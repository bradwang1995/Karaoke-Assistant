import { readVideoMetadata } from "./videoMetadata";
import type { RoomSnapshot } from "../src/types/room";
import type { VideoSearchResult, YouTubeQuotaStatus } from "../src/types/youtube";
import type { ClientRole } from "../src/types/websocket";
import { cleanupCompletedItems } from "../src/lib/roomReducer";
import {
  deactivateRoomInD1,
  deleteInactiveQueueItemsFromD1,
  getRoomSnapshotFromD1,
  saveRoomSnapshotToD1,
  touchRoomActivityInD1,
} from "./d1Repository";
import { apiError, jsonResponse } from "./json";
import { recordQueuedSearchRecommendation } from "./kvCache";
import { applyRoomCommand, type RoomCommandMessage } from "./roomCommands";
import { isValidRoomId } from "./roomIds";
import type { Env } from "./types";
import { decodeClientMessage, encodeServerMessage } from "./websocketMessages";

interface ClientInfo {
  clientId: string;
  role: ClientRole;
  displayName?: string;
  connectedAt: string;
}

const ROOM_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_STORAGE_KEY = "room-activity";

interface RoomActivityState {
  roomId: string;
  lastActiveAt: string;
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

      await this.touchRoomActivity(route.roomId);
      const snapshot = await getRoomSnapshotFromD1(this.env.DB, route.roomId);

      if (!snapshot) {
        return apiError(404, "ROOM_NOT_FOUND", "Room not found.");
      }

      return jsonResponse(snapshot);
    }

    if (route?.name === "cleanup") {
      if (!isValidRoomId(route.roomId)) {
        return apiError(400, "INVALID_ROOM_ID", "Room id must be 8 lowercase letters or numbers.");
      }

      if (!this.env.DB) {
        return apiError(503, "D1_NOT_CONFIGURED", "D1 binding DB is not configured.");
      }

      await this.touchRoomActivity(route.roomId);
      const snapshot = await this.getSnapshot(route.roomId);
      const cleaned = {
        ...cleanupCompletedItems(snapshot),
        connectedClients: this.sockets.size,
      };

      await saveRoomSnapshotToD1(this.env.DB, cleaned);
      await deleteInactiveQueueItemsFromD1(this.env.DB, route.roomId);
      await this.touchRoomActivity(route.roomId);

      const nextSnapshot = {
        ...((await getRoomSnapshotFromD1(this.env.DB, route.roomId)) ?? cleaned),
        connectedClients: this.sockets.size,
      };
      this.broadcastSnapshot(nextSnapshot);

      return jsonResponse(nextSnapshot);
    }

    if (route?.name === "ws") {
      if (!isValidRoomId(route.roomId)) {
        return apiError(400, "INVALID_ROOM_ID", "Room id must be 8 lowercase letters or numbers.");
      }

      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }

      await this.touchRoomActivity(route.roomId);
      return this.handleWebSocket(request, route.roomId);
    }

    if (route?.name === "youtubeQuota") {
      if (!isValidRoomId(route.roomId)) {
        return apiError(400, "INVALID_ROOM_ID", "Room id must be 8 lowercase letters or numbers.");
      }

      if (request.method !== "POST") {
        return apiError(405, "METHOD_NOT_ALLOWED", "Use POST to publish YouTube quota status.");
      }

      const status = await request.json().catch(() => null);

      if (!isYouTubeQuotaStatus(status)) {
        return apiError(400, "INVALID_QUOTA_STATUS", "YouTube quota status is invalid.");
      }

      this.broadcastYouTubeQuotaStatus(status);
      return new Response(null, { status: 204 });
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
        await this.touchRoomActivity(roomId);
        socket.send(encodeServerMessage({ type: "PONG" }));
        return;
      }

      if (message.type === "JOIN_ROOM") {
        await this.touchRoomActivity(roomId);
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

      const nextSnapshot = await this.applyAndPersistCommand(
        roomId,
        message as RoomCommandMessage,
      );
      await this.touchRoomActivity(roomId);
      this.broadcastSnapshot(nextSnapshot);
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

  private async applyAndPersistCommand(roomId: string, message: RoomCommandMessage) {
    if (!this.env.DB) {
      throw new Error("D1 binding DB is not configured.");
    }

    const currentSnapshot = await this.getSnapshot(roomId);
    let queuedVideo: VideoSearchResult | undefined;
    if (message.type === "ADD_QUEUE_ITEM") {
      const video = (await readVideoMetadata(this.env.DB, [message.payload.videoId])).get(message.payload.videoId);
      queuedVideo = video;
      message = { ...message, payload: { ...message.payload, title: video?.title ?? "YouTube 视频", channelTitle: video?.channelTitle, thumbnailUrl: video?.thumbnailUrl, metadataStamp: video?.provenance?.snippet } };
    }
    const nextSnapshot = {
      ...applyRoomCommand(currentSnapshot, message),
      connectedClients: this.sockets.size,
    };

    await saveRoomSnapshotToD1(this.env.DB, nextSnapshot);

    if (message.type === "ADD_QUEUE_ITEM") {
      this.state.waitUntil(
        recordQueuedSearchRecommendation(this.env.SEARCH_CACHE, message.payload, undefined, queuedVideo).catch(
          (error) => {
            console.error(
              JSON.stringify({
                event: "queued-recommendation-write-failed",
                roomId,
                videoId: message.payload.videoId,
                error: error instanceof Error ? error.message : "Unknown KV error",
              }),
            );
          },
        ),
      );
    }

    return nextSnapshot;
  }

  private async touchRoomActivity(roomId: string, now = new Date()) {
    const lastActiveAt = now.toISOString();

    await this.state.storage.put(ACTIVITY_STORAGE_KEY, {
      roomId,
      lastActiveAt,
    } satisfies RoomActivityState);
    await this.state.storage.setAlarm(now.getTime() + ROOM_INACTIVITY_TIMEOUT_MS);

    if (this.env.DB) {
      await touchRoomActivityInD1(this.env.DB, roomId, lastActiveAt);
    }

    return lastActiveAt;
  }

  async alarm() {
    const activity = await this.state.storage.get<RoomActivityState>(ACTIVITY_STORAGE_KEY);

    if (!activity) {
      return;
    }

    if (this.sockets.size > 0) {
      await this.touchRoomActivity(activity.roomId);
      return;
    }

    const lastActiveMs = Date.parse(activity.lastActiveAt);
    const now = Date.now();

    if (!Number.isFinite(lastActiveMs)) {
      await this.state.storage.delete(ACTIVITY_STORAGE_KEY);
      return;
    }

    const inactiveForMs = now - lastActiveMs;

    if (inactiveForMs < ROOM_INACTIVITY_TIMEOUT_MS) {
      await this.state.storage.setAlarm(lastActiveMs + ROOM_INACTIVITY_TIMEOUT_MS);
      return;
    }

    if (this.env.DB) {
      await deactivateRoomInD1(this.env.DB, activity.roomId, new Date(now).toISOString());
    }

    await this.state.storage.delete(ACTIVITY_STORAGE_KEY);
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

  private broadcastYouTubeQuotaStatus(status: YouTubeQuotaStatus) {
    const message = encodeServerMessage({
      type: "YOUTUBE_QUOTA_UPDATED",
      payload: status,
    });

    for (const socket of this.sockets.keys()) {
      socket.send(message);
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

  if (parts.length === 3 && parts[0] === "rooms" && parts[2] === "cleanup") {
    return { name: "cleanup" as const, roomId: parts[1] };
  }

  if (parts.length === 3 && parts[0] === "rooms" && parts[2] === "ws") {
    return { name: "ws" as const, roomId: parts[1] };
  }

  if (parts.length === 3 && parts[0] === "rooms" && parts[2] === "youtube-quota") {
    return { name: "youtubeQuota" as const, roomId: parts[1] };
  }

  return null;
}

function isYouTubeQuotaStatus(value: unknown): value is YouTubeQuotaStatus {
  if (!value || typeof value !== "object") {
    return false;
  }

  const status = value as Partial<YouTubeQuotaStatus>;

  return (
    typeof status.dailyLimit === "number" &&
    Number.isFinite(status.dailyLimit) &&
    typeof status.used === "number" &&
    Number.isFinite(status.used) &&
    typeof status.remaining === "number" &&
    Number.isFinite(status.remaining) &&
    typeof status.exhausted === "boolean" &&
    typeof status.resetAt === "string" &&
    status.resetTimeZone === "America/Los_Angeles" &&
    typeof status.updatedAt === "string"
  );
}
