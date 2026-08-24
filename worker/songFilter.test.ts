import { describe, expect, it } from "vitest";
import {
  filterStructurallyUsableVideoResults,
  isStructurallyUsableVideoResult,
} from "./songFilter";

describe("ordinary search structural eligibility", () => {
  it("accepts long, non-Music, and unenriched videos when id and title are usable", () => {
    const longNonMusicResult = {
      videoId: "long-song",
      title: "情歌王 15 分钟完整版",
      categoryId: "24",
      durationSeconds: 900,
      score: 0,
      reasons: [],
    };

    expect(
      isStructurallyUsableVideoResult(longNonMusicResult),
    ).toBe(true);
    expect(
      isStructurallyUsableVideoResult({
        videoId: "no-details",
        title: "后来 KTV",
      }),
    ).toBe(true);
  });

  it("rejects malformed ids, blank titles, and duplicate ids only", () => {
    const results = filterStructurallyUsableVideoResults([
      result("usable-id", "后来 KTV"),
      result("usable-id", "duplicate"),
      result("bad id", "invalid id"),
      result("missing-title", "   "),
    ]);

    expect(results.map((item) => item.videoId)).toEqual(["usable-id"]);
  });
});

function result(videoId: string, title: string) {
  return { videoId, title, score: 0, reasons: [] };
}
