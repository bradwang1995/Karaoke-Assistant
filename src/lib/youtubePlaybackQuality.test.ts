import { describe, expect, it } from "vitest";
import {
  DEFAULT_YOUTUBE_PLAYBACK_QUALITY,
  getAvailablePlaybackQualityOptions,
  getClosestAvailablePlaybackQuality,
  normalizeAvailableYouTubePlaybackQualities,
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
    expect(resolveYouTubePlaybackQuality("auto")).toBe(DEFAULT_YOUTUBE_PLAYBACK_QUALITY);
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

  it("normalizes real YouTube quality levels into concrete labels", () => {
    expect(
      normalizeAvailableYouTubePlaybackQualities(["medium", "hd720", "auto", "hd720", "small"]),
    ).toEqual(["hd720", "medium", "small"]);
    expect(getAvailablePlaybackQualityOptions(["hd720", "large"])).toEqual([
      { value: "hd720", label: "720p" },
      { value: "large", label: "480p" },
    ]);
  });

  it("shows the closest effective quality when the preferred quality is unavailable", () => {
    expect(getClosestAvailablePlaybackQuality("hd1080", ["hd720", "large"])).toBe("hd720");
    expect(getClosestAvailablePlaybackQuality("small", ["hd720", "large"])).toBe("large");
  });
});
