import type {
  AdminStorageCapacitySource,
  AdminStorageError,
  AdminStorageHealth,
  AdminStorageResourceMetric,
  AdminStorageStatus,
  AdminStorageUsageSource,
} from "../src/types/admin";
import type { Env } from "./types";

const CLOUDFLARE_API_BASE_URL = "https://api.cloudflare.com/client/v4";
const CLOUDFLARE_GRAPHQL_URL = `${CLOUDFLARE_API_BASE_URL}/graphql`;
const DEFAULT_METRICS_TTL_SECONDS = 5 * 60;
const MIN_METRICS_TTL_SECONDS = 60;
const MAX_METRICS_TTL_SECONDS = 60 * 60;
const REFRESH_LEASE_SECONDS = 30;
const D1_MAX_STALE_MILLISECONDS = 24 * 60 * 60 * 1000;
const KV_MAX_STALE_MILLISECONDS = 72 * 60 * 60 * 1000;
const CRITICAL_STORAGE_PERCENTAGE = 90;
const REFRESH_LOCK_NAME = "cloudflare-storage-metrics";

export type StorageResource = "d1" | "kv";

export interface StoredStorageMetric {
  resource: StorageResource;
  usedBytes: number | null;
  keyCount: number | null;
  usageSource: AdminStorageUsageSource;
  measuredAt: string | null;
  lastSuccessfulAt: string | null;
  lastAttemptAt: string;
  lastError: AdminStorageError | null;
}

export interface ProviderStorageMetric {
  usedBytes: number;
  keyCount: number | null;
  usageSource: Exclude<AdminStorageUsageSource, "unavailable">;
  measuredAt: string;
}

export interface AdminStorageMetricStore {
  read(): Promise<StoredStorageMetric[]>;
  writeSuccess(
    resource: StorageResource,
    metric: ProviderStorageMetric,
    attemptedAt: string,
  ): Promise<void>;
  writeFailure(
    resource: StorageResource,
    error: AdminStorageError,
    attemptedAt: string,
  ): Promise<void>;
  acquireRefreshLease(leaseId: string, now: string, expiresAt: string): Promise<boolean>;
  releaseRefreshLease(leaseId: string): Promise<void>;
}

interface AdminStorageOptions {
  forceRefresh?: boolean;
  now?: Date;
  fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
  store?: AdminStorageMetricStore;
  repositoryEstimateBytes?: number | null;
}

interface CloudflareStorageConfig {
  accountId: string | null;
  apiToken: string | null;
  d1DatabaseId: string | null;
  d1DatabaseName: string;
  kvNamespaceId: string | null;
  kvNamespaceName: string;
  d1CapacityBytes: number | null;
  kvCapacityBytes: number | null;
  warningPercentage: number | null;
  ttlSeconds: number;
}

class StorageMetricProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function getAdminStorageStatus(
  db: D1Database,
  env: Env,
  options: AdminStorageOptions = {},
): Promise<AdminStorageStatus> {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const config = readCloudflareStorageConfig(env);
  const repositoryEstimate =
    "repositoryEstimateBytes" in options
      ? (options.repositoryEstimateBytes ?? null)
      : await readRepositoryEstimate(db);
  const store = options.store ?? new D1AdminStorageMetricStore(db);

  try {
    let states = await store.read();

    if (shouldRefresh(states, now, config.ttlSeconds, options.forceRefresh === true)) {
      const leaseId = crypto.randomUUID();
      const expiresAt = new Date(now.getTime() + REFRESH_LEASE_SECONDS * 1000).toISOString();
      const acquired = await store.acquireRefreshLease(leaseId, nowIso, expiresAt);

      if (acquired) {
        try {
          await refreshCloudflareMetrics(
            store,
            config,
            now,
            options.fetcher ?? fetch,
          );
        } finally {
          await store.releaseRefreshLease(leaseId).catch(() => undefined);
        }
        states = await store.read();
      }
    }

    return buildAdminStorageStatus(states, config, repositoryEstimate, now);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "admin-storage-cache-unavailable",
        error: error instanceof Error ? error.message.slice(0, 160) : "Unknown storage cache error",
      }),
    );
    return unavailableStorageStatus(
      config,
      repositoryEstimate,
      nowIso,
      safeError(
        "STORAGE_CACHE_UNAVAILABLE",
        "Cloudflare 指标缓存暂时不可用。",
      ),
    );
  }
}

async function refreshCloudflareMetrics(
  store: AdminStorageMetricStore,
  config: CloudflareStorageConfig,
  now: Date,
  fetcher: (input: string, init?: RequestInit) => Promise<Response>,
) {
  const attemptedAt = now.toISOString();

  await Promise.all(
    (["d1", "kv"] as const).map(async (resource) => {
      try {
        const metric =
          resource === "d1"
            ? await fetchD1StorageMetric(config, attemptedAt, fetcher)
            : await fetchKvStorageMetric(config, now, fetcher);
        await store.writeSuccess(resource, metric, attemptedAt);
      } catch (error) {
        const safe = toSafeProviderError(error);
        await store.writeFailure(resource, safe, attemptedAt);
        console.error(
          JSON.stringify({
            event: "cloudflare-storage-refresh-failed",
            resource,
            code: safe.code,
          }),
        );
      }
    }),
  );
}

async function fetchD1StorageMetric(
  config: CloudflareStorageConfig,
  measuredAt: string,
  fetcher: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<ProviderStorageMetric> {
  requireProviderConfiguration(config, "d1");
  const response = await fetcher(
    `${CLOUDFLARE_API_BASE_URL}/accounts/${encodeURIComponent(config.accountId!)}/d1/database/${encodeURIComponent(config.d1DatabaseId!)}`,
    {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${config.apiToken}`,
      },
      signal: AbortSignal.timeout(8_000),
    },
  );
  const body = await readProviderBody(response);
  const result = recordValue(body, "result");
  const fileSize = finiteNonNegativeNumber(result?.file_size);

  if (fileSize === null) {
    throw new StorageMetricProviderError(
      "PROVIDER_RESPONSE_INVALID",
      "Cloudflare D1 API 未返回可用的数据库体积。",
    );
  }

  return {
    usedBytes: fileSize,
    keyCount: null,
    usageSource: "cloudflare-d1-api",
    measuredAt,
  };
}

async function fetchKvStorageMetric(
  config: CloudflareStorageConfig,
  now: Date,
  fetcher: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<ProviderStorageMetric> {
  requireProviderConfiguration(config, "kv");
  const end = formatUtcDate(now);
  const startDate = new Date(now);
  startDate.setUTCDate(startDate.getUTCDate() - 3);
  const response = await fetcher(CLOUDFLARE_GRAPHQL_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.apiToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: `query AdminKvStorage(
        $accountTag: string!
        $namespaceId: string
        $start: Date
        $end: Date
      ) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            kvStorageAdaptiveGroups(
              filter: { date_geq: $start, date_leq: $end, namespaceId: $namespaceId }
              limit: 4
              orderBy: [date_DESC]
            ) {
              max {
                keyCount
                byteCount
              }
              dimensions {
                date
              }
            }
          }
        }
      }`,
      variables: {
        accountTag: config.accountId,
        namespaceId: config.kvNamespaceId,
        start: formatUtcDate(startDate),
        end,
      },
    }),
    signal: AbortSignal.timeout(8_000),
  });
  const body = await readProviderBody(response);

  if (Array.isArray(body.errors) && body.errors.length > 0) {
    throw new StorageMetricProviderError(
      "PROVIDER_RESPONSE_INVALID",
      "Cloudflare Analytics 暂时无法返回 KV 存储指标。",
    );
  }

  const data = recordValue(body, "data");
  const viewer = recordValue(data, "viewer");
  const accounts = Array.isArray(viewer?.accounts) ? viewer.accounts : [];
  const account = isRecord(accounts[0]) ? accounts[0] : null;
  const groups = Array.isArray(account?.kvStorageAdaptiveGroups)
    ? account.kvStorageAdaptiveGroups
    : [];
  const latest = isRecord(groups[0]) ? groups[0] : null;
  const max = recordValue(latest, "max");
  const dimensions = recordValue(latest, "dimensions");
  const usedBytes = finiteNonNegativeNumber(max?.byteCount);
  const keyCount = finiteNonNegativeNumber(max?.keyCount);
  const measuredDate = typeof dimensions?.date === "string" ? dimensions.date : null;

  if (usedBytes === null || keyCount === null || !measuredDate) {
    throw new StorageMetricProviderError(
      "PROVIDER_DATA_UNAVAILABLE",
      "Cloudflare Analytics 尚未提供该 KV 命名空间的存储快照。",
    );
  }

  return {
    usedBytes,
    keyCount,
    usageSource: "cloudflare-analytics",
    measuredAt: `${measuredDate}T00:00:00.000Z`,
  };
}

async function readProviderBody(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new StorageMetricProviderError(
        "PROVIDER_AUTH_FAILED",
        "Cloudflare 只读令牌无效或权限不足。",
      );
    }
    if (response.status === 429) {
      throw new StorageMetricProviderError(
        "PROVIDER_RATE_LIMITED",
        "Cloudflare 指标接口请求过于频繁，请稍后重试。",
      );
    }
    throw new StorageMetricProviderError(
      "PROVIDER_UNAVAILABLE",
      "Cloudflare 指标接口暂时不可用。",
    );
  }

  const body = await response.json().catch(() => null);
  if (!isRecord(body)) {
    throw new StorageMetricProviderError(
      "PROVIDER_RESPONSE_INVALID",
      "Cloudflare 指标接口返回了无法识别的数据。",
    );
  }
  return body;
}

function requireProviderConfiguration(config: CloudflareStorageConfig, resource: StorageResource) {
  const resourceId = resource === "d1" ? config.d1DatabaseId : config.kvNamespaceId;
  if (!config.accountId || !config.apiToken || !resourceId) {
    throw new StorageMetricProviderError(
      "CONFIGURATION_MISSING",
      "Cloudflare 只读指标配置尚未完成。",
    );
  }
}

function buildAdminStorageStatus(
  states: StoredStorageMetric[],
  config: CloudflareStorageConfig,
  repositoryEstimateBytes: number | null,
  now: Date,
): AdminStorageStatus {
  const d1State = states.find((state) => state.resource === "d1") ?? null;
  const kvState = states.find((state) => state.resource === "kv") ?? null;
  const d1 = toResourceMetric(
    "d1",
    d1State,
    config.d1DatabaseName,
    config.d1CapacityBytes,
    config.warningPercentage,
    now,
  ) as AdminStorageStatus["d1"];
  const kv = toResourceMetric(
    "kv",
    kvState,
    config.kvNamespaceName,
    config.kvCapacityBytes,
    config.warningPercentage,
    now,
  ) as AdminStorageStatus["kv"];

  return {
    updatedAt: now.toISOString(),
    stale: d1.stale || kv.stale,
    repositoryEstimate: {
      usedBytes: repositoryEstimateBytes,
      source: "application-estimate",
      authoritative: false,
    },
    d1,
    kv,
  };
}

function toResourceMetric(
  resource: StorageResource,
  state: StoredStorageMetric | null,
  name: string,
  capacityBytes: number | null,
  warningPercentage: number | null,
  now: Date,
): AdminStorageResourceMetric {
  const usedBytes = state?.usedBytes ?? null;
  const capacityPercentage =
    usedBytes !== null && capacityBytes !== null && capacityBytes > 0
      ? (usedBytes / capacityBytes) * 100
      : null;
  const maxStaleMilliseconds =
    resource === "d1" ? D1_MAX_STALE_MILLISECONDS : KV_MAX_STALE_MILLISECONDS;
  const successfulAt = state?.lastSuccessfulAt ? Date.parse(state.lastSuccessfulAt) : Number.NaN;
  const measuredAt = state?.measuredAt ? Date.parse(state.measuredAt) : Number.NaN;
  const expired =
    !Number.isFinite(successfulAt) ||
    now.getTime() - successfulAt > maxStaleMilliseconds ||
    !Number.isFinite(measuredAt) ||
    now.getTime() - measuredAt > maxStaleMilliseconds;
  const stale = usedBytes !== null && (expired || state?.lastError !== null);
  const error =
    state?.lastError ??
    (usedBytes !== null && expired
      ? safeError("METRIC_STALE", "Cloudflare 指标已超过可接受的新鲜度。")
      : null);

  return {
    resource,
    name,
    usedBytes,
    keyCount: resource === "kv" ? (state?.keyCount ?? null) : null,
    capacityBytes,
    capacityPercentage,
    usageSource: state?.usageSource ?? "unavailable",
    capacitySource: capacitySource(capacityBytes),
    usageAuthoritative: usedBytes !== null && state?.usageSource !== "unavailable",
    capacityAuthoritative: false,
    measuredAt: state?.measuredAt ?? null,
    lastSuccessfulAt: state?.lastSuccessfulAt ?? null,
    stale,
    health: storageHealth(usedBytes, capacityPercentage, warningPercentage, stale),
    error,
  };
}

function unavailableStorageStatus(
  config: CloudflareStorageConfig,
  repositoryEstimateBytes: number | null,
  updatedAt: string,
  error: AdminStorageError,
): AdminStorageStatus {
  const resource = (
    kind: StorageResource,
    name: string,
    capacityBytes: number | null,
  ): AdminStorageResourceMetric => ({
    resource: kind,
    name,
    usedBytes: null,
    keyCount: null,
    capacityBytes,
    capacityPercentage: null,
    usageSource: "unavailable",
    capacitySource: capacitySource(capacityBytes),
    usageAuthoritative: false,
    capacityAuthoritative: false,
    measuredAt: null,
    lastSuccessfulAt: null,
    stale: false,
    health: "unavailable",
    error,
  });

  return {
    updatedAt,
    stale: false,
    repositoryEstimate: {
      usedBytes: repositoryEstimateBytes,
      source: "application-estimate",
      authoritative: false,
    },
    d1: resource("d1", config.d1DatabaseName, config.d1CapacityBytes) as AdminStorageStatus["d1"],
    kv: resource("kv", config.kvNamespaceName, config.kvCapacityBytes) as AdminStorageStatus["kv"],
  };
}

function storageHealth(
  usedBytes: number | null,
  capacityPercentage: number | null,
  warningPercentage: number | null,
  stale: boolean,
): AdminStorageHealth {
  if (usedBytes === null) return "unavailable";
  if (stale) return "stale";
  if (capacityPercentage !== null && capacityPercentage >= CRITICAL_STORAGE_PERCENTAGE) {
    return "critical";
  }
  if (
    capacityPercentage !== null &&
    warningPercentage !== null &&
    capacityPercentage >= warningPercentage
  ) {
    return "warning";
  }
  return "healthy";
}

function shouldRefresh(
  states: StoredStorageMetric[],
  now: Date,
  ttlSeconds: number,
  forceRefresh: boolean,
) {
  if (forceRefresh || states.length < 2) return true;
  const cutoff = now.getTime() - ttlSeconds * 1000;
  return states.some((state) => {
    const attemptedAt = Date.parse(state.lastAttemptAt);
    return !Number.isFinite(attemptedAt) || attemptedAt < cutoff;
  });
}

function readCloudflareStorageConfig(env: Env): CloudflareStorageConfig {
  return {
    accountId: nonEmpty(env.CLOUDFLARE_ACCOUNT_ID),
    apiToken: nonEmpty(env.CLOUDFLARE_API_TOKEN),
    d1DatabaseId: nonEmpty(env.CLOUDFLARE_D1_DATABASE_ID),
    d1DatabaseName: nonEmpty(env.CLOUDFLARE_D1_DATABASE_NAME) ?? "DB",
    kvNamespaceId: nonEmpty(env.CLOUDFLARE_KV_NAMESPACE_ID),
    kvNamespaceName: nonEmpty(env.CLOUDFLARE_KV_NAMESPACE_NAME) ?? "SEARCH_CACHE",
    d1CapacityBytes: readPositiveNumber(
      env.D1_CAPACITY_LIMIT_BYTES ?? env.SEARCH_REPOSITORY_CAPACITY_BYTES,
    ),
    kvCapacityBytes: readPositiveNumber(env.KV_CAPACITY_LIMIT_BYTES),
    warningPercentage: readPercentage(env.SEARCH_REPOSITORY_WARNING_THRESHOLD_PERCENT),
    ttlSeconds: boundedInteger(
      env.CLOUDFLARE_STORAGE_METRICS_TTL_SECONDS,
      DEFAULT_METRICS_TTL_SECONDS,
      MIN_METRICS_TTL_SECONDS,
      MAX_METRICS_TTL_SECONDS,
    ),
  };
}

async function readRepositoryEstimate(db: D1Database): Promise<number | null> {
  try {
    const row = await db
      .prepare(
        `SELECT COALESCE(SUM(approx_bytes), 0) AS estimated_bytes
         FROM search_repository_entries`,
      )
      .first<Record<string, unknown>>();
    return finiteNonNegativeNumber(row?.estimated_bytes);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "repository-estimate-read-failed",
        error: error instanceof Error ? error.message.slice(0, 160) : "Unknown D1 error",
      }),
    );
    return null;
  }
}

class D1AdminStorageMetricStore implements AdminStorageMetricStore {
  constructor(private readonly db: D1Database) {}

  async read(): Promise<StoredStorageMetric[]> {
    const result = await this.db
      .prepare(
        `SELECT resource, used_bytes, key_count, usage_source, measured_at,
                last_success_at, last_attempt_at, last_error_code, last_error_message
         FROM admin_storage_metric_state
         ORDER BY resource ASC`,
      )
      .all<Record<string, unknown>>();
    const states: StoredStorageMetric[] = [];

    for (const row of result.results) {
      const resource = row.resource === "d1" || row.resource === "kv" ? row.resource : null;
      const lastAttemptAt = typeof row.last_attempt_at === "string" ? row.last_attempt_at : null;
      if (!resource || !lastAttemptAt) continue;

      states.push({
        resource,
        usedBytes: finiteNonNegativeNumber(row.used_bytes),
        keyCount: finiteNonNegativeNumber(row.key_count),
        usageSource: normalizeUsageSource(row.usage_source),
        measuredAt: typeof row.measured_at === "string" ? row.measured_at : null,
        lastSuccessfulAt:
          typeof row.last_success_at === "string" ? row.last_success_at : null,
        lastAttemptAt,
        lastError:
          typeof row.last_error_code === "string"
            ? safeError(
                row.last_error_code,
                typeof row.last_error_message === "string"
                  ? row.last_error_message
                  : "Cloudflare 指标暂时无法更新。",
              )
            : null,
      });
    }

    return states;
  }

  async writeSuccess(
    resource: StorageResource,
    metric: ProviderStorageMetric,
    attemptedAt: string,
  ) {
    await this.db
      .prepare(
        `INSERT INTO admin_storage_metric_state (
           resource, used_bytes, key_count, usage_source, measured_at,
           last_success_at, last_attempt_at, last_error_code, last_error_message, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, NULL, NULL, ?6)
         ON CONFLICT(resource) DO UPDATE SET
           used_bytes = excluded.used_bytes,
           key_count = excluded.key_count,
           usage_source = excluded.usage_source,
           measured_at = excluded.measured_at,
           last_success_at = excluded.last_success_at,
           last_attempt_at = excluded.last_attempt_at,
           last_error_code = NULL,
           last_error_message = NULL,
           updated_at = excluded.updated_at`,
      )
      .bind(
        resource,
        metric.usedBytes,
        metric.keyCount,
        metric.usageSource,
        metric.measuredAt,
        attemptedAt,
      )
      .run();
  }

  async writeFailure(
    resource: StorageResource,
    error: AdminStorageError,
    attemptedAt: string,
  ) {
    await this.db
      .prepare(
        `INSERT INTO admin_storage_metric_state (
           resource, used_bytes, key_count, usage_source, measured_at,
           last_success_at, last_attempt_at, last_error_code, last_error_message, updated_at
         ) VALUES (?1, NULL, NULL, 'unavailable', NULL, NULL, ?2, ?3, ?4, ?2)
         ON CONFLICT(resource) DO UPDATE SET
           last_attempt_at = excluded.last_attempt_at,
           last_error_code = excluded.last_error_code,
           last_error_message = excluded.last_error_message,
           updated_at = excluded.updated_at`,
      )
      .bind(resource, attemptedAt, error.code, error.message)
      .run();
  }

  async acquireRefreshLease(leaseId: string, now: string, expiresAt: string) {
    const result = await this.db
      .prepare(
        `INSERT INTO admin_storage_metric_refresh_locks (
           lock_name, lease_id, expires_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(lock_name) DO UPDATE SET
           lease_id = excluded.lease_id,
           expires_at = excluded.expires_at,
           updated_at = excluded.updated_at
         WHERE admin_storage_metric_refresh_locks.expires_at <= ?4`,
      )
      .bind(REFRESH_LOCK_NAME, leaseId, expiresAt, now)
      .run();
    return Number(result.meta.changes ?? 0) > 0;
  }

  async releaseRefreshLease(leaseId: string) {
    await this.db
      .prepare(
        `DELETE FROM admin_storage_metric_refresh_locks
         WHERE lock_name = ?1 AND lease_id = ?2`,
      )
      .bind(REFRESH_LOCK_NAME, leaseId)
      .run();
  }
}

function capacitySource(capacityBytes: number | null): AdminStorageCapacitySource {
  return capacityBytes === null ? "unavailable" : "operator-config";
}

function normalizeUsageSource(value: unknown): AdminStorageUsageSource {
  return value === "cloudflare-d1-api" || value === "cloudflare-analytics"
    ? value
    : "unavailable";
}

function toSafeProviderError(error: unknown) {
  if (error instanceof StorageMetricProviderError) {
    return safeError(error.code, error.message);
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return safeError("PROVIDER_TIMEOUT", "Cloudflare 指标接口响应超时。");
  }
  return safeError("PROVIDER_UNAVAILABLE", "Cloudflare 指标接口暂时不可用。");
}

function safeError(code: string, message: string): AdminStorageError {
  return {
    code: code.slice(0, 64),
    message: message.slice(0, 180),
  };
}

function recordValue(
  value: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  return value && isRecord(value[key]) ? value[key] : null;
}

function finiteNonNegativeNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function readPositiveNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function readPercentage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 100 ? parsed : null;
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

function nonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
