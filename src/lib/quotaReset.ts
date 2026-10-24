import { interpolate, type Translator } from "../i18n/messages";

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

export function formatRelativeQuotaReset(resetAt: string, now = Date.now(), t: Translator = interpolate) {
  const resetTime = Date.parse(resetAt);
  if (!Number.isFinite(resetTime)) return t("本地重置时间暂不可用");
  const remainingMilliseconds = resetTime - now;
  if (remainingMilliseconds <= 0) return t("本地重置即将开始");
  const remainingHours = Math.ceil(remainingMilliseconds / MILLISECONDS_PER_HOUR);
  return t("本地重置还有 {0} 小时", [remainingHours]);
}
