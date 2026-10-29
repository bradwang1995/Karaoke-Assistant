import { setLanguage, useLanguage } from "../i18n";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const language = useLanguage();
  return (
    <button
      type="button"
      onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
      aria-label={language === "zh" ? "Switch to English" : "切换为中文"}
      title={language === "zh" ? "Switch to English" : "切换为中文"}
      className={`site-link inline-flex shrink-0 items-center gap-1 bg-transparent text-sm ${className}`}
    >
      <span lang="zh" className={language === "zh" ? "font-semibold text-teal-300" : "opacity-60"}>中</span>
      <span aria-hidden="true" className="opacity-40">/</span>
      <span lang="en" className={language === "en" ? "font-semibold text-teal-300" : "opacity-60"}>EN</span>
    </button>
  );
}
