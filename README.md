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

当前核心体验：

- 第一首歌自动成为 `playing`；后续歌曲 `queued`，不会打断当前播放。
- Mobile 支持 `歌名 / 歌手`、会立即重搜的 `带原唱`、默认推荐、从 30 秒开始的单个轻量 preview 和缓存内无限滚动。
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
| D1 `DB` | 房间、队列和 playback persistence。 |
| KV `SEARCH_CACHE` | Search family cache、index、推荐、rate limit、quota estimate。 |
| YouTube APIs | Worker-only search 和官方 iframe playback。 |

### 2.1 房间数据流

创建房间：

1. Frontend 根据浏览器可公开的平台信息生成友好房间名，并用 `POST /api/rooms` 提交；浏览器不会读取真实电脑名或 Chrome Profile 名。
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
| `YOUTUBE_SEARCH_DAILY_LIMIT` | `50` | Project search-call guardrail。 |
| `YOUTUBE_SEARCH_MAX_CALLS_PER_FILL` | `1` | 每个 cold family 最多一次 search。 |
| `SEARCH_CACHE_TTL_DAYS` | `365` | KV cache TTL。 |
| `SEARCH_CACHE_MAX_ENTRY_BYTES` | `524288` | Family payload 上限约 512 KiB。 |
| `SEARCH_RATE_LIMIT_PER_MINUTE` | `20` | Room + identity search rate limit。 |

Google 当前文档的默认 `search.list` bucket 是 100 calls/day、每次计 1 call；本项目主动限制为 50/day。实际平台上限以 Google Cloud Console 为准，项目变量只控制 app guardrail 和 estimate。

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
- 排序先保证 title/artist 相关，再考虑 KTV、伴奏、lyrics 和原唱意图。
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

所以 song/artist、伴奏/原唱和明确 artist 的结果不会错误共享同一 family。

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

Artist mode 使用 artist-oriented `ktv / karaoke / classic songs` 或 `lyrics / MV / official`。Aliases 以 `|` 合成最多 450 characters 的 broad query；hot path 使用第一条 source query，无需在 request 中调用 LLM。

### 6.4 Live fetch pipeline

1. Read KV family/index cache。
2. Read quota estimate，决定 allowed search calls。
3. `search.list` 使用 `type=video`、`maxResults=50`、`videoEmbeddable=true`、`safeSearch=moderate`、`regionCode=CA`、`relevanceLanguage=zh-Hans`。
4. Deduplicate by `videoId`。
5. `videos.list(part=contentDetails)` 读取 duration，每 50 ids 一批。
6. 针对 current user query 排序。
7. 写 family cache、normalized indexes 和 recommendation pool。
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
| Channel-only match | +2 |
| Song title miss | -72 |
| Artist in title/channel | +42 / +32 |
| KTV / 卡拉OK / karaoke | 普通 KTV intent：+30 / +30 / +24 |
| 伴奏 / instrumental | 普通 KTV intent：+20 / +16；原唱 intent：-30 / -28 |
| Lyric video / lyrics / 歌词 | Secondary positive |
| Original / 原唱 / MV / official | 原唱 intent：+34 / +38 / +24 / +20；普通 intent 会降权 |
| Live、现场、reaction、cover | Downrank |
| Remix、tutorial、教学、shorts | Downrank |
| Duration < 60s 或 > 15min | Downrank |

带 low-priority marker 的 title 即使命中 query，也只拿较低 title score。`带原唱` 会自动发起同 query 的新请求，family、source query 和正负权重都会变化；Result 保留 `score` 和 `reasons` 供 test/debug。

关键 regression：搜索 `依赖` 时，`离开我的依赖` 的 KTV/lyrics/伴奏必须高于标题无关的 `唯一` KTV。

### 6.6 KV cache

Keys：

```txt
yt-search:v3:<familyHash>:CA:zh-Hans
yt-search-index:v1:<normalizedQuery>:CA:zh-Hans
yt-search-recommendations:v1:CA:zh-Hans
yt-search-quota:v1:<Pacific-date>
```

Family entry 保存：

- Canonical/normalized query、artist、type、vocal intent、aliases、hash。
- Created/expiry timestamps 和 source queries。
- 最多 50 条 results。
- Search/videos call counts、payload bytes、pruned count。
- Hit count 和 last accessed time。

读取先查 normalized index，再 fallback 到 family hash。Cache hit 会按当前 query 重新打分、增加 hit count，但不延长原 expiry。

写入先限制 50 条，再测 UTF-8 JSON bytes；超过 512 KiB 时从尾部裁剪。默认 TTL 365 天。Search cache 可重建，因此不写 D1。

### 6.7 Recommendations、quota、rate limit

- 每次成功写 family 时合并 recommendation pool，按 video id 去重，保留最多 200 条；mobile 首批显示 10 条并自动按 10 条扩展。
- Recommendation key 不存在或不足时，会从最近 family entries 合并 fallback，因此旧的 40 条 pool 也能继续扩展。
- Project guardrail：50 search calls/day、1 call/cold fill。
- Quota day 按 `America/Los_Angeles`，PT 午夜重置。
- `GET /api/youtube/quota` 返回 remaining/reset；display 只显示简洁的本地相对倒计时（`本地重置还有 N 小时`），不暴露 GMT 或 IANA 时区文本。
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

### 6.9 后续 search 方向

- 根据真实 hit rate 决定 exact query、song family 或 artist catalog 的 cache boundary。
- 用 curated/offline tooling 增加中文别名、拼音、英文名和 typo。
- 增加 cache age、hits、payload、quota drift 的 admin visibility。
- 决定是否提供显式 prewarm。
- 按实际 KV limits/cost 设计 eviction。
- 若增加多 source-query，仍受 daily/per-fill caps 限制。

## 7. YouTube preview 与 display player

Mobile preview：

- 手机竖屏默认两列，较宽/横屏为 3–4 列；card 只保留视频画面和不溢出的状态标签。
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
- 不显示画质 selector 或手动模式；display 和 preview 均由 YouTube 根据网络、设备与 viewport 自动选择画质。
- Google 已明确 `setPlaybackQuality`、`getPlaybackQuality` 和 `getAvailableQualityLevels` 不再支持，`suggestedQuality/vq` 也会被忽略；项目不提供假的固定 360p/720p/1080p 选项。
- `modestbranding` / `showinfo` 已失效，`rel=0` 也只能把相关推荐限制到同一频道；Google 还禁止用 overlay/frame 遮挡嵌入播放器。因此 app 只能关闭受支持的 controls、避免 hover，并在 ENDED/error 后隐藏整个 iframe，不能合规地强行抹掉所有 YouTube 自有 UI。

官方说明：<https://developers.google.com/youtube/iframe_api_reference#october-24,-2019>、<https://developers.google.com/youtube/player_parameters>、<https://developers.google.com/youtube/terms/required-minimum-functionality>

## 8. Cloudflare 手动配置

当前 production 资源已经创建。以下用于新环境、恢复或迁移。

### 8.1 登录

```bash
npx wrangler login
npx wrangler whoami
```

### 8.2 D1

```bash
npx wrangler d1 create ktv-assistant-db
npx wrangler d1 execute ktv-assistant-db --file ./migrations/0001_initial.sql --remote
```

把新 `database_id` 写入两个 Wrangler config。Local D1 可使用 `--local`；production schema change 必须通过 migration，不直接手改线上表。

### 8.3 KV

```bash
npx wrangler kv namespace create SEARCH_CACHE
```

把 namespace id 写入两个 config 的 `SEARCH_CACHE` binding。

### 8.4 YouTube API key

1. Google Cloud 创建/选择 project。
2. 启用 YouTube Data API v3。
3. 创建并限制 API key。
4. 写入两个 encrypted Worker secrets：

```bash
npx wrangler secret put YOUTUBE_API_KEY
npx wrangler secret put YOUTUBE_API_KEY --config wrangler.room.toml
```

Secret 不写入代码、README、`.env`、`.dev.vars` 或 Wrangler config。

### 8.5 首次部署

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

## 9. 日常部署

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

## 10. Production 测试

### 10.1 End-to-end

1. 用 production `/create` 创建 fresh room。
2. Display 打开 mobile link/QR，不覆盖 display tab。
3. Mobile 搜 `后来`，测试 song/artist 和 `带原唱`。
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
- Mobile 使用固定高度外壳；header、搜索栏/结果标题和 footer 不参与页面滚动，只有结果容器独立滚动并保存 `scrollTop`，卡片标签不得穿透搜索栏。

### 10.2 API/search smoke

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

### 10.3 WebSocket smoke

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

### 10.4 Cleanup、rate limit、devices

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

## 11. 安全与内容约束

- Secrets 不 commit。
- D1 schema 通过 migration。
- Production 断线不伪造 command success。
- YouTube 只使用官方 embed / IFrame Player API。
- 不下载、不提取、不转码、不重新托管视频。

## 12. 官方参考

- YouTube search：<https://developers.google.com/youtube/v3/docs/search/list>
- YouTube quota：<https://developers.google.com/youtube/v3/determine_quota_cost>
- YouTube IFrame Player API：<https://developers.google.com/youtube/iframe_api_reference>
- Cloudflare D1 commands：<https://developers.cloudflare.com/d1/wrangler-commands/>
- Cloudflare KV commands：<https://developers.cloudflare.com/kv/reference/kv-commands/>
- Durable Objects：<https://developers.cloudflare.com/durable-objects/get-started/>
