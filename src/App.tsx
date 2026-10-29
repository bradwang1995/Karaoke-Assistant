import { LanguageToggle } from "./components/LanguageToggle";
import { translate as t, useLanguage } from "./i18n";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import CreateRoomPage from "./routes/CreateRoomPage";
import DebugPage from "./routes/DebugPage";
import DisplayPage from "./routes/DisplayPage";
import MobilePage from "./routes/MobilePage";
import { ROOM_JOIN_ROUTE } from "./lib/roomJoin";

const AdminPage = lazy(() => import("./routes/AdminPage"));

export default function App() {
  useLanguage();
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/create" replace />} />
      <Route path="/create" element={<CreateRoomPage />} />
      <Route path="/room/:roomId/display" element={<DisplayPage />} />
      <Route path="/room/:roomId/mobile" element={<MobilePage />} />
      <Route path={ROOM_JOIN_ROUTE} element={<MobilePage />} />
      <Route path="/room/:roomId/debug" element={<DebugPage />} />
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<div className="admin-surface grid min-h-screen place-items-center text-slate-400"><LanguageToggle className="fixed right-4 top-4 text-white" />{t("正在加载管理控制台…")}</div>}>
            <AdminPage />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/create" replace />} />
    </Routes>
  );
}
