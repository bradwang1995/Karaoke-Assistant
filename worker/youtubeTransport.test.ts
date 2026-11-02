import { afterEach, expect, it, vi } from "vitest";
import { lookupYouTubeVideosByIds } from "./youtubeSearch";

afterEach(() => vi.unstubAllGlobals());
it("does not propagate request URLs or credentials from transport errors", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("https://example.test/?key=test-secret-do-not-log"); }));
  await expect(lookupYouTubeVideosByIds(["dQw4w9WgXcQ"], "test-secret-do-not-log")).rejects.toThrow(/^YouTube network request failed\.$/);
});
