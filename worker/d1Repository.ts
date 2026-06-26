import type { QueueItem, Room, RoomSnapshot } from "../src/types/room";
import type { PlaybackStateRow, QueueItemRow, RoomRow } from "./types";

export async function createRoomInD1(
  db: D1Database,
  roomId: string,
  now = new Date().toISOString(),
) {
  await db
    .prepare(
      `
      INSERT INTO rooms (id, display_name, created_at, updated_at, is_active)
      VALUES (?, ?, ?, ?, 1)
      `,
    )
    .bind(roomId, `K歌房 ${roomId}`, now, now)
    .run();

  await db
    .prepare(
      `
      INSERT INTO playback_states (
        room_id,
        current_queue_item_id,
        current_video_id,
        player_state,
        started_at,
        updated_at
      )
      VALUES (?, NULL, NULL, 'idle', NULL, ?)
      `,
    )
    .bind(roomId, now)
    .run();

  return getRoomSnapshotFromD1(db, roomId);
}

export async function getRoomSnapshotFromD1(
  db: D1Database,
  roomId: string,
): Promise<RoomSnapshot | null> {
  const roomRow = await db
    .prepare(
      `
      SELECT id, display_name, created_at, updated_at, is_active
      FROM rooms
      WHERE id = ?
      `,
    )
    .bind(roomId)
    .first<RoomRow>();

  if (!roomRow) {
    return null;
  }

  const queueRows = await db
    .prepare(
      `
      SELECT
        id,
        room_id,
        video_id,
        title,
        channel_title,
        thumbnail_url,
        requested_by,
        status,
        sort_key,
        created_at,
        updated_at
      FROM queue_items
      WHERE room_id = ?
        AND status != 'removed'
      ORDER BY sort_key ASC
      `,
    )
    .bind(roomId)
    .all<QueueItemRow>();

  const playbackRow = await db
    .prepare(
      `
      SELECT
        room_id,
        current_queue_item_id,
        current_video_id,
        player_state,
        started_at,
        updated_at
      FROM playback_states
      WHERE room_id = ?
      `,
    )
    .bind(roomId)
    .first<PlaybackStateRow>();

  const now = new Date().toISOString();
  const room: Room = {
    id: roomRow.id,
    displayName: roomRow.display_name ?? undefined,
    createdAt: roomRow.created_at,
    updatedAt: roomRow.updated_at,
    isActive: roomRow.is_active === 1,
  };

  return {
    room,
    queue: (queueRows.results ?? []).map(toQueueItem),
    playback: {
      roomId,
      currentQueueItemId: playbackRow?.current_queue_item_id ?? null,
      currentVideoId: playbackRow?.current_video_id ?? null,
      playerState: toPlayerState(playbackRow?.player_state),
      startedAt: playbackRow?.started_at ?? undefined,
      updatedAt: playbackRow?.updated_at ?? now,
    },
    connectedClients: 0,
  };
}

export async function saveRoomSnapshotToD1(db: D1Database, snapshot: RoomSnapshot) {
  await db
    .prepare(
      `
      UPDATE rooms
      SET
        display_name = ?,
        updated_at = ?,
        is_active = ?
      WHERE id = ?
      `,
    )
    .bind(
      snapshot.room.displayName ?? null,
      snapshot.room.updatedAt,
      snapshot.room.isActive ? 1 : 0,
      snapshot.room.id,
    )
    .run();

  await db
    .prepare(
      `
      INSERT INTO playback_states (
        room_id,
        current_queue_item_id,
        current_video_id,
        player_state,
        started_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(room_id) DO UPDATE SET
        current_queue_item_id = excluded.current_queue_item_id,
        current_video_id = excluded.current_video_id,
        player_state = excluded.player_state,
        started_at = excluded.started_at,
        updated_at = excluded.updated_at
      `,
    )
    .bind(
      snapshot.playback.roomId,
      snapshot.playback.currentQueueItemId,
      snapshot.playback.currentVideoId,
      snapshot.playback.playerState,
      snapshot.playback.startedAt ?? null,
      snapshot.playback.updatedAt,
    )
    .run();

  for (const item of snapshot.queue) {
    await db
      .prepare(
        `
        INSERT INTO queue_items (
          id,
          room_id,
          video_id,
          title,
          channel_title,
          thumbnail_url,
          requested_by,
          status,
          sort_key,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          room_id = excluded.room_id,
          video_id = excluded.video_id,
          title = excluded.title,
          channel_title = excluded.channel_title,
          thumbnail_url = excluded.thumbnail_url,
          requested_by = excluded.requested_by,
          status = excluded.status,
          sort_key = excluded.sort_key,
          updated_at = excluded.updated_at
        `,
      )
      .bind(
        item.id,
        item.roomId,
        item.videoId,
        item.title,
        item.channelTitle ?? null,
        item.thumbnailUrl ?? null,
        item.requestedBy ?? null,
        item.status,
        item.sortKey,
        item.createdAt,
        item.updatedAt,
      )
      .run();
  }
}

export async function deleteInactiveQueueItemsFromD1(db: D1Database, roomId: string) {
  await db
    .prepare(
      `
      DELETE FROM queue_items
      WHERE room_id = ?
        AND status IN ('completed', 'removed')
      `,
    )
    .bind(roomId)
    .run();
}

function toQueueItem(row: QueueItemRow): QueueItem {
  return {
    id: row.id,
    roomId: row.room_id,
    videoId: row.video_id,
    title: row.title,
    channelTitle: row.channel_title ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    requestedBy: row.requested_by ?? undefined,
    status: toQueueItemStatus(row.status),
    sortKey: row.sort_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toQueueItemStatus(status: string): QueueItem["status"] {
  if (
    status === "queued" ||
    status === "playing" ||
    status === "completed" ||
    status === "removed"
  ) {
    return status;
  }

  return "queued";
}

function toPlayerState(
  state: string | null | undefined,
): RoomSnapshot["playback"]["playerState"] {
  if (
    state === "idle" ||
    state === "loading" ||
    state === "playing" ||
    state === "paused" ||
    state === "ended" ||
    state === "error"
  ) {
    return state;
  }

  return "idle";
}
