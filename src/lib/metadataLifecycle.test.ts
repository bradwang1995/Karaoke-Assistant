import { describe, expect, it } from "vitest";
import { apiStamp, freshStamp, sanitizeVideo, playbackAllowed, METADATA_TTL_MS } from "./metadataLifecycle";

const now = Date.parse("2028-02-01T12:00:00.000Z");
describe("YouTube metadata lifecycle", () => {
  it("uses an exact UTC boundary across leap February and rejects corrupt/future stamps", () => {
    const stamp = apiStamp(now);
    expect(freshStamp(stamp, now + METADATA_TTL_MS - 1)).toBe(true);
    expect(freshStamp(stamp, now + METADATA_TTL_MS)).toBe(false);
    for (const value of [undefined, { ...stamp, fetchedAt: "bad" }, apiStamp(now + 1), { ...stamp, expiresAt: "2099-01-01T00:00:00.000Z" }]) {
      expect(freshStamp(value, now)).toBe(false);
    }
  });
  it("does not let a fresh snippet revive old details or status", () => {
    const video = { videoId: "dQw4w9WgXcQ", title: "song", score: 1, reasons: [], durationSeconds: 90,
      provenance: { snippet: apiStamp(now), details: apiStamp(now - METADATA_TTL_MS), status: apiStamp(now - METADATA_TTL_MS) },
      madeForKids: false as const, embeddable: true };
    const clean = sanitizeVideo(video, now)!;
    expect(clean.durationSeconds).toBeUndefined();
    expect(clean.madeForKids).toBe("unknown");
    expect(playbackAllowed(clean, now)).toBe(false);
    expect(sanitizeVideo({ ...video, provenance: undefined }, now)).toBeNull();
  });
  it("allows only explicit fresh non-MFK and embeddable status", () => {
    const video = { videoId: "dQw4w9WgXcQ", title: "song", score: 0, reasons: [],
      provenance: { snippet: apiStamp(now), status: apiStamp(now) }, madeForKids: false as const, embeddable: true };
    expect(playbackAllowed(video, now)).toBe(true);
    expect(playbackAllowed({ ...video, madeForKids: true }, now)).toBe(false);
    expect(playbackAllowed({ ...video, madeForKids: "unknown" }, now)).toBe(false);
    expect(playbackAllowed(video, now + 3_600_000)).toBe(false);
  });
});
