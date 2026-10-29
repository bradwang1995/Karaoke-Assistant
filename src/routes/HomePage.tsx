import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { translate as t, useLanguage } from "../i18n";
import { SiteFooter } from "../components/SiteFooter";

export default function HomePage() {
  useLanguage();
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_0%,rgba(20,184,166,0.18),transparent_35%),radial-gradient(ellipse_at_90%_25%,rgba(251,113,133,0.10),transparent_30%)]" />
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SiteHeader />
        <section className="mx-auto max-w-3xl space-y-7 py-14 text-center sm:py-20">
          <p className="inline-flex rounded-full border border-teal-300/20 bg-teal-300/10 px-4 py-2 text-sm font-semibold text-teal-200">{t("不用安装 App，即开即唱")}</p>
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">{t("手机点歌 · 大屏播放")}</h1>
          <p className="mx-auto max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{t("免费的多人 KTV 点歌助手。朋友扫码加入同一房间，一起安排歌单，在电脑或连接电视的大屏上播放。")}</p>
          <Link to="/create" className="site-primary inline-flex rounded-2xl bg-teal-300 px-8 py-4 text-lg font-bold text-slate-950 shadow-lg shadow-teal-400/15">{t("准备开唱")}</Link>
        </section>
        <section className="mb-10 rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-9">
          <h2 className="mb-7 text-2xl font-semibold">{t("三步开始 K 歌")}</h2>
          <ol className="grid gap-5 md:grid-cols-3">
            {[t("在电脑浏览器创建房间，大屏会显示加入二维码。"), t("朋友用手机扫码，搜索歌曲或粘贴 YouTube 视频链接。"), t("加入共享歌单，在大屏播放；用房间控制重唱、暂停或切歌。")].map((step, index) => (
              <li key={index} className="rounded-2xl border border-white/10 bg-slate-950/50 p-6"><span className="grid h-9 w-9 place-items-center rounded-xl border border-teal-300/20 bg-teal-300/10 text-sm font-bold text-teal-200">0{index + 1}</span><p className="mt-4 leading-7 text-slate-300">{step}</p></li>
            ))}
          </ol>
        </section>
        <section className="mb-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-teal-200/10 bg-teal-300/[0.04] p-6 sm:p-9"><h2 className="mb-4 text-2xl font-semibold">{t("一起管理下一首")}</h2><p className="leading-8 text-slate-300">{t("多个手机共享同一歌单，查看待播歌曲、调整顺序。大屏负责播放，手机负责点歌，无需安装专用 App。")}</p></div>
          <div className="rounded-3xl border border-rose-200/10 bg-rose-300/[0.04] p-6 sm:p-9"><h2 className="mb-4 text-2xl font-semibold">{t("从已有设备开始")}</h2><p className="leading-8 text-slate-300">{t("先用电脑和手机体验。麦克风、混音器和音箱需要另外连接；本服务不会把手机变成麦克风。视频由 YouTube 官方嵌入播放器提供，部分视频可能无法嵌入播放。")}</p></div>
        </section>
        <section className="mb-10 space-y-7 rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-9">
          <h2 className="text-2xl font-semibold">{t("看看实际界面")}</h2>
          <p className="max-w-3xl leading-7 text-slate-400">{t("以下为本地空房间的实际截图，展示英文界面。大屏显示加入二维码，手机查看共享歌单；截图中的二维码仅用于本地预览，请创建自己的房间后再扫码。")}</p>
          <div className="grid items-start gap-7 md:grid-cols-[minmax(0,1fr)_220px]">
            <figure className="min-w-0 space-y-3">
              <img
                src="/product/display-room.jpg"
                alt={t("大屏空房间：右上角加入二维码与等待点歌提示")}
                width={1265}
                height={712}
                loading="lazy"
                className="h-auto w-full rounded-2xl border border-white/10"
              />
              <figcaption className="text-sm text-slate-400">{t("大屏：亮出二维码，等待朋友点歌。")}</figcaption>
            </figure>
            <figure className="mx-auto w-full max-w-[220px] space-y-3">
              <img
                src="/product/mobile-queue.jpg"
                alt={t("手机歌单页：当前播放与待播队列的空状态")}
                width={390}
                height={844}
                loading="lazy"
                className="h-auto w-full rounded-2xl border border-white/10"
              />
              <figcaption className="text-sm text-slate-400">{t("手机：查看当前播放与下一首。")}</figcaption>
            </figure>
          </div>
        </section>
        <SiteFooter />
      </div>
    </main>
  );
}
