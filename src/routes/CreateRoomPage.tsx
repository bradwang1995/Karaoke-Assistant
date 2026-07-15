import {
  ArrowRight,
  LoaderCircle,
  MonitorPlay,
  QrCode,
  Smartphone,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { StatusMessage } from "../components/StatusMessage";
import { ApiClientError, createRoomViaApi } from "../lib/apiClient";
import { createDeviceRoomDisplayName } from "../lib/roomName";
import { createRoomId, hydrateRoomSnapshot, readRoomSnapshot } from "../lib/roomState";

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const createRoom = async () => {
    setIsCreating(true);
    setNotice(null);

    try {
      const roomDisplayName = createDeviceRoomDisplayName();
      const response = await createRoomViaApi(roomDisplayName);

      if (response.snapshot) {
        hydrateRoomSnapshot(response.snapshot);
      }

      navigate(response.displayUrl);
    } catch (error) {
      const roomId = createRoomId();
      readRoomSnapshot(roomId, createDeviceRoomDisplayName());

      if (error instanceof ApiClientError && error.code === "NON_JSON_RESPONSE") {
        setNotice("当前是本地 Vite 模式，已使用本地房间继续。");
      } else {
        setNotice("后端 API 暂不可用，已使用本地房间继续。");
      }

      navigate(`/room/${roomId}/display`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(20,184,166,0.2),transparent_32%),radial-gradient(circle_at_86%_76%,rgba(251,113,133,0.16),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-300/50 to-transparent" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5 sm:px-8 sm:py-6">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/10 text-teal-300 shadow-lg shadow-black/20">
              <MonitorPlay size={23} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-normal">K歌助手</h1>
              <p className="text-sm text-slate-400">手机点歌 · 大屏播放</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-slate-300 sm:flex">
            <UsersRound size={15} className="text-rose-300" />
            为朋友聚会而做
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-9 md:grid-cols-[1.08fr_0.92fr] md:py-12 lg:gap-16">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-2 text-sm font-semibold text-teal-200">
              <Sparkles size={16} />
              不用安装 App，即开即唱
            </p>
            <h2 className="text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-6xl">
              <span className="block">开一个房间，</span>
              <span className="mt-1 block text-teal-300">让朋友扫码开唱。</span>
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              <span className="block">大屏负责播放，手机负责点歌。</span>
              <span className="block">创建后，房间二维码会自动出现在大屏右上角。</span>
            </p>
            <div className="mt-9 flex items-center">
              <button
                type="button"
                onClick={createRoom}
                disabled={isCreating}
                className="create-room-cta group relative isolate inline-flex min-h-16 min-w-[10.5rem] shrink-0 items-center justify-center gap-3 overflow-hidden rounded-2xl px-5 py-4 text-lg font-extrabold text-slate-950 transition focus:outline-none focus:ring-4 focus:ring-teal-200/40 disabled:cursor-wait disabled:opacity-60 sm:min-h-[4.5rem] sm:min-w-[15rem] sm:px-9 sm:text-xl"
              >
                {isCreating ? (
                  <LoaderCircle size={23} className="relative z-10 animate-spin" />
                ) : (
                  <ArrowRight
                    size={24}
                    className="relative z-10 transition-transform group-hover:translate-x-1"
                  />
                )}
                <span className="relative z-10">
                  {isCreating ? "正在创建房间" : "创建房间"}
                </span>
              </button>
              <p className="ml-4 flex max-w-[7rem] items-center gap-2 text-xs leading-5 text-slate-300 sm:ml-10 sm:max-w-none sm:text-sm">
                <span>创建后自动打开大屏页</span>
                <ArrowRight
                  size={17}
                  className="create-room-hint-arrow hidden shrink-0 text-teal-300 sm:block"
                />
              </p>
            </div>
            {notice ? (
              <StatusMessage tone="warning" className="mt-4">
                {notice}
              </StatusMessage>
            ) : null}
          </div>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/25 backdrop-blur sm:p-7">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">
                  Ready in seconds
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">三步开始 K 歌</h3>
              </div>
              <span className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300">
                1 个房间
              </span>
            </div>

            <div className="grid gap-3">
              <SetupStep
                step="01"
                icon={<MonitorPlay size={22} />}
                tone="teal"
                title="创建房间"
                body="自动打开大屏播放页"
              />
              <SetupStep
                step="02"
                icon={<QrCode size={22} />}
                tone="rose"
                title="亮出二维码"
                body="二维码固定在大屏右上角"
              />
              <SetupStep
                step="03"
                icon={<Smartphone size={22} />}
                tone="teal"
                title="朋友点歌"
                body="手机搜索、预览并加入歌单"
              />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function SetupStep({
  step,
  icon,
  tone,
  title,
  body,
}: {
  step: string;
  icon: ReactNode;
  tone: "teal" | "rose";
  title: string;
  body: string;
}) {
  return (
    <article className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <span className="w-7 shrink-0 text-xs font-bold tabular-nums text-slate-500">{step}</span>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            tone === "teal"
              ? "bg-teal-300/10 text-teal-300"
              : "bg-rose-300/10 text-rose-300"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h4 className="font-semibold text-white">{title}</h4>
          <p className="mt-0.5 text-sm leading-5 text-slate-400">{body}</p>
        </div>
      </div>
    </article>
  );
}
