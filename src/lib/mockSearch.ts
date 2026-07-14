import type { SearchResponse, SearchType, VideoSearchResult } from "../types/youtube";
import { normalizeQuery } from "./queryNormalize";
import { youtubeThumbnailUrl } from "./youtube";

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

const KARAOKE_TITLE_PATTERNS = [
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
  "{query} lyric video 歌词版",
  "{query} Official MV 字幕版",
  "{query} lyrics",
  "{query} 原唱 KTV 字幕",
  "{query} MV",
  "{query} 歌词版",
  "{query} original with lyrics",
  "{query} 官方音源字幕",
];

const MOCK_CHANNEL_TITLES = [
  "KTV 点唱频道",
  "华语伴奏精选",
  "朋友练歌房",
  "Karaoke Studio",
  "经典练唱库",
  "中文伴奏台",
  "KTV Remix",
  "Instrumental Studio",
];

const MOCK_DURATIONS = [265, 241, 304, 278, 252, 299, 286, 270];

export async function searchMockVideos(
  query: string,
  limit = 10,
  options: { searchType?: SearchType; includeOriginalVocal?: boolean } = {},
): Promise<SearchResponse> {
  const normalizedQuery = normalizeQuery(query);
  const patterns = options.includeOriginalVocal ? ORIGINAL_TITLE_PATTERNS : KARAOKE_TITLE_PATTERNS;

  if (!normalizedQuery) {
    return {
      query,
      normalizedQuery,
      cached: true,
      results: [],
    };
  }

  await new Promise((resolve) => window.setTimeout(resolve, 350));

  const results: VideoSearchResult[] = Array.from(
    { length: Math.min(limit, patterns.length) },
    (_, index) => {
    const pattern = patterns[index % patterns.length];
    const videoId = MOCK_VIDEO_IDS[index % MOCK_VIDEO_IDS.length];
    const title =
      options.searchType === "artist"
        ? pattern.replace("{query}", `${query.trim()} 经典歌曲 ${index + 1}`)
        : pattern.replace("{query}", query.trim());

      return {
        videoId,
        title,
        channelTitle: MOCK_CHANNEL_TITLES[index % MOCK_CHANNEL_TITLES.length],
        thumbnailUrl: youtubeThumbnailUrl(videoId),
        durationSeconds: MOCK_DURATIONS[index % MOCK_DURATIONS.length],
        score: 32 - index * 0.5,
        reasons: ["mock result", "title contains KTV"],
      };
    },
  );

  return {
    query,
    normalizedQuery: options.includeOriginalVocal
      ? `${normalizedQuery} lyric video`
      : `${normalizedQuery} ktv`,
    searchType: options.searchType ?? "song",
    includeOriginalVocal: options.includeOriginalVocal ?? false,
    cached: true,
    results,
  };
}
