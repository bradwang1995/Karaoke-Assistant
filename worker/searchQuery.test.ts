import { describe, expect, it } from "vitest";
import { classifySearchQuery } from "./searchQuery";

describe("search query classification", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://m.youtube.com/shorts/dQw4w9WgXcQ?feature=share",
    "https://youtu.be/dQw4w9WgXcQ?si=test",
    "youtube.com/live/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ])("extracts a direct YouTube video id from %s", (query) => {
    expect(classifySearchQuery(query)).toEqual({
      kind: "youtube-video-url",
      videoId: "dQw4w9WgXcQ",
    });
  });

  it.each([
    "https://example.com/song",
    "www.example.com/song",
    "https://youtube.com/playlist?list=PL123",
    "https://youtube.com/watch?v=too-short",
    "ftp://youtu.be/dQw4w9WgXcQ",
    "https://youtube.com.example.com/watch?v=dQw4w9WgXcQ",
  ])("blocks URL-like input that is not a supported YouTube video URL: %s", (query) => {
    expect(classifySearchQuery(query)).toEqual({ kind: "blocked-url" });
  });

  it.each(["后来", "A", "周杰伦 晴天", "周杰伦: 晴天", "not a url"])(
    "keeps ordinary search text unchanged: %s",
    (query) => {
      expect(classifySearchQuery(query)).toEqual({ kind: "text" });
    },
  );
});
