import type { VideoSearchResult } from "../src/types/youtube";

export const YOUTUBE_MUSIC_CATEGORY_ID = "10";
export const MAX_SONG_DURATION_SECONDS = 7 * 60;

export function isEligibleSongResult(
  result: Pick<VideoSearchResult, "categoryId" | "durationSeconds">,
) {
  return (
    result.categoryId === YOUTUBE_MUSIC_CATEGORY_ID &&
    typeof result.durationSeconds === "number" &&
    Number.isFinite(result.durationSeconds) &&
    result.durationSeconds > 0 &&
    result.durationSeconds < MAX_SONG_DURATION_SECONDS
  );
}

export function filterEligibleSongResults<T extends VideoSearchResult>(results: T[]) {
  return results.filter(isEligibleSongResult);
}
