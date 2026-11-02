import type { ApiStamp, VideoSearchResult } from "../types/youtube";

export const METADATA_TTL_MS = 29 * 24 * 60 * 60 * 1000;
export const STATUS_TTL_MS = 60 * 60 * 1000;
export function apiStamp(now = Date.now()): ApiStamp {
  return { source: "youtube-api", fetchedAt: new Date(now).toISOString(), expiresAt: new Date(now + METADATA_TTL_MS).toISOString() };
}
export function freshStamp(value: unknown, now = Date.now()): value is ApiStamp {
  if (!value || typeof value !== "object" || !("source" in value) || value.source !== "youtube-api" ||
      !("fetchedAt" in value) || typeof value.fetchedAt !== "string" || !("expiresAt" in value) || typeof value.expiresAt !== "string") return false;
  const start = Date.parse(value.fetchedAt), end = Date.parse(value.expiresAt);
  return Number.isFinite(now) && Number.isFinite(start) && Number.isFinite(end) && start <= now && end > now && end > start && end <= start + METADATA_TTL_MS && value.fetchedAt === new Date(start).toISOString() && value.expiresAt === new Date(end).toISOString();
}
export function sanitizeVideo<T extends VideoSearchResult>(video: T, now = Date.now()): T | null {
  if (!video || typeof video !== "object" || !freshStamp(video.provenance?.snippet, now)) return null;
  const next = { ...video, provenance: { ...video.provenance } };
  if (!freshStamp(next.provenance.details, now)) {
    delete next.durationSeconds; delete next.categoryId; delete next.tags; delete next.provenance.details;
  }
  if (!freshStamp(next.provenance.status, now)) {
    next.madeForKids = "unknown"; delete next.embeddable; delete next.provenance.status;
  }
  return next;
}
export function freshVideos<T extends VideoSearchResult>(videos: T[], now = Date.now()): T[] {
  return videos.flatMap((video) => { const clean = sanitizeVideo(video, now); return clean ? [clean] : []; });
}
export function playbackAllowed(video: Pick<VideoSearchResult, "provenance" | "madeForKids" | "embeddable">, now = Date.now()) {
  const stamp = video.provenance?.status;
  return freshStamp(stamp, now) && now < Date.parse(stamp.fetchedAt) + STATUS_TTL_MS && video.madeForKids === false && video.embeddable === true;
}
export function metadataExpiry(videos: VideoSearchResult[]) {
  return Math.min(...videos.flatMap((v) => Object.values(v.provenance ?? {}).map((s) => Date.parse(s.expiresAt))));
}
