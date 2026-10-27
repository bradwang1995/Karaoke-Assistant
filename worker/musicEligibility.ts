import type { SearchResponse, SearchType, VideoSearchResult } from "../src/types/youtube";
import { SEARCH_RESULT_POLICY_VERSION } from "../src/lib/searchPolicyVersion";
import { containsQuery, normalizeRankingText, normalizeSongComparableText } from "./scoring";
import { normalizeSearchFamilyQuery } from "./searchFamily";

interface MusicQueryContext {
  searchType?: SearchType;
  artist?: string;
}

// Specific recording formats. KTV/live alone can also describe a venue or a news event.
const RECORDING_SIGNALS = /\b(mv|music\s+video|lyrics?|instrumental|karaoke|cover|acoustic|a\s*cappella|official\s+audio)\b|伴奏|歌词|翻唱|纯音乐|卡拉\s*ok|演唱会|现场演唱|合唱/iu;
const PERFORMANCE_HINTS = /\b(ktv|live|music|singing|song|concert|cover|karaoke|lyrics?|instrumental|mv)\b|伴奏|翻唱|歌词|卡拉\s*ok|演唱|唱歌|音乐|现场|舞台|演出|合唱/iu;
const VERSION_LABEL = /(?:\bktv\b|\blive\b|现场)[\s\p{P}]*$/iu;

export function musicEligibility(
  result: Pick<VideoSearchResult, "title" | "channelTitle" | "categoryId" | "tags">,
  query: string,
  options: MusicQueryContext = {},
) {
  const title = normalizeRankingText(result.title);
  const contentTitle = title.replace(/#[^\s#]+/gu, " ").trim();
  const canonicalQuery = normalizeRankingText(normalizeSearchFamilyQuery(query));
  const songIdentity = options.searchType !== "artist" && hasSongIdentity(contentTitle, canonicalQuery);
  const strongTitleMusic = RECORDING_SIGNALS.test(contentTitle) ||
    (VERSION_LABEL.test(contentTitle) && (songIdentity || hasRecordingStructure(contentTitle)));
  const music = result.categoryId === "10" || strongTitleMusic;
  const hints = PERFORMANCE_HINTS.test(normalizeRankingText(
    `${result.title} ${result.channelTitle ?? ""} ${result.tags?.join(" ") ?? ""}`,
  ));
  const knownNonMusic = Boolean(result.categoryId && /^\d+$/.test(result.categoryId) && result.categoryId !== "10");
  const artistIdentity = options.searchType === "artist" && Boolean(canonicalQuery) && (
    containsQuery(contentTitle, canonicalQuery) ||
    containsQuery(normalizeRankingText(result.channelTitle ?? ""), canonicalQuery)
  );

  return {
    // Unknown metadata or plausible performances remain searchable, regardless of vocal intent.
    searchEligible: !knownNonMusic || music || songIdentity || hints,
    recommendationEligible: music && (songIdentity || artistIdentity),
  };
}

export function filterSearchResultsForDisplay(response: SearchResponse): SearchResponse {
  const results = response.results.filter((result) => musicEligibility(result, response.query, response).searchEligible);
  return {
    ...response,
    results,
    cacheMeta: {
      ...response.cacheMeta,
      sourceQueryCount: response.cacheMeta?.sourceQueryCount ?? 0,
      cachedResultCount: response.cacheMeta?.cachedResultCount ?? response.results.length,
      servedFromExpandedCache: response.cacheMeta?.servedFromExpandedCache ?? false,
      resultPolicyVersion: SEARCH_RESULT_POLICY_VERSION,
      candidateResultCount: response.results.length,
      filteredResultCount: results.length,
      hiddenNonMusicResultCount: response.results.length - results.length,
    },
  };
}

export function isSelfContainedMusicRecording(title: string) {
  const content = normalizeRankingText(title).replace(/#[^\s#]+/gu, " ").trim();
  return hasRecordingStructure(content) && (RECORDING_SIGNALS.test(content) || VERSION_LABEL.test(content));
}

function hasSongIdentity(title: string, query: string) {
  if (!query) return false;
  const comparableQuery = musicComparableText(query);
  const comparableTitle = musicComparableText(title);
  if (comparableTitle === comparableQuery) return true;
  if (title.split(/[|/\[\]{}()<>《》〈〉【】「」『』:：–—-]+/u)
    .some((segment) => musicComparableText(segment) === comparableQuery)) return true;
  // The query is a title at the start, not merely a substring in a lyric or sentence.
  return comparableTitle.startsWith(`${comparableQuery} `) ||
    (title.startsWith(query) && containsQuery(title, query) &&
      /^(?:\s|[\p{P}]|ktv\b|mv\b|伴奏|翻唱|歌词|现场|卡拉)/iu.test(title.slice(query.length)));
}

function musicComparableText(value: string) {
  const withoutFormat = value.replace(/\b(?:official\s+)?music\s+video\b/giu, " ").trim();
  return normalizeSongComparableText(withoutFormat || value);
}

function hasRecordingStructure(title: string) {
  return /\S\s+[-–—]\s+\S/u.test(title) || /[《【「『][^》】」』]+[》】」』]/u.test(title);
}
