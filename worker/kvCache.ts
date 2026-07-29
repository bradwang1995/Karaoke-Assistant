import { normalizeQuery } from "../src/lib/queryNormalize";
import type { QueueItemInput } from "../src/types/room";
import type { SearchResponse } from "../src/types/youtube";
import type { SearchQueryFamily } from "./searchFamily";
import { filterEligibleSongResults } from "./songFilter";

const SEARCH_CACHE_VERSION = "v4";
const SEARCH_CACHE_INDEX_VERSION = "v2";
const SEARCH_RECOMMENDATIONS_VERSION = "v2";
export const DEFAULT_SEARCH_CACHE_TTL_SECONDS = 60 * 60 * 24 * 365;
export const DEFAULT_SEARCH_CACHE_MAX_ENTRY_BYTES = 512 * 1024;
export const MAX_CACHED_SEARCH_RESULTS = 50;
export const MAX_RECOMMENDED_SEARCH_RESULTS = 200;
export const MAX_PROMOTED_RESULTS_PER_SEARCH = 8;

export interface SearchCacheNamespace {
  get<T>(key: string, options: { type: "json" }): Promise<T | null>;
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void>;
  list?(options?: KvListOptions): Promise<KvListResult>;
}

interface KvListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

interface KvListResult {
  keys: Array<{ name: string }>;
  list_complete: boolean;
  cursor?: string;
}

interface SearchCacheStats {
  resultCount: number;
  youtubeSearchCalls: number;
  videosListCalls: number;
  payloadBytes: number;
  prunedResultCount: number;
}

export interface SearchCacheEntry {
  query: string;
  normalizedQuery: string;
  queryFamily: {
    canonicalQuery: string;
    artist?: string;
    searchType: SearchQueryFamily["searchType"];
    includeOriginalVocal: boolean;
    aliases: string[];
    hash: string;
  };
  createdAt: string;
  expiresAt: string;
  sourceQueries: string[];
  results: SearchResponse["results"];
  stats: SearchCacheStats;
  hitCount: number;
  lastAccessedAt?: string;
}

export interface SearchCacheReadResult {
  entry: SearchCacheEntry;
  familyHash: string;
}

interface SearchRecommendationsEntry {
  updatedAt: string;
  results: SearchResponse["results"];
}

export function searchCacheKey(familyHash: string, regionCode = "CA", language = "zh-Hans") {
  return searchCacheFamilyKey(familyHash, regionCode, language);
}

export function searchCacheFamilyKey(
  familyHash: string,
  regionCode = "CA",
  language = "zh-Hans",
) {
  return `yt-search:${SEARCH_CACHE_VERSION}:${familyHash}:${regionCode}:${language}`;
}

export function searchCacheFamilyKeyPrefix() {
  return `yt-search:${SEARCH_CACHE_VERSION}:`;
}

export function searchCacheIndexKey(
  normalizedQuery: string,
  options: {
    searchType?: SearchQueryFamily["searchType"];
    includeOriginalVocal?: boolean;
    artist?: string;
  } = {},
  regionCode = "CA",
  language = "zh-Hans",
) {
  const searchType = options.searchType ?? "song";
  const vocalIntent = options.includeOriginalVocal ? "original" : "karaoke";
  const artist = encodeURIComponent(options.artist ?? "-");

  return `yt-search-index:${SEARCH_CACHE_INDEX_VERSION}:${searchType}:${vocalIntent}:${artist}:${normalizedQuery}:${regionCode}:${language}`;
}

export function searchRecommendationsKey(regionCode = "CA", language = "zh-Hans") {
  return `yt-search-recommendations:${SEARCH_RECOMMENDATIONS_VERSION}:${regionCode}:${language}`;
}

export async function readSearchCache(
  namespace: SearchCacheNamespace | undefined,
  family: SearchQueryFamily,
): Promise<SearchCacheReadResult | null> {
  if (!namespace) {
    return null;
  }

  const entry = await namespace.get<SearchCacheEntry>(
    searchCacheFamilyKey(family.hash),
    { type: "json" },
  );

  if (isValidSearchCacheEntry(entry) && isCompatibleSearchCacheEntry(entry, family)) {
    const results = filterEligibleSongResults(entry.results);

    if (results.length > 0) {
      return { entry: { ...entry, results }, familyHash: family.hash };
    }
  }

  return null;
}

export async function writeSearchCache(
  namespace: SearchCacheNamespace | undefined,
  family: SearchQueryFamily,
  response: SearchResponse,
  options: {
    ttlSeconds?: number;
    maxEntryBytes?: number;
  } = {},
) {
  if (!namespace) {
    return null;
  }

  const ttlSeconds = options.ttlSeconds ?? DEFAULT_SEARCH_CACHE_TTL_SECONDS;
  const maxEntryBytes = options.maxEntryBytes ?? DEFAULT_SEARCH_CACHE_MAX_ENTRY_BYTES;
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + ttlSeconds * 1000);
  const results = filterEligibleSongResults(response.results).slice(
    0,
    MAX_CACHED_SEARCH_RESULTS,
  );

  if (results.length === 0) {
    return null;
  }
  const entry = buildSearchCacheEntry({
    response,
    family,
    createdAt,
    expiresAt,
    results,
    payloadBytes: 0,
    prunedResultCount: 0,
  });
  const payload = pruneCachePayload(entry, maxEntryBytes);

  await namespace.put(searchCacheFamilyKey(family.hash), payload.value, {
    expirationTtl: ttlSeconds,
  });

  await updateSearchRecommendations(namespace, payload.entry.results, ttlSeconds);

  return payload.entry;
}

export async function readSearchRecommendations(
  namespace: SearchCacheNamespace | undefined,
  limit: number,
) {
  if (!namespace) {
    return [];
  }

  const recommendations = await namespace.get<SearchRecommendationsEntry>(
    searchRecommendationsKey(),
    { type: "json" },
  );

  const storedResults = isValidRecommendationsEntry(recommendations)
    ? filterEligibleSongResults(recommendations.results)
    : [];

  if (storedResults.length >= limit) {
    return storedResults.slice(0, limit);
  }

  const familyResults = await readRecommendationsFromFamilyCaches(namespace, limit);
  return uniqueResults([...storedResults, ...familyResults]).slice(0, limit);
}

export async function touchSearchCache(
  namespace: SearchCacheNamespace | undefined,
  familyHash: string,
  entry: SearchCacheEntry,
) {
  if (!namespace) {
    return;
  }

  const expiresAtMs = Date.parse(entry.expiresAt);

  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return;
  }

  const nextEntry: SearchCacheEntry = {
    ...entry,
    hitCount: entry.hitCount + 1,
    lastAccessedAt: new Date().toISOString(),
  };
  const value = JSON.stringify({
    ...nextEntry,
    stats: {
      ...nextEntry.stats,
      payloadBytes: measureJsonBytes(nextEntry),
    },
  } satisfies SearchCacheEntry);

  await namespace.put(searchCacheFamilyKey(familyHash), value, {
    expiration: Math.floor(expiresAtMs / 1000),
  });

  await updateSearchRecommendations(
    namespace,
    nextEntry.results,
    Math.max(Math.floor((expiresAtMs - Date.now()) / 1000), 60),
  );
}

export async function recordQueuedSearchRecommendation(
  namespace: SearchCacheNamespace | undefined,
  item: QueueItemInput,
  ttlSeconds = DEFAULT_SEARCH_CACHE_TTL_SECONDS,
) {
  if (!namespace) {
    return;
  }

  const existing = await namespace.get<SearchRecommendationsEntry>(
    searchRecommendationsKey(),
    { type: "json" },
  );
  const existingResult = isValidRecommendationsEntry(existing)
    ? existing.results.find((result) => result.videoId === item.videoId)
    : undefined;

  await updateSearchRecommendations(
    namespace,
    [
      {
        ...existingResult,
        videoId: item.videoId,
        title: item.title,
        ...(item.channelTitle ? { channelTitle: item.channelTitle } : {}),
        ...(item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : {}),
        score: Math.max(existingResult?.score ?? 0, 1_000_000),
        reasons: uniqueValues(["recently queued", ...(existingResult?.reasons ?? [])]),
      },
    ],
    ttlSeconds,
  );
}

function buildSearchCacheEntry({
  response,
  family,
  createdAt,
  expiresAt,
  results,
  payloadBytes,
  prunedResultCount,
}: {
  response: SearchResponse;
  family: SearchQueryFamily;
  createdAt: Date;
  expiresAt: Date;
  results: SearchResponse["results"];
  payloadBytes: number;
  prunedResultCount: number;
}): SearchCacheEntry {
  return {
    query: response.query,
    normalizedQuery: response.normalizedQuery,
    queryFamily: {
      canonicalQuery: family.canonicalQuery,
      ...(family.artist ? { artist: family.artist } : {}),
      searchType: family.searchType,
      includeOriginalVocal: family.includeOriginalVocal,
      aliases: family.aliases,
      hash: family.hash,
    },
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    sourceQueries: response.cacheMeta?.sourceQueries ?? family.sourceQueries,
    results,
    stats: {
      resultCount: results.length,
      youtubeSearchCalls: response.cacheMeta?.sourceQueryCount ?? 0,
      videosListCalls: response.cacheMeta?.videosListCalls ?? 0,
      payloadBytes,
      prunedResultCount,
    },
    hitCount: 0,
  };
}

function pruneCachePayload(entry: SearchCacheEntry, maxEntryBytes: number) {
  const nextEntry: SearchCacheEntry = {
    ...entry,
    results: [...entry.results],
  };
  let prunedResultCount = 0;
  let payload = stringifyWithMeasuredBytes(nextEntry, prunedResultCount);

  while (payload.bytes > maxEntryBytes && nextEntry.results.length > 0) {
    nextEntry.results.pop();
    prunedResultCount += 1;
    payload = stringifyWithMeasuredBytes(nextEntry, prunedResultCount);
  }

  return {
    entry: payload.entry,
    value: payload.value,
  };
}

function stringifyWithMeasuredBytes(entry: SearchCacheEntry, prunedResultCount: number) {
  const resultCount = entry.results.length;
  const nextEntry: SearchCacheEntry = {
    ...entry,
    stats: {
      ...entry.stats,
      resultCount,
      payloadBytes: 0,
      prunedResultCount,
    },
  };
  const initialValue = JSON.stringify(nextEntry);
  const measuredEntry: SearchCacheEntry = {
    ...nextEntry,
    stats: {
      ...nextEntry.stats,
      payloadBytes: byteLength(initialValue),
    },
  };
  const value = JSON.stringify(measuredEntry);

  return {
    entry: measuredEntry,
    value,
    bytes: byteLength(value),
  };
}

async function updateSearchRecommendations(
  namespace: SearchCacheNamespace,
  nextResults: SearchResponse["results"],
  ttlSeconds: number,
) {
  const existing = await namespace.get<SearchRecommendationsEntry>(searchRecommendationsKey(), {
    type: "json",
  });
  const promotedResults = nextResults.slice(0, MAX_PROMOTED_RESULTS_PER_SEARCH);
  const remainingResults = nextResults.slice(MAX_PROMOTED_RESULTS_PER_SEARCH);
  const mergedResults = uniqueResults([
    ...promotedResults,
    ...(isValidRecommendationsEntry(existing) ? existing.results : []),
    ...remainingResults,
  ]).slice(0, MAX_RECOMMENDED_SEARCH_RESULTS);
  const entry: SearchRecommendationsEntry = {
    updatedAt: new Date().toISOString(),
    results: mergedResults,
  };

  await namespace.put(searchRecommendationsKey(), JSON.stringify(entry), {
    expirationTtl: ttlSeconds,
  });
}

async function readRecommendationsFromFamilyCaches(
  namespace: SearchCacheNamespace,
  limit: number,
) {
  if (!namespace.list) {
    return [];
  }

  const listed = await namespace.list({
    prefix: searchCacheFamilyKeyPrefix(),
    limit: Math.min(Math.max(Math.ceil(limit / 10), 20), 1_000),
  });
  const entries = (
    await Promise.all(
      listed.keys.map((key) =>
        namespace.get<SearchCacheEntry>(key.name, {
          type: "json",
        }),
      ),
    )
  )
    .filter(isValidSearchCacheEntry)
    .map((entry) => ({
      ...entry,
      results: filterEligibleSongResults(entry.results),
    }))
    .filter((entry) => entry.results.length > 0);
  const rankedGroups = entries
    .sort((a, b) => recommendationEntryScore(b) - recommendationEntryScore(a))
    .map((entry) => entry.results);
  const interleavedResults: SearchResponse["results"] = [];
  const seenVideoIds = new Set<string>();
  const longestGroupLength = Math.max(0, ...rankedGroups.map((group) => group.length));

  for (let resultIndex = 0; resultIndex < longestGroupLength; resultIndex += 1) {
    for (const group of rankedGroups) {
      const result = group[resultIndex];

      if (result && !seenVideoIds.has(result.videoId)) {
        seenVideoIds.add(result.videoId);
        interleavedResults.push(result);
      }

      if (interleavedResults.length >= limit) {
        return interleavedResults.slice(0, limit);
      }
    }
  }

  return interleavedResults.slice(0, limit);
}

function isValidSearchCacheEntry(value: SearchCacheEntry | null): value is SearchCacheEntry {
  if (!value || !Array.isArray(value.results)) {
    return false;
  }

  const expiresAtMs = Date.parse(value.expiresAt);

  return !Number.isFinite(expiresAtMs) || expiresAtMs > Date.now();
}

function isCompatibleSearchCacheEntry(
  entry: SearchCacheEntry,
  family: SearchQueryFamily,
) {
  return (
    normalizeQuery(entry.query) === family.canonicalQuery &&
    entry.queryFamily.canonicalQuery === family.canonicalQuery &&
    entry.queryFamily.searchType === family.searchType &&
    entry.queryFamily.includeOriginalVocal === family.includeOriginalVocal &&
    (entry.queryFamily.artist ?? "") === (family.artist ?? "")
  );
}

function isValidRecommendationsEntry(
  value: SearchRecommendationsEntry | null,
): value is SearchRecommendationsEntry {
  return Boolean(value && Array.isArray(value.results));
}

function uniqueResults(results: SearchResponse["results"]) {
  const seen = new Set<string>();
  const unique: SearchResponse["results"] = [];

  for (const result of results) {
    if (seen.has(result.videoId)) {
      continue;
    }

    seen.add(result.videoId);
    unique.push(result);
  }

  return unique;
}

function cacheEntryTimestamp(entry: SearchCacheEntry) {
  const value = Date.parse(entry.lastAccessedAt ?? entry.createdAt);
  return Number.isFinite(value) ? value : 0;
}

function recommendationEntryScore(entry: SearchCacheEntry) {
  const sixHoursMs = 6 * 60 * 60 * 1000;
  return cacheEntryTimestamp(entry) + Math.min(entry.hitCount, 100) * sixHoursMs;
}

function measureJsonBytes(value: unknown) {
  return byteLength(JSON.stringify(value));
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function uniqueValues(values: string[]) {
  return [...new Set(values)];
}
