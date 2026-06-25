import { describe, expect, it } from "vitest";
import { buildSearchQueryFamily, normalizeSearchFamilyQuery } from "./searchFamily";

describe("search query families", () => {
  it("normalizes karaoke variants into the same family", () => {
    expect(normalizeSearchFamilyQuery("Later ktv")).toBe("later");
    expect(normalizeSearchFamilyQuery("Later karaoke")).toBe("later");
    expect(buildSearchQueryFamily("Later ktv").hash).toBe(buildSearchQueryFamily("Later").hash);
  });

  it("builds broad source queries for YouTube search", () => {
    const family = buildSearchQueryFamily("Later", "Artist");

    expect(family.canonicalQuery).toBe("later");
    expect(family.normalizedQuery).toBe("later ktv");
    expect(family.aliases).toContain("later ktv");
    expect(family.aliases).toContain("later karaoke");
    expect(family.sourceQueries[0]).toContain("later ktv|later karaoke");
    expect(family.sourceQueries[0]).toContain("artist later ktv");
  });
});
