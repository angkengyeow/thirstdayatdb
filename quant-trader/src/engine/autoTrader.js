// Auto-trading engine — stateless signal processor
import { runStrategy } from '../data/marketData';

export const AUTO_MODES = {
  CONSERVATIVE: { riskPct: 0.02, stopLoss: 0.015, takeProfit: 0.04, label: 'Conservative', color: '#74b9ff', maxPositions: 3 },
  BALANCED:     { riskPct: 0.05, stopLoss: 0.025, takeProfit: 0.07, label: 'Balanced',     color: '#00d4ff', maxPositions: 5 },
  AGGRESSIVE:   { riskPct: 0.10, stopLoss: 0.04,  takeProfit: 0.12, label: 'Aggressive',   color: '#ff6b35', maxPositions: 8 },
};

// Default watchlist groupings
export const WATCHLISTS = {
  FOCUSED:  { label: 'Focused (1)', symbols: [] },         // filled dynamically from selected symbol
  CRYPTO:   { label: 'Crypto (2)', symbols: ['BTC/USD', 'ETH/USD'] },
  EQUITIES: { label: 'Equities (5)', symbols: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN'] },
  ALL:      { label: 'All Markets (10)', symbols: ['BTC/USD','ETH/USD','AAPL','TSLA','SPY','QQQ','NVDA','MSFT','AMZN','GLD'] },
};

export function createPortfolio(startingCash = 100000) {
  return {
    cash: startingCash,
    startingCash,
    positions: {},      // symbol -> { qty, entryPrice, entryTime }
    closedTrades: [],
    totalPnl: 0,
    equityCurve: [{ time: new Date().toISOString(), value: startingCash }],
  };
}

// Process a single symbol tick — pure, returns new portfolio + events
export function processTick({ portfolio, candles, symbol, strategy, mode }) {
  const cfg = AUTO_MODES[mode] || AUTO_MODES.BALANCED;
  const events = [];
  const p = {
    ...portfolio,
    positions: { ...portfolio.positions },
    closedTrades: [...portfolio.closedTrades],
    equityCurve: portfolio.equityCurve,
  };

  const signals = runStrategy(candles, strategy);
  const latest = signals[signals.length - 1];
  const currentPrice = candles[candles.length - 1]?.close;
  if (!currentPrice) return { portfolio: p, events };

  const pos = p.positions[symbol];
  const openCount = Object.keys(p.positions).length;

  // Check stop loss / take profit on open position
  if (pos) {
    const pricePct = (currentPrice - pos.entryPrice) / pos.entryPrice;
    let closeReason = null;

    if (pricePct <= -cfg.stopLoss) closeReason = `SL ${(cfg.stopLoss * 100).toFixed(1)}%`;
    else if (pricePct >= cfg.takeProfit) closeReason = `TP ${(cfg.takeProfit * 100).toFixed(1)}%`;
    else if (latest?.signal === 'SELL') closeReason = `SELL signal`;

    if (closeReason) {
      const pnl = (currentPrice - pos.entryPrice) * pos.qty;
      p.cash += currentPrice * pos.qty;
      p.totalPnl += pnl;
      p.closedTrades.push({
        symbol,
        entry: pos.entryPrice,
        exit: currentPrice,
        qty: pos.qty,
        pnl: +pnl.toFixed(2),
        pct: +((currentPrice - pos.entryPrice) / pos.entryPrice * 100).toFixed(2),
        time: new Date().toISOString(),
        reason: closeReason,
      });
      delete p.positions[symbol];
      events.push({ type: 'CLOSE', symbol, price: currentPrice, pnl: +pnl.toFixed(2), reason: closeReason });
    }
  }

  // Open new position on BUY signal if under max positions cap
  if (!p.positions[symbol] && latest?.signal === 'BUY' && openCount < cfg.maxPositions) {
    const allocate = p.cash * cfg.riskPct;
    const qty = +(allocate / currentPrice).toFixed(6);
    if (qty > 0 && p.cash >= qty * currentPrice) {
      p.cash -= qty * currentPrice;
      p.positions[symbol] = { qty, entryPrice: currentPrice, entryTime: new Date().toISOString() };
      events.push({ type: 'BUY', symbol, price: currentPrice, qty, reason: latest.reason });
    }
  }

  return { portfolio: p, events };
}

export function getPortfolioValue(portfolio, prices) {
  const positionsValue = Object.entries(portfolio.positions).reduce((acc, [sym, pos]) => {
    return acc + (prices[sym] || pos.entryPrice) * pos.qty;
  }, 0);
  return portfolio.cash + positionsValue;
}

export function getOpenPnl(portfolio, prices) {
  return Object.entries(portfolio.positions).reduce((acc, [sym, pos]) => {
    const cur = prices[sym] || pos.entryPrice;
    return acc + (cur - pos.entryPrice) * pos.qty;
  }, 0);
}

export function getSymbolAllocation(portfolio, prices) {
  const total = getPortfolioValue(portfolio, prices);
  return Object.entries(portfolio.positions).map(([sym, pos]) => {
    const value = (prices[sym] || pos.entryPrice) * pos.qty;
    return { symbol: sym, value: +value.toFixed(2), pct: +((value / total) * 100).toFixed(1) };
  });
}
