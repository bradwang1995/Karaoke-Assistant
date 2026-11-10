import { usePlaybackDecision, validDecision } from "../hooks/usePlaybackDecision";
import { translate as t, useLanguage } from "../i18n";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createYouTubeIframe } from "../lib/youtube";
import { canStartPlayback, claimPlayback, releasePlayback } from "../lib/playerVisibility";
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
  initialVolume?: number;
  onVolumeChange?: (volume: number) => void;
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
  setVolume: (volume: number) => void;
}

export type { PlayerProgress } from "../lib/playerProgress";

export const FullscreenPlayer = forwardRef<FullscreenPlayerHandle, FullscreenPlayerProps>(
  function FullscreenPlayer(
    {
      videoId,
      autoPlay,
      playRequestId,
      initialVolume,
      onVolumeChange,
      onPlaybackStarted,
      onPlaybackEnded,
      onPlaybackError,
      onAutoplayBlocked,
      onProgress,
      onStatusChange,
    },
    ref,
  ) {
  useLanguage();
  const gate = usePlaybackDecision(videoId);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const readyPlayerRef = useRef<YouTubePlayer | null>(null);
  const volumeRef = useRef(initialVolume);
  const pendingVolumeRef = useRef<{ value: number; expiresAt: number }>();
  const playbackOwner = useRef({ pause: () => playerRef.current?.pauseVideo?.() });
  const pendingPlayRef = useRef(false);
  const automaticPlayRef = useRef(true);
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
    onVolumeChange,
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

  const requestPlay = (player: YouTubePlayer, automatic = true, start = () => player.playVideo?.()) => {
    if (!startedRef.current && !validDecision(gate.decision, videoId)) { gate.retry(); return; }
    clearPlayRetryTimeouts();
    pendingPlayRef.current = true;
    automaticPlayRef.current = automatic;

    if (typeof player.playVideo !== "function") {
      return;
    }
    if (!shellRef.current || !canStartPlayback(shellRef.current, automatic)) {
      pendingPlayRef.current = false;
      updateStatus("blocked");
      callbacksRef.current.onAutoplayBlocked();
      return;
    }
    claimPlayback(playbackOwner.current);
    start();
    // Detect a silent browser rejection, but never retry without a user action.
    playRetryTimeoutsRef.current.push(window.setTimeout(() => {
      if (pendingPlayRef.current) {
        pendingPlayRef.current = false;
        updateStatus("blocked");
        callbacksRef.current.onAutoplayBlocked();
      }
    }, 2_000));
  };

  const requestRestart = (player: YouTubePlayer) => {
    if (!validDecision(gate.decision, videoId)) { gate.retry(); return; }
    if (!shellRef.current || !canStartPlayback(shellRef.current)) {
      pendingPlayRef.current = false;
      updateStatus("blocked");
      callbacksRef.current.onAutoplayBlocked();
      return;
    }
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

    // Atomically reload the room's video and play after the usual guards.
    // Cue/seek/play can race because cueVideoById completes asynchronously.
    requestPlay(player, true, () => {
      player.loadVideoById?.({ videoId, startSeconds: DISPLAY_PLAYBACK_START_SECONDS });
    });
  };

  const applyVolume = (player: YouTubePlayer, value: number) => {
    // Give the iframe time to report the new value before accepting an older reading.
    pendingVolumeRef.current = { value, expiresAt: performance.now() + 750 };
    player.setVolume?.(value);
    if (value > 0 && player.isMuted?.()) player.unMute?.();
  };

  useImperativeHandle(ref, () => ({
    setVolume(value) {
      volumeRef.current = value;
      if (readyPlayerRef.current) applyVolume(readyPlayerRef.current, value);
    },
    play() {
      if (playerRef.current) {
        requestPlay(playerRef.current, false);
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
      onVolumeChange,
    };
  }, [
    onAutoplayBlocked,
    onPlaybackEnded,
    onPlaybackError,
    onProgress,
    onPlaybackStarted,
    onStatusChange,
    onVolumeChange,
  ]);

  useEffect(() => {
    const shell = shellRef.current;
    let cancelled = false;
    let volumeInterval: number | undefined;

    pendingRestartRef.current = false;
    startedRef.current = false;
    endedRef.current = false;
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
    if (!gate.allowed) { updateStatus("blocked"); return; }
    loadYouTubeIframeApi(gate.decision!, videoId)
      .then((api) => {
        if (cancelled) {
          return;
        }

        const playerVars = {
          autoplay: 0,
          controls: 1,
          cc_load_policy: 0,
          disablekb: 0,
          enablejsapi: 1,
          fs: 1,
          iv_load_policy: 3,
          playsinline: 1,
          rel: 0,
          start: DISPLAY_PLAYBACK_START_SECONDS,
          origin: window.location.origin,
        };
        const host = createYouTubeIframe(videoId, playerVars, gate.decision!);
        shell.appendChild(host);
        const player = new api.Player(host, {
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
      window.clearInterval(volumeInterval);
      pendingVolumeRef.current = undefined;
      clearPlayRetryTimeouts();
      clearProgressInterval();
      playerRef.current?.destroy?.();
      releasePlayback(playbackOwner.current);
      playerRef.current = null;
      readyPlayerRef.current = null;
      shell.replaceChildren();
    };

    function handleReady(event: YouTubePlayerEvent) {
      if (cancelled) return;
      readyPlayerRef.current = event.target;
      if (callbacksRef.current.onVolumeChange) {
        if (volumeRef.current !== undefined) applyVolume(event.target, volumeRef.current);
        reportVolume();
        volumeInterval = window.setInterval(reportVolume, 200);
      }
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

    function reportVolume() {
      const player = readyPlayerRef.current;
      if (!player) return;
      const value = player.isMuted?.() ? 0 : player.getVolume?.();
      if (value === undefined || !Number.isFinite(value)) return;
      const pending = pendingVolumeRef.current;
      if (pending && value !== pending.value && performance.now() < pending.expiresAt) return;
      pendingVolumeRef.current = undefined;
      if (value === volumeRef.current) return;
      volumeRef.current = value;
      callbacksRef.current.onVolumeChange?.(value);
    }

    function handleStateChange(event: YouTubePlayerStateChangeEvent) {
      if (cancelled) return;
      if (event.data === YOUTUBE_PLAYER_STATE.PLAYING) {
        if (pendingPlayRef.current && (!shellRef.current || !canStartPlayback(shellRef.current, automaticPlayRef.current))) {
          event.target.pauseVideo?.();
          handleAutoplayBlocked();
          return;
        }
        if (!pendingPlayRef.current) automaticPlayRef.current = false;
        claimPlayback(playbackOwner.current);
        pendingPlayRef.current = false;
        clearPlayRetryTimeouts();
        startProgressInterval(event.target);
        updateStatus("playing");

        if (!startedRef.current) {
          gate.markStarted();
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
        pendingPlayRef.current = false;
        clearPlayRetryTimeouts();
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
  }, [autoPlay, videoId, gate.allowed]);

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

  useEffect(() => {
    const check = () => {
      if (playerRef.current && shellRef.current && !canStartPlayback(shellRef.current, automaticPlayRef.current)) {
        playerRef.current?.pauseVideo?.();
        if (pendingPlayRef.current) {
          pendingPlayRef.current = false;
          clearPlayRetryTimeouts();
          updateStatus("blocked");
          callbacksRef.current.onAutoplayBlocked();
        }
      }
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("resize", check);
    window.addEventListener("scroll", check, true);
    const observer = new IntersectionObserver(check, { threshold: [0, 0.5, 0.51, 1] });
    if (shellRef.current) observer.observe(shellRef.current);
    const dialogs = new MutationObserver(check);
    dialogs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("resize", check);
      window.removeEventListener("scroll", check, true);
      observer.disconnect();
      dialogs.disconnect();
    };
  }, []);

  return (
    <>
    <div
      ref={shellRef}
      data-player-status={status}
      className="absolute inset-0 h-full w-full bg-black [&_iframe]:h-full [&_iframe]:w-full"
    />
    {!gate.allowed ? <div className="absolute inset-0 grid place-items-center bg-black p-6 text-center text-white"><div>
      <p>{t(gate.denied ? "此视频暂不支持在本应用内播放" : gate.decision ? "无法确认视频状态，请重试" : "正在检查视频状态…")}</p>
      {gate.decision && !gate.denied ? <button type="button" className="mt-4 underline" onClick={gate.retry}>{t("重试")}</button> : null}
    </div></div> : null}
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
