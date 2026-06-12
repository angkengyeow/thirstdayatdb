// Simulated market data engine

export const SYMBOLS = ['BTC/USD', 'ETH/USD', 'AAPL', 'TSLA', 'SPY', 'QQQ', 'NVDA', 'MSFT', 'AMZN', 'GLD'];

export const BASE_PRICES = {
  'BTC/USD': 67420.50,
  'ETH/USD': 3842.10,
  'AAPL': 189.45,
  'TSLA': 248.90,
  'SPY': 531.20,
  'QQQ': 462.80,
  'NVDA': 875.30,
  'MSFT': 415.60,
  'AMZN': 192.40,
  'GLD': 218.75,
};

export const VOLATILITY = {
  'BTC/USD': 0.008,
  'ETH/USD': 0.01,
  'AAPL': 0.003,
  'TSLA': 0.006,
  'SPY': 0.002,
  'QQQ': 0.0025,
  'NVDA': 0.007,
  'MSFT': 0.003,
  'AMZN': 0.004,
  'GLD': 0.002,
};

// Generate OHLCV candle data
export function generateCandles(symbol, count = 100) {
  const vol = VOLATILITY[symbol] || 0.003;
  let price = BASE_PRICES[symbol] || 100;
  const candles = [];
  const now = Date.now();
  const interval = 5 * 60 * 1000; // 5 min

  for (let i = count; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.49) * vol * price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * vol * price * 0.5;
    const low = Math.min(open, close) - Math.random() * vol * price * 0.5;
    const volume = Math.floor(Math.random() * 10000 + 1000);
    candles.push({
      time: new Date(now - i * interval).toISOString(),
      timestamp: now - i * interval,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume,
    });
    price = close;
  }
  return candles;
}

// Technical indicators
export function calcSMA(data, period) {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b.close, 0) / period;
  });
}

export function calcEMA(data, period) {
  const k = 2 / (period + 1);
  const result = [];
  let ema = data[0]?.close || 0;
  data.forEach((d, i) => {
    if (i === 0) { result.push(d.close); return; }
    ema = d.close * k + ema * (1 - k);
    result.push(+ema.toFixed(2));
  });
  return result;
}

export function calcRSI(data, period = 14) {
  const result = new Array(period).fill(null);
  for (let i = period; i < data.length; i++) {
    const slice = data.slice(i - period, i);
    let gains = 0, losses = 0;
    for (let j = 1; j < slice.length; j++) {
      const diff = slice[j].close - slice[j - 1].close;
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const rs = gains / (losses || 0.001);
    result.push(+(100 - 100 / (1 + rs)).toFixed(2));
  }
  return result;
}

export function calcBollingerBands(data, period = 20) {
  const sma = calcSMA(data, period);
  return data.map((_, i) => {
    if (i < period - 1) return { upper: null, middle: null, lower: null };
    const slice = data.slice(i - period + 1, i + 1);
    const mean = sma[i];
    const std = Math.sqrt(slice.reduce((acc, d) => acc + Math.pow(d.close - mean, 2), 0) / period);
    return {
      upper: +(mean + 2 * std).toFixed(2),
      middle: +mean.toFixed(2),
      lower: +(mean - 2 * std).toFixed(2),
    };
  });
}

export function calcMACD(data, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = calcEMA(data, fast);
  const emaSlow = calcEMA(data, slow);
  const macdLine = emaFast.map((f, i) => +(f - emaSlow[i]).toFixed(4));

  // Compute signal line as EMA of MACD line
  const k = 2 / (signalPeriod + 1);
  const signalLine = [];
  let sig = macdLine[0];
  macdLine.forEach((m, i) => {
    if (i === 0) { signalLine.push(m); return; }
    sig = m * k + sig * (1 - k);
    signalLine.push(+sig.toFixed(4));
  });

  return macdLine.map((m, i) => ({
    macd: m,
    signal: signalLine[i],
    histogram: +(m - signalLine[i]).toFixed(4),
  }));
}

// Average True Range for volatility filter
export function calcATR(data, period = 14) {
  const trs = data.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = data[i - 1];
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  });
  return trs.map((_, i) => {
    if (i < period - 1) return null;
    return +(trs.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period).toFixed(4);
  });
}

// Volume moving average
export function calcVolumeSMA(data, period = 20) {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    return data.slice(i - period + 1, i + 1).reduce((a, b) => a + b.volume, 0) / period;
  });
}

// Strategy signals
export function runStrategy(candles, strategyType) {
  const sma20 = calcSMA(candles, 20);
  const sma50 = calcSMA(candles, 50);
  const rsi = calcRSI(candles, 14);
  const bb = calcBollingerBands(candles, 20);
  const macd = calcMACD(candles, 12, 26, 9);
  const atr = calcATR(candles, 14);
  const volSMA = calcVolumeSMA(candles, 20);
  const signals = [];

  for (let i = 51; i < candles.length; i++) {
    const c = candles[i];
    let signal = null;
    let reason = '';
    let confidence = 0;

    if (strategyType === 'momentum') {
      if (sma20[i] > sma50[i] && sma20[i - 1] <= sma50[i - 1]) {
        signal = 'BUY'; reason = 'SMA20 crossed above SMA50';
      } else if (sma20[i] < sma50[i] && sma20[i - 1] >= sma50[i - 1]) {
        signal = 'SELL'; reason = 'SMA20 crossed below SMA50';
      }

    } else if (strategyType === 'mean_reversion') {
      if (rsi[i] < 30 && c.close < bb[i].lower) {
        signal = 'BUY'; reason = 'RSI oversold + below lower BB';
      } else if (rsi[i] > 70 && c.close > bb[i].upper) {
        signal = 'SELL'; reason = 'RSI overbought + above upper BB';
      }

    } else if (strategyType === 'breakout') {
      const recent = candles.slice(i - 10, i);
      const maxHigh = Math.max(...recent.map(r => r.high));
      const minLow = Math.min(...recent.map(r => r.low));
      if (c.close > maxHigh * 1.005) { signal = 'BUY'; reason = '10-bar high breakout'; }
      else if (c.close < minLow * 0.995) { signal = 'SELL'; reason = '10-bar low breakdown'; }

    } else if (strategyType === 'multi_factor') {
      // ── MULTI-FACTOR CONFLUENCE STRATEGY ──────────────────────────────────
      // Requires 3-of-4 factor agreement for entry — filters out most noise.
      //
      // Factor 1: MACD bullish/bearish crossover
      const macdBull = macd[i].macd > macd[i].signal && macd[i - 1].macd <= macd[i - 1].signal;
      const macdBear = macd[i].macd < macd[i].signal && macd[i - 1].macd >= macd[i - 1].signal;

      // Factor 2: RSI not overbought/oversold at entry (40–62 sweet spot for buys)
      const rsiOk = rsi[i] !== null && rsi[i] > 40 && rsi[i] < 62;
      const rsiSellOk = rsi[i] !== null && rsi[i] > 55;

      // Factor 3: Price above / below short-term trend (SMA20)
      const priceAboveTrend = c.close > sma20[i];
      const priceBelowTrend = c.close < sma20[i];

      // Factor 4: Above-average volume confirms conviction
      const volSpike = volSMA[i] !== null && c.volume > volSMA[i] * 1.2;

      // Factor 5: Positive MACD histogram (momentum accelerating)
      const histAccel = macd[i].histogram > 0 && macd[i].histogram > macd[i - 1].histogram;
      const histDecel = macd[i].histogram < 0 && macd[i].histogram < macd[i - 1].histogram;

      // Count bullish factors
      const bullFactors = [macdBull, rsiOk, priceAboveTrend, volSpike, histAccel].filter(Boolean).length;
      const bearFactors = [macdBear, rsiSellOk, priceBelowTrend, volSpike, histDecel].filter(Boolean).length;

      if (bullFactors >= 3) {
        signal = 'BUY';
        const reasons = [];
        if (macdBull) reasons.push('MACD cross↑');
        if (rsiOk) reasons.push(`RSI ${rsi[i]}`);
        if (priceAboveTrend) reasons.push('above SMA20');
        if (volSpike) reasons.push('vol spike');
        if (histAccel) reasons.push('hist accel');
        reason = reasons.join(' · ');
        confidence = bullFactors;
      } else if (bearFactors >= 3) {
        signal = 'SELL';
        const reasons = [];
        if (macdBear) reasons.push('MACD cross↓');
        if (rsiSellOk) reasons.push(`RSI ${rsi[i]}`);
        if (priceBelowTrend) reasons.push('below SMA20');
        if (volSpike) reasons.push('vol spike');
        if (histDecel) reasons.push('hist decel');
        reason = reasons.join(' · ');
        confidence = bearFactors;
      }
    }

    if (signal) signals.push({ ...c, signal, reason, price: c.close, confidence });
  }
  return signals;
}

// Portfolio simulation
export function runBacktest(candles, signals) {
  let cash = 100000;
  let position = 0;
  let entryPrice = 0;
  const equity = [];
  const trades = [];

  candles.forEach((c, i) => {
    const sig = signals.find(s => s.timestamp === c.timestamp);
    if (sig && sig.signal === 'BUY' && position === 0) {
      const qty = Math.floor(cash * 0.95 / c.close);
      position = qty;
      entryPrice = c.close;
      cash -= qty * c.close;
    } else if (sig && sig.signal === 'SELL' && position > 0) {
      const pnl = (c.close - entryPrice) * position;
      trades.push({
        entry: entryPrice,
        exit: c.close,
        qty: position,
        pnl: +pnl.toFixed(2),
        pct: +((c.close - entryPrice) / entryPrice * 100).toFixed(2),
        time: c.time,
      });
      cash += position * c.close;
      position = 0;
    }
    equity.push({ time: c.time, timestamp: c.timestamp, value: +(cash + position * c.close).toFixed(2) });
  });

  const totalReturn = ((equity[equity.length - 1]?.value || 100000) / 100000 - 1) * 100;
  const winTrades = trades.filter(t => t.pnl > 0);
  const winRate = trades.length ? (winTrades.length / trades.length * 100).toFixed(1) : 0;
  const maxDrawdown = calcMaxDrawdown(equity);
  const sharpe = calcSharpe(equity);

  return { equity, trades, totalReturn: +totalReturn.toFixed(2), winRate, maxDrawdown, sharpe, tradeCount: trades.length };
}

function calcMaxDrawdown(equity) {
  let peak = equity[0]?.value || 0;
  let maxDD = 0;
  equity.forEach(e => {
    if (e.value > peak) peak = e.value;
    const dd = (peak - e.value) / peak * 100;
    if (dd > maxDD) maxDD = dd;
  });
  return +maxDD.toFixed(2);
}

function calcSharpe(equity) {
  if (equity.length < 2) return 0;
  const returns = equity.slice(1).map((e, i) => (e.value - equity[i].value) / equity[i].value);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length);
  return std ? +(mean / std * Math.sqrt(252 * 78)).toFixed(2) : 0;
}
