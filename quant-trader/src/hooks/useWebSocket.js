// hooks/useWebSocket.js — Real-time WebSocket hook for QuantexPro
// Subscribes to engine data streams (prices, signals, fills, portfolio)

import { useEffect, useRef, useCallback, useState } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export default function useWebSocket(clientId = 'web-ui') {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [lastBar, setLastBar] = useState(null);
  const [lastSignal, setLastSignal] = useState(null);
  const [lastFill, setLastFill] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const handlersRef = useRef({});

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = `${WS_URL}/api/ws/${clientId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({
        subscribe: ['prices', 'signals', 'fills', 'portfolio'],
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'connected' || msg.type === 'subscribed') return;

        const { channel, data } = msg;

        switch (channel) {
          case 'prices':
            setLastBar(data);
            handlersRef.current.onBar?.(data);
            break;
          case 'signals':
            setLastSignal(data);
            handlersRef.current.onSignal?.(data);
            break;
          case 'fills':
            setLastFill(data);
            handlersRef.current.onFill?.(data);
            break;
          case 'portfolio':
            setPortfolio(data);
            handlersRef.current.onPortfolio?.(data);
            break;
          default:
            handlersRef.current.onUnknown?.(msg);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      // Auto-reconnect after 3s
      setTimeout(() => connect(), 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [clientId]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  const on = useCallback((event, handler) => {
    handlersRef.current[event] = handler;
  }, []);

  const off = useCallback((event) => {
    delete handlersRef.current[event];
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    connect,
    disconnect,
    connected,
    lastBar,
    lastSignal,
    lastFill,
    portfolio,
    on,
    off,
  };
}