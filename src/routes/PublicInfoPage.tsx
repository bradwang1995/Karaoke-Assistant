import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { useLanguage } from "../i18n";
import { publicPages, publicSiteDetails } from "../content/publicPages";

export default function PublicInfoPage({ page }: { page: keyof typeof publicPages }) {
  const language = useLanguage();
  const copy = publicPages[page][language];
  const contact = publicSiteDetails.contactEmail;
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-5"><SiteHeader /></div>
      <main className="mx-auto max-w-5xl space-y-7 px-5 py-12 sm:py-16">
        <h1 className="text-3xl font-semibold sm:text-5xl">{copy.title}</h1>
        <p className="text-lg leading-8 text-slate-300">{copy.intro}</p>
        {page !== "setup" && <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">{language === "zh" ? "草稿 · 更新于 2026-10-28。本地预览版本，尚未发布。" : "Draft · Updated October 28, 2026. Local preview; not yet published."}</p>}
        {copy.sections.map((section) => (
          <section key={section.title} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">{section.title}</h2>
            {section.paragraphs.map((text) => <p key={text} className="leading-8 text-slate-300">{text}</p>)}
            {page === "privacy" && (section.title === "第三方服务" || section.title === "Third-party services") && (
              <p className="text-sm leading-7 text-slate-400">
                {language === "zh" ? "了解第三方的信息处理方式：" : "Read about third-party information handling: "}
                <a className="underline decoration-white/25 underline-offset-4 hover:text-slate-200" href="https://policies.google.com/privacy">Google Privacy Policy</a>
              </p>
            )}
          </section>
        ))}
        {page !== "setup" && <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8"><h2 className="text-xl font-semibold">{language === "zh" ? "运营者与联系" : "Operator and contact"}</h2><p>{publicSiteDetails.operatorName || (language === "zh" ? "运营者名称待补充" : "Operator name to be added")}</p><p className="text-sm leading-7 text-slate-400">{language === "zh" ? "个人独立项目，运营于加拿大安大略省，面向 YouTube 服务可用的国家与地区。隐私事务由项目运营者负责。通常在三天内查看并回复邮件；这不代表所有请求都会在三天内处理完毕。" : "An independent personal project operated from Ontario, Canada, intended for countries and regions where YouTube services are available. The project operator handles privacy enquiries. Emails are normally reviewed and answered within three days; completing a request may take longer."}</p>{contact ? <a className="text-teal-300 underline" href={`mailto:${contact}`}>{contact}</a> : <p className="text-slate-400">{language === "zh" ? "联系邮箱与数据请求流程待补充。" : "Contact email and data request process to be added."}</p>}</section>}
      </main>
      <div className="mx-auto max-w-5xl px-5"><SiteFooter /></div>
    </div>
  );
}
