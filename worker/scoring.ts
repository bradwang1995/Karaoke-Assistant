import type { VideoSearchResult } from "../src/types/youtube";

const POSITIVE_SIGNALS = [
  { text: "ktv", score: 10, reason: "title contains KTV" },
  { text: "\u5361\u62c9ok", score: 10, reason: "title contains karaoke marker" },
  { text: "\u4f34\u594f", score: 8, reason: "title contains instrumental marker" },
  { text: "\u5b57\u5e55", score: 5, reason: "title contains subtitles marker" },
  { text: "卡拉ok", score: 10, reason: "title contains 卡拉OK" },
  { text: "伴奏", score: 8, reason: "title contains 伴奏" },
  { text: "字幕", score: 5, reason: "title contains 字幕" },
  { text: "karaoke", score: 5, reason: "title contains karaoke" },
  { text: "instrumental", score: 4, reason: "title contains instrumental" },
  { text: "pinyin", score: 3, reason: "title contains pinyin" },
];

const NEGATIVE_SIGNALS = [
  { text: "live", score: -8, reason: "title contains live" },
  { text: "\u73b0\u573a", score: -8, reason: "title contains live marker" },
  { text: "现场", score: -8, reason: "title contains 现场" },
  { text: "reaction", score: -8, reason: "title contains reaction" },
  { text: "cover", score: -6, reason: "title contains cover" },
  { text: "tutorial", score: -5, reason: "title contains tutorial" },
  { text: "\u6559\u5b66", score: -5, reason: "title contains tutorial marker" },
  { text: "shorts", score: -5, reason: "title contains shorts" },
  { text: "lyrics", score: -4, reason: "title contains lyrics" },
  { text: "教学", score: -5, reason: "title contains 教学" },
];

export function scoreSearchResult(
  result: Omit<VideoSearchResult, "score" | "reasons">,
  originalQuery: string,
): VideoSearchResult {
  const haystack = `${result.title} ${result.channelTitle ?? ""}`.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  for (const signal of POSITIVE_SIGNALS) {
    if (haystack.includes(signal.text)) {
      score += signal.score;
      reasons.push(signal.reason);
    }
  }

  for (const signal of NEGATIVE_SIGNALS) {
    if (haystack.includes(signal.text)) {
      score += signal.score;
      reasons.push(signal.reason);
    }
  }

  if (originalQuery && haystack.includes(originalQuery.toLowerCase())) {
    score += 8;
    reasons.push("title contains query");
  }

  if (typeof result.durationSeconds === "number") {
    if (result.durationSeconds < 60) {
      score -= 10;
      reasons.push("video too short");
    }
    if (result.durationSeconds > 900) {
      score -= 5;
      reasons.push("video too long");
    }
  }

  return { ...result, score, reasons };
}
