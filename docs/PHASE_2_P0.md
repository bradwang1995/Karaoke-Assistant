# Phase 2 / P0：API 元数据生命周期与 Made for Kids

状态：本地实施，未部署。实施授权不包含生产迁移、清理、回填、真实 YouTube 调用或审核申请。

## 当前契约

- snippet、details、status 分组携带 `source=youtube-api`、`fetchedAt`、`expiresAt`。只有解析官方 API 响应的 provider 能创建时间；API 时间与缓存写入、访问、排队、UI 保存时间分开。
- API 字段组最多保留29天，UTC毫秒精确边界，`now >= expiresAt` 拒绝。29天是比政策一般30日上限更保守的工程窗口。缺失、坏时间、未来时间、超长窗口均不可当fresh。
- D1 exact repository、catalog、KV exact/recommendations、前端内存使用相同规则。details/status 到期不使 snippet 重新获取时间；复制、touch、merge、promotion 不延寿。
- 保留 `rank-preserve-50-v2` family、原有相关性及推荐资格。KV schema `v5`、推荐池 `v9`；旧版本不作为fallback读取。
- 搜索仍仅用户主动提交，cold `search.list` 最多一次，Worker1600ms／浏览器2000ms。`cacheOnly` 与空查询推荐不调用 YouTube。
- `youtube_video_metadata` 是提供队列与播放检查的可信逐视频投影。缓存读取优先展示此处已有的新元数据，不伪造全局实时性。
- D1 `queue_items` 新写入只保存业务字段及通用占位，不再持久化API标题/频道/缩略图；snapshot从可信metadata表组装。DO不采信客户端上传的标题或获取时间。
- 浏览器只持久化查询、选项和业务队列，不持久化API payload；启动遍历本站旧搜索和房间key，清除旧API副本。前端内存有到期timer及focus检查。

## 播放检查

`POST /api/youtube/playback/:videoId` 同源、限流、no-store。状态必须是可信且1小时内获取的 `madeForKids=false`、`embeddable=true`；不存在、true、unknown、过期、错误、无key或预算不足均不加载iframe。

- 搜索enrichment与URL请求均读取 `part=id,contentDetails,snippet,status`；不增加独立search.list。
- 预览、大屏初播、换歌、恢复、重唱均经同一许可入口；创建iframe与加载IFrame API脚本均要求匹配且未过期的许可。手机页不再预加载第三方脚本。
- 阻断展示原因及重试，不发送ended，不自动连续跳歌；用户仍可手动下一首或移除。
- 保留200×200预览、30秒起点、静音、原生controls及大屏底栏几何。
- **MFK暂不嵌入是产品策略，不是官方一律禁播要求。** 将来支持前需核实追踪关闭、播放器相关数据流与适用法律，不能用单个embed参数代替。

## 配额与刷新

- `youtube_details_daily` 独立于搜索ledger，D1原子预留，太平洋日界。所有详情尝试总上限1000/日，其中后台最多500/日；失败请求也计量。无D1计量能力时不发详情请求。
- 单批最多50个ID；搜索复用已有details，后台有界批量刷新。播放检查用D1逐视频租约跨请求去重；其他请求遇在途刷新暂时unknown，可重试。它不保证所有不同ID的交互请求合并为一批。
- 每小时维护优先刷新活跃队列相关的、已获取超过24小时的metadata，最多50个ID；另尝试保住一个旧family中的最多50个已知候选。刷新失败不把旧时间更新为now。
- 成功响应缺字段会替换/清空；返回集合遗漏ID使旧可信metadata失效。403/429/超时不等于视频已删除。
- 1000是本项目保守上限，不是Google Console真实额度。Console项目配置与实际消耗尚未核实。

## 副本与到期处理

| 副本 | 处理 |
| --- | --- |
| repository.response_json | 逐项校验来源；保留query及业务计数；未知/过期payload分批擦除；刷新时只保留真正重新取得的视频字段 |
| catalog及normalized字段 | 来源到期一起清除；新响应缺字段不COALESCE旧值；当前无FTS，0006已移除 |
| KV exact、推荐与旧index/version | 新写使用绝对到期；推荐逐项校验；旧`yt-search*`前缀分页清除，进度保存在D1 |
| Worker请求内存 | 继承provenance，不生成新获取时间；无持久全局API元数据池 |
| browser内存与持久化 | 内存到期清除；持久化只存业务字段；不活跃旧浏览器无法远程触达 |
| 队列、DO、WebSocket | API字段由可信表hydrate；队列位置、操作者、时间、当前项等业务状态保留；客户端metadata不得回写为可信 |
| URL fallback | 通用占位，无远程缩略图、无可信status，不能绕过播放检查 |
| 使用事件及运维记录 | 既有30/90天任务独立保留；新details ledger90天；当前未发现playback_events.payload_json的应用写入路径，生产历史内容仍需盘点 |

video ID须按来源分类：用户URL输入与选歌产生的队列引用作为必要业务引用保留；未被用户选择的API候选ID随API缓存到期。API派生规范化字段/评分继承来源期限，不能仅通过改名获得长期保留或额外指标许可。

## 清理与生产操作门槛

`maintainMetadata(env, now, true)` 为dry-run：不调用API、不写数据、不推进KV cursor。当前dry-run报告repository候选与该页KV候选数，不是全库完整盘点。

普通调用每批最多100条repository、1000条catalog、1000条可信metadata、1000条旧队列字段、100个KV key；D1批次事务，KV游标可续跑，重跑幂等。日志只有计数/错误码，不导出payload或密钥。新schema迁移本身不清空历史数据，也不把迁移时间写成fetchedAt。

另行明确授权生产后才可：

1. 只读统计全部副本、历史版本、未知年龄、积压及备份，确认清理吞吐能在余量内完成。
2. 评审dry-run范围与刷新预算；历史unknown不能继续当fresh。优先保住活跃队列及热门query，不能承诺所有旧缓存立即可用。
3. 应用0008并按Room→Main发布兼容读写门禁；禁止部署旧的无gate前端继续作为新客户端。
4. 在受控批次中刷新/擦除历史API副本，检查实际剩余数量和作业日志；KV最终一致性期间读取仍自行校验时间。
5. 核查旧客户端、日志payload与备份；保留自有业务数据。不要建立永久旧API payload备份作为回滚手段。

回滚应保留迁移和gate，停用后台刷新或修复新逻辑；不能通过回滚到旧版本恢复超期metadata或无MFK检查的播放器。

## 验证与限制

- 聚焦测试包括UTC/闰年边界、坏时间、字段组独立时钟、D1复制、KV merge/touch/promotion、50/51批次、PT日界/DST、预算上限、租约去重、MFK三态、缺字段/403/404/429、队列元数据不采信、dry-run/分批幂等及浏览器物理清理。
- `npm run verify:search` 现包含生命周期与metadata集成测试，禁止真实网络；再运行typecheck。共享路径变更需完整无网络回归和build。
- 本地双Worker使用`.wrangler/p0-local/`下独立配置和state，虚拟资源ID、空测试变量文件，不复制或读取既有密钥。Frontend修改后build并刷新；终端停止则预览停止。
- 当前不能证明永久离线浏览器已清除、生产历史数据全部删除、备份到期或所有旧页面已升级。批次积压可能超出预留余量，生产计数与处置是发布门槛。
- API驱动评分/推荐用途与Developer Policies III.E.4.h的边界仍需专项确认；本次保留相关性不代表该用途已获许可。
- mock状态与本地播放许可不能证明真实视频MFK、可播放性或平台认可。本地无key时应看到阻断，这是预期。

政策基准（2026-10-29核实）：[Developer Policies III.A、III.E.4、III.L](https://developers.google.com/youtube/terms/developer-policies)、[MFK指南](https://developers.google.com/youtube/data/guides/made_for_kids_status)、[Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)、[videos.list](https://developers.google.com/youtube/data/reference/rest/v3/videos/list)、[Quota Calculator](https://developers.google.com/youtube/data/determine_quota_cost)。完成这两个P0不等于通过整体审核或商业广告批准。
