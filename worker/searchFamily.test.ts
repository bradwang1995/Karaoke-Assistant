import { describe, expect, it } from "vitest";
import {
  buildSearchQueryFamily,
  normalizeSearchFamilyQuery,
} from "./searchFamily";

describe("search query families", () => {
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
    expect(family.sourceQueries[0]).toBe("artist later ktv");
    expect(family.sourceQueries[1]).toBe("later ktv");
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
    expect(karaoke.sourceQueries[0]).toBe("later ktv");
    expect(original.sourceQueries[0]).toBe("later lyrics");
    expect(original.sourceQueries).not.toContain("later ktv");
    expect(original.sourceQueries).toContain("later official audio");
  });

  it("builds artist-mode source queries", () => {
    const family = buildSearchQueryFamily("Jay Chou", undefined, {
      searchType: "artist",
    });

    expect(family.searchType).toBe("artist");
    expect(family.normalizedQuery).toBe("jay chou ktv");
    expect(family.sourceQueries[0]).toBe("jay chou ktv");
    expect(family.sourceQueries).toContain("jay chou instrumental");
    expect(family.sourceQueries.length).toBeGreaterThanOrEqual(8);
  });
});
