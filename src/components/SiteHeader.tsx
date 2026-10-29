import { Link } from "react-router-dom";
import { SiteBrand } from "./SiteBrand";
import { LanguageToggle } from "./LanguageToggle";
import { translate as t, useLanguage } from "../i18n";

export function SiteHeader() {
  useLanguage();
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-white/10 py-5 sm:py-6">
      <SiteBrand />
      <nav className="site-header-actions flex items-center gap-2">
        <Link to="/create" className="site-link text-sm text-slate-200">{t("准备开唱")}</Link>
        <LanguageToggle />
      </nav>
    </header>
  );
}
