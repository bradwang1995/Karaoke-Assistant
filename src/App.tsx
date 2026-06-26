import { Navigate, Route, Routes } from "react-router-dom";
import CreateRoomPage from "./routes/CreateRoomPage";
import DebugPage from "./routes/DebugPage";
import DisplayPage from "./routes/DisplayPage";
import MobilePage from "./routes/MobilePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/create" replace />} />
      <Route path="/create" element={<CreateRoomPage />} />
      <Route path="/room/:roomId/display" element={<DisplayPage />} />
      <Route path="/room/:roomId/mobile" element={<MobilePage />} />
      <Route path="/room/:roomId/debug" element={<DebugPage />} />
      <Route path="*" element={<Navigate to="/create" replace />} />
    </Routes>
  );
}
