CREATE TABLE IF NOT EXISTS search_repository_entries (
  id TEXT PRIMARY KEY,
  family_hash TEXT NOT NULL,
  original_query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  artist TEXT,
  normalized_artist TEXT NOT NULL DEFAULT '',
  search_type TEXT NOT NULL CHECK (search_type IN ('song', 'artist')),
  include_original_vocal INTEGER NOT NULL DEFAULT 0 CHECK (include_original_vocal IN (0, 1)),
  response_json TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  external_search_calls INTEGER NOT NULL DEFAULT 0,
  approx_bytes INTEGER NOT NULL DEFAULT 0,
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL,
  UNIQUE (normalized_query, normalized_artist, search_type, include_original_vocal)
);

CREATE INDEX IF NOT EXISTS idx_search_repository_recent
ON search_repository_entries(last_accessed_at DESC, id);

CREATE INDEX IF NOT EXISTS idx_search_repository_type_recent
ON search_repository_entries(search_type, last_accessed_at DESC, id);

CREATE TABLE IF NOT EXISTS search_events (
  id TEXT PRIMARY KEY,
  room_id TEXT,
  query_text TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  artist TEXT,
  song TEXT,
  search_type TEXT NOT NULL CHECK (search_type IN ('song', 'artist')),
  original_performer_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (original_performer_status IN ('true', 'false', 'unknown')),
  response_source TEXT NOT NULL
    CHECK (response_source IN ('repository', 'external', 'mock', 'error')),
  origin TEXT NOT NULL DEFAULT 'human'
    CHECK (origin IN ('human', 'admin', 'automation')),
  result_count INTEGER NOT NULL DEFAULT 0,
  success INTEGER NOT NULL DEFAULT 1 CHECK (success IN (0, 1)),
  error_code TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_events_created
ON search_events(created_at DESC, id);

CREATE INDEX IF NOT EXISTS idx_search_events_query_created
ON search_events(normalized_query, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_events_source_created
ON search_events(response_source, created_at DESC);

CREATE TABLE IF NOT EXISTS youtube_quota_daily (
  quota_date TEXT PRIMARY KEY,
  used_search_calls INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_events (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_ids_json TEXT NOT NULL,
  affected_count INTEGER NOT NULL DEFAULT 0,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  details_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_events_created
ON admin_audit_events(created_at DESC, id);
