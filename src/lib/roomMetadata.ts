import type { RoomSnapshot } from "../types/room";
import { freshStamp } from "./metadataLifecycle";

export function sanitizeRoomSnapshot(snapshot: RoomSnapshot, persist = false): RoomSnapshot {
  return { ...snapshot, queue: snapshot.queue.map((item) => {
    if (!persist && freshStamp(item.metadataStamp)) return item;
    return { ...item, title: "YouTube 视频", channelTitle: undefined, thumbnailUrl: undefined, metadataStamp: undefined };
  }) };
}
