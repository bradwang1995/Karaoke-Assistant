import { describe, expect, it } from "vitest";
import {
  enforceYouTubePreviewStart,
  hasYouTubePreviewReachedStart,
  MOBILE_PREVIEW_START_SECONDS,
  youtubeEmbedUrl,
  youtubePreviewEmbedUrl,
  youtubePreviewPlayerVars,
} from "./youtube";
import type { YouTubePlayer } from "./youtubeIframeApi";

describe("YouTube embed URLs", () => {
  it("starts mobile previews at 30 seconds", () => {
    const url = new URL(youtubePreviewEmbedUrl("video-id"));

    expect(MOBILE_PREVIEW_START_SECONDS).toBe(30);
    expect(url.searchParams.get("start")).toBe("30");
    expect(url.searchParams.get("autoplay")).toBe("1");
    expect(url.searchParams.get("mute")).toBe("1");
  });

  it("configures selected-card previews for immediate muted autoplay from 30 seconds", () => {
    expect(youtubePreviewPlayerVars("https://example.com")).toMatchObject({
      autoplay: 1,
      mute: 1,
      start: 30,
      playsinline: 1,
      origin: "https://example.com",
    });
  });

  it("requests captions while keeping preview controls disabled", () => {
    expect(youtubePreviewPlayerVars("https://example.com")).toMatchObject({
      cc_load_policy: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
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

  it("keeps app-owned embeds free of native controls", () => {
    const url = new URL(youtubeEmbedUrl("video-id"));

    expect(url.searchParams.get("controls")).toBe("0");
    expect(url.searchParams.get("disablekb")).toBe("1");
    expect(url.searchParams.get("fs")).toBe("0");
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
