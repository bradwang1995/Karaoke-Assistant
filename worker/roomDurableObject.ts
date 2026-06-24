import type { RoomSnapshot } from "../src/types/room";
import type { ClientRole } from "../src/types/websocket";
import { getRoomSnapshotFromD1 } from "./d1Repository";
import { apiError, jsonResponse } from "./json";
import { isValidRoomId } from "./roomIds";
import type { Env } from "./types";
import { decodeClientMessage, encodeServerMessage } from "./websocketMessages";

interface ClientInfo {
  clientId: string;
  role: ClientRole;
  displayName?: string;
  connectedAt: string;
}

export class RoomDurableObject {
  state: DurableObjectState;
  env: Env;
  sockets: Map<WebSocket, ClientInfo>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sockets = new Map();
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const route = matchRoomRoute(url.pathname);

    if (route?.name === "snapshot") {
      if (!isValidRoomId(route.roomId)) {
        return apiError(400, "INVALID_ROOM_ID", "Room id must be 8 lowercase letters or numbers.");
      }

      if (!this.env.DB) {
        return apiError(503, "D1_NOT_CONFIGURED", "D1 binding DB is not configured.");
      }

      const snapshot = await getRoomSnapshotFromD1(this.env.DB, route.roomId);

      if (!snapshot) {
        return apiError(404, "ROOM_NOT_FOUND", "Room not found.");
      }

      return jsonResponse(snapshot);
    }

    if (route?.name === "ws") {
      if (!isValidRoomId(route.roomId)) {
        return apiError(400, "INVALID_ROOM_ID", "Room id must be 8 lowercase letters or numbers.");
      }

      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }

      return this.handleWebSocket(request, route.roomId);
    }

    return new Response("Room Durable Object shell", { status: 200 });
  }

  private async handleWebSocket(_request: Request, roomId: string) {
    let initialSnapshot: RoomSnapshot;

    try {
      initialSnapshot = await this.getSnapshot(roomId, this.sockets.size + 1);
    } catch (error) {
      return apiError(
        error instanceof Error && error.message === "Room not found." ? 404 : 503,
        error instanceof Error && error.message === "Room not found."
          ? "ROOM_NOT_FOUND"
          : "ROOM_SNAPSHOT_UNAVAILABLE",
        error instanceof Error ? error.message : "Room snapshot is unavailable.",
      );
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();

    const anonymousClient: ClientInfo = {
      clientId: crypto.randomUUID(),
      role: "mobile",
      connectedAt: new Date().toISOString(),
    };
    this.sockets.set(server, anonymousClient);

    server.addEventListener("message", (event) => {
      void this.handleWebSocketMessage(roomId, server, event.data);
    });

    server.addEventListener("close", () => {
      this.handleConnectionClose(server);
    });

    server.addEventListener("error", () => {
      this.handleConnectionClose(server);
    });

    this.sendSnapshot(server, initialSnapshot);
    this.broadcastSnapshot(initialSnapshot, server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleWebSocketMessage(
    roomId: string,
    socket: WebSocket,
    data: string | ArrayBuffer,
  ) {
    try {
      const message = decodeClientMessage(data);

      if (message.type === "PING") {
        socket.send(encodeServerMessage({ type: "PONG" }));
        return;
      }

      if (message.type === "JOIN_ROOM") {
        this.sockets.set(socket, {
          clientId: message.clientId,
          role: message.role,
          displayName: message.displayName,
          connectedAt: new Date().toISOString(),
        });

        const snapshot = await this.getSnapshot(roomId);
        this.sendSnapshot(socket, snapshot);
        this.broadcastSnapshot(snapshot, socket);
        return;
      }

      this.sendError(
        socket,
        "NOT_IMPLEMENTED",
        `${message.type} is not implemented in this backend iteration.`,
      );
    } catch (error) {
      this.sendError(
        socket,
        "INVALID_MESSAGE",
        error instanceof Error ? error.message : "Invalid WebSocket message.",
      );
    }
  }

  private handleConnectionClose(socket: WebSocket) {
    this.sockets.delete(socket);
  }

  private async getSnapshot(
    roomId: string,
    connectedClients = this.sockets.size,
  ): Promise<RoomSnapshot> {
    if (!this.env.DB) {
      throw new Error("D1 binding DB is not configured.");
    }

    const snapshot = await getRoomSnapshotFromD1(this.env.DB, roomId);

    if (!snapshot) {
      throw new Error("Room not found.");
    }

    return {
      ...snapshot,
      connectedClients,
    };
  }

  private sendSnapshot(socket: WebSocket, snapshot: RoomSnapshot) {
    socket.send(encodeServerMessage({ type: "ROOM_SNAPSHOT", payload: snapshot }));
  }

  private broadcastSnapshot(snapshot: RoomSnapshot, except?: WebSocket) {
    const message = encodeServerMessage({
      type: "ROOM_UPDATED",
      payload: {
        ...snapshot,
        connectedClients: this.sockets.size,
      },
    });

    for (const socket of this.sockets.keys()) {
      if (socket !== except) {
        socket.send(message);
      }
    }
  }

  private sendError(socket: WebSocket, code: string, message: string) {
    socket.send(
      encodeServerMessage({
        type: "ERROR",
        payload: {
          code,
          message,
        },
      }),
    );
  }
}

function matchRoomRoute(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 3 && parts[0] === "rooms" && parts[2] === "snapshot") {
    return { name: "snapshot" as const, roomId: parts[1] };
  }

  if (parts.length === 3 && parts[0] === "rooms" && parts[2] === "ws") {
    return { name: "ws" as const, roomId: parts[1] };
  }

  return null;
}
