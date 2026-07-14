import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  loadYouTubeIframeApi,
  YOUTUBE_PLAYER_STATE,
  type YouTubePlayer,
  type YouTubePlayerErrorEvent,
  type YouTubePlayerEvent,
  type YouTubePlayerStateChangeEvent,
} from "../lib/youtubeIframeApi";

type PlayerStatus =
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
}

export interface FullscreenPlayerHandle {
  play: () => void;
  restart: () => void;
  seekTo: (seconds: number) => void;
}

export interface PlayerProgress {
  currentTime: number;
  duration: number;
}

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
  });
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [errorCode, setErrorCode] = useState<number | null>(null);

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
    callbacksRef.current.onProgress?.({ currentTime: 0, duration: 0 });
    setStatus("loading");

    if (typeof player.loadVideoById === "function") {
      player.loadVideoById({ videoId, startSeconds: 0 });
    }

    player.seekTo?.(0, true);
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
    };
  }, [
    onAutoplayBlocked,
    onPlaybackEnded,
    onPlaybackError,
    onProgress,
    onPlaybackStarted,
  ]);

  useEffect(() => {
    const shell = shellRef.current;
    let cancelled = false;

    startedRef.current = false;
    endedRef.current = false;
    pendingRestartRef.current = false;
    pendingPlayRef.current = autoPlay || playRequestId > 0;
    lastPlayRequestRef.current = playRequestId;
    callbacksRef.current.onProgress?.({ currentTime: 0, duration: 0 });
    setStatus("loading");
    setErrorCode(null);

    if (!shell) {
      setStatus("error");
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
            disablefs: 1,
            enablejsapi: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
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
          setStatus("error");
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
      setStatus("ready");
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
        setStatus("playing");

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
        setStatus("ended");

        if (!endedRef.current) {
          endedRef.current = true;
          callbacksRef.current.onPlaybackEnded();
        }
        return;
      }

      if (event.data === YOUTUBE_PLAYER_STATE.BUFFERING) {
        startProgressInterval(event.target);
        setStatus("buffering");
        return;
      }

      if (event.data === YOUTUBE_PLAYER_STATE.PAUSED) {
        reportProgress(event.target);
        setStatus("paused");
        return;
      }

      if (event.data === YOUTUBE_PLAYER_STATE.CUED) {
        setStatus("ready");
      }
    }

    function handleError(event: YouTubePlayerErrorEvent) {
      clearPlayRetryTimeouts();
      clearProgressInterval();
      setErrorCode(event.data);
      setStatus("error");
      callbacksRef.current.onPlaybackError(event.data);
    }

    function handleAutoplayBlocked() {
      pendingPlayRef.current = false;
      clearPlayRetryTimeouts();
      clearProgressInterval();
      setStatus("blocked");
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

  const statusText = getStatusText(status, errorCode);

  return (
    <>
      <div
        ref={shellRef}
        className="absolute inset-0 h-full w-full bg-black [&_iframe]:pointer-events-none [&_iframe]:h-full [&_iframe]:w-full"
      />
      <button
        type="button"
        aria-label="播放当前歌曲"
        onClick={() => {
          if (playerRef.current) {
            requestPlay(playerRef.current);
          }
        }}
        className="absolute inset-0 z-[5] cursor-default bg-transparent focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-teal-300/60"
      />
      {status === "ended" ? <div className="pointer-events-none absolute inset-0 z-[6] bg-black" /> : null}
      {statusText ? (
        <div className="pointer-events-none absolute left-4 top-16 z-10 rounded-lg bg-black/60 px-3 py-2 text-sm font-medium text-white backdrop-blur">
          {statusText}
        </div>
      ) : null}
    </>
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

function getStatusText(status: PlayerStatus, errorCode: number | null) {
  switch (status) {
    case "loading":
      return "播放器加载中";
    case "buffering":
      return "缓冲中";
    case "blocked":
      return "浏览器阻止了自动播放";
    case "error":
      return errorCode ? `播放失败 (${errorCode})` : "播放失败";
    default:
      return "";
  }
}
