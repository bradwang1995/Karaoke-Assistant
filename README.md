# K歌助手

一个面向朋友聚会场景的 Web KTV 点歌助手：大屏负责播放，手机负责点歌，同一个房间通过 Cloudflare Worker + Durable Object + WebSocket 同步歌单。

## Production

- 主应用域名：`https://ktv-assistant.bradwang1995.workers.dev`
- 主应用 Worker：`ktv-assistant`
- Room Durable Object Worker：`ktv-assistant-room`
- Durable Object class：`RoomDurableObject`
- D1 database：`ktv-assistant-db` (`a2fe987b-5191-4ac3-9d01-f923d19c731a`)
- KV namespace：`SEARCH_CACHE` (`aedd751919314f9e81f1917e59a859bd`)
- YouTube Data API secret：`YOUTUBE_API_KEY` 已配置在 Cloudflare

## 当前功能

- `/create` 创建房间并进入大屏页。
- `/room/:roomId/display` 大屏播放页，显示 QR code、当前歌曲、播放控制和连接状态；二维码避开 YouTube 右上角控件，手机页链接会打开新 tab。
- `/room/:roomId/mobile` 手机点歌页，支持搜索、缓存推荐、预览、点歌、置顶、删歌、重复点歌提示和刷新保留 tab。
- `/room/:roomId/debug` 调试页，支持查看 snapshot、复制房间链接、刷新远端状态和清理已完成歌曲。
- 后端搜索接入 YouTube Data API，KV 缓存搜索结果和默认推荐；冷搜索默认最多消耗 1 次 `search.list` call、缓存 50 条候选，前端最多返回 8 条，并有基础搜索限流。
- 大屏接入 YouTube IFrame Player API，当前歌出现后会主动尝试播放，切到下一首时继续自动尝试播放；播放开始/结束会同步 `PLAYER_STARTED` / `PLAYER_ENDED`，播放按钮不覆盖 YouTube 控件。
- 大屏播放器默认建议 1080p 清晰度，并会记住本机上次选择的播放清晰度用于下一首视频。
- WebSocket 支持重连 backoff；production 断线时不会静默写入本地假状态。
- 本地 Vite 模式保留 localStorage fallback，方便 UI 开发。

## 本地开发

```bash
npm install
npm run dev
```

本地 Vite server 主要用于 UI 开发。真实 D1、KV、Durable Object、WebSocket 和 production asset 行为，请使用 production URL 测试。

## 验证

```bash
npm run typecheck
npm run test
npm run build
```

Production 测试流程见：

```txt
markdown/TESTING.MD
```

## 部署

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

使用 `--keep-vars` 是为了避免覆盖 Cloudflare Dashboard 中已有的变量配置。不要把 `YOUTUBE_API_KEY` 或 Cloudflare token 写进源码、README、`.env`、`.dev.vars` 或 Wrangler config。

## 重要约束

- YouTube 内容只通过官方 embed / IFrame Player API 播放。
- 不下载、不转码、不提取、不重新托管 YouTube 视频。
- production 行为以 `workers.dev` 线上环境为准，不以本地 Vite fallback 为准。
