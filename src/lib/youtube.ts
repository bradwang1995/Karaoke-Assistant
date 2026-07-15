export const MOBILE_PREVIEW_START_SECONDS = 30;

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
    controls: "0",
    disablekb: "1",
    fs: "0",
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
