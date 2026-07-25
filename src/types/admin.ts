import type { SearchType, VideoSearchResult, YouTubeQuotaStatus } from "./youtube";

export type AdminRange = "24h" | "7d" | "30d";
export type AdminResponseSource = "repository" | "external" | "mock" | "error";
export type AdminStorageUsageSource =
  | "cloudflare-d1-api"
  | "cloudflare-analytics"
  | "unavailable";
export type AdminStorageCapacitySource = "operator-config" | "unavailable";
export type AdminStorageHealth =
  | "healthy"
  | "warning"
  | "critical"
  | "stale"
  | "unavailable";

export interface AdminStorageError {
  code: string;
  message: string;
}

export interface AdminStorageResourceMetric {
  resource: "d1" | "kv";
  name: string;
  usedBytes: number | null;
  keyCount: number | null;
  capacityBytes: number | null;
  capacityPercentage: number | null;
  usageSource: AdminStorageUsageSource;
  capacitySource: AdminStorageCapacitySource;
  usageAuthoritative: boolean;
  capacityAuthoritative: boolean;
  measuredAt: string | null;
  lastSuccessfulAt: string | null;
  stale: boolean;
  health: AdminStorageHealth;
  error: AdminStorageError | null;
}

export interface AdminStorageStatus {
  updatedAt: string;
  stale: boolean;
  repositoryEstimate: {
    usedBytes: number | null;
    source: "application-estimate";
    authoritative: false;
  };
  d1: AdminStorageResourceMetric & { resource: "d1" };
  kv: AdminStorageResourceMetric & { resource: "kv" };
}

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
    songQueries: number;
    artistQueries: number;
    uniqueSongs: number;
    uniqueArtists: number;
  };
  storage: AdminStorageStatus;
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

export type AdminCleanupUnavailableReason =
  | "capacity_unknown"
  | "measurement_unavailable"
  | "measurement_stale"
  | "policy_incomplete"
  | "policy_invalid"
  | "below_threshold"
  | "repository_empty";

export interface AdminCleanupCandidate {
  id: string;
  query: string;
  searchType: SearchType;
  accessCount: number;
  approxBytes: number;
  createdAt: string;
  lastAccessedAt: string;
}

export interface AdminCleanupHistoryItem {
  id: string;
  outcome: "success" | "failure";
  result: "success" | "partial" | "skipped" | "failure";
  affectedCount: number;
  message: string | null;
  createdAt: string;
}

export interface AdminCleanupPreview {
  configured: boolean;
  actionNeeded: boolean;
  unavailableReason: AdminCleanupUnavailableReason | null;
  capacityBytes: number | null;
  databaseBytes: number | null;
  capacityPercentage: number | null;
  usageSource: AdminStorageUsageSource;
  usageAuthoritative: boolean;
  capacitySource: AdminStorageCapacitySource;
  measuredAt: string | null;
  stale: boolean;
  thresholdPercentage: number | null;
  targetPercentage: number | null;
  batchSize: number;
  estimatedRepositoryBytes: number;
  estimatedBytesToRemove: number;
  candidates: AdminCleanupCandidate[];
  recentRuns: AdminCleanupHistoryItem[];
  policy: string;
  updatedAt: string;
}

export interface AdminCleanupResult {
  runId: string;
  outcome: "success" | "partial" | "skipped";
  deletedCount: number;
  deletedIds: string[];
  estimatedBytesRemoved: number;
  databaseBytesBefore: number | null;
  databaseBytesAfter: number | null;
  capacityPercentageBefore: number | null;
  capacityPercentageAfter: number | null;
  targetPercentage: number | null;
  targetReached: boolean | null;
  message: string;
  updatedAt: string;
}
