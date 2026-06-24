import { useEffect, useMemo, useRef, useState } from "react";
import { hydrateRoomSnapshot } from "../lib/roomState";
import type { RoomId } from "../types/room";
import type {
  ClientRole,
  ClientToServerMessage,
  ServerToClientMessage,
} from "../types/websocket";

type SocketStatus = "idle" | "connecting" | "connected" | "unavailable" | "closed" | "error";

interface UseRoomSocketOptions {
  roomId: RoomId;
  role: ClientRole;
  enabled?: boolean;
}

interface RoomSocketState {
  status: SocketStatus;
  lastError?: string;
  send: (message: ClientToServerMessage) => void;
}

export function useRoomSocket({
  roomId,
  role,
  enabled = true,
}: UseRoomSocketOptions): RoomSocketState {
  const [status, setStatus] = useState<SocketStatus>("idle");
  const [lastError, setLastError] = useState<string | undefined>();
  const socketRef = useRef<WebSocket | null>(null);
  const clientId = useMemo(() => getClientId(), []);

  useEffect(() => {
    if (!enabled || !roomId || !("WebSocket" in window)) {
      setStatus("idle");
      return;
    }

    const socket = new WebSocket(roomWebSocketUrl(roomId));
    socketRef.current = socket;
    setStatus("connecting");
    setLastError(undefined);

    const joinMessage: ClientToServerMessage = {
      type: "JOIN_ROOM",
      role,
      clientId,
    };

    const pingInterval = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "PING" } satisfies ClientToServerMessage));
      }
    }, 30_000);

    socket.addEventListener("open", () => {
      setStatus("connected");
      socket.send(JSON.stringify(joinMessage));
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
      setStatus(event.code === 1006 ? "unavailable" : "closed");
    });

    socket.addEventListener("error", () => {
      setStatus("error");
      setLastError("WebSocket connection failed.");
    });

    return () => {
      window.clearInterval(pingInterval);
      socketRef.current = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, "Page changed");
      }
    };
  }, [clientId, enabled, role, roomId]);

  return {
    status,
    lastError,
    send(message) {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
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

