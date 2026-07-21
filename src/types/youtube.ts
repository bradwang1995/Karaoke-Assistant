export type SearchType = "song" | "artist";

export interface VideoSearchResult {
  videoId: string;
  title: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  publishedAt?: string;
  score: number;
  reasons: string[];
}

export interface SearchResponse {
  query: string;
  normalizedQuery: string;
  searchType?: SearchType;
  includeOriginalVocal?: boolean;
  cached: boolean;
  results: VideoSearchResult[];
  cacheMeta?: {
    sourceQueryCount: number;
    cachedResultCount: number;
    servedFromExpandedCache: boolean;
    videosListCalls?: number;
    sourceQueries?: string[];
    quota?: {
      dailyLimit: number;
      used?: number;
      remainingBefore: number;
      remainingAfter: number;
      exhausted: boolean;
      resetAt?: string;
      resetTimeZone?: string;
      updatedAt?: string;
    };
    prunedResultCount?: number;
    responseSource?: "repository" | "external" | "mock";
    repositoryEntryId?: string;
  };
}

export interface YouTubeQuotaStatus {
  dailyLimit: number;
  used: number;
  remaining: number;
  exhausted: boolean;
  resetAt: string;
  resetTimeZone: "America/Los_Angeles";
  updatedAt: string;
  source?: "local_estimate";
  unit?: "search_calls";
}
