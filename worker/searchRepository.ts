import type {
  AdminDeleteRepositoryResult,
  AdminOverview,
  AdminRange,
  AdminRepositoryItem,
  AdminRepositoryPage,
  AdminResponseSource,
  AdminSearchEventItem,
  AdminSearchEventPage,
} from "../src/types/admin";
import type { SearchResponse, SearchType, YouTubeQuotaStatus } from "../src/types/youtube";
import { searchCacheFamilyKey, searchCacheIndexKey } from "./kvCache";
import type { SearchQueryFamily } from "./searchFamily";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_DELETE_COUNT = 50;

export async function readSearchRepository(
  db: D1Database | undefined,
  family: SearchQueryFamily,
) {
  if (!db) {
    return null;
  }

  const row = await db
    .prepare(
      `SELECT id, response_json
       FROM search_repository_entries
       WHERE normalized_query = ?1
         AND normalized_artist = ?2
         AND search_type = ?3
         AND include_original_vocal = ?4
       LIMIT 1`,
    )
    .bind(
      family.canonicalQuery,
      family.artist ?? "",
      family.searchType,
      family.includeOriginalVocal ? 1 : 0,
    )
    .first<{ id: string; response_json: string }>();

  if (!row) {
    return null;
  }

  const response = parseStoredResponse(row.response_json);

  if (!response) {
    return null;
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE search_repository_entries
       SET access_count = access_count + 1,
           last_accessed_at = ?1
       WHERE id = ?2`,
    )
    .bind(now, row.id)
    .run();

  return {
    id: row.id,
    response: {
      ...response,
      cached: true,
      cacheMeta: {
        ...response.cacheMeta,
        sourceQueryCount: response.cacheMeta?.sourceQueryCount ?? 0,
        cachedResultCount: response.results.length,
        servedFromExpandedCache: false,
        responseSource: "repository" as const,
        repositoryEntryId: row.id,
      },
    } satisfies SearchResponse,
  };
}

export async function writeSearchRepository(
  db: D1Database | undefined,
  family: SearchQueryFamily,
  response: SearchResponse,
) {
  if (!db || response.results.length === 0) {
    return null;
  }

  const now = new Date().toISOString();
  const responseJson = JSON.stringify(response);
  const approxBytes = new TextEncoder().encode(responseJson).byteLength;
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO search_repository_entries (
         id, family_hash, original_query, normalized_query, artist, normalized_artist,
         search_type, include_original_vocal, response_json, result_count,
         external_search_calls, approx_bytes, access_count, created_at, updated_at,
         last_accessed_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 0, ?13, ?13, ?13)
       ON CONFLICT(normalized_query, normalized_artist, search_type, include_original_vocal)
       DO UPDATE SET
         family_hash = excluded.family_hash,
         original_query = excluded.original_query,
         artist = excluded.artist,
         response_json = excluded.response_json,
         result_count = excluded.result_count,
         external_search_calls = excluded.external_search_calls,
         approx_bytes = excluded.approx_bytes,
         updated_at = excluded.updated_at,
         last_accessed_at = excluded.last_accessed_at`,
    )
    .bind(
      id,
      family.hash,
      response.query,
      family.canonicalQuery,
      family.artist ?? null,
      family.artist ?? "",
      family.searchType,
      family.includeOriginalVocal ? 1 : 0,
      responseJson,
      response.results.length,
      response.cacheMeta?.sourceQueryCount ?? 0,
      approxBytes,
      now,
    )
    .run();

  return db
    .prepare(
      `SELECT id
       FROM search_repository_entries
       WHERE normalized_query = ?1
         AND normalized_artist = ?2
         AND search_type = ?3
         AND include_original_vocal = ?4
       LIMIT 1`,
    )
    .bind(
      family.canonicalQuery,
      family.artist ?? "",
      family.searchType,
      family.includeOriginalVocal ? 1 : 0,
    )
    .first<{ id: string }>();
}

export async function recordSearchEvent(
  db: D1Database | undefined,
  input: {
    roomId?: string;
    query: string;
    normalizedQuery: string;
    artist?: string;
    searchType: SearchType;
    includeOriginalVocal: boolean;
    source: AdminResponseSource;
    resultCount: number;
    success: boolean;
    errorCode?: string;
  },
) {
  if (!db) {
    return;
  }

  const isSong = input.searchType === "song";
  await db
    .prepare(
      `INSERT INTO search_events (
         id, room_id, query_text, normalized_query, artist, song, search_type,
         original_performer_status, response_source, origin, result_count, success,
         error_code, created_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'human', ?10, ?11, ?12, ?13)`,
    )
    .bind(
      crypto.randomUUID(),
      input.roomId ?? null,
      input.query,
      input.normalizedQuery,
      isSong ? input.artist ?? null : input.query,
      isSong ? input.query : null,
      input.searchType,
      input.includeOriginalVocal ? "true" : "unknown",
      input.source,
      input.resultCount,
      input.success ? 1 : 0,
      input.errorCode ?? null,
      new Date().toISOString(),
    )
    .run();
}

export async function getAdminOverview(
  db: D1Database,
  range: AdminRange,
  quota: YouTubeQuotaStatus,
  capacityBytes: number | null,
  warningThresholdPercentage: number | null,
): Promise<AdminOverview> {
  const startAt = rangeStart(range).toISOString();
  const bucketExpression =
    range === "24h"
      ? "strftime('%Y-%m-%dT%H:00:00Z', created_at)"
      : "strftime('%Y-%m-%dT00:00:00Z', created_at)";
  const [
    repositoryResult,
    searchTotalsResult,
    trendResult,
    topResult,
    topSongsResult,
    topArtistsResult,
    originalPerformerResult,
    collectionResult,
  ] =
    await db.batch<Record<string, unknown>>([
      db.prepare(
        `SELECT COUNT(*) AS total_queries,
                COALESCE(SUM(result_count), 0) AS total_results,
                COALESCE(SUM(access_count), 0) AS repository_hits,
                COALESCE(SUM(approx_bytes), 0) AS estimated_bytes,
                COALESCE(SUM(CASE WHEN search_type = 'song' THEN 1 ELSE 0 END), 0) AS song_queries,
                COALESCE(SUM(CASE WHEN search_type = 'artist' THEN 1 ELSE 0 END), 0) AS artist_queries,
                COUNT(DISTINCT CASE WHEN search_type = 'song' THEN normalized_query END) AS unique_songs,
                COUNT(DISTINCT CASE
                  WHEN search_type = 'artist' THEN normalized_query
                  ELSE NULLIF(normalized_artist, '')
                END) AS unique_artists
         FROM search_repository_entries`,
      ),
      db.prepare(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN response_source = 'repository' AND success = 1 THEN 1 ELSE 0 END), 0) AS repository_hits,
                COALESCE(SUM(CASE WHEN response_source = 'external' AND success = 1 THEN 1 ELSE 0 END), 0) AS external_requests
         FROM search_events
         WHERE created_at >= ?1`,
      ).bind(startAt),
      db.prepare(
        `SELECT ${bucketExpression} AS bucket,
                COALESCE(SUM(CASE WHEN response_source = 'repository' AND success = 1 THEN 1 ELSE 0 END), 0) AS repository_hits,
                COALESCE(SUM(CASE WHEN response_source = 'external' AND success = 1 THEN 1 ELSE 0 END), 0) AS external_requests
         FROM search_events
         WHERE created_at >= ?1
         GROUP BY bucket
         ORDER BY bucket ASC`,
      ).bind(startAt),
      db.prepare(
        `SELECT MAX(query_text) AS query, search_type, COUNT(*) AS count
         FROM search_events
         WHERE created_at >= ?1 AND success = 1
         GROUP BY normalized_query, search_type
         ORDER BY count DESC, query ASC
         LIMIT 5`,
      ).bind(startAt),
      db.prepare(
        `SELECT MAX(song) AS label, COUNT(*) AS count
         FROM search_events
         WHERE created_at >= ?1 AND success = 1 AND song IS NOT NULL
         GROUP BY lower(song)
         ORDER BY count DESC, label ASC
         LIMIT 5`,
      ).bind(startAt),
      db.prepare(
        `SELECT MAX(artist) AS label, COUNT(*) AS count
         FROM search_events
         WHERE created_at >= ?1 AND success = 1 AND artist IS NOT NULL
         GROUP BY lower(artist)
         ORDER BY count DESC, label ASC
         LIMIT 5`,
      ).bind(startAt),
      db.prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN original_performer_status = 'true' THEN 1 ELSE 0 END), 0) AS included,
           COALESCE(SUM(CASE WHEN original_performer_status = 'false' THEN 1 ELSE 0 END), 0) AS excluded,
           COALESCE(SUM(CASE WHEN original_performer_status = 'unknown' THEN 1 ELSE 0 END), 0) AS unknown_count
         FROM search_events
         WHERE created_at >= ?1 AND success = 1`,
      ).bind(startAt),
      db.prepare("SELECT MIN(created_at) AS collection_started_at FROM search_events"),
    ]);

  const repository = repositoryResult.results[0] ?? {};
  const searchTotals = searchTotalsResult.results[0] ?? {};
  const collection = collectionResult.results[0] ?? {};
  const originalPerformer = originalPerformerResult.results[0] ?? {};
  const databaseBytes = finiteNumber(repositoryResult.meta.size_after);
  const capacityPercentage =
    capacityBytes && databaseBytes !== null
      ? Math.min((databaseBytes / capacityBytes) * 100, 100)
      : null;

  return {
    range,
    quota: {
      ...quota,
      source: "local_estimate",
      unit: "search_calls",
    },
    repository: {
      totalQueries: rowNumber(repository, "total_queries"),
      totalResults: rowNumber(repository, "total_results"),
      repositoryHits: rowNumber(repository, "repository_hits"),
      estimatedRepositoryBytes: rowNumber(repository, "estimated_bytes"),
      databaseBytes,
      capacityBytes,
      capacityPercentage,
      capacitySource: capacityBytes ? "configured" : "unknown",
      warningThresholdPercentage,
      storagePressure:
        capacityPercentage === null || warningThresholdPercentage === null
          ? null
          : capacityPercentage >= warningThresholdPercentage,
      songQueries: rowNumber(repository, "song_queries"),
      artistQueries: rowNumber(repository, "artist_queries"),
      uniqueSongs: rowNumber(repository, "unique_songs"),
      uniqueArtists: rowNumber(repository, "unique_artists"),
    },
    searches: {
      total: rowNumber(searchTotals, "total"),
      repositoryHits: rowNumber(searchTotals, "repository_hits"),
      externalRequests: rowNumber(searchTotals, "external_requests"),
      trend: trendResult.results.map((row) => {
        const bucket = rowString(row, "bucket");
        return {
          bucket,
          label: trendLabel(bucket, range),
          repositoryHits: rowNumber(row, "repository_hits"),
          externalRequests: rowNumber(row, "external_requests"),
        };
      }),
      topSearches: topResult.results.map((row) => ({
        query: rowString(row, "query"),
        searchType: rowString(row, "search_type") === "artist" ? "artist" : "song",
        count: rowNumber(row, "count"),
      })),
      topSongs: topSongsResult.results.map((row) => ({
        label: rowString(row, "label"),
        count: rowNumber(row, "count"),
      })),
      topArtists: topArtistsResult.results.map((row) => ({
        label: rowString(row, "label"),
        count: rowNumber(row, "count"),
      })),
      originalPerformer: {
        included: rowNumber(originalPerformer, "included"),
        excluded: rowNumber(originalPerformer, "excluded"),
        unknown: rowNumber(originalPerformer, "unknown_count"),
      },
    },
    collectionStartedAt: nullableRowString(collection, "collection_started_at"),
    updatedAt: new Date().toISOString(),
  };
}

export async function listAdminSearchEvents(
  db: D1Database,
  options: {
    range: AdminRange;
    page?: number;
    pageSize?: number;
    query?: string;
    source?: AdminResponseSource;
  },
): Promise<AdminSearchEventPage> {
  const page = positiveInteger(options.page, 1);
  const pageSize = Math.min(positiveInteger(options.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const clauses = ["created_at >= ?1"];
  const bindings: unknown[] = [rangeStart(options.range).toISOString()];

  if (options.query) {
    bindings.push(`%${escapeLike(options.query)}%`);
    clauses.push(`query_text LIKE ?${bindings.length} ESCAPE '\\'`);
  }

  if (options.source) {
    bindings.push(options.source);
    clauses.push(`response_source = ?${bindings.length}`);
  }

  const where = clauses.join(" AND ");
  const offset = (page - 1) * pageSize;
  const countStatement = db
    .prepare(`SELECT COUNT(*) AS total FROM search_events WHERE ${where}`)
    .bind(...bindings);
  const rowsStatement = db
    .prepare(
      `SELECT id, query_text, artist, song, search_type, original_performer_status,
              response_source, result_count, success, error_code, created_at
       FROM search_events
       WHERE ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ?${bindings.length + 1} OFFSET ?${bindings.length + 2}`,
    )
    .bind(...bindings, pageSize, offset);
  const [countResult, rowsResult] = await db.batch<Record<string, unknown>>([
    countStatement,
    rowsStatement,
  ]);
  const total = rowNumber(countResult.results[0] ?? {}, "total");

  return {
    items: rowsResult.results.map(toAdminSearchEventItem),
    page,
    pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    updatedAt: new Date().toISOString(),
  };
}

export async function listAdminRepositoryEntries(
  db: D1Database,
  options: {
    page?: number;
    pageSize?: number;
    query?: string;
    searchType?: SearchType;
    sort?: "recent" | "reuse" | "results" | "size";
    direction?: "asc" | "desc";
  },
): Promise<AdminRepositoryPage> {
  const page = positiveInteger(options.page, 1);
  const pageSize = Math.min(positiveInteger(options.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const clauses: string[] = [];
  const bindings: unknown[] = [];

  if (options.query) {
    bindings.push(`%${escapeLike(options.query)}%`);
    clauses.push(
      `(original_query LIKE ?${bindings.length} ESCAPE '\\' OR normalized_query LIKE ?${bindings.length} ESCAPE '\\' OR artist LIKE ?${bindings.length} ESCAPE '\\')`,
    );
  }

  if (options.searchType) {
    bindings.push(options.searchType);
    clauses.push(`search_type = ?${bindings.length}`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const sortColumn = {
    recent: "last_accessed_at",
    reuse: "access_count",
    results: "result_count",
    size: "approx_bytes",
  }[options.sort ?? "recent"];
  const direction = options.direction === "asc" ? "ASC" : "DESC";
  const offset = (page - 1) * pageSize;
  const countStatement = db
    .prepare(`SELECT COUNT(*) AS total FROM search_repository_entries ${where}`)
    .bind(...bindings);
  const rowsStatement = db
    .prepare(
      `SELECT id, original_query, normalized_query, artist, search_type,
              include_original_vocal, response_json, result_count, approx_bytes,
              access_count, created_at, updated_at, last_accessed_at
       FROM search_repository_entries
       ${where}
       ORDER BY ${sortColumn} ${direction}, id ASC
       LIMIT ?${bindings.length + 1} OFFSET ?${bindings.length + 2}`,
    )
    .bind(...bindings, pageSize, offset);
  const [countResult, rowsResult] = await db.batch<Record<string, unknown>>([
    countStatement,
    rowsStatement,
  ]);
  const total = rowNumber(countResult.results[0] ?? {}, "total");

  return {
    items: rowsResult.results.map(toAdminRepositoryItem),
    page,
    pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteAdminRepositoryEntries(
  db: D1Database,
  ids: string[],
  cache?: KVNamespace,
): Promise<AdminDeleteRepositoryResult> {
  const uniqueIds = [...new Set(ids)].slice(0, MAX_DELETE_COUNT);
  const placeholders = uniqueIds.map((_, index) => `?${index + 1}`).join(", ");
  const session = db.withSession("first-primary");
  const now = new Date().toISOString();
  let cacheRows: D1Result<Record<string, unknown>>;

  try {
    cacheRows = await session
      .prepare(
        `SELECT id, family_hash, normalized_query, normalized_artist, search_type,
                include_original_vocal
         FROM search_repository_entries
         WHERE id IN (${placeholders})`,
      )
      .bind(...uniqueIds)
      .all<Record<string, unknown>>();
    const existingIds = cacheRows.results.map((row) => rowString(row, "id"));
    const auditId = crypto.randomUUID();

    await session.batch([
      session
        .prepare(`DELETE FROM search_repository_entries WHERE id IN (${placeholders})`)
        .bind(...uniqueIds),
      session
        .prepare(
          `INSERT INTO admin_audit_events (
             id, action, target_type, target_ids_json, affected_count, outcome,
             details_json, created_at
           ) VALUES (?1, 'delete_repository_entries', 'search_repository_entry', ?2, ?3, 'success', ?4, ?5)`,
        )
        .bind(
          auditId,
          JSON.stringify(uniqueIds),
          existingIds.length,
          JSON.stringify({ requestedCount: uniqueIds.length }),
          now,
        ),
    ]);

    if (cache) {
      await Promise.allSettled(
        cacheRows.results.flatMap((row) => {
          const familyHash = rowString(row, "family_hash");
          const normalizedQuery = rowString(row, "normalized_query");
          const searchType = rowString(row, "search_type") === "artist" ? "artist" : "song";
          const includeOriginalVocal = rowNumber(row, "include_original_vocal") === 1;
          const artist = nullableRowString(row, "normalized_artist") ?? undefined;
          return [
            cache.delete(searchCacheFamilyKey(familyHash)),
            cache.delete(
              searchCacheIndexKey(normalizedQuery, {
                searchType,
                includeOriginalVocal,
                artist,
              }),
            ),
          ];
        }),
      );
    }

    return {
      requestedCount: uniqueIds.length,
      deletedCount: existingIds.length,
      deletedIds: existingIds,
      updatedAt: now,
    };
  } catch (error) {
    await recordFailedDeletionAudit(db, uniqueIds, error);
    throw error;
  }
}

async function recordFailedDeletionAudit(db: D1Database, ids: string[], error: unknown) {
  try {
    await db
      .prepare(
        `INSERT INTO admin_audit_events (
           id, action, target_type, target_ids_json, affected_count, outcome,
           details_json, created_at
         ) VALUES (?1, 'delete_repository_entries', 'search_repository_entry', ?2, 0, 'failure', ?3, ?4)`,
      )
      .bind(
        crypto.randomUUID(),
        JSON.stringify(ids),
        JSON.stringify({ error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error" }),
        new Date().toISOString(),
      )
      .run();
  } catch (auditError) {
    console.error(
      JSON.stringify({
        event: "admin-deletion-audit-failed",
        error: auditError instanceof Error ? auditError.message : "Unknown audit error",
      }),
    );
  }
}

export function normalizeAdminRange(value: string | null): AdminRange {
  return value === "7d" || value === "30d" ? value : "24h";
}

export function readConfiguredCapacityBytes(value: string | undefined) {
  const capacity = Number(value);
  return Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : null;
}

export function readConfiguredWarningThresholdPercentage(value: string | undefined) {
  const threshold = Number(value);
  return Number.isFinite(threshold) && threshold > 0 && threshold < 100 ? threshold : null;
}

export function isValidDeleteIds(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_DELETE_COUNT &&
    value.every((id) => typeof id === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(id))
  );
}

function parseStoredResponse(value: string): SearchResponse | null {
  try {
    const response = JSON.parse(value) as Partial<SearchResponse>;
    return typeof response.query === "string" && Array.isArray(response.results)
      ? (response as SearchResponse)
      : null;
  } catch {
    return null;
  }
}

function toAdminSearchEventItem(row: Record<string, unknown>): AdminSearchEventItem {
  return {
    id: rowString(row, "id"),
    query: rowString(row, "query_text"),
    artist: nullableRowString(row, "artist"),
    song: nullableRowString(row, "song"),
    searchType: rowString(row, "search_type") === "artist" ? "artist" : "song",
    originalPerformerStatus:
      rowString(row, "original_performer_status") === "true"
        ? "true"
        : rowString(row, "original_performer_status") === "false"
          ? "false"
          : "unknown",
    source: normalizeResponseSource(rowString(row, "response_source")),
    resultCount: rowNumber(row, "result_count"),
    success: rowNumber(row, "success") === 1,
    errorCode: nullableRowString(row, "error_code"),
    createdAt: rowString(row, "created_at"),
  };
}

function toAdminRepositoryItem(row: Record<string, unknown>): AdminRepositoryItem {
  const response = parseStoredResponse(rowString(row, "response_json"));
  return {
    id: rowString(row, "id"),
    query: rowString(row, "original_query"),
    normalizedQuery: rowString(row, "normalized_query"),
    artist: nullableRowString(row, "artist"),
    searchType: rowString(row, "search_type") === "artist" ? "artist" : "song",
    includeOriginalVocal: rowNumber(row, "include_original_vocal") === 1,
    resultCount: rowNumber(row, "result_count"),
    accessCount: rowNumber(row, "access_count"),
    approxBytes: rowNumber(row, "approx_bytes"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
    lastAccessedAt: rowString(row, "last_accessed_at"),
    previewResults: response?.results.slice(0, 3) ?? [],
  };
}

function normalizeResponseSource(value: string): AdminResponseSource {
  return value === "repository" || value === "external" || value === "mock"
    ? value
    : "error";
}

function rangeStart(range: AdminRange, now = new Date()) {
  const hours = range === "24h" ? 24 : range === "7d" ? 7 * 24 : 30 * 24;
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

function trendLabel(bucket: string, range: AdminRange) {
  const date = new Date(bucket);

  if (!Number.isFinite(date.getTime())) {
    return bucket;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/Toronto",
    ...(range === "24h"
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : { month: "2-digit", day: "2-digit" }),
  }).format(date);
}

function positiveInteger(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function escapeLike(value: string) {
  return value.trim().slice(0, 100).replace(/[\\%_]/g, "\\$&");
}

function rowNumber(row: Record<string, unknown>, key: string) {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function rowString(row: Record<string, unknown>, key: string) {
  return typeof row[key] === "string" ? row[key] : "";
}

function nullableRowString(row: Record<string, unknown>, key: string) {
  return typeof row[key] === "string" && row[key] ? row[key] : null;
}
