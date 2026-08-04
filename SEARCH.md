# K歌助手搜索与缓存规范

最后核实：2026-08-04
代码基线：`02f2e42`
状态：当前实现的 source of truth

## 1. 这份文件如何使用

本文件只管理搜索相关行为：输入解释、YouTube 查询、结果准入、排序、D1/KV 缓存、推荐、额度、超时、Mobile 搜索状态和搜索发布验证。播放器的完整行为、房间同步、Admin 认证和通用部署仍见 `README.md`；已经发生过什么、何时发布以及真实验收结果仍见 `PROGRESS.md`。

从现在开始遵守以下规则：

1. `SEARCH.md` 描述“现在的代码实际上怎么运行”，不是愿景稿。
2. 想改变算法时，先在“下一版变更提案”写清输入、期望输出、缓存迁移和验收样例，再修改代码。
3. 代码完成后，同一批改动必须更新本文件的当前契约、版本和测试矩阵。
4. 如果本文件、测试和代码互相矛盾，不允许凭记忆判断；发布前必须把三者重新对齐。
5. `PROGRESS.md` 中的 pass 记录是历史证据，不覆盖本文件的当前规范。

为了防止文档和配置悄悄漂移，下面的 JSON 是 `npm run verify:search` 会读取的机器契约。更改其中任何值，都应同时更改实现和测试。

<!-- SEARCH_CONTRACT_START -->
```json
{
  "schemaVersion": 1,
  "searchAlgorithmVersion": "quality-fill-50-v1",
  "searchCacheVersion": "v4",
  "recommendationsVersion": "v2",
  "regionCode": "CA",
  "relevanceLanguage": "zh-Hans",
  "searchPageSize": 50,
  "maxCachedResults": 50,
  "maxRecommendations": 200,
  "maxDurationSecondsExclusive": 420,
  "dailySearchListLimit": 100,
  "maxSearchListCallsPerColdFill": 1,
  "workerDeadlineMs": 1600,
  "browserDeadlineMs": 2000,
  "kvTtlDays": 365,
  "kvMaxEntryBytes": 524288,
  "rateLimitPerMinute": 20
}
```
<!-- SEARCH_CONTRACT_END -->

## 2. 两分钟理解当前搜索

一次普通文字搜索的实际顺序是：

1. Mobile 只有在用户按搜索或键盘 Search/Enter 时才提交；切换歌名/歌手、原唱开关或修改文字本身不会搜索。
2. Main Worker 先对非空请求执行同 room + IP 的一分钟 rate limit。
3. 服务端用完整规范化文字、可选 artist、歌名/歌手模式、KTV/原唱意图和算法版本生成唯一 family hash。
4. D1 repository 与 KV family cache 并行读取，但 D1 命中优先；只读取当前 exact family，不跨文字、不跨模式、不跨原唱开关。
5. Exact hit 会重新执行当前歌曲资格过滤和当前 ranking，然后直接返回，不请求 YouTube。
6. Exact miss 才进入 quota 检查。当前 production 最多预留并执行一次 `search.list`。
7. 这一次查询固定取最多 50 个 YouTube video candidates，再用一次 `videos.list` 批量补充 duration、category、tags 和 embeddable 状态。
8. 先执行歌曲资格硬过滤，再执行查询相关性和 KTV/原唱意图硬过滤，最后按分数排序。
9. 经过详情验证的非空结果写入 D1 exact repository、KV exact family 和 recommendation pool；零结果不做 negative cache。
10. Worker 的外部预算为 1600ms；浏览器在 2000ms 主动 abort。数量永远服从时间上限，因此结果可能少于 50。

最重要的结论：`最多 50` 不是 `保证 50`；当前 production 不翻页，也不会尝试第二个 alias。缓存保证相同 exact family 重用同一候选集合，但缓存读取时仍会按当前代码重新过滤、重新打分。

## 3. 搜索入口与四种请求类型

### 3.1 空查询：推荐

`query.trim()` 为空时，router 直接读取 recommendation pool：

- 不经过非空搜索 rate limit。
- 不读取 D1 exact repository。
- 不调用 YouTube，也不占 `search.list` ledger。
- API 最多返回 200 条；Mobile 先显示 10 条，再每次增加 10 条。

### 3.2 普通文字：主搜索算法

普通文字限制 100 个字符。Mobile 当前发送：

```json
{
  "query": "后来",
  "limit": 50,
  "searchType": "song",
  "includeOriginalVocal": false
}
```

API 还接受可选 `artist`、`cacheFill` 和隐藏的 `cacheOnly`；Mobile 当前不单独发送 artist，也不暴露 cache-only。

### 3.3 YouTube 单视频 URL：隐藏兜底

服务端在普通 family 逻辑之前识别 `youtube.com/watch`、`youtu.be`、`shorts`、`live`、`embed` 和 `/v/` 的 11 位 video id：

- 跳过 search family、ranking、歌曲类别/7 分钟过滤、D1/KV exact cache、搜索事件和 `search.list` ledger。
- 有 API key 时调用一次 `videos.list` 读取标题、缩略图等 metadata；明确不存在或 `embeddable=false` 时返回空。
- metadata 请求临时失败时，仍返回基于 video id 和 YouTube 缩略图的兜底卡片。
- 该路径没有 Worker 1600ms deadline 包装，但 Mobile 的整个请求仍受浏览器 2000ms abort 约束。
- `cacheOnly=true` 时不调用 `videos.list`，并返回空结果。

这条路径有意允许非 Music 或超过 7 分钟的视频，因为它是用户明确指定 video id 的隐藏后门，不属于推荐算法。

### 3.4 其他 URL：直接拦截

非 YouTube URL、playlist/channel URL、无效 YouTube video URL 和不支持的 YouTube route 均返回空结果，不调用任何 YouTube API，也不写搜索事件。

## 4. 输入规范化与 exact family identity

### 4.1 三个容易混淆的 query 名称

| 名称 | 当前含义 | 示例 |
| --- | --- | --- |
| 原始 query | 用户提交的文字，进入 response 和 D1 `original_query`。 | `  后来  ` |
| canonical query | trim、连续空格折叠、lowercase 后的完整输入；这是 cache identity 的文字部分。 | `后来` |
| provider query | 只在构造 YouTube 查询时继续移除末尾 KTV/karaoke/instrumental/pinyin/伴奏/卡拉OK；不改变 cache identity。 | `后来 KTV` → `后来` |

Response 的 `normalizedQuery` 是 provider-oriented display/debug 值：KTV 通常为 `<文字> ktv`，原唱通常为 `<文字> lyric video`。它不是 D1/KV identity。D1 列名 `normalized_query` 实际保存 canonical query。

### 4.2 Family hash

当前 hash 输入为：

```txt
quality-fill-50-v1 | canonicalQuery | normalizedArtist | searchType | original-or-karaoke
```

然后使用 32-bit FNV-1a 风格计算，输出 8 位十六进制字符串。以下任一项不同都会形成不同 family：

- 完整 canonical query。
- 可选 artist。
- `song` 或 `artist`。
- `includeOriginalVocal=false` 或 `true`。
- `SEARCH_ALGORITHM_VERSION`。

示例：

| 请求 A | 请求 B | 是否同 family | 原因 |
| --- | --- | --- | --- |
| `后来` | `  后来  ` | 是 | 只差首尾/连续空格。 |
| `Later` | `later` | 是 | identity 会 lowercase。 |
| `后来` | `后来 KTV` | 否 | canonical query 保留 KTV；只有 provider query 会去掉。 |
| `周杰伦` + song | `周杰伦` + artist | 否 | searchType 不同。 |
| `后来` KTV | `后来` 原唱 | 否 | vocal intent 不同。 |
| 相同请求、算法版本改变 | 旧请求 | 否 | 版本必须隔离旧候选集合。 |

当前不会读取“差不多”的 query、其他三个 option family、normalized index、拼音近似、语义匹配或全局候选目录。

### 4.3 算法版本的真实作用

算法版本只进入 family hash，不自动迁移数据：

- KV 会生成一个新 key，旧 key 留到 TTL 自然过期。
- D1 查询会读到相同 canonical query/options 的 row，但 `family_hash` 不同就忽略。
- 新 cold search 成功持久化时，由于 D1 unique key 不含算法版本，新结果会覆盖该 query/options 的旧 row。
- 如果没有额度或 live search 失败，旧 D1 row 会继续存在，但不会被新版读取。

只改 ranking 而不 bump 版本时，旧候选会用新分数重排；只改 provider query、准入规则或候选来源而不 bump 版本时，只要旧候选重排后仍有至少一条，系统就不会 cold refill。这是修改算法时最需要警惕的缓存行为。

## 5. Cold search 的 YouTube 查询

### 5.1 当前真正会执行的第一条 query

| 模式 | `includeOriginalVocal` | 第一条 provider query |
| --- | --- | --- |
| 歌名 | false | `<providerQuery> ktv`，有 artist 时为 `<artist> <providerQuery> ktv` |
| 歌名 | true | `<providerQuery> lyrics`，有 artist 时为 `<artist> <providerQuery> lyrics` |
| 歌手 | false | `<providerQuery> ktv` |
| 歌手 | true | `<providerQuery> lyrics` |

`searchFamily.ts` 仍会生成 karaoke、伴奏、卡拉OK、pinyin、instrumental、lyric video、歌词、MV、official audio、radio 等完整 alias 列表，也会生成一个用 `|` 连接的 broad query。

但是 production 的 `YOUTUBE_SEARCH_MAX_CALLS_PER_FILL=1`，所以当前只会执行第一条 focused query。后续 aliases、`nextPageToken` 翻页和第二 source query 只有调用方显式把 `maxSearchCalls` 提高时才可能运行；它们现在属于保留在 helper 内的停用能力，不是 production 行为。

### 5.2 `search.list` 参数

当前固定参数：

```txt
part=snippet
type=video
maxResults=50
videoEmbeddable=true
videoCategoryId=10
safeSearch=moderate
regionCode=CA
relevanceLanguage=zh-Hans
```

YouTube 返回顺序只是候选发现顺序，最终用户顺序由本地硬过滤与 scoring 决定。

### 5.3 `videos.list` 详情补全

每批最多 50 个 video ids，读取：

- `contentDetails.duration`
- `snippet.categoryId`
- 最多 20 个 tags
- `status.embeddable`
- 标题、频道、发布时间和缩略图

先按 `videoId` 去重。详情明确缺失、无法解析 duration 或 `embeddable=false` 的候选不会进入 verified candidates。

## 6. 候选准入：硬过滤优先于分数

结果进入 UI 的逻辑不是“分数高就一定进”。顺序是：

1. YouTube 详情资格。
2. 查询相关性硬门槛。
3. KTV/原唱意图硬门槛。
4. 对通过者按 score 排序。

### 6.1 歌曲资格

正常 verified path 必须同时满足：

- `categoryId === "10"`。
- duration 是有限数字且 `> 0`。
- duration 严格 `< 420` 秒；`6:59` 可通过，`7:00` 被拒绝。
- `videos.list` 没有明确给出 `embeddable=false`。另外 `search.list` 已请求 `videoEmbeddable=true`。

KV/D1 写入和读取都会再次执行 category/duration 过滤。因此缺 metadata 的历史 row 不会继续作为 exact hit。

### 6.2 歌名模式的查询相关性

歌名模式只允许标题命中。以下属于 title match：

- 规范化标题与 query 完全相同。
- 标题以 query 开头。
- 标题包含完整 query。
- 多词 query 的每个长度大于 1 的 token 都在标题中。

仅 channel 或 tags 命中虽然会产生诊断分数，但会被最终硬门槛拒绝。标题比较会移除括号、分隔符以及 official/MV/HD/KTV/karaoke/version/instrumental/pinyin/lyrics/cover/live/audio、伴奏、字幕、高清、完整版等常见修饰词后再比较。

### 6.3 歌手模式的查询相关性

歌手模式允许以下 metadata 命中并累加：

- title 包含歌手：`+42`。
- channel 包含歌手：`+32`。
- tags 包含歌手：`+16`。
- 多词歌手名的 tokens 全部出现在 title + channel：`+18`。

以上都没有命中时标记 `metadata does not match artist query` 并硬拒绝。这就是搜索 `单依纯` 时黄小琥等完全无关歌手不应进入结果的直接规则。

### 6.4 KTV/非原唱意图硬门槛

标题或 tags 至少包含一个以下 marker：

- `KTV`、`卡拉OK`、`karaoke`
- `伴奏`、`instrumental`
- `字幕`、`pinyin`

同时只要标题或 tags 包含 `原唱` 或英文 `original` / `original vocal`，就硬拒绝。`official` 和 `MV` 在 KTV 模式只是减分，不是硬拒绝；如果同一标题还有 KTV marker，仍可能保留。

### 6.5 原唱意图硬门槛

歌曲模式要求标题显式包含至少一个：

- `lyric video`、`lyrics`、`lyric`、`歌词`
- `original`、`原唱`
- `MV`、`official`、`audio`、`radio`

歌手模式更宽：明确匹配歌手 metadata 后，即使标题没有上述 original marker，普通歌曲也可进入；但标题或 tags 出现 KTV、卡拉OK、karaoke、伴奏、instrumental、字幕、pinyin 或 `cover` 时硬拒绝。

## 7. Scoring 与最终排序

硬门槛通过后才比较总分。相同分数保持 YouTube 候选的原发现顺序。

### 7.1 歌名相关性分

| 信号 | 分数 |
| --- | ---: |
| 标题精确等于 query | +60 |
| 标题以 query 开头 | +48 |
| 标题包含 query | +40 |
| 多 token 全部命中标题 | +24 |
| 上述 title match 同时带 live/cover/reaction/tutorial/shorts | 改为 +10 |

### 7.2 KTV 意图分

| 信号 | 分数 |
| --- | ---: |
| KTV / 卡拉OK | +30 |
| karaoke | +24 |
| 伴奏 | +20 |
| instrumental | +16 |
| 字幕 | +8 |
| pinyin | +3 |
| original / 原唱 | -42 / -48 |
| MV / official | -28 / -24 |

### 7.3 原唱意图分

| 信号 | 分数 |
| --- | ---: |
| 原唱 / original | +38 / +34 |
| MV / official | +24 / +20 |
| lyric video / lyrics / lyric / 歌词 | +18 / +14 / +12 / +14 |
| audio / radio | +16 / +12 |
| 伴奏 / instrumental | -30 / -28 |
| karaoke / 卡拉OK | -14 / -14 |

### 7.4 通用负分

`live`、`现场`、reaction、cover、remix、tutorial/教学、shorts 会得到 `-5` 到 `-8`。这些通常只是降序，不是硬拒绝；唯一明确的 cover 硬拒绝发生在“歌手 + 原唱”模式。

当前 `scoring.ts` 中 `现场` 和 `教学` 各存在一组 Unicode/直接文字重复项，因此可能各被扣分两次。这是已知实现债务，不应在解释结果时误认为有两个不同规则。

## 8. 缓存不是一层：五种状态必须分开

| 层 | 用途 | 是否参与非空 exact search | 生命周期 |
| --- | --- | --- | --- |
| D1 `search_repository_entries` | 持久 exact response source | 是，优先级最高 | 无 TTL；管理员删除/清理或新版成功覆盖 |
| KV `yt-search:v4:*` | exact family 加速与 D1 fallback | 是 | 默认 365 天 |
| KV recommendations | 空查询默认推荐 | 否，不补非空 query | 写入时刷新 TTL |
| D1 `search_video_catalog` | 已验证候选统计 | 否 | 无自动 TTL |
| Mobile localStorage | 单个 room 的 UI 恢复 | 否，不作为服务端候选来源 | 24 小时 |

把这五层统称为“缓存”会导致错误判断。尤其是 recommendation pool 和 video catalog 都不会给一个新的非空 query 补结果。

### 8.1 Exact read 顺序

1. 生成唯一 family。
2. 并行读取 D1 row 和 KV family key。
3. 两边都有时使用 D1；只有 D1 miss/失败时才使用 KV。
4. 对存储结果重新执行 Music/时长过滤、当前查询相关性和当前 intent hard gate，并重新打分排序。
5. 重排后至少一条存在就立即返回；不会因为只有 1、8 或 12 条而 cold refill。
6. 重排后为 0 才把该存储命中视为无效并进入 cold search。

因此 exact cache 保证“同一个候选池可复用”，不保证永远返回存入时完全相同的 score/reasons，也不保证数量达到 50。

### 8.2 D1 repository

D1 unique identity 是：

```txt
canonical query + normalized artist + searchType + includeOriginalVocal
```

Row 另存 `family_hash`。读取先按 query + artist 最多取 4 行，再严格校验当前 hash、模式、原唱开关和 original query。D1 命中会增加 `access_count` 并更新 `last_accessed_at`，但不会自动刷新候选内容，也没有 TTL。

### 8.3 KV exact family

Key：

```txt
yt-search:v4:<familyHash>:CA:zh-Hans
```

Entry 保存 query family、aliases、hash、created/expiry、source queries、最多 50 条 results、provider call stats、payload bytes、pruned count、hit count 和 last access。

写入前先过滤未验证歌曲并截断到 50 条；JSON 超过 524,288 bytes 时从结果尾部逐条裁剪。KV touch 增加 hit count 和 last access，但保持原 expiration，不延长 family TTL。

代码仍保留 `yt-search-index:v2:*` key builder，但在线搜索不读、不写这个 index；它目前只在管理员删除 repository row 时作为旧 key 清理目标。

### 8.4 写入与空结果

正常 cold response 的完整 verified result set 会并行写 D1 和 KV；production 使用 `ctx.waitUntil`，公开 API 不等待持久化完成。

- 非空 verified results：写 D1、KV、recommendations。
- 完全零结果：不写 exact cache，即没有 negative caching。
- details timeout/429 后基于 search snippet 返回的未验证 partial results：可临时显示，但 D1/KV 再过滤时会丢弃，因此不会持久化。
- 重复 cold miss 当前没有 request coalescing；并发相同 exact miss 可能分别预留额度和请求 YouTube。

### 8.5 Recommendations

Key：

```txt
yt-search-recommendations:v2:CA:zh-Hans
```

更新顺序：本次结果前 8 条 → 现有 recommendation pool → 本次其余结果；按 video id 去重并截断到 200。真实点歌会把该 video 以高分 `recently queued` 信号推到最前。

如果 recommendation key 不存在或数量不足，系统列出一批 KV family entries，按：

```txt
lastAccessedAt/createdAt + min(hitCount, 100) × 6 小时
```

排序 family，再按每个 family 的第 1 名、第 2 名……轮转合并。

重要现状：常规 exact 查询通常由 D1 命中。D1 命中只 touch D1，不会自动 touch KV 或重新提升 recommendation pool；“每次 cache hit 都重提推荐头部”并不是当前通用事实。

### 8.6 被动 video catalog

只有通过 details 验证的 Music、`0 < duration < 420` candidates 会按 video id 写入 `search_video_catalog`，记录首次/最近 query、出现次数和 metadata。它用于 Admin 统计，不被在线搜索读取。旧 FTS5 跨查询索引已由 migration 0006 删除。

## 9. Quota、时间与限流

### 9.1 Search quota ledger

- App guardrail：Pacific quota day 每日 100 次 `search.list`。
- D1 `youtube_quota_daily` 是首选 ledger；D1 失败时 KV `yt-search-quota:v1:<date>` fallback。
- 每个 `search.list` 发出前先原子预留 1 次。即使随后返回 429/503 或网络失败，这次可能已被 YouTube 计费，因此 ledger 不回滚。
- 没有可用的 D1/KV ledger 时，系统拒绝发送无法记账的外部请求。
- `videos.list` 调用数只进入 `videosListCalls` 诊断，不进入本项目的 `search.list` daily ledger。
- App ledger 是本地估算，Google Cloud Console 仍是外部真实配额的最终权威。

### 9.2 时间预算

| 层 | 上限 | 行为 |
| --- | ---: | --- |
| Worker YouTube pipeline | 1600ms，代码硬 cap 1900ms | search/details 共用 deadline；到时 abort 当前 provider fetch |
| Browser 非空 search | 2000ms | Abort API request，UI 保留既有结果并显示停止提示 |

浏览器 abort 不保证已经在 Worker 内执行的 quota reservation 或 background persistence 被撤销，因此不能把客户端 timeout 理解为“没有消耗额度”。

### 9.3 Rate limit

默认同一个 `roomId + client IP` 每个固定 60 秒窗口最多 20 次非空请求。检查发生在 exact cache、cache-only 和 URL routing 之前，因此以下都会计入 rate limit：

- D1/KV cache hit。
- cache-only smoke。
- YouTube URL 和被拦截 URL。
- cold search。

超限返回 HTTP 200 的 partial response：`throttled=true`、零结果、零 provider calls。该 response 当前设置 `cached=true`，这里只表示“没有外部请求”，不能把它解释为真实 exact cache hit。超限请求当前不写 search event。

## 10. 超时、429、空结果时 Mobile 怎么处理

| 服务端/客户端结果 | 有旧卡片 | 没有旧卡片 |
| --- | --- | --- |
| 正常非空 response | 用新结果整体替换，选择第一项，关闭旧 preview | 显示新结果 |
| 普通零结果 | 清空旧结果，显示“没有找到合适的视频” | 显示空状态 |
| Worker `timedOut=true` 且零结果 | 保留旧卡片并提示 | 显示 timeout 空状态 |
| `providerRateLimited=true` 且零结果 | 保留旧卡片并提示 | 显示限流空状态 |
| `throttled=true` 且零结果 | 保留旧卡片并提示 | 显示节流空状态 |
| `quota.exhausted=true` 且零结果 | 保留旧卡片和恢复倒计时 | 持续显示“今日搜索额度已用完” |
| 浏览器 2000ms abort / HTTP error | 原 `searchResponse` 不变，显示错误 panel | 显示错误 panel |

搜索 pending 时旧卡片仍可见并可用；结果标题显示“正在搜索”。按搜索按钮本身发生在结果 grid 外，会依照现有 click-outside 规则停止 active preview。较旧 requestId 的迟到成功响应会被忽略。

Mobile 每个 room 在 localStorage 保存 query、模式、原唱开关、完整 response、已展开数量、选中项、active preview 和 scroll，TTL 24 小时。输入/筛选的草稿变化会被保存，但不会自动重新搜索。

## 11. API response 怎么诊断

关键字段：

| 字段 | 解释 |
| --- | --- |
| `cached` | 一般表示本地结果，但 recommendations 和 throttle 也会为 true；诊断时必须结合其他字段。 |
| `cacheMeta.responseSource` | `repository`、`external` 或 `mock`。KV hit 当前也会合并成 `repository` 语义。 |
| `sourceQueryCount` | 本次真实执行的 `search.list` 数；当前 production cold search 应为 1，其余通常为 0。 |
| `videosListCalls` | 本次详情批次调用数。 |
| `sourceQueries` | 实际使用的 provider query；cache hit 可能携带历史值，不能据此判断本次发了请求。 |
| `candidateResultCount` | 正常 live path 中通过详情资格的 candidates 数。 |
| `filteredResultCount` | 相关性/intent 后的结果数；timeout partial 时可能包含未验证 snippets。 |
| `externalCallAvoided` | true 表示没有走普通外部 search；URL path 即使调用 videos.list 也仍为 true。 |
| `timedOut` / `providerRateLimited` / `throttled` | 可恢复 partial 状态。 |
| `quota` | 本地 ledger 的 before/after、exhausted 和 Pacific reset。 |
| `cacheOnly` | 隐藏诊断模式确认。 |
| `servedFromExpandedCache` | 旧的多-family merge 字段；当前只读一个 exact family，正常情况下没有实际 expanded 语义。 |
| `catalogResultCount` | 当前在线搜索不读 catalog，因此应为 0。 |

`cacheOnly=true` 只保证零 YouTube 调用和不写 human search event/quota ledger，不保证完全无存储写入：D1 hit 会更新 access count；仅 KV 命中时可能 touch KV 并回填 D1。它仍经过 rate limit。

## 12. 四个标准样例

### 12.1 `后来` + 歌名 + 非原唱

- Provider query：`后来 ktv`。
- 标题必须命中“后来”。
- title/tags 必须有 KTV/karaoke/伴奏等 marker。
- 明确原唱/original 被拒绝。
- `黄小琥 没那么简单 KTV` 因歌名不匹配被拒绝。

### 12.2 `后来` + 歌名 + 原唱

- Provider query：`后来 lyrics`。
- 标题必须命中“后来”。
- 标题必须显式有 lyrics/歌词/original/原唱/MV/official/audio/radio。
- 纯 KTV 伴奏被拒绝。

### 12.3 `单依纯` + 歌手 + 非原唱

- Provider query：`单依纯 ktv`。
- title/channel/tags 至少一处必须匹配单依纯。
- 还必须有 KTV/伴奏 marker。
- metadata 完全无单依纯的黄小琥结果被拒绝。

### 12.4 `林俊杰` + 歌手 + 原唱

- Provider query：`林俊杰 lyrics`。
- 本人 lyrics/official audio 优先。
- 明确匹配林俊杰的普通歌曲也可进入。
- KTV、伴奏和 cover 被拒绝。

这些是 `worker/searchQualityContract.test.ts` 的零网络 golden contracts。它们验证规则方向，不代表真实 YouTube 每次一定返回相同数量或完整歌单。

## 13. 当前已知问题与维护风险

以下是本次代码核实确认的事实，后续 investigate 应优先从这里开始：

1. **算法版本名称已经落后。** 当前 identity 仍为 `quality-fill-50-v1`，但 production 已从最多 12 次补满改为最多 1 次调用。版本值如果没有随着候选语义变化而更新，旧 D1/KV 候选仍可能继续命中。
2. **Exact D1 无 TTL。** 只要当前重排还能留下至少一条，即使结果很少、过时或缺少后来新增的优质候选，也不会自动 live refill。
3. **Production aliases 实际没有 fallback。** 代码生成很多 alias，但 one-call guard 使第一条以外全部不执行。修改后续 alias 不会改变 production 结果。
4. **Helper 仍支持多调用。** `youtubeSearch.ts` 和两项历史测试仍能在显式 `maxSearchCalls=12` 时翻页/换 query；配置 guard 是阻止它进入 production 的主要保护。
5. **零结果没有 negative cache。** 同一个冷门/无效 query 每次都可能重新消耗一次额度。
6. **并发 miss 没有合并。** 同一 family 同时到达的 cold requests 可能重复消耗额度。
7. **D1 identity 不含 region/language。** KV key 含 `CA/zh-Hans`，D1 unique key 不含；以后改变地区/语言必须 bump algorithm version 或迁移 schema。
8. **Recommendation 与 exact cache 是两套行为。** 常见 D1 hit 不会重新提升推荐；推荐顺序不能用来推断 exact query 排序。
9. **Timeout partial 的统计含义不完全一致。** Details timeout 时 UI 可收到未验证 snippets，`filteredResultCount` 可能非零，但 `candidateResultCount=0`，这些结果也不会缓存。
10. **Score 与 hard gate 耦合。** 歌名模式用 `reasons` 文本判断是否 title match；channel/tag 分数和 `>900s` penalty 在正常 verified path 基本不会决定最终准入，修改文字 reason 也可能意外改变过滤。
11. **重复负分。** `现场` 和 `教学` 当前各有重复 signal，可能被扣两次。
12. **真实结果仍受 YouTube 变化影响。** Offline golden tests 固定算法规则，但不能覆盖 provider 排序、区域结果、删除视频、metadata 变化或 key 级实际 quota。

这些条目是“当前风险”，不是已经授权修改的需求。具体优化前应先在下一节写出期望。

## 14. 搜索算法变更协议

### 14.1 下一版变更提案

在动代码前复制并填写：

```md
### 变更名称

- 当前问题：用真实 query/options/前几条结果描述。
- 期望行为：明确哪些结果必须进、必须出、排序怎样。
- 不改变：列出不能回归的模式。
- Query 变化：第一条 provider query 是否变化。
- Hard gate 变化：歌曲/歌手、KTV/原唱准入是否变化。
- Score 变化：具体 signal 和分值。
- Cache 影响：旧候选能否安全重排，是否必须 bump algorithm version。
- 配额影响：最坏 search.list/videos.list 次数与时间。
- Golden fixtures：至少一个正例、一个反例、一个相邻模式回归。
- 真实验收：最多 2–3 个 cold families；列出 query/options 和 quota 前后值。
```

提案没有实现前必须标记 `[待实现]`，不能直接改写“当前行为”让文档假装代码已经改变。

### 14.2 什么时候必须 bump version

| 改动 | `SEARCH_ALGORITHM_VERSION` | KV cache version | Recommendations version |
| --- | --- | --- | --- |
| Provider 第一 query、aliases、region/language | 必须 | 通常不必 | 视结果语义 |
| Hard filter、intent gate、title/artist match | 必须 | 只有 entry schema 不兼容才改 | 视旧推荐是否安全 |
| Score/排序改变 | 建议必须；除非明确只想重排旧候选 | 不必 | 旧推荐排序不安全时改 |
| Family identity 字段改变 | 必须 | 可能必须 | 通常不必 |
| KV entry schema/兼容校验改变 | 视候选语义 | 必须 | 不一定 |
| 推荐合并/提升规则改变 | 不一定 | 不一定 | 必须 |
| 纯 UI copy/loading、两秒错误展示 | 不必 | 不必 | 不必 |
| Quota/rate limit/time budget | 候选语义变化时必须 | 不必 | 不必 |

Version bump 后必须新增测试证明旧 D1 `family_hash` 不会命中，并说明旧 KV 如何自然过期或清理。

### 14.3 每次修改必须完成

1. 更新本文件的提案、当前契约和已知风险。
2. 更新 `worker/searchQualityContract.test.ts` 的 golden cases；不能仅放宽断言。
3. 更新相关 focused tests：family、scoring、provider、service/cache、experience。
4. 运行 `npm run verify:search`；它会禁止未 stub 的网络，并核对本文件机器契约与代码/config。
5. 运行 full tests、typecheck、production build 和 `git diff --check`。
6. 先使用 `cacheOnly=true` 做零额度 production smoke。
7. 只有用户明确安排时才运行 2–3 次真实 cold search；记录 quota before/after、source query、调用数、时间、前排结果和 repeat exact hit。
8. 结果通过后在 `PROGRESS.md` 记录发布历史；不要把历史 pass 复制回本文件冒充当前规则。

### 14.4 完成标准

搜索改动只有同时满足以下条件才算完成：

- 四种模式的正负例都明确。
- Exact cache identity 和迁移策略明确。
- Cold call 最坏次数与两秒体验明确。
- Offline tests 证明零真实额度。
- 真实测试没有超过预先批准的额度。
- `SEARCH.md`、代码、测试和 production config 一致。

## 15. 代码地图

| 文件 | 职责 |
| --- | --- |
| `worker/router.ts` | Request validation、rate limit、search event、quota broadcast、HTTP errors |
| `worker/searchQuery.ts` | 普通文字、YouTube 单视频 URL、blocked URL 分类 |
| `src/lib/queryNormalize.ts` | canonical query 基础规范化 |
| `worker/searchFamily.ts` | algorithm version、family hash、provider aliases/source queries |
| `worker/youtubeSearch.ts` | search.list、videos.list、deadline、candidate detail pipeline |
| `worker/songFilter.ts` | Music category 和严格 `< 420s` 资格 |
| `worker/scoring.ts` | 查询相关性、intent hard gates、score 和稳定排序 |
| `worker/searchService.ts` | D1/KV read order、live fallback、persistence、recommendations、quota orchestration |
| `worker/searchRepository.ts` | D1 exact repository、search events、Admin deletion/cleanup |
| `worker/kvCache.ts` | KV exact family、payload pruning、recommendation pool |
| `worker/videoCatalog.ts` | 被动 verified candidate 统计，不参与在线搜索 |
| `worker/youtubeQuota.ts` | Pacific daily ledger、D1 reservation、KV fallback |
| `src/lib/apiClient.ts` | 浏览器 2000ms abort |
| `src/lib/searchExperience.ts` | partial response 的结果保留与提示 |
| `src/routes/MobilePage.tsx` | 搜索草稿、提交、卡片、分页、preview、24h state |
| `worker/searchQualityContract.test.ts` | 四模式 golden contract |
| `scripts/verify-search.mjs` | 零网络发布门禁和配置/文档一致性 |
