import { describe, expect, it } from "vitest";
import {
  enforceYouTubePreviewStart,
  hasYouTubePreviewReachedStart,
  MOBILE_PREVIEW_START_SECONDS,
  startYouTubePreview,
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

  it("explicitly mutes, seeks, and starts mobile previews through the player API", () => {
    const calls: string[] = [];
    const player = {
      mute: () => calls.push("mute"),
      loadVideoById: ({ videoId, startSeconds }) =>
        calls.push(`load:${videoId}:${startSeconds}`),
      seekTo: (seconds, allowSeekAhead) =>
        calls.push(`seek:${seconds}:${allowSeekAhead}`),
      playVideo: () => calls.push("play"),
    } satisfies YouTubePlayer;

    startYouTubePreview(player, "video-id");

    expect(calls).toEqual([
      "mute",
      "load:video-id:30",
      "seek:30:true",
      "play",
    ]);
  });

  it("configures selected-card previews for immediate muted autoplay from 30 seconds", () => {
    expect(youtubePreviewPlayerVars("https://example.com")).toMatchObject({
      autoplay: 0,
      mute: 1,
      start: 30,
      playsinline: 1,
      origin: "https://example.com",
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

    expect(url.searchParams.has("modestbranding")).toBe(false);
    expect(url.searchParams.has("showinfo")).toBe(false);
  });
});
