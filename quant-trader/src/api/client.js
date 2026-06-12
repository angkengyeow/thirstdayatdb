// api/client.js — QuantexPro Backend API Client
// Connects the React UI to the FastAPI backend

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiClient {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
    this._abortControllers = new Map();
  }

  async _fetch(endpoint, options = {}) {
    const url = `${this.baseUrl}/api${endpoint}`;
    const controller = new AbortController();
    const { timeout = 15000, ...fetchOpts } = options;

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        ...fetchOpts,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOpts.headers,
        },
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`API ${res.status}: ${errBody.slice(0, 200)}`);
      }
      return res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ── Engine Control ──────────────────────────────────────────────────────────

  async getStatus() {
    return this._fetch('/engine/status');
  }

  async startEngine() {
    return this._fetch('/engine/start', { method: 'POST' });
  }

  async stopEngine() {
    return this._fetch('/engine/stop', { method: 'POST' });
  }

  async setStrategy(strategy, symbol, params = {}) {
    return this._fetch('/engine/strategy', {
      method: 'POST',
      body: JSON.stringify({ strategy, symbol, params }),
    });
  }

  async runBacktest(symbol, strategy, opts = {}) {
    return this._fetch('/engine/backtest', {
      method: 'POST',
      body: JSON.stringify({
        symbol,
        strategy,
        starting_cash: opts.cash || 100000,
        bar_count: opts.bars || 300,
        risk_config: opts.risk || null,
        strategy_params: opts.params || {},
      }),
    });
  }

  // ── Portfolio ───────────────────────────────────────────────────────────────

  async getPortfolio() {
    return this._fetch('/portfolio');
  }

  async getTrades(page = 1, pageSize = 50, filters = {}) {
    const params = new URLSearchParams({ page, page_size: pageSize, ...filters });
    return this._fetch(`/trades?${params}`);
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  async getHealth() {
    return this._fetch('/health');
  }

  async getConfig() {
    return this._fetch('/config');
  }

  async getSignals(limit = 50) {
    return this._fetch(`/signals?limit=${limit}`);
  }

  async getRejections() {
    return this._fetch('/rejections');
  }

  async getMetrics() {
    return this._fetch('/metrics');
  }
}

export const api = new ApiClient();
export default ApiClient;