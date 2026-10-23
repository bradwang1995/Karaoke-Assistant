import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchType } from "../src/types/youtube";
import { classifySearchQuery } from "../src/lib/searchQuery";
import { searchYouTubeVideos } from "./youtubeSearch";
import { ambiguousSongCandidates } from "./fixtures/ambiguousSong";

interface QualityCandidate {
  videoId: string;
  title: string;
  channelTitle?: string;
  tags?: string[];
  durationSeconds?: number;
  categoryId?: string;
  enriched?: boolean;
}

interface QualityContract {
  name: string;
  query: string;
  searchType: SearchType;
  includeOriginalVocal: boolean;
  candidates: QualityCandidate[];
  strongestId: string;
  weakId: string;
}

const QUALITY_CONTRACTS: QualityContract[] = [
  ...[false, true].map((includeOriginalVocal): QualityContract => ({
    name: `冷门同名词歌曲简繁匹配优先，原唱=${includeOriginalVocal}，保留 50 条`,
    query: "耍赖",
    searchType: "song",
    includeOriginalVocal,
    candidates: ambiguousSongCandidates(),
    strongestId: includeOriginalVocal ? "song-official" : "song-ktv",
    weakId: "unrelated-0",
  })),
  {
    name: "歌曲非原唱保留全部候选并把目标 KTV 排在弱结果前",
    query: "后来",
    searchType: "song",
    includeOriginalVocal: false,
    candidates: [
      candidate("later-ktv", "后来 KTV 伴奏版", ["karaoke", "instrumental"]),
      candidate("later-original", "后来 Official MV 原唱", ["official"]),
      candidate("wrong-song", "黄小琥 没那么简单 KTV", ["karaoke"]),
      candidate("later-medley", "后来 KTV 十五分钟串烧", ["karaoke"], 900, "24"),
    ],
    strongestId: "later-ktv",
    weakId: "wrong-song",
  },
  {
    name: "歌曲原唱保留 KTV 与错歌名候选但把官方歌词排在前面",
    query: "后来",
    searchType: "song",
    includeOriginalVocal: true,
    candidates: [
      candidate("later-mv", "后来 Official MV 原唱 歌词", ["official", "lyrics"]),
      candidate("later-backing", "后来 KTV 伴奏版", ["karaoke", "instrumental"]),
      candidate("wrong-original", "唯一 Official MV Lyrics", ["official", "lyrics"]),
      { ...candidate("no-details", "后来 普通上传", []), enriched: false },
    ],
    strongestId: "later-mv",
    weakId: "later-backing",
  },
  {
    name: "歌手非原唱保留弱 metadata 并把本人 KTV 排在前面",
    query: "单依纯",
    searchType: "artist",
    includeOriginalVocal: false,
    candidates: [
      candidate("shan-ktv", "单依纯 永不失联的爱 KTV 伴奏", ["karaoke"]),
      candidate("huang", "黄小琥 没那么简单 KTV", ["karaoke"]),
      candidate("shan-original", "单依纯 永不失联的爱 Official MV 原唱", ["official"]),
      candidate("weak-upload", "热门华语 Karaoke", []),
    ],
    strongestId: "shan-ktv",
    weakId: "huang",
  },
  {
    name: "歌手原唱保留 KTV 与 cover 并把本人官方音频排在前面",
    query: "林俊杰",
    searchType: "artist",
    includeOriginalVocal: true,
    candidates: [
      candidate("jj-lyrics", "林俊杰 修炼爱情 Lyrics Official Audio", ["lyrics", "official"]),
      candidate("jj-plain", "林俊杰 江南", []),
      candidate("jj-ktv", "林俊杰 江南 KTV 伴奏", ["karaoke", "instrumental"]),
      candidate("jj-cover", "林俊杰 江南 Cover", ["cover"]),
    ],
    strongestId: "jj-lyrics",
    weakId: "jj-ktv",
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
        expect(url.searchParams.get("videoEmbeddable")).toBe("true");
        expect(url.searchParams.get("videoCategoryId")).toBeNull();
        expect(url.searchParams.get("videoDuration")).toBeNull();
        return jsonResponse({ items: contract.candidates.map(searchItem) });
      }

      if (url.pathname.endsWith("/videos")) {
        const requestedIds = url.searchParams.get("id")?.split(",") ?? [];
        return jsonResponse({
          items: contract.candidates
            .filter((item) => item.enriched !== false && requestedIds.includes(item.videoId))
            .map(detailsItem),
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
    const ids = result.response.results.map((item) => item.videoId);
    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input)));

    expect(ids).toHaveLength(contract.candidates.length);
    expect(ids).toEqual(expect.arrayContaining(contract.candidates.map((item) => item.videoId)));
    expect(ids.indexOf(contract.strongestId)).toBeLessThan(ids.indexOf(contract.weakId));
    if (contract.query === "耍赖") {
      expect(ids.slice(0, 6).every((id) => id.startsWith("song-"))).toBe(true);
      expect(ids[0]).toBe(contract.strongestId);
    }
    expect(urls.filter((url) => url.pathname.endsWith("/search"))).toHaveLength(1);
    expect(urls.filter((url) => url.pathname.endsWith("/videos"))).toHaveLength(1);
    expect(result.response.cacheMeta).toMatchObject({
      sourceQueryCount: 1,
      videosListCalls: 1,
      candidateResultCount: contract.candidates.length,
      filteredResultCount: contract.candidates.length,
      timedOut: false,
      providerRateLimited: false,
      detailsEnrichmentFailed: false,
    });
  });
});

function candidate(
  videoId: string,
  title: string,
  tags: string[],
  durationSeconds = 240,
  categoryId = "10",
): QualityCandidate {
  return { videoId, title, tags, durationSeconds, categoryId };
}

function searchItem(item: QualityCandidate) {
  return {
    id: { videoId: item.videoId },
    snippet: {
      title: item.title,
      channelTitle: item.channelTitle ?? "Quality Contract Channel",
      publishedAt: "2026-01-01T00:00:00Z",
      thumbnails: { high: { url: `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg` } },
    },
  };
}

function detailsItem(item: QualityCandidate) {
  return {
    id: item.videoId,
    ...(item.durationSeconds !== undefined
      ? { contentDetails: { duration: isoDuration(item.durationSeconds) } }
      : {}),
    snippet: {
      ...(item.categoryId ? { categoryId: item.categoryId } : {}),
      ...(item.tags ? { tags: item.tags } : {}),
    },
    status: { embeddable: true },
  };
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


describe("URL entry validation contract", () => {
  it.each(["https://youtube.com/watch?v=dQw4w9WgXcQ", "youtu.be/dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ"])("accepts a single video: %s", query => {
    expect(classifySearchQuery(query).kind).toBe("youtube-video-url");
  });
  it.each(["后来", "https://youtube.com/playlist?list=PL123", "https://youtube.com/@artist", "https://youtube.com/watch?v=bad", "https://example.com/watch?v=dQw4w9WgXcQ"])("rejects URL-mode input: %s", query => {
    expect(classifySearchQuery(query).kind).not.toBe("youtube-video-url");
  });
});
