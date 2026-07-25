import type {
  AdminCleanupCandidate,
  AdminCleanupHistoryItem,
  AdminCleanupPreview,
  AdminCleanupResult,
  AdminDeleteRepositoryResult,
  AdminOverview,
  AdminRange,
  AdminRepositoryItem,
  AdminRepositoryPage,
  AdminResponseSource,
  AdminSearchEventItem,
  AdminSearchEventPage,
  AdminStorageCapacitySource,
  AdminStorageResourceMetric,
  AdminStorageUsageSource,
} from "../src/types/admin";
import type { SearchResponse, SearchType, YouTubeQuotaStatus } from "../src/types/youtube";
import { searchCacheFamilyKey, searchCacheIndexKey } from "./kvCache";
import type { SearchQueryFamily } from "./searchFamily";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_DELETE_COUNT = 50;
const DEFAULT_CLEANUP_BATCH_SIZE = 25;
const MAX_CLEANUP_BATCH_SIZE = 50;
const CLEANUP_LOCK_NAME = "repository-storage-pressure";
const CLEANUP_LOCK_SECONDS = 60;

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
): Promise<Omit<AdminOverview, "storage">> {
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

interface RepositoryCleanupConfig {
  capacityBytes: number | null;
  databaseBytes: number | null;
  usageSource: AdminStorageUsageSource;
  usageAuthoritative: boolean;
  capacitySource: AdminStorageCapacitySource;
  measuredAt: string | null;
  stale: boolean;
  thresholdPercentage: number | null;
  targetPercentage: number | null;
  batchSize?: number | null;
}

type RefreshD1StorageMetric = () => Promise<
  Pick<AdminStorageResourceMetric, "usedBytes" | "usageAuthoritative" | "stale">
>;

export class RepositoryCleanupBusyError extends Error {
  readonly code = "REPOSITORY_CLEANUP_BUSY";

  constructor() {
    super("已有资料库清理任务正在运行，请稍后重试。");
  }
}

export async function previewAdminRepositoryCleanup(
  db: D1Database,
  config: RepositoryCleanupConfig,
): Promise<AdminCleanupPreview> {
  const now = new Date().toISOString();
  const [storage, recentRuns] = await Promise.all([
    readRepositoryStorage(db),
    readRecentCleanupRuns(db),
  ]);
  const batchSize = normalizeCleanupBatchSize(config.batchSize);
  const base = {
    capacityBytes: config.capacityBytes,
    databaseBytes: config.databaseBytes,
    capacityPercentage: calculatePercentage(config.databaseBytes, config.capacityBytes),
    usageSource: config.usageSource,
    usageAuthoritative: config.usageAuthoritative,
    capacitySource: config.capacitySource,
    measuredAt: config.measuredAt,
    stale: config.stale,
    thresholdPercentage: config.thresholdPercentage,
    targetPercentage: config.targetPercentage,
    batchSize,
    estimatedRepositoryBytes: storage.estimatedRepositoryBytes,
    recentRuns,
    updatedAt: now,
  };

  if (config.databaseBytes === null || !config.usageAuthoritative) {
    return unavailableCleanupPreview(base, "measurement_unavailable");
  }

  if (config.stale) {
    return unavailableCleanupPreview(base, "measurement_stale");
  }

  if (config.capacityBytes === null) {
    return unavailableCleanupPreview(base, "capacity_unknown");
  }

  if (config.thresholdPercentage === null || config.targetPercentage === null) {
    return unavailableCleanupPreview(base, "policy_incomplete");
  }

  if (config.targetPercentage >= config.thresholdPercentage) {
    return unavailableCleanupPreview(base, "policy_invalid");
  }

  if ((base.capacityPercentage ?? 0) < config.thresholdPercentage) {
    return unavailableCleanupPreview(base, "below_threshold", true);
  }

  if (storage.totalQueries === 0) {
    return unavailableCleanupPreview(base, "repository_empty", true);
  }

  const candidateResult = await db
    .prepare(
      `SELECT id, original_query, search_type, access_count, approx_bytes,
              created_at, last_accessed_at
       FROM search_repository_entries
       ORDER BY access_count ASC, last_accessed_at ASC, created_at ASC, id ASC
       LIMIT ?1`,
    )
    .bind(batchSize)
    .all<Record<string, unknown>>();
  const bytesNeeded = Math.max(
    config.databaseBytes - config.capacityBytes * (config.targetPercentage / 100),
    0,
  );
  const candidates: AdminCleanupCandidate[] = [];
  let estimatedBytesToRemove = 0;

  for (const row of candidateResult.results) {
    const candidate = toCleanupCandidate(row);
    candidates.push(candidate);
    estimatedBytesToRemove += candidate.approxBytes;

    if (estimatedBytesToRemove >= bytesNeeded) {
      break;
    }
  }

  return {
    configured: true,
    actionNeeded: candidates.length > 0,
    unavailableReason: candidates.length > 0 ? null : "repository_empty",
    ...base,
    estimatedBytesToRemove,
    candidates,
    policy: cleanupPolicyDescription(
      config.thresholdPercentage,
      config.targetPercentage,
      batchSize,
    ),
  };
}

export async function runAdminRepositoryCleanup(
  db: D1Database,
  config: RepositoryCleanupConfig,
  cache?: KVNamespace,
  refreshD1StorageMetric?: RefreshD1StorageMetric,
): Promise<AdminCleanupResult> {
  const leaseId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const startedAt = new Date();

  if (!(await acquireCleanupLock(db, leaseId, startedAt))) {
    throw new RepositoryCleanupBusyError();
  }

  try {
    const preview = await previewAdminRepositoryCleanup(db, config);

    if (!preview.actionNeeded || preview.candidates.length === 0) {
      const result = skippedCleanupResult(runId, preview);
      await recordCleanupAudit(db, runId, [], "success", {
        result: "skipped",
        preview,
        message: result.message,
      });
      return result;
    }

    const ids = preview.candidates.map((candidate) => candidate.id);
    const placeholders = ids.map((_, index) => `?${index + 1}`).join(", ");
    const session = db.withSession("first-primary");
    const cacheRows = await session
      .prepare(
        `SELECT family_hash, normalized_query, normalized_artist, search_type,
                include_original_vocal
         FROM search_repository_entries
         WHERE id IN (${placeholders})`,
      )
      .bind(...ids)
      .all<Record<string, unknown>>();

    const batchResults = await session.batch([
      session
        .prepare(`DELETE FROM search_repository_entries WHERE id IN (${placeholders})`)
        .bind(...ids),
      session
        .prepare(
          `INSERT INTO admin_audit_events (
             id, action, target_type, target_ids_json, affected_count, outcome,
             details_json, created_at
           ) VALUES (?1, 'cleanup_repository', 'search_repository_entry', ?2, ?3, 'success', ?4, ?5)`,
        )
        .bind(
          runId,
          JSON.stringify(ids),
          ids.length,
          JSON.stringify({ result: "running", preview }),
          startedAt.toISOString(),
        ),
    ]);
    const deletedCount = Number(batchResults[0]?.meta.changes ?? ids.length);

    await deleteRepositoryCacheRows(cache, cacheRows.results);
    const estimatedBytesRemoved = preview.candidates.reduce(
      (total, candidate) => total + candidate.approxBytes,
      0,
    );
    const afterRepository = await readRepositoryStorageAfterCleanup(
      db,
      Math.max(preview.estimatedRepositoryBytes - estimatedBytesRemoved, 0),
    );
    const refreshedStorage = refreshD1StorageMetric
      ? await refreshD1StorageMetric().catch(() => null)
      : null;
    const databaseBytesAfter =
      refreshedStorage?.usageAuthoritative && !refreshedStorage.stale
        ? refreshedStorage.usedBytes
        : null;
    const percentageAfter = calculatePercentage(databaseBytesAfter, preview.capacityBytes);
    const targetReached =
      percentageAfter === null || preview.targetPercentage === null
        ? null
        : percentageAfter <= preview.targetPercentage;
    const outcome = targetReached === true && deletedCount === ids.length ? "success" : "partial";
    const result: AdminCleanupResult = {
      runId,
      outcome,
      deletedCount,
      deletedIds: ids,
      estimatedBytesRemoved,
      databaseBytesBefore: preview.databaseBytes,
      databaseBytesAfter,
      capacityPercentageBefore: preview.capacityPercentage,
      capacityPercentageAfter: percentageAfter,
      targetPercentage: preview.targetPercentage,
      targetReached,
      message:
        targetReached === true
          ? `本批已删除 ${deletedCount} 条低复用资料，存储已达到目标范围。`
          : `本批已删除 ${deletedCount} 条低复用资料；D1 容量统计可能延迟，必要时可再次预览。`,
      updatedAt: new Date().toISOString(),
    };

    await updateCleanupAudit(db, runId, deletedCount, {
      result: outcome,
      preview,
      after: {
        databaseBytes: databaseBytesAfter,
        estimatedRepositoryBytes: afterRepository.estimatedRepositoryBytes,
        capacityPercentage: percentageAfter,
      },
      estimatedBytesRemoved,
      targetReached,
      message: result.message,
    });

    return result;
  } catch (error) {
    if (!(error instanceof RepositoryCleanupBusyError)) {
      await recordCleanupFailureAudit(db, runId, error, startedAt);
    }
    throw error;
  } finally {
    await releaseCleanupLock(db, leaseId);
  }
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

    await deleteRepositoryCacheRows(cache, cacheRows.results);

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

async function readRepositoryStorage(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT COUNT(*) AS total_queries,
              COALESCE(SUM(approx_bytes), 0) AS estimated_repository_bytes
       FROM search_repository_entries`,
    )
    .all<Record<string, unknown>>();
  const row = result.results[0] ?? {};

  return {
    totalQueries: rowNumber(row, "total_queries"),
    estimatedRepositoryBytes: rowNumber(row, "estimated_repository_bytes"),
  };
}

async function readRepositoryStorageAfterCleanup(
  db: D1Database,
  estimatedRepositoryBytes: number,
) {
  try {
    return await readRepositoryStorage(db);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "repository-cleanup-after-measurement-failed",
        error: error instanceof Error ? error.message : "Unknown measurement error",
      }),
    );
    return {
      totalQueries: 0,
      estimatedRepositoryBytes,
    };
  }
}

async function readRecentCleanupRuns(db: D1Database): Promise<AdminCleanupHistoryItem[]> {
  const result = await db
    .prepare(
      `SELECT id, outcome, affected_count, details_json, created_at
       FROM admin_audit_events
       WHERE action = 'cleanup_repository'
       ORDER BY created_at DESC, id DESC
       LIMIT 5`,
    )
    .all<Record<string, unknown>>();

  return result.results.map((row) => {
    const details = parseJsonRecord(nullableRowString(row, "details_json"));
    const value = details?.result;
    const resultValue =
      value === "success" || value === "partial" || value === "skipped"
        ? value
        : "failure";
    return {
      id: rowString(row, "id"),
      outcome: rowString(row, "outcome") === "success" ? "success" : "failure",
      result: resultValue,
      affectedCount: rowNumber(row, "affected_count"),
      message: typeof details?.message === "string" ? details.message : null,
      createdAt: rowString(row, "created_at"),
    };
  });
}

function unavailableCleanupPreview(
  base: Pick<
    AdminCleanupPreview,
    | "capacityBytes"
    | "databaseBytes"
    | "capacityPercentage"
    | "usageSource"
    | "usageAuthoritative"
    | "capacitySource"
    | "measuredAt"
    | "stale"
    | "thresholdPercentage"
    | "targetPercentage"
    | "batchSize"
    | "estimatedRepositoryBytes"
    | "recentRuns"
    | "updatedAt"
  >,
  unavailableReason: NonNullable<AdminCleanupPreview["unavailableReason"]>,
  configured = false,
): AdminCleanupPreview {
  return {
    configured,
    actionNeeded: false,
    unavailableReason,
    ...base,
    estimatedBytesToRemove: 0,
    candidates: [],
    policy:
      base.thresholdPercentage !== null && base.targetPercentage !== null
        ? cleanupPolicyDescription(
            base.thresholdPercentage,
            base.targetPercentage,
            base.batchSize,
          )
        : "容量、预警线与清理目标必须通过部署配置明确提供；系统不会自行猜测。",
  };
}

function toCleanupCandidate(row: Record<string, unknown>): AdminCleanupCandidate {
  return {
    id: rowString(row, "id"),
    query: rowString(row, "original_query"),
    searchType: rowString(row, "search_type") === "artist" ? "artist" : "song",
    accessCount: rowNumber(row, "access_count"),
    approxBytes: rowNumber(row, "approx_bytes"),
    createdAt: rowString(row, "created_at"),
    lastAccessedAt: rowString(row, "last_accessed_at"),
  };
}

function skippedCleanupResult(
  runId: string,
  preview: AdminCleanupPreview,
): AdminCleanupResult {
  const messages: Record<NonNullable<AdminCleanupPreview["unavailableReason"]>, string> = {
    capacity_unknown: "数据库容量未知，未执行清理。",
    measurement_unavailable: "Cloudflare D1 实际体积暂时无法获取，未执行清理。",
    measurement_stale: "Cloudflare D1 实际体积已经过期，未执行清理。",
    policy_incomplete: "清理策略配置不完整，未执行清理。",
    policy_invalid: "清理目标必须低于预警线，未执行清理。",
    below_threshold: "当前存储尚未达到预警线，无需清理。",
    repository_empty: "持久资料库为空，无需清理。",
  };

  return {
    runId,
    outcome: "skipped",
    deletedCount: 0,
    deletedIds: [],
    estimatedBytesRemoved: 0,
    databaseBytesBefore: preview.databaseBytes,
    databaseBytesAfter: preview.databaseBytes,
    capacityPercentageBefore: preview.capacityPercentage,
    capacityPercentageAfter: preview.capacityPercentage,
    targetPercentage: preview.targetPercentage,
    targetReached: null,
    message:
      messages[preview.unavailableReason ?? "repository_empty"],
    updatedAt: new Date().toISOString(),
  };
}

function cleanupPolicyDescription(
  thresholdPercentage: number,
  targetPercentage: number,
  batchSize: number,
) {
  return `达到 ${thresholdPercentage}% 后，按复用次数、最近使用、创建时间依次从低到高选择；每批最多 ${batchSize} 条，目标降至 ${targetPercentage}% 以下。`;
}

function calculatePercentage(value: number | null, capacity: number | null) {
  return value === null || capacity === null
    ? null
    : (value / capacity) * 100;
}

function normalizeCleanupBatchSize(value: number | null | undefined) {
  return Math.min(
    positiveInteger(value ?? undefined, DEFAULT_CLEANUP_BATCH_SIZE),
    MAX_CLEANUP_BATCH_SIZE,
  );
}

async function acquireCleanupLock(db: D1Database, leaseId: string, now: Date) {
  const expiresAt = new Date(now.getTime() + CLEANUP_LOCK_SECONDS * 1000).toISOString();
  const result = await db
    .prepare(
      `INSERT INTO repository_cleanup_locks (
         lock_name, lease_id, expires_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(lock_name)
       DO UPDATE SET
         lease_id = excluded.lease_id,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at
       WHERE repository_cleanup_locks.expires_at <= ?4`,
    )
    .bind(CLEANUP_LOCK_NAME, leaseId, expiresAt, now.toISOString())
    .run();

  return Number(result.meta.changes ?? 0) === 1;
}

async function releaseCleanupLock(db: D1Database, leaseId: string) {
  try {
    await db
      .prepare(
        `DELETE FROM repository_cleanup_locks
         WHERE lock_name = ?1 AND lease_id = ?2`,
      )
      .bind(CLEANUP_LOCK_NAME, leaseId)
      .run();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "repository-cleanup-lock-release-failed",
        error: error instanceof Error ? error.message : "Unknown lock release error",
      }),
    );
  }
}

async function deleteRepositoryCacheRows(
  cache: KVNamespace | undefined,
  rows: Record<string, unknown>[],
) {
  if (!cache) {
    return;
  }

  await Promise.allSettled(
    rows.flatMap((row) => {
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

async function recordCleanupAudit(
  db: D1Database,
  runId: string,
  ids: string[],
  outcome: "success" | "failure",
  details: unknown,
) {
  await db
    .prepare(
      `INSERT INTO admin_audit_events (
         id, action, target_type, target_ids_json, affected_count, outcome,
         details_json, created_at
       ) VALUES (?1, 'cleanup_repository', 'search_repository_entry', ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(
      runId,
      JSON.stringify(ids),
      ids.length,
      outcome,
      JSON.stringify(details),
      new Date().toISOString(),
    )
    .run();
}

async function updateCleanupAudit(
  db: D1Database,
  runId: string,
  affectedCount: number,
  details: unknown,
) {
  try {
    await db
      .prepare(
        `UPDATE admin_audit_events
         SET affected_count = ?1, details_json = ?2
         WHERE id = ?3`,
      )
      .bind(affectedCount, JSON.stringify(details), runId)
      .run();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "repository-cleanup-audit-update-failed",
        runId,
        error: error instanceof Error ? error.message : "Unknown audit update error",
      }),
    );
  }
}

async function recordCleanupFailureAudit(
  db: D1Database,
  runId: string,
  error: unknown,
  startedAt: Date,
) {
  try {
    await db
      .prepare(
        `INSERT INTO admin_audit_events (
           id, action, target_type, target_ids_json, affected_count, outcome,
           details_json, created_at
         ) VALUES (?1, 'cleanup_repository', 'search_repository_entry', '[]', 0, 'failure', ?2, ?3)
         ON CONFLICT(id)
         DO UPDATE SET outcome = 'failure', details_json = excluded.details_json`,
      )
      .bind(
        runId,
        JSON.stringify({
          result: "failure",
          error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
        }),
        startedAt.toISOString(),
      )
      .run();
  } catch (auditError) {
    console.error(
      JSON.stringify({
        event: "repository-cleanup-failure-audit-failed",
        runId,
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

export function readConfiguredCleanupTargetPercentage(value: string | undefined) {
  return readConfiguredWarningThresholdPercentage(value);
}

export function readConfiguredCleanupBatchSize(value: string | undefined) {
  const batchSize = Number(value);
  return Number.isFinite(batchSize) && batchSize > 0
    ? Math.min(Math.floor(batchSize), MAX_CLEANUP_BATCH_SIZE)
    : DEFAULT_CLEANUP_BATCH_SIZE;
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

function parseJsonRecord(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
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
