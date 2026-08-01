export interface Env {
  DB?: D1Database;
  SEARCH_CACHE?: KVNamespace;
  ROOM_OBJECT?: DurableObjectNamespace;
  YOUTUBE_API_KEY?: string;
  YOUTUBE_SEARCH_DAILY_LIMIT?: string;
  YOUTUBE_SEARCH_MAX_CALLS_PER_FILL?: string;
  YOUTUBE_SEARCH_TIMEOUT_MS?: string;
  SEARCH_CACHE_TTL_DAYS?: string;
  SEARCH_CACHE_MAX_ENTRY_BYTES?: string;
  SEARCH_RATE_LIMIT_PER_MINUTE?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
  ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_D1_DATABASE_ID?: string;
  CLOUDFLARE_D1_DATABASE_NAME?: string;
  CLOUDFLARE_KV_NAMESPACE_ID?: string;
  CLOUDFLARE_KV_NAMESPACE_NAME?: string;
  CLOUDFLARE_STORAGE_METRICS_TTL_SECONDS?: string;
  D1_CAPACITY_LIMIT_BYTES?: string;
  KV_CAPACITY_LIMIT_BYTES?: string;
  SEARCH_REPOSITORY_CAPACITY_BYTES?: string;
  SEARCH_REPOSITORY_WARNING_THRESHOLD_PERCENT?: string;
  SEARCH_REPOSITORY_CLEANUP_TARGET_PERCENT?: string;
  SEARCH_REPOSITORY_CLEANUP_BATCH_SIZE?: string;
}

export interface RoomRow {
  id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
  is_active: number;
}

export interface QueueItemRow {
  id: string;
  room_id: string;
  video_id: string;
  title: string;
  channel_title: string | null;
  thumbnail_url: string | null;
  requested_by: string | null;
  status: string;
  sort_key: number;
  created_at: string;
  updated_at: string;
}

export interface PlaybackStateRow {
  room_id: string;
  current_queue_item_id: string | null;
  current_video_id: string | null;
  player_state: string;
  started_at: string | null;
  updated_at: string;
}
