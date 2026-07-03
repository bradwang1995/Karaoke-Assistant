# Post Internal Test Fix Log 1

> Source: pasted post-internal-test feedback from 2026-07-03.
> Purpose: keep this round of follow-up polish grouped by implementation batch, commits, verification, push, and redeploy.

## Issue Inventory

| ID | Priority | Area | Request | Status |
| --- | --- | --- | --- | --- |
| PIT-01 | P1 | Mobile search cards | Move `已选中` / `已在歌单` into overlay pill tags so card content does not shift. | Done |
| PIT-02 | P0 | Search ranking | Restore KTV/karaoke versions as top priority, then accompaniment/lyrics video, while still respecting original-vocal intent. | Planned |
| PIT-03 | P1 | Mobile preview | Remove redundant preview buttons; selecting a result should auto-preview it. | Done |
| PIT-04 | P1 | Create page | Remove the `扫码点歌` button from the create-room page because no room exists yet. | Done |
| PIT-05 | P1 | Add-song feedback | Replace per-card notification with a page-level toast and a visual flight animation into the queue/count area. | Done |
| PIT-06 | P1 | Mobile queue count | Show the current song-list count in the queue tab/header count area. | Done |
| PIT-07 | P1 | Mobile search controls | Convert `带原唱` from checkbox to pill toggle; put type, query, toggle, and icon-only search button on one compact row. | Done |
| PIT-08 | P1 | Mobile search controls | Keep search controls and visible-result count sticky while scrolling results. | Done |
| PIT-09 | P1 | Mobile preview | Hide removable YouTube preview chrome and stop preview when the user clicks away. | Done |
| PIT-10 | P1 | Display player | Hide removable YouTube player chrome such as title/menu/settings/fullscreen; keep app-level playback controls. | Planned |
| PIT-11 | P1 | Display player | Keep a useful progress/seek control after hiding YouTube controls. | Planned |
| PIT-12 | P1 | Display quality | Keep the app quality selector authoritative and avoid mismatched YouTube quality chrome. | Planned |
| PIT-13 | P0 | Room lifecycle | Auto-clean inactive rooms after 5 minutes without activity. | Planned |
| PIT-14 | P0 | Room heartbeat | Treat open display/mobile pages as active by sending/receiving periodic heartbeats. | Planned |
| PIT-15 | P1 | Search quota | Show remaining YouTube Search API calls using a backend estimate and reset it on the correct daily schedule. | Planned |

## Implementation Groups

1. Mobile and create-page UX polish
   - PIT-01, PIT-03, PIT-04, PIT-05, PIT-06, PIT-07, PIT-08, PIT-09
   - Expected commit: compact sticky search controls, overlay tags, general toast, add-to-queue animation, and create-page cleanup.

2. Search ranking and quota visibility
   - PIT-02, PIT-15
   - Expected commit: stronger KTV scoring tests, Pacific-Time quota reset, quota status API, and small UI quota display.

3. Display/preview YouTube chrome cleanup
   - PIT-10, PIT-11, PIT-12
   - Expected commit: hidden YouTube controls where possible plus app-owned progress/seek and quality controls.

4. Room heartbeat and inactivity cleanup
   - PIT-13, PIT-14
   - Expected commit: Durable Object activity tracking, alarm-based inactivity cleanup, and heartbeat behavior.

5. Documentation and release
   - Update README, PROJECT_PROGRESS, TESTING, and this log.
   - Run `npm run typecheck`, `npm run test`, and `npm run build`.
   - Push and redeploy the Room Worker first if it changed, then the main Worker.

## Verification Notes

- 2026-07-03 group 1 mobile/create-page UX polish:
  - `npm run typecheck` passed.

## Commit Log

- Pending.
