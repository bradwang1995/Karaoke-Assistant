import { MonitorPlay } from "lucide-react";
import { Link } from "react-router-dom";
import { translate as t, useLanguage } from "../i18n";

export function SiteBrand() {
  const language = useLanguage();
  return (
    <Link to="/" className="site-brand inline-flex shrink-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-teal-200/15 bg-teal-300/10 text-teal-300 shadow-lg shadow-black/20"><MonitorPlay size={23} aria-hidden="true" /></span>
      <span>
        <span className="site-brand-text block" aria-label={t("K歌助手")}>
          {language === "zh" ? <><span className="site-brand-k" aria-hidden="true">K</span><span aria-hidden="true">{t("歌助手")}</span></> : t("K歌助手")}
        </span>
        <span className="block text-xs leading-5 text-slate-400">{t("手机点歌 · 大屏播放")}</span>
      </span>
    </Link>
  );
}
