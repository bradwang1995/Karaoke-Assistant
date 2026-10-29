# KTV Assistant（K歌助手）

一个面向朋友聚会的 Web KTV 点歌助手：大屏负责播放，手机负责扫码点歌，同一房间通过 Cloudflare Worker、Durable Object 和 WebSocket 实时同步。

Repository: <https://github.com/bradwang1995/Karaoke-Assistant>

Production: <https://ktv-assistant.bradwang1995.workers.dev>

项目文档：

- `README.md`：产品、总体架构、手动配置、部署和通用测试。
- `SEARCH.md`：搜索算法、缓存、推荐、额度、两秒体验和变更协议的唯一当前规范。
- `PROGRESS.md`：实现状态、历史修复、验证记录和待办。

## 1. 产品与使用流程

1. 主持人在 `/create` 创建房间。
2. 浏览器进入 `/room/:roomId/display`，作为电脑、电视或投影大屏。
3. 参与者扫描二维码进入 `/room/:roomId/mobile`。
4. 手机搜索、预览并点歌；Durable Object 持久化并广播新 snapshot。
5. 大屏用 YouTube IFrame Player API 播放；结束、重唱或切歌会同步到房间。

| Route | 用途 |
| --- | --- |
| `/` | 中英文产品介绍首页；从此进入 `/create`。 |
| `/setup` | 独立家庭 KTV 设备指南，不加载 YouTube 播放器或搜索数据。 |
| `/privacy`、`/terms` | 中英文隐私政策与条款草稿，运营者资料待补充。 |
| `/create` | 创建房间。 |
| `/room/:roomId/display` | 播放、可收起并随时重新展开的二维码、重播、暂停/继续、下一首、seek 和 quota。 |
| `/j/:roomId` | 二维码专用短入口，直接进入同一房间手机点歌页。 |
| `/room/:roomId/mobile` | 搜索、preview、点歌和队列管理。 |
| `/room/:roomId/debug` | Snapshot、房间链接和 cleanup。 |
| `/admin` | 单管理员登录后的搜索、配额与持久资料库总览。 |
| `/admin/searches` | 搜索事件筛选、分页与来源检查。 |
| `/admin/repository` | 持久查询资料检查、排序、分页和安全删除。 |

当前核心体验：

- 第一首歌自动成为 `playing`；后续歌曲 `queued`，不会打断当前播放。
- Mobile 支持 `歌名 / 歌手 / URL`、`带原唱`、高分缓存推荐、固定 200×200px、从 30 秒开始、静音且由用户主动启动的单个 preview 和缓存内无限滚动；头部的“K歌助手 / K歌房”同行显示，原唱开启时只有内部 toggle 变绿；搜索 pending 只更新固定高度状态，不插入等待 panel；只有提交搜索按钮才会请求，输入和筛选变化不会擅自刷新结果。
- URL 点歌：选择 `URL` 后，输入框提示 `YouTube视频链接`，输入单视频链接并提交；支持 `watch`、`youtu.be`、`shorts`、`live` 和 `embed` 等链接，隐藏原唱选项，无效输入在提交前提示。沿用现有 preview/点歌卡片，不消耗搜索次数，搜索额度耗尽仍可使用（视频 metadata 可能调用一次 `videos.list`）。
- Search query、模式、结果、选中项、preview、scroll 和 tab 可恢复 24 小时。
- 搜索比较识别简繁歌名/歌手，保留既有排序；原始候选缓存完整保存，公开结果保守隐藏明确非音乐项，音乐版本与信息不足项优先保留。首页只收明确音乐且与查询相关的合格项，不足数量不补弱结果。当前规则见 `SEARCH.md` 第 6–8 节；本轮回退基线见 `docs/SEARCH_BASELINE_2026-10-27.md`。
- 点歌后保留搜索上下文；歌单支持置顶、删除、重唱和切歌。待播项使用紧凑单行 card，不重复显示“第 N 首”；置顶/删歌先在本地乐观更新，再由房间 snapshot 确认。超长歌名会在卡片内换行且不会产生横向滚动。
- Display 自动尝试播放，提供 app-owned progress/seek、重播、暂停/继续和下一首；任何新 queue item 都严格从 0 秒开始。
- Display 与手机预览同时允许 YouTube 原生控件、键盘、全屏及链接交互；KTV 自有控制保留。语言切换在底栏最左侧、连接状态左边，采用“中、EN”两行竖排、不显示斜线；其他页面继续横排。右侧扫码按钮中文逐字竖排、英文 Scan / to / join 逐词换行，默认收起，点击或键盘 Enter/Space 切换 72px 二维码（含按用户要求缩小为 2 格的白边，低于通常 4 格建议，需实际扫码确认）；扫码按钮收起时只显示竖排文字、不显示箭头；展开后显示二维码，按钮只保留 24px 向右箭头用于收起，不再显示扫码文字，默认无边框和底色、左右 padding 为 2px，悬停时与语言按钮一致显示半透明背景和阴影，悬停标题提示展开/收起；二维码采用同源 `/j/:roomId` 短链接减少信息量，保留 M 纠错等级；展开时通过局部负 margin 去掉底栏额外上下留白，72px 图像上下距 74px 底栏边缘各约 1px，右侧零外部间隙、2px 轻微圆角，不遮挡播放器或增加底栏高度。桌面正常状态底栏保持至少 74px，Replay / Play / Pause / Resume / Next 保留文字与 40px 按钮，标题/进度区域收窄，Up Next 为 110px。小二维码的实际扫描距离需手机验收。
- YouTube 原生控件的自动显隐由 YouTube 自己管理，应用不强制常显或遮挡控件，也不使用已废弃的 autohide 参数。暂停、焦点及播放器自身状态可能影响显示；不能保证所有浏览器或视频的表现相同。
- YouTube iframe 在加载前配置 sandbox：允许正常脚本、同源存储、表单、投屏及独立弹窗，不允许替换顶层 KTV 页面。YouTube 自己以新窗口打开的链接可正常打开；跨域播放器内部的链接目标不受应用控制，无法保证所有推荐都开新标签页，推荐仍可能在 iframe 内换视频。`rel=0` 不能禁用推荐。本次只处理播放器交互，未作整体合规认证；依据 [YouTube 最低功能规范](https://developers.google.com/youtube/terms/required-minimum-functionality) 与 [播放器参数](https://developers.google.com/youtube/player_parameters)。
- 点歌卡片固定预留 200×200px iframe 区域（卡片另含标题与边框），自动按可用宽度排完整列；手机通常一列，现有桌面容器最多三列。选中不放大、不重排，只有选中的卡片加载一个原生播放器；autoplay=0、mute=1，用户主动点击原生播放按钮才启动，保留 30 秒起点，不自动弹出外部预览。
- WebSocket 自动重连；30 秒 heartbeat；无客户端活动 5 分钟后 inactive cleanup。

### 界面语言

英文品牌为 **KTV Assistant**。手机页不再展示房间名；英文顶部显示 `Next: 数量` 与连接状态文字，窄屏空间不足时允许头部换行。点歌使用 `Pick song`，缓存推荐使用 `Cached songs`，额度使用 `Searches remaining` 并保持数字同行。搜索栏使用 `Song` / `Artist` 与 `Vocals` 短标签，原唱开关的完整说明为 `Include original vocals`。首页采用独立英文文案 `Your room. / Your stage.`、`Let your voice run wild.`，空播放状态为 `Ready when you are`；中文主体文案保留。

播放页中英文的“即将播放 / Up next”显示队列第一首歌名，空队列显示“暂无 / None”。区域宽度为 110px，桌面端与重播、播放/暂停/继续、下一首按钮保持同排，不因标题或英文文案换行增高底栏；保留已微调的底栏纵向间距和按钮尺寸。短标题右对齐；溢出时从标题开头先停留 15 秒，再以不超过每秒 12 像素、至少 20 秒的速度向左滚动，末尾停留 5 秒后循环。短标题静止，系统减少动态效果偏好启用时关闭滚动；悬停可查看完整标题。

- 现有创建房间、大屏、手机点歌、Admin 和调试页均支持中文 / English。首次使用读取 `navigator.language`：`zh` 及其地区、简繁变体使用简体中文，其他语言使用英文。
- 页面右上角的无边框 `中 / EN` 按钮立即切换；手动选择保存在当前站点的 `localStorage`（`karaoke-assistant:language`），优先于浏览器语言，刷新后保留，同一浏览器配置中的同源标签页同步。
- 不同设备、浏览器配置和隐私会话各自独立。语言不进入房间 snapshot、WebSocket、搜索请求或缓存键。歌名、频道、用户自定义房间名和调试 JSON 保持原文；旧默认房间名只在界面显示时本地化。
- 浏览器禁用存储时仍可在当前页切换，但无法保证刷新保留或跨标签页同步。未手动选择时跟随浏览器语言变更；移除该偏好后恢复自动检测。
- 翻译集中在 `src/i18n/en.json`，以现有中文文案作为 key。`useLanguage` 订阅本地语言状态，动态提示在渲染时翻译；Admin 日期、数字使用对应 locale。搜索配额的时间计算不变。
- 语言切换不使用 `/en`、`/zh` 路由，也不修改 YouTube 查询语言。Phase 1 后续增加的公开产品页面见下方说明。使用第 4.2 节 Vite 预览即可检查翻译；这不代表真实 Worker 端到端验证。

### 公开网站基础设施（Phase 1，本地实现完成，待审阅）

公开首页、设备指南和政策路由已建立，复用语言选择与深色响应式样式；创建房间和扫码路径保持原样。公开页面与创建页共享页脚导航，“产品介绍”返回首页；导航、语言按钮与页脚链接采用一致的悬停边框视觉和阴影。长文内容及待补运营者名称、联系邮箱集中在 `src/content/publicPages.ts`。政策草稿依据当前数据存储方式编写，不代表已完成法律或平台合规审核；数据请求处理说明与隐私同意机制已补齐，发布前仍需审阅政策正文。直接扫码的手机页可点击顶部品牌、大屏可点击顶部 About 打开政策菜单；链接另开页保留当前房间，不占播放器或底栏空间。首页已展示本地空房间的手机队列和大屏实际截图（`public/product/`）；设备型号和实测内容仍待补充。尚未接入广告、联盟追踪或提交审核。

首页定位为功能介绍，入口“准备开唱 / Ready to Sing”前往 `/create`；创建页实际操作按钮为“创建房间 / Start a Room”。创建页品牌可返回首页，大屏提示使用显示器图标，窄屏说明放在按钮下方。首页、创建页和公开内容页共用品牌组件；中文使用随站点提供的 Ma Shan Zheng 品牌字体子集（许可在 `public/fonts/`），英文使用本地 Courgette 手写字体，中文 K 单独放大加宽；不增加外部字体请求。内容页只保留顶部开始入口，Google 隐私链接位于第三方说明正文，YouTube 条款放页脚，联系区采用卡片。

公开路由之间切换会回到页首，便于从头阅读政策与指南；房间内的搜索/歌单滚动逻辑保持原样。详细范围与验收见 `docs/PHASE_1.md`。当前 Vite 预览为 `http://127.0.0.1:5174/`，真实隔离双 Worker 为 `http://127.0.0.1:8797/`，是否仍运行以终端为准。Vite 前端编辑会热更新，无需重建；关闭终端或 Ctrl+C 停止服务。Vite 不证明真实 Worker 同步。

创建、手机、大屏、调试和 Admin 在访问功能前要求用户主动勾选并继续；直接扫码保留原 URL 和 tab 参数。确认前不挂载受保护页面，公开首页、指南与政策仍可阅读。政策版本与确认时间只存在浏览器 localStorage，不上传服务端；版本变更会重新要求确认。禁用存储时仅在当前页面有效。房间政策菜单可撤回，停止当前页房间连接与播放器；同源其他标签页同步更新。操作说明见 `docs/PRIVACY_REQUESTS.md`。此确认记录不是身份认证或服务器访问控制。

## 2. 技术架构

| 组件 | 职责 |
| --- | --- |
| React + TypeScript + Vite | 页面、mobile UI state、播放器和 local development。 |
| Main Worker `ktv-assistant` | API router、YouTube search、production assets。 |
| Room Worker `ktv-assistant-room` | 导出 `RoomDurableObject`。 |
| Durable Object | WebSocket clients、命令顺序、broadcast、heartbeat、alarm。 |
| D1 `DB` | 房间、队列、playback、持久搜索资料库、搜索事件、quota ledger 和 admin audit。 |
| KV `SEARCH_CACHE` | Exact search family 加速、推荐、quota fallback 和 rate limit；不是持久资料库的 source of truth。 |
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

本地 Vite 保留 `localStorage + BroadcastChannel` fallback；只有 localhost origin 在 socket 未连接时允许使用。D1、KV、Durable Object、WebSocket 和 Worker routing 可按第 4 节在本机模拟验证；以下仍需在发布时做线上 smoke：

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

搜索相关 variables、代码默认值和机器可读契约统一维护在 `SEARCH.md`；这里不重复一份容易漂移的算法参数。

| Variable | Value | 作用 |
| --- | ---: | --- |
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

YouTube search quota、response-size 和本地 ledger 的区别见 `SEARCH.md`。

## 4. 本地开发与分批发布

默认先在本机修改、预览、验证；你明确说“发布”或“部署”后，才执行第 10 节的完整发布。可以连续调整几轮再一起发布。平时不自动 push main，因为 main push 会触发 Cloudflare Main 自动部署。

Codex 每次应主动说明该用哪种验证、替你执行可运行的检查，并告诉你本地地址、服务是否运行、操作步骤和预期结果。你不用先学会所有命令；可以直接说“打开本地预览让我看看”或“帮我验证本地 Worker 的房间同步”。

### 4.1 第一次准备

在 PowerShell 进入仓库（下面所有命令都在此目录运行）：

```powershell
Set-Location 'C:\Brad Wang\Repos\K歌助手'
npm install
```

依赖已经安装时不必每次重新 install。每个长时间运行的服务占一个终端；保留终端窗口，按 Ctrl+C 停止。端口占用时，以终端实际打印的地址为准。

### 4.2 文字、按钮、样式：快速前端预览

```powershell
npm run dev
```

1. 看到 Local 地址后打开它，通常是 http://localhost:5173/create。
2. 点击“创建房间”，从大屏的扫码点歌链接进入手机页。
3. 例如检查这次文案：搜索类型选择 URL，空输入提示应为“YouTube视频链接”；切回歌名/歌手，提示应分别为“歌名”“歌手名”。
4. 保存前端源文件后，Vite 自动更新页面。看不到变化时先确认打开的是 localhost，而不是线上 workers.dev。

此模式没有运行 Worker 后端；API 失败后可进入“本地模式”，使用 mock 搜索与 localStorage/BroadcastChannel。适合检查文案、布局、开关、错误提示；不能证明真实 D1、KV、DO 或生产搜索正确。不提交真实播放即可验证多数 UI。

### 4.3 自动测试：我来选择并解释结果

| 改动 | 日常最小验证 |
| --- | --- |
| 纯文案、说明文档 | 文案/差异检查；有 UI 时本地预览，不默认全量测试或 build |
| 某个 helper 的逻辑 | 相关测试，例如 npm test -- src/lib/searchExperience.test.ts；再 npm run typecheck |
| 搜索行为、校验或配额 | npm run verify:search（网络隔离，不花真实搜索额度） |
| API、房间和同步 | 相关自动测试、typecheck，再按下一节运行本地双 Worker |
| 准备发布 | 第 10 节完整验证和生产 smoke |

测试输出中的 passed 是通过；failed 则先修复/解释。Codex 必须报告实际运行的命令和结果，不能把“没运行”写成通过。npm run preview 只预览已构建静态文件，不会启动 Worker。

### 4.4 后端、数据库、实时同步：本地双 Worker

Phase 1 的数据维护任务只配置在 Main：每小时分批清理 30 天前的搜索/播放事件、停用且 30 天未更新的房间及其残留数据，以及 90 天前的管理员审计/日配额记录。活跃房间与公共歌曲资料库、KV 缓存不参与此清理。积压和任务故障可能导致清理延迟。`migrations/0007_data_retention_indexes.sql` 只新增维护索引，发布前须按既有发布流程审阅并应用，当前没有运行生产迁移或清理。

本轮隔离预览为 `http://127.0.0.1:8797/privacy`，同时运行 Main/Room，使用 `.wrangler/phase1-retention/state` 和空 YouTube key。已实际验证本地调度删除过期 fixture、保留活跃房间与缓存，以及创建房间 Connected。Wrangler 4.105 的测试调度入口是 `/cdn-cgi/handler/scheduled`（仅限本地 `--test-scheduled`），不是普通 SPA 路由 `/__scheduled`。前端更改需 build 后刷新；若 Windows 导致 asset watcher 被禁用，需重启本地 Worker 才能加载新产物。SQLite 回归测试使用 Node 22.13+ 的 `node:sqlite`，只操作内存数据库。

先准备前端产物与本地数据库：

```powershell
npm run build
npx wrangler d1 migrations apply ktv-assistant-db --local --config wrangler.toml
npx wrangler dev --local --config wrangler.toml --config wrangler.room.toml --port 8787 --ip 127.0.0.1
```

- 看到 Ready on http://127.0.0.1:8787 后打开 http://127.0.0.1:8787/create。第一个 config 是入口，第二个提供 Room Durable Object；不要只启动 Main 就判断房间同步失败。[Cloudflare 多 Worker 本地开发说明](https://developers.cloudflare.com/workers/local-development/multi-workers/)
- 创建新房间，在两个同源标签页分别打开 display 和 mobile。预期显示“实时已连接”，而不是“本地模式”。
- 未配置 YOUTUBE_API_KEY 时可使用 mock 文字搜索：点一首歌，在另一页检查标题/队列是否同步；重点检查应用状态，不把 iframe 的真实播放或自动播放当作此次通过条件。
- D1、KV 和 DO 在本机模拟，数据保存在 .wrangler/state；本地初始数据与生产不同是正常现象。迁移只在首次准备或新增 migration 后执行，不使用 --remote。
- Worker 源码修改由 Wrangler 重新加载；前端显示的是 dist。改前端后，在另一终端重新 npm run build，构建完成再刷新浏览器。不要把 Vite 的 5173 页面和 Worker 的 8787 页面混作一次验证。
- 本地运行一般无需 Cloudflare 登录。不要为本地验证 deploy，不添加 remote bindings，也不把生产密钥复制到本地。Wrangler 会加载 .dev.vars；本地存储隔离不等于外部请求隔离，若配置 YouTube key，外部查询仍可能消耗真实额度。默认无 key/mock；现有本地管理员密钥不要打印或提交。

停止服务按 Ctrl+C；数据会保留，后续启动通常可继续使用。若报 no such table，先核对是否漏跑 --local migrations；若是“本地模式”，核对地址、双 Worker 启动和终端错误。Codex 应先帮忙定位，不要求你自行排查全部日志。

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

## 6. 搜索系统

搜索是独立维护的高变动子系统。当前算法、四种模式、exact family identity、D1/KV 行为、推荐、quota、timeout、已知风险和强制变更协议全部以根目录 `SEARCH.md` 为准。

README 只保留产品级不变量：

- Mobile 支持歌名/歌手与 KTV/原唱四种组合，只在用户显式提交时搜索。
- 非空 exact family 优先复用本地结果；cold search 受严格调用预算和两秒体验上限保护。
- 普通文字搜索完整保存 provider 的结构可用原始候选；展示过滤与首页推荐分别采用保守保留、严格准入规则，不因数量不足额外请求 YouTube。精确规则见 `SEARCH.md`。
- 搜索保留分类错误或信息不足的疑似歌曲；首页支持明确歌名部分的部分匹配。命中旧 D1/KV 缓存也更新合格推荐，历史补建按游标有界翻页；搜索成功和返回推荐时重新读取首页数据，刷新期间保留已有卡片。后台写入及 KV 最终一致性仍可能造成短暂延迟。
- 用户明确提供的 YouTube 单视频 URL 走隐藏兜底；其他 URL 不消耗搜索额度。
- 搜索实现有零真实网络的 golden contracts；修改搜索前后必须运行 `npm run verify:search`。
- `PROGRESS.md` 只记录历史 pass 和发布证据，不作为当前算法定义。

不要在 README 重新复制 scoring、cache keys 或 provider query；需要修改时直接更新 `SEARCH.md`。

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

D1/KV exact read order、family hash 校验、旧算法隔离、live fallback、持久化和失败策略统一见 `SEARCH.md`。Admin 继续把 repository 与 search events 作为运营数据展示；D1 暂时不可用时，公开搜索不会因为 admin instrumentation 整体失败。

### 7.3 容量与 quota 语义

- D1 使用官方 `GET /accounts/{account_id}/d1/database/{database_id}` 的 `file_size`，页面标记为“Cloudflare D1 API”；不再把 SQL statement `meta.size_after` 当成管理页面权威值。
- KV 使用 Cloudflare GraphQL Analytics 的 `kvStorageAdaptiveGroups`，页面展示最新 `byteCount` 与 `keyCount` 并标记为“Cloudflare Analytics”。该数据按天聚合，保留 provider 测量日与最近成功时间。
- `estimatedRepositoryBytes` / “应用记录估算”只合计 `search_repository_entries.approx_bytes`，用于理解搜索结果 payload；它不是 D1 数据库体积，也不与 KV 真实 bytes 混算。
- D1、KV 完全分开显示。任一 provider 失败不会清零另一项；如果有最近成功值则继续显示并标记“过期”，从未成功则显示“暂时无法获取”。
- Cloudflare 当前提供 plan-dependent 文档上限，但已核实的 D1/KV 指标接口没有返回本账户可直接使用的机器可读容量上限。系统不根据 plan 名称硬编码 500 MB、5 GB、10 GB 或 1 TB；只有显式运维配置容量时才计算百分比，且标记为“运维配置”、`authoritative=false`。
- 管理页面自动读取最多每 5 分钟向 Cloudflare 重新验证一次；手动“刷新数据”会要求服务端重新验证。D1 lease 避免多个管理员页面同时重复调用 provider。
- 清理策略要求 D1 权威实际体积可用且新鲜，并同时配置 capacity、warning threshold 和更低的 cleanup target；缺一项、指标过期、目标不低于预警线或容量未越线时，服务端都返回明确的 skipped preview，不删除资料。
- 首版坚持 manual-first：预览和确认后才执行有限批次；自动清理仍未启用。
- YouTube 页面值标记为 `local_estimate / search_calls`；完整 ledger、预留和真实配额边界见 `SEARCH.md`。

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

- 手机竖屏默认两列，较宽/横屏为 3–4 列；每张 card 在视频下方显示两行以内的歌名，不显示 uploader/channel。激活 preview 时保持原 card/grid 尺寸，不临时放大或改变结果布局。
- Mobile 使用与 display 连续一致的 slate/teal 深色背景，`theme-color`、`color-scheme`、HTML/body 和 safe-area 都保持深色，避免 Safari 顶部状态栏、底部地址栏或结果区露出白带。
- 进入点歌页后预热 IFrame API；选择 card 后立即激活 preview，快速切换会销毁旧 preview，只有 active card 挂载 iframe。
- Pending/加载阶段显示 spinner；10 秒仍未加载会显示可重试提示；点击外部停止。
- Preview 构造时直接设置 `autoplay=1`、`mute=1`、`start=30`、`cc_load_policy=1` 和 `playsinline=1`，让有字幕轨的视频默认显示字幕；ready 后只校准 `mute()`、`seekTo(30)` 和 `playVideo()`，不再二次 `loadVideoById`。只有真实 current time 达到 29 秒后才结束 spinner，并把实际时间写入 preview 容器的 `data-preview-current-time` 供生产验收读取。
- App 不重复显示 video title/channel/quality，active preview 也不叠加“已选中”badge；iframe 禁止 pointer/hover/focus，并在实际 PLAYING 后立即淡入。YouTube 原生 title/avatar/branding 可能按官方规则出现，不能用 overlay 或裁切遮挡。

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

只有明确要求发布/部署时才运行以下流程，日常小修改不自动执行。发布前先汇总本批本地验收与未覆盖项，再统一验证：

```powershell
npm run test
npm run typecheck
npm run verify:search
npm run build
git diff --check
npx wrangler deploy --config wrangler.room.toml --keep-vars
npx wrangler deploy --config wrangler.toml --keep-vars
```

Room → Main 使用 --keep-vars；提交/推送仅包含本批改动，随后做生产 smoke 并记录真实版本 ID。未请求发布时不自动提交/推送 main；需要保留检查点可明确要求本地 commit。

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
- footer 最左侧将连接状态 badge 与右侧两行额度/reset 提示水平并排；仅中间歌名缩小为 18px（sm 起 20px），progress 上间距和 footer 上下留白收紧。其他字体、颜色、右侧播放控制与队列统计、二维码 card 尺寸保持原样。不显示“正在播放”，歌名与 progress 不重叠。
- 已播放 progress 与 thumb 同为 teal，未播放部分为灰色；右侧重播、暂停/继续、下一首和队列统计有明确的 button/panel 层级。
- `/create` 在 390×844 与 1280×720 都应无横向 overflow；主标题使用受控两行，CTA 在手机首屏可见，三步说明保持简短。
- Mobile 使用固定高度深色外壳；header、搜索栏/结果标题和 footer 不参与页面滚动，只有结果容器独立滚动并保存 `scrollTop`，滚动条也只出现在结果区，卡片标签不得穿透搜索栏；header/tab/search/点歌 controls 保持紧凑，“即将播放”是可直达歌单的 inline badge。
- Mobile Safari 的状态栏、浏览器上下栏和 safe-area 不应露白；长按正文/缩略图不出现蓝色选择层，搜索输入仍可选字。
- Display 空状态 footer 不显示占位歌名；Space 在页面任意非输入焦点暂停/继续，点击播放器控制键后不保留焦点圈。

### 11.2 搜索专项

零额度 cache-only smoke、最多 2–3 次的人工 live search、quota before/after、四模式验收矩阵和发布完成标准统一见 `SEARCH.md` 的“搜索算法变更协议”。README 不维护第二份可能与算法脱节的搜索 smoke。

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

Rate-limit 专项：同 room + identity 快速重复非空搜索，超限应返回 `throttled=true`、`retryAfterSeconds`、0 个新结果和 0 个 provider calls；Mobile 必须保留当前结果。

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
6. Search 按 `SEARCH.md` 的诊断字段依次检查 exact family、quota ledger、provider、D1/KV 和 rate limit。
7. Sync 检查 `ROOM_OBJECT`、Room Worker、D1。
8. Autoplay/restart/pause/seek/next 必须在目标浏览器复现；YouTube 画质只验证 adaptive，不验证已废弃的强制 quality API 或已移除的手动模式。

### 11.6 Admin smoke

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
