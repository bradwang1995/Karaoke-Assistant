// Populate with operator-approved public details before release. Never invent contact information.
export const publicSiteDetails: { operatorName: string; contactEmail: string } = {
  operatorName: "KTV Assistant",
  contactEmail: "bradwang9999@hotmail.com",
};

type Copy = { title: string; intro: string; sections: { title: string; paragraphs: string[] }[] };
export const publicPages: Record<"setup" | "privacy" | "terms", Record<"zh" | "en", Copy>> = {
  setup: {
    zh: {
      title: "家庭 KTV 设备指南",
      intro: "先用已有设备体验，再决定购买什么。K歌助手管理点歌和播放，不会把手机变成麦克风，也不会自动混合人声与伴奏。",
      sections: [
        { title: "1. 电脑与手机：先试唱", paragraphs: ["在电脑浏览器创建房间，使用电脑扬声器播放。朋友扫描二维码，用自己的手机搜索和安排歌单。无需先购买专用 KTV 主机。", "先确认浏览器可以播放所选视频，手机能打开房间链接。部分视频会限制嵌入播放；换一条可播放的视频再测试。"] },
        { title: "2. 电视或投影：扩大画面", paragraphs: ["用 HDMI 把电脑连接到电视或投影，选择正确的输入源，并确认电脑的音频输出设备。连接电视不会自动连接麦克风。", "购买转接器前确认电脑、电视和音箱的接口。HDMI、光纤和模拟音频不能直接互换；某些连接需要主动转换设备。"] },
        { title: "3. 麦克风、混音器与音箱", paragraphs: ["典型连接：麦克风或无线接收器 → 兼容的混音器麦克风输入；电脑或电视音频输出 → 混音器音乐输入；混音器线路输出 → 有源音箱。无源音箱还需要合适的功放。", "按设备手册检查接头、麦克风电平与线路电平、输入数量和供电要求。有些一体式 KTV 音箱已带混音功能，不一定需要另买混音器。不要把功放的扬声器输出接到线路输入。"] },
        { title: "4. 延迟、音量与啸叫", paragraphs: ["人声优先使用有线音频链路。蓝牙可能引入明显延迟，不适合所有实时唱歌场景。电视也可能增加音频处理延迟，可检查设备的音频设置。", "先把各路音量调低，再逐步增加；避免麦克风正对或靠近音箱。如果出现啸叫，立即降低音量并调整位置。"] },
        { title: "购买前的清单", paragraphs: ["确认已有设备的型号、接口、房间大小、预算，以及同时使用的麦克风数量。先画出完整连接路径，再购买缺少的设备和线材。", "本页目前没有付费推广或联盟购买链接。具体设备型号、自有照片和真实使用体验将在核实后补充；我们尚未声称是 Amazon Associate。"] },
      ],
    },
    en: {
      title: "Home Karaoke Setup",
      intro: "Try what you already own before buying equipment. KTV Assistant manages songs and playback; it does not turn a phone into a microphone or mix vocals with music.",
      sections: [
        { title: "1. Start with a computer and phones", paragraphs: ["Create a room in a computer browser and use its speakers. Friends scan the QR code to search and arrange songs on their phones. No dedicated karaoke console is needed to try it.", "Check that your browser plays the selected video and phones can open the room link. Some videos restrict embedding; try another playable video."] },
        { title: "2. Add a TV or projector", paragraphs: ["Connect your computer over HDMI, select the correct input and check the computer audio output. A TV connection does not also connect microphones.", "Check computer, TV and speaker ports before buying adapters. HDMI, optical and analogue audio are not interchangeable; some paths need an active converter."] },
        { title: "3. Connect microphones, a mixer and speakers", paragraphs: ["Typical path: microphone or wireless receiver → compatible mixer microphone input; computer or TV audio output → mixer music input; mixer line output → powered speakers. Passive speakers also need a suitable amplifier.", "Check connectors, microphone and line levels, input counts and power requirements in the manuals. Some karaoke speakers include mixing, so a separate mixer may be unnecessary. Never connect amplifier speaker output to a line input."] },
        { title: "4. Latency, volume and feedback", paragraphs: ["Prefer wired audio for vocals. Bluetooth can introduce noticeable delay and may be unsuitable for live singing. TV audio processing can also add delay; check your device settings.", "Start with low volume and raise it gradually. Keep microphones away from speaker fronts. If feedback occurs, immediately lower the volume and reposition equipment."] },
        { title: "Before you buy", paragraphs: ["List your equipment models, ports, room size, budget and simultaneous microphone count. Draw the complete connection path before buying missing equipment and cables.", "This guide currently has no paid promotions or affiliate purchase links. Specific models, original photos and first-hand experience will be added after verification. We do not currently claim Amazon Associate status."] },
      ],
    },
  },
  privacy: {
    zh: { title: "隐私政策", intro: "本文说明 K歌助手当前版本中的信息处理、保存、删除与隐私联系方式。", sections: [
      { title: "房间与搜索数据", paragraphs: ["服务端保存房间标识、房间名、歌曲队列、视频信息与播放状态，用于多设备同步。搜索词、搜索事件、缓存和配额记录用于提供搜索、控制用量及排查问题。持有房间链接的人可以访问房间，请勿填写敏感信息。"] },
      { title: "浏览器存储", paragraphs: ["本地存储保存语言、设备标识、房间快照、搜索界面状态，以及你确认的政策版本和时间。确认记录不包含你的姓名或邮箱，不会发送到服务端。搜索界面状态可恢复 24 小时；其他本地数据可通过浏览器清除此站点数据删除。管理员登录使用会话 Cookie。可通过房间内的政策菜单撤回确认并停止当前页面的房间功能；这不删除其他参与者的房间或服务端记录。清除本地数据不会删除服务端记录。"] },
      { title: "第三方服务", paragraphs: ["本服务使用 YouTube API Services 获取视频信息，使用 YouTube 嵌入播放器播放，无需 Google 账号登录，也不请求你的 YouTube 密码或账号授权。加载视频、缩略图等内容时，浏览器会向 Google/YouTube 发送请求，他们可能按自身政策使用 Cookie 或类似技术。相关 Google 隐私政策链接见本节。", "Cloudflare 承载网站、数据库和实时通信，并处理网络请求及限流信息。本服务当前没有接入第三方广告脚本或 Amazon 联盟追踪。"] },
      { title: "隐私问题与数据请求", paragraphs: ["请通过下方邮箱联系项目隐私事务负责人。为便于定位记录，可提供房间链接或房间编号、约略使用时间，以及希望查询、更正或删除的内容；请勿发送密码、身份证件或不必要的敏感信息。", "我们通常在三天内查看并回复邮件。收到请求后会核实必要的信息与请求范围，说明可处理的记录和后续步骤，并按适用要求处理；涉及其他参与者的信息不会仅凭一个房间链接就直接披露。"] },
      { title: "保存与删除", paragraphs: ["无客户端活动约五分钟后房间停用、队列清空、播放重置。常规清理目标为：搜索和播放事件保留 30 天；停用且 30 天未更新的房间及其残留数据予以清理；管理员审计和日配额记录保留 90 天。活跃房间不会因创建时间较早而被删除。清理按小时分批执行，积压或故障可能造成延迟，不代表所有备份或第三方数据同步消失。", "公共歌曲资料库与共享查询缓存用于复用搜索结果，不按使用事件的 30 天期限删除；KV 搜索缓存默认在写入后保留一年，重新写入会刷新期限，D1 资料由管理员维护。如其中包含你的个人信息，可通过下方邮箱提出请求，我们将核实对应范围。此处说明的是待发布版本的规则，不代表已经完成整体合规审核。"] },
    ] },
    en: { title: "Privacy Policy", intro: "This describes information handling, retention, deletion and privacy contact details for the current version.", sections: [
      { title: "Room and search data", paragraphs: ["The server stores room IDs, names, song queues, video information and playback state for device synchronization. Search terms, events, caches and quota records support search, usage controls and troubleshooting. Anyone holding a room link can access the room; avoid sensitive information."] },
      { title: "Browser storage", paragraphs: ["Local storage holds language, a device identifier, room snapshots, search interface state, and the policy version and time you accepted. The acceptance record contains no name or email and is not sent to the server. Search interface state can be restored for 24 hours. Other local data can be removed by clearing this site’s browser data. Administrator sign-in uses a session cookie. Use the room policy menu to withdraw acceptance and stop this page’s room features; this does not delete other participants’ rooms or server records. Clearing local data does not delete server records."] },
      { title: "Third-party services", paragraphs: ["This service uses YouTube API Services for video information and YouTube embeds for playback. No Google sign-in is required, and we do not request your YouTube password or account authorization. Loading videos, thumbnails and other content sends requests to Google/YouTube, which may use cookies or similar technologies under their policies. See the Google Privacy Policy linked in this section.", "Cloudflare hosts the site, database and real-time connections and processes network requests and rate-limit information. This service currently has no third-party advertising scripts or Amazon affiliate tracking."] },
      { title: "Privacy enquiries and data requests", paragraphs: ["Contact the project privacy contact at the email below. To help locate records, provide a room link or ID, approximate usage time and what you want to access, correct or delete. Do not send passwords, identity documents or unnecessary sensitive information.", "We normally review and answer emails within three days. We will verify the necessary information and request scope, explain the records we can address and next steps, and handle the request under applicable requirements. A room link alone does not entitle a requester to other participants’ information."] },
      { title: "Retention and deletion", paragraphs: ["After about five minutes without client activity, rooms become inactive, queues clear and playback resets. Routine cleanup targets are 30 days for search and playback events; inactive rooms not updated for 30 days and their remaining data are removed; administrator audit and daily quota records are kept for 90 days. Active rooms are not deleted simply because they were created long ago. Hourly cleanup runs in batches; backlogs or failures can delay removal, which does not erase every backup or third-party record.", "The public song repository and shared query caches reuse search results and are not deleted on the 30-day usage-event schedule. KV search caches normally last one year after writing, renewed by subsequent writes; D1 repository data is maintained by the administrator. If it contains your personal information, contact us below so we can identify the relevant scope. These rules describe the version awaiting release, not a completed compliance review."] },
    ] },
  },
  terms: {
    zh: { title: "服务条款", intro: "K歌助手提供免费的多人点歌、共享队列和大屏播放控制。以下条款为待运营者确认的草稿。", sections: [
      { title: "YouTube 与内容使用", paragraphs: ["使用本服务时，你也同意受 YouTube 服务条款约束，链接见下方。请同时阅读本服务隐私政策。视频内容由第三方提供，嵌入可用性由内容提供方决定。", "仅访问和播放你有权使用的内容，遵守适用法律及内容提供方规则。本服务不授予音乐版权、公开表演或商业场所播放许可。"] },
      { title: "合理使用与房间安全", paragraphs: ["不得滥用接口、绕过访问限制、干扰其他房间或提交违法信息。房间链接允许他人加入，请只与预期参与者分享。参与者的队列操作会影响同一房间的其他人。"] },
      { title: "可用性与设备", paragraphs: ["网络、API 配额、视频下架和嵌入限制可能影响服务。我们不保证每条视频可播放或服务持续可用。请自行确认设备连接与音量安全。适用法律赋予的权利不受本条款排除。"] },
    ] },
    en: { title: "Terms of Use", intro: "KTV Assistant provides free collaborative song selection, shared queues and big-screen playback controls. These draft terms await operator confirmation.", sections: [
      { title: "YouTube and content use", paragraphs: ["By using this service, you also agree to be bound by the YouTube Terms of Service linked below. Please also read our Privacy Policy. Third parties provide video content and determine embedding availability.", "Only access and play content you are entitled to use, following applicable law and provider rules. This service grants no music copyright, public-performance or commercial-venue playback licence."] },
      { title: "Acceptable use and room safety", paragraphs: ["Do not abuse APIs, bypass access restrictions, disrupt other rooms or submit unlawful information. Room links allow others to join; share them only with intended participants. Queue actions affect everyone in the room."] },
      { title: "Availability and equipment", paragraphs: ["Networks, API quotas, video removal and embed restrictions can affect service. We do not guarantee every video or continuous availability. Check equipment connections and safe volume levels. These terms do not exclude rights provided by applicable law."] },
    ] },
  },
};
