import { describe, expect, it } from "vitest";
import { cachedAmbiguousSongCandidates } from "./fixtures/cachedAmbiguousSong";
import { musicEligibility, isSelfContainedMusicRecording } from "./musicEligibility";

describe("conservative music search and selective recommendations", () => {
  it.each([
    ["周深", "【中文版本】周深新歌《浮光》跨晩首唱！宿命感拉满", "24"],
    ["周深", "【周深】周深不太会唱系列三 我试试", "24"],
    ["周深", "#周深  封神之曲《达拉崩吧》", "29"],
    ["林俊杰", "林俊傑 孤獨娛樂", "22"],
    ["某歌手", "某歌手 - 灰姑娘", "24"],
  ])("retains real artist uploads despite non-Music metadata: %s / %s", (query, title, categoryId) => {
    expect(musicEligibility({ title, categoryId }, query, { searchType: "artist" }).searchEligible).toBe(true);
  });

  it("keeps an ambiguous non-Music upload searchable without recommending it", () => {
    expect(musicEligibility({ title: "普通上传", categoryId: "22" }, "耍赖"))
      .toEqual({ searchEligible: true, recommendationEligible: false });
  });

  it.each([
    "[ KTV ] 三国恋 Tam Quốc Luyến - TANK Karaoke 伴奏",
    "TANK 呂建忠 - 三國戀 Three Kingdom Love (伴奏 KTV Instrumental)",
    "TANK.-.[三國戀].KTV.mpg",
    "汪蘇瀧  三國殺  KTV版",
    "歌手《恋三国》翻唱",
  ])("recommends a partial query in a recording title: %s", (title) => {
    expect(musicEligibility({ title, categoryId: "10" }, "三国").recommendationEligible).toBe(true);
  });

  it("preserves English word boundaries for partial recording titles", () => {
    expect(musicEligibility({ title: "Artist - Someone Lyrics", categoryId: "10" }, "One").recommendationEligible).toBe(false);
    expect(musicEligibility({ title: "Artist - One Day Lyrics", categoryId: "10" }, "One").recommendationEligible).toBe(true);
  });

  it.each([
    { title: "王靖雯 - 唉『我好想看你耍賴』Lyrics", categoryId: "10" },
    { title: "新闻采访 三国演员谈拍戏", categoryId: "24" },
    { title: "日常生活 #三国恋 #MV", categoryId: "22" },
  ])("does not promote a lyric, narrative or hashtag match: $title", (result) => {
    const query = result.title.includes("耍賴") ? "耍赖" : "三国";
    expect(musicEligibility(result, query).recommendationEligible).toBe(false);
  });

  it.each([
    ["陳楚生 - 耍賴 Official Music Video", "10"],
    ["陳楚生 - 耍賴 Lyrics", "24"],
    ["耍賴 Cover by 小林", "24"],
    ["耍赖 伴奏", "22"],
    ["陳楚生《耍賴》现场 Live", "24"],
    ["耍赖 KTV", "22"],
    ["耍赖 卡拉OK", "24"],
    ["耍赖 instrumental", "19"],
    ["耍赖", "10"],
  ])("preserves and recommends a matching music version regardless of category: %s", (title, categoryId) => {
    expect(musicEligibility({ title, categoryId }, "耍赖")).toEqual({ searchEligible: true, recommendationEligible: true });
  });

  it.each([
    ["警察处理醉汉耍赖", "25"],
    ["霸总喝醉耍赖，灰姑娘超幸福", "24"],
    ["不给彩票就砸桌 耍赖女大闹", "22"],
  ])("excludes known non-music clips without music evidence: %s", (title, categoryId) => {
    expect(musicEligibility({ title, categoryId }, "耍赖")).toEqual({ searchEligible: false, recommendationEligible: false });
  });

  it.each([
    { title: "普通上传", categoryId: undefined },
    { title: "耍賴", categoryId: "24" },
    { title: "第一次来KTV 有点紧张 #演出表演 #舞台", categoryId: "22" },
    { title: "你们说谁耍赖 #打火机翻唱#ktv", categoryId: "22" },
    { title: "唱霸王KTV! 男摆阔耍赖不付钱", categoryId: "25" },
  ])("keeps uncertain uploads searchable without automatic recommendation: $title", (result) => {
    expect(musicEligibility(result, "耍赖")).toEqual({ searchEligible: true, recommendationEligible: false });
  });

  it("does not require the original singer, a duration, or a particular vocal intent", () => {
    expect(musicEligibility({ title: "耍賴 翻唱" }, "耍赖", { artist: "陈楚生" }).recommendationEligible).toBe(true);
  });

  it("requires song identity rather than another song's lyrics", () => {
    expect(musicEligibility({ title: "王靖雯 - 唉『我好想看你耍賴』Lyrics", categoryId: "10" }, "耍赖"))
      .toEqual({ searchEligible: true, recommendationEligible: false });
  });

  it("requires artist title/channel affinity rather than tags alone", () => {
    expect(musicEligibility({ title: "陳楚生 - 耍賴", categoryId: "10" }, "陈楚生", { searchType: "artist" }).recommendationEligible).toBe(true);
    expect(musicEligibility({ title: "耍賴 MV", channelTitle: "陳楚生", categoryId: "10" }, "陈楚生", { searchType: "artist" }).recommendationEligible).toBe(true);
    expect(musicEligibility({ title: "别人的歌 MV", tags: ["陈楚生"], categoryId: "10" }, "陈楚生", { searchType: "artist" }).recommendationEligible).toBe(false);
  });

  it("keeps all four actual matching uploads, recommends only those four, and hides known irrelevant clips", () => {
    const candidates = cachedAmbiguousSongCandidates;
    const visible = candidates.filter((result) => musicEligibility(result, "耍赖").searchEligible);
    const recommended = candidates.filter((result) => musicEligibility(result, "耍赖").recommendationEligible);
    expect(visible.length).toBeLessThan(50);
    expect(recommended.map((result) => result.videoId)).toEqual(expect.arrayContaining([
      "-H5mMOf7quU", "00QDPHlWhvU", "jd4cllIyDHg", "IdMHKsoFNCI",
    ]));
    expect(recommended).toHaveLength(4);
    expect(visible.map((result) => result.videoId)).not.toContain("uPs3JXnKzI4");
  });

  it("does not let an unknown queued video or a venue hashtag become a song", () => {
    expect(isSelfContainedMusicRecording("YouTube 视频")).toBe(false);
    expect(isSelfContainedMusicRecording("KTV 敬酒起冲突 #cover")).toBe(false);
    expect(isSelfContainedMusicRecording("歌手 - 耍赖 Cover")).toBe(true);
  });
});
