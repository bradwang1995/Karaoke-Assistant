const YOUTUBE_SEARCH_QUOTA_VERSION = "v1";
const QUOTA_STATE_TTL_SECONDS = 60 * 60 * 24 * 3;

interface JsonKvNamespace {
  get<T>(key: string, options: { type: "json" }): Promise<T | null>;
  put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void>;
}

interface YouTubeSearchQuotaState {
  date: string;
  used: number;
  limit: number;
  updatedAt: string;
}

export function youtubeSearchQuotaKey(date = formatUtcDate(new Date())) {
  return `yt-search-quota:${YOUTUBE_SEARCH_QUOTA_VERSION}:${date}`;
}

export async function getAvailableYouTubeSearchCalls(
  namespace: JsonKvNamespace | undefined,
  dailyLimit: number,
  now = new Date(),
) {
  if (!namespace) {
    return dailyLimit;
  }

  const state = await readQuotaState(namespace, dailyLimit, now);
  return Math.max(dailyLimit - state.used, 0);
}

export async function recordYouTubeSearchCalls(
  namespace: JsonKvNamespace | undefined,
  count: number,
  dailyLimit: number,
  now = new Date(),
) {
  if (!namespace || count <= 0) {
    return null;
  }

  const state = await readQuotaState(namespace, dailyLimit, now);
  const nextState: YouTubeSearchQuotaState = {
    date: state.date,
    used: Math.min(state.used + count, dailyLimit),
    limit: dailyLimit,
    updatedAt: now.toISOString(),
  };

  await namespace.put(youtubeSearchQuotaKey(nextState.date), JSON.stringify(nextState), {
    expirationTtl: QUOTA_STATE_TTL_SECONDS,
  });

  return nextState;
}

async function readQuotaState(
  namespace: JsonKvNamespace,
  dailyLimit: number,
  now: Date,
): Promise<YouTubeSearchQuotaState> {
  const date = formatUtcDate(now);
  const state = await namespace.get<YouTubeSearchQuotaState>(youtubeSearchQuotaKey(date), {
    type: "json",
  });

  if (!state || state.date !== date || typeof state.used !== "number") {
    return {
      date,
      used: 0,
      limit: dailyLimit,
      updatedAt: now.toISOString(),
    };
  }

  return {
    date,
    used: Math.max(Math.floor(state.used), 0),
    limit: dailyLimit,
    updatedAt: state.updatedAt,
  };
}

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
