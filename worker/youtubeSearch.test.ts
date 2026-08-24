import { afterEach, describe, expect, it, vi } from "vitest";
import { parseIso8601DurationSeconds, searchYouTubeVideos } from "./youtubeSearch";

describe("youtube search helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fills a cache pool with one 50-result search page", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.pathname.endsWith("/search")) {
        return jsonResponse({
          items: buildSearchItems(0, 50),
        });
      }

      if (url.pathname.endsWith("/videos")) {
        const ids = url.searchParams.get("id")?.split(",") ?? [];

        return jsonResponse({
          items: ids.map((id) => ({
            id,
            contentDetails: { duration: "PT4M" },
            snippet: {
              categoryId: "10",
              tags: ["music", "karaoke"],
            },
            status: { embeddable: true },
          })),
        });
      }

      throw new Error(`Unexpected URL: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const providerResult = await searchYouTubeVideos({
      query: "Later",
      apiKey: "test-key",
      maxSearchCalls: 1,
      targetResultCount: 50,
    });
    const response = providerResult.response;
    const searchCalls = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .filter((url) => url.pathname.endsWith("/search"));
    const videosCalls = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .filter((url) => url.pathname.endsWith("/videos"));

    expect(response.results).toHaveLength(50);
    expect(response.cacheMeta?.sourceQueryCount).toBe(1);
    expect(response.cacheMeta?.cachedResultCount).toBe(50);
    expect(response.cacheMeta?.candidateResultCount).toBe(50);
    expect(response.cacheMeta?.filteredResultCount).toBe(50);
    expect(providerResult.candidates).toHaveLength(50);
    expect(response.cacheMeta?.videosListCalls).toBe(1);
    expect(searchCalls).toHaveLength(1);
    expect(videosCalls).toHaveLength(1);
    expect(searchCalls[0].searchParams.get("maxResults")).toBe("50");
    expect(searchCalls[0].searchParams.get("q")).toBe("later ktv");
    expect(searchCalls[0].searchParams.get("videoEmbeddable")).toBe("true");
    expect(searchCalls[0].searchParams.get("videoCategoryId")).toBeNull();
    expect(searchCalls[0].searchParams.get("videoDuration")).toBeNull();
    expect(searchCalls[0].searchParams.get("safeSearch")).toBe("moderate");
    expect(searchCalls[0].searchParams.get("regionCode")).toBe("CA");
    expect(searchCalls[0].searchParams.get("relevanceLanguage")).toBe("zh-Hans");
    expect(searchCalls[0].searchParams.has("pageToken")).toBe(false);
    expect(videosCalls[0].searchParams.get("part")).toBe(
      "contentDetails,snippet,status",
    );
    expect(response.results[0]).toMatchObject({
      categoryId: "10",
      durationSeconds: 240,
      tags: ["music", "karaoke"],
    });
  });

  it("preserves 16 strong and 34 weak artist candidates while ranking strong matches first", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.pathname.endsWith("/search")) {
        return jsonResponse({
          items: buildSearchItemsWithTitle(0, 50, (index) =>
            index < 16
              ? `林俊杰 经典歌曲 ${index} Official Lyrics`
              : `华语热门歌曲 ${index}`,
          ),
        });
      }

      const ids = url.searchParams.get("id")?.split(",") ?? [];
      return jsonResponse({ items: ids.map((id) => ({ id, status: { embeddable: true } })) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const providerResult = await searchYouTubeVideos({
      query: "林俊杰",
      searchType: "artist",
      includeOriginalVocal: true,
      apiKey: "test-key",
      maxSearchCalls: 1,
      targetResultCount: 50,
    });
    const results = providerResult.response.results;

    expect(results).toHaveLength(50);
    expect(results.slice(0, 16).every((result) => result.title.includes("林俊杰"))).toBe(true);
    expect(results.slice(16).every((result) => !result.title.includes("林俊杰"))).toBe(true);
    expect(providerResult.response.cacheMeta?.sourceQueryCount).toBe(1);
  });

  it("only follows an explicitly enabled page token when the provider returned fewer than the target", async () => {
    let searchCall = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.pathname.endsWith("/search")) {
        const currentCall = searchCall;
        searchCall += 1;
        return jsonResponse({
          ...(currentCall === 0 ? { nextPageToken: "focused-page-2" } : {}),
          items: currentCall === 0 ? buildSearchItems(0, 8) : buildSearchItems(8, 42),
        });
      }

      if (url.pathname.endsWith("/videos")) {
        const ids = url.searchParams.get("id")?.split(",") ?? [];
        return jsonResponse({
          items: ids.map((id) => ({
            id,
            contentDetails: { duration: "PT4M" },
            snippet: { categoryId: "10", tags: ["music"] },
            status: { embeddable: true },
          })),
        });
      }

      throw new Error(`Unexpected URL: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const providerResult = await searchYouTubeVideos({
      query: "Later",
      apiKey: "test-key",
      maxSearchCalls: 12,
      targetResultCount: 50,
    });

    expect(providerResult.response.results).toHaveLength(50);
    expect(providerResult.response.cacheMeta).toMatchObject({
      sourceQueryCount: 2,
      videosListCalls: 2,
      filteredResultCount: 50,
    });
    expect(providerResult.response.cacheMeta?.sourceQueries).toEqual([
      "later ktv",
      "later ktv",
    ]);
    const searchUrls = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .filter((url) => url.pathname.endsWith("/search"));
    expect(searchUrls[0].searchParams.has("pageToken")).toBe(false);
    expect(searchUrls[1].searchParams.get("pageToken")).toBe("focused-page-2");
  });

  it("moves to the next intent query when the focused query has no next page", async () => {
    let searchCall = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.pathname.endsWith("/search")) {
        const currentCall = searchCall;
        searchCall += 1;
        return jsonResponse({
          items: currentCall === 0
            ? buildSearchItems(0, 4)
            : buildSearchItems(50, 6),
        });
      }

      if (url.pathname.endsWith("/videos")) {
        const ids = url.searchParams.get("id")?.split(",") ?? [];
        return jsonResponse({
          items: ids.map((id) => ({
            id,
            contentDetails: { duration: "PT4M" },
            snippet: { categoryId: "10", tags: ["music"] },
            status: { embeddable: true },
          })),
        });
      }

      throw new Error(`Unexpected URL: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const providerResult = await searchYouTubeVideos({
      query: "Later",
      apiKey: "test-key",
      maxSearchCalls: 12,
      targetResultCount: 10,
    });

    expect(providerResult.response.results).toHaveLength(10);
    expect(providerResult.response.cacheMeta?.sourceQueries).toEqual([
      "later ktv",
      "later karaoke",
    ]);
  });

  it("returns the current search-page results when video details exceed the deadline", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = new URL(String(input));

        if (url.pathname.endsWith("/search")) {
          return jsonResponse({ items: buildSearchItems(0, 50) });
        }

        if (url.pathname.endsWith("/videos")) {
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        }

        throw new Error(`Unexpected URL: ${url.toString()}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const providerResult = await searchYouTubeVideos({
      query: "Later",
      apiKey: "test-key",
      maxSearchCalls: 1,
      targetResultCount: 50,
      deadlineAt: Date.now() + 25,
    });

    expect(providerResult.response.results).toHaveLength(50);
    expect(providerResult.candidates).toHaveLength(50);
    expect(providerResult.response.cacheMeta).toMatchObject({
      sourceQueryCount: 1,
      videosListCalls: 1,
      candidateResultCount: 50,
      timedOut: true,
      providerRateLimited: false,
    });
  });

  it("returns a graceful partial response when YouTube rate limits the provider call", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("limited", { status: 429 })));

    const providerResult = await searchYouTubeVideos({
      query: "Later",
      apiKey: "test-key",
      maxSearchCalls: 1,
      targetResultCount: 50,
    });

    expect(providerResult.response.results).toEqual([]);
    expect(providerResult.response.cacheMeta).toMatchObject({
      sourceQueryCount: 1,
      timedOut: false,
      providerRateLimited: true,
    });
  });

  it("preserves long, non-Music, missing metadata candidates and rejects explicit non-embeddable videos", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.pathname.endsWith("/search")) {
        return jsonResponse({ items: buildSearchItems(0, 6) });
      }

      if (url.pathname.endsWith("/videos")) {
        return jsonResponse({
          items: [
            videoDetails("video-0", "PT6M59S", "10", true),
            videoDetails("video-1", "PT7M", "10", true),
            videoDetails("video-2", "PT10M", "19", true),
            videoDetails("video-3", "PT4M", "10", false),
            videoDetails("video-4", "PT15M", "24", true),
          ],
        });
      }

      throw new Error(`Unexpected URL: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const providerResult = await searchYouTubeVideos({
      query: "Later",
      apiKey: "test-key",
    });

    expect(providerResult.response.results.map((result) => result.videoId)).toEqual(
      expect.arrayContaining(["video-0", "video-1", "video-2", "video-4", "video-5"]),
    );
    expect(providerResult.response.results).toHaveLength(5);
    expect(providerResult.candidates).toHaveLength(5);
    expect(providerResult.response.cacheMeta).toMatchObject({
      candidateResultCount: 5,
      filteredResultCount: 5,
    });
  });

  it("keeps snippet candidates when videos.list enrichment fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.pathname.endsWith("/search")) {
        return jsonResponse({ items: buildSearchItems(0, 50) });
      }

      return new Response("details unavailable", { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const providerResult = await searchYouTubeVideos({
      query: "Later",
      apiKey: "test-key",
      maxSearchCalls: 1,
      targetResultCount: 50,
    });

    expect(providerResult.response.results).toHaveLength(50);
    expect(providerResult.candidates).toHaveLength(50);
    expect(providerResult.response.cacheMeta).toMatchObject({
      sourceQueryCount: 1,
      videosListCalls: 1,
      candidateResultCount: 50,
      detailsEnrichmentFailed: true,
    });
  });

  it("parses ISO 8601 YouTube durations", () => {
    expect(parseIso8601DurationSeconds("PT4M32S")).toBe(272);
    expect(parseIso8601DurationSeconds("PT1H2M3S")).toBe(3723);
    expect(parseIso8601DurationSeconds("PT58S")).toBe(58);
  });

  it("returns undefined for unsupported durations", () => {
    expect(parseIso8601DurationSeconds("P1D")).toBeUndefined();
  });

  it("does not dispatch an external request when the quota reservation is rejected", async () => {
    const fetchMock = vi.fn();
    const beforeSearchCall = vi.fn(async () => false);
    vi.stubGlobal("fetch", fetchMock);

    const providerResult = await searchYouTubeVideos({
      query: "青花瓷",
      apiKey: "test-key",
      beforeSearchCall,
    });
    const response = providerResult.response;

    expect(beforeSearchCall).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.cacheMeta?.sourceQueryCount).toBe(0);
    expect(response.results).toEqual([]);
  });

  it("reserves quota before a provider failure that may already have consumed it", async () => {
    const callOrder: string[] = [];
    const beforeSearchCall = vi.fn(async () => {
      callOrder.push("reserve");
      return true;
    });
    const fetchMock = vi.fn(async () => {
      callOrder.push("fetch");
      return new Response("failure", { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      searchYouTubeVideos({
        query: "青花瓷",
        apiKey: "test-key",
        beforeSearchCall,
      }),
    ).rejects.toThrow("YouTube search failed with status 503");
    expect(callOrder).toEqual(["reserve", "fetch"]);
  });
});

function buildSearchItems(start: number, count: number) {
  return buildSearchItemsWithTitle(start, count, (index) => `Later KTV ${index}`);
}

function buildSearchItemsWithTitle(
  start: number,
  count: number,
  title: (index: number) => string,
) {
  return Array.from({ length: count }, (_, index) => {
    const id = `video-${start + index}`;

    return {
      id: { videoId: id },
      snippet: {
        title: title(start + index),
        channelTitle: "Karaoke Studio",
        publishedAt: "2026-01-01T00:00:00Z",
        thumbnails: {
          high: { url: `https://img.youtube.com/vi/${id}/hqdefault.jpg` },
        },
      },
    };
  });
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function videoDetails(
  id: string,
  duration: string,
  categoryId: string,
  embeddable: boolean,
) {
  return {
    id,
    contentDetails: { duration },
    snippet: { categoryId, tags: ["music"] },
    status: { embeddable },
  };
}
