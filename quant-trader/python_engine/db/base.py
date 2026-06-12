"""
base.py — SQLAlchemy engine, session factory, and base model.

Designed for:
  - PostgreSQL (production) with TimescaleDB extension
  - SQLite (development/testing) via DATABASE_URL=sqlite:///data/quantex.db

Usage:
    from .base import get_session
    with get_session() as session:
        trades = session.query(TradeModel).all()
"""

from __future__ import annotations
import logging
import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

logger = logging.getLogger(__name__)

# ── Connection ────────────────────────────────────────────────────────────────

def _build_url() -> str:
    """Build DATABASE_URL from components or use env var."""
    url = os.getenv("DATABASE_URL", "")
    if url:
        return url
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "quantexpro")
    user = os.getenv("DB_USER", "quantex")
    pw   = os.getenv("DB_PASSWORD", "quantex")
    return f"postgresql://{user}:{pw}@{host}:{port}/{name}"

DATABASE_URL = _build_url()
_echo = os.getenv("DB_ECHO", "0") == "1"

engine = create_engine(
    DATABASE_URL,
    echo=_echo,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── Base Model ────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


# ── Session Management ────────────────────────────────────────────────────────

@contextmanager
def get_session() -> Generator[Session, None, None]:
    """Context manager for database sessions with automatic close."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db() -> None:
    """Create all tables. Safe to call multiple times (uses IF NOT EXISTS)."""
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified at %s", DATABASE_URL.replace(
        os.getenv("DB_PASSWORD", ""), "****"
    ))