"""
alerts.py — Multi-channel alerting for critical trading events.

Channels:
  - Telegram Bot
  - Discord Webhook
  - Slack Webhook
  - Log file (always)

Each function is a no-op if the corresponding credentials are not configured.
All alerts fire at most once per cooldown period to prevent spam.
"""

from __future__ import annotations
import logging
import os
import time
from typing import Optional

import requests

logger = logging.getLogger(__name__)

# ── Cooldown tracker ──────────────────────────────────────────────────────────
_last_alert: dict[str, float] = {}
_ALERT_COOLDOWN_S = 60  # minimum seconds between identical alerts


def _should_alert(key: str) -> bool:
    now = time.time()
    if now - _last_alert.get(key, 0) < _ALERT_COOLDOWN_S:
        return False
    _last_alert[key] = now
    return True


# ── Telegram ──────────────────────────────────────────────────────────────────

def _send_telegram(message: str) -> bool:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return False
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"},
            timeout=10,
        )
        r.raise_for_status()
        logger.debug("Telegram alert sent: %s", message[:60])
        return True
    except Exception as exc:
        logger.warning("Telegram alert failed: %s", exc)
        return False


# ── Discord ───────────────────────────────────────────────────────────────────

def _send_discord(message: str) -> bool:
    webhook = os.getenv("DISCORD_WEBHOOK_URL", "")
    if not webhook:
        return False
    try:
        r = requests.post(
            webhook,
            json={"content": f"```\n{message}\n```"},
            timeout=10,
        )
        r.raise_for_status()
        return True
    except Exception as exc:
        logger.warning("Discord alert failed: %s", exc)
        return False


# ── Slack ─────────────────────────────────────────────────────────────────────

def _send_slack(message: str) -> bool:
    webhook = os.getenv("SLACK_WEBHOOK_URL", "")
    if not webhook:
        return False
    try:
        r = requests.post(
            webhook,
            json={"text": f"*QuantexPro Alert:*\n{message}"},
            timeout=10,
        )
        r.raise_for_status()
        return True
    except Exception as exc:
        logger.warning("Slack alert failed: %s", exc)
        return False


# ── Public alerting interface ─────────────────────────────────────────────────

def send_alert(key: str, subject: str, details: str = "") -> None:
    """Send an alert across all configured channels.

    Args:
        key: Unique alert key for cooldown dedup (e.g. "drawdown", "kill_switch")
        subject: Short one-line subject
        details: Optional multi-line details
    """
    if not _should_alert(key):
        return

    message = f"🚨 <b>QuantexPro Alert</b>\n{subject}"
    if details:
        message += f"\n<pre>{details}</pre>"

    logger.warning("ALERT [%s]: %s", key, subject)
    _send_telegram(message)
    _send_discord(subject)
    _send_slack(subject)


def send_fill_alert(symbol: str, side: str, qty: float, price: float, pnl: float = 0.0) -> None:
    """Send an alert for a filled order."""
    subject = f"{side} {symbol} qty={qty:.4f} @ ${price:.2f}"
    details = f"PnL: ${pnl:+.2f}" if pnl else ""
    send_alert(f"fill_{symbol}_{side}_{int(time.time()/60)}", subject, details)


def send_drawdown_alert(drawdown_pct: float, limit_pct: float) -> None:
    """Send an alert when drawdown crosses a threshold."""
    send_alert(
        f"drawdown_{int(drawdown_pct * 10)}",
        f"⚠️ Drawdown Alert: {drawdown_pct:.1f}% (limit: {limit_pct:.1f}%)",
        "Risk manager kill-switch may trigger soon. Review open positions."
    )


def send_kill_switch_alert() -> None:
    """Send an immediate alert when the risk kill-switch is triggered."""
    send_alert(
        "kill_switch",
        "🚫 RISK KILL-SWITCH ACTIVATED — All new positions halted",
        "Max drawdown limit breached. Manual intervention required."
    )


def send_startup_alert(mode: str, symbol: str, strategy: str) -> None:
    """Send a startup notification."""
    send_alert(
        "startup",
        f"✅ Engine started — Mode: {mode} | Symbol: {symbol} | Strategy: {strategy}",
    )


def send_error_alert(error_msg: str) -> None:
    """Send an alert for unhandled engine errors."""
    send_alert("engine_error", f"❌ Engine Error: {error_msg[:200]}")