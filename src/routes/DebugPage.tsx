import { Check, Copy, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { StatusMessage } from "../components/StatusMessage";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { cleanupRoomViaApi, fetchRoomSnapshot } from "../lib/apiClient";
import { copyTextToClipboard } from "../lib/clipboard";
import { hydrateRoomSnapshot, useRoomSnapshot } from "../lib/roomState";
import type { RoomSnapshot } from "../types/room";

export default function DebugPage() {
  const { roomId = "" } = useParams();
  const roomSocket = useRoomSocket({ roomId, role: "display" });
  const localSnapshot = useRoomSnapshot(roomId);
  const [remoteSnapshot, setRemoteSnapshot] = useState<RoomSnapshot | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const links = useMemo(() => {
    const origin = window.location.origin;
    return {
      display: `${origin}/room/${roomId}/display`,
      mobile: `${origin}/room/${roomId}/mobile`,
      debug: `${origin}/room/${roomId}/debug`,
    };
  }, [roomId]);

  const snapshot = remoteSnapshot ?? localSnapshot;

  const refreshSnapshot = async () => {
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const nextSnapshot = await fetchRoomSnapshot(roomId);
      hydrateRoomSnapshot(nextSnapshot);
      setRemoteSnapshot(nextSnapshot);
      setStatusMessage("已刷新远端 snapshot。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "刷新失败。");
    } finally {
      setIsRefreshing(false);
    }
  };

  const cleanupRoom = async () => {
    setIsCleaning(true);
    setErrorMessage(null);

    try {
      const nextSnapshot = await cleanupRoomViaApi(roomId);
      hydrateRoomSnapshot(nextSnapshot);
      setRemoteSnapshot(nextSnapshot);
      setStatusMessage("已清理 completed / removed 歌曲。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "清理失败。");
    } finally {
      setIsCleaning(false);
    }
  };

  const copyLink = async (label: string, value: string) => {
    try {
      await copyTextToClipboard(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1_600);
    } catch {
      setErrorMessage("复制失败。");
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-950">
      <div className="mx-auto grid w-full max-w-5xl gap-4">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">房间调试</p>
            <h1 className="text-2xl font-semibold tracking-normal">{roomId}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/room/${roomId}/display`}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              大屏
            </Link>
            <Link
              to={`/room/${roomId}/mobile`}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              手机
            </Link>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <InfoPanel label="连接状态" value={socketLabel(roomSocket.status)}>
            {roomSocket.status === "connected" ? (
              <Wifi className="text-emerald-600" size={20} />
            ) : (
              <WifiOff className="text-amber-600" size={20} />
            )}
          </InfoPanel>
          <InfoPanel label="当前状态" value={snapshot.playback.playerState} />
          <InfoPanel label="队列数量" value={`${snapshot.queue.length} 首`} />
        </section>

        {statusMessage ? (
          <StatusMessage tone="success" title="完成">
            {statusMessage}
          </StatusMessage>
        ) : null}
        {errorMessage ? (
          <StatusMessage tone="error" title="出错了">
            {errorMessage}
          </StatusMessage>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold tracking-normal">操作</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshSnapshot}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
              刷新远端 snapshot
            </button>
            <button
              type="button"
              onClick={cleanupRoom}
              disabled={isCleaning}
              className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <Trash2 size={16} />
              清理已完成歌曲
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold tracking-normal">链接</h2>
          <div className="mt-3 grid gap-2">
            {Object.entries(links).map(([label, value]) => (
              <button
                key={label}
                type="button"
                onClick={() => copyLink(label, value)}
                className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="min-w-0 truncate">{value}</span>
                {copied === label ? (
                  <Check className="shrink-0 text-emerald-600" size={16} />
                ) : (
                  <Copy className="shrink-0 text-slate-400" size={16} />
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold tracking-normal">Snapshot JSON</h2>
          <pre className="mt-3 max-h-[520px] overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}

function InfoPanel({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-1 text-lg font-semibold">{value}</p>
        </div>
        {children}
      </div>
    </article>
  );
}

function socketLabel(status: string) {
  if (status === "connected") return "实时已连接";
  if (status === "connecting") return "正在连接";
  if (status === "reconnecting") return "正在重连";
  return "未连接";
}
