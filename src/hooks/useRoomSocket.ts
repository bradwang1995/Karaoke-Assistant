import { useEffect, useMemo, useRef, useState } from "react";
import { hydrateRoomSnapshot } from "../lib/roomState";
import type { RoomId } from "../types/room";
import type {
  ClientRole,
  ClientToServerMessage,
  ServerToClientMessage,
} from "../types/websocket";

export type SocketStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "unavailable"
  | "closed"
  | "error";

const PING_INTERVAL_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 8_000;
const MAX_RECONNECT_ATTEMPTS = 8;

interface UseRoomSocketOptions {
  roomId: RoomId;
  role: ClientRole;
  enabled?: boolean;
}

interface RoomSocketState {
  status: SocketStatus;
  lastError?: string;
  reconnectAttempt: number;
  nextRetryMs?: number;
  canUseLocalFallback: boolean;
  send: (message: ClientToServerMessage) => boolean;
}

export function useRoomSocket({
  roomId,
  role,
  enabled = true,
}: UseRoomSocketOptions): RoomSocketState {
  const [status, setStatus] = useState<SocketStatus>("idle");
  const [lastError, setLastError] = useState<string | undefined>();
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [nextRetryMs, setNextRetryMs] = useState<number | undefined>();
  const socketRef = useRef<WebSocket | null>(null);
  const clientId = useMemo(() => getClientId(), []);
  const canUseLocalFallback = isLocalDevOrigin() && status !== "connected";

  useEffect(() => {
    if (!enabled || !roomId || !("WebSocket" in window)) {
      setStatus("idle");
      setReconnectAttempt(0);
      setNextRetryMs(undefined);
      return;
    }

    let disposed = false;
    let reconnectTimer: number | undefined;
    let pingInterval: number | undefined;

    const joinMessage: ClientToServerMessage = {
      type: "JOIN_ROOM",
      role,
      clientId,
    };

    const clearTimers = () => {
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }

      if (pingInterval !== undefined) {
        window.clearInterval(pingInterval);
        pingInterval = undefined;
      }
    };

    const connect = (attempt: number) => {
      if (disposed) return;

      clearTimers();
      setStatus(attempt === 0 ? "connecting" : "reconnecting");
      setReconnectAttempt(attempt);
      setNextRetryMs(undefined);

      const socket = new WebSocket(roomWebSocketUrl(roomId));
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        if (disposed) return;

        setStatus("connected");
        setLastError(undefined);
        setReconnectAttempt(0);
        setNextRetryMs(undefined);
        socket.send(JSON.stringify(joinMessage));

        pingInterval = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "PING" } satisfies ClientToServerMessage));
          }
        }, PING_INTERVAL_MS);
      });

      socket.addEventListener("message", (event) => {
        const message = parseServerMessage(event.data);

        if (!message) {
          return;
        }

        if (message.type === "ROOM_SNAPSHOT" || message.type === "ROOM_UPDATED") {
          hydrateRoomSnapshot(message.payload);
        }

        if (message.type === "ERROR") {
          setLastError(message.payload.message);
        }
      });

      socket.addEventListener("close", (event) => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }

        if (pingInterval !== undefined) {
          window.clearInterval(pingInterval);
          pingInterval = undefined;
        }

        if (disposed) return;

        if (event.code === 1000) {
          setStatus("closed");
          return;
        }

        scheduleReconnect(attempt + 1);
      });

      socket.addEventListener("error", () => {
        setLastError("WebSocket connection failed.");
      });
    };

    const scheduleReconnect = (attempt: number) => {
      if (attempt > MAX_RECONNECT_ATTEMPTS) {
        setStatus("unavailable");
        setReconnectAttempt(attempt - 1);
        setNextRetryMs(undefined);
        setLastError("WebSocket connection is unavailable.");
        return;
      }

      const delay = getReconnectDelay(attempt);
      setStatus("reconnecting");
      setReconnectAttempt(attempt);
      setNextRetryMs(delay);
      reconnectTimer = window.setTimeout(() => connect(attempt), delay);
    };

    connect(0);

    return () => {
      disposed = true;
      clearTimers();
      const socket = socketRef.current;
      socketRef.current = null;

      if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
        socket.close(1000, "Page changed");
      }
    };
  }, [clientId, enabled, role, roomId]);

  return {
    status,
    lastError,
    reconnectAttempt,
    nextRetryMs,
    canUseLocalFallback,
    send(message) {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
        return true;
      }

      setLastError("Room connection is not ready.");
      return false;
    },
  };
}

function roomWebSocketUrl(roomId: RoomId) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/rooms/${roomId}/ws`;
}

function getClientId() {
  const storageKey = "ktv-assistant:client-id";
  const existing = window.localStorage.getItem(storageKey);

  if (existing) {
    return existing;
  }

  const clientId = crypto.randomUUID();
  window.localStorage.setItem(storageKey, clientId);
  return clientId;
}

function getReconnectDelay(attempt: number) {
  return Math.min(BASE_RECONNECT_DELAY_MS * 2 ** Math.max(attempt - 1, 0), MAX_RECONNECT_DELAY_MS);
}

function isLocalDevOrigin() {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1"
  );
}

function parseServerMessage(data: unknown): ServerToClientMessage | null {
  if (typeof data !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(data) as ServerToClientMessage;

    if (
      parsed.type === "ROOM_SNAPSHOT" ||
      parsed.type === "ROOM_UPDATED" ||
      parsed.type === "ERROR" ||
      parsed.type === "PONG"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}
