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
import { ambiguousSongCandidates } from "./fixtures/ambiguousSong";
import { cachedAmbiguousSongCandidates } from "./fixtures/cachedAmbiguousSong";

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
  it("promotes only four actual matching songs on writes, touch and legacy rebuild, leaving v6 and fifty raw hits intact", async () => {
    const kv = new MemoryKv();
    const family = buildSearchQueryFamily("耍赖");
    const legacyKey = "yt-search-recommendations:v6:CA:zh-Hans";
    const legacyPool = JSON.stringify({ updatedAt: new Date().toISOString(), results: cachedAmbiguousSongCandidates.slice(0, 20) });
    kv.values.set(legacyKey, legacyPool);
    await writeSearchCache(kv, family, buildResponse("耍赖", family.normalizedQuery, cachedAmbiguousSongCandidates));
    const expected = ["-H5mMOf7quU", "00QDPHlWhvU", "jd4cllIyDHg", "IdMHKsoFNCI"];
    expect((await readSearchRecommendations(kv, 200)).map((item) => item.videoId)).toEqual(expected);
    const cached = await readSearchCache(kv, family);
    expect(cached?.entry.results).toHaveLength(50);
    await touchSearchCache(kv, family.hash, cached!.entry);
    expect((await readSearchRecommendations(kv, 200)).map((item) => item.videoId)).toEqual(expected);
    kv.values.delete(searchRecommendationsKey());
    expect((await readSearchRecommendations(kv, 200)).map((item) => item.videoId)).toEqual(expected);
    const writesAfterRebuild = kv.writes.length;
    await readSearchRecommendations(kv, 200);
    expect(kv.writes).toHaveLength(writesAfterRebuild);
    await recordQueuedSearchRecommendation(kv, { videoId: "00QDPHlWhvU", title: "琳娜 - 耍賴" });
    expect((await readSearchRecommendations(kv, 200))[0].videoId).toBe("00QDPHlWhvU");
    expect((await readSearchCache(kv, family))?.entry.results).toHaveLength(50);
    expect(kv.values.get(legacyKey)).toBe(legacyPool);
  });

  it("serves rebuilt songs even when the optional v7 write fails", async () => {
    const kv = new MemoryKv();
    const family = buildSearchQueryFamily("Later");
    await writeSearchCache(kv, family, buildResponse("Later", family.normalizedQuery, buildResults(3)));
    kv.values.delete(searchRecommendationsKey());
    kv.put = async () => { throw new Error("KV write unavailable"); };
    expect((await readSearchRecommendations(kv, 200)).map((item) => item.videoId)).toEqual(["video-0", "video-1", "video-2"]);
  });

  it("checks eligibility before the twenty-item cap, including lower-ranked valid artist covers", async () => {
    const kv = new MemoryKv();
    const family = buildSearchQueryFamily("林俊杰", undefined, { searchType: "artist" });
    const interviews = buildResults(30).map((item) => ({
      ...item, title: "林俊杰 专访", channelTitle: "林俊杰", tags: ["林俊杰"], categoryId: "24",
    }));
    const covers = buildResults(6, 100).map((item) => ({ ...item, title: "林俊杰 江南 Cover", tags: [] }));
    await writeSearchCache(kv, family, buildResponse("林俊杰", family.normalizedQuery, [...interviews, ...covers]));
    expect((await readSearchRecommendations(kv, 200)).map((item) => item.videoId)).toEqual(covers.map((item) => item.videoId));
  });

  it("never backfills a zero-eligible family or promotes unknown queued videos into the homepage", async () => {
    const kv = new MemoryKv();
    const family = buildSearchQueryFamily("耍赖");
    await writeSearchCache(kv, family, buildResponse("耍赖", family.normalizedQuery, [{
      videoId: "news", title: "霸总喝醉耍赖", categoryId: "24", score: 9999, reasons: [],
    }]));
    await recordQueuedSearchRecommendation(kv, { videoId: "news", title: "霸总喝醉耍赖" });
    await recordQueuedSearchRecommendation(kv, { videoId: "direct-url", title: "YouTube 视频" });
    expect(await readSearchRecommendations(kv, 200)).toEqual([]);
    expect((await readSearchCache(kv, family))?.entry.results).toHaveLength(1);
    await recordQueuedSearchRecommendation(kv, { videoId: "new-cover", title: "小林 - 耍赖 Cover" });
    expect((await readSearchRecommendations(kv, 200)).map((item) => item.videoId)).toEqual(["new-cover"]);
  });

  it("builds stable v4 cache keys", () => {
    expect(searchCacheFamilyKey("abc123")).toBe("yt-search:v4:abc123:CA:zh-Hans");
    expect(searchCacheIndexKey("later ktv")).toBe(
      "yt-search-index:v2:song:karaoke:-:later ktv:CA:zh-Hans",
    );
  });

  it("caches long, non-Music, and missing-metadata videos but removes structural duplicates", async () => {
    const kv = new MemoryKv();
    const family = buildSearchQueryFamily("Later");
    const candidates = buildResults(4);
    const nonMusic = candidates[1]!;
    const tooLong = candidates[2]!;
    const noMetadata = candidates[3]!;
    nonMusic.categoryId = "19";
    tooLong.durationSeconds = 900;
    delete noMetadata.categoryId;
    delete noMetadata.durationSeconds;

    const written = await writeSearchCache(
      kv,
      family,
      buildResponse("Later", family.normalizedQuery, [
        ...candidates,
        { ...candidates[0]!, title: "duplicate" },
      ]),
    );

    expect(written?.results.map((result) => result.videoId)).toEqual(
      candidates.map((result) => result.videoId),
    );
    await expect(readSearchCache(kv, family)).resolves.toMatchObject({
      entry: {
        results: candidates.map((result) => ({ videoId: result.videoId })),
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

  it("rejects an exact-key entry carrying the previous algorithm family hash", async () => {
    const kv = new MemoryKv();
    const family = buildSearchQueryFamily("林俊杰", undefined, { searchType: "artist" });
    await writeSearchCache(
      kv,
      family,
      buildResponse("林俊杰", family.normalizedQuery, buildResults(2)),
    );
    const key = searchCacheFamilyKey(family.hash);
    const oldEntry = JSON.parse(kv.values.get(key) ?? "null");
    oldEntry.queryFamily.hash = "a47f904a";
    kv.values.set(key, JSON.stringify(oldEntry));

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
    const recommendations = await readSearchRecommendations(kv, 20);

    expect(kv.values.has(searchRecommendationsKey())).toBe(true);
    expect(searchRecommendationsKey()).toBe("yt-search-recommendations:v7:CA:zh-Hans");
    expect(recommendations).toHaveLength(10);
    expect(recommendations[0].videoId).toBe("video-0");
  });

  it.each(["v4", "v5", "v6"])("ignores the previous recommendation pool version %s", async (version) => {
    const kv = new MemoryKv();
    kv.values.set(
      `yt-search-recommendations:${version}:CA:zh-Hans`,
      JSON.stringify({ updatedAt: new Date().toISOString(), results: buildResults(20) }),
    );

    await expect(readSearchRecommendations(kv, 20)).resolves.toEqual([]);
    expect(searchRecommendationsKey()).toBe("yt-search-recommendations:v7:CA:zh-Hans");
  });

  it("rebuilds recommendations from reranked legacy candidates before taking the top twenty", async () => {
    const kv = new MemoryKv();
    const family = buildSearchQueryFamily("耍赖");
    await writeSearchCache(kv, family, buildResponse("耍赖", family.normalizedQuery, ambiguousSongCandidates()));
    kv.values.delete(searchRecommendationsKey());
    kv.values.set("yt-search-recommendations:v4:CA:zh-Hans", JSON.stringify({
      updatedAt: new Date().toISOString(), results: ambiguousSongCandidates().slice(0, 20),
    }));

    const recommendations = await readSearchRecommendations(kv, 20);
    expect(recommendations.map((item) => item.videoId)).toEqual(["song-ktv", "song-cover", "song-live", "song-official"]);
    expect((await readSearchCache(kv, family))?.entry.results).toHaveLength(50);

    const cached = await readSearchCache(kv, family);
    await touchSearchCache(kv, family.hash, cached!.entry);
    expect((await readSearchRecommendations(kv, 20)).map((item) => item.videoId)).toEqual(recommendations.map((item) => item.videoId));
  });

  it("keeps recommendations selective by using only the top twenty from each family", async () => {
    const kv = new MemoryKv();

    for (let familyIndex = 0; familyIndex < 2; familyIndex += 1) {
      const family = buildSearchQueryFamily(`Singer ${familyIndex}`);
      const response = buildResponse(
        `Singer ${familyIndex}`,
        family.normalizedQuery,
        buildResults(50, familyIndex * 50, `Singer ${familyIndex}`),
      );

      await writeSearchCache(kv, family, response, {
        ttlSeconds: 60 * 60 * 24 * 365,
        maxEntryBytes: 100_000,
      });
    }

    const recommendations = await readSearchRecommendations(kv, 100);

    expect(recommendations).toHaveLength(40);
    expect(new Set(recommendations.map((result) => result.videoId)).size).toBe(40);
    expect(recommendations.some((result) => result.videoId === "video-19")).toBe(true);
    expect(recommendations.some((result) => result.videoId === "video-20")).toBe(false);
    expect(recommendations.some((result) => result.videoId === "video-69")).toBe(true);
    expect(recommendations.some((result) => result.videoId === "video-70")).toBe(false);
  });

  it("does not rebuild recommendations from an old algorithm family entry", async () => {
    const kv = new MemoryKv();
    const family = buildSearchQueryFamily("林俊杰", undefined, { searchType: "artist" });
    await writeSearchCache(
      kv,
      family,
      buildResponse("林俊杰", family.normalizedQuery, buildResults(8)),
    );
    const currentKey = searchCacheFamilyKey(family.hash);
    const oldEntry = JSON.parse(kv.values.get(currentKey) ?? "null");
    oldEntry.queryFamily.hash = "a47f904a";
    kv.values.clear();
    kv.values.set(searchCacheFamilyKey("a47f904a"), JSON.stringify(oldEntry));

    await expect(readSearchRecommendations(kv, 8)).resolves.toEqual([]);
  });

  it("promotes only the strongest results from the latest search ahead of prior hits", async () => {
    const kv = new MemoryKv();
    const earlierFamily = buildSearchQueryFamily("Earlier Singer");
    const latestFamily = buildSearchQueryFamily("Latest Singer");

    await writeSearchCache(
      kv,
      earlierFamily,
      buildResponse("Earlier Singer", earlierFamily.normalizedQuery, buildResults(12, 0, "Earlier Singer")),
    );
    await writeSearchCache(
      kv,
      latestFamily,
      buildResponse("Latest Singer", latestFamily.normalizedQuery, buildResults(12, 100, "Latest Singer")),
    );

    const recommendations = await readSearchRecommendations(kv, 24);

    expect(recommendations.slice(0, 12).map((result) => result.videoId)).toEqual(
      buildResults(12, 100).map((result) => result.videoId),
    );
    expect(recommendations[12].videoId).toBe("video-0");
    expect(recommendations).toHaveLength(24);
  });

  it("moves recently reused searches and actually queued songs to the front", async () => {
    const kv = new MemoryKv();
    const firstFamily = buildSearchQueryFamily("First Singer");
    const secondFamily = buildSearchQueryFamily("Second Singer");

    await writeSearchCache(
      kv,
      firstFamily,
      buildResponse("First Singer", firstFamily.normalizedQuery, buildResults(12, 0, "First Singer")),
    );
    await writeSearchCache(
      kv,
      secondFamily,
      buildResponse("Second Singer", secondFamily.normalizedQuery, buildResults(12, 100, "Second Singer")),
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

function buildResults(count: number, offset = 0, query = "Later"): VideoSearchResult[] {
  return Array.from({ length: count }, (_, index) => ({
    videoId: `video-${index + offset}`,
    title: `${query} KTV ${index + offset}`,
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
