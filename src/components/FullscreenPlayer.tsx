import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  loadYouTubeIframeApi,
  YOUTUBE_PLAYER_STATE,
  type YouTubePlayer,
  type YouTubePlayerErrorEvent,
  type YouTubePlayerEvent,
  type YouTubePlayerQualityChangeEvent,
  type YouTubePlayerStateChangeEvent,
} from "../lib/youtubeIframeApi";
import {
  isYouTubePlaybackQuality,
  normalizeAvailableYouTubePlaybackQualities,
  type YouTubePlaybackQuality,
} from "../lib/youtubePlaybackQuality";

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
  title: string;
  autoPlay: boolean;
  playRequestId: number;
  playbackQuality: YouTubePlaybackQuality;
  onPlaybackStarted: () => void;
  onPlaybackEnded: () => void;
  onPlaybackError: (errorCode: number) => void;
  onAutoplayBlocked: () => void;
  onPlaybackQualityStatusChange?: (status: PlayerQualityStatus) => void;
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

export interface PlayerQualityStatus {
  availableQualities: YouTubePlaybackQuality[];
  playbackQuality: YouTubePlaybackQuality | null;
}

export const FullscreenPlayer = forwardRef<FullscreenPlayerHandle, FullscreenPlayerProps>(
  function FullscreenPlayer(
    {
      videoId,
      title,
      autoPlay,
      playRequestId,
      playbackQuality,
      onPlaybackStarted,
      onPlaybackEnded,
      onPlaybackError,
      onAutoplayBlocked,
      onPlaybackQualityStatusChange,
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
  const qualityRetryTimeoutsRef = useRef<number[]>([]);
  const qualityStatusTimeoutsRef = useRef<number[]>([]);
  const progressIntervalRef = useRef<number | null>(null);
  const lastQualityStatusSignatureRef = useRef("");
  const playbackQualityRef = useRef(playbackQuality);
  const callbacksRef = useRef({
    onPlaybackStarted,
    onPlaybackEnded,
    onPlaybackError,
    onAutoplayBlocked,
    onPlaybackQualityStatusChange,
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

  const clearQualityRetryTimeouts = () => {
    for (const timeoutId of qualityRetryTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }

    qualityRetryTimeoutsRef.current = [];
  };

  const clearQualityStatusTimeouts = () => {
    for (const timeoutId of qualityStatusTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }

    qualityStatusTimeoutsRef.current = [];
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

  const reportQualityStatus = (player: YouTubePlayer) => {
    const availableQualities = normalizeAvailableYouTubePlaybackQualities(
      player.getAvailableQualityLevels?.() ?? [],
    );
    const rawPlaybackQuality = player.getPlaybackQuality?.();
    const playbackQuality = isYouTubePlaybackQuality(rawPlaybackQuality)
      ? rawPlaybackQuality
      : null;
    const signature = `${playbackQuality ?? ""}|${availableQualities.join(",")}`;

    if (signature === lastQualityStatusSignatureRef.current) {
      return;
    }

    lastQualityStatusSignatureRef.current = signature;
    callbacksRef.current.onPlaybackQualityStatusChange?.({
      availableQualities,
      playbackQuality,
    });
  };

  const scheduleQualityStatusReports = (player: YouTubePlayer) => {
    clearQualityStatusTimeouts();
    reportQualityStatus(player);

    for (const delay of [300, 1_000, 2_500, 5_000]) {
      const timeoutId = window.setTimeout(() => {
        reportQualityStatus(player);
      }, delay);

      qualityStatusTimeoutsRef.current.push(timeoutId);
    }
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
    pendingRestartRef.current = false;
    pendingPlayRef.current = true;

    if (typeof player.loadVideoById === "function") {
      player.loadVideoById({ videoId, startSeconds: 0 });
    } else {
      player.seekTo?.(0, true);
    }

    requestPlay(player);
  };

  const applyPlaybackQuality = (player: YouTubePlayer) => {
    clearQualityRetryTimeouts();
    player.setPlaybackQuality?.(playbackQualityRef.current);

    for (const delay of [250, 900, 2_000, 4_000]) {
      const timeoutId = window.setTimeout(() => {
        player.setPlaybackQuality?.(playbackQualityRef.current);
        reportQualityStatus(player);
      }, delay);

      qualityRetryTimeoutsRef.current.push(timeoutId);
    }
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
      onPlaybackQualityStatusChange,
      onProgress,
    };
  }, [
    onAutoplayBlocked,
    onPlaybackEnded,
    onPlaybackError,
    onPlaybackQualityStatusChange,
    onProgress,
    onPlaybackStarted,
  ]);

  useEffect(() => {
    playbackQualityRef.current = playbackQuality;

    if (playerRef.current) {
      applyPlaybackQuality(playerRef.current);
      scheduleQualityStatusReports(playerRef.current);
    }
  }, [playbackQuality]);

  useEffect(() => {
    const shell = shellRef.current;
    let cancelled = false;

    startedRef.current = false;
    endedRef.current = false;
    pendingRestartRef.current = false;
    clearQualityStatusTimeouts();
    lastQualityStatusSignatureRef.current = "";
    pendingPlayRef.current = autoPlay || playRequestId > 0;
    lastPlayRequestRef.current = playRequestId;
    callbacksRef.current.onProgress?.({ currentTime: 0, duration: 0 });
    callbacksRef.current.onPlaybackQualityStatusChange?.({
      availableQualities: [],
      playbackQuality: null,
    });
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
            disablefs: 1,
            enablejsapi: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
            vq: playbackQualityRef.current,
          },
          events: {
            onReady: handleReady,
            onStateChange: handleStateChange,
            onError: handleError,
            onPlaybackQualityChange: handlePlaybackQualityChange,
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
      clearQualityRetryTimeouts();
      clearQualityStatusTimeouts();
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

      applyPlaybackQuality(event.target);
      startProgressInterval(event.target);
      scheduleQualityStatusReports(event.target);

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
        event.target.setPlaybackQuality?.(playbackQualityRef.current);
        scheduleQualityStatusReports(event.target);
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
        event.target.setPlaybackQuality?.(playbackQualityRef.current);
        scheduleQualityStatusReports(event.target);
        startProgressInterval(event.target);
        setStatus("buffering");
        return;
      }

      if (event.data === YOUTUBE_PLAYER_STATE.PAUSED) {
        reportQualityStatus(event.target);
        reportProgress(event.target);
        setStatus("paused");
        return;
      }

      if (event.data === YOUTUBE_PLAYER_STATE.CUED) {
        scheduleQualityStatusReports(event.target);
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

    function handlePlaybackQualityChange(event: YouTubePlayerQualityChangeEvent) {
      reportQualityStatus(event.target);
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
        title={title}
        className="absolute inset-0 h-full w-full bg-black [&_iframe]:h-full [&_iframe]:w-full"
      />
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
