const MAX_ROOM_DISPLAY_NAME_LENGTH = 40;

interface NavigatorWithUserAgentData {
  platform: string;
  userAgent: string;
  userAgentData?: {
    platform?: string;
  };
}

export function createDeviceRoomDisplayName(
  navigatorLike: NavigatorWithUserAgentData = navigator as NavigatorWithUserAgentData,
) {
  const platform = `${navigatorLike.userAgentData?.platform ?? navigatorLike.platform} ${
    navigatorLike.userAgent
  }`.toLowerCase();

  if (platform.includes("windows") || platform.includes("win32")) {
    return "这台 Windows 电脑的 K 歌房";
  }

  if (platform.includes("mac")) {
    return "这台 Mac 的 K 歌房";
  }

  if (platform.includes("iphone")) {
    return "这台 iPhone 的 K 歌房";
  }

  if (platform.includes("ipad")) {
    return "这台 iPad 的 K 歌房";
  }

  if (platform.includes("android")) {
    return "这台 Android 设备的 K 歌房";
  }

  return "我的 K 歌房";
}

export function normalizeRoomDisplayName(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return fallback;
  }

  return Array.from(normalized).slice(0, MAX_ROOM_DISPLAY_NAME_LENGTH).join("");
}

export function visibleRoomDisplayName(displayName: string | undefined, roomId: string) {
  const legacyDisplayName = `K歌房 ${roomId}`;
  const normalized = normalizeRoomDisplayName(displayName, legacyDisplayName);

  return normalized === legacyDisplayName ? "朋友的 K 歌房" : normalized;
}
