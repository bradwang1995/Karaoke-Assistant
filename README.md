# K歌助手

一个面向朋友聚会的 Web KTV 点歌助手。当前版本已经跑通本地 MVP，并完成 Cloudflare Worker + Assets、Durable Object、D1、KV、WebSocket 队列和真实 YouTube 搜索的线上验证。

## MVP 已包含

- `/create` 创建房间并进入大屏页
- `/room/:roomId/display` 大屏播放页，显示二维码和当前歌曲
- `/room/:roomId/mobile` 手机点歌页，包含「点歌」和「歌单」两个标签
- 真实 YouTube 搜索 API，返回 4 个候选视频；本地/失败时保留 mock fallback
- 候选视频可预览、选择并加入歌单
- 本地跨标签页同步歌单、置顶、删歌、下一首
- Cloudflare Worker + Assets 部署配置、D1 初始 migration、KV 缓存和 Durable Object 房间后端

## 线上环境

- 主应用域名：`https://ktv-assistant.bradwang1995.workers.dev`
- 主应用 Worker：`ktv-assistant`
- Room Durable Object Worker：`ktv-assistant-room`
- D1 database：`ktv-assistant-db` (`a2fe987b-5191-4ac3-9d01-f923d19c731a`)
- KV namespace：`SEARCH_CACHE` (`aedd751919314f9e81f1917e59a859bd`)
- Durable Object class：`RoomDurableObject`
- YouTube Data API secret：已配置为 `YOUTUBE_API_KEY`

## 本地运行

```bash
npm install
npm run dev
```

打开 `/create` 创建房间。大屏页右上角二维码会指向同一个房间的手机点歌页。

## 验证

```bash
npm run build
npm run test
```

## Cloudflare backend notes

当前仓库里有两份 Wrangler 配置：

- `wrangler.toml`：主应用 Worker + Assets，负责前端资源和 `/api/*`。
- `wrangler.room.toml`：Room Durable Object Worker。

主应用 Worker 已绑定 `DB`、`SEARCH_CACHE` 和 `ROOM_OBJECT`。`ROOM_OBJECT` 指向 `ktv-assistant-room` 导出的 `RoomDurableObject`；两个 Wrangler 文件里的 D1/KV id 都已替换成真实资源 id。

## 后续方向

1. 按 [searchdetails.md](searchdetails.md) 扩展搜索 query、100-result cache fill 和 quota guardrails。
2. 用 YouTube IFrame Player API 实现自动播下一首和错误处理。
3. 做移动端和大屏视觉 QA。
4. 补 WebSocket reconnect retry/backoff。
