export const DEFAULT_YOUTUBE_PLAYBACK_QUALITY = "hd1080";
export const PREVIEW_YOUTUBE_PLAYBACK_QUALITY = "large";

export type YouTubePlaybackQuality =
  | "tiny"
  | "small"
  | "medium"
  | "large"
  | "hd720"
  | "hd1080"
  | "highres";

export const YOUTUBE_PLAYBACK_QUALITY_OPTIONS: Array<{
  value: YouTubePlaybackQuality;
  label: string;
}> = [
  { value: "highres", label: "4K" },
  { value: "hd1080", label: "1080p" },
  { value: "hd720", label: "720p" },
  { value: "large", label: "480p" },
  { value: "medium", label: "360p" },
  { value: "small", label: "240p" },
  { value: "tiny", label: "144p" },
];

const QUALITY_STORAGE_KEY = "ktv:display:youtube-playback-quality";
const VALID_QUALITIES = new Set<YouTubePlaybackQuality>(
  YOUTUBE_PLAYBACK_QUALITY_OPTIONS.map((option) => option.value),
);
const QUALITY_RANK = new Map<YouTubePlaybackQuality, number>(
  YOUTUBE_PLAYBACK_QUALITY_OPTIONS.map((option, index, options) => [
    option.value,
    options.length - index,
  ]),
);

interface QualityStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export function isYouTubePlaybackQuality(value: unknown): value is YouTubePlaybackQuality {
  return typeof value === "string" && VALID_QUALITIES.has(value as YouTubePlaybackQuality);
}

export function resolveYouTubePlaybackQuality(value: unknown): YouTubePlaybackQuality {
  return isYouTubePlaybackQuality(value) ? value : DEFAULT_YOUTUBE_PLAYBACK_QUALITY;
}

export function readPreferredYouTubePlaybackQuality(
  storage = getBrowserQualityStorage(),
): YouTubePlaybackQuality {
  if (!storage) {
    return DEFAULT_YOUTUBE_PLAYBACK_QUALITY;
  }

  try {
    return resolveYouTubePlaybackQuality(storage.getItem(QUALITY_STORAGE_KEY));
  } catch {
    return DEFAULT_YOUTUBE_PLAYBACK_QUALITY;
  }
}

export function savePreferredYouTubePlaybackQuality(
  quality: YouTubePlaybackQuality,
  storage = getBrowserQualityStorage(),
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(QUALITY_STORAGE_KEY, quality);
  } catch {
    // Storage can be unavailable in some private browsing modes.
  }
}

export function normalizeAvailableYouTubePlaybackQualities(
  qualities: unknown,
): YouTubePlaybackQuality[] {
  if (!Array.isArray(qualities)) {
    return [];
  }

  const seen = new Set<YouTubePlaybackQuality>();

  for (const quality of qualities) {
    if (isYouTubePlaybackQuality(quality)) {
      seen.add(quality);
    }
  }

  return [...seen].sort((a, b) => qualityRank(b) - qualityRank(a));
}

export function getAvailablePlaybackQualityOptions(
  availableQualities: YouTubePlaybackQuality[],
  fallbackQuality: YouTubePlaybackQuality = DEFAULT_YOUTUBE_PLAYBACK_QUALITY,
) {
  const normalizedQualities = normalizeAvailableYouTubePlaybackQualities(availableQualities);
  const optionValues =
    normalizedQualities.length > 0
      ? normalizedQualities
      : [resolveYouTubePlaybackQuality(fallbackQuality)];

  return optionValues.map((quality) => ({
    value: quality,
    label: getYouTubePlaybackQualityLabel(quality),
  }));
}

export function getClosestAvailablePlaybackQuality(
  preferredQuality: YouTubePlaybackQuality,
  availableQualities: YouTubePlaybackQuality[],
) {
  const normalizedQualities = normalizeAvailableYouTubePlaybackQualities(availableQualities);

  if (normalizedQualities.length === 0 || normalizedQualities.includes(preferredQuality)) {
    return preferredQuality;
  }

  const preferredRank = qualityRank(preferredQuality);
  const closestLowerOrEqual = normalizedQualities.find(
    (quality) => qualityRank(quality) <= preferredRank,
  );

  return closestLowerOrEqual ?? normalizedQualities[normalizedQualities.length - 1];
}

export function getYouTubePlaybackQualityLabel(quality: YouTubePlaybackQuality) {
  return (
    YOUTUBE_PLAYBACK_QUALITY_OPTIONS.find((option) => option.value === quality)?.label ?? quality
  );
}

function qualityRank(quality: YouTubePlaybackQuality) {
  return QUALITY_RANK.get(quality) ?? 0;
}

function getBrowserQualityStorage(): QualityStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
