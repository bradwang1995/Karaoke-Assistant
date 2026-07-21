const YOUTUBE_SEARCH_QUOTA_VERSION = "v1";
const QUOTA_STATE_TTL_SECONDS = 60 * 60 * 24 * 3;
const YOUTUBE_QUOTA_RESET_TIME_ZONE = "America/Los_Angeles" as const;

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

export interface YouTubeSearchQuotaStatus {
  dailyLimit: number;
  used: number;
  remaining: number;
  exhausted: boolean;
  resetAt: string;
  resetTimeZone: typeof YOUTUBE_QUOTA_RESET_TIME_ZONE;
  updatedAt: string;
}

export function youtubeSearchQuotaKey(date = formatPacificDate(new Date())) {
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

export async function getYouTubeSearchQuotaStatus(
  namespace: JsonKvNamespace | undefined,
  dailyLimit: number,
  now = new Date(),
): Promise<YouTubeSearchQuotaStatus> {
  const state = namespace
    ? await readQuotaState(namespace, dailyLimit, now)
    : {
        date: formatPacificDate(now),
        used: 0,
        limit: dailyLimit,
        updatedAt: now.toISOString(),
      };
  return buildQuotaStatus(state, dailyLimit, now);
}

export async function getYouTubeSearchQuotaStatusForEnv(
  env: { DB?: D1Database; SEARCH_CACHE?: JsonKvNamespace },
  dailyLimit: number,
  now = new Date(),
) {
  if (env.DB) {
    try {
      const state = await readD1QuotaState(env.DB, dailyLimit, now);
      return buildQuotaStatus(state, dailyLimit, now);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "youtube-quota-d1-read-failed",
          error: error instanceof Error ? error.message : "Unknown D1 error",
        }),
      );
    }
  }

  return getYouTubeSearchQuotaStatus(env.SEARCH_CACHE, dailyLimit, now);
}

function buildQuotaStatus(
  state: YouTubeSearchQuotaState,
  dailyLimit: number,
  now: Date,
): YouTubeSearchQuotaStatus {
  const used = Math.min(Math.max(Math.floor(state.used), 0), dailyLimit);
  const remaining = Math.max(dailyLimit - used, 0);

  return {
    dailyLimit,
    used,
    remaining,
    exhausted: remaining <= 0,
    resetAt: getNextPacificMidnight(now).toISOString(),
    resetTimeZone: YOUTUBE_QUOTA_RESET_TIME_ZONE,
    updatedAt: state.updatedAt,
  };
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

  return buildQuotaStatus(nextState, dailyLimit, now);
}

export async function recordYouTubeSearchCallsForEnv(
  env: { DB?: D1Database; SEARCH_CACHE?: JsonKvNamespace },
  count: number,
  dailyLimit: number,
  now = new Date(),
) {
  if (count <= 0) {
    return getYouTubeSearchQuotaStatusForEnv(env, dailyLimit, now);
  }

  if (env.DB) {
    try {
      return await recordD1QuotaState(env.DB, count, dailyLimit, now);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "youtube-quota-d1-write-failed",
          error: error instanceof Error ? error.message : "Unknown D1 error",
        }),
      );
    }
  }

  return (
    (await recordYouTubeSearchCalls(env.SEARCH_CACHE, count, dailyLimit, now)) ??
    getYouTubeSearchQuotaStatus(env.SEARCH_CACHE, dailyLimit, now)
  );
}

async function readD1QuotaState(
  db: D1Database,
  dailyLimit: number,
  now: Date,
): Promise<YouTubeSearchQuotaState> {
  const date = formatPacificDate(now);
  const row = await db
    .prepare(
      `SELECT quota_date, used_search_calls, daily_limit, updated_at
       FROM youtube_quota_daily
       WHERE quota_date = ?1
       LIMIT 1`,
    )
    .bind(date)
    .first<{
      quota_date: string;
      used_search_calls: number;
      daily_limit: number;
      updated_at: string;
    }>();

  if (!row) {
    return {
      date,
      used: 0,
      limit: dailyLimit,
      updatedAt: now.toISOString(),
    };
  }

  return {
    date: row.quota_date,
    used: Math.max(Math.floor(row.used_search_calls), 0),
    limit: row.daily_limit,
    updatedAt: row.updated_at,
  };
}

async function recordD1QuotaState(
  db: D1Database,
  count: number,
  dailyLimit: number,
  now: Date,
) {
  const date = formatPacificDate(now);
  const updatedAt = now.toISOString();
  const session = db.withSession("first-primary");

  await session
    .prepare(
      `INSERT INTO youtube_quota_daily (
         quota_date, used_search_calls, daily_limit, updated_at
       ) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(quota_date)
       DO UPDATE SET
         used_search_calls = MIN(
           youtube_quota_daily.used_search_calls + excluded.used_search_calls,
           excluded.daily_limit
         ),
         daily_limit = excluded.daily_limit,
         updated_at = excluded.updated_at`,
    )
    .bind(date, Math.max(Math.floor(count), 0), dailyLimit, updatedAt)
    .run();

  const state = await session
    .prepare(
      `SELECT used_search_calls, updated_at
       FROM youtube_quota_daily
       WHERE quota_date = ?1
       LIMIT 1`,
    )
    .bind(date)
    .first<{ used_search_calls: number; updated_at: string }>();

  return buildQuotaStatus(
    {
      date,
      used: state?.used_search_calls ?? 0,
      limit: dailyLimit,
      updatedAt: state?.updated_at ?? updatedAt,
    },
    dailyLimit,
    now,
  );
}

async function readQuotaState(
  namespace: JsonKvNamespace,
  dailyLimit: number,
  now: Date,
): Promise<YouTubeSearchQuotaState> {
  const date = formatPacificDate(now);
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

function formatPacificDate(date: Date) {
  const parts = getTimeZoneDateParts(date, YOUTUBE_QUOTA_RESET_TIME_ZONE);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getNextPacificMidnight(date: Date) {
  const parts = getTimeZoneDateParts(date, YOUTUBE_QUOTA_RESET_TIME_ZONE);
  const nextLocalMidnightUtcMs = zonedLocalTimeToUtcMs(
    {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day) + 1,
      hour: 0,
      minute: 0,
      second: 0,
    },
    YOUTUBE_QUOTA_RESET_TIME_ZONE,
  );

  return new Date(nextLocalMidnightUtcMs);
}

function getTimeZoneDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: readPart(parts, "year"),
    month: readPart(parts, "month"),
    day: readPart(parts, "day"),
  };
}

function getTimeZoneDateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const hour = readPart(parts, "hour");

  return {
    year: Number(readPart(parts, "year")),
    month: Number(readPart(parts, "month")),
    day: Number(readPart(parts, "day")),
    hour: hour === "24" ? 0 : Number(hour),
    minute: Number(readPart(parts, "minute")),
    second: Number(readPart(parts, "second")),
  };
}

function zonedLocalTimeToUtcMs(
  localTime: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone: string,
) {
  const localAsUtcMs = Date.UTC(
    localTime.year,
    localTime.month - 1,
    localTime.day,
    localTime.hour,
    localTime.minute,
    localTime.second,
  );
  let utcMs = localAsUtcMs;

  for (let i = 0; i < 3; i += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
    const nextUtcMs = localAsUtcMs - offsetMs;

    if (Math.abs(nextUtcMs - utcMs) < 1) {
      return nextUtcMs;
    }

    utcMs = nextUtcMs;
  }

  return utcMs;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getTimeZoneDateTimeParts(date, timeZone);
  const localAsUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return localAsUtcMs - date.getTime();
}

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}
