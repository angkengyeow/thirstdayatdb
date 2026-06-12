"""
server.py — FastAPI application factory for QuantexPro.

Creates the FastAPI app, registers all routers, and wires middleware
(metrics, CORS, structured logging, authentication).

Start with:
    uvicorn python_engine.api.server:app --host 0.0.0.0 --port 8000

Or via Docker:
    docker compose up -d
"""

from __future__ import annotations
import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

_request_times: list[float] = []


# ─── Lifecycle ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup & shutdown hooks."""
    from ..config import cfg
    from .. import engine_instance

    logger.info("=" * 60)
    logger.info("QuantexPro API Server v2.5.0 starting...")
    logger.info("Mode: %s | Symbol: %s | Strategy: %s", cfg.mode.value, cfg.symbol, cfg.strategy)
    logger.info("=" * 60)

    # Initialise DB tables if needed
    try:
        from ..db.base import init_db
        init_db()
        logger.info("Database tables initialised")
    except Exception as exc:
        logger.warning("Database init skipped: %s", exc)

    # Initialise scheduler if enabled
    try:
        from ..scheduler.scheduler import get_scheduler
        sched = get_scheduler()
        sched.start()
        logger.info("Scheduler started")
    except Exception as exc:
        logger.info("Scheduler not started: %s", exc)

    yield

    # Shutdown: stop engine and scheduler
    if engine_instance and getattr(engine_instance, "_running", False):
        engine_instance.stop()
        logger.info("Trading engine stopped")
    try:
        from ..scheduler.scheduler import get_scheduler
        get_scheduler().shutdown()
    except Exception:
        pass
    logger.info("QuantexPro API Server shut down")


# ─── App Factory ──────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title="QuantexPro Trading Engine API",
        version="2.5.0",
        description="Enterprise-grade algorithmic trading engine REST API",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ── Middleware ───────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # restrict in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_timing(request: Request, call_next):
        t0 = time.time()
        response = await call_next(request)
        duration = (time.time() - t0) * 1000
        _request_times.append(duration)
        if len(_request_times) > 1000:
            _request_times.pop(0)
        response.headers["X-Response-Time-Ms"] = f"{duration:.1f}"
        logger.debug("%s %s → %d (%.1f ms)", request.method, request.url.path, response.status_code, duration)
        return response

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error", "path": request.url.path})

    # ── Register Routers ─────────────────────────────────────────────────────
    from .routes.engine import router as engine_router
    from .routes.portfolio import router as portfolio_router
    from .routes.admin import router as admin_router
    from .ws_server import router as ws_router

    app.include_router(engine_router, prefix="/api")
    app.include_router(portfolio_router, prefix="/api")
    app.include_router(admin_router, prefix="/api")
    app.include_router(ws_router, prefix="/api")

    return app


# ── Instantiate ───────────────────────────────────────────────────────────────
app = create_app()