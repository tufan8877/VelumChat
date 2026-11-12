import { useState, useEffect, useRef, useCallback, useMemo } from "react";

function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.token || u?.accessToken || null;
  } catch {
    return null;
  }
}

export function useWebSocketReliable(userId?: number) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const eventHandlersRef = useRef<Map<string, Function[]>>(new Map());
  const reconnectTimeoutRef = useRef<any>(null);
  const messageQueueRef = useRef<any[]>([]);

  const emit = useCallback((event: string, data?: any) => {
    const handlers = eventHandlersRef.current.get(event) || [];
    handlers.forEach((h) => {
      try {
        h(data);
      } catch (e) {
        console.error("WS handler error:", e);
      }
    });
  }, []);

  const connect = useCallback(() => {
    if (!userId) return;

    const token = getAuthToken();
    if (!token) {
      console.error("❌ Missing JWT token in localStorage -> cannot connect websocket.");
      setIsConnected(false);
      return;
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      console.log("🔌 Connecting WebSocket:", wsUrl);

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("✅ WebSocket connected");
        setIsConnected(true);

        // ✅ IMPORTANT: server expects JOIN with token
        const joinMessage = { type: "join", token };
        wsRef.current?.send(JSON.stringify(joinMessage));
        console.log("📤 WS join sent (token)");

        // send queued messages
        while (messageQueueRef.current.length > 0) {
          const queued = messageQueueRef.current.shift();
          wsRef.current?.send(JSON.stringify(queued));
        }

        emit("connected");
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // ✅ Emit exactly once on the generic channel.
          // App code can switch(data.type) on this.
          emit("message", data);

          // ✅ Also emit the specific typed channel for components that subscribe to it.
          if (data?.type && data.type !== "message") emit(data.type, data);
        } catch (e) {
          console.error("❌ WS parse error:", e);
        }
      };

      wsRef.current.onclose = (evt) => {
        console.log("🔌 WebSocket closed:", evt.code, evt.reason);
        setIsConnected(false);
        emit("disconnected");

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("🔄 WS reconnecting...");
          connect();
        }, 2500);
      };

      wsRef.current.onerror = (err) => {
        console.error("❌ WebSocket error:", err);
        setIsConnected(false);
        emit("error", err);
      };
    } catch (e) {
      console.error("❌ Failed to create WebSocket:", e);
      setIsConnected(false);
    }
  }, [userId, emit]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
      eventHandlersRef.current.clear();
    };
  }, [connect]);

  const send = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    // queue if not open
    messageQueueRef.current.push(message);
    return false;
  }, []);

  const on = useCallback((event: string, handler: Function) => {
    const handlers = eventHandlersRef.current.get(event) || [];
    handlers.push(handler);
    eventHandlersRef.current.set(event, handlers);
  }, []);

  const off = useCallback((event: string, handler?: Function) => {
    if (!handler) {
      eventHandlersRef.current.delete(event);
      return;
    }
    const handlers = eventHandlersRef.current.get(event) || [];
    const idx = handlers.indexOf(handler);
    if (idx >= 0) handlers.splice(idx, 1);
    eventHandlersRef.current.set(event, handlers);
  }, []);

  return useMemo(() => ({ isConnected, send, on, off }), [isConnected, send, on, off]);
}
