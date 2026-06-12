# ─────────────────────────────────────────────────────────────────────────────
# QuantexPro Engine — Build & Automation Makefile
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: install test lint clean run-api run-backtest docker-build

# ── Dependencies ──────────────────────────────────────────────────────────────

install:
	pip install -r requirements.txt

install-dev: install
	pip install pytest-cov mypy flake8

# ── Quality ───────────────────────────────────────────────────────────────────

lint:
	flake8 . --max-line-length=100 --extend-ignore=E203,W503,W504
	mypy . --ignore-missing-imports --strict-optional

test:
	python -m pytest tests/ -v --cov=./ --cov-report=term --cov-fail-under=70 --ignore=api --ignore=db --ignore=monitoring --ignore=scheduler

test-benchmark:
	python -m pytest tests/ -v --benchmark-only

test-ci: lint test

# ── Run ───────────────────────────────────────────────────────────────────────

run-backtest:
	python -m main

run-api:
	uvicorn api.server:app --host 0.0.0.0 --port 8000 --reload --log-level info

# ── Docker ────────────────────────────────────────────────────────────────────

docker-build:
	docker build -t quantex-engine -f ../Dockerfile.engine ..
	docker build -t quantex-web -f ../Dockerfile.web ..

docker-run:
	docker compose -f ../docker-compose.yml -f ../docker-compose.dev.yml up -d

docker-stop:
	docker compose -f ../docker-compose.yml down

docker-logs:
	docker compose logs -f engine

# ── Cleanup ───────────────────────────────────────────────────────────────────

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name '*.pyc' -delete
	rm -rf .pytest_cache .mypy_cache .benchmarks coverage.xml

.PHONY: help
help:
	@echo "QuantexPro Engine Makefile"
	@echo "  install         — Install dependencies"
	@echo "  test            — Run tests with coverage"
	@echo "  lint            — Run linters (flake8 + mypy)"
	@echo "  run-backtest    — Run a backtest with synthetic data"
	@echo "  run-api         — Start the FastAPI server"
	@echo "  docker-build    — Build Docker images"
	@echo "  docker-run      — Start full stack via Docker Compose"