import { sanitizeRoomSnapshot } from "./roomMetadata";
import { useEffect, useMemo, useState } from "react";
import {
  addQueueItem,
  createInitialSnapshot,
  markPlayerEnded,
  markPlayerStarted,
  promoteQueueItem,
  removeQueueItem,
  restartCurrentItem,
} from "./roomReducer";
import type { QueueItemInput, RoomSnapshot } from "../types/room";

const STORAGE_PREFIX = "ktv-assistant:room:";
const ROOM_EVENT = "ktv-assistant:room-updated";
const CHANNEL_NAME = "ktv-assistant-room-updates";

const liveSnapshots = new Map<string, RoomSnapshot>();
let broadcastChannel: BroadcastChannel | null = null;

export function createRoomId() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 8);
}

export function readRoomSnapshot(roomId: string, displayName?: string): RoomSnapshot {
  if (liveSnapshots.has(roomId)) {
    const clean = sanitizeRoomSnapshot(liveSnapshots.get(roomId)!);
    liveSnapshots.set(roomId, clean);
    return clean;
  }
  const key = roomStorageKey(roomId);
  let snapshot = createInitialSnapshot(roomId, undefined, displayName);
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) snapshot = sanitizeRoomSnapshot(JSON.parse(raw) as RoomSnapshot, true);
  } catch { /* Missing, blocked or corrupt storage starts a page-only room. */ }
  liveSnapshots.set(roomId, snapshot);
  try { window.localStorage.setItem(key, JSON.stringify(sanitizeRoomSnapshot(snapshot, true))); }
  catch { /* Preserve the loaded business state even when writes fail. */ }
  return snapshot;
}

export function saveRoomSnapshot(snapshot: RoomSnapshot) {
  snapshot = sanitizeRoomSnapshot(snapshot);
  liveSnapshots.set(snapshot.room.id, snapshot);
  try {
    window.localStorage.setItem(roomStorageKey(snapshot.room.id), JSON.stringify(sanitizeRoomSnapshot(snapshot, true)));
  } catch { /* Keep the live room usable for this page without persistence. */ }
  notifyRoomUpdated(snapshot.room.id);
}

export function hydrateRoomSnapshot(snapshot: RoomSnapshot) {
  saveRoomSnapshot(snapshot);
}

export function addSongToRoom(roomId: string, input: QueueItemInput) {
  saveRoomSnapshot(addQueueItem(readRoomSnapshot(roomId), input));
}

export function promoteSong(roomId: string, queueItemId: string) {
  saveRoomSnapshot(promoteQueueItem(readRoomSnapshot(roomId), queueItemId));
}

export function removeSong(roomId: string, queueItemId: string) {
  saveRoomSnapshot(removeQueueItem(readRoomSnapshot(roomId), queueItemId));
}

export function playerStarted(roomId: string, queueItemId: string, videoId: string) {
  saveRoomSnapshot(markPlayerStarted(readRoomSnapshot(roomId), queueItemId, videoId));
}

export function playerEnded(roomId: string, queueItemId: string, videoId: string) {
  saveRoomSnapshot(markPlayerEnded(readRoomSnapshot(roomId), queueItemId, videoId));
}

export function restartCurrentSong(roomId: string, queueItemId: string, videoId: string) {
  saveRoomSnapshot(restartCurrentItem(readRoomSnapshot(roomId), queueItemId, videoId));
}

export function useRoomSnapshot(roomId: string) {
  const [snapshot, setSnapshot] = useState(() => readRoomSnapshot(roomId));

  useEffect(() => {
    setSnapshot(readRoomSnapshot(roomId));

    const updateFromStorage = () => {
      setSnapshot(readRoomSnapshot(roomId));
    };

    const handleLocalEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId: string }>).detail;
      if (detail?.roomId === roomId) {
        updateFromStorage();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === roomStorageKey(roomId)) {
        liveSnapshots.delete(roomId);
        updateFromStorage();
      }
    };

    const channel = getBroadcastChannel();
    const handleMessage = (event: MessageEvent<{ roomId: string }>) => {
      if (event.data.roomId === roomId) {
        updateFromStorage();
      }
    };

    const expiryTimer = window.setInterval(updateFromStorage, 60_000);
    window.addEventListener("focus", updateFromStorage);
    window.addEventListener(ROOM_EVENT, handleLocalEvent);
    window.addEventListener("storage", handleStorage);
    channel?.addEventListener("message", handleMessage);

    return () => {
      window.clearInterval(expiryTimer);
      window.removeEventListener("focus", updateFromStorage);
      window.removeEventListener(ROOM_EVENT, handleLocalEvent);
      window.removeEventListener("storage", handleStorage);
      channel?.removeEventListener("message", handleMessage);
    };
  }, [roomId]);

  useEffect(() => {
    const expiry = Math.min(...snapshot.queue.flatMap((item) => item.metadataStamp ? [Date.parse(item.metadataStamp.expiresAt)] : []));
    if (!Number.isFinite(expiry)) return;
    const timer = window.setTimeout(() => setSnapshot(readRoomSnapshot(roomId)), Math.min(Math.max(expiry - Date.now() + 1, 0), 2147483647));
    return () => window.clearTimeout(timer);
  }, [roomId, snapshot.queue]);
  return useMemo(() => snapshot, [snapshot]);
}

function roomStorageKey(roomId: string) {
  return `${STORAGE_PREFIX}${roomId}`;
}

function notifyRoomUpdated(roomId: string) {
  window.dispatchEvent(new CustomEvent(ROOM_EVENT, { detail: { roomId } }));
  getBroadcastChannel()?.postMessage({ roomId });
}

function getBroadcastChannel() {
  if (!("BroadcastChannel" in window)) {
    return null;
  }

  broadcastChannel ??= new BroadcastChannel(CHANNEL_NAME);
  return broadcastChannel;
}
