# Karaoke Assistant（K歌助手）

一个面向朋友聚会的 Web KTV 点歌助手：大屏负责播放，手机负责扫码点歌，同一房间通过 Cloudflare Worker、Durable Object 和 WebSocket 实时同步。

Repository: <https://github.com/bradwang1995/Karaoke-Assistant>

Production: <https://ktv-assistant.bradwang1995.workers.dev>

项目文档：

- `README.md`：产品、架构、search technical design、手动配置、部署和测试。
- `PROGRESS.md`：实现状态、历史修复、验证记录和待办。

## 1. 产品与使用流程

1. 主持人在 `/create` 创建房间。
2. 浏览器进入 `/room/:roomId/display`，作为电脑、电视或投影大屏。
3. 参与者扫描二维码进入 `/room/:roomId/mobile`。
4. 手机搜索、预览并点歌；Durable Object 持久化并广播新 snapshot。
5. 大屏用 YouTube IFrame Player API 播放；结束、重唱或切歌会同步到房间。

| Route | 用途 |
| --- | --- |
| `/create` | 创建房间。 |
| `/room/:roomId/display` | 播放、二维码、重播、暂停/继续、下一首、seek 和 quota。 |
| `/room/:roomId/mobile` | 搜索、preview、点歌和队列管理。 |
| `/room/:roomId/debug` | Snapshot、房间链接和 cleanup。 |
| `/admin` | 单管理员登录后的搜索、配额与持久资料库总览。 |
| `/admin/searches` | 搜索事件筛选、分页与来源检查。 |
| `/admin/repository` | 持久查询资料检查、排序、分页和安全删除。 |

当前核心体验：

- 第一首歌自动成为 `playing`；后续歌曲 `queued`，不会打断当前播放。
- Mobile 支持 `歌名 / 歌手`、`带原唱`、默认推荐、选中后立即从 30 秒静音自动播放的单个轻量 preview 和缓存内无限滚动；只有提交搜索按钮才会请求，输入和筛选变化不会擅自刷新结果。
- Search query、模式、结果、选中项、preview、scroll 和 tab 可恢复 24 小时。
- 点歌后保留搜索上下文；歌单支持置顶、删除、重唱和切歌。
- Display 自动尝试播放，提供 app-owned progress/seek、重播、暂停/继续和下一首；任何新 queue item 都严格从 0 秒开始。
- WebSocket 自动重连；30 秒 heartbeat；无客户端活动 5 分钟后 inactive cleanup。

## 2. 技术架构

| 组件 | 职责 |
| --- | --- |
| React + TypeScript + Vite | 页面、mobile UI state、播放器和 local development。 |
| Main Worker `ktv-assistant` | API router、YouTube search、production assets。 |
| Room Worker `ktv-assistant-room` | 导出 `RoomDurableObject`。 |
| Durable Object | WebSocket clients、命令顺序、broadcast、heartbeat、alarm。 |
| D1 `DB` | 房间、队列、playback、持久搜索资料库、搜索事件、quota ledger 和 admin audit。 |
| KV `SEARCH_CACHE` | Search family 加速层、index、推荐和 rate limit；不是持久资料库的 source of truth。 |
| YouTube APIs | Worker-only search 和官方 iframe playback。 |

### 2.1 房间数据流

创建房间：

1. Frontend 使用中性的“K歌房”名称并用 `POST /api/rooms` 提交；普通网页无法可靠读取真实电脑名或 Chrome Profile 名，因此不伪装成设备识别结果。
2. Main Worker 生成 8 位小写字母/数字 room id。
3. D1 写入 `rooms` 和初始 `playback_states`。
4. API 返回 display/mobile URLs 和 initial snapshot。

实时同步：

1. Display/mobile 连接 `/api/rooms/:roomId/ws`。
2. Main Worker 把 upgrade 转给按 room id 命名的 Durable Object。
3. `JOIN_ROOM` 返回 `ROOM_SNAPSHOT`。
4. Queue/player command 通过共享 reducer 得到 next snapshot。
5. DO 写 D1，再用 `ROOM_UPDATED` 广播给所有 clients。

队列 invariant：

- 新增第一首时进入 `playing + loading`。
- Add/promote queued item 不替换当前 playing item。
- Player event 的 queue item id 和 video id 必须匹配当前播放。
- `PLAYER_ENDED` 完成当前歌曲并选择 sort key 最小的下一首。
- `RESTART_CURRENT_ITEM` 只重置为 `loading`，不改变顺序。
- 没有 queued item 时 playback 回到 `idle`。

### 2.2 D1 与房间生命周期

`migrations/0001_initial.sql` 包含：

- `rooms`：名称、时间和 `is_active`。
- `queue_items`：YouTube metadata、status 和 sort key。
- `playback_states`：当前 item/video 和 player state。
- `playback_events`：预留 event audit table。

Snapshot 包含 `room`、`queue`、`playback` 和 `connectedClients`。Activity 写入 DO storage 并更新 D1；alarm 到期时：

- 有 active socket：延期。
- 未满 5 分钟：按最后 activity 重新安排。
- 已 inactive 5 分钟：room 设为 inactive，queue 清空，playback 设为 idle。

### 2.3 Local 与 production

本地 Vite 保留 `localStorage + BroadcastChannel` fallback；只有 localhost origin 在 socket 未连接时允许使用。以下必须在线上验证：

- Durable Object、WebSocket、D1 和 KV。
- Search cache、quota 和 rate limit。
- Worker + Assets routing。
- 真实 browser autoplay、playsinline 和 iframe policy。

主要代码位置：

```txt
src/routes/                 create、display、mobile、debug
src/hooks/useRoomSocket.ts  connection、heartbeat、reconnect
src/lib/roomReducer.ts      shared queue rules
worker/router.ts            HTTP API
worker/roomDurableObject.ts realtime room lifecycle
worker/search*.ts           query family、service、ranking
worker/searchRepository.ts  D1 持久搜索资料库、admin 聚合与删除审计
worker/cloudflareStorage.ts Cloudflare D1/KV 权威存储指标、缓存与过期回退
worker/adminAuth.ts         单管理员 session、cookie、rate limit、origin guard
worker/kvCache.ts           cache/index/recommendations
worker/youtube*.ts          live search、quota
```

## 3. Production 资源与配置

| 资源 | 名称 / ID |
| --- | --- |
| GitHub repository | `bradwang1995/Karaoke-Assistant` |
| Cloudflare account | `Bradwang1995@gmail.com's Account` / `7b1b04c010c424952c9d2cbcbea76145` |
| Main Worker + Assets | `ktv-assistant` |
| Production origin | `ktv-assistant.bradwang1995.workers.dev` |
| Room Worker | `ktv-assistant-room` |
| Durable Object | `RoomDurableObject` / `0b4ed7f219e94e1fb685b7f554808aba` |
| D1 | `ktv-assistant-db` / `a2fe987b-5191-4ac3-9d01-f923d19c731a` |
| KV | `SEARCH_CACHE` / `aedd751919314f9e81f1917e59a859bd` |
| Secret | `YOUTUBE_API_KEY` 配置在两个 Worker；管理员与 Cloudflare 指标 secrets 只配置在 Main Worker |

Main Worker bindings：

```txt
DB           -> ktv-assistant-db
SEARCH_CACHE -> SEARCH_CACHE
ROOM_OBJECT  -> RoomDurableObject in ktv-assistant-room
```

Room Worker 使用相同 D1/KV，并通过 `[[migrations]]` 创建 `RoomDurableObject`。`workers_dev = false`，不需要独立 public URL。

GitHub repository 与 Cloudflare Worker 独立命名。仓库已改名为 `Karaoke-Assistant`，但 Main Worker 继续使用 `ktv-assistant`，因此现有 production URL、D1、KV、Durable Object 和 secrets 不需要迁移。Main Worker 已连接 Cloudflare Workers Builds，`main` 分支 push 会触发 Main 自动部署；Room Worker 仍必须由 Wrangler 独立发布，完整发布顺序见第 10 节。

Runtime variables：

| Variable | Value | 作用 |
| --- | ---: | --- |
| `YOUTUBE_SEARCH_DAILY_LIMIT` | `100` | Project `search.list` call guardrail。 |
| `YOUTUBE_SEARCH_MAX_CALLS_PER_FILL` | `1` | 每个 cold family 最多一次 search。 |
| `SEARCH_CACHE_TTL_DAYS` | `365` | KV cache TTL。 |
| `SEARCH_CACHE_MAX_ENTRY_BYTES` | `524288` | Family payload 上限约 512 KiB。 |
| `SEARCH_RATE_LIMIT_PER_MINUTE` | `20` | Room + identity search rate limit。 |
| `ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE` | `5` | 单一 IP 每分钟管理员登录尝试上限。 |
| `CLOUDFLARE_ACCOUNT_ID` | production account ID | Cloudflare 管理 API / Analytics 服务端查询范围；不会返回浏览器。 |
| `CLOUDFLARE_D1_DATABASE_ID` | production D1 ID | D1 `file_size` 查询目标；不会返回浏览器。 |
| `CLOUDFLARE_D1_DATABASE_NAME` | `ktv-assistant-db` | 管理页面资源标签。 |
| `CLOUDFLARE_KV_NAMESPACE_ID` | production KV ID | KV Analytics 查询目标；不会返回浏览器。 |
| `CLOUDFLARE_KV_NAMESPACE_NAME` | `SEARCH_CACHE` | 管理页面资源标签。 |
| `CLOUDFLARE_STORAGE_METRICS_TTL_SECONDS` | `300` | 服务端最近成功值复用时间，避免每次 render 调用 Cloudflare。 |
| `D1_CAPACITY_LIMIT_BYTES` | 未设置 | 可选运维配置；只有明确知道该环境的真实 D1 上限时才设置。 |
| `KV_CAPACITY_LIMIT_BYTES` | 未设置 | 可选运维配置；没有可靠上限时不显示 KV 百分比。 |
| `SEARCH_REPOSITORY_CAPACITY_BYTES` | 未设置 | 旧配置兼容别名；仅在未设置 `D1_CAPACITY_LIMIT_BYTES` 时作为 D1 运维容量使用。 |
| `SEARCH_REPOSITORY_WARNING_THRESHOLD_PERCENT` | 未设置 | 可选；已知容量下的预警百分比，必须在 `0–100` 之间。 |
| `SEARCH_REPOSITORY_CLEANUP_TARGET_PERCENT` | 未设置 | 可选；必须低于预警线，定义每批清理希望达到的容量百分比。 |
| `SEARCH_REPOSITORY_CLEANUP_BATCH_SIZE` | `25` | 每次手动存储清理最多删除的资料条数；服务端硬上限为 50。 |

Google 当前文档的默认 `search.list` bucket 是 100 calls/day、每次计 1 call；本项目 guardrail 与该默认值一致。单次 `search.list` 仍最多返回 50 条，这是独立的 response-size 限制。实际平台上限以 Google Cloud Console 为准，项目变量只控制 app guardrail 和 estimate。

## 4. 本地开发

```bash
npm install
npm run dev
```

| Command | 作用 |
| --- | --- |
| `npm run dev` | Vite dev server。 |
| `npm run typecheck` | Frontend + Worker TypeScript。 |
| `npm run test` | 全部 Vitest tests。 |
| `npm run build` | TypeScript + Worker + production assets。 |
| `npm run preview` | Preview built assets。 |

提交前：

```bash
npm run typecheck
npm run test
npm run build
```

## 5. API 与 WebSocket protocol

| Method | Path | 说明 |
| --- | --- | --- |
| `POST` | `/api/rooms` | 创建房间；JSON 可带 `displayName`，服务端规范化并限制为 40 个 Unicode 字符。 |
| `GET` | `/api/rooms/:roomId/snapshot` | 当前 snapshot。 |
| `GET` | `/api/rooms/:roomId/ws` | WebSocket upgrade。 |
| `POST` | `/api/rooms/:roomId/search` | 搜索或默认推荐。 |
| `POST` | `/api/rooms/:roomId/cleanup` | 删除 completed/removed items。 |
| `GET` | `/api/youtube/quota` | 应用估算的 search quota。 |
| `GET / POST / DELETE` | `/api/admin/session` | 检查 session、登录和退出；响应不缓存。 |
| `GET` | `/api/admin/overview` | 受保护的 quota、资料库、趋势、歌曲/歌手聚合与容量状态。 |
| `GET` | `/api/admin/storage` | 受保护的标准化 D1/KV 指标；`?refresh=1` 要求服务端重新验证 Cloudflare。 |
| `GET` | `/api/admin/searches` | 受保护的搜索事件筛选和分页。 |
| `GET / DELETE` | `/api/admin/repository` | 受保护的资料库检查和最多 50 条的选择删除。 |
| `GET / POST` | `/api/admin/repository/cleanup` | 受保护的存储清理预览与明确确认后的有限批次执行。 |

Room id 必须是 8 位小写字母/数字。Error response 使用 `error.code` 和 `error.message`。

Client → server messages：

- `JOIN_ROOM`：`role`、`clientId`、可选 `displayName`。
- `ADD_QUEUE_ITEM`：video metadata。
- `PROMOTE_QUEUE_ITEM` / `REMOVE_QUEUE_ITEM`：`queueItemId`。
- `PLAYER_STARTED` / `PLAYER_ENDED` / `RESTART_CURRENT_ITEM`：当前 ids。
- `PING`：heartbeat。

Server → client：`ROOM_SNAPSHOT`、`ROOM_UPDATED`、`PONG`、`ERROR`。

Client 每 30 秒 `PING`；reconnect 从 500ms 倍增到 8 秒，最多 8 次。Production socket unavailable 时不会把 command 写入本地假 snapshot。

## 6. Search technical design

Search 的目标是把用户输入文字作为主要 cache identity，同时保证 cache 只稳定复现候选、绝不改变搜索相关性。系统读取同一完整规范化文字与 artist 的四个歌曲/歌手、伴奏/原唱组合，先做当前查询的严格相关性过滤，再按当前意图重排。若旧缓存经严格过滤后一条可用结果也没有，系统会执行新的精准 cold request 来修复该 family；在线流程不会扫描历史候选目录。

### 6.1 目标与约束

- API key 只存在于 Worker secret。
- Cold search family 默认只发一次 `search.list`。
- 一次最多取 50 个 Music category embeddable candidates，去重、补 duration/category/tags/status，只保留严格短于 7 分钟的歌曲，再打分和缓存；恰好 7 分钟也会被拒绝。
- 原始 embeddable candidates 与用户可见结果分开：候选只被动写入 D1 供统计，在线搜索不会查询该目录；界面只接收本次外部结果中通过相关性过滤的内容。
- 非空搜索 UI 最多取 50，先显示 10，再按 10 条从当前 response 展开。
- 空查询 recommendation pool 聚合最多 200 条，并按 10 条自动扩展到缓存耗尽。
- Cache hit、空查询推荐和 client-side load-more 不增加 search call。
- 歌名模式只保留 title 命中；歌手模式拒绝 title/channel/tags 都不含目标歌手的结果。通过相关性门槛后，非原唱只保留带 KTV/卡拉OK/karaoke/伴奏/instrumental 标记且没有明确 original/原唱标记的候选；原唱模式只保留标题带 lyric video/lyrics/歌词、原唱、MV、official、audio 或 radio 标记的候选。
- 新搜索发出后立即清空上一批卡片，按钮进入灰色 disabled 状态并显示旋转图标；结果区域持续显示加载状态，直到新 response 到达。
- Guardrails 通过 Wrangler variables 配置。

Google `search.list` 当前 `maxResults` 是 0–50；`q` 支持 OR `|` 和 NOT `-`。额外 page request 会消耗新的 search call，因此默认只取第一页。

### 6.2 Request / response

```json
{
  "query": "后来",
  "limit": 50,
  "searchType": "song",
  "includeOriginalVocal": false,
  "cacheFill": true
}
```

Request rules：

- `query` required，trim 后最多 100 characters。
- `limit` 默认 10；非空搜索 clamp 到 1–50，空查询推荐 clamp 到 1–200。
- `artist` optional，最多 100 characters；API 支持，mobile UI 暂不单独发送。
- `searchType` 是 `song` 或 `artist`，默认 `song`。
- `includeOriginalVocal` 默认 `false`。
- `cacheFill` 默认 `true`。设为 `false` 会把 cold target 缩到当前 limit，但 cache miss 仍可能发一次 YouTube request。
- Empty query 直接读 recommendations，不发 live search。

Response 保留：

- `query`、`normalizedQuery`、`searchType`、`includeOriginalVocal`。
- `cached` 和 scored `results`。
- `cacheMeta`：search calls、cached count、videos calls、source queries、pruned count、quota snapshot，以及候选/过滤/目录复用和新增目录视频计数。

### 6.3 Query family

`buildSearchQueryFamily`：

1. 对用户实际输入只做 trim、连续空格折叠和小写规范化；该完整文字作为 cache identity。
2. 用完整规范化文字、artist、type 和 vocal intent 生成稳定 hash。
3. 只有在构造 YouTube provider query 时，才移除末尾 `ktv`、`karaoke`、`instrumental`、`pinyin`、`伴奏`、`卡拉OK`，避免重复后缀；这不会改变 cache identity。
4. 生成 provider aliases、normalized query 和 source queries。

Hash input：

```txt
canonicalQuery | artist | searchType | original-or-karaoke
```

单个 family 仍要求完整规范化文字、song/artist、伴奏/原唱和明确 artist 全部相同。一次本地读取会以当前 family 为首，再按“同模式另一原唱开关 → 另一模式同原唱开关 → 另一模式另一原唱开关”检查同一文字与 artist 的其余三个 family。`后来` 与 `后来 KTV` 仍完全隔离；系统绝不会用不同文字或全局候选目录补结果。

Song/KTV aliases：

```txt
后来
后来 ktv
后来 karaoke
后来 伴奏
后来 卡拉OK
后来 pinyin karaoke
后来 instrumental
```

Original-vocal aliases：

```txt
后来
后来 lyric video
后来 lyrics
后来 歌词
后来 MV
后来 original with lyrics
```

实际只消耗一次 `search.list` 的首条 source query 会直接表达当前意图：普通模式使用 `focused text + ktv`，带原唱模式使用 `focused text + lyrics`；若歌名请求带明确 artist，则 focused text 为 `artist + song`。其余 canonical、KTV、artist 和 broad aliases 只作为未来可用的 deterministic fallback。无需在 request 中调用 LLM。

### 6.4 Live fetch pipeline

1. D1 用一次查询读取同一完整规范化文字与 artist 的最多四个 option families；KV 并行读取对应四个精确 hash。当前 family 优先，缺少或不足时才合并另外三个 family。
2. 只合并四个相同文字与 artist 的 option families；不读 normalized index、不匹配相似文字、不扫描被动候选目录。
3. 对本地结果重新执行歌曲资格与查询相关性过滤、按 `videoId` 去重，再以当前 vocal intent 重排；四个 family 即使存在，只要严格过滤后为零，也会读取 quota estimate 并准备一次精准外部搜索，避免坏缓存永久返回空白或无关内容。
4. `search.list` 使用 `type=video`、`videoCategoryId=10`、`maxResults=50`、`videoEmbeddable=true`、`safeSearch=moderate`、`regionCode=CA`、`relevanceLanguage=zh-Hans`。
5. Deduplicate by `videoId`，并用 `videos.list(part=contentDetails,snippet,status)` 每 50 ids 一批读取 duration、category、tags 和最新 embeddable 状态。
6. 只保留 `categoryId=10`、duration 大于 0 且严格小于 420 秒、仍可嵌入的视频；详情缺失、非音乐分类、恰好或超过 7 分钟全部 fail closed。
7. 歌名模式过滤 title miss、channel-only 和 tags-only hit；歌手模式过滤 metadata 完全不含目标歌手的候选。相关候选再按当前 vocal intent 排序，其他 family 不能绕过该门槛。通过歌曲资格过滤的外部候选被动写入 D1 统计目录，但该目录不参与在线检索。
8. 将本次过滤后的完整结果写入当前 exact repository、exact family cache 和 recommendation pool。生产请求使用 Worker lifecycle 后台刷新 cache、repository access 与搜索事件；真实候选新增计数仍在 response 前完成。
9. 返回 requested slice，非空搜索最多 50 条；50 是上限而非保证，不存在“本地凑够 10 条就提前返回”的路径。

没有 `YOUTUBE_API_KEY` 时使用 mock provider。Quota exhausted 且 cache miss 时返回空 results 和 quota metadata；已有 cache 仍可使用。

### 6.5 Ranking

相关性高于通用 KTV keyword，避免无关 KTV 视频压过真正的歌曲：

| Signal | Score / behavior |
| --- | --- |
| Exact title | +60 |
| Title prefix | +48 |
| Title contains query | +40 |
| Query tokens in title | +24 |
| Channel-only match | 歌名模式过滤；其他上下文 +2 |
| Song title miss | 歌名模式过滤；底层 score -72 |
| Artist in title/channel | +42 / +32 |
| KTV / 卡拉OK / karaoke | 普通 KTV intent：+30 / +30 / +24 |
| 伴奏 / instrumental | 普通 KTV intent：+20 / +16；原唱 intent：-30 / -28 |
| Lyric video / lyrics / 歌词 | 原唱 intent 的准入标记并加权 |
| Original / 原唱 / MV / official | 原唱 intent：+34 / +38 / +24 / +20；普通 intent 拒绝明确 original/原唱，MV/official 降权 |
| Audio / radio | 原唱 intent 的准入标记：+16 / +12 |
| Live、现场、reaction、cover | Downrank |
| Remix、tutorial、教学、shorts | Downrank |
| Duration < 60s | Downrank；duration ≥ 7min 在 scoring 前拒绝 |

带 low-priority marker 的 title 即使命中 query，也只拿较低 title score。`带原唱` 会改变下一次显式提交搜索使用的正负权重；当前 exact family 优先，同一文字与 artist 的相反 vocal intent family 只在结果不足时补充并重新打分。切换本身不请求或清空当前结果；Result 保留 `score` 和 `reasons` 供 test/debug。

关键 regressions：搜索 `依赖` 时只保留标题命中的 `离开我的依赖` 等候选，标题无关的 `唯一` KTV 不能进入结果；歌手模式搜索 `单依纯` 时，metadata 完全不含 `单依纯` 的其他歌手歌曲也不能进入结果。

### 6.6 KV cache

Keys：

```txt
yt-search:v4:<familyHash>:CA:zh-Hans
yt-search-recommendations:v2:CA:zh-Hans
yt-search-quota:v1:<Pacific-date>
```

Family entry 保存：

- Canonical/normalized query、artist、type、vocal intent、aliases、hash。
- Created/expiry timestamps 和 source queries。
- 最多 50 条 results。
- Search/videos call counts、payload bytes、pruned count。
- Hit count 和 last accessed time。

每个 KV read 只查精确 family hash，并再次验证完整规范化文字、type、vocal intent 和 artist scope；一次用户搜索会并行读取同一文字与 artist 的四个精确 option hashes。不会 fallback 到 normalized index、不同文字或全局候选目录；命中的 family 增加 hit count，但不延长原 expiry。历史 `yt-search:v3`、`yt-search-recommendations:v1` 与 `yt-search-index:v2` key 可自然过期，新搜索不再读取或写入。

写入先限制 50 条，再测 UTF-8 JSON bytes；超过 512 KiB 时从尾部裁剪。默认 TTL 365 天。KV 可重建；D1 exact repository 与视频目录是持久资料源。

### 6.7 D1 被动候选统计目录

`migrations/0005_search_video_catalog.sql` 新增：

- `search_video_catalog`：按 `video_id` 去重保存标题、频道、缩略图、duration、发布时间、首次/最近来源 query、出现次数和时间。
- `search_events` 效率列：外部候选数、过滤后数、目录结果数、新增独立候选、真实 search calls 和是否避免外部调用。

目录只接收 YouTube `type=video + videoEmbeddable=true + videoCategoryId=10` 且经详情复核为 Music、严格短于 7 分钟、仍可嵌入的候选，用于统计候选增长、重复出现和过滤效率。在线搜索完全不读取该表；低相关候选不会暴露给用户，也不会被拿来补足其他 query。

同一视频在并发/重复写入时使用 `INSERT ... DO NOTHING` 的真实 D1 `changes` 计算新增数量，已存在视频只更新 metadata、appearance count 和 last seen。管理台因此可以显示真实的“新增候选/额度”，而不是把重复候选当成增长。

`migrations/0006_remove_cross_query_catalog_search.sql` 删除 0005 曾建立的 FTS5 表和同步 triggers，保留原始候选统计数据，避免无用索引写入成本。

### 6.8 Recommendations、quota、rate limit

- 每次成功写 family 时只把该搜索排名最高的前 8 条提升到 recommendation pool 顶部，其余尾部结果排在已有高质量候选之后；按 video id 去重并保留最多 200 条。
- Cache hit 会重新提升该 family 的头部结果；真实 `ADD_QUEUE_ITEM` 会把被点歌曲置顶，因此近期搜索、近期点歌和历史高命中 family 都会形成可解释的推荐信号。
- Recommendation key 不存在或不足时，会按“最近访问时间 + hit count”排列 family，再按名次轮转合并，而不是让单个最新 family 的随机尾部垄断列表。
- Project guardrail：100 `search.list` calls/day、1 call/cold fill；单次结果上限仍是 50。
- Quota day 按 `America/Los_Angeles`，PT 午夜重置。
- `GET /api/youtube/quota` 返回 remaining/reset；cold search 写入后直接使用刚记录的 status，并通过 room WebSocket `YOUTUBE_QUOTA_UPDATED` 即时更新 display。60 秒 query poll 只作断线兜底。
- Display 只显示简洁的本地相对倒计时（`本地重置还有 N 小时`），不暴露 GMT 或 IANA 时区文本。
- Estimate 不替代 Google Cloud Console，失败/无效请求可能造成 drift。
- 非空搜索默认同 room + IP identity 每分钟 20 次。
- 超限：HTTP 429、`SEARCH_RATE_LIMITED`、`retry-after`。

### 6.9 Mobile search state

每个 room 的 localStorage state 保留 24 小时：

- Query、type、original-vocal toggle。
- Full response cache 和 visible count（10–50）。
- Selected result、active preview、scroll。
- Search/queue tab URL state。

继续加载只扩展当前 response。切 tab、refresh 或连续点歌都应保留上下文。

输入 query、切换歌名/歌手或打开/关闭原唱只更新草稿条件，不改变当前标题、数量和结果；按搜索按钮或键盘 Search/Enter 才提交。请求进行中保留旧结果，成功后一次性替换，避免数量在输入或 loading 中跳动。

### 6.10 后续 search 方向

- 用 curated/offline tooling 增加中文别名、拼音、英文名和 typo。
- 决定是否提供显式 prewarm。
- 按真实 D1/KV 增长和复用率设计目录/缓存 eviction。
- 若增加多 source-query，仍受 daily/per-fill caps 限制。

## 7. 管理控制台与持久搜索资料库

### 7.1 当前首版范围

管理页面采用精简的三段导航：`总览`、`搜索记录`、`资料库`。首版只包含运营必需能力：

- 单管理员密码登录；服务端验证 `ADMIN_PASSWORD`，使用 `ADMIN_SESSION_SECRET` 签发 12 小时、`Secure`、`HttpOnly`、`SameSite=Strict` cookie。
- 所有 admin read/mutation API 独立校验 session；前端路由隐藏与否不参与授权判断。
- 登录端点按 IP 限流；admin mutation 额外校验 same-origin；错误响应与 admin 数据均使用 `Cache-Control: no-store`。
- 总览展示本地耐久 quota ledger、Cloudflare D1 API 实际体积、Cloudflare Analytics KV bytes/key count、应用记录估算、持久查询/结果/复用计数、被动候选采集、精确复用与过滤效率、趋势、热门歌曲/歌手和原唱分类状态。
- 搜索记录支持 `24 小时 / 7 天 / 30 天`、关键词、来源、分页；历史从 migration 上线后的新事件开始，不伪造 backfill。
- 资料库支持关键词、查询类型、排序、分页、结果标题预览、最多 50 条选择删除和确认对话框。
- 删除同时移除对应 D1 entry 与 KV 加速 key，并写 `admin_audit_events`；不提供 raw `TRUNCATE`。
- 存储压力清理必须先预览；只有容量、预警线和较低目标都已配置且当前容量越线时，才按低复用、最久未用、最早创建的顺序生成候选。执行使用 60 秒短期锁和最多 50 条的有限批次，结果与最近历史可见且写入审计。
- 首版不自动执行存储清理；D1 物理容量在逻辑删除后可能延迟变化，因此 partial outcome 会诚实显示并允许稍后重新预览。

当前仍不包含 automated/prewarm search、趋势抓取、跨查询/semantic/fuzzy matching、无人值守自动容量清理或多角色权限系统。

### 7.2 D1 数据与复用路径

`migrations/0002_admin_console.sql` 新增：

- `search_repository_entries`：精确 query family 的持久 response JSON、结果数、估算 bytes、reuse count 和时间戳；没有 TTL 字段。
- `search_events`：原始/规范化查询、歌曲/歌手、原唱三态、来源、结果数、成功状态和 `human/admin/automation` origin。
- `youtube_quota_daily`：按 Pacific quota day 聚合的耐久 search-call ledger；D1 原子 upsert，KV 只在 D1 异常时 fallback。
- `admin_audit_events`：删除 action、目标 ids、影响条数、success/failure 和时间。

`migrations/0003_repository_cleanup_lock.sql` 新增单一短期 lease 表，阻止两个管理员清理任务同时执行；过期 lease 可由后续任务安全接管。

`migrations/0004_cloudflare_storage_metrics.sql` 新增 D1/KV 最近成功指标状态与 30 秒刷新 lease。缓存只保存标准化 bytes、key count、来源、时间和安全错误码，不保存 Cloudflare token 或原始 provider response。

`migrations/0005_search_video_catalog.sql` 新增持久视频目录和搜索效率事件列；`migrations/0006_remove_cross_query_catalog_search.sql` 删除不再使用的 FTS5 索引与 triggers。目录没有自动 TTL；实际 D1 `file_size` 继续由 Cloudflare 指标路径监控。

用户搜索顺序：

1. 用完整规范化文字与 artist 一次查询 D1 的四个 song/artist × original-vocal option families，并行读取 KV 的四个精确 hash。
2. 当前 family 优先；如其他 family 提供了额外歌曲，按当前意图合并、去重和重排，`responseSource=repository`、`externalCallAvoided=true`，不调用 YouTube。
3. 四个 family 都没有可用结果才调用 YouTube（或 local mock）。不会读取 normalized index、相似 query 或候选目录。Live path 在发出 `search.list` 前先通过 D1 原子预留一次额度；即使 provider 随后失败，这次可能已消耗的调用也保留在 ledger。没有可用耐久 ledger 时不会发出无法记账的外部调用。
4. 外部结果必须有可验证的 Music category、严格短于 7 分钟的 duration 和可嵌入状态；过滤后的完整结果写入当前 exact repository、KV family 与 recommendations。
5. KV search key 已升到 `yt-search:v4`、recommendation key 已升到 `yt-search-recommendations:v2`，避免旧的未验证 metadata 继续返回。D1 旧 row 若缺少 category/duration 也会被忽略，直到 live search 刷新。
6. 命中的 repository access、KV touch、cache/repository refresh、human search event 与 quota broadcast 在生产使用 `ctx.waitUntil` 完成；API route 仍记录真实 response source、候选/过滤/新增与复用指标。

如果 D1 暂时不可用，公开搜索会记录结构化错误并沿用 KV/live path，不因为 admin instrumentation 让用户搜索整体失败。

### 7.3 容量与 quota 语义

- D1 使用官方 `GET /accounts/{account_id}/d1/database/{database_id}` 的 `file_size`，页面标记为“Cloudflare D1 API”；不再把 SQL statement `meta.size_after` 当成管理页面权威值。
- KV 使用 Cloudflare GraphQL Analytics 的 `kvStorageAdaptiveGroups`，页面展示最新 `byteCount` 与 `keyCount` 并标记为“Cloudflare Analytics”。该数据按天聚合，保留 provider 测量日与最近成功时间。
- `estimatedRepositoryBytes` / “应用记录估算”只合计 `search_repository_entries.approx_bytes`，用于理解搜索结果 payload；它不是 D1 数据库体积，也不与 KV 真实 bytes 混算。
- D1、KV 完全分开显示。任一 provider 失败不会清零另一项；如果有最近成功值则继续显示并标记“过期”，从未成功则显示“暂时无法获取”。
- Cloudflare 当前提供 plan-dependent 文档上限，但已核实的 D1/KV 指标接口没有返回本账户可直接使用的机器可读容量上限。系统不根据 plan 名称硬编码 500 MB、5 GB、10 GB 或 1 TB；只有显式运维配置容量时才计算百分比，且标记为“运维配置”、`authoritative=false`。
- 管理页面自动读取最多每 5 分钟向 Cloudflare 重新验证一次；手动“刷新数据”会要求服务端重新验证。D1 lease 避免多个管理员页面同时重复调用 provider。
- 清理策略要求 D1 权威实际体积可用且新鲜，并同时配置 capacity、warning threshold 和更低的 cleanup target；缺一项、指标过期、目标不低于预警线或容量未越线时，服务端都返回明确的 skipped preview，不删除资料。
- 首版坚持 manual-first：预览和确认后才执行有限批次；自动清理仍未启用。
- YouTube 页面值标记为 `local_estimate / search_calls`。当前 project guardrail 为 100 calls/day、一次 `search.list` 计一次；Google Cloud Console 仍是最终权威。

### 7.4 本地管理员验证

`.dev.vars` 已被 `.gitignore` 排除。开发者本地创建：

```dotenv
ADMIN_PASSWORD="仅用于本机的密码"
ADMIN_SESSION_SECRET="足够长且随机的本机 session secret"
# 仅用于服务端读取 Cloudflare D1/KV 指标；至少需要 D1 Read + Account Analytics Read：
# CLOUDFLARE_API_TOKEN="..."
# 只有明确知道当前环境的真实容量时才添加以下示例变量：
# D1_CAPACITY_LIMIT_BYTES="..."
# KV_CAPACITY_LIMIT_BYTES="..."
# SEARCH_REPOSITORY_WARNING_THRESHOLD_PERCENT="80"
# SEARCH_REPOSITORY_CLEANUP_TARGET_PERCENT="70"
# SEARCH_REPOSITORY_CLEANUP_BATCH_SIZE="25"
```

然后使用完整 Worker runtime，而不是只跑 Vite：

```bash
npx wrangler d1 migrations apply ktv-assistant-db --local --config wrangler.toml
npm run build
npx wrangler dev --local --config wrangler.toml
```

打开 `http://127.0.0.1:8787/admin`。生产环境必须通过 `wrangler secret put` 或 Dashboard encrypted secret 配置两个值，绝不写入 Git。

### 7.5 生产指标验收快照（2026-07-26）

生产管理员登录后强制刷新，D1 与 KV 均返回权威来源，没有安全错误或伪造容量：

- Main Worker 当前活动版本 `45fc80db-0a8c-4037-a51c-18b003b618d6`，由 `CLOUDFLARE_API_TOKEN` Secret 更新生成，承载 100% 生产流量；本批运行时代码发布版本为 `ba476a0f-0583-431b-ba68-9d1b43d33c52`。
- D1 API 在 `2026-07-27T01:52:41.947Z` 返回 `278,528 bytes`；Admin 按二进制单位显示 `272.0 KB`，同刻 Cloudflare Dashboard 按十进制单位显示 `279 kB`。
- KV GraphQL Analytics 返回 `1,297,755 bytes`、`413` 个键，指标日为 `2026-07-27T00:00:00.000Z`；Admin 显示 `1.2 MB / 413`，Dashboard 显示 `1.3 MB / 413`。
- Admin 与 Dashboard 的显示差异只来自二进制和十进制单位换算，精确来源值一致。D1/KV 容量上限仍未配置，因此界面不显示猜测百分比。

## 8. YouTube preview 与 display player

Mobile preview：

- 手机竖屏默认两列，较宽/横屏为 3–4 列；每张 card 在视频下方显示两行以内的歌名，不显示 uploader/channel。
- Mobile 使用与 display 连续一致的 slate/teal 深色背景，`theme-color`、`color-scheme`、HTML/body 和 safe-area 都保持深色，避免 Safari 顶部状态栏、底部地址栏或结果区露出白带。
- 选择 card 后立即激活 preview；快速切换会销毁旧 preview，只有 active card 挂载 iframe。
- Pending/加载阶段显示 spinner；10 秒仍未加载会显示可重试提示；点击外部停止。
- Preview 初始化即设置 `autoplay=1`、`mute=1`、`start=30` 和 `playsinline=1`；ready 后仍依次 `mute()`、`loadVideoById(startSeconds=30)`、`seekTo(30)` 和 `playVideo()`，并在短延迟后重试。只有收到真实 `PLAYING` 状态才结束 spinner；选中即激活、30 秒起点与调用参数由回归测试和浏览器检查保护。
- App 不重复显示 video title/channel/quality；YouTube 原生 title/avatar/branding 可能按官方规则出现，不能用 overlay 或裁切遮挡。

Display：

- IFrame Player API + autoplay intent；API 未 ready 时等待。
- 短延迟 retry；browser block 时 footer 的暂停/继续键切换为播放入口。
- 实际 PLAYING 才发送 `PLAYER_STARTED`；ENDED 发送 `PLAYER_ENDED`。
- Restart 会重置 player flags/progress，再从 0 秒重新 load/play 并重新发送 `PLAYER_STARTED`；manual skip 和 natural end 共用推进规则。
- Progress 以 queue item id 隔离；切歌、自然结束推进和手动下一首都不会继承上一首的 current time，已播放段为 teal、未播放段为灰色。
- Footer 提供明显的重播、暂停/继续、下一首三键 wrapper；默认 iframe 禁止 pointer hover、关闭 native controls/fullscreen/keyboard，并移除 app 自己覆盖在视频上的状态、点击和结束遮罩。
- 全局 `Space` 在非输入控件焦点下切换暂停/继续并阻止按钮残留焦点；Mobile/Display 禁止任意文字、图片和播放器区域被拖选，输入框仍可正常编辑。
- 没有当前歌曲时 footer 不渲染“等待点歌”等占位标题。
- 不显示画质 selector 或手动模式；display 和 preview 均由 YouTube 根据网络、设备与 viewport 自动选择画质。
- Google 已明确 `setPlaybackQuality`、`getPlaybackQuality` 和 `getAvailableQualityLevels` 不再支持，`suggestedQuality/vq` 也会被忽略；项目不提供假的固定 360p/720p/1080p 选项。
- `modestbranding` / `showinfo` 已失效，`rel=0` 也只能把相关推荐限制到同一频道；Google 还禁止用 overlay/frame 遮挡嵌入播放器。因此 app 只能关闭受支持的 controls、避免 hover，并在 ENDED/error 后隐藏整个 iframe，不能合规地强行抹掉所有 YouTube 自有 UI。

官方说明：<https://developers.google.com/youtube/iframe_api_reference#october-24,-2019>、<https://developers.google.com/youtube/player_parameters>、<https://developers.google.com/youtube/terms/required-minimum-functionality>

## 9. Cloudflare 手动配置

当前 production 资源已经创建。以下用于新环境、恢复或迁移。

### 9.1 登录

```bash
npx wrangler login
npx wrangler whoami
```

### 9.2 D1

```bash
npx wrangler d1 create ktv-assistant-db
npx wrangler d1 migrations apply ktv-assistant-db --remote --config wrangler.toml
```

把新 `database_id` 写入两个 Wrangler config。Local D1 可使用 `--local`；production schema change 必须通过 migration，不直接手改线上表。

### 9.3 KV

```bash
npx wrangler kv namespace create SEARCH_CACHE
```

把 namespace id 写入两个 config 的 `SEARCH_CACHE` binding。

### 9.4 YouTube API key

1. Google Cloud 创建/选择 project。
2. 启用 YouTube Data API v3。
3. 创建并限制 API key。
4. 写入两个 encrypted Worker secrets：

```bash
npx wrangler secret put YOUTUBE_API_KEY
npx wrangler secret put YOUTUBE_API_KEY --config wrangler.room.toml
```

Secret 不写入代码、README、`.env`、`.dev.vars` 或 Wrangler config。

### 9.5 Admin secrets

Main Worker 需要两个 encrypted secrets。使用者在交互式终端输入真实值；命令和文档不会输出 secret：

```bash
npx wrangler secret put ADMIN_PASSWORD --config wrangler.toml
npx wrangler secret put ADMIN_SESSION_SECRET --config wrangler.toml
```

Room Worker 不直接提供 admin 页面，因此无需复制 admin secrets。

### 9.6 Cloudflare 只读指标 token

在 Cloudflare Dashboard 为目标 account 创建自定义 API token：

- Account permission：`D1 Read`。
- Account permission：`Account Analytics Read`。
- Account resources：只包含本项目所在 account。
- 不使用 Global API Key，不添加 D1/KV/Workers 写权限。

随后仅写入 Main Worker encrypted secret：

```bash
npx wrangler secret put CLOUDFLARE_API_TOKEN --config wrangler.toml
npx wrangler secret list --config wrangler.toml
```

交互提示中只粘贴原始 token 值，不包含 token 名称、token ID、引号或 `Bearer` 前缀。更新 Secret 会生成新的 Main Worker 版本；必须再用 `wrangler deployments status --config wrangler.toml --json` 确认新版本已获得 100% 流量。

Worker 只在受保护的管理员请求中服务端调用 Cloudflare；token、account ID、database ID、namespace ID 和原始 provider response 均不会发送浏览器。D1 读取使用 Client API；KV bytes/key count 使用与 Dashboard 相同的 GraphQL Analytics dataset。

### 9.7 首次部署

```bash
npx wrangler deploy --config wrangler.room.toml --dry-run
npx wrangler deploy --config wrangler.room.toml --keep-vars
npm run build
npx wrangler deploy --keep-vars
```

确认 Main Worker bindings：

```txt
DB           -> ktv-assistant-db
SEARCH_CACHE -> SEARCH_CACHE
ROOM_OBJECT  -> RoomDurableObject, script_name = ktv-assistant-room
```

## 10. 日常部署

Main Worker/frontend only：

```bash
npm run typecheck
npm run test
npm run build
npx wrangler deploy --keep-vars
```

改到 DO/Room Worker：

```bash
npm run typecheck
npm run test
npm run build
npx wrangler deploy --config wrangler.room.toml --keep-vars
npx wrangler deploy --keep-vars
```

Room Worker 先部署；`--keep-vars` 防止覆盖 Dashboard variables/secrets。

当前 Main Worker 已连接 Cloudflare Workers Builds：push 到 production branch `main` 会自动构建并部署 Main，但不会替代 Room 的发布。因此 substantial release 仍以“先 Room、再 Main”为最终顺序；如果代码 push 已先触发 Main 自动部署，需要再按该顺序手动发布并复核最终 active versions。纯文档提交应使用 `[CI Skip]` 前缀，避免生成没有运行时变化的重复 Main 版本。

## 11. Production 测试

### 11.1 End-to-end

1. 用 production `/create` 创建 fresh room。
2. Display 打开 mobile link/QR，不覆盖 display tab。
3. Mobile 输入 `后来`，切换 song/artist 和 `带原唱` 时结果数量保持不变；只按搜索按钮时发起新搜索。
4. 确认 title-related result 高于无关 KTV。
5. 确认只有一个 preview、URL 从 30 秒开始，点击外部停止。
6. 点第一首后仍在 search，display 无刷新更新并尝试播放。
7. 再点第二首，确认第一首不被打断。
8. Refresh mobile，tab/search state 应恢复。
9. 测置顶、删除、重唱、切歌。
10. Display 测 seek、restart、pause/resume 和 next；切到第二首后进度必须为 `0:00`。
11. 让短视频自然结束，确认推进；队列空后 idle。
12. Debug 检查 snapshot 和 cleanup。

Display 专项：

- `PLAYER_STARTED` 只在实际播放后出现。
- Autoplay blocked 时提示清楚。
- 不显示画质选项；YouTube adaptive 是唯一模式，不伪装成可强制固定的 app quality API。
- 默认播放区无 app 状态提示、透明点击层或结束遮罩；native controls/fullscreen/keyboard 关闭，ENDED/error iframe 不继续显示相关推荐或错误页。
- QR 外层为紧凑暗色 card，内部保留 140px Canvas 纯黑/纯白高纠错码与白色 quiet zone，并阻止浏览器强制深色模式降低对比度；不遮挡 player。
- `实时已连接`、今日剩余额度和本地 reset 相对小时都在 footer 最左侧，不显示“正在播放”；歌名与 progress 在中间且不重叠。
- 已播放 progress 与 thumb 同为 teal，未播放部分为灰色；右侧重播、暂停/继续、下一首和队列统计有明确的 button/panel 层级。
- `/create` 在 390×844 与 1280×720 都应无横向 overflow；主标题使用受控两行，CTA 在手机首屏可见，三步说明保持简短。
- Mobile 使用固定高度深色外壳；header、搜索栏/结果标题和 footer 不参与页面滚动，只有结果容器独立滚动并保存 `scrollTop`，滚动条也只出现在结果区，卡片标签不得穿透搜索栏。
- Mobile Safari 的状态栏、浏览器上下栏和 safe-area 不应露白；长按正文/缩略图不出现蓝色选择层，搜索输入仍可选字。
- Display 空状态 footer 不显示占位歌名；Space 在页面任意非输入焦点暂停/继续，点击播放器控制键后不保留焦点圈。

### 11.2 API/search smoke

```powershell
$base = "https://ktv-assistant.bradwang1995.workers.dev"
$room = Invoke-RestMethod -Method Post -Uri "$base/api/rooms"
$roomId = $room.roomId
Invoke-RestMethod -Uri "$base/api/rooms/$roomId/snapshot"
Invoke-RestMethod -Uri "$base/api/youtube/quota"

$body = @{
  query = "后来"
  limit = 50
  searchType = "song"
  includeOriginalVocal = $false
  cacheFill = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "$base/api/rooms/$roomId/search" `
  -ContentType "application/json" `
  -Body $body
```

期望：

- New room queue empty、player idle。
- Cold search 通常 `cached=false`；repeat family `cached=true`。
- 非空 results 最多 50，UI 每次展开 10 条。
- Empty query 最多返回 200 条去重 recommendations，UI 按 10 条无限滚动，且不增加 search estimate。

### 11.3 Admin 存储指标

1. 登录 production `/admin`，点击“刷新数据”。
2. 运行 `npx wrangler d1 info ktv-assistant-db --config wrangler.toml`，对照页面 `ktv-assistant-db` 的 bytes；允许格式单位与请求时间造成少量显示差异。
3. 在 Cloudflare Dashboard 打开 `SEARCH_CACHE` 的 Metrics，对照最新 storage bytes 与 key count；KV Analytics 是日聚合，页面会显示 provider 测量日。
4. 确认 D1 来源为“Cloudflare D1 API”、KV 来源为“Cloudflare Analytics”、搜索 payload 为“应用记录估算”。
5. 未配置 `D1_CAPACITY_LIMIT_BYTES` / `KV_CAPACITY_LIMIT_BYTES` 时，页面不得显示百分比或推断 plan。
6. 未认证访问 `/api/admin/storage` 必须返回 `401` 和 `Cache-Control: no-store`。

### 11.4 WebSocket smoke

```js
const roomId = "<roomId>";
const ws = new WebSocket(
  "wss://ktv-assistant.bradwang1995.workers.dev/api/rooms/" + roomId + "/ws",
);
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "JOIN_ROOM",
    role: "mobile",
    clientId: crypto.randomUUID(),
  }));
  ws.send(JSON.stringify({ type: "PING" }));
};
ws.onmessage = (event) => console.log(JSON.parse(event.data));
```

期望 `ROOM_SNAPSHOT`、`PONG`；第二个 client 连接时 connected count 变化。再发送两次 `ADD_QUEUE_ITEM`：第一首 playing、第二首 queued；`PLAYER_ENDED` 推进；`RESTART_CURRENT_ITEM` 保持当前 item 并回到 loading。

### 11.5 Cleanup、rate limit、devices

Debug page 应能 refresh snapshot、复制链接、删除 completed/removed items。关闭所有 display/mobile/debug 页面至少 5 分钟后，snapshot 应显示 inactive、empty queue、idle playback。

Rate-limit 专项：同 room + identity 快速重复非空搜索，超限应返回 HTTP 429、`SEARCH_RATE_LIMITED` 和 `retry-after`。

| Device | 重点 |
| --- | --- |
| Mobile Safari | QR、sticky controls、preview、playsinline、queue。 |
| Android Chrome | Search、load-more、preview、sync。 |
| iPad Safari | Orientation、layout、iframe。 |
| Desktop Chrome | Autoplay、restart、seek、auto-advance。 |

通过标准：

- 创建真实 D1 room。
- Search 返回相关 candidates。
- 手机连续点歌，大屏无刷新同步。
- 多 clients snapshot 一致。
- Restart、skip、natural end 正确。
- 空队列 idle。
- Quota 可见。
- 5-minute inactivity cleanup 正确。

故障排查顺序：

1. 确认 production URL 和 fresh room。
2. 查看 Console/Network。
3. 跑 create/snapshot API smoke。
4. 跑 `JOIN_ROOM/PING`。
5. 确认最新 commit 是否真正 deploy。
6. Search 检查 secret、Google quota、KV、rate limit。
7. Sync 检查 `ROOM_OBJECT`、Room Worker、D1。
8. Autoplay/restart/pause/seek/next 必须在目标浏览器复现；YouTube 画质只验证 adaptive，不验证已废弃的强制 quality API 或已移除的手动模式。

### 11.5 Admin smoke

- 未登录 `GET /api/admin/overview` 必须返回 `401 ADMIN_UNAUTHORIZED`，且不返回任何 metrics。
- `/admin` 未登录只显示登录表单；登录后显示三段导航和真实 D1 数据。
- 搜索记录/资料库的关键词、来源/类型、排序和分页能更新表格；空数据明确说明缺少数据。
- 选择资料后必须经过 destructive confirmation；成功后表格与总览刷新，D1 `admin_audit_events` 有 success 记录。
- 清理配置缺失或容量未越线时，preview 必须明确 skipped 且不能出现执行按钮；测试环境越线时，preview 显示排序策略、候选和估算大小，确认执行后记录 success/partial/failure 与 affected count。
- 连续两个 cleanup POST 不能并发删除同一批资料；有效短期 lease 返回 `409 REPOSITORY_CLEANUP_BUSY`，过期 lease 才能接管。
- 配额必须标记为本地估算；数据库容量上限未配置时必须显示“未知”，不能从 D1 实际体积猜百分比。
- Session 过期或撤销后，下一个 admin API `401` 会清除受保护查询并返回登录状态。

## 12. 安全与内容约束

- Secrets 不 commit。
- Admin password/session secret 只存在于 Worker encrypted secrets；cookie 不写 localStorage。
- 每个 admin endpoint 独立服务端授权；mutation 同时校验 origin、输入和 bounded ids。
- D1 schema 通过 migration。
- Production 断线不伪造 command success。
- YouTube 只使用官方 embed / IFrame Player API。
- 不下载、不提取、不转码、不重新托管视频。

## 13. 官方参考

- YouTube search：<https://developers.google.com/youtube/v3/docs/search/list>
- YouTube quota：<https://developers.google.com/youtube/v3/determine_quota_cost>
- YouTube IFrame Player API：<https://developers.google.com/youtube/iframe_api_reference>
- Cloudflare D1 commands：<https://developers.cloudflare.com/d1/wrangler-commands/>
- Cloudflare D1 database details API：<https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/get/>
- Cloudflare D1 limits：<https://developers.cloudflare.com/d1/platform/limits/>
- Cloudflare KV commands：<https://developers.cloudflare.com/kv/reference/kv-commands/>
- Cloudflare KV metrics / `kvStorageAdaptiveGroups`：<https://developers.cloudflare.com/kv/observability/metrics-analytics/>
- Cloudflare GraphQL Analytics token：<https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/>
- Cloudflare Workers Builds production branches：<https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/>
- Durable Objects：<https://developers.cloudflare.com/durable-objects/get-started/>
