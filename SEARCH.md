# K歌助手搜索与缓存规范

最后核实：2026-10-27（四项修复已发布，生产缓存验证通过，用户实际使用验收待进行）
代码基线：本轮 `9b42ac3`；上一发布 `eae1d9d` / 发布记录 `a6651fb`，成熟回退版本 `aa65a60`；回退记录见 `docs/SEARCH_BASELINE_2026-10-27.md`
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
  "searchAlgorithmVersion": "rank-preserve-50-v2",
  "searchResultPolicyVersion": "music-evidence-v2",
  "searchCacheVersion": "v4",
  "recommendationsVersion": "v8",
  "regionCode": "CA",
  "relevanceLanguage": "zh-Hans",
  "searchPageSize": 50,
  "maxCachedResults": 50,
  "maxRecommendations": 200,
  "maxPromotedRecommendationsPerSearch": 20,
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

1. Mobile 只有在用户按搜索或键盘 Search/Enter 时才提交；切换歌名/歌手/URL、原唱开关或修改文字本身不会搜索。
2. Main Worker 先对非空请求执行同 room + IP 的一分钟 rate limit。
3. 服务端用完整规范化文字、可选 artist、歌名/歌手模式、KTV/原唱意图和算法版本生成唯一 family hash。
4. D1 repository 与 KV family cache 并行读取，但 D1 命中优先；只读取当前 exact family，不跨文字、不跨模式、不跨原唱开关。
5. Exact hit 先保留完整结构可用候选并按当前 scoring 排序，再应用展示 policy；不请求 YouTube，即使筛后 0 条也不视为 cache miss。
6. Exact miss 才进入 quota 检查。当前 production 最多预留并执行一次 `search.list`。
7. 这一次查询固定取最多 50 个 YouTube video candidates；`videoEmbeddable=true` 在 provider 层排除不可播放结果，再用最多一次 `videos.list` 尝试补充 duration、category、tags 和 embeddable 状态。
8. 原始候选只剔除缺少可用 video id、缺少可显示标题、重复 id 或详情明确 `embeddable=false` 的记录；先保存完整候选，再按第 6 节过滤公开展示。
9. 所有结构可用候选按 song/artist 与 KTV/原唱信号评分并稳定排序；低相关或错误意图结果留在后排，不被质量逻辑删除。
10. 完整原始排序池写入 D1 exact repository 和 KV exact family；recommendations 先判断明确音乐/查询关联资格，再从合格项取最多 20 条，不补弱结果。
11. Worker 的外部预算为 1600ms；浏览器在 2000ms 主动 abort。`videos.list` 缺失、失败或超时时使用已有 snippet，不延长等待。

最重要的结论：**原始候选完整保留、公开搜索保守过滤、首页严格准入。** `maxResults=50` 是 provider 上限，不是保证展示数量。provider 返回 50 条结构可用候选时缓存仍保留 50 条，公开结果可能较少；不翻页补满，不因展示不足或为 0 而重搜。

## 3. 搜索入口与四种请求类型

### 3.1 空查询：推荐

`query.trim()` 为空时，router 直接读取 recommendation pool：

- 不经过非空搜索 rate limit。
- 不读取 D1 exact repository。
- 不调用 YouTube，也不占 `search.list` ledger。
- API 最多返回 200 条；Mobile 先显示 10 条，再每次增加 10 条。
- Mobile 搜索成功后失效并刷新推荐数据；搜索框为空时按搜索，会切回推荐并主动重新读取，重置为先显示 10 条。刷新时保留已有推荐；空查询仍为零 YouTube 调用。

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

### 3.3 YouTube 单视频 URL：正式点歌入口

服务端在普通 family 逻辑之前识别 `youtube.com/watch`、`youtu.be`、`shorts`、`live`、`embed` 和 `/v/` 的 11 位 video id：

- 跳过 search family、ranking、普通文字结构准入、D1/KV exact cache、搜索事件和 `search.list` ledger。
- 有 API key 时调用一次 `videos.list` 读取标题、缩略图等 metadata；明确不存在或 `embeddable=false` 时返回空。
- metadata 请求临时失败时，仍返回基于 video id 和 YouTube 缩略图的兜底卡片。
- 该路径没有 Worker 1600ms deadline 包装，但 Mobile 的整个请求仍受浏览器 2000ms abort 约束。
- `cacheOnly=true` 时不调用 `videos.list`，并返回空结果。

Mobile 下拉框提供 `URL` 选项；该模式输入提示为 `YouTube视频链接`、隐藏原唱开关，并在提交前用与服务端相同的分类器校验。无效链接、普通文字、频道和纯播放列表会提示且不发送搜索请求。URL 模式随 24 小时 UI 状态恢复。歌名/歌手模式仍兼容已有 URL 输入。此路径不属于普通文字搜索算法，不消耗 `search.list` 次数，额度耗尽仍可点歌；`videos.list` metadata 调用并非零 YouTube API 用量。

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
rank-preserve-50-v2 | canonicalQuery | normalizedArtist | searchType | original-or-karaoke
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

2026-10-27 起区分 raw candidate algorithm 与 response policy：本轮不改变 provider/原始准入/排序，保留 `rank-preserve-50-v2` family，避免失效旧候选；当前 `searchResultPolicyVersion=music-evidence-v2` 只标识公开返回视图。recommendations 单独为 `v8`。以下 family 升级规则仍适用于原始候选语义变化。

算法版本只进入 family hash，不自动迁移数据：

本轮准入语义从 `quality-fill-50-v1` 升为 `rank-preserve-50-v2`；两个版本的相同 query/options 必须得到不同 hash。

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
safeSearch=moderate
regionCode=CA
relevanceLanguage=zh-Hans
```

普通文字搜索不发送 `videoCategoryId`，也不发送 `videoDuration`：非 Music category 与任何长度的视频都可以进入候选。YouTube 返回顺序是候选发现顺序；最终用户顺序由本地 scoring 决定，相同分数保持 provider 顺序。

### 5.3 `videos.list` 详情补全

每批最多 50 个 video ids，读取：

- `contentDetails.duration`
- `snippet.categoryId`
- 最多 20 个 tags
- `status.embeddable`
- 标题、频道、发布时间和缩略图

`videos.list` 是可选 enrichment，不是普通质量准入条件：

- 详情成功时合并可用字段，供卡片、诊断、catalog 和排序使用。
- 某个 id 被 details response 遗漏、duration 无法解析、category/tags 缺失时，保留 `search.list` snippet candidate。
- 整批 details 超时、429 或其他失败时，保留已经取得的 snippet candidates，不延长现有 deadline。
- 只有详情明确 `embeddable=false` 时才剔除该 candidate。

## 6. 原始候选与公开展示分开

原始候选继续采用最小结构准入，完整池先持久化。公开返回在 service 最终 limit 之前应用独立 policy，既有 scoring 不变。

当前唯一硬剔除条件：

1. 缺少非空 video id，或 id 含 YouTube id 不允许的字符。
2. 缺少非空、可显示的 title。
3. 与当前 candidate pool 中已有 video id 重复。
4. `videos.list` 明确返回 `embeddable=false`。

以下都不是原始缓存候选的剔除条件：

- `categoryId` 不是 `10` 或完全缺失。
- duration 缺失、无法解析、7 分钟、10 分钟、15 分钟或更长。
- tags 缺失。
- title 没有命中 song query。
- title/channel/tags 没有命中 artist query。
- 没有 KTV/karaoke/伴奏/instrumental/字幕/pinyin marker。
- 没有 lyrics/original/MV/official/audio/radio marker。
- KTV 模式出现 original/official/MV，或原唱模式出现 KTV/伴奏/cover。

### 6.0 公开展示 policy `music-evidence-v2`

- 仅当 category 明确为非 Music、正文还有新闻/采访/剧情/日常事件等明确非音乐内容线索、且没有歌曲身份、录音格式或音乐/演出线索时隐藏。缺少肯定的非音乐内容线索时保留，不把“未识别到音乐”当作非音乐证据。首唱、新歌、主题曲、插曲等也支持音乐识别；hashtag、频道或 tags 中的音乐/演出提示只作为不确定保护，不足以自动推荐。
- 非 Music 分类不会单独导致排除；不要求原歌手名字，不以时长、原唱开关、cover/live、详情失败或排序分数决定排除。
- Music category、正文录音格式支持音乐证据；KTV/live 单词可能是场所/事件，仅在歌曲身份或录音标题结构中作为明确版本。仅 KTV 或表演 hashtag 的片段保守保留在搜索中，但不自动推荐。
- 筛选为纯函数，输出保留候选的原顺序；不改变任何 score/reasons。raw D1/KV 全量池不删除、无需 migration，回退旧代码仍能读到所有候选。
- response `cacheMeta.resultPolicyVersion` 标识视图；`candidateResultCount` 是本次 raw 池大小，`filteredResultCount` 为展示筛选后、limit 前大小；`hiddenNonMusicResultCount` 为隐藏数；`cachedResultCount` 仍表示已保存的原始池大小。
- cacheOnly 与普通缓存命中都先根据 raw 池判断命中，筛后 0 条仍返回成功空视图、0 次外部调用；冷搜索先保存完整池再过滤返回，不增加补搜。

### 6.1 歌名模式

title exact/prefix/full-query/token match 会得到显著加分；只有 channel/tags 命中得到较小加分；完全不命中得到显著负分。它们只改变顺序，不改变 inclusion。

### 6.2 歌手模式

artist 在 title/channel/tags 或多 token metadata 中命中会累加显著加分；完全不匹配得到负分并排到强匹配之后，不再导致 `林俊杰` 的 50 个 provider candidates 只剩约 16 个。

### 6.3 KTV 与原唱意图

KTV 模式奖励 KTV/卡拉OK/karaoke/伴奏/instrumental/字幕/pinyin，并对 original/原唱/MV/official 降分；原唱模式奖励 original/原唱/MV/official/lyrics/歌词/audio/radio，并对 KTV/karaoke/伴奏/instrumental/cover 降分。这些偏好受有界总分约束，仅影响同一相关性层内的顺序，不把匹配歌曲排到无关视频之后。

## 7. Scoring 与最终排序

结构可用 candidates 全部计算总分。相同分数保持 YouTube 候选的原发现顺序；`reasons` 只用于诊断，不参与 inclusion 判断。

### 7.0 比较规范化与相关性优先

- 仅排序比较使用 Unicode NFKC 与 `opencc-js/t2cn` 简繁等价转换；标题展示、provider query、canonical query 和 family hash 均不变。不做拼音/语义扩展，不特判歌手或歌名。英文匹配保留词边界，例如 `One` 不命中 `Someone`，`live` 不命中 `lives`。
- 总分 = `相关性层 × 1000 + query 匹配分 + clamp(意图分 + 通用负分, -40, 60) + 时长分`。各层之间不会被 metadata 标记叠加逆转。
- 歌名模式第 4 层：移除标题 hashtag 后，去版本标记只剩歌名、分隔/书名号中有独立歌名，或歌名开头且有标题音乐证据。第 3 层：仅标题包含 query，且有 Music category 或标题伴奏/歌词/翻唱/现场/MV 等音乐证据。另一首歌的歌词含 query 不因此获得第 4 层。KTV/卡拉OK 单独出现在叙事中不是证据；位于非 hashtag 标题末尾或有独立歌名/其他音乐证据时才支持优先。没有 category/duration/tags 的歌曲仍可凭标题进入高层。
- 第 2 层：仅有标题文字命中，或标题带 reaction/tutorial/shorts；第 1 层：只在 channel/tags 命中；第 0 层：不匹配。
- 歌手模式：title/channel/tags 或完整 token 命中为第 3 层，不匹配为第 0 层；同层沿用原有 metadata 权重。
- live/cover 保留正常歌名匹配分，不再把匹配分一律降至 +10；仍有小幅版本偏好扣分。低相关结果全部留在后排。

### 7.1 歌名相关性分

| 信号 | 分数 |
| --- | ---: |
| 标题精确等于 query | +60 |
| 标题以 query 开头 | +48 |
| 标题包含 query | +40 |
| 多 token 全部命中标题 | +24 |
| 上述 title match 同时带 reaction/tutorial/shorts | 改为 +10 |

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
| KTV | -18 |
| 伴奏 / instrumental | -30 / -28 |
| karaoke / 卡拉OK | -14 / -14 |

### 7.4 通用负分

`live`、`现场`、reaction、cover、remix、tutorial/教学、shorts 会得到 `-5` 到 `-8`。它们只降序，不硬拒绝。`现场` 和 `教学` 各只有一条 signal，不会重复扣分。

## 8. 缓存不是一层：五种状态必须分开

| 层 | 用途 | 是否参与非空 exact search | 生命周期 |
| --- | --- | --- | --- |
| D1 `search_repository_entries` | 持久 exact response source | 是，优先级最高 | 无 TTL；管理员删除/清理或新版成功覆盖 |
| KV `yt-search:v4:*` | exact family 加速与 D1 fallback | 是 | 默认 365 天 |
| KV recommendations `v8` | 空查询的精选推荐 | 否，不补非空 query | 写入时刷新 TTL |
| D1 `search_video_catalog` | 结构可用 provider candidates 的 analytics catalog | 否 | 无自动 TTL |
| Mobile localStorage | 单个 room 的 UI 恢复 | 否，不作为服务端候选来源 | 24 小时 |

把这五层统称为“缓存”会导致错误判断。尤其是 recommendation pool 和 video catalog 都不会给一个新的非空 query 补结果。

### 8.1 Exact read 顺序

1. 生成唯一 family。
2. 并行读取 D1 row 和 KV family key。
3. 两边都有时使用 D1；只有 D1 miss/失败时才使用 KV。
4. 对存储结果执行结构准入/去重与既有排序，保留 raw 池；最后对公开视图应用 music policy。
5. raw 池至少一条即为命中；筛后 0、1、8 或 12 条都不 cold refill。
6. 只有 raw 池本身结构不可用或为 0 时，才进入原有 miss 分支；cacheOnly miss 不会请求外部。

因此 exact cache 保证“同一个原始候选池可复用”，公开视图按当前 policy 计算，不保证显示数量为 50。

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

KV schema version 保持 `v4`、raw family 保持 `rank-preserve-50-v2`；entry 仍保存完整候选。Recommendation key 为 `v8`，旧 `v7` 及更早池不读不覆盖、按旧 TTL 自然过期，供旧代码回退。新写入、D1/KV 命中和历史重建都先重排，再用当前 query/family 判定音乐资格，最后最多取 20；不清空 exact 数据、不触发 YouTube refill。

写入前只过滤结构不可用/重复结果并截断到 50 条；category、duration、tags 和完整 details 都不是 cache eligibility。JSON 超过 524,288 bytes 时从低分尾部逐条裁剪。KV touch 增加 hit count 和 last access，但保持原 expiration，不延长 family TTL。

代码仍保留 `yt-search-index:v2:*` key builder，但在线搜索不读、不写这个 index；它目前只在管理员删除 repository row 时作为旧 key 清理目标。

### 8.4 写入与空结果

正常 cold response 的完整 structural result set 会并行写 D1 和 KV；production 使用 `ctx.waitUntil`，公开 API 不等待持久化完成。

- 非空 structural results：完整排序池写 D1/KV；只有满足音乐与查询关联条件的头部进入 recommendations。
- 完全零结果：不写 exact cache，即没有 negative caching。
- details timeout、429、其他失败或遗漏 id 后的 snippet：结构可用即持久化，缺 category 的候选保守显示，exact repeat 复用原始池。
- 重复 cold miss 当前没有 request coalescing；并发相同 exact miss 可能分别预留额度和请求 YouTube。

### 8.5 Recommendations

Key：

```txt
yt-search-recommendations:v8:CA:zh-Hans
```

更新顺序：本次 raw 结果按 query/intent 重排 → 筛出明确音乐且与查询有关的项 → 取最多 20 → 与当前 v8 pool 按 video id 去重并截断到 200。不足 20 不凑数；零合格不写入任何弱项。歌名支持独立歌名及明确歌名部分的部分匹配（如三国→三国恋/三国杀、书名号内的恋三国），不搜索 `『』` / `「」` 引出的歌词摘录，不靠 hashtag 建立关联；歌手要求正文标题/频道匹配（tags 单独匹配不足）。所有推荐仍须 Music category 或明确音乐录音证据。

真实点歌只提升已经在当前合格池里的视频，或正文标题自带歌名结构与明确音乐格式的录音；未知标题、普通 URL 兜底和日常片段不会因点歌直接进入全局推荐。点歌本身、URL 解析和播放不受这道推荐门槛限制，不为推荐补查 YouTube metadata。

如果 recommendation key 不存在或数量不足，系统按 KV 游标翻页读取 family entries，每页最多 20 组、每次最多 5 页/100 组；未完成时保存 `familyRebuildCursor`，后续不足额读取继续，不被前 20 个字典序键永久截断，空页也依据 list_complete 继续。提升/点歌写入保留补建游标。先重建每个 entry 的当前 family hash 并排除旧 algorithm entries，再按：

```txt
lastAccessedAt/createdAt + min(hitCount, 100) × 6 小时
```

排序本批 family，再重排/筛选每个 family 的合格项并取最多 20 条，轮转合并。不能先截 20 再筛，否则会漏掉下方有效音乐。旧 v7 pool 本身不参与重建，raw family 内部的弱结果也不能成为补足项。池已满足请求数量时仍直接返回；最近查询通过命中提升进入池，不依赖历史扫描是否轮到它。

重建得到的合格结果或补建游标与已存状态不同时，尽力保存到 v8 pool，使旧缓存迁移后已认可的纯歌名视频仍能在点歌时提升；保存前重读最新 pool，优先保留近期提升。不变时不重复写，刷新失败仍返回已经读到的歌曲，不增加外部调用。

常规 D1 exact hit 也使用完整重排候选在现有后台任务中提升合格推荐；不改写原始 D1/KV 候选，不增加外部调用。KV hit 沿用 touch 后提升。后台写入与 KV 的最终一致性意味着推荐刷新可能短暂读到旧池，不能承诺跨设备即时可见。

### 8.6 被动 video catalog

所有结构可用、未重复的 provider candidates 都可以按 video id 写入 `search_video_catalog`；缺失的 duration/category/tags 允许为空，后续 enrichment 成功时更新可用字段。Catalog 只用于 Admin analytics，不被在线 exact search 读取，也不会成为隐藏 quality filter。旧 FTS5 跨查询索引已由 migration 0006 删除。

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

如果 `search.list` 已成功，后续 `videos.list` 超时不会丢弃 snippet candidates；response 会保留结果并设置 `timedOut=true`。Details 的非 429 HTTP/网络失败设置 `detailsEnrichmentFailed=true`，也保留 snippet candidates。系统不会为了可选 metadata 延长 deadline。

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

搜索 pending 时旧卡片仍可见并可用；固定高度的结果标题、计数和搜索按钮图标显示搜索状态，不在滚动结果区插入“最多等待 2 秒”面板，避免结果 content shift。按搜索按钮本身发生在结果 grid 外，会依照现有 click-outside 规则停止 active preview。较旧 requestId 的迟到成功响应会被忽略。

Mobile 每个 room 在 localStorage 保存 query、模式、原唱开关、完整 response、已展开数量、选中项、active preview 和 scroll，TTL 24 小时。输入/筛选的草稿变化会被保存，但不会自动重新搜索。

选中结果后的 active preview card 保持 Mobile 原有 2/3/4 列 grid 尺寸，不因播放而横跨整行；app 不在 active video 上叠加 selection badge。Preview 构造时直接使用 `autoplay=1 + mute=1 + start=30 + cc_load_policy=1`，ready 后只校准 seek/play，不再二次 `loadVideoById`。这不改变 query、ranking、cache、recommendations、quota、deadline 或 search response，属于纯 UI/player 变更，不 bump algorithm、KV 或 recommendation version。

## 11. API response 怎么诊断

关键字段：

| 字段 | 解释 |
| --- | --- |
| `cached` | 一般表示本地结果，但 recommendations 和 throttle 也会为 true；诊断时必须结合其他字段。 |
| `cacheMeta.responseSource` | `repository`、`external` 或 `mock`。KV hit 当前也会合并成 `repository` 语义。 |
| `sourceQueryCount` | 本次真实执行的 `search.list` 数；当前 production cold search 应为 1，其余通常为 0。 |
| `videosListCalls` | 本次详情批次调用数。 |
| `sourceQueries` | 实际使用的 provider query；cache hit 可能携带历史值，不能据此判断本次发了请求。 |
| `candidateResultCount` | 普通 live path 中通过最小结构准入的去重 candidates 数；通常应与 provider 可用数量接近。 |
| `filteredResultCount` | 最终已排序结果数；不再表示被 quality hard gate 筛后的数量。 |
| `externalCallAvoided` | true 表示没有走普通外部 search；URL path 即使调用 videos.list 也仍为 true。 |
| `timedOut` / `providerRateLimited` / `throttled` | 可恢复 partial 状态。 |
| `detailsEnrichmentFailed` | `videos.list` 非 timeout/429 失败；snippet candidates 已保留。 |
| `quota` | 本地 ledger 的 before/after、exhausted 和 Pacific reset。 |
| `cacheOnly` | 隐藏诊断模式确认。 |
| `resultPolicyVersion` | 公开视图的资格版本；与 raw family algorithm 分开。旧浏览器搜索快照版本不符则不恢复结果，输入/模式仍保留。 |
| `hiddenNonMusicResultCount` | 本次公开视图隐藏的明显非音乐项数量；raw D1/KV 不因此删除。 |
| `servedFromExpandedCache` | 旧的多-family merge 字段；当前只读一个 exact family，正常情况下没有实际 expanded 语义。 |
| `catalogResultCount` | 当前在线搜索不读 catalog，因此应为 0。 |

`cacheOnly=true` 只保证零 YouTube 调用和不写 human search event/quota ledger，不保证完全无存储写入：D1 hit 会更新 access count；仅 KV 命中时可能 touch KV 并回填 D1。它仍经过 rate limit。

## 12. 四个标准样例

### 12.1 `后来` + 歌名 + 非原唱

- Provider query：`后来 ktv`。
- 标题命中“后来”且有 KTV/karaoke/伴奏 marker 的结果排在前面。
- 明确原唱/original/official/MV 结果被降分，但不删除。
- `黄小琥 没那么简单 KTV` 等弱 title mismatch 通常在底部，仍保留供用户浏览。

### 12.2 `后来` + 歌名 + 原唱

- Provider query：`后来 lyrics`。
- 标题命中“后来”且有 lyrics/歌词/original/原唱/MV/official/audio/radio 的结果排在前面。
- 纯 KTV/伴奏或错歌名结果被降分，但不删除。

### 12.3 `单依纯` + 歌手 + 非原唱

- Provider query：`单依纯 ktv`。
- title/channel/tags 命中单依纯且有 KTV/伴奏 marker 的结果排在前面。
- metadata 完全不匹配单依纯的黄小琥等结果得到 artist mismatch 负分并排在后面，不再压缩 provider result count。

### 12.4 `林俊杰` + 歌手 + 原唱

- Provider query：`林俊杰 lyrics`。
- 本人 lyrics/official audio 优先。
- 明确匹配林俊杰的普通歌曲随后。
- KTV、伴奏、cover 和弱 metadata candidates 仍保留在后排；16 个强匹配 + 34 个弱匹配的结构可用 provider pool 应返回 50 条。

### 12.5 `耍赖` + 歌名 + 两种原唱开关

- 简体输入匹配繁体 `耍賴`，截图改编的 44 条日常/剧情/其他歌曲与 6 条目标歌曲全部保留。
- 6 条目标歌曲（伴奏、原唱、歌词、翻唱、现场、纯歌名）优先于干扰项；非原唱首项 KTV，原唱首项 Official MV。
- D1/KV 已有错序结果重新搜索后同样修复，0 次外部请求；推荐从旧 family 重建时先重排再取前 20。

以上 50 条完整性样例描述 provider/raw 候选契约。公开 API 再执行第 6.0 节 policy，因此显示数量可能较少。`musicEligibility.test.ts` 与 service/cache 测试另验证音乐正例保留、筛后空命中、推荐不凑数、原始池不变。这些离线契约不代表真实 YouTube 每次一定返回 50 条或完整歌单。

### 12.6 分类误伤、部分歌名与推荐更新

- artist + 两种原唱意图：周深《浮光》首唱、《达拉崩吧》、林俊杰简短歌名及歌手匹配的结构化标题不因非 Music 分类被隐藏；不确定普通上传保留搜索但不自动推荐。
- song + 两种原唱意图：三国可关联三国恋、三国杀及书名号内的部分歌名；歌词摘录、标签、无音乐证据的叙事不因此获得推荐；英文词边界保留。
- D1-only / D1+KV hit：后台提升最多 20 个合格项，原始候选/排序不改写、旧 v7 池不覆盖，0 次外部请求。
- KV 重建：25 组跨页、120 组按 100 组预算继续游标、空的未完成页、点歌不丢补建进度；已满足请求数量时不扫描。
- Mobile：搜索成功与清空返回推荐均重新读取；不需要重载页面。旧 policy v1 结果快照失效，草稿和模式保持。

## 13. 当前已知问题与维护风险

以下是本次代码核实确认的事实，后续 investigate 应优先从这里开始：

1. **不确定项仍可出现在搜索尾部。** 为保护召回率，只有非 Music 分类且存在肯定的非音乐内容线索、又无歌曲/音乐保护才隐藏；metadata 误标或含糊标题无法保证全自动零误判。首页门槛更严格，不用不确定项凑数。
2. **YouTube 可能本来就少于 50。** `maxResults=50` 不是保证；provider 结果不足、重复、空 id/title 或明确不可嵌入时，应用不会制造缺失结果。
3. **One-call 不补页。** Production aliases 实际没有 fallback；第一条 focused query 少于 50 时不会翻页或换 query，因为配额和两秒体验优先。
4. **Helper 仍支持多调用。** `youtubeSearch.ts` 的显式 `maxSearchCalls>1` 能翻页/换 query；Room/Main 的 `=1` 配置、service 默认值和 verifier 是 production 保护。
5. **Exact D1 无 TTL。** 同一算法 family 只要仍有结构可用结果，即使 provider 后来出现新视频，也不会自动 live refill。
6. **零结果没有 negative cache。** 同一个冷门/无效 query 每次都可能重新消耗一次额度。
7. **并发 miss 没有合并。** 同一 family 同时到达的 cold requests 可能重复消耗额度。
8. **D1 identity 不含 region/language。** KV key 含 `CA/zh-Hans`，D1 unique key 不含；以后改变地区/语言必须 bump algorithm version 或迁移 schema。
9. **Recommendation 与 exact cache 是两套行为。** Exact 保留最多 50；recommendations 只摄入每个 family 最多 20 条合格音乐。D1/KV hit 均后台提升，尚未查询的历史 family 使用有界游标补建；不确定的已点视频可能只在歌单中可用，不自动出现在全局推荐。
10. **Snippet fallback metadata 较少。** Details 失败时候选仍会缓存，但缺 duration/category/tags，排序只能使用 title/channel/snippet；后续 exact hit 不会主动补 enrichment。
11. **浏览器 abort 不撤销 Worker。** 2000ms 客户端停止不保证 quota reservation、provider fetch 或 background persistence 被取消。
12. **真实结果仍受 YouTube 变化影响。** Offline golden tests 固定算法规则，但不能覆盖 provider 排序、区域结果、删除视频、metadata 变化或 key 级实际 quota。

这些条目是“当前风险”，不是已经授权修改的需求。具体优化前应先在下一节写出期望。

## 14. 搜索算法变更协议

### 14.1 下一版变更提案

### 保守展示过滤与首页音乐准入 [已发布 2026-10-27]

- 输入/输出：普通搜索只排除已知非 Music 且没有歌曲身份/音乐或演出线索的候选；MV、歌词、伴奏、翻唱、现场、短片、长串烧、非 Music 分类的音乐以及 metadata 不足的结果优先保留。原唱开关只调整现有排序。
- 首页：必须有明确音乐证据和当前歌名/歌手关联，先判断资格再截取最多 20；不足不补弱结果。新写入、touch、旧 family 重建和点歌提升均应用准入，URL 点歌功能本身不变。
- 缓存：原始候选的来源/结构准入/排序不变，仍以 algorithm `rank-preserve-50-v2`、exact KV `v4` 保存最多 50 条。新增独立的 response policy `music-evidence-v1`，只在公开 response 上过滤；因此不更改 raw family identity、不冷重填、不删除候选。此项明确区别于改变原始候选准入的 hard filter。
- 推荐 key 从 `v6` 升为 `v7`，不读取旧池，从现有 exact family 重建合格项；保留旧池供原代码回退。浏览器旧 policy response 不恢复，保留输入和模式。筛后 0 条仍是 raw cache hit，禁止因此请求 YouTube。
- 预算：provider query、每次最多 1 次 search.list、1600ms/2000ms、quota/rate limit、播放/队列、双语文案和布局不变，不增加依赖或外部 metadata 请求。
- 基线：本地标签 `codex/baseline-before-music-eligibility-2026-10-27` 指向 `aa65a60`；修改前完整测试 30 files/208 tests、搜索专项 13 files/110 tests、typecheck、build 均通过。回退与测试详情另记基线文档。
- 验收：真实 50 条缓存的原始排序/分数不变，减少明显非音乐展示；所有音乐正例保留；只贡献合格推荐且不得凑满 20；旧 KV/D1 复用、筛后空结果、失败/缺 metadata、四模式、URL、点歌提升、推荐重建、UI 旧状态与零外部调用回归。

### 真实缓存验收补充：标签和歌词误命中 [已发布 2026-10-23]

- 生产 cacheOnly 样例显示：日常视频标题尾部的 `#打火机翻唱#ktv` 被当作音乐证据；另一首《唉》的歌词含“耍赖”，也能凭 Music metadata 得到歌曲高层级。
- 仅排序修正：判断歌曲证据前移除标题 hashtag，区分独立/开头歌名与仅在歌词/叙事中出现的 query。独立歌名优先于有音乐 metadata 的普通包含匹配。保持结构准入、候选、provider query、family hash 和搜索预算不变。
- 验收：使用本次读出的完整真实缓存 50 条做零网络回归；相关歌名的视频优先于 hashtag 日常视频和另一首歌的歌词，全部 50 条仍保留。重新 Room → Main 部署后以 cacheOnly 复核。
- 推荐 key 升为 `v6`，隔离首次部署 `v5` 可能产生的旧顺序；exact 数据继续复用。

### 简繁等价与歌曲相关性优先排序 [已发布 2026-10-23]

- 输入/验收：`耍赖` 应匹配 `陳楚生 - 耍賴`；目标歌曲的伴奏、原唱、翻唱、现场排在剧情/日常视频之前。保留全部结构可用候选，不强化过滤。
- 排序：仅比较时用 OpenCC 统一简繁与 Unicode 宽度；歌名/歌手相关性和标题音乐证据优先于有界的 KTV/原唱偏好，cover/live 不再降低歌名匹配等级；不靠频道/tags 堆叠把无关视频推上来。
- 缓存：本次明确只重排现有候选，保留 algorithm `rank-preserve-50-v2` 和 exact KV `v4`，不改变 family identity、provider query、准入或候选来源。D1/KV exact hit 继续重算；recommendations 首次为 `v5`，真实缓存验收补充后最终为 `v6`，从旧 exact family 用新排序重建前 20 条，旧推荐按 TTL 自然过期。
- 配额/预算：不增加外部请求，保持 1 次 cold search.list、1600ms Worker 与 2000ms 浏览器；不清理生产缓存。用户明确批准后已发布。
- 验证：简繁双向、截图标题、原唱/伴奏切换、翻唱/现场、metadata 缺失/非 Music、英文词边界、四种模式、旧 D1/KV 错序重排、旧推荐重建和 50 条完整保留，使用零网络 fixtures。

### URL 输入提示简化 [已实现 2026-10-22]

- URL placeholder 改为 `YouTube视频链接`，删除操作动词；仅文案变化，不改变输入解释、配额、缓存或版本。
- 验收：URL 模式空输入显示该精确文案；歌名/歌手名不变。


### URL 点歌正式入口 [已实现 2026-10-21]

- 输入/输出：Mobile 增加 URL 模式，有效 YouTube 单视频链接返回现有卡片；无效 id、频道、纯列表、其他站点和普通文字提交前提示且不发请求。
- UI：URL 模式提示为 `YouTube视频链接`、隐藏原唱开关，并随 24 小时状态恢复；四种文字模式不变。
- 实现：前后端共用现有分类器，沿用直接视频 API 路径。
- Query、准入、排序、缓存迁移：无变化，不 bump algorithm、KV 或 recommendations version。
- 配额：0 次 search.list，最多 1 次 videos.list，搜索额度耗尽仍可使用；既有 rate limit、浏览器 2 秒 deadline 不变。
- 验收：有效 watch/短链接/shorts、无效 URL 拦截、四种文字模式回归；模拟 quota ledger 不可用仍返回单视频。
- 生产验证：cacheOnly 零外部调用 smoke 和 URL 单视频路径，不运行 cold 文字搜索。


### 扩大高分缓存推荐 `[已实现 2026-08-24]`

- 当前问题：空查询最多可返回 200 条，但每个 exact search family 只提升前 8 条；只搜过一两个 family 时，缓存推荐会长期只有 8 或 16 首。
- 期望行为：每个 family 取排序后的前 20 条进入 recommendation pool，按 video id 去重并保持最多 200 条；真实点歌仍优先，family 重建仍按近期使用与命中次数排序后轮转合并。
- 不改变：exact search 最多保存 50 条、Mobile 每页显示 10 条、推荐总上限 200、query family、provider query、准入、排序、quota、rate limit 和时间预算都不变。
- Query 变化：无。空查询仍只读本地 KV，非空查询的第一条 provider query 不变。
- Hard gate 变化：无。仍只从 exact family 中已排序的结构可用候选取头部。
- Score 变化：无。推荐不重算或改写歌曲分数。
- Cache 影响：recommendations key 从 `v3` bump 到 `v4`，避免旧的 8 条/family 池阻止新规则重建；exact KV `v4` 和 algorithm family hash 不变，旧 recommendation key 不再读取并按原 TTL 自然过期。
- 配额影响：无。推荐读取、新池写入与现有 family 重建都是 KV 操作，`search.list` / `videos.list` 调用数仍为 0。
- Golden fixtures：50 条的单 family 只提升前 20 条；两个 family 共可提供 40 条且不包含各自第 21 条；旧 recommendation version 不命中；recently queued 仍排第一。
- 真实验收：本地零网络测试验证数量、去重和顺序；若发布，只用空查询和 `cacheOnly=true` 复核零外部调用，不执行新的 cold production search。

### Mobile pending 固定高度反馈 `[已实现 2026-08-23]`

- 当前问题：搜索开始后在滚动结果区插入大块等待状态或提示 panel，会挤动已有卡片并减少有效浏览高度。
- 期望行为：只使用既有固定高度的结果标题、计数和搜索按钮 spinner 反馈 pending；旧结果继续可用，空结果区保持稳定。
- 不改变：query family、provider query、准入、排序、cache、quota、rate limit、1600ms Worker deadline、2000ms browser abort 和 partial response 保留策略全部不变。
- Version：纯 UI loading 呈现，不 bump algorithm、KV 或 recommendation version。

### Preserve-50：完整性优先、排序控制质量 `[已实现 2026-08-23]`

- 当前问题：普通文字搜索取得最多 50 个 YouTube candidates 后，又被 Music category、`<420s`、title/artist、KTV/原唱 marker 和 details 完整性多层硬过滤；例如 `林俊杰 + artist` 可能只剩约 16 条。
- 期望行为：provider 返回的 candidate 只因缺少可用 video id、缺少可显示标题、重复 id 或明确 `embeddable=false` 才剔除；其余候选全部进入评分并稳定排序，50 个结构可用 candidates 通常返回 50 条。
- 不改变：每个 cold family 最多一次 `search.list`、`maxResults=50`、1600ms Worker/2000ms browser、rate limit、直接视频 URL、blocked URL、空查询推荐入口。
- Query 变化：四模式第一条 focused provider query 不变；普通文字 search 移除 `videoCategoryId=10`，不设置 duration filter。
- Hard gate 变化：移除 Music、时长、metadata 完整性、title/artist match、KTV/原唱/cover 准入门槛；保留结构可用性与明确不可嵌入门槛。
- Score 变化：保留现有 query 与 intent 加减分作为纯排序信号；移除 reasons 驱动准入，并清理重复 `现场`/`教学` 负分。
- Cache 影响：D1/KV read/write 改为结构准入后重排，必须 bump algorithm version 隔离旧候选；KV entry schema 不变，recommendations 改为只摄入每次 exact search 的高分头部并隔离旧池。
- 配额影响：最坏仍为 1 次 `search.list` + 1 次 `videos.list`，共用现有 deadline；details 缺失、失败或超时时使用 snippet candidates。
- Golden fixtures：四种 song/artist × KTV/original 模式均证明强意图排前、弱意图仍保留；另覆盖 50 条、16 强 + 34 弱、长视频、缺 metadata、cache round trip 和旧 hash 隔离。
- 真实验收：发布只做 `cacheOnly=true` 零额度 smoke；未经另行授权不运行 cold production search。

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

### 搜索误伤与推荐更新修复 [已发布，生产缓存验证通过 2026-10-27]

- 输入/期望：周深 artist 的《浮光》首唱、《达拉崩吧》和林俊杰的简短歌曲标题不可仅因非 Music 分类而隐藏；三国 song 可推荐明确录音标题中的《三国恋》《三国杀》，不把另一首歌曲的歌词命中当歌名。
- 展示：只有已知非 Music 分类且正文有明确非音乐内容线索、又缺少歌曲/音乐/演出保护时隐藏；不确定项保留。推荐继续要求音乐证据和标题/歌手关联，每组最多 20，不凑弱项。
- 缓存：D1 exact hit 也从完整候选更新合格推荐；历史 KV 补建正确翻页，每次最多 5 页、100 组，保存游标供后续不足额读取继续。新 policy 为 music-evidence-v2，推荐池为 v8；raw algorithm、v4 exact cache 和排序不变，复用旧候选，不清空或重搜。
- 前端：搜索成功后失效并刷新推荐；清空搜索返回推荐时主动重新读取，保留已加载歌曲。
- 预算：provider query、最多 1 次 search.list、详情调用、1600ms/2000ms、配额、队列、播放、双语和布局不变。推荐更新使用现有后台任务，不增加 YouTube 请求。
- 验收：真实 47/49 条样例、部分歌名与歌词反例、D1/KV hit、旧推荐版本隔离、超 20 组分页/空页/继续游标/预算、前端刷新、完整原始顺序分数、零网络专项验证和本地双 Worker。

### 14.2 什么时候必须 bump version

| 改动 | `SEARCH_ALGORITHM_VERSION` | KV cache version | Recommendations version |
| --- | --- | --- | --- |
| Provider 第一 query、aliases、region/language | 必须 | 通常不必 | 视结果语义 |
| 改变 raw 候选准入的 hard filter、intent gate、title/artist match | 必须 | 只有 entry schema 不兼容才改 | 视旧推荐是否安全 |
| 仅过滤公开视图，raw 候选来源/准入/排序不变 | 不必；必须升级独立 response policy | 不必 | 资格变化必须改 |
| Score/排序改变 | 建议必须；除非明确只想重排旧候选 | 不必 | 旧推荐排序不安全时改 |
| Family identity 字段改变 | 必须 | 可能必须 | 通常不必 |
| KV entry schema/兼容校验改变 | 视候选语义 | 必须 | 不一定 |
| 推荐合并/提升规则改变 | 不一定 | 不一定 | 必须 |
| 纯 UI copy/loading、两秒错误展示 | 不必 | 不必 | 不必 |
| Quota/rate limit/time budget | 候选语义变化时必须 | 不必 | 不必 |

Version bump 后必须新增测试证明旧 D1 `family_hash` 不会命中，并说明旧 KV 如何自然过期或清理。

### 14.3 本地开发与发布验证

1. 更新本文件的提案、当前契约和已知风险。
2. 算法/准入/排序契约改变时更新 `worker/searchQualityContract.test.ts` golden cases；纯文案不要求新增算法测试，不能仅放宽断言。
3. 更新相关 focused tests：family、scoring、provider、service/cache、experience。
4. 搜索行为变化时运行 `npm run verify:search`；它会禁止未 stub 的网络，并核对本文件机器契约与代码/config。纯文案/流程说明按 README 第 4 节做最小检查，不默认全量验证。
5. 本地阶段运行相关检查与 `git diff --check`。只有用户明确要求发布/部署时，再统一运行 full tests、typecheck、verify:search 和 production build；不默认 push main（会触发自动部署）。
6. 发布后先使用 `cacheOnly=true` 做零额度 production smoke；本地完成不自动请求生产。
7. 只有用户明确安排时才运行 2–3 次真实 cold search；记录 quota before/after、source query、调用数、时间、前排结果和 repeat exact hit。
8. 结果通过后在 `PROGRESS.md` 记录发布历史；不要把历史 pass 复制回本文件冒充当前规则。

### 14.4 完成标准

本地搜索开发和正式发布分别标记状态；纯文案只需验证对应文案与相邻 UI。行为改动按适用项验证，生产项留到明确要求发布时：

- 四种模式的正负例都明确。
- Exact cache identity 和迁移策略明确。
- Cold call 最坏次数与两秒体验明确。
- Offline tests 证明零真实额度。
- 真实测试没有超过预先批准的额度。
- `SEARCH.md`、代码、测试和 production config 一致。

## 15. 代码地图

### 界面双语（已发布）

英文布局优化仅改变显示层：搜索类型短标签为 `Song` / `Artist`，原唱短标签为 `Vocals`（完整 aria-label / title 为 `Include original vocals`），英文搜索栏保持单行；推荐标题显示 `Song picks`，分页数量显示为 `8/8` 形式。界面短标签不改变提交值或搜索行为，不触发缓存版本变更。

本次仅增加搜索界面、加载、空状态、错误、partial response 与配额提示的中英翻译。手动语言偏好只保存在当前浏览器，不发送到搜索 API；输入、歌名/歌手/URL 模式、原唱意图、结果保留逻辑、两秒 deadline、推荐池与所有缓存键均保持现有契约。根据第 14 节矩阵，纯 UI copy 不调整 algorithm/cache/recommendations 版本，机器契约不变。中文 URL placeholder 保持 `YouTube视频链接`，英文为 `YouTube video link`。

| 文件 | 职责 |
| --- | --- |
| `worker/router.ts` | Request validation、rate limit、search event、quota broadcast、HTTP errors |
| `src/lib/searchQuery.ts` / `worker/searchQuery.ts` | 前后端共享普通文字、YouTube 单视频 URL、blocked URL 分类；Worker 保留转导出 |
| `src/lib/queryNormalize.ts` | canonical query 基础规范化 |
| `worker/searchFamily.ts` | algorithm version、family hash、provider aliases/source queries |
| `worker/youtubeSearch.ts` | search.list、videos.list、deadline、candidate detail pipeline |
| `worker/songFilter.ts` | 历史文件名；当前只负责 video id/title 结构准入与去重，不过滤 category/duration |
| `worker/musicEligibility.ts` | 独立的保守展示过滤、严格推荐资格，不改变原始缓存或排序 |
| `src/lib/searchPolicyVersion.ts` | 服务端/浏览器共享的公开视图版本，失效旧结果快照 |
| `worker/scoring.ts` | Query/intent 纯评分诊断与稳定排序，不决定 inclusion |
| `worker/searchService.ts` | D1/KV read order、live fallback、persistence、recommendations、quota orchestration |
| `worker/searchRepository.ts` | D1 exact repository、search events、Admin deletion/cleanup |
| `worker/kvCache.ts` | KV exact family、payload pruning、recommendation pool |
| `worker/videoCatalog.ts` | 被动 structural provider candidate analytics，不参与在线搜索 |
| `worker/youtubeQuota.ts` | Pacific daily ledger、D1 reservation、KV fallback |
| `src/lib/apiClient.ts` | 浏览器 2000ms abort |
| `src/lib/searchExperience.ts` | partial response 的结果保留与提示 |
| `src/routes/MobilePage.tsx` | 搜索草稿、提交、卡片、分页、preview、24h state |
| `worker/searchQualityContract.test.ts` | 四模式 golden contract |
| `scripts/verify-search.mjs` | 零网络发布门禁和配置/文档一致性 |
