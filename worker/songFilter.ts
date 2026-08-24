import type { VideoSearchResult } from "../src/types/youtube";

export function isStructurallyUsableVideoResult(
  result: Pick<VideoSearchResult, "videoId" | "title">,
) {
  const videoId = result.videoId?.trim();
  const title = result.title?.trim();

  return Boolean(videoId && title && /^[A-Za-z0-9_-]+$/.test(videoId));
}

export function filterStructurallyUsableVideoResults<T extends VideoSearchResult>(results: T[]) {
  const seenVideoIds = new Set<string>();

  return results.filter((result) => {
    if (!isStructurallyUsableVideoResult(result) || seenVideoIds.has(result.videoId)) {
      return false;
    }

    seenVideoIds.add(result.videoId);
    return true;
  });
}
