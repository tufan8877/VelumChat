import { useEffect, useMemo, useRef, useState } from "react";

type WSState = {
  ws: WebSocket | null;
  isConnected: boolean;
  send: (data: any) => boolean;
  lastError?: string;
};

/**
 * Reliable WebSocket hook
 * - Always uses wss:// when page is https://
 * - Sends { type:"join", token } after connection opens (server expects token-based join)
 * - Auto-reconnect with backoff
 */
export function useWebSocketReliable(userId?: number | null, token?: string | null): WSState {
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | undefined>(undefined);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<any>(null);
  const backoffRef = useRef<number>(500);

  const wsUrl = useMemo(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}/ws`;
  }, []);

  const clearReconnect = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const scheduleReconnect = () => {
    clearReconnect();
    const delay = Math.min(backoffRef.current, 8000);
    reconnectTimerRef.current = setTimeout(() => {
      backoffRef.current = Math.min(backoffRef.current * 1.6, 8000);
      connect();
    }, delay);
  };

  const sendJoin = (ws: WebSocket) => {
    if (!token) return;
    try {
      ws.send(JSON.stringify({ type: "join", token }));
    } catch {}
  };

  const connect = () => {
    try {
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }
    } catch {}

    setLastError(undefined);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      backoffRef.current = 500;
      sendJoin(ws);
    };

    ws.onerror = () => {
      setLastError("WebSocket error");
    };

    ws.onclose = () => {
      setIsConnected(false);
      scheduleReconnect();
    };
  };

  useEffect(() => {
    connect();
    return () => {
      clearReconnect();
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  // Re-send join if userId/token changes while socket is open
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    if (ws.readyState !== WebSocket.OPEN) return;
    sendJoin(ws);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token]);

  const send = (data: any) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(data));
      return true;
    } catch (e: any) {
      setLastError(e?.message || "Send failed");
      return false;
    }
  };

  return { ws: wsRef.current, isConnected, send, lastError };
}
