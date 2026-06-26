export const DEFAULT_YOUTUBE_PLAYBACK_QUALITY = "hd1080";

export type YouTubePlaybackQuality =
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
  { value: "hd1080", label: "1080p" },
  { value: "hd720", label: "720p" },
  { value: "large", label: "480p" },
  { value: "medium", label: "360p" },
  { value: "small", label: "240p" },
  { value: "highres", label: "最高" },
];

const QUALITY_STORAGE_KEY = "ktv:display:youtube-playback-quality";
const VALID_QUALITIES = new Set<YouTubePlaybackQuality>(
  YOUTUBE_PLAYBACK_QUALITY_OPTIONS.map((option) => option.value),
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
