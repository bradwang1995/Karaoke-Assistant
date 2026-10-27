# 搜索音乐准入改动前基线

记录日期：2026-10-27。此文档保存成熟版本与本轮变更边界，不替代 SEARCH.md 的当前契约。

## 可恢复节点

- 基线 commit：`aa65a603247bbb01f7b864e4ea08714a216570a0`；tree：`3b71f93471407ccb7428bad9f8dba41bccd2fbc4`。
- 原分支：`codex/search-relevance-ranking`；实施分支：`codex/music-eligibility-cache`。
- 回退 tag：`codex/baseline-before-music-eligibility-2026-10-27`。已随 `codex/music-eligibility-cache` 发布分支推送远程，并核实指向上述成熟 commit。
- 开始前 `git status --short` 为空；已包含双语界面与已批准的紧凑底栏（160px 下一首区域）。
- 2026-10-27 本次发布前已用 deployments status 只读核实回退版本：Room `dd918083-a7ae-49b8-9a20-1fd2ab7938e0`，Main `46fb6774-1898-4ee3-8e08-34ad377ed16e`，均 100% 活动。

## 修改前实际验证

后续四项修复的起点是发布记录 `a6651fb`（功能 `eae1d9d`），开始前工作区干净；已发布 policy `music-evidence-v1`、推荐 `v7`，原始 algorithm/KV 与成熟基线相同。该起点曾通过 31 files/240 tests、搜索专项 142 项和 build。四项修复使用 policy v2 / 推荐 v8，继续保留原始候选以及旧 v7 池，回退到上述发布代码不需恢复或清理缓存。用户后续授权的发布结果记录于 PROGRESS.md；原 v1 回退部署为 Room `ac92afe0-a8c5-4cce-ac01-5d6378d69427`、Main `ea599cd9-e959-4cb6-94f5-8db9890c09e6`。

| 检查 | 结果 |
| --- | --- |
| npm test | 30 files / 208 tests 通过 |
| npm run verify:search | 13 files / 110 tests 通过，禁止真实网络 |
| typecheck | verify:search 内通过 |
| npm run build | 通过，2248 modules |

前端基线产物：index CSS `47.98 kB`，主 JS `337.21 kB`，Admin JS `405.69 kB`（构建工具报告值，不是性能指标）。

## 既有搜索行为

- provider 最多一次 search.list、最多 50 个原始候选；1600ms Worker / 2000ms 浏览器。
- 原始准入只排除无效 id/title、重复与明确不可嵌入项。所有结构可用候选保留，重新计算现有 ranking。
- algorithm `rank-preserve-50-v2`；exact KV `v4`；recommendations `v6`；每 family 最多提升前 20 条，没有音乐资格门槛。
- D1 exact 优先，KV fallback；同 query、artist、searchType、原唱开关隔离。缓存复用不请求 YouTube。
- URL 点歌独立于普通文字搜索；quota、播放器、队列、实时同步与语言偏好均已有行为，不属于本轮改动目标。

## 本轮允许改变与保护措施

- 允许改变：普通搜索隐藏明显非音乐项；首页只推荐合格音乐；旧浏览器结果快照作废后重新取得干净推荐。
- 保持：原始候选缓存与排序、查询来源、配额、deadline、四种模式/URL、点歌播放与中英界面布局。
- 原始 D1/KV entries 不删除、不改变 family hash 或 schema；新版只过滤返回视图。筛后零条不作为 miss。
- 新推荐池使用新 key，旧 `v6` 池不覆盖。回退原代码可继续读取旧 raw caches 和旧推荐 key；未来新查询原始 entries 同样兼容原代码。
- 不承诺仅凭 metadata 对所有未来视频零误判；以音乐正例零误删、未知信息保守保留、raw 候选可恢复为验收标准。
- `worker/fixtures/searchRankingBaseline.ts` 保存改动前真实缓存 50 条的顺序与分数；新增回归将新实现的原始 ranking 与该快照逐条比较。

## 回退步骤（仅说明，本轮不执行）

1. 不要 reset 或覆盖其他人的未提交工作。先保留当前分支；用基线 tag 建立独立 checkout/worktree，或在本轮未来提交后使用 scoped revert。
2. 核对回退不带走已成熟的 localization 与紧凑底栏修改。
3. 本地先验证基线测试和 build。只有用户明确授权发布时才 Room → Main 部署并保留 Dashboard vars/secrets。
4. 不删除 raw caches 或新版推荐 key；旧代码使用既有 family 与 `v6` 推荐 key。线上数据回退无需执行数据库 migration。

## 新实现验证记录

- 最终完整测试 31 files/240 tests，搜索专项 14 files/142 tests（零网络）与 typecheck 通过；build 与 diff check 通过。
- 真实 raw 50 条顺序/分数与基线逐项一致；公开显示 27，推荐 4，所有原始候选仍可由原代码读取。
- 本地双 Worker 验证首页、搜索/原唱、刷新恢复、中英、点歌、房间同步与提升；quota used 0，未请求生产。
- 真实 YouTube 播放未通过：固定样例播放器错误 150；播放器源码未修改。没有把自动测试与点歌同步验收外推为真实播放通过。
- 用户已批准发布，功能提交 `eae1d9d`；新 Room `ac92afe0-a8c5-4cce-ac01-5d6378d69427`、Main `ea599cd9-e959-4cb6-94f5-8db9890c09e6` 已核实为 100% 活动版本。生产 cacheOnly 原始 50/展示 27，quota 0 → 0。实际播放由用户继续生产验收；完整过程见 PROGRESS.md。
