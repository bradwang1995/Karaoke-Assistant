import { describe, expect, it } from "vitest";
import {
  createDeviceRoomDisplayName,
  normalizeRoomDisplayName,
  visibleRoomDisplayName,
} from "./roomName";

describe("room display names", () => {
  it("uses an available device platform without exposing the technical room id", () => {
    expect(
      createDeviceRoomDisplayName({
        platform: "Win32",
        userAgent: "Mozilla/5.0",
      }),
    ).toBe("这台 Windows 电脑的 K 歌房");
  });

  it("normalizes and limits user-provided values", () => {
    expect(normalizeRoomDisplayName("  Brad   的房间  ", "fallback")).toBe("Brad 的房间");
    expect(normalizeRoomDisplayName("歌".repeat(50), "fallback")).toHaveLength(40);
  });

  it("replaces legacy id-based labels with a friendly fallback", () => {
    expect(visibleRoomDisplayName("K歌房 abc12345", "abc12345")).toBe("朋友的 K 歌房");
    expect(visibleRoomDisplayName("这台 Mac 的 K 歌房", "abc12345")).toBe(
      "这台 Mac 的 K 歌房",
    );
  });
});
