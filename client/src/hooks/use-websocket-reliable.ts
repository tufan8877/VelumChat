import { useEffect, useMemo, useRef, useState } from "react";

type Handler = (payload: any) => void;

type WSClient = {
  isConnected: boolean;
  send: (data: any) => void;
  on: (event: string, handler: Handler) => () => void;
};

function getToken(): string | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.token || u?.accessToken || localStorage.getItem("token") || null;
  } catch {
    return localStorage.getItem("token");
  }
}

function getWsUrl() {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

/**
 * Reliable WebSocket hook.
 * Emits:
 *  - data.type channel (e.g. "new_message", "user_status", ...)
 *  - "message" channel EXACTLY ONCE per WS frame for backward compatibility.
 *
 * This prevents double-processing while keeping older listeners working.
 */
export function useWebSocketReliable(userId?: number): WSClient | null {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<Handler>>>(new Map());
  const joinSentRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);

  const emit = (event: string, payload: any) => {
    const set = handlersRef.current.get(event);
    if (!set || set.size === 0) return;
    for (const h of Array.from(set)) {
      try {
        h(payload);
      } catch (e) {
        console.error("WS handler error:", e);
      }
    }
  };

  const on = (event: string, handler: Handler) => {
    if (!handlersRef.current.has(event)) handlersRef.current.set(event, new Set());
    handlersRef.current.get(event)!.add(handler);
    return () => handlersRef.current.get(event)!.delete(handler);
  };

  const send = (data: any) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(typeof data === "string" ? data : JSON.stringify(data));
  };

  useEffect(() => {
    if (!userId) return;

    let closed = false;
    let retry = 0;
    let retryTimer: any = null;

    const connect = () => {
      if (closed) return;

      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;
      joinSentRef.current = false;

      ws.onopen = () => {
        setIsConnected(true);
        retry = 0;

        const token = getToken();
        if (token && !joinSentRef.current) {
          joinSentRef.current = true;
          try {
            ws.send(JSON.stringify({ type: "join", token }));
          } catch {}
        }
      };

      ws.onmessage = (evt) => {
        try {
          const raw = typeof evt.data === "string" ? evt.data : "";
          const data = raw ? JSON.parse(raw) : evt.data;

          if (data?.type) emit(data.type, data);

          const compatPayload =
            data?.type === "new_message" && data?.message
              ? { ...data, type: "message", message: data.message }
              : data;

          emit("message", compatPayload);
        } catch (e) {
          console.error("❌ WS parse error:", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        if (closed) return;
        retry += 1;
        const delay = Math.min(8000, 500 + retry * 500);
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      setIsConnected(false);
      if (retryTimer) clearTimeout(retryTimer);
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
    };
  }, [userId]);

  return useMemo(
    () => ({
      isConnected,
      send,
      on,
    }),
    [isConnected]
  );
}

export default useWebSocketReliable;
