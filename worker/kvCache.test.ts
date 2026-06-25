import { describe, expect, it } from "vitest";
import type { SearchResponse, VideoSearchResult } from "../src/types/youtube";
import {
  readSearchCache,
  searchCacheFamilyKey,
  searchCacheIndexKey,
  writeSearchCache,
} from "./kvCache";
import { buildSearchQueryFamily } from "./searchFamily";

class MemoryKv {
  values = new Map<string, string>();
  writes: Array<{ key: string; value: string; options?: KVNamespacePutOptions }> = [];

  async get<T>(key: string, options: { type: "json" }): Promise<T | null>;
  async get(key: string): Promise<string | null>;
  async get<T>(key: string, options?: { type: "json" }) {
    const value = this.values.get(key);

    if (!value) {
      return null;
    }

    return options?.type === "json" ? (JSON.parse(value) as T) : value;
  }

  async put(key: string, value: string, options?: KVNamespacePutOptions) {
    this.values.set(key, value);
    this.writes.push({ key, value, options });
  }
}

describe("KV search cache", () => {
  it("builds stable v2 cache keys", () => {
    expect(searchCacheFamilyKey("abc123")).toBe("yt-search:v2:abc123:CA:zh-Hans");
    expect(searchCacheIndexKey("later ktv")).toBe("yt-search-index:v1:later ktv:CA:zh-Hans");
  });

  it("writes a family cache entry and reads it through an equivalent query", async () => {
    const kv = new MemoryKv();
    const family = buildSearchQueryFamily("Later");
    const response = buildResponse("Later", family.normalizedQuery, buildResults(6));

    const written = await writeSearchCache(kv, family, response, {
      ttlSeconds: 60 * 60 * 24 * 365,
      maxEntryBytes: 100_000,
    });
    const cached = await readSearchCache(kv, buildSearchQueryFamily("Later karaoke"));

    expect(written?.stats.youtubeSearchCalls).toBe(2);
    expect(written?.results).toHaveLength(6);
    expect(cached?.entry.queryFamily.hash).toBe(family.hash);
    expect(cached?.entry.results).toHaveLength(6);
    expect(kv.values.has(searchCacheFamilyKey(family.hash))).toBe(true);
  });

  it("prunes low-ranked hits when a cache entry would be too large", async () => {
    const kv = new MemoryKv();
    const family = buildSearchQueryFamily("Later");
    const oversizedResults = buildResults(8).map((result) => ({
      ...result,
      title: `${result.title} ${"x".repeat(500)}`,
    }));
    const response = buildResponse("Later", family.normalizedQuery, oversizedResults);

    const written = await writeSearchCache(kv, family, response, {
      ttlSeconds: 60 * 60 * 24 * 365,
      maxEntryBytes: 1,
    });

    expect(written?.results).toHaveLength(0);
    expect(written?.stats.prunedResultCount).toBe(8);
  });
});

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
      sourceQueryCount: 2,
      cachedResultCount: results.length,
      servedFromExpandedCache: false,
      videosListCalls: 1,
      sourceQueries: ["later ktv|later karaoke"],
    },
  };
}

function buildResults(count: number): VideoSearchResult[] {
  return Array.from({ length: count }, (_, index) => ({
    videoId: `video-${index}`,
    title: `Later KTV ${index}`,
    channelTitle: "Karaoke Studio",
    thumbnailUrl: `https://img.youtube.com/vi/video-${index}/hqdefault.jpg`,
    durationSeconds: 240,
    publishedAt: "2026-01-01T00:00:00Z",
    score: 100 - index,
    reasons: ["test"],
  }));
}
