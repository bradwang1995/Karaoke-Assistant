import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchType } from "../src/types/youtube";
import { searchYouTubeVideos } from "./youtubeSearch";

interface QualityCandidate {
  videoId: string;
  title: string;
  channelTitle?: string;
  tags?: string[];
  durationSeconds?: number;
  categoryId?: string;
  embeddable?: boolean;
}

interface QualityContract {
  name: string;
  query: string;
  searchType: SearchType;
  includeOriginalVocal: boolean;
  candidates: QualityCandidate[];
  expectedIds: string[];
}

const QUALITY_CONTRACTS: QualityContract[] = [
  {
    name: "歌曲非原唱只保留目标歌名的 KTV/伴奏",
    query: "后来",
    searchType: "song",
    includeOriginalVocal: false,
    candidates: [
      candidate("later-ktv", "后来 KTV 伴奏版", ["karaoke", "instrumental"]),
      candidate("later-karaoke", "后来 Karaoke 字幕版", ["karaoke"]),
      candidate("later-original", "后来 Official MV 原唱", ["official"]),
      candidate("wrong-song", "黄小琥 没那么简单 KTV", ["karaoke"]),
      candidate("later-seven-minutes", "后来 KTV 完整版", ["karaoke"], 420),
    ],
    expectedIds: ["later-ktv", "later-karaoke"],
  },
  {
    name: "歌曲原唱优先歌词、官方音频和 radio，拒绝纯伴奏",
    query: "后来",
    searchType: "song",
    includeOriginalVocal: true,
    candidates: [
      candidate("later-mv", "后来 Official MV 原唱 歌词", ["official", "lyrics"]),
      candidate("later-radio", "后来 Lyrics Radio Official Audio", ["lyrics", "radio"]),
      candidate("later-backing", "后来 KTV 伴奏版", ["karaoke", "instrumental"]),
      candidate("wrong-original", "唯一 Official MV Lyrics", ["official", "lyrics"]),
    ],
    expectedIds: ["later-mv", "later-radio"],
  },
  {
    name: "歌手非原唱拒绝黄小琥等无关歌手",
    query: "单依纯",
    searchType: "artist",
    includeOriginalVocal: false,
    candidates: [
      candidate("shan-ktv", "单依纯 永不失联的爱 KTV 伴奏", ["karaoke"]),
      candidate("shan-karaoke", "单依纯 想你时风起 Karaoke", ["karaoke"]),
      candidate("huang", "黄小琥 没那么简单 KTV", ["karaoke"]),
      candidate("shan-original", "单依纯 永不失联的爱 Official MV 原唱", ["official"]),
    ],
    expectedIds: ["shan-ktv", "shan-karaoke"],
  },
  {
    name: "歌手原唱接受本人普通歌曲和歌词视频，拒绝 KTV 与 cover",
    query: "林俊杰",
    searchType: "artist",
    includeOriginalVocal: true,
    candidates: [
      candidate("jj-lyrics", "林俊杰 修炼爱情 Lyrics Official Audio", ["lyrics", "official"]),
      candidate("jj-plain", "林俊杰 江南", ["music"]),
      candidate("jj-ktv", "林俊杰 江南 KTV 伴奏", ["karaoke", "instrumental"]),
      candidate("jj-cover", "林俊杰 江南 Cover", ["cover"]),
    ],
    expectedIds: ["jj-lyrics", "jj-plain"],
  },
];

describe("search quality release contracts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(QUALITY_CONTRACTS)("$name", async (contract) => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.pathname.endsWith("/search")) {
        return jsonResponse({
          items: contract.candidates.map((item) => ({
            id: { videoId: item.videoId },
            snippet: {
              title: item.title,
              channelTitle: item.channelTitle ?? "Quality Contract Channel",
              publishedAt: "2026-01-01T00:00:00Z",
              thumbnails: {
                high: { url: `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg` },
              },
            },
          })),
        });
      }

      if (url.pathname.endsWith("/videos")) {
        const requestedIds = url.searchParams.get("id")?.split(",") ?? [];
        return jsonResponse({
          items: contract.candidates
            .filter((item) => requestedIds.includes(item.videoId))
            .map((item) => ({
              id: item.videoId,
              contentDetails: { duration: isoDuration(item.durationSeconds ?? 240) },
              snippet: {
                categoryId: item.categoryId ?? "10",
                tags: item.tags ?? ["music"],
              },
              status: { embeddable: item.embeddable ?? true },
            })),
        });
      }

      throw new Error(`Zero-quota contract attempted an unexpected URL: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchYouTubeVideos({
      query: contract.query,
      searchType: contract.searchType,
      includeOriginalVocal: contract.includeOriginalVocal,
      apiKey: "offline-contract-key",
      maxSearchCalls: 1,
      targetResultCount: 50,
      deadlineAt: Date.now() + 1_600,
    });
    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input)));

    expect(result.response.results.map((item) => item.videoId)).toEqual(contract.expectedIds);
    expect(urls.filter((url) => url.pathname.endsWith("/search"))).toHaveLength(1);
    expect(urls.filter((url) => url.pathname.endsWith("/videos"))).toHaveLength(1);
    expect(result.response.cacheMeta).toMatchObject({
      sourceQueryCount: 1,
      videosListCalls: 1,
      timedOut: false,
      providerRateLimited: false,
    });
    expect(
      result.response.results.every(
        (item) =>
          item.categoryId === "10" &&
          typeof item.durationSeconds === "number" &&
          item.durationSeconds > 0 &&
          item.durationSeconds < 420,
      ),
    ).toBe(true);
  });
});

function candidate(
  videoId: string,
  title: string,
  tags: string[],
  durationSeconds = 240,
): QualityCandidate {
  return { videoId, title, tags, durationSeconds };
}

function isoDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `PT${minutes}M${remainingSeconds}S`;
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
