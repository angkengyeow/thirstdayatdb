import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {
  Activity, Settings, ChevronDown,
  Zap, Bell, Shield, BarChart2, Bot,
} from 'lucide-react';
import Ticker from './components/Ticker';
import PriceChart from './components/PriceChart';
import RSIChart from './components/RSIChart';
import MACDChart from './components/MACDChart';
import OrderBook from './components/OrderBook';
import TradeLog from './components/TradeLog';
import MetricsBar from './components/MetricsBar';
import StrategyPanel from './components/StrategyPanel';
import AutoTradePanel from './components/AutoTradePanel';

const EquityChart = lazy(() => import('./components/EquityChart'));
const BlueprintPage = lazy(() => import('./components/BlueprintPage'));
const LiveDashboard = lazy(() => import('./components/LiveDashboard'));
const StrategyComparison = lazy(() => import('./components/StrategyComparison'));
import { SYMBOLS, BASE_PRICES, VOLATILITY, generateCandles, runStrategy, runBacktest } from './data/marketData';
import { createPortfolio, processTick, WATCHLISTS } from './engine/autoTrader';
import './index.css';

const TABS = ['CHART', 'BACKTEST', 'ORDERBOOK', 'TRADES', 'LIVE ENGINE', 'COMPARE', 'BLUEPRINT'];

export default function App() {
  const [activeTab, setActiveTab] = useState('CHART');
  const [symbol, setSymbol] = useState('BTC/USD');
  const [strategy, setStrategy] = useState('momentum');
  const [candles, setCandles] = useState(() => generateCandles('BTC/USD', 100));
  const [signals, setSignals] = useState([]);
  const [backtestResult, setBacktestResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [livePrice, setLivePrice] = useState(BASE_PRICES['BTC/USD']);
  const [liveOrders, setLiveOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [symbolOpen, setSymbolOpen] = useState(false);
  const liveRef = useRef(null);

  // Auto-trade state
  const [isAuto, setIsAuto] = useState(false);
  const [autoMode, setAutoMode] = useState('BALANCED');
  const [watchlist, setWatchlist] = useState('FOCUSED');
  const [portfolio, setPortfolio] = useState(() => createPortfolio(100000));
  const [eventLog, setEventLog] = useState([]);
  const [allPrices, setAllPrices] = useState({ ...BASE_PRICES });
  // Multi-symbol candle state: { [sym]: candle[] }
  const [multiCandles, setMultiCandles] = useState(() => {
    const init = {};
    SYMBOLS.forEach(s => { init[s] = generateCandles(s, 100); });
    return init;
  });
  const [rightPanel, setRightPanel] = useState('signals'); // 'signals' | 'auto'
  const autoRef = useRef(null);

  // Live price feed — also tracks all prices for portfolio valuation
  useEffect(() => {
    const interval = setInterval(() => {
      setLivePrice(prev => {
        const vol = VOLATILITY[symbol] || 0.003;
        const delta = (Math.random() - 0.49) * vol * prev;
        const next = +(prev + delta).toFixed(2);
        setAllPrices(p => ({ ...p, [symbol]: next }));
        return next;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [symbol]);

  // Auto-trading engine — multi-symbol, fires on each tick
  useEffect(() => {
    if (!isAuto) return;
    const activeSymbols = watchlist === 'FOCUSED'
      ? [symbol]
      : (WATCHLISTS[watchlist]?.symbols || [symbol]);

    autoRef.current = setInterval(() => {
      setMultiCandles(prevAll => {
        const nextAll = { ...prevAll };
        const newEvents = [];
        let latestPortfolio = null;

        activeSymbols.forEach(sym => {
          const prevCandles = prevAll[sym] || generateCandles(sym, 100);
          const last = prevCandles[prevCandles.length - 1];
          const vol = VOLATILITY[sym] || 0.003;
          const change = (Math.random() - 0.49) * vol * last.close;
          const newClose = +(last.close + change).toFixed(2);
          const newCandle = {
            ...last,
            timestamp: last.timestamp + 300000,
            time: new Date(last.timestamp + 300000).toISOString(),
            open: last.close,
            close: newClose,
            high: Math.max(last.close, newClose) + Math.random() * vol * last.close * 0.2,
            low: Math.min(last.close, newClose) - Math.random() * vol * last.close * 0.2,
            volume: Math.floor(Math.random() * 5000 + 500),
          };
          nextAll[sym] = [...prevCandles.slice(-99), newCandle];
          // Update allPrices for this symbol
          setAllPrices(p => ({ ...p, [sym]: newClose }));
          // Also update main chart candles if this is the viewed symbol
          if (sym === symbol) {
            setCandles(nextAll[sym]);
          }
        });

        // Process portfolio ticks for all active symbols sequentially
        setPortfolio(prevPortfolio => {
          let p = prevPortfolio;
          activeSymbols.forEach(sym => {
            const result = processTick({ portfolio: p, candles: nextAll[sym], symbol: sym, strategy, mode: autoMode });
            p = result.portfolio;
            newEvents.push(...result.events);
          });
          if (newEvents.length > 0) {
            setEventLog(prev => [...prev, ...newEvents].slice(-200));
            const lastEv = newEvents[newEvents.length - 1];
            const note = {
              id: Date.now(),
              msg: lastEv.type === 'BUY'
                ? `BOT BUY ${lastEv.symbol} @ $${lastEv.price?.toFixed(2)}`
                : `BOT CLOSE ${lastEv.symbol}: ${lastEv.pnl >= 0 ? '+' : ''}$${lastEv.pnl?.toFixed(0)} — ${lastEv.reason}`,
              type: lastEv.type === 'BUY' ? 'BUY' : (lastEv.pnl >= 0 ? 'BUY' : 'SELL'),
            };
            setNotifications(prev => [note, ...prev.slice(0, 4)]);
          }
          return p;
        });

        return nextAll;
      });
    }, 1500);
    return () => clearInterval(autoRef.current);
  }, [isAuto, symbol, strategy, autoMode, watchlist]);

  // Update candles on symbol change
  useEffect(() => {
    const c = generateCandles(symbol, 100);
    setCandles(c);
    setLivePrice(c[c.length - 1].close);
    setSignals([]);
    setBacktestResult(null);
  }, [symbol]);

  // Live trading engine (manual simulation, disabled when auto is on)
  useEffect(() => {
    if (!isLive || isAuto) return;
    liveRef.current = setInterval(() => {
      setCandles(prev => {
        const last = prev[prev.length - 1];
        const vol = VOLATILITY[symbol] || 0.003;
        const change = (Math.random() - 0.49) * vol * last.close;
        const newClose = +(last.close + change).toFixed(2);
        const newCandle = {
          ...last,
          timestamp: last.timestamp + 300000,
          time: new Date(last.timestamp + 300000).toISOString(),
          open: last.close,
          close: newClose,
          high: Math.max(last.close, newClose) + Math.random() * vol * last.close * 0.2,
          low: Math.min(last.close, newClose) - Math.random() * vol * last.close * 0.2,
          volume: Math.floor(Math.random() * 5000 + 500),
        };
        const updated = [...prev.slice(-99), newCandle];

        const liveSigs = runStrategy(updated, strategy);
        const latestSig = liveSigs[liveSigs.length - 1];
        if (latestSig && latestSig.timestamp === newCandle.timestamp) {
          const note = { id: Date.now(), msg: `${latestSig.signal} signal: ${latestSig.reason}`, type: latestSig.signal };
          setNotifications(prev2 => [note, ...prev2.slice(0, 4)]);
          if (latestSig.signal === 'BUY') {
            setLiveOrders(prev2 => [{
              time: newCandle.time,
              timestamp: newCandle.timestamp,
              type: latestSig.signal,
              entry: newClose,
              qty: Math.floor(1000 / newClose * 100) / 100,
              isLive: true,
            }, ...prev2.slice(0, 9)]);
          }
        }
        return updated;
      });
    }, 2000);
    return () => clearInterval(liveRef.current);
  }, [isLive, symbol, strategy]);

  const handleRunBacktest = useCallback(async () => {
    setIsRunning(true);
    await new Promise(r => setTimeout(r, 800));
    const sigs = runStrategy(candles, strategy);
    setSignals(sigs);
    const result = runBacktest(candles, sigs);
    setBacktestResult(result);
    setIsRunning(false);
    setActiveTab('BACKTEST');

    const note = { id: Date.now(), msg: `Backtest complete: ${result.tradeCount} trades, ${result.totalReturn > 0 ? '+' : ''}${result.totalReturn}% return`, type: result.totalReturn > 0 ? 'BUY' : 'SELL' };
    setNotifications(prev => [note, ...prev.slice(0, 4)]);
  }, [candles, strategy]);

  const metrics = backtestResult ? {
    totalReturn: backtestResult.totalReturn,
    winRate: backtestResult.winRate,
    maxDrawdown: backtestResult.maxDrawdown,
    sharpe: backtestResult.sharpe,
    tradeCount: backtestResult.tradeCount,
    portfolioValue: backtestResult.equity[backtestResult.equity.length - 1]?.value || 100000,
  } : { portfolioValue: 100000 };

  const priceChange = livePrice - BASE_PRICES[symbol];
  const priceChangePct = (priceChange / BASE_PRICES[symbol] * 100).toFixed(2);

  return (
    <div className="grid-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div className="scanline" />

      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', background: 'rgba(5,8,16,0.95)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="flex items-center justify-between px-4 py-2.5">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color="#000" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
                QUANTEX<span style={{ color: 'var(--accent)' }}>PRO</span>
              </div>
              <div style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '2px' }}>ENTERPRISE TRADING ENGINE</div>
            </div>
          </div>

          {/* Symbol selector */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setSymbolOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 2,
                  cursor: 'pointer',
                  fontFamily: 'Space Mono',
                  fontSize: 12,
                  color: 'var(--text)',
                }}
              >
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{symbol}</span>
                <ChevronDown size={12} style={{ color: 'var(--muted)' }} />
              </button>
              {symbolOpen && (
                <div className="absolute top-full left-0 mt-1 z-50" style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 2,
                  minWidth: 140,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                  {SYMBOLS.map(sym => (
                    <button
                      key={sym}
                      onClick={() => { setSymbol(sym); setSymbolOpen(false); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '6px 12px',
                        fontFamily: 'Space Mono', fontSize: 11,
                        color: sym === symbol ? 'var(--accent)' : 'var(--text2)',
                        background: sym === symbol ? 'rgba(0,212,255,0.08)' : 'transparent',
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live price */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'Syne', letterSpacing: '-0.3px' }}>
                {livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 10, color: priceChange >= 0 ? 'var(--accent2)' : 'var(--danger)', fontFamily: 'Space Mono' }}>
                {priceChange >= 0 ? '+' : ''}{priceChangePct}%
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs fade-up"
                style={{
                  background: notifications[0].type === 'BUY' ? 'rgba(0,255,136,0.08)' : 'rgba(255,59,92,0.08)',
                  border: `1px solid ${notifications[0].type === 'BUY' ? 'rgba(0,255,136,0.3)' : 'rgba(255,59,92,0.3)'}`,
                  borderRadius: 2, maxWidth: 280,
                }}>
                <Bell size={10} style={{ color: notifications[0].type === 'BUY' ? 'var(--accent2)' : 'var(--danger)', flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {notifications[0].msg}
                </span>
              </div>
            )}

            <button
              onClick={() => { if (!isAuto) { setIsLive(l => !l); } }}
              className="flex items-center gap-1.5"
              style={{
                background: isLive && !isAuto ? 'rgba(0,255,136,0.12)' : 'var(--surface)',
                border: `1px solid ${isLive && !isAuto ? 'rgba(0,255,136,0.4)' : 'var(--border)'}`,
                borderRadius: 2, padding: '6px 12px',
                cursor: isAuto ? 'not-allowed' : 'pointer', fontFamily: 'Space Mono', fontSize: 10,
                color: isLive && !isAuto ? 'var(--accent2)' : 'var(--text2)',
                opacity: isAuto ? 0.4 : 1,
              }}
            >
              {isLive && !isAuto ? <><span className="pulse-dot" style={{ display: 'inline-block' }} />&nbsp;LIVE</> : <><Activity size={10} />&nbsp;SIMULATE</>}
            </button>

            {/* AUTO TRADE button */}
            <button
              onClick={() => {
                setRightPanel('auto');
                setIsAuto(a => {
                  if (!a) setIsLive(false);
                  return !a;
                });
              }}
              className="flex items-center gap-1.5"
              style={{
                background: isAuto ? 'rgba(255,107,53,0.15)' : 'var(--surface)',
                border: `1px solid ${isAuto ? 'rgba(255,107,53,0.6)' : 'var(--border)'}`,
                borderRadius: 2, padding: '6px 12px',
                cursor: 'pointer', fontFamily: 'Space Mono', fontSize: 10,
                color: isAuto ? 'var(--accent3)' : 'var(--text2)',
                fontWeight: isAuto ? 700 : 400,
              }}
            >
              <Bot size={10} />
              &nbsp;{isAuto ? 'AUTO ON' : 'AUTO'}
              {isAuto && <span className="pulse-dot" style={{ display: 'inline-block', background: 'var(--accent3)', boxShadow: '0 0 8px var(--accent3)' }} />}
            </button>

            <button
              onClick={() => setRightPanel(p => p === 'auto' ? 'signals' : 'auto')}
              style={{ background: rightPanel === 'auto' ? 'rgba(255,107,53,0.1)' : 'var(--surface)', border: `1px solid ${rightPanel === 'auto' ? 'rgba(255,107,53,0.3)' : 'var(--border)'}`, borderRadius: 2, padding: 6, cursor: 'pointer', color: rightPanel === 'auto' ? 'var(--accent3)' : 'var(--text2)' }}>
              <Shield size={14} />
            </button>
            <button style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 2, padding: 6, cursor: 'pointer', color: 'var(--text2)' }}>
              <Settings size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Ticker */}
      <Ticker />

      {/* Metrics */}
      <MetricsBar metrics={metrics} />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 600 }}>
        {/* Strategy panel */}
        <div style={{ width: 220, borderRight: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden' }}>
          <StrategyPanel
            strategy={strategy}
            onStrategyChange={setStrategy}
            onRun={handleRunBacktest}
            isRunning={isRunning}
          />
        </div>

        {/* Center content */}
        <div className="flex flex-col overflow-hidden" style={{ flex: 1, minWidth: 0 }}>
          {/* Tab bar */}
          <div className="flex items-center border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 16px',
                  fontFamily: 'Space Mono', fontSize: 10, letterSpacing: '1.5px',
                  color: activeTab === tab ? 'var(--accent)' : 'var(--muted)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tab}
              </button>
            ))}
            <div className="ml-auto px-3 flex items-center gap-2" style={{ fontSize: 9, color: 'var(--muted)' }}>
              <span className="pulse-dot" />
              <span style={{ letterSpacing: '1px' }}>{isLive ? 'LIVE DATA' : 'SIMULATED'}</span>
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden" style={{ minHeight: 500 }}>
            {activeTab === 'CHART' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: '0 0 60%', borderBottom: '1px solid var(--border)', paddingTop: 8, paddingBottom: 8 }}>
                  <PriceChart candles={candles} signals={signals} />
                </div>
                {/* RSI always shown */}
                <div style={{ flex: strategy === 'multi_factor' ? '0 0 20%' : '0 0 40%', borderBottom: strategy === 'multi_factor' ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ padding: '4px 12px', fontSize: 9, color: 'var(--muted)', letterSpacing: '1px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>RSI (14)</span>
                    {strategy === 'multi_factor' && (
                      <span style={{ fontSize: 8, padding: '1px 5px', background: 'rgba(249,202,36,0.12)', border: '1px solid rgba(249,202,36,0.3)', color: '#f9ca24', borderRadius: 2 }}>
                        FILTER: 40–62
                      </span>
                    )}
                  </div>
                  <div style={{ height: 'calc(100% - 28px)' }}>
                    <RSIChart candles={candles} />
                  </div>
                </div>
                {/* MACD shown when Multi-Factor is active */}
                {strategy === 'multi_factor' && (
                  <div style={{ flex: '0 0 20%' }}>
                    <div style={{ padding: '4px 12px', fontSize: 9, color: 'var(--muted)', letterSpacing: '1px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>MACD (12, 26, 9)</span>
                      <span style={{ fontSize: 8, color: '#00d4ff' }}>━ MACD</span>
                      <span style={{ fontSize: 8, color: '#a29bfe' }}>╌ SIGNAL</span>
                      <span style={{ fontSize: 8, color: 'var(--accent2)' }}>▌ HISTOGRAM</span>
                    </div>
                    <div style={{ height: 'calc(100% - 28px)' }}>
                      <MACDChart candles={candles} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'BACKTEST' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {backtestResult ? (
                  <>
                    <div style={{ flex: '0 0 55%', borderBottom: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '1.5px' }}>EQUITY CURVE</span>
                        <div className="flex gap-4" style={{ fontSize: 9, color: 'var(--text2)' }}>
                          <span style={{ color: '#ff9f43' }}>━ SMA20</span>
                          <span style={{ color: '#a29bfe' }}>━ EMA50</span>
                          <span style={{ color: '#74b9ff', opacity: 0.6 }}>━ BB</span>
                        </div>
                      </div>
                      <div style={{ height: 'calc(100% - 36px)', padding: '8px 0' }}>
                        <Suspense fallback={<div className="flex items-center justify-center h-full" style={{ fontSize: 10, color: 'var(--muted)' }}>LOADING...</div>}>
                          <EquityChart equity={backtestResult.equity} />
                        </Suspense>
                      </div>
                    </div>
                    <div style={{ flex: '0 0 45%', overflow: 'auto' }}>
                      <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border)', fontSize: 9, color: 'var(--muted)', letterSpacing: '1.5px' }}>
                        TRADE BREAKDOWN — {backtestResult.trades.length} CLOSED
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1, padding: 1 }}>
                        {backtestResult.trades.map((t, i) => {
                          const isWin = t.pnl >= 0;
                          return (
                            <div key={i} className="p-3" style={{
                              background: isWin ? 'rgba(0,255,136,0.04)' : 'rgba(255,59,92,0.04)',
                              border: `1px solid ${isWin ? 'rgba(0,255,136,0.15)' : 'rgba(255,59,92,0.15)'}`,
                            }}>
                              <div className="flex justify-between items-start mb-2">
                                <span style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '1px' }}>TRADE #{i + 1}</span>
                                <span className="tag" style={{
                                  background: isWin ? 'rgba(0,255,136,0.12)' : 'rgba(255,59,92,0.12)',
                                  color: isWin ? 'var(--accent2)' : 'var(--danger)',
                                }}>{isWin ? 'WIN' : 'LOSS'}</span>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: isWin ? 'var(--accent2)' : 'var(--danger)', fontFamily: 'Syne' }}>
                                {isWin ? '+' : ''}${t.pnl.toFixed(0)}
                              </div>
                              <div style={{ fontSize: 9, color: 'var(--text2)', marginTop: 2 }}>
                                {t.entry?.toFixed(2)} → {t.exit?.toFixed(2)}
                              </div>
                              <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>
                                {isWin ? '+' : ''}{t.pct}% · {t.qty} units
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full flex-col gap-4">
                    <BarChart2 size={40} style={{ color: 'var(--border)' }} />
                    <div style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '2px' }}>SELECT STRATEGY & RUN BACKTEST</div>
                    <button onClick={handleRunBacktest} className="btn-primary" disabled={isRunning}>
                      {isRunning ? 'RUNNING...' : 'RUN BACKTEST NOW'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ORDERBOOK' && (
              <div style={{ height: '100%' }}>
                <OrderBook price={livePrice} />
              </div>
            )}

            {activeTab === 'TRADES' && (
              <div style={{ height: '100%' }}>
                <TradeLog trades={backtestResult?.trades || []} liveOrders={liveOrders} />
              </div>
            )}

            {activeTab === 'LIVE ENGINE' && (
              <div style={{ height: '100%' }}>
                <Suspense fallback={<div className="flex items-center justify-center h-full" style={{ fontSize: 10, color: 'var(--muted)' }}>LOADING...</div>}>
                  <LiveDashboard />
                </Suspense>
              </div>
            )}

            {activeTab === 'COMPARE' && (
              <div style={{ height: '100%' }}>
                <Suspense fallback={<div className="flex items-center justify-center h-full" style={{ fontSize: 10, color: 'var(--muted)' }}>LOADING...</div>}>
                  <StrategyComparison />
                </Suspense>
              </div>
            )}

            {activeTab === 'BLUEPRINT' && (
              <div style={{ height: '100%' }}>
                <Suspense fallback={<div className="flex items-center justify-center h-full" style={{ fontSize: 10, color: 'var(--muted)' }}>LOADING...</div>}>
                  <BlueprintPage />
                </Suspense>
              </div>
            )}
          </div>
        </div>

        {/* Right panel: togglable signals / auto trade */}
        <div style={{ width: 220, borderLeft: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Panel toggle tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            {[{ key: 'signals', label: 'SIGNALS' }, { key: 'auto', label: 'AUTO BOT' }].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setRightPanel(key)}
                style={{
                  flex: 1, padding: '7px 4px',
                  fontFamily: 'Space Mono', fontSize: 9, letterSpacing: '1.2px',
                  color: rightPanel === key ? (key === 'auto' ? 'var(--accent3)' : 'var(--accent)') : 'var(--muted)',
                  background: 'transparent', border: 'none',
                  borderBottom: `2px solid ${rightPanel === key ? (key === 'auto' ? 'var(--accent3)' : 'var(--accent)') : 'transparent'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {label}{key === 'auto' && isAuto && <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--accent3)', boxShadow: '0 0 6px var(--accent3)', marginLeft: 4, verticalAlign: 'middle' }} />}
              </button>
            ))}
          </div>

          {rightPanel === 'auto' ? (
            <AutoTradePanel
              isAuto={isAuto}
              onToggle={() => setIsAuto(a => { if (!a) setIsLive(false); return !a; })}
              onReset={() => { setPortfolio(createPortfolio(100000)); setEventLog([]); }}
              autoMode={autoMode}
              onModeChange={setAutoMode}
              watchlist={watchlist}
              onWatchlistChange={setWatchlist}
              focusSymbol={symbol}
              portfolio={portfolio}
              prices={allPrices}
              eventLog={eventLog}
            />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-2" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {signals.slice(-20).reverse().map((sig, i) => (
                  <div key={i} className="p-2" style={{
                    background: sig.signal === 'BUY' ? 'rgba(0,255,136,0.06)' : 'rgba(255,59,92,0.06)',
                    border: `1px solid ${sig.signal === 'BUY' ? 'rgba(0,255,136,0.2)' : 'rgba(255,59,92,0.2)'}`,
                    borderRadius: 2,
                  }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="tag" style={{
                        background: sig.signal === 'BUY' ? 'rgba(0,255,136,0.15)' : 'rgba(255,59,92,0.15)',
                        color: sig.signal === 'BUY' ? 'var(--accent2)' : 'var(--danger)',
                      }}>{sig.signal}</span>
                      <span style={{ fontSize: 8, color: 'var(--muted)' }}>
                        {new Date(sig.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 10, color: 'var(--text)', fontWeight: 700 }}>
                        ${sig.price?.toFixed(2)}
                      </div>
                      {sig.confidence > 0 && (
                        <div style={{ display: 'flex', gap: 2 }}>
                          {[1,2,3,4,5].map(n => (
                            <div key={n} style={{ width: 4, height: 4, borderRadius: 1, background: n <= sig.confidence ? 'var(--accent3)' : 'var(--border)' }} />
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 8, color: 'var(--text2)', lineHeight: 1.4, marginTop: 2 }}>
                      {sig.reason}
                    </div>
                  </div>
                ))}
                {signals.length === 0 && (
                  <div style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', marginTop: 20, lineHeight: 2, letterSpacing: '0.5px' }}>
                    RUN BACKTEST<br />TO SEE SIGNALS
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border)' }}>
                <div className="px-3 py-2" style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '1.5px', borderBottom: '1px solid var(--border)' }}>
                  MARKET STATS
                </div>
                {[
                  { label: '24H HIGH', value: (livePrice * 1.023).toFixed(2), color: 'var(--accent2)' },
                  { label: '24H LOW', value: (livePrice * 0.977).toFixed(2), color: 'var(--danger)' },
                  { label: '24H VOL', value: `${(Math.random() * 50 + 20).toFixed(1)}B`, color: 'var(--text)' },
                  { label: 'OPEN INT', value: `${(Math.random() * 10 + 5).toFixed(1)}B`, color: 'var(--text)' },
                  { label: 'FUNDING', value: `${(Math.random() * 0.1).toFixed(4)}%`, color: 'var(--accent3)' },
                ].map((stat, i) => (
                  <div key={i} className="flex justify-between items-center px-3 py-1.5" style={{ borderBottom: '1px solid rgba(30,45,69,0.4)' }}>
                    <span style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '1px' }}>{stat.label}</span>
                    <span style={{ fontSize: 10, color: stat.color, fontWeight: 700, fontFamily: 'Space Mono' }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status bar */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '4px 16px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4" style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'Space Mono' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="pulse-dot" style={{ display: 'inline-block', width: 4, height: 4 }} />
              {isAuto ? 'AUTO TRADING ACTIVE' : isLive ? 'LIVE FEED ACTIVE' : 'SIMULATION MODE'}
            </span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span>ENGINE v2.4.1</span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span>STRATEGY: {strategy.toUpperCase()}</span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span>SYMBOL: {symbol}</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'Space Mono' }}>
            {new Date().toLocaleString()} UTC
          </div>
        </div>
      </footer>
    </div>
  );
}
