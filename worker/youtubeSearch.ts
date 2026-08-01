import type { SearchResponse, SearchType, VideoSearchResult } from "../src/types/youtube";
import { rankSearchResultsForQuery } from "./scoring";
import { buildSearchQueryFamily } from "./searchFamily";
import {
  isEligibleSongResult,
  YOUTUBE_MUSIC_CATEGORY_ID,
} from "./songFilter";
import type { VideoCatalogCandidate } from "./videoCatalog";

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const REGION_CODE = "CA";
const RELEVANCE_LANGUAGE = "zh-Hans";
const SEARCH_PAGE_SIZE = 50;
const VIDEO_DETAILS_CHUNK_SIZE = 50;
const DEFAULT_TARGET_CACHE_RESULTS = 50;
const DEFAULT_MAX_SEARCH_CALLS = 1;

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
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      categoryId?: string;
      tags?: string[];
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
    status?: {
      embeddable?: boolean;
    };
  }>;
}

export interface YouTubeSearchOptions {
  query: string;
  artist?: string;
  searchType?: SearchType;
  includeOriginalVocal?: boolean;
  apiKey: string;
  maxSearchCalls?: number;
  targetResultCount?: number;
  beforeSearchCall?: () => Promise<boolean>;
}

export interface YouTubeSearchProviderResult {
  response: SearchResponse;
  candidates: VideoCatalogCandidate[];
}

export async function lookupYouTubeVideoById(videoId: string, apiKey: string) {
  const params = new URLSearchParams({
    part: "contentDetails,snippet,status",
    id: videoId,
    key: apiKey,
  });
  const response = await fetch(`${YOUTUBE_VIDEOS_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`YouTube video details failed with status ${response.status}.`);
  }

  const body = (await response.json()) as YouTubeVideosListResponse;
  const item = body.items?.find((candidate) => candidate.id === videoId);
  const title = item?.snippet?.title;

  if (!item || !title || item.status?.embeddable === false) {
    return null;
  }

  const durationSeconds = item.contentDetails?.duration
    ? parseIso8601DurationSeconds(item.contentDetails.duration)
    : undefined;
  const thumbnails = item.snippet?.thumbnails;

  return {
    videoId,
    title: decodeHtmlEntities(title),
    channelTitle: item.snippet?.channelTitle,
    thumbnailUrl:
      thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url,
    durationSeconds,
    publishedAt: item.snippet?.publishedAt,
    categoryId: item.snippet?.categoryId,
    tags: (item.snippet?.tags ?? []).slice(0, 20),
    score: 0,
    reasons: ["youtube-direct-url"],
  } satisfies VideoSearchResult;
}

export async function searchYouTubeVideos({
  query,
  artist,
  searchType = "song",
  includeOriginalVocal = false,
  apiKey,
  maxSearchCalls = DEFAULT_MAX_SEARCH_CALLS,
  targetResultCount = DEFAULT_TARGET_CACHE_RESULTS,
  beforeSearchCall,
}: YouTubeSearchOptions): Promise<YouTubeSearchProviderResult> {
  const family = buildSearchQueryFamily(query, artist, { searchType, includeOriginalVocal });
  const dedupedResults = new Map<string, Omit<VideoSearchResult, "score" | "reasons">>();
  const candidatesById = new Map<string, VideoCatalogCandidate>();
  const usedSourceQueries: string[] = [];
  let searchCallCount = 0;
  let videosListCalls = 0;

  sourceQueries:
  for (const sourceQuery of family.sourceQueries) {
    let pageToken: string | undefined;

    do {
      if (searchCallCount >= maxSearchCalls || targetResultCount <= 0) {
        break sourceQueries;
      }

      const allowed = beforeSearchCall ? await beforeSearchCall() : true;

      if (!allowed) {
        break sourceQueries;
      }

      const searchBody = await fetchSearchPage({ apiKey, sourceQuery, pageToken });
      searchCallCount += 1;
      usedSourceQueries.push(sourceQuery);
      const newBaseResults: Array<Omit<VideoSearchResult, "score" | "reasons">> = [];

      for (const item of searchBody.items ?? []) {
        const result = toBaseResult(item);

        if (result && !dedupedResults.has(result.videoId)) {
          dedupedResults.set(result.videoId, result);
          newBaseResults.push(result);
        }
      }

      const detailsResult = await fetchVideoDetails(
        apiKey,
        newBaseResults.map((result) => result.videoId),
      );
      videosListCalls += detailsResult.callCount;

      for (const result of newBaseResults) {
        const videoDetails = detailsResult.details.get(result.videoId);

        if (!videoDetails || videoDetails.embeddable === false) {
          continue;
        }

        const candidate = {
          ...result,
          durationSeconds: videoDetails.durationSeconds,
          categoryId: videoDetails.categoryId,
          ...(videoDetails.tags.length > 0 ? { tags: videoDetails.tags } : {}),
        };

        if (isEligibleSongResult(candidate)) {
          candidatesById.set(candidate.videoId, candidate);
        }
      }

      const rankedCount = rankSearchResultsForQuery(
        [...candidatesById.values()],
        query,
        { searchType, includeOriginalVocal, artist },
      ).length;

      if (rankedCount >= targetResultCount) {
        break sourceQueries;
      }

      pageToken = searchBody.nextPageToken;
    } while (pageToken);
  }

  const candidates = [...candidatesById.values()];
  const results = rankSearchResultsForQuery(
    candidates,
    query,
    { searchType, includeOriginalVocal, artist },
  ).slice(0, targetResultCount);

  return {
    response: {
      query,
      normalizedQuery: family.normalizedQuery,
      searchType,
      includeOriginalVocal,
      cached: false,
      results,
      cacheMeta: {
        sourceQueryCount: searchCallCount,
        cachedResultCount: results.length,
        servedFromExpandedCache: false,
        videosListCalls,
        sourceQueries: usedSourceQueries,
        candidateResultCount: candidates.length,
        filteredResultCount: results.length,
      },
    },
    candidates,
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
    videoCategoryId: YOUTUBE_MUSIC_CATEGORY_ID,
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

async function fetchVideoDetails(apiKey: string, videoIds: string[]) {
  const details = new Map<
    string,
    {
      durationSeconds: number;
      categoryId?: string;
      tags: string[];
      embeddable?: boolean;
    }
  >();
  let callCount = 0;

  for (let start = 0; start < videoIds.length; start += VIDEO_DETAILS_CHUNK_SIZE) {
    const ids = videoIds.slice(start, start + VIDEO_DETAILS_CHUNK_SIZE);

    if (ids.length === 0) {
      continue;
    }

    const params = new URLSearchParams({
      part: "contentDetails,snippet,status",
      id: ids.join(","),
      key: apiKey,
    });

    const response = await fetch(`${YOUTUBE_VIDEOS_URL}?${params.toString()}`);
    callCount += 1;

    if (!response.ok) {
      throw new Error(`YouTube video details failed with status ${response.status}.`);
    }

    const body = (await response.json()) as YouTubeVideosListResponse;

    for (const item of body.items ?? []) {
      if (!item.id || !item.contentDetails?.duration) {
        continue;
      }

      const durationSeconds = parseIso8601DurationSeconds(item.contentDetails.duration);

      if (typeof durationSeconds === "number") {
        details.set(item.id, {
          durationSeconds,
          categoryId: item.snippet?.categoryId,
          tags: (item.snippet?.tags ?? []).slice(0, 20),
          embeddable: item.status?.embeddable,
        });
      }
    }
  }

  return { details, callCount };
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
