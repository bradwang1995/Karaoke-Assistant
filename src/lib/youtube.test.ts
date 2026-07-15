import { describe, expect, it } from "vitest";
import {
  MOBILE_PREVIEW_START_SECONDS,
  youtubeEmbedUrl,
  youtubePreviewEmbedUrl,
} from "./youtube";

describe("YouTube embed URLs", () => {
  it("starts mobile previews at 30 seconds", () => {
    const url = new URL(youtubePreviewEmbedUrl("video-id"));

    expect(MOBILE_PREVIEW_START_SECONDS).toBe(30);
    expect(url.searchParams.get("start")).toBe("30");
    expect(url.searchParams.get("autoplay")).toBe("1");
    expect(url.searchParams.get("mute")).toBe("1");
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
