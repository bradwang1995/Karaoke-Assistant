import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import CreateRoomPage from "./routes/CreateRoomPage";
import DebugPage from "./routes/DebugPage";
import DisplayPage from "./routes/DisplayPage";
import MobilePage from "./routes/MobilePage";

const AdminPage = lazy(() => import("./routes/AdminPage"));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/create" replace />} />
      <Route path="/create" element={<CreateRoomPage />} />
      <Route path="/room/:roomId/display" element={<DisplayPage />} />
      <Route path="/room/:roomId/mobile" element={<MobilePage />} />
      <Route path="/room/:roomId/debug" element={<DebugPage />} />
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<div className="admin-surface grid min-h-screen place-items-center text-slate-400">正在加载管理控制台…</div>}>
            <AdminPage />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/create" replace />} />
    </Routes>
  );
}
