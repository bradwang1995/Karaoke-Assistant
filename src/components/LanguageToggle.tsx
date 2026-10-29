import { setLanguage, useLanguage } from "../i18n";

export function LanguageToggle({ className = "", vertical = false }: { className?: string; vertical?: boolean }) {
  const language = useLanguage();
  return (
    <button
      type="button"
      onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
      aria-label={language === "zh" ? "Switch to English" : "切换为中文"}
      title={language === "zh" ? "Switch to English" : "切换为中文"}
      className={`site-link inline-flex shrink-0 items-center bg-transparent text-sm ${vertical ? "h-14 w-7 flex-col justify-center gap-0 px-1 leading-4" : "gap-1"} ${className}`}
    >
      <span lang="zh" className={language === "zh" ? "font-semibold text-teal-300" : "opacity-60"}>中</span>
      {!vertical ? <span aria-hidden="true" className="opacity-40">/</span> : null}
      <span lang="en" className={language === "en" ? "font-semibold text-teal-300" : "opacity-60"}>EN</span>
    </button>
  );
}
