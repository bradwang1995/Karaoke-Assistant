import { useRef } from "react";
import { createPortal } from "react-dom";
import { publicPages } from "../content/publicPages";
import { translate as t, useLanguage } from "../i18n";
import { privacyConsent } from "../lib/privacyConsent";

// Native modal dialogs supply focus containment, Escape and focus restoration.
export function SiteInfoButton({ brand = false }: { brand?: boolean }) {
  const language = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={t("产品说明与政策")}
        title={t("产品说明与政策")}
        className={brand
          ? "rounded-sm text-left underline decoration-white/25 decoration-dotted underline-offset-4 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
          : "rounded-md px-2 py-1 text-sm text-slate-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"}
      >
        {brand ? t("K歌助手") : t("关于")}
      </button>
      {createPortal(
        <dialog
          ref={dialogRef}
          aria-labelledby="site-info-title"
          className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-2xl border border-white/15 bg-slate-950 p-6 text-white shadow-2xl backdrop:bg-black/70"
          onClick={(event) => {
            if (event.target === event.currentTarget) dialogRef.current?.close();
          }}
        >
          <h2 id="site-info-title" className="text-xl font-semibold">{t("产品说明与政策")}</h2>
          <nav className="my-5 grid gap-3 text-teal-200">
            {[["/", t("K歌助手")], ["/setup", publicPages.setup[language].title], ["/privacy", publicPages.privacy[language].title], ["/terms", publicPages.terms[language].title], ["https://www.youtube.com/t/terms", "YouTube Terms of Service"]].map(([href, label]) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/10 px-4 py-3 hover:bg-white/10">{label}</a>
            ))}
          </nav>
          <p className="mb-5 text-sm leading-6 text-slate-400">{t("链接在新页面打开，不会离开当前房间。政策信息仍为待完善草稿。")}</p>
          <button type="button" onClick={() => {
            dialogRef.current?.close();
            privacyConsent.revoke();
          }} className="mb-3 w-full rounded-lg border border-white/20 px-4 py-3 text-sm">{t("撤回同意并停止使用房间")}</button>
          <button type="button" onClick={() => dialogRef.current?.close()} className="w-full rounded-lg bg-teal-300 px-4 py-3 font-semibold text-slate-950">{t("关闭")}</button>
        </dialog>,
        document.body,
      )}
    </>
  );
}
