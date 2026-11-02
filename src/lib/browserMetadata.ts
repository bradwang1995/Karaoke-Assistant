import { sanitizeRoomSnapshot } from "./roomMetadata";
import type { RoomSnapshot } from "../types/room";

// A returning browser can be cleaned; a browser that never reconnects cannot.
export function clearPersistedApiMetadata(storage: Storage) {
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => Boolean(key));
  for (const key of keys) {
    if (!key.startsWith("ktv-assistant:mobile-search:") && !key.startsWith("ktv-assistant:room:")) continue;
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      if (key.startsWith("ktv-assistant:room:")) {
        storage.setItem(key, JSON.stringify(sanitizeRoomSnapshot(JSON.parse(raw) as RoomSnapshot, true)));
      } else {
        const state = JSON.parse(raw);
        if (!Number.isFinite(state.savedAt) || state.savedAt > Date.now() || Date.now() - state.savedAt >= 86400000) storage.removeItem(key);
        else storage.setItem(key, JSON.stringify({ ...state, response: null, activePreviewVideoId: null }));
      }
    } catch { storage.removeItem(key); }
  }
}
