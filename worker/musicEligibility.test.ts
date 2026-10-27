import { describe, expect, it } from "vitest";
import { cachedAmbiguousSongCandidates } from "./fixtures/cachedAmbiguousSong";
import { musicEligibility, isSelfContainedMusicRecording } from "./musicEligibility";

describe("conservative music search and selective recommendations", () => {
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
