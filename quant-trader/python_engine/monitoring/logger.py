"""
logger.py — Structured JSON logging configuration.

Configures Python logging to emit JSON-formatted log records for
shipment to ELK, Loki, CloudWatch, or any log aggregator.

Production: JSON output to stdout
Development: Human-readable console output (rich log formatting)

Usage:
    from .logger import setup_logging
    setup_logging()
"""

from __future__ import annotations
import json
import logging
import logging.config
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any


class JSONFormatter(logging.Formatter):
    """Log formatter that outputs JSON lines."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = self.formatException(record.exc_info)
        if hasattr(record, "extra"):
            log_entry["extra"] = record.extra
        return json.dumps(log_entry, default=str)


def setup_logging() -> None:
    """Configure structured logging based on LOG_LEVEL env var."""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    use_json = os.getenv("LOG_FORMAT", "json" if os.getenv("PRODUCTION") else "console").lower() == "json"

    handlers: dict[str, Any] = {
        "console": {
            "class": "logging.StreamHandler",
            "stream": sys.stdout,
            "formatter": "json" if use_json else "colored",
        }
    }

    formatters: dict[str, Any] = {
        "json": {
            "()": JSONFormatter,
        },
        "colored": {
            "format": "%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
            "datefmt": "%Y-%m-%dT%H:%M:%S",
        },
    }

    logging.config.dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": formatters,
        "handlers": handlers,
        "root": {
            "level": log_level,
            "handlers": ["console"],
        },
        "loggers": {
            "uvicorn": {"level": "WARNING", "handlers": ["console"], "propagate": False},
            "httpx": {"level": "WARNING", "handlers": ["console"], "propagate": False},
            "websockets": {"level": "WARNING", "handlers": ["console"], "propagate": False},
            "apscheduler": {"level": "WARNING", "handlers": ["console"], "propagate": False},
        },
    })

    logger = logging.getLogger("quantexpro")
    logger.info("Structured logging initialised (format=%s, level=%s)",
                "json" if use_json else "colored", log_level)