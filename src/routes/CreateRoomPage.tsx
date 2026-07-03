import { MonitorPlay, Plus, Smartphone } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { StatusMessage } from "../components/StatusMessage";
import { ApiClientError, createRoomViaApi } from "../lib/apiClient";
import { createRoomId, hydrateRoomSnapshot, readRoomSnapshot } from "../lib/roomState";

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const createRoom = async () => {
    setIsCreating(true);
    setNotice(null);

    try {
      const response = await createRoomViaApi();

      if (response.snapshot) {
        hydrateRoomSnapshot(response.snapshot);
      }

      navigate(response.displayUrl);
    } catch (error) {
      const roomId = createRoomId();
      readRoomSnapshot(roomId);

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
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-950 text-teal-300">
              <MonitorPlay size={23} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-normal">K歌助手</h1>
              <p className="text-sm text-slate-500">手机点歌，大屏播放</p>
            </div>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-8 py-8 md:grid-cols-[1fr_0.9fr] md:py-10">
          <div className="max-w-xl">
            <p className="mb-4 text-sm font-medium text-teal-700">
              开一个房间，朋友扫码点歌
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-5xl">
              大屏播放，手机点歌，一个房间一起唱。
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              创建房间后，把大屏页面留在电视或电脑上，再让朋友用手机扫码进入同一个房间。
            </p>
            <div className="mt-8">
              <button
                type="button"
                onClick={createRoom}
                disabled={isCreating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
              >
                <Plus size={20} />
                {isCreating ? "创建中" : "创建房间"}
              </button>
            </div>
            {notice ? (
              <StatusMessage tone="warning" className="mt-4">
                {notice}
              </StatusMessage>
            ) : null}
          </div>

          <div className="grid gap-5 border-l-0 border-slate-200 md:border-l md:pl-8">
            <FeatureNote
              icon={<MonitorPlay size={22} />}
              tone="display"
              title="大屏页"
              body="横屏显示当前视频，右上角固定二维码，空房间时显示等待状态。"
            />
            <FeatureNote
              icon={<Smartphone size={22} />}
              tone="mobile"
              title="手机页"
              body="竖屏搜索歌曲、预览候选视频、点歌、置顶和删歌。"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function FeatureNote({
  icon,
  tone,
  title,
  body,
}: {
  icon: ReactNode;
  tone: "display" | "mobile";
  title: string;
  body: string;
}) {
  return (
    <article className="border-b border-slate-200 pb-5 last:border-b-0 last:pb-0">
      <div className="flex items-start gap-4">
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${
            tone === "display" ? "bg-teal-50 text-teal-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
        </div>
      </div>
    </article>
  );
}
