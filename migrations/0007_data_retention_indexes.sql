CREATE INDEX IF NOT EXISTS idx_rooms_retention
ON rooms(is_active, updated_at, id);

CREATE INDEX IF NOT EXISTS idx_playback_events_retention
ON playback_events(created_at, id);
