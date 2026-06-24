import { Copy, ExternalLink, MonitorPlay, QrCode, SkipForward } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { getCurrentItem, getQueuedItems } from "../lib/roomReducer";
import { playerEnded, playerStarted, useRoomSnapshot } from "../lib/roomState";
import { youtubeEmbedUrl } from "../lib/youtube";

export default function DisplayPage() {
  const { roomId = "" } = useParams();
  useRoomSocket({ roomId, role: "display" });
  const snapshot = useRoomSnapshot(roomId);
  const currentItem = getCurrentItem(snapshot);
  const queuedItems = getQueuedItems(snapshot);
  const [hasStarted, setHasStarted] = useState(false);

  const mobileUrl = useMemo(() => {
    const path = `/room/${roomId}/mobile`;
    return `${window.location.origin}${path}`;
  }, [roomId]);

  const handleStart = () => {
    if (!currentItem) return;
    setHasStarted(true);
    playerStarted(roomId, currentItem.id, currentItem.videoId);
  };

  const handleNext = () => {
    if (!currentItem) return;
    setHasStarted(false);
    playerEnded(roomId, currentItem.id, currentItem.videoId);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(20,184,166,0.22),transparent_30%),radial-gradient(circle_at_78%_78%,rgba(251,113,133,0.18),transparent_28%)]" />

      {currentItem ? (
        <iframe
          key={`${currentItem.id}-${hasStarted ? "playing" : "ready"}`}
          className="absolute inset-0 h-full w-full"
          title={currentItem.title}
          src={youtubeEmbedUrl(currentItem.videoId, {
            start: hasStarted ? 0 : 30,
            autoplay: hasStarted,
          })}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <section className="relative z-10 grid min-h-screen place-items-center px-6 text-center">
          <div>
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-xl bg-white/10 text-teal-200">
              <MonitorPlay size={32} />
            </div>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-5xl">
              当前没有视频播放
            </h1>
            <p className="mt-4 text-base text-slate-300">让朋友扫码点歌，第一首会自动排到这里。</p>
          </div>
        </section>
      )}

      <div className="absolute right-4 top-4 z-20 rounded-lg bg-white p-3 text-slate-950 shadow-glow">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <QrCode size={14} />
            扫码点歌
          </span>
          <button
            type="button"
            title="复制手机链接"
            onClick={() => navigator.clipboard.writeText(mobileUrl)}
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
          >
            <Copy size={15} />
          </button>
        </div>
        <QRCodeSVG value={mobileUrl} size={132} level="M" includeMargin />
        <Link
          to={`/room/${roomId}/mobile`}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          <ExternalLink size={13} />
          打开手机页
        </Link>
      </div>

      <div className="absolute left-4 top-4 z-20 flex max-w-[calc(100%-220px)] flex-wrap items-center gap-2">
        {currentItem ? (
          <>
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
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/85 to-transparent px-4 pb-4 pt-16">
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-teal-200">正在播放</p>
            <h2 className="truncate text-xl font-semibold tracking-normal sm:text-2xl">
              {currentItem?.title ?? "等待点歌"}
            </h2>
            {currentItem?.channelTitle ? (
              <p className="mt-1 truncate text-sm text-slate-300">{currentItem.channelTitle}</p>
            ) : null}
          </div>
          <div className="rounded-lg bg-white/10 px-3 py-2 text-right backdrop-blur">
            <p className="text-xs text-slate-300">即将播放</p>
            <p className="text-lg font-semibold">{queuedItems.length} 首</p>
          </div>
        </div>
      </div>
    </main>
  );
}
