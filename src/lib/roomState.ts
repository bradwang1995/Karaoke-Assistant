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

let broadcastChannel: BroadcastChannel | null = null;

export function createRoomId() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 8);
}

export function readRoomSnapshot(roomId: string, displayName?: string): RoomSnapshot {
  const key = roomStorageKey(roomId);
  const raw = window.localStorage.getItem(key);

  if (!raw) {
    const snapshot = createInitialSnapshot(roomId, undefined, displayName);
    window.localStorage.setItem(key, JSON.stringify(snapshot));
    return snapshot;
  }

  try {
    return JSON.parse(raw) as RoomSnapshot;
  } catch {
    const snapshot = createInitialSnapshot(roomId, undefined, displayName);
    window.localStorage.setItem(key, JSON.stringify(snapshot));
    return snapshot;
  }
}

export function saveRoomSnapshot(snapshot: RoomSnapshot) {
  window.localStorage.setItem(roomStorageKey(snapshot.room.id), JSON.stringify(snapshot));
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
        updateFromStorage();
      }
    };

    const channel = getBroadcastChannel();
    const handleMessage = (event: MessageEvent<{ roomId: string }>) => {
      if (event.data.roomId === roomId) {
        updateFromStorage();
      }
    };

    window.addEventListener(ROOM_EVENT, handleLocalEvent);
    window.addEventListener("storage", handleStorage);
    channel?.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener(ROOM_EVENT, handleLocalEvent);
      window.removeEventListener("storage", handleStorage);
      channel?.removeEventListener("message", handleMessage);
    };
  }, [roomId]);

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
