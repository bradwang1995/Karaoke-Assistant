# K歌助手项目进展 Tracker

Last updated: 2026-06-26

这个文件用来跟踪 `KTV_Assistant_Cloudflare_Design_Doc.md` 里的实现进度。我们后续每一轮都可以按这里的步骤推进：做一小块、验证一小块、更新一小块。

## 状态图例

- `[x]` 已完成，并且本地验证通过
- `[~]` 已有雏形，但还不是设计文档里的最终实现
- `[ ]` 未开始

## 当前项目状态

当前版本是本地可运行 MVP + 已部署的 Cloudflare Worker 后端。主应用 `ktv-assistant` 已通过 Worker + Assets 暴露在 `https://ktv-assistant.bradwang1995.workers.dev`，D1/KV/Durable Object 绑定和基础房间 API 已完成远端验证。

已实现的核心体验：

- `[x]` 创建房间入口 `/create`
- `[x]` 大屏页 `/room/:roomId/display`
- `[x]` 手机点歌页 `/room/:roomId/mobile`
- `[x]` 大屏页显示二维码，二维码指向同房间手机页
- `[x]` 手机页有「点歌」和「歌单」两个标签
- `[x]` 手机页 tab 同步到 URL，刷新后保留当前 tab
- `[x]` 模拟搜索返回 8 个候选视频
- `[x]` 候选视频使用 YouTube embed 预览
- `[x]` 用户可以选择候选视频并点歌
- `[x]` 歌单支持置顶和删歌确认
- `[x]` 大屏和手机页在同一浏览器环境里通过 `localStorage + BroadcastChannel` 同步
- `[x]` 第一首歌自动成为当前播放
- `[x]` 大屏可手动「开始 K 歌」和「下一首」
- `[x]` 基础 reducer 单元测试
- `[x]` `npm run build` 通过
- `[x]` `npm run test` 通过

明确还不是最终形态的地方：

- `[~]` 实时同步目前是本地浏览器同步，不是 Cloudflare Durable Object
- `[x]` 搜索后端已接真实 YouTube Data API，前端仍保留 mock fallback
- `[x]` 搜索结果默认返回最多 8 条，并优先排序歌名本身匹配
- `[x]` 点歌页进入时显示最多 8 条 KV 缓存推荐
- `[~]` 大屏播放器已接入 YouTube IFrame Player API 状态机；移动端预览仍使用普通 iframe
- `[x]` Cloudflare backend 已有 API router、D1 repository、Worker 入口和 Room Durable Object Worker 配置
- `[x]` 已实现 D1 repository 写法，并通过真实 Cloudflare D1 remote API 验证
- `[x]` KV namespace `SEARCH_CACHE` 已创建并完成 Worker 绑定验证
- `[x]` 已通过真实 Cloudflare runtime 验证 WebSocket 房间连接和队列命令路径
- `[x]` YouTube 搜索默认每次冷缓存填充只使用 1 个 `search.list` call，最多缓存 50 条候选，适配 50/day quota
- `[x]` 手机端点击或播放搜索候选预览时会先选中该视频
- `[x]` 大屏二维码已下移，避免遮挡 YouTube 顶部播放控件

## Phase 0 - Project Setup

设计目标：创建 React + TypeScript + Vite 项目，接入基础工具链，确保能本地开发和构建。

- `[x]` React + TypeScript + Vite
- `[x]` Tailwind CSS
- `[x]` React Router
- `[x]` Zustand
- `[x]` TanStack Query
- `[x]` QR code library
- `[x]` Wrangler config draft
- `[x]` 基础目录结构
- `[x]` `npm run dev` 可启动
- `[x]` `npm run build` 可构建
- `[x]` `npm run test` 可运行

备注：ESLint/Prettier 还没有加，当前不是 MVP 阻塞项。

## Phase 1 - Static UI Skeleton

设计目标：先把大屏页和手机页做出来，不要求真实后端。

- `[x]` `/create`
- `[x]` `/room/:roomId/display`
- `[x]` `/room/:roomId/mobile`
- `[x]` 大屏全屏布局
- `[x]` QR code overlay
- `[x]` 手机页 tabs
- `[x]` 搜索页 UI shell
- `[x]` 歌单页 UI shell
- `[x]` 中文 UI 文案

下一轮可检查：

- `[ ]` 在真实手机宽度下做一次视觉 QA
- `[ ]` 在横屏电视/电脑屏幕下做一次视觉 QA
- `[ ]` 根据实际使用感受微调按钮大小、间距和固定底部操作栏

## Extra MVP Slice - Local Usable Flow

这个不是设计文档单独列出的正式阶段，但对第一版可体验 MVP 很有价值。

- `[x]` mock 搜索接口
- `[x]` mock 候选视频生成
- `[x]` 本地房间状态 reducer
- `[x]` 本地状态持久化到 `localStorage`
- `[x]` 同浏览器多标签页同步
- `[x]` 添加歌曲
- `[x]` 置顶歌曲
- `[x]` 删除歌曲
- `[x]` 当前歌曲结束后切到下一首
- `[x]` reducer 单元测试覆盖核心队列逻辑

后续替换方向：

- `[ ]` 保留前端交互，替换底层同步实现为 Worker + Durable Object + WebSocket

## Phase 2 - Cloudflare Backend Foundation

设计目标：建立真实 Cloudflare 后端基础，让房间 snapshot 和 WebSocket 能通过 Durable Object 工作。

当前状态：

- `[x]` `wrangler.toml` 初稿
- `[x]` `wrangler.room.toml` Room Durable Object Worker 配置
- `[x]` D1 初始 migration 文件
- `[x]` Pages Function API router
- `[x]` Durable Object class snapshot shell
- `[x]` 确认最新 Wrangler Durable Object migration 写法
- `[x]` 根据 Cloudflare Pages 限制拆分 Pages config 和 Durable Object Worker config
- `[x]` `POST /api/rooms` 实现 D1 写入逻辑
- `[x]` `GET /api/rooms/:roomId/snapshot` 实现从 Durable Object 或 D1 返回真实状态
- `[x]` `GET /api/rooms/:roomId/ws` WebSocket upgrade
- `[x]` Durable Object 可从 D1 读取 room snapshot
- `[x]` Durable Object 管理 connected clients
- `[x]` 前端创建房间优先调用 API，Vite 本地模式自动 fallback 到本地房间
- `[~]` 前端 display/mobile 已接入 WebSocket hook，并可从后端 snapshot hydrate
- `[x]` 使用真实 Cloudflare D1/KV/DO 资源做远端验证

已验证的线上资源：

- 主应用 Worker + Assets：`ktv-assistant`
- 线上域名：`https://ktv-assistant.bradwang1995.workers.dev`
- Room Durable Object Worker：`ktv-assistant-room`
- D1：`ktv-assistant-db` (`a2fe987b-5191-4ac3-9d01-f923d19c731a`)
- KV：`SEARCH_CACHE` (`aedd751919314f9e81f1917e59a859bd`)

建议下一步：

1. 配置 `YOUTUBE_API_KEY` secret 后验证真实搜索结果。
2. 做真实手机/大屏浏览器联调，确认 UI 与 WebSocket hook 行为。
3. 补 WebSocket reconnect retry/backoff。

## Phase 3 - Realtime Queue

设计目标：Durable Object 成为房间状态源，所有手机和大屏实时同步同一份歌单。

当前状态：

- `[x]` 本地 reducer 已实现队列规则
- `[x]` 本地已实现 add/promote/remove/advance
- `[x]` 本地测试覆盖“不打断当前播放”的规则
- `[x]` WebSocket `JOIN_ROOM`
- `[x]` WebSocket `ROOM_SNAPSHOT`
- `[x]` WebSocket `ROOM_UPDATED` for connected-client snapshot broadcasts
- `[x]` Durable Object `ADD_QUEUE_ITEM`
- `[x]` Durable Object `PROMOTE_QUEUE_ITEM`
- `[x]` Durable Object `REMOVE_QUEUE_ITEM`
- `[x]` Durable Object `PLAYER_STARTED`
- `[x]` Durable Object `PLAYER_ENDED`
- `[x]` D1 持久化 queue changes 已通过真实 Cloudflare 资源验证
- `[x]` Durable Object restart 后从 D1 恢复
- `[ ]` 两个手机页面实时同步验证
- `[x]` 大屏和手机页面 WebSocket 同房间连接验证

建议实现方式：

1. 把现有 `roomReducer` 作为共享业务规则保留。
2. Durable Object 调用同一套 reducer 或等价逻辑。
3. 前端新增 socket hook，逐步替换 `roomState.ts` 的本地实现。

## Phase 4 - YouTube Search

设计目标：后端代理 YouTube Data API，前端永远不暴露 API key，并用 KV 做缓存。

当前状态：

- `[x]` 前端 mock search flow
- `[x]` `normalizeQuery`
- `[x]` `worker/scoring.ts` 初始评分函数
- `[x]` 搜索评分优先标题精确/前缀/包含歌名匹配，降低相关歌和频道命中权重
- `[x]` `POST /api/rooms/:roomId/search`
- `[x]` KV cache lookup
- `[x]` YouTube `search.list`
- `[x]` 可选 `videos.list` 获取 duration
- `[x]` 结果过滤和排序
- `[x]` KV cache write
- `[x]` KV recommendation pool for blank-query default recommendations
- `[x]` 前端优先调用 API search，失败时 fallback 到 mock search
- `[x]` 搜索失败友好提示
- `[x]` quota 保护策略：默认 50 calls/day，每次 cache fill 默认 1 call / 50 results
- `[x]` 使用真实 `YOUTUBE_API_KEY` 验证 YouTube result quality

建议实现方式：

1. 先保留 mock provider，做 provider interface。已完成。
2. 再接 Worker search route。已完成。
3. 最后用环境变量 `YOUTUBE_API_KEY` 打开真实 provider。已完成，并已通过 Step 9.5 远端验证。

## Phase 5 - YouTube Preview Players

设计目标：手机端显示 8 个候选视频，静音，从约 30 秒开始预览。

当前状态：

- `[x]` 显示 8 个候选卡片
- `[x]` 进入点歌页时显示缓存推荐
- `[x]` 每个候选卡片有 YouTube iframe
- `[x]` iframe URL 设置 `start=30`
- `[x]` iframe URL 设置 `mute=1`
- `[x]` 可以选择候选视频
- `[x]` 点击或播放候选视频预览时会先选中该候选
- `[x]` 选中态边框
- `[x]` 点歌按钮
- `[~]` 响应式布局已做基础版
- `[ ]` 使用 YouTube IFrame Player API 精确控制预览
- `[ ]` 移动端 autoplay 行为实机测试
- `[ ]` `playsinline` 行为实机确认
- `[ ]` iframe 加载失败兜底

## Phase 6 - Display Playback

设计目标：大屏负责播放当前歌曲，歌曲结束后通知房间并自动切下一首。

当前状态：

- `[x]` 大屏显示当前歌曲
- `[x]` 没有歌曲时显示「当前没有视频播放」
- `[x]` 大屏 YouTube IFrame Player API 播放当前视频
- `[x]` 手动「开始 K 歌」
- `[x]` 手动「下一首」
- `[x]` YouTube IFrame Player API loader
- `[x]` 监听 `onStateChange`
- `[x]` 自动发送 `PLAYER_STARTED`
- `[x]` 自动发送 `PLAYER_ENDED`
- `[x]` 自动切下一首并播放
- `[x]` 播放控制栏移到 YouTube iframe 外，避免遮挡进度条
- `[x]` `开始 K 歌` 点击路径直接请求播放器播放，并保留自动播放重试
- `[x]` 播放失败兜底 UI
- `[ ]` 浏览器 autoplay 限制下的真实设备测试

## Phase 7 - Polish and Reliability

设计目标：让真实聚会场景更稳、更舒服。

- `[x]` WebSocket reconnect retry/backoff
- `[x]` loading states 统一
- `[x]` error states 统一
- `[x]` duplicate song warning
- `[x]` copy room link button polish
- `[x]` debug page `/room/:roomId/debug`
- `[x]` basic room cleanup endpoint `POST /api/rooms/:roomId/cleanup`
- `[x]` search rate limiting
- `[x]` mobile tab URL state
- `[x]` display mobile link opens in a new browser tab
- `[x]` YouTube API 使用说明或 footer
- `[x]` search cache fill defaults to one YouTube search call and 50 cached results
- `[x]` display QR code offset avoids the YouTube top-right playback/settings area
- `[~]` 移动端 Safari 测试：测试清单已补，待实机验收
- `[~]` Android Chrome 测试：测试清单已补，待实机验收
- `[~]` iPad Safari 测试：测试清单已补，待实机验收
- `[~]` Desktop Chrome 测试：测试清单已补，待实机验收

## Testing Progress

- `[x]` Unit test: add first song starts playback
- `[x]` Unit test: adding/promoting does not interrupt current song
- `[x]` Unit test: remove queued song
- `[x]` Unit test: player ended advances queue
- `[x]` Build: `npm run build`
- `[x]` Test: `npm run test`
- `[x]` Production dependency audit: `npm audit --omit=dev`
- `[x]` Remote smoke test: `POST /api/rooms` on `ktv-assistant.bradwang1995.workers.dev`
- `[x]` Remote smoke test: `GET /api/rooms/:roomId/snapshot` on `ktv-assistant.bradwang1995.workers.dev`
- `[x]` Remote WebSocket test: `JOIN_ROOM`, `PING`, connected-client broadcast
- `[x]` Remote WebSocket queue test: add, promote, remove, player ended idle
- `[x]` Remote WebSocket queue test: player ended advances to next queued song
- `[x]` Remote search test: real YouTube results and repeat-query KV cache hit
- `[ ]` Worker route tests
- `[ ]` Durable Object integration tests
- `[x]` WebSocket message unit tests
- `[x]` Room command unit tests
- `[x]` WebSocket runtime integration tests
- `[x]` Search rate-limit unit tests
- `[ ]` Playwright E2E test
- `[~]` Manual QR scan / device matrix documented in `testing.md`

## Recommended Next Iterations

### Iteration 1 - Backend room snapshot

Goal: Cloudflare backend can create a room and return a real room snapshot.

- `[x]` Clean up API route structure
- `[x]` Implement shared backend types
- `[x]` Implement room creation in API
- `[x]` Persist created room to D1
- `[x]` Implement snapshot endpoint
- `[x]` Add minimal tests or local verification notes
- `[x]` Cloudflare resource ids 已替换为真实值
- `[x]` Manually verify deployed Worker with real Cloudflare resources

Note: The project now uses `wrangler.toml` for the main Worker + Assets app and `wrangler.room.toml` for the separate Durable Object Worker. The verified production URL is `https://ktv-assistant.bradwang1995.workers.dev`.

### Iteration 2 - Durable Object WebSocket

Goal: display and mobile can connect to the same room Durable Object.

- `[x]` Implement WebSocket upgrade route
- `[x]` Implement `JOIN_ROOM`
- `[x]` Send initial `ROOM_SNAPSHOT`
- `[x]` Track connected clients
- `[x]` Add safe frontend WebSocket hook with local fallback
- `[x]` Add reconnect retry/backoff
- `[x]` Runtime-test WebSocket with real Cloudflare bindings

### Iteration 3 - Durable Object queue operations

Goal: real-time queue operations move from local storage to backend source of truth.

- `[x]` Implement `ADD_QUEUE_ITEM`
- `[x]` Implement `PROMOTE_QUEUE_ITEM`
- `[x]` Implement `REMOVE_QUEUE_ITEM`
- `[x]` Implement `PLAYER_STARTED`
- `[x]` Implement `PLAYER_ENDED`
- `[x]` Broadcast `ROOM_UPDATED`
- `[x]` Persist queue operations to D1 in code
- `[x]` Frontend uses WebSocket commands when connected
- `[x]` Frontend keeps local fallback when WebSocket is unavailable
- `[x]` Verify persistence and broadcasts against real Cloudflare bindings

### Iteration 4 - Search API

Goal: replace mock search with backend search provider while keeping mock available for local/dev.

- `[x]` Define search provider interface
- `[x]` Keep mock provider for dev/test
- `[x]` Implement YouTube provider
- `[x]` Implement KV cache
- `[x]` Add scoring/ranking tests
- `[x]` Switch frontend to API search with mock fallback
- `[x]` Configure `YOUTUBE_API_KEY` secret in Cloudflare Workers
- `[x]` Runtime-test search with real YouTube Data API

### Iteration 5 - Player API

Goal: display page detects playback events and advances automatically.

- `[x]` Add YouTube IFrame API loader
- `[x]` Build `FullscreenPlayer` component
- `[x]` Send `PLAYER_STARTED`
- `[x]` Send `PLAYER_ENDED`
- `[x]` Handle player errors
- `[~]` Test auto-advance in browser

### Iteration 6 - Visual QA and party-readiness

Goal: make the MVP comfortable enough for a real small gathering.

- `[~]` Phone portrait QA documented, awaiting real-device pass
- `[~]` Landscape display QA documented, awaiting real-device pass
- `[x]` Better loading/error UI
- `[x]` Room link copy polish
- `[x]` Duplicate song warning
- `[x]` Reconnect polish
- `[x]` Debug page and cleanup endpoint
- `[x]` Search rate limiting

## Current Commands

Local development:

```bash
npm install
npm run dev
```

Verification:

```bash
npm run build
npm run test
npm audit --omit=dev
```

Cloudflare remote verification:

```bash
npx wrangler versions view aa11f04a-2b42-442a-accc-813740cc9709 --json
npx wrangler versions view 0df7e1b2-7a47-4ab5-a14f-b38d90b09e9e --config wrangler.room.toml --json
curl -X POST https://ktv-assistant.bradwang1995.workers.dev/api/rooms
curl https://ktv-assistant.bradwang1995.workers.dev/api/rooms/<roomId>/snapshot
curl -X POST https://ktv-assistant.bradwang1995.workers.dev/api/rooms/<roomId>/cleanup
```

Remote Step 7/8, Step 8.5, Step 8.6, Step 9.5, production testing docs, search quota polish, candidate selection polish, and QR overlay polish were updated through 2026-06-26.

## Notes

- We are staying on the local `main` branch.
- Do not edit files outside `C:\Brad Wang\Repos\K歌助手` for implementation work.
- The first MVP intentionally prioritizes a usable local flow before replacing the local state layer with Cloudflare infrastructure.
- YouTube content must remain embedded only. Do not download, extract, transcode, or re-host YouTube videos.
