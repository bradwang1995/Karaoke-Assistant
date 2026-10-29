import type { YouTubePlayer } from "./youtubeIframeApi";

export const MOBILE_PREVIEW_START_SECONDS = 30;
export const MOBILE_PREVIEW_START_TOLERANCE_SECONDS = 1;

export function youtubeThumbnailUrl(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeEmbedUrl(
  videoId: string,
  options: {
    start?: number;
    muted?: boolean;
    autoplay?: boolean;
  } = {},
) {
  const params = new URLSearchParams({
    playsinline: "1",
    rel: "0",
    controls: "1",
    disablekb: "0",
    fs: "1",
    iv_load_policy: "3",
    start: String(options.start ?? 0),
  });

  if (options.muted) params.set("mute", "1");
  if (options.autoplay) params.set("autoplay", "1");
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export function youtubePreviewEmbedUrl(videoId: string) {
  return youtubeEmbedUrl(videoId, {
    start: MOBILE_PREVIEW_START_SECONDS,
    muted: true,
    autoplay: true,
  });
}

export function youtubePreviewPlayerVars(origin: string) {
  return {
    autoplay: 1,
    cc_load_policy: 1,
    controls: 1,
    disablekb: 0,
    enablejsapi: 1,
    fs: 1,
    iv_load_policy: 3,
    mute: 1,
    playsinline: 1,
    rel: 0,
    start: MOBILE_PREVIEW_START_SECONDS,
    origin,
  };
}

// Set restrictions before navigation: allow YouTube popups without allowing
// the cross-origin player to replace the KTV page. Link targets remain YouTube's.
export function createYouTubeIframe(videoId: string, playerVars: Record<string, string | number>) {
  const iframe = document.createElement("iframe");
  iframe.className = "h-full w-full";
  iframe.title = "YouTube video player";
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox");
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  const params = new URLSearchParams(
    Object.entries(playerVars).map(([key, value]) => [key, String(value)]),
  );
  iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params}`;
  return iframe;
}

export function hasYouTubePreviewReachedStart(player: YouTubePlayer) {
  const currentTime = player.getCurrentTime?.();

  return typeof currentTime === "number" &&
    Number.isFinite(currentTime) &&
    currentTime >= MOBILE_PREVIEW_START_SECONDS - MOBILE_PREVIEW_START_TOLERANCE_SECONDS;
}

export function enforceYouTubePreviewStart(player: YouTubePlayer) {
  player.mute?.();

  if (!hasYouTubePreviewReachedStart(player)) {
    player.seekTo?.(MOBILE_PREVIEW_START_SECONDS, true);
  }

  player.playVideo?.();
  return hasYouTubePreviewReachedStart(player);
}
