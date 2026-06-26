import {
  Check,
  Copy,
  ExternalLink,
  MonitorPlay,
  QrCode,
  SlidersHorizontal,
  SkipForward,
  Wifi,
  WifiOff,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FullscreenPlayer, type FullscreenPlayerHandle } from "../components/FullscreenPlayer";
import { useRoomSocket, type SocketStatus } from "../hooks/useRoomSocket";
import { copyTextToClipboard } from "../lib/clipboard";
import { getCurrentItem, getQueuedItems } from "../lib/roomReducer";
import { playerEnded, playerStarted, useRoomSnapshot } from "../lib/roomState";
import {
  readPreferredYouTubePlaybackQuality,
  resolveYouTubePlaybackQuality,
  savePreferredYouTubePlaybackQuality,
  YOUTUBE_PLAYBACK_QUALITY_OPTIONS,
  type YouTubePlaybackQuality,
} from "../lib/youtubePlaybackQuality";
import type { QueueItem } from "../types/room";

export default function DisplayPage() {
  const { roomId = "" } = useParams();
  const roomSocket = useRoomSocket({ roomId, role: "display" });
  const snapshot = useRoomSnapshot(roomId);
  const currentItem = getCurrentItem(snapshot);
  const queuedItems = getQueuedItems(snapshot);
  const [playRequestId, setPlayRequestId] = useState(0);
  const [playerIssue, setPlayerIssue] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [playbackQuality, setPlaybackQuality] = useState<YouTubePlaybackQuality>(() =>
    readPreferredYouTubePlaybackQuality(),
  );
  const playerHandleRef = useRef<FullscreenPlayerHandle | null>(null);
  const lastAutoPlayItemIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!currentItem) {
      lastAutoPlayItemIdRef.current = null;
      return;
    }

    if (lastAutoPlayItemIdRef.current === currentItem.id) {
      return;
    }

    lastAutoPlayItemIdRef.current = currentItem.id;
    setPlayerIssue(null);
    setPlayRequestId((requestId) => requestId + 1);
  }, [currentItem?.id]);

  const handleStart = () => {
    if (!currentItem) return;
    lastAutoPlayItemIdRef.current = currentItem.id;
    setPlayerIssue(null);
    playerHandleRef.current?.play();
    setPlayRequestId((requestId) => requestId + 1);
  };

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
    setPlayerIssue("浏览器阻止了自动播放，请点底部开始 K 歌。");
  }, []);

  const handlePlaybackQualityChange = useCallback((nextQuality: YouTubePlaybackQuality) => {
    setPlaybackQuality(nextQuality);
    savePreferredYouTubePlaybackQuality(nextQuality);
  }, []);

  const handleNext = () => {
    if (!currentItem) return;
    setPlayerIssue(null);
    sendPlayerEnded(currentItem);
  };

  const handleQualitySelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextQuality = resolveYouTubePlaybackQuality(event.target.value);

    setPlaybackQuality(nextQuality);
    savePreferredYouTubePlaybackQuality(nextQuality);
  };

  const copyMobileLink = async () => {
    try {
      await copyTextToClipboard(mobileUrl);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1_600);
    } catch {
      setCopyState("error");
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(20,184,166,0.22),transparent_30%),radial-gradient(circle_at_78%_78%,rgba(251,113,133,0.18),transparent_28%)]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="absolute right-4 top-20 z-30 hidden rounded-lg bg-white p-3 text-slate-950 shadow-glow sm:block">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <QrCode size={14} />
              扫码点歌
            </span>
            <button
              type="button"
              title="复制手机链接"
              onClick={copyMobileLink}
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            >
              {copyState === "copied" ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <QRCodeSVG value={mobileUrl} size={132} level="M" includeMargin />
          <Link
            to={`/room/${roomId}/mobile`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            <ExternalLink size={13} />
            打开手机页
          </Link>
          {copyState === "copied" ? (
            <p className="mt-2 text-center text-[11px] font-medium text-emerald-700">链接已复制</p>
          ) : null}
          {copyState === "error" ? (
            <p className="mt-2 text-center text-[11px] font-medium text-rose-700">复制失败</p>
          ) : null}
        </div>

        <section className="relative min-h-[360px] flex-1 bg-black">
          {currentItem ? (
            <FullscreenPlayer
              ref={playerHandleRef}
              key={currentItem.id}
              videoId={currentItem.videoId}
              title={currentItem.title}
              autoPlay
              playRequestId={playRequestId}
              playbackQuality={playbackQuality}
              onPlaybackStarted={handlePlaybackStarted}
              onPlaybackEnded={handlePlaybackEnded}
              onPlaybackError={handlePlaybackError}
              onAutoplayBlocked={handleAutoplayBlocked}
              onPlaybackQualityChange={handlePlaybackQualityChange}
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

        <section className="relative z-20 border-t border-white/10 bg-slate-950/95 px-4 py-3 shadow-2xl">
          <div className="flex flex-col gap-3 text-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start">
              <ConnectionBadge
                status={roomSocket.status}
                canUseLocalFallback={roomSocket.canUseLocalFallback}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-teal-200">正在播放</p>
                <h2 className="truncate text-xl font-semibold tracking-normal sm:text-2xl">
                  {currentItem?.title ?? "等待点歌"}
                </h2>
                {currentItem?.channelTitle ? (
                  <p className="mt-1 truncate text-sm text-slate-300">
                    {currentItem.channelTitle}
                  </p>
                ) : null}
                {playerIssue ? (
                  <p className="mt-2 text-sm font-medium text-rose-200">{playerIssue}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {currentItem ? (
                <>
                  <label className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur">
                    <SlidersHorizontal size={16} />
                    <select
                      aria-label="清晰度"
                      value={playbackQuality}
                      onChange={handleQualitySelect}
                      className="bg-transparent text-sm font-semibold text-white outline-none [&_option]:bg-slate-950"
                    >
                      {YOUTUBE_PLAYBACK_QUALITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={handleStart}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-teal-400 focus:outline-none focus:ring-4 focus:ring-teal-300/40"
                  >
                    <MonitorPlay size={17} />
                    开始 K 歌
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-2 rounded-lg bg-white/12 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/20"
                  >
                    <SkipForward size={17} />
                    下一首
                  </button>
                </>
              ) : null}
              <div className="rounded-lg bg-white/10 px-3 py-2 text-right backdrop-blur">
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
