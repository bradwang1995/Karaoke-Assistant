import { describe, expect, it } from "vitest";
import {
  DEFAULT_YOUTUBE_PLAYBACK_QUALITY,
  readPreferredYouTubePlaybackQuality,
  resolveYouTubePlaybackQuality,
  savePreferredYouTubePlaybackQuality,
} from "./youtubePlaybackQuality";

function createStorage(initialValue: string | null = null) {
  let value = initialValue;

  return {
    getItem: () => value,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue;
    },
  };
}

describe("youtube playback quality preference", () => {
  it("defaults to 1080p when no valid quality is stored", () => {
    expect(resolveYouTubePlaybackQuality(null)).toBe(DEFAULT_YOUTUBE_PLAYBACK_QUALITY);
    expect(resolveYouTubePlaybackQuality("tiny")).toBe(DEFAULT_YOUTUBE_PLAYBACK_QUALITY);
  });

  it("reads a stored quality preference", () => {
    const storage = createStorage("hd720");

    expect(readPreferredYouTubePlaybackQuality(storage)).toBe("hd720");
  });

  it("saves a quality preference for the next player", () => {
    const storage = createStorage();

    savePreferredYouTubePlaybackQuality("large", storage);

    expect(readPreferredYouTubePlaybackQuality(storage)).toBe("large");
  });
});
