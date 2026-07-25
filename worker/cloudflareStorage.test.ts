import { describe, expect, it, vi } from "vitest";
import type { AdminStorageError } from "../src/types/admin";
import {
  getAdminStorageStatus,
  type AdminStorageMetricStore,
  type ProviderStorageMetric,
  type StorageResource,
  type StoredStorageMetric,
} from "./cloudflareStorage";
import type { Env } from "./types";

const NOW = new Date("2026-07-25T12:00:00.000Z");

describe("Cloudflare admin storage metrics", () => {
  it("normalizes authoritative D1 and KV values without exposing provider identifiers", async () => {
    const store = new MemoryStorageMetricStore();
    const fetcher = successfulFetcher();
    const status = await getAdminStorageStatus({} as D1Database, configuredEnv(), {
      now: NOW,
      forceRefresh: true,
      fetcher,
      store,
      repositoryEstimateBytes: 321,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(status.d1).toMatchObject({
      name: "ktv-assistant-db",
      usedBytes: 197_000,
      usageSource: "cloudflare-d1-api",
      usageAuthoritative: true,
      capacityBytes: 1_000_000,
      capacitySource: "operator-config",
      capacityAuthoritative: false,
      stale: false,
    });
    expect(status.d1.capacityPercentage).toBeCloseTo(19.7);
    expect(status.kv).toMatchObject({
      name: "SEARCH_CACHE",
      usedBytes: 2_048,
      keyCount: 12,
      usageSource: "cloudflare-analytics",
      usageAuthoritative: true,
      capacityBytes: null,
      capacityPercentage: null,
      stale: false,
    });
    expect(status.repositoryEstimate).toEqual({
      usedBytes: 321,
      source: "application-estimate",
      authoritative: false,
    });
    expect(JSON.stringify(status)).not.toContain("account-123");
    expect(JSON.stringify(status)).not.toContain("secret-token");
  });

  it("keeps the last successful value and marks it stale after a provider failure", async () => {
    const store = new MemoryStorageMetricStore([
      storedMetric("d1", {
        usedBytes: 196_608,
        usageSource: "cloudflare-d1-api",
      }),
      storedMetric("kv", {
        usedBytes: 1_024,
        keyCount: 8,
        usageSource: "cloudflare-analytics",
      }),
    ]);
    const fetcher = vi.fn(async (url: string) =>
      url.includes("/d1/database/")
        ? new Response("unavailable", { status: 503 })
        : kvResponse(1_100, 9),
    );

    const status = await getAdminStorageStatus({} as D1Database, configuredEnv(), {
      now: NOW,
      forceRefresh: true,
      fetcher,
      store,
      repositoryEstimateBytes: 300,
    });

    expect(status.d1).toMatchObject({
      usedBytes: 196_608,
      stale: true,
      health: "stale",
      error: {
        code: "PROVIDER_UNAVAILABLE",
        message: "Cloudflare 指标接口暂时不可用。",
      },
    });
    expect(status.kv).toMatchObject({
      usedBytes: 1_100,
      keyCount: 9,
      stale: false,
    });
  });

  it("returns partial success and never fabricates a capacity percentage", async () => {
    const store = new MemoryStorageMetricStore();
    const env = configuredEnv();
    delete env.D1_CAPACITY_LIMIT_BYTES;
    const fetcher = vi.fn(async (url: string) =>
      url.includes("/d1/database/")
        ? d1Response(200_000)
        : new Response(JSON.stringify({ errors: [{ message: "denied" }] }), {
            status: 403,
            headers: { "content-type": "application/json" },
          }),
    );

    const status = await getAdminStorageStatus({} as D1Database, env, {
      now: NOW,
      forceRefresh: true,
      fetcher,
      store,
      repositoryEstimateBytes: 0,
    });

    expect(status.d1).toMatchObject({
      usedBytes: 200_000,
      capacityBytes: null,
      capacityPercentage: null,
      health: "healthy",
    });
    expect(status.kv).toMatchObject({
      usedBytes: null,
      keyCount: null,
      capacityPercentage: null,
      health: "unavailable",
      error: { code: "PROVIDER_AUTH_FAILED" },
    });
  });

  it("reuses the stored snapshot when another request owns the refresh lease", async () => {
    const store = new MemoryStorageMetricStore([
      storedMetric("d1", {
        usedBytes: 197_000,
        usageSource: "cloudflare-d1-api",
      }),
      storedMetric("kv", {
        usedBytes: 2_048,
        keyCount: 12,
        usageSource: "cloudflare-analytics",
      }),
    ]);
    store.allowLease = false;
    const fetcher = vi.fn();

    const status = await getAdminStorageStatus({} as D1Database, configuredEnv(), {
      now: NOW,
      forceRefresh: true,
      fetcher,
      store,
      repositoryEstimateBytes: 321,
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(status.d1.usedBytes).toBe(197_000);
    expect(status.kv.usedBytes).toBe(2_048);
  });
});

class MemoryStorageMetricStore implements AdminStorageMetricStore {
  readonly states = new Map<StorageResource, StoredStorageMetric>();
  allowLease = true;

  constructor(initial: StoredStorageMetric[] = []) {
    initial.forEach((state) => this.states.set(state.resource, state));
  }

  async read() {
    return [...this.states.values()].map((state) => ({ ...state }));
  }

  async writeSuccess(
    resource: StorageResource,
    metric: ProviderStorageMetric,
    attemptedAt: string,
  ) {
    this.states.set(resource, {
      resource,
      usedBytes: metric.usedBytes,
      keyCount: metric.keyCount,
      usageSource: metric.usageSource,
      measuredAt: metric.measuredAt,
      lastSuccessfulAt: attemptedAt,
      lastAttemptAt: attemptedAt,
      lastError: null,
    });
  }

  async writeFailure(
    resource: StorageResource,
    error: AdminStorageError,
    attemptedAt: string,
  ) {
    const current = this.states.get(resource);
    this.states.set(resource, {
      resource,
      usedBytes: current?.usedBytes ?? null,
      keyCount: current?.keyCount ?? null,
      usageSource: current?.usageSource ?? "unavailable",
      measuredAt: current?.measuredAt ?? null,
      lastSuccessfulAt: current?.lastSuccessfulAt ?? null,
      lastAttemptAt: attemptedAt,
      lastError: error,
    });
  }

  async acquireRefreshLease() {
    return this.allowLease;
  }

  async releaseRefreshLease() {}
}

function configuredEnv(): Env {
  return {
    CLOUDFLARE_ACCOUNT_ID: "account-123",
    CLOUDFLARE_API_TOKEN: "secret-token",
    CLOUDFLARE_D1_DATABASE_ID: "database-123",
    CLOUDFLARE_D1_DATABASE_NAME: "ktv-assistant-db",
    CLOUDFLARE_KV_NAMESPACE_ID: "namespace-123",
    CLOUDFLARE_KV_NAMESPACE_NAME: "SEARCH_CACHE",
    D1_CAPACITY_LIMIT_BYTES: "1000000",
    CLOUDFLARE_STORAGE_METRICS_TTL_SECONDS: "300",
  };
}

function successfulFetcher() {
  return vi.fn(async (url: string) =>
    url.includes("/d1/database/") ? d1Response(197_000) : kvResponse(2_048, 12),
  );
}

function d1Response(fileSize: number) {
  return Response.json({
    success: true,
    result: {
      name: "ktv-assistant-db",
      file_size: fileSize,
    },
  });
}

function kvResponse(byteCount: number, keyCount: number) {
  return Response.json({
    data: {
      viewer: {
        accounts: [
          {
            kvStorageAdaptiveGroups: [
              {
                max: { byteCount, keyCount },
                dimensions: { date: "2026-07-25" },
              },
            ],
          },
        ],
      },
    },
  });
}

function storedMetric(
  resource: StorageResource,
  values: {
    usedBytes: number;
    keyCount?: number;
    usageSource: StoredStorageMetric["usageSource"];
  },
): StoredStorageMetric {
  return {
    resource,
    usedBytes: values.usedBytes,
    keyCount: values.keyCount ?? null,
    usageSource: values.usageSource,
    measuredAt: "2026-07-25T00:00:00.000Z",
    lastSuccessfulAt: "2026-07-25T11:00:00.000Z",
    lastAttemptAt: "2026-07-25T11:00:00.000Z",
    lastError: null,
  };
}
