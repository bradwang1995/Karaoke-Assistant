import type { SearchResponse, SearchType, VideoSearchResult } from "../src/types/youtube";
import { SEARCH_RESULT_POLICY_VERSION } from "../src/lib/searchPolicyVersion";
import { containsQuery, normalizeRankingText, normalizeSongComparableText } from "./scoring";
import { normalizeSearchFamilyQuery } from "./searchFamily";

interface MusicQueryContext {
  searchType?: SearchType;
  artist?: string;
}

// Specific recording formats. KTV/live alone can also describe a venue or a news event.
const RECORDING_SIGNALS = /\b(mv|music\s+video|lyrics?|instrumental|karaoke|cover|acoustic|a\s*cappella|official\s+audio)\b|伴奏|歌词|翻唱|纯音乐|卡拉\s*ok|演唱会|现场演唱|合唱|首唱|独唱|新歌|主题曲|插曲|之曲/iu;
const PERFORMANCE_HINTS = /\b(ktv|live|music|singing|song|concert|cover|karaoke|lyrics?|instrumental|mv)\b|伴奏|翻唱|歌词|卡拉\s*ok|演唱|唱歌|音乐|现场|舞台|演出|合唱/iu;
const VERSION_LABEL = /(?:\bktv\b|\blive\b|现场)(?:\s*版(?:本)?)?[\s\p{P}]*$/iu;
// A non-Music category is not proof of non-music content. Require positive context too.
const NON_MUSIC_CONTENT = /新闻|采访|专访|访谈|剧情|短剧|霸总|灰姑娘|警察|醉汉|砸桌|大闹|鬼故事|都市传说|冷知识|搞笑|恶搞|游戏攻略|游戏实况|射箭|婚礼|女儿奴|啼啼大哭|自曝|历史解说/u;

export function musicEligibility(
  result: Pick<VideoSearchResult, "title" | "channelTitle" | "categoryId" | "tags">,
  query: string,
  options: MusicQueryContext = {},
) {
  const title = normalizeRankingText(result.title);
  const contentTitle = title.replace(/#[^\s#]+/gu, " ").trim();
  const canonicalQuery = normalizeRankingText(normalizeSearchFamilyQuery(query));
  const songIdentity = options.searchType !== "artist" && hasSongIdentity(contentTitle, canonicalQuery);
  const relatedSongTitle = options.searchType !== "artist" && hasRelatedSongTitle(contentTitle, canonicalQuery);
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
    // Uncertain uploads remain searchable; exclusion needs affirmative non-music context.
    searchEligible: !knownNonMusic || !NON_MUSIC_CONTENT.test(contentTitle) || music || songIdentity || hints ||
      (artistIdentity && hasRecordingStructure(contentTitle)),
    recommendationEligible: music && (songIdentity || relatedSongTitle || artistIdentity),
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

function hasRelatedSongTitle(title: string, query: string) {
  if (!query) return false;
  // These quotes conventionally introduce a lyric excerpt, not the recording's title.
  const recordingTitle = title.split(/[『「]/u)[0];
  const comparableQuery = musicComparableText(query);
  // Partial matching is safe in an explicitly named song, including a suffix of its name.
  if ([...recordingTitle.matchAll(/[《〈\[]([^》〉\]]+)[》〉\]]/gu)]
    .some((match) => containsQuery(musicComparableText(match[1]), comparableQuery))) return true;

  // Artist-title separators and title/version tokens support partial song names. Do not
  // search the quoted lyrics or treat arbitrary Chinese substrings in sentences as names.
  return recordingTitle.split(/[|/\[\]{}()<>《》〈〉【】:：–—-]+/u).some((segment) => {
    const comparable = musicComparableText(segment);
    return (comparable.startsWith(comparableQuery) && containsQuery(comparable, comparableQuery)) ||
      ((RECORDING_SIGNALS.test(recordingTitle) || VERSION_LABEL.test(recordingTitle)) &&
        comparable.split(/\s+/u).some((token) => token.startsWith(comparableQuery) && containsQuery(token, comparableQuery)));
  });
}

function hasRecordingStructure(title: string) {
  return /\S\s+[-–—]\s+\S/u.test(title) || /[《【「『][^》】」』]+[》】」』]/u.test(title);
}
