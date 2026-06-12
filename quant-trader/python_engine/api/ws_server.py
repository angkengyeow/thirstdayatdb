"""
ws_server.py — WebSocket server for real-time streaming.

Streams live data to frontend clients:
  - Price ticks (Bar objects)
  - Trading signals (BUY/SELL/HOLD)
  - Order fills
  - Portfolio snapshots

WebSocket endpoint: ws://host:8000/api/ws/{client_id}

Subscribe to channels via JSON message:
  {"subscribe": ["prices", "signals", "fills", "portfolio"]}
"""

from __future__ import annotations
import asyncio
import json
import logging
import time
import uuid
from typing import Any, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .. import engine_instance as engine
from ..monitoring.metrics import METRICS

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── Connection Manager ───────────────────────────────────────────────────────

class ConnectionManager:
    """Manages WebSocket connections and channel subscriptions."""

    def __init__(self):
        self._connections: dict[str, WebSocket] = {}
        self._subscriptions: dict[str, set[str]] = {}  # client_id -> {channels}
        self._broadcast_tasks: list[asyncio.Task] = []

    async def connect(self, client_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections[client_id] = ws
        self._subscriptions[client_id] = {"prices", "signals", "fills", "portfolio"}
        logger.info("WebSocket connected: %s (total: %d)", client_id, len(self._connections))
        METRICS["ws_connections"].inc()

    def disconnect(self, client_id: str) -> None:
        self._connections.pop(client_id, None)
        self._subscriptions.pop(client_id, None)
        logger.info("WebSocket disconnected: %s (remaining: %d)", client_id, len(self._connections))

    async def handle_message(self, client_id: str, data: dict) -> None:
        subs = data.get("subscribe")
        if isinstance(subs, list):
            self._subscriptions[client_id] = set(subs)
            await self._send(client_id, {"type": "subscribed", "channels": subs})

    async def broadcast(self, channel: str, payload: dict) -> None:
        dead_clients = []
        for cid, ws in self._connections.items():
            if channel in self._subscriptions.get(cid, set()):
                try:
                    await ws.send_json({"channel": channel, "data": payload, "ts": time.time()})
                except Exception:
                    dead_clients.append(cid)
        for cid in dead_clients:
            self.disconnect(cid)

    async def _send(self, client_id: str, payload: dict) -> None:
        ws = self._connections.get(client_id)
        if ws:
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(client_id)


manager = ConnectionManager()


# ─── WebSocket Endpoint ───────────────────────────────────────────────────────

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(ws: WebSocket, client_id: str = ""):
    if not client_id:
        client_id = str(uuid.uuid4())[:8]
    await manager.connect(client_id, ws)
    try:
        await ws.send_json({
            "type": "connected",
            "client_id": client_id,
            "channels": list(manager._subscriptions.get(client_id, [])),
            "ts": time.time(),
        })
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
                await manager.handle_message(client_id, data)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "Invalid JSON"})
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(client_id)


# ─── Broadcasting helpers (called from engine) ────────────────────────────────

async def broadcast_bar(bar) -> None:
    """Broadcast a new OHLCV bar to price subscribers."""
    await manager.broadcast("prices", {
        "symbol": bar.symbol,
        "timestamp": bar.timestamp.isoformat(),
        "open": bar.open,
        "high": bar.high,
        "low": bar.low,
        "close": bar.close,
        "volume": bar.volume,
    })


async def broadcast_signal(signal) -> None:
    """Broadcast a trading signal."""
    await manager.broadcast("signals", {
        "symbol": signal.symbol,
        "signal_type": signal.signal_type.value,
        "price": signal.price,
        "confidence": signal.confidence,
        "strategy_id": signal.strategy_id,
        "reason": signal.reason,
        "timestamp": signal.timestamp.isoformat(),
    })


async def broadcast_fill(order) -> None:
    """Broadcast an order fill."""
    req = order.request
    await manager.broadcast("fills", {
        "order_id": order.order_id,
        "symbol": req.symbol,
        "side": req.side.value,
        "quantity": order.filled_qty,
        "price": order.avg_fill_price,
        "status": order.status.value,
        "timestamp": (order.filled_at or order.submitted_at).isoformat(),
    })


async def broadcast_portfolio(snapshot) -> None:
    """Broadcast a portfolio snapshot (periodic)."""
    await manager.broadcast("portfolio", {
        "timestamp": snapshot.timestamp.isoformat(),
        "cash": round(snapshot.cash, 2),
        "equity": round(snapshot.total_equity, 2),
        "unrealised_pnl": round(snapshot.unrealised_pnl, 2),
        "realised_pnl": round(snapshot.realised_pnl, 2),
        "open_positions": len(snapshot.positions),
        "max_drawdown_pct": round(snapshot.max_drawdown_pct * 100, 2),
    })