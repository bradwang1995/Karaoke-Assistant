import type { CreateRoomResponse } from "../src/types/api";
import type { AdminResponseSource } from "../src/types/admin";
import { cleanupCompletedItems } from "../src/lib/roomReducer";
import {
  clearAdminSession,
  createAdminSession,
  isSameOriginMutation,
  readAdminSession,
  requireAdmin,
} from "./adminAuth";
import {
  createRoomInD1,
  deleteInactiveQueueItemsFromD1,
  getRoomSnapshotFromD1,
  saveRoomSnapshotToD1,
} from "./d1Repository";
import { getAdminStorageStatus } from "./cloudflareStorage";
import { apiError, jsonResponse } from "./json";
import { checkRateLimit } from "./rateLimit";
import { createRoomId, isValidRoomId } from "./roomIds";
import { classifySearchQuery } from "./searchQuery";
import { getSearchRecommendations, getYouTubeDailySearchLimit, searchVideos } from "./searchService";
import {
  deleteAdminRepositoryEntries,
  getAdminOverview,
  isValidDeleteIds,
  listAdminRepositoryEntries,
  listAdminSearchEvents,
  normalizeAdminRange,
  previewAdminRepositoryCleanup,
  readConfiguredCleanupBatchSize,
  readConfiguredCleanupTargetPercentage,
  readConfiguredWarningThresholdPercentage,
  recordSearchEvent,
  RepositoryCleanupBusyError,
  runAdminRepositoryCleanup,
} from "./searchRepository";
import type { Env } from "./types";
import type { SearchType } from "../src/types/youtube";
import type { SearchResponse, YouTubeQuotaStatus } from "../src/types/youtube";
import { getYouTubeSearchQuotaStatusForEnv } from "./youtubeQuota";

const CREATE_ROOM_ATTEMPTS = 3;
const DEFAULT_SEARCH_RATE_LIMIT_PER_MINUTE = 20;
const DEFAULT_SEARCH_RESPONSE_LIMIT = 10;
const MAX_SEARCH_RESPONSE_LIMIT = 50;
const MAX_RECOMMENDATION_RESPONSE_LIMIT = 200;
const MAX_URL_QUERY_LENGTH = 2_048;

export async function handleApiRequest(
  request: Request,
  env: Env,
  ctx?: ExecutionContext,
) {
  const url = new URL(request.url);
  const route = matchApiRoute(url.pathname);

  if (!route) {
    return apiError(404, "NOT_FOUND", "API route not found.");
  }

  if (route.name === "adminSession") {
    return handleAdminSession(request, env);
  }

  if (
    route.name === "adminOverview" ||
    route.name === "adminStorage" ||
    route.name === "adminSearches" ||
    route.name === "adminRepository" ||
    route.name === "adminRepositoryCleanup"
  ) {
    try {
      return await handleProtectedAdminRoute(request, env, route.name, url);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "admin-request-failed",
          route: route.name,
          error: error instanceof Error ? error.message : "Unknown admin request error",
        }),
      );
      return adminApiError(500, "ADMIN_REQUEST_FAILED", "管理数据请求失败，请稍后重试。");
    }
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

    return searchRoomVideos(request, env, route.roomId, ctx);
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
    const fallbackDisplayName = "K歌房";
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

async function searchRoomVideos(
  request: Request,
  env: Env,
  roomId: string,
  ctx?: ExecutionContext,
) {
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

  const queryClassification = classifySearchQuery(query);
  const maxQueryLength =
    queryClassification.kind === "text" ? 100 : MAX_URL_QUERY_LENGTH;

  if (query.length > maxQueryLength) {
    return apiError(
      400,
      "QUERY_TOO_LONG",
      `Search query must be ${maxQueryLength} characters or fewer.`,
    );
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
    const response = await searchVideos({
      query,
      artist: artist || undefined,
      searchType,
      includeOriginalVocal,
      limit,
      cacheFill,
      waitUntil: ctx ? (promise) => ctx.waitUntil(promise) : undefined,
      env,
    });
    const responseSource = responseSourceFromSearchResponse(response, env);
    const sideEffects: Promise<unknown>[] = response.cacheMeta?.queryMode
      ? []
      : [safelyRecordSearchEvent(env, {
          roomId,
          query,
          normalizedQuery: response.normalizedQuery,
          artist: artist || undefined,
          searchType,
          includeOriginalVocal,
          source: responseSource,
          resultCount: response.results.length,
          success: true,
          candidateResultCount: response.cacheMeta?.candidateResultCount ?? 0,
          filteredResultCount: response.cacheMeta?.filteredResultCount ?? 0,
          catalogResultCount: response.cacheMeta?.catalogResultCount ?? 0,
          uniqueCatalogVideosAdded: response.cacheMeta?.uniqueCatalogVideosAdded ?? 0,
          externalSearchCalls:
            responseSource === "external"
              ? response.cacheMeta?.sourceQueryCount ?? 0
              : 0,
          externalCallAvoided: response.cacheMeta?.externalCallAvoided === true,
        })];
    const quotaStatus = quotaStatusFromSearchResponse(response);

    if (quotaStatus) {
      sideEffects.push(broadcastYouTubeQuotaStatus(env, roomId, quotaStatus));
    }

    await finishSearchSideEffects(sideEffects, ctx);
    return jsonResponse(response);
  } catch (error) {
    await finishSearchSideEffects([safelyRecordSearchEvent(env, {
      roomId,
      query,
      normalizedQuery: query.toLocaleLowerCase(),
      artist: artist || undefined,
      searchType,
      includeOriginalVocal,
      source: "error",
      resultCount: 0,
      success: false,
      errorCode: "SEARCH_FAILED",
    })], ctx);
    return apiError(
      502,
      "SEARCH_FAILED",
      error instanceof Error ? error.message : "Search failed.",
    );
  }
}

async function finishSearchSideEffects(
  tasks: Promise<unknown>[],
  ctx?: ExecutionContext,
) {
  const task = Promise.all(tasks).then(() => undefined);

  if (ctx) {
    ctx.waitUntil(task);
    return;
  }

  await task;
}

function quotaStatusFromSearchResponse(
  response: SearchResponse,
): YouTubeQuotaStatus | null {
  const quota = response.cacheMeta?.quota;

  if (
    !quota ||
    typeof quota.used !== "number" ||
    typeof quota.resetAt !== "string" ||
    quota.resetTimeZone !== "America/Los_Angeles" ||
    typeof quota.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    dailyLimit: quota.dailyLimit,
    used: quota.used,
    remaining: quota.remainingAfter,
    exhausted: quota.exhausted,
    resetAt: quota.resetAt,
    resetTimeZone: quota.resetTimeZone,
    updatedAt: quota.updatedAt,
  };
}

async function broadcastYouTubeQuotaStatus(
  env: Env,
  roomId: string,
  status: YouTubeQuotaStatus,
) {
  if (!env.ROOM_OBJECT) {
    return;
  }

  try {
    const stub = env.ROOM_OBJECT.getByName(roomId);
    const response = await stub.fetch(
      new Request(`https://room-object.internal/rooms/${roomId}/youtube-quota`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(status),
      }),
    );

    if (!response.ok) {
      console.error(
        JSON.stringify({
          event: "youtube-quota-broadcast-failed",
          roomId,
          status: response.status,
        }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "youtube-quota-broadcast-failed",
        roomId,
        error: error instanceof Error ? error.message : "Unknown Durable Object error",
      }),
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
  return jsonResponse(await getYouTubeSearchQuotaStatusForEnv(env, dailyLimit));
}

async function handleAdminSession(request: Request, env: Env) {
  if (request.method === "GET") {
    return readAdminSession(request, env);
  }

  if (request.method === "POST") {
    if (!isSameOriginMutation(request)) {
      return adminApiError(403, "ADMIN_ORIGIN_REJECTED", "登录请求来源无效。");
    }

    return createAdminSession(request, env);
  }

  if (request.method === "DELETE") {
    if (!isSameOriginMutation(request)) {
      return adminApiError(403, "ADMIN_ORIGIN_REJECTED", "退出请求来源无效。");
    }

    return clearAdminSession();
  }

  return adminApiError(405, "METHOD_NOT_ALLOWED", "Use GET, POST, or DELETE for admin sessions.");
}

async function handleProtectedAdminRoute(
  request: Request,
  env: Env,
  routeName:
    | "adminOverview"
    | "adminStorage"
    | "adminSearches"
    | "adminRepository"
    | "adminRepositoryCleanup",
  url: URL,
) {
  if (!(await requireAdmin(request, env))) {
    return adminApiError(401, "ADMIN_UNAUTHORIZED", "需要管理员登录。");
  }

  if (!env.DB) {
    return adminApiError(503, "D1_NOT_CONFIGURED", "D1 binding DB is not configured.");
  }

  if (routeName === "adminOverview") {
    if (request.method !== "GET") {
      return adminApiError(405, "METHOD_NOT_ALLOWED", "Use GET to read the admin overview.");
    }

    const [quota, storage] = await Promise.all([
      getYouTubeSearchQuotaStatusForEnv(env, getYouTubeDailySearchLimit(env)),
      getAdminStorageStatus(env.DB, env, {
        forceRefresh: url.searchParams.get("refreshStorage") === "1",
      }),
    ]);
    const overview = await getAdminOverview(
      env.DB,
      normalizeAdminRange(url.searchParams.get("range")),
      quota,
    );
    return adminJsonResponse({ ...overview, storage });
  }

  if (routeName === "adminStorage") {
    if (request.method !== "GET") {
      return adminApiError(405, "METHOD_NOT_ALLOWED", "Use GET to read storage metrics.");
    }

    return adminJsonResponse(
      await getAdminStorageStatus(env.DB, env, {
        forceRefresh: url.searchParams.get("refresh") === "1",
      }),
    );
  }

  if (routeName === "adminSearches") {
    if (request.method !== "GET") {
      return adminApiError(405, "METHOD_NOT_ALLOWED", "Use GET to read admin search records.");
    }

    return adminJsonResponse(
      await listAdminSearchEvents(env.DB, {
        range: normalizeAdminRange(url.searchParams.get("range")),
        page: readPositiveQueryNumber(url.searchParams.get("page")),
        pageSize: readPositiveQueryNumber(url.searchParams.get("pageSize")),
        query: readQueryText(url.searchParams.get("query")),
        source: normalizeAdminResponseSource(url.searchParams.get("source")),
      }),
    );
  }

  if (routeName === "adminRepositoryCleanup") {
    const cleanupConfig = await repositoryCleanupConfig(
      env.DB,
      env,
      request.method === "POST" || url.searchParams.get("refreshStorage") === "1",
    );

    if (request.method === "GET") {
      return adminJsonResponse(await previewAdminRepositoryCleanup(env.DB, cleanupConfig));
    }

    if (request.method === "POST") {
      if (!isSameOriginMutation(request)) {
        return adminApiError(403, "ADMIN_ORIGIN_REJECTED", "清理请求来源无效。");
      }

      const body = await request.json().catch(() => null);

      if (
        typeof body !== "object" ||
        body === null ||
        !("confirm" in body) ||
        (body as { confirm?: unknown }).confirm !== true
      ) {
        return adminApiError(400, "CLEANUP_CONFIRMATION_REQUIRED", "必须明确确认清理策略。");
      }

      try {
        return adminJsonResponse(
          await runAdminRepositoryCleanup(
            env.DB,
            cleanupConfig,
            env.SEARCH_CACHE,
            async () =>
              (
                await getAdminStorageStatus(env.DB!, env, {
                  forceRefresh: true,
                  repositoryEstimateBytes: null,
                })
              ).d1,
          ),
        );
      } catch (error) {
        if (error instanceof RepositoryCleanupBusyError) {
          return adminApiError(409, error.code, error.message);
        }
        throw error;
      }
    }

    return adminApiError(405, "METHOD_NOT_ALLOWED", "Use GET or POST for repository cleanup.");
  }

  if (request.method === "GET") {
    const searchType = url.searchParams.get("searchType");
    const sort = url.searchParams.get("sort");
    return adminJsonResponse(
      await listAdminRepositoryEntries(env.DB, {
        page: readPositiveQueryNumber(url.searchParams.get("page")),
        pageSize: readPositiveQueryNumber(url.searchParams.get("pageSize")),
        query: readQueryText(url.searchParams.get("query")),
        searchType: searchType === "song" || searchType === "artist" ? searchType : undefined,
        sort:
          sort === "reuse" || sort === "results" || sort === "size" ? sort : "recent",
        direction: url.searchParams.get("direction") === "asc" ? "asc" : "desc",
      }),
    );
  }

  if (request.method === "DELETE") {
    if (!isSameOriginMutation(request)) {
      return adminApiError(403, "ADMIN_ORIGIN_REJECTED", "删除请求来源无效。");
    }

    const body = await request.json().catch(() => null);
    const ids =
      typeof body === "object" && body !== null && "ids" in body
        ? (body as { ids?: unknown }).ids
        : null;

    if (!isValidDeleteIds(ids)) {
      return adminApiError(400, "INVALID_DELETE_IDS", "请选择 1 至 50 条有效资料记录。");
    }

    return adminJsonResponse(await deleteAdminRepositoryEntries(env.DB, ids, env.SEARCH_CACHE));
  }

  return adminApiError(405, "METHOD_NOT_ALLOWED", "Use GET or DELETE for admin repository data.");
}

function adminJsonResponse(body: unknown) {
  return jsonResponse(body, { headers: { "cache-control": "no-store" } });
}

async function repositoryCleanupConfig(
  db: D1Database,
  env: Env,
  forceRefresh: boolean,
) {
  const storage = await getAdminStorageStatus(db, env, {
    forceRefresh,
    repositoryEstimateBytes: null,
  });

  return {
    capacityBytes: storage.d1.capacityBytes,
    databaseBytes: storage.d1.usedBytes,
    usageSource: storage.d1.usageSource,
    usageAuthoritative: storage.d1.usageAuthoritative,
    capacitySource: storage.d1.capacitySource,
    measuredAt: storage.d1.measuredAt,
    stale: storage.d1.stale,
    thresholdPercentage: readConfiguredWarningThresholdPercentage(
      env.SEARCH_REPOSITORY_WARNING_THRESHOLD_PERCENT,
    ),
    targetPercentage: readConfiguredCleanupTargetPercentage(
      env.SEARCH_REPOSITORY_CLEANUP_TARGET_PERCENT,
    ),
    batchSize: readConfiguredCleanupBatchSize(env.SEARCH_REPOSITORY_CLEANUP_BATCH_SIZE),
  };
}

function adminApiError(status: number, code: string, message: string) {
  return apiError(status, code, message, {
    headers: { "cache-control": "no-store" },
  });
}

async function safelyRecordSearchEvent(
  env: Env,
  input: Parameters<typeof recordSearchEvent>[1],
) {
  try {
    await recordSearchEvent(env.DB, input);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "search-event-write-failed",
        error: error instanceof Error ? error.message : "Unknown D1 error",
      }),
    );
  }
}

function responseSourceFromSearchResponse(response: SearchResponse, env: Env): AdminResponseSource {
  return (
    response.cacheMeta?.responseSource ??
    (response.cached ? "repository" : env.YOUTUBE_API_KEY ? "external" : "mock")
  );
}

function normalizeAdminResponseSource(value: string | null): AdminResponseSource | undefined {
  return value === "repository" || value === "external" || value === "mock" || value === "error"
    ? value
    : undefined;
}

function readPositiveQueryNumber(value: string | null) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : undefined;
}

function readQueryText(value: string | null) {
  const query = value?.trim();
  return query ? query.slice(0, 100) : undefined;
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

  if (parts.length === 3 && parts[0] === "api" && parts[1] === "admin" && parts[2] === "session") {
    return { name: "adminSession" as const };
  }

  if (parts.length === 3 && parts[0] === "api" && parts[1] === "admin" && parts[2] === "overview") {
    return { name: "adminOverview" as const };
  }

  if (parts.length === 3 && parts[0] === "api" && parts[1] === "admin" && parts[2] === "storage") {
    return { name: "adminStorage" as const };
  }

  if (parts.length === 3 && parts[0] === "api" && parts[1] === "admin" && parts[2] === "searches") {
    return { name: "adminSearches" as const };
  }

  if (parts.length === 3 && parts[0] === "api" && parts[1] === "admin" && parts[2] === "repository") {
    return { name: "adminRepository" as const };
  }

  if (
    parts.length === 4 &&
    parts[0] === "api" &&
    parts[1] === "admin" &&
    parts[2] === "repository" &&
    parts[3] === "cleanup"
  ) {
    return { name: "adminRepositoryCleanup" as const };
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
