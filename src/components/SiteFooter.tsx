import { Link } from "react-router-dom";
import { publicPages, publicSiteDetails } from "../content/publicPages";
import { translate as t, useLanguage } from "../i18n";
import { useSyncExternalStore } from "react";
import { privacyConsent, subscribePrivacyConsent } from "../lib/privacyConsent";

export function SiteFooter({ allowWithdrawal = false }: { allowWithdrawal?: boolean }) {
  const language = useLanguage();
  const accepted = useSyncExternalStore(subscribePrivacyConsent, privacyConsent.accepted, () => false);
  return (
    <>
      {allowWithdrawal && accepted ? (
        <div className="flex justify-center py-5">
          <button type="button" onClick={() => privacyConsent.revoke()} className="rounded-sm px-4 py-3 text-center text-sm text-teal-200 underline underline-offset-4 hover:text-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">{t("撤回同意并停止使用房间")}</button>
        </div>
      ) : null}
      <footer className="site-footer flex flex-wrap items-center justify-center gap-2 border-t border-white/10 py-6 text-center text-sm text-slate-400">
        <Link className="site-link" to="/">{t("产品首页")}</Link>
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
    </>
  );
}
