import type { SearchResponse } from "../types/youtube";
import { formatRelativeQuotaReset } from "./quotaReset";

export function shouldPreserveCurrentSearchResults(response: SearchResponse) {
  return (
    response.results.length === 0 &&
    Boolean(
      response.cacheMeta?.timedOut ||
        response.cacheMeta?.providerRateLimited ||
        response.cacheMeta?.throttled ||
        response.cacheMeta?.quota?.exhausted,
    )
  );
}

export function searchPartialMessage(response: SearchResponse) {
  if (response.cacheMeta?.quota?.exhausted) {
    return `今日搜索额度已用完，${quotaResetMessage(response.cacheMeta.quota.resetAt)}；当前结果已保留。`;
  }

  if (response.cacheMeta?.throttled) {
    return "搜索太频繁，已保留当前结果，请稍等一下再试。";
  }

  if (response.cacheMeta?.providerRateLimited) {
    return response.results.length > 0
      ? "YouTube 暂时限流，已返回当前找到的结果。"
      : "YouTube 暂时限流，已保留当前结果。";
  }

  return response.results.length > 0
    ? "已在 2 秒内返回当前找到的结果。"
    : "搜索已在 2 秒停止，已保留当前结果。";
}

export function quotaResetMessage(resetAt?: string) {
  return resetAt ? formatRelativeQuotaReset(resetAt) : "本地重置时间暂不可用";
}
