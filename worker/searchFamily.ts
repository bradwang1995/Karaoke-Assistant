import { normalizeQuery, normalizeSearchQuery } from "../src/lib/queryNormalize";
import type { SearchType } from "../src/types/youtube";

const MAX_SOURCE_QUERY_LENGTH = 450;

const KARAOKE_SUFFIX_PATTERNS = [
  /\s+ktv$/i,
  /\s+karaoke$/i,
  /\s+karaoke version$/i,
  /\s+instrumental$/i,
  /\s+pinyin$/i,
  /\s+\u4f34\u594f$/u,
  /\s+\u5361\u62c9\s*ok$/iu,
];

export interface SearchQueryFamily {
  canonicalQuery: string;
  normalizedQuery: string;
  artist?: string;
  searchType: SearchType;
  includeOriginalVocal: boolean;
  aliases: string[];
  sourceQueries: string[];
  hash: string;
}

export function buildSearchQueryFamily(
  query: string,
  artist?: string,
  options: { searchType?: SearchType; includeOriginalVocal?: boolean } = {},
): SearchQueryFamily {
  const searchType = options.searchType ?? "song";
  const includeOriginalVocal = options.includeOriginalVocal ?? false;
  const canonicalQuery = normalizeQuery(query);
  const providerQuery = normalizeSearchFamilyQuery(canonicalQuery);
  const normalizedArtist = normalizeOptionalText(artist);
  const normalizedQuery = buildNormalizedQuery(providerQuery, searchType, includeOriginalVocal);
  const aliases = buildFamilyAliases(
    providerQuery,
    normalizedArtist,
    searchType,
    includeOriginalVocal,
  );
  const sourceQueries = buildSourceQueries(
    providerQuery,
    aliases,
    normalizedArtist,
    searchType,
    includeOriginalVocal,
  );
  const hash = searchFamilyHash(canonicalQuery, normalizedArtist, searchType, includeOriginalVocal);

  return {
    canonicalQuery,
    normalizedQuery,
    ...(normalizedArtist ? { artist: normalizedArtist } : {}),
    searchType,
    includeOriginalVocal,
    aliases,
    sourceQueries,
    hash,
  };
}

export function normalizeSearchFamilyQuery(query: string) {
  let normalized = normalizeQuery(query);
  let next = stripKaraokeSuffix(normalized);

  while (next !== normalized) {
    normalized = next;
    next = stripKaraokeSuffix(normalized);
  }

  return normalized;
}

export function searchFamilyHash(
  canonicalQuery: string,
  artist?: string,
  searchType: SearchType = "song",
  includeOriginalVocal = false,
) {
  const input = `${normalizeQuery(canonicalQuery)}|${normalizeOptionalText(artist) ?? ""}|${searchType}|${includeOriginalVocal ? "original" : "karaoke"}`;
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stripKaraokeSuffix(query: string) {
  for (const pattern of KARAOKE_SUFFIX_PATTERNS) {
    const stripped = query.replace(pattern, "").trim();

    if (stripped !== query) {
      return stripped;
    }
  }

  return query;
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value ? normalizeQuery(value) : "";
  return normalized.length > 0 ? normalized : undefined;
}

function buildNormalizedQuery(
  canonicalQuery: string,
  searchType: SearchType,
  includeOriginalVocal: boolean,
) {
  if (!canonicalQuery) {
    return "";
  }

  if (searchType === "artist") {
    return includeOriginalVocal
      ? `${canonicalQuery} lyric video`
      : `${canonicalQuery} ktv`;
  }

  return includeOriginalVocal
    ? `${canonicalQuery} lyric video`
    : normalizeSearchQuery(canonicalQuery);
}

function buildFamilyAliases(
  canonicalQuery: string,
  artist: string | undefined,
  searchType: SearchType,
  includeOriginalVocal: boolean,
) {
  if (!canonicalQuery) {
    return [];
  }

  const aliases =
    searchType === "artist"
      ? buildArtistAliases(canonicalQuery, includeOriginalVocal)
      : buildSongAliases(canonicalQuery, includeOriginalVocal);

  if (artist && searchType === "song") {
    aliases.push(
      `${artist} ${canonicalQuery} ktv`,
      `${artist} ${canonicalQuery} karaoke`,
      `${artist} karaoke`,
      `${artist} classic songs ktv`,
    );
  }

  return uniqueNormalized(aliases);
}

function buildSongAliases(canonicalQuery: string, includeOriginalVocal: boolean) {
  if (includeOriginalVocal) {
    return [
      canonicalQuery,
      `${canonicalQuery} lyric video`,
      `${canonicalQuery} lyrics`,
      `${canonicalQuery} \u6b4c\u8bcd`,
      `${canonicalQuery} MV`,
      `${canonicalQuery} original with lyrics`,
    ];
  }

  return [
    canonicalQuery,
    normalizeSearchQuery(canonicalQuery),
    `${canonicalQuery} karaoke`,
    `${canonicalQuery} \u4f34\u594f`,
    `${canonicalQuery} \u5361\u62c9OK`,
    `${canonicalQuery} pinyin karaoke`,
    `${canonicalQuery} instrumental`,
  ];
}

function buildArtistAliases(canonicalQuery: string, includeOriginalVocal: boolean) {
  if (includeOriginalVocal) {
    return [
      `${canonicalQuery} lyric video`,
      `${canonicalQuery} lyrics`,
      `${canonicalQuery} \u6b4c\u8bcd`,
      `${canonicalQuery} MV`,
      `${canonicalQuery} official`,
      `${canonicalQuery} songs with lyrics`,
    ];
  }

  return [
    `${canonicalQuery} ktv`,
    `${canonicalQuery} karaoke`,
    `${canonicalQuery} \u4f34\u594f`,
    `${canonicalQuery} \u5361\u62c9OK`,
    `${canonicalQuery} pinyin karaoke`,
    `${canonicalQuery} classic songs ktv`,
  ];
}

function buildSourceQueries(
  canonicalQuery: string,
  aliases: string[],
  artist: string | undefined,
  searchType: SearchType,
  includeOriginalVocal: boolean,
) {
  if (!canonicalQuery) {
    return [];
  }

  const broadQuery = joinAliasesForYouTube(aliases.filter((alias) => alias !== canonicalQuery));
  const focusedSongQuery = artist
    ? `${artist} ${canonicalQuery}`
    : canonicalQuery;
  const fallbackQueries = searchType === "artist"
    ? [
        includeOriginalVocal
          ? `${canonicalQuery} lyric video`
          : `${canonicalQuery} ktv`,
        includeOriginalVocal
          ? `${canonicalQuery} songs lyrics`
          : `${canonicalQuery} karaoke songs`,
      ]
    : artist
    ? [
        `${artist} ${canonicalQuery} ktv`,
        `${artist} karaoke`,
        normalizeSearchQuery(canonicalQuery),
      ]
    : [normalizeSearchQuery(canonicalQuery), `${canonicalQuery} karaoke`];

  return uniqueNormalized(
    (
      searchType === "song"
        ? [focusedSongQuery, ...fallbackQueries, broadQuery]
        : [broadQuery, ...fallbackQueries]
    ).filter(Boolean),
  );
}

function joinAliasesForYouTube(aliases: string[]) {
  const parts: string[] = [];
  let length = 0;

  for (const alias of aliases) {
    const nextLength = length + alias.length + (parts.length > 0 ? 1 : 0);

    if (nextLength > MAX_SOURCE_QUERY_LENGTH) {
      break;
    }

    parts.push(alias);
    length = nextLength;
  }

  return parts.join("|");
}

function uniqueNormalized(values: string[]) {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    const normalized = normalizeQuery(value);

    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      uniqueValues.push(normalized);
    }
  }

  return uniqueValues;
}
