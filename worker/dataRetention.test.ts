/// <reference types="node" />
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { retentionPlan } from "./dataRetention";

const databases: DatabaseSync[] = [];
const now = Date.parse("2026-10-28T12:00:00Z");
function database() {
  const db = new DatabaseSync(":memory:");
  databases.push(db);
  db.exec("PRAGMA foreign_keys = ON");
  const folder = new URL("../migrations/", import.meta.url);
  for (const file of readdirSync(folder).filter((name) => name.endsWith(".sql")).sort()) {
    db.exec(readFileSync(new URL(file, folder), "utf8"));
  }
  return db;
}
function clean(db: DatabaseSync) {
  db.exec("BEGIN");
  try {
    for (const { sql, cutoff } of retentionPlan(now)) db.prepare(sql).run(cutoff);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
afterEach(() => databases.splice(0).forEach((db) => db.close()));

describe("data retention against migrated SQLite", () => {
  it("deletes only expired inactive rooms, including FK children, and is idempotent", () => {
    const db = database();
    for (const [id, active, updated] of [
      ["old", 0, "2026-09-01T00:00:00.000Z"],
      ["active", 1, "2026-09-01T00:00:00.000Z"],
      ["boundary", 0, "2026-09-28T12:00:00.000Z"],
      ["recent", 0, "2026-10-28T00:00:00.000Z"],
    ] as const) {
      db.prepare("INSERT INTO rooms VALUES (?, ?, ?, ?, ?)").run(id, id, updated, updated, active);
      db.prepare("INSERT INTO playback_states (room_id, player_state, updated_at) VALUES (?, 'idle', ?)").run(id, updated);
      db.prepare("INSERT INTO queue_items (id, room_id, video_id, title, status, sort_key, created_at, updated_at) VALUES (?, ?, 'v', 'song', 'queued', 1, ?, ?)").run(id, id, updated, updated);
      db.prepare("INSERT INTO playback_events (id, room_id, event_type, created_at) VALUES (?, ?, 'fixture', '2099-01-01T00:00:00.000Z')").run(id, id);
    }
    clean(db);
    expect(db.prepare("SELECT id FROM rooms ORDER BY id").all().map((row) => row.id)).toEqual(["active", "boundary", "recent"]);
    expect(db.prepare("SELECT room_id FROM queue_items ORDER BY room_id").all().map((row) => row.room_id)).toEqual(["active", "boundary", "recent"]);
    expect(db.prepare("SELECT room_id FROM playback_states WHERE room_id = 'old'").get()).toBeUndefined();
    expect(db.prepare("SELECT room_id FROM playback_events WHERE room_id = 'old'").get()).toBeUndefined();
    clean(db);
    expect(db.prepare("SELECT COUNT(*) AS n FROM rooms").get()?.n).toBe(3);
  });

  it("bounds event cleanup, preserves the exact cutoff and never deletes the shared repository", () => {
    const db = database();
    const insert = db.prepare("INSERT INTO search_events (id, query_text, normalized_query, search_type, response_source, created_at) VALUES (?, 'song', 'song', 'song', 'repository', ?)");
    for (let i = 0; i < 1001; i++) insert.run(`old-${i}`, "2026-09-01T00:00:00.000Z");
    insert.run("boundary", "2026-09-28T12:00:00.000Z");
    db.exec(`INSERT INTO search_repository_entries (id, family_hash, original_query, normalized_query, search_type, response_json, created_at, updated_at, last_accessed_at)
      VALUES ('keep', 'hash', 'song', 'song', 'song', '{}', '2020', '2020', '2020')`);
    clean(db);
    expect(db.prepare("SELECT COUNT(*) AS n FROM search_events").get()?.n).toBe(2);
    clean(db);
    expect(db.prepare("SELECT id FROM search_events").all().map((row) => row.id)).toEqual(["boundary"]);
    expect(db.prepare("SELECT id FROM search_repository_entries").get()?.id).toBe("keep");
  });

  it("uses a separate 90-day boundary for operations records", () => {
    const db = database();
    for (const [id, timestamp] of [["old", "2026-07-01T00:00:00.000Z"], ["boundary", "2026-07-30T12:00:00.000Z"], ["recent", "2026-10-01T00:00:00.000Z"]]) {
      db.prepare("INSERT INTO admin_audit_events VALUES (?, 'test', 'test', '[]', 0, 'success', NULL, ?)").run(id, timestamp);
      db.prepare("INSERT INTO youtube_quota_daily VALUES (?, 1, 100, ?)").run(timestamp.slice(0, 10), timestamp);
    }
    clean(db);
    expect(db.prepare("SELECT id FROM admin_audit_events ORDER BY id").all().map((row) => row.id)).toEqual(["boundary", "recent"]);
    expect(db.prepare("SELECT quota_date FROM youtube_quota_daily ORDER BY quota_date").all().map((row) => row.quota_date)).toEqual(["2026-07-30", "2026-10-01"]);
  });

  it("rejects invalid clocks before generating deletions", () => {
    expect(() => retentionPlan(Number.NaN)).toThrow("Invalid retention clock");
  });
});
