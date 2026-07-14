# Project Progress

Last updated: 2026-07-13

这份文件记录 implementation status、历史修复、验证结果和剩余工作。系统设计、search details、手动配置、部署和测试步骤见根目录 `README.md`。

## 1. 当前状态

| Area | Status | Summary |
| --- | --- | --- |
| Product MVP | Complete | Create、display、mobile、debug 全流程可用。 |
| Cloudflare backend | Complete | Worker + Assets、D1、KV、Durable Object 已上线。 |
| Realtime queue | Complete | WebSocket commands、broadcast、persistence、reconnect 已完成。 |
| YouTube search | MVP complete | Live API、family cache、ranking、推荐、rate limit、quota 已完成。 |
| Mobile preview | Partial | 单个 480p iframe 可用；精确 Player API control 待做。 |
| Display player | MVP complete | Autoplay attempt、seek、quality、auto-advance 已完成。 |
| Reliability | MVP complete | Heartbeat、5-minute cleanup、debug、fallback policy 已完成。 |
| Automated tests | 12 files / 47 tests | Route/DO integration 和 Playwright 待补。 |
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
- `[x]` Create page 只保留有效 create CTA。
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
- `[x]` API 40 results；mobile 8-at-a-time expansion。
- `[x]` 20/min rate limit。
- `[x]` Project quota 50/day、1/fill、Pacific reset 和 status API。
- `[x]` Real YouTube result + repeat-query cache hit verified。

### Phase 5 — Mobile search and preview

- `[x]` Default recommendations。
- `[x]` Sticky type/query/toggle/search controls。
- `[x]` 24-hour per-room search state。
- `[x]` Queue tab URL persistence。
- `[x]` One active 480p preview iframe。
- `[x]` Select-and-preview；click outside stops。
- `[x]` Overlay selection/queue tags。
- `[x]` Page toast + add-to-queue animation。
- `[x]` Stay on search after adding；duplicate warning。
- `[x]` Direct promote；confirm remove/restart/skip。
- `[ ]` Preview IFrame Player API control。
- `[ ]` Preview load-failure fallback。
- `[~]` Mobile autoplay/playsinline real-device check。

### Phase 6 — Display playback

- `[x]` Fullscreen IFrame Player API。
- `[x]` Autoplay intent、ready guard、retry、blocked hint。
- `[x]` PLAYING/ENDED → room commands。
- `[x]` Natural end、manual skip、mobile restart。
- `[x]` App next、progress/seek、quality controls。
- `[x]` YouTube chrome cleanup。
- `[x]` 1080p default + persistent preference。
- `[x]` Concrete available/effective qualities。
- `[x]` Clean QR card 和 local-time quota footer。
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
| Quality | 1080p default、selector、persistence。 |
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
| PIT-10–12 | P1 | Display chrome、app seek、authoritative quality UI。 |
| PIT-13 | P0 | 5-minute inactive cleanup。 |
| PIT-14 | P0 | Open-client heartbeat。 |
| PIT-15 | P1 | Quota estimate and Pacific reset。 |

### 2026-07-03 post-internal pass 2

| ID | P | Completed |
| --- | --- | --- |
| PIT2-01 | P1 | Sticky header clipping fix。 |
| PIT2-02 | P1 | Auto-preview、less hover chrome、480p。 |
| PIT2-03 | P0 | Partial title above unrelated KTV。 |
| PIT2-04 | P0 | Persistent 1080p and real quality options。 |
| PIT2-05 | P1 | Remove start button；larger centered progress。 |
| PIT2-06 | P1 | Hide uploader；local quota reset time。 |
| PIT2-07 | P1 | Simplified linked QR card。 |
| PIT2-08 | P1 | Remove duplicate queue-tab count。 |
| PIT2-09 | P1 | Confirm restart/skip；direct promote。 |
| PIT2-10 | P1 | Verification、release、documentation。 |

## 4. Verification record

### Automated history

| Date | Result |
| --- | --- |
| 2026-07-02 | Targeted reducer/room/WebSocket/search tests passed；full 11 files / 41 tests。 |
| 2026-07-03 pass 1 | Search/quota/heartbeat targeted tests；full 12 files / 44 tests。 |
| 2026-07-03 pass 2 | Ranking/quality targeted tests；full 12 files / 47 tests。 |
| 2026-07-13 docs | Typecheck、12 files / 47 tests、production build passed；no deploy。 |

Current coverage：

- `[x]` Query normalization、room ids、reducer rules。
- `[x]` Room commands、WebSocket validation/runtime。
- `[x]` KV keys/family/recommendations/size policy。
- `[x]` Search family、ranking、rate limit、YouTube parsing。
- `[x]` Pacific quota reset、playback quality。
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

Last smoke room `141g331u`：idle、empty queue；quota 45/50、Pacific reset timezone。2026-07-13 文档整理没有改 production code 或 redeploy。

Known limitation：post-internal pass 2 的 sandbox Vite browser smoke 因 `listen UNKNOWN` 无法 bind local port。自动验证通过，但不替代真实设备 visual/autoplay QA。

## 5. Remaining work

### P0 — Real-device acceptance

- `[ ]` Mobile Safari：QR、sticky UI、preview、playsinline、queue。
- `[ ]` Android Chrome：search/load-more、preview、sync/reconnect。
- `[ ]` iPad Safari：orientation、layout、iframe。
- `[ ]` Desktop Chrome：autoplay、quality、seek、auto-advance。
- `[ ]` Two real mobile clients concurrent queue operations。

每个平台至少：fresh room、点两首歌、display sync、manual next、natural end、debug snapshot。

### P1 — Tests and preview robustness

- `[ ]` Router request/response integration tests。
- `[ ]` DO storage、alarm、socket count、D1 recovery tests。
- `[ ]` Playwright create → search → queue → display flow。
- `[ ]` Injected-clock inactivity test。
- `[ ]` Mobile preview Player API control。
- `[ ]` Iframe unavailable/load-error fallback。
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
