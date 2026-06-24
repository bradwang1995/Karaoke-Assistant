# K歌助手手动操作清单

Last updated: 2026-06-24

这个文件专门记录需要你本人手动完成、授权或确认的步骤。项目实现仍然在代码里推进；这里是 Cloudflare 账号、资源创建、部署验证、API key 等必须由你掌控的部分。

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
database_id = "replace-with-cloudflare-d1-id"
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
id = "replace-with-kv-namespace-id"
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

## Step 6 - 创建或部署 Cloudflare Pages 项目

先构建前端：

```bash
npm run build
```

如果你想用 Wrangler 直接上传 Pages：

```bash
npx wrangler pages project create
npx wrangler pages deploy dist
```

如果你想用 GitHub 自动部署：

1. 把本地 repo 推到 GitHub。
2. 在 Cloudflare Dashboard 里进入 Workers & Pages。
3. 创建 Pages project，选择 GitHub repo。
4. Build command 设置为：

```bash
npm run build
```

5. Build output directory 设置为：

```txt
dist
```

## Step 7 - 给 Pages 绑定 D1、KV 和 Durable Object

Pages project 创建后，需要在 Cloudflare Dashboard 或 Wrangler config 里确认这些绑定：

```txt
DB -> ktv-assistant-db
SEARCH_CACHE -> 你的 KV namespace
ROOM_OBJECT -> RoomDurableObject, script_name = ktv-assistant-room
```

当前 `wrangler.toml` 已经写了绑定名称和 Durable Object 关系，但 D1/KV 的真实 id 仍然需要你替换。

## Step 8 - 验证后端 API

部署完成后，打开 Pages 域名，例如：

```txt
https://<your-project>.pages.dev
```

创建房间 API 应该能返回 JSON：

```bash
curl -X POST https://<your-project>.pages.dev/api/rooms
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
curl https://<your-project>.pages.dev/api/rooms/<roomId>/snapshot
```

## Step 9 - 后续接 YouTube API key

这一项不是当前 step 必须做。等我们实现真实 YouTube search provider 后，你需要：

1. 去 Google Cloud 创建或选择项目。
2. 启用 YouTube Data API v3。
3. 创建 API key。
4. 在 Cloudflare Worker/Pages 里设置 secret：

```bash
npx wrangler secret put YOUTUBE_API_KEY
```

如果 secret 需要同时给 Room Worker 和 Pages Functions 使用，我们到时候会按实际代码路径分别设置。

## Step 10 - 手动验收 checklist

资源创建后，逐项检查：

- `[ ]` `wrangler.toml` 里的 D1 `database_id` 已替换
- `[ ]` `wrangler.room.toml` 里的 D1 `database_id` 已替换
- `[ ]` `wrangler.toml` 里的 KV `id` 已替换
- `[ ]` `wrangler.room.toml` 里的 KV `id` 已替换
- `[ ]` D1 schema 已执行到 remote D1
- `[ ]` `ktv-assistant-room` Worker 已部署
- `[ ]` Pages project 已创建
- `[ ]` Pages project 能访问首页
- `[ ]` `POST /api/rooms` 返回 JSON
- `[ ]` `GET /api/rooms/:roomId/snapshot` 返回 JSON
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

