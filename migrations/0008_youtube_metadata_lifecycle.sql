-- Unknown historical timestamps stay NULL. No production data is touched by adding columns.
ALTER TABLE search_repository_entries ADD COLUMN metadata_expires_at TEXT;
ALTER TABLE search_video_catalog ADD COLUMN metadata_expires_at TEXT;
CREATE INDEX IF NOT EXISTS idx_repository_metadata_expiry ON search_repository_entries(metadata_expires_at);
CREATE INDEX IF NOT EXISTS idx_catalog_metadata_expiry ON search_video_catalog(metadata_expires_at);
CREATE TABLE IF NOT EXISTS youtube_video_metadata (
  video_id TEXT PRIMARY KEY,
  response_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_video_metadata_expiry ON youtube_video_metadata(expires_at);
CREATE TABLE IF NOT EXISTS youtube_details_daily (
  quota_date TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  background_attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS youtube_refresh_leases (
  video_id TEXT PRIMARY KEY,
  lease_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS youtube_maintenance_state (
  name TEXT PRIMARY KEY,
  cursor TEXT
);
