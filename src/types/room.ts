export type RoomId = string;
export type QueueItemId = string;
export type ClientId = string;

export type QueueItemStatus = "queued" | "playing" | "completed" | "removed";

export interface Room {
  id: RoomId;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface QueueItem {
  metadataStamp?: import("./youtube").ApiStamp;
  id: QueueItemId;
  roomId: RoomId;
  videoId: string;
  title: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  requestedBy?: string;
  status: QueueItemStatus;
  sortKey: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaybackState {
  roomId: RoomId;
  currentQueueItemId: QueueItemId | null;
  currentVideoId: string | null;
  playerState: "idle" | "loading" | "playing" | "paused" | "ended" | "error";
  startedAt?: string;
  updatedAt: string;
}

export interface RoomSnapshot {
  room: Room;
  queue: QueueItem[];
  playback: PlaybackState;
  connectedClients: number;
}

export interface QueueItemInput {
  metadataStamp?: import("./youtube").ApiStamp;
  videoId: string;
  title: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  requestedBy?: string;
}

