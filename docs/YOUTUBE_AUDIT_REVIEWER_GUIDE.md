# KTV Assistant — reviewer guide

Prepared 2026-11-02. This guide describes the current local source. The changes in this review have **not** been deployed, and no YouTube approval is claimed. Check the active release before using this guide for a production audit.

## Purpose and access

Website: <https://ktv-assistant.bradwang1995.workers.dev/>. Public pages are `/`, `/setup`, `/privacy` and `/terms`. Ordinary participants need no account, Google sign-in, administrator access or installation. The administrator console is an operator tool and is not part of the guest journey.

KTV Assistant coordinates a shared karaoke session: a host uses a computer/TV display, guests use separate phones to arrange one shared queue, and room state synchronizes through WebSockets. Queue order, collaboration, QR joining, restart and next-song controls are application features. Videos remain in YouTube's official embedded player. The service does not download, extract, replace audio, or grant music/public-performance licences.

## Review journey

1. Open the homepage. Switch between Chinese and English with **中 / EN**. Read Privacy Policy and Terms of Use; they link to Google Privacy Policy and YouTube Terms of Service.
2. Choose **Ready to Sing** to reach `/create`. On a fresh browser, the consent checkbox is unchecked and **Agree and continue** is disabled. Declining returns to the public overview. Consent precedes mounting room features, connections and players.
3. Accept locally applicable terms yourself, then choose **Start a Room**. This opens `/room/:roomId/display`. Confirm **Connected**. Expand **Scan to join** in the footer.
4. Scan with two phones. QR data uses `/j/:roomId`; `/room/:roomId/mobile` remains available. Each phone makes its own consent choice. No guest login is required. Use the real deployment origin reachable by those phones; `127.0.0.1` on a phone points to the phone itself.
5. On phone A, submit a song query. Merely typing or changing Song/Artist/URL/Vocals does not submit a query. Select a result; preview is muted, starts at 30 seconds, and requires the user's native Play click. Select **Pick song** to queue it.
6. On phone B, pick another song. Both phones and the display should show one shared current item and the waiting queue. Use **Queue**, move a waiting item to the top, and remove a waiting item. Keep at least one other participant observing synchronization.
7. The first item attempts playback only when the display's player is visible, adequately sized, more than half on screen and not covered by the policy dialog. If visibility or browser autoplay rules block it, use **Play** / **Resume**. Restoring visibility alone does not repeatedly retry playback.
8. Use app-owned **Pause**, **Replay**, **Skip** and progress/seek outside the iframe. Test YouTube's own settings, captions, keyboard, full screen, logo, sharing and outbound links inside the iframe. YouTube chooses its native UI, advertisements and recommendations; `rel=0` does not remove recommendations. App controls must not obscure these features.
9. Open **About and policies**: the mobile brand is the entry; the display has an information icon. Debug/admin have an About entry, and accepted public/create pages have it in their footer. Policy links open separately. Withdraw acceptance: protected children unmount, player instances are destroyed, sockets close and reconnect timers stop. Other same-origin tabs return to the consent screen. This does not delete shared server records or sign an administrator out of their server session.

## Expected limitations

- MFK=true, unknown, stale or unavailable embedding status prevents iframe/script loading. This is a conservative product choice, not a claim that YouTube categorically forbids all MFK embeds. Manual Retry cannot bypass the server decision.
- Removed/private/non-embeddable, regional restrictions, network failures and quota exhaustion may prevent search or playback. An unknown state is not evidence that a video was deleted. Skip/remove remain user actions; errors do not automatically drain the queue.
- A cache hit does not make a YouTube search call. A playback check can separately need `videos.list`; do not label the entire journey zero-API.
- Source tests and blank mock frames cannot prove real YouTube control layout, ads, cross-origin links, real-device autoplay, QR scanning or physical audio. These require the runbook's live-device checks.
- Current code has no third-party advertising scripts or Amazon affiliate tracking. Future advertising is a proposal only and must not overlay the player. This guide is not monetization permission.

See [evidence/runbook](YOUTUBE_AUDIT_EVIDENCE_RUNBOOK.md), [submission draft](YOUTUBE_AUDIT_SUBMISSION_DRAFT.md), and [local remediation report](PHASE_2_REMAINING_REPORT.md).
