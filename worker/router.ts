import type { CreateRoomResponse } from "../src/types/api";
import { cleanupCompletedItems } from "../src/lib/roomReducer";
import {
  createRoomInD1,
  deleteInactiveQueueItemsFromD1,
  getRoomSnapshotFromD1,
  saveRoomSnapshotToD1,
} from "./d1Repository";
import { apiError, jsonResponse } from "./json";
import { checkRateLimit } from "./rateLimit";
import { createRoomId, isValidRoomId } from "./roomIds";
import { getSearchRecommendations, getYouTubeDailySearchLimit, searchVideos } from "./searchService";
import type { Env } from "./types";
import type { SearchType } from "../src/types/youtube";
import { getYouTubeSearchQuotaStatus } from "./youtubeQuota";

const CREATE_ROOM_ATTEMPTS = 3;
const DEFAULT_SEARCH_RATE_LIMIT_PER_MINUTE = 20;
const DEFAULT_SEARCH_RESPONSE_LIMIT = 10;
const MAX_SEARCH_RESPONSE_LIMIT = 50;
const MAX_RECOMMENDATION_RESPONSE_LIMIT = 200;

export async function handleApiRequest(request: Request, env: Env) {
  const url = new URL(request.url);
  const route = matchApiRoute(url.pathname);

  if (!route) {
    return apiError(404, "NOT_FOUND", "API route not found.");
  }

  if (route.name === "createRoom") {
    if (request.method !== "POST") {
      return apiError(405, "METHOD_NOT_ALLOWED", "Use POST to create a room.");
    }

    return createRoom(request, env);
  }

  if (route.name === "roomSnapshot") {
    if (request.method !== "GET") {
      return apiError(405, "METHOD_NOT_ALLOWED", "Use GET to read a room snapshot.");
    }

    return getRoomSnapshot(request, env, route.roomId);
  }

  if (route.name === "roomWebSocket") {
    if (request.method !== "GET") {
      return apiError(405, "METHOD_NOT_ALLOWED", "Use GET to connect to a room WebSocket.");
    }

    return connectRoomWebSocket(request, env, route.roomId);
  }

  if (route.name === "roomSearch") {
    if (request.method !== "POST") {
      return apiError(405, "METHOD_NOT_ALLOWED", "Use POST to search videos.");
    }

    return searchRoomVideos(request, env, route.roomId);
  }

  if (route.name === "roomCleanup") {
    if (request.method !== "POST") {
      return apiError(405, "METHOD_NOT_ALLOWED", "Use POST to clean up a room.");
    }

    return cleanupRoom(request, env, route.roomId);
  }

  if (route.name === "youtubeQuota") {
    if (request.method !== "GET") {
      return apiError(405, "METHOD_NOT_ALLOWED", "Use GET to read YouTube quota status.");
    }

    return getYoutubeQuota(env);
  }

  return apiError(404, "NOT_FOUND", "API route not found.");
}

async function createRoom(request: Request, env: Env) {
  if (!env.DB) {
    return apiError(503, "D1_NOT_CONFIGURED", "D1 binding DB is not configured.");
  }

  for (let attempt = 0; attempt < CREATE_ROOM_ATTEMPTS; attempt += 1) {
    const roomId = createRoomId();
    const fallbackDisplayName = `K歌房 ${roomId}`;
    const requestBody = await request.clone().json().catch(() => null);
    const displayName = normalizeRoomDisplayName(
      requestBody && typeof requestBody === "object" && "displayName" in requestBody
        ? requestBody.displayName
        : undefined,
      fallbackDisplayName,
    );

    try {
      const snapshot = await createRoomInD1(env.DB, roomId, displayName);
      const origin = new URL(request.url).origin;

      if (!snapshot) {
        return apiError(500, "ROOM_CREATE_FAILED", "Created room snapshot was not found.");
      }

      return jsonResponse({
        roomId,
        displayUrl: `/room/${roomId}/display`,
        mobileUrl: `/room/${roomId}/mobile`,
        snapshot,
        absoluteDisplayUrl: `${origin}/room/${roomId}/display`,
        absoluteMobileUrl: `${origin}/room/${roomId}/mobile`,
      } satisfies CreateRoomResponse & {
        absoluteDisplayUrl: string;
        absoluteMobileUrl: string;
      });
    } catch (error) {
      if (attempt === CREATE_ROOM_ATTEMPTS - 1) {
        return apiError(
          500,
          "ROOM_CREATE_FAILED",
          error instanceof Error ? error.message : "Failed to create room.",
        );
      }
    }
  }

  return apiError(500, "ROOM_CREATE_FAILED", "Failed to create room.");
}

function normalizeRoomDisplayName(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return fallback;
  }

  return Array.from(normalized).slice(0, 40).join("");
}

async function getRoomSnapshot(request: Request, env: Env, roomId: string) {
  if (!isValidRoomId(roomId)) {
    return apiError(400, "INVALID_ROOM_ID", "Room id must be 8 lowercase letters or numbers.");
  }

  if (env.ROOM_OBJECT) {
    const id = env.ROOM_OBJECT.idFromName(roomId);
    const stub = env.ROOM_OBJECT.get(id);
    const url = new URL(request.url);
    url.pathname = `/rooms/${roomId}/snapshot`;
    return stub.fetch(new Request(url, request));
  }

  if (!env.DB) {
    return apiError(503, "D1_NOT_CONFIGURED", "D1 binding DB is not configured.");
  }

  const snapshot = await getRoomSnapshotFromD1(env.DB, roomId);

  if (!snapshot) {
    return apiError(404, "ROOM_NOT_FOUND", "Room not found.");
  }

  return jsonResponse(snapshot);
}

async function connectRoomWebSocket(request: Request, env: Env, roomId: string) {
  if (!isValidRoomId(roomId)) {
    return apiError(400, "INVALID_ROOM_ID", "Room id must be 8 lowercase letters or numbers.");
  }

  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  if (!env.ROOM_OBJECT) {
    return apiError(503, "ROOM_OBJECT_NOT_CONFIGURED", "Durable Object binding is not configured.");
  }

  const id = env.ROOM_OBJECT.idFromName(roomId);
  const stub = env.ROOM_OBJECT.get(id);
  const url = new URL(request.url);
  url.pathname = `/rooms/${roomId}/ws`;

  return stub.fetch(new Request(url, request));
}

async function searchRoomVideos(request: Request, env: Env, roomId: string) {
  if (!isValidRoomId(roomId)) {
    return apiError(400, "INVALID_ROOM_ID", "Room id must be 8 lowercase letters or numbers.");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be JSON.");
  }

  if (!isSearchRequestBody(body)) {
    return apiError(400, "INVALID_SEARCH_REQUEST", "Search request must include a query string.");
  }

  const query = body.query.trim();
  const limit = clampLimit(
    body.limit,
    query.length === 0 ? MAX_RECOMMENDATION_RESPONSE_LIMIT : MAX_SEARCH_RESPONSE_LIMIT,
  );

  if (query.length === 0) {
    return jsonResponse(await getSearchRecommendations({ limit, env }));
  }

  if (query.length > 100) {
    return apiError(400, "QUERY_TOO_LONG", "Search query must be 100 characters or fewer.");
  }

  const artist = typeof body.artist === "string" ? body.artist.trim() : undefined;
  const searchType = normalizeSearchType(body.searchType);
  const includeOriginalVocal = body.includeOriginalVocal === true;

  if (artist && artist.length > 100) {
    return apiError(400, "ARTIST_TOO_LONG", "Artist must be 100 characters or fewer.");
  }

  const cacheFill = typeof body.cacheFill === "boolean" ? body.cacheFill : true;
  const rateLimit = await checkRateLimit({
    namespace: env.SEARCH_CACHE,
    scope: `room:${roomId}:search`,
    identity: clientIdentity(request),
    limit: getSearchRateLimitPerMinute(env),
  });

  if (!rateLimit.allowed) {
    return jsonResponse(
      {
        error: {
          code: "SEARCH_RATE_LIMITED",
          message: "Too many searches. Please wait a moment and try again.",
        },
      },
      {
        status: 429,
        headers: {
          "retry-after": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  try {
    return jsonResponse(
      await searchVideos({
        query,
        artist: artist || undefined,
        searchType,
        includeOriginalVocal,
        limit,
        cacheFill,
        env,
      }),
    );
  } catch (error) {
    return apiError(
      502,
      "SEARCH_FAILED",
      error instanceof Error ? error.message : "Search failed.",
    );
  }
}

async function cleanupRoom(request: Request, env: Env, roomId: string) {
  if (!isValidRoomId(roomId)) {
    return apiError(400, "INVALID_ROOM_ID", "Room id must be 8 lowercase letters or numbers.");
  }

  if (env.ROOM_OBJECT) {
    const id = env.ROOM_OBJECT.idFromName(roomId);
    const stub = env.ROOM_OBJECT.get(id);
    const url = new URL(request.url);
    url.pathname = `/rooms/${roomId}/cleanup`;
    return stub.fetch(new Request(url, request));
  }

  if (!env.DB) {
    return apiError(503, "D1_NOT_CONFIGURED", "D1 binding DB is not configured.");
  }

  const snapshot = await getRoomSnapshotFromD1(env.DB, roomId);

  if (!snapshot) {
    return apiError(404, "ROOM_NOT_FOUND", "Room not found.");
  }

  const cleaned = cleanupCompletedItems(snapshot);
  await saveRoomSnapshotToD1(env.DB, cleaned);
  await deleteInactiveQueueItemsFromD1(env.DB, roomId);

  return jsonResponse((await getRoomSnapshotFromD1(env.DB, roomId)) ?? cleaned);
}

async function getYoutubeQuota(env: Env) {
  const dailyLimit = getYouTubeDailySearchLimit(env);
  return jsonResponse(await getYouTubeSearchQuotaStatus(env.SEARCH_CACHE, dailyLimit));
}

function matchApiRoute(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 2 && parts[0] === "api" && parts[1] === "rooms") {
    return { name: "createRoom" as const };
  }

  if (
    parts.length === 4 &&
    parts[0] === "api" &&
    parts[1] === "rooms" &&
    parts[3] === "snapshot"
  ) {
    return { name: "roomSnapshot" as const, roomId: parts[2] };
  }

  if (
    parts.length === 4 &&
    parts[0] === "api" &&
    parts[1] === "rooms" &&
    parts[3] === "ws"
  ) {
    return { name: "roomWebSocket" as const, roomId: parts[2] };
  }

  if (
    parts.length === 4 &&
    parts[0] === "api" &&
    parts[1] === "rooms" &&
    parts[3] === "search"
  ) {
    return { name: "roomSearch" as const, roomId: parts[2] };
  }

  if (
    parts.length === 4 &&
    parts[0] === "api" &&
    parts[1] === "rooms" &&
    parts[3] === "cleanup"
  ) {
    return { name: "roomCleanup" as const, roomId: parts[2] };
  }

  if (parts.length === 3 && parts[0] === "api" && parts[1] === "youtube" && parts[2] === "quota") {
    return { name: "youtubeQuota" as const };
  }

  return null;
}

function isSearchRequestBody(
  value: unknown,
): value is {
  query: string;
  limit?: number;
  artist?: string;
  cacheFill?: boolean;
  searchType?: unknown;
  includeOriginalVocal?: unknown;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "query" in value &&
    typeof (value as { query?: unknown }).query === "string"
  );
}

function clampLimit(limit: number | undefined, maximum: number) {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return DEFAULT_SEARCH_RESPONSE_LIMIT;
  }

  return Math.min(Math.max(Math.floor(limit), 1), maximum);
}

function normalizeSearchType(value: unknown): SearchType {
  return value === "artist" ? "artist" : "song";
}

function getSearchRateLimitPerMinute(env: Env) {
  const value = Number(env.SEARCH_RATE_LIMIT_PER_MINUTE);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_SEARCH_RATE_LIMIT_PER_MINUTE;
  }

  return Math.floor(value);
}

function clientIdentity(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous"
  );
}
