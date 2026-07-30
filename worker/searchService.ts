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
import {
  buildSearchQueryFamily,
  buildSearchQueryFamilyVariants,
  type SearchQueryFamily,
} from "./searchFamily";
import { rankSearchResultsForQuery } from "./scoring";
import { readSearchRepositories, writeSearchRepository } from "./searchRepository";
import { filterEligibleSongResults } from "./songFilter";
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
  waitUntil?: (promise: Promise<unknown>) => void;
  env: SearchServiceEnv;
}

interface LocalSearchHit {
  family: SearchQueryFamily;
  response: SearchResponse;
  repositoryEntryId?: string;
}

export async function searchVideos({
  query,
  artist,
  searchType = "song",
  includeOriginalVocal = false,
  limit = 10,
  cacheFill = true,
  waitUntil,
  env,
}: SearchVideosOptions): Promise<SearchResponse> {
  const families = buildSearchQueryFamilyVariants(query, artist, {
    searchType,
    includeOriginalVocal,
  });
  const family = families[0]!;
  const [repositoryHits, kvHits] = await Promise.all([
    safeReadSearchRepositories(env.DB, families, waitUntil),
    readSearchCacheVariants(env.SEARCH_CACHE, families),
  ]);
  const repositoryByFamily = new Map(
    repositoryHits.map((hit) => [hit.family.hash, hit]),
  );
  const kvByFamily = new Map(kvHits.map((hit) => [hit.family.hash, hit]));
  const localHits: LocalSearchHit[] = [];

  for (const candidateFamily of families) {
    const repositoryHit = repositoryByFamily.get(candidateFamily.hash);

    if (repositoryHit) {
      localHits.push({
        family: candidateFamily,
        response: repositoryHit.response,
        repositoryEntryId: repositoryHit.id,
      });
      continue;
    }

    const kvHit = kvByFamily.get(candidateFamily.hash);

    if (kvHit) {
      localHits.push(kvHit);
    }
  }
  const cacheTtlSeconds = getSearchCacheTtlSeconds(env);

  if (localHits.length > 0) {
    const response = mergeLocalSearchResponses({
      query,
      artist,
      searchType,
      includeOriginalVocal,
      family,
      hits: localHits,
    });
    if (response.results.length > 0) {
      const backgroundTasks = kvHits
        .filter((hit) => !repositoryByFamily.has(hit.family.hash))
        .map((hit) => touchSearchCache(env.SEARCH_CACHE, hit.familyHash, hit.entry));

      if (
        response.cacheMeta?.servedFromExpandedCache ||
        !repositoryByFamily.has(family.hash)
      ) {
        backgroundTasks.push(
          writeSearchCache(env.SEARCH_CACHE, family, response, {
            ttlSeconds: cacheTtlSeconds,
            maxEntryBytes: getSearchCacheMaxEntryBytes(env),
          }).then(() => undefined),
          safeWriteSearchRepository(env.DB, family, response).then(() => undefined),
        );
      }

      await runBackgroundTasks(backgroundTasks, waitUntil, "search-cache-refresh-failed");
      return limitSearchResponse(response, limit);
    }
  }

  const providerResponse = env.YOUTUBE_API_KEY
    ? await searchLiveVideos({
        query,
        artist,
        searchType,
        includeOriginalVocal,
        limit,
        cacheFill,
        waitUntil,
        env,
      })
    : {
        ...searchMockVideos(query, limit, { searchType, includeOriginalVocal }),
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
    waitUntil,
  });
}

async function safeReadSearchRepositories(
  db: D1Database | undefined,
  families: SearchQueryFamily[],
  waitUntil?: (promise: Promise<unknown>) => void,
) {
  try {
    return await readSearchRepositories(db, families, { waitUntil });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "search-repository-read-failed",
        familyHash: families[0]?.hash,
        error: error instanceof Error ? error.message : "Unknown D1 error",
      }),
    );
    return [];
  }
}

async function readSearchCacheVariants(
  namespace: SearchCacheNamespace | undefined,
  families: SearchQueryFamily[],
) {
  const results = await Promise.all(
    families.map(async (family) => {
      const cached = await readSearchCache(namespace, family);

      if (!cached) {
        return null;
      }

      return {
        family,
        familyHash: cached.familyHash,
        entry: cached.entry,
        response: {
          query: cached.entry.query,
          normalizedQuery: cached.entry.normalizedQuery,
          searchType: family.searchType,
          includeOriginalVocal: family.includeOriginalVocal,
          cached: true,
          results: cached.entry.results,
        } satisfies SearchResponse,
      };
    }),
  );

  return results.filter((result) => result !== null);
}

function mergeLocalSearchResponses({
  query,
  artist,
  searchType,
  includeOriginalVocal,
  family,
  hits,
}: {
  query: string;
  artist?: string;
  searchType: SearchType;
  includeOriginalVocal: boolean;
  family: SearchQueryFamily;
  hits: LocalSearchHit[];
}) {
  const exactHit = hits.find((hit) => hit.family.hash === family.hash);
  const exactVideoIds = new Set(exactHit?.response.results.map((result) => result.videoId) ?? []);
  const seenVideoIds = new Set<string>();
  const merged: SearchResponse["results"] = [];

  for (const hit of hits) {
    for (const result of filterEligibleSongResults(hit.response.results)) {
      if (!seenVideoIds.has(result.videoId)) {
        seenVideoIds.add(result.videoId);
        merged.push(result);
      }
    }
  }

  const results = rankSearchResultsForQuery(merged, query, {
    artist,
    searchType,
    includeOriginalVocal,
  }).slice(0, MAX_CACHED_SEARCH_RESULTS);
  const expandedResultCount = results.filter(
    (result) => !exactVideoIds.has(result.videoId),
  ).length;

  return {
    query,
    normalizedQuery: family.normalizedQuery,
    searchType,
    includeOriginalVocal,
    cached: true,
    results,
    cacheMeta: {
      sourceQueryCount: 0,
      cachedResultCount: results.length,
      servedFromExpandedCache: !exactHit || expandedResultCount > 0,
      videosListCalls: 0,
      sourceQueries: uniqueStrings(
        hits.flatMap((hit) => hit.response.cacheMeta?.sourceQueries ?? []),
      ),
      responseSource: "repository" as const,
      repositoryEntryId:
        exactHit?.repositoryEntryId ??
        hits.find((hit) => hit.repositoryEntryId)?.repositoryEntryId,
      candidateResultCount: 0,
      filteredResultCount: 0,
      catalogResultCount: 0,
      uniqueCatalogVideosAdded: 0,
      externalCallAvoided: true,
    },
  } satisfies SearchResponse;
}

async function runBackgroundTasks(
  tasks: Promise<unknown>[],
  waitUntil: ((promise: Promise<unknown>) => void) | undefined,
  errorEvent: string,
) {
  if (tasks.length === 0) {
    return;
  }

  const task = Promise.all(tasks)
    .then(() => undefined)
    .catch((error) => {
      console.error(
        JSON.stringify({
          event: errorEvent,
          error: error instanceof Error ? error.message : "Unknown background task error",
        }),
      );
    });

  if (waitUntil) {
    waitUntil(task);
    return;
  }

  await task;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
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
  waitUntil,
}: {
  env: SearchServiceEnv;
  family: ReturnType<typeof buildSearchQueryFamily>;
  response: SearchResponse;
  cacheTtlSeconds: number;
  limit: number;
  waitUntil?: (promise: Promise<unknown>) => void;
}) {
  const cacheWrite = writeSearchCache(env.SEARCH_CACHE, family, response, {
    ttlSeconds: cacheTtlSeconds,
    maxEntryBytes: getSearchCacheMaxEntryBytes(env),
  });
  const repositoryWrite = safeWriteSearchRepository(env.DB, family, response);

  if (waitUntil) {
    await runBackgroundTasks(
      [cacheWrite, repositoryWrite],
      waitUntil,
      "search-result-persistence-failed",
    );

    return limitSearchResponse(
      {
        ...response,
        cacheMeta: {
          ...response.cacheMeta,
          sourceQueryCount: response.cacheMeta?.sourceQueryCount ?? 0,
          cachedResultCount: response.results.length,
          servedFromExpandedCache: response.cacheMeta?.servedFromExpandedCache ?? false,
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

  const [cachedEntry, persisted] = await Promise.all([cacheWrite, repositoryWrite]);

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
  waitUntil,
  env,
}: {
  query: string;
  artist?: string;
  searchType: SearchType;
  includeOriginalVocal: boolean;
  limit: number;
  cacheFill: boolean;
  waitUntil?: (promise: Promise<unknown>) => void;
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
