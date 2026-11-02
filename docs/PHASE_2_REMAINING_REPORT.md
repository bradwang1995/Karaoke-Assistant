# Phase 2 remaining remediation — local acceptance report

Date: 2026-11-02. Workspace: `C:\Brad Wang\Repos\K歌助手`. Branch: `codex/music-eligibility-cache`. Starting and ending HEAD: `9f2d7aad2ab28946d803e354fe440cba6b167434`. Starting `git status --short`: empty. No commit, push, deployment, production access, Google Cloud change, audit submission or real YouTube Data API request was performed in this round.

## Executive summary

**CODE FIXED:** display autoplay now starts through a visibility gate, with one attempt and manual recovery; restart cues the room video without implicit autoplay; page playback ownership prevents competing application players; preview errors remove the iframe before showing retry; preview start correction does not initiate a second playback. Added policy/withdrawal access to admin/debug and accepted public/create pages. Blocked localStorage no longer crashes room entry/state handling. YouTube transport failures and public search errors no longer propagate internal URLs.

**ALREADY FIXED (regressed against current source, not rebuilt):** P0 provenance/expiry, D1/KV/recommendation lifecycle, legacy cleanup, business-state preservation, MFK and embedding gates, versioned consent, linked bilingual policies, native control/referrer/sandbox configuration. Current policies already lack obsolete unpublished notices. Policy substance and `POLICY_VERSION=2026-11-02-p0-v2` remain unchanged; no artificial version bump.

**NEEDS MANUAL VALIDATION:** real YouTube controls at 200×200, advertisements, links/fullscreen/captions, actual background/autoplay behavior, two physical phones and QR scan distance. Mock results below prove local application behavior only.

**NEEDS USER/CONSOLE ACTION:** verified key/project mapping and restriction design, method usage/quota screenshots, legal application details, user-owned replacement logo, real recording, future advertising/derived-scoring clarification. **BLOCKED:** official audit readiness is blocked on these external/runtime evidence gates, not on an unresolved known local test failure.

Local source is ready to enter release review. This is neither YouTube approval nor production compliance certification. P0's earlier release/cleanup notes are historical; current production cleanup completion was not inspected.

## Complete remediation matrix

Paths/line numbers refer to this local final source. AF = ALREADY FIXED; CF = CODE FIXED; M = NEEDS MANUAL VALIDATION; U = NEEDS USER/CONSOLE ACTION. A source-level result does not turn a runtime/production item into PASS.

| ID | Issue / original risk | Result | Source evidence (actual line) | Tests / evidence this round | Still needs manual / production? |
| --- | --- | --- | --- | --- | --- |
| A1 | Metadata copied/reaccessed indefinitely across caches | AF: genuine group clocks, 29-day absolute limits; current versions only; bounded physical removal | `src/lib/metadataLifecycle.ts:3,14`; `worker/metadataMaintenance.ts:8`; `worker/kvCache.ts:10,12` | lifecycle, KV, repository/catalog and metadata integration tests in full 320 + search 196 | Yes: actual production backlog, backups and offline clients |
| A2 | Unknown timestamps/MFK or old queues bypass gate | AF: trusted status <=1h; true/unknown/stale blocked; leases/budgets; old payload scrub | `worker/videoMetadata.ts:42`; `worker/d1Repository.ts:129`; `src/lib/youtube.ts:61`; `src/lib/privacyConsent.ts:1` | metadata integration: migrations, bad/missing fields, MFK tri-state, 403/404/429, lease/limits; URL local no-key blocked | Real status/playback and production migration/cron state not rechecked |
| A3 | Metadata cleanup deletes guest order/requester state | AF, plus blocked-storage fix preserves state independently | `worker/d1Repository.ts:129`; `src/lib/roomState.ts:29,47` | SQLite cleanup preserves room/requester; browserMetadata tests; new roomState tests scrub persisted API title and preserve guest state on write failure | Shared-room production behavior pending later release |
| B1 | Tiny/cropped player/native controls | AF lower-bound layout; M for native control completeness. Existing two-column scroll preserved | `src/routes/MobilePage.tsx:832,1067,1074`; `src/routes/DisplayPage.tsx:294`; `src/lib/playerVisibility.ts:2` | 320/375/390px placeholder preview 200×200, card 202px, page width=scroll width; 844×390 page checked; mock display iframe 400×300, 199px blocked | **NEEDS REAL-BROWSER CHECK**; placeholder size cannot establish native controls fit; increase size if actual controls clip |
| B2 | Native controls/keyboard/logo/share/ads blocked by app | AF controls/keyboard/fullscreen enabled; app controls outside iframe; no new interaction overlay | `src/lib/youtube.ts:61`; `src/components/FullscreenPlayer.tsx:253`; `src/routes/MobilePage.tsx:1074` | youtube iframe configuration tests; source review; local app boundaries | Real cross-origin controls, popups/targets, ads and native recommendations pending |
| B3 | Missing client identity/Referer or restrictive sandbox | AF origin and strict-origin-when-cross-origin; scripts/forms/presentation/popups allowed, top-page replacement disallowed | `src/lib/youtube.ts:61`; `src/components/FullscreenPlayer.tsx:253` | iframe tests verify origin, referrer, fullscreen and sandbox; no parent no-referrer policy found in reviewed source | Actual Referer/network and YouTube internal target behavior pending |
| B4 | Hidden/covered autoplay, multiple auto players, retry loop | CF: autoplay=0; >half viewport + hit tests + visible document; one page owner; hidden/scroll/resize/dialog events pause; no automatic retry; explicit manual play tolerates partial visibility | `src/lib/playerVisibility.ts:2,23`; `src/components/FullscreenPlayer.tsx:126,153,253,407`; `src/routes/MobilePage.tsx:1104` | new visibility tests incl exact half/199px/overlay/manual/owner; LOCAL mock counters first play=1, rejected remount adds 1 only; hidden remount adds 0; manual recovery adds 1 | Real background/mobile/YouTube policies pending; ownership is per page, not across different devices |
| B5 | Replay/next/error/reconnect regressions | CF replay cues original video after gate; preview timeout/error destroys iframe then offers Retry; AF queue/reconnect | `src/components/FullscreenPlayer.tsx:153`; `src/routes/MobilePage.tsx:1215,1290`; `src/hooks/useRoomSocket.ts:175`; `src/routes/DisplayPage.tsx:202` | mock Pause/Play/Replay/Unmount; local two URL queue items sync over real local WS; replay remains blocked without key; Worker reloads reconnect; room command/reducer tests | Actual ended/seek/media/network-error scenarios and two-device checks pending; preview native error path source-reviewed, not a real YouTube error capture |
| B6 | Own title/progress/buttons obscure iframe | AF layout separates display footer/card title from frame; CF error UI only after iframe removal | `src/routes/DisplayPage.tsx:294`; `src/routes/MobilePage.tsx:1074,1215,1290` | local layout/source review; mock geometry; no player ad suppression code added | Actual native UI/ads remain manual |
| C1 | Policy stale relative to P0 / unpublished labels | AF: bilingual 29-day provenance, old-browser limits, refresh/delete and third parties already stated | `src/content/publicPages.ts:33`; `src/routes/PublicInfoPage.tsx:16` | current text inspected; i18n/consent tests in full suite | Later deployment must match source; not claimed deployed this round |
| C2 | Missing Google/YouTube links or music licence claims | AF accessible links; Terms explicitly grants no copyright/public-performance licence | `src/routes/PublicInfoPage.tsx:24`; `src/content/publicPages.ts:49`; `src/components/SiteFooter.tsx:11` | source + local policy menu links; i18n tests | User verifies formal legal information for audit |
| C3 | Players/room requests before real consent | AF protected children unmounted until explicit checked consent; decline to public page | `src/App.tsx:25`; `src/components/PrivacyConsent.tsx:13` | SSR child-not-rendered test; LOCAL fresh gate disabled; DOM iframe=0, scripts only same-origin asset before accepting; local room created only afterwards | DOM inspection is not a full network trace; real deployed network capture pending |
| C4 | Blocked storage, cross-tab revoke, stale consent | AF version/time and storage events; CF room identity/state tolerate blocked reads/writes | `src/lib/privacyConsent.ts:1,55`; `src/hooks/useRoomSocket.ts:211`; `src/lib/roomState.ts:29,47` | consent tests; LOCAL withdrawal re-gates display+two mobile tabs; storage-blocked fixture accepts/enters room/withdraws without crash; teardown code closes sockets/stops reconnect | Storage-blocked choices are page-only; no cross-tab guarantee without shared browser mechanisms; actual playing iframe teardown pending |
| C5 | Debug/admin no continuous policy/revoke access | CF reused shared lightweight menu; includes admin loading/login/shell, no auth bypass | `src/routes/AdminPage.tsx:94`; `src/routes/DebugPage.tsx:83`; `src/components/SiteFooter.tsx:10` | LOCAL admin unauthenticated menu, debug entry, accepted create footer/dialog; admin authorization tests | Authenticated admin shell placement source-checked only (no admin session used) |
| C6 | Deletion promise exceeds actual operations | AF scoped manual request runbook; CF clarification of withdrawal vs server deletion/admin logout | `docs/PRIVACY_REQUESTS.md:21,35`; `src/content/publicPages.ts:33` | source review + SQLite physical scrub tests | Production requests/other participants/third-party backups require operator scope checks; no real deletion performed |
| C7 | Current ad/affiliate status misrepresented | AF code/text: no third-party ad scripts or Amazon tracking; future plan only | `src/content/publicPages.ts:33`; `docs/YOUTUBE_AUDIT_SUBMISSION_DRAFT.md:42` | tracked frontend script scan found no ad tracking code; bundle check recorded below | Future actual ad-bearing room page requires independent-value review |
| C8 | New material policy silently inherits old consent | AF version enforcement; no substantive policy change this round, so version retained | `src/lib/privacyConsent.ts:1`; `src/lib/privacyConsent.test.ts:15` | version/time/old/corrupt/blocked-storage/cross-tab tests | Any future material policy/advertising change needs a fresh version |
| D1 | Key in browser/repo/error/log | CF transport errors replaced by constant; public SEARCH_FAILED generic; AF Worker secret-only interface | `worker/youtubeSearch.ts:453`; `worker/router.ts:405`; `worker/types.ts`; `worker/youtubeTransport.test.ts:1`; `worker/router.errors.test.ts:1` | tracked-source credential pattern scan: no matching files; new failure tests with fake URL/key; final dist scan below | Pattern scan is not a guarantee about historical/private logs or Console values; no actual secrets read |
| D2 | Wrong application restriction breaks Worker requests | U: Console plan explains server caller, fixed-egress tradeoff, safe rotation sequence; no referrer restriction applied | `docs/YOUTUBE_AUDIT_EVIDENCE_RUNBOOK.md:33` | official Google API key guidance reviewed; no external mutation | User/Console decision and measured live validation required |
| D3 | Unsafe parent policy/debug/admin exposure | AF native-preserving sandbox/referrer; protected admin API tests; CF error redaction. No CSP configured in reviewed app/asset source; no broad untested CSP introduced | `src/lib/youtube.ts:61`; `worker/router.ts:57`; `worker/router.admin.test.ts:1`; `worker/adminAuth.ts` | unauthorized admin read/delete/cleanup tests and source review; ordinary room links intentionally shared | Broader CSP/security hardening separate; current deployment headers/real iframe network pending |
| D4 | Assume project/key/bindings match local names | U: explicit CONSOLE CHECK NEEDED for 429290784361 and both secrets | `docs/YOUTUBE_AUDIT_EVIDENCE_RUNBOOK.md:33` | no Console access or secret inspection | User must verify ownership, mapping, permissions and active versions |
| E1 | Reviewer blocked by admin/ordinary login | AF normal routes independent of admin; reviewer steps written | `src/App.tsx:25`; `docs/YOUTUBE_AUDIT_REVIEWER_GUIDE.md:5` | LOCAL no-login create → display → /j Connected | Two phones and production public access pending |
| E2 | Fake/demo route unnecessary | AF existing normal workflow used; no /demo added | `src/App.tsx:25`; `docs/YOUTUBE_AUDIT_REVIEWER_GUIDE.md:11` | LOCAL real local room/WS; test fixtures outside product entry/build | Mock fixture must never be submitted as real playback proof |
| E3 | Documentation mixes old release/local state | CF current section appended; historical dated records preserved; P0 prior release not rewritten | `README.md:16`; `SEARCH.md:46`; `docs/PRIVACY_REQUESTS.md:35`; `PROGRESS.md:1` | diff review; source and docs contracts aligned | Current production behavior unverified this round |
| E4 | No repeatable English reviewer journey | CF guide includes language, consent, host/guests, queue, controls and privacy | `docs/YOUTUBE_AUDIT_REVIEWER_GUIDE.md:1` | paths/copy checked against current source/local UI | Real recording follows final deployed UI |
| E5 | No evidence capture plan / fake evidence risk | CF capture table, URL/state/function/level/completion and ~2-minute recording plan | `docs/YOUTUBE_AUDIT_EVIDENCE_RUNBOOK.md:5` | explicitly distinguishes SOURCE/LOCAL/MANUAL/PRODUCTION; one local policy screenshot only | User records real demo/screenshots; none fabricated |
| E6 | Submission text overclaims architecture/value/ads | CF English draft describes actual API/retention/limitations and bracketed user fields | `docs/YOUTUBE_AUDIT_SUBMISSION_DRAFT.md:1` | API paths checked against router; no submit action | Legal fields, production evidence, independent-value policy answer pending |
| E7 | Invented quota usage/growth/need | U: historical screenshot labelled; current method buckets and videos.list=1/call distinguished from app ledgers | `docs/YOUTUBE_AUDIT_EVIDENCE_RUNBOOK.md:33`; `docs/YOUTUBE_AUDIT_SUBMISSION_DRAFT.md:42` | current official quota/audit and cost pages rechecked; no live Console data | User supplies 7/30-day method counts/units, peaks and 403/429 reasons; no extension application justified yet |
| E8 | Unwanted logo/brand changes | AF scope: logo, image words, font assets, decorative brand layout and user screenshots unchanged | final git file list below | diff paths show no brand/font/image changes | User replaces plural image branding and verifies logo |
| E9 | No Phase 3 decision gates | CF distinct source/manual/production/user/Console/YouTube gates | `docs/YOUTUBE_AUDIT_EVIDENCE_RUNBOOK.md:43` | gate table + final decisions below | User owns release and audit submission |
| F1 | Other direct API compliance defects | CF no second preview play initiation, native preview error no invisible Retry dead-end, safe transport errors; no extra product features | `src/lib/youtube.ts:85`; `src/routes/MobilePage.tsx:1215,1290`; `worker/youtubeSearch.ts:453` | youtube helper test + new security tests; full regression | API-derived scoring and future same-page advertising require YouTube clarification, deliberately not redesigned |

## Files changed and reasons

- `src/lib/playerVisibility.ts`, `src/lib/playerVisibility.test.ts`: visible-document/minimum-size/visible-area/hit-test checks; distinguish scripted start from an explicit partly-visible manual play; single page playback owner.
- `src/components/FullscreenPlayer.tsx`: guarded one-shot playback/restart, manual recovery, ownership, pause on visibility/geometry/dialog changes; no retry loop or implicit load autoplay.
- `src/routes/MobilePage.tsx`, `src/lib/youtube.ts`, `src/lib/youtube.test.ts`: visibility/ownership, seek-only correction, destroy failed/timed-out iframe before actionable retry.
- `src/components/SiteFooter.tsx`, `src/routes/AdminPage.tsx`, `src/routes/DebugPage.tsx`: shared policy/withdrawal access, without exposing admin privileges.
- `src/lib/roomState.ts`, `src/lib/roomState.test.ts`, `src/hooks/useRoomSocket.ts`: blocked-storage fallback preserves business state and physical old-payload scrubbing.
- `worker/youtubeSearch.ts`, `worker/router.ts`, `worker/youtubeTransport.test.ts`, `worker/router.errors.test.ts`: transport/public error redaction with fake-key regression tests.
- `test/browser/phase2.html`, `test/browser/phase2.tsx`, `test/browser/storage-blocked.html`: repeatable development-only fixtures; no production route, no real media/API and not bundled in dist.
- `README.md`, `SEARCH.md`, `PROGRESS.md`, `docs/PRIVACY_REQUESTS.md`: current local behavior, unchanged search algorithm/version and actual evidence.
- This report and three `docs/YOUTUBE_AUDIT_*.md` files: reviewer guide, evidence/runbook/gates and English submission draft.

No migration/config/dependency/lockfile/brand/image/font changes. `SEARCH.md` only documents sanitized errors; algorithm, cache, recommendations, quota and deadlines unchanged. A later release needs the normal Room → Main sequence, preservation of Dashboard variables and active-version checks. Existing P0 0008/cron/cleanup must be verified, not blindly reapplied based on this report.

## Commands and actual results

- Focused no-network tests: 7 files / 38 tests passed; later focused error/state tests: 2 files / 3 tests passed.
- Final `npm.cmd --% test -- --config vitest.search.config.ts`: **42 files / 320 tests passed**, 2026-11-02. The npm `test` script ran `vitest run`; explicit setup blocks unstubbed external fetch.
- `npm run typecheck`: passed standalone and inside verify:search; build also checks app/Worker TypeScript.
- `npm run build`: passed; final artifact names recorded in PROGRESS. Fixtures not included in the application build.
- `npm run verify:search`: **17 files / 196 tests passed**, typecheck and machine contract passed; no real network allowed.
- `git diff --check`: final result recorded with ending status below.
- All 0001–0008 migrations applied successfully only to new isolated local D1 through `wrangler d1 migrations apply ... --local --config .wrangler/phase2-local/main.toml --persist-to .wrangler/phase2-local/state`. Dual local Workers run with both isolated configs, no remote flag or live key.
- Initial sandbox Vitest run failed before executing tests with Windows `realpath EPERM`; authorized local escalation ran it successfully. One initial `npm test -- --config ...` invocation lost `--config` through PowerShell and found no tests; corrected with `npm.cmd --% ...`. No tests were weakened/skipped. Wrangler version check printed a sandbox log-write EPERM; local commands use an in-workspace log directory. SQLite emits its expected experimental-module warning.

## Browser/session evidence and limits

Fresh Codex built-in @Browser session only; no personal Chrome. Local Worker room `0i640r6t`; no production room created. Native consent UI default unchecked/continue disabled; before consent DOM has zero iframes and only same-origin application script/logo. This is DOM/source evidence, not a complete network capture.

Real local Main/Room WebSockets Connected; two no-key URL items synchronized to display and remained blocked for playback. Replay did not bypass MFK; source/unit tests cover queue ordering, removal, next-item and reconnect rules. Worker hot reloads reconnected real local sockets. Withdrawal from mobile reset display and both mobile tabs to the consent gate; console inspection on the tested Worker tab showed no errors. Admin was never authenticated; its login policy dialog, Debug and accepted create footer were inspected.

320/375/390px local mobile placeholder previews measured 200×200, cards 202px, document scrollWidth equalled width; the narrow result pane retains intentional inner horizontal scrolling. 844×390 landscape page fit was checked, but no native iframe/control measurement was made there. Mock display used 400×300 iframe; tests reject 199px. Mock counter scenarios verified first auto attempt once, Pause/manual Resume/Replay, rejection without retries, cover/199px blocking and unmount. Simulated visibilitychange paused; hidden mount added no play, visible restoration did not retry, explicit Play recovered. These are labelled simulations, not real browser background/YouTube media evidence.

Storage-blocked fixture loads the actual app with a throwing localStorage getter: page-only consent, Vite fallback room entry and withdrawal worked. It is not proof of live Worker operation with a privacy-mode browser. Same-origin storage-event withdrawal works in normal tabs; permanently isolated/blocked storage cannot promise cross-tab coordination.

Preview URLs: **Vite `http://127.0.0.1:5192/`** (hot reload); **Workers `http://127.0.0.1:8792/`** (running with isolated state; dist requires rebuild/refresh). Keep terminals open; Ctrl+C stops services. For user review, open Worker `/create`, accept locally, create a room, expand QR and open its mobile link. No-key preview should show a retryable status block, not a YouTube iframe. `127.0.0.1` QR is not reachable by another phone as this computer.

Local screenshot: `C:\Users\bradw\.codex\visualizations\2026\11\02\01a19db0-de3d-7e00-8d2a-1a1685844933\phase2-local-policy.png` shows create-page policy/withdrawal, no real YouTube media. No official demo video or production screenshot was recorded.

Remaining limits: actual cross-origin YouTube controls, captions/settings/logo/More videos/ads/links/fullscreen, native media errors and device autoplay remain **NEEDS REAL-BROWSER CHECK**. Hit-test sampling supplements the exact viewport-area check; it is not exhaustive proof against every possible visual obstruction. Current code does not add a continuous polling loop to defeat playback restrictions.

## User's consolidated acceptance checklist

1. **Click locally:** Worker `/create` → consent/create → QR mobile link; both Connected; policy entries on create/debug/admin; withdraw and confirm other tabs stop; switch languages. Vite mock fixture separately verifies scripted playback counters, never real media.
2. **Desktop + two phones after an authorized release/staging setup:** scan real reachable QR, each select a song; reorder/delete, replay/next/pause/seek; reconnect; test visible/hidden/covered autoplay and explicit recovery. Verify complete native controls at phone widths and landscape; enlarge player if actual controls clip. Check ads, links, keyboard and full screen without overlays.
3. **Console screenshots:** verify project/key ownership, YouTube API-only restrictions, server-compatible application restriction decision, 7/30-day method usage/units and 403/429/peaks; redact key values.
4. **Cloudflare after separate authorization:** active Main/Room versions and assets, existing 0008/cron, real metadata backlog/backup/old-client handling; only then record production results.
5. **Formal evidence:** fill required legal/operator data, replace Logo personally, record actual public→consent→host→two guests→queue→native player→withdraw flow. Obtain YouTube guidance about same-page room ads and API-derived scores before monetization decisions.

## Final GO / NO-GO

| Decision | Result |
| --- | --- |
| Local code can enter release review | **GO**: current checks pass; focused diff left local for review |
| Authorized to deploy production in this round | **NO** |
| Sufficient actual runtime evidence to submit YouTube Audit | **NO-GO**: real devices/native playback, production and user/Console evidence pending |
| Need additional quota | **UNDETERMINED**: no present Console usage or justified demand; no application |
| Written YouTube clarification required | Future ad sales on API-data-containing mobile room page and independent value on that same page; API-derived scoring/recommendation interpretation. Separate `/setup` content does not resolve room-page ad eligibility |

## Final workspace snapshot and safe scan

Final status / diff-check / artifact scan are appended below after verification. No claim is made about secret absence in uninspected private files or production logs.


Ending `git status --short` (all changes local; HEAD unchanged):

```text
 M PROGRESS.md
 M README.md
 M SEARCH.md
 M docs/PRIVACY_REQUESTS.md
 M src/components/FullscreenPlayer.tsx
 M src/components/SiteFooter.tsx
 M src/hooks/useRoomSocket.ts
 M src/lib/roomState.ts
 M src/lib/youtube.test.ts
 M src/lib/youtube.ts
 M src/routes/AdminPage.tsx
 M src/routes/DebugPage.tsx
 M src/routes/MobilePage.tsx
 M worker/router.ts
 M worker/youtubeSearch.ts
?? docs/PHASE_2_REMAINING_REPORT.md
?? docs/YOUTUBE_AUDIT_EVIDENCE_RUNBOOK.md
?? docs/YOUTUBE_AUDIT_REVIEWER_GUIDE.md
?? docs/YOUTUBE_AUDIT_SUBMISSION_DRAFT.md
?? src/lib/playerVisibility.test.ts
?? src/lib/playerVisibility.ts
?? src/lib/roomState.test.ts
?? test/browser/
?? worker/router.errors.test.ts
?? worker/youtubeTransport.test.ts
```

Final built asset scan: `index-Bv3P8aDi.js`, `index-Dlx8wsaO.css`, `PublicInfoPage-BpIQvwAU.js`, `AdminPage-BaC2yZSF.js`; no target API-key/private-key pattern, no `YOUTUBE_API_KEY` binding name and no test-fixture text. Source scan inspected 162 tracked paths and found no target credential patterns or frontend ad-tracker code; it deliberately did not read secret files. No logo/font/image paths changed.
Final `git diff --check`: **PASS (exit 0)**. Only Git's LF/CRLF informational warnings were emitted; no whitespace errors. Final no-network test/search/typecheck/build results above are from this round. Final source state remains uncommitted.


## Subsequent authorized production release — 2026-11-02

The local-only authorization/status statements above describe the initial implementation turn. The user subsequently explicitly requested push and deployment. Source debf48628f912812c84cb330c08d8168ec9e3e42 was pushed to codex/music-eligibility-cache (not main). Room f28d8c7d-c412-4967-bd2c-10c7f1083725 and Main 998ec7ce-2f3a-440a-9ceb-40a823642d3c were deployed in that order with keep-vars and verified active at 100%. Full 320 tests, search 196/typecheck, build and diff checks passed again. Production cacheOnly smoke returned 0 results with search ledger 0→0; browser loaded the matching build and showed no console errors or pre-consent iframe. No real cold search/videos.list, new room, admin login, migration or manual retention cleanup was performed. Native playback/devices, retention backlog, Console and audit evidence remain pending. Detailed release record: PROGRESS.md.
