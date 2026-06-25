import { normalizeQuery, normalizeSearchQuery } from "../src/lib/queryNormalize";

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
  aliases: string[];
  sourceQueries: string[];
  hash: string;
}

export function buildSearchQueryFamily(query: string, artist?: string): SearchQueryFamily {
  const canonicalQuery = normalizeSearchFamilyQuery(query);
  const normalizedArtist = normalizeOptionalText(artist);
  const normalizedQuery = canonicalQuery ? normalizeSearchQuery(canonicalQuery) : normalizeQuery(query);
  const aliases = buildFamilyAliases(canonicalQuery, normalizedArtist);
  const sourceQueries = buildSourceQueries(canonicalQuery, aliases, normalizedArtist);
  const hash = searchFamilyHash(canonicalQuery, normalizedArtist);

  return {
    canonicalQuery,
    normalizedQuery,
    ...(normalizedArtist ? { artist: normalizedArtist } : {}),
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

export function searchFamilyHash(canonicalQuery: string, artist?: string) {
  const input = `${normalizeQuery(canonicalQuery)}|${normalizeOptionalText(artist) ?? ""}`;
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

function buildFamilyAliases(canonicalQuery: string, artist?: string) {
  if (!canonicalQuery) {
    return [];
  }

  const aliases = [
    canonicalQuery,
    normalizeSearchQuery(canonicalQuery),
    `${canonicalQuery} karaoke`,
    `${canonicalQuery} \u4f34\u594f`,
    `${canonicalQuery} \u5361\u62c9OK`,
    `${canonicalQuery} pinyin karaoke`,
    `${canonicalQuery} instrumental`,
  ];

  if (artist) {
    aliases.push(
      `${artist} ${canonicalQuery} ktv`,
      `${artist} ${canonicalQuery} karaoke`,
      `${artist} karaoke`,
      `${artist} classic songs ktv`,
    );
  }

  return uniqueNormalized(aliases);
}

function buildSourceQueries(canonicalQuery: string, aliases: string[], artist?: string) {
  if (!canonicalQuery) {
    return [];
  }

  const broadQuery = joinAliasesForYouTube(aliases.filter((alias) => alias !== canonicalQuery));
  const fallbackQueries = artist
    ? [
        `${artist} ${canonicalQuery} ktv`,
        `${artist} karaoke`,
        normalizeSearchQuery(canonicalQuery),
      ]
    : [normalizeSearchQuery(canonicalQuery), `${canonicalQuery} karaoke`];

  return uniqueNormalized([broadQuery, ...fallbackQueries].filter(Boolean));
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
