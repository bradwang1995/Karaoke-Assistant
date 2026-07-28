CREATE TABLE IF NOT EXISTS search_video_catalog (
  video_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  channel_title TEXT,
  normalized_channel_title TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  published_at TEXT,
  first_seen_query TEXT NOT NULL,
  last_seen_query TEXT NOT NULL,
  appearance_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_video_catalog_recent
ON search_video_catalog(last_seen_at DESC, video_id);

CREATE INDEX IF NOT EXISTS idx_search_video_catalog_popular
ON search_video_catalog(appearance_count DESC, last_seen_at DESC, video_id);

CREATE VIRTUAL TABLE IF NOT EXISTS search_video_catalog_fts USING fts5(
  normalized_title,
  normalized_channel_title,
  content = 'search_video_catalog',
  content_rowid = 'rowid',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS search_video_catalog_ai
AFTER INSERT ON search_video_catalog BEGIN
  INSERT INTO search_video_catalog_fts(rowid, normalized_title, normalized_channel_title)
  VALUES (new.rowid, new.normalized_title, new.normalized_channel_title);
END;

CREATE TRIGGER IF NOT EXISTS search_video_catalog_ad
AFTER DELETE ON search_video_catalog BEGIN
  INSERT INTO search_video_catalog_fts(
    search_video_catalog_fts,
    rowid,
    normalized_title,
    normalized_channel_title
  ) VALUES (
    'delete',
    old.rowid,
    old.normalized_title,
    old.normalized_channel_title
  );
END;

CREATE TRIGGER IF NOT EXISTS search_video_catalog_au
AFTER UPDATE OF normalized_title, normalized_channel_title ON search_video_catalog BEGIN
  INSERT INTO search_video_catalog_fts(
    search_video_catalog_fts,
    rowid,
    normalized_title,
    normalized_channel_title
  ) VALUES (
    'delete',
    old.rowid,
    old.normalized_title,
    old.normalized_channel_title
  );
  INSERT INTO search_video_catalog_fts(rowid, normalized_title, normalized_channel_title)
  VALUES (new.rowid, new.normalized_title, new.normalized_channel_title);
END;

ALTER TABLE search_events
ADD COLUMN candidate_result_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE search_events
ADD COLUMN filtered_result_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE search_events
ADD COLUMN catalog_result_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE search_events
ADD COLUMN unique_catalog_videos_added INTEGER NOT NULL DEFAULT 0;

ALTER TABLE search_events
ADD COLUMN external_search_calls INTEGER NOT NULL DEFAULT 0;

ALTER TABLE search_events
ADD COLUMN external_call_avoided INTEGER NOT NULL DEFAULT 0
CHECK (external_call_avoided IN (0, 1));
