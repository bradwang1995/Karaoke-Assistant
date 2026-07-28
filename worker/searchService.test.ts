import { describe, expect, it } from "vitest";
import type { SearchResponse, VideoSearchResult } from "../src/types/youtube";
import { buildSearchQueryFamily } from "./searchFamily";
import { searchVideos } from "./searchService";
import { writeSearchCache } from "./kvCache";

class MemoryKv {
  values = new Map<string, string>();

  async get<T>(key: string, options: { type: "json" }): Promise<T | null>;
  async get(key: string): Promise<string | null>;
  async get<T>(key: string, options?: { type: "json" }) {
    const value = this.values.get(key);

    if (!value) {
      return null;
    }

    return options?.type === "json" ? (JSON.parse(value) as T) : value;
  }

  async put(key: string, value: string) {
    this.values.set(key, value);
  }

  async list(options: { prefix?: string } = {}) {
    return {
      keys: [...this.values.keys()]
        .filter((key) => !options.prefix || key.startsWith(options.prefix))
        .map((name) => ({ name })),
      list_complete: true,
    };
  }
}

describe("search service cache reuse", () => {
  it("keeps karaoke and original-vocal cache results strictly isolated", async () => {
    const kv = new MemoryKv();
    const karaokeFamily = buildSearchQueryFamily("年少有为");
    const originalFamily = buildSearchQueryFamily("年少有为", undefined, {
      includeOriginalVocal: true,
    });

    await writeSearchCache(
      kv,
      karaokeFamily,
      buildResponse("年少有为", karaokeFamily.normalizedQuery, [
        buildResult("karaoke", "年少有为 KTV 伴奏版"),
      ]),
    );
    await writeSearchCache(
      kv,
      originalFamily,
      buildResponse("年少有为", originalFamily.normalizedQuery, [
        buildResult("original", "年少有为 official MV 原唱 歌词"),
      ]),
    );

    const env = {
      SEARCH_CACHE: kv,
      YOUTUBE_SEARCH_DAILY_LIMIT: "100",
    };
    const karaoke = await searchVideos({
      query: "年少有为",
      searchType: "song",
      includeOriginalVocal: false,
      limit: 50,
      env,
    });
    const original = await searchVideos({
      query: "年少有为",
      searchType: "song",
      includeOriginalVocal: true,
      limit: 50,
      env,
    });

    expect(karaoke.cached).toBe(true);
    expect(original.cached).toBe(true);
    expect(karaoke.results.map((result) => result.videoId)).toEqual(["karaoke"]);
    expect(original.results.map((result) => result.videoId)).toEqual(["original"]);
    expect(karaoke.cacheMeta?.servedFromExpandedCache).toBe(false);
    expect(original.cacheMeta?.servedFromExpandedCache).toBe(false);
  });

  it("reuses only the same normalized text and creates a new entry for different text", async () => {
    const db = new MemorySearchRepositoryD1();
    const first = await searchVideos({
      query: "青花瓷",
      artist: "周杰伦",
      searchType: "song",
      limit: 8,
      env: { DB: db.database },
    });
    const second = await searchVideos({
      query: "  青花瓷  ",
      artist: "周杰伦",
      searchType: "song",
      limit: 3,
      env: { DB: db.database },
    });
    const differentText = await searchVideos({
      query: "青花瓷 KTV",
      artist: "周杰伦",
      searchType: "song",
      limit: 3,
      env: { DB: db.database },
    });

    expect(first.cached).toBe(false);
    expect(first.cacheMeta?.repositoryEntryId).toBeTruthy();
    expect(second.cached).toBe(true);
    expect(second.results).toHaveLength(3);
    expect(second.cacheMeta).toMatchObject({
      responseSource: "repository",
      repositoryEntryId: first.cacheMeta?.repositoryEntryId,
    });
    expect(differentText.cached).toBe(false);
    expect(differentText.cacheMeta?.responseSource).toBe("mock");
    expect(db.accessUpdates).toBe(1);
    expect(db.entryCount).toBe(2);
  });

  it("does not reuse a cache entry when the original-vocal flag differs", async () => {
    const kv = new MemoryKv();
    const karaokeFamily = buildSearchQueryFamily("后来");
    await writeSearchCache(
      kv,
      karaokeFamily,
      buildResponse("后来", karaokeFamily.normalizedQuery, [
        buildResult("karaoke", "后来 KTV 伴奏版"),
      ]),
    );
    const response = await searchVideos({
      query: "后来",
      searchType: "song",
      includeOriginalVocal: true,
      limit: 10,
      env: {
        SEARCH_CACHE: kv,
        YOUTUBE_SEARCH_DAILY_LIMIT: "100",
      },
    });

    expect(response.cached).toBe(false);
    expect(response.cacheMeta).toMatchObject({
      responseSource: "mock",
      catalogResultCount: 0,
      externalCallAvoided: false,
      sourceQueryCount: 0,
    });
    expect(response.results.map((result) => result.videoId)).not.toContain(
      "karaoke",
    );
  });

  it("rejects a legacy D1 row whose original query text differs", async () => {
    const db = new MemorySearchRepositoryD1();
    db.seedLegacyEntry({
      normalizedQuery: "后来",
      originalQuery: "后来 KTV",
      response: buildResponse("后来 KTV", "后来 ktv", [
        buildResult("legacy", "后来 KTV 旧结果"),
      ]),
    });

    const response = await searchVideos({
      query: "后来",
      searchType: "song",
      includeOriginalVocal: false,
      limit: 10,
      env: { DB: db.database },
    });

    expect(response.cached).toBe(false);
    expect(response.cacheMeta?.responseSource).toBe("mock");
    expect(response.results.map((result) => result.videoId)).not.toContain(
      "legacy",
    );
    expect(db.accessUpdates).toBe(0);
  });
});

class MemorySearchRepositoryD1 {
  private entries = new Map<
    string,
    { id: string; originalQuery: string; responseJson: string; accessCount: number }
  >();

  database = {
    prepare: (sql: string): D1PreparedStatement =>
      new MemorySearchRepositoryStatement(this, sql),
  } as Partial<D1Database> as D1Database;

  get entryCount() {
    return this.entries.size;
  }

  get accessUpdates() {
    return [...this.entries.values()].reduce((total, entry) => total + entry.accessCount, 0);
  }

  seedLegacyEntry({
    normalizedQuery,
    originalQuery,
    response,
  }: {
    normalizedQuery: string;
    originalQuery: string;
    response: SearchResponse;
  }) {
    this.entries.set(repositoryKey(normalizedQuery, "", "song", 0), {
      id: "legacy-entry",
      originalQuery,
      responseJson: JSON.stringify(response),
      accessCount: 0,
    });
  }

  find(bindings: unknown[]) {
    return this.entries.get(repositoryKey(bindings[0], bindings[1], bindings[2], bindings[3]));
  }

  insert(bindings: unknown[]) {
    const key = repositoryKey(bindings[3], bindings[5], bindings[6], bindings[7]);
    const current = this.entries.get(key);
    this.entries.set(key, {
      id: current?.id ?? String(bindings[0]),
      originalQuery: String(bindings[2]),
      responseJson: String(bindings[8]),
      accessCount: current?.accessCount ?? 0,
    });
  }

  touch(id: unknown) {
    for (const [key, entry] of this.entries) {
      if (entry.id === id) {
        this.entries.set(key, { ...entry, accessCount: entry.accessCount + 1 });
      }
    }
  }
}

class MemorySearchRepositoryStatement {
  private bindings: unknown[] = [];

  constructor(
    private db: MemorySearchRepositoryD1,
    private sql: string,
  ) {}

  bind(...bindings: unknown[]) {
    this.bindings = bindings;
    return this as Partial<D1PreparedStatement> as D1PreparedStatement;
  }

  async first<T = Record<string, unknown>>(_colName?: string): Promise<T | null> {
    const entry = this.db.find(this.bindings);
    if (!entry) return null;

    if (this.sql.includes("response_json")) {
      return {
        id: entry.id,
        original_query: entry.originalQuery,
        response_json: entry.responseJson,
      } as T;
    }

    return { id: entry.id } as T;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    if (this.sql.includes("INSERT INTO search_repository_entries")) {
      this.db.insert(this.bindings);
    } else if (this.sql.includes("UPDATE search_repository_entries")) {
      this.db.touch(this.bindings[1]);
    }

    return d1Result<T>([], 1);
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return d1Result<T>([], 0);
  }

  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
  async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
    return options?.columnNames ? ([[]] as [string[], ...T[]]) : [];
  }
}

function repositoryKey(query: unknown, artist: unknown, type: unknown, vocal: unknown) {
  return [query, artist, type, vocal].map(String).join("|");
}

function d1Result<T>(results: T[], changes: number): D1Result<T> {
  return {
    success: true,
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: changes,
      last_row_id: 0,
      changed_db: changes > 0,
      changes,
    },
    results,
  };
}

function buildResponse(
  query: string,
  normalizedQuery: string,
  results: VideoSearchResult[],
): SearchResponse {
  return {
    query,
    normalizedQuery,
    cached: false,
    results,
    cacheMeta: {
      sourceQueryCount: 1,
      cachedResultCount: results.length,
      servedFromExpandedCache: false,
      videosListCalls: 1,
      sourceQueries: [query],
    },
  };
}

function buildResult(videoId: string, title: string): VideoSearchResult {
  return {
    videoId,
    title,
    channelTitle: "Test Channel",
    durationSeconds: 280,
    score: 0,
    reasons: [],
  };
}
