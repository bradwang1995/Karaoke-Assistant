# KTV Assistant — English submission draft

Draft for user review, 2026-11-02. Not submitted. Replace/verify bracketed items; never claim this local implementation is the active production release without checking. No YouTube approval, copyright licence or advertising approval is claimed.

## Project and independent value

KTV Assistant (K歌助手) is a free web application for a group karaoke session. A host opens a display on a computer or connected TV; guests scan a room QR code and collaboratively select songs from phones. The application maintains room membership connections, a shared ordered queue, queue promotion/removal and session playback coordination. Guests need no account or Google authorization. Video playback uses the official YouTube IFrame Player; the application does not download videos, extract audio, supply alternate audio tracks or suppress YouTube advertisements.

Website: <https://ktv-assistant.bradwang1995.workers.dev/>. Public overview, equipment guide, Privacy Policy and Terms are accessible without login. Operator/legal applicant: **[user to verify required legal name/entity, address, contact and form declarations]**. Public privacy contact is configured in the website. Google Cloud project number supplied by the operator: **429290784361 [verify actual key/project mapping in Console]**.

## Architecture and API use

React/TypeScript/Vite serves the bilingual interface. A Cloudflare Main Worker handles API requests; a Room Worker/Durable Object coordinates WebSockets. D1 stores room business state, bounded metadata projections and usage ledgers. KV accelerates exact search families and recommendations. The YouTube API key is a server secret, not a browser credential. Ordinary guest access does not require administrator authentication; protected administrator APIs use a separate session cookie.

YouTube methods used: `search.list` for an explicitly submitted uncached text search; `videos.list` for snippet/details/status including `madeForKids` and embedding eligibility, URL lookup, playback checks and bounded maintenance. Exact valid cache hits and empty-query recommendations do not make a YouTube request. A fresh playback decision may separately require `videos.list`. One cold text fill makes at most one search request; external and browser deadlines remain 1600/2000ms. URL entry does not call `search.list`.

| Application interface | Purpose |
| --- | --- |
| `POST /api/rooms` | Create ordinary guest room |
| `GET /api/rooms/:roomId/snapshot` | Room snapshot |
| `GET /api/rooms/:roomId/ws` (WebSocket upgrade) | Join, queue commands and synchronized snapshots |
| `POST /api/rooms/:roomId/search` | Explicit text/URL lookup; empty query returns recommendations |
| `GET /api/youtube/quota` | App search ledger status, not total Google usage |
| `POST /api/youtube/playback/:videoId` | Same-origin, rate-limited, no-store playback decision |
| `POST /api/rooms/:roomId/cleanup` | Completed/removed queue cleanup; not a privacy-erasure API |
| `/api/admin/*` | Operator-only session, usage and repository management |

## Player behavior

Selected phone preview uses one muted, manually started player at a 30-second start point. Display playback is attempted once after readiness and visibility checks; blocked playback has an explicit manual Play/Resume path. App controls sit outside the player. Native controls, keyboard, captions, fullscreen, sharing and links remain enabled. The iframe passes the page origin and an origin-preserving referrer policy. Sandbox permits scripts, same-origin functionality, forms, presentation and independent popups while preventing replacement of the top-level application page. Real cross-origin controls and link behaviors must be verified on the final deployment.

The application currently blocks embedding for MFK=true, unknown, stale and unavailable status; explicit non-MFK, embeddable status must be freshly verified. This conservative product strategy does not claim that YouTube universally prohibits MFK playback.

## Information handling

API metadata groups carry genuine acquisition and expiry times, are limited to 29 days and are rejected when unknown or expired. Copying/merging/accessing/queueing does not refresh acquisition. A separate one-hour status freshness window gates playback. Bounded maintenance refreshes known IDs or removes stale payloads. Business queue references/order/requester fields are separate from API titles/channels/thumbnails. Browser persistent storage keeps business/UI choices and versioned consent, not API payloads; old browser payloads are scrubbed when revisited. Permanently offline browsers cannot be remotely erased.

Routine non-API retention targets: usage events 30 days; inactive rooms not updated for 30 days are cleaned; operator audit and daily quota records 90 days. Inactivity cleanup resets a room after approximately five minutes without clients; that is not complete server/privacy erasure. Hourly bounded jobs can backlog. Current production cleanup completion, backups and old clients still need operator verification. Privacy requests are handled through the public contact using the documented scope/identity process; a shared room link does not identify an individual or authorize disclosure of other guests' data.

Consent is required before protected application features mount. It is stored by version/time in the browser, with a page-only fallback when storage is blocked. Withdrawal unmounts protected features and closes connections across same-origin tabs; it does not erase shared service data or act as server authentication. Google/YouTube and Cloudflare processing are disclosed with links to their policies.

## Quota and commercialization

The operator's screenshot recorded search.list 100/day and other-method quota 10,000 units/day; these are historical configuration, not verified present usage. The app search-call ledger and details budget (1000 attempts/day, at most 500 background) are internal protective limits. **[Attach real 7/30-day Console method usage, peaks and 403/429 analysis.]** We do not currently have evidence justifying an increased quota request and make no usage-growth forecast.

There are currently no third-party advertising scripts or Amazon affiliate tracking in the code. Adsterra and Amazon affiliate links are future possibilities only. No advertising would be placed over/in the YouTube player. Before selling ads on a mobile room page containing YouTube API data, we need YouTube clarification that the non-YouTube material on that same page supplies sufficient independent value if the API data were removed. An equipment guide on a separate URL does not settle that issue. We also seek guidance on the policy treatment of API-derived ranking/recommendation scoring. No written permission has been received or inferred.

## Attachments to supply

**[Current deployed-version evidence; real desktop/two-phone recording; native-control screenshots at phone widths; consent/withdrawal screenshots; metadata cleanup verification; redacted project/key/quota screenshots; completed legal information; user-replaced logo.]** See the evidence runbook for exact targets. Local blank-frame fixtures are deliberately excluded from official playback evidence.
