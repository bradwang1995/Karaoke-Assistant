import type { SearchResponse, VideoSearchResult } from "../src/types/youtube";
import { scoreSearchResult } from "./scoring";
import { buildSearchQueryFamily } from "./searchFamily";

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const REGION_CODE = "CA";
const RELEVANCE_LANGUAGE = "zh-Hans";
const SEARCH_PAGE_SIZE = 50;
const VIDEO_DETAILS_CHUNK_SIZE = 50;
const DEFAULT_TARGET_CACHE_RESULTS = 100;
const DEFAULT_MAX_SEARCH_CALLS = 2;

interface YouTubeSearchListResponse {
  nextPageToken?: string;
  items?: Array<{
    id?: {
      videoId?: string;
    };
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
}

interface YouTubeVideosListResponse {
  items?: Array<{
    id?: string;
    contentDetails?: {
      duration?: string;
    };
  }>;
}

export interface YouTubeSearchOptions {
  query: string;
  artist?: string;
  apiKey: string;
  maxSearchCalls?: number;
  targetResultCount?: number;
}

export async function searchYouTubeVideos({
  query,
  artist,
  apiKey,
  maxSearchCalls = DEFAULT_MAX_SEARCH_CALLS,
  targetResultCount = DEFAULT_TARGET_CACHE_RESULTS,
}: YouTubeSearchOptions): Promise<SearchResponse> {
  const family = buildSearchQueryFamily(query, artist);
  const dedupedResults = new Map<string, Omit<VideoSearchResult, "score" | "reasons">>();
  const usedSourceQueries: string[] = [];
  let searchCallCount = 0;

  for (const sourceQuery of family.sourceQueries) {
    let nextPageToken: string | undefined;
    let sourceQueryUsed = false;

    do {
      if (searchCallCount >= maxSearchCalls || dedupedResults.size >= targetResultCount) {
        break;
      }

      const searchBody = await fetchSearchPage({
        apiKey,
        sourceQuery,
        pageToken: nextPageToken,
      });
      searchCallCount += 1;
      sourceQueryUsed = true;

      for (const item of searchBody.items ?? []) {
        const result = toBaseResult(item);

        if (result && !dedupedResults.has(result.videoId)) {
          dedupedResults.set(result.videoId, result);
        }
      }

      nextPageToken = searchBody.nextPageToken;
    } while (nextPageToken);

    if (sourceQueryUsed) {
      usedSourceQueries.push(sourceQuery);
    }

    if (searchCallCount >= maxSearchCalls || dedupedResults.size >= targetResultCount) {
      break;
    }
  }

  const baseResults = [...dedupedResults.values()].slice(0, targetResultCount);
  const { durations, callCount: videosListCalls } = await fetchVideoDurations(
    apiKey,
    baseResults.map((result) => result.videoId),
  );

  const results = baseResults
    .map((result) =>
      scoreSearchResult(
        {
          ...result,
          durationSeconds: durations.get(result.videoId),
        },
        query,
      ),
    )
    .sort((a, b) => b.score - a.score);

  return {
    query,
    normalizedQuery: family.normalizedQuery,
    cached: false,
    results,
    cacheMeta: {
      sourceQueryCount: searchCallCount,
      cachedResultCount: results.length,
      servedFromExpandedCache: false,
      videosListCalls,
      sourceQueries: usedSourceQueries,
    },
  };
}

async function fetchSearchPage({
  apiKey,
  sourceQuery,
  pageToken,
}: {
  apiKey: string;
  sourceQuery: string;
  pageToken?: string;
}) {
  const searchParams = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: sourceQuery,
    maxResults: String(SEARCH_PAGE_SIZE),
    videoEmbeddable: "true",
    safeSearch: "moderate",
    regionCode: REGION_CODE,
    relevanceLanguage: RELEVANCE_LANGUAGE,
    key: apiKey,
  });

  if (pageToken) {
    searchParams.set("pageToken", pageToken);
  }

  const searchResponse = await fetch(`${YOUTUBE_SEARCH_URL}?${searchParams.toString()}`);

  if (!searchResponse.ok) {
    throw new Error(`YouTube search failed with status ${searchResponse.status}.`);
  }

  return (await searchResponse.json()) as YouTubeSearchListResponse;
}

function toBaseResult(
  item: NonNullable<YouTubeSearchListResponse["items"]>[number],
): Omit<VideoSearchResult, "score" | "reasons"> | null {
  const videoId = item.id?.videoId;
  const title = item.snippet?.title;

  if (!videoId || !title) {
    return null;
  }

  const thumbnails = item.snippet?.thumbnails;

  return {
    videoId,
    title: decodeHtmlEntities(title),
    channelTitle: item.snippet?.channelTitle,
    thumbnailUrl: thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url,
    publishedAt: item.snippet?.publishedAt,
  };
}

async function fetchVideoDurations(apiKey: string, videoIds: string[]) {
  const durations = new Map<string, number>();
  let callCount = 0;

  for (let start = 0; start < videoIds.length; start += VIDEO_DETAILS_CHUNK_SIZE) {
    const ids = videoIds.slice(start, start + VIDEO_DETAILS_CHUNK_SIZE);

    if (ids.length === 0) {
      continue;
    }

    const params = new URLSearchParams({
      part: "contentDetails",
      id: ids.join(","),
      key: apiKey,
    });

    const response = await fetch(`${YOUTUBE_VIDEOS_URL}?${params.toString()}`);
    callCount += 1;

    if (!response.ok) {
      continue;
    }

    const body = (await response.json()) as YouTubeVideosListResponse;

    for (const item of body.items ?? []) {
      if (item.id && item.contentDetails?.duration) {
        const durationSeconds = parseIso8601DurationSeconds(item.contentDetails.duration);

        if (typeof durationSeconds === "number") {
          durations.set(item.id, durationSeconds);
        }
      }
    }
  }

  return { durations, callCount };
}

export function parseIso8601DurationSeconds(duration: string) {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);

  if (!match) {
    return undefined;
  }

  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
