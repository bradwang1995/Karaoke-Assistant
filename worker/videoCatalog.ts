import { normalizeQuery } from "../src/lib/queryNormalize";
import type { VideoSearchResult } from "../src/types/youtube";
import { isEligibleSongResult } from "./songFilter";

const MAX_CATALOG_WRITE_RESULTS = 50;

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

function uniqueCatalogCandidates(candidates: VideoCatalogCandidate[]) {
  const seen = new Set<string>();
  const unique: VideoCatalogCandidate[] = [];

  for (const candidate of candidates) {
    if (
      !candidate.videoId ||
      !candidate.title ||
      seen.has(candidate.videoId) ||
      !isEligibleSongResult(candidate)
    ) {
      continue;
    }

    seen.add(candidate.videoId);
    unique.push(candidate);
  }

  return unique;
}
