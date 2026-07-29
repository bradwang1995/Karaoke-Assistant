import { describe, expect, it } from "vitest";
import {
  buildSearchQueryFamily,
  buildSearchQueryFamilyVariants,
  normalizeSearchFamilyQuery,
} from "./searchFamily";

describe("search query families", () => {
  it("builds the current option family first and the other three combinations after it", () => {
    const variants = buildSearchQueryFamilyVariants("周杰伦", undefined, {
      searchType: "song",
      includeOriginalVocal: false,
    });

    expect(
      variants.map((family) => [
        family.searchType,
        family.includeOriginalVocal,
        family.canonicalQuery,
      ]),
    ).toEqual([
      ["song", false, "周杰伦"],
      ["song", true, "周杰伦"],
      ["artist", false, "周杰伦"],
      ["artist", true, "周杰伦"],
    ]);
    expect(new Set(variants.map((family) => family.hash)).size).toBe(4);
  });

  it("keeps different query text in separate cache families", () => {
    expect(normalizeSearchFamilyQuery("Later ktv")).toBe("later");
    expect(normalizeSearchFamilyQuery("Later karaoke")).toBe("later");
    expect(buildSearchQueryFamily("Later ktv").hash).not.toBe(
      buildSearchQueryFamily("Later").hash,
    );
    expect(buildSearchQueryFamily("  LATER  ").hash).toBe(
      buildSearchQueryFamily("later").hash,
    );
  });

  it("starts song searches with a focused title query before broader fallbacks", () => {
    const family = buildSearchQueryFamily("Later", "Artist");

    expect(family.canonicalQuery).toBe("later");
    expect(family.normalizedQuery).toBe("later ktv");
    expect(family.aliases).toContain("later ktv");
    expect(family.aliases).toContain("later karaoke");
    expect(family.sourceQueries[0]).toBe("artist later");
    expect(family.sourceQueries).toContain("artist later ktv");
    expect(family.sourceQueries.at(-1)).toContain("later ktv|later karaoke");
  });

  it("separates original-vocal searches from karaoke searches", () => {
    const karaoke = buildSearchQueryFamily("Later");
    const original = buildSearchQueryFamily("Later", undefined, {
      includeOriginalVocal: true,
    });

    expect(original.hash).not.toBe(karaoke.hash);
    expect(original.normalizedQuery).toBe("later lyric video");
    expect(original.sourceQueries[0]).toBe("later");
    expect(original.sourceQueries).toContain("later ktv");
  });

  it("builds artist-mode source queries", () => {
    const family = buildSearchQueryFamily("Jay Chou", undefined, {
      searchType: "artist",
    });

    expect(family.searchType).toBe("artist");
    expect(family.normalizedQuery).toBe("jay chou ktv");
    expect(family.sourceQueries[0]).toContain("jay chou ktv");
    expect(family.sourceQueries[0]).toContain("jay chou karaoke");
  });
});
