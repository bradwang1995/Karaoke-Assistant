import { describe, expect, it } from "vitest";
import { rankSearchResultsForQuery, scoreSearchResult } from "./scoring";

describe("search scoring", () => {
  it("rewards KTV-like results", () => {
    const result = scoreSearchResult(
      {
        videoId: "video-1",
        title: "后来 KTV 字幕版",
        channelTitle: "KTV Channel",
        durationSeconds: 280,
      },
      "后来",
    );

    expect(result.score).toBeGreaterThan(20);
    expect(result.reasons).toContain("title contains KTV");
    expect(result.reasons).toContain("title exactly matches song query");
  });

  it("penalizes likely non-karaoke results", () => {
    const result = scoreSearchResult(
      {
        videoId: "video-1",
        title: "后来 live cover",
        channelTitle: "Example",
        durationSeconds: 30,
      },
      "后来",
    );

    expect(result.score).toBeLessThan(0);
    expect(result.reasons).toContain("video too short");
    expect(result.reasons).toContain("title contains song query with low-priority marker");
  });

  it("keeps exact song-title matches ahead of related karaoke results", () => {
    const results = rankSearchResultsForQuery(
      [
        {
          videoId: "related",
          title: "刘若英 经典情歌 KTV 合集",
          channelTitle: "后来 Karaoke Channel",
          durationSeconds: 280,
        },
        {
          videoId: "exact",
          title: "后来 KTV 字幕版",
          channelTitle: "KTV Channel",
          durationSeconds: 280,
        },
      ],
      "后来",
    );

    expect(results[0].videoId).toBe("exact");
    expect(results[0].reasons).toContain("title exactly matches song query");
    expect(results).toHaveLength(1);
  });

  it("removes unrelated karaoke matches instead of letting intent keywords outrank the query", () => {
    const results = rankSearchResultsForQuery(
      [
        {
          videoId: "unrelated-karaoke",
          title: "\u9093\u7d2b\u68cb\u300a\u552f\u4e00\u300b Pinyin Karaoke Version Instrumental KTV",
          channelTitle: "Karaoke Channel",
          durationSeconds: 250,
        },
        {
          videoId: "matching-lyrics",
          title: "\u738b\u8273\u8587 - \u79bb\u5f00\u6211\u7684\u4f9d\u8d56 Lyrics",
          channelTitle: "Aurora music",
          durationSeconds: 248,
        },
        {
          videoId: "matching-original",
          title: "\u79bb\u5f00\u6211\u7684\u4f9d\u8d56 \u5e26\u539f\u5531 KTV",
          channelTitle: "Fan Upload",
          durationSeconds: 248,
        },
      ],
      "\u4f9d\u8d56",
      { searchType: "song", includeOriginalVocal: true },
    );

    expect(results.map((result) => result.videoId)).toEqual([
      "matching-original",
      "matching-lyrics",
    ]);
  });

  it("removes unrelated metadata from song-title search results", () => {
    const results = rankSearchResultsForQuery(
      [
        {
          videoId: "matching",
          title: "年少有为 KTV 伴奏版",
          channelTitle: "KTV Channel",
          durationSeconds: 280,
        },
        {
          videoId: "channel-only",
          title: "热门华语歌曲合集",
          channelTitle: "年少有为 Karaoke",
          durationSeconds: 280,
        },
        {
          videoId: "unrelated",
          title: "完全不同的歌 official MV lyrics",
          channelTitle: "Music Channel",
          durationSeconds: 280,
        },
      ],
      "年少有为",
      { searchType: "song", includeOriginalVocal: true },
    );

    expect(results.map((result) => result.videoId)).toEqual(["matching"]);
  });

  it("moves original-vocal results ahead when original vocals are requested", () => {
    const results = rankSearchResultsForQuery(
      [
        {
          videoId: "karaoke",
          title: "后来 KTV 伴奏版",
          channelTitle: "KTV Channel",
          durationSeconds: 280,
        },
        {
          videoId: "lyrics",
          title: "后来 lyric video 歌词版",
          channelTitle: "Official Channel",
          durationSeconds: 280,
        },
      ],
      "后来",
      { includeOriginalVocal: true },
    );

    expect(results[0].videoId).toBe("lyrics");
    expect(results[0].reasons).toContain("title contains lyric video");
    expect(results[1].reasons).toContain(
      "accompaniment conflicts with original-vocal intent",
    );
  });

  it("uses original-vocal intent to rank non-KTV results", () => {
    const results = rankSearchResultsForQuery(
      [
        {
          videoId: "plain",
          title: "后来 audio",
          channelTitle: "Fan Upload",
          durationSeconds: 280,
        },
        {
          videoId: "official",
          title: "后来 official MV 原唱",
          channelTitle: "Official Channel",
          durationSeconds: 280,
        },
      ],
      "后来",
      { includeOriginalVocal: true },
    );

    expect(results[0].videoId).toBe("official");
    expect(results[0].reasons).toContain("title contains 原唱");
  });

  it("keeps karaoke searches accompaniment-only and original searches vocal-first", () => {
    const candidates = [
      {
        videoId: "karaoke",
        title: "后来 KTV 伴奏版",
        channelTitle: "KTV Channel",
        durationSeconds: 280,
      },
      {
        videoId: "original",
        title: "后来 official MV 原唱 歌词",
        channelTitle: "Official Channel",
        durationSeconds: 280,
      },
    ];

    const karaokeOrder = rankSearchResultsForQuery(candidates, "后来", {
      includeOriginalVocal: false,
    });
    const originalOrder = rankSearchResultsForQuery(candidates, "后来", {
      includeOriginalVocal: true,
    });

    expect(karaokeOrder.map((result) => result.videoId)).toEqual(["karaoke"]);
    expect(originalOrder.map((result) => result.videoId)).toEqual(["original", "karaoke"]);
  });

  it("prioritizes artist metadata in artist search mode", () => {
    const results = rankSearchResultsForQuery(
      [
        {
          videoId: "other",
          title: "晴天 KTV 伴奏版",
          channelTitle: "KTV Channel",
          durationSeconds: 280,
        },
        {
          videoId: "artist",
          title: "周杰伦 晴天 KTV",
          channelTitle: "周杰伦 Official",
          durationSeconds: 280,
        },
      ],
      "周杰伦",
      { searchType: "artist" },
    );

    expect(results.map((result) => result.videoId)).toEqual(["artist"]);
    expect(results[0].reasons.join("; ")).toContain("artist query");
  });

  it("keeps lyrics, radio, and official audio ahead for original-vocal searches", () => {
    const results = rankSearchResultsForQuery(
      [
        {
          videoId: "karaoke",
          title: "如愿 KTV 纯伴奏",
          channelTitle: "KTV Channel",
          durationSeconds: 280,
        },
        {
          videoId: "radio",
          title: "如愿 Lyrics Radio Official Audio",
          channelTitle: "Music Channel",
          durationSeconds: 280,
        },
      ],
      "如愿",
      { searchType: "song", includeOriginalVocal: true },
    );

    expect(results.map((result) => result.videoId)).toEqual(["radio", "karaoke"]);
  });
});
