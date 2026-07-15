export interface PlayerProgress {
  currentTime: number;
  duration: number;
}

export interface PlayerProgressSession extends PlayerProgress {
  queueItemId: string | null;
}

export const DISPLAY_PLAYBACK_START_SECONDS = 0;

const EMPTY_PROGRESS: PlayerProgress = {
  currentTime: DISPLAY_PLAYBACK_START_SECONDS,
  duration: 0,
};

export function createPlayerProgressSession(
  queueItemId: string | null,
  progress: PlayerProgress = EMPTY_PROGRESS,
): PlayerProgressSession {
  return {
    queueItemId,
    currentTime: progress.currentTime,
    duration: progress.duration,
  };
}

export function getPlayerProgressForItem(
  session: PlayerProgressSession,
  queueItemId: string | null,
): PlayerProgress {
  if (!queueItemId || session.queueItemId !== queueItemId) {
    return { ...EMPTY_PROGRESS };
  }

  return {
    currentTime: session.currentTime,
    duration: session.duration,
  };
}
