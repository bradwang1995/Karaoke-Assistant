// Test-only Vite entry. Not imported by the application or included in dist.
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { FullscreenPlayer, type FullscreenPlayerHandle } from "../../src/components/FullscreenPlayer";
import { privacyConsent } from "../../src/lib/privacyConsent";
import type { YouTubePlayer, YouTubePlayerEvent, YouTubePlayerStateChangeEvent } from "../../src/lib/youtubeIframeApi";
import "../../src/styles.css";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MobilePage from "../../src/routes/MobilePage";
import DisplayPage from "../../src/routes/DisplayPage";
import { addSongToRoom, createRoomId } from "../../src/lib/roomState";
import { searchMockVideos } from "../../src/lib/mockSearch";
import { apiStamp } from "../../src/lib/metadataLifecycle";

const counts = { play: 0, pause: 0, seek: 0, load: 0, cue: 0, destroy: 0, checks: 0 };
let rejectPlay = false;
let decisionMode = "normal";
let transientFailures = 0;
// The test never navigates a frame to YouTube, loads its script, or contacts Data API.
Object.defineProperty(HTMLIFrameElement.prototype, "src", {
  get() { return this.getAttribute("src") ?? ""; },
  set() { this.setAttribute("src", "about:blank"); this.title = "LOCAL MOCK — no YouTube playback"; },
  configurable: true,
});
window.fetch = async (_input, init) => {
  const path = String(_input);
  if (window.location.search === "?display" && !path.startsWith("/api/youtube/playback/")) {
    return new Response(null, { status: 503 });
  }
  const mobile = window.location.search === "?mobile";
  if (mobile && !path.startsWith("/api/youtube/playback/")) {
    const request = JSON.parse(String(init?.body ?? "{}"));
    const response = await searchMockVideos(request.query || "经典 KTV", 50, request);
    response.results = response.results.map(video => ({ ...video, provenance: { snippet: apiStamp() } }));
    return Response.json(response);
  }
  counts.checks++;
  if ((mobile && counts.checks === 1) || transientFailures > 0) {
    transientFailures = Math.max(0, transientFailures - 1);
    return new Response(null, { status: 503 });
  }
  const videoId = path.split("/").at(-1);
  if (decisionMode === "blocked") return Response.json({ videoId, allowed: false, reason: "made-for-kids" });
  return Response.json({ videoId, allowed: true, reason: "allowed", expiresAt: new Date(Date.now() + (decisionMode === "expiring" ? 2500 : 3600000)).toISOString() });
};
type Events = { onReady: (e: YouTubePlayerEvent) => void; onStateChange: (e: YouTubePlayerStateChangeEvent) => void };
class MockPlayer implements YouTubePlayer {
  private volume = 75;
  private muted = false;
  private currentTime = 0;
  constructor(private frame: HTMLIFrameElement, private options: { events: Events }) {
    if (window.location.search === "?display") {
      frame.addEventListener("load", () => {
        const slider = frame.contentDocument?.querySelector<HTMLInputElement>("input");
        slider?.addEventListener("input", () => { this.volume = slider.valueAsNumber; });
        frame.contentDocument?.querySelector("button")?.addEventListener("click", () => { this.muted = !this.muted; });
      }, { once: true });
      frame.srcdoc = '<input type="range" aria-label="Mock native volume" value="75"><button>Mock native mute</button>';
    }
    queueMicrotask(() => options.events.onReady({ target: this }));
  }
  playVideo() { counts.play++; if (!rejectPlay) this.options.events.onStateChange({ target: this, data: 1 }); }
  pauseVideo() { counts.pause++; this.options.events.onStateChange({ target: this, data: 2 }); }
  seekTo(seconds: number) {
    counts.seek++;
    this.currentTime = seconds;
    this.frame.dataset.mockSeek = String(seconds);
  }
  cueVideoById() { counts.cue++; queueMicrotask(() => this.options.events.onStateChange({ target: this, data: 5 })); }
  loadVideoById(options: { videoId: string; startSeconds?: number }) {
    if (options.videoId !== "dQw4w9WgXcQ" || options.startSeconds !== 0) throw new Error("Incorrect replay target");
    counts.load++;
    this.currentTime = 0;
    this.frame.dataset.mockReplay = String(counts.load);
    this.playVideo();
  }
  getCurrentTime() { return this.currentTime; }
  getDuration() { return 180; }
  getVolume() { return this.volume; }
  isMuted() { return this.muted; }
  unMute() { this.muted = false; }
  setVolume(volume: number) {
    this.volume = volume;
    this.frame.dataset.mockVolume = String(volume);
    const slider = this.frame.contentDocument?.querySelector<HTMLInputElement>("input");
    if (slider) slider.value = String(volume);
  }
  getIframe() { return this.frame; }
  destroy() { counts.destroy++; }
}
// Structural mock constructor; the real implementation also accepts element IDs.
window.YT = { Player: MockPlayer } as unknown as NonNullable<typeof window.YT>;

function Fixture() {
  const player = useRef<FullscreenPlayerHandle>(null);
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState(0);
  const [status, setStatus] = useState("");
  const [report, setReport] = useState("Not run");
  const [size, setSize] = useState(400);
  const [covered, setCovered] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [hidden, setHidden] = useState(false);
  return <main style={{ padding: 8, fontFamily: "sans-serif" }}>
    <h1>LOCAL MOCK — Phase 2 regression</h1>
    <p>No real YouTube content, API, or network. Never use this page as audit playback evidence.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0" }}>
      <button onClick={() => { privacyConsent.accept(); setMounted(true); setSession(n => n + 1); }}>Mount autoplay</button>
      <button onClick={() => { decisionMode = "expiring"; privacyConsent.accept(); setMounted(true); setSession(n => n + 1); }}>Mount near expiry</button>
      <button onClick={() => { decisionMode = "normal"; transientFailures = 1; privacyConsent.accept(); setMounted(true); setSession(n => n + 1); }}>Mount with one 503</button>
      <button onClick={() => { decisionMode = "blocked"; privacyConsent.accept(); setMounted(true); setSession(n => n + 1); }}>Switch to blocked song</button>
      <button onClick={() => player.current?.play()}>Manual Play</button>
      <button onClick={() => player.current?.pause()}>Pause</button>
      <button onClick={() => player.current?.restart()}>Replay</button>
      <button onClick={() => { setMounted(false); }}>Unmount</button>
      <button onClick={() => { rejectPlay = !rejectPlay; setBlocked(rejectPlay); }}>Toggle browser rejection</button>
      <button onClick={() => setSize(n => n === 199 ? 400 : 199)}>Toggle 199px boundary</button>
      <button onClick={() => setCovered(n => !n)}>Toggle cover</button>
      <button onClick={() => {
        const next = !hidden;
        Object.defineProperty(document, "visibilityState", { configurable: true, value: next ? "hidden" : "visible" });
        setHidden(next);
        document.dispatchEvent(new Event("visibilitychange"));
      }}>Simulate visibilitychange</button>
      <button onClick={() => setReport(JSON.stringify(counts))}>Read counters</button>
    </div>
    <p>Status: {status}; rejection: {String(blocked)}; width: {size}; simulated hidden: {String(hidden)}</p>
    <output>{report}</output>
    <div style={{ position: "relative", width: size, height: 300, marginTop: 12 }}>
      {mounted && <FullscreenPlayer key={session} ref={player} videoId="dQw4w9WgXcQ" autoPlay playRequestId={0}
        onPlaybackStarted={() => {}} onPlaybackEnded={() => {}} onPlaybackError={() => {}}
        onAutoplayBlocked={() => setStatus("blocked")} onStatusChange={setStatus} />}
      {covered && <div style={{ position: "absolute", inset: 0, background: "#aaa" }}>Test obstruction</div>}
    </div>
  </main>;
}
const queryClient = new QueryClient();
const displayRoomId = window.location.search === "?display" ? createRoomId() : null;
if (displayRoomId) {
  privacyConsent.accept();
  addSongToRoom(displayRoomId, { videoId: "dQw4w9WgXcQ", title: "Volume test one", metadataStamp: apiStamp() });
  addSongToRoom(displayRoomId, { videoId: "M7lc1UVf-VE", title: "Volume test two", metadataStamp: apiStamp() });
}
createRoot(document.getElementById("root")!).render(window.location.search === "?mobile"
  ? <QueryClientProvider client={queryClient}><MemoryRouter initialEntries={["/room/bugfix1104/mobile"]}><Routes>
      <Route path="/room/:roomId/mobile" element={<MobilePage />} />
    </Routes></MemoryRouter></QueryClientProvider>
  : displayRoomId
    ? <QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[`/room/${displayRoomId}/display`]}><Routes>
        <Route path="/room/:roomId/display" element={<DisplayPage />} />
      </Routes></MemoryRouter></QueryClientProvider>
    : <Fixture />);
