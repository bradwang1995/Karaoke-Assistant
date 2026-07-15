import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  loadYouTubeIframeApi,
  YOUTUBE_PLAYER_STATE,
  type YouTubePlayer,
  type YouTubePlayerErrorEvent,
  type YouTubePlayerEvent,
  type YouTubePlayerStateChangeEvent,
} from "../lib/youtubeIframeApi";
import {
  DISPLAY_PLAYBACK_START_SECONDS,
  type PlayerProgress,
} from "../lib/playerProgress";

export type PlayerStatus =
  | "loading"
  | "ready"
  | "buffering"
  | "playing"
  | "paused"
  | "ended"
  | "blocked"
  | "error";

interface FullscreenPlayerProps {
  videoId: string;
  autoPlay: boolean;
  playRequestId: number;
  onPlaybackStarted: () => void;
  onPlaybackEnded: () => void;
  onPlaybackError: (errorCode: number) => void;
  onAutoplayBlocked: () => void;
  onProgress?: (progress: PlayerProgress) => void;
  onStatusChange?: (status: PlayerStatus) => void;
}

export interface FullscreenPlayerHandle {
  play: () => void;
  pause: () => void;
  restart: () => void;
  seekTo: (seconds: number) => void;
}

export type { PlayerProgress } from "../lib/playerProgress";

export const FullscreenPlayer = forwardRef<FullscreenPlayerHandle, FullscreenPlayerProps>(
  function FullscreenPlayer(
    {
      videoId,
      autoPlay,
      playRequestId,
      onPlaybackStarted,
      onPlaybackEnded,
      onPlaybackError,
      onAutoplayBlocked,
      onProgress,
      onStatusChange,
    },
    ref,
  ) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const pendingPlayRef = useRef(false);
  const pendingRestartRef = useRef(false);
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const lastPlayRequestRef = useRef(0);
  const playRetryTimeoutsRef = useRef<number[]>([]);
  const progressIntervalRef = useRef<number | null>(null);
  const callbacksRef = useRef({
    onPlaybackStarted,
    onPlaybackEnded,
    onPlaybackError,
    onAutoplayBlocked,
    onProgress,
    onStatusChange,
  });
  const [status, setStatus] = useState<PlayerStatus>("loading");

  const updateStatus = (nextStatus: PlayerStatus) => {
    setStatus(nextStatus);
    callbacksRef.current.onStatusChange?.(nextStatus);
  };

  const clearPlayRetryTimeouts = () => {
    for (const timeoutId of playRetryTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }

    playRetryTimeoutsRef.current = [];
  };

  const clearProgressInterval = () => {
    if (progressIntervalRef.current === null) {
      return;
    }

    window.clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = null;
  };

  const reportProgress = (player: YouTubePlayer) => {
    const currentTime = player.getCurrentTime?.() ?? 0;
    const duration = player.getDuration?.() ?? 0;

    callbacksRef.current.onProgress?.({
      currentTime: Number.isFinite(currentTime) ? Math.max(currentTime, 0) : 0,
      duration: Number.isFinite(duration) ? Math.max(duration, 0) : 0,
    });
  };

  const startProgressInterval = (player: YouTubePlayer) => {
    clearProgressInterval();
    reportProgress(player);
    progressIntervalRef.current = window.setInterval(() => reportProgress(player), 1_000);
  };

  const requestPlay = (player: YouTubePlayer) => {
    clearPlayRetryTimeouts();
    pendingPlayRef.current = true;

    if (typeof player.playVideo !== "function") {
      return;
    }

    player.playVideo();

    for (const delay of [250, 900]) {
      const timeoutId = window.setTimeout(() => {
        if (pendingPlayRef.current && typeof player.playVideo === "function") {
          player.playVideo();
        }
      }, delay);

      playRetryTimeoutsRef.current.push(timeoutId);
    }
  };

  const requestRestart = (player: YouTubePlayer) => {
    clearPlayRetryTimeouts();
    pendingRestartRef.current = false;
    pendingPlayRef.current = true;
    startedRef.current = false;
    endedRef.current = false;
    callbacksRef.current.onProgress?.({
      currentTime: DISPLAY_PLAYBACK_START_SECONDS,
      duration: 0,
    });
    updateStatus("loading");

    if (typeof player.loadVideoById === "function") {
      player.loadVideoById({
        videoId,
        startSeconds: DISPLAY_PLAYBACK_START_SECONDS,
      });
    }

    player.seekTo?.(DISPLAY_PLAYBACK_START_SECONDS, true);
    requestPlay(player);
  };

  useImperativeHandle(ref, () => ({
    play() {
      if (playerRef.current) {
        requestPlay(playerRef.current);
      } else {
        pendingPlayRef.current = true;
      }
    },
    pause() {
      playerRef.current?.pauseVideo?.();
    },
    restart() {
      if (playerRef.current) {
        requestRestart(playerRef.current);
      } else {
        pendingRestartRef.current = true;
        pendingPlayRef.current = true;
      }
    },
    seekTo(seconds: number) {
      if (!Number.isFinite(seconds) || !playerRef.current) {
        return;
      }

      playerRef.current.seekTo?.(Math.max(seconds, 0), true);
      reportProgress(playerRef.current);
    },
  }));

  useEffect(() => {
    callbacksRef.current = {
      onPlaybackStarted,
      onPlaybackEnded,
      onPlaybackError,
      onAutoplayBlocked,
      onProgress,
      onStatusChange,
    };
  }, [
    onAutoplayBlocked,
    onPlaybackEnded,
    onPlaybackError,
    onProgress,
    onPlaybackStarted,
    onStatusChange,
  ]);

  useEffect(() => {
    const shell = shellRef.current;
    let cancelled = false;

    pendingRestartRef.current = false;
    pendingPlayRef.current = autoPlay || playRequestId > 0;
    lastPlayRequestRef.current = playRequestId;
    callbacksRef.current.onProgress?.({
      currentTime: DISPLAY_PLAYBACK_START_SECONDS,
      duration: 0,
    });
    updateStatus("loading");

    if (!shell) {
      updateStatus("error");
      return;
    }

    shell.replaceChildren();
    const host = document.createElement("div");
    host.className = "h-full w-full";
    shell.appendChild(host);

    loadYouTubeIframeApi()
      .then((api) => {
        if (cancelled) {
          return;
        }

        const player = new api.Player(host, {
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            autoplay: autoPlay || playRequestId > 0 ? 1 : 0,
            controls: 0,
            cc_load_policy: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            playsinline: 1,
            rel: 0,
            start: DISPLAY_PLAYBACK_START_SECONDS,
            origin: window.location.origin,
          },
          events: {
            onReady: handleReady,
            onStateChange: handleStateChange,
            onError: handleError,
            onAutoplayBlocked: handleAutoplayBlocked,
          },
        });

        playerRef.current = player;
      })
      .catch(() => {
        if (!cancelled) {
          updateStatus("error");
        }
      });

    return () => {
      cancelled = true;
      clearPlayRetryTimeouts();
      clearProgressInterval();
      playerRef.current?.destroy?.();
      playerRef.current = null;
      shell.replaceChildren();
    };

    function handleReady(event: YouTubePlayerEvent) {
      updateStatus("ready");
      const currentShell = shellRef.current;

      if (currentShell) {
        allowIframeAutoplay(event.target, currentShell);
      }

      startProgressInterval(event.target);

      if (pendingRestartRef.current) {
        requestRestart(event.target);
        return;
      }

      if (pendingPlayRef.current) {
        requestPlay(event.target);
      }
    }

    function handleStateChange(event: YouTubePlayerStateChangeEvent) {
      if (event.data === YOUTUBE_PLAYER_STATE.PLAYING) {
        pendingPlayRef.current = false;
        clearPlayRetryTimeouts();
        startProgressInterval(event.target);
        updateStatus("playing");

        if (!startedRef.current) {
          startedRef.current = true;
          callbacksRef.current.onPlaybackStarted();
        }
        return;
      }

      if (event.data === YOUTUBE_PLAYER_STATE.ENDED) {
        clearPlayRetryTimeouts();
        reportProgress(event.target);
        clearProgressInterval();
        updateStatus("ended");

        if (!endedRef.current) {
          endedRef.current = true;
          callbacksRef.current.onPlaybackEnded();
        }
        return;
      }

      if (event.data === YOUTUBE_PLAYER_STATE.BUFFERING) {
        startProgressInterval(event.target);
        updateStatus("buffering");
        return;
      }

      if (event.data === YOUTUBE_PLAYER_STATE.PAUSED) {
        reportProgress(event.target);
        updateStatus("paused");
        return;
      }

      if (event.data === YOUTUBE_PLAYER_STATE.CUED) {
        updateStatus("ready");
      }
    }

    function handleError(event: YouTubePlayerErrorEvent) {
      clearPlayRetryTimeouts();
      clearProgressInterval();
      updateStatus("error");
      callbacksRef.current.onPlaybackError(event.data);
    }

    function handleAutoplayBlocked() {
      pendingPlayRef.current = false;
      clearPlayRetryTimeouts();
      clearProgressInterval();
      updateStatus("blocked");
      callbacksRef.current.onAutoplayBlocked();
    }
  }, [autoPlay, videoId]);

  useEffect(() => {
    if (playRequestId <= lastPlayRequestRef.current) {
      return;
    }

    lastPlayRequestRef.current = playRequestId;
    pendingPlayRef.current = true;
    if (playerRef.current) {
      requestPlay(playerRef.current);
    }
  }, [playRequestId]);

  return (
    <div
      ref={shellRef}
      className={`absolute inset-0 h-full w-full bg-black [&_iframe]:pointer-events-none [&_iframe]:h-full [&_iframe]:w-full ${
        status === "ended" || status === "error" ? "invisible" : ""
      }`}
    />
  );
  },
);

function allowIframeAutoplay(player: YouTubePlayer, shell: HTMLElement) {
  const iframe = player.getIframe?.() ?? shell.querySelector("iframe");

  iframe?.setAttribute(
    "allow",
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
  );
}
