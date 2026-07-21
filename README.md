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
- Mobile 支持 `歌名 / 歌手`、`带原唱`、默认推荐、从 30 秒开始的单个轻量 preview 和缓存内无限滚动；只有提交搜索按钮才会请求，输入和筛选变化不会擅自刷新结果。
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
| Secret | `YOUTUBE_API_KEY`，已配置在两个 Worker |

Main Worker bindings：

```txt
DB           -> ktv-assistant-db
SEARCH_CACHE -> SEARCH_CACHE
ROOM_OBJECT  -> RoomDurableObject in ktv-assistant-room
```

Room Worker 使用相同 D1/KV，并通过 `[[migrations]]` 创建 `RoomDurableObject`。`workers_dev = false`，不需要独立 public URL。

GitHub repository 与 Cloudflare Worker 独立命名。仓库已改名为 `Karaoke-Assistant`，但 Main Worker 继续使用 `ktv-assistant`，因此现有 production URL、D1、KV、Durable Object 和 secrets 不需要迁移。项目通过 Wrangler 手动部署，没有 Cloudflare Git integration；更新 Git remote 或 `git push` 不会触发 deploy。

Runtime variables：

| Variable | Value | 作用 |
| --- | ---: | --- |
| `YOUTUBE_SEARCH_DAILY_LIMIT` | `100` | Project `search.list` call guardrail。 |
| `YOUTUBE_SEARCH_MAX_CALLS_PER_FILL` | `1` | 每个 cold family 最多一次 search。 |
| `SEARCH_CACHE_TTL_DAYS` | `365` | KV cache TTL。 |
| `SEARCH_CACHE_MAX_ENTRY_BYTES` | `524288` | Family payload 上限约 512 KiB。 |
| `SEARCH_RATE_LIMIT_PER_MINUTE` | `20` | Room + identity search rate limit。 |
| `ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE` | `5` | 单一 IP 每分钟管理员登录尝试上限。 |
| `SEARCH_REPOSITORY_CAPACITY_BYTES` | 未设置 | 可选；已知数据库容量，未设置时 UI 必须显示“未知”。 |
| `SEARCH_REPOSITORY_WARNING_THRESHOLD_PERCENT` | 未设置 | 可选；已知容量下的预警百分比，必须在 `0–100` 之间。 |

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
| `GET` | `/api/admin/searches` | 受保护的搜索事件筛选和分页。 |
| `GET / DELETE` | `/api/admin/repository` | 受保护的资料库检查和最多 50 条的选择删除。 |

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

Search 的目标不是每次只返回少量临时结果，而是用一次 cold request 建立可复用、可重新排序的 KTV candidate pool。

### 6.1 目标与约束

- API key 只存在于 Worker secret。
- Cold search family 默认只发一次 `search.list`。
- 一次最多取 50 个 embeddable candidates，去重、补 duration、打分、缓存。
- 非空搜索 UI 最多取 50，先显示 10，再按 10 条从当前 response 展开。
- 空查询 recommendation pool 聚合最多 200 条，并按 10 条自动扩展到缓存耗尽。
- Cache hit、空查询推荐和 client-side load-more 不增加 search call。
- 歌名模式先过滤 title 不相关结果；其余排序先保证 title/artist 相关，再考虑 KTV、伴奏、lyrics 和原唱意图。
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
- `cacheMeta`：search calls、cached count、videos calls、source queries、pruned count 和 quota snapshot。

### 6.3 Query family

`buildSearchQueryFamily`：

1. Normalize case/spacing。
2. 反复移除结尾 `ktv`、`karaoke`、`instrumental`、`pinyin`、`伴奏`、`卡拉OK`。
3. 用 canonical query、artist、type 和 vocal intent 生成稳定 hash。
4. 生成 aliases、normalized query 和 source queries。

Hash input：

```txt
canonicalQuery | artist | searchType | original-or-karaoke
```

所以 song/artist、伴奏/原唱和明确 artist 各有独立 family；歌名模式会显式合并同一 canonical song 的 KTV/原唱历史候选，再按当前 intent 重排，避免切换原唱时浪费 search call 或换成无关结果。

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

Song mode 的第一条 source query 是精确 canonical song title，确保一次 50-result fill 建立稳定的混合 candidate pool；KTV、artist 和 broad OR aliases 只作为后续 fallback。Artist mode 保持 artist-oriented `ktv / karaoke / classic songs` 或 `lyrics / MV / official` broad query。无需在 request 中调用 LLM。

### 6.4 Live fetch pipeline

1. Read KV family/index cache。
2. Read quota estimate，决定 allowed search calls。
3. `search.list` 使用 `type=video`、`maxResults=50`、`videoEmbeddable=true`、`safeSearch=moderate`、`regionCode=CA`、`relevanceLanguage=zh-Hans`。
4. Deduplicate by `videoId`。
5. `videos.list(part=contentDetails)` 读取 duration，每 50 ids 一批。
6. 歌名模式过滤 title miss / channel-only hit，再针对 current user query 和 vocal intent 排序。
7. 写 family cache、intent-scoped normalized indexes 和 recommendation pool。
8. 返回 requested slice，非空搜索最多 50 条。

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
| Lyric video / lyrics / 歌词 | Secondary positive |
| Original / 原唱 / MV / official | 原唱 intent：+34 / +38 / +24 / +20；普通 intent 会降权 |
| Live、现场、reaction、cover | Downrank |
| Remix、tutorial、教学、shorts | Downrank |
| Duration < 60s 或 > 15min | Downrank |

带 low-priority marker 的 title 即使命中 query，也只拿较低 title score。`带原唱` 会改变下一次显式提交搜索使用的正负权重；歌名模式复用并合并同一 canonical song 的两个 intent family，歌手模式继续使用各自 family。切换本身不请求或清空当前结果；Result 保留 `score` 和 `reasons` 供 test/debug。

关键 regression：搜索 `依赖` 时，`离开我的依赖` 的 KTV/lyrics/伴奏必须高于标题无关的 `唯一` KTV。

### 6.6 KV cache

Keys：

```txt
yt-search:v3:<familyHash>:CA:zh-Hans
yt-search-index:v2:<song-or-artist>:<karaoke-or-original>:<artist-scope>:<normalizedQuery>:CA:zh-Hans
yt-search-recommendations:v1:CA:zh-Hans
yt-search-quota:v1:<Pacific-date>
```

Family entry 保存：

- Canonical/normalized query、artist、type、vocal intent、aliases、hash。
- Created/expiry timestamps 和 source queries。
- 最多 50 条 results。
- Search/videos call counts、payload bytes、pruned count。
- Hit count 和 last accessed time。

读取先查精确 family hash，再 fallback 到 type/vocal-intent/artist 隔离的 normalized index，并验证 entry scope。歌名 cache hit 会按固定顺序合并同一 canonical song 的 KTV/原唱 family、按当前 intent 重新打分并过滤无关 title；命中的 family 增加 hit count，但不延长原 expiry。

写入先限制 50 条，再测 UTF-8 JSON bytes；超过 512 KiB 时从尾部裁剪。默认 TTL 365 天。Search cache 可重建，因此不写 D1。

### 6.7 Recommendations、quota、rate limit

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

### 6.8 Mobile search state

每个 room 的 localStorage state 保留 24 小时：

- Query、type、original-vocal toggle。
- Full response cache 和 visible count（10–50）。
- Selected result、active preview、scroll。
- Search/queue tab URL state。

继续加载只扩展当前 response。切 tab、refresh 或连续点歌都应保留上下文。

输入 query、切换歌名/歌手或打开/关闭原唱只更新草稿条件，不改变当前标题、数量和结果；按搜索按钮或键盘 Search/Enter 才提交。请求进行中保留旧结果，成功后一次性替换，避免数量在输入或 loading 中跳动。

### 6.9 后续 search 方向

- 根据真实 hit rate 决定 exact query、song family 或 artist catalog 的 cache boundary。
- 用 curated/offline tooling 增加中文别名、拼音、英文名和 typo。
- 增加 cache age、hits、payload、quota drift 的 admin visibility。
- 决定是否提供显式 prewarm。
- 按实际 KV limits/cost 设计 eviction。
- 若增加多 source-query，仍受 daily/per-fill caps 限制。

## 7. 管理控制台与持久搜索资料库

### 7.1 当前首版范围

管理页面采用精简的三段导航：`总览`、`搜索记录`、`资料库`。首版只包含运营必需能力：

- 单管理员密码登录；服务端验证 `ADMIN_PASSWORD`，使用 `ADMIN_SESSION_SECRET` 签发 12 小时、`Secure`、`HttpOnly`、`SameSite=Strict` cookie。
- 所有 admin read/mutation API 独立校验 session；前端路由隐藏与否不参与授权判断。
- 登录端点按 IP 限流；admin mutation 额外校验 same-origin；错误响应与 admin 数据均使用 `Cache-Control: no-store`。
- 总览展示本地耐久 quota ledger 的使用量、剩余量、Pacific reset 倒计时、D1 实际体积、持久查询/结果/复用计数、趋势、热门歌曲/歌手和原唱分类状态。
- 搜索记录支持 `24 小时 / 7 天 / 30 天`、关键词、来源、分页；历史从 migration 上线后的新事件开始，不伪造 backfill。
- 资料库支持关键词、查询类型、排序、分页、结果标题预览、最多 50 条选择删除和确认对话框。
- 删除同时移除对应 D1 entry 与 KV 加速 key，并写 `admin_audit_events`；不提供 raw `TRUNCATE`。

本批次明确不包含 automated search、趋势抓取、semantic/fuzzy related-query matching、自动容量清理或多角色权限系统。这些属于后续阶段。

### 7.2 D1 数据与复用路径

`migrations/0002_admin_console.sql` 新增：

- `search_repository_entries`：精确 query family 的持久 response JSON、结果数、估算 bytes、reuse count 和时间戳；没有 TTL 字段。
- `search_events`：原始/规范化查询、歌曲/歌手、原唱三态、来源、结果数、成功状态和 `human/admin/automation` origin。
- `youtube_quota_daily`：按 Pacific quota day 聚合的耐久 search-call ledger；D1 原子 upsert，KV 只在 D1 异常时 fallback。
- `admin_audit_events`：删除 action、目标 ids、影响条数、success/failure 和时间。

用户搜索顺序：

1. 使用现有 deterministic query family 规范化策略查 D1 exact match。
2. 命中时更新 `access_count/last_accessed_at`，返回 `responseSource=repository`，不调用 YouTube。
3. D1 miss 时可读取旧 KV family 作为兼容加速；有效 KV 结果会写回 D1。
4. 完全 miss 才调用 YouTube（或 local mock），把结果写入 D1；KV 仍保留 365 天 TTL，但只是可丢失的加速/推荐层。
5. API route 记录 human search event 与 response source，供 admin 聚合。

如果 D1 暂时不可用，公开搜索会记录结构化错误并沿用 KV/live path，不因为 admin instrumentation 让用户搜索整体失败。

### 7.3 容量与 quota 语义

- `databaseBytes` 使用 D1 statement metadata 的 `size_after`，代表整个 D1 database，而不是只计算资料记录。
- `estimatedRepositoryBytes` 是 application payload estimate，只用于资料内部分析，不冒充 provider capacity。
- 百分比只有在明确配置 `SEARCH_REPOSITORY_CAPACITY_BYTES` 时计算；没有可靠上限时显示“容量未知”。
- 可选 `SEARCH_REPOSITORY_WARNING_THRESHOLD_PERCENT` 只负责预警；首版坚持 manual-first，不自动删除资料。
- YouTube 页面值标记为 `local_estimate / search_calls`。当前 project guardrail 为 100 calls/day、一次 `search.list` 计一次；Google Cloud Console 仍是最终权威。

### 7.4 本地管理员验证

`.dev.vars` 已被 `.gitignore` 排除。开发者本地创建：

```dotenv
ADMIN_PASSWORD="仅用于本机的密码"
ADMIN_SESSION_SECRET="足够长且随机的本机 session secret"
```

然后使用完整 Worker runtime，而不是只跑 Vite：

```bash
npx wrangler d1 migrations apply ktv-assistant-db --local --config wrangler.toml
npm run build
npx wrangler dev --local --config wrangler.toml
```

打开 `http://127.0.0.1:8787/admin`。生产环境必须通过 `wrangler secret put` 或 Dashboard encrypted secret 配置两个值，绝不写入 Git。

## 8. YouTube preview 与 display player

Mobile preview：

- 手机竖屏默认两列，较宽/横屏为 3–4 列；每张 card 在视频下方显示两行以内的歌名，不显示 uploader/channel。
- Mobile 使用与 display 连续一致的 slate/teal 深色背景，`theme-color`、`color-scheme`、HTML/body 和 safe-area 都保持深色，避免 Safari 顶部状态栏、底部地址栏或结果区露出白带。
- 选择后 debounce 600ms；快速切换会取消旧 preview，只有 active card 挂载 iframe。
- Pending/加载阶段显示 spinner；10 秒仍未加载会显示可重试提示；点击外部停止。
- Preview 固定请求从 30 秒开始，并通过专用 URL helper 和回归测试保护；mute、autoplay、playsinline，画质由 YouTube 自适应。
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

### 9.6 首次部署

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

Room Worker 先部署；`--keep-vars` 防止覆盖 Dashboard variables/secrets。`git push` 不等于 deploy；纯文档更新不 redeploy。

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

### 11.3 WebSocket smoke

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

### 11.4 Cleanup、rate limit、devices

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
- Cloudflare KV commands：<https://developers.cloudflare.com/kv/reference/kv-commands/>
- Durable Objects：<https://developers.cloudflare.com/durable-objects/get-started/>
