import { setLanguage, useLanguage } from "../i18n";

export function LanguageToggle({ className = "", vertical = false }: { className?: string; vertical?: boolean }) {
  const language = useLanguage();
  return (
    <button
      type="button"
      onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
      aria-label={language === "zh" ? "Switch to English" : "切换为中文"}
      title={language === "zh" ? "Switch to English" : "切换为中文"}
      className={`inline-flex shrink-0 items-center rounded-md border-0 bg-transparent py-1 text-sm transition hover:bg-white/10 hover:shadow-[0_2px_12px_rgba(45,212,191,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${vertical ? "h-14 w-7 flex-col justify-center gap-0 px-1 leading-4" : "gap-1 px-2"} ${className}`}
    >
      <span lang="zh" className={language === "zh" ? "font-semibold text-teal-300" : "opacity-60"}>中</span>
      {!vertical ? <span aria-hidden="true" className="opacity-40">/</span> : null}
      <span lang="en" className={language === "en" ? "font-semibold text-teal-300" : "opacity-60"}>EN</span>
    </button>
  );
}
