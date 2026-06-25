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
      remainingBefore: number;
      remainingAfter: number;
      exhausted: boolean;
    };
    prunedResultCount?: number;
  };
}
