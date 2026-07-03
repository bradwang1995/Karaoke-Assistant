import type { VideoSearchResult } from "../src/types/youtube";
import type { SearchType } from "../src/types/youtube";
import { normalizeQuery } from "../src/lib/queryNormalize";
import { normalizeSearchFamilyQuery } from "./searchFamily";

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
  { text: "original", score: 10, reason: "title contains original vocal marker" },
  { text: "原唱", score: 10, reason: "title contains 原唱" },
  { text: "mv", score: 8, reason: "title contains MV" },
  { text: "official", score: 6, reason: "title contains official" },
];

const NEGATIVE_SIGNALS = [
  { text: "live", score: -8, reason: "title contains live" },
  { text: "\u73b0\u573a", score: -8, reason: "title contains live marker" },
  { text: "现场", score: -8, reason: "title contains 现场" },
  { text: "reaction", score: -8, reason: "title contains reaction" },
  { text: "cover", score: -6, reason: "title contains cover" },
  { text: "remix", score: -5, reason: "title contains remix" },
  { text: "tutorial", score: -5, reason: "title contains tutorial" },
  { text: "\u6559\u5b66", score: -5, reason: "title contains tutorial marker" },
  { text: "shorts", score: -5, reason: "title contains shorts" },
  { text: "教学", score: -5, reason: "title contains 教学" },
];

export function scoreSearchResult(
  result: Omit<VideoSearchResult, "score" | "reasons">,
  originalQuery: string,
  options: SearchScoringOptions = {},
): VideoSearchResult {
  const haystack = `${result.title} ${result.channelTitle ?? ""}`.toLowerCase();
  const title = normalizeQuery(result.title);
  const channelTitle = normalizeQuery(result.channelTitle ?? "");
  const reasons: string[] = [];
  let score = 0;

  for (const signal of [
    ...KTV_PRIMARY_SIGNALS,
    ...ACCOMPANIMENT_SIGNALS,
    ...LYRICS_VIDEO_SIGNALS,
    ...(options.includeOriginalVocal ? ORIGINAL_VOCAL_INTENT_SIGNALS : []),
  ]) {
    if (haystack.includes(signal.text)) {
      score += signal.score;
      reasons.push(signal.reason);
    }
  }

  for (const signal of NEGATIVE_SIGNALS) {
    if (haystack.includes(signal.text)) {
      score += signal.score;
      reasons.push(signal.reason);
    }
  }

  const queryMatch =
    options.searchType === "artist"
      ? scoreArtistQueryMatch(title, channelTitle, originalQuery)
      : scoreTitleQueryMatch(title, channelTitle, originalQuery);

  if (queryMatch.score !== 0) {
    score += queryMatch.score;
    reasons.push(queryMatch.reason);
  }

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

function scoreArtistQueryMatch(title: string, channelTitle: string, originalQuery: string) {
  const canonicalQuery = normalizeSearchFamilyQuery(originalQuery);

  if (!canonicalQuery) {
    return { score: 0, reason: "" };
  }

  const comparableTitle = normalizeSongComparableText(title);
  const comparableChannel = normalizeSongComparableText(channelTitle);
  const comparableQuery = normalizeSongComparableText(canonicalQuery);
  let score = 0;
  const reasons: string[] = [];

  if (title.includes(canonicalQuery) || comparableTitle.includes(comparableQuery)) {
    score += 42;
    reasons.push("title contains artist query");
  }

  if (channelTitle.includes(canonicalQuery) || comparableChannel.includes(comparableQuery)) {
    score += 32;
    reasons.push("channel contains artist query");
  }

  if (score > 0) {
    return { score, reason: reasons.join("; ") };
  }

  const queryTokens = canonicalQuery.split(" ").filter((token) => token.length > 1);
  const haystack = `${title} ${channelTitle}`;

  if (queryTokens.length > 1 && queryTokens.every((token) => haystack.includes(token))) {
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

function scoreTitleQueryMatch(title: string, channelTitle: string, originalQuery: string) {
  const canonicalQuery = normalizeSearchFamilyQuery(originalQuery);

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

  if (title.includes(canonicalQuery) || comparableTitle.includes(comparableQuery)) {
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

  if (queryTokens.length > 1 && queryTokens.every((token) => title.includes(token))) {
    return {
      score: TITLE_TOKEN_MATCH_SCORE,
      reason: "title contains query tokens",
    };
  }

  if (channelTitle.includes(canonicalQuery)) {
    return {
      score: CHANNEL_ONLY_QUERY_SCORE,
      reason: "channel contains query",
    };
  }

  return {
    score: TITLE_MISS_PENALTY,
    reason: "title does not match query",
  };
}

function titleStartsWithQuery(title: string, query: string) {
  return title === query || title.startsWith(`${query} `) || title.startsWith(query);
}

function normalizeSongComparableText(value: string) {
  return normalizeQuery(value)
    .replace(/&amp;/g, "&")
    .replace(/[()[\]{}<>]/g, " ")
    .replace(/[\u300a\u300b\u3008\u3009\u3010\u3011\uff08\uff09]/gu, " ")
    .replace(/[|/_-]+/g, " ")
    .replace(/\b(official|mv|hd|hq|ktv|karaoke|version|instrumental|pinyin|lyrics|lyric|cover|live|audio)\b/gi, " ")
    .replace(/\u5361\u62c9\s*ok/giu, " ")
    .replace(/(\u4f34\u594f|\u5b57\u5e55|\u9ad8\u6e05|\u5b8c\u6574|\u5b98\u65b9|\u7eaf\u97f3\u4e50|\u7248)/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasLowPriorityTitleMarker(title: string) {
  return /\b(live|cover|reaction|tutorial|shorts)\b/i.test(title);
}
