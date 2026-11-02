import type { ClientId, RoomSnapshot } from "./room";
import type { YouTubeQuotaStatus } from "./youtube";

export type ClientRole = "display" | "mobile";

export type ClientToServerMessage =
  | {
      type: "JOIN_ROOM";
      role: ClientRole;
      clientId: ClientId;
      displayName?: string;
    }
  | {
      type: "ADD_QUEUE_ITEM";
      payload: {
        videoId: string;
        metadataStamp?: import("./youtube").ApiStamp;
        title: string;
        channelTitle?: string;
        thumbnailUrl?: string;
        requestedBy?: string;
      };
    }
  | {
      type: "PROMOTE_QUEUE_ITEM";
      payload: {
        queueItemId: string;
      };
    }
  | {
      type: "REMOVE_QUEUE_ITEM";
      payload: {
        queueItemId: string;
      };
    }
  | {
      type: "PLAYER_STARTED";
      payload: {
        queueItemId: string;
        videoId: string;
      };
    }
  | {
      type: "PLAYER_ENDED";
      payload: {
        queueItemId: string;
        videoId: string;
      };
    }
  | {
      type: "RESTART_CURRENT_ITEM";
      payload: {
        queueItemId: string;
        videoId: string;
      };
    }
  | {
      type: "PING";
    };

export type ServerToClientMessage =
  | {
      type: "ROOM_SNAPSHOT";
      payload: RoomSnapshot;
    }
  | {
      type: "ROOM_UPDATED";
      payload: RoomSnapshot;
    }
  | {
      type: "ERROR";
      payload: {
        code: string;
        message: string;
      };
    }
  | {
      type: "YOUTUBE_QUOTA_UPDATED";
      payload: YouTubeQuotaStatus;
    }
  | {
      type: "PONG";
    };
