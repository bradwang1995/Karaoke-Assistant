import { describe, expect, it } from "vitest";
import {
  DISPLAY_PLAYBACK_START_SECONDS,
  createPlayerProgressSession,
  getPlayerProgressForItem,
} from "./playerProgress";

describe("display player progress sessions", () => {
  it("always defines display playback as starting from zero", () => {
    expect(DISPLAY_PLAYBACK_START_SECONDS).toBe(0);
  });

  it("does not expose one song's progress to the next song", () => {
    const previousSong = createPlayerProgressSession("song-1", {
      currentTime: 30,
      duration: 240,
    });

    expect(getPlayerProgressForItem(previousSong, "song-2")).toEqual({
      currentTime: 0,
      duration: 0,
    });
  });

  it("keeps progress for the matching queue item", () => {
    const currentSong = createPlayerProgressSession("song-1", {
      currentTime: 45,
      duration: 240,
    });

    expect(getPlayerProgressForItem(currentSong, "song-1")).toEqual({
      currentTime: 45,
      duration: 240,
    });
  });
});
