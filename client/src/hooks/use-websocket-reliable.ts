import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Listener = (payload: any) => void;

type WSApi = {
  isConnected: boolean;
  sendJson: (data: any) => boolean;
  on: (event: string, fn: Listener) => () => void;
  off: (event: string, fn: Listener) => void;
};

function getToken(): string | null {
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      return u?.token || u?.accessToken || localStorage.getItem("token") || null;
    }
  } catch {}
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

function getWsUrl() {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

export function useWebSocketReliable(userId?: number): WSApi {
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<any>(null);
  const heartbeatTimerRef = useRef<any>(null);

  const listenersRef = useRef<Map<string, Set<Listener>>>(new Map());
  const sendQueueRef = useRef<string[]>([]);
  const joinedRef = useRef(false);
  const lastJoinTokenRef = useRef<string | null>(null);
  const isUnmountedRef = useRef(false);

  const emit = useCallback((event: string, payload: any) => {
    const set = listenersRef.current.get(event);
    if (!set || set.size === 0) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch (e) {
        console.error("❌ WS listener error:", e);
      }
    }
  }, []);

  const off = useCallback((event: string, fn: Listener) => {
    const set = listenersRef.current.get(event);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) listenersRef.current.delete(event);
  }, []);

  const on = useCallback(
    (event: string, fn: Listener) => {
      let set = listenersRef.current.get(event);
      if (!set) {
        set = new Set();
        listenersRef.current.set(event, set);
      }
      set.add(fn);
      return () => off(event, fn);
    },
    [off]
  );

  const flushQueue = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    while (sendQueueRef.current.length > 0) {
      const msg = sendQueueRef.current.shift();
      if (!msg) continue;
      try {
        ws.send(msg);
      } catch {
        sendQueueRef.current.unshift(msg);
        break;
      }
    }
  }, []);

  const sendJoin = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;

    const token = getToken();
    if (!token) {
      console.warn("⚠️ WS join skipped: missing token");
      return false;
    }

    if (joinedRef.current && lastJoinTokenRef.current === token) return true;

    try {
      ws.send(JSON.stringify({ type: "join", token }));
      joinedRef.current = true;
      lastJoinTokenRef.current = token;
      return true;
    } catch (e) {
      console.error("❌ WS join send failed:", e);
      return false;
    }
  }, []);

  const cleanupTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const closeWs = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (!ws) return;
    try {
      ws.onopen = null as any;
      ws.onclose = null as any;
      ws.onerror = null as any;
      ws.onmessage = null as any;
      ws.close();
    } catch {}
  }, []);

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;

    const url = getWsUrl();

    joinedRef.current = false;

    closeWs();
    cleanupTimers();

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      console.error("❌ WS create failed:", e);
      setIsConnected(false);
      reconnectTimerRef.current = setTimeout(connect, 1500);
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      if (isUnmountedRef.current) return;
      setIsConnected(true);

      // IMPORTANT: join immediately
      sendJoin();

      // flush queued messages
      flushQueue();

      emit("open", { ok: true });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // emit specific event once
        if (data?.type) {
          emit(data.type, data);
        }

        // emit generic channel exactly once per frame
        emit("message", data);
      } catch (e) {
        console.error("❌ WS parse error:", e);
      }
    };

    ws.onerror = (err) => {
      emit("error", err);
    };

    ws.onclose = () => {
      if (isUnmountedRef.current) return;
      setIsConnected(false);
      emit("close", { ok: false });

      cleanupTimers();
      reconnectTimerRef.current = setTimeout(connect, 900);
    };

    // heartbeat (helps mobile Safari)
    heartbeatTimerRef.current = setInterval(() => {
      const s = wsRef.current;
      if (!s || s.readyState !== WebSocket.OPEN) return;

      // ensure joined
      sendJoin();

      try {
        s.send(JSON.stringify({ type: "ping", t: Date.now() }));
      } catch {}
    }, 20000);
  }, [cleanupTimers, closeWs, emit, flushQueue, sendJoin]);

  const sendJson = useCallback(
    (data: any) => {
      const ws = wsRef.current;
      const raw = JSON.stringify(data);

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        sendQueueRef.current.push(raw);
        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 300);
        }
        return false;
      }

      // join before sending first message
      sendJoin();

      try {
        ws.send(raw);
        return true;
      } catch (e) {
        console.error("❌ WS send failed:", e);
        sendQueueRef.current.push(raw);
        return false;
      }
    },
    [connect, sendJoin]
  );

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      cleanupTimers();
      closeWs();
      setIsConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "user" || e.key === "token") {
        try {
          sendJoin();
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [sendJoin]);

  return useMemo(
    () => ({
      isConnected,
      sendJson,
      on,
      off,
    }),
    [isConnected, sendJson, on, off]
  );
}
