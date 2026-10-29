import { LanguageToggle } from "./components/LanguageToggle";
import { translate as t, useLanguage } from "./i18n";
import { lazy, Suspense, useLayoutEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import CreateRoomPage from "./routes/CreateRoomPage";
import DebugPage from "./routes/DebugPage";
import DisplayPage from "./routes/DisplayPage";
import MobilePage from "./routes/MobilePage";
import HomePage from "./routes/HomePage";
import { PrivacyConsent } from "./components/PrivacyConsent";

const AdminPage = lazy(() => import("./routes/AdminPage"));
const PublicInfoPage = lazy(() => import("./routes/PublicInfoPage"));

export default function App() {
  useLanguage();
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    if (["/", "/create", "/setup", "/privacy", "/terms"].includes(pathname)) {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {(["setup", "privacy", "terms"] as const).map((page) => (
        <Route key={page} path={`/${page}`} element={<Suspense fallback={null}><PublicInfoPage page={page} /></Suspense>} />
      ))}
      <Route path="/create" element={<PrivacyConsent><CreateRoomPage /></PrivacyConsent>} />
      <Route path="/room/:roomId/display" element={<PrivacyConsent><DisplayPage /></PrivacyConsent>} />
      <Route path="/room/:roomId/mobile" element={<PrivacyConsent><MobilePage /></PrivacyConsent>} />
      <Route path="/room/:roomId/debug" element={<PrivacyConsent><DebugPage /></PrivacyConsent>} />
      <Route
        path="/admin/*"
        element={
          <PrivacyConsent><Suspense fallback={<div className="admin-surface grid min-h-screen place-items-center text-slate-400"><LanguageToggle className="fixed right-4 top-4 text-white" />{t("正在加载管理控制台…")}</div>}>
            <AdminPage />
          </Suspense></PrivacyConsent>
        }
      />
      <Route path="*" element={<Navigate to="/create" replace />} />
    </Routes>
  );
}
