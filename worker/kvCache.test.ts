import { describe, expect, it } from "vitest";
import type { SearchResponse, VideoSearchResult } from "../src/types/youtube";
import {
  readSearchCache,
  readSearchRecommendations,
  recordQueuedSearchRecommendation,
  searchCacheFamilyKey,
  searchCacheIndexKey,
  searchRecommendationsKey,
  touchSearchCache,
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

  async list(options: { prefix?: string } = {}) {
    const keys = [...this.values.keys()]
      .filter((key) => !options.prefix || key.startsWith(options.prefix))
      .map((name) => ({ name }));

    return { keys, list_complete: true };
  }
}

describe("KV search cache", () => {
  it("builds stable v4 cache keys", () => {
    expect(searchCacheFamilyKey("abc123")).toBe("yt-search:v4:abc123:CA:zh-Hans");
    expect(searchCacheIndexKey("later ktv")).toBe(
      "yt-search-index:v2:song:karaoke:-:later ktv:CA:zh-Hans",
    );
  });

  it("does not cache non-music or seven-minute videos", async () => {
    const kv = new MemoryKv();
    const family = buildSearchQueryFamily("Later");
    const candidates = buildResults(3);
    const valid = candidates[0]!;
    const nonMusic = candidates[1]!;
    const tooLong = candidates[2]!;
    nonMusic.categoryId = "19";
    tooLong.durationSeconds = 420;

    const written = await writeSearchCache(
      kv,
      family,
      buildResponse("Later", family.normalizedQuery, [valid, nonMusic, tooLong]),
    );

    expect(written?.results.map((result) => result.videoId)).toEqual([valid.videoId]);
    await expect(readSearchCache(kv, family)).resolves.toMatchObject({
      entry: {
        results: [{ videoId: valid.videoId }],
      },
    });
  });

  it("reads only the exact normalized query family", async () => {
    const kv = new MemoryKv();
    const family = buildSearchQueryFamily("Later");
    const response = buildResponse("Later", family.normalizedQuery, buildResults(6));

    const written = await writeSearchCache(kv, family, response, {
      ttlSeconds: 60 * 60 * 24 * 365,
      maxEntryBytes: 100_000,
    });
    const cached = await readSearchCache(kv, buildSearchQueryFamily("  LATER  "));
    const differentText = await readSearchCache(
      kv,
      buildSearchQueryFamily("Later karaoke"),
    );

    expect(written?.stats.youtubeSearchCalls).toBe(1);
    expect(written?.results).toHaveLength(6);
    expect(cached?.entry.queryFamily.hash).toBe(family.hash);
    expect(cached?.entry.queryFamily.searchType).toBe("song");
    expect(cached?.entry.queryFamily.includeOriginalVocal).toBe(false);
    expect(cached?.entry.results).toHaveLength(6);
    expect(differentText).toBeNull();
    expect(kv.values.has(searchCacheFamilyKey(family.hash))).toBe(true);
    expect(
      [...kv.values.keys()].some((key) => key.startsWith("yt-search-index:")),
    ).toBe(false);
  });

  it("keeps song, artist, karaoke, and original-vocal indexes isolated", async () => {
    const kv = new MemoryKv();
    const karaoke = buildSearchQueryFamily("Later");
    const original = buildSearchQueryFamily("Later", undefined, {
      includeOriginalVocal: true,
    });
    const artist = buildSearchQueryFamily("Later", undefined, {
      searchType: "artist",
    });

    await writeSearchCache(kv, karaoke, buildResponse("Later", karaoke.normalizedQuery, buildResults(2)));
    await writeSearchCache(kv, original, buildResponse("Later", original.normalizedQuery, buildResults(2, 10)));
    await writeSearchCache(kv, artist, buildResponse("Later", artist.normalizedQuery, buildResults(2, 20)));

    await expect(readSearchCache(kv, karaoke)).resolves.toMatchObject({
      familyHash: karaoke.hash,
    });
    await expect(readSearchCache(kv, original)).resolves.toMatchObject({
      familyHash: original.hash,
    });
    await expect(readSearchCache(kv, artist)).resolves.toMatchObject({
      familyHash: artist.hash,
    });
  });

  it("rejects a legacy cache entry whose original query text differs", async () => {
    const kv = new MemoryKv();
    const family = buildSearchQueryFamily("Later");
    await writeSearchCache(
      kv,
      family,
      buildResponse("Later KTV", family.normalizedQuery, buildResults(2)),
    );

    await expect(readSearchCache(kv, family)).resolves.toBeNull();
  });

  it("updates the default recommendation pool from written cache entries", async () => {
    const kv = new MemoryKv();
    const family = buildSearchQueryFamily("Later");
    const response = buildResponse("Later", family.normalizedQuery, buildResults(10));

    await writeSearchCache(kv, family, response, {
      ttlSeconds: 60 * 60 * 24 * 365,
      maxEntryBytes: 100_000,
    });
    const recommendations = await readSearchRecommendations(kv, 8);

    expect(kv.values.has(searchRecommendationsKey())).toBe(true);
    expect(recommendations).toHaveLength(8);
    expect(recommendations[0].videoId).toBe("video-0");
  });

  it("keeps at least 100 unique cached recommendations for infinite expansion", async () => {
    const kv = new MemoryKv();

    for (let familyIndex = 0; familyIndex < 2; familyIndex += 1) {
      const family = buildSearchQueryFamily(`Singer ${familyIndex}`);
      const response = buildResponse(
        `Singer ${familyIndex}`,
        family.normalizedQuery,
        buildResults(50, familyIndex * 50),
      );

      await writeSearchCache(kv, family, response, {
        ttlSeconds: 60 * 60 * 24 * 365,
        maxEntryBytes: 100_000,
      });
    }

    const recommendations = await readSearchRecommendations(kv, 100);

    expect(recommendations).toHaveLength(100);
    expect(new Set(recommendations.map((result) => result.videoId)).size).toBe(100);
  });

  it("promotes only the strongest results from the latest search ahead of prior hits", async () => {
    const kv = new MemoryKv();
    const earlierFamily = buildSearchQueryFamily("Earlier Singer");
    const latestFamily = buildSearchQueryFamily("Latest Singer");

    await writeSearchCache(
      kv,
      earlierFamily,
      buildResponse("Earlier Singer", earlierFamily.normalizedQuery, buildResults(12)),
    );
    await writeSearchCache(
      kv,
      latestFamily,
      buildResponse("Latest Singer", latestFamily.normalizedQuery, buildResults(12, 100)),
    );

    const recommendations = await readSearchRecommendations(kv, 24);

    expect(recommendations.slice(0, 8).map((result) => result.videoId)).toEqual(
      buildResults(8, 100).map((result) => result.videoId),
    );
    expect(recommendations[8].videoId).toBe("video-0");
    expect(recommendations.findIndex((result) => result.videoId === "video-108")).toBeGreaterThan(
      recommendations.findIndex((result) => result.videoId === "video-0"),
    );
  });

  it("moves recently reused searches and actually queued songs to the front", async () => {
    const kv = new MemoryKv();
    const firstFamily = buildSearchQueryFamily("First Singer");
    const secondFamily = buildSearchQueryFamily("Second Singer");

    await writeSearchCache(
      kv,
      firstFamily,
      buildResponse("First Singer", firstFamily.normalizedQuery, buildResults(12)),
    );
    await writeSearchCache(
      kv,
      secondFamily,
      buildResponse("Second Singer", secondFamily.normalizedQuery, buildResults(12, 100)),
    );

    const cached = await readSearchCache(kv, firstFamily);
    expect(cached).not.toBeNull();
    await touchSearchCache(kv, cached!.familyHash, cached!.entry);
    expect((await readSearchRecommendations(kv, 1))[0].videoId).toBe("video-0");

    await recordQueuedSearchRecommendation(kv, {
      videoId: "video-11",
      title: "Actually queued song",
      channelTitle: "Chosen by a guest",
    });
    const queuedFirst = await readSearchRecommendations(kv, 1);

    expect(queuedFirst[0]).toMatchObject({
      videoId: "video-11",
      title: "Actually queued song",
      reasons: expect.arrayContaining(["recently queued"]),
    });
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
      sourceQueryCount: 1,
      cachedResultCount: results.length,
      servedFromExpandedCache: false,
      videosListCalls: 1,
      sourceQueries: ["later ktv|later karaoke"],
    },
  };
}

function buildResults(count: number, offset = 0): VideoSearchResult[] {
  return Array.from({ length: count }, (_, index) => ({
    videoId: `video-${index + offset}`,
    title: `Later KTV ${index + offset}`,
    channelTitle: "Karaoke Studio",
    thumbnailUrl: `https://img.youtube.com/vi/video-${index + offset}/hqdefault.jpg`,
    durationSeconds: 240,
    publishedAt: "2026-01-01T00:00:00Z",
    categoryId: "10",
    tags: ["music", "karaoke"],
    score: 100 - index,
    reasons: ["test"],
  }));
}
