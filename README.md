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
- `/room/:roomId/display` 大屏播放页，显示 QR code、当前歌曲、播放控制和连接状态。
- `/room/:roomId/mobile` 手机点歌页，支持搜索、预览、点歌、置顶、删歌和重复点歌提示。
- `/room/:roomId/debug` 调试页，支持查看 snapshot、复制房间链接、刷新远端状态和清理已完成歌曲。
- 后端搜索接入 YouTube Data API，KV 缓存搜索结果，并有基础搜索限流。
- 大屏接入 YouTube IFrame Player API，能在播放开始/结束时同步 `PLAYER_STARTED` / `PLAYER_ENDED`。
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
testing.md
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
