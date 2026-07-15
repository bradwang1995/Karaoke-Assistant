import {
  MonitorPlay,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FullscreenPlayer,
  type FullscreenPlayerHandle,
  type PlayerProgress,
  type PlayerStatus,
} from "../components/FullscreenPlayer";
import { useRoomSocket, type SocketStatus } from "../hooks/useRoomSocket";
import { fetchYouTubeQuotaStatus } from "../lib/apiClient";
import { formatRelativeQuotaReset } from "../lib/quotaReset";
import { getCurrentItem, getQueuedItems } from "../lib/roomReducer";
import {
  createPlayerProgressSession,
  getPlayerProgressForItem,
  type PlayerProgressSession,
} from "../lib/playerProgress";
import {
  playerEnded,
  playerStarted,
  restartCurrentSong,
  useRoomSnapshot,
} from "../lib/roomState";
import type { QueueItem } from "../types/room";
import type { YouTubeQuotaStatus } from "../types/youtube";

export default function DisplayPage() {
  const { roomId = "" } = useParams();
  const roomSocket = useRoomSocket({ roomId, role: "display" });
  const snapshot = useRoomSnapshot(roomId);
  const currentItem = getCurrentItem(snapshot);
  const queuedItems = getQueuedItems(snapshot);
  const [playRequestId, setPlayRequestId] = useState(0);
  const [playerIssue, setPlayerIssue] = useState<string | null>(null);
  const [playerProgress, setPlayerProgress] = useState<PlayerProgressSession>(() =>
    createPlayerProgressSession(null),
  );
  const [seekSeconds, setSeekSeconds] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("loading");
  const playerHandleRef = useRef<FullscreenPlayerHandle | null>(null);
  const lastAutoPlayItemIdRef = useRef<string | null>(null);
  const handledLoadingPlaybackKeyRef = useRef<string | null>(null);
  const quotaQuery = useQuery({
    queryKey: ["youtube-quota-status"],
    queryFn: fetchYouTubeQuotaStatus,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const mobileUrl = useMemo(() => {
    const path = `/room/${roomId}/mobile`;
    return `${window.location.origin}${path}`;
  }, [roomId]);

  const sendPlayerStarted = useCallback(
    (item: QueueItem) => {
      if (roomSocket.status === "connected") {
        if (!roomSocket.send({
          type: "PLAYER_STARTED",
          payload: {
            queueItemId: item.id,
            videoId: item.videoId,
          },
        })) {
          setPlayerIssue("房间连接正在恢复，播放状态暂未同步。");
        }
      } else if (roomSocket.canUseLocalFallback) {
        playerStarted(roomId, item.id, item.videoId);
      } else {
        setPlayerIssue("房间连接正在恢复，播放状态暂未同步。");
      }
    },
    [roomId, roomSocket],
  );

  const sendPlayerEnded = useCallback(
    (item: QueueItem) => {
      if (roomSocket.status === "connected") {
        if (!roomSocket.send({
          type: "PLAYER_ENDED",
          payload: {
            queueItemId: item.id,
            videoId: item.videoId,
          },
        })) {
          setPlayerIssue("房间连接正在恢复，请稍后再切歌。");
        }
      } else if (roomSocket.canUseLocalFallback) {
        playerEnded(roomId, item.id, item.videoId);
      } else {
        setPlayerIssue("房间连接正在恢复，请稍后再切歌。");
      }
    },
    [roomId, roomSocket],
  );

  const sendRestartCurrentItem = useCallback(
    (item: QueueItem) => {
      if (roomSocket.status === "connected") {
        if (!roomSocket.send({
          type: "RESTART_CURRENT_ITEM",
          payload: {
            queueItemId: item.id,
            videoId: item.videoId,
          },
        })) {
          setPlayerIssue("房间连接正在恢复，请稍后再重播。");
          return false;
        }

        return true;
      }

      if (roomSocket.canUseLocalFallback) {
        restartCurrentSong(roomId, item.id, item.videoId);
        return true;
      }

      setPlayerIssue("房间连接正在恢复，请稍后再重播。");
      return false;
    },
    [roomId, roomSocket],
  );

  useEffect(() => {
    if (!currentItem) {
      lastAutoPlayItemIdRef.current = null;
      setPlayerProgress(createPlayerProgressSession(null));
      setSeekSeconds(0);
      setIsSeeking(false);
      setPlayerStatus("loading");
      return;
    }

    if (lastAutoPlayItemIdRef.current === currentItem.id) {
      return;
    }

    lastAutoPlayItemIdRef.current = currentItem.id;
    handledLoadingPlaybackKeyRef.current = playbackLoadingKey(
      currentItem.id,
      snapshot.playback.updatedAt,
    );
    setPlayerProgress(createPlayerProgressSession(currentItem.id));
    setSeekSeconds(0);
    setIsSeeking(false);
    setPlayerStatus("loading");
    setPlayerIssue(null);
    setPlayRequestId((requestId) => requestId + 1);
  }, [currentItem?.id, snapshot.playback.updatedAt]);

  useEffect(() => {
    if (!currentItem || snapshot.playback.playerState !== "loading") {
      return;
    }

    const loadingKey = playbackLoadingKey(currentItem.id, snapshot.playback.updatedAt);

    if (handledLoadingPlaybackKeyRef.current === loadingKey) {
      return;
    }

    handledLoadingPlaybackKeyRef.current = loadingKey;
    setPlayerIssue(null);
    playerHandleRef.current?.restart();
  }, [currentItem, snapshot.playback.playerState, snapshot.playback.updatedAt]);

  const handlePlaybackStarted = useCallback(() => {
    if (!currentItem) return;
    setPlayerIssue(null);
    sendPlayerStarted(currentItem);
  }, [currentItem, sendPlayerStarted]);

  const handlePlaybackEnded = useCallback(() => {
    if (!currentItem) return;
    sendPlayerEnded(currentItem);
  }, [currentItem, sendPlayerEnded]);

  const handlePlaybackError = useCallback((errorCode: number) => {
    setPlayerIssue(`播放器错误 ${errorCode}`);
  }, []);

  const handleAutoplayBlocked = useCallback(() => {
    setPlayerIssue("浏览器阻止了自动播放，请使用下方的播放按钮。");
  }, []);

  const handleProgress = useCallback(
    (progress: PlayerProgress) => {
      if (!currentItem) {
        return;
      }

      setPlayerProgress(createPlayerProgressSession(currentItem.id, progress));

      if (!isSeeking) {
        setSeekSeconds(progress.currentTime);
      }
    },
    [currentItem, isSeeking],
  );

  const handleSeekChange = (seconds: number) => {
    setSeekSeconds(seconds);
  };

  const commitSeek = () => {
    if (!currentItem || !Number.isFinite(seekSeconds)) {
      setIsSeeking(false);
      return;
    }

    playerHandleRef.current?.seekTo(seekSeconds);
    setIsSeeking(false);
  };

  const handleNext = () => {
    if (!currentItem) return;
    setPlayerIssue(null);
    sendPlayerEnded(currentItem);
  };

  const handleRestart = () => {
    if (!currentItem) return;
    setPlayerIssue(null);
    sendRestartCurrentItem(currentItem);
  };

  const handlePauseToggle = () => {
    if (!currentItem) return;
    setPlayerIssue(null);

    if (playerStatus === "playing" || playerStatus === "buffering") {
      playerHandleRef.current?.pause();
      return;
    }

    playerHandleRef.current?.play();
  };

  const currentProgress = getPlayerProgressForItem(playerProgress, currentItem?.id ?? null);
  const pauseButtonLabel =
    playerStatus === "playing" || playerStatus === "buffering"
      ? "暂停"
      : playerStatus === "paused"
        ? "继续"
        : "播放";
  const PauseButtonIcon =
    playerStatus === "playing" || playerStatus === "buffering" ? Pause : Play;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(20,184,166,0.22),transparent_30%),radial-gradient(circle_at_78%_78%,rgba(251,113,133,0.18),transparent_28%)]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="qr-code-card absolute right-5 top-16 z-30 hidden rounded-2xl border border-white/15 bg-slate-950/90 p-3 text-white shadow-[0_18px_50px_rgba(2,6,23,0.65)] backdrop-blur sm:block">
          <div className="mb-2 flex items-center justify-center">
            <Link
              to={`/room/${roomId}/mobile`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold tracking-wide text-white transition hover:text-teal-200"
            >
              扫码点歌
            </Link>
          </div>
          <Link
            to={`/room/${roomId}/mobile`}
            target="_blank"
            rel="noreferrer"
            aria-label="打开扫码点歌手机页"
            className="qr-code-surface block rounded-lg bg-white p-2 focus:outline-none focus:ring-4 focus:ring-teal-300/40"
          >
            <QRCodeCanvas
              value={mobileUrl}
              size={140}
              level="H"
              bgColor="#ffffff"
              fgColor="#000000"
              className="qr-code-canvas"
            />
          </Link>
        </div>

        <section className="relative min-h-[360px] flex-1 bg-black">
          {currentItem ? (
            <FullscreenPlayer
              ref={playerHandleRef}
              key={currentItem.id}
              videoId={currentItem.videoId}
              autoPlay
              playRequestId={playRequestId}
              onPlaybackStarted={handlePlaybackStarted}
              onPlaybackEnded={handlePlaybackEnded}
              onPlaybackError={handlePlaybackError}
              onAutoplayBlocked={handleAutoplayBlocked}
              onProgress={handleProgress}
              onStatusChange={setPlayerStatus}
            />
          ) : (
            <div className="grid h-full min-h-[420px] place-items-center px-6 text-center">
              <div>
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-xl bg-white/10 text-teal-200">
                  <MonitorPlay size={32} />
                </div>
                <h1 className="text-3xl font-semibold tracking-normal sm:text-5xl">
                  当前没有视频播放
                </h1>
                <p className="mt-4 text-base text-slate-300">
                  让朋友扫码点歌，第一首会自动排到这里。
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="relative z-20 border-t border-white/10 bg-slate-950 px-4 py-4 shadow-2xl">
          <div className="grid gap-4 text-sm lg:grid-cols-[12rem_minmax(0,1fr)_22rem] lg:items-center">
            <div className="min-w-0 lg:self-start">
              <ConnectionBadge
                status={roomSocket.status}
                canUseLocalFallback={roomSocket.canUseLocalFallback}
              />
              <YouTubeQuotaStatus
                status={quotaQuery.data}
                isLoading={quotaQuery.isPending}
                isError={quotaQuery.isError}
              />
            </div>
            <div className="min-w-0 text-center">
              <h2 className="truncate text-xl font-semibold tracking-normal sm:text-2xl">
                {currentItem?.title ?? "等待点歌"}
              </h2>
              {playerIssue ? (
                <p className="mt-2 text-sm font-medium text-rose-200">{playerIssue}</p>
              ) : null}
              {currentItem ? (
                <PlayerProgressControl
                  currentTime={isSeeking ? seekSeconds : currentProgress.currentTime}
                  duration={currentProgress.duration}
                  onSeekStart={() => setIsSeeking(true)}
                  onSeekChange={handleSeekChange}
                  onSeekCommit={commitSeek}
                />
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {currentItem ? (
                <div className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.07] p-1.5 shadow-lg shadow-black/20">
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/20"
                  >
                    <RotateCcw size={17} />
                    重播
                  </button>
                  <button
                    type="button"
                    onClick={handlePauseToggle}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-teal-400 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-teal-300 focus:outline-none focus:ring-4 focus:ring-teal-300/30"
                  >
                    <PauseButtonIcon size={17} />
                    {pauseButtonLabel}
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-300/25 bg-rose-300/15 px-3 py-2 text-sm font-semibold text-rose-50 transition hover:bg-rose-300/25 focus:outline-none focus:ring-4 focus:ring-rose-300/20"
                  >
                    <SkipForward size={17} />
                    下一首
                  </button>
                </div>
              ) : null}
              <div className="border-l border-white/15 py-1 pl-3 text-right">
                <p className="text-xs text-slate-300">即将播放</p>
                <p className="text-lg font-semibold">{queuedItems.length} 首</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function PlayerProgressControl({
  currentTime,
  duration,
  onSeekStart,
  onSeekChange,
  onSeekCommit,
}: {
  currentTime: number;
  duration: number;
  onSeekStart: () => void;
  onSeekChange: (seconds: number) => void;
  onSeekCommit: () => void;
}) {
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;
  const safeCurrentTime = Math.min(
    Number.isFinite(currentTime) ? Math.max(currentTime, 0) : 0,
    safeDuration || 0,
  );
  const disabled = safeDuration <= 0;
  const playedPercent = disabled ? 0 : (safeCurrentTime / safeDuration) * 100;

  return (
    <div className="mx-auto mt-3 flex w-full max-w-3xl items-center gap-3 text-sm text-slate-200">
      <span className="w-12 shrink-0 tabular-nums">{formatPlayerTime(safeCurrentTime)}</span>
      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[0.45rem] -translate-y-1/2 overflow-hidden rounded-full bg-slate-500/60">
          <div
            className="h-full rounded-full bg-teal-400"
            style={{ width: `${playedPercent}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(Math.floor(safeDuration), 0)}
          step={1}
          value={disabled ? 0 : Math.floor(safeCurrentTime)}
          disabled={disabled}
          onPointerDown={onSeekStart}
          onPointerUp={onSeekCommit}
          onBlur={onSeekCommit}
          onKeyDown={onSeekStart}
          onKeyUp={onSeekCommit}
          onChange={(event) => {
            onSeekStart();
            onSeekChange(Number(event.target.value));
          }}
          aria-label="播放进度"
          className="player-progress-range relative z-10 w-full disabled:opacity-40"
        />
      </div>
      <span className="w-12 shrink-0 text-right tabular-nums">{formatPlayerTime(safeDuration)}</span>
    </div>
  );
}

function formatPlayerTime(seconds: number) {
  const totalSeconds = Math.max(Math.floor(seconds), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function YouTubeQuotaStatus({
  status,
  isLoading,
  isError,
}: {
  status: YouTubeQuotaStatus | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return <p className="mt-2 text-xs text-slate-400">搜索额度加载中</p>;
  }

  if (isError || !status) {
    return <p className="mt-2 text-xs text-slate-400">搜索额度暂不可用</p>;
  }

  return (
    <div
      className={`mt-2 space-y-1 text-xs font-medium ${
        status.exhausted ? "text-amber-200" : "text-slate-400"
      }`}
    >
      <p>今日搜索剩余 {status.remaining}/{status.dailyLimit}</p>
      <p>{formatRelativeQuotaReset(status.resetAt)}</p>
    </div>
  );
}

function playbackLoadingKey(queueItemId: string, updatedAt: string) {
  return `${queueItemId}:${updatedAt}`;
}

function ConnectionBadge({
  status,
  canUseLocalFallback,
}: {
  status: SocketStatus;
  canUseLocalFallback: boolean;
}) {
  const connected = status === "connected";
  const Icon = connected ? Wifi : WifiOff;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold backdrop-blur ${
        connected
          ? "bg-emerald-500/90 text-emerald-950"
          : canUseLocalFallback
            ? "bg-white/12 text-white"
            : "bg-amber-400/90 text-amber-950"
      }`}
    >
      <Icon size={15} />
      {connectionLabel(status, canUseLocalFallback)}
    </span>
  );
}

function connectionLabel(status: SocketStatus, canUseLocalFallback: boolean) {
  if (canUseLocalFallback) return "本地模式";
  if (status === "connected") return "实时已连接";
  if (status === "connecting") return "正在连接";
  if (status === "reconnecting") return "正在重连";
  return "连接不可用";
}
