import { lookupYouTubeVideosByIds } from "./youtubeSearch";
/// <reference types="node" />
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiStamp, METADATA_TTL_MS } from "../src/lib/metadataLifecycle";
import { checkPlayback, readVideoMetadata, reserveDetails, saveVideoMetadata } from "./videoMetadata";
import { maintainMetadata } from "./metadataMaintenance";
import { readSearchRepositories, writeSearchRepository } from "./searchRepository";
import { buildSearchQueryFamily } from "./searchFamily";
import { upsertVideoCatalog } from "./videoCatalog";
import { createRoomInD1, getRoomSnapshotFromD1, saveRoomSnapshotToD1 } from "./d1Repository";
import { createInitialSnapshot, addQueueItem } from "../src/lib/roomReducer";

const databases: DatabaseSync[] = [];
function database() {
  const sqlite = new DatabaseSync(":memory:"); databases.push(sqlite);
  sqlite.exec("PRAGMA foreign_keys=ON");
  const folder = new URL("../migrations/", import.meta.url);
  for (const file of readdirSync(folder).filter((n) => n.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file, folder), "utf8"));
  function prepare(sql: string, args: (string | number | null)[] = []) {
    const numbered = /\?\d+/.test(sql);
    const values = numbered ? [...sql.matchAll(/\?(\d+)/g)].map((m) => args[Number(m[1]) - 1]) : args;
    const query = sql.replace(/\?\d+/g, "?");
    const statement = {
      bind: (...values: (string | number | null)[]) => prepare(sql, values),
      first: async () => sqlite.prepare(query).get(...values) ?? null,
      all: async () => ({ success: true, results: sqlite.prepare(query).all(...values), meta: { changes: 0 } }),
      run: async () => ({ success: true, results: [], meta: { changes: Number(sqlite.prepare(query).run(...values).changes) } }),
    };
    return statement;
  }
  const db = { prepare, batch: async (statements: ReturnType<typeof prepare>[]) => {
    sqlite.exec("BEGIN");
    try { const results = []; for (const stmt of statements) results.push(await stmt.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } } as unknown as D1Database;
  return { db, sqlite };
}
const id = "dQw4w9WgXcQ";
function video(now = Date.now()) {
  return { videoId: id, title: "A song", channelTitle: "Singer", score: 1, reasons: [], durationSeconds: 123,
    madeForKids: false as boolean | "unknown", embeddable: true,
    provenance: { snippet: apiStamp(now), details: apiStamp(now), status: apiStamp(now) } };
}
afterEach(() => { databases.splice(0).forEach((db) => db.close()); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("metadata integration against actual migrations", () => {
  it("drains a thousand expired catalog records per bounded batch and preserves fresh records", async () => {
    const { db, sqlite } = database();
    const insert = sqlite.prepare(`INSERT INTO search_video_catalog (video_id,title,normalized_title,first_seen_query,last_seen_query,first_seen_at,last_seen_at)
      VALUES (?,'Old title','old title','query','query','2020','2020')`);
    for (let i = 0; i < 1001; i++) insert.run(String(i));
    await upsertVideoCatalog(db, [video()], "song");
    await maintainMetadata({ DB: db });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM search_video_catalog WHERE metadata_expires_at IS NULL").get()?.n).toBe(1);
    expect(sqlite.prepare("SELECT title FROM search_video_catalog WHERE video_id=?").get(id)?.title).toBe("A song");
    await maintainMetadata({ DB: db });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM search_video_catalog").get()?.n).toBe(1);
  });
  it("uses the Pacific quota day across midnight and DST without using the host timezone", async () => {
    const { db, sqlite } = database();
    await reserveDetails(db, false, Date.parse("2026-10-29T06:59:59Z"));
    await reserveDetails(db, false, Date.parse("2026-10-29T07:00:00Z"));
    await reserveDetails(db, false, Date.parse("2026-11-01T08:59:59Z"));
    await reserveDetails(db, false, Date.parse("2026-11-01T09:00:00Z"));
    expect(sqlite.prepare("SELECT quota_date, attempts FROM youtube_details_daily ORDER BY quota_date").all()).toEqual([
      { quota_date: "2026-10-28", attempts: 1 }, { quota_date: "2026-10-29", attempts: 1 }, { quota_date: "2026-11-01", attempts: 2 },
    ]);
    expect(await reserveDetails(db, false, NaN)).toBe(false);
  });
  it("uses a single batch of 50 IDs and rejects an oversized batch before fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ items: [] })); vi.stubGlobal("fetch", fetchMock);
    await lookupYouTubeVideosByIds(Array.from({ length: 50 }, (_, i) => String(i)), "test-only");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("id")?.split(",")).toHaveLength(50);
    await expect(lookupYouTubeVideosByIds(Array.from({ length: 51 }, (_, i) => String(i)), "test-only")).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("atomically caps details attempts and preserves the foreground reserve", async () => {
    const { db, sqlite } = database();
    const now = Date.now();
    for (let n = 0; n < 500; n++) expect(await reserveDetails(db, true, now)).toBe(true);
    expect(await reserveDetails(db, true, now)).toBe(false);
    for (let n = 0; n < 500; n++) expect(await reserveDetails(db, false, now)).toBe(true);
    expect(await reserveDetails(db, false, now)).toBe(false);
    expect(sqlite.prepare("SELECT attempts, background_attempts FROM youtube_details_daily").get()).toMatchObject({ attempts: 1000, background_attempts: 500 });
    expect(await reserveDetails(undefined)).toBe(false);
  });
  it("round trips provider metadata, rejects older overwrites and refuses expired data", async () => {
    const { db } = database(), now = Date.now();
    await saveVideoMetadata(db, [video(now)]);
    await saveVideoMetadata(db, [{ ...video(now - 1000), title: "Old copy" }]);
    expect((await readVideoMetadata(db, [id])).get(id)?.title).toBe("A song");
    vi.useFakeTimers(); vi.setSystemTime(now + METADATA_TTL_MS);
    expect((await readVideoMetadata(db, [id])).size).toBe(0);
  });
  it.each([true, false, "unknown"] as const)("gates explicit MFK %s, retrying unknown status without treating it as false", async (madeForKids) => {
    const { db } = database(); await saveVideoMetadata(db, [{ ...video(), madeForKids }]);
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const decision = await checkPlayback({ DB: db, YOUTUBE_API_KEY: "test-only" }, id);
    expect(decision.allowed).toBe(madeForKids === false); expect(fetchMock).toHaveBeenCalledTimes(madeForKids === "unknown" ? 1 : 0);
  });
  it.each([403, 404, 429])("fails closed on status request error %s and meters the attempt", async (status) => {
    const { db, sqlite } = database(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));
    expect((await checkPlayback({ DB: db, YOUTUBE_API_KEY: "test-only" }, id)).allowed).toBe(false);
    expect(sqlite.prepare("SELECT attempts FROM youtube_details_daily").get()).toMatchObject({ attempts: 1 });
    expect(sqlite.prepare("SELECT * FROM youtube_refresh_leases").all()).toHaveLength(0);
  });
  it("deduplicates in-flight status checks across requests via a D1 lease", async () => {
    const { db } = database();
    let resolve!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((done) => { resolve = done; })); vi.stubGlobal("fetch", fetchMock);
    const first = checkPlayback({ DB: db, YOUTUBE_API_KEY: "test-only" }, id);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect((await checkPlayback({ DB: db, YOUTUBE_API_KEY: "test-only" }, id)).allowed).toBe(false);
    resolve(Response.json({ items: [{ id, snippet: { title: "Song" }, status: { madeForKids: false, embeddable: true } }] }));
    expect((await first).allowed).toBe(true); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects missing MFK and unavailable videos instead of treating them as false", async () => {
    const { db } = database();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ items: [{ id, snippet: { title: "Song" }, status: { embeddable: true } }] })).mockResolvedValueOnce(Response.json({ items: [] })));
    expect((await checkPlayback({ DB: db, YOUTUBE_API_KEY: "test-only" }, id)).allowed).toBe(false);
    // A different ID has no status; the existing unknown status is not converted into false.
    expect((await checkPlayback({ DB: db, YOUTUBE_API_KEY: "test-only" }, "kJQP7kiw5Fk")).reason).toBe("unavailable");
  });
  it("keeps true acquisition time through repository copies and replaces missing catalog fields", async () => {
    const { db, sqlite } = database(), now = Date.now() - 10000;
    const family = buildSearchQueryFamily("song");
    const response = { query: "song", normalizedQuery: "song", cached: false, results: [video(now)] };
    await writeSearchRepository(db, family, response);
    const hit = (await readSearchRepositories(db, [family]))[0];
    expect(hit.response.results[0].provenance?.snippet?.fetchedAt).toBe(new Date(now).toISOString());
    await upsertVideoCatalog(db, response.results, "song");
    await upsertVideoCatalog(db, [{ ...video(), durationSeconds: undefined }], "song");
    expect(sqlite.prepare("SELECT duration_seconds FROM search_video_catalog").get()).toMatchObject({ duration_seconds: null });
  });
  it("never persists a client supplied queue title and hydrates only trusted metadata", async () => {
    const { db, sqlite } = database();
    await createRoomInD1(db, "room1234");
    let snapshot = addQueueItem(createInitialSnapshot("room1234"), { videoId: id, title: "Forged title" });
    await saveRoomSnapshotToD1(db, snapshot);
    expect(sqlite.prepare("SELECT title FROM queue_items").get()).toMatchObject({ title: "YouTube 视频" });
    expect((await getRoomSnapshotFromD1(db, "room1234"))?.queue[0].title).toBe("YouTube 视频");
    await saveVideoMetadata(db, [video()]);
    snapshot = (await getRoomSnapshotFromD1(db, "room1234"))!;
    expect(snapshot.queue[0].title).toBe("A song");
  });
  it("dry-runs and then scrubs unknown API payloads without deleting room business state", async () => {
    const { db, sqlite } = database();
    await createRoomInD1(db, "room1234");
    await saveRoomSnapshotToD1(db, addQueueItem(createInitialSnapshot("room1234"), { videoId: id, title: "song", requestedBy: "friend" }));
    sqlite.exec(`INSERT INTO search_repository_entries (id,family_hash,original_query,normalized_query,search_type,response_json,created_at,updated_at,last_accessed_at)
      VALUES ('old','hash','song','song','song','{"results":[]}','2020','2020','2020')`);
    await maintainMetadata({ DB: db }, Date.now(), true);
    expect(sqlite.prepare("SELECT response_json FROM search_repository_entries").get()?.response_json).not.toBe("{}");
    await maintainMetadata({ DB: db }); await maintainMetadata({ DB: db });
    expect(sqlite.prepare("SELECT response_json FROM search_repository_entries").get()?.response_json).toBe("{}");
    expect(sqlite.prepare("SELECT requested_by FROM queue_items").get()?.requested_by).toBe("friend");
    expect(sqlite.prepare("SELECT id FROM rooms").all()).toHaveLength(1);
  });
  it("bounds unknown-age cleanup and resumes without assigning migration time to old metadata", async () => {
    const { db, sqlite } = database();
    const insert = sqlite.prepare(`INSERT INTO search_repository_entries (id,family_hash,original_query,normalized_query,search_type,response_json,created_at,updated_at,last_accessed_at)
      VALUES (?,'hash',?,?,'song',?,'2020','2020','2020')`);
    for (let i = 0; i < 101; i++) insert.run(String(i), String(i), String(i), JSON.stringify({ results: [{ videoId: id, title: "Old title" }] }));
    await maintainMetadata({ DB: db });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM search_repository_entries WHERE response_json != '{}'").get()?.n).toBe(1);
    await maintainMetadata({ DB: db });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM search_repository_entries WHERE response_json != '{}'").get()?.n).toBe(0);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM search_repository_entries").get()?.n).toBe(101);
  });
  it("resumes legacy KV cleanup after an empty incomplete page and preserves fresh current keys", async () => {
    const { db, sqlite } = database();
    const legacy = "yt-search:v4:old:CA:zh-Hans", current = "yt-search:v5:fresh:CA:zh-Hans";
    const values = new Map([[legacy, { results: [video()] }], [current, { results: [video()] }]]);
    const cache = {
      list: vi.fn(async (options: { cursor?: string }) => options.cursor === "next" ?
        { keys: [...values.keys()].map((name) => ({ name })), list_complete: true } : { keys: [], list_complete: false, cursor: "next" }),
      get: async (key: string) => values.get(key) ?? null,
      delete: async (key: string) => { values.delete(key); },
    } as unknown as KVNamespace;
    await maintainMetadata({ DB: db, SEARCH_CACHE: cache }, Date.now(), true);
    expect(sqlite.prepare("SELECT * FROM youtube_maintenance_state").all()).toHaveLength(0);
    await maintainMetadata({ DB: db, SEARCH_CACHE: cache });
    expect(sqlite.prepare("SELECT cursor FROM youtube_maintenance_state").get()?.cursor).toBe("next");
    await maintainMetadata({ DB: db, SEARCH_CACHE: cache });
    expect(values.has(legacy)).toBe(false); expect(values.has(current)).toBe(true);
    expect(sqlite.prepare("SELECT cursor FROM youtube_maintenance_state").get()?.cursor).toBeNull();
  });
  it("refreshes a bounded known-ID batch through the API instead of copying the old payload", async () => {
    const { db, sqlite } = database();
    const family = buildSearchQueryFamily("song");
    await writeSearchRepository(db, family, { query: "song", normalizedQuery: "song", cached: false, results: [video()] });
    sqlite.exec("UPDATE search_repository_entries SET metadata_expires_at=NULL");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ items: [{ id, snippet: { title: "Refreshed title" }, status: { madeForKids: false, embeddable: true } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await maintainMetadata({ DB: db, YOUTUBE_API_KEY: "test-only" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const hit = (await readSearchRepositories(db, [family]))[0];
    expect(hit.response.results[0].title).toBe("Refreshed title");
    expect(hit.response.results[0].durationSeconds).toBeUndefined();
    expect(sqlite.prepare("SELECT attempts, background_attempts FROM youtube_details_daily").get()).toMatchObject({ attempts: 1, background_attempts: 1 });
  });
});
