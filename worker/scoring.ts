import type { VideoSearchResult } from "../src/types/youtube";
import type { SearchType } from "../src/types/youtube";
import { normalizeQuery } from "../src/lib/queryNormalize";
import { normalizeSearchFamilyQuery } from "./searchFamily";
import { Converter } from "opencc-js/t2cn";

// Comparison only: keep displayed titles, provider queries and cache identities intact.
const toSimplified = Converter({ from: "t", to: "cn" });
const RELEVANCE_TIER_SCORE = 1_000;
const MUSIC_TITLE_SIGNALS = /\b(karaoke|instrumental|lyrics?|mv|audio|cover|live)\b|(?:\bktv\b|卡拉\s*ok)[\s\p{P}]*$|伴奏|歌词|翻唱|现场|原唱|演唱|纯音乐/iu;

const EXACT_TITLE_MATCH_SCORE = 60;
const TITLE_PREFIX_MATCH_SCORE = 48;
const TITLE_CONTAINS_QUERY_SCORE = 40;
const TITLE_TOKEN_MATCH_SCORE = 24;
const CHANNEL_ONLY_QUERY_SCORE = 2;
const TITLE_MISS_PENALTY = -72;

interface SearchScoringOptions {
  searchType?: SearchType;
  includeOriginalVocal?: boolean;
  artist?: string;
}

const KTV_PRIMARY_SIGNALS = [
  { text: "ktv", score: 30, reason: "title contains KTV" },
  { text: "卡拉ok", score: 30, reason: "title contains 卡拉OK" },
  { text: "karaoke", score: 24, reason: "title contains karaoke" },
];

const ACCOMPANIMENT_SIGNALS = [
  { text: "伴奏", score: 20, reason: "title contains 伴奏" },
  { text: "instrumental", score: 16, reason: "title contains instrumental" },
  { text: "字幕", score: 8, reason: "title contains 字幕" },
  { text: "pinyin", score: 3, reason: "title contains pinyin" },
];

const LYRICS_VIDEO_SIGNALS = [
  { text: "lyric video", score: 18, reason: "title contains lyric video" },
  { text: "lyrics", score: 14, reason: "title contains lyrics" },
  { text: "lyric", score: 12, reason: "title contains lyric" },
  { text: "歌词", score: 14, reason: "title contains 歌词" },
];

const ORIGINAL_VOCAL_INTENT_SIGNALS = [
  { text: "original", score: 34, reason: "title contains original vocal marker" },
  { text: "原唱", score: 38, reason: "title contains 原唱" },
  { text: "mv", score: 24, reason: "title contains MV" },
  { text: "official", score: 20, reason: "title contains official" },
  { text: "audio", score: 16, reason: "title contains audio" },
  { text: "radio", score: 12, reason: "title contains radio" },
];

const ORIGINAL_VOCAL_EXCLUSION_SIGNALS = [
  { text: "original", score: -42, reason: "original-vocal result deprioritized" },
  { text: "原唱", score: -48, reason: "original-vocal result deprioritized" },
  { text: "mv", score: -28, reason: "official MV deprioritized for karaoke intent" },
  { text: "official", score: -24, reason: "official video deprioritized for karaoke intent" },
];

const ORIGINAL_VOCAL_KARAOKE_PENALTIES = [
  { text: "ktv", score: -18, reason: "KTV result deprioritized for original vocals" },
  { text: "伴奏", score: -30, reason: "accompaniment conflicts with original-vocal intent" },
  { text: "instrumental", score: -28, reason: "instrumental conflicts with original-vocal intent" },
  { text: "karaoke", score: -14, reason: "karaoke-only result deprioritized for original vocals" },
  { text: "卡拉ok", score: -14, reason: "karaoke-only result deprioritized for original vocals" },
];

const NEGATIVE_SIGNALS = [
  { text: "live", score: -8, reason: "title contains live" },
  { text: "现场", score: -8, reason: "title contains 现场" },
  { text: "reaction", score: -8, reason: "title contains reaction" },
  { text: "cover", score: -6, reason: "title contains cover" },
  { text: "remix", score: -5, reason: "title contains remix" },
  { text: "tutorial", score: -5, reason: "title contains tutorial" },
  { text: "shorts", score: -5, reason: "title contains shorts" },
  { text: "教学", score: -5, reason: "title contains 教学" },
];

export function scoreSearchResult(
  result: Omit<VideoSearchResult, "score" | "reasons">,
  originalQuery: string,
  options: SearchScoringOptions = {},
): VideoSearchResult {
  const title = normalizeRankingText(result.title);
  const channelTitle = normalizeRankingText(result.channelTitle ?? "");
  const tags = normalizeRankingText(result.tags?.join(" ") ?? "");
  const haystack = `${title} ${channelTitle} ${tags}`;
  const reasons: string[] = [];
  let score = 0;

  const intentSignals = options.includeOriginalVocal
    ? [
        ...LYRICS_VIDEO_SIGNALS,
        ...ORIGINAL_VOCAL_INTENT_SIGNALS,
        ...ORIGINAL_VOCAL_KARAOKE_PENALTIES,
      ]
    : [
        ...KTV_PRIMARY_SIGNALS,
        ...ACCOMPANIMENT_SIGNALS,
        ...ORIGINAL_VOCAL_EXCLUSION_SIGNALS,
      ];

  for (const signal of intentSignals) {
    if (containsQuery(haystack, signal.text)) {
      score += signal.score;
      reasons.push(signal.reason);
    }
  }

  for (const signal of NEGATIVE_SIGNALS) {
    if (containsQuery(haystack, signal.text)) {
      score += signal.score;
      reasons.push(signal.reason);
    }
  }

  // Intent is a preference within relevance tiers, never a substitute for relevance.
  score = Math.max(-40, Math.min(60, score));
  const queryMatch =
    options.searchType === "artist"
      ? scoreArtistQueryMatch(title, channelTitle, tags, originalQuery)
      : scoreTitleQueryMatch(title, channelTitle, tags, originalQuery);

  if (queryMatch.score !== 0) {
    score += queryMatch.score;
    reasons.push(queryMatch.reason);
  }

  const tier = queryRelevanceTier(result, title, originalQuery, queryMatch.score, options);
  score += tier * RELEVANCE_TIER_SCORE;
  reasons.push(`query relevance tier ${tier}`);

  if (typeof result.durationSeconds === "number") {
    if (result.durationSeconds < 60) {
      score -= 10;
      reasons.push("video too short");
    }
    if (result.durationSeconds > 900) {
      score -= 5;
      reasons.push("video too long");
    }
  }

  return { ...result, score, reasons };
}

export function rankSearchResultsForQuery(
  results: Array<Omit<VideoSearchResult, "score" | "reasons"> | VideoSearchResult>,
  originalQuery: string,
  options: SearchScoringOptions = {},
): VideoSearchResult[] {
  return results
    .map((result, index) => ({
      result: scoreSearchResult(result, originalQuery, options),
      index,
    }))
    .sort((a, b) => b.result.score - a.result.score || a.index - b.index)
    .map(({ result }) => result);
}

function scoreArtistQueryMatch(
  title: string,
  channelTitle: string,
  tags: string,
  originalQuery: string,
) {
  const canonicalQuery = normalizeRankingText(normalizeSearchFamilyQuery(originalQuery));

  if (!canonicalQuery) {
    return { score: 0, reason: "" };
  }

  const comparableTitle = normalizeSongComparableText(title);
  const comparableChannel = normalizeSongComparableText(channelTitle);
  const comparableQuery = normalizeSongComparableText(canonicalQuery);
  let score = 0;
  const reasons: string[] = [];

  if (containsQuery(title, canonicalQuery) || containsQuery(comparableTitle, comparableQuery)) {
    score += 42;
    reasons.push("title contains artist query");
  }

  if (containsQuery(channelTitle, canonicalQuery) || containsQuery(comparableChannel, comparableQuery)) {
    score += 32;
    reasons.push("channel contains artist query");
  }

  if (containsQuery(tags, canonicalQuery)) {
    score += 16;
    reasons.push("tags contain artist query");
  }

  if (score > 0) {
    return { score, reason: reasons.join("; ") };
  }

  const queryTokens = canonicalQuery.split(" ").filter((token) => token.length > 1);
  const haystack = `${title} ${channelTitle}`;

  if (queryTokens.length > 1 && queryTokens.every((token) => containsQuery(haystack, token))) {
    return {
      score: 18,
      reason: "metadata contains artist query tokens",
    };
  }

  return {
    score: -18,
    reason: "metadata does not match artist query",
  };
}

function scoreTitleQueryMatch(
  title: string,
  channelTitle: string,
  tags: string,
  originalQuery: string,
) {
  const canonicalQuery = normalizeRankingText(normalizeSearchFamilyQuery(originalQuery));

  if (!canonicalQuery) {
    return { score: 0, reason: "" };
  }

  const comparableTitle = normalizeSongComparableText(title);
  const comparableQuery = normalizeSongComparableText(canonicalQuery);
  const hasLowPriorityMarker = hasLowPriorityTitleMarker(title);

  if (!comparableQuery) {
    return { score: 0, reason: "" };
  }

  if (title === canonicalQuery || comparableTitle === comparableQuery) {
    if (hasLowPriorityMarker) {
      return {
        score: 10,
        reason: "title contains song query with low-priority marker",
      };
    }

    return {
      score: EXACT_TITLE_MATCH_SCORE,
      reason: "title exactly matches song query",
    };
  }

  if (titleStartsWithQuery(title, canonicalQuery) || titleStartsWithQuery(comparableTitle, comparableQuery)) {
    if (hasLowPriorityMarker) {
      return {
        score: 10,
        reason: "title contains song query with low-priority marker",
      };
    }

    return {
      score: TITLE_PREFIX_MATCH_SCORE,
      reason: "title starts with song query",
    };
  }

  if (containsQuery(title, canonicalQuery) || containsQuery(comparableTitle, comparableQuery)) {
    if (hasLowPriorityMarker) {
      return {
        score: 10,
        reason: "title contains song query with low-priority marker",
      };
    }

    return {
      score: TITLE_CONTAINS_QUERY_SCORE,
      reason: "title contains song query",
    };
  }

  const queryTokens = canonicalQuery.split(" ").filter((token) => token.length > 1);

  if (queryTokens.length > 1 && queryTokens.every((token) => containsQuery(title, token))) {
    return {
      score: TITLE_TOKEN_MATCH_SCORE,
      reason: "title contains query tokens",
    };
  }

  if (containsQuery(channelTitle, canonicalQuery)) {
    return {
      score: CHANNEL_ONLY_QUERY_SCORE,
      reason: "channel contains query",
    };
  }

  if (containsQuery(tags, canonicalQuery)) {
    return {
      score: 8,
      reason: "tags contain query",
    };
  }

  return {
    score: TITLE_MISS_PENALTY,
    reason: "title does not match query",
  };
}

function titleStartsWithQuery(title: string, query: string) {
  return Boolean(query) && title.startsWith(query) && containsQuery(title, query);
}

export function normalizeRankingText(value: string) {
  return normalizeQuery(toSimplified(value.normalize("NFKC")));
}

export function containsQuery(text: string, query: string) {
  if (!query) return false;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = /^[a-z0-9]/i.test(query) ? "(?<![a-z0-9])" : "";
  const end = /[a-z0-9]$/i.test(query) ? "(?![a-z0-9])" : "";
  return new RegExp(`${start}${escaped}${end}`, "i").test(text);
}

function queryRelevanceTier(
  result: Omit<VideoSearchResult, "score" | "reasons">,
  title: string,
  query: string,
  matchScore: number,
  options: SearchScoringOptions,
) {
  if (matchScore <= 0) return 0;
  if (options.searchType === "artist") return 3;
  // Reactions/tutorials still have a title match, but remain below songs.
  if (matchScore === 10) return 2;
  if (matchScore < TITLE_TOKEN_MATCH_SCORE) return 1;

  // Hashtags describe/distribute a clip; they cannot establish its song identity.
  const contentTitle = title.replace(/#[^\s#]+/gu, " ").trim();
  const comparableQuery = normalizeSongComparableText(normalizeSearchFamilyQuery(query));
  const standaloneTitle = normalizeSongComparableText(contentTitle) === comparableQuery;
  const namedSong = contentTitle
    .split(/[|/\[\]{}()<>《》〈〉【】「」『』:：–—-]+/u)
    .some((segment) => normalizeSongComparableText(segment) === comparableQuery);
  // Category and version markers support a title match; neither is an inclusion gate.
  const titleMusicEvidence = MUSIC_TITLE_SIGNALS.test(contentTitle);
  if (standaloneTitle || namedSong || (matchScore === TITLE_PREFIX_MATCH_SCORE && titleMusicEvidence)) {
    return 4;
  }
  const musicEvidence = result.categoryId === "10" || titleMusicEvidence;
  return musicEvidence ? 3 : 2;
}

export function normalizeSongComparableText(value: string) {
  const normalized = normalizeRankingText(value);
  return normalized
    .replace(/&amp;/g, "&")
    .replace(/[()[\]{}<>]/g, " ")
    .replace(/[\u300a\u300b\u3008\u3009\u3010\u3011\uff08\uff09]/gu, " ")
    .replace(/[|/_-]+/g, " ")
    .replace(/\b(official|original|mv|hd|hq|ktv|karaoke|version|instrumental|pinyin|lyrics|lyric|cover|live|audio|radio)\b/gi, " ")
    .replace(/\u5361\u62c9\s*ok/giu, " ")
    .replace(/(\u4f34\u594f|\u5b57\u5e55|\u9ad8\u6e05|\u5b8c\u6574|\u5b98\u65b9|\u7eaf\u97f3\u4e50|原唱|歌词|翻唱|现场|\u7248)/gu, " ")
    .replace(/\s+/g, " ")
    .trim() || normalized;
}

function hasLowPriorityTitleMarker(title: string) {
  return /\b(reaction|tutorial|shorts)\b/i.test(title);
}
