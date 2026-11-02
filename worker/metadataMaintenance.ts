import { freshVideos, metadataExpiry } from "../src/lib/metadataLifecycle";
import type { SearchResponse } from "../src/types/youtube";
import { lookupYouTubeVideosByIds } from "./youtubeSearch";
import { reserveDetails, saveVideoMetadata } from "./videoMetadata";
import type { Env } from "./types";

// Bounded and restartable. Dry-run never refreshes, writes, or advances the cursor.
export async function maintainMetadata(env: Env, now = Date.now(), dryRun = false) {
  const db = env.DB;
  if (!db || !Number.isFinite(now)) return;
  const cutoff = new Date(now).toISOString();
  if (!dryRun && env.YOUTUBE_API_KEY) {
    const due = await db.prepare(`SELECT video_id, fetched_at FROM youtube_video_metadata
      WHERE fetched_at <= ? ORDER BY CASE WHEN video_id IN
      (SELECT video_id FROM queue_items WHERE status IN ('queued','playing')) THEN 0 ELSE 1 END, fetched_at LIMIT 50`)
      .bind(new Date(now - 86400000).toISOString()).all<{ video_id: string; fetched_at: string }>();
    if (due.results.length && await reserveDetails(db, true, now)) {
      try {
        const refreshed = await lookupYouTubeVideosByIds(due.results.map((row) => row.video_id), env.YOUTUBE_API_KEY);
        await saveVideoMetadata(db, refreshed);
        // A successful complete response omitted this ID. Do not retain its old payload.
        const found = new Set(refreshed.map((video) => video.videoId));
        const missing = due.results.filter((row) => !found.has(row.video_id));
        if (missing.length) await db.batch(missing.map((row) => db.prepare("DELETE FROM youtube_video_metadata WHERE video_id=? AND fetched_at <= ?").bind(row.video_id, row.fetched_at)));
      } catch { console.error("metadata-maintenance-daily-refresh-failed"); }
    }
  }
  const stale = await db.prepare(`SELECT id, response_json FROM search_repository_entries
    WHERE response_json != '{}' AND (julianday(metadata_expires_at) IS NULL OR metadata_expires_at <= ?)
    ORDER BY last_accessed_at DESC, id LIMIT 100`).bind(cutoff).all<{ id: string; response_json: string }>();
  const stats = { dryRun, repositoryCandidates: stale.results.length, refreshedVideos: 0, deletedKvKeys: 0, changedRows: [] as number[] };
  if (!dryRun && env.YOUTUBE_API_KEY && stale.results.length) {
    // Save the investment in known video candidates before retiring unknown-age payloads.
    const row = stale.results[0];
    try {
      const response = JSON.parse(row.response_json) as SearchResponse;
      const ids = [...new Set((response.results ?? []).map((v) => v.videoId))].filter((id) => /^[a-zA-Z0-9_-]{11}$/.test(id)).slice(0, 50);
      if (ids.length && await reserveDetails(db, true, now)) {
        const videos = await lookupYouTubeVideosByIds(ids, env.YOUTUBE_API_KEY);
        await saveVideoMetadata(db, videos);
        stats.refreshedVideos = videos.length;
        if (videos.length) {
          const next = { query: response.query, normalizedQuery: response.normalizedQuery, searchType: response.searchType,
            includeOriginalVocal: response.includeOriginalVocal, cached: true, results: videos } satisfies SearchResponse;
          await db.prepare(`UPDATE search_repository_entries SET response_json=?, metadata_expires_at=?, result_count=?, approx_bytes=?
            WHERE id=? AND response_json=?`).bind(JSON.stringify(next), new Date(metadataExpiry(videos)).toISOString(), videos.length,
              new TextEncoder().encode(JSON.stringify(next)).byteLength, row.id, row.response_json).run();
        }
      }
    } catch { console.error("metadata-maintenance-refresh-failed"); }
  }
  if (!dryRun) {
    const statements = [
      db.prepare(`UPDATE search_repository_entries SET response_json='{}', result_count=0, approx_bytes=2 WHERE id IN
        (SELECT id FROM search_repository_entries WHERE response_json != '{}' AND (julianday(metadata_expires_at) IS NULL OR metadata_expires_at <= ?) LIMIT 100)`).bind(cutoff),
      db.prepare(`DELETE FROM search_video_catalog WHERE video_id IN (SELECT video_id FROM search_video_catalog
        WHERE julianday(metadata_expires_at) IS NULL OR metadata_expires_at <= ? LIMIT 1000)`).bind(cutoff),
      db.prepare(`DELETE FROM youtube_video_metadata WHERE video_id IN (SELECT video_id FROM youtube_video_metadata WHERE julianday(expires_at) IS NULL OR julianday(fetched_at) IS NULL OR julianday(expires_at) > julianday(fetched_at) + 29 OR expires_at <= ? LIMIT 1000)`).bind(cutoff),
      db.prepare(`UPDATE queue_items SET title='YouTube 视频', channel_title=NULL, thumbnail_url=NULL WHERE id IN
        (SELECT id FROM queue_items WHERE title != 'YouTube 视频' OR channel_title IS NOT NULL OR thumbnail_url IS NOT NULL LIMIT 1000)`),
      db.prepare("DELETE FROM youtube_refresh_leases WHERE expires_at <= ?").bind(now),
      db.prepare("DELETE FROM youtube_details_daily WHERE quota_date < ?").bind(new Date(now - 90 * 86400000).toISOString().slice(0, 10)),
    ];
    const result = await db.batch(statements);
    stats.changedRows = result.map((r) => r.meta.changes ?? 0);
  }
  if (env.SEARCH_CACHE) {
    const state = await db.prepare("SELECT cursor FROM youtube_maintenance_state WHERE name='legacy-kv'").first<{ cursor: string | null }>();
    const page = await env.SEARCH_CACHE.list({ prefix: "yt-search", cursor: state?.cursor ?? undefined, limit: 100 });
    for (const key of page.keys) {
      const current = key.name.startsWith("yt-search:v5:") || key.name.startsWith("yt-search-recommendations:v9:");
      let remove = !current;
      if (current) {
        const payload = await env.SEARCH_CACHE.get<{ results?: SearchResponse["results"] }>(key.name, { type: "json" }).catch(() => null);
        remove = !payload?.results?.length || freshVideos(payload.results, now).length !== payload.results.length;
      }
      if (remove) { stats.deletedKvKeys++; if (!dryRun) await env.SEARCH_CACHE.delete(key.name); }
    }
    if (!dryRun) await db.prepare(`INSERT INTO youtube_maintenance_state VALUES ('legacy-kv', ?)
      ON CONFLICT(name) DO UPDATE SET cursor=excluded.cursor`).bind(page.list_complete ? null : page.cursor).run();
  }
  console.log(JSON.stringify({ event: "youtube-metadata-maintenance", ...stats }));
  return stats;
}
