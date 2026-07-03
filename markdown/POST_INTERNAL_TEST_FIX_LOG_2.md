# Post Internal Test Fix Log 2

> Source: second pasted desktop post-internal-test feedback from 2026-07-03.
> Purpose: keep this second follow-up polish pass grouped by implementation batch, commits, verification, push, and redeploy.

## Issue Inventory

| ID | Priority | Area | Request | Status |
| --- | --- | --- | --- | --- |
| PIT2-01 | P1 | Mobile sticky search | Prevent the sticky search/header controls from being clipped or overlapped while scrolling. | Done |
| PIT2-02 | P1 | Mobile preview | Make selecting a candidate auto-preview without a separate play affordance, reduce YouTube hover chrome, and request 480p preview quality. | Done |
| PIT2-03 | P0 | Search ranking | Keep partial title matches such as `依赖` -> `离开我的依赖` ahead of unrelated KTV results like `唯一`. | Done |
| PIT2-04 | P0 | Display quality | Keep default display playback at 1080p, persist user-selected quality for later songs, and show concrete current-video quality options instead of `最高`. | Done |
| PIT2-05 | P1 | Display controls | Remove the redundant `开始 K 歌` button, center/enlarge the app progress bar, keep next-song control, and make queue count look like text instead of a button. | Done |
| PIT2-06 | P1 | Display metadata | Hide the uploader/channel name from the main display footer and show quota reset in the browser's local timezone. | Done |
| PIT2-07 | P1 | Display QR | Remove the QR header icon, copy button, and `打开手机页` button; enlarge `扫码点歌`, make it the mobile-page link, and slightly enlarge the QR code. | Done |
| PIT2-08 | P1 | Mobile queue | Remove the queue count from the `歌单` tab because the header already shows the count. | Done |
| PIT2-09 | P1 | Mobile queue actions | Add confirmation for `重唱` and `切歌`, remove confirmation for `置顶`, and make `重唱` / `切歌` neutral white buttons. | Done |
| PIT2-10 | P1 | Documentation/release | Update docs, run verification, commit in related batches, push, and redeploy. | In progress |

## Implementation Groups

1. Player, preview, and search behavior
   - PIT2-01, PIT2-02, PIT2-03, PIT2-04
   - Expected commit: real quality options/effective quality reporting, 480p preview, preview simplification, sticky search offset, and stricter partial-title ranking.

2. Display and QR polish
   - PIT2-05, PIT2-06, PIT2-07
   - Expected commit: larger centered progress, no start button, local quota reset time, cleaner QR card, and display metadata cleanup.

3. Mobile queue controls
   - PIT2-08, PIT2-09
   - Expected commit: queue tab count removal, direct promote, restart/skip confirmation, and neutral button styling.

4. Documentation and release
   - Update README, PROJECT_PROGRESS, TESTING, and this log.
   - Run `npm run typecheck`, `npm run test`, and `npm run build`.
   - Push and redeploy the main Worker. Deploy the Room Worker only if Worker/DO code changes.

## Verification Notes

- 2026-07-03 targeted local verification:
  - `npm run typecheck` passed.
  - `npm run test -- worker/scoring.test.ts src/lib/youtubePlaybackQuality.test.ts` passed.
  - Local browser smoke was attempted, but Vite could not bind a local port in this sandboxed desktop environment (`listen UNKNOWN` on 127.0.0.1 and 0.0.0.0). Browser visual QA remains a manual/production smoke item for this pass.
- 2026-07-03 full local verification:
  - `npm run typecheck` passed.
  - `npm run test` passed: 12 test files, 47 tests.
  - `npm run build` passed.

## Commit Log

- `5798259` - `Polish playback quality and queue controls`
- `a79c961` - `Document post internal test pass two`
