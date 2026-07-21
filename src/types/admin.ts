import type { SearchType, VideoSearchResult, YouTubeQuotaStatus } from "./youtube";

export type AdminRange = "24h" | "7d" | "30d";
export type AdminResponseSource = "repository" | "external" | "mock" | "error";

export interface AdminSessionStatus {
  authenticated: true;
  expiresAt: string;
}

export interface AdminOverviewTrendPoint {
  bucket: string;
  label: string;
  repositoryHits: number;
  externalRequests: number;
}

export interface AdminTopSearch {
  query: string;
  searchType: SearchType;
  count: number;
}

export interface AdminTopDimension {
  label: string;
  count: number;
}

export interface AdminOverview {
  range: AdminRange;
  quota: YouTubeQuotaStatus & {
    source: "local_estimate";
    unit: "search_calls";
  };
  repository: {
    totalQueries: number;
    totalResults: number;
    repositoryHits: number;
    estimatedRepositoryBytes: number;
    databaseBytes: number | null;
    capacityBytes: number | null;
      capacityPercentage: number | null;
      capacitySource: "configured" | "unknown";
      warningThresholdPercentage: number | null;
      storagePressure: boolean | null;
      songQueries: number;
      artistQueries: number;
      uniqueSongs: number;
      uniqueArtists: number;
    };
  searches: {
    total: number;
    repositoryHits: number;
    externalRequests: number;
    trend: AdminOverviewTrendPoint[];
    topSearches: AdminTopSearch[];
    topSongs: AdminTopDimension[];
    topArtists: AdminTopDimension[];
    originalPerformer: {
      included: number;
      excluded: number;
      unknown: number;
    };
  };
  collectionStartedAt: string | null;
  updatedAt: string;
}

export interface AdminSearchEventItem {
  id: string;
  query: string;
  artist: string | null;
  song: string | null;
  searchType: SearchType;
  originalPerformerStatus: "true" | "false" | "unknown";
  source: AdminResponseSource;
  resultCount: number;
  success: boolean;
  errorCode: string | null;
  createdAt: string;
}

export interface AdminSearchEventPage {
  items: AdminSearchEventItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  updatedAt: string;
}

export interface AdminRepositoryItem {
  id: string;
  query: string;
  normalizedQuery: string;
  artist: string | null;
  searchType: SearchType;
  includeOriginalVocal: boolean;
  resultCount: number;
  accessCount: number;
  approxBytes: number;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
  previewResults: VideoSearchResult[];
}

export interface AdminRepositoryPage {
  items: AdminRepositoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  updatedAt: string;
}

export interface AdminDeleteRepositoryResult {
  requestedCount: number;
  deletedCount: number;
  deletedIds: string[];
  updatedAt: string;
}
