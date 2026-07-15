# Project Progress

Last updated: 2026-07-14

这份文件记录 implementation status、历史修复、验证结果和剩余工作。系统设计、search details、手动配置、部署和测试步骤见根目录 `README.md`。

## 1. 当前状态

| Area | Status | Summary |
| --- | --- | --- |
| Product MVP | Complete | Create、display、mobile、debug 全流程可用。 |
| Cloudflare backend | Complete | Worker + Assets、D1、KV、Durable Object 已上线。 |
| Realtime queue | Complete | WebSocket commands、broadcast、persistence、reconnect 已完成。 |
| YouTube search | MVP complete | Live API、family cache、ranking、推荐、rate limit、quota 已完成。 |
| Mobile preview | MVP complete | 2–4 列、单 iframe、固定 30 秒起点、600ms debounce、spinner/timeout fallback 已完成。 |
| Display player | MVP complete | Autoplay、0 秒切歌、restart、pause/resume、seek、auto-advance 已完成；画质由 YouTube 自适应。 |
| Reliability | MVP complete | Heartbeat、5-minute cleanup、debug、fallback policy 已完成。 |
| Automated tests | 14 files / 53 tests | Route/DO integration 和 Playwright E2E 待补。 |
| Real-device QA | Pending | Safari、Android、iPad、Desktop Chrome 待正式验收。 |
| Documentation | Complete | 只保留 root README + progress。 |

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
- `[x]` Deterministic aliases、OR source query、family hash。
- `[x]` One `search.list` page、最多 50 embeddable candidates。
- `[x]` Duration enrichment、dedupe、scoring。
- `[x]` Title/artist/KTV/伴奏/lyrics/original ranking。
- `[x]` Partial-title regression coverage。
- `[x]` KV v3 family cache、index、metadata、payload pruning。
- `[x]` Recommendation pool 和 cached re-ranking。
- `[x]` API 50 results；mobile 10-at-a-time expansion。
- `[x]` Recommendation pool 200 results；缓存耗尽前自动无限滚动。
- `[x]` Original-vocal toggle 自动重搜并使用对立权重，顺序有明确变化。
- `[x]` 20/min rate limit。
- `[x]` Project quota 50/day、1/fill、Pacific reset 和 status API。
- `[x]` Real YouTube result + repeat-query cache hit verified。

### Phase 5 — Mobile search and preview

- `[x]` Default recommendations。
- `[x]` Sticky type/query/toggle/search controls。
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

Last local pass-4 smoke room `3r512238`：create CTA、mock search、单 iframe preview `start=30`、两首点歌、restart 保持当前 item、next 推进第二首且 progress value 为 `0`。Create 已确认 390×844 无横向 overflow、1280×720 无页面滚动；Display 已确认 dark 140px QR、无画质 selector、三键 panel。

Known limitation：本轮已在本地浏览器完成 responsive smoke，但测试视频在自动化环境返回 YouTube error 150；失败 iframe 已隐藏，仍不替代真实设备 autoplay/playsinline/pause-resume QA。YouTube 原生 title/avatar/branding 可能按官方策略出现，app 不遮挡或伪装。

## 5. Remaining work

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

### P3 — Tooling

- `[ ]` Evaluate ESLint/Prettier。
- `[ ]` Evaluate automatic deploy；before that, push and deploy remain separate。

## 6. Documentation rules

- README explains how the system works and how to operate it。
- Progress records what is complete, verified, and pending。
- 不再为小修改创建新的 Markdown logs。
- 新修复更新现有 phase/table，不追加互相矛盾的 update notes。
- Production version 只在真实 deploy 后更新。
- Test counts 只在完整 suite 实际运行后更新。
- Pure docs changes do not redeploy。
