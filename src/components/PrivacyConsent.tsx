import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { LanguageToggle } from "./LanguageToggle";
import { SiteBrand } from "./SiteBrand";
import { translate as t, useLanguage } from "../i18n";
import { privacyConsent, subscribePrivacyConsent } from "../lib/privacyConsent";

export function PrivacyConsent({ children }: { children: ReactNode }) {
  useLanguage();
  const accepted = useSyncExternalStore(subscribePrivacyConsent, privacyConsent.accepted, () => false);
  const [checked, setChecked] = useState(false);
  useEffect(() => { setChecked(false); }, [accepted]);
  if (accepted) return children;

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-slate-950 px-5 py-8 text-white">
      <section className="w-full max-w-lg space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
        <header className="flex flex-wrap items-center justify-between gap-4"><SiteBrand /><LanguageToggle /></header>
        <h1 className="text-2xl font-semibold">{t("开始前，请了解隐私与条款")}</h1>
        <p className="leading-7 text-slate-300">{t("房间会同步歌单与播放状态，搜索使用 YouTube API，视频使用 YouTube 嵌入播放器。请先阅读以下说明，再选择是否继续。")}</p>
        <nav className="flex flex-wrap gap-4 text-teal-200 underline">
          <a href="/privacy" target="_blank" rel="noopener noreferrer">{t("隐私政策")}</a>
          <a href="/terms" target="_blank" rel="noopener noreferrer">{t("服务条款")}</a>
          <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>
        </nav>
        <p className="text-sm leading-6 text-slate-400">{t("本地预览版本：政策与条款尚未发布。确认记录仅保存在当前浏览器；禁用存储时只在当前页面有效。")}</p>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/15 p-4 leading-7">
          <input className="mt-2 h-4 w-4 shrink-0 accent-teal-300" type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
          <span>{t("我已阅读并同意隐私政策、服务条款及 YouTube 服务条款。")}</span>
        </label>
        <button type="button" disabled={!checked} onClick={() => {
          if (!checked) return;
          privacyConsent.accept();
          setChecked(false);
        }} className="w-full rounded-xl bg-teal-300 px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{t("同意并继续")}</button>
        <Link to="/" className="block text-center text-sm text-slate-300 underline">{t("暂不同意，返回产品介绍")}</Link>
      </section>
    </main>
  );
}
