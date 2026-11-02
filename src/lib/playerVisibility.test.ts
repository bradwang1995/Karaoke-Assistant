import { afterEach, describe, expect, it, vi } from "vitest";
import { canStartPlayback, claimPlayback, releasePlayback } from "./playerVisibility";

afterEach(() => vi.unstubAllGlobals());
function scene({ width = 400, height = 300, left = 0, top = 0, hits = 25, hidden = false, dialog = false } = {}) {
  const frame = { getBoundingClientRect: () => ({ width, height, left, top, right: left + width, bottom: top + height }) };
  let calls = 0;
  vi.stubGlobal("window", { innerWidth: 400, innerHeight: 300 });
  vi.stubGlobal("document", {
    visibilityState: hidden ? "hidden" : "visible",
    querySelector: () => dialog ? {} : null,
    elementFromPoint: () => calls++ < hits ? frame : {},
  });
  return { querySelector: () => frame } as unknown as HTMLElement;
}
describe("scripted YouTube playback visibility", () => {
  it("requires a visible document, minimum viewport and more than half on screen", () => {
    expect(canStartPlayback(scene())).toBe(true);
    for (const options of [{ hidden: true }, { width: 199 }, { height: 199 }, { left: 200 }, { top: 150 }, { left: 500 }, { dialog: true }]) {
      expect(canStartPlayback(scene(options))).toBe(false);
    }
    expect(canStartPlayback(scene({ width: 200, height: 200 }))).toBe(true);
    expect(canStartPlayback(scene({ left: 199 }))).toBe(true);
  });
  it("rejects clipped/covered frames even with a full bounding rectangle", () => {
    expect(canStartPlayback(scene({ hits: 12 }))).toBe(false);
    expect(canStartPlayback(scene({ hits: 13 }))).toBe(true);
    scene();
    expect(canStartPlayback({ querySelector: () => null } as unknown as HTMLElement)).toBe(false);
  });
  it("allows explicit manual playback with a partly visible frame without allowing hidden/background playback", () => {
    expect(canStartPlayback(scene({ left: 250, hits: 10 }), false)).toBe(true);
    expect(canStartPlayback(scene({ left: 250, hits: 10 }))).toBe(false);
    expect(canStartPlayback(scene({ hidden: true }), false)).toBe(false);
    expect(canStartPlayback(scene({ hits: 0 }), false)).toBe(false);
  });
  it("hands page playback ownership to one player and releases on unmount", () => {
    const a = { pause: vi.fn() }, b = { pause: vi.fn() };
    claimPlayback(a); claimPlayback(a);
    expect(a.pause).not.toHaveBeenCalled();
    claimPlayback(b);
    expect(a.pause).toHaveBeenCalledTimes(1);
    releasePlayback(a); claimPlayback(a);
    expect(b.pause).toHaveBeenCalledTimes(1);
    releasePlayback(a); claimPlayback(b);
    expect(a.pause).toHaveBeenCalledTimes(1);
    releasePlayback(b);
  });
});
