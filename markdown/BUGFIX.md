# Bugfix Tracker

Last updated: 2026-06-26

This file tracks the June 26 bugfix batch from manual testing.

## 2026-06-26 Batch

- `[x]` Search ranking: user-facing top results now prioritize the searched song title itself before related songs, same-artist songs, or channel-only matches. The public search limit is now 8.
- `[x]` Mobile tab refresh: the mobile page tab is synced to URL state. `?tab=queue` keeps the queue tab after refresh; the default URL stays on search.
- `[x]` Search default recommendations: entering the search tab now loads up to 8 cached recommendations from the KV recommendation pool. Empty search responses do not spend YouTube quota.
- `[x]` Display autoplay: the display player now uses YouTube IFrame autoplay parameters, short retry attempts, and a direct `play()` call from the `开始 K 歌` click path.
- `[x]` Display controls layout: `开始 K 歌` and `下一首` moved into a bottom control bar outside the YouTube iframe, so they no longer cover the YouTube progress bar.
- `[x]` Open mobile/home link behavior: the display page's `打开手机页` link opens in a new browser tab, preserving the display tab for playback while another tab is used for ordering/testing.
- `[x]` Search quota usage: cold cache fills now default to one YouTube `search.list` call with up to 50 results, matching the 50/day project budget more closely.
- `[x]` Search result selection: tapping or playing a YouTube preview iframe now selects that candidate before playback interaction continues.
- `[x]` Display QR overlay: the QR code is offset lower so it no longer covers YouTube's top-right playback/settings area.

## Implementation Notes

- Search changes touched `worker/scoring.ts`, `worker/searchService.ts`, `worker/kvCache.ts`, `worker/router.ts`, `worker/youtubeSearch.ts`, and the frontend search flow in `src/routes/MobilePage.tsx`.
- Player and layout changes touched `src/components/FullscreenPlayer.tsx`, `src/lib/youtubeIframeApi.ts`, and `src/routes/DisplayPage.tsx`.
- Quota tuning touched `worker/searchService.ts`, `worker/youtubeSearch.ts`, `worker/kvCache.ts`, `wrangler.toml`, and `wrangler.room.toml`.
- Unit coverage was added for title-priority ranking and the default recommendation pool.

## Verification

- `npm run test`
- `npm run build`
- Deployed Room Worker version `0df7e1b2-7a47-4ab5-a14f-b38d90b09e9e`
- Deployed main Worker + Assets version `aa11f04a-2b42-442a-accc-813740cc9709`

Local dev-server/browser smoke verification was intentionally skipped for this batch; production manual testing should use the deployed `workers.dev` URL.
