import { loadYouTubeIframeApi } from "./youtubeIframeApi";
import { describe, expect, it, vi } from "vitest";
import {
  createYouTubeIframe,
  enforceYouTubePreviewStart,
  hasYouTubePreviewReachedStart,
  MOBILE_PREVIEW_START_SECONDS,
  youtubeEmbedUrl,
  youtubePreviewEmbedUrl,
  youtubePreviewPlayerVars,
} from "./youtube";
import type { YouTubePlayer } from "./youtubeIframeApi";

describe("YouTube embed URLs", () => {
  it("rejects loading the third-party API script without permission", async () => {
    await expect(loadYouTubeIframeApi({ videoId: "video-id", allowed: false, reason: "unknown" }, "video-id")).rejects.toThrow("Playback permission required");
  });
  it("does not create or navigate an iframe before a matching valid playback decision", () => {
    const createElement = vi.fn();
    vi.stubGlobal("document", { createElement });
    try {
      for (const decision of [
        { videoId: "video-id", allowed: false, reason: "unknown" as const },
        { videoId: "other", allowed: true, reason: "allowed" as const, expiresAt: new Date(Date.now() + 1000).toISOString() },
        { videoId: "video-id", allowed: true, reason: "allowed" as const, expiresAt: "broken" },
        { videoId: "video-id", allowed: true, reason: "allowed" as const, expiresAt: new Date(0).toISOString() },
      ]) expect(() => createYouTubeIframe("video-id", {}, decision)).toThrow("Playback permission required");
      expect(createElement).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it("allows external popups while preventing top-level navigation before loading the player", () => {
    const attributes = new Map<string, string>();
    const iframe = { setAttribute: (key: string, value: string) => attributes.set(key, value) };
    vi.stubGlobal("document", { createElement: () => iframe });
    try {
      const result = createYouTubeIframe("video-id", {
        enablejsapi: 1, controls: 1, origin: "https://example.com",
      }, { videoId: "video-id", allowed: true, reason: "allowed", expiresAt: new Date(Date.now() + 1000).toISOString() });
      const sandbox = attributes.get("sandbox")!.split(" ");
      expect(sandbox).toEqual(expect.arrayContaining([
        "allow-scripts", "allow-same-origin", "allow-popups", "allow-popups-to-escape-sandbox",
      ]));
      expect(sandbox).not.toContain("allow-top-navigation");
      expect(sandbox).not.toContain("allow-top-navigation-by-user-activation");
      expect(result.allowFullscreen).toBe(true);
      expect(result.referrerPolicy).toBe("strict-origin-when-cross-origin");
      expect(new URL(result.src).searchParams.get("enablejsapi")).toBe("1");
      expect(new URL(result.src).searchParams.get("origin")).toBe("https://example.com");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("starts mobile previews at 30 seconds", () => {
    const url = new URL(youtubePreviewEmbedUrl("video-id"));

    expect(MOBILE_PREVIEW_START_SECONDS).toBe(30);
    expect(url.searchParams.get("start")).toBe("30");
    expect(url.searchParams.has("autoplay")).toBe(false);
    expect(url.searchParams.get("mute")).toBe("1");
  });

  it("cues selected-card previews muted at 30 seconds without autoplay", () => {
    expect(youtubePreviewPlayerVars("https://example.com")).toMatchObject({
      autoplay: 0,
      mute: 1,
      start: 30,
      playsinline: 1,
      origin: "https://example.com",
    });
  });

  it("requests captions and enables native preview controls", () => {
    expect(youtubePreviewPlayerVars("https://example.com")).toMatchObject({
      cc_load_policy: 1,
      controls: 1,
      disablekb: 0,
      fs: 1,
    });
  });

  it("does not consider preview playback ready until the real player time reaches 30 seconds", () => {
    let currentTime = 0;
    const calls: string[] = [];
    const player = {
      getCurrentTime: () => currentTime,
      mute: () => calls.push("mute"),
      seekTo: (seconds: number) => {
        calls.push(`seek:${seconds}`);
        currentTime = seconds;
      },
      playVideo: () => calls.push("play"),
    } satisfies YouTubePlayer;

    expect(hasYouTubePreviewReachedStart(player)).toBe(false);
    expect(enforceYouTubePreviewStart(player)).toBe(true);
    expect(hasYouTubePreviewReachedStart(player)).toBe(true);
    expect(calls).toEqual(["mute", "seek:30", "play"]);
  });

  it("enables native controls alongside app-owned controls", () => {
    const url = new URL(youtubeEmbedUrl("video-id"));

    expect(url.searchParams.get("controls")).toBe("1");
    expect(url.searchParams.get("disablekb")).toBe("0");
    expect(url.searchParams.get("fs")).toBe("1");
  });

  it("does not emit deprecated branding parameters", () => {
    const url = new URL(youtubeEmbedUrl("video-id"));
    const previewVars = youtubePreviewPlayerVars("https://example.com");

    expect(url.searchParams.has("modestbranding")).toBe(false);
    expect(url.searchParams.has("showinfo")).toBe(false);
    expect(previewVars).not.toHaveProperty("modestbranding");
    expect(previewVars).not.toHaveProperty("showinfo");
  });
});
