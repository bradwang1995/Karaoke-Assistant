## 底栏、双列点歌及政策弹窗已发布 — 2026-10-29

- 源码提交 5d61d1183e89c3539b2c04577d070127f10cd36f 已推 origin/codex/music-eligibility-cache，并由 ls-remote 核实；未推 main。
- 按 Room → Main 使用 --keep-vars 部署，deployments list 核实最终均为 100%：Room 9b584007-f8be-4067-9f49-1309784280ba；Main 5510d5ad-875f-43af-86dd-234a69d46976。
- 生产 cacheOnly 耍赖命中 45 条，脚本确认 sourceQueryCount=0、externalCallAvoided=true、quota used 0→0；未运行冷搜索。
- 全新内置 Browser 线上首页加载 assets/index-CteU80QN.js、assets/index-Bof-8tIV.css，与发布构建一致，console error 为空。本轮布局及弹窗交互证据见下面本地验收记录；发布后未新建线上房间、未验证真实媒体播放。
- 发布前全量 35 文件 / 283 项、typecheck、build、verify:search 14 文件 / 167 项与 git diff --check 全部通过。

## 底栏、双列点歌及政策弹窗发布准备 — 2026-10-29

- 用户已确认本轮界面并授权 push/deploy；发布仅包含 Display 底栏宽度与紧凑按钮、Mobile 双列卡片、政策弹窗 X/撤回文字及内部留白关闭修复，无搜索算法、存储或 Worker 逻辑改动。
- 发布检查：npm test 35 文件 / 283 项、typecheck、build、verify:search 14 文件 / 167 项、git diff --check 全部通过。构建入口 assets/index-CteU80QN.js、样式 assets/index-Bof-8tIV.css。
- 推送当前 codex/music-eligibility-cache 分支，不推 main；按 Room → Main 使用 --keep-vars。部署后记录实际版本及零配额 smoke。

## 政策弹窗留白误关闭修复（本地验证，未发布）— 2026-10-29

- 原判断仅检查 click target 是否为 dialog，导致点击 dialog 自身 padding 也关闭；改为同时检查点击坐标是否位于 dialog 边界外。保留 X、原生 Escape 与撤回操作。
- 撤回入口前说明文字的下间距从 20px 缩至 8px，其余布局不变。
- 全新内置 Browser 临时组件页实测：左侧内部 padding、底部内部 padding 点击均保持打开；外部点击和 X 均关闭并恢复焦点。typecheck、git diff --check 通过；临时文件已清理。未提交、推送或部署；Vite http://127.0.0.1:5180/ 仍在运行。

## 政策弹窗按钮样式（本地验证，未发布）— 2026-10-29

- 移除底部高亮关闭按钮，改为标题右侧 32px 圆角细边框 X 按钮，提供 hover 与键盘焦点样式及本地化关闭标签。
- 撤回同意入口改为青色下划线文字，复用首次隐私提示的链接色彩；保留原有关闭与撤回行为，政策链接不变。
- 全新内置 Browser 临时组件页目视验证通过，X 点击及 Escape 均关闭弹窗并恢复入口焦点；未执行实际撤回。typecheck 与 git diff --check 通过。临时文件已删除；本地 Vite http://127.0.0.1:5180/ 继续热更新，未提交、推送或部署。

## 底栏宽度与手机双列卡片（本地验证，未发布）— 2026-10-29

- 标题/进度宽度上限从 320px 提升至 896px，移除按钮组背景/边框/padding，按钮水平 padding 12→8px、图标文字间距 8→4px，下一首改为切歌（英文 Skip），即将播放宽度 110→140px。
- 手机结果与加载骨架固定两列 202px 卡片，4px 列间距与左右 padding；内层播放器保持 200×200。640px 起自动列数；小于容纳宽度时结果区允许横向滚动，不压缩播放器。
- 全新内置 Browser 使用临时本地组件页与 mock 推荐检查：440×956 下前两卡片 x=11/217、同 y=204，卡片宽 202、播放器 200×200；目视双列通过。2559 与 1280 宽度底栏按钮保持同排，2559 下标题宽 896。mock 视频出现 YouTube error 150，不作为真实播放验证。临时预览文件已删除。
- verify:search 14 文件 / 167 项及 typecheck 通过（受限 Windows realpath EPERM 后沙箱外重跑）；git diff --check 通过。Vite http://127.0.0.1:5180/ 正在运行，前端热更新；未提交、推送或部署。

## 品牌与产品截图已发布 — 2026-10-29

- 发布源码 f390223fcb8fd3c3e44e857f0d93b0f45139262c 已推 origin/codex/music-eligibility-cache 并通过 ls-remote 核对；未推 main。
- 按 Room → Main 使用 --keep-vars 部署，并读取 deployments list 核实最终 100% 版本：Room a6795291-bdce-4da8-af5e-090657078d67；Main 0de4c7ec-9c13-4f94-9160-b1937619387f。
- 全新内置 Browser 线上首页加载 assets/index-DVK4l-51.js，与构建一致；中英文 Header 均 139px，品牌无副标题，两张新 PNG 正常加载，尺寸分别 1280×720 / 390×844；console error 为空。线上截图 product-release.png 位于本轮 visualization 目录。
- cacheOnly 耍赖命中 45 条，脚本验证 sourceQueryCount=0、externalCallAvoided=true，quota used 0→0。首次 npm 调用吞掉参数名，未发搜索请求；直接运行脚本后通过。未运行冷搜索、未新建线上房间或测试真实媒体播放。

## 品牌与产品截图发布准备 — 2026-10-29

- 本轮发布范围：中英文图片 Logo、移除品牌副标题、语言切换等高 Header、创建页引言固定高度，以及最新大屏/手机队列截图和替代文字。没有搜索、Worker 或存储逻辑变更。
- 全量测试 35 文件 / 283 项、typecheck、build、verify:search 14 文件 / 167 项、git diff --check 通过。初次测试/构建被受限 Windows realpath EPERM 阻止，沙箱外重跑通过。构建入口 assets/index-DVK4l-51.js。
- origin/codex/music-eligibility-cache 与本地发布前基线一致；仅推此分支，按 Room → Main 使用 --keep-vars 部署。最终版本和线上检查另行记录。

## 更新产品界面截图（本地验证，未发布）— 2026-10-29

- 重新使用当前 DisplayPage / MobilePage 截取英文空房间：大屏 1280×720、手机队列 390×844。大屏展示底栏右侧已展开二维码、竖排语言按钮及政策入口；手机展示当前队列。以 PNG 替换旧 JPG，同步首页尺寸及中英文替代文字。
- 使用临时本地组件预览，不记录隐私同意、不创建线上房间、不播放媒体；临时预览文件已删除。截图为 Local mode，不代表真实 Worker 同步或播放验证。
- 新建内置 Browser 验证首页两张图片加载成功、自然尺寸正确，并目视检查并排呈现；git diff --check 通过。仅图片与展示文字更新，未运行完整测试或构建。预览 http://127.0.0.1:5174/ 正在运行，热更新；未提交、推送或部署。
- 聊天已改名为「品牌 Logo 与产品界面截图更新」。

## 移除 Logo 副标题（本地修改，未发布）— 2026-10-29

- 按用户要求移除共用 SiteBrand 下方的中英文副标题，释放原有 20px 高度；Logo 固定尺寸及语言切换布局保持。
- git diff --check 通过；纯文案移除，未运行测试或构建。本轮未重新进行浏览器验收。未提交、推送或部署。

## 图片 Logo 与稳定 Header（本地验证，未发布）— 2026-10-29

- 共用 SiteBrand 使用用户提供的中英文透明 PNG 替换文字及显示器图标，保留首页链接、替代文字及副标题；图片预留相同宽高。公开 Header 使用固定响应式行数，创建页引言预留 56px，避免语言换行改变高度。
- typecheck、git diff --check 通过。全新 Codex 内置 Browser 首页中英文 Header 均 158.67px；320px 窄屏均 184.67px，无横向溢出，console error 为空。创建页真实同意后布局尚未浏览器验收。
- Vite http://127.0.0.1:5174/ 正在运行，前端热更新；点击右上角中 / EN 检查对应 Logo 和 Header 下边线。未提交、推送或部署。

## Phase 1 公开网站发布 — 2026-10-29

- 用户授权 push/deploy 后拉取远端，确认 main 仍是旧基线；实际最新已发布提交位于 origin/codex/youtube-native-controls 的 9619b1b。合并该分支保留已发布播放器、固定200px预览、底栏及QR；短扫码 /j/:roomId 纳入隐私边界。大屏政策入口为紧凑信息图标，未恢复旧顶部栏。
- 源码4dfb658，合并发布f21857e，已推送origin/codex/music-eligibility-cache并核对远端SHA；未推main。移除即将发布政策中的本地预览/未发布提示。
- 最终35文件283项测试、typecheck、build、verify:search 14文件167项（禁止真实网络）、diff check通过。生产0007仅新增索引，执行成功；Main小时cron启用，未手动执行生产保留清理。
- Room → Main 使用 --keep-vars，读取部署记录均100%：Room dff42010-aa21-4db3-baf5-dcf2a41c92b9；Main 27e754cf-0056-4442-98c3-5a1255fdc1bd。
- cacheOnly 耍赖45条，脚本验证sourceQueryCount=0、externalCallAvoided=true、quota used 0→0。未运行冷搜索。
- 新内置Browser生产首页中英正确，加载index-BmBJTMvF.js匹配最终构建；/create和/j/4245553a均默认未勾选、继续disabled，未替用户接受线上条款。console error为空。截图.wrangler/phase1-release/home.jpg。未重测真实播放或新建线上房间，自动清理首次生产执行尚未观察。

## 底栏与二维码改版（已发布，扫码距离待用户实测）— 2026-10-29

- 代码提交 afa9aabbd331d4aff66cd14858991ba76c2c6328 已推送 origin/codex/youtube-native-controls，远端 SHA 已核对。仅提交本轮独立 worktree 的 11 个文件，未推 main；原工作区其他 agent 的公开首页、政策、隐私、字体、数据保留及 Worker/迁移改动未包含、未触碰。
- 发布前全量测试 32 文件 / 267 项、typecheck、build、verify:search 14 文件 / 167 项、git diff --check 全部通过。
- 按 Room → Main、--keep-vars 部署并再次读取最终活动记录确认均 100%：Room 3eb7c642-6638-44f3-bdd4-296e8b3a7d00；Main 6e4dea65-94b5-431a-85c6-14a2d5dd8aa0。Dashboard 管理变量保留，未改配置或 secrets。
- 生产 cacheOnly 耍赖命中 45 条，sourceQueryCount=0、externalCallAvoided=true，额度 used 0 → 0；未运行冷搜索。
- 新建 Codex 内置 @Browser 验证生产 /create 加载 /assets/index-Bhov9apd.js，与隔离构建一致。创建空验收房间 4245553a，Display Connected；扫码按钮展开后实测 1280×720 下底栏 74px、QR 72×72px、右侧间隙 0、圆角 2px，console error 为空，无 iframe。
- 生产 /j/4245553a 成功显示同一房间手机页并 Connected；缓存推荐卡片前三项预览区均 200×200px。未点击候选/点歌/播放，手机页 iframe 数 0，全程未播放视频或声音。截图 qr-footer-production.png 在本轮 visualization 目录。
- 原生手动播放、连续切歌及二维码 2 格白边在不同手机/电视距离下的扫描成功率留给用户验收。本次仅验证部署、连接、入口、布局和零额度缓存路径，不声称完成实机媒体/扫码验收。

## 底栏与二维码改版发布准备 — 2026-10-29

- 用户明确授权只发布本次改动。隔离 worktree 的 codex/youtube-native-controls 分支仅纳入 11 个文件：底栏/扫码与语言组件、固定 200×200 静音手动预览、短加入链接、对应测试、README/SEARCH/PROGRESS。原工作区其他 agent 的首页、政策、隐私、字体、数据保留、迁移与 Worker 配置均未纳入或修改。
- 发布前全量测试 32 文件 / 267 项、typecheck、build、verify:search 14 文件 / 167 项及 git diff --check 全部通过。构建入口 assets/index-Bhov9apd.js。本次不进行真实播放或有声测试，二维码白边 2 格的实机扫描距离仍需用户验收。

## 二维码白边减半、圆角与右侧贴边（本地验证，未发布）— 2026-10-29

- 按用户要求直接将生成参数 marginSize 从 4 减至 2，无需图像裁剪；72px 尺寸与 M 纠错保持，生产短链接图案每格从约 1.756px 增至 1.946px。此白边低于通常 4 格建议，真实扫描成功率仍待手机确认。
- Canvas 加 2px 圆角，链接通过 -mr-4 抵消底栏右侧留白。全新内置 @Browser 固定 1280×720 验证：二维码 72×72、右侧外部间隙 0、圆角 2px、底栏仍 74px，上下间隙约 1px，无媒体 iframe 或声音。截图 qr-rounded-local.png 位于本轮 visualization 目录。
- typecheck 与 git diff --check 通过；临时验证页已删除。预览 http://127.0.0.1:5175/room/qrround1/display，Vite 运行中、前端热更新；未提交、推送或部署。

## 二维码降密度与贴近底栏边缘（本地验证，未发布）— 2026-10-29

- 新增同源短入口 /j/:roomId，直接复用 MobilePage；原 /room/:roomId/mobile 保留。二维码仅编码短入口，不使用第三方短链、不新增存储、请求、过期时间或 Worker 逻辑。roomJoin.ts 共享路由与 URL 生成，原房间 id 保持一致。
- 使用当前二维码库实测生产域名 + 8 位房间 id：payload 67 → 57 字符，图案 37×37 → 33×33 modules；纠错等级仍 M，保留四格 quiet zone。显示从 56px 增至 72px，每格边长约 1.244px → 1.756px，增加约 41%。
- 移除 QR 外部额外上下间距，使用 QR 链接局部 -my-2 抵消底栏 padding，不改变其他控制。明确 marginSize=4，保留识别必需白边，图像不再裁圆角。固定 1280×720 内置浏览器验证：底栏 74px、二维码 72×72px、上下外部间隙各 1px，无媒体 iframe。
- 新增短链路由与二维码密度回归 2 项通过，typecheck、git diff --check 通过。内置浏览器直接打开 /j/qrshort1，显示原手机点歌页和本地模式，未调用冷搜索、未播放视频或声音。截图 qr-optimized-local.png 在本轮 visualization 目录。
- 本轮仅本地，未提交/推送/部署；真实手机扫码距离、生产域名短入口仍待发布后验收。本地二维码指向 127.0.0.1，不能代表手机可跨设备加入。Vite http://127.0.0.1:5175/room/qrshort1/display，前端热更新；临时固定视口页面已删除。

## 扫码按钮去边框与收紧留白（本地验证，未发布）— 2026-10-29

- 扫码按钮与语言切换统一默认透明背景、零边框，仅 hover 出现相同的半透明背景与青色阴影；保留 focus-visible 键盘焦点提示。移除展开态常驻底色、边框和方向渐变。
- 左右 padding 降至各 2px，并收紧 Chevron 的 SVG 水平 viewBox，保持 24px 高、12px 宽，避免图标自身留白造成视觉上 padding 过大。无文字的收起箭头按钮实际宽 16px。
- typecheck、git diff --check 通过；全新内置 @Browser 无视频页面实测：展开按钮背景 rgba(0,0,0,0)、边框 0px、左右 padding 各 2px、SVG 12×24px。二维码切换正常，无视频或声音。截图 qr-compact-local.png 位于本轮 visualization 目录。
- 本地预览 http://127.0.0.1:5175/room/padqr026/display，服务运行中、前端热更新；未提交、推送或部署。

## 扫码按钮文字/箭头分状态（本地验证，未发布）— 2026-10-29

- 按用户微调，箭头从 48px 缩至 24px。收起态只显示竖排扫码文字，不显示箭头；展开态显示二维码，按钮只保留箭头用于收起，不显示扫码文字。保留 title、aria-expanded 与键盘切换。
- typecheck、git diff --check 通过。新建内置 @Browser 无视频页实测收起态文字“扫码点歌”、SVG 数 0；点击展开后按钮文字为空、SVG 高 24px，二维码出现。全程无媒体/声音；截图 qr-state-local.png 在本轮 visualization 目录。
- 本地预览 http://127.0.0.1:5175/room/qrstate1/display，Vite 运行中、热更新；未提交、推送或部署。

## 竖排去斜线与大箭头（本地验证，未发布）— 2026-10-29

- 竖排语言只保留“中”和“EN”，移除斜线；其他页面横排仍保留斜线。扫码箭头图标从 10px 放大到 48px，可见箭头路径约 24px 高（约两行文字），保留展开/收起旋转与悬停效果。
- typecheck、git diff --check 通过；新建内置浏览器固定 1280×720 无视频页验证：语言文字为中EN、箭头 SVG 高 48px、展开二维码后底栏仍为 74px，iframe 数量为 0，无声音。截图 footer-big-arrow.png 保存于本轮 visualization 目录；临时页面已删除。
- 未提交、推送或部署。预览 http://127.0.0.1:5175/room/bigarrow/display，Vite 运行中、前端热更新。

## 竖排 EN 恢复与扫码方向提示（本地验证，未发布）— 2026-10-29

- 按用户更正，竖排语言始终使用“中 / EN”，不再把 EN 替换成汉字“英”。
- 扫码按钮添加 10px 左箭头：收起朝左、展开旋转朝右；悬停提供对应方向青色渐变、边框强调与轻微箭头位移，减少动态效果偏好下关闭箭头过渡。展开状态保留青色背景；title 提示当前展开/收起动作。仍在底栏中显示二维码，不覆盖播放器。
- typecheck、git diff --check 通过。全新内置 @Browser 无视频页面验证中/EN、双语扫码文字、点击展开/收起、title 和箭头旋转状态；固定 1280×720 本地视口下底栏仍为 74px。没有加载或播放任何视频、声音。临时固定视口页面验证后删除；截图 vertical-footer-arrow.png 在本轮 visualization 目录。
- 本地预览 http://127.0.0.1:5175/room/arrow027/display，Vite 运行中、前端热更新；本轮未提交、推送或部署。

## 底栏竖排语言与扫码开关（本地验证，未发布）— 2026-10-29

- 用户要求竖排节省宽度：Display 使用 LanguageToggle 的可选 vertical 模式，“中 / 英”逐行显示，移至连接状态（含本地模式）左侧；其他页面默认横排不变。
- 右侧扫码入口改为竖排 button，中文“扫 / 码 / 点 / 歌”，英文“Scan / to / join”；默认二维码不挂载，点击、Enter 或 Space 切换 56px 二维码。展开区域仍在底栏内，无覆盖视频的浮层。新增 aria-expanded / aria-controls；Display 空格播放快捷键忽略按钮与链接，避免切换语言或二维码时误触播放。
- typecheck、语言与翻译覆盖 2 文件 / 32 项、git diff --check 通过。全新 Codex 内置 @Browser 本地验证 1280×720：中/斜线/英沿竖向排列、位于连接状态左边；中英文扫码分别逐字/逐词排列；默认 0 个 canvas，Space 展开为 1 个、Enter 收起回到 0 个，两种状态底栏均 74px，无横向溢出。测试页无 iframe，全程不加载视频、不播放声音。
- 本地 Vite 已重启并运行于 http://127.0.0.1:5175/room/vjoin026/display；前端热更新，Ctrl+C 停止。底栏截图为本轮 visualization 目录 vertical-footer-zh.png。未提交、推送或部署；二维码手机实扫距离仍待验收。

## 常驻底栏二维码与固定 200×200 预览（本地实施，未发布）— 2026-10-28

- 用户确认新方案，取代上一轮未发布的右侧栏和过小卡片外部预览。Display 移除 header/aside、二维码缩放状态与按钮；56px 二维码含白色留白、M 纠错，与“扫码点歌”和中英切换一起常驻底栏。保留播放控制文字和 40px 按钮；Up Next 由 160px 改为 110px，标题/进度区域最大 320px。桌面底栏最小高度 74px，窄屏允许分行，不覆盖播放器。
- 点歌卡片固定 200×200px 预览区域，边框与标题另计，网格按 202px 整列自动排列。390px/320px 验证单列且无水平溢出，桌面现有 768px 容器显示三列；选中前后尺寸/位置不变。只有 active card 挂载 iframe；恢复/选择卡片不触发播放，autoplay=0、mute=1、start=30，ready/CUED 只设置静音，不自动 play。原生播放由用户操作。SEARCH.md 同步界面契约，搜索算法、缓存版本、额度与请求不变。
- 内置 @Browser 用可用的官方示例验证 200×200 iframe、原生 Play 按钮，实际 video paused=true、muted=true；未按播放按钮，也未播放声音。底栏使用临时媒体全禁 CSP 和播放器替身检查，不启动真实视频；这不是实际 Worker/媒体播放验收。
- 1280×720 下正常额度与英文 Resume 状态实测：视频 top=0、1280×646px，底栏 74px，三个按钮 40px 且 top=663px；56px 二维码常驻、无侧栏和横向溢出，中英文切换正常。证据截图 footer-qr-local.png、cards-200-local.png（本轮 visualization 目录）。
- 聚焦播放器/队列/翻译 4 文件 / 25 项、typecheck、零网络 verify:search 14 文件 / 167 项通过。临时验证文件结束后删除；二维码远距离手机扫描、真实手动播放与全屏未验收。
- 本次在独立 worktree 本地修改，未提交、推送或部署，原项目中另一个 agent 的介绍页/政策改动未触碰。Vite 预览 http://127.0.0.1:5175/room/footer26/display 与 /room/cardsize/mobile，服务运行中、前端热更新；Ctrl+C 停止。

## 右侧栏与固定点歌卡片（本地验证，未发布）— 2026-10-28

- 按生产反馈将 Display header 改为视频右侧栏，展开 208px、收起 80px；紧凑按钮仅二维码图标和左箭头，展开时右箭头收起。1280×720 有视频状态实测：视频 top=0、高 646px，展开/收起只把宽度从 1072px 改为 1200px，底栏仍为 74px。
- 删除活动点歌卡片的 col-span-2 和 200px 最小尺寸，恢复原网格与 16:9。用户明确选择：尺寸小于官方 200×200 要求时只显示缩略图，提供另开 YouTube 的预览链接；符合尺寸时保留内嵌原生播放器。ResizeObserver 在调整视口后重新判断，过小不加载 iframe。
- 390px / 320px 同源本地测试视口验证：选中切换前后卡片位置及尺寸不变，390px 卡片 169×151.94px（包含标题）；320px 无水平溢出、无内嵌 iframe。Enter 打开 Preview on YouTube 在新标签页，原点歌页保留；卡片键盘处理不拦截子链接。
- 官方可播放示例 M7lc1UVf-VE 的应用 embed 和普通 native embed 对照均能自动隐藏控件；大屏实际 playing 状态观察到 ytp-autohide，标题、中央按钮和进度条不常驻。当前未复现用户特定生产环境的常显原因，未加入遮罩、隐藏 iframe、模拟内部事件或已废弃的 autohide 参数，不宣称该症状根因已修复。
- 聚焦尺寸边界、播放器、队列和翻译测试 4 文件 / 26 项通过；typecheck、git diff --check 通过。Vite 独立 worktree 预览 http://127.0.0.1:5175/room/ytlayout/display 与 /mobile，前端热更新；不是 Worker 同步验证，未进行生产操作、冷搜索、提交、推送或部署。临时对照页验证后删除。

## YouTube 原生交互恢复（已发布，播放体验待用户验收）— 2026-10-28

- 代码提交 85e7ac93547c3f75b6b3fd75f8bfa95af9f15530 已推送 origin/codex/youtube-native-controls，远端 SHA 已核对。发布基线 609157c；只包含本次播放器修复及对应测试/文档。未推 main，未包含另一个 agent 的首页、设备指南、政策、About 入口、翻译或素材；原工作区内容未改动。
- 隔离 worktree 构建并按 Room → Main 使用 --keep-vars 部署；再次读取 deployment history 确认 Room 99ab30e4-9fba-49a8-a336-bba5e0e3bfde、Main 8c98de71-97aa-447f-8182-dfb74ec717a7 均承接 100% 流量。
- 发布前全量测试 31 文件 / 265 项、typecheck、build、verify:search 14 文件 / 167 项、git diff --check 全部通过。
- 生产 cacheOnly 耍赖返回 45 条，sourceQueryCount=0、externalCallAvoided=true，额度 used 0 → 0。第一次 smoke 因房间 ID 格式错误 HTTP 400，改用合法 8 位 ID 后通过；未执行冷搜索。
- 全新 Codex 内置 @Browser 打开生产 /create，实际加载 /assets/index-BWK0OXcQ.js，与隔离构建一致；创建验收房间 6l232z6l，Display 显示 Connected、剩余额度 100/100，console error 为空。未选歌或启动播放，真实原生暂停、音量、拖动、全屏、推荐交互及连续播放仍待用户验收。
- 生产截图保存于本轮 visualization 目录 youtube-production-release.png。刷新已有生产页面或从 /create 新建房间即可测试；用户反馈后另行修改与授权发布。

## YouTube 原生交互发布准备 — 2026-10-28

- 用户明确授权仅发布本次 YouTube 播放器修复；在独立 worktree / codex/youtube-native-controls 分支提取 5 个代码与测试文件和对应文档。排除所有 Phase 1 首页、政策、About 入口、翻译与素材，原工作区未改动。
- 发布前全量测试 31 文件 / 265 项、typecheck、build、verify:search 14 文件 / 167 项及 git diff --check 全部通过。真实播放验收仍由用户在生产进行；先前本地视频 error 150 的限制保留。

## YouTube 原生交互恢复（本地验证，待用户验收，未发布）— 2026-10-27

- 大屏和手机预览恢复 controls、键盘、全屏与 iframe 点击；保留 KTV 进度、重播、播放/暂停、切歌和队列。暂停清除播放重试；首次起播仍从大屏 0 秒、手机预览 30 秒开始，预览开始后允许用户向前拖动。
- 加载前创建带 sandbox 的 iframe，允许 popup 及 popup 脱离 sandbox，禁止 top navigation。YouTube 内部跨域链接无法统一强制 target；推荐可能在 iframe 内换视频。二维码/语言移到视频上方；活动预览占两列、至少 200px 高；不覆盖 YouTube 加载/错误界面。
- 新建 Codex 内置浏览器会话，Vite `http://127.0.0.1:5173/room/youtube-review/display` 与 `/mobile`：实测 iframe pointer-events=auto、controls=1、disablekb=0、fs=1，预览高度至少 200px；点击原生 Watch on YouTube 打开独立 YouTube 标签页，KTV 页 URL 保持；本地添加两首、Next 切到第二首、二维码收起通过。未请求真实 YouTube 搜索，无生产/远程存储操作。
- 两个 mock 视频均返回 YouTube 不可播放（大屏 error 150）；临时页面对比无 sandbox 与有 sandbox 的同视频也都不可播放，已删除临时页面。真实播放、原生暂停/音量/进度/全屏、推荐点击及真实 Worker 同步尚未运行时验证；不声称整体合规认证。
- 初次 Vite 受沙箱 realpath EPERM 阻止，允许后启动成功。Vite 正在运行，前端热更新；Ctrl+C 停止。不提交、推送或部署。
- 最终 `npm run typecheck`、三组聚焦测试 16 项通过；`git diff --check` 通过。截图保存在本轮 visualization 目录。

# Project Progress

Last updated: 2026-10-27

## 分类误伤、部分歌名与首页推荐更新（已发布，用户实际使用验收待进行）— 2026-10-27

- 用户批准修复四项生产验收问题。起点 `a6651fb` / 功能 `eae1d9d`，工作区干净；成熟回退节点继续见 `docs/SEARCH_BASELINE_2026-10-27.md`。本地实施阶段没有提交、推送、部署或生产数据变更；用户随后明确授权发布，结果见本节末尾。
- 搜索展示需同时有非 Music 分类和肯定的非音乐内容线索，且无歌曲/音乐保护才排除；首唱、新歌、主题曲等纳入音乐证据，信息不足和歌手关联的录音结构优先保留。推荐支持明确歌名部分的部分匹配，继续排除仅歌词/hashtag 命中，不用弱项凑满 20。
- policy 升为 `music-evidence-v2`、推荐池升为 `v8`；保留 raw algorithm `rank-preserve-50-v2` / exact KV v4、原始候选与分数顺序，不覆盖旧 v7 池。D1 命中在已有后台任务中提升合格推荐；历史重建每次最多五页/100 组，保存游标并正确处理空页，点歌不丢进度。
- Mobile 搜索成功后失效/刷新推荐；清空后按搜索主动重新读取，保留已有卡片。后台持久化与 KV 最终一致性仍可能有短暂可见延迟，不承诺生产跨设备即时出现。
- 先加入的真实标题/部分歌名测试在旧实现中 10 项失败；修复后搜索专项 14 files/166 tests、typecheck、完整测试 31 files/264 tests、build 均通过。沙箱启动测试曾因 Windows realpath EPERM 失败，原命令提权后正常执行。没有放宽网络隔离、配额或原始排序回归。
- 既有生产候选的最终离线重放：周深 artist 50→50（旧展示47），林俊杰 artist 50→50（旧49），周杰伦 artist 50→50；三国 song 原始50、展示49、合格推荐8（旧0），含三国恋/三国杀。耍赖的四条明确歌曲仍为唯一合格推荐，原始50条排序 golden 通过；保守展示允许更多不确定项留在搜索尾部。
- 独立双 Worker 使用无密钥配置 `.wrangler/quality-investigation/{main,room}.local.toml` 与 `.wrangler/state-music-eligibility-v2`，仅本地迁移并预置六组既有公开视频 metadata，没有调用 YouTube。内置 @Browser 新会话创建房间 `323j5a0w`，Connected；初始推荐0，周深/林俊杰/周杰伦搜索总数均50，搜索后直接清空返回推荐，合格池逐步增至68，三国恋/三国杀出现在推荐前部，中文/英文均验证，console warn/error 为空。此验证证明真实本地 Worker/API 路径，未使用 Vite fallback。
- 本地预览运行中：`http://127.0.0.1:8795/room/323j5a0w/mobile`。歌手模式搜索上述三位，或歌名模式搜索三国，再清空按搜索看首页；这里只回放已有缓存，非实时 YouTube。截图 `.wrangler/quality-investigation/recommendations-v2.png` 未提交。前端由已构建 dist 提供，后续前端修改需 build 后刷新；Ctrl+C 停止服务。
- CSS 产物仍为 `index-BJfuVwz4.css`，没有改布局、双语词库、播放器或队列代码；本地阶段未进行真实视频播放或生产验收。
- 用户已明确授权本批 push/redeploy，实际使用留待用户稍后验收。发布前只读确认当前线上 100% 回退版本：Room `ac92afe0-a8c5-4cce-ac01-5d6378d69427`、Main `ea599cd9-e959-4cb6-94f5-8db9890c09e6`，对应此前功能 `eae1d9d` / 记录 `a6651fb`。后续发布结果仅在远端验证后记录。
- 发布前再次通过完整 31 files/264 tests、搜索专项 14 files/166 tests、typecheck、build 与 diff check。功能提交 `9b42ac3e66915f9392b1a7a5603df7ee519931c1` 已推送 `origin/codex/music-eligibility-cache` 并用 ls-remote 核实；没有推送 main。
- 2026-10-27 22:41 UTC 按 Room → Main、两者均带 `--keep-vars` 发布；deployments status 已核实活动流量均为 100%：Room `54cc7914-fb88-46cf-bbb0-2b7570ffb9c2`，Main `c4afd566-4529-4163-a313-d35397f7b183`。没有生产 schema migration、原始缓存删除或密钥变更。
- 生产 smoke 使用隔离的 search room id `qfix1027`，先 cacheOnly 耍赖，再 cacheOnly 周深/林俊杰/周杰伦 artist 与三国 song（原唱均关闭）。五组均为 repository 命中、raw50、policy v2、sourceQueryCount=0；展示分别45/50/50/50/49，三国合格推荐8，耍赖仍仅4。配额 used `4 → 4`；没有冷搜索、详情补查或触发播放。
- 首页空查询返回200条全局推荐：上述三位歌手各自头20条全部可见，三国8/8和耍赖4/4均已进入池，四个已知剧情/日常/新闻视频 ID 均不存在。首次历史补建脚本端耗时1884ms，持久化后重复读取200条为172ms、sourceQueryCount=0（均不是浏览器性能测量）；不把这些计数当作全局歌曲总数或真实播放通过证据。原始 smoke 数据位于未提交的 `.wrangler/release-v2-production.json`。
- 生产实际播放和进一步用户使用验收留待用户方便时进行。发布记录以独立 `[CI Skip]` 文档提交推送，刷新原页面后可使用新前端。

这份文件记录 implementation status、历史修复、验证结果和剩余工作。搜索的当前算法与缓存规范只以根目录 `SEARCH.md` 为准；产品、总体架构、手动配置、部署和通用测试见 `README.md`。

## 保守搜索展示与严格首页准入（已发布，用户生产验收中）— 2026-10-27

- 回退基线：`aa65a603247bbb01f7b864e4ea08714a216570a0`，本地标签 `codex/baseline-before-music-eligibility-2026-10-27`；原工作区干净，已包含成熟双语与紧凑底栏。详情及回退步骤见 `docs/SEARCH_BASELINE_2026-10-27.md`。未覆盖此前功能或生产数据。
- 修改前验证：完整 30 files/208 tests、搜索专项 13 files/110 tests、typecheck、build 通过。新增 fixture 记录基线真实 50 条候选顺序/分数，新实现逐项一致。
- 展示规则：新增纯函数音乐资格判断，仅排除已知非 Music 且无歌曲/音乐/演出线索者；明确音乐版本、非 Music 分类音乐、metadata 不足、短片/长串烧优先保留。原唱开关、原有 scoring 与 provider query 不改。
- 缓存分层：raw algorithm `rank-preserve-50-v2` 与 exact KV `v4` 不变，D1/KV 先保存全部 raw candidates，再过滤公开视图。独立 response policy `music-evidence-v1` 防止恢复旧浏览器结果；输入、模式与原唱选项保留。筛后零条仍是缓存命中，不冷重填。
- 推荐 `v7`：新写、touch、历史重建统一先筛明确音乐与查询关联，再最多取 20 条；不足不补尾部。v6 池不读不覆盖，旧 raw 与推荐 key 支持代码回退。重建的合格结果尽力持久化，保持既有纯歌名歌曲的点歌提升；不变时不重复写，刷新故障不使可用读取失败。
- 点歌提升：已认可推荐或自带清楚录音结构/版本的音乐可提升；未知 URL 兜底/日常视频不能自动进入全局首页，点歌/播放路径本身不加限制，不补查 metadata。
- 最终验证：完整 31 files/240 tests、搜索专项 14 files/142 tests（真实网络禁止）、typecheck、build、`git diff --check` 通过。原有 URL、quota、deadline、四模式、结构准入、播放器/队列/i18n 测试仍通过。没有新增依赖或 schema migration。
- 真实缓存离线回放：原始 50 条完整保留，公开显示 27、隐藏 23、推荐 4 条明确同名歌曲。保持非 Music 的《达尔文 伴奏》等音乐可搜，含糊 KTV/表演片段仍保守可搜；首页不含这些不确定项。不能仅凭 metadata 承诺所有未来视频零误判。
- 本机独立双 Worker 使用 `.wrangler/state-music-eligibility` 与空 env 的 Main，无 YouTube key；本地迁移仅准备隔离库。旧 v4 KV 和 D1 的 50 条 fixture 经真实 Worker/API 返回 `cached=true`、`candidateResultCount=50`、`filteredResultCount=27`、`hiddenNonMusicResultCount=23`、`sourceQueryCount=0`、本地 quota used `0`。
- 新建内置 @Browser 验证：创建房间、Connected、首页 `4/4`、普通/原唱搜索 `27`、刷新恢复原唱/结果、清空回推荐、中文/英文、点歌与房间同步、已点歌曲升到推荐首位。手机页 console warning/error 为空。实际 YouTube 播放未通过：样例视频返回播放器错误 150；播放页源码没有修改，未把点歌/同步通过冒充播放通过。
- 本地预览运行中：`http://127.0.0.1:8793/room/0b2a5o4z/mobile`。初始推荐四首，搜索“耍赖”后最多显示 27 条；清空再按搜索返回推荐。这里只是固定缓存回放，非实时 YouTube 搜索。截图 `.wrangler/music-eligibility-preview/homepage.png` 未提交；验收播放页已关闭。
- 前端由 dist 提供，改前端需 build 后刷新；Worker 源码自动重载，关闭运行终端停止服务。未改双语词库/样式/DisplayPage，构建 CSS 与成熟版同为 `index-BJfuVwz4.css`；未声称窄屏或完整真实播放验收。
- 用户已检查并明确批准 push/deploy，计划在生产进行用户验收。发布前重复完整 240 项、搜索专项 142 项、typecheck、build、diff check 均通过。
- 发布前只读核实线上回退版本：Room `dd918083-a7ae-49b8-9a20-1fd2ab7938e0`、Main `46fb6774-1898-4ee3-8e08-34ad377ed16e`，均为当前 100% 活动版本。
- 功能提交 `eae1d9d60ecc01742fc3c892843756c2b88c8f57` 已推送 `origin/codex/music-eligibility-cache`；成熟回退标签 `codex/baseline-before-music-eligibility-2026-10-27` 也已推送并用 ls-remote 核实指向 `aa65a603247bbb01f7b864e4ea08714a216570a0`。未推送 main。
- 按 Room → Main 使用 `--keep-vars` 发布，实际活动版本均经 deployments status 确认 100%：Room `ac92afe0-a8c5-4cce-ac01-5d6378d69427`；Main `ea599cd9-e959-4cb6-94f5-8db9890c09e6`。没有生产 schema migration 或缓存删除。
- 生产 cacheOnly 验证：房间 `0e0k0s2b`、查询“耍赖”，命中原始 50 条，公开返回 27、隐藏 23，policy 为 `music-evidence-v1`，sourceQueryCount=0，quota used `0 → 0`。前四条仍为目标同名歌曲，包括两条陈楚生《耍賴》。
- 首页空查询本地缓存读取返回 56 条（多历史 family 的合格项，不能拿单 family 的 4 条作为全局首页上限），检查的四个已知剧情/日常/新闻视频 ID 均未进入首页。没有运行新的 YouTube 搜索或详情调用；未替用户触发播放，实际播放与进一步生产测试留给用户验收。
- 发布记录以独立 `[CI Skip]` 文档提交推送，保持线上代码来源明确。用户应刷新原页面后再开始生产测试；旧浏览器结果快照按新 policy 作废，输入与模式保留。

## 英文紧凑文案与下一首标题（已发布）— 2026-10-24

### 发布后的底栏高度修正（已发布）

- 用户指出加宽的 Up Next 挤出按钮换行，违背之前精调的底栏高度要求。将区域从 160/208px 缩到 80px，禁止右侧控制区和标签换行；右侧列仅调整横向宽度以容纳英文 Resume，保持按钮尺寸和底栏纵向 padding。
- 新建内置浏览器验证本地 `http://localhost:5176/room/local-review/display`：1280×720 英文正常暂停状态底栏 74px，三个按钮 40px 且 top 相同，Up Next 宽 80px；中文也已截图确认按钮与下一首同排。自动播放被阻止时仍保留原有提示，提示会增加高度。
- typecheck 与 diff check 通过；纯布局修正，未推送或部署。用户要求记住高度约束，已写入 memory 更新便笺。
- 用户随后确认将 Up Next 宽度加倍至 160px；相应增加右侧列横向空间，保持同排和纵向尺寸。内置浏览器在 1280×720 英文 Resume 状态实测区域 160px、底栏 74px、按钮 40px 且 top 相同；typecheck、diff check 通过，仍仅本地。
- 用户随后授权发布。代码提交 `c8b67b8` 已推送 `origin/codex/search-relevance-ranking`，未推送 main。发布前 full test 30 文件/208 测试、typecheck、build、verify:search 13 文件/110 测试、diff check 全部通过。
- Room → Main 使用 `--keep-vars` 部署并核对最终活动版本均 100%：Room `dd918083-a7ae-49b8-9a20-1fd2ab7938e0`；Main `46fb6774-1898-4ee3-8e08-34ad377ed16e`。
- 生产 cacheOnly 耍赖命中 50 条，额度 used `2 → 2`。新建内置浏览器与独立验收房间 `255p3r1d`，从缓存推荐点入两首歌，验证 Connected、队列同步、长标题；1280×720 英文 Resume 状态实测底栏 74px、Up Next 160px、三个按钮 40px 且 top 均 663.5px。验收播放已暂停；未调用冷文字搜索。窄屏和完整动画周期未验收。

- 英文额度缩短为 `Searches remaining` 并禁止标签/数字换行；点歌使用 `Pick song`，推荐使用 `Cached songs`，缓存结果末尾保留 `All cached results shown`。
- 手机英文顶部恢复 `Next: 数量` 与连接状态文字；空间不足时允许头部换行。不可用状态缩短为 `Disconnected`。
- 后续微调：下一首短标题右对齐；保留宽度限制和仅溢出时滚动，长标题仍从开头展示。
- 播放页中英文下一首区域显示实际队首标题或“暂无 / None”，限制宽度；溢出标题停留 15 秒后缓慢滚动，末尾停留 5 秒再循环，短标题静止，并尊重减少动态效果偏好。
- `npm run typecheck`、翻译/覆盖与 roomReducer 三组聚焦测试（38 项）、`git diff --check` 通过。测试初次受沙箱 realpath EPERM 阻止，提权后原样通过。
- 新建内置浏览器本地会话，确认英文文案、缓存末尾提示、点歌后 Next 数量及播放页实际下一首标题；未使用真实搜索或生产 API。Vite 本地额度 API 不可用，未做额度成功状态运行时验证；浏览器 viewport override 未反映在截图中，未声称完成窄屏验收；长标题完整动画周期与真实 WebSocket 状态未完成运行时验证。
- 本地 Vite：`http://localhost:5176/create`，前端改动热更新。未提交、推送或部署。
- 上述为本地阶段记录。用户随后授权 push/deploy；发布代码提交 `4f8c3fa` 已推送 `origin/codex/search-relevance-ranking`，未推送 main。
- 发布前完整 `npm test`：30 文件、208 测试通过；typecheck、build、verify:search（13 文件、110 测试）、diff check 全部通过。
- 按 Room → Main 使用 `--keep-vars` 部署，活动版本已用 deployments list 核对：Room `4444e848-d3de-4180-b66e-97437ee94e72`；Main `da3fba3b-3755-4329-8ab0-1322d0c121c1`，均 100%。
- 生产 cacheOnly smoke：耍赖缓存命中 50 条，额度 used `2 → 2`，无外部搜索。首次 smoke ID 格式错误返回 400，改为八位 ID 后通过。
- 新建内置浏览器会话确认线上 `Searches remaining: 98/100` 同行、`Up next / None` 右对齐及手机 `Next: 0`、`Pick song`、`Cached songs`。通过创建流程建立隔离验收房间 `3k0r6q50`，播放页确认 Connected、无 error/warn 日志；直接打开未创建房间时会重连，不作为连接验收依据。长标题完整动画周期和窄屏截图仍未验收。

## 冷门同名词歌曲排序修复（已发布）— 2026-10-23

- 复现：截图中的简体“耍赖”无法匹配繁体“耍賴”；原唱/Official/MV 叠加负分与普通视频的同词命中进一步拉低真正歌曲。新增的 8 个初始回归样例在旧实现下全部失败，修复后通过。
- 排序采用简繁等价、英文词边界与相关性分层，KTV/原唱偏好有界；cover/live 不再把歌名匹配降至 +10。独立歌名、音乐标题或 Music metadata 支持歌曲优先，不把 KTV 场所剧情仅凭 KTV 字样升为歌曲。准入规则未改，50 条结构可用候选全部保留。
- 新增唯一依赖 `opencc-js@1.4.2`，只导入 Worker 的繁转简入口，用于通用匹配，不维护歌名/歌手特例；前端构建未包含该词典。
- 保留 `rank-preserve-50-v2` 和 exact KV `v4`，已缓存的同一候选池重新搜索时重排；recommendations 最终升为 `v6`，旧 exact family 重建/复用时先排序再取前 20，旧推荐池不再读取。未清空生产缓存，不增加 YouTube 调用。
- 发布前验证：最终 `npm test` 通过（28 files / 176 tests）；`npm run verify:search` 通过（13 files / 110 tests，禁止真实网络，包含 typecheck）；`npm run build` 通过；`git diff --check` 通过。
- 本地双 Worker：独立 `.wrangler/state-search-ranking` 完成本地 6 个 migrations；Main 使用空 env 文件，无 YouTube key；真实本地 D1 写入截图改编的 50 条错序 fixture。API cacheOnly 验证 `cached=true`、`responseSource=repository`、`sourceQueryCount=0`、`videosListCalls=0`、返回 50 条，6 条目标歌曲全部在前。本地 quota used `0`。
- 新建内置 @Browser 会话验证创建房间、实时连接、歌名搜索与原唱切换，前六项均为目标歌曲；非原唱首项 KTV，原唱首项 Official MV。console warning/error 记录为空。本地使用固定样例；生产缓存验收见下。未调用真实 YouTube 搜索/metadata，也未验证播放。
- 本地预览运行于 `http://127.0.0.1:8791/room/4t691l1k/mobile`；输入“耍赖”并按搜索，切换原唱后再次搜索以检查顺序。展示的是固定样例，缩略图占位正常；前端由 dist 提供，前端编辑后需 build 再刷新，Worker 编辑由 Wrangler 重载。停止运行终端会关闭预览。
- 用户已检查本地预览并明确批准 push and deploy。
- 首次部署 `a6b86d7` 的 cacheOnly 验收实际命中“耍赖”50 条缓存、quota `5 → 5`，发现日常视频 `#打火机翻唱#ktv` 仍排第一。该验收未视为通过：补入完整真实缓存 50 条 fixture，移除 hashtag 对歌曲证据的影响，并让独立/开头歌名高于仅在其他歌曲歌词中出现的 query；全部候选保留，重新发布后的验证已通过。`v6` 同时隔离首次 `v5` 可能产生的推荐旧顺序。
- 最终功能提交 `482658f` 与前置 `a6b86d7` 均已推送 `origin/main` 和 `origin/codex/search-relevance-ranking`。按 Room → Main 并加 `--keep-vars` 发布：Room `c1dd3d91-dd9d-4faa-baf1-efa3ae4b8d3a`；手动 Main `95e4bd0a-5674-4ac7-8cdf-27252df39a99`。Main 自动构建随后完成，最终活动 Main 为 `9575719e-c038-4c25-ac2a-8b0733272b33`；脚本 etag 与手动版完全相同（`0d0179465ec5ff4edf9ea6f7af0992e1ba550a1e35fab52bda412496f7c2ecaf`），绑定保留。最终 Room/Main 均由 `wrangler deployments status --json` 确认 100% 流量，自动版再次 cacheOnly 验证仍是正确前排、50 条、quota `5 → 5`。
- 最终生产 cacheOnly 验收：房间 `0e0k0s2b`，查询“耍赖”，命中 50 条，quota used `5 → 5`；前四项为“耍赖”、琳娜同名歌与两条陈楚生《耍賴》。另一首歌的歌词匹配排第 5，日常 hashtag 视频随后。没有新增 YouTube 外部请求，也没有删除原候选。
- 新建内置 @Browser 生产验证：房间实时连接、搜索结果 `20/50`，首行即上述四个相关歌曲；console warning/error 为空，真实缩略图与文字顺序可见。截图本地保存为 `.wrangler/search-ranking/production.png`，未提交临时产物；未点歌或播放。最终发布记录单独以 `[CI Skip]` 提交。

## 空搜索返回缓存推荐（已发布）— 2026-10-23

- Mobile 搜索框清空后按搜索，会返回缓存推荐页并重置为先显示 10 首；按钮在非搜索中保持可用。推荐池和分页逻辑未变。
- 缓存规则说明见 `SEARCH.md`：推荐池最多 200 首，每个 exact 搜索 family 最多贡献排序前 20 首；exact family 最多存 50 首；实际点歌歌曲也会被提升。推荐按 video ID 去重，热门/最近使用的 family 参与重建顺序。
- `npm run typecheck` 通过；`npm run verify:search` 通过（13 files / 89 tests，零网络约束）；`git diff --check` 通过。
- 功能提交 `61080b1` 与搜索结果文案修复 `3adcd5e` 一起推送至 `origin/main`；Room `723b0d5b-3542-456f-a457-19dbe7cc971a`、Main `d0f733c6-c25c-4da8-90a1-a253f0645faa` 均为部署历史中的最新 100% 活动版本。Main 自动构建在手动部署后完成，最终版本已复核。
- 发布前全量测试 28 files / 155 tests、typecheck、搜索专项 13 files / 89 tests、production build、`git diff --check` 均通过。cacheOnly 生产 smoke 使用房间 `0e0k0s2b`、查询“后来”，安全 miss、0 条结果，quota used `3 → 3`；没有外部搜索调用。

## 搜索结果文案不依赖缓存来源（已发布）— 2026-10-23

- 主动提交搜索后，不论歌名、歌手、URL、原唱或普通伴奏，也不论响应来自缓存，完成与分页加载文案都显示“搜索结果”；仅推荐列表显示“缓存结果”。
- `npm run typecheck` 与 `git diff --check` 通过。内置 @Browser 本地 mock 验收了歌名普通伴奏、歌手、URL、歌名原唱，均显示“已经显示全部搜索结果”。
- 发布前本地预览：`http://localhost:5173/room/4e0d5a63/mobile`。前端 mock 覆盖歌名普通伴奏、歌手、URL、歌名原唱，均显示“已经显示全部搜索结果”；该 UI 检查不代表真实 Worker 搜索验收。

## 搜索结果提示与二维码收起（已发布）— 2026-10-23

- Mobile 搜索分页在普通搜索时显示“搜索结果”，只有缓存/推荐结果显示“缓存结果”；大屏二维码可在原位置收起为按钮并重新展开。
- 功能提交 `a5bb731`；完整测试 28 files / 155 tests、typecheck、搜索专项 13 files / 89 tests、production build、`git diff --check` 均通过。
- 功能提交 `a5bb731` 和发布记录提交 `c7833f7` 已推送 `origin/main`；随后 Room → Main 使用 `--keep-vars` 再次发布。最终 Room version `88a722e6-0e91-43c0-9435-5d434d16ece3`、Main version `d800f53a-e438-49e4-ad16-6a1138f493b0`，部署历史复核均为 100% 活动版本。
- 生产 cacheOnly smoke：测试房间 `0e0k0s2b`、查询“后来”，安全 miss、0 条结果，quota used `0 → 0`；脚本确认没有外部搜索调用。
- 内置 @Browser 生产验收：新房间 `373w311p` 实时连接正常，二维码收起后按钮出现，再次点击可恢复二维码；未运行 cold search，也未消耗 YouTube 搜索额度。

## URL 点歌正式入口 — 2026-10-21

- 已增加 URL 下拉选项、链接提示、提交前共享校验、URL 模式隐藏原唱、24 小时状态恢复；文字搜索契约和缓存版本不变。
- 搜索专项验证：13 files / 89 tests，通过零网络约束与 typecheck。
- 完整测试：28 files / 155 tests；production build 通过。
- 内置 @Browser 本地验证：无效其他站点链接提示、URL 模式隐藏原唱、刷新恢复 URL 模式、切回歌手恢复原唱；通过。
- 新增直接视频回归：quota/cache/D1 不被读取，0 次 search.list，metadata 正常返回。
- 内置 @Browser：390×844 URL 布局无横向溢出（clientWidth/scrollWidth 均为 390），未捕获 console error；未做真实 YouTube 端到端点歌验收。
- `git diff --check`：通过（修复 tsconfig 列表新增项的尾空格后）。
- 功能提交 `ccb98b1` 已推送 `origin/main`。
- 2026-10-22 已恢复本机 Wrangler OAuth 登录；生产构建、typecheck 与 diff 检查通过，按 Room → Main 使用 --keep-vars 发布。
- Room version: c1b7d1c1-3e3e-4b85-9f23-2bd343a49a37；Main version: 9b63a48f-c4bb-41a6-861f-4d15fd47ff95；deployments list 复核均为 100%。
- Production cacheOnly smoke：测试房间 640z5m2i，直接 URL 返回 0 条，0 次外部调用，quota used 0 → 0。
- 内置 @Browser 生产验收：创建房间、实时连接、URL 模式隐藏原唱、指定视频 metadata 卡片返回 1 条、点歌成功、歌单显示该视频为当前歌曲；全部通过。真实 URL 查询及点歌后 quota used=0、remaining=100，未运行 cold 文字搜索。
- 实际视频解码/音频播放与真实设备兼容性未在本次 smoke 中验证。

## URL 输入提示简化 — 2026-10-22

- URL placeholder 改为 `YouTube视频链接`；歌名/歌手名及搜索行为不变。
- 完整测试 28 files / 155 tests、搜索专项 13 files / 89 tests、typecheck、production build、git diff --check 均通过。
- Room `b10d3089-9173-493b-a92f-902d8392028c` → Main `c6133ee1-f41f-4425-bc36-c239680df633` 已使用 --keep-vars 发布。
- 内置 @Browser 生产 smoke：三个输入提示精确为 `歌名`、`歌手名`、`YouTube视频链接`；未提交搜索，不消耗搜索次数。

## 开发流程改为本地优先 — 2026-10-22

- 默认本地开发/最小验证；明确要求发布后才完整测试、Room → Main 部署及生产 smoke。默认不 push main，避免 Workers Builds 自动发布。
- AGENTS 新增新手指导要求，README 第 4 节给出 Vite 预览、focused tests、local migrations、双 Worker 与排障步骤；SEARCH 验证阶段同步对齐。
- 实测双 Worker --local 启动命令：Ready on http://127.0.0.1:8787；存储 bindings 均为 local，未部署。
- local migrations 检查：No migrations to apply；内置 @Browser 实测本地创建房间 0q2q3u37、实时连接、mock 搜索 8 条、点歌成功、大屏同步标题与手机歌单一致。未将真实音视频播放作为验收条件。
- git diff --check 通过；本批仅修改流程文档，未重复运行全量测试/构建，未提交、推送或部署。

## 大屏底栏收紧（已发布）— 2026-10-22

- 左侧连接 badge 与两行额度/reset 提示水平并排；歌名字号最终从 20/24px 稍微缩小到 18/20px（审阅后由首版 16/18px 调回），progress 上间距从 12px 改为 4px，底栏上下 padding 从 16px 改为 8px。其余字体、颜色、右侧按钮、控制面板、队列统计及二维码 card 样式保持原版。
- `npm run typecheck`、`git diff --check` 通过；仅样式调整，未运行全量测试、build 或搜索专项。
- 新建内置 @Browser 会话，在 Vite http://127.0.0.1:5173/room/2y6f410w/display 检查空状态、额度不可用、模拟两行额度、长歌名、禁用进度和播放器错误状态；1280×720 无横向溢出，正常底栏高 74px，三个按钮均高 40px；错误提示出现时高 102px。
- Vite 预览使用临时服务脚本提供模拟 quota 97/100，其余 API 使用本地 fallback/mock；不是实时 Worker 连接或真实额度。样例视频出现 YouTube 150 错误，未验证真实音视频播放。尝试 390×844 viewport 切换后实际仍为 1280×720，窄屏验收未完成。
- 本地预览阶段保留页面供用户审阅，未提前提交、推送或部署。
- 审阅修订验证：对照 HEAD，右侧 controls/队列和二维码 card 源码完全一致，唯一 typography 差异是歌名；其余变化仅 layout、padding/margin 与防收缩。typecheck、diff 检查再次通过；新内置 @Browser 页面实测 1033×846 无横向溢出，歌名 20px，badge/额度/“即将播放”12px、队列数量 18px，按钮 14px/高 40px，QR card 182×210px。本地模式的灰色 badge 与空房间隐藏控制键均为原有状态行为。
- 字体显示差异最终由用户确认是 Chrome 站点缩放不同：production 125%，localhost 100%；未为此放大其他字体或控件。用户统一比例审阅后明确批准发布。
- 发布前完整测试 28 files / 155 tests、搜索专项 13 files / 89 tests、typecheck、build、git diff --check 均通过。代码提交 `a09d961` 已推送 origin/main。
- 初次手动发布后 Main 自动构建完成，已再次按 Room → Main 使用 --keep-vars 发布并复核：Room `faa9f2aa-94d4-4f1e-b313-172a9de5ddb6`；Main `7cd8bd12-b7ed-4ff6-8207-b0fee486d0e4`，最终均 100%。线上静态资源匹配本批构建。
- Production smoke 房间 `0e0k0s2b`：cacheOnly 搜索返回 0 条但契约通过，0 次外部搜索，quota used 6 → 6；缓存推荐返回结果，选取既有缓存中的倒数视频点歌成功。内置 @Browser 确认实时连接、左侧并排、标题 20px、按钮 14px/高 40px、footer padding 8px 16px、无横向溢出；再次 cacheOnly 检查 quota 仍为 6。未将真实音视频解码或窄屏作为本次发布验收通过项。

## 1. 当前状态

| Area | Status | Summary |
| --- | --- | --- |
| Repository | Complete | GitHub 已改名为 `bradwang1995/Karaoke-Assistant`，local origin 已更新。 |
| Product MVP | Complete | Create、display、mobile、debug 全流程可用。 |
| Cloudflare backend | Complete | Worker + Assets、D1、KV、Durable Object 已上线。 |
| Realtime queue | Complete | WebSocket commands、broadcast、persistence、reconnect，以及 mobile 歌单超长标题的安全换行与横向溢出约束已完成。 |
| YouTube search | MVP complete | 当前 executable contract、四模式规则、缓存层次、已知风险和变更协议见 `SEARCH.md`；本文件只保留历史 pass 与验证证据。 |
| Admin console | Production complete | 简洁暗色总览、搜索记录、资料库管理与认证已完成，并已发布到生产环境。 |
| Cloudflare storage metrics | Production complete | D1 `file_size`、KV Analytics bytes/key count、服务端缓存、过期回退和 UI 已发布；生产 token、管理员登录与 Dashboard 同刻对照均已完成。 |
| Persistent search repository | Production complete | D1 作为无 TTL 的真实资料源，KV 继续作为加速层；精确查询复用、访问统计、手动删除和存储压力清理已上线。 |
| Mobile preview | MVP complete | 2–4 列、active card 整行扩展、IFrame API 预热、构造即从 30 秒静音 autoplay、字幕默认开启、PLAYING 后淡入与 timeout fallback 已完成。 |
| Display player | MVP complete | Autoplay、0 秒切歌、restart、pause/resume、seek、auto-advance 已完成；画质由 YouTube 自适应。 |
| Reliability | MVP complete | Heartbeat、5-minute cleanup、debug、fallback policy 已完成。 |
| Automated tests | 28 files / 146 tests | 零网络 preserve-50 golden search contract、recommendation v4 高分头部、cache-only、两秒体验、provider 限流、preview、Admin、quota 等 regressions 全部通过；DO storage 和端到端测试待补。 |
| Real-device QA | Pending | Safari、Android、iPad、Desktop Chrome 待正式验收。 |
| Documentation | Complete | `SEARCH.md` 是搜索 source of truth；`README.md` 管产品与运维，`PROGRESS.md` 管历史与证据。重复的 `DESIGN-QA.MD` 已移除。 |

状态：`[x]` complete；`[~]` usable but needs further validation；`[ ]` pending。

## 2. Implementation progress

### Phase 0 — Foundation

- `[x]` React 18、TypeScript、Vite、Tailwind、React Router。
- `[x]` Zustand、TanStack Query、QR code dependencies。
- `[x]` Main/Room Wrangler configs 和 Cloudflare types。
- `[x]` Frontend、Worker、migration、tests 目录。
- `[x]` Dev、typecheck、test、build scripts。
- `[ ]` ESLint/Prettier 未加入；非 MVP blocker。

### Phase 1 — Routes and UI

- `[x]` `/create`、`/display`、`/mobile`、`/debug`。
- `[x]` Display fullscreen layout、QR、player controls。
- `[x]` Mobile search/queue tabs 和中文 UI。
- `[x]` Loading、empty、error states。
- `[x]` Create page 只保留有效 create CTA；暗色响应式 hero、受控两行标题和三步说明已完成。
- `[x]` Display QR/title 打开 mobile new tab。
- `[~]` Responsive base complete；跨设备 visual QA pending。

### Local MVP

- `[x]` Mock search provider。
- `[x]` Shared room reducer。
- `[x]` localStorage snapshot + BroadcastChannel。
- `[x]` Add、promote、remove、advance、restart、cleanup。
- `[x]` First song starts；queued additions do not interrupt。
- `[x]` Reducer tests。
- `[x]` Local fallback 限制在 localhost；production 不伪造成功。

### Phase 2 — Cloudflare backend

- `[x]` Main Worker + Assets 和 separate Room Worker。
- `[x]` D1 schema、repository、snapshot read/save。
- `[x]` DO SQLite migration declaration。
- `[x]` Room id generation/validation。
- `[x]` Create、snapshot、WebSocket、cleanup API routes。
- `[x]` DO restart 后从 D1 恢复。
- `[x]` Real D1/KV/DO bindings production verification。
- `[x]` Admin D1 存储改用 Cloudflare Client API `file_size`，不再使用 SQL `meta.size_after` 作为权威值。
- `[x]` Admin KV 存储改用 GraphQL `kvStorageAdaptiveGroups` 的 `byteCount/keyCount`，与 D1 独立展示。
- `[x]` 指标最近成功值持久缓存、5 分钟调用控制、30 秒并发 lease、partial success 和 stale fallback。
- `[x]` Production D1 已应用 `0004_cloudflare_storage_metrics.sql`；复核无待应用 migration，两个新表均存在。
- `[x]` 按 Room → Main `--keep-vars` 发布：Room `8ee39e12-4618-4948-81d0-f753158a4046`、Main `ba476a0f-0583-431b-ba68-9d1b43d33c52`，均为 100% active。
- `[ ]` Main Worker `CLOUDFLARE_API_TOKEN`（D1 Read + Account Analytics Read）尚未在 secret 列表中确认；线上会安全显示“暂时无法获取”，不会伪造实际值。

### Phase 3 — Realtime queue

- `[x]` `JOIN_ROOM`、`ROOM_SNAPSHOT`、`ROOM_UPDATED`、`PING/PONG`。
- `[x]` Add、promote、remove commands。
- `[x]` Player started、ended、restart commands。
- `[x]` Stale player-event id guards。
- `[x]` Command 后写 D1 并 broadcast。
- `[x]` Connected-client tracking。
- `[x]` 500ms–8s exponential reconnect，最多 8 次。
- `[x]` 中文 metadata JSON/WebSocket/D1 round trip。
- `[~]` 两台真实手机并发操作待验收。

### Phase 4 — YouTube search

- `[x]` Worker-only API key、live provider、mock fallback。
- `[x]` Song/artist 和 original-vocal intents。
- `[x]` Deterministic aliases、当前 KTV/原唱意图 focused source query、family hash。
- `[x]` Cold search 只发一个精准 intent `search.list`；Worker 1600ms、浏览器 2000ms 截止，到时返回当前部分结果。
- `[x]` Duration/category/tags/status enrichment、dedupe；严格拒绝 7 分钟及以上与非音乐视频。
- `[x]` Song title 与 artist metadata 严格相关性门槛；通过后再做 KTV/伴奏或 lyrics/original/audio/radio ranking。
- `[x]` Partial-title regression coverage。
- `[x]` KV v4 exact family cache、v2 recommendations、metadata、payload pruning；历史 v2 normalized index 不再读写。
- `[x]` Recommendation pool 和 cached re-ranking。
- `[x]` 原始 embeddable candidates 与用户可见结果分离；D1 候选目录只被动统计，不参与在线搜索。
- `[x]` 只复用算法版本、完整规范化文字、artist、song/artist 和 original-vocal 全部相同的唯一 family；不再用其余三个选项 family 补充，也不读取不同文字或全局目录。
- `[x]` API 50 results；mobile 10-at-a-time expansion。
- `[x]` Recommendation pool 200 results；缓存耗尽前自动无限滚动。
- `[x]` 显式提交时原唱使用独立 intent queries、准入门槛与权重；各选项保持完全隔离的 exact family。
- `[x]` 20/min 节流；超限返回正常 `throttled` partial response，Mobile 保留当前结果，不再暴露搜索 HTTP 429。
- `[x]` Project quota 100/day、最多 1 call/fill、每次 outbound call 前预留、Pacific reset、status API 和 room WebSocket 即时额度推送。
- `[x]` Real YouTube result + repeat-query cache hit verified。
- `[x]` 不展示提示的 YouTube 单视频 URL 兜底；严格拦截其他 URL，绕过原搜索 family、资料库、ranking 与 `search.list` quota ledger。

### Phase 5 — Mobile search and preview

- `[x]` Default recommendations。
- `[x]` 固定 header/search/footer 外壳；结果容器独立滚动并保存 `scrollTop`。
- `[x]` 24-hour per-room search state。
- `[x]` Queue tab URL persistence。
- `[x]` Portrait 2-column、wide/landscape 3–4-column compact previews。
- `[x]` One active adaptive-quality preview iframe；固定从 30 秒开始，click outside stops。
- `[x]` 选中即激活、`autoplay=1 + mute=1 + start=30`、loading spinner、10s slow-load retry hint。
- `[x]` Overlay selection/queue tags。
- `[x]` Page toast + add-to-queue animation。
- `[x]` Stay on search after adding；duplicate warning。
- `[x]` Direct promote；confirm remove/restart/skip。
- `[x]` Preview iframe load/timeout fallback。
- `[x]` 搜索 pending 不插入等待 panel；compact header/tab/search/footer 提高结果区高度，“即将播放” badge 可直达歌单。
- `[x]` Active preview 保持原 2/3/4 列 card 尺寸；构造时直接 autoplay/start/captions，避免 ready 后重复加载。
- `[x]` 待播 card 约减半高度并移除“第 N 首”；置顶/删歌使用横向 44px touch target，并在 WebSocket send 成功后立即乐观更新本地 snapshot。
- `[~]` Mobile autoplay/playsinline real-device check。

### Phase 6 — Display playback

- `[x]` Fullscreen IFrame Player API。
- `[x]` Autoplay intent、ready guard、retry、blocked hint。
- `[x]` PLAYING/ENDED → room commands。
- `[x]` Natural end、manual skip、mobile restart。
- `[x]` App restart、pause/resume、next、progress/seek controls；三键 wrapper 有明确 button 层级。
- `[x]` YouTube chrome cleanup。
- `[x]` 已移除官方明确失效的 quality APIs、画质 selector 和 manual mode；YouTube 自适应画质。
- `[x]` Dark compact QR card + 140px pure black/white Canvas；room-level connection/quota/local-time status 在 footer 最左。
- `[x]` Center title above progress，和歌名不再重叠。
- `[x]` Progress 以 queue item id 隔离；新歌固定 0 秒，played teal / remaining gray。
- `[ ]` Real-browser autoplay matrix。

### Phase 7 — Reliability

- `[x]` Unified loading/error/status messages。
- `[x]` Production disconnect protection。
- `[x]` Debug snapshot、links、manual cleanup。
- `[x]` 30-second heartbeat。
- `[x]` DO activity storage + alarm。
- `[x]` Activity refresh on snapshot/JOIN/PING/commands。
- `[x]` 5-minute inactive deactivation、queue clear、idle playback。
- `[x]` Search failure/quota/rate-limit feedback。
- `[~]` Party-ready visual/device validation pending。

### Phase 8 — Admin console and persistent search repository

- `[x]` `/admin` 独立 lazy-loaded 管理界面；侧栏只保留总览、搜索记录、资料库三项基础能力。
- `[x]` 单管理员密码登录；12 小时 HMAC session cookie、登录限流、同源 mutation guard 和主动退出。
- `[x]` 总览提供系统状态、YouTube 当日调用与 Pacific reset、资料库真实容量状态、候选采集与精确复用效率、搜索趋势、热门歌曲/歌手和系统提醒。
- `[x]` 搜索记录支持时间、来源、类型和关键词筛选，以及服务端分页。
- `[x]` 资料库支持关键词/类型/原唱状态筛选、排序、分页、结果摘要、批量选择和二次确认删除。
- `[x]` D1 `search_repository_entries` 作为持久真实资料源；精确标准化查询优先复用，KV 仅保留为可过期加速层。
- `[x]` D1 `search_video_catalog` 被动记录外部候选与增长指标；FTS5 与 triggers 已移除，在线搜索不读取该表。
- `[x]` 搜索事件、资料库访问次数、每日 YouTube quota ledger 和管理员审计事件均持久化到 D1。
- `[x]` 冷查询和旧 KV 命中可回填 D1；资料库故障不会阻断公开搜索的安全 fallback。
- `[x]` 管理 API 覆盖 session、overview、searches、repository read/delete；未认证读取也返回 `401` 与 `no-store`。
- `[x]` Recharts 仅随 `/admin` chunk 加载，公共 K 歌入口不承担图表 bundle。
- `[x]` 本地 migration、登录、总览、筛选、空状态、真实资料行、选择、删除确认和删除操作已通过浏览器验证。
- `[x]` 存储压力清理支持只读预览、低复用/最久未用/最早创建排序、最多 50 条有限批次、短期并发 lease、二次确认、KV 同步清除、success/partial/failure 审计与最近历史。
- `[x]` Live YouTube search 在 outbound request 前原子预留 D1 quota；provider 随后失败时仍保留可能已消耗的调用，最终一个额度不能被两个实例同时预留。
- `[x]` 桌面 reference/implementation 同屏对照、移动端 viewport、全量自动验证和双 Worker dry-run 已通过。
- `[x]` Production migration、secrets、Room → Main release、公开流程和未认证保护 smoke 已完成。
- `[~]` 管理员密码由用户独立持有；生产登录页和 secret 已确认，登录后的真实数据终验交由管理员本人完成。
- `[x]` 用户触发搜索会积累 exact response cache 和被动候选统计；只在同一完整文字与 artist 的四个 option families 内复用。
- `[ ]` 无人值守 prewarm/自动搜索仍未启用。

## 3. Bugfix and internal-test archive

只记录修复结果，不再记录反复修改文档的过程。

### 2026-06-26 manual batch

| Area | Completed |
| --- | --- |
| Search | Title relevance ahead of related/channel-only results。 |
| Mobile tab | `?tab=queue` survives refresh。 |
| Recommendations | KV defaults；empty query uses no search call。 |
| Autoplay | Params、retry、play intent、Player-ready guard。 |
| Quality | 默认 YouTube adaptive；手动选项只打开原生 controls，不调用已废弃的强制 quality API。 |
| Display layout | Controls outside iframe；mobile link new tab；QR offset。 |
| Quota | One call / up to 50 results per cold fill。 |
| Preview | Interacting with iframe first selects result。 |

### 2026-07-02 internal test

| ID | P | Completed |
| --- | --- | --- |
| IT-01 | P0 | Mobile skip/next control。 |
| IT-02 | P0 | Mobile restart current。 |
| IT-03 | P0 | Portrait home CTA hierarchy。 |
| IT-04 | P1 | `带原唱` toggle and ranking。 |
| IT-05 | P1 | Song/artist selector。 |
| IT-06 | P0 | Add song keeps search context。 |
| IT-07 | P0 | One preview；interaction selects result。 |
| IT-08 | P1 | Load more from current response。 |
| IT-09 | P1 | Persist search state and scroll。 |
| IT-10 | P2 | Song/artist/KTV/vocal ranking。 |

### 2026-07-03 post-internal pass 1

| ID | P | Completed |
| --- | --- | --- |
| PIT-01 | P1 | Overlay selection/queue pills。 |
| PIT-02 | P0 | KTV/karaoke restored as primary version signal。 |
| PIT-03 | P1 | Remove duplicate preview button。 |
| PIT-04 | P1 | Remove invalid create-page QR CTA。 |
| PIT-05 | P1 | Page toast + queue flight animation。 |
| PIT-06 | P1 | Clear mobile queue count placement。 |
| PIT-07 | P1 | Pill toggle + compact toolbar。 |
| PIT-08 | P1 | Sticky controls/result count。 |
| PIT-09 | P1 | Less preview chrome；outside click stops。 |
| PIT-10–12 | P1 | Display chrome、app seek；quality UI 后在第三轮因官方 API 失效移除。 |
| PIT-13 | P0 | 5-minute inactive cleanup。 |
| PIT-14 | P0 | Open-client heartbeat。 |
| PIT-15 | P1 | Quota estimate and Pacific reset。 |

### 2026-07-03 post-internal pass 2

| ID | P | Completed |
| --- | --- | --- |
| PIT2-01 | P1 | Sticky header clipping fix。 |
| PIT2-02 | P1 | Auto-preview、less hover chrome；固定画质假设后在第三轮修正为 adaptive。 |
| PIT2-03 | P0 | Partial title above unrelated KTV。 |
| PIT2-04 | P0 | 早期 quality preference 尝试；第三轮确认官方 API no-op 后移除。 |
| PIT2-05 | P1 | Remove start button；larger centered progress。 |
| PIT2-06 | P1 | Hide uploader；local quota reset time。 |
| PIT2-07 | P1 | Simplified linked QR card。 |
| PIT2-08 | P1 | Remove duplicate queue-tab count。 |
| PIT2-09 | P1 | Confirm restart/skip；direct promote。 |
| PIT2-10 | P1 | Verification、release、documentation。 |

### 2026-07-13 post-internal pass 3

| ID | P | Completed |
| --- | --- | --- |
| PIT3-01 | P0 | QR 改为纯黑/纯白、高纠错级别、增大尺寸和白色发光边界。 |
| PIT3-02 | P1 | `正在播放`、连接、今日剩余额度、本地 reset 日期/时间/时区固定在 footer 最左。 |
| PIT3-03 | P0 | 移除 YouTube 已废弃且实际 no-op 的固定 quality API/retry/storage；当时保留的原生 controls 手动模式已在第四轮移除。 |
| PIT3-04 | P0 | Restart 重置 player flags/progress，重新 load 0 秒并再次同步 started。 |
| PIT3-05 | P1 | 歌名移到 footer 中间，progress/时间置于其下，消除 overlap。 |
| PIT3-06 | P1 | Display 默认禁止 iframe hover pointer，移除 app click/status/end overlay；autoplay blocked 改用 footer 按钮。 |
| PIT3-07 | P1 | Recommendation pool 从 40 扩为 200，旧 pool 不足时合并 family fallback。 |
| PIT3-08 | P1 | Mobile preview 改为 portrait 2 列、宽屏 3–4 列的小卡片并移除 app title/channel chrome。 |
| PIT3-09 | P0 | Preview 600ms debounce、单 iframe、spinner、10s timeout/retry hint。 |
| PIT3-10 | P1 | Solid header/tags、固定 sticky 高度、16px search input，修复标签溢出和 iOS focus zoom。 |
| PIT3-11 | P0 | 原唱 toggle 自动重搜；原唱/KTV intent 使用相反加减分，结果顺序真实变化。 |
| PIT3-12 | P1 | 非空搜索最多 50，首批和后续每批 10。 |
| PIT3-13 | P1 | README/progress、自动测试、responsive browser smoke 和 release。 |

### 2026-07-14 post-internal pass 3 follow-up

| ID | P | Completed |
| --- | --- | --- |
| PIT3-14 | P0 | QR 从 DOM SVG 改为 Canvas 黑白输出，并加 `only light` / forced-color protection，避免客户端强制深色导致不可扫描。 |
| PIT3-15 | P1 | Display 移除“正在播放”；quota reset 简化为只显示剩余小时，不再显示 GMT、日期或 IANA 时区。 |
| PIT3-16 | P1 | Mobile sticky 建立独立层叠上下文并收紧结果间距，阻止卡片标签穿透；Display ended/error 后隐藏 iframe；当时的 native manual 模式已在第四轮移除。 |

### 2026-07-14 post-internal pass 4

| ID | P | Completed |
| --- | --- | --- |
| PIT4-01 | P0 | Display 移除 auto/manual 画质 UI 和 native manual path，统一由 YouTube adaptive quality 决定。 |
| PIT4-02 | P1 | Footer 增加重播、暂停/继续、下一首三键，并用有边框的 panel、teal 主操作和 rose next 状态强化 affordance。 |
| PIT4-03 | P1 | 自绘 app progress track：已播放段与 thumb 同为 teal，未播放段为 gray。 |
| PIT4-04 | P1 | QR 外层改为暗色紧凑 card，Canvas 从 168px 缩至 140px；内部仍保持高纠错纯黑白和 white quiet zone。 |
| PIT4-05 | P0 | 删除 display 的动态 `startAtSeconds=currentTime`；FullscreenPlayer 固定 0 秒，progress session 按 queue item id 隔离，manual next/natural end/restart 均不会继承旧进度。 |
| PIT4-06 | P0 | Mobile preview 改用专用 URL helper，固定 `start=30`，并补 URL regression tests。 |
| PIT4-07 | P1 | Preview 不添加 title/channel/quality chrome，移除失效的 `modestbranding/showinfo` 参数；按官方规则保留不可遮挡的 YouTube 原生标识。 |
| PIT4-08 | P1 | `/create` 改为与 display 一致的 slate/teal/rose 暗色界面；受控两行标题、首屏 CTA 和简短三步说明消除尴尬换行与空散布局。 |
| PIT4-09 | P1 | 新增 player progress session 与 YouTube preview URL 测试，更新 README/PROGRESS 并完成 responsive browser smoke。 |

### 2026-07-15 post-internal pass 5

| ID | P | Completed |
| --- | --- | --- |
| PIT5-01 | P1 | Create 说明文案在“创建后”前固定换行，消除中文孤字/难看 wrap。 |
| PIT5-02 | P1 | Create CTA 扩至桌面 240×72px，并加入无需 hover 的 teal/cyan/rose/amber 循环渐变、扫光和 reduced-motion fallback。 |
| PIT5-03 | P1 | CTA 右侧说明进一步拉开间距并保留静态箭头；持续移动的箭头只放在主按钮文字右侧，不新增竞争主操作。 |
| PIT5-04 | P0 | Mobile 改为 `100dvh` 固定外壳；header、搜索/结果标题、footer 脱离 scroll，只有结果区 `overflow-y-auto`。 |
| PIT5-05 | P0 | 删除搜索内容 `pb-24` 和内部 sticky footer；footer 使用固定 `shrink-0` 高度，结果到底不再产生额外底部留白。 |
| PIT5-06 | P1 | Mobile 外壳、header、搜索栏、结果/preview 卡、歌单和 footer 全部统一到 display 的 slate/teal 暗色主题并放大小字号。 |
| PIT5-07 | P1 | 新房间使用诚实的中性“K歌房”；不再根据 user agent 伪装成读取了电脑名或 Chrome Profile，legacy id/设备猜测标签也统一隐藏。 |
| PIT5-08 | P1 | 房间名 tests 覆盖 normalization、中性默认值和 legacy label 清理；同步更新操作与发布文档。 |
| PIT5-09 | P1 | Create 删除“1 个房间”badge，右上角替换为“在这个世界上，只有在唱歌的时候，我是绝对自由的。”。 |
| PIT5-10 | P0 | Display 空 footer 不再显示“等待点歌”；Space 在非输入焦点全局切换暂停/继续，点击重播/暂停/下一首后主动释放焦点。 |
| PIT5-11 | P0 | Mobile/Display 增加不可选择/不可长按拖图边界，保留输入编辑；消除截图中的蓝色文字和播放器选择层。 |
| PIT5-12 | P0 | HTML/theme-color/color-scheme/body/safe-area 全部设为深色，Mobile 只让结果区滚动并使用深色 scrollbar，阻止 Safari 上下 browser chrome 和 overscroll 露白。 |
| PIT5-13 | P1 | Preview card 在同一选中边框内恢复视频下方歌名，仍不显示 uploader/channel；搜索工具栏统一 16px 字号并放大原唱和搜索点击区。 |
| PIT5-14 | P0 | 只有 submit 才搜索；输入、歌名/歌手和原唱变化不清空、不重查、不改变当前数量，pending 期间保留旧结果直到成功替换。 |
| PIT5-15 | P0 | Recommendation pool 只强提升每次搜索前 8 条，cache hit 重提 family 头部，真实点歌置顶；family fallback 按 recency/hits 排序后轮转，避免最近搜索的随机尾部垄断。 |

### 2026-07-20 post-internal pass 6

| ID | P | Completed |
| --- | --- | --- |
| PIT6-01 | P0 | 按 Google 2026-06 granular quota 文档核实：默认 `search.list` bucket 是 100 calls/day、每次 1 call；单次 `maxResults` 仍是 50。Main/Room guardrail 与默认值同步为 100。 |
| PIT6-02 | P0 | 修复 v1 normalized index 跨 song/artist、KTV/原唱和 artist scope 覆盖 family hash；v2 index 隔离全部 intent，并始终优先读取、验证精确 family。 |
| PIT6-03 | P0 | 歌名模式固定合并同一 canonical song 的 KTV/原唱历史 cache，去重后按当前 intent 重排；只要历史中有相关结果就不再发 live search。 |
| PIT6-04 | P0 | Cold song search 第一条 source query 改为精确歌名；标题 miss 和 channel-only hit 不再进入歌名结果，旧 cache 若只剩无关项会回到 live fill 并覆盖当前 family。 |
| PIT6-05 | P0 | Quota write 直接返回刚记录的 100-based status，不再立即回读最终一致 KV；Main Worker 经 room Durable Object 发布 `YOUTUBE_QUOTA_UPDATED`，Display React Query cache 立即更新，60 秒 poll 只作兜底。 |
| PIT6-06 | P1 | 新增 cache intent isolation、同曲跨 intent reuse、song relevance、focused source query、quota write-through 和 WebSocket quota regressions；README/PROGRESS 同步。按用户要求 commit/push 但不立即 deploy。 |
| PIT6-07 | P0 | 用户后续明确授权发布；按 Room → Main 顺序使用 Wrangler 4.105 和 `--keep-vars` 上线，生产 HTTP、真实搜索/cache、100/day quota 与 WebSocket 即时 quota push 已复核。 |

### 2026-07-21 admin console baseline

| ID | P | Completed |
| --- | --- | --- |
| ADM-01 | P0 | 按用户选定的第三版暗色 dashboard 缩减为总览、搜索记录、资料库三项基础导航，保留现代图表与紧凑信息层级。 |
| ADM-02 | P0 | 新增 D1 持久搜索资料库、搜索事件、每日 quota ledger 和管理员审计表；持久资料不设 TTL，KV 仅作 accelerator。 |
| ADM-03 | P0 | 公开搜索改为 D1 exact hit 优先；cold fill/legacy KV 自动回填，读命中更新访问时间和次数，唯一键避免数据重复。 |
| ADM-04 | P0 | 新增安全的 fallback 管理员认证与受保护 API；session secret/password 只从 Worker secret 读取。 |
| ADM-05 | P1 | 完成 overview、search log 和 repository filters/pagination/delete 交互；容量未知时显示“未知”而不虚构百分比。 |
| ADM-06 | P1 | Admin 页面 lazy-load Recharts，保留公共 K 歌首屏 bundle 边界；README 与 PROGRESS 使用中文记录行为、配置和操作。 |
| ADM-07 | P0 | 本地 D1 migration、资料写入/精确复用、受保护路由、登录、交互删除、桌面同屏对照和移动端 responsive 均已验证；最终 production evidence 待下方本轮记录补齐。 |
| ADM-08 | P0 | 补齐 storage-pressure cleanup：必须先预览，策略与候选可见；执行前二次确认，服务端持有 60 秒 lease，按配置 batch 删除并记录 before/after、affected count、target outcome 和 failure。自动执行仍关闭。 |
| ADM-09 | P0 | Quota 从“成功后记账”强化为“请求前原子预留”；失败后的可能消耗不丢失，并发最终额度只允许一个 D1 reservation。无耐久 ledger 时不发送无法追踪的 live search。 |
| ADM-10 | P0 | 完成存储路径 discovery：D1 保存房间、队列、播放状态、持久搜索 response、搜索事件、quota、audit 与 admin 指标缓存；KV 保存 `yt-search:v3` family、`yt-search-index:v2`、recommendations 和 D1 异常时 quota fallback；DO 只保存房间 activity 并通过 D1 恢复业务 snapshot。 |
| ADM-11 | P0 | 新增服务端 Cloudflare 指标 client：D1 调用 database details API 的 `file_size`；KV 调用 GraphQL `kvStorageAdaptiveGroups` 的 `byteCount/keyCount`。响应只返回标准化值、来源、新鲜度和安全错误，不返回 token、account/resource ID 或原始 provider body。 |
| ADM-12 | P0 | D1/KV 使用量与容量完全分离；未找到返回当前 account 真实 D1/KV capacity limit 的支持接口，因此不按 plan 名称硬编码上限。可选 `D1_CAPACITY_LIMIT_BYTES` / `KV_CAPACITY_LIMIT_BYTES` 明确标记为“运维配置”。 |
| ADM-13 | P0 | `migrations/0004_cloudflare_storage_metrics.sql` 保存最近成功指标和 refresh lease；provider 部分失败保留另一资源，失败后继续显示最近成功值并标记过期，从未成功显示“暂时无法获取”。 |
| ADM-14 | P1 | 保留用户选定的现有暗色界面与三项导航，仅在持久资料库卡片、系统提醒和清理预览中补充 D1/KV 实际值、key count、来源、测量时间和 app estimate 区分；全局刷新会强制服务端重新验证 Cloudflare。 |
| ADM-15 | P0 | 完成生产管理员登录与 Dashboard 终验：D1 `278,528 bytes` 对应 Admin `272.0 KB` / Dashboard `279 kB`；KV `1,297,755 bytes`、`413` 个键对应 Admin `1.2 MB / 413` / Dashboard `1.3 MB / 413`。差异仅为单位换算。 |

### 2026-07-28 cross-query catalog pass 7

| ID | P | Completed |
| --- | --- | --- |
| SRCH7-01 | P0 | 新增 D1 `search_video_catalog` 与 FTS5 external-content 索引；insert/update/delete triggers 保持目录和索引同步。 |
| SRCH7-02 | P0 | `search.list` 原始 embeddable candidates 全部进入目录；现有 title relevance 与 KTV/原唱 scoring 只把相关结果交给用户。 |
| SRCH7-03 | P0 | Exact repository/KV miss 后先查跨查询目录；本地至少有 `min(limit, 10)` 条时不调用 YouTube，不足时外部补齐、去重、重排并持久化。 |
| SRCH7-04 | P1 | 搜索事件新增候选数、过滤后数、目录结果、新增独立视频、真实 search calls 与免调用标记；新增数使用 D1 insert `changes`，避免把重复视频算作增长。 |
| SRCH7-05 | P1 | Admin 总览新增候选目录与额度效率卡，显示总视频、累计出现、本地复用率、免调用、新增候选/额度和过滤前/后。 |
| SRCH7-06 | P0 | Migration 0005 已在本地 D1 成功执行 14 条命令；真实 FTS5 中文 `MATCH`、trigger insert 与 join 返回通过。定向 6 files / 31 tests 和 typecheck 已通过，完整发布验证见 verification record。 |

### 2026-07-28 exact-query rollback pass 8

用户实际体验推翻了 pass 7 的跨查询提前返回策略；下列项目明确取代 SRCH7-01、SRCH7-03 和相关复用文案。

| ID | P | Completed |
| --- | --- | --- |
| SRCH8-01 | P0 | Cache identity 改为完整规范化搜索文字 + artist + song/artist mode + original-vocal flag；只折叠大小写、首尾和连续空格，不再把 `后来` 与 `后来 KTV` 视为同一查询。 |
| SRCH8-02 | P0 | D1 只查 exact repository，KV 只查 exact family hash；删除 normalized index fallback、KTV/原唱双 family 合并、候选目录检索和本地 10 条提前返回。 |
| SRCH8-03 | P0 | Exact miss 直接进入 YouTube cold search；一次仍最多获取 50 个 embeddable candidates，并把本次通过过滤的完整结果写入 exact D1/KV response。 |
| SRCH8-04 | P1 | 候选表仅保留被动增长/过滤统计；migration 0006 删除 FTS5 表和同步 triggers，避免无用索引写入。 |
| SRCH8-05 | P1 | Admin 改为“候选采集与精确复用效率”，明确在线搜索不扫描目录，精确复用条件完整可见。 |

### 2026-07-29 song-only same-text cache pass 9

本轮保留 pass 8 的“绝不扫描全局候选目录”，但把搜索文字提升为主要 identity：歌曲/歌手与原唱开关只在同一文字、同一 artist 的四个精确 family 之间作为次级选项复用。

| ID | P | Completed |
| --- | --- | --- |
| SRCH9-01 | P0 | YouTube `search.list` 限定 Music category 10；`videos.list` 同时读取 duration、category、tags 与 embeddable，未知详情、非音乐分类、恰好或超过 7 分钟的视频全部拒绝。 |
| SRCH9-02 | P0 | D1 用一次查询读取同一文字与 artist 的最多四个 option families，KV 并行读取四个精确 hash；当前选项优先，其余组合只用于补充并按当前意图重排，绝不扫描全局候选目录。 |
| SRCH9-03 | P0 | KV search/recommendation namespaces 升到 v4/v2；旧 D1/KV 结果缺少新歌曲资格 metadata 时 fail closed，避免历史旅游视频或超长视频继续返回。 |
| SRCH9-04 | P0 | Mobile 搜索开始即清空旧卡片与 preview，搜索按钮灰显并旋转，结果区持续显示歌曲筛选 spinner，直到新 response 到达。 |
| SRCH9-05 | P1 | D1 四 family 合并为单次读取；KV 四 key 并行；repository/KV touch、结果持久化、事件与 quota broadcast 使用 Worker `waitUntil`，同时保留候选新增指标的同步真实性。 |

### 2026-07-29 mobile preview playback restoration pass 10

| ID | P | Completed |
| --- | --- | --- |
| PREV10-01 | P0 | Mobile preview 从仅依赖 iframe URL 参数改为 IFrame Player API；ready 后先静音，再从 30 秒显式 load、seek、play，并做 250ms/900ms 短重试。 |
| PREV10-02 | P0 | Spinner 只在收到真实 `PLAYING` 后消失，不再把 iframe `onLoad` 误当作已播放；error/autoplay blocked/10 秒 timeout 统一进入可重试状态。 |
| PREV10-03 | P1 | 保留 600ms 防误触、单 active preview、点击外部停止、无 native controls 与 adaptive quality；新增调用顺序 regression test。 |

### 2026-07-30 search relevance and immediate preview pass 11

本轮修复 pass 9 跨 family 补充造成的相关性回归，并以用户当前要求取代 pass 10 的 600ms preview debounce。

| ID | P | Completed |
| --- | --- | --- |
| SRCH11-01 | P0 | 歌名模式只接受标题命中；歌手模式拒绝 title/channel/tags 都不含目标歌手的候选。跨 family cache 只能补充通过当前查询门槛的候选，不能再让其他歌手或 channel-only 结果进入前列。 |
| SRCH11-02 | P0 | 非原唱首个 YouTube source query 明确使用 focused text + `ktv`，只保留带 KTV/卡拉OK/karaoke/伴奏/instrumental 标记且没有明确 original/原唱的候选；原唱首个 query 使用 focused text + `lyrics`，只保留标题带 lyrics/歌词、原唱、MV、official、audio/radio 标记的候选。 |
| SRCH11-03 | P0 | 同文字 cache 仍稳定复用并重新按当前意图排序；若旧 family 存在但严格相关性过滤后为零，则执行一次精准 cold refill 修复坏缓存，不把无关结果永久复现。 |
| PREV11-01 | P0 | 选中候选卡立即激活唯一 preview，移除 600ms debounce；iframe 初始化使用 `autoplay=1`、`mute=1`、`start=30`、`playsinline=1`，ready 后继续显式 mute/load/seek/play。 |

### 2026-08-01 quality-first 50-result search and verified 30-second preview pass 12

2026-07-30 的 production acceptance 被用户真实使用推翻：`林俊杰` 歌手查询仍被旧缓存固定为 8/8，preview 虽带 `start=30` 参数却仍可能从 0 秒开始。本轮不沿用 pass 11 的完成结论，重新以实际结果数量和播放器真实 current time 为验收依据。

| ID | P | Implemented locally |
| --- | --- | --- |
| SRCH12-01 | P0 | Exact cache identity 加入搜索算法版本，只读取相同文字、artist、模式和原唱开关的唯一 family；不再跨四个 option family 混合，旧算法的 8 条缓存不会命中新版。 |
| SRCH12-02 | P0 | Cold fill 从“一次 search 后直接缓存”改为优先沿精准 intent query 的 `nextPageToken` 翻页、再按其他 intent source query 继续补量；每轮执行 metadata/资格/相关性过滤，过滤后达到 50 条才停止，默认质量补量上限从 1 次提高到 12 次。 |
| SRCH12-03 | P0 | 歌手普通模式扩充 KTV/karaoke/伴奏/卡拉OK/pinyin/instrumental 查询；歌手原唱模式扩充 lyrics/歌词/MV/official audio/radio，并允许明确匹配歌手且无 KTV/伴奏/cover 冲突的普通原唱歌曲。 |
| SRCH12-04 | P0 | 首次生产 smoke 揭示 D1 repository 读取虽构建了新版 hash，却只按文字/artist/options 找旧 row；读取路径现强制 `family_hash` 与当前算法版本化 hash 完全相同，旧 8 条 row 会 cold refill 并由现有唯一键原位升级。 |
| PREV12-01 | P0 | IFrame 初始化恢复 `autoplay=0`，阻止视频在 ready 前从 0 秒抢先播放；ready 后显式 mute → load at 30 → seek 30 → play，收到 `PLAYING` 时还必须确认 `getCurrentTime() >= 29`，否则继续 seek，不能提前结束 loading。 |

### 2026-08-01 two-second search UX and graceful throttling pass 13

用户实际使用确认 pass 12 为补满 50 进行最多 12 次顺序外部调用，搜索时间过长并开始出现 429。本轮以用户体验取代“必须补满 50”：两秒是硬上限，到点返回当前结果，不能为了数量继续等待。

| ID | P | Implemented locally |
| --- | --- | --- |
| SRCH13-01 | P0 | Cold family 从最多 12 次降为 1 次精准 `search.list`；新增 `YOUTUBE_SEARCH_TIMEOUT_MS=1600`，所有 YouTube search/details fetch 共享 deadline 和 AbortController。 |
| SRCH13-02 | P0 | 详情在 deadline 前完成则保持 Music/时长/embeddable 严格验证；详情超时时立即用已发现标题做 query/intent 过滤并返回，但未验证结果不持久化。 |
| SRCH13-03 | P0 | 浏览器 fetch 在 2000ms 主动 abort；搜索期间保留当前卡片和选择，超时、应用节流或 provider 429 没有新结果时继续显示当前结果。搜索按钮仍按既有 click-outside 规则停止当前 preview。 |
| SRCH13-04 | P0 | 应用 20/min guard 不再返回破坏 UI 的 HTTP 429，改为 `throttled` partial response；YouTube 429 也转换为可解释的部分响应，且单次 cold call 显著降低 provider 压力。 |

### 2026-08-01 quota exhaustion clarity pass 14

生产 `/api/youtube/quota` 实测为 `100/100`、`remaining=0`、`exhausted=true`，重置时间 `2026-08-02T07:00:00Z`；这不是两秒 timeout 或房间级 429。相同生产时刻，已缓存的 `林俊杰 / 歌手 / 非原唱` 仍由 repository 返回 50 条且 `externalCallAvoided=true`，证明受影响的是 cold miss。

| ID | P | Implemented locally |
| --- | --- | --- |
| SRCH14-01 | P0 | Mobile 把零结果且 `quota.exhausted=true` 视为可恢复的部分响应；已有卡片继续显示并给出重置倒计时，不再被空 response 替换。 |
| SRCH14-02 | P0 | 没有已有卡片时显示持续可见的“今日搜索额度已用完”和恢复倒计时，并说明已缓存的相同搜索仍可用，不再显示误导性的“没有找到合适的视频”。 |

### 2026-08-01 zero-quota search development and release guard pass 15

本轮目标不是再次靠生产 cold search 调算法，而是建立可重复的本地事实来源：以后修改搜索相关性、意图、缓存、超时或错误体验时，先在 0 次真实 YouTube 调用下发现回归，再由用户用少量真实查询做最终验收。

| ID | P | Implemented locally |
| --- | --- | --- |
| SRCH15-01 | P0 | 新增 deterministic golden provider contract，覆盖歌曲/歌手 × KTV/原唱四组搜索；固定 `后来`、`单依纯`、`林俊杰` 的允许/拒绝结果和一次 search + 一次 details 调用预算。 |
| SRCH15-02 | P0 | 新增 Vitest 全局 no-network setup；搜索契约默认阻断未 stub 的真实 fetch，`verify:search` 会清空 API key 并一次运行质量、cache、timeout/429、UI 保留和 preview 回归。 |
| SRCH15-03 | P0 | 发布 guard 同时检查 Room/Main variables 和源码默认值：daily=100、max calls/fill=1、Worker=1600ms、browser=2000ms，阻止多轮补量或超时漂移重新进入生产。 |
| SRCH15-04 | P0 | Search API 增加隐藏 `cacheOnly=true` 诊断模式；exact hit 可读，miss/单视频 URL 都不触达 YouTube，且不写 human search event 或 quota ledger。 |
| SRCH15-05 | P1 | 新增硬编码 cache-only 的生产 smoke 脚本，自动对比 quota 前后 `used` 并验证 `sourceQueryCount=0`；README 将真实 cold search 明确降级为用户授权的人工验收。 |

### 2026-08-04 search source-of-truth and documentation governance pass 16

本轮没有修改 production 搜索结果；目标是把散落在 README、历史 progress 和代码中的搜索事实收敛成可审计规范，并让搜索验证脚本阻止文档/config/常量漂移。

| ID | P | Implemented locally |
| --- | --- | --- |
| DOC16-01 | P0 | 根目录新增 `SEARCH.md`，以当前代码重新核实 query family、四模式 hard gates/scoring、YouTube pipeline、D1/KV/recommendations/catalog、quota、两秒状态和 API 诊断。 |
| DOC16-02 | P0 | 明确区分“当前行为”和“下一版变更提案”，建立 version bump matrix、golden fixtures、额度上限与发布完成标准。 |
| DOC16-03 | P0 | `verify:search` 读取 `SEARCH.md` 机器契约，并与 Room/Main variables、Worker/Client constants、cache versions、region/language、结果/时长限制核对。 |
| DOC16-04 | P1 | README 搜索技术细节和 production search smoke 移至 `SEARCH.md`，只保留产品级不变量与链接；PROGRESS 历史 pass 保留但不再定义当前算法。 |
| DOC16-05 | P2 | 删除内容已被本文件历史 QA 摘要覆盖的 `DESIGN-QA.MD`，文档职责收敛为 README / SEARCH / PROGRESS。 |

### 2026-08-23 preserve-50 ranking-first search redesign pass 17

内部测试发现 `林俊杰 + artist` 等健康的 50-candidate provider response 会被 Music category、`<420s`、title/artist、KTV/原唱 marker 与 details 完整性 hard gates 压缩到约 16 条。本轮把普通文字搜索改为“完整性优先、排序第二、只有结构不可用才拒绝”。

| ID | P | Implemented |
| --- | --- | --- |
| SRCH17-01 | P0 | `search.list` 仍只调用一次、`maxResults=50`、`videoEmbeddable=true`，移除 `videoCategoryId=10`，不设置 provider duration filter。 |
| SRCH17-02 | P0 | 本地只剔除空/非法 id、空 title、重复 id 和详情明确 `embeddable=false`；移除 Music、时长、metadata、title/artist 与 KTV/原唱/cover hard gates。 |
| SRCH17-03 | P0 | `videos.list` 降为 enrichment；遗漏 id、缺 duration/category/tags、timeout、429 或其他 details failure 时保留 snippet candidates。 |
| SRCH17-04 | P0 | D1/KV read/write 使用相同 structural semantics，50 条 cold candidates 可完整 exact round trip；algorithm `quality-fill-50-v1 → rank-preserve-50-v2` 隔离旧 family。 |
| SRCH17-05 | P1 | KV entry schema 保持 `v4`；recommendations 因只摄入每次前 8 条而 `v2 → v3`，fallback 排除旧 algorithm family，catalog 明确记录 broader structural candidates 且只用于 analytics。 |
| SRCH17-06 | P1 | 四模式 golden contracts 改为验证 permissive inclusion + intelligent ordering；新增 50 条、16 强 + 34 弱 artist、长视频/缺 metadata、details failure、cache round trip、旧 hash 隔离和 explicit non-embeddable regressions。 |
| SRCH17-07 | P2 | Scoring reasons 不再参与准入，重复 `现场`/`教学` signals 清理；`SEARCH.md` 机器契约与 verifier 同步禁止 category/duration/intent hard gate 回归。 |

### 2026-08-23 mobile compact controls and preview polish pass 18

本轮只调整 Mobile 的可视空间、pending 呈现、歌单入口和 preview 启动/淡入；搜索 query、排序、cache、quota 和两秒 deadline 保持 pass 17 契约。

| ID | P | Implemented locally |
| --- | --- | --- |
| MUI18-01 | P0 | 移除结果区“正在搜索 / 最多等待 2 秒”大块状态和旧结果 loading panel；固定高度标题、计数和按钮 spinner 继续反馈 pending，避免 content shift。 |
| MUI18-02 | P1 | “即将播放 N 首”改为与连接状态同排的紧凑可点击 badge，点击直接切到歌单 tab 并同步 URL/store。 |
| MUI18-03 | P1 | 收紧 header、tab、search controls 和底部点歌按钮高度，扩大搜索与歌单的独立滚动窗口。 |
| MUI18-04 | P1 | 点歌页挂载即预热 YouTube IFrame API；preview 在真实 PLAYING 后短延迟淡入，iframe 显式禁止 pointer/hover/focus，以减少首次加载和原生 chrome 干扰。 |

### 2026-08-24 full-width preview and dense queue pass 19

生产复现确认半列 preview 只有约 `167×94`，低于 YouTube embed `200×200` 最低 viewport；本轮不再依赖淡入延迟掩盖问题，而是扩大 active player、移除重复加载并压缩长歌单。

| ID | P | Implemented locally |
| --- | --- | --- |
| MUI19-01 | P0 | Active preview card 在 2/3/4 列 grid 中分别横跨整行；390px viewport 的 player 约为 `356×200`，active video 上不显示 app selection badge。 |
| MUI19-02 | P0 | Preview player 改为构造时 `autoplay=1 + mute=1 + start=30 + cc_load_policy=1`；ready/retry 只做 seek/play 校准，移除重复 `loadVideoById`，真实 PLAYING/29 秒 guard 不变。 |
| MUI19-03 | P1 | 待播 card 改为紧凑 thumbnail/title/channel + 右侧图标操作，移除“第 N 首”和第二行大按钮区，list gap 同步收紧。 |
| MUI19-04 | P1 | Connected 状态下置顶/删歌在 WebSocket send 成功后立即应用同一 reducer 到本地 snapshot；服务端广播随后覆盖为权威状态。 |

### 2026-08-24 preview size rollback and queue controls pass 20

根据实际使用反馈撤回整行 preview，不再用放大 player 规避不可控的 YouTube 原生 chrome；保留 30 秒直接启动、字幕请求和 active app badge 隐藏。待播 card 保持紧凑高度，两个无文字操作改为横向排列并扩大触控区域。

| ID | P | Implemented locally |
| --- | --- | --- |
| MUI20-01 | P0 | Active preview 移除 full-row col-span 与 200px minimum height，恢复与其他搜索结果相同的 2/3/4 列 card 尺寸。 |
| MUI20-02 | P1 | 待播 card 的置顶/删歌从 32px 纵向按钮改为左右横排的 44px touch target；保留 aria-label/title，390px viewport 实测 card 高度为 74px。 |

### 2026-08-24 mobile header/toggle and broader cache recommendations pass 21

本轮保留 pass 20 已接受的 preview 与歌单布局，只收紧 Mobile 头部/原唱控件层级，并扩大现有高分 exact family 的缓存推荐数量。

| ID | P | Implemented locally |
| --- | --- | --- |
| MUI21-01 | P1 | “K歌房”移到“K歌助手”同一行，长房间名可截断，头部节省一行垂直空间。 |
| MUI21-02 | P1 | 原唱开启时外层 box 保持与关闭时一致的深色中性外观，只有内部 toggle 轨道变为 teal。 |
| SRCH21-01 | P1 | 每个 exact search family 进入 recommendation pool 的高分头部从 8 条增至 20 条，仍按 video id 去重、最多 200 条，recently queued 仍最优先。 |
| SRCH21-02 | P1 | Recommendation key `v3 → v4`；现有 exact KV `v4` family 可按新规则重建，旧推荐池不再读取并按 TTL 自然过期。Query、排序、准入、配额与外部调用数均不变。 |

### Admin storage discovery（2026-07-25）

- 旧管理页面约 `192.0 KB` 的来源已定位：`getAdminOverview()` 执行资料库聚合 SQL 后读取该 statement 的 `D1Result.meta.size_after`。它通常接近整个 D1 文件大小，但不是 Cloudflare database details 管理 API，因此本轮已从 UI 与清理判断移除。
- 2026-07-25 只读 `wrangler d1 info ktv-assistant-db` 报告 production `database_size = 197 kB`、10 tables；应用 migration 0004 与后续指标刷新后，2026-07-26 同刻生产对照为 D1 API `278,528 bytes`、Dashboard `279 kB`、12 tables。
- D1 是真实持久资料源：`rooms`、`queue_items`、`playback_states`、`playback_events`、`search_repository_entries`、被动 `search_video_catalog`、`search_events`、`youtube_quota_daily`、`admin_audit_events`、cleanup/metric leases 与最近成功 metric state。
- KV `SEARCH_CACHE` 是可丢失加速层：`yt-search:v4` exact family payload、`yt-search-recommendations:v2`，以及 D1 quota ledger 异常时的 quota fallback。历史 `yt-search:v3`、`yt-search-recommendations:v1` 与 `yt-search-index:v2` key 不再读写并等待 TTL 自然过期。
- `RoomDurableObject` 的 Durable Object storage 只保存 `room-activity` lifecycle state；房间业务 snapshot 读写 D1，queued recommendation 会写 KV。
- Main/Room 使用同一 production D1/KV IDs；仓库没有 `env.preview` / `env.production` 分叉，也没有此前 Cloudflare storage metrics client。Main Worker 是唯一公开 admin API 和唯一需要 Cloudflare read-only token 的 Worker。

## 4. Verification record

### Automated history

| Date | Result |
| --- | --- |
| 2026-07-02 | Targeted reducer/room/WebSocket/search tests passed；full 11 files / 41 tests。 |
| 2026-07-03 pass 1 | Search/quota/heartbeat targeted tests；full 12 files / 44 tests。 |
| 2026-07-03 pass 2 | Ranking/quality targeted tests；full 12 files / 47 tests。 |
| 2026-07-13 docs | Typecheck、12 files / 47 tests、production build passed；no deploy。 |
| 2026-07-13 pass 3 | Typecheck、11 files / 44 tests、production build、`git diff --check` passed。 |
| 2026-07-13 pass 3 UI | 390×844：2 columns、16px input、single debounced iframe、original auto-search；1280×720：QR/footer/title-progress layout passed。 |
| 2026-07-14 pass 3 follow-up | Typecheck、12 files / 47 tests、production build、Wrangler Main Worker dry-run、`git diff --check` passed。 |
| 2026-07-14 follow-up UI | 1280×720：Display 默认 `controls=0/fs=0`，手动为 `controls=1/fs=1`，error iframe 隐藏且画质 selector 不挤压 footer；390×844：sticky 停在 164px、结果间距收紧，卡片标签滚入搜索区时由 sticky 层正确遮挡。 |
| 2026-07-14 pass 4 | Typecheck、14 files / 53 tests、production build、Wrangler 4.105 Main Worker dry-run、`git diff --check` passed。 |
| 2026-07-14 pass 4 UI | 390×844：create CTA 首屏可见、无横向 overflow、preview URL `start=30` 且单 iframe；1280×720：dark 140px QR、无画质 selector、三键 panel、下一首切换后 progress value `0`。 |
| 2026-07-15 repository rename | New/old GitHub remotes resolve to HEAD `d64f60f`；local origin 更新至 `bradwang1995/Karaoke-Assistant`；production root 返回 HTTP 200；no deploy。 |
| 2026-07-15 pass 5 | Typecheck、15 files / 56 tests、production build、双 Worker dry-run、`git diff --check` passed。 |
| 2026-07-15 pass 5 UI | Create 1280×720：CTA 240×72、持续 gradient、说明强制两行；Mobile 390×800：结果 `scrollTop 0→87`、`window.scrollY=0`，header/search/footer 坐标滚动前后完全一致。 |
| 2026-07-15 pass 5 follow-up | Typecheck、15 files / 58 tests、production build、Wrangler 4.105 Room/Main 双 dry-run、`git diff --check` passed；新增 recommendation promotion/cache-hit/queued-song 和 neutral room-name regressions。Local Vite root HTTP 200；自动浏览器 transport 在连接时关闭，因此本记录不虚报新的截图/交互视觉通过。 |
| 2026-07-20 pass 6 | Search/cache/quota/WebSocket focused 7 files / 32 tests、typecheck、full 17 files / 64 tests、production build 和 `git diff --check` passed。Wrangler 4.105 已确认；Room/Main dry-run 因安全审查认为可能认证并发送 bundle metadata 而未执行。按用户明确要求没有 production deploy，也没有虚报 runtime/browser smoke。 |
| 2026-07-21 pass 6 release | Typecheck、full 17 files / 64 tests、production build、`git diff --check` passed；Wrangler 4.105 按 Room → Main 顺序以 `--keep-vars` 发布，版本列表与 production smoke 复核通过。 |
| 2026-07-21 admin baseline local | Typecheck、full 20 files / 73 tests、production build、Wrangler 4.105 Room/Main 双 dry-run 和 `git diff --check` passed。内置浏览器完成 1440×1024 reference/implementation 同屏对照与 390×844 responsive smoke；页面无横向 overflow，三页导航与表格容器正常，console 无 error/warning。 |
| 2026-07-21 admin storage protection | Typecheck、full 20 files / 82 tests、production build、Wrangler 4.105 Room/Main 双 dry-run 和 `git diff --check` passed。Local D1 应用 migration 0003；内置浏览器实际完成越线 preview → 二次确认 → 删除 1 条 → partial outcome → 空资料库刷新，D1 audit 为 `cleanup_repository/success/partial/affected_count=1`。1440×1024 与 390×844 均无横向页面溢出或 console error/warning。 |
| 2026-07-22 admin production release | Full 20 files / 82 tests、typecheck、production build、`git diff --check` passed。Production D1 migrations 无待应用项；Wrangler 4.105 按 Room → Main 顺序以 `--keep-vars` 发布，deployment status 复核两个新版本均为 100%。Production root/admin HTTP 200，未认证 overview 为 401 + `no-store`；UTF-8 冷查询返回 10 条，重复查询命中 repository 且 quota 不增加；内置浏览器完成登录页、create CTA → display、连接状态和 console smoke。 |
| 2026-07-25 real storage metrics release | Full 21 files / 88 tests、typecheck、production build、Wrangler 4.105 Room/Main 双 dry-run passed。Local 与 production D1 均已应用 migration 0004；production 复核无待应用 migration，两个指标表真实存在。按 Room → Main `--keep-vars` 发布，Room `8ee39e12-4618-4948-81d0-f753158a4046`、Main `ba476a0f-0583-431b-ba68-9d1b43d33c52` 均为 100%。Production root/admin 为 200，未认证 storage 为 401 + `no-store`；线上登录页加载正常且 console 无 error/warning。生产只读 token 和登录后的 Dashboard 数值对照尚待完成。 |
| 2026-07-26 real storage metrics acceptance | Main Secret 更新生成活动版本 `45fc80db-0a8c-4037-a51c-18b003b618d6`，deployment status 为 100%。管理员登录生产 `/admin` 后强制刷新成功：D1 `278,528 bytes`、KV `1,297,755 bytes / 413 keys`，缓存无错误码；Cloudflare Dashboard 同刻显示 D1 `279 kB / 12 tables`、KV `1.3 MB / 413`。生产页面无横向溢出，console 无 error/warning。最终复跑 full 21 files / 88 tests、typecheck、production build、Room/Main 双 dry-run 和 `git diff --check` 均通过。 |
| 2026-07-28 cross-query catalog local | Targeted 6 files / 31 tests、full 22 files / 92 tests、typecheck、production build、Wrangler 4.105 Room/Main 双 dry-run 和 `git diff --check` passed。Local D1 migration 0005 执行 14 条命令；真实 FTS5 中文 `MATCH`、trigger insert 与 join 返回通过。内置浏览器在 1440×1024 验证新效率面板、无横向 overflow、console 无 error/warning；390×844 DOM 仍无页面级横向 overflow 且面板存在，但本次 full-page capture 出现现有侧栏文字压缩，因此不重新宣称移动端视觉终验。 |
| 2026-07-28 exact-query rollback local | Targeted 5 files / 25 tests、full 22 files / 92 tests、typecheck、production build、Wrangler 4.105 Room/Main 双 dry-run 和 `git diff --check` passed。Local D1 migration 0006 执行 5 条命令，保留 `search_video_catalog` 基础数据并删除 FTS5 表和 3 个同步 triggers。内置浏览器在 1440×1024 与 390×844 验证“候选采集与精确复用效率”文案；旧 10 条门槛与在线跨查询文案不存在，两种 viewport 均无页面级横向 overflow，console 无 error/warning。 |
| 2026-07-28 cross-query catalog production release | Production D1 migration 0005 执行 14 条命令并复核无待应用项。Wrangler 4.105 按 Room → Main 顺序以 `--keep-vars` 发布；Room `fdf83e2b-69ad-4ea8-a00c-5d2e58c760f3`、Main `79f4ffaa-93b8-48b7-b35e-becbc62b20a8` 均为 100%。Production root/admin 为 200，未认证 overview 为 401 + `no-store`。一次 UTF-8 冷搜索用 1 次额度取得 50 个原始候选、过滤后 44 条并新增 50 个目录视频；精确复用与跨查询复用分别返回 44/43 条，额度保持 1，后者由 FTS5 目录返回且 `sourceQueryCount=0`。 |
| 2026-07-29 exact-query rollback production release | Production D1 migration 0006 执行 5 条命令；候选基础表保留 247 条，FTS5 表和 3 个同步 triggers 均已删除，并复核无待应用 migration。Wrangler 4.105 按 Room → Main 顺序以 `--keep-vars` 发布；Room `8317ea66-8de7-4177-80ad-bed8622ece20`、Main `8326d942-3a08-4253-84c5-eee8c696442a` 均为 100%。Production root/admin 为 200，未认证 overview 为 401 + `no-store`；线上 Admin chunk 与本地 build SHA-256 完全一致。UTF-8 `后来 + 刘若英` 冷查询、原唱 flag 变体和 `后来 KTV` 文字变体各自调用 1 次 external 并返回 26 条；两个 exact repeats 均由 repository 返回 26 条、0 次 external，quota `0 → 3`，所有事件 `catalogResultCount=0`。 |
| 2026-07-29 song-only same-text cache local | Targeted 7 files / 39 tests、full 23 files / 99 tests、typecheck、production build、Wrangler 4.105 Room/Main 双 dry-run 和 `git diff --check` passed。内置浏览器在 390×844 通过 1.2 秒受控延迟验证：已有 8 张结果卡时提交下一次搜索，卡片立即变为 0、结果区 `aria-busy=true`、搜索按钮 disabled 且 spinner 文案可见；response 到达后恢复 8 张卡片。页面 `scrollWidth=clientWidth=390`，console 无 error/warning。 |
| 2026-07-29 song-only same-text cache production release | Production migration 复核为无待应用项；Wrangler 4.105 按 Room → Main 顺序以 `--keep-vars` 发布，Room `4d1dfa72-9a84-48b8-9a1e-538075dc0108`、Main `ae0f1f0e-1c4c-4672-a1ef-667cdff1b644` 均为 100%。Production root/admin 为 200，未认证 overview 为 401 + `no-store`。`甜甜的 + 周杰伦` 冷查询由 external 返回 28 条，全部 category 10 且 `0 < duration < 420`；改为 artist + 原唱后由 repository 返回 28 条，`servedFromExpandedCache=true`、`sourceQueryCount=0`、`externalCallAvoided=true`，quota 仅 `6 → 7`。生产内置浏览器 390×844 显示实时已连接、10/28 条推荐，无横向 overflow，console 无 error/warning。 |
| 2026-07-29 mobile preview playback restoration local | Focused YouTube helper 1 file / 4 tests、full 23 files / 100 tests、typecheck、production build、Wrangler 4.105 Room/Main 双 dry-run 与 `git diff --check` passed。内置浏览器 390×844 实际点选卡片后只创建一个 `enablejsapi=1` iframe，参数为 `autoplay=0`、`start=30`、`playsinline=1` 和正确 origin；API helper 回归测试确认 ready 后调用顺序为 mute → load at 30 → seek 30 → play。本地 mock 视频在自动化环境返回既有 error 150，因此本地记录没有虚报真实 PLAYING；生产真实结果另行通过。 |
| 2026-07-29 mobile preview playback restoration production release | Production migration 无待应用项；Wrangler 4.105 按 Room → Main、`--keep-vars` 发布，Room `fe4cf8b8-bdcb-4bcd-8837-0a7e8e1dccad`、Main `1777984c-d2e9-4ed1-9891-93136c86ab18` 均为 100%。生产内置浏览器 390×844 加载 `index-Bj8oiKxj.js`，实际点选后恰有一个 iframe，参数包含 `autoplay=0`、`enablejsapi=1`、`start=30`、`playsinline=1` 与正确 production origin；spinner 随真实 `PLAYING` 消失且 player 保持可见，页面无横向 overflow，console 无 error/warning。 |
| 2026-07-30 search relevance/immediate preview local | Focused 4 files / 26 tests 与 full 23 files / 103 tests passed；typecheck、production build、Wrangler 4.105 Room/Main 双 dry-run、`git diff --check` passed。全新内置浏览器本地房间实际搜索 `后来` 并点选第二张卡，选中项立即切换且只创建 1 个 iframe；参数为 `autoplay=1`、`mute=1`、`start=30`、正确 autoplay allow。Mock video id 按预期不可真实播放，因此本记录只确认即时激活和播放器参数，不虚报真实 `PLAYING`。 |
| 2026-07-30 search relevance/immediate preview production release | 源码提交 `5c874f1`、`5174a7c` 已推送 `origin/main`。Wrangler 4.105 按 Room → Main、`--keep-vars` 发布并复核活动部署为 Room `07acd0da-0406-4a91-9836-3cd8c6dfb05a`、Main `0521d5c3-f17f-4f6e-9fe7-7967566748d1`，流量均为 100%。生产 API 房间 `2w002z6x`：`单依纯` 非原唱仅返回本人相关 KTV 结果且无黄小琥；`后来` 非原唱 3 条全部为 KTV/karaoke；原唱冷查询以 `后来 lyrics` 返回 11 条有声/歌词候选，前四条均为目标歌曲，完全相同查询随后命中 repository、结果 ID 顺序一致且 `sourceQueryCount=0`。全新生产内置浏览器 390×844 选择首条刘若英歌词结果后仅有 1 个 iframe，参数含 `autoplay=1`、`mute=1`、`start=30`、`playsinline=1` 和 autoplay allow；真实 `PLAYING` 后 loading 消失，无预览错误、横向 overflow 或 console error/warning。 |
| 2026-08-01 quality-first search/verified preview local | 用户截图推翻 pass 11 production acceptance 后重新实现。Focused 5 files / 37 tests、full 25 files / 126 tests、typecheck、production build 和 `git diff --check` passed。Provider regressions 同时证明同一精确 intent 会优先使用 `nextPageToken` 翻页补满、无下一页时会继续后续 intent query，D1 regression 证明旧算法 `family_hash` row 不会复用；preview regression 证明 current time 未达到 29 秒不会视为成功。Wrangler 4.105 Room/Main 均生成完整 dry-run bundle 和 bindings summary，确认 `YOUTUBE_SEARCH_MAX_CALLS_PER_FILL="12"`；用户级 Wrangler debug log 因沙箱 EPERM 无法写入，但两次 dry-run 均正常退出 0。全新内置浏览器 390×844 本地房间 `6v0s502o` 实际点选后只有一个 iframe，参数含 `autoplay=0`、`start=30`、`mute=1`、`enablejsapi=1` 和正确 localhost origin，页面无横向溢出且 console 无 error/warning；mock video 不作为真实播放证据。 |
| 2026-08-01 quality-first search/verified preview production release | 源码提交 `af2ac6a` 后首次 smoke 在同一生产请求重现旧 D1 8/8，随即定位并以 `faf0559` 修复 D1 读取未校验算法版本化 `family_hash`；两次提交均已推送 `origin/main`。最终按 Room → Main、`--keep-vars` 重新发布并复核活动流量为 Room `d430bdf5-8b93-4944-8c6c-733958e577b8`、Main `dab4441d-efda-4ba4-879f-6368e9116a60`，均为 100%。生产房间 `27205g6r`：林俊杰、周杰伦、邓紫棋的歌手普通与原唱模式六组均返回 50/50；普通模式前排为本人 KTV/karaoke/伴奏，原唱前排为本人歌词/原唱内容。林俊杰普通模式完全相同请求第二次由 repository 返回相同 50 个 ID、`sourceQueryCount=0`；全部 smoke 共用 29/100 calls。全新生产内置浏览器 390×844 点选“江南 KTV / 林俊杰”后只有一个 iframe，参数含 `autoplay=0`、`start=30`、`mute=1`、`enablejsapi=1` 和正确 production origin；真实 current time 为 `30.022` 秒后 loading 才消失，刷新恢复仍为单 iframe，页面无横向 overflow，console 无 error/warning。 |
| 2026-08-01 two-second search UX local | Focused 5 files / 28 tests、full 26 files / 129 tests、typecheck、production build、Wrangler 4.105 Room/Main 双 dry-run 与 `git diff --check` passed；bindings 确认为单次 cold call 与 `YOUTUBE_SEARCH_TIMEOUT_MS="1600"`。全新内置浏览器 390×844 本地房间 `674r4u00` 完成搜索和结果切换，preview 始终只有一个 iframe 且 URL 含 `start=30`、`enablejsapi=1` 和正确 localhost origin；页面 `scrollWidth=clientWidth=390`，console 无 error/warning。Mock video 不作为真实 `PLAYING` 证据。 |
| 2026-08-01 two-second search UX production release | 源码提交 `b5935eb` 已推送 `origin/main`。Wrangler 4.105 按 Room → Main、`--keep-vars` 发布并复核活动流量为 Room `22573249-9b01-41d5-8ced-74f5092e97bd`、Main `15c766a6-508c-4e2d-ae2e-1735fe081d6f`，均为 100%。生产房间 `5l6a0r2m` 的 `陶喆` 歌手非原唱 cold API 搜索 1198ms 返回 12 条目标 KTV/伴奏结果，只用 1 次 `search.list`，Worker provider elapsed 847ms；完全相同请求 291ms 从 repository 返回相同 12 条、`sourceQueryCount=0`。全新生产内置浏览器 390×844：repository 搜索 412ms；cold `张震岳` 1157ms 返回 4 条目标伴奏/KTV，cold `崔健` 1251ms 返回 4 条且 pending 期间仍显示上一批张震岳卡片；`许巍` 没有新结果时仍保留上一批卡片。实际点选陶喆结果后只有一个 iframe，参数含 `autoplay=0`、`start=30`、`mute=1`、`enablejsapi=1` 和正确 production origin；iframe 显示 Pause、app loading/retry 均消失，满足只有 current time 达到 29 秒才完成的 preview guard。页面 `scrollWidth=clientWidth=390`，console 无 error/warning。 |
| 2026-08-01 quota exhaustion clarity production release | 源码提交 `a586698` 已推送 `origin/main`。Wrangler 4.105 按 Room → Main、`--keep-vars` 发布并复核活动流量为 Room `a8d2b811-2d73-48d9-85ef-4cf5a091bfdb`、Main `f693be88-01ca-4ddf-ad62-06feafebe5ed`，均为 100%。生产 quota 维持 `100/100` 的真实耗尽状态；全新内置浏览器 390×844 在 cold miss 空页面持续显示“今日搜索额度已用完”和“本地重置还有 6 小时”，加载已缓存 `林俊杰 / 歌手 / 非原唱` 后显示 10/50 条，再提交未缓存歌手时仍保留相同 50 条结果并显示“当前结果已保留”提示。生产加载新版 `/assets/index-C2rQf336.js`，页面无横向 overflow，console 无 error/warning。 |
| 2026-08-01 zero-quota search guard local | `npm run verify:search` 在真实网络被禁止的环境下通过 9 files / 56 tests，并通过 typecheck；full 28 files / 142 tests、production build、Wrangler 4.105 Room/Main 双 dry-run 与 `git diff --check` passed。全新内置浏览器本地 room `096x1933` 搜索 `后来` 返回 8 条 mock 结果，点选第二条后只有一个 iframe，URL 含 `autoplay=0`、`start=30`、`mute=1`、`enablejsapi=1` 和正确 localhost origin。本轮没有执行 production search/cache smoke，保留真实额度给用户次日上午 2–3 次人工验收。 |
| 2026-08-01 zero-quota search guard production release | 源码提交 `ef2fb17` 已推送 `origin/main`。Wrangler 4.105 先发布 Room，再以 `--keep-vars` 发布 Main；Workers Builds 在首次 Main 手动发布后完成同一 main push 的自动版本，因此又手动发布 Main 一次，最终活动流量为 Room `d7aedc20-6af5-4125-9807-008ea4889a9d`、Main `b3bb7d9d-9db0-4eda-9c77-ba3111587d7a`，均为 100%。Production root 返回 200 并加载本地 build 对应的 `index-CmOH7Wkg.js`。按用户安排，本轮没有请求 production search endpoint（包括 cache-only），也没有执行 cold search；真实搜索与 preview 终验保留到次日上午。 |
| 2026-08-04 search source-of-truth local | 基于 `02f2e42` 逐项复核 search family、provider、scoring、D1/KV、recommendations、quota、router 与 Mobile 状态后新增 `SEARCH.md`。机器契约与源码/config 校验、零网络 focused 9 files / 56 tests、typecheck、full 28 files / 142 tests、production build 和 `git diff --check` passed。没有修改 Worker/frontend runtime，因此本轮不做浏览器或 production deploy/smoke。 |
| 2026-08-23 mobile queue overflow local | Mobile 歌单纵向滚动容器禁止横向 overflow，正在播放与待播卡片对不可断开的超长标题使用任意位置换行，并收紧 flex/card 宽度边界。Full 28 files / 142 tests、typecheck、production build、Wrangler 4.105 Room/Main 双 dry-run 和 `git diff --check` passed。全新内置浏览器在 390×844 的本地房间 `0m2b711n` 加入 100 字符无空格的正在播放与待播标题；document、body 和歌单容器均为 `scrollWidth=clientWidth`，两处标题自身也无横向 overflow。视觉检查通过，console 无 error；仅有 README 已记录的 React Router v7 future-flag warnings。 |
| 2026-08-23 mobile queue overflow production release | 源码提交 `4b5fa3e` 已推送 `origin/main`。Wrangler 4.105 按 Room → Main、`--keep-vars` 发布；push 触发的 Workers Build 在首次 Main 手动发布后生成同源自动版本，因此再次手动发布 Main。最终活动版本为 Room `0c6074c4-8e73-4f83-abd8-81807cac6d4c`、Main `f387d7e0-66d7-4c68-9117-62ecb63a022a`。独立 production WebSocket client 在临时房间 `194u236j` 成功写入两首 100 字符无空格标题并收到 2-item snapshot；生产内置浏览器加载本地 build 对应的 `index-CbPHpDBo.js`，390×844 下 document、body、歌单容器与两处标题均为 `scrollWidth=clientWidth`，歌单容器 `overflow-x=hidden`，视觉检查和 console error/warning 检查通过。该浏览器会话从 display 导航至 mobile 后 WebSocket 未恢复连接，因此本轮不把 mobile realtime UI 连接列为重新验收通过；独立 WebSocket smoke 正常。 |
| 2026-08-23 preserve-50 search redesign local | 基于 `add871e` 实现 ordinary text search 的 structural-only admission、纯 ranking、snippet enrichment fallback、D1/KV preserve-50、algorithm v2、recommendations v3 selective ingestion 与 broader analytics catalog。`npm run verify:search` 13 files / 79 tests、typecheck、full 28 files / 145 tests、production build、Wrangler 4.105 Room/Main `--keep-vars` dry-run 和 `git diff --check` passed；dry-run 的用户级 log 文件因 sandbox EPERM 无法写入，但两个 bundle/bindings summary 均成功。所有 provider fixtures 都是 mocked，未请求 production search endpoint，真实 YouTube `search.list` quota 消耗为 0。 |
| 2026-08-23 preserve-50 search redesign production release | 源码提交 `b6fad28` 已推送 `origin/main`。Wrangler 4.105 按 Room → Main、`--keep-vars` 发布；push 触发的 Workers Build 在首次 Main 手动发布后切换活动版本，因此再次手动发布 Main。最终 100% 活动版本为 Room `97e33d3e-f95f-4f2c-8bd3-aa0998ff3d54`、Main `b900b971-b7ad-4a76-96b7-8dbb32811ad9`。生产临时房间 `124r3q1r` 的 `林俊杰 + artist + original + cacheOnly` 返回新 algorithm family 的安全 miss：`resultCount=0`、`sourceQueryCount=0`、`externalCallAvoided=true`，quota `0 → 0`；这不是 live quality 结论，只证明旧 family 未被当作新版 exact hit 且零额度路径正常。Production root HTTP 200 并加载 `/assets/index-CbPHpDBo.js`。本轮没有执行 cold production search，真实 YouTube `search.list` quota 消耗为 0；真实 provider 数量与前排质量留待用户后续有限人工验收。 |
| 2026-08-23 mobile compact/preview polish local | `npm run verify:search` 13 files / 79 tests、full 28 files / 145 tests、typecheck、production build、Wrangler 4.105 Room/Main `--keep-vars` dry-run 和 `git diff --check` passed；Wrangler 仅有既知的用户级 log EPERM，两个 bundle/bindings summary 都正常退出。全新内置浏览器 390×844：pending 前后结果滚动区坐标恒为 `top=214 / height=531`，8 张旧卡片保持可用且无“最多等待 2 秒”panel；badge 高 26px 并正确跳到 `?tab=queue`，页面无横向 overflow。点选 preview 后只有 1 个 iframe，参数含 `controls=0`、`start=30`、`enablejsapi=1`，iframe 为 `pointer-events:none`、`tabindex=-1`，卡片内没有 app 暂停按钮。自动化环境进入既有 10 秒 slow-load fallback，未把真实 PLAYING 或 YouTube 原生 chrome 淡出虚报为通过；console 只有既知 React Router v7 future-flag warnings。 |
| 2026-08-23 mobile compact/preview polish production release | 源码提交 `d4ade67` 已推送 `origin/main`。Wrangler 4.105 按 Room → Main、`--keep-vars` 发布；push 触发的 Workers Build 在首次 Main 手动发布后生成同源自动版本，因此再次手动发布 Main。最终活动版本为 Room `297b4fb6-6f28-4b56-873a-eaab83332d70`、Main `f14ea2df-e47d-4d7e-8a83-5f6343a06145`，部署列表均显示 100%。Production root HTTP 200 并加载新 bundle `/assets/index-C7R6G3_e.js`；bundle HTTP 200、309,268 bytes。本轮只做页面/assets 只读 smoke，没有调用 production search endpoint，也没有消耗真实 YouTube `search.list` quota；真实设备 preview autoplay 与官方 chrome 淡出仍保留为人工验收项。 |
| 2026-08-24 full-width preview/dense queue local | 生产旧版先复现 active preview 只有 `167×94`，虽达到真实 `30.048s`，但低于 YouTube `200×200` 最低 viewport。新版通过 `npm run verify:search` 13 files / 79 tests、full 28 files / 145 tests、typecheck、production build、Wrangler 4.105 Room/Main `--keep-vars` dry-run 与 `git diff --check`；dry-run 仅有既知用户级 log EPERM，bundle/bindings summary 均成功。全新内置浏览器 390×844 验证 active player 为 `355.5×200`、单 iframe、`autoplay=1`、`start=30`、`cc_load_policy=1`、`controls=0`，无 active selection badge、无横向 overflow。本地 5 个待播 card 均为 86px 且没有“第 N 首”；置顶完整自动化往返约 293ms 后目标已到首位，删歌约 303ms 后 card/header/count 同步从 5 变 4。Console 只有既有 React Router v7 future-flag warnings；mock video 进入 error fallback，因此没有虚报本地真实 PLAYING/字幕。 |
| 2026-08-24 full-width preview/dense queue production release | 源码提交 `58f248e` 已推送 `origin/main`。Wrangler 4.105 按 Room → Main、`--keep-vars` 发布；GitHub Workers Build 随后生成自动 Main 版本，因此再次手动发布。最终 100% 活动版本为 Room `2a4e7ef5-1aca-4890-9e86-094a9d7156e4`、Main `0f070c4d-1017-42ac-9b37-58a79cd455db`。Production root、新 JS `/assets/index-D1oYEM9X.js`（309,183 bytes）和 CSS `/assets/index-zpoI-iHt.css`（44,521 bytes）均 HTTP 200。全新内置浏览器 390×844 的真实 YouTube preview 达到 `30.084s`，单 iframe 为 `355.5×200`，参数含 `autoplay=1`、`start=30`、`cc_load_policy=1`、`controls=0`；实际截图中歌词清晰可见，未出现 app 暂停键/已选中 badge，也无横向 overflow。内置浏览器中的临时生产房间持续显示重连，因此没有把 connected WebSocket 下的生产置顶/删歌速度虚报为通过；本地 UI 自动化与 reducer 路径已覆盖该即时反馈。本轮没有提交 production search，也未消耗真实 YouTube `search.list` quota。 |
| 2026-08-24 preview rollback/queue controls local | `npm run verify:search` 13 files / 79 tests、full 28 files / 145 tests、typecheck、production build 与 `git diff --check` passed。全新内置浏览器 390×844：active preview card 与 sibling 均为 169px 宽，iframe 恢复为约 `167×94`，grid 保持两列且无横向 overflow；5 个待播 card 均高 74px，没有“第 N 首”，每张 card 的置顶/删歌为从左到右排列的两个 `44×44` touch target。截图确认长标题仍可两行显示，操作区没有挤出 card。Local mock video 进入既有 preview error fallback，因此本轮只验证尺寸与布局，没有虚报真实 PLAYING。 |
| 2026-08-24 preview rollback/queue controls production release | 源码提交 `d6b0cd5` 已推送 `origin/main`。Wrangler 4.105 按 Room → Main、`--keep-vars` 发布；GitHub Workers Build 再次在首次手动 Main 发布后生成自动版本，因此再次手动发布。最终 100% 活动版本为 Room `1d8d30e5-6da2-414b-9864-7c416ffd232c`、Main `d2cbf827-2210-4741-aeff-671b9bf643c5`。Production root、新 JS `/assets/index-DNEF8LtP.js`（309,117 bytes）和 CSS `/assets/index-Bgnd4eGg.css`（44,366 bytes）均 HTTP 200。全新内置浏览器 390×844 的真实 YouTube preview 与 sibling 均为 169px 宽，单 iframe 约 `167×94`，达到 `30.07s`，参数仍含 `autoplay=1`、`start=30`、`cc_load_policy=1`、`controls=0`，且无横向 overflow。生产截图确认整行大 preview 已撤回；YouTube 原生角标仍可能出现。本轮没有提交 production search，也未消耗真实 YouTube `search.list` quota。 |
| 2026-08-24 mobile header/toggle and broader recommendations local | Recommendation key `v3 → v4`，每 family 高分头部 `8 → 20`。`npm run verify:search` 13 files / 80 tests、full 28 files / 146 tests、typecheck 和 production build 通过，provider fixtures 全部 mocked，真实 YouTube 调用为 0。按仓库要求启动全新内置浏览器并设为 390×844，但本地 `127.0.0.1` 导航被浏览器安全策略拦截，因此本记录不宣称原唱 toggle、同行房间名或横向 overflow 已完成本地视觉验收。发布与生产验证证据见同日 release record。 |
| 2026-08-24 mobile header/toggle and broader recommendations production release | 源码提交 `ea062a9` 已推送并与 `origin/main` 一致。Wrangler 4.105 按 Room → Main、`--keep-vars` 发布；GitHub Workers Build 在首次手动 Main 后生成自动版本，因此再次手动发布。最终 100% 活动版本为 Room `907ba87f-56c5-43f1-9485-d3a8da33c4b3`、Main `93bdd310-e321-4a4d-b4b6-e676c07e3baf`。Production root、新 JS `/assets/index-mgJqfWE5.js`（309,126 bytes）和 CSS `/assets/index-CnH3rh0C.css`（44,359 bytes）均 HTTP 200；空查询接口返回 20 首、`cached=true`、`sourceQueryCount=0`。全新内置浏览器 390×844 的临时房间实时连接成功：“K歌助手”与“K歌房”分别位于 y=12/19 的同一行，viewport/scroll width 均为 390；原唱由 off→on 时外框 background/border/text 均保持不变，内部轨道 class 从 `bg-slate-600` 切换为 `bg-teal-300`；推荐由 `10/20` 自动展开到 `20/20`，console 无 warning/error。内置浏览器截图命令超时，因此颜色验收依据真实生产 DOM、computed outer style 与已加载 CSS rule，不宣称取得像素截图。本轮没有提交 production cold search，真实 YouTube `search.list` 调用为 0。 |

### Admin console design QA（2026-07-21）

Final result：passed；没有遗留可执行的 P0、P1 或 P2 design finding。必要验收结论保留在本节，原独立 QA 文件已于 2026-08-04 删除。

- Reference：用户选定的第三版深色 dashboard，并按要求进一步精简。
- Desktop：`1440×1024` 同屏比较；深色 tokens、侧栏、状态、双指标卡、趋势图和底部信息层级与参考方向一致。
- Mobile：`390×844`；页面 `scrollWidth=clientWidth=390`，搜索记录和资料库表格只在自身容器横向滚动。
- Interaction：总览、搜索记录、资料库导航与真实资料状态均通过；本轮之前已验证登录、筛选、选择、删除确认和删除。
- Console：最终桌面与移动验收均无 application error 或 warning。

### Real storage metrics design QA（2026-07-25）

Final result：production passed；没有遗留可执行的 P0、P1 或 P2 design finding。Main Worker 只读 token、生产管理员登录和 Cloudflare Dashboard 数值对照均已完成。

- Desktop：`1440×1000`；原有暗色布局和三项导航保持不变，D1、KV 与应用记录估算分层清晰。
- Mobile：`390×844`；`documentScrollWidth === documentClientWidth`，指标卡、筛选和清理预览无页面级横向溢出。
- Failure state：没有 token 时 D1/KV 分别显示安全不可用状态，不生成假体积、容量或百分比；清理执行入口保持关闭。
- Production data：D1 API `278,528 bytes` 与 Dashboard `279 kB` 一致；KV Analytics `1,297,755 bytes / 413 keys` 与 Dashboard `1.3 MB / 413` 一致。Admin 的 `272.0 KB / 1.2 MB` 使用二进制换算。
- Interaction：生产登录、手动刷新、三页导航和清理预览均通过；刷新后按钮恢复可用。
- Console：本地与生产均无 application error 或 warning；关键数值与布局证据保留在本节。

### Fourth-round design QA（2026-07-15）

Final result：passed；没有遗留可执行的 P0、P1 或 P2 design finding，也不需要 post-comparison fix loop。

- Evidence：source attachment `ec1632b2-0153-4df7-baa9-cc17011bb814/image-1.png`；其余 before/after、implementation、full-view 与 QR/footer focused comparison 位于 Codex visualization `019f63d8-8589-75c3-b89a-396facff0868/design-qa/`。关键文件包括 `create-desktop-before-after.png`、`create-mobile-before-after.png`、`create-after-1280x720-pass1.png`、`create-after-390x844-pass1.png`、`mobile-preview-after-390x844.png`、`display-after-2589x1336-final.png`、`display-annotated-before-after-exact.png`、`display-footer-focused-before-after-exact.png` 和 `display-qr-focused-before-after-exact.png`。
- Coverage：create desktop `1280×720`、create/mobile preview `390×844`、annotated display `2589×1336`；覆盖 create ready、mobile 搜索 + 单一 active preview + selected/queued candidates，以及 display current item + zero queued items + hidden YouTube error fallback。
- Typography/layout：create hero 在桌面与手机均保持受控两行标题、稳定中文系统字体 fallback 和清晰字重；桌面无页面滚动，手机无横向 overflow 且 CTA 位于首屏。Display controls、queue count、QR、title 和 progress 分组无碰撞。
- Visual/accessibility：沿用 slate/teal/rose 暗色 tokens；QR wrapper 为暗色，扫描面保持纯黑白。Lucide 图标、清晰 border/focus ring、semantic button/link/heading、带 accessible label 的 slider/QR link，以及至少 `40px` 的 mobile tap target 均通过检查。
- Content/assets：create copy 简短且 task-oriented，不读三步说明也能理解主要结果与 CTA；无需 raster hero/decorative image，app icons 统一使用现有 Lucide family，YouTube source-owned thumbnail/player content 不被 app overlay 遮挡。
- Interaction：create CTA 可进入新房间；mobile search 可返回结果，选择卡片后恰有一个 preview iframe 且 URL 含 `start=30`；两首点歌后 restart 保持当前 item，next 推进第二首并将 progress 保持为 `0`。Display 恰有 replay、play/pause-resume、next 三个 player actions，无 quality selector。
- Console：无 application error；仅有既存 React Router v7 future-flag warning。P3 follow-up 是在未来 dependency upgrade 时 opt in 或消除这些 warning。
- Limitation：自动化环境的 YouTube 视频返回 error 150，app 的 error iframe fallback 正确隐藏；因此比较聚焦 QR、footer、progress、quality 和 control surfaces，真实设备 autoplay/playsinline/pause-resume 仍按下方清单验收。

Current coverage：

- `[x]` Query normalization、room ids、reducer rules。
- `[x]` Room commands、WebSocket validation/runtime。
- `[x]` KV keys/family/recommendations/size policy。
- `[x]` Search family、ranking、rate limit、YouTube parsing。
- `[x]` 搜索框 YouTube 单视频 URL 隐形兜底；普通文字算法不变，其他 URL 不发 search request。
- `[x]` Pacific quota reset、本地时区显示、restart player state。
- `[x]` Display item-key progress isolation、0-second next；Mobile dedicated 30-second preview URL。
- `[ ]` Main Worker route integration。
- `[ ]` DO storage/alarm integration。
- `[ ]` Playwright E2E。

### Production checkpoints

| Date | Result |
| --- | --- |
| 2026-06-25 | Create/snapshot、D1、JOIN/PING、multi-client、queue commands、real search/cache verified。 |
| 2026-06-26 | Main `369207c2-9359-4b4d-914c-937c4e0f4729`；Room `0df7e1b2-7a47-4ab5-a14f-b38d90b09e9e`。 |
| 2026-07-02 | Main `628c4f22-35e0-481b-8ef4-4be952fc644f`；Room `e893a72f-b718-43a7-adc8-60bd63c6444c`。 |
| 2026-07-03 pass 1 | Main `036c62e4-0999-4cf1-a034-083664f2e97e`；Room `fd9accc1-1c03-42d0-a200-2790d1febf0a`。 |
| 2026-07-03 pass 2 | Main `b3a43603-2208-4a4e-816c-72212d8de3d2`；Room unchanged。 |
| 2026-07-13 pass 3 | Main `e7fc338f-11ff-42b9-9523-df64de2a06c6`；Room `92c36603-e923-4665-b334-d10cadd28f78`。 |
| 2026-07-14 pass 4 | Main `ce2a851c-9f79-4fd3-ac70-337219ccbc13`；Room unchanged。 |
| 2026-07-15 pass 5 | Main `bd5c8ece-23f3-4abe-97d4-fad3891a0fc1`；Room `9ec6503c-07cb-4a7c-8ff0-4236ab934e19`。 |
| 2026-07-15 pass 5 follow-up | Main active deployment `c942af48-74f2-44c7-bf2d-17f35ae734ef`；Room active deployment `362b4d10-476e-47da-bb10-cf3c10716ca9`。 |
| 2026-07-21 pass 6 release | Main `aa2aa657-62a2-4b8d-93ec-d7ca508dab25`；Room `dc38a381-b95c-4cc7-914a-91f8fc952ec0`。 |
| 2026-07-22 admin production release | Main `23be9233-b48a-4b1d-b788-236e3851c9f7`（100%）；Room `a3458d1b-f30b-4ba4-b4d6-07eb9f230b54`（100%）。 |
| 2026-07-25 real storage metrics release | Main `ba476a0f-0583-431b-ba68-9d1b43d33c52`（100%）；Room `8ee39e12-4618-4948-81d0-f753158a4046`（100%）。 |
| 2026-07-26 storage token acceptance | Main Secret-change version `45fc80db-0a8c-4037-a51c-18b003b618d6`（100%）；Room unchanged。 |
| 2026-07-29 exact-query rollback release | Main `8326d942-3a08-4253-84c5-eee8c696442a`（100%）；Room `8317ea66-8de7-4177-80ad-bed8622ece20`（100%）。 |
| 2026-07-29 song-only same-text cache release | Main `ae0f1f0e-1c4c-4672-a1ef-667cdff1b644`（100%）；Room `4d1dfa72-9a84-48b8-9a1e-538075dc0108`（100%）。 |
| 2026-07-29 mobile preview playback restoration release | Main `1777984c-d2e9-4ed1-9891-93136c86ab18`（100%）；Room `fe4cf8b8-bdcb-4bcd-8837-0a7e8e1dccad`（100%）。 |
| 2026-07-31 YouTube direct URL fallback release | 源码 `e007236` 已推送；Main `860a101e-a1e4-4d89-b884-f48d64595972`（100%）；Room `bf78c9d5-09e8-4a06-a62b-f9e455a1bc2b`（100%）。 |

Last local pass-4 smoke room `3r512238`：create CTA、mock search、单 iframe preview `start=30`、两首点歌、restart 保持当前 item、next 推进第二首且 progress value 为 `0`。Create 已确认 390×844 无横向 overflow、1280×720 无页面滚动；Display 已确认 dark 140px QR、无画质 selector、三键 panel。

Production pass-4 smoke room `362x7342`：fresh D1 room 创建成功、WebSocket `实时已连接`、quota 50/50、QR Canvas 140px、画质 selector count 0、无 console error。

Production pass-5 smoke room `113f4j5h`：production root HTTP 200；create API 与 snapshot room id 一致，D1 display name 为“这台 Windows 电脑的 K 歌房”；线上 CSS 包含 `create-room-gradient`；quota endpoint 正常返回剩余 49。

Production pass-5 follow-up smoke room `3n2j6g1j`：root、display、mobile 均 HTTP 200；create response 与 D1 snapshot display name 均为中性“K歌房”；HTML `theme-color=#020617`，线上 CSS 包含 `app-no-select` 和 dark scrollbar；空查询返回 10 条 cached recommendations，quota 48/50。WebSocket `ADD_QUEUE_ITEM` 后 snapshot current video 为 `OKjmFVeIG8s`；远端 KV 首位先确认同一 video，公开 recommendation API 在最终一致性传播后也返回同一首，证明 queued-song promotion 已上线。

Production pass-6 smoke room `4a1d0n6a`：root、display、mobile 均 HTTP 200，create response 与 snapshot room id 一致。UTF-8 `年少有为` 歌名搜索在 KTV/原唱 intent 各返回 5 条相关结果并共享 5 个 video id，两次均命中同一 cache 且 quota 保持 98/100；`童话 光良` live fill 返回 25 条后，KTV/原唱重复搜索均 `cached=true`、共享 25 个 id，quota 保持 96/100。WebSocket 收到 `ROOM_SNAPSHOT`、`PONG` 和 cold fill 后的 `YOUTUBE_QUOTA_UPDATED`；quota endpoint 确认 daily limit 100。

Production admin release API smoke room `1q6s3n4v`：root 与 `/admin` 均 HTTP 200；未认证 `/api/admin/overview` 返回 401 与 `Cache-Control: no-store`；room snapshot 为 empty queue / idle。UTF-8 `青花瓷 + 周杰伦` 首次由 external 返回 10 条，第二次 `cached=true`、`responseSource=repository`，quota 保持不变。一次错误编码的 smoke 请求产生的 4 条乱码事件、1 条 repository 记录、对应 family/index KV 与 recommendations 聚合已精确清除，复核垃圾事件与资料行均为 0，空查询仍返回 10 条 recommendations 且无 external call。内置浏览器另从 create CTA 创建 room `3q240558` 并进入 display；登录页与 display 均无横向 overflow 或 console error/warning。由于生产密码未提供给 Codex，未代替管理员提交登录表单。

Production storage metrics acceptance：管理员已自行登录，Codex 未读取密码。强制刷新后 D1 与 KV 系统提醒均为正常；服务端状态表记录 `cloudflare-d1-api` 的 `278,528 bytes` 与 `cloudflare-analytics` 的 `1,297,755 bytes / 413 keys`，`last_error_code` 均为空。Dashboard 同刻显示 D1 `279 kB / 12 tables`、KV `1.3 MB / 413`；生产页面 `scrollWidth=clientWidth=2036`，console 为空。

Production cross-query catalog smoke room `5r652e0d`：quota `0 → 1 → 1 → 1`。`暖暖 + 梁静茹` cold search 为 `external`，取得 50 个 embeddable candidates、过滤后返回 44 条并新增 50 个独立目录视频；相同查询由 exact repository 返回 44 条；移除 artist 的新查询由跨查询目录返回 43 条，`catalogResultCount=43`、`externalCallAvoided=true`、`sourceQueryCount=0`。Production D1 只读复核为目录 50 条、appearance 50、FTS5 `暖暖` 命中 43 条，三条 `search_events` 的候选/过滤/目录/额度列与 API metadata 一致。Production `AdminPage-BQ8ZOyC6.js` 与本地 production build SHA-256 完全一致，且包含“候选目录与额度效率”面板；生产管理员密码未提供给 Codex，因此没有代替管理员登录查看受保护总览。

Production exact-query rollback smoke room `5o3m3t27`：quota `0 → 3`。`后来 + 刘若英`（song、无原唱）冷查询由 external 返回 26 条，完全相同查询由 repository 返回 26 条且 `sourceQueryCount=0`；只改原唱 flag 后重新由 external 返回 26 条；文字改为 `后来 KTV` 后也重新由 external 返回 26 条，再次完全相同请求则由 repository 返回 26 条且不增加额度。D1 只读复核为三个独立 repository identity，两个 exact repeat 的 `access_count=1`；五条事件均为 `catalogResultCount=0`，来源顺序为 external / repository / external / external / repository。Production migration 0006 后候选基础表保留 247 条，FTS5 与 triggers 不存在；`AdminPage-Cb4kbW9h.js` 与本地 production build SHA-256 完全一致，包含新精确复用文案且不含旧 10 条门槛或在线跨查询文案。

Production song-only same-text cache smoke room `326t192b`：quota `6 → 7`。`甜甜的 + 周杰伦` song/无原唱冷查询由 external 返回 28 条；全部结果均为 YouTube Music category 10、duration 大于 0 且严格小于 420 秒。保持完整文字与 artist 不变，只改为 artist/原唱后由 repository 返回同样 28 条，`servedFromExpandedCache=true`、`externalCallAvoided=true`、`sourceQueryCount=0`，没有第二次 external call。Production D1 两条事件复核为 external `49 candidates → 28 filtered / 1 call / avoided=0` 与 repository `28 results / 0 call / avoided=1`。Production root/admin 为 200，未认证 overview 为 401 + `Cache-Control: no-store`；内置浏览器 390×844 显示实时已连接与 10/28 条缓存推荐，页面 `scrollWidth=clientWidth=390`，console 无 error/warning。

Production mobile preview playback restoration smoke room `326t192b`：生产页面加载新 asset `index-Bj8oiKxj.js`；点选“凡人歌 - 李宗盛”结果后只存在一个 YouTube Player iframe，URL 参数为 `autoplay=0`、`enablejsapi=1`、`start=30`、`playsinline=1` 和 production origin。组件只有收到 `PLAYING` 才把 loading 改为 loaded；本次 spinner 确实消失、player 可见，证明显式 mute/load/seek/play 流程已进入生产播放状态。390×844 下 `scrollWidth=clientWidth=390`，console 无 error/warning。真实手机字幕清晰度和移动端浏览器差异仍由周末内测验收。

Local YouTube URL fallback verification：25 files / 122 tests、typecheck、production build、Room/Main Wrangler dry-run 与 `git diff --check` 通过。内置浏览器 fresh session 在 390×844 下粘贴 `youtu.be` 单视频 URL 后只显示 1 张结果卡，点击后 iframe 指向同一 video ID 且含 `start=30`、`mute=1`、`playsinline=1`，点歌 toast 成功并标记“已在歌单”；改贴 `example.com` URL 返回 0/0 与空状态。页面 `scrollWidth=clientWidth=390`，console 无 error/warning。本地未配置 YouTube key，因此卡片使用故障兜底标题；真实 metadata 留待 production smoke。

Production YouTube direct URL fallback smoke room `3y1e002u`：production root/admin 均 HTTP 200，线上 bundle 为本地 production build 的 `index-CMvPwRfc.js`。API 与全新内置浏览器均确认 `youtu.be/dQw4w9WgXcQ` 只返回真实 metadata 卡片“Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)”，`queryMode=youtube-url`、`sourceQueryCount=0`、`videosListCalls=1`；`example.com` 返回 `queryMode=blocked-url`、0 results、0 videos calls。390×844 preview iframe 指向同一 video id，含 `start=30`、`mute=1`、`playsinline=1` 且无横向 overflow；点歌 toast 成功、卡片标记“已在歌单”，snapshot 确认 current video 为 `dQw4w9WgXcQ`。全过程 project search quota 保持 `0/100`，最终 fresh page console 无 error/warning。

Known limitation：本轮已在本地与生产内置浏览器完成 responsive smoke，但仍不替代真实设备 autoplay/playsinline/pause-resume QA。YouTube 原生 title/avatar/branding 可能按官方策略出现，app 不遮挡或伪装。

## 5. Remaining work

### P0 — Pass 12 production acceptance

- `[x]` 完成 exact-only versioned cache、最多 12 轮翻页/多 intent 质量补量和 30 秒真实 current-time gate 实现。
- `[x]` 完成 focused/full tests、typecheck、production build、双 Worker dry-run bundle/binding 检查和 `git diff --check`。
- `[x]` 在全新内置浏览器完成本地 390×844 移动端交互 smoke，并明确不把 mock video 当作真实播放证据。
- `[x]` Commit/push 私有源码到 `origin/main`；生产 smoke 发现的 D1 根因修复也另行提交并推送。
- `[x]` 按 Room → Main、`--keep-vars` 发布并复核两个最终活动版本为 100%。
- `[x]` 生产冷查询逐项确认 `林俊杰`、`周杰伦`、`邓紫棋` 的歌手普通/原唱六组均为 50/50；完全相同林俊杰普通请求再次返回相同 ID 顺序且 `sourceQueryCount=0`。
- `[x]` 生产真实 preview 确认唯一 iframe、自动静音播放，loading 只在 IFrame API 实际记录 `30.022` 秒后结束。

### P0 — Admin baseline release

- `[x]` 完成 1440×1024 reference/implementation 同屏视觉对照并关闭 P0/P1/P2 finding。
- `[x]` 完成 390×844 管理台 responsive browser smoke。
- `[x]` 完整 typecheck、test、production build、双 Worker dry-run 和 `git diff --check`。
- `[x]` 确认 production admin secrets、应用 D1 migration，按 Room → Main `--keep-vars` 发布。
- `[x]` 验证 production 未认证保护、登录页、create → display、中文搜索与 repository 复用，并记录真实版本 ID。
- `[x]` 管理员本人使用独立持有的密码完成登录后真实总览/资料库终验；Codex 未读取或请求该密码。

### P0 — Real Cloudflare storage metrics release

- `[x]` 完成官方 D1 `file_size`、KV Analytics bytes/key count、缓存/lease/stale fallback 和清理保护实现。
- `[x]` 完成本地 migration 0004、21 files / 88 tests、typecheck、production build、双 Worker dry-run 和响应式浏览器 QA。
- `[x]` 应用 production migration 0004，并确认无待应用 migration、两个新表均存在。
- `[x]` 按 Room → Main `--keep-vars` 发布并复核两个新版本均为 100% active；production root/admin 与未认证 storage smoke 通过。
- `[x]` 为 Main Worker 配置 `CLOUDFLARE_API_TOKEN`，只授予 D1 Read 与 Account Analytics Read。
- `[x]` 配置 token 后由管理员登录生产页面，并把 D1/KV 数值与同刻 Cloudflare Dashboard 对照。

### P0 — Real-device acceptance

- `[ ]` Mobile Safari：QR、sticky UI、preview、playsinline、queue。
- `[ ]` Android Chrome：search/load-more、preview、sync/reconnect。
- `[ ]` iPad Safari：orientation、layout、iframe。
- `[ ]` Desktop Chrome：autoplay、restart、pause/resume、seek、auto-advance。
- `[ ]` Two real mobile clients concurrent queue operations。

每个平台至少：fresh room、点两首歌、display sync、restart、pause/resume、manual next、natural end、debug snapshot。

### P1 — Tests and preview robustness

- `[ ]` Router request/response integration tests。
- `[ ]` DO storage、alarm、socket count、D1 recovery tests。
- `[ ]` Playwright create → search → queue → display flow。
- `[ ]` Injected-clock inactivity test。
- `[ ]` 真实 YouTube iframe unavailable/slow-load UX 验收。
- `[ ]` Mobile autoplay/playsinline guidance。

### P2 — Search evolution

- `[ ]` Observe family hits、payload size、age、quota drift。
- `[ ]` Decide exact-query vs song-family vs artist-catalog boundary。
- `[ ]` Curated Chinese/pinyin/English aliases and typos。
- `[ ]` Optional cache inspection/prewarm tooling。
- `[ ]` Real KV cost-based eviction。
- `[x]` Preserve-50 ranking-first exact search；production 固定一次 `search.list`，不翻页、不换 alias，结构可用 candidates 通常完整保留。
- `[ ]` 自动搜索/自动补库：在明确触发、quota budget、去重、审计和停止策略后再设计实施。
- `[x]` 资料库清理预览和保留策略；不会按估算容量静默删除。
- `[ ]` 无人值守自动清理：只有在长期观察手动批次、D1 容量延迟与保留质量后，才考虑单独启用。
- `[ ]` 并发 exact miss 请求合并，进一步减少相同查询同时触发外部 API 的机会。

### P3 — Tooling

- `[ ]` Evaluate ESLint/Prettier。
- `[ ]` 在未来 dependency upgrade 时 opt into 或消除 React Router v7 future-flag warnings。
- `[x]` Main 已连接 Workers Builds；main push 会自动部署，日常本地开发不自动 push，发布仍需验证 Room → Main 的最终版本。

## 6. Documentation rules

- README explains the product, overall architecture, operation, deployment, and general testing。
- SEARCH is the only current source of truth for search, cache, ranking, quota, and search change protocol。
- PROGRESS records what is complete, verified, pending, and historically released；历史 pass 不覆盖 SEARCH 的当前契约。
- 不再为小修改创建新的 Markdown logs。
- 新修复更新现有 phase/table，不追加互相矛盾的 update notes。
- Production version 只在真实 deploy 后更新。
- Test counts 只在完整 suite 实际运行后更新。
- Pure docs changes do not redeploy。
## 中英文界面 localization（已发布，生产验证通过）— 2026-10-23

- 正式发布：功能提交 `e9be953` 已推送 `origin/codex/search-relevance-ranking` 和 `origin/main`。依次以 `--keep-vars` 部署 Room `0451181f-4335-4a6e-a331-c51bde444ed4`、Main `fe4736fa-bb3f-4949-89c9-980973e06c2f`。Main Workers Builds 随后成功完成（GitHub check run `120772889447`，对应同一功能提交），最终活动 Main 为 `520a205e-1918-4808-b2aa-4310d7805c9c`，100% 流量；Room 同样 100%。Dashboard 管理变量和 secrets 保留，未做迁移。生产实际 JS 为 `/assets/index-D5VrmbNK.js`，与本地正式构建一致。
- 生产验收：初次 cacheOnly 在房间 `0e0k0s2b` 搜索“耍赖”，缓存命中 50 条，quota used `8 → 8`。新建内置 @Browser 验证首页英语、中英切换及刷新保留、引言居中（中文中心偏差 0px）、真实房间 `1h4j6i5v` 创建成功，Display 和 Mobile 均 Connected，同浏览器手机切换可同步大屏；两页 console error 均为空。没有冷搜索、点歌或视频播放。最终自动构建版本在新房间再次 cacheOnly 命中 50 条，quota used 仍为 `8 → 8`；截图 `.wrangler/localization-preview/production-home.png`。

- 用户完成引言居中预览验收并明确授权 push and deploy。发布前全量 `npm test` 30 files / 208 tests、`npm run verify:search` 13 files / 110 tests（含 typecheck、禁止真实网络）、`npm run build`、`git diff --check` 均通过。发布结果见下方正式记录。

- 创建页顶部引言改为独立居中：桌面三列布局左右等宽，中英文引言中心与 header 中心一致（内置 @Browser DOM 实测误差小于 0.01px）；640px 中等屏幕独立一行居中，375px 手机保留隐藏引言，无重叠。只调整 header 样式，未修改文案或行为。当前预览 `http://127.0.0.1:5185/create`；临时视口检查页已删除，截图保存在 `.wrangler/localization-preview/create-centered-quote.png`。`git diff --check` 通过，纯布局未重跑测试或构建；该布局随后通过用户验收并上线。

- 根据用户英文截图调整：统一英文品牌 `KTV Assistant` 和页面 title；移除手机页房间名，只改变展示、不改变房间数据。英文顶栏采用歌单图标 + 数字与连接图标（保留完整 aria-label / title），搜索栏采用 `Song` / `Artist` / `Vocals` 短标签并保持单行；原唱控件行为不变。移除之前强制英文顶栏和原唱开关换行的规则。首页重写为 `Your room. / Your stage.`、`Let your voice run wild.`，空播放状态为 `Ready when you are`；手机首页按钮说明移至按钮下方，768–1023px 英文首页用单列避免卡片挤压。中文主体文案保留。新建内置 @Browser、同源 iframe 实测点歌页 320 / 375 / 430px 和首页 375 / 768px，顶部/搜索栏均保持单行，无控件重叠。`npm test -- src/i18n` 2 files / 32 tests、`npm run typecheck` 通过。当前正常预览 `http://127.0.0.1:5184/create`，本地验证使用 Vite mock 模式，随后通过用户验收并上线。

- 创建房间、大屏、手机点歌、Admin（含登录、总览、搜索记录、资料库）和调试页接入中英文翻译。首次使用按 `navigator.language` 的 `zh` 变体选择简体中文，其他语言为英文；右上角无边框 `中 / EN` 支持 hover 阴影和键盘 focus。
- 手动偏好仅保存在当前同源浏览器的 `karaoke-assistant:language`，同配置标签页通过 storage event 同步；不同设备/浏览器配置互不影响。不修改房间 snapshot、WebSocket、用户歌曲/频道/自定义房间名、搜索请求、YouTube 查询语言、缓存键与版本。禁用存储时降级为当前页内存偏好。
- 现有文案集中到 `src/i18n/en.json`；动态 toast、播放器错误、确认弹窗、partial search 与 quota 倒计时随语言切换更新。英文搜索栏根据文案长度适配宽屏和窄屏。
- 独立 localization 审查后，仅按用户要求修复第三项：Debug 刷新与清理 catch 保存原始错误/中文 fallback，在渲染时翻译，避免英文错误状态切回中文后仍保留英文。使用临时 Vite 插件令这两个 API reject 非 Error 值，在新建内置 @Browser 中验证了刷新错误英文 → 中文 → 英文及清理错误英文 → 中文，均即时更新。`npm test -- src/i18n` 2 files / 32 tests 通过；`npm run typecheck` 与 `git diff --check` 通过。其他两项审查发现未在本次修改中处理；该修复随后通过用户验收并纳入本次发布。此次正常预览实际端口为 `http://127.0.0.1:5183/create`，错误分支 mock 验证页为 `http://127.0.0.1:5182/room/3f1e3t3t/debug`，两者因端口不同而分别保存语言偏好；mock 配置及截图均位于忽略目录 `.wrangler/localization-preview/`，未改生产 API。
- 聚焦测试：`npm test -- src/i18n src/lib/quotaReset.test.ts src/lib/searchExperience.test.ts` 4 files / 41 tests 通过，覆盖中文地区变体、非中文默认、手动优先、刷新保留、storage 同步/清除、独立 profile 隔离、存储禁用、插值与翻译 key 完整性。`npm run verify:search` 13 files / 110 tests、typecheck 均通过，强制无真实网络；最终 `npm run build` 与 `git diff --check` 通过。
- 新建 Codex 内置 @Browser 会话实测：首页自动英文、手动切换与刷新保留；同浏览器手机页切换后大屏同步；搜索草稿和选中卡片保持；空歌单、URL placeholder、无效 URL 提示即时双语切换；Admin 登录页和调试页均可切换。用临时同源 iframe 实测 320px / 390px 手机视口，英文控件不重叠；临时验证页已删除。最终首页和手机页 console error 均为空，只有已有 React Router future flag warnings。截图保存于忽略目录 `.wrangler/localization-preview/`。
- 预览服务运行于 `http://127.0.0.1:5181/create`，手机页为 `http://127.0.0.1:5181/room/3f1e3t3t/mobile`。Vite 源码热更新，无需 rebuild；关闭运行终端会停止服务。这是无 Worker 的本地 mock 模式，未验证真实 D1/KV/DO、真实播放、Admin 认证后的 live 数据；独立 profile 隔离由自动测试验证，未操作个人 Chrome。上述本地阶段未执行发布；正式 commit、push、部署和生产 smoke 见本节正式记录。
# Phase 1 公开网站基础设施（本地实现完成，用户审阅中，未发布）— 2026-10-28

- 用户指定以 Phase 1 为长期目标，先完成页面和架构，运营者与联系信息之后补齐；完整范围见 `docs/PHASE_1.md`。
- 新增中英文产品首页 `/`，不再自动跳至创建页；保留 `/create`、现有扫码与播放路由。新增 `/setup`、`/privacy`、`/terms` 和相互导航。静态公开页不请求搜索或加载播放器。
- 设备指南包含电脑起步、电视、音频连接、兼容性、延迟和啸叫；没有虚构推荐型号、联盟身份或购买链接。隐私与条款明确草稿、联系方式及数据请求流程待补。
- 运营者/邮箱配置集中在 `src/content/publicPages.ts`，用户可后续提供。已补实际本地空房间截图；尚待设备实测内容、正式政策信息及隐私同意机制、完整验收；不标记整个 Phase 1 完成。
- typecheck、build 通过；翻译覆盖 1 文件/11 项通过。受限环境 Vitest/Vite 首次因 Windows realpath EPERM 失败，在获准的非沙箱执行后通过/正常启动。未运行全量测试、搜索专项或真实 Worker 验证，因为本轮只改公开静态页面与路由。
- 新建内置 @Browser 实际打开首页，导航至设备指南、隐私与条款，验证英文及中文切换；390px 窄屏首页及条款无横向溢出，刷新保留中文；首页创建链接实际打开原 `/create` 页，未触发创建 API。控制台无 error，有两条 React Router v7 future-flag warning。其他视口与完整路由交互仍需继续检查。
- 后续补齐共享页脚：产品首页、设备指南、政策与创建页均可返回产品介绍、访问设备指南/隐私/条款。提供真实邮箱后会统一出现 mailto 联系入口；空配置不生成虚假地址。创建页正文及创建逻辑未改。typecheck 与 diff check 通过；全新内置 @Browser 验证中英页脚、创建页到设备指南链接，390px 无横向溢出。
- 首页新增实际手机队列页和大屏空房间截图，素材位于 `public/product/`，总计约 54KB；明确标注英文界面、本地空房间以及截图二维码不可用于正式加入。未播放视频或调用真实搜索；手机截图使用空队列，未采用 mock 搜索卡片。内置浏览器确认两张图片成功加载、自然尺寸 1265×712 与 390×844，中英文说明切换及窄屏纵向排列正常。typecheck 与翻译覆盖 11 项通过。
- 直接扫码入口现可查看政策：手机顶部品牌按钮、大屏顶部 About 打开原生 dialog；产品介绍、指南、隐私、条款及 YouTube 条款另开页面，不导航走当前房间。弹窗不占播放器或底栏空间，不强制接受草稿。浏览器实测中文/英文、打开/关闭与 Escape、关闭后焦点返回入口、隐私另开页且房间 URL 保留；没有真实播放或 Worker 同步验证。最终 build、typecheck（build 内含）、翻译覆盖 13 项通过；diff check 通过。
- 公开长页导航修复：实测隐私底部切到条款后标题 top=-527.87px（仍在旧滚动位置）。App 仅在 `/`、`/create`、`/setup`、`/privacy`、`/terms` 的 pathname 变化时归顶，未改房间查询参数/滚动逻辑。内置浏览器复测条款→隐私 `scrollY=0`、标题在可视区；typecheck 和 diff check 通过。Phase 1 验收证据与用户后补信息列在 `docs/PHASE_1.md`，未宣称整体完成。
- 本轮 Vite 服务地址 `http://127.0.0.1:5173/`。未提交、推送或部署，保留既有未提交播放器改动。

- 2026-10-28 用户补充运营者姓名与联系邮箱，已填入 publicSiteDetails，政策与页脚联系入口复用该配置。移除“运营资料尚未提供”的过时草稿说明，仍保留数据处理规则和条款待确认状态。仅本地修改，未发布。

- 用户更正公开资料授权：不公开法定姓名，允许公开邮箱。前端配置已改为 KTV Assistant，并补充个人项目、Ontario/Canada、YouTube 可用地区、通常三天内回复（非办结时限）。设备实测暂缓；数据保存/删除方案授权工程侧完善。未发布。

- 本轮验证：typecheck、build（移除法定姓名后的版本）、diff check 通过；后续仅补充双语数据请求说明后 typecheck 与内置浏览器中英文检查通过。`src`、`public`、已生成 `dist` 未检出先前法定姓名。新 Vite 服务实际为 `http://127.0.0.1:5174/privacy`（5173 占用）；未发布。房间无活动清理、KV 一年 TTL、quota 三天 TTL、admin 会话十二小时已从源码核对；搜索事件/D1 资料无统一自动期限，不能当作已完成的留存策略。

- Phase 1 数据维护（本地，未发布）：新增 dataRetention scheduled handler，仅 Main 配置 hourly cron；搜索/播放事件30天、停用未更新房间30天、审计/日配额90天，分批执行，活跃房间/共享缓存保留。0007只添加索引。隔离本地数据库应用7个迁移并写入测试fixture；通过4.105实际 `/cdn-cgi/handler/scheduled` 触发，日志 deletedRows=[1,0,0,0,1,1,0,0]，SQL复查旧事件/停用房间移除、新事件/活跃房间/共享资料保留。创建真实本地房间6d235q15显示Connected，无冷搜索或播放。
- 维护验证：内存SQLite真实迁移4项 + 翻译13项，共2文件17项通过；verify:search 14文件167项且禁止真实网络；typecheck、build与diff check通过。Node22 SQLite有experimental warning；无新增依赖。Wrangler asset watcher在build后明确报EPERM并禁用，重启同一隔离服务后privacy页面成功显示新规则。预览 http://127.0.0.1:8797/privacy 运行中，Main/Room本地绑定、空key，状态目录.wrangler/phase1-retention/state。未动生产数据/迁移/配置，隐私同意与请求操作流程仍待完成。

- Phase1收尾：新增版本化PrivacyConsent边界，覆盖create/mobile/display/debug/Admin，公开内容不受阻。受保护组件确认前不挂载；确认记录只保留version/acceptedAt；存储失败降级页面内存；withdraw清除确认、卸载页面并关闭WS，跨tab通过storage同步。补隐私存储披露及docs/PRIVACY_REQUESTS.md操作说明。
- Gate验证：Vite直接queue链接默认未勾选/disabled，继续后保留tab，刷新恢复，withdraw后重新提示且刷新仍未勾选；真实本地Worker确认前无API/WS日志，确认后Connected，撤回后snapshot连接数0。修复大屏dialog内Space被播放快捷键拦截，实际Close按钮Space成功。测试仅针对未发布的本地草稿，无线上账户协议操作。
- 最终完整npm test：34文件279项通过（SQLite有experimental warning）；gate/translation/socket专项4文件20项通过；最终build（含typecheck）、diff check通过。搜索专项此前167项且禁真实网络。Phase1逐项验收见docs/PHASE_1.md，本地实现完成，未提交/推送/部署；用户自用设备型号照片明确暂缓，后续平台审核/广告不计为本轮缺口。

- 最终窄屏验收：内置浏览器viewport覆盖未改变实际1280px页面，未将其冒充390px通过。改用临时同源390×844 iframe检查；中文client/scroll均390px，英文有纵向滚动条时client/scroll均375px，无横向溢出；拒绝链接实际返回公开首页。临时public验证页已移除、测试tab已关闭。确认页截图.wrangler/phase1-preview/consent-final.jpg，用户预览 http://127.0.0.1:8797/create ，服务仍在运行。

## 用户审阅后的公开页面 UI 调整（本地完成，待审阅）

- 统一SiteBrand/SiteHeader，首页、创建页、政策/指南及确认页品牌使用本地中文书写体子集（3848字节、许可保留）和英文衬线斜体；字体随站点加载。创建页品牌返回首页。
- 入口文案“准备开唱 / Get started”，实际创建按钮“准备好了 / Ready to sing”；保留加载态、渐变/光效与房间逻辑，说明图标改MonitorPlay，手机上下排列防止竖排。
- 首页使用居中hero、渐变底色、分区留白和卡片；共享导航/语言/页脚hover边框视觉、阴影及focus效果，页脚主页入口改“产品介绍”。联系区卡片化，去除正文底部创建/重复条款按钮；Google隐私链接融入正文，内容页顶部不再重复设备指南入口。未修改播放器底栏。
- 验证：typecheck、2文件17项测试、diff check通过；内置Browser中英桌面与320/390px容器检查无横向溢出，说明正常横排。320px英文品牌最初换成两行，已缩小对应宽度字号并测得单行20.22px，和语言按钮无重叠。页脚hover实测shadow非none；首页与创建页英文品牌font/size/color相同；创建页品牌点击实际回首页；政策页面/create、Google和YouTube链接各只保留1处，console error为空。
- 临时public测试页和测试tab已移除；截图.wrangler/ui-polish/home-zh.jpg与create-zh.jpg。当前Vite http://127.0.0.1:5174/ 运行中，前端热更新；没有运行生产部署、提交或推送。此轮纯UI未重复后端/搜索测试或重建dist。

## 第二轮公开页面修正（2026-10-29，本地完成）
- 入口改“准备开唱 / Ready to Sing”，创建按钮“创建房间 / Start a Room”；英文导航标题大小写统一。页脚居中、hover去边框保留柔和阴影，顶部padding增至6px 10px。YouTube条款新标签页打开。
- 英文品牌换本地Courgette字体子集（5940字节、附许可），中文K独立放大加宽。README与Phase1记录同步。
- typecheck及2文件17项专项测试通过；测试首次受沙箱realpath EPERM阻止，受限环境外重跑通过。内置Browser核对双语按钮、外链新tab保留原页、页脚居中与hover无inset边框、顶部padding；320/390px双语创建页无横向溢出、品牌和语言按钮无重叠，console error为空。临时测试页和标签页已清理。
- Vite预览 http://127.0.0.1:5174/ 运行中，支持热更新；截图.wrangler/ui-refine/home-en.jpg。未提交、推送或发布。
