import type { SearchResponse, VideoSearchResult } from "../src/types/youtube";
import type { SearchType } from "../src/types/youtube";
import { normalizeQuery, normalizeSearchQuery } from "../src/lib/queryNormalize";

const MOCK_VIDEO_IDS = [
  "dQw4w9WgXcQ",
  "kJQP7kiw5Fk",
  "JGwWNGJdvx8",
  "OPf0YbXqDm0",
  "RgKAFK5djSk",
  "09R8_2nJtjg",
  "YQHsXMglC9A",
  "60ItHLz5WEA",
];

const TITLE_PATTERNS = [
  "{query} KTV 伴奏版",
  "{query} 卡拉OK 字幕版",
  "{query} 高清 KTV",
  "{query} karaoke 练唱版",
  "{query} 原版伴奏",
  "{query} KTV 女声版",
  "{query} KTV 男声版",
  "{query} instrumental karaoke",
];

const ORIGINAL_TITLE_PATTERNS = [
  "{query} Lyrics Radio",
  "{query} official lyric video",
  "{query} 原唱 歌词版",
  "{query} Official Audio",
  "{query} lyrics",
  "{query} original vocal",
  "{query} 官方 MV",
  "{query} radio edit",
];

export function searchMockVideos(
  query: string,
  limit = 10,
  options: { searchType?: SearchType; includeOriginalVocal?: boolean } = {},
): SearchResponse {
  const normalizedQuery = normalizeQuery(query);

  if (!normalizedQuery) {
    return {
      query,
      normalizedQuery,
      cached: false,
      results: [],
    };
  }

  const titlePatterns = options.includeOriginalVocal
    ? ORIGINAL_TITLE_PATTERNS
    : TITLE_PATTERNS;
  const results: VideoSearchResult[] = titlePatterns.slice(0, limit).map(
    (pattern, index) => {
      const videoId = MOCK_VIDEO_IDS[index % MOCK_VIDEO_IDS.length];
      return {
        videoId,
        title: pattern.replace("{query}", query.trim()),
        channelTitle: [
          "KTV 点唱频道",
          "华语伴奏精选",
          "朋友练歌房",
          "Karaoke Studio",
          "经典练唱库",
          "中文伴奏台",
          "KTV Remix",
          "Instrumental Studio",
        ][index],
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        durationSeconds: [265, 241, 304, 278, 252, 299, 286, 270][index],
        publishedAt: "2026-01-01T00:00:00Z",
        categoryId: "10",
        tags: ["music", options.includeOriginalVocal ? "lyrics" : "karaoke"],
        score: 32 - index * 3,
        reasons: ["mock result", "title contains KTV"],
      };
    },
  );

  return {
    query,
    normalizedQuery: normalizeSearchQuery(query),
    searchType: options.searchType,
    includeOriginalVocal: options.includeOriginalVocal,
    cached: false,
    results,
  };
}
