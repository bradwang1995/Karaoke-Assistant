import { describe, expect, it } from "vitest";
import { clearPersistedApiMetadata } from "./browserMetadata";
import { createInitialSnapshot, addQueueItem } from "./roomReducer";
import { apiStamp } from "./metadataLifecycle";

describe("browser API payload cleanup", () => {
  it("physically removes payloads across all rooms without removing business state", () => {
    const snapshot = addQueueItem(createInitialSnapshot("room1234"), { videoId: "dQw4w9WgXcQ", title: "API title", requestedBy: "friend", metadataStamp: apiStamp() });
    const values = new Map<string, string>([
      ["ktv-assistant:room:room1234", JSON.stringify(snapshot)],
      ["ktv-assistant:mobile-search:other", JSON.stringify({ savedAt: Date.now(), query: "song", response: { results: ["old"] } })],
      ["ktv-assistant:mobile-search:expired", JSON.stringify({ savedAt: 1, response: { results: ["old"] } })],
      ["karaoke-assistant:language", "en"],
    ]);
    const storage = { length: values.size, key: (i: number) => [...values.keys()][i], getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear() } as Storage;
    clearPersistedApiMetadata(storage);
    expect(JSON.parse(values.get("ktv-assistant:room:room1234")!).queue[0]).toMatchObject({ title: "YouTube 视频", requestedBy: "friend" });
    expect(JSON.parse(values.get("ktv-assistant:mobile-search:other")!)).toMatchObject({ query: "song", response: null });
    expect(values.has("ktv-assistant:mobile-search:expired")).toBe(false);
    expect(values.get("karaoke-assistant:language")).toBe("en");
  });
});
