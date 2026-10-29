const DAY_MS = 24 * 60 * 60 * 1000;

export const USAGE_RETENTION_DAYS = 30;
export const OPERATIONS_RETENTION_DAYS = 90;

// Bounded, independent maintenance. Public song repositories and KV caches are excluded.
export function retentionPlan(now: number) {
  if (!Number.isFinite(now)) throw new Error("Invalid retention clock");
  const usageCutoff = new Date(now - USAGE_RETENTION_DAYS * DAY_MS).toISOString();
  const operationsCutoff = new Date(now - OPERATIONS_RETENTION_DAYS * DAY_MS).toISOString();
  const expiredRooms = `SELECT id FROM rooms
    WHERE is_active = 0 AND updated_at < ?
    ORDER BY updated_at, id LIMIT 100`;
  return [
    { sql: `DELETE FROM search_events WHERE id IN (
        SELECT id FROM search_events WHERE created_at < ? ORDER BY created_at, id LIMIT 1000
      )`, cutoff: usageCutoff },
    { sql: `DELETE FROM playback_events WHERE id IN (
        SELECT id FROM playback_events WHERE created_at < ? ORDER BY created_at, id LIMIT 1000
      )`, cutoff: usageCutoff },
    ...["queue_items", "playback_events", "playback_states"].map((table) => ({
      sql: `DELETE FROM ${table} WHERE room_id IN (${expiredRooms})`,
      cutoff: usageCutoff,
    })),
    { sql: `DELETE FROM rooms WHERE id IN (${expiredRooms})`, cutoff: usageCutoff },
    { sql: `DELETE FROM admin_audit_events WHERE id IN (
        SELECT id FROM admin_audit_events WHERE created_at < ? ORDER BY created_at, id LIMIT 1000
      )`, cutoff: operationsCutoff },
    { sql: `DELETE FROM youtube_quota_daily WHERE quota_date IN (
        SELECT quota_date FROM youtube_quota_daily WHERE quota_date < ? ORDER BY quota_date LIMIT 1000
      )`, cutoff: operationsCutoff.slice(0, 10) },
  ];
}

export async function runDataRetention(db: D1Database | undefined, now: number) {
  if (!db) return;
  // D1 batches are transactional: child rows and inactive rooms are removed together.
  const results = await db.batch(retentionPlan(now).map(({ sql, cutoff }) => db.prepare(sql).bind(cutoff)));
  console.log(JSON.stringify({
    event: "data-retention-completed",
    deletedRows: results.map((result) => result.meta.changes),
  }));
}
