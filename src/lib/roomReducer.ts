import type { QueueItem, QueueItemInput, RoomSnapshot } from "../types/room";

export function createInitialSnapshot(
  roomId: string,
  now = new Date().toISOString(),
  displayName = `K歌房 ${roomId}`,
): RoomSnapshot {
  return {
    room: {
      id: roomId,
      displayName,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    },
    queue: [],
    playback: {
      roomId,
      currentQueueItemId: null,
      currentVideoId: null,
      playerState: "idle",
      updatedAt: now,
    },
    connectedClients: 1,
  };
}

export function getCurrentItem(snapshot: RoomSnapshot) {
  return (
    snapshot.queue.find(
      (item) =>
        item.id === snapshot.playback.currentQueueItemId &&
        item.status === "playing",
    ) ?? null
  );
}

export function getQueuedItems(snapshot: RoomSnapshot) {
  return snapshot.queue
    .filter((item) => item.status === "queued")
    .sort((a, b) => a.sortKey - b.sortKey);
}

export function getVisibleQueueItems(snapshot: RoomSnapshot) {
  return snapshot.queue
    .filter((item) => item.status === "queued" || item.status === "playing")
    .sort((a, b) => a.sortKey - b.sortKey);
}

export function addQueueItem(
  snapshot: RoomSnapshot,
  input: QueueItemInput,
  now = new Date().toISOString(),
): RoomSnapshot {
  const maxSortKey = snapshot.queue.reduce(
    (max, item) => Math.max(max, item.sortKey),
    0,
  );
  const item: QueueItem = {
    id: createQueueItemId(),
    roomId: snapshot.room.id,
    videoId: input.videoId,
    title: input.title,
    channelTitle: input.channelTitle,
    thumbnailUrl: input.thumbnailUrl,
    requestedBy: input.requestedBy,
    status: "queued",
    sortKey: maxSortKey + 1000,
    createdAt: now,
    updatedAt: now,
  };

  return ensureActiveSong(
    touchRoom({ ...snapshot, queue: [...snapshot.queue, item] }, now),
    now,
  );
}

export function promoteQueueItem(
  snapshot: RoomSnapshot,
  queueItemId: string,
  now = new Date().toISOString(),
): RoomSnapshot {
  const queuedItems = getQueuedItems(snapshot);
  const target = queuedItems.find((item) => item.id === queueItemId);

  if (!target) {
    return snapshot;
  }

  const minSortKey = queuedItems.reduce(
    (min, item) => Math.min(min, item.sortKey),
    target.sortKey,
  );

  const queue = snapshot.queue.map((item) =>
    item.id === queueItemId
      ? { ...item, sortKey: minSortKey - 1000, updatedAt: now }
      : item,
  );

  return touchRoom({ ...snapshot, queue }, now);
}

export function removeQueueItem(
  snapshot: RoomSnapshot,
  queueItemId: string,
  now = new Date().toISOString(),
): RoomSnapshot {
  const target = snapshot.queue.find((item) => item.id === queueItemId);

  if (!target || target.status === "removed" || target.status === "completed") {
    return snapshot;
  }

  const queue = snapshot.queue.map((item) =>
    item.id === queueItemId ? { ...item, status: "removed" as const, updatedAt: now } : item,
  );

  const nextSnapshot: RoomSnapshot =
    target.status === "playing"
      ? {
          ...snapshot,
          queue,
          playback: {
            ...snapshot.playback,
            currentQueueItemId: null,
            currentVideoId: null,
            playerState: "idle" as const,
            updatedAt: now,
          },
        }
      : { ...snapshot, queue };

  return ensureActiveSong(touchRoom(nextSnapshot, now), now);
}

export function markPlayerStarted(
  snapshot: RoomSnapshot,
  queueItemId: string,
  videoId: string,
  now = new Date().toISOString(),
): RoomSnapshot {
  if (
    snapshot.playback.currentQueueItemId !== queueItemId ||
    snapshot.playback.currentVideoId !== videoId
  ) {
    return snapshot;
  }

  return touchRoom(
    {
      ...snapshot,
      playback: {
        ...snapshot.playback,
        playerState: "playing",
        startedAt: snapshot.playback.startedAt ?? now,
        updatedAt: now,
      },
    },
    now,
  );
}

export function markPlayerEnded(
  snapshot: RoomSnapshot,
  queueItemId: string,
  videoId: string,
  now = new Date().toISOString(),
): RoomSnapshot {
  if (
    snapshot.playback.currentQueueItemId !== queueItemId ||
    snapshot.playback.currentVideoId !== videoId
  ) {
    return snapshot;
  }

  const queue = snapshot.queue.map((item) =>
    item.id === queueItemId
      ? { ...item, status: "completed" as const, updatedAt: now }
      : item,
  );

  return ensureActiveSong(
    touchRoom(
      {
        ...snapshot,
        queue,
        playback: {
          ...snapshot.playback,
          currentQueueItemId: null,
          currentVideoId: null,
          playerState: "ended",
          updatedAt: now,
        },
      },
      now,
    ),
    now,
  );
}

export function restartCurrentItem(
  snapshot: RoomSnapshot,
  queueItemId: string,
  videoId: string,
  now = new Date().toISOString(),
): RoomSnapshot {
  if (
    snapshot.playback.currentQueueItemId !== queueItemId ||
    snapshot.playback.currentVideoId !== videoId
  ) {
    return snapshot;
  }

  return touchRoom(
    {
      ...snapshot,
      playback: {
        ...snapshot.playback,
        playerState: "loading",
        startedAt: undefined,
        updatedAt: now,
      },
    },
    now,
  );
}

export function cleanupCompletedItems(
  snapshot: RoomSnapshot,
  now = new Date().toISOString(),
): RoomSnapshot {
  const queue = snapshot.queue.filter(
    (item) => item.status !== "completed" && item.status !== "removed",
  );

  return ensureActiveSong(touchRoom({ ...snapshot, queue }, now), now);
}

export function ensureActiveSong(
  snapshot: RoomSnapshot,
  now = new Date().toISOString(),
): RoomSnapshot {
  const currentItem = getCurrentItem(snapshot);

  if (currentItem) {
    return snapshot;
  }

  const nextItem = getQueuedItems(snapshot)[0];

  if (!nextItem) {
    return {
      ...snapshot,
      playback: {
        ...snapshot.playback,
        currentQueueItemId: null,
        currentVideoId: null,
        playerState: "idle",
        updatedAt: now,
      },
    };
  }

  const queue = snapshot.queue.map((item) =>
    item.id === nextItem.id ? { ...item, status: "playing" as const, updatedAt: now } : item,
  );

  return {
    ...snapshot,
    queue,
    playback: {
      ...snapshot.playback,
      currentQueueItemId: nextItem.id,
      currentVideoId: nextItem.videoId,
      playerState: "loading",
      startedAt: undefined,
      updatedAt: now,
    },
  };
}

function touchRoom(snapshot: RoomSnapshot, now: string): RoomSnapshot {
  return {
    ...snapshot,
    room: {
      ...snapshot.room,
      updatedAt: now,
    },
    playback: {
      ...snapshot.playback,
      updatedAt: snapshot.playback.updatedAt || now,
    },
  };
}

function createQueueItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `item-${Math.random().toString(36).slice(2, 10)}`;
}
