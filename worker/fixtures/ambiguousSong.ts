import type { VideoSearchResult } from "../../src/types/youtube";

// Screenshot-inspired candidates, deliberately keeping the songs at the provider's tail.
// IDs are synthetic; this fixture must never require a YouTube request.
export function ambiguousSongCandidates(): VideoSearchResult[] {
  const unrelatedTitles = [
    '你们说谁耍赖 #打火机 #吉隆坡的天气',
    '霸总喝醉耍赖太可爱，黏在灰姑娘身上',
    '任贤齐耍赖婚礼一拖再拖 自曝对女装情有独钟',
    '“夕阳红”射箭全过程：沙溢“耍赖”',
    '可以演戏了！啼啼大哭耍赖看修杰楷变脸',
    '第一次来KTV 有点紧张 #演出表演 #舞台',
    '我要换丈母娘（歪歌）卡拉OK 歌词 KTV',
    '唱霸王KTV! 男摆阔叫6女陪酒耍赖不付钱',
    '今日份耍赖皮的爸爸 #女儿奴 #治愈系笑容',
    '嚣张！不给彩票就砸桌 耍赖女大闹',
    '洪佩瑜 Pei-Yu Hung - 不佔地方',
    '游喧 勾勾手 mv 完整版',
  ];
  const distractions = Array.from({ length: 44 }, (_, index) => ({
    videoId: `unrelated-${index}`,
    title: unrelatedTitles[index % unrelatedTitles.length],
    channelTitle: "日常视频",
    categoryId: "24",
    durationSeconds: 240,
    score: 9999 - index,
    reasons: ["old cached score"],
  }));
  const songs = [
    { videoId: "song-ktv", title: "陳楚生 - 耍賴 KTV 伴奏版", categoryId: "10" },
    { videoId: "song-official", title: "陳楚生 - 耍賴 Official MV 原唱", categoryId: "10" },
    { videoId: "song-lyrics", title: "陳楚生 - 耍賴『我的世界經得住你一萬次耍賴』" },
    { videoId: "song-cover", title: "耍賴 Cover by 小林", categoryId: "24" },
    { videoId: "song-live", title: "陳楚生《耍賴》現場 Live" },
    { videoId: "song-plain", title: "耍賴" },
  ].map((song) => ({ ...song, score: -9999, reasons: ["old cached score"] }));

  return [...distractions, ...songs];
}
