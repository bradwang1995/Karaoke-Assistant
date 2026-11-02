import { afterEach, expect, it, vi } from "vitest";
import { readRoomSnapshot, saveRoomSnapshot } from "./roomState";
import { addQueueItem, createInitialSnapshot } from "./roomReducer";

afterEach(() => vi.unstubAllGlobals());
it("keeps page-only business state usable with disabled localStorage", () => {
  vi.stubGlobal("window", {
    get localStorage() { throw new Error("blocked"); },
    dispatchEvent: vi.fn(),
  });
  const snapshot = readRoomSnapshot("blocked-storage");
  saveRoomSnapshot(addQueueItem(snapshot, { videoId: "dQw4w9WgXcQ", title: "User selection", requestedBy: "guest" }));
  expect(readRoomSnapshot("blocked-storage").queue[0].requestedBy).toBe("guest");
});

it("physically scrubs old persisted metadata and retains business state if a later write fails", () => {
  const snapshot = addQueueItem(createInitialSnapshot("old-local"), { videoId: "dQw4w9WgXcQ", title: "Old API title", requestedBy: "guest" });
  const setItem = vi.fn();
  vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify(snapshot), setItem } });
  expect(readRoomSnapshot("old-local").queue[0]).toMatchObject({ title: "YouTube 视频", requestedBy: "guest" });
  expect(JSON.parse(setItem.mock.calls[0][1]).queue[0].title).toBe("YouTube 视频");
  vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify({ ...snapshot, room: { ...snapshot.room, id: "write-blocked" } }), setItem: () => { throw new Error("full"); } } });
  expect(readRoomSnapshot("write-blocked").queue[0].requestedBy).toBe("guest");
});
