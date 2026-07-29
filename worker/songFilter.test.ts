import { describe, expect, it } from "vitest";
import {
  isEligibleSongResult,
  MAX_SONG_DURATION_SECONDS,
  YOUTUBE_MUSIC_CATEGORY_ID,
} from "./songFilter";

describe("song result eligibility", () => {
  it("only accepts Music-category videos shorter than seven minutes", () => {
    expect(
      isEligibleSongResult({
        categoryId: YOUTUBE_MUSIC_CATEGORY_ID,
        durationSeconds: MAX_SONG_DURATION_SECONDS - 1,
      }),
    ).toBe(true);
    expect(
      isEligibleSongResult({
        categoryId: YOUTUBE_MUSIC_CATEGORY_ID,
        durationSeconds: MAX_SONG_DURATION_SECONDS,
      }),
    ).toBe(false);
    expect(
      isEligibleSongResult({
        categoryId: "19",
        durationSeconds: 240,
      }),
    ).toBe(false);
    expect(
      isEligibleSongResult({
        categoryId: YOUTUBE_MUSIC_CATEGORY_ID,
      }),
    ).toBe(false);
  });
});
