import { freshVideos, metadataExpiry, playbackAllowed, sanitizeVideo, STATUS_TTL_MS } from "../src/lib/metadataLifecycle";
import type { PlaybackDecision, VideoSearchResult } from "../src/types/youtube";
import type { Env } from "./types";
import { lookupYouTubeVideoById } from "./youtubeSearch";

export async function reserveDetails(db: D1Database | undefined, background = false, now = Date.now()) {
  if (!db || !Number.isFinite(now)) return false; // Never make unmetered production details requests.
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  try {
    const row = await db.prepare(`INSERT INTO youtube_details_daily (quota_date, attempts, background_attempts)
    VALUES (?1, 1, ?2) ON CONFLICT(quota_date) DO UPDATE SET attempts = attempts + 1,
    background_attempts = background_attempts + ?2
    WHERE attempts < 1000 AND (background_attempts + ?2) <= 500 RETURNING attempts`).bind(day, background ? 1 : 0).first();
    return Boolean(row);
  } catch { console.error("youtube-details-budget-unavailable"); return false; }
}

export async function saveVideoMetadata(db: D1Database | undefined, videos: VideoSearchResult[]) {
  if (!db) return;
  const clean = freshVideos(videos);
  if (!clean.length) return;
  await db.batch(clean.map((v) => db.prepare(`INSERT INTO youtube_video_metadata (video_id, response_json, fetched_at, expires_at)
    VALUES (?1, ?2, ?3, ?4) ON CONFLICT(video_id) DO UPDATE SET response_json=excluded.response_json,
    fetched_at=excluded.fetched_at, expires_at=excluded.expires_at WHERE excluded.fetched_at >= fetched_at`)
    .bind(v.videoId, JSON.stringify(v), v.provenance!.snippet!.fetchedAt, new Date(metadataExpiry([v])).toISOString())));
}

export async function readVideoMetadata(db: D1Database, ids: string[]) {
  const unique = [...new Set(ids)];
  const result = new Map<string, VideoSearchResult>();
  for (let start = 0; start < unique.length; start += 50) {
    const batch = unique.slice(start, start + 50);
    const rows = await db.prepare(`SELECT response_json FROM youtube_video_metadata WHERE video_id IN (${batch.map(() => "?").join(",")}) AND expires_at > ?`)
      .bind(...batch, new Date().toISOString()).all<{ response_json: string }>();
    for (const row of rows.results) {
      try { const v = sanitizeVideo(JSON.parse(row.response_json) as VideoSearchResult); if (v) result.set(v.videoId, v); } catch { /* Corrupt cache is a miss. */ }
    }
  }
  return result;
}

export async function checkPlayback(env: Env, videoId: string): Promise<PlaybackDecision> {
  const blocked = (reason: PlaybackDecision["reason"]): PlaybackDecision => ({ videoId, allowed: false, reason });
  if (!env.DB) return blocked("unknown");
  let video = (await readVideoMetadata(env.DB, [videoId])).get(videoId);
  if (typeof video?.madeForKids !== "boolean" || typeof video.embeddable !== "boolean" || !video?.provenance?.status || Date.now() >= Date.parse(video.provenance.status.fetchedAt) + STATUS_TTL_MS) {
    if (!env.YOUTUBE_API_KEY) return blocked("unknown");
    const leaseId = crypto.randomUUID(), now = Date.now();
    const lease = await env.DB.prepare(`INSERT INTO youtube_refresh_leases VALUES (?1, ?2, ?3)
      ON CONFLICT(video_id) DO UPDATE SET lease_id=excluded.lease_id, expires_at=excluded.expires_at
      WHERE expires_at <= ?4 RETURNING lease_id`).bind(videoId, leaseId, now + 10_000, now).first();
    if (!lease) return blocked("unknown");
    try {
      if (!await reserveDetails(env.DB)) return blocked("budget");
      const fetched = await lookupYouTubeVideoById(videoId, env.YOUTUBE_API_KEY);
      if (!fetched) {
        await env.DB.prepare("DELETE FROM youtube_video_metadata WHERE video_id = ?").bind(videoId).run();
        return blocked("unavailable");
      }
      video = fetched;
      await saveVideoMetadata(env.DB, [video]);
    } catch { return blocked("unknown"); }
    finally { await env.DB.prepare("DELETE FROM youtube_refresh_leases WHERE video_id=? AND lease_id=?").bind(videoId, leaseId).run(); }
  }
  if (video.embeddable === false) return blocked("unavailable");
  if (video.madeForKids === true) return blocked("made-for-kids");
  if (!playbackAllowed(video)) return blocked("unknown");
  return { videoId, allowed: true, reason: "allowed", expiresAt: new Date(Date.parse(video.provenance!.status!.fetchedAt) + STATUS_TTL_MS).toISOString() };
}
