import { normalizeQuery } from "../src/lib/queryNormalize";
import type { SearchType, VideoSearchResult } from "../src/types/youtube";
import { rankSearchResultsForQuery } from "./scoring";
import { buildSearchQueryFamily } from "./searchFamily";

const MAX_CATALOG_WRITE_RESULTS = 50;
const MAX_CATALOG_SEARCH_RESULTS = 200;
const MAX_FTS_QUERY_TERMS = 12;

export type VideoCatalogCandidate = Omit<VideoSearchResult, "score" | "reasons">;

export interface VideoCatalogWriteResult {
  candidateCount: number;
  uniqueVideosAdded: number;
}

export async function upsertVideoCatalog(
  db: D1Database | undefined,
  candidates: VideoCatalogCandidate[],
  sourceQuery: string,
): Promise<VideoCatalogWriteResult> {
  const uniqueCandidates = uniqueCatalogCandidates(candidates).slice(0, MAX_CATALOG_WRITE_RESULTS);

  if (!db || uniqueCandidates.length === 0) {
    return {
      candidateCount: uniqueCandidates.length,
      uniqueVideosAdded: 0,
    };
  }

  const now = new Date().toISOString();
  const normalizedSourceQuery = normalizeQuery(sourceQuery);

  const insertResults = await db.batch(
    uniqueCandidates.map((candidate) =>
      db
        .prepare(
          `INSERT INTO search_video_catalog (
             video_id, title, normalized_title, channel_title, normalized_channel_title,
             thumbnail_url, duration_seconds, published_at, first_seen_query,
             last_seen_query, appearance_count, first_seen_at, last_seen_at
           ) VALUES (
             ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, 1, ?10, ?10
           )
           ON CONFLICT(video_id) DO NOTHING`,
        )
        .bind(
          candidate.videoId,
          candidate.title,
          normalizeQuery(candidate.title),
          candidate.channelTitle ?? null,
          normalizeQuery(candidate.channelTitle ?? ""),
          candidate.thumbnailUrl ?? null,
          candidate.durationSeconds ?? null,
          candidate.publishedAt ?? null,
          normalizedSourceQuery,
          now,
        ),
    ),
  );
  const existingCandidates = uniqueCandidates.filter(
    (_, index) => (insertResults[index]?.meta.changes ?? 0) === 0,
  );

  if (existingCandidates.length > 0) {
    await db.batch(
      existingCandidates.map((candidate) =>
        db
          .prepare(
            `UPDATE search_video_catalog
             SET title = ?2,
                 normalized_title = ?3,
                 channel_title = ?4,
                 normalized_channel_title = ?5,
                 thumbnail_url = COALESCE(?6, thumbnail_url),
                 duration_seconds = COALESCE(?7, duration_seconds),
                 published_at = COALESCE(?8, published_at),
                 last_seen_query = ?9,
                 appearance_count = appearance_count + 1,
                 last_seen_at = ?10
             WHERE video_id = ?1`,
          )
          .bind(
            candidate.videoId,
            candidate.title,
            normalizeQuery(candidate.title),
            candidate.channelTitle ?? null,
            normalizeQuery(candidate.channelTitle ?? ""),
            candidate.thumbnailUrl ?? null,
            candidate.durationSeconds ?? null,
            candidate.publishedAt ?? null,
            normalizedSourceQuery,
            now,
          ),
      ),
    );
  }

  return {
    candidateCount: uniqueCandidates.length,
    uniqueVideosAdded: insertResults.filter(
      (result) => (result.meta.changes ?? 0) > 0,
    ).length,
  };
}

export async function searchVideoCatalog({
  db,
  query,
  artist,
  searchType,
  includeOriginalVocal,
  limit,
}: {
  db: D1Database | undefined;
  query: string;
  artist?: string;
  searchType: SearchType;
  includeOriginalVocal: boolean;
  limit: number;
}): Promise<VideoSearchResult[]> {
  if (!db || limit <= 0) {
    return [];
  }

  const family = buildSearchQueryFamily(query, artist, {
    searchType,
    includeOriginalVocal,
  });
  const matchQuery = buildCatalogMatchQuery(
    family.canonicalQuery,
    searchType === "song" ? artist : undefined,
  );

  if (!matchQuery) {
    return [];
  }

  const queryLimit = Math.min(
    Math.max(Math.ceil(limit) * 4, 50),
    MAX_CATALOG_SEARCH_RESULTS,
  );
  const rows = await db
    .prepare(
      `SELECT catalog.video_id, catalog.title, catalog.channel_title,
              catalog.thumbnail_url, catalog.duration_seconds, catalog.published_at
       FROM search_video_catalog_fts
       JOIN search_video_catalog AS catalog
         ON catalog.rowid = search_video_catalog_fts.rowid
       WHERE search_video_catalog_fts MATCH ?1
       ORDER BY bm25(search_video_catalog_fts, 1.0, 0.45) ASC,
                catalog.appearance_count DESC,
                catalog.last_seen_at DESC
       LIMIT ?2`,
    )
    .bind(matchQuery, queryLimit)
    .all<Record<string, unknown>>();

  return rankSearchResultsForQuery(
    rows.results.map(toCatalogCandidate).filter(isCatalogCandidate),
    query,
    {
      searchType,
      includeOriginalVocal,
      artist,
    },
  ).slice(0, limit);
}

export function buildCatalogMatchQuery(query: string, artist?: string) {
  const terms = uniqueTerms([
    ...catalogTerms(query),
    ...catalogTerms(artist ?? ""),
  ]).slice(0, MAX_FTS_QUERY_TERMS);

  return terms.map((term) => `"${term.replace(/"/g, '""')}"`).join(" AND ");
}

function catalogTerms(value: string) {
  return normalizeQuery(value)
    .split(" ")
    .map((term) => term.trim())
    .filter(Boolean);
}

function uniqueTerms(terms: string[]) {
  return [...new Set(terms)];
}

function uniqueCatalogCandidates(candidates: VideoCatalogCandidate[]) {
  const seen = new Set<string>();
  const unique: VideoCatalogCandidate[] = [];

  for (const candidate of candidates) {
    if (!candidate.videoId || !candidate.title || seen.has(candidate.videoId)) {
      continue;
    }

    seen.add(candidate.videoId);
    unique.push(candidate);
  }

  return unique;
}

function toCatalogCandidate(row: Record<string, unknown>): VideoCatalogCandidate | null {
  const videoId = rowString(row, "video_id");
  const title = rowString(row, "title");

  if (!videoId || !title) {
    return null;
  }

  return {
    videoId,
    title,
    ...(nullableRowString(row, "channel_title")
      ? { channelTitle: nullableRowString(row, "channel_title") ?? undefined }
      : {}),
    ...(nullableRowString(row, "thumbnail_url")
      ? { thumbnailUrl: nullableRowString(row, "thumbnail_url") ?? undefined }
      : {}),
    ...(rowNumber(row, "duration_seconds") !== undefined
      ? { durationSeconds: rowNumber(row, "duration_seconds") }
      : {}),
    ...(nullableRowString(row, "published_at")
      ? { publishedAt: nullableRowString(row, "published_at") ?? undefined }
      : {}),
  };
}

function rowString(row: Record<string, unknown>, key: string) {
  return typeof row[key] === "string" ? row[key] : "";
}

function nullableRowString(row: Record<string, unknown>, key: string) {
  return typeof row[key] === "string" && row[key].length > 0 ? row[key] : null;
}

function rowNumber(row: Record<string, unknown>, key: string) {
  return typeof row[key] === "number" && Number.isFinite(row[key]) ? row[key] : undefined;
}

function isCatalogCandidate(
  candidate: VideoCatalogCandidate | null,
): candidate is VideoCatalogCandidate {
  return candidate !== null;
}
