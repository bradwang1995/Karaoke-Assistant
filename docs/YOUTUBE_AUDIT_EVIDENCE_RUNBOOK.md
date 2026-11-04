# YouTube audit evidence and Phase 3 gates

Updated 2026-11-02: code deployed after explicit user authorization; active versions and cache-only smoke are recorded in PROGRESS.md. Local and mock evidence below remains local evidence. Never substitute screenshots of mocks or old deployments for current production evidence. Do not upload private room links, credentials, unrelated participant information or Console key values.

## Evidence levels and outstanding capture

`SOURCE` means inspected implementation/tests. `LOCAL` means this round's isolated run, not YouTube playback. `PRODUCTION` requires a separately authorized deployment/check. `MANUAL` requires a person or physical devices. No production recording was made this round.

| Evidence | URL / state / screenshot target | What it establishes | Current level / completion |
| --- | --- | --- | --- |
| Public access / English and Chinese | `/`, `/setup`, `/privacy`, `/terms`; language toggle and footer | No login wall; accessible linked policies | SOURCE/LOCAL inspected; current production captures pending |
| First consent | `/create` and `/j/:roomId` in fresh browser | Unchecked gate, disabled continue, decline path; no room/player before consent | SOURCE tests + LOCAL; production capture pending |
| Host and QR | `/create` → display, expanded QR | Ordinary host creates without admin login; room connection | LOCAL Connected; physical QR/two-phone capture pending |
| Two guests / shared queue | Two physical phones on same room | Independent pick, queue update, reorder/remove across devices | LOCAL multiple tabs + unit tests; two-device MANUAL pending |
| Native player | display and selected mobile preview, 320/375/390px and landscape | Actual iframe >=200×200; complete native controls, captions/settings/logo/share/fullscreen/links/ads accessible | LOCAL placeholder/mock geometry only; NEEDS REAL-BROWSER CHECK |
| Autoplay / manual recovery | Visible vs hidden tab, scrolled/clipped/covered player, first song/replay/next | >half visibility before automatic start; single page owner; rejection has manual recovery, no retry loop | SOURCE/unit + LOCAL mock counters; actual YouTube/device check pending |
| Withdrawal | Policy menu in mobile/display/debug/admin; standalone withdrawal above create footer (public pages omit it) | Re-gate all same-origin tabs, destroy players, close sockets, stop reconnect | SOURCE + LOCAL; real-playing destruction capture pending |
| P0 lifecycle | Operator-only metadata counts/age groups and cron summaries | Unknown/expired payloads actually drained; no new fetchedAt from copies; queue business fields retained | SOURCE + LOCAL SQLite tests; production backlog/backup/old-client verification pending |
| Key/project/quota | Google Cloud Console and Cloudflare active deployment panels | Project ownership, API restrictions, server key bindings, actual usage | CONSOLE CHECK NEEDED; redact keys/cookies |
| Operator/application identity | Audit form fields, privacy contact, user-replaced logo | Accurate legal/contact/project details and brand | User must verify/fill; logo deliberately untouched |

Suggested ~2 minute real recording (not recorded): 0:00 public homepage/language/policies; 0:15 first consent/create; 0:35 display QR and two phones joining; 0:55 each phone picks a song; 1:15 queue sync/reorder/remove; 1:35 native display player and Pause/Replay/Skip; 1:50 policy and withdrawal. Extend or provide separate clips to show native controls, blocked autoplay recovery, hidden tabs and lifecycle evidence clearly. Do not edit away errors to imply successful playback.

## Local reproduction

- UI/source preview: `http://127.0.0.1:5192/` (Vite, hot reload). It is not evidence of Worker behavior.
- Real local Main+Room: `http://127.0.0.1:8792/`, dummy resource IDs and empty `.wrangler/phase2-local/.dev.vars`; isolated state `.wrangler/phase2-local/state`. All 0001–0008 migrations applied locally. No production config/credentials copied. Worker assets use `dist`; frontend edits require build, then refresh (restart if asset watcher does not reload).
- Deterministic player fixture: `http://127.0.0.1:5192/test/browser/phase2.html`. Its heading identifies LOCAL MOCK. It replaces fetch and iframe navigation, supplies a mock `YT.Player`, and is excluded from `dist`. **Mount autoplay**, **Read counters**: one play; Pause/Manual Play/Replay work; toggle browser rejection then mount: only one attempt and blocked after 2s; toggle it off and Manual Play: recovery; 199px or cover before mounting: zero additional play. Read counters after each scenario. Unmount destroys the instance. This is never real playback evidence.
- **Simulate visibilitychange** in that fixture injects a test-only hidden/visible document state: hidden pauses, mounting while hidden does not play, restoring visible does not retry, and Manual Play recovers. This tests the event handling, not an actual mobile browser background policy. `test/browser/storage-blocked.html` separately loads the real app with a throwing localStorage getter; page-only consent, room entry and withdrawal were checked in Vite fallback mode.
- `npm.cmd --% test -- --config vitest.search.config.ts` runs the full suite with a fetch guard. `npm run verify:search` checks the contract with the same no-network setup. This PowerShell form preserves the `--config` argument.
- Keep the service terminals open; Ctrl+C stops them. The current `127.0.0.1` addresses are not a two-phone network setup. Do not use tunnels, remote bindings or production keys to bypass this limit.

## Key restrictions and Console action (no changes performed)

1. Verify that the actual YouTube key belongs to project number **429290784361**, and that both deployed Workers have the intended secret binding. Local names cannot prove this. Redact all key values in screenshots.
2. Retain an API restriction to YouTube Data API v3 and confirm current method quotas. A browser HTTP-referrer restriction is inappropriate for the Worker-to-Google request path: the caller is a server, not the guest page.
3. Evaluate IP restrictions only with a documented, stable outbound egress design compatible with the deployment. Do not assume ordinary Workers have a dedicated fixed IP. Introducing such egress infrastructure is a separate design/release decision; it is not implemented here. Until resolved, keep server-side secrecy, rate limits, budgets, monitoring and least API scope; these reduce risk but are not an application restriction.
4. If rotation is selected: create a replacement in the verified project, apply supported restrictions, update both Worker secrets without exposing them, validate a controlled `videos.list` and authorized search with measured quota, then revoke the old key only after success. Rotation, Console edits and live quota consumption require separate authorization; never publish a key in chat, Git, browser bundle or logs.
5. Gather **7 and 30 days** of per-method calls/units, 403/429 reasons, peaks, successful demand and blocked requests. The user's screenshot showed search.list 100/day and 10,000 units/day for other methods at capture time; it is not current usage. Current official documentation describes separate search and other-method allocations and `videos.list` at 1 unit per call (the app batches up to 50 IDs); internal attempt counters are not a count of individual videos or total Console units. Failed attempts, the app's search ledger and its details-attempt budget are different measurements. No growth prediction or quota increase request is justified by available evidence.

References checked 2026-11-02: [API key security](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices), [YouTube quotas/audits](https://developers.google.com/youtube/data/guides/quota_and_compliance_audits?hl=en), [method costs](https://developers.google.com/youtube/v3/determine_quota_cost), [minimum player functionality](https://developers.google.com/youtube/terms/required-minimum-functionality).

## GO / NO-GO gates

| Gate | Decision now | Required next evidence / owner |
| --- | --- | --- |
| Local source enters release review | GO only after final checks recorded in report | Reviewer inspects focused diff; no automatic release |
| Production deployment authorized | **YES — completed 2026-11-02** | User authorized push/deploy after local report; release checks and Room → Main with keep-vars passed; no new migration |
| Native controls and device flow accepted | **NO-GO pending MANUAL** | Actual YouTube controls at 200×200 (increase size if controls clip), keyboard/link/popups/fullscreen/ads, desktop + two phones, reconnect, first-song/replay/skip/autoplay recovery |
| Production matches source and retention policy | **NO-GO pending PRODUCTION** | Active Main/Room versions/assets, existing 0008 and cron, backlog/backup/old-page checks; no assumption that historical cleanup finished |
| Audit package ready to submit | **NO-GO** | User's legal/operator information, accurate project mapping, current screenshots and real recording, production/device verification, replacement logo supplied by user |
| More quota is needed | **UNDETERMINED; do not apply** | Console 7/30-day method usage, error reasons and measured demand |
| Future room-page ad sales | **NO-GO pending policy clarification** | Seek YouTube written guidance on III.G.1 independent value on the actual API-data-containing mobile room page; /setup content on another page is insufficient evidence |
| API-derived scoring/recommendations policy interpretation | **OPEN** | Ask YouTube about III.E.4 derived metrics and current ranking/recommendation uses; source retention alone is not permission |

No audit/extension form is submitted by this runbook. Only YouTube can provide an official determination. No advertising/affiliate code is enabled.
