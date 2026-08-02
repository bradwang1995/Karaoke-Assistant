import { describe, expect, it } from "vitest";
import type { SearchResponse } from "../types/youtube";
import {
  quotaResetMessage,
  searchPartialMessage,
  shouldPreserveCurrentSearchResults,
} from "./searchExperience";

describe("search experience contracts", () => {
  it.each([
    { timedOut: true },
    { providerRateLimited: true },
    { throttled: true },
    { quota: { exhausted: true } },
  ])("preserves current cards for a recoverable empty response: %o", (cacheMeta) => {
    expect(shouldPreserveCurrentSearchResults(response([], cacheMeta))).toBe(true);
  });

  it("replaces current cards for a successful result or an ordinary empty result", () => {
    expect(shouldPreserveCurrentSearchResults(response(["result"], { timedOut: true }))).toBe(false);
    expect(shouldPreserveCurrentSearchResults(response([], {}))).toBe(false);
  });

  it("keeps quota exhaustion and provider failures explicit", () => {
    const quota = response([], {
      quota: {
        dailyLimit: 100,
        remainingBefore: 0,
        remainingAfter: 0,
        exhausted: true,
        resetAt: "2026-08-02T07:00:00.000Z",
      },
    });
    expect(searchPartialMessage(quota)).toContain("今日搜索额度已用完");
    expect(searchPartialMessage(response([], { providerRateLimited: true }))).toContain(
      "YouTube 暂时限流",
    );
    expect(quotaResetMessage()).toBe("本地重置时间暂不可用");
  });
});

function response(
  videoIds: string[],
  cacheMeta: TestCacheMeta,
): SearchResponse {
  const { quota, ...cacheMetaWithoutQuota } = cacheMeta;

  return {
    query: "测试",
    normalizedQuery: "测试 ktv",
    cached: false,
    results: videoIds.map((videoId) => ({
      videoId,
      title: `${videoId} KTV`,
      score: 1,
      reasons: [],
    })),
    cacheMeta: {
      sourceQueryCount: 0,
      cachedResultCount: videoIds.length,
      servedFromExpandedCache: false,
      ...cacheMetaWithoutQuota,
      ...(quota
        ? {
            quota: {
              dailyLimit: 100,
              remainingBefore: 0,
              remainingAfter: 0,
              exhausted: false,
              ...quota,
            },
          }
        : {}),
    },
  };
}

type SearchCacheMeta = NonNullable<SearchResponse["cacheMeta"]>;
type TestCacheMeta = Omit<Partial<SearchCacheMeta>, "quota"> & {
  quota?: Partial<NonNullable<SearchCacheMeta["quota"]>>;
};
