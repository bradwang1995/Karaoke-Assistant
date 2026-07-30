import { afterEach, describe, expect, it, vi } from "vitest";
import { searchVideos } from "./searchService";

describe("direct YouTube URL search routing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns one metadata-backed result without calling YouTube search", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      expect(url.pathname).toBe("/youtube/v3/videos");
      expect(url.searchParams.get("id")).toBe("dQw4w9WgXcQ");

      return jsonResponse({
        items: [
          {
            id: "dQw4w9WgXcQ",
            contentDetails: { duration: "PT3M32S" },
            snippet: {
              title: "测试歌曲 &amp; KTV",
              channelTitle: "测试频道",
              categoryId: "10",
              thumbnails: {
                high: { url: "https://example.com/thumb.jpg" },
              },
            },
            status: { embeddable: true },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchVideos({
      query: "https://youtu.be/dQw4w9WgXcQ?si=secret",
      env: { YOUTUBE_API_KEY: "test-key" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.results).toEqual([
      expect.objectContaining({
        videoId: "dQw4w9WgXcQ",
        title: "测试歌曲 & KTV",
        durationSeconds: 212,
      }),
    ]);
    expect(response.cacheMeta).toMatchObject({
      queryMode: "youtube-url",
      sourceQueryCount: 0,
      videosListCalls: 1,
      externalCallAvoided: true,
    });
  });

  it("returns no results and performs no provider call for another URL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchVideos({
      query: "https://example.com/not-a-song",
      env: { YOUTUBE_API_KEY: "test-key" },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.results).toEqual([]);
    expect(response.cacheMeta).toMatchObject({
      queryMode: "blocked-url",
      sourceQueryCount: 0,
      videosListCalls: 0,
      externalCallAvoided: true,
    });
  });

  it("keeps a direct add fallback when metadata lookup fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("failure", { status: 503 })));

    const response = await searchVideos({
      query: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      env: { YOUTUBE_API_KEY: "test-key" },
    });

    expect(response.results).toEqual([
      expect.objectContaining({
        videoId: "dQw4w9WgXcQ",
        title: "YouTube 视频",
      }),
    ]);
    expect(response.cacheMeta?.sourceQueryCount).toBe(0);
  });
});

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
