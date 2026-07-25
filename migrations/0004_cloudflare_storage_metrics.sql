CREATE TABLE IF NOT EXISTS admin_storage_metric_state (
  resource TEXT PRIMARY KEY CHECK (resource IN ('d1', 'kv')),
  used_bytes INTEGER CHECK (used_bytes IS NULL OR used_bytes >= 0),
  key_count INTEGER CHECK (key_count IS NULL OR key_count >= 0),
  usage_source TEXT NOT NULL
    CHECK (usage_source IN ('cloudflare-d1-api', 'cloudflare-analytics', 'unavailable')),
  measured_at TEXT,
  last_success_at TEXT,
  last_attempt_at TEXT NOT NULL,
  last_error_code TEXT,
  last_error_message TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_storage_metric_refresh_locks (
  lock_name TEXT PRIMARY KEY,
  lease_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
