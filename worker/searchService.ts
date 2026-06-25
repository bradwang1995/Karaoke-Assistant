import type { SearchResponse } from "../src/types/youtube";
import {
  DEFAULT_SEARCH_CACHE_MAX_ENTRY_BYTES,
  DEFAULT_SEARCH_CACHE_TTL_SECONDS,
  MAX_CACHED_SEARCH_RESULTS,
  readSearchCache,
  touchSearchCache,
  writeSearchCache,
} from "./kvCache";
import { searchMockVideos } from "./mockSearchProvider";
import { buildSearchQueryFamily } from "./searchFamily";
import type { Env } from "./types";
import { searchYouTubeVideos } from "./youtubeSearch";
import { getAvailableYouTubeSearchCalls, recordYouTubeSearchCalls } from "./youtubeQuota";

const DEFAULT_YOUTUBE_DAILY_SEARCH_LIMIT = 50;
const DEFAULT_YOUTUBE_SEARCH_CALLS_PER_FILL = 2;

interface SearchVideosOptions {
  query: string;
  artist?: string;
  limit?: number;
  cacheFill?: boolean;
  env: Env;
}

export async function searchVideos({
  query,
  artist,
  limit = 4,
  cacheFill = true,
  env,
}: SearchVideosOptions): Promise<SearchResponse> {
  const family = buildSearchQueryFamily(query, artist);
  const cached = await readSearchCache(env.SEARCH_CACHE, family);
  const cacheTtlSeconds = getSearchCacheTtlSeconds(env);

  if (cached) {
    await touchSearchCache(env.SEARCH_CACHE, cached.familyHash, cached.entry);

    return limitSearchResponse(
      {
        query,
        normalizedQuery: cached.entry.normalizedQuery,
        cached: true,
        results: cached.entry.results,
        cacheMeta: {
          sourceQueryCount: cached.entry.stats.youtubeSearchCalls,
          cachedResultCount: cached.entry.results.length,
          servedFromExpandedCache: true,
          videosListCalls: cached.entry.stats.videosListCalls,
          sourceQueries: cached.entry.sourceQueries,
          prunedResultCount: cached.entry.stats.prunedResultCount,
        },
      },
      limit,
    );
  }

  const response = env.YOUTUBE_API_KEY
    ? await searchLiveVideos({
        query,
        artist,
        cacheFill,
        env,
      })
    : searchMockVideos(query, limit);

  const cachedEntry = await writeSearchCache(env.SEARCH_CACHE, family, response, {
    ttlSeconds: cacheTtlSeconds,
    maxEntryBytes: getSearchCacheMaxEntryBytes(env),
  });

  return limitSearchResponse(
    {
      ...response,
      cacheMeta: {
        ...response.cacheMeta,
        sourceQueryCount: response.cacheMeta?.sourceQueryCount ?? 0,
        cachedResultCount: cachedEntry?.results.length ?? response.results.length,
        servedFromExpandedCache: false,
        videosListCalls: response.cacheMeta?.videosListCalls,
        sourceQueries: response.cacheMeta?.sourceQueries,
        prunedResultCount: cachedEntry?.stats.prunedResultCount ?? 0,
        quota: response.cacheMeta?.quota,
      },
    },
    limit,
  );
}

async function searchLiveVideos({
  query,
  artist,
  cacheFill,
  env,
}: {
  query: string;
  artist?: string;
  cacheFill: boolean;
  env: Env;
}) {
  const dailyLimit = getYouTubeDailySearchLimit(env);
  const remainingBefore = await getAvailableYouTubeSearchCalls(env.SEARCH_CACHE, dailyLimit);
  const perFillBudget = cacheFill ? getYouTubeSearchCallsPerFill(env) : 1;
  const maxSearchCalls = Math.min(perFillBudget, remainingBefore);

  if (maxSearchCalls <= 0) {
    const family = buildSearchQueryFamily(query, artist);

    return {
      query,
      normalizedQuery: family.normalizedQuery,
      cached: false,
      results: [],
      cacheMeta: {
        sourceQueryCount: 0,
        cachedResultCount: 0,
        servedFromExpandedCache: false,
        sourceQueries: [],
        quota: {
          dailyLimit,
          remainingBefore,
          remainingAfter: 0,
          exhausted: true,
        },
      },
    } satisfies SearchResponse;
  }

  const targetResultCount = cacheFill ? MAX_CACHED_SEARCH_RESULTS : 4;
  const response = await searchYouTubeVideos({
    query,
    artist,
    apiKey: env.YOUTUBE_API_KEY ?? "",
    maxSearchCalls,
    targetResultCount,
  });
  const usedSearchCalls = response.cacheMeta?.sourceQueryCount ?? 0;
  await recordYouTubeSearchCalls(env.SEARCH_CACHE, usedSearchCalls, dailyLimit);
  const remainingAfter = Math.max(remainingBefore - usedSearchCalls, 0);

  return {
    ...response,
    cacheMeta: {
      ...response.cacheMeta,
      sourceQueryCount: usedSearchCalls,
      cachedResultCount: response.results.length,
      servedFromExpandedCache: false,
      quota: {
        dailyLimit,
        remainingBefore,
        remainingAfter,
        exhausted: remainingAfter <= 0,
      },
    },
  } satisfies SearchResponse;
}

function limitSearchResponse(response: SearchResponse, limit: number): SearchResponse {
  return {
    ...response,
    results: response.results.slice(0, limit),
    cacheMeta: response.cacheMeta
      ? {
          ...response.cacheMeta,
          cachedResultCount: response.cacheMeta.cachedResultCount,
        }
      : undefined,
  };
}

function getYouTubeDailySearchLimit(env: Env) {
  return parsePositiveInteger(env.YOUTUBE_SEARCH_DAILY_LIMIT, DEFAULT_YOUTUBE_DAILY_SEARCH_LIMIT);
}

function getYouTubeSearchCallsPerFill(env: Env) {
  return Math.min(
    parsePositiveInteger(env.YOUTUBE_SEARCH_MAX_CALLS_PER_FILL, DEFAULT_YOUTUBE_SEARCH_CALLS_PER_FILL),
    getYouTubeDailySearchLimit(env),
  );
}

function getSearchCacheTtlSeconds(env: Env) {
  const ttlDays = parsePositiveInteger(
    env.SEARCH_CACHE_TTL_DAYS,
    DEFAULT_SEARCH_CACHE_TTL_SECONDS / (60 * 60 * 24),
  );

  return ttlDays * 60 * 60 * 24;
}

function getSearchCacheMaxEntryBytes(env: Env) {
  return parsePositiveInteger(env.SEARCH_CACHE_MAX_ENTRY_BYTES, DEFAULT_SEARCH_CACHE_MAX_ENTRY_BYTES);
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}
