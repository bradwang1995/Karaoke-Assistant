import { describe, expect, it } from "vitest";
import {
  addQueueItem,
  cleanupCompletedItems,
  createInitialSnapshot,
  getCurrentItem,
  getQueuedItems,
  markPlayerEnded,
  promoteQueueItem,
  removeQueueItem,
} from "./roomReducer";

describe("room reducer", () => {
  it("starts the first added song without interrupting later additions", () => {
    const initial = createInitialSnapshot("room-a", "2026-06-23T00:00:00.000Z");
    const first = addQueueItem(initial, {
      videoId: "first",
      title: "第一首 KTV",
    });
    const second = addQueueItem(first, {
      videoId: "second",
      title: "第二首 KTV",
    });

    expect(getCurrentItem(second)?.videoId).toBe("first");
    expect(getQueuedItems(second).map((item) => item.videoId)).toEqual(["second"]);
  });

  it("promotes queued songs without changing the current song", () => {
    const initial = createInitialSnapshot("room-a", "2026-06-23T00:00:00.000Z");
    const withFirst = addQueueItem(initial, { videoId: "first", title: "第一首" });
    const withSecond = addQueueItem(withFirst, { videoId: "second", title: "第二首" });
    const withThird = addQueueItem(withSecond, { videoId: "third", title: "第三首" });
    const third = getQueuedItems(withThird).find((item) => item.videoId === "third")!;
    const promoted = promoteQueueItem(withThird, third.id);

    expect(getCurrentItem(promoted)?.videoId).toBe("first");
    expect(getQueuedItems(promoted).map((item) => item.videoId)).toEqual(["third", "second"]);
  });

  it("removes queued songs", () => {
    const initial = createInitialSnapshot("room-a", "2026-06-23T00:00:00.000Z");
    const withFirst = addQueueItem(initial, { videoId: "first", title: "第一首" });
    const withSecond = addQueueItem(withFirst, { videoId: "second", title: "第二首" });
    const second = getQueuedItems(withSecond)[0];
    const removed = removeQueueItem(withSecond, second.id);

    expect(getQueuedItems(removed)).toEqual([]);
    expect(getCurrentItem(removed)?.videoId).toBe("first");
  });

  it("advances when the current song ends", () => {
    const initial = createInitialSnapshot("room-a", "2026-06-23T00:00:00.000Z");
    const withFirst = addQueueItem(initial, { videoId: "first", title: "第一首" });
    const withSecond = addQueueItem(withFirst, { videoId: "second", title: "第二首" });
    const current = getCurrentItem(withSecond)!;
    const advanced = markPlayerEnded(withSecond, current.id, current.videoId);

    expect(getCurrentItem(advanced)?.videoId).toBe("second");
    expect(getQueuedItems(advanced)).toEqual([]);
  });

  it("removes completed items during cleanup", () => {
    const initial = createInitialSnapshot("room-a", "2026-06-23T00:00:00.000Z");
    const withFirst = addQueueItem(initial, { videoId: "first", title: "First" });
    const withSecond = addQueueItem(withFirst, { videoId: "second", title: "Second" });
    const current = getCurrentItem(withSecond)!;
    const advanced = markPlayerEnded(withSecond, current.id, current.videoId);
    const cleaned = cleanupCompletedItems(advanced);

    expect(cleaned.queue.some((item) => item.videoId === "first")).toBe(false);
    expect(getCurrentItem(cleaned)?.videoId).toBe("second");
  });
});
