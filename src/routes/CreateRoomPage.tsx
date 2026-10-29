import { LanguageToggle } from "../components/LanguageToggle";
import { SiteFooter } from "../components/SiteFooter";
import { SiteBrand } from "../components/SiteBrand";
import { translate as t, useLanguage } from "../i18n";
import {
  ArrowRight,
  LoaderCircle,
  MonitorPlay,
  Quote,
  QrCode,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { StatusMessage } from "../components/StatusMessage";
import { ApiClientError, createRoomViaApi } from "../lib/apiClient";
import { createRoomDisplayName } from "../lib/roomName";
import { createRoomId, hydrateRoomSnapshot, readRoomSnapshot } from "../lib/roomState";

export default function CreateRoomPage() {
  useLanguage();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const createRoom = async () => {
    setIsCreating(true);
    setNotice(null);

    try {
      const roomDisplayName = createRoomDisplayName();
      const response = await createRoomViaApi(roomDisplayName);

      if (response.snapshot) {
        hydrateRoomSnapshot(response.snapshot);
      }

      navigate(response.displayUrl);
    } catch (error) {
      const roomId = createRoomId();
      readRoomSnapshot(roomId, createRoomDisplayName());

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
    <main className="app-no-select relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(20,184,166,0.2),transparent_32%),radial-gradient(circle_at_86%_76%,rgba(251,113,133,0.16),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-300/50 to-transparent" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5 sm:px-8 sm:py-6">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 pb-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <SiteBrand />
          <LanguageToggle className="site-header-control col-start-2 row-start-1 justify-self-end lg:col-start-3" />
          <div className="col-span-2 row-start-2 hidden items-center justify-self-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-center text-xs font-medium text-slate-300 sm:flex lg:col-span-1 lg:col-start-2 lg:row-start-1">
            <Quote size={15} className="shrink-0 text-rose-300" />
            {t("在这个世界上，只有在唱歌的时候，我是绝对自由的。")}
          </div>
        </header>

        <section className="create-room-layout grid flex-1 items-center gap-10 py-9 md:grid-cols-[1.08fr_0.92fr] md:py-12 lg:gap-16">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-2 text-sm font-semibold text-teal-200">
              <Sparkles size={16} />
              {t("不用安装 App，即开即唱")}
            </p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-6xl">
              <span className="block">{t("开一个房间，")}</span>
              <span className="mt-1 block text-teal-300">{t("让朋友扫码开唱。")}</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              <span className="block">{t("大屏负责播放，手机负责点歌。")}</span>
              <span className="block">{t("创建后，房间二维码会自动出现在大屏右上角。")}</span>
            </p>
            <div className="create-room-action mt-9 flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={createRoom}
                disabled={isCreating}
                className="site-primary create-room-cta group relative isolate inline-flex min-h-[4.5rem] min-w-[12rem] shrink-0 items-center justify-center gap-3 overflow-hidden rounded-2xl px-7 py-4 text-xl font-extrabold text-slate-950 transition focus:outline-none focus:ring-4 focus:ring-teal-200/40 disabled:cursor-wait disabled:opacity-60 sm:min-h-20 sm:min-w-[17rem] sm:px-10 sm:text-2xl"
              >
                <span className="relative z-10">
                  {isCreating ? t("正在创建房间") : t("创建房间")}
                </span>
                {isCreating ? (
                  <LoaderCircle size={23} className="relative z-10 animate-spin" />
                ) : (
                  <ArrowRight size={24} className="create-room-cta-arrow relative z-10" />
                )}
              </button>
              <p className="create-room-cta-note flex items-center gap-2 text-xs leading-5 text-slate-300 sm:text-sm">
                <span>{t("创建后自动打开大屏页")}</span>
                <MonitorPlay size={17} className="shrink-0 text-teal-300" />
              </p>
            </div>
            {notice ? (
              <StatusMessage tone="warning" appearance="dark" className="mt-4">
                {t(notice)}
              </StatusMessage>
            ) : null}
          </div>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/25 backdrop-blur sm:p-7">
            <div className="mb-5 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">
                  Ready in seconds
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">{t("三步开始 K 歌")}</h2>
              </div>
            </div>

            <div className="grid gap-3">
              <SetupStep
                step="01"
                icon={<MonitorPlay size={22} />}
                tone="teal"
                title={t("创建房间")}
                body={t("自动打开大屏播放页")}
              />
              <SetupStep
                step="02"
                icon={<QrCode size={22} />}
                tone="rose"
                title={t("亮出二维码")}
                body={t("二维码固定在大屏右上角")}
              />
              <SetupStep
                step="03"
                icon={<Smartphone size={22} />}
                tone="teal"
                title={t("朋友点歌")}
                body={t("手机搜索、预览并加入歌单")}
              />
            </div>
          </aside>
        </section>
        <SiteFooter />
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
  useLanguage();
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
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="mt-0.5 text-sm leading-5 text-slate-400">{body}</p>
        </div>
      </div>
    </article>
  );
}
