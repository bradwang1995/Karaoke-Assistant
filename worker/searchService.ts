import type { SearchResponse, SearchType } from "../src/types/youtube";
import {
  DEFAULT_SEARCH_CACHE_MAX_ENTRY_BYTES,
  DEFAULT_SEARCH_CACHE_TTL_SECONDS,
  MAX_CACHED_SEARCH_RESULTS,
  readSearchCache,
  readSearchRecommendations,
  type SearchCacheReadResult,
  type SearchCacheNamespace,
  touchSearchCache,
  writeSearchCache,
} from "./kvCache";
import { searchMockVideos } from "./mockSearchProvider";
import { rankSearchResultsForQuery } from "./scoring";
import { buildSearchQueryFamily } from "./searchFamily";
import { readSearchRepository, writeSearchRepository } from "./searchRepository";
import type { Env } from "./types";
import { searchYouTubeVideos } from "./youtubeSearch";
import {
  getYouTubeSearchQuotaStatusForEnv,
  recordYouTubeSearchCallsForEnv,
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

  const cachedEntries = await readCachedSearchEntries({
    query,
    artist,
    searchType,
    includeOriginalVocal,
    env,
  });
  const cacheTtlSeconds = getSearchCacheTtlSeconds(env);
  const cachedResults = rankSearchResultsForQuery(
    uniqueCachedResults(cachedEntries),
    query,
    {
      searchType,
      includeOriginalVocal,
      artist,
    },
  );

  if (cachedResults.length > 0) {
    for (const cached of cachedEntries) {
      await touchSearchCache(env.SEARCH_CACHE, cached.familyHash, cached.entry);
    }

    const response = {
        query,
        normalizedQuery: family.normalizedQuery,
        searchType,
        includeOriginalVocal,
        cached: true,
        results: cachedResults,
        cacheMeta: {
          sourceQueryCount: sumCachedStat(
            cachedEntries,
            (cached) => cached.entry.stats.youtubeSearchCalls,
          ),
          cachedResultCount: cachedResults.length,
          servedFromExpandedCache: true,
          videosListCalls: sumCachedStat(
            cachedEntries,
            (cached) => cached.entry.stats.videosListCalls,
          ),
          sourceQueries: [
            ...new Set(cachedEntries.flatMap((cached) => cached.entry.sourceQueries)),
          ],
          prunedResultCount: sumCachedStat(
            cachedEntries,
            (cached) => cached.entry.stats.prunedResultCount,
          ),
          responseSource: "repository" as const,
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

  const response = env.YOUTUBE_API_KEY
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

  const responseSource = env.YOUTUBE_API_KEY ? "external" : "mock";
  const responseWithSource: SearchResponse = {
    ...response,
    cacheMeta: {
      ...response.cacheMeta,
      sourceQueryCount: response.cacheMeta?.sourceQueryCount ?? 0,
      cachedResultCount: response.results.length,
      servedFromExpandedCache: false,
      responseSource,
    },
  };
  const cachedEntry = await writeSearchCache(env.SEARCH_CACHE, family, responseWithSource, {
    ttlSeconds: cacheTtlSeconds,
    maxEntryBytes: getSearchCacheMaxEntryBytes(env),
  });
  const persisted = await safeWriteSearchRepository(env.DB, family, responseWithSource);

  return limitSearchResponse(
    {
      ...responseWithSource,
      cacheMeta: {
        ...responseWithSource.cacheMeta,
        sourceQueryCount: responseWithSource.cacheMeta?.sourceQueryCount ?? 0,
        cachedResultCount: cachedEntry?.results.length ?? responseWithSource.results.length,
        servedFromExpandedCache: false,
        videosListCalls: responseWithSource.cacheMeta?.videosListCalls,
        sourceQueries: responseWithSource.cacheMeta?.sourceQueries,
        prunedResultCount: cachedEntry?.stats.prunedResultCount ?? 0,
        quota: responseWithSource.cacheMeta?.quota,
        responseSource,
        repositoryEntryId: persisted?.id,
      },
    },
    limit,
  );
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

async function readCachedSearchEntries({
  query,
  artist,
  searchType,
  includeOriginalVocal,
  env,
}: {
  query: string;
  artist?: string;
  searchType: SearchType;
  includeOriginalVocal: boolean;
  env: SearchServiceEnv;
}) {
  const families =
    searchType === "song"
      ? [false, true].map((vocalIntent) =>
          buildSearchQueryFamily(query, artist, {
            searchType,
            includeOriginalVocal: vocalIntent,
          }),
        )
      : [
          buildSearchQueryFamily(query, artist, {
            searchType,
            includeOriginalVocal,
          }),
        ];
  const reads = await Promise.all(
    families.map((candidate) => readSearchCache(env.SEARCH_CACHE, candidate)),
  );
  const entries: SearchCacheReadResult[] = [];
  const seenFamilyHashes = new Set<string>();

  for (const cached of reads) {
    if (!cached || seenFamilyHashes.has(cached.familyHash)) {
      continue;
    }

    seenFamilyHashes.add(cached.familyHash);
    entries.push(cached);
  }

  return entries;
}

function uniqueCachedResults(cachedEntries: SearchCacheReadResult[]) {
  const results: SearchResponse["results"] = [];
  const seenVideoIds = new Set<string>();

  for (const cached of cachedEntries) {
    for (const result of cached.entry.results) {
      if (seenVideoIds.has(result.videoId)) {
        continue;
      }

      seenVideoIds.add(result.videoId);
      results.push(result);
    }
  }

  return results;
}

function sumCachedStat(
  cachedEntries: SearchCacheReadResult[],
  readValue: (cached: SearchCacheReadResult) => number,
) {
  return cachedEntries.reduce((total, cached) => total + readValue(cached), 0);
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
  const response = await searchYouTubeVideos({
    query,
    artist,
    searchType,
    includeOriginalVocal,
    apiKey: env.YOUTUBE_API_KEY ?? "",
    maxSearchCalls,
    targetResultCount,
  });
  const usedSearchCalls = response.cacheMeta?.sourceQueryCount ?? 0;
  const quotaAfter =
    (await recordYouTubeSearchCallsForEnv(env, usedSearchCalls, dailyLimit)) ?? quotaBefore;
  const remainingAfter = quotaAfter.remaining;

  return {
    ...response,
    cacheMeta: {
      ...response.cacheMeta,
      sourceQueryCount: usedSearchCalls,
      cachedResultCount: response.results.length,
      servedFromExpandedCache: false,
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
