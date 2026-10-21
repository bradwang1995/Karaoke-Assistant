export type SearchQueryClassification =
  | { kind: "text" }
  | { kind: "youtube-video-url"; videoId: string }
  | { kind: "blocked-url" };

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const EXPLICIT_URL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//i;
const URL_WITHOUT_SCHEME_PATTERN =
  /^(?:www\.)?(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?:[/:?#]|$)/i;

export function classifySearchQuery(query: string): SearchQueryClassification {
  const value = query.trim();

  if (
    !EXPLICIT_URL_SCHEME_PATTERN.test(value) &&
    !URL_WITHOUT_SCHEME_PATTERN.test(value)
  ) {
    return { kind: "text" };
  }

  const candidate = EXPLICIT_URL_SCHEME_PATTERN.test(value)
    ? value
    : `https://${value}`;
  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    return { kind: "text" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { kind: "blocked-url" };
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const isYouTubeHost =
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "youtu.be" ||
    hostname === "youtube-nocookie.com" ||
    hostname.endsWith(".youtube-nocookie.com");

  if (!isYouTubeHost) {
    return { kind: "blocked-url" };
  }

  const videoId = extractYouTubeVideoId(url, hostname);

  return videoId
    ? { kind: "youtube-video-url", videoId }
    : { kind: "blocked-url" };
}

function extractYouTubeVideoId(url: URL, hostname: string) {
  if (hostname === "youtu.be") {
    return validVideoId(url.pathname.split("/").filter(Boolean)[0]);
  }

  if (url.pathname === "/watch") {
    return validVideoId(url.searchParams.get("v") ?? undefined);
  }

  const [route, id] = url.pathname.split("/").filter(Boolean);

  if (route === "shorts" || route === "embed" || route === "live" || route === "v") {
    return validVideoId(id);
  }

  return undefined;
}

function validVideoId(value: string | undefined) {
  return value && YOUTUBE_VIDEO_ID_PATTERN.test(value) ? value : undefined;
}
