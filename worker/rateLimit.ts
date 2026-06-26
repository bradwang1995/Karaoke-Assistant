const RATE_LIMIT_VERSION = "v1";
const DEFAULT_WINDOW_SECONDS = 60;

interface JsonKvNamespace {
  get<T>(key: string, options: { type: "json" }): Promise<T | null>;
  put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void>;
}

interface RateLimitState {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  namespace: JsonKvNamespace | undefined;
  scope: string;
  identity: string;
  limit: number;
  now?: Date;
  windowSeconds?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit({
  namespace,
  scope,
  identity,
  limit,
  now = new Date(),
  windowSeconds = DEFAULT_WINDOW_SECONDS,
}: RateLimitOptions): Promise<RateLimitResult> {
  const safeLimit = Math.max(Math.floor(limit), 1);
  const resetAt = getWindowResetAt(now, windowSeconds);

  if (!namespace) {
    return {
      allowed: true,
      limit: safeLimit,
      remaining: safeLimit - 1,
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  const key = rateLimitKey(scope, identity, now, windowSeconds);
  const current = await namespace.get<RateLimitState>(key, { type: "json" });
  const count = current?.resetAt === resetAt && Number.isFinite(current.count) ? current.count : 0;
  const retryAfterSeconds = Math.max(Math.ceil((resetAt - now.getTime()) / 1000), 1);

  if (count >= safeLimit) {
    return {
      allowed: false,
      limit: safeLimit,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
    };
  }

  const nextCount = count + 1;
  await namespace.put(
    key,
    JSON.stringify({
      count: nextCount,
      resetAt,
    } satisfies RateLimitState),
    {
      expirationTtl: retryAfterSeconds + 30,
    },
  );

  return {
    allowed: true,
    limit: safeLimit,
    remaining: Math.max(safeLimit - nextCount, 0),
    resetAt,
    retryAfterSeconds: 0,
  };
}

export function rateLimitKey(
  scope: string,
  identity: string,
  now = new Date(),
  windowSeconds = DEFAULT_WINDOW_SECONDS,
) {
  const windowId = Math.floor(now.getTime() / (windowSeconds * 1000));
  return `rate-limit:${RATE_LIMIT_VERSION}:${normalizeKeyPart(scope)}:${hashText(identity)}:${windowId}`;
}

function getWindowResetAt(now: Date, windowSeconds: number) {
  const windowMs = windowSeconds * 1000;
  return (Math.floor(now.getTime() / windowMs) + 1) * windowMs;
}

function normalizeKeyPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9:-]+/g, "-").slice(0, 120);
}

function hashText(value: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
