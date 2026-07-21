# Project Progress

Last updated: 2026-07-21

这份文件记录 implementation status、历史修复、验证结果和剩余工作。系统设计、search details、手动配置、部署和测试步骤见根目录 `README.md`。

## 1. 当前状态

| Area | Status | Summary |
| --- | --- | --- |
| Repository | Complete | GitHub 已改名为 `bradwang1995/Karaoke-Assistant`，local origin 已更新。 |
| Product MVP | Complete | Create、display、mobile、debug 全流程可用。 |
| Cloudflare backend | Complete | Worker + Assets、D1、KV、Durable Object 已上线。 |
| Realtime queue | Complete | WebSocket commands、broadcast、persistence、reconnect 已完成。 |
| YouTube search | MVP complete | Live API、family cache、ranking、推荐、rate limit、quota 已完成。 |
| Admin console | Local release candidate | 简洁暗色总览、搜索记录、资料库管理、认证和浏览器交互已完成；生产发布待本轮收尾。 |
| Persistent search repository | Local release candidate | D1 作为无 TTL 的真实资料源，KV 继续作为加速层；精确查询复用、访问统计和手动删除已完成。 |
| Mobile preview | MVP complete | 2–4 列、单 iframe、固定 30 秒起点、600ms debounce、spinner/timeout fallback 已完成。 |
| Display player | MVP complete | Autoplay、0 秒切歌、restart、pause/resume、seek、auto-advance 已完成；画质由 YouTube 自适应。 |
| Reliability | MVP complete | Heartbeat、5-minute cleanup、debug、fallback policy 已完成。 |
| Automated tests | 20 files / 73 tests | Admin auth/routes/repository regressions 已加入；DO storage 和端到端测试待补。 |
| Real-device QA | Pending | Safari、Android、iPad、Desktop Chrome 待正式验收。 |
| Documentation | Complete | `README.md`、`PROGRESS.md` 已纳入本轮功能；`design-qa.md` 记录本轮强制视觉验收。 |

状态：`[x]` complete；`[~]` usable but needs further validation；`[ ]` pending。

## 2. Implementation progress

### Phase 0 — Foundation

- `[x]` React 18、TypeScript、Vite、Tailwind、React Router。
- `[x]` Zustand、TanStack Query、QR code dependencies。
- `[x]` Main/Room Wrangler configs 和 Cloudflare types。
- `[x]` Frontend、Worker、migration、tests 目录。
- `[x]` Dev、typecheck、test、build scripts。
- `[ ]` ESLint/Prettier 未加入；非 MVP blocker。

### Phase 1 — Routes and UI

- `[x]` `/create`、`/display`、`/mobile`、`/debug`。
- `[x]` Display fullscreen layout、QR、player controls。
- `[x]` Mobile search/queue tabs 和中文 UI。
- `[x]` Loading、empty、error states。
- `[x]` Create page 只保留有效 create CTA；暗色响应式 hero、受控两行标题和三步说明已完成。
- `[x]` Display QR/title 打开 mobile new tab。
- `[~]` Responsive base complete；跨设备 visual QA pending。

### Local MVP

- `[x]` Mock search provider。
- `[x]` Shared room reducer。
- `[x]` localStorage snapshot + BroadcastChannel。
- `[x]` Add、promote、remove、advance、restart、cleanup。
- `[x]` First song starts；queued additions do not interrupt。
- `[x]` Reducer tests。
- `[x]` Local fallback 限制在 localhost；production 不伪造成功。

### Phase 2 — Cloudflare backend

- `[x]` Main Worker + Assets 和 separate Room Worker。
- `[x]` D1 schema、repository、snapshot read/save。
- `[x]` DO SQLite migration declaration。
- `[x]` Room id generation/validation。
- `[x]` Create、snapshot、WebSocket、cleanup API routes。
- `[x]` DO restart 后从 D1 恢复。
- `[x]` Real D1/KV/DO bindings production verification。

### Phase 3 — Realtime queue

- `[x]` `JOIN_ROOM`、`ROOM_SNAPSHOT`、`ROOM_UPDATED`、`PING/PONG`。
- `[x]` Add、promote、remove commands。
- `[x]` Player started、ended、restart commands。
- `[x]` Stale player-event id guards。
- `[x]` Command 后写 D1 并 broadcast。
- `[x]` Connected-client tracking。
- `[x]` 500ms–8s exponential reconnect，最多 8 次。
- `[x]` 中文 metadata JSON/WebSocket/D1 round trip。
- `[~]` 两台真实手机并发操作待验收。

### Phase 4 — YouTube search

- `[x]` Worker-only API key、live provider、mock fallback。
- `[x]` Song/artist 和 original-vocal intents。
- `[x]` Deterministic aliases、歌名 focused source query、歌手 broad OR query、family hash。
- `[x]` One `search.list` page、最多 50 embeddable candidates。
- `[x]` Duration enrichment、dedupe、scoring。
- `[x]` Song title relevance filter；title/artist/KTV/伴奏/lyrics/original ranking。
- `[x]` Partial-title regression coverage。
- `[x]` KV v3 family cache、v2 intent-scoped index、metadata、payload pruning。
- `[x]` Recommendation pool 和 cached re-ranking。
- `[x]` API 50 results；mobile 10-at-a-time expansion。
- `[x]` Recommendation pool 200 results；缓存耗尽前自动无限滚动。
- `[x]` 显式提交时原唱使用对立权重；歌名模式合并同曲 KTV/原唱历史 cache，顺序稳定且不重复消耗 search call。
- `[x]` 20/min rate limit。
- `[x]` Project quota 100/day、1/fill、Pacific reset、status API 和 room WebSocket 即时额度推送。
- `[x]` Real YouTube result + repeat-query cache hit verified。

### Phase 5 — Mobile search and preview

- `[x]` Default recommendations。
- `[x]` 固定 header/search/footer 外壳；结果容器独立滚动并保存 `scrollTop`。
- `[x]` 24-hour per-room search state。
- `[x]` Queue tab URL persistence。
- `[x]` Portrait 2-column、wide/landscape 3–4-column compact previews。
- `[x]` One active adaptive-quality preview iframe；固定从 30 秒开始，click outside stops。
- `[x]` 600ms debounce、pending/loading spinner、10s slow-load retry hint。
- `[x]` Overlay selection/queue tags。
- `[x]` Page toast + add-to-queue animation。
- `[x]` Stay on search after adding；duplicate warning。
- `[x]` Direct promote；confirm remove/restart/skip。
- `[x]` Preview iframe load/timeout fallback。
- `[~]` Mobile autoplay/playsinline real-device check。

### Phase 6 — Display playback

- `[x]` Fullscreen IFrame Player API。
- `[x]` Autoplay intent、ready guard、retry、blocked hint。
- `[x]` PLAYING/ENDED → room commands。
- `[x]` Natural end、manual skip、mobile restart。
- `[x]` App restart、pause/resume、next、progress/seek controls；三键 wrapper 有明确 button 层级。
- `[x]` YouTube chrome cleanup。
- `[x]` 已移除官方明确失效的 quality APIs、画质 selector 和 manual mode；YouTube 自适应画质。
- `[x]` Dark compact QR card + 140px pure black/white Canvas；room-level connection/quota/local-time status 在 footer 最左。
- `[x]` Center title above progress，和歌名不再重叠。
- `[x]` Progress 以 queue item id 隔离；新歌固定 0 秒，played teal / remaining gray。
- `[ ]` Real-browser autoplay matrix。

### Phase 7 — Reliability

- `[x]` Unified loading/error/status messages。
- `[x]` Production disconnect protection。
- `[x]` Debug snapshot、links、manual cleanup。
- `[x]` 30-second heartbeat。
- `[x]` DO activity storage + alarm。
- `[x]` Activity refresh on snapshot/JOIN/PING/commands。
- `[x]` 5-minute inactive deactivation、queue clear、idle playback。
- `[x]` Search failure/quota/rate-limit feedback。
- `[~]` Party-ready visual/device validation pending。

### Phase 8 — Admin console and persistent search repository

- `[x]` `/admin` 独立 lazy-loaded 管理界面；侧栏只保留总览、搜索记录、资料库三项基础能力。
- `[x]` 单管理员密码登录；12 小时 HMAC session cookie、登录限流、同源 mutation guard 和主动退出。
- `[x]` 总览提供系统状态、YouTube 当日调用与 Pacific reset、资料库真实容量状态、搜索趋势、热门歌曲/歌手和系统提醒。
- `[x]` 搜索记录支持时间、来源、类型和关键词筛选，以及服务端分页。
- `[x]` 资料库支持关键词/类型/原唱状态筛选、排序、分页、结果摘要、批量选择和二次确认删除。
- `[x]` D1 `search_repository_entries` 作为持久真实资料源；精确标准化查询优先复用，KV 仅保留为可过期加速层。
- `[x]` 搜索事件、资料库访问次数、每日 YouTube quota ledger 和管理员审计事件均持久化到 D1。
- `[x]` 冷查询和旧 KV 命中可回填 D1；资料库故障不会阻断公开搜索的安全 fallback。
- `[x]` 管理 API 覆盖 session、overview、searches、repository read/delete；未认证读取也返回 `401` 与 `no-store`。
- `[x]` Recharts 仅随 `/admin` chunk 加载，公共 K 歌入口不承担图表 bundle。
- `[x]` 本地 migration、登录、总览、筛选、空状态、真实资料行、选择、删除确认和删除操作已通过浏览器验证。
- `[x]` 桌面 reference/implementation 同屏对照、移动端 viewport、全量自动验证和双 Worker dry-run 已通过。
- `[~]` Production migration、secrets、release 和 smoke 正在本轮收尾。
- `[ ]` 自动搜索/自动补库是下一阶段，不属于本轮初始管理台发布。

## 3. Bugfix and internal-test archive

只记录修复结果，不再记录反复修改文档的过程。

### 2026-06-26 manual batch

| Area | Completed |
| --- | --- |
| Search | Title relevance ahead of related/channel-only results。 |
| Mobile tab | `?tab=queue` survives refresh。 |
| Recommendations | KV defaults；empty query uses no search call。 |
| Autoplay | Params、retry、play intent、Player-ready guard。 |
| Quality | 默认 YouTube adaptive；手动选项只打开原生 controls，不调用已废弃的强制 quality API。 |
| Display layout | Controls outside iframe；mobile link new tab；QR offset。 |
| Quota | One call / up to 50 results per cold fill。 |
| Preview | Interacting with iframe first selects result。 |

### 2026-07-02 internal test

| ID | P | Completed |
| --- | --- | --- |
| IT-01 | P0 | Mobile skip/next control。 |
| IT-02 | P0 | Mobile restart current。 |
| IT-03 | P0 | Portrait home CTA hierarchy。 |
| IT-04 | P1 | `带原唱` toggle and ranking。 |
| IT-05 | P1 | Song/artist selector。 |
| IT-06 | P0 | Add song keeps search context。 |
| IT-07 | P0 | One preview；interaction selects result。 |
| IT-08 | P1 | Load more from current response。 |
| IT-09 | P1 | Persist search state and scroll。 |
| IT-10 | P2 | Song/artist/KTV/vocal ranking。 |

### 2026-07-03 post-internal pass 1

| ID | P | Completed |
| --- | --- | --- |
| PIT-01 | P1 | Overlay selection/queue pills。 |
| PIT-02 | P0 | KTV/karaoke restored as primary version signal。 |
| PIT-03 | P1 | Remove duplicate preview button。 |
| PIT-04 | P1 | Remove invalid create-page QR CTA。 |
| PIT-05 | P1 | Page toast + queue flight animation。 |
| PIT-06 | P1 | Clear mobile queue count placement。 |
| PIT-07 | P1 | Pill toggle + compact toolbar。 |
| PIT-08 | P1 | Sticky controls/result count。 |
| PIT-09 | P1 | Less preview chrome；outside click stops。 |
| PIT-10–12 | P1 | Display chrome、app seek；quality UI 后在第三轮因官方 API 失效移除。 |
| PIT-13 | P0 | 5-minute inactive cleanup。 |
| PIT-14 | P0 | Open-client heartbeat。 |
| PIT-15 | P1 | Quota estimate and Pacific reset。 |

### 2026-07-03 post-internal pass 2

| ID | P | Completed |
| --- | --- | --- |
| PIT2-01 | P1 | Sticky header clipping fix。 |
| PIT2-02 | P1 | Auto-preview、less hover chrome；固定画质假设后在第三轮修正为 adaptive。 |
| PIT2-03 | P0 | Partial title above unrelated KTV。 |
| PIT2-04 | P0 | 早期 quality preference 尝试；第三轮确认官方 API no-op 后移除。 |
| PIT2-05 | P1 | Remove start button；larger centered progress。 |
| PIT2-06 | P1 | Hide uploader；local quota reset time。 |
| PIT2-07 | P1 | Simplified linked QR card。 |
| PIT2-08 | P1 | Remove duplicate queue-tab count。 |
| PIT2-09 | P1 | Confirm restart/skip；direct promote。 |
| PIT2-10 | P1 | Verification、release、documentation。 |

### 2026-07-13 post-internal pass 3

| ID | P | Completed |
| --- | --- | --- |
| PIT3-01 | P0 | QR 改为纯黑/纯白、高纠错级别、增大尺寸和白色发光边界。 |
| PIT3-02 | P1 | `正在播放`、连接、今日剩余额度、本地 reset 日期/时间/时区固定在 footer 最左。 |
| PIT3-03 | P0 | 移除 YouTube 已废弃且实际 no-op 的固定 quality API/retry/storage；当时保留的原生 controls 手动模式已在第四轮移除。 |
| PIT3-04 | P0 | Restart 重置 player flags/progress，重新 load 0 秒并再次同步 started。 |
| PIT3-05 | P1 | 歌名移到 footer 中间，progress/时间置于其下，消除 overlap。 |
| PIT3-06 | P1 | Display 默认禁止 iframe hover pointer，移除 app click/status/end overlay；autoplay blocked 改用 footer 按钮。 |
| PIT3-07 | P1 | Recommendation pool 从 40 扩为 200，旧 pool 不足时合并 family fallback。 |
| PIT3-08 | P1 | Mobile preview 改为 portrait 2 列、宽屏 3–4 列的小卡片并移除 app title/channel chrome。 |
| PIT3-09 | P0 | Preview 600ms debounce、单 iframe、spinner、10s timeout/retry hint。 |
| PIT3-10 | P1 | Solid header/tags、固定 sticky 高度、16px search input，修复标签溢出和 iOS focus zoom。 |
| PIT3-11 | P0 | 原唱 toggle 自动重搜；原唱/KTV intent 使用相反加减分，结果顺序真实变化。 |
| PIT3-12 | P1 | 非空搜索最多 50，首批和后续每批 10。 |
| PIT3-13 | P1 | README/progress、自动测试、responsive browser smoke 和 release。 |

### 2026-07-14 post-internal pass 3 follow-up

| ID | P | Completed |
| --- | --- | --- |
| PIT3-14 | P0 | QR 从 DOM SVG 改为 Canvas 黑白输出，并加 `only light` / forced-color protection，避免客户端强制深色导致不可扫描。 |
| PIT3-15 | P1 | Display 移除“正在播放”；quota reset 简化为只显示剩余小时，不再显示 GMT、日期或 IANA 时区。 |
| PIT3-16 | P1 | Mobile sticky 建立独立层叠上下文并收紧结果间距，阻止卡片标签穿透；Display ended/error 后隐藏 iframe；当时的 native manual 模式已在第四轮移除。 |

### 2026-07-14 post-internal pass 4

| ID | P | Completed |
| --- | --- | --- |
| PIT4-01 | P0 | Display 移除 auto/manual 画质 UI 和 native manual path，统一由 YouTube adaptive quality 决定。 |
| PIT4-02 | P1 | Footer 增加重播、暂停/继续、下一首三键，并用有边框的 panel、teal 主操作和 rose next 状态强化 affordance。 |
| PIT4-03 | P1 | 自绘 app progress track：已播放段与 thumb 同为 teal，未播放段为 gray。 |
| PIT4-04 | P1 | QR 外层改为暗色紧凑 card，Canvas 从 168px 缩至 140px；内部仍保持高纠错纯黑白和 white quiet zone。 |
| PIT4-05 | P0 | 删除 display 的动态 `startAtSeconds=currentTime`；FullscreenPlayer 固定 0 秒，progress session 按 queue item id 隔离，manual next/natural end/restart 均不会继承旧进度。 |
| PIT4-06 | P0 | Mobile preview 改用专用 URL helper，固定 `start=30`，并补 URL regression tests。 |
| PIT4-07 | P1 | Preview 不添加 title/channel/quality chrome，移除失效的 `modestbranding/showinfo` 参数；按官方规则保留不可遮挡的 YouTube 原生标识。 |
| PIT4-08 | P1 | `/create` 改为与 display 一致的 slate/teal/rose 暗色界面；受控两行标题、首屏 CTA 和简短三步说明消除尴尬换行与空散布局。 |
| PIT4-09 | P1 | 新增 player progress session 与 YouTube preview URL 测试，更新 README/PROGRESS 并完成 responsive browser smoke。 |

### 2026-07-15 post-internal pass 5

| ID | P | Completed |
| --- | --- | --- |
| PIT5-01 | P1 | Create 说明文案在“创建后”前固定换行，消除中文孤字/难看 wrap。 |
| PIT5-02 | P1 | Create CTA 扩至桌面 240×72px，并加入无需 hover 的 teal/cyan/rose/amber 循环渐变、扫光和 reduced-motion fallback。 |
| PIT5-03 | P1 | CTA 右侧说明进一步拉开间距并保留静态箭头；持续移动的箭头只放在主按钮文字右侧，不新增竞争主操作。 |
| PIT5-04 | P0 | Mobile 改为 `100dvh` 固定外壳；header、搜索/结果标题、footer 脱离 scroll，只有结果区 `overflow-y-auto`。 |
| PIT5-05 | P0 | 删除搜索内容 `pb-24` 和内部 sticky footer；footer 使用固定 `shrink-0` 高度，结果到底不再产生额外底部留白。 |
| PIT5-06 | P1 | Mobile 外壳、header、搜索栏、结果/preview 卡、歌单和 footer 全部统一到 display 的 slate/teal 暗色主题并放大小字号。 |
| PIT5-07 | P1 | 新房间使用诚实的中性“K歌房”；不再根据 user agent 伪装成读取了电脑名或 Chrome Profile，legacy id/设备猜测标签也统一隐藏。 |
| PIT5-08 | P1 | 房间名 tests 覆盖 normalization、中性默认值和 legacy label 清理；同步更新操作与发布文档。 |
| PIT5-09 | P1 | Create 删除“1 个房间”badge，右上角替换为“在这个世界上，只有在唱歌的时候，我是绝对自由的。”。 |
| PIT5-10 | P0 | Display 空 footer 不再显示“等待点歌”；Space 在非输入焦点全局切换暂停/继续，点击重播/暂停/下一首后主动释放焦点。 |
| PIT5-11 | P0 | Mobile/Display 增加不可选择/不可长按拖图边界，保留输入编辑；消除截图中的蓝色文字和播放器选择层。 |
| PIT5-12 | P0 | HTML/theme-color/color-scheme/body/safe-area 全部设为深色，Mobile 只让结果区滚动并使用深色 scrollbar，阻止 Safari 上下 browser chrome 和 overscroll 露白。 |
| PIT5-13 | P1 | Preview card 在同一选中边框内恢复视频下方歌名，仍不显示 uploader/channel；搜索工具栏统一 16px 字号并放大原唱和搜索点击区。 |
| PIT5-14 | P0 | 只有 submit 才搜索；输入、歌名/歌手和原唱变化不清空、不重查、不改变当前数量，pending 期间保留旧结果直到成功替换。 |
| PIT5-15 | P0 | Recommendation pool 只强提升每次搜索前 8 条，cache hit 重提 family 头部，真实点歌置顶；family fallback 按 recency/hits 排序后轮转，避免最近搜索的随机尾部垄断。 |

### 2026-07-20 post-internal pass 6

| ID | P | Completed |
| --- | --- | --- |
| PIT6-01 | P0 | 按 Google 2026-06 granular quota 文档核实：默认 `search.list` bucket 是 100 calls/day、每次 1 call；单次 `maxResults` 仍是 50。Main/Room guardrail 与默认值同步为 100。 |
| PIT6-02 | P0 | 修复 v1 normalized index 跨 song/artist、KTV/原唱和 artist scope 覆盖 family hash；v2 index 隔离全部 intent，并始终优先读取、验证精确 family。 |
| PIT6-03 | P0 | 歌名模式固定合并同一 canonical song 的 KTV/原唱历史 cache，去重后按当前 intent 重排；只要历史中有相关结果就不再发 live search。 |
| PIT6-04 | P0 | Cold song search 第一条 source query 改为精确歌名；标题 miss 和 channel-only hit 不再进入歌名结果，旧 cache 若只剩无关项会回到 live fill 并覆盖当前 family。 |
| PIT6-05 | P0 | Quota write 直接返回刚记录的 100-based status，不再立即回读最终一致 KV；Main Worker 经 room Durable Object 发布 `YOUTUBE_QUOTA_UPDATED`，Display React Query cache 立即更新，60 秒 poll 只作兜底。 |
| PIT6-06 | P1 | 新增 cache intent isolation、同曲跨 intent reuse、song relevance、focused source query、quota write-through 和 WebSocket quota regressions；README/PROGRESS 同步。按用户要求 commit/push 但不立即 deploy。 |
| PIT6-07 | P0 | 用户后续明确授权发布；按 Room → Main 顺序使用 Wrangler 4.105 和 `--keep-vars` 上线，生产 HTTP、真实搜索/cache、100/day quota 与 WebSocket 即时 quota push 已复核。 |

### 2026-07-21 admin console baseline

| ID | P | Completed |
| --- | --- | --- |
| ADM-01 | P0 | 按用户选定的第三版暗色 dashboard 缩减为总览、搜索记录、资料库三项基础导航，保留现代图表与紧凑信息层级。 |
| ADM-02 | P0 | 新增 D1 持久搜索资料库、搜索事件、每日 quota ledger 和管理员审计表；持久资料不设 TTL，KV 仅作 accelerator。 |
| ADM-03 | P0 | 公开搜索改为 D1 exact hit 优先；cold fill/legacy KV 自动回填，读命中更新访问时间和次数，唯一键避免数据重复。 |
| ADM-04 | P0 | 新增安全的 fallback 管理员认证与受保护 API；session secret/password 只从 Worker secret 读取。 |
| ADM-05 | P1 | 完成 overview、search log 和 repository filters/pagination/delete 交互；容量未知时显示“未知”而不虚构百分比。 |
| ADM-06 | P1 | Admin 页面 lazy-load Recharts，保留公共 K 歌首屏 bundle 边界；README 与 PROGRESS 使用中文记录行为、配置和操作。 |
| ADM-07 | P0 | 本地 D1 migration、资料写入/精确复用、受保护路由、登录、交互删除、桌面同屏对照和移动端 responsive 均已验证；最终 production evidence 待下方本轮记录补齐。 |

## 4. Verification record

### Automated history

| Date | Result |
| --- | --- |
| 2026-07-02 | Targeted reducer/room/WebSocket/search tests passed；full 11 files / 41 tests。 |
| 2026-07-03 pass 1 | Search/quota/heartbeat targeted tests；full 12 files / 44 tests。 |
| 2026-07-03 pass 2 | Ranking/quality targeted tests；full 12 files / 47 tests。 |
| 2026-07-13 docs | Typecheck、12 files / 47 tests、production build passed；no deploy。 |
| 2026-07-13 pass 3 | Typecheck、11 files / 44 tests、production build、`git diff --check` passed。 |
| 2026-07-13 pass 3 UI | 390×844：2 columns、16px input、single debounced iframe、original auto-search；1280×720：QR/footer/title-progress layout passed。 |
| 2026-07-14 pass 3 follow-up | Typecheck、12 files / 47 tests、production build、Wrangler Main Worker dry-run、`git diff --check` passed。 |
| 2026-07-14 follow-up UI | 1280×720：Display 默认 `controls=0/fs=0`，手动为 `controls=1/fs=1`，error iframe 隐藏且画质 selector 不挤压 footer；390×844：sticky 停在 164px、结果间距收紧，卡片标签滚入搜索区时由 sticky 层正确遮挡。 |
| 2026-07-14 pass 4 | Typecheck、14 files / 53 tests、production build、Wrangler 4.105 Main Worker dry-run、`git diff --check` passed。 |
| 2026-07-14 pass 4 UI | 390×844：create CTA 首屏可见、无横向 overflow、preview URL `start=30` 且单 iframe；1280×720：dark 140px QR、无画质 selector、三键 panel、下一首切换后 progress value `0`。 |
| 2026-07-15 repository rename | New/old GitHub remotes resolve to HEAD `d64f60f`；local origin 更新至 `bradwang1995/Karaoke-Assistant`；production root 返回 HTTP 200；no deploy。 |
| 2026-07-15 pass 5 | Typecheck、15 files / 56 tests、production build、双 Worker dry-run、`git diff --check` passed。 |
| 2026-07-15 pass 5 UI | Create 1280×720：CTA 240×72、持续 gradient、说明强制两行；Mobile 390×800：结果 `scrollTop 0→87`、`window.scrollY=0`，header/search/footer 坐标滚动前后完全一致。 |
| 2026-07-15 pass 5 follow-up | Typecheck、15 files / 58 tests、production build、Wrangler 4.105 Room/Main 双 dry-run、`git diff --check` passed；新增 recommendation promotion/cache-hit/queued-song 和 neutral room-name regressions。Local Vite root HTTP 200；自动浏览器 transport 在连接时关闭，因此本记录不虚报新的截图/交互视觉通过。 |
| 2026-07-20 pass 6 | Search/cache/quota/WebSocket focused 7 files / 32 tests、typecheck、full 17 files / 64 tests、production build 和 `git diff --check` passed。Wrangler 4.105 已确认；Room/Main dry-run 因安全审查认为可能认证并发送 bundle metadata 而未执行。按用户明确要求没有 production deploy，也没有虚报 runtime/browser smoke。 |
| 2026-07-21 pass 6 release | Typecheck、full 17 files / 64 tests、production build、`git diff --check` passed；Wrangler 4.105 按 Room → Main 顺序以 `--keep-vars` 发布，版本列表与 production smoke 复核通过。 |
| 2026-07-21 admin baseline local | Typecheck、full 20 files / 73 tests、production build、Wrangler 4.105 Room/Main 双 dry-run 和 `git diff --check` passed。内置浏览器完成 1440×1024 reference/implementation 同屏对照与 390×844 responsive smoke；页面无横向 overflow，三页导航与表格容器正常，console 无 error/warning。 |

### Admin console design QA（2026-07-21）

Final result：passed；没有遗留可执行的 P0、P1 或 P2 design finding。详细中文记录见根目录 `design-qa.md`。

- Reference：用户选定的第三版深色 dashboard，并按要求进一步精简。
- Desktop：`1440×1024` 同屏比较；深色 tokens、侧栏、状态、双指标卡、趋势图和底部信息层级与参考方向一致。
- Mobile：`390×844`；页面 `scrollWidth=clientWidth=390`，搜索记录和资料库表格只在自身容器横向滚动。
- Interaction：总览、搜索记录、资料库导航与真实资料状态均通过；本轮之前已验证登录、筛选、选择、删除确认和删除。
- Console：最终桌面与移动验收均无 application error 或 warning。

### Fourth-round design QA（2026-07-15）

Final result：passed；没有遗留可执行的 P0、P1 或 P2 design finding，也不需要 post-comparison fix loop。

- Evidence：source attachment `ec1632b2-0153-4df7-baa9-cc17011bb814/image-1.png`；其余 before/after、implementation、full-view 与 QR/footer focused comparison 位于 Codex visualization `019f63d8-8589-75c3-b89a-396facff0868/design-qa/`。关键文件包括 `create-desktop-before-after.png`、`create-mobile-before-after.png`、`create-after-1280x720-pass1.png`、`create-after-390x844-pass1.png`、`mobile-preview-after-390x844.png`、`display-after-2589x1336-final.png`、`display-annotated-before-after-exact.png`、`display-footer-focused-before-after-exact.png` 和 `display-qr-focused-before-after-exact.png`。
- Coverage：create desktop `1280×720`、create/mobile preview `390×844`、annotated display `2589×1336`；覆盖 create ready、mobile 搜索 + 单一 active preview + selected/queued candidates，以及 display current item + zero queued items + hidden YouTube error fallback。
- Typography/layout：create hero 在桌面与手机均保持受控两行标题、稳定中文系统字体 fallback 和清晰字重；桌面无页面滚动，手机无横向 overflow 且 CTA 位于首屏。Display controls、queue count、QR、title 和 progress 分组无碰撞。
- Visual/accessibility：沿用 slate/teal/rose 暗色 tokens；QR wrapper 为暗色，扫描面保持纯黑白。Lucide 图标、清晰 border/focus ring、semantic button/link/heading、带 accessible label 的 slider/QR link，以及至少 `40px` 的 mobile tap target 均通过检查。
- Content/assets：create copy 简短且 task-oriented，不读三步说明也能理解主要结果与 CTA；无需 raster hero/decorative image，app icons 统一使用现有 Lucide family，YouTube source-owned thumbnail/player content 不被 app overlay 遮挡。
- Interaction：create CTA 可进入新房间；mobile search 可返回结果，选择卡片后恰有一个 preview iframe 且 URL 含 `start=30`；两首点歌后 restart 保持当前 item，next 推进第二首并将 progress 保持为 `0`。Display 恰有 replay、play/pause-resume、next 三个 player actions，无 quality selector。
- Console：无 application error；仅有既存 React Router v7 future-flag warning。P3 follow-up 是在未来 dependency upgrade 时 opt in 或消除这些 warning。
- Limitation：自动化环境的 YouTube 视频返回 error 150，app 的 error iframe fallback 正确隐藏；因此比较聚焦 QR、footer、progress、quality 和 control surfaces，真实设备 autoplay/playsinline/pause-resume 仍按下方清单验收。

Current coverage：

- `[x]` Query normalization、room ids、reducer rules。
- `[x]` Room commands、WebSocket validation/runtime。
- `[x]` KV keys/family/recommendations/size policy。
- `[x]` Search family、ranking、rate limit、YouTube parsing。
- `[x]` Pacific quota reset、本地时区显示、restart player state。
- `[x]` Display item-key progress isolation、0-second next；Mobile dedicated 30-second preview URL。
- `[ ]` Main Worker route integration。
- `[ ]` DO storage/alarm integration。
- `[ ]` Playwright E2E。

### Production checkpoints

| Date | Result |
| --- | --- |
| 2026-06-25 | Create/snapshot、D1、JOIN/PING、multi-client、queue commands、real search/cache verified。 |
| 2026-06-26 | Main `369207c2-9359-4b4d-914c-937c4e0f4729`；Room `0df7e1b2-7a47-4ab5-a14f-b38d90b09e9e`。 |
| 2026-07-02 | Main `628c4f22-35e0-481b-8ef4-4be952fc644f`；Room `e893a72f-b718-43a7-adc8-60bd63c6444c`。 |
| 2026-07-03 pass 1 | Main `036c62e4-0999-4cf1-a034-083664f2e97e`；Room `fd9accc1-1c03-42d0-a200-2790d1febf0a`。 |
| 2026-07-03 pass 2 | Main `b3a43603-2208-4a4e-816c-72212d8de3d2`；Room unchanged。 |
| 2026-07-13 pass 3 | Main `e7fc338f-11ff-42b9-9523-df64de2a06c6`；Room `92c36603-e923-4665-b334-d10cadd28f78`。 |
| 2026-07-14 pass 4 | Main `ce2a851c-9f79-4fd3-ac70-337219ccbc13`；Room unchanged。 |
| 2026-07-15 pass 5 | Main `bd5c8ece-23f3-4abe-97d4-fad3891a0fc1`；Room `9ec6503c-07cb-4a7c-8ff0-4236ab934e19`。 |
| 2026-07-15 pass 5 follow-up | Main active deployment `c942af48-74f2-44c7-bf2d-17f35ae734ef`；Room active deployment `362b4d10-476e-47da-bb10-cf3c10716ca9`。 |
| 2026-07-21 pass 6 release | Main `aa2aa657-62a2-4b8d-93ec-d7ca508dab25`；Room `dc38a381-b95c-4cc7-914a-91f8fc952ec0`。 |

Last local pass-4 smoke room `3r512238`：create CTA、mock search、单 iframe preview `start=30`、两首点歌、restart 保持当前 item、next 推进第二首且 progress value 为 `0`。Create 已确认 390×844 无横向 overflow、1280×720 无页面滚动；Display 已确认 dark 140px QR、无画质 selector、三键 panel。

Production pass-4 smoke room `362x7342`：fresh D1 room 创建成功、WebSocket `实时已连接`、quota 50/50、QR Canvas 140px、画质 selector count 0、无 console error。

Production pass-5 smoke room `113f4j5h`：production root HTTP 200；create API 与 snapshot room id 一致，D1 display name 为“这台 Windows 电脑的 K 歌房”；线上 CSS 包含 `create-room-gradient`；quota endpoint 正常返回剩余 49。

Production pass-5 follow-up smoke room `3n2j6g1j`：root、display、mobile 均 HTTP 200；create response 与 D1 snapshot display name 均为中性“K歌房”；HTML `theme-color=#020617`，线上 CSS 包含 `app-no-select` 和 dark scrollbar；空查询返回 10 条 cached recommendations，quota 48/50。WebSocket `ADD_QUEUE_ITEM` 后 snapshot current video 为 `OKjmFVeIG8s`；远端 KV 首位先确认同一 video，公开 recommendation API 在最终一致性传播后也返回同一首，证明 queued-song promotion 已上线。

Production pass-6 smoke room `4a1d0n6a`：root、display、mobile 均 HTTP 200，create response 与 snapshot room id 一致。UTF-8 `年少有为` 歌名搜索在 KTV/原唱 intent 各返回 5 条相关结果并共享 5 个 video id，两次均命中同一 cache 且 quota 保持 98/100；`童话 光良` live fill 返回 25 条后，KTV/原唱重复搜索均 `cached=true`、共享 25 个 id，quota 保持 96/100。WebSocket 收到 `ROOM_SNAPSHOT`、`PONG` 和 cold fill 后的 `YOUTUBE_QUOTA_UPDATED`；quota endpoint 确认 daily limit 100。

Known limitation：本轮已在本地浏览器完成 responsive smoke，但测试视频在自动化环境返回 YouTube error 150；失败 iframe 已隐藏，仍不替代真实设备 autoplay/playsinline/pause-resume QA。YouTube 原生 title/avatar/branding 可能按官方策略出现，app 不遮挡或伪装。

## 5. Remaining work

### P0 — Admin baseline release

- `[x]` 完成 1440×1024 reference/implementation 同屏视觉对照并关闭 P0/P1/P2 finding。
- `[x]` 完成 390×844 管理台 responsive browser smoke。
- `[x]` 完整 typecheck、test、production build、双 Worker dry-run 和 `git diff --check`。
- `[ ]` 确认 production admin secrets、应用 D1 migration，按 Room → Main `--keep-vars` 发布。
- `[ ]` 验证 production 未认证保护、管理员登录、真实总览/资料库和现有公开 K 歌流程，并记录真实版本 ID。

### P0 — Real-device acceptance

- `[ ]` Mobile Safari：QR、sticky UI、preview、playsinline、queue。
- `[ ]` Android Chrome：search/load-more、preview、sync/reconnect。
- `[ ]` iPad Safari：orientation、layout、iframe。
- `[ ]` Desktop Chrome：autoplay、restart、pause/resume、seek、auto-advance。
- `[ ]` Two real mobile clients concurrent queue operations。

每个平台至少：fresh room、点两首歌、display sync、restart、pause/resume、manual next、natural end、debug snapshot。

### P1 — Tests and preview robustness

- `[ ]` Router request/response integration tests。
- `[ ]` DO storage、alarm、socket count、D1 recovery tests。
- `[ ]` Playwright create → search → queue → display flow。
- `[ ]` Injected-clock inactivity test。
- `[ ]` 真实 YouTube iframe unavailable/slow-load UX 验收。
- `[ ]` Mobile autoplay/playsinline guidance。

### P2 — Search evolution

- `[ ]` Observe family hits、payload size、age、quota drift。
- `[ ]` Decide exact-query vs song-family vs artist-catalog boundary。
- `[ ]` Curated Chinese/pinyin/English aliases and typos。
- `[ ]` Optional cache inspection/prewarm tooling。
- `[ ]` Real KV cost-based eviction。
- `[ ]` Multi-source query only under daily/per-fill caps。
- `[ ]` 自动搜索/自动补库：在明确触发、quota budget、去重、审计和停止策略后再设计实施。
- `[ ]` 资料库自动清理：先提供阈值预览和保留策略，不直接按估算容量静默删除。
- `[ ]` 并发 exact miss 请求合并，进一步减少相同查询同时触发外部 API 的机会。

### P3 — Tooling

- `[ ]` Evaluate ESLint/Prettier。
- `[ ]` 在未来 dependency upgrade 时 opt into 或消除 React Router v7 future-flag warnings。
- `[ ]` Evaluate automatic deploy；before that, push and deploy remain separate。

## 6. Documentation rules

- README explains how the system works and how to operate it。
- Progress records what is complete, verified, and pending。
- 常规产品文档仍只维护 README/PROGRESS；`design-qa.md` 仅作为本轮 Product Design 强制验收记录。
- 不再为小修改创建新的 Markdown logs。
- 新修复更新现有 phase/table，不追加互相矛盾的 update notes。
- Production version 只在真实 deploy 后更新。
- Test counts 只在完整 suite 实际运行后更新。
- Pure docs changes do not redeploy。
