# Project Progress

Last updated: 2026-08-01

这份文件记录 implementation status、历史修复、验证结果和剩余工作。系统设计、search details、手动配置、部署和测试步骤见根目录 `README.md`。

## 1. 当前状态

| Area | Status | Summary |
| --- | --- | --- |
| Repository | Complete | GitHub 已改名为 `bradwang1995/Karaoke-Assistant`，local origin 已更新。 |
| Product MVP | Complete | Create、display、mobile、debug 全流程可用。 |
| Cloudflare backend | Complete | Worker + Assets、D1、KV、Durable Object 已上线。 |
| Realtime queue | Complete | WebSocket commands、broadcast、persistence、reconnect 已完成。 |
| YouTube search | MVP complete | Live API、算法版本化 exact family cache、2 秒 UX 硬截止、单次 cold provider call、部分结果返回、KTV/原唱 intent ranking、推荐、rate limit、quota，以及不展示提示的单视频 URL 兜底已完成。 |
| Admin console | Production complete | 简洁暗色总览、搜索记录、资料库管理与认证已完成，并已发布到生产环境。 |
| Cloudflare storage metrics | Production complete | D1 `file_size`、KV Analytics bytes/key count、服务端缓存、过期回退和 UI 已发布；生产 token、管理员登录与 Dashboard 同刻对照均已完成。 |
| Persistent search repository | Production complete | D1 作为无 TTL 的真实资料源，KV 继续作为加速层；精确查询复用、访问统计、手动删除和存储压力清理已上线。 |
| Mobile preview | MVP complete | 2–4 列、选中即激活单 IFrame Player、静音自动播放并从 30 秒显式 load/seek/play、spinner/timeout fallback 已完成。 |
| Display player | MVP complete | Autoplay、0 秒切歌、restart、pause/resume、seek、auto-advance 已完成；画质由 YouTube 自适应。 |
| Reliability | MVP complete | Heartbeat、5-minute cleanup、debug、fallback policy 已完成。 |
| Automated tests | 26 files / 129 tests | 两秒客户端截止、Worker 部分结果、provider 限流降级、单视频 URL、preview、search、Admin、quota 等 regressions 全部通过；DO storage 和端到端测试待补。 |
| Real-device QA | Pending | Safari、Android、iPad、Desktop Chrome 待正式验收。 |
| Documentation | Complete | `README.md`、`PROGRESS.md` 已纳入本轮功能；`DESIGN-QA.MD` 记录本轮强制视觉验收。 |

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
- `[x]` Admin D1 存储改用 Cloudflare Client API `file_size`，不再使用 SQL `meta.size_after` 作为权威值。
- `[x]` Admin KV 存储改用 GraphQL `kvStorageAdaptiveGroups` 的 `byteCount/keyCount`，与 D1 独立展示。
- `[x]` 指标最近成功值持久缓存、5 分钟调用控制、30 秒并发 lease、partial success 和 stale fallback。
- `[x]` Production D1 已应用 `0004_cloudflare_storage_metrics.sql`；复核无待应用 migration，两个新表均存在。
- `[x]` 按 Room → Main `--keep-vars` 发布：Room `8ee39e12-4618-4948-81d0-f753158a4046`、Main `ba476a0f-0583-431b-ba68-9d1b43d33c52`，均为 100% active。
- `[ ]` Main Worker `CLOUDFLARE_API_TOKEN`（D1 Read + Account Analytics Read）尚未在 secret 列表中确认；线上会安全显示“暂时无法获取”，不会伪造实际值。

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
- `[x]` Deterministic aliases、当前 KTV/原唱意图 focused source query、family hash。
- `[x]` Cold search 只发一个精准 intent `search.list`；Worker 1600ms、浏览器 2000ms 截止，到时返回当前部分结果。
- `[x]` Duration/category/tags/status enrichment、dedupe；严格拒绝 7 分钟及以上与非音乐视频。
- `[x]` Song title 与 artist metadata 严格相关性门槛；通过后再做 KTV/伴奏或 lyrics/original/audio/radio ranking。
- `[x]` Partial-title regression coverage。
- `[x]` KV v4 exact family cache、v2 recommendations、metadata、payload pruning；历史 v2 normalized index 不再读写。
- `[x]` Recommendation pool 和 cached re-ranking。
- `[x]` 原始 embeddable candidates 与用户可见结果分离；D1 候选目录只被动统计，不参与在线搜索。
- `[x]` 只复用算法版本、完整规范化文字、artist、song/artist 和 original-vocal 全部相同的唯一 family；不再用其余三个选项 family 补充，也不读取不同文字或全局目录。
- `[x]` API 50 results；mobile 10-at-a-time expansion。
- `[x]` Recommendation pool 200 results；缓存耗尽前自动无限滚动。
- `[x]` 显式提交时原唱使用独立 intent queries、准入门槛与权重；各选项保持完全隔离的 exact family。
- `[x]` 20/min 节流；超限返回正常 `throttled` partial response，Mobile 保留当前结果，不再暴露搜索 HTTP 429。
- `[x]` Project quota 100/day、最多 1 call/fill、每次 outbound call 前预留、Pacific reset、status API 和 room WebSocket 即时额度推送。
- `[x]` Real YouTube result + repeat-query cache hit verified。
- `[x]` 不展示提示的 YouTube 单视频 URL 兜底；严格拦截其他 URL，绕过原搜索 family、资料库、ranking 与 `search.list` quota ledger。

### Phase 5 — Mobile search and preview

- `[x]` Default recommendations。
- `[x]` 固定 header/search/footer 外壳；结果容器独立滚动并保存 `scrollTop`。
- `[x]` 24-hour per-room search state。
- `[x]` Queue tab URL persistence。
- `[x]` Portrait 2-column、wide/landscape 3–4-column compact previews。
- `[x]` One active adaptive-quality preview iframe；固定从 30 秒开始，click outside stops。
- `[x]` 选中即激活、`autoplay=1 + mute=1 + start=30`、loading spinner、10s slow-load retry hint。
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
- `[x]` 总览提供系统状态、YouTube 当日调用与 Pacific reset、资料库真实容量状态、候选采集与精确复用效率、搜索趋势、热门歌曲/歌手和系统提醒。
- `[x]` 搜索记录支持时间、来源、类型和关键词筛选，以及服务端分页。
- `[x]` 资料库支持关键词/类型/原唱状态筛选、排序、分页、结果摘要、批量选择和二次确认删除。
- `[x]` D1 `search_repository_entries` 作为持久真实资料源；精确标准化查询优先复用，KV 仅保留为可过期加速层。
- `[x]` D1 `search_video_catalog` 被动记录外部候选与增长指标；FTS5 与 triggers 已移除，在线搜索不读取该表。
- `[x]` 搜索事件、资料库访问次数、每日 YouTube quota ledger 和管理员审计事件均持久化到 D1。
- `[x]` 冷查询和旧 KV 命中可回填 D1；资料库故障不会阻断公开搜索的安全 fallback。
- `[x]` 管理 API 覆盖 session、overview、searches、repository read/delete；未认证读取也返回 `401` 与 `no-store`。
- `[x]` Recharts 仅随 `/admin` chunk 加载，公共 K 歌入口不承担图表 bundle。
- `[x]` 本地 migration、登录、总览、筛选、空状态、真实资料行、选择、删除确认和删除操作已通过浏览器验证。
- `[x]` 存储压力清理支持只读预览、低复用/最久未用/最早创建排序、最多 50 条有限批次、短期并发 lease、二次确认、KV 同步清除、success/partial/failure 审计与最近历史。
- `[x]` Live YouTube search 在 outbound request 前原子预留 D1 quota；provider 随后失败时仍保留可能已消耗的调用，最终一个额度不能被两个实例同时预留。
- `[x]` 桌面 reference/implementation 同屏对照、移动端 viewport、全量自动验证和双 Worker dry-run 已通过。
- `[x]` Production migration、secrets、Room → Main release、公开流程和未认证保护 smoke 已完成。
- `[~]` 管理员密码由用户独立持有；生产登录页和 secret 已确认，登录后的真实数据终验交由管理员本人完成。
- `[x]` 用户触发搜索会积累 exact response cache 和被动候选统计；只在同一完整文字与 artist 的四个 option families 内复用。
- `[ ]` 无人值守 prewarm/自动搜索仍未启用。

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
| ADM-08 | P0 | 补齐 storage-pressure cleanup：必须先预览，策略与候选可见；执行前二次确认，服务端持有 60 秒 lease，按配置 batch 删除并记录 before/after、affected count、target outcome 和 failure。自动执行仍关闭。 |
| ADM-09 | P0 | Quota 从“成功后记账”强化为“请求前原子预留”；失败后的可能消耗不丢失，并发最终额度只允许一个 D1 reservation。无耐久 ledger 时不发送无法追踪的 live search。 |
| ADM-10 | P0 | 完成存储路径 discovery：D1 保存房间、队列、播放状态、持久搜索 response、搜索事件、quota、audit 与 admin 指标缓存；KV 保存 `yt-search:v3` family、`yt-search-index:v2`、recommendations 和 D1 异常时 quota fallback；DO 只保存房间 activity 并通过 D1 恢复业务 snapshot。 |
| ADM-11 | P0 | 新增服务端 Cloudflare 指标 client：D1 调用 database details API 的 `file_size`；KV 调用 GraphQL `kvStorageAdaptiveGroups` 的 `byteCount/keyCount`。响应只返回标准化值、来源、新鲜度和安全错误，不返回 token、account/resource ID 或原始 provider body。 |
| ADM-12 | P0 | D1/KV 使用量与容量完全分离；未找到返回当前 account 真实 D1/KV capacity limit 的支持接口，因此不按 plan 名称硬编码上限。可选 `D1_CAPACITY_LIMIT_BYTES` / `KV_CAPACITY_LIMIT_BYTES` 明确标记为“运维配置”。 |
| ADM-13 | P0 | `migrations/0004_cloudflare_storage_metrics.sql` 保存最近成功指标和 refresh lease；provider 部分失败保留另一资源，失败后继续显示最近成功值并标记过期，从未成功显示“暂时无法获取”。 |
| ADM-14 | P1 | 保留用户选定的现有暗色界面与三项导航，仅在持久资料库卡片、系统提醒和清理预览中补充 D1/KV 实际值、key count、来源、测量时间和 app estimate 区分；全局刷新会强制服务端重新验证 Cloudflare。 |
| ADM-15 | P0 | 完成生产管理员登录与 Dashboard 终验：D1 `278,528 bytes` 对应 Admin `272.0 KB` / Dashboard `279 kB`；KV `1,297,755 bytes`、`413` 个键对应 Admin `1.2 MB / 413` / Dashboard `1.3 MB / 413`。差异仅为单位换算。 |

### 2026-07-28 cross-query catalog pass 7

| ID | P | Completed |
| --- | --- | --- |
| SRCH7-01 | P0 | 新增 D1 `search_video_catalog` 与 FTS5 external-content 索引；insert/update/delete triggers 保持目录和索引同步。 |
| SRCH7-02 | P0 | `search.list` 原始 embeddable candidates 全部进入目录；现有 title relevance 与 KTV/原唱 scoring 只把相关结果交给用户。 |
| SRCH7-03 | P0 | Exact repository/KV miss 后先查跨查询目录；本地至少有 `min(limit, 10)` 条时不调用 YouTube，不足时外部补齐、去重、重排并持久化。 |
| SRCH7-04 | P1 | 搜索事件新增候选数、过滤后数、目录结果、新增独立视频、真实 search calls 与免调用标记；新增数使用 D1 insert `changes`，避免把重复视频算作增长。 |
| SRCH7-05 | P1 | Admin 总览新增候选目录与额度效率卡，显示总视频、累计出现、本地复用率、免调用、新增候选/额度和过滤前/后。 |
| SRCH7-06 | P0 | Migration 0005 已在本地 D1 成功执行 14 条命令；真实 FTS5 中文 `MATCH`、trigger insert 与 join 返回通过。定向 6 files / 31 tests 和 typecheck 已通过，完整发布验证见 verification record。 |

### 2026-07-28 exact-query rollback pass 8

用户实际体验推翻了 pass 7 的跨查询提前返回策略；下列项目明确取代 SRCH7-01、SRCH7-03 和相关复用文案。

| ID | P | Completed |
| --- | --- | --- |
| SRCH8-01 | P0 | Cache identity 改为完整规范化搜索文字 + artist + song/artist mode + original-vocal flag；只折叠大小写、首尾和连续空格，不再把 `后来` 与 `后来 KTV` 视为同一查询。 |
| SRCH8-02 | P0 | D1 只查 exact repository，KV 只查 exact family hash；删除 normalized index fallback、KTV/原唱双 family 合并、候选目录检索和本地 10 条提前返回。 |
| SRCH8-03 | P0 | Exact miss 直接进入 YouTube cold search；一次仍最多获取 50 个 embeddable candidates，并把本次通过过滤的完整结果写入 exact D1/KV response。 |
| SRCH8-04 | P1 | 候选表仅保留被动增长/过滤统计；migration 0006 删除 FTS5 表和同步 triggers，避免无用索引写入。 |
| SRCH8-05 | P1 | Admin 改为“候选采集与精确复用效率”，明确在线搜索不扫描目录，精确复用条件完整可见。 |

### 2026-07-29 song-only same-text cache pass 9

本轮保留 pass 8 的“绝不扫描全局候选目录”，但把搜索文字提升为主要 identity：歌曲/歌手与原唱开关只在同一文字、同一 artist 的四个精确 family 之间作为次级选项复用。

| ID | P | Completed |
| --- | --- | --- |
| SRCH9-01 | P0 | YouTube `search.list` 限定 Music category 10；`videos.list` 同时读取 duration、category、tags 与 embeddable，未知详情、非音乐分类、恰好或超过 7 分钟的视频全部拒绝。 |
| SRCH9-02 | P0 | D1 用一次查询读取同一文字与 artist 的最多四个 option families，KV 并行读取四个精确 hash；当前选项优先，其余组合只用于补充并按当前意图重排，绝不扫描全局候选目录。 |
| SRCH9-03 | P0 | KV search/recommendation namespaces 升到 v4/v2；旧 D1/KV 结果缺少新歌曲资格 metadata 时 fail closed，避免历史旅游视频或超长视频继续返回。 |
| SRCH9-04 | P0 | Mobile 搜索开始即清空旧卡片与 preview，搜索按钮灰显并旋转，结果区持续显示歌曲筛选 spinner，直到新 response 到达。 |
| SRCH9-05 | P1 | D1 四 family 合并为单次读取；KV 四 key 并行；repository/KV touch、结果持久化、事件与 quota broadcast 使用 Worker `waitUntil`，同时保留候选新增指标的同步真实性。 |

### 2026-07-29 mobile preview playback restoration pass 10

| ID | P | Completed |
| --- | --- | --- |
| PREV10-01 | P0 | Mobile preview 从仅依赖 iframe URL 参数改为 IFrame Player API；ready 后先静音，再从 30 秒显式 load、seek、play，并做 250ms/900ms 短重试。 |
| PREV10-02 | P0 | Spinner 只在收到真实 `PLAYING` 后消失，不再把 iframe `onLoad` 误当作已播放；error/autoplay blocked/10 秒 timeout 统一进入可重试状态。 |
| PREV10-03 | P1 | 保留 600ms 防误触、单 active preview、点击外部停止、无 native controls 与 adaptive quality；新增调用顺序 regression test。 |

### 2026-07-30 search relevance and immediate preview pass 11

本轮修复 pass 9 跨 family 补充造成的相关性回归，并以用户当前要求取代 pass 10 的 600ms preview debounce。

| ID | P | Completed |
| --- | --- | --- |
| SRCH11-01 | P0 | 歌名模式只接受标题命中；歌手模式拒绝 title/channel/tags 都不含目标歌手的候选。跨 family cache 只能补充通过当前查询门槛的候选，不能再让其他歌手或 channel-only 结果进入前列。 |
| SRCH11-02 | P0 | 非原唱首个 YouTube source query 明确使用 focused text + `ktv`，只保留带 KTV/卡拉OK/karaoke/伴奏/instrumental 标记且没有明确 original/原唱的候选；原唱首个 query 使用 focused text + `lyrics`，只保留标题带 lyrics/歌词、原唱、MV、official、audio/radio 标记的候选。 |
| SRCH11-03 | P0 | 同文字 cache 仍稳定复用并重新按当前意图排序；若旧 family 存在但严格相关性过滤后为零，则执行一次精准 cold refill 修复坏缓存，不把无关结果永久复现。 |
| PREV11-01 | P0 | 选中候选卡立即激活唯一 preview，移除 600ms debounce；iframe 初始化使用 `autoplay=1`、`mute=1`、`start=30`、`playsinline=1`，ready 后继续显式 mute/load/seek/play。 |

### 2026-08-01 quality-first 50-result search and verified 30-second preview pass 12

2026-07-30 的 production acceptance 被用户真实使用推翻：`林俊杰` 歌手查询仍被旧缓存固定为 8/8，preview 虽带 `start=30` 参数却仍可能从 0 秒开始。本轮不沿用 pass 11 的完成结论，重新以实际结果数量和播放器真实 current time 为验收依据。

| ID | P | Implemented locally |
| --- | --- | --- |
| SRCH12-01 | P0 | Exact cache identity 加入搜索算法版本，只读取相同文字、artist、模式和原唱开关的唯一 family；不再跨四个 option family 混合，旧算法的 8 条缓存不会命中新版。 |
| SRCH12-02 | P0 | Cold fill 从“一次 search 后直接缓存”改为优先沿精准 intent query 的 `nextPageToken` 翻页、再按其他 intent source query 继续补量；每轮执行 metadata/资格/相关性过滤，过滤后达到 50 条才停止，默认质量补量上限从 1 次提高到 12 次。 |
| SRCH12-03 | P0 | 歌手普通模式扩充 KTV/karaoke/伴奏/卡拉OK/pinyin/instrumental 查询；歌手原唱模式扩充 lyrics/歌词/MV/official audio/radio，并允许明确匹配歌手且无 KTV/伴奏/cover 冲突的普通原唱歌曲。 |
| SRCH12-04 | P0 | 首次生产 smoke 揭示 D1 repository 读取虽构建了新版 hash，却只按文字/artist/options 找旧 row；读取路径现强制 `family_hash` 与当前算法版本化 hash 完全相同，旧 8 条 row 会 cold refill 并由现有唯一键原位升级。 |
| PREV12-01 | P0 | IFrame 初始化恢复 `autoplay=0`，阻止视频在 ready 前从 0 秒抢先播放；ready 后显式 mute → load at 30 → seek 30 → play，收到 `PLAYING` 时还必须确认 `getCurrentTime() >= 29`，否则继续 seek，不能提前结束 loading。 |

### 2026-08-01 two-second search UX and graceful throttling pass 13

用户实际使用确认 pass 12 为补满 50 进行最多 12 次顺序外部调用，搜索时间过长并开始出现 429。本轮以用户体验取代“必须补满 50”：两秒是硬上限，到点返回当前结果，不能为了数量继续等待。

| ID | P | Implemented locally |
| --- | --- | --- |
| SRCH13-01 | P0 | Cold family 从最多 12 次降为 1 次精准 `search.list`；新增 `YOUTUBE_SEARCH_TIMEOUT_MS=1600`，所有 YouTube search/details fetch 共享 deadline 和 AbortController。 |
| SRCH13-02 | P0 | 详情在 deadline 前完成则保持 Music/时长/embeddable 严格验证；详情超时时立即用已发现标题做 query/intent 过滤并返回，但未验证结果不持久化。 |
| SRCH13-03 | P0 | 浏览器 fetch 在 2000ms 主动 abort；搜索期间保留当前卡片和选择，超时、应用节流或 provider 429 没有新结果时继续显示当前结果。搜索按钮仍按既有 click-outside 规则停止当前 preview。 |
| SRCH13-04 | P0 | 应用 20/min guard 不再返回破坏 UI 的 HTTP 429，改为 `throttled` partial response；YouTube 429 也转换为可解释的部分响应，且单次 cold call 显著降低 provider 压力。 |

### 2026-08-01 quota exhaustion clarity pass 14

生产 `/api/youtube/quota` 实测为 `100/100`、`remaining=0`、`exhausted=true`，重置时间 `2026-08-02T07:00:00Z`；这不是两秒 timeout 或房间级 429。相同生产时刻，已缓存的 `林俊杰 / 歌手 / 非原唱` 仍由 repository 返回 50 条且 `externalCallAvoided=true`，证明受影响的是 cold miss。

| ID | P | Implemented locally |
| --- | --- | --- |
| SRCH14-01 | P0 | Mobile 把零结果且 `quota.exhausted=true` 视为可恢复的部分响应；已有卡片继续显示并给出重置倒计时，不再被空 response 替换。 |
| SRCH14-02 | P0 | 没有已有卡片时显示持续可见的“今日搜索额度已用完”和恢复倒计时，并说明已缓存的相同搜索仍可用，不再显示误导性的“没有找到合适的视频”。 |

### Admin storage discovery（2026-07-25）

- 旧管理页面约 `192.0 KB` 的来源已定位：`getAdminOverview()` 执行资料库聚合 SQL 后读取该 statement 的 `D1Result.meta.size_after`。它通常接近整个 D1 文件大小，但不是 Cloudflare database details 管理 API，因此本轮已从 UI 与清理判断移除。
- 2026-07-25 只读 `wrangler d1 info ktv-assistant-db` 报告 production `database_size = 197 kB`、10 tables；应用 migration 0004 与后续指标刷新后，2026-07-26 同刻生产对照为 D1 API `278,528 bytes`、Dashboard `279 kB`、12 tables。
- D1 是真实持久资料源：`rooms`、`queue_items`、`playback_states`、`playback_events`、`search_repository_entries`、被动 `search_video_catalog`、`search_events`、`youtube_quota_daily`、`admin_audit_events`、cleanup/metric leases 与最近成功 metric state。
- KV `SEARCH_CACHE` 是可丢失加速层：`yt-search:v4` exact family payload、`yt-search-recommendations:v2`，以及 D1 quota ledger 异常时的 quota fallback。历史 `yt-search:v3`、`yt-search-recommendations:v1` 与 `yt-search-index:v2` key 不再读写并等待 TTL 自然过期。
- `RoomDurableObject` 的 Durable Object storage 只保存 `room-activity` lifecycle state；房间业务 snapshot 读写 D1，queued recommendation 会写 KV。
- Main/Room 使用同一 production D1/KV IDs；仓库没有 `env.preview` / `env.production` 分叉，也没有此前 Cloudflare storage metrics client。Main Worker 是唯一公开 admin API 和唯一需要 Cloudflare read-only token 的 Worker。

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
| 2026-07-21 admin storage protection | Typecheck、full 20 files / 82 tests、production build、Wrangler 4.105 Room/Main 双 dry-run 和 `git diff --check` passed。Local D1 应用 migration 0003；内置浏览器实际完成越线 preview → 二次确认 → 删除 1 条 → partial outcome → 空资料库刷新，D1 audit 为 `cleanup_repository/success/partial/affected_count=1`。1440×1024 与 390×844 均无横向页面溢出或 console error/warning。 |
| 2026-07-22 admin production release | Full 20 files / 82 tests、typecheck、production build、`git diff --check` passed。Production D1 migrations 无待应用项；Wrangler 4.105 按 Room → Main 顺序以 `--keep-vars` 发布，deployment status 复核两个新版本均为 100%。Production root/admin HTTP 200，未认证 overview 为 401 + `no-store`；UTF-8 冷查询返回 10 条，重复查询命中 repository 且 quota 不增加；内置浏览器完成登录页、create CTA → display、连接状态和 console smoke。 |
| 2026-07-25 real storage metrics release | Full 21 files / 88 tests、typecheck、production build、Wrangler 4.105 Room/Main 双 dry-run passed。Local 与 production D1 均已应用 migration 0004；production 复核无待应用 migration，两个指标表真实存在。按 Room → Main `--keep-vars` 发布，Room `8ee39e12-4618-4948-81d0-f753158a4046`、Main `ba476a0f-0583-431b-ba68-9d1b43d33c52` 均为 100%。Production root/admin 为 200，未认证 storage 为 401 + `no-store`；线上登录页加载正常且 console 无 error/warning。生产只读 token 和登录后的 Dashboard 数值对照尚待完成。 |
| 2026-07-26 real storage metrics acceptance | Main Secret 更新生成活动版本 `45fc80db-0a8c-4037-a51c-18b003b618d6`，deployment status 为 100%。管理员登录生产 `/admin` 后强制刷新成功：D1 `278,528 bytes`、KV `1,297,755 bytes / 413 keys`，缓存无错误码；Cloudflare Dashboard 同刻显示 D1 `279 kB / 12 tables`、KV `1.3 MB / 413`。生产页面无横向溢出，console 无 error/warning。最终复跑 full 21 files / 88 tests、typecheck、production build、Room/Main 双 dry-run 和 `git diff --check` 均通过。 |
| 2026-07-28 cross-query catalog local | Targeted 6 files / 31 tests、full 22 files / 92 tests、typecheck、production build、Wrangler 4.105 Room/Main 双 dry-run 和 `git diff --check` passed。Local D1 migration 0005 执行 14 条命令；真实 FTS5 中文 `MATCH`、trigger insert 与 join 返回通过。内置浏览器在 1440×1024 验证新效率面板、无横向 overflow、console 无 error/warning；390×844 DOM 仍无页面级横向 overflow 且面板存在，但本次 full-page capture 出现现有侧栏文字压缩，因此不重新宣称移动端视觉终验。 |
| 2026-07-28 exact-query rollback local | Targeted 5 files / 25 tests、full 22 files / 92 tests、typecheck、production build、Wrangler 4.105 Room/Main 双 dry-run 和 `git diff --check` passed。Local D1 migration 0006 执行 5 条命令，保留 `search_video_catalog` 基础数据并删除 FTS5 表和 3 个同步 triggers。内置浏览器在 1440×1024 与 390×844 验证“候选采集与精确复用效率”文案；旧 10 条门槛与在线跨查询文案不存在，两种 viewport 均无页面级横向 overflow，console 无 error/warning。 |
| 2026-07-28 cross-query catalog production release | Production D1 migration 0005 执行 14 条命令并复核无待应用项。Wrangler 4.105 按 Room → Main 顺序以 `--keep-vars` 发布；Room `fdf83e2b-69ad-4ea8-a00c-5d2e58c760f3`、Main `79f4ffaa-93b8-48b7-b35e-becbc62b20a8` 均为 100%。Production root/admin 为 200，未认证 overview 为 401 + `no-store`。一次 UTF-8 冷搜索用 1 次额度取得 50 个原始候选、过滤后 44 条并新增 50 个目录视频；精确复用与跨查询复用分别返回 44/43 条，额度保持 1，后者由 FTS5 目录返回且 `sourceQueryCount=0`。 |
| 2026-07-29 exact-query rollback production release | Production D1 migration 0006 执行 5 条命令；候选基础表保留 247 条，FTS5 表和 3 个同步 triggers 均已删除，并复核无待应用 migration。Wrangler 4.105 按 Room → Main 顺序以 `--keep-vars` 发布；Room `8317ea66-8de7-4177-80ad-bed8622ece20`、Main `8326d942-3a08-4253-84c5-eee8c696442a` 均为 100%。Production root/admin 为 200，未认证 overview 为 401 + `no-store`；线上 Admin chunk 与本地 build SHA-256 完全一致。UTF-8 `后来 + 刘若英` 冷查询、原唱 flag 变体和 `后来 KTV` 文字变体各自调用 1 次 external 并返回 26 条；两个 exact repeats 均由 repository 返回 26 条、0 次 external，quota `0 → 3`，所有事件 `catalogResultCount=0`。 |
| 2026-07-29 song-only same-text cache local | Targeted 7 files / 39 tests、full 23 files / 99 tests、typecheck、production build、Wrangler 4.105 Room/Main 双 dry-run 和 `git diff --check` passed。内置浏览器在 390×844 通过 1.2 秒受控延迟验证：已有 8 张结果卡时提交下一次搜索，卡片立即变为 0、结果区 `aria-busy=true`、搜索按钮 disabled 且 spinner 文案可见；response 到达后恢复 8 张卡片。页面 `scrollWidth=clientWidth=390`，console 无 error/warning。 |
| 2026-07-29 song-only same-text cache production release | Production migration 复核为无待应用项；Wrangler 4.105 按 Room → Main 顺序以 `--keep-vars` 发布，Room `4d1dfa72-9a84-48b8-9a1e-538075dc0108`、Main `ae0f1f0e-1c4c-4672-a1ef-667cdff1b644` 均为 100%。Production root/admin 为 200，未认证 overview 为 401 + `no-store`。`甜甜的 + 周杰伦` 冷查询由 external 返回 28 条，全部 category 10 且 `0 < duration < 420`；改为 artist + 原唱后由 repository 返回 28 条，`servedFromExpandedCache=true`、`sourceQueryCount=0`、`externalCallAvoided=true`，quota 仅 `6 → 7`。生产内置浏览器 390×844 显示实时已连接、10/28 条推荐，无横向 overflow，console 无 error/warning。 |
| 2026-07-29 mobile preview playback restoration local | Focused YouTube helper 1 file / 4 tests、full 23 files / 100 tests、typecheck、production build、Wrangler 4.105 Room/Main 双 dry-run 与 `git diff --check` passed。内置浏览器 390×844 实际点选卡片后只创建一个 `enablejsapi=1` iframe，参数为 `autoplay=0`、`start=30`、`playsinline=1` 和正确 origin；API helper 回归测试确认 ready 后调用顺序为 mute → load at 30 → seek 30 → play。本地 mock 视频在自动化环境返回既有 error 150，因此本地记录没有虚报真实 PLAYING；生产真实结果另行通过。 |
| 2026-07-29 mobile preview playback restoration production release | Production migration 无待应用项；Wrangler 4.105 按 Room → Main、`--keep-vars` 发布，Room `fe4cf8b8-bdcb-4bcd-8837-0a7e8e1dccad`、Main `1777984c-d2e9-4ed1-9891-93136c86ab18` 均为 100%。生产内置浏览器 390×844 加载 `index-Bj8oiKxj.js`，实际点选后恰有一个 iframe，参数包含 `autoplay=0`、`enablejsapi=1`、`start=30`、`playsinline=1` 与正确 production origin；spinner 随真实 `PLAYING` 消失且 player 保持可见，页面无横向 overflow，console 无 error/warning。 |
| 2026-07-30 search relevance/immediate preview local | Focused 4 files / 26 tests 与 full 23 files / 103 tests passed；typecheck、production build、Wrangler 4.105 Room/Main 双 dry-run、`git diff --check` passed。全新内置浏览器本地房间实际搜索 `后来` 并点选第二张卡，选中项立即切换且只创建 1 个 iframe；参数为 `autoplay=1`、`mute=1`、`start=30`、正确 autoplay allow。Mock video id 按预期不可真实播放，因此本记录只确认即时激活和播放器参数，不虚报真实 `PLAYING`。 |
| 2026-07-30 search relevance/immediate preview production release | 源码提交 `5c874f1`、`5174a7c` 已推送 `origin/main`。Wrangler 4.105 按 Room → Main、`--keep-vars` 发布并复核活动部署为 Room `07acd0da-0406-4a91-9836-3cd8c6dfb05a`、Main `0521d5c3-f17f-4f6e-9fe7-7967566748d1`，流量均为 100%。生产 API 房间 `2w002z6x`：`单依纯` 非原唱仅返回本人相关 KTV 结果且无黄小琥；`后来` 非原唱 3 条全部为 KTV/karaoke；原唱冷查询以 `后来 lyrics` 返回 11 条有声/歌词候选，前四条均为目标歌曲，完全相同查询随后命中 repository、结果 ID 顺序一致且 `sourceQueryCount=0`。全新生产内置浏览器 390×844 选择首条刘若英歌词结果后仅有 1 个 iframe，参数含 `autoplay=1`、`mute=1`、`start=30`、`playsinline=1` 和 autoplay allow；真实 `PLAYING` 后 loading 消失，无预览错误、横向 overflow 或 console error/warning。 |
| 2026-08-01 quality-first search/verified preview local | 用户截图推翻 pass 11 production acceptance 后重新实现。Focused 5 files / 37 tests、full 25 files / 126 tests、typecheck、production build 和 `git diff --check` passed。Provider regressions 同时证明同一精确 intent 会优先使用 `nextPageToken` 翻页补满、无下一页时会继续后续 intent query，D1 regression 证明旧算法 `family_hash` row 不会复用；preview regression 证明 current time 未达到 29 秒不会视为成功。Wrangler 4.105 Room/Main 均生成完整 dry-run bundle 和 bindings summary，确认 `YOUTUBE_SEARCH_MAX_CALLS_PER_FILL="12"`；用户级 Wrangler debug log 因沙箱 EPERM 无法写入，但两次 dry-run 均正常退出 0。全新内置浏览器 390×844 本地房间 `6v0s502o` 实际点选后只有一个 iframe，参数含 `autoplay=0`、`start=30`、`mute=1`、`enablejsapi=1` 和正确 localhost origin，页面无横向溢出且 console 无 error/warning；mock video 不作为真实播放证据。 |
| 2026-08-01 quality-first search/verified preview production release | 源码提交 `af2ac6a` 后首次 smoke 在同一生产请求重现旧 D1 8/8，随即定位并以 `faf0559` 修复 D1 读取未校验算法版本化 `family_hash`；两次提交均已推送 `origin/main`。最终按 Room → Main、`--keep-vars` 重新发布并复核活动流量为 Room `d430bdf5-8b93-4944-8c6c-733958e577b8`、Main `dab4441d-efda-4ba4-879f-6368e9116a60`，均为 100%。生产房间 `27205g6r`：林俊杰、周杰伦、邓紫棋的歌手普通与原唱模式六组均返回 50/50；普通模式前排为本人 KTV/karaoke/伴奏，原唱前排为本人歌词/原唱内容。林俊杰普通模式完全相同请求第二次由 repository 返回相同 50 个 ID、`sourceQueryCount=0`；全部 smoke 共用 29/100 calls。全新生产内置浏览器 390×844 点选“江南 KTV / 林俊杰”后只有一个 iframe，参数含 `autoplay=0`、`start=30`、`mute=1`、`enablejsapi=1` 和正确 production origin；真实 current time 为 `30.022` 秒后 loading 才消失，刷新恢复仍为单 iframe，页面无横向 overflow，console 无 error/warning。 |
| 2026-08-01 two-second search UX local | Focused 5 files / 28 tests、full 26 files / 129 tests、typecheck、production build、Wrangler 4.105 Room/Main 双 dry-run 与 `git diff --check` passed；bindings 确认为单次 cold call 与 `YOUTUBE_SEARCH_TIMEOUT_MS="1600"`。全新内置浏览器 390×844 本地房间 `674r4u00` 完成搜索和结果切换，preview 始终只有一个 iframe 且 URL 含 `start=30`、`enablejsapi=1` 和正确 localhost origin；页面 `scrollWidth=clientWidth=390`，console 无 error/warning。Mock video 不作为真实 `PLAYING` 证据。 |
| 2026-08-01 two-second search UX production release | 源码提交 `b5935eb` 已推送 `origin/main`。Wrangler 4.105 按 Room → Main、`--keep-vars` 发布并复核活动流量为 Room `22573249-9b01-41d5-8ced-74f5092e97bd`、Main `15c766a6-508c-4e2d-ae2e-1735fe081d6f`，均为 100%。生产房间 `5l6a0r2m` 的 `陶喆` 歌手非原唱 cold API 搜索 1198ms 返回 12 条目标 KTV/伴奏结果，只用 1 次 `search.list`，Worker provider elapsed 847ms；完全相同请求 291ms 从 repository 返回相同 12 条、`sourceQueryCount=0`。全新生产内置浏览器 390×844：repository 搜索 412ms；cold `张震岳` 1157ms 返回 4 条目标伴奏/KTV，cold `崔健` 1251ms 返回 4 条且 pending 期间仍显示上一批张震岳卡片；`许巍` 没有新结果时仍保留上一批卡片。实际点选陶喆结果后只有一个 iframe，参数含 `autoplay=0`、`start=30`、`mute=1`、`enablejsapi=1` 和正确 production origin；iframe 显示 Pause、app loading/retry 均消失，满足只有 current time 达到 29 秒才完成的 preview guard。页面 `scrollWidth=clientWidth=390`，console 无 error/warning。 |

### Admin console design QA（2026-07-21）

Final result：passed；没有遗留可执行的 P0、P1 或 P2 design finding。详细中文记录见根目录 `DESIGN-QA.MD`。

- Reference：用户选定的第三版深色 dashboard，并按要求进一步精简。
- Desktop：`1440×1024` 同屏比较；深色 tokens、侧栏、状态、双指标卡、趋势图和底部信息层级与参考方向一致。
- Mobile：`390×844`；页面 `scrollWidth=clientWidth=390`，搜索记录和资料库表格只在自身容器横向滚动。
- Interaction：总览、搜索记录、资料库导航与真实资料状态均通过；本轮之前已验证登录、筛选、选择、删除确认和删除。
- Console：最终桌面与移动验收均无 application error 或 warning。

### Real storage metrics design QA（2026-07-25）

Final result：production passed；没有遗留可执行的 P0、P1 或 P2 design finding。Main Worker 只读 token、生产管理员登录和 Cloudflare Dashboard 数值对照均已完成。

- Desktop：`1440×1000`；原有暗色布局和三项导航保持不变，D1、KV 与应用记录估算分层清晰。
- Mobile：`390×844`；`documentScrollWidth === documentClientWidth`，指标卡、筛选和清理预览无页面级横向溢出。
- Failure state：没有 token 时 D1/KV 分别显示安全不可用状态，不生成假体积、容量或百分比；清理执行入口保持关闭。
- Production data：D1 API `278,528 bytes` 与 Dashboard `279 kB` 一致；KV Analytics `1,297,755 bytes / 413 keys` 与 Dashboard `1.3 MB / 413` 一致。Admin 的 `272.0 KB / 1.2 MB` 使用二进制换算。
- Interaction：生产登录、手动刷新、三页导航和清理预览均通过；刷新后按钮恢复可用。
- Console：本地与生产均无 application error 或 warning。详细记录和本地截图路径见 `DESIGN-QA.MD`。

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
- `[x]` 搜索框 YouTube 单视频 URL 隐形兜底；普通文字算法不变，其他 URL 不发 search request。
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
| 2026-07-22 admin production release | Main `23be9233-b48a-4b1d-b788-236e3851c9f7`（100%）；Room `a3458d1b-f30b-4ba4-b4d6-07eb9f230b54`（100%）。 |
| 2026-07-25 real storage metrics release | Main `ba476a0f-0583-431b-ba68-9d1b43d33c52`（100%）；Room `8ee39e12-4618-4948-81d0-f753158a4046`（100%）。 |
| 2026-07-26 storage token acceptance | Main Secret-change version `45fc80db-0a8c-4037-a51c-18b003b618d6`（100%）；Room unchanged。 |
| 2026-07-29 exact-query rollback release | Main `8326d942-3a08-4253-84c5-eee8c696442a`（100%）；Room `8317ea66-8de7-4177-80ad-bed8622ece20`（100%）。 |
| 2026-07-29 song-only same-text cache release | Main `ae0f1f0e-1c4c-4672-a1ef-667cdff1b644`（100%）；Room `4d1dfa72-9a84-48b8-9a1e-538075dc0108`（100%）。 |
| 2026-07-29 mobile preview playback restoration release | Main `1777984c-d2e9-4ed1-9891-93136c86ab18`（100%）；Room `fe4cf8b8-bdcb-4bcd-8837-0a7e8e1dccad`（100%）。 |
| 2026-07-31 YouTube direct URL fallback release | 源码 `e007236` 已推送；Main `860a101e-a1e4-4d89-b884-f48d64595972`（100%）；Room `bf78c9d5-09e8-4a06-a62b-f9e455a1bc2b`（100%）。 |

Last local pass-4 smoke room `3r512238`：create CTA、mock search、单 iframe preview `start=30`、两首点歌、restart 保持当前 item、next 推进第二首且 progress value 为 `0`。Create 已确认 390×844 无横向 overflow、1280×720 无页面滚动；Display 已确认 dark 140px QR、无画质 selector、三键 panel。

Production pass-4 smoke room `362x7342`：fresh D1 room 创建成功、WebSocket `实时已连接`、quota 50/50、QR Canvas 140px、画质 selector count 0、无 console error。

Production pass-5 smoke room `113f4j5h`：production root HTTP 200；create API 与 snapshot room id 一致，D1 display name 为“这台 Windows 电脑的 K 歌房”；线上 CSS 包含 `create-room-gradient`；quota endpoint 正常返回剩余 49。

Production pass-5 follow-up smoke room `3n2j6g1j`：root、display、mobile 均 HTTP 200；create response 与 D1 snapshot display name 均为中性“K歌房”；HTML `theme-color=#020617`，线上 CSS 包含 `app-no-select` 和 dark scrollbar；空查询返回 10 条 cached recommendations，quota 48/50。WebSocket `ADD_QUEUE_ITEM` 后 snapshot current video 为 `OKjmFVeIG8s`；远端 KV 首位先确认同一 video，公开 recommendation API 在最终一致性传播后也返回同一首，证明 queued-song promotion 已上线。

Production pass-6 smoke room `4a1d0n6a`：root、display、mobile 均 HTTP 200，create response 与 snapshot room id 一致。UTF-8 `年少有为` 歌名搜索在 KTV/原唱 intent 各返回 5 条相关结果并共享 5 个 video id，两次均命中同一 cache 且 quota 保持 98/100；`童话 光良` live fill 返回 25 条后，KTV/原唱重复搜索均 `cached=true`、共享 25 个 id，quota 保持 96/100。WebSocket 收到 `ROOM_SNAPSHOT`、`PONG` 和 cold fill 后的 `YOUTUBE_QUOTA_UPDATED`；quota endpoint 确认 daily limit 100。

Production admin release API smoke room `1q6s3n4v`：root 与 `/admin` 均 HTTP 200；未认证 `/api/admin/overview` 返回 401 与 `Cache-Control: no-store`；room snapshot 为 empty queue / idle。UTF-8 `青花瓷 + 周杰伦` 首次由 external 返回 10 条，第二次 `cached=true`、`responseSource=repository`，quota 保持不变。一次错误编码的 smoke 请求产生的 4 条乱码事件、1 条 repository 记录、对应 family/index KV 与 recommendations 聚合已精确清除，复核垃圾事件与资料行均为 0，空查询仍返回 10 条 recommendations 且无 external call。内置浏览器另从 create CTA 创建 room `3q240558` 并进入 display；登录页与 display 均无横向 overflow 或 console error/warning。由于生产密码未提供给 Codex，未代替管理员提交登录表单。

Production storage metrics acceptance：管理员已自行登录，Codex 未读取密码。强制刷新后 D1 与 KV 系统提醒均为正常；服务端状态表记录 `cloudflare-d1-api` 的 `278,528 bytes` 与 `cloudflare-analytics` 的 `1,297,755 bytes / 413 keys`，`last_error_code` 均为空。Dashboard 同刻显示 D1 `279 kB / 12 tables`、KV `1.3 MB / 413`；生产页面 `scrollWidth=clientWidth=2036`，console 为空。

Production cross-query catalog smoke room `5r652e0d`：quota `0 → 1 → 1 → 1`。`暖暖 + 梁静茹` cold search 为 `external`，取得 50 个 embeddable candidates、过滤后返回 44 条并新增 50 个独立目录视频；相同查询由 exact repository 返回 44 条；移除 artist 的新查询由跨查询目录返回 43 条，`catalogResultCount=43`、`externalCallAvoided=true`、`sourceQueryCount=0`。Production D1 只读复核为目录 50 条、appearance 50、FTS5 `暖暖` 命中 43 条，三条 `search_events` 的候选/过滤/目录/额度列与 API metadata 一致。Production `AdminPage-BQ8ZOyC6.js` 与本地 production build SHA-256 完全一致，且包含“候选目录与额度效率”面板；生产管理员密码未提供给 Codex，因此没有代替管理员登录查看受保护总览。

Production exact-query rollback smoke room `5o3m3t27`：quota `0 → 3`。`后来 + 刘若英`（song、无原唱）冷查询由 external 返回 26 条，完全相同查询由 repository 返回 26 条且 `sourceQueryCount=0`；只改原唱 flag 后重新由 external 返回 26 条；文字改为 `后来 KTV` 后也重新由 external 返回 26 条，再次完全相同请求则由 repository 返回 26 条且不增加额度。D1 只读复核为三个独立 repository identity，两个 exact repeat 的 `access_count=1`；五条事件均为 `catalogResultCount=0`，来源顺序为 external / repository / external / external / repository。Production migration 0006 后候选基础表保留 247 条，FTS5 与 triggers 不存在；`AdminPage-Cb4kbW9h.js` 与本地 production build SHA-256 完全一致，包含新精确复用文案且不含旧 10 条门槛或在线跨查询文案。

Production song-only same-text cache smoke room `326t192b`：quota `6 → 7`。`甜甜的 + 周杰伦` song/无原唱冷查询由 external 返回 28 条；全部结果均为 YouTube Music category 10、duration 大于 0 且严格小于 420 秒。保持完整文字与 artist 不变，只改为 artist/原唱后由 repository 返回同样 28 条，`servedFromExpandedCache=true`、`externalCallAvoided=true`、`sourceQueryCount=0`，没有第二次 external call。Production D1 两条事件复核为 external `49 candidates → 28 filtered / 1 call / avoided=0` 与 repository `28 results / 0 call / avoided=1`。Production root/admin 为 200，未认证 overview 为 401 + `Cache-Control: no-store`；内置浏览器 390×844 显示实时已连接与 10/28 条缓存推荐，页面 `scrollWidth=clientWidth=390`，console 无 error/warning。

Production mobile preview playback restoration smoke room `326t192b`：生产页面加载新 asset `index-Bj8oiKxj.js`；点选“凡人歌 - 李宗盛”结果后只存在一个 YouTube Player iframe，URL 参数为 `autoplay=0`、`enablejsapi=1`、`start=30`、`playsinline=1` 和 production origin。组件只有收到 `PLAYING` 才把 loading 改为 loaded；本次 spinner 确实消失、player 可见，证明显式 mute/load/seek/play 流程已进入生产播放状态。390×844 下 `scrollWidth=clientWidth=390`，console 无 error/warning。真实手机字幕清晰度和移动端浏览器差异仍由周末内测验收。

Local YouTube URL fallback verification：25 files / 122 tests、typecheck、production build、Room/Main Wrangler dry-run 与 `git diff --check` 通过。内置浏览器 fresh session 在 390×844 下粘贴 `youtu.be` 单视频 URL 后只显示 1 张结果卡，点击后 iframe 指向同一 video ID 且含 `start=30`、`mute=1`、`playsinline=1`，点歌 toast 成功并标记“已在歌单”；改贴 `example.com` URL 返回 0/0 与空状态。页面 `scrollWidth=clientWidth=390`，console 无 error/warning。本地未配置 YouTube key，因此卡片使用故障兜底标题；真实 metadata 留待 production smoke。

Production YouTube direct URL fallback smoke room `3y1e002u`：production root/admin 均 HTTP 200，线上 bundle 为本地 production build 的 `index-CMvPwRfc.js`。API 与全新内置浏览器均确认 `youtu.be/dQw4w9WgXcQ` 只返回真实 metadata 卡片“Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)”，`queryMode=youtube-url`、`sourceQueryCount=0`、`videosListCalls=1`；`example.com` 返回 `queryMode=blocked-url`、0 results、0 videos calls。390×844 preview iframe 指向同一 video id，含 `start=30`、`mute=1`、`playsinline=1` 且无横向 overflow；点歌 toast 成功、卡片标记“已在歌单”，snapshot 确认 current video 为 `dQw4w9WgXcQ`。全过程 project search quota 保持 `0/100`，最终 fresh page console 无 error/warning。

Known limitation：本轮已在本地与生产内置浏览器完成 responsive smoke，但仍不替代真实设备 autoplay/playsinline/pause-resume QA。YouTube 原生 title/avatar/branding 可能按官方策略出现，app 不遮挡或伪装。

## 5. Remaining work

### P0 — Pass 12 production acceptance

- `[x]` 完成 exact-only versioned cache、最多 12 轮翻页/多 intent 质量补量和 30 秒真实 current-time gate 实现。
- `[x]` 完成 focused/full tests、typecheck、production build、双 Worker dry-run bundle/binding 检查和 `git diff --check`。
- `[x]` 在全新内置浏览器完成本地 390×844 移动端交互 smoke，并明确不把 mock video 当作真实播放证据。
- `[x]` Commit/push 私有源码到 `origin/main`；生产 smoke 发现的 D1 根因修复也另行提交并推送。
- `[x]` 按 Room → Main、`--keep-vars` 发布并复核两个最终活动版本为 100%。
- `[x]` 生产冷查询逐项确认 `林俊杰`、`周杰伦`、`邓紫棋` 的歌手普通/原唱六组均为 50/50；完全相同林俊杰普通请求再次返回相同 ID 顺序且 `sourceQueryCount=0`。
- `[x]` 生产真实 preview 确认唯一 iframe、自动静音播放，loading 只在 IFrame API 实际记录 `30.022` 秒后结束。

### P0 — Admin baseline release

- `[x]` 完成 1440×1024 reference/implementation 同屏视觉对照并关闭 P0/P1/P2 finding。
- `[x]` 完成 390×844 管理台 responsive browser smoke。
- `[x]` 完整 typecheck、test、production build、双 Worker dry-run 和 `git diff --check`。
- `[x]` 确认 production admin secrets、应用 D1 migration，按 Room → Main `--keep-vars` 发布。
- `[x]` 验证 production 未认证保护、登录页、create → display、中文搜索与 repository 复用，并记录真实版本 ID。
- `[x]` 管理员本人使用独立持有的密码完成登录后真实总览/资料库终验；Codex 未读取或请求该密码。

### P0 — Real Cloudflare storage metrics release

- `[x]` 完成官方 D1 `file_size`、KV Analytics bytes/key count、缓存/lease/stale fallback 和清理保护实现。
- `[x]` 完成本地 migration 0004、21 files / 88 tests、typecheck、production build、双 Worker dry-run 和响应式浏览器 QA。
- `[x]` 应用 production migration 0004，并确认无待应用 migration、两个新表均存在。
- `[x]` 按 Room → Main `--keep-vars` 发布并复核两个新版本均为 100% active；production root/admin 与未认证 storage smoke 通过。
- `[x]` 为 Main Worker 配置 `CLOUDFLARE_API_TOKEN`，只授予 D1 Read 与 Account Analytics Read。
- `[x]` 配置 token 后由管理员登录生产页面，并把 D1/KV 数值与同刻 Cloudflare Dashboard 对照。

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
- `[x]` Multi-source quality fill under daily/per-fill caps；production acceptance 尚列在 Pass 12 P0。
- `[ ]` 自动搜索/自动补库：在明确触发、quota budget、去重、审计和停止策略后再设计实施。
- `[x]` 资料库清理预览和保留策略；不会按估算容量静默删除。
- `[ ]` 无人值守自动清理：只有在长期观察手动批次、D1 容量延迟与保留质量后，才考虑单独启用。
- `[ ]` 并发 exact miss 请求合并，进一步减少相同查询同时触发外部 API 的机会。

### P3 — Tooling

- `[ ]` Evaluate ESLint/Prettier。
- `[ ]` 在未来 dependency upgrade 时 opt into 或消除 React Router v7 future-flag warnings。
- `[ ]` Evaluate automatic deploy；before that, push and deploy remain separate。

## 6. Documentation rules

- README explains how the system works and how to operate it。
- Progress records what is complete, verified, and pending。
- 常规产品文档仍只维护 README/PROGRESS；`DESIGN-QA.MD` 仅作为本轮 Product Design 强制验收记录。
- 不再为小修改创建新的 Markdown logs。
- 新修复更新现有 phase/table，不追加互相矛盾的 update notes。
- Production version 只在真实 deploy 后更新。
- Test counts 只在完整 suite 实际运行后更新。
- Pure docs changes do not redeploy。
