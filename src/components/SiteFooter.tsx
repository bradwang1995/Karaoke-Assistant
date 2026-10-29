import { Link } from "react-router-dom";
import { publicPages, publicSiteDetails } from "../content/publicPages";
import { translate as t, useLanguage } from "../i18n";

export function SiteFooter() {
  const language = useLanguage();
  return (
    <footer className="site-footer flex flex-wrap items-center justify-center gap-2 border-t border-white/10 py-6 text-center text-sm text-slate-400">
      <Link className="site-link" to="/">{t("产品介绍")}</Link>
      <Link className="site-link" to="/setup">{publicPages.setup[language].title}</Link>
      <Link className="site-link" to="/privacy">{publicPages.privacy[language].title}</Link>
      <Link className="site-link" to="/terms">{publicPages.terms[language].title}</Link>
      <a className="site-link" href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>
      {publicSiteDetails.contactEmail && (
        <a className="site-link min-w-0 break-all" href={`mailto:${publicSiteDetails.contactEmail}`}>
          {publicSiteDetails.contactEmail}
        </a>
      )}
    </footer>
  );
}
