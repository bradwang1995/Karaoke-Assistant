# K歌助手手动操作清单

Last updated: 2026-06-25

这个文件专门记录需要你本人手动完成、授权或确认的步骤。项目实现仍然在代码里推进；这里是 Cloudflare 账号、资源创建、部署验证、API key 等必须由你掌控的部分。

## 当前已确认的线上资源

- Cloudflare account: `Bradwang1995@gmail.com's Account` (`7b1b04c010c424952c9d2cbcbea76145`)
- 主应用 Worker + Assets: `ktv-assistant`
- 线上域名: `https://ktv-assistant.bradwang1995.workers.dev`
- Room Durable Object Worker: `ktv-assistant-room`
- Durable Object class: `RoomDurableObject`
- Durable Object namespace id: `0b4ed7f219e94e1fb685b7f554808aba`
- D1 database: `ktv-assistant-db` (`a2fe987b-5191-4ac3-9d01-f923d19c731a`)
- KV namespace: `SEARCH_CACHE` (`aedd751919314f9e81f1917e59a859bd`)
- `YOUTUBE_API_KEY` secret: configured on `ktv-assistant` and `ktv-assistant-room`
- Step 7/8/8.5/8.6/9.5 verified on: `2026-06-25`

## 现在先不用急着做的事

当前本地 MVP 不需要真实 Cloudflare 资源也能运行：

```bash
npm install
npm run dev
```

你现在可以继续在本地检查 UI、流程、交互。等我们准备把本地状态替换成真实后端同步时，再按下面步骤做 Cloudflare 资源。

## 你最终需要准备的账号和权限

- Cloudflare 账号
- 能创建 Workers、Pages、D1、KV、Durable Objects 的权限
- 本机能用 Wrangler 登录 Cloudflare
- 后续接真实搜索时需要 Google Cloud / YouTube Data API key

## Step 1 - 登录 Wrangler

在项目根目录运行：

```bash
npx wrangler login
```

浏览器会打开 Cloudflare 登录和授权页面。完成后回到终端确认登录成功。

可选检查：

```bash
npx wrangler whoami
```

## Step 2 - 创建 D1 数据库

创建数据库：

```bash
npx wrangler d1 create ktv-assistant-db
```

成功后 Wrangler 会输出类似这样的配置片段：

```toml
[[d1_databases]]
binding = "DB"
database_name = "ktv-assistant-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

你需要把输出里的 `database_id` 填到两个文件里：

- `wrangler.toml`
- `wrangler.room.toml`

都替换这一行：

```toml
database_id = "a2fe987b-5191-4ac3-9d01-f923d19c731a"
```

## Step 3 - 创建 KV namespace

创建搜索缓存 namespace：

```bash
npx wrangler kv namespace create SEARCH_CACHE
```

成功后 Wrangler 会输出类似这样的配置片段：

```toml
[[kv_namespaces]]
binding = "SEARCH_CACHE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

你需要把输出里的 `id` 填到两个文件里：

- `wrangler.toml`
- `wrangler.room.toml`

都替换这一行：

```toml
id = "aedd751919314f9e81f1917e59a859bd"
```

## Step 4 - 初始化 D1 schema

我们已经有 schema 文件：

```txt
migrations/0001_initial.sql
```

等 `database_id` 替换好之后，运行：

```bash
npx wrangler d1 execute ktv-assistant-db --file ./migrations/0001_initial.sql --remote
```

如果你只想先本地试 D1，可以把 `--remote` 换成 `--local`，但正式上线前必须对 remote D1 执行一次。

## Step 5 - 部署 Room Durable Object Worker

这个项目现在有两份 Wrangler 配置：

- `wrangler.toml`：Cloudflare Pages + Pages Functions
- `wrangler.room.toml`：Room Durable Object Worker

原因：Cloudflare Pages Functions 可以绑定 Durable Object，但 Durable Object class 需要由单独的 Worker 创建和部署。

先做 dry-run：

```bash
npx wrangler deploy --config wrangler.room.toml --dry-run
```

如果 dry-run 没问题，再真正部署：

```bash
npx wrangler deploy --config wrangler.room.toml
```

部署成功后，Cloudflare 里应该出现一个 Worker：

```txt
ktv-assistant-room
```

这个 Worker 导出：

```txt
RoomDurableObject
```

## Step 6 - 创建或部署 Cloudflare 应用

先构建前端：

```bash
npm run build
```

当前实际线上形态是 Cloudflare Worker + Assets：

```bash
npx wrangler deploy
```

部署成功后的主应用域名是：

```txt
https://ktv-assistant.bradwang1995.workers.dev
```

如果后续改回 Cloudflare Pages，再使用 Pages direct upload：

```bash
npx wrangler pages project create
npx wrangler pages deploy dist
```

如果你想用 GitHub 自动部署：

1. 把本地 repo 推到 GitHub。
2. 在 Cloudflare Dashboard 里进入 Workers & Pages。
3. 创建 Cloudflare Pages 项目，选择 GitHub repo。
4. Build command 设置为：

```bash
npm run build
```

5. Build output directory 设置为：

```txt
dist
```

## Step 7 - 给主应用绑定 D1、KV 和 Durable Object

主应用部署后，需要在 Cloudflare Dashboard 或 Wrangler config 里确认这些绑定：

```txt
DB -> ktv-assistant-db, database_id = a2fe987b-5191-4ac3-9d01-f923d19c731a
SEARCH_CACHE -> SEARCH_CACHE, namespace_id = aedd751919314f9e81f1917e59a859bd
ROOM_OBJECT -> RoomDurableObject, script_name = ktv-assistant-room
```

当前 `wrangler.toml` 和 `wrangler.room.toml` 已经写入真实 D1/KV id。2026-06-25 已通过 `wrangler versions view` 确认主应用 Worker 版本 `b430cf03-42ac-42b5-b80f-67754e1e09aa` 含有 `DB`、`SEARCH_CACHE`、`ROOM_OBJECT` 三个绑定，并且 `ROOM_OBJECT` 指向 `ktv-assistant-room`。

## Step 8 - 验证后端 API

部署完成后，打开线上域名：

```txt
https://ktv-assistant.bradwang1995.workers.dev
```

创建房间 API 应该能返回 JSON：

```bash
curl -X POST https://ktv-assistant.bradwang1995.workers.dev/api/rooms
```

你应该看到类似：

```json
{
  "roomId": "abc123xy",
  "displayUrl": "/room/abc123xy/display",
  "mobileUrl": "/room/abc123xy/mobile",
  "snapshot": {
    "room": {
      "id": "abc123xy"
    },
    "queue": [],
    "playback": {
      "playerState": "idle"
    },
    "connectedClients": 0
  }
}
```

再验证 snapshot：

```bash
curl https://ktv-assistant.bradwang1995.workers.dev/api/rooms/<roomId>/snapshot
```

2026-06-25 已验证通过：

- `POST /api/rooms` 返回 `200 OK`
- 测试房间 `roomId`: `473p0b41`
- `GET /api/rooms/473p0b41/snapshot` 返回 `200 OK`
- 线上返回的 `playerState` 是 `idle`，`queue` 是空数组，`connectedClients` 是 `0`

## Step 8.5 - 验证 WebSocket 房间连接

这一项需要主应用 Worker + Room Durable Object Worker + D1 都配置好之后再做。当前 Vite 本地 dev server 不会提供真实 `/api/rooms/:roomId/ws`，所以本地打不开 WebSocket 是正常的。

2026-06-25 已验证通过：

- 测试房间 `roomId`: `462g123j`
- `wss://ktv-assistant.bradwang1995.workers.dev/api/rooms/462g123j/ws` 可以连接
- `JOIN_ROOM` 返回 `ROOM_SNAPSHOT`
- `PING` 返回 `PONG`
- 第二个客户端连接同一房间后，第一个客户端收到 `ROOM_UPDATED`，`connectedClients` 变为 `2`

先用 `POST /api/rooms` 创建一个 room，并记下返回的 `roomId`。然后任选一种方式测试 WebSocket。

浏览器 DevTools 测试：

```js
const roomId = "<roomId>";
const ws = new WebSocket(`wss://ktv-assistant.bradwang1995.workers.dev/api/rooms/${roomId}/ws`);
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "JOIN_ROOM",
    role: "mobile",
    clientId: crypto.randomUUID()
  }));
  ws.send(JSON.stringify({ type: "PING" }));
};
ws.onmessage = (event) => console.log("WS message", event.data);
ws.onerror = (event) => console.log("WS error", event);
ws.onclose = (event) => console.log("WS close", event.code, event.reason);
```

期望看到：

- `ROOM_SNAPSHOT`
- `PONG`
- 如果再开一个 tab 连接同一个 room，第一个 tab 可能收到 `ROOM_UPDATED`，里面的 `connectedClients` 会变化。

如果你安装了 `wscat`，也可以用命令行测试：

```bash
npx wscat -c wss://ktv-assistant.bradwang1995.workers.dev/api/rooms/<roomId>/ws
```

连接后输入：

```json
{"type":"JOIN_ROOM","role":"mobile","clientId":"manual-test"}
```

再输入：

```json
{"type":"PING"}
```

## Step 8.6 - 验证 WebSocket 队列操作

这一项同样需要真实 Cloudflare Worker + Room Worker + D1 资源。

先用 Step 8.5 的方法打开 WebSocket，并完成 `JOIN_ROOM`。你应该已经能看到 `ROOM_SNAPSHOT`。

添加第一首歌：

```js
ws.send(JSON.stringify({
  type: "ADD_QUEUE_ITEM",
  payload: {
    videoId: "dQw4w9WgXcQ",
    title: "测试歌曲 1 KTV",
    channelTitle: "Manual Test"
  }
}));
```

期望看到 `ROOM_UPDATED`，其中：

- `playback.currentVideoId` 是 `dQw4w9WgXcQ`
- 第一首歌的 `status` 是 `playing`

添加第二首歌：

```js
ws.send(JSON.stringify({
  type: "ADD_QUEUE_ITEM",
  payload: {
    videoId: "kJQP7kiw5Fk",
    title: "测试歌曲 2 KTV",
    channelTitle: "Manual Test"
  }
}));
```

期望看到 `ROOM_UPDATED`，其中第二首歌在 `queue` 里是 `queued`，当前播放仍然是第一首。

置顶第二首歌：

```js
const latest = JSON.parse("<paste latest ROOM_UPDATED json here>");
const queued = latest.payload.queue.find((item) => item.status === "queued");
ws.send(JSON.stringify({
  type: "PROMOTE_QUEUE_ITEM",
  payload: {
    queueItemId: queued.id
  }
}));
```

删除一首 queued 歌：

```js
ws.send(JSON.stringify({
  type: "REMOVE_QUEUE_ITEM",
  payload: {
    queueItemId: queued.id
  }
}));
```

模拟当前歌曲结束：

```js
const current = latest.payload.queue.find((item) => item.status === "playing");
ws.send(JSON.stringify({
  type: "PLAYER_ENDED",
  payload: {
    queueItemId: current.id,
    videoId: current.videoId
  }
}));
```

期望看到下一首 queued 歌变成 `playing`。如果队列空了，`playback.playerState` 应回到 `idle`。

2026-06-25 已验证通过：

- 测试房间 `462g123j`：`ADD_QUEUE_ITEM`、`PROMOTE_QUEUE_ITEM`、`REMOVE_QUEUE_ITEM`、`PLAYER_ENDED` 都返回 `ROOM_UPDATED`
- 删除 queued 歌后结束当前歌，房间回到 `idle`，`currentVideoId` 清空
- 额外测试房间 `4v3l3o07`：当前歌 `PLAYER_ENDED` 后，下一首 queued 歌自动变成 `playing`
- HTTP snapshot 复查通过，WebSocket 队列操作已写回 D1
- Unicode 标题检查通过，线上 JSON/WebSocket/D1 链路可以保存中文标题

## Step 9 - 后续接 YouTube API key

代码现在已经支持真实 YouTube search provider。没有 `YOUTUBE_API_KEY` 时，后端会返回 mock search 结果，方便继续开发；配置 secret 后才会调用 YouTube Data API。

你需要：

1. 去 Google Cloud 创建或选择项目。
2. 启用 YouTube Data API v3。
3. 创建 API key。
4. 在 Cloudflare `ktv-assistant` Worker 里设置 encrypted secret：

Cloudflare Dashboard:

```txt
Workers & Pages -> ktv-assistant -> Settings -> Variables and Secrets -> Add
```

变量名：

```txt
YOUTUBE_API_KEY
```

选择 Encrypt，然后保存。

如果你后续也想直接访问 `ktv-assistant-room` Worker 的 search route，可以给 Room Worker 也设置同名 secret：

```bash
npx wrangler secret put YOUTUBE_API_KEY --config wrangler.room.toml
```

不要把 API key 写进源码、README、`.env`、`.dev.vars` 或 wrangler toml 并 commit。

## Step 9.5 - 验证搜索 API

如果还没有设置 `YOUTUBE_API_KEY`，这个 API 也会返回 mock 结果：

```bash
curl -X POST https://ktv-assistant.bradwang1995.workers.dev/api/rooms/<roomId>/search \
  -H "content-type: application/json" \
  -d "{\"query\":\"后来\",\"limit\":4}"
```

期望看到：

```json
{
  "query": "后来",
  "normalizedQuery": "后来 ktv",
  "cached": false,
  "results": []
}
```

真实返回里 `results` 应该有 0 到 4 个视频。设置 `YOUTUBE_API_KEY` 后再执行同一个请求，应该返回真实 YouTube 搜索结果。重复同一个搜索时，如果 KV 已配置，`cached` 应该可能变成 `true`。

2026-06-25 已验证通过：

- `YOUTUBE_API_KEY` 已配置在 `ktv-assistant` 和 `ktv-assistant-room`
- 测试房间 `roomId`: `6z3b0y00`
- 第一次请求 `POST /api/rooms/6z3b0y00/search` 返回 `200 OK`
- 查询 `后来` 返回 `normalizedQuery = "后来 ktv"`
- 第一次请求返回真实 YouTube results，`cached = false`，`results.length = 4`
- 第一条结果：`刘若英 《后来》 Pinyin Karaoke Version Instrumental Music 拼音卡拉OK伴奏 KTV with Pinyin Lyrics 4k`
- 第二次同 query 请求返回 `cached = true`，确认 KV cache 可命中

## Step 10 - 手动验收 checklist

资源创建后，逐项检查：

- `[x]` `wrangler.toml` 里的 D1 `database_id` 已替换
- `[x]` `wrangler.room.toml` 里的 D1 `database_id` 已替换
- `[x]` `wrangler.toml` 里的 KV `id` 已替换
- `[x]` `wrangler.room.toml` 里的 KV `id` 已替换
- `[x]` D1 schema 已执行到 remote D1
- `[x]` `ktv-assistant-room` Worker 已部署
- `[x]` 主应用 `ktv-assistant` Worker + Assets 已部署
- `[x]` 线上首页能访问：`https://ktv-assistant.bradwang1995.workers.dev`
- `[x]` `POST /api/rooms` 返回 JSON
- `[x]` `GET /api/rooms/:roomId/snapshot` 返回 JSON
- `[x]` `GET /api/rooms/:roomId/ws` 可以 WebSocket 连接
- `[x]` WebSocket `JOIN_ROOM` 返回 `ROOM_SNAPSHOT`
- `[x]` WebSocket `PING` 返回 `PONG`
- `[x]` WebSocket `ADD_QUEUE_ITEM` 返回 `ROOM_UPDATED`
- `[x]` WebSocket `PROMOTE_QUEUE_ITEM` 返回 `ROOM_UPDATED`
- `[x]` WebSocket `REMOVE_QUEUE_ITEM` 返回 `ROOM_UPDATED`
- `[x]` WebSocket `PLAYER_ENDED` 能切到下一首或回到 idle
- `[x]` `POST /api/rooms/:roomId/search` 返回 JSON
- `[x]` 设置 `YOUTUBE_API_KEY` 后 search 返回真实 YouTube results
- `[x]` 重复搜索时 KV cache 可命中
- `[ ]` `/create` 创建房间后能进入 display 页面

## 当前不要手动改的东西

- 不要手动编辑 D1 表结构，优先改 `migrations/0001_initial.sql` 或新增 migration。
- 不要把 YouTube API key 写进源码、README 或 wrangler toml。
- 不要把 Cloudflare 账号 token、API token、secret commit 到 git。
- 不要下载、转码、提取或重新托管 YouTube 视频；这个项目只做搜索和 embed 播放。

## 官方文档参考

- Cloudflare D1 Wrangler commands: https://developers.cloudflare.com/d1/wrangler-commands/
- Cloudflare KV Wrangler commands: https://developers.cloudflare.com/kv/reference/kv-commands/
- Cloudflare Pages Direct Upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare Pages Functions bindings: https://developers.cloudflare.com/pages/functions/bindings/
- Cloudflare Durable Objects getting started: https://developers.cloudflare.com/durable-objects/get-started/

## Phase 7 - Production polish and reliability checks

Last updated: 2026-06-26

这部分是当前 production MVP 的日常手动验收入口。完整双语测试流程见 `testing.md`。

### 部署提醒

只改主应用 Worker + Assets 时：

```bash
npm run build
npx wrangler deploy --keep-vars
```

如果改到了 Room Durable Object Worker：

```bash
npm run build
npx wrangler deploy --config wrangler.room.toml --keep-vars
npx wrangler deploy --keep-vars
```

使用 `--keep-vars`，避免覆盖 Cloudflare Dashboard 中已有变量。不要把 `YOUTUBE_API_KEY` 或 Cloudflare token 写入源码。

### Debug 页

打开：

```txt
https://ktv-assistant.bradwang1995.workers.dev/room/<roomId>/debug
```

可以检查：

- WebSocket 连接状态
- 当前 playback state
- queue 数量
- room snapshot JSON
- display / mobile / debug 链接复制
- `POST /api/rooms/:roomId/cleanup` 清理 completed / removed 歌曲

### Search rate limit

当前主应用和 Room Worker 配置：

```toml
SEARCH_RATE_LIMIT_PER_MINUTE = "20"
```

超过限制时，搜索 API 应返回：

- HTTP `429`
- error code `SEARCH_RATE_LIMITED`
- `retry-after` header

### 仍需真实设备验收

以下测试必须在真实设备上完成，不能只用本地 Vite server 代替：

- Mobile Safari
- Android Chrome
- iPad Safari
- Desktop Chrome

每个设备至少测试创建房间、扫码/打开手机页、搜索、点两首歌、大屏开始播放、下一首、debug snapshot。
