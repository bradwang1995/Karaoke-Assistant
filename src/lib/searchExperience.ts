import { interpolate, type Translator } from "../i18n/messages";
import type { SearchResponse } from "../types/youtube";
import { formatRelativeQuotaReset } from "./quotaReset";
import { SEARCH_RESULT_POLICY_VERSION } from "./searchPolicyVersion";

export function isCurrentSearchResponse(response: SearchResponse) {
  return response.cacheMeta?.resultPolicyVersion === SEARCH_RESULT_POLICY_VERSION ||
    response.cacheMeta?.queryMode === "youtube-url";
}

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

export function searchPartialMessage(response: SearchResponse, t: Translator = interpolate) {
  if (response.cacheMeta?.quota?.exhausted) {
    return t("今日搜索额度已用完，{0}；当前结果已保留。", [quotaResetMessage(response.cacheMeta.quota.resetAt, t)]);
  }

  if (response.cacheMeta?.throttled) {
    return t("搜索太频繁，已保留当前结果，请稍等一下再试。");
  }

  if (response.cacheMeta?.providerRateLimited) {
    return response.results.length > 0
      ? t("YouTube 暂时限流，已返回当前找到的结果。")
      : t("YouTube 暂时限流，已保留当前结果。");
  }

  return response.results.length > 0
    ? t("已在 2 秒内返回当前找到的结果。")
    : t("搜索已在 2 秒停止，已保留当前结果。");
}

export function quotaResetMessage(resetAt?: string, t: Translator = interpolate) {
  return resetAt ? formatRelativeQuotaReset(resetAt, Date.now(), t) : t("本地重置时间暂不可用");
}
