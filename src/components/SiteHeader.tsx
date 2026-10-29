import { Link } from "react-router-dom";
import { SiteBrand } from "./SiteBrand";
import { LanguageToggle } from "./LanguageToggle";
import { translate as t, useLanguage } from "../i18n";

export function SiteHeader() {
  useLanguage();
  return (
    <header className="grid grid-cols-1 items-center gap-x-6 gap-y-4 border-b border-white/10 py-5 sm:grid-cols-[1fr_auto] sm:py-6">
      <SiteBrand />
      <nav className="site-header-actions flex h-9 items-center gap-2 whitespace-nowrap">
        <Link to="/create" className="site-link text-sm text-slate-200">{t("准备开唱")}</Link>
        <LanguageToggle />
      </nav>
    </header>
  );
}
