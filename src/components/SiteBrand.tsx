import { Link } from "react-router-dom";
import { translate as t, useLanguage } from "../i18n";

export function SiteBrand() {
  const language = useLanguage();
  return (
    <Link to="/" className="site-brand inline-flex shrink-0 flex-col items-start rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">
      <img src={`/brand/logo-${language}.png`} width={2172} height={724} alt={t("K歌助手")} className="site-brand-image" />
    </Link>
  );
}
