# Production 测试指南 / Production Testing Guide

Last updated: 2026-06-26

## 中文版

这个文档专门用来测试线上真实环境，不是测试本地 Vite server。

Production URL:

```txt
https://ktv-assistant.bradwang1995.workers.dev
```

本地 `http://localhost:5173` 仍然可以用来快速看 UI，但它不是生产行为的准绳。真实的 D1 持久化、KV 搜索缓存、Durable Object 房间状态、WebSocket 同步和 Cloudflare Worker + Assets 部署，都应该用上面的 production URL 测。

## 中文 0. 测试前准备

建议用一个新的浏览器 tab，或者无痕窗口测试。这个 app 会把房间 snapshot 写进 `localStorage`，旧浏览器数据可能让测试结果看起来很怪。

如果你想测试最新 `main` 的代码，必须确认它已经部署到 Cloudflare。`git push` 到 GitHub 不等于 production 已更新，除非以后配置了 Cloudflare 自动部署。

主应用部署命令：

```bash
npm run build
npx wrangler deploy --keep-vars
```

如果改到了 `ktv-assistant-room` / Durable Object Worker，再先部署 Room Worker：

```bash
npm run build
npx wrangler deploy --config wrangler.room.toml --keep-vars
npx wrangler deploy --keep-vars
```

快速确认 production 正常：

1. 打开 `https://ktv-assistant.bradwang1995.workers.dev`。
2. 页面应该能正常加载。
3. 打开 `/create` 创建房间。
4. 创建后应该进入同一个 `workers.dev` 域名下的 display 页面。

## 中文 1. 最重要的端到端浏览器测试

这是最接近真实聚会场景的测试。

1. 打开：

```txt
https://ktv-assistant.bradwang1995.workers.dev/create
```

2. 点击创建房间按钮。
3. 你应该进入：

```txt
/room/<roomId>/display
```

4. 把这个 display 页面留在电脑、电视或大屏浏览器上。
5. 用二维码、页面上的手机链接，或手动输入下面地址打开手机页。点击页面上的手机链接时应打开新的浏览器 tab，不应覆盖 display tab：

```txt
https://ktv-assistant.bradwang1995.workers.dev/room/<roomId>/mobile
```

6. 手机页默认应先显示最多 8 条缓存推荐。如果没有缓存，可以为空。
7. 在手机页搜索一首歌，例如：

```txt
后来
```

8. 搜索结果预期：

- 搜索结果来自后端 `/api/rooms/:roomId/search`。
- 最多显示 8 条结果。
- 前排结果优先匹配搜索的歌名本身；相关歌曲、同歌手歌曲和频道命中应排在后面。
- 候选卡片里能看到 YouTube 预览 iframe。
- 点选某个候选视频后，它会有选中态。
- 直接点击或播放候选视频预览时，也会先选中该候选。
- 点击点歌按钮后，会进入歌单 tab。

9. 刷新 mobile 页面。
10. 预期：

- 如果当前在歌单 tab，URL 应包含 `?tab=queue`，刷新后仍停留在歌单 tab。
- 切回点歌 tab 后，URL 回到无 tab 参数或非 queue 参数。

11. 第一首歌加入后的大屏预期：

- Display 页面不用刷新就会更新。
- 第一首歌自动成为当前播放。
- 队列数量会更新。
- 右上角二维码仍然存在，并且不应遮挡 YouTube 右上角播放设置。

12. 再从手机页添加第二首歌。
13. 队列预期：

- 当前播放的第一首不会被打断。
- 第二首会出现在即将播放队列里。
- 手机页和大屏页都会无刷新同步。

## 中文 2. 大屏 YouTube 播放器测试

这一块测试 production 上的 YouTube IFrame Player API。

1. 第一首歌出现在 display 页面后，先观察播放器是否自动尝试播放；如果浏览器策略拦截，再点击底部 `开始 K 歌`。
2. 预期：

- YouTube iframe 初始化参数应包含 `autoplay=1`。
- YouTube 播放器会自动尝试播放；如果当前浏览器允许带声音 autoplay，应直接开始播放。
- app 只会在 YouTube 真正进入播放状态后发送 `PLAYER_STARTED`。
- 如果浏览器阻止自动播放，大屏会显示 autoplay/browser 提示；这时点击底部 `开始 K 歌`，不要依赖 YouTube 中间的 play overlay。
- `开始 K 歌` 和 `下一首` 按钮应位于播放器下方控制栏，不应遮挡 YouTube 进度条。
- 清晰度菜单默认是 `1080p`；改成其他清晰度后，刷新或切到下一首仍应保留该选择。

3. 用 display 页的 `下一首` 按钮做快速切歌测试。
4. 预期：

- 当前歌会标记为 completed。
- 下一首 queued 歌会变成当前播放。
- Display 会自动尝试播放下一首，新 iframe 仍应带 `autoplay=1` 和上一次选择的清晰度参数。

5. 如果想测真实视频结束事件，可以找一首较短的视频，让它自然播完。
6. 预期：

- YouTube 上报 `ENDED`。
- app 发送 `PLAYER_ENDED`。
- 下一首 queued 歌自动变成当前播放。
- 如果队列空了，房间回到 idle。

## 中文 3. Production API Smoke Test

PowerShell:

```powershell
$base = "https://ktv-assistant.bradwang1995.workers.dev"
$room = Invoke-RestMethod -Method Post -Uri "$base/api/rooms"
$room | ConvertTo-Json -Depth 20

$roomId = $room.roomId
Invoke-RestMethod -Uri "$base/api/rooms/$roomId/snapshot" | ConvertTo-Json -Depth 20
```

预期：

- `roomId` 是 8 位小写房间 id。
- `absoluteDisplayUrl` 指向 production display 页面。
- `absoluteMobileUrl` 指向 production mobile 页面。
- snapshot 里 `queue` 是空数组。
- snapshot 里 `playback.playerState` 是 `"idle"`。

搜索 smoke test：

```powershell
$body = @{
  query = "后来"
  limit = 8
  cacheFill = $false
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "$base/api/rooms/$roomId/search" `
  -ContentType "application/json" `
  -Body $body |
  ConvertTo-Json -Depth 20
```

预期：

- HTTP 请求成功。
- 返回里有 `query`、`normalizedQuery`、`cached`、`results`。
- `results` 有 0 到 8 条。
- 如果 `YOUTUBE_API_KEY` 已配置，结果应该是真实 YouTube 搜索结果。

快速测试时建议用 `cacheFill = $false`，跳过冷缓存填充。正常用户搜索的冷缓存填充默认最多消耗 1 次 YouTube `search.list` call，并缓存最多 50 条候选结果。

默认推荐 smoke test：

```powershell
$body = @{
  query = ""
  limit = 8
  cacheFill = $false
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "$base/api/rooms/$roomId/search" `
  -ContentType "application/json" `
  -Body $body |
  ConvertTo-Json -Depth 20
```

预期：返回 `cached = true`，`results` 有 0 到 8 条，且不会调用 YouTube search quota。

## 中文 4. WebSocket Smoke Test

在任意 production 页面打开浏览器 DevTools console，执行：

```js
const roomId = "<roomId>";
const ws = new WebSocket(
  `wss://ktv-assistant.bradwang1995.workers.dev/api/rooms/${roomId}/ws`,
);

let latestMessage = null;

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "JOIN_ROOM",
    role: "mobile",
    clientId: crypto.randomUUID(),
  }));
  ws.send(JSON.stringify({ type: "PING" }));
};

ws.onmessage = (event) => {
  latestMessage = JSON.parse(event.data);
  console.log("WS", latestMessage);
};

ws.onerror = (event) => console.log("WS error", event);
ws.onclose = (event) => console.log("WS close", event.code, event.reason);
```

预期：

- `JOIN_ROOM` 返回 `ROOM_SNAPSHOT`。
- `PING` 返回 `PONG`。
- 同一个 room 打开第二个客户端时，connected-client 数量会变化。

队列命令测试：

```js
ws.send(JSON.stringify({
  type: "ADD_QUEUE_ITEM",
  payload: {
    videoId: "dQw4w9WgXcQ",
    title: "Manual Test Song 1",
    channelTitle: "Manual Test",
  },
}));
```

预期：

- 收到 `ROOM_UPDATED`。
- 如果房间原来是 idle，新增歌曲会变成 `playing`。
- `playback.currentVideoId` 等于新增的 `videoId`。

再加第二首：

```js
ws.send(JSON.stringify({
  type: "ADD_QUEUE_ITEM",
  payload: {
    videoId: "kJQP7kiw5Fk",
    title: "Manual Test Song 2",
    channelTitle: "Manual Test",
  },
}));
```

预期：

- 第二首是 `queued`。
- 当前播放仍然是第一首。

模拟当前歌曲结束：

```js
const current = latestMessage.payload.queue.find((item) => item.status === "playing");

ws.send(JSON.stringify({
  type: "PLAYER_ENDED",
  payload: {
    queueItemId: current.id,
    videoId: current.videoId,
  },
}));
```

预期：

- 之前的当前歌曲变成 `completed`。
- 下一首 queued 歌变成 `playing`。
- 如果没有下一首，`playback.playerState` 变成 `"idle"`。

## 中文 5. Debug 页和 Cleanup 测试

打开：

```txt
https://ktv-assistant.bradwang1995.workers.dev/room/<roomId>/debug
```

预期：

- 能看到连接状态、当前播放状态、队列数量和 snapshot JSON。
- 点击 `刷新远端 snapshot` 后，JSON 应该更新为远端 D1 / Durable Object 当前状态。
- 点击链接区域的任意链接，应该能复制对应 URL，并显示复制成功状态。
- 当队列里有 completed / removed 歌曲时，点击 `清理已完成歌曲` 后，这些项目应该从 snapshot 里移除。
- 清理后 display / mobile 页应该收到更新，或者刷新后看到同样结果。

也可以用 PowerShell 直接测 cleanup endpoint：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "$base/api/rooms/$roomId/cleanup" |
  ConvertTo-Json -Depth 20
```

## 中文 6. 搜索限流测试

搜索限流默认按 room + client identity 做短窗口保护。快速手动测试时，不建议真的刷太多线上请求；只需要确认正常搜索能成功。

如果要验证限流，可以在同一个房间里连续快速调用搜索 API。超过窗口限制后，预期：

- HTTP status 是 `429`。
- 返回错误 code 是 `SEARCH_RATE_LIMITED`。
- response header 里有 `retry-after`。

## 中文 7. 实机设备测试矩阵

这些项目需要真实设备手动验收：

- Mobile Safari：扫码进入 mobile 页，搜索、预览、点歌、歌单操作。
- Android Chrome：扫码进入 mobile 页，搜索、预览、点歌、歌单操作。
- iPad Safari：横竖屏切换、mobile 页排版、YouTube iframe 行为。
- Desktop Chrome：display 页播放、二维码、复制链接、自动切歌。

每个设备至少测一遍：

1. 创建新房间。
2. 手机页搜索并添加两首歌。
3. 大屏点击 `开始 K 歌`。
4. 大屏点击 `下一首`。
5. 打开 debug 页确认 snapshot 和队列状态。

## 中文 8. 不要用本地 server 测这些东西

不要用 `http://localhost:5173` 验证这些 production 功能：

- Durable Object 房间状态
- 真实 WebSocket 房间同步
- 远端 D1 持久化
- 远端 KV 搜索缓存
- production asset 是否真的部署

本地 Vite 模式可能 fallback 到浏览器本地状态，所以它可能看起来能跑，但其实完全绕过了线上后端。

## 中文 9. 通过标准

一次 production 测试通过，至少意味着：

- `/create` 可以创建真实房间。
- Display 和 mobile URL 都在 `workers.dev` 域名下。
- 手机页搜索能返回可用结果。
- 手机页点歌后，大屏无需刷新就更新。
- 同一个 room 的两个客户端能同步。
- 大屏 `开始 K 歌` 能启动 YouTube 播放。
- YouTube 播放开始后，房间状态反映 `PLAYER_STARTED`。
- `下一首` 能切到下一首 queued 歌。
- YouTube 视频自然结束也能推进队列。
- 队列清空后房间回到 idle。

## 中文 10. 如果测试失败

按这个顺序查：

1. 确认你用的是 `https://ktv-assistant.bradwang1995.workers.dev`，不是 localhost。
2. 创建一个全新的房间。
3. 打开 DevTools，看 Console 和 Network。
4. 跑 API smoke test。
5. 跑 WebSocket smoke test。
6. 如果最新 `main` 行为没出现，重新部署 `npx wrangler deploy --keep-vars`。
7. 如果搜索失败，检查 `YOUTUBE_API_KEY`、quota 和 `SEARCH_CACHE`。
8. 如果房间同步失败，检查 `ROOM_OBJECT`、`ktv-assistant-room` 和 D1 bindings。

---

## English Version

This guide is for testing the real deployed app, not the local Vite server.

Production URL:

```txt
https://ktv-assistant.bradwang1995.workers.dev
```

The local `http://localhost:5173` server is still useful for quick UI work, but it is not the source of truth for production behavior. Real D1 persistence, KV search cache, Durable Object room state, WebSocket routing, and Worker + Assets deployment should all be tested against the production URL above.

## English 0. Before You Start

Use a fresh browser tab or an incognito window when you want a clean test. The app stores room snapshots in `localStorage`, so old browser data can make a test confusing.

If you want to test the latest code from `main`, make sure it has actually been deployed to Cloudflare. Pushing to GitHub is not the same thing as deploying unless Cloudflare auto-deploy is configured.

Main app deploy command:

```bash
npm run build
npx wrangler deploy --keep-vars
```

If the `ktv-assistant-room` / Durable Object Worker changed, deploy the Room Worker first:

```bash
npm run build
npx wrangler deploy --config wrangler.room.toml --keep-vars
npx wrangler deploy --keep-vars
```

Quick production sanity check:

1. Open `https://ktv-assistant.bradwang1995.workers.dev`.
2. The page should load.
3. Open `/create` and create a room.
4. The display page should stay under the same `workers.dev` origin.

## English 1. Main End-To-End Browser Test

This is the most important test.

1. Open:

```txt
https://ktv-assistant.bradwang1995.workers.dev/create
```

2. Click the create-room button.
3. You should land on:

```txt
/room/<roomId>/display
```

4. Keep this display page open on your laptop, TV, or desktop browser.
5. Open the mobile page by scanning the QR code, clicking the mobile link, or manually opening it. Clicking the display page mobile link should open a new browser tab and preserve the display tab:

```txt
https://ktv-assistant.bradwang1995.workers.dev/room/<roomId>/mobile
```

6. The mobile search tab should show up to 8 cached recommendations by default. It can be empty if the cache has not been warmed.
7. On the mobile page, search for a song, for example:

```txt
后来
```

8. Expected search behavior:

- Results come from the backend `/api/rooms/:roomId/search` route.
- Up to 8 results are shown.
- Top results prioritize the searched song title itself; related songs, same-artist songs, and channel-only matches should rank lower.
- Candidate cards show YouTube preview iframes.
- Selecting a candidate highlights it.
- Tapping or playing a candidate preview iframe should select that candidate first.
- Tapping the add-song button moves you to the queue tab.

9. Refresh the mobile page.
10. Expected behavior:

- If the current tab is the queue tab, the URL should include `?tab=queue`, and refresh should keep the queue tab active.
- Switching back to search should remove the queue tab URL state.

11. Expected display behavior after adding the first song:

- The display page updates without refresh.
- The first song becomes the current song.
- The queue count updates.
- The QR code remains visible and should not cover YouTube's top-right playback/settings area.

12. Add a second song from the mobile page.
13. Expected queue behavior:

- The current song is not interrupted.
- The second song appears as upcoming.
- Queue changes sync to both display and mobile without refresh.

## English 2. Display Player Test

This tests the production YouTube IFrame Player API path.

1. After the first song appears on the display page, first observe whether the player attempts autoplay; if browser policy blocks it, click the bottom `开始 K 歌` button.
2. Expected behavior:

- The YouTube iframe initializes with `autoplay=1`.
- The YouTube player attempts to start automatically; if the browser allows audible autoplay, playback starts directly.
- The app sends `PLAYER_STARTED` only after YouTube reports that playback has actually started.
- If autoplay is blocked, the display shows a browser/autoplay warning; click the bottom `开始 K 歌` button instead of relying on the YouTube center play overlay.
- `开始 K 歌` and `下一首` should sit below the iframe in the control bar and should not cover the YouTube progress bar.
- The quality selector defaults to `1080p`; after changing it, refresh or advance to the next song and confirm the same quality is retained.

3. Use the display page `下一首` button for a fast auto-advance test.
4. Expected behavior:

- The current song is marked complete.
- The next queued song becomes current.
- The display attempts to play the next song automatically, and the new iframe still carries `autoplay=1` plus the saved quality parameter.

5. For a true end-of-video test, let a short video finish naturally.
6. Expected behavior:

- YouTube reports `ENDED`.
- The app sends `PLAYER_ENDED`.
- The next queued song becomes current.
- If the queue is empty, the room returns to idle.

## English 3. Production API Smoke Test

PowerShell:

```powershell
$base = "https://ktv-assistant.bradwang1995.workers.dev"
$room = Invoke-RestMethod -Method Post -Uri "$base/api/rooms"
$room | ConvertTo-Json -Depth 20

$roomId = $room.roomId
Invoke-RestMethod -Uri "$base/api/rooms/$roomId/snapshot" | ConvertTo-Json -Depth 20
```

Expected:

- `roomId` is an 8-character lowercase room id.
- `absoluteDisplayUrl` points to the production display page.
- `absoluteMobileUrl` points to the production mobile page.
- Snapshot has `queue: []`.
- Snapshot has `playback.playerState: "idle"`.

Search smoke test:

```powershell
$body = @{
  query = "后来"
  limit = 8
  cacheFill = $false
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "$base/api/rooms/$roomId/search" `
  -ContentType "application/json" `
  -Body $body |
  ConvertTo-Json -Depth 20
```

Expected:

- HTTP request succeeds.
- Response includes `query`, `normalizedQuery`, `cached`, and `results`.
- `results` has 0 to 8 items.
- With `YOUTUBE_API_KEY` configured, results should be real YouTube results.

Use `cacheFill = $false` for quick tests to skip cold cache fill. Normal user searches default to at most 1 YouTube `search.list` call and up to 50 cached candidate results.

Default recommendations smoke test:

```powershell
$body = @{
  query = ""
  limit = 8
  cacheFill = $false
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "$base/api/rooms/$roomId/search" `
  -ContentType "application/json" `
  -Body $body |
  ConvertTo-Json -Depth 20
```

Expected: response has `cached = true`, `results` has 0 to 8 items, and YouTube search quota is not used.

## English 4. WebSocket Smoke Test

Use the browser DevTools console on any production page.

```js
const roomId = "<roomId>";
const ws = new WebSocket(
  `wss://ktv-assistant.bradwang1995.workers.dev/api/rooms/${roomId}/ws`,
);

let latestMessage = null;

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "JOIN_ROOM",
    role: "mobile",
    clientId: crypto.randomUUID(),
  }));
  ws.send(JSON.stringify({ type: "PING" }));
};

ws.onmessage = (event) => {
  latestMessage = JSON.parse(event.data);
  console.log("WS", latestMessage);
};

ws.onerror = (event) => console.log("WS error", event);
ws.onclose = (event) => console.log("WS close", event.code, event.reason);
```

Expected:

- `JOIN_ROOM` returns `ROOM_SNAPSHOT`.
- `PING` returns `PONG`.
- Opening a second client for the same room changes the connected-client count.

Queue command test:

```js
ws.send(JSON.stringify({
  type: "ADD_QUEUE_ITEM",
  payload: {
    videoId: "dQw4w9WgXcQ",
    title: "Manual Test Song 1",
    channelTitle: "Manual Test",
  },
}));
```

Expected:

- You receive `ROOM_UPDATED`.
- The added song becomes `playing` if the room was idle.
- `playback.currentVideoId` matches the added `videoId`.

Add a second item:

```js
ws.send(JSON.stringify({
  type: "ADD_QUEUE_ITEM",
  payload: {
    videoId: "kJQP7kiw5Fk",
    title: "Manual Test Song 2",
    channelTitle: "Manual Test",
  },
}));
```

Expected:

- The second item is `queued`.
- The current item is still the first item.

Simulate current song ending:

```js
const current = latestMessage.payload.queue.find((item) => item.status === "playing");

ws.send(JSON.stringify({
  type: "PLAYER_ENDED",
  payload: {
    queueItemId: current.id,
    videoId: current.videoId,
  },
}));
```

Expected:

- The previous current item becomes `completed`.
- The next queued item becomes `playing`.
- If no queued item exists, `playback.playerState` becomes `"idle"`.

## English 5. Debug Page And Cleanup Test

Open:

```txt
https://ktv-assistant.bradwang1995.workers.dev/room/<roomId>/debug
```

Expected:

- You can see connection status, playback status, queue count, and snapshot JSON.
- Clicking `刷新远端 snapshot` refreshes the JSON from remote D1 / Durable Object state.
- Clicking any link row copies that URL and shows copied feedback.
- When the queue has completed / removed items, clicking `清理已完成歌曲` removes those items from the snapshot.
- Display and mobile should receive the update, or show the same result after refresh.

PowerShell cleanup endpoint test:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "$base/api/rooms/$roomId/cleanup" |
  ConvertTo-Json -Depth 20
```

## English 6. Search Rate Limit Test

Search rate limiting protects the search route by room + client identity. For normal manual testing, do not spam production unnecessarily; just confirm regular search succeeds.

If you need to verify the limiter, call the search API repeatedly in the same room. After the limit is exceeded, expected behavior is:

- HTTP status is `429`.
- Error code is `SEARCH_RATE_LIMITED`.
- The response includes a `retry-after` header.

## English 7. Real Device Test Matrix

These items require real device validation:

- Mobile Safari: QR scan into mobile page, search, preview, add song, queue actions.
- Android Chrome: QR scan into mobile page, search, preview, add song, queue actions.
- iPad Safari: orientation changes, mobile layout, YouTube iframe behavior.
- Desktop Chrome: display playback, QR code, link copying, auto-advance.

For each device, run at least:

1. Create a fresh room.
2. Search and add two songs from mobile.
3. Click `开始 K 歌` on display.
4. Click `下一首` on display.
5. Open the debug page and confirm snapshot / queue state.

## English 8. What Not To Test Locally

Do not use `http://localhost:5173` to verify these production features:

- Durable Object room state
- Real WebSocket room sync
- Remote D1 persistence
- Remote KV search cache
- Real production asset deployment

Local Vite mode can fall back to local browser state, so it can look like the app works while completely bypassing the production backend.

## English 9. Pass Criteria

A production test pass means:

- `/create` creates a real room.
- Display and mobile URLs both use `workers.dev`.
- Mobile search returns usable results.
- Adding songs from mobile updates display without refresh.
- Two clients in the same room stay synchronized.
- Display `开始 K 歌` starts YouTube playback.
- `PLAYER_STARTED` is reflected in the room after playback starts.
- `下一首` advances to the next queued song.
- Natural YouTube video ending also advances the room.
- Empty queue returns the room to idle.

## English 10. If Something Fails

Check these in order:

1. Confirm you are using `https://ktv-assistant.bradwang1995.workers.dev`, not localhost.
2. Create a fresh room.
3. Open browser DevTools and check Console and Network.
4. Run the API smoke test.
5. Run the WebSocket smoke test.
6. If latest `main` behavior is missing, deploy with `npx wrangler deploy --keep-vars`.
7. If search fails, check `YOUTUBE_API_KEY`, quota, and `SEARCH_CACHE`.
8. If room sync fails, check `ROOM_OBJECT`, `ktv-assistant-room`, and D1 bindings.
