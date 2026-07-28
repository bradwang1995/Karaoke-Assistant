import type { SearchResponse, SearchType } from "../src/types/youtube";
import {
  DEFAULT_SEARCH_CACHE_MAX_ENTRY_BYTES,
  DEFAULT_SEARCH_CACHE_TTL_SECONDS,
  MAX_CACHED_SEARCH_RESULTS,
  readSearchCache,
  readSearchRecommendations,
  type SearchCacheNamespace,
  touchSearchCache,
  writeSearchCache,
} from "./kvCache";
import { searchMockVideos } from "./mockSearchProvider";
import { buildSearchQueryFamily } from "./searchFamily";
import { readSearchRepository, writeSearchRepository } from "./searchRepository";
import type { Env } from "./types";
import {
  upsertVideoCatalog,
  type VideoCatalogCandidate,
} from "./videoCatalog";
import { searchYouTubeVideos } from "./youtubeSearch";
import {
  getYouTubeSearchQuotaStatusForEnv,
  reserveYouTubeSearchCallsForEnv,
} from "./youtubeQuota";

const DEFAULT_YOUTUBE_DAILY_SEARCH_LIMIT = 100;
const DEFAULT_YOUTUBE_SEARCH_CALLS_PER_FILL = 1;

type SearchServiceEnv = Omit<Env, "SEARCH_CACHE"> & {
  SEARCH_CACHE?: SearchCacheNamespace;
};

interface SearchVideosOptions {
  query: string;
  artist?: string;
  searchType?: SearchType;
  includeOriginalVocal?: boolean;
  limit?: number;
  cacheFill?: boolean;
  env: SearchServiceEnv;
}

export async function searchVideos({
  query,
  artist,
  searchType = "song",
  includeOriginalVocal = false,
  limit = 10,
  cacheFill = true,
  env,
}: SearchVideosOptions): Promise<SearchResponse> {
  const family = buildSearchQueryFamily(query, artist, { searchType, includeOriginalVocal });
  const repositoryHit = await safeReadSearchRepository(env.DB, family);

  if (repositoryHit) {
    return limitSearchResponse(repositoryHit.response, limit);
  }

  const cached = await readSearchCache(env.SEARCH_CACHE, family);
  const cacheTtlSeconds = getSearchCacheTtlSeconds(env);

  if (cached && cached.entry.results.length > 0) {
    await touchSearchCache(env.SEARCH_CACHE, cached.familyHash, cached.entry);

    const response = {
        query,
        normalizedQuery: family.normalizedQuery,
        searchType,
        includeOriginalVocal,
        cached: true,
        results: cached.entry.results,
        cacheMeta: {
          sourceQueryCount: 0,
          cachedResultCount: cached.entry.results.length,
          servedFromExpandedCache: false,
          videosListCalls: 0,
          sourceQueries: cached.entry.sourceQueries,
          prunedResultCount: cached.entry.stats.prunedResultCount,
          responseSource: "repository" as const,
          candidateResultCount: 0,
          filteredResultCount: 0,
          catalogResultCount: 0,
          uniqueCatalogVideosAdded: 0,
          externalCallAvoided: true,
        },
      } satisfies SearchResponse;

    const persisted = await safeWriteSearchRepository(env.DB, family, response);
    return limitSearchResponse(
      persisted
        ? {
            ...response,
            cacheMeta: {
              ...response.cacheMeta,
              repositoryEntryId: persisted.id,
            },
          }
        : response,
      limit,
    );
  }

  const providerResponse = env.YOUTUBE_API_KEY
    ? await searchLiveVideos({
        query,
        artist,
        searchType,
        includeOriginalVocal,
        limit,
        cacheFill,
        env,
      })
    : {
        ...searchMockVideos(query, limit),
        searchType,
        includeOriginalVocal,
      };
  const usedExternalSearchCalls = providerResponse.cacheMeta?.sourceQueryCount ?? 0;
  const responseSource = env.YOUTUBE_API_KEY ? "external" : "mock";
  const responseWithSource: SearchResponse = {
    ...providerResponse,
    cached: false,
    cacheMeta: {
      ...providerResponse.cacheMeta,
      sourceQueryCount: usedExternalSearchCalls,
      cachedResultCount: providerResponse.results.length,
      servedFromExpandedCache: false,
      responseSource,
      catalogResultCount: 0,
      externalCallAvoided: false,
    },
  };

  return persistAndLimitSearchResponse({
    env,
    family,
    response: responseWithSource,
    cacheTtlSeconds,
    limit,
  });
}

async function safeReadSearchRepository(db: D1Database | undefined, family: ReturnType<typeof buildSearchQueryFamily>) {
  try {
    return await readSearchRepository(db, family);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "search-repository-read-failed",
        familyHash: family.hash,
        error: error instanceof Error ? error.message : "Unknown D1 error",
      }),
    );
    return null;
  }
}

async function safeWriteSearchRepository(
  db: D1Database | undefined,
  family: ReturnType<typeof buildSearchQueryFamily>,
  response: SearchResponse,
) {
  try {
    return await writeSearchRepository(db, family, response);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "search-repository-write-failed",
        familyHash: family.hash,
        error: error instanceof Error ? error.message : "Unknown D1 error",
      }),
    );
    return null;
  }
}

async function safeUpsertVideoCatalog(
  db: D1Database | undefined,
  candidates: VideoCatalogCandidate[],
  sourceQuery: string,
) {
  try {
    return await upsertVideoCatalog(db, candidates, sourceQuery);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "search-video-catalog-write-failed",
        error: error instanceof Error ? error.message : "Unknown D1 error",
      }),
    );
    return {
      candidateCount: candidates.length,
      uniqueVideosAdded: 0,
    };
  }
}

async function persistAndLimitSearchResponse({
  env,
  family,
  response,
  cacheTtlSeconds,
  limit,
}: {
  env: SearchServiceEnv;
  family: ReturnType<typeof buildSearchQueryFamily>;
  response: SearchResponse;
  cacheTtlSeconds: number;
  limit: number;
}) {
  const cachedEntry = await writeSearchCache(env.SEARCH_CACHE, family, response, {
    ttlSeconds: cacheTtlSeconds,
    maxEntryBytes: getSearchCacheMaxEntryBytes(env),
  });
  const persisted = await safeWriteSearchRepository(env.DB, family, response);

  return limitSearchResponse(
    {
      ...response,
      cacheMeta: {
        ...response.cacheMeta,
        sourceQueryCount: response.cacheMeta?.sourceQueryCount ?? 0,
        cachedResultCount: cachedEntry?.results.length ?? response.results.length,
        servedFromExpandedCache: response.cacheMeta?.servedFromExpandedCache ?? false,
        videosListCalls: response.cacheMeta?.videosListCalls,
        sourceQueries: response.cacheMeta?.sourceQueries,
        prunedResultCount: cachedEntry?.stats.prunedResultCount ?? 0,
        quota: response.cacheMeta?.quota,
        responseSource: response.cacheMeta?.responseSource,
        repositoryEntryId: persisted?.id,
        candidateResultCount: response.cacheMeta?.candidateResultCount ?? 0,
        filteredResultCount: response.cacheMeta?.filteredResultCount ?? 0,
        catalogResultCount: response.cacheMeta?.catalogResultCount ?? 0,
        uniqueCatalogVideosAdded: response.cacheMeta?.uniqueCatalogVideosAdded ?? 0,
        externalCallAvoided: response.cacheMeta?.externalCallAvoided ?? false,
      },
    },
    limit,
  );
}

export async function getSearchRecommendations({
  limit = 10,
  env,
}: {
  limit?: number;
  env: SearchServiceEnv;
}): Promise<SearchResponse> {
  const results = await readSearchRecommendations(env.SEARCH_CACHE, limit);

  return {
    query: "",
    normalizedQuery: "",
    cached: true,
    results,
    cacheMeta: {
      sourceQueryCount: 0,
      cachedResultCount: results.length,
      servedFromExpandedCache: true,
      sourceQueries: [],
    },
  };
}

async function searchLiveVideos({
  query,
  artist,
  searchType,
  includeOriginalVocal,
  limit,
  cacheFill,
  env,
}: {
  query: string;
  artist?: string;
  searchType: SearchType;
  includeOriginalVocal: boolean;
  limit: number;
  cacheFill: boolean;
  env: SearchServiceEnv;
}) {
  const dailyLimit = getYouTubeDailySearchLimit(env);
  const quotaBefore = await getYouTubeSearchQuotaStatusForEnv(env, dailyLimit);
  const remainingBefore = quotaBefore.remaining;
  const perFillBudget = cacheFill ? getYouTubeSearchCallsPerFill(env) : 1;
  const maxSearchCalls = Math.min(perFillBudget, remainingBefore);

  if (maxSearchCalls <= 0) {
    const family = buildSearchQueryFamily(query, artist, { searchType, includeOriginalVocal });

    return {
      query,
      normalizedQuery: family.normalizedQuery,
      searchType,
      includeOriginalVocal,
      cached: false,
      results: [],
      cacheMeta: {
        sourceQueryCount: 0,
        cachedResultCount: 0,
        servedFromExpandedCache: false,
        sourceQueries: [],
        quota: {
          dailyLimit,
          used: quotaBefore.used,
          remainingBefore,
          remainingAfter: 0,
          exhausted: true,
          resetAt: quotaBefore.resetAt,
          resetTimeZone: quotaBefore.resetTimeZone,
          updatedAt: quotaBefore.updatedAt,
        },
      },
    } satisfies SearchResponse;
  }

  const targetResultCount = cacheFill ? MAX_CACHED_SEARCH_RESULTS : limit;
  let quotaAfter = quotaBefore;
  let reservationRejectedWithCapacity = false;
  const providerResult = await searchYouTubeVideos({
    query,
    artist,
    searchType,
    includeOriginalVocal,
    apiKey: env.YOUTUBE_API_KEY ?? "",
    maxSearchCalls,
    targetResultCount,
    beforeSearchCall: async () => {
      const reservation = await reserveYouTubeSearchCallsForEnv(env, 1, dailyLimit);
      quotaAfter = reservation.status;
      reservationRejectedWithCapacity = !reservation.reserved && reservation.status.remaining > 0;
      return reservation.reserved;
    },
  });
  const response = providerResult.response;
  const usedSearchCalls = response.cacheMeta?.sourceQueryCount ?? 0;

  if (usedSearchCalls === 0 && reservationRejectedWithCapacity) {
    throw new Error("YouTube search quota ledger reservation failed.");
  }

  const catalogWrite = await safeUpsertVideoCatalog(
    env.DB,
    providerResult.candidates,
    query,
  );
  const remainingAfter = quotaAfter.remaining;

  return {
    ...response,
    cacheMeta: {
      ...response.cacheMeta,
      sourceQueryCount: usedSearchCalls,
      cachedResultCount: response.results.length,
      servedFromExpandedCache: false,
      candidateResultCount: catalogWrite.candidateCount,
      filteredResultCount: response.results.length,
      uniqueCatalogVideosAdded: catalogWrite.uniqueVideosAdded,
      externalCallAvoided: false,
      quota: {
        dailyLimit,
        used: quotaAfter.used,
        remainingBefore,
        remainingAfter,
        exhausted: remainingAfter <= 0,
        resetAt: quotaAfter.resetAt,
        resetTimeZone: quotaAfter.resetTimeZone,
        updatedAt: quotaAfter.updatedAt,
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

export function getYouTubeDailySearchLimit(env: SearchServiceEnv) {
  return parsePositiveInteger(env.YOUTUBE_SEARCH_DAILY_LIMIT, DEFAULT_YOUTUBE_DAILY_SEARCH_LIMIT);
}

function getYouTubeSearchCallsPerFill(env: SearchServiceEnv) {
  return Math.min(
    parsePositiveInteger(env.YOUTUBE_SEARCH_MAX_CALLS_PER_FILL, DEFAULT_YOUTUBE_SEARCH_CALLS_PER_FILL),
    getYouTubeDailySearchLimit(env),
  );
}

function getSearchCacheTtlSeconds(env: SearchServiceEnv) {
  const ttlDays = parsePositiveInteger(
    env.SEARCH_CACHE_TTL_DAYS,
    DEFAULT_SEARCH_CACHE_TTL_SECONDS / (60 * 60 * 24),
  );

  return ttlDays * 60 * 60 * 24;
}

function getSearchCacheMaxEntryBytes(env: SearchServiceEnv) {
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
