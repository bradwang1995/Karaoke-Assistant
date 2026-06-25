import { normalizeSearchQuery } from "../src/lib/queryNormalize";
import type { SearchResponse } from "../src/types/youtube";
import type { SearchQueryFamily } from "./searchFamily";

const SEARCH_CACHE_VERSION = "v2";
const SEARCH_CACHE_INDEX_VERSION = "v1";
export const DEFAULT_SEARCH_CACHE_TTL_SECONDS = 60 * 60 * 24 * 365;
export const DEFAULT_SEARCH_CACHE_MAX_ENTRY_BYTES = 512 * 1024;
export const MAX_CACHED_SEARCH_RESULTS = 100;

interface JsonKvNamespace {
  get<T>(key: string, options: { type: "json" }): Promise<T | null>;
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void>;
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

export function searchCacheIndexKey(
  normalizedQuery: string,
  regionCode = "CA",
  language = "zh-Hans",
) {
  return `yt-search-index:${SEARCH_CACHE_INDEX_VERSION}:${normalizedQuery}:${regionCode}:${language}`;
}

export async function readSearchCache(
  namespace: JsonKvNamespace | undefined,
  family: SearchQueryFamily,
): Promise<SearchCacheReadResult | null> {
  if (!namespace) {
    return null;
  }

  const indexedHash = await namespace.get(searchCacheIndexKey(family.normalizedQuery));
  const hashes = uniqueValues([indexedHash, family.hash].filter(isString));

  for (const familyHash of hashes) {
    const entry = await namespace.get<SearchCacheEntry>(searchCacheFamilyKey(familyHash), {
      type: "json",
    });

    if (isValidSearchCacheEntry(entry)) {
      return { entry, familyHash };
    }
  }

  return null;
}

export async function writeSearchCache(
  namespace: JsonKvNamespace | undefined,
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
  const results = response.results.slice(0, MAX_CACHED_SEARCH_RESULTS);
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

  await writeSearchCacheIndexes(namespace, family, ttlSeconds);

  return payload.entry;
}

export async function touchSearchCache(
  namespace: JsonKvNamespace | undefined,
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

async function writeSearchCacheIndexes(
  namespace: JsonKvNamespace,
  family: SearchQueryFamily,
  ttlSeconds: number,
) {
  const normalizedIndexQueries = uniqueValues([
    family.normalizedQuery,
    ...family.aliases
      .filter((alias) => alias.includes(family.canonicalQuery))
      .map((alias) => normalizeSearchQuery(alias)),
  ]);

  await Promise.all(
    normalizedIndexQueries.map((normalizedQuery) =>
      namespace.put(searchCacheIndexKey(normalizedQuery), family.hash, {
        expirationTtl: ttlSeconds,
      }),
    ),
  );
}

function isValidSearchCacheEntry(value: SearchCacheEntry | null): value is SearchCacheEntry {
  if (!value || !Array.isArray(value.results)) {
    return false;
  }

  const expiresAtMs = Date.parse(value.expiresAt);

  return !Number.isFinite(expiresAtMs) || expiresAtMs > Date.now();
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

function isString(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}
