# K歌助手 Internal Test Fix Log

> Source: `C:\Users\bradw\Downloads\ktv_webapp_internal_test_issues.md`  
> Purpose: track the first internal-test issue batch through implementation, verification, commits, push, and redeploy.

## Issue Inventory

| ID | Priority | Area | Issue | Status |
| --- | --- | --- | --- | --- |
| IT-01 | P0 | Mobile queue | Add a visible `切歌 / 下一首` control that skips the current song and syncs playback state. | Done |
| IT-02 | P0 | Mobile queue | Add a `重唱` control that restarts the current song without changing queue order. | Done |
| IT-03 | P0 | Home page | Make portrait mobile layout clearly show `创建房间` and `扫码点歌`, while making intro panels look non-clickable. | Done |
| IT-04 | P1 | Search | Add `带原唱` toggle; default off; use it in search query/ranking. | Done |
| IT-05 | P1 | Search | Add `歌名 / 歌手` search type selector; default song-title mode. | Done |
| IT-06 | P0 | Mobile search | Do not auto-switch to the queue after adding a song; keep search context and show success feedback. | Done |
| IT-07 | P0 | Search preview | Only one preview may play at once; clicking preview/card selects the result. | Done |
| IT-08 | P1 | Search results | Support loading more results from the current cached result set, not new API calls. | Done |
| IT-09 | P1 | Search state | Persist query, type, original-vocal toggle, result cache, visible count, selected video, and scroll position. | Done |
| IT-10 | P2 | Search quality | Improve filtering/ranking for song-title vs artist searches and KTV/original-vocal intent. | Done |

## Implementation Groups

1. Playback and add-song flow
   - IT-01, IT-02, IT-06
   - Expected commit: mobile queue remote controls plus non-disruptive add-song feedback.

2. Mobile-first UI and preview behavior
   - IT-03, IT-07
   - Expected commit: portrait-safe home page and single active preview card.

3. Search controls, caching, persistence, and ranking
   - IT-04, IT-05, IT-08, IT-09, IT-10
   - Expected commit: expanded search request options, cached pagination, local search-state restore, and scoring tests.

4. Documentation and release
   - Update README, SEARCHDETAILS, PROJECT_PROGRESS, and this log.
   - Run typecheck/test/build.
   - Push and redeploy both Workers if room Worker changed.

## Verification Notes

- 2026-07-02 playback/add-song group:
  - `npm run typecheck` passed.
  - `npm run test -- src/lib/roomReducer.test.ts worker/roomCommands.test.ts worker/websocketMessages.test.ts` passed.
- 2026-07-02 mobile home/preview group:
  - `npm run typecheck` passed.
- 2026-07-02 search controls/cache/persistence/ranking group:
  - `npm run typecheck` passed.
  - `npm run test -- worker/searchFamily.test.ts worker/scoring.test.ts` passed.
- 2026-07-02 full verification:
  - `npm run typecheck` passed.
  - `npm run test` passed: 11 test files, 41 tests.
  - `npm run build` passed.
- 2026-07-02 production deployment:
  - Pushed `main` to `origin/main`.
  - Deployed `ktv-assistant-room` version `e893a72f-b718-43a7-adc8-60bd63c6444c`.
  - Deployed `ktv-assistant` version `628c4f22-35e0-481b-8ef4-4be952fc644f`.
  - Production smoke room `1j000c55`: snapshot idle, queue empty, blank-query recommendations cached with 8 results.

## Commit Log

- `4c08ec1` - `Add mobile playback controls`
- `f991c7b` - `Improve mobile entry and previews`
- `bc39cb1` - `Expand mobile search controls`
- `99f231c` - `Document internal test fixes`
- `42174de` - `Record internal test deployment`
