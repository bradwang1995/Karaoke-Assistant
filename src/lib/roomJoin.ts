export const ROOM_JOIN_ROUTE = "/j/:roomId";

export function roomJoinUrl(origin: string, roomId: string) {
  return new URL(
    ROOM_JOIN_ROUTE.replace(":roomId", encodeURIComponent(roomId)),
    origin,
  ).href;
}
