import { describe, expect, it } from "vitest";
import { rankSearchResultsForQuery, scoreSearchResult } from "./scoring";

describe("search scoring", () => {
  it("rewards strong song-title and KTV signals", () => {
    const result = scoreSearchResult(
      candidate("strong", "后来 KTV 字幕伴奏版", "KTV Channel", ["karaoke", "instrumental"]),
      "后来",
    );

    expect(result.score).toBeGreaterThan(50);
    expect(result.reasons).toContain("title contains KTV");
    expect(result.reasons).toContain("title exactly matches song query");
  });

  it("ranks a matching song above weak title mismatches without deleting either", () => {
    const results = rankSearchResultsForQuery(
      [
        candidate("wrong-song", "黄小琥 没那么简单 KTV", "Karaoke Channel"),
        candidate("channel-only", "热门华语歌曲合集", "后来 Karaoke"),
        candidate("matching", "后来 KTV 伴奏版", "KTV Channel"),
      ],
      "后来",
      { searchType: "song", includeOriginalVocal: false },
    );

    expect(results.map((result) => result.videoId)).toEqual([
      "matching",
      "channel-only",
      "wrong-song",
    ]);
  });

  it("uses KTV and original intent only to change ordering", () => {
    const candidates = [
      candidate("karaoke", "后来 KTV 伴奏版", "KTV Channel", ["karaoke", "instrumental"]),
      candidate("original", "后来 Official MV 原唱 Lyrics", "Official Channel", ["official"]),
    ];

    const karaokeOrder = rankSearchResultsForQuery(candidates, "后来", {
      includeOriginalVocal: false,
    });
    const originalOrder = rankSearchResultsForQuery(candidates, "后来", {
      includeOriginalVocal: true,
    });

    expect(karaokeOrder.map((result) => result.videoId)).toEqual(["karaoke", "original"]);
    expect(originalOrder.map((result) => result.videoId)).toEqual(["original", "karaoke"]);
  });

  it("ranks strong artist metadata above weak metadata while preserving all candidates", () => {
    const results = rankSearchResultsForQuery(
      [
        candidate("weak", "晴天 KTV 伴奏版", "KTV Channel"),
        candidate("tag-match", "修炼爱情 Karaoke", "Music Channel", ["林俊杰"]),
        candidate("strong", "林俊杰 江南 KTV", "林俊杰 Official"),
      ],
      "林俊杰",
      { searchType: "artist", includeOriginalVocal: false },
    );

    expect(results.map((result) => result.videoId)).toEqual(["strong", "tag-match", "weak"]);
    expect(results.at(-1)?.reasons).toContain("metadata does not match artist query");
  });

  it("preserves covers and wrong-intent artist results but ranks official originals first", () => {
    const results = rankSearchResultsForQuery(
      [
        candidate("ktv", "林俊杰 江南 KTV 伴奏", "KTV Channel"),
        candidate("cover", "林俊杰 江南 Cover", "Fan Channel"),
        candidate("official", "林俊杰 修炼爱情 Lyrics Official Audio", "JJ Lin"),
      ],
      "林俊杰",
      { searchType: "artist", includeOriginalVocal: true },
    );

    expect(results[0].videoId).toBe("official");
    expect(results.map((result) => result.videoId)).toEqual(
      expect.arrayContaining(["official", "cover", "ktv"]),
    );
    expect(results).toHaveLength(3);
  });

  it("keeps long videos eligible and applies each Chinese negative signal once", () => {
    const result = scoreSearchResult(
      {
        ...candidate("medley", "情歌王 现场 教学 KTV", "Music Channel"),
        durationSeconds: 1_200,
      },
      "情歌王",
    );

    expect(result.reasons.filter((reason) => reason.includes("现场"))).toHaveLength(1);
    expect(result.reasons.filter((reason) => reason.includes("教学"))).toHaveLength(1);
    expect(result.reasons).toContain("video too long");
    expect(rankSearchResultsForQuery([result], "情歌王")).toHaveLength(1);
  });

  it("keeps stable provider order when scores tie", () => {
    const results = rankSearchResultsForQuery(
      [candidate("first", "无关内容一", "Channel"), candidate("second", "无关内容二", "Channel")],
      "后来",
    );

    expect(results.map((result) => result.videoId)).toEqual(["first", "second"]);
  });
});

function candidate(videoId: string, title: string, channelTitle: string, tags?: string[]) {
  return {
    videoId,
    title,
    channelTitle,
    ...(tags ? { tags } : {}),
    durationSeconds: 280,
  };
}
