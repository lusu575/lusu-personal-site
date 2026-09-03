# PROJECT_CONTEXT.md

## 2026-09-03 每日 AI 新闻拒稿事件跨信号分类修复

- 2026-09-03 自动运行 `run-20260902T230158Z-12509278` 在精确窗口抓取 2,033 个候选并完成 Codex 主审和 12 条三语组稿，失败点是最终 provenance 校验；生产 POST 为 0。一个 Fable／Mythos 精确标题簇由不同 focused lane 命中，代表候选同时带能力与设备战略信号，三个别名候选只带能力信号。finalize 已把逐候选类别无歧义归一，组装器的拒稿分支却再次用事件主类别覆盖了它们。
- 入选或拒稿的受保护事件都使用同一分类溯源规则：每个 priority decision 优先保留 finalize 后的逐候选 `editorialClass`，事件级 `editorialClass` 只锚定代表候选和事件主类别，不能覆盖成员自己的合法保护类别。成员的 `eventKey + eventStage`、状态、实质变化、评分以及拒稿理由仍必须与同一事件一致。
- Codex 提交的 `eventKey` 与 `eventStage` 是编辑身份，不允许 finalize 用截断等方式静默改写。两者必须在 finalize 阶段即满足最多 120 字符的规范小写内部 ID；超长、尾随连字符或其他非法形式应直接退回作者响应修正，不能拖到最终运行校验才暴露。
- 当天恢复稿最终保留 12 个独立达标事件（11 条 confirmed、1 条 rumor），以 canonical SHA-256 `1b2db4694751bcbc5db3e04c35a45d6bdbd6e531c05218fdf008d2e02a9fa1d4` 完成双确认且只发送一次生产 POST。结果为 `published`、`duplicate=false`，公开 slug `daily-ai-news-2026-09-03` 的 zh／en／ja 回读全部通过。

## 2026-09-02 每日 AI 新闻发现截断与跨信号事件修复

- GPU／图形和消费端 AI 的两条宽查询曾命中第 100 条 max-plus-one 探针，required 覆盖因此失败关闭。宽父查询现只作 supplemental，具体厂商、技术和设备类别由独立 required 分片完整签收，范围没有删减。
- 同一精确标题事件可以带多个保护信号：代表候选锚定事件主类别，成员保留各自已审核类别，事件身份、状态、实质变化与评分仍保持一致。

## 2026-09-01 每日 AI 新闻泛 AI 选题增量扩充

- 每日 AI 新闻在既有模型、工具、开放权重、多模态、芯片、机器人、自动驾驶、基础设施、金融与政策安全范围上，增量覆盖 GPU／生成式图形、消费级／端侧设备和泛 AI 行业应用；具体产品名称只作发现别名，不能把清单外的实质变化拒为栏目外。

## 2026-08-30 每日 AI 新闻最终校验修复

- Codex 响应在组装前即锁住 editorial signal 类别、事件成员一致性、可靠首发时间、精确窗口和拒绝理由；组装器提前检查三语 AI 解读的长度、句数及其相对事实段比例，避免只在最终校验逐个暴露作者错误。

## 2026-08-29 每日 AI 新闻改为 Codex 主审

- `ai-news:semantic-review` 只做无判断的客观预筛和精确标题初步聚类，任何 editorial signal 或 RSS 候选都进入 Codex 队列。当前定时任务的 Codex 亲自完成编辑判断，再以 `--finalize` 生成完整台账；正式链路不再启动 Gemma、llama.cpp 或其他本地语义评分模型。

## 2026-08-27 密码房彻底删除与移动上传恢复

- Quick Transfer 房间过期或管理员删除时，会中止未完成 Multipart，物理删除 R2 文件以及 D1 内的条目、会话和房间，不备份。部分失败保持 `deleting` 与写入锁并可重试；只有完整清理后，同一密码才创建全新空房。
- 聊天室后台可永久删除整个私密密码房的全部消息，公共大厅受保护。私密房到期或被管理员删除后不保留历史，同一密码对应的 room key 之后只会读到新消息。
- 在线画板管理删除在 DO／R2 成功后同步删除 D1 room、asset 和 ban 索引，不再留 `deleting` 墓碑；DO 协议和自动 24 小时生命周期未改变。
- Quick Transfer 手机端的图片／文件选择改为明确按钮驱动隐藏 input，每次打开前清空选择值，取消、权限拒绝、选错来源或重选同一文件后可立即重试。

## 2026-08-24 每日 AI 新闻传闻门禁与官方帖召回修复

- 已确认的要闻／主要新闻仍使用 6 分门槛。从 report date 2026-08-24 起，传闻改用 5 分门槛，并可由当事人公开预告、一篇有明确作者／机构归属的可靠直达报道，或两家独立可靠直达报道支撑。条件语气、`whyUnverified`、`rumorEvidenceBasis`、窗口和去重仍为硬门禁；聚合页、匿名截图、重复事件和纯猜测仍不可用。整期仍至少 5 条且要闻必须为 confirmed。
- 2026-08-24 恢复运行的精确窗口包含 1,309 条候选。核心漏抓断点是 X 公开主页已把帖子标识从 `data-tweet-id` 改为 `itemID + schema.org meta`，旧解析器因而把官方主页误报为空；新解析器兼容新旧标记、校验账号与 status URL，并在页面包含 `SocialMediaPosting` 却无法解析时失败关闭。明确的 rate-limit “update” 同时进入 `usage-policy-change` 受保护审阅。

## 2026-08-20 匿名互动界面与 H3 来源返回

- 聊天室 composer 使用单个相对定位输入壳：textarea、字数提示与 52×44px 方角 XP 发送按钮在同一输入面内；发送位图以 34px 槽位放大显示，消息列表不得再使用人为的大底部 padding，移动端最终覆盖也必须维持这一结构。
- 聊天室和在线画板的密码房入口均提供 zh／en／ja 的“？”说明。Chat 的说明只由鼠标悬浮或键盘 `:focus-visible` 显示，移开立即隐藏，点击不得切换持久状态；Whiteboard 保持其独立入口交互。Chat 的 24 小时规则按最后消息清理，Whiteboard 按最后参与者退出后 24 小时删除，不得混写。
- 在线画板大厅版本为 1.0.8，入口背景来自 Image2 并保存 PNG／WebP 与来源 manifest；卡片继续使用真实 HTML 和 XP／Pixel／Y2K 外壳，房间协作与保留协议未改变。
- `/admin/minimax-h3.html` 使用 `?from=admin|tools` 决定返回目标。后台导航必须带 `from=admin`，工具目录带 `from=tools`；直接访问回到公共工具区。
- 当前公开记录为 `seed-update-2026-08-20-chat-whiteboard-ui-fixes`，公开表示／文章 seed／主缓存 token 为 `20260820-chat-whiteboard-ui-r2`。

## 2026-08-19 每日 AI 新闻 RSS 与“关于我”低调入口

- 主站恢复一个严格限域的公开聚合面：`GET /api/feeds/daily-ai-news.xml?lang=zh|en|ja`。feed 只查询 `status = published` 且分类为 `daily-ai-news` 的最近 50 期，输出标题、摘要、发布时间和站内文章链接；它不提供写入、管理、其他分类或全站数据。
- “关于我”页的 RSS 入口独立放在介绍文字下方，不与社交账号混排，也不增加首页主按钮。入口文案和链接跟随 zh／en／ja 切换，页面 head 同时声明 RSS autodiscovery。
- RSS 响应使用 `application/rss+xml; charset=utf-8`、XML 转义、安全响应头、强 ETag 与短缓存；公开表示／文章 seed／主模块缓存版本统一为 `20260819-daily-ai-news-rss-r1`。网站更新记录为 `seed-update-2026-08-19-daily-ai-news-rss`。

## 2026-08-19 免费额度爬虫遥测保护

- `functions/api/analytics-traffic-classifier.mjs` 是公共遥测统一的自动化客户端分类入口。已知搜索、AI、SEO、安全扫描、synthetic monitor、Headless 与脚本工具访问 `POST /api/analytics/identify|page-view|click` 时，必须在 `ensureCoreSchema`、匿名身份、Cookie、限流桶和 D1 事件之前返回 `recorded:false`。
- 公开文章继续向爬虫返回正文以维持收录，但这些请求不写文章阅读事件、访客资料或累计浏览数。普通浏览器与账号、存档、Chat、Transfer、Whiteboard 等必要业务不受分类器影响。
- User-Agent 只是高置信启发式而非身份认证；规则必须覆盖不含 `bot` 字样的 `GoogleOther`。不得根据国家、单页访问或普通浏览器版本把访客判为爬虫。历史遥测不删除，会随 180 天保留和后台时间窗自然退出。
- Cloudflare 当前连接缺少自定义 WAF 编辑权限，因此 CMS／Secret 探测路径没有新增线上边缘规则。不要增加全站 Pages middleware 让原本免费的静态资产转入 Functions 计额；取得 WAF 权限后应单独复核、创建并回读窄范围规则。

## 2026-08-13 MiniMax H3 公开工具入口暂时隐藏

- 公开 Tools 路由暂时不渲染 \`minimax-h3\` 卡片：资源条目保留 \`publicCatalog: false\`，并新增 \`showInTools: false\`，由资源路由在生成卡片前过滤。此隐藏只作用于访客工具区，不删除 \`/admin/minimax-h3.html\`、后端 API、Runner、Bridge、D1 控制面或本地配置。
- 家庭 ComfyUI 与 Bridge 的 loopback 边界、执行／传输默认关闭和 image2 生成的简约 AI 视频主题图标资产保持不变。重新公开前仍必须完成 Cloudflare Tunnel/Access、生产 token、Runner heartbeat 和真实 GPU canary 验收。
- 公开更新 ID／slug 为 \`seed-update-2026-08-13-hide-minimax-h3-tools\`／\`2026-08-13-hide-minimax-h3-tools\`，时间为 \`2026-08-13T02:00:00.000Z\`；Home 最新五条为暂时隐藏 → H3 控制面上线准备 → 壁纸／游戏显示修复 → 第一版 H3 发布 → BFCache 修复。

## 2026-08-12 MiniMax H3 隔离生产发布边界

- `main` 已合并 H3 控制面并由 Cloudflare Pages Production 部署到最终 commit `03e8512e80d06853cf3889353db6505d0a91986f`；站长专用在线 ComfyUI · MiniMax H3 工具入口、admin-only `minimax-h3:execute`、P0–P3 控制面与 D1 schema 已进入正式站点，同时保留基线上已有视频、壁纸和游戏功能。Production D1 已完成 H3-only 增量迁移。
- 代码路径支持固定 Runner、家庭 ComfyUI `127.0.0.1:8188` 与 loopback Bridge `127.0.0.1:8791`，但控制／传输开关默认关闭；生产 Agent token、Tunnel/Access、Runner 心跳和 GPU canary 必须单独配置并实测后，才能宣称可在线生成。
- H3 参考素材与成片不进入站点 R2、D1、KV、Durable Object、Pages 或 CDN；图标由 image2 生成，采用机械透明处理和最近邻缩放，不使用代码绘制或合成。

## 2026-08-12 视频壁纸互斥、返回续播与游戏显示契约

- 桌面 Home 的视频壁纸与旧 CSS 动态云必须互斥。只要设备、性能、Save-Data 与 motion 设置满足视频播放资格，`wallpaperCloudAssetCandidates()` 必须返回空列表，动态云同步也不得创建节点；视频素材自身负责云层运动。静态底图仍永久挂载，视频无法就绪时直接显示静态底图，不允许为了失败兜底重新叠加第二套动态云。真正不具备视频资格的旧降级路径保持原行为。
- route 可见性与视频播放资格是两个状态。离开 Home 或文档隐藏只暂停当前视频，不清空 `src`、不移除节点、不释放解码器；回到 Home 或重新可见时复用同一节点续播，避免重新请求、解码和整屏淡入。只有手机／low／Save-Data／reduced／off 等真正失去播放资格，或主题／分辨率资源发生变化时才销毁旧媒体。
- 五个独立游戏继续共享单一 `100dvh` shell，但 `.game-frame-card` 不得再使用 1280px 最大宽度；它占满扣除 20px 边距后的可用宽度，避免浏览器缩放后缩成中央小窗。视口宽度不超过 860px 或高度不超过 720px 时，存档、云端、许可证与 AI 面板默认收起到一个至少 44px 的三语按钮后，iframe 使用余下高度；不得用全局 `zoom`、裁切或小于 44px 的触控目标掩盖布局问题。
- 公开更新 ID／slug 为 `seed-update-2026-08-12-wallpaper-game-display-fix`／`2026-08-12-wallpaper-game-display-fix`，时间为 `2026-08-12T07:30:00.000Z`，公开 API／文章 seed 与主缓存 token 为 `20260812-wallpaper-game-display-r1`。Home 最新五条固定为本次修复、第一版 H3 发布、BFCache 修复、视频单链接候选、8 月 10 日 H3 历史发布；完整历史继续保留 slim-dawn、ceramic-roll 及更早记录。

## 2026-08-11 第一版 H3 整帧 48fps／4K 动态壁纸发布契约

- 桌面 Home 的 morning／day／dusk／night 当前正式使用用户确认的第一版 MiniMax H3 素材帧。四段都保留第一版整幅画面的轻微树木、云层、水面与光影变化，并严格按源帧 `0..62 + 61..1` 整理为约 5.17 秒的整屏往返循环；最终每段为 48fps、248 帧。第二版过弱的局部 mask／gain 合成不再是生产视频来源，电视机中也没有小女孩或随机 cameo。
- 正式视频链路固定为：第一版 H3 源帧 `0..62 + 61..1` 组成 24fps 往返序列 → 双向光流补帧到 48fps → 对全部 248 帧使用 `RealESRGAN_x4plus_anime_6B` 逐帧 AI 超分 → 分别输出 1920×1080 与 3840×2160。不得把原始 124 帧全段误写为本次循环来源，也不得再把旧的“静态底图只超分一次，再叠局部 mask／gain 时域差分”描述为当前生产方案。
- 运行时边界没有扩大：只在桌面 Home、normal performance、Save-Data 关闭且站内 motion 为 full 时请求当前主题的一段 muted／loop／playsinline MP4，并按 CSS 尺寸 × DPR 选择 1080p 或 2160p。手机、low performance、Save-Data、`prefers-reduced-motion`、站内 reduced／off 保持零视频请求；静态壁纸永久兜底。非 Home／页面隐藏生命周期的释放行为已由 2026-08-12 的暂停保留与复用规则取代；motion mode、runtime ready 与 `pageshow` 的 BFCache 恢复协调继续保留。
- 公开更新 ID／slug 为 `seed-update-2026-08-11-h3-first-version-video-sr-48fps`／`2026-08-11-h3-first-version-video-sr-48fps`，时间为 `2026-08-11T10:40:00.000Z`，当次公开 API／文章 seed token 为 `20260811-h3-first-version-video-sr-48fps-r1`。该记录当前是 Home 最新五条中的第二项；视频单链接候选仍在最新五条中，slim-dawn 与更早记录保留在完整历史。

## 2026-08-11 动态壁纸 BFCache 恢复契约

- 桌面 Home 的轻动态壁纸必须在浏览器前进／后退和 BFCache 恢复后重新协调，而不能假设模块只初始化一次。已确认的故障顺序是：恢复时主模块先读到页面隐藏期间留下的旧 `off`，随后 `ui-motion` 把全站状态写回 `full`，但旧流程没有通知壁纸控制器，因此当前主题视频没有重新挂载。
- 壁纸控制器现在在 motion mode 变化、动效运行时 ready 以及 `pageshow` 三个生命周期信号上重新同步当前 route、theme、visibility 与播放资格。恢复逻辑必须可重复执行，并继续维持同一时刻只有当前主题的一个视频节点／请求。
- 本修复不改变渐进增强边界：手机、low performance、Save-Data、`prefers-reduced-motion`、站内 reduced／off 仍是零视频请求；非 Home 或页面隐藏仍暂停或释放视频，静态壁纸仍为永久兜底。
- 公开更新 ID／slug 为 `seed-update-2026-08-11-ambient-wallpaper-bfcache-fix`／`2026-08-11-ambient-wallpaper-bfcache-fix`，时间为 `2026-08-11T03:35:00.000Z`，该次历史 seed token 为 `20260811-ambient-wallpaper-bfcache-fix-r1`。这条记录继续完整保留，并在后续第一版 H3 发布加入后成为 Home 最新五条中的第二项。

## 2026-08-11 `video_publish` 单链接发布 0.4.0 候选

- 本轮只收窄既有 `video_publish` 的必填输入，不新增工具、scope 或 API：生产清单仍是 23 项工具，写入继续使用 `content:write`；0.4.0 候选仍由同一工具直接提交 `status=published`，既有直接公开行为不变。
- 站长可以只告诉 AI 一条 YouTube、Bilibili 或 b23.tv 链接；AI 为每次新动作生成唯一 `operationId`。服务端规范化平台、外部 ID、原地址与 iframe 地址，并对省略的 `title`、`description`、`thumbnailUrl`、`authorName`、`publishedAt` 做有界 provider 补全；调用方显式传入的值（包括允许的空值或 `null`）优先，不被远端结果覆盖。
- `operationId + canonical caller-intent hash` 只绑定调用方实际提交的字段。服务端必须先检查并回放持久收据，再决定是否访问 provider，因此同载荷重试不重复联网；旧版完整载荷收据继续兼容。只有在不存在可回放收据时才抓取元数据。
- 标题是最终发布的硬门槛：若调用方省略标题且 provider 也无法返回合格标题，则返回 `VIDEO_METADATA_TITLE_UNAVAILABLE`，视频、分类关系、收据与审计均保持零写入。显式标题存在时，其他可选元数据抓取失败仍可发布，并持久化受限 `metadata_error`。本站始终不下载、上传、转码或托管视频文件，也不接受本机路径、Base64、原始字节或任意 iframe URL。
- 当前只记录仓库 0.4.0 上线候选，不提前宣称生产可用。精确 Worker version、真实浏览器 OAuth、23 工具发现、最小载荷发布、同载荷重放、管理／公开回读与 grant 撤销结果必须在实际部署后由主发布流程回填；历史 bundle 的验收不能替代新 bundle。
- 首次候选曾临时部署为精确 Worker `9b0bd726-2c15-414c-bdff-fc5179b4e003`。DCR、PKCE、站长 OAuth 和精确 23 项工具发现通过，但仅 `operationId + originalUrl` 的 YouTube 发布因 provider 未返回标题而以 `VIDEO_METADATA_TITLE_UNAVAILABLE` 结束，视频、分类、收据和审计均未写入；临时 grant 已撤销，生产已 100% 回滚到稳定 0.3.1 `849d8328-87db-4ac8-819a-ce725fc06349`。该尝试不是生命周期验收成功，也不得用于 registry promotion。
- 当前仓库候选并行读取 YouTube oEmbed 与由同一已校验 videoId 构造的官方 watch page：oEmbed 的标题／作者／封面优先，页面尽量补齐简介／发布时间并在 oEmbed 失败或缺标题时兜底。两路使用浏览器兼容请求头、256 KiB JSON／2 MiB HTML 流式上限和覆盖正文的 8 秒超时；页面声明的 canonical／`og:url` 必须匹配请求 videoId，畸形或中断正文会主动取消响应流，结果仍经过既有字段规范化／官方 CDN 白名单。此修复尚未重新部署或生产验收；站长停止本轮授权后不得继续发起 OAuth，只有收到新的明确授权才能重跑闭环。
- 视频候选的三语公开更新为 `seed-update-2026-08-11-video-link-autofill`／`2026-08-11-video-link-autofill`，发布时间 `2026-08-11T00:20:00.000Z`，该条历史 seed token 为 `20260811-video-link-autofill-r1`；随后第一版 H3 发布把当前公开表示、文章 seed、Home import 与 `js/main.js` 缓存 token 推进为 `20260811-h3-first-version-video-sr-48fps-r1`。Home 无正文投影仍保留本条，并按发布时间排在第一版 H3 与 BFCache 修复之后。

## 2026-08-10 四时段 H3 局部合成发布契约（历史阶段，已由第一版整帧方案替代）

- 桌面 Home 的 morning／day／dusk／night 四张壁纸均有约 5 秒的无缝环境循环，来源为本地 MiniMax H3。视觉目标是“看得出活着，不抢窗口和文字”：H3 局部变化只作用于树冠和真实水面，云层继续使用已有 CSS 慢速漂移，夜间另有低亮度、不持续强闪的微弱星光。电视机与屏幕保持静态，本版不引入角色出现。
- 该历史阶段的 4K 交付不对每个视频帧独立做 AI 超分：每个主题的静态底图先使用官方 `RealESRGAN_x4plus_anime_6B` 权重一次超分到 3840×2160，再叠加经平滑与限幅的 H3 局部时域差分。此方案因动态过弱已被 2026-08-11 的第一版整帧、双向光流 48fps、逐帧超分方案替代，不得再作为当前生产事实。
- 运行时只为当前主题请求一个视频文件，依 CSS 显示尺寸与 device pixel ratio 选择 1920×1080 或 3840×2160；其他三个主题不预载。视频 muted、loop、playsinline，就绪后才短淡入，失败时不影响对应静态壁纸；页面隐藏时暂停。
- 移动端、low performance、Save-Data、`prefers-reduced-motion`、站内 `data-motion="reduced"` 与 `off` 都是零视频请求的硬门槛，直接使用当前主题静态壁纸。这是对历史“不用整屏视频”的严格渐进增强例外，不得扩展到手机、非 Home 路由、同时预载四个主题或无静态兜底的实现。
- 公开三语更新 ID／slug 为 `seed-update-2026-08-10-h3-ambient-wallpapers-4k`／`2026-08-10-h3-ambient-wallpapers-4k`，公开 API／文章 seed token 为 `20260810-h3-ambient-wallpapers-4k-r1`；完整 fallback、Home 最新五条投影、Functions seed 与 schema seed 必须保持三语一致。

## 2026-08-10 四时段壁纸开关跨路由动效修复

- 当前最终公开记录仍为 `seed-update-2026-08-10-wallpaper-switch-slim-dawn`／`2026-08-10-wallpaper-switch-slim-dawn`，但更新时间为 `2026-08-10T04:10:00.000Z`；Functions 公开 API、文章 seed、schema marker、Home 投影与 `js/main.js` 使用 `20260810-wallpaper-switch-route-motion-r1`。本次没有更改 r6 PNG，所以 `wallpaper-time-switch.source.json` 保留素材发布溯源 token `20260810-wallpaper-switch-slim-dawn-r1`，图像 token 仍为 `20260810-wallpaper-time-switch-r6`。
- 四段开关的内部动效契约是“所有实际可见的公开路由”：桌面 Home、Knowledge、Videos、Tools、Games、Blog、Chat 与 About 都要先完成 5 个唯一运行时 URL 的预解码，再开放 radio；切换时 thumb、roller、scene、marker、celestial 和当前主题 accent 保持同一套可中断 transition。`data-static` 只能在 `document.hidden` 时设置，不得再用 `route !== home` 关闭动效。
- 开关内部动效与整页壁纸是两个边界：Home 继续独占全景壁纸 crossfade 和动态云层，App 路由只让顶栏四段控件自身流畅动作。移动 App 紧凑栏仍隐藏该 176px 控件，不破坏有标签的 44px Home 返回键、右侧栏目标题和短屏可读容量；这些隐藏路由不应额外预解码 accent。keyboard／motion-off 即时、reduced 只保留 140ms opacity、low／Save-Data 跳过 accent 等既有语义不变。

## 2026-08-10 四时段壁纸开关细框晨曦版发布契约

- 当前最终公开记录为 `seed-update-2026-08-10-wallpaper-switch-slim-dawn`，slug `2026-08-10-wallpaper-switch-slim-dawn`，发布时间 `2026-08-10T02:30:00.000Z`；三语 fallback、Home 投影、Functions seed、schema seed、公开 CSS／JS／API／文章 seed 统一使用 `20260810-wallpaper-switch-slim-dawn-r1`。Home 最新五条严格按 slim-dawn、ceramic-roll、calm-redesign、scene-redesign、game-video 排列；下方 r5 ceramic-roll 章节和更早记录只作为按日期保存的历史，不能再冒充当前契约。
- 当前图像 token 为 `20260810-wallpaper-time-switch-r6`。176×44 控件、四个 44px 触摸目标、36×36 wrapper、top 4px、四档 x 4／48／92／136px、32×32 正向天体与 2px inset 均不变。r6 frame 的 alpha32 中心水平透明 run 为 18..860（843px）、垂直 run 为 20..200（181px），对应 half-open bbox `[18,20,861,201]`；运行时必须使用 `clip-path: inset(4px 4px round 18px)`。roller 在 36px wrapper 内实际可见外径约 33.375px、中心开孔 30px、单边约 1.6875px，以两条局部凹槽和非对称釉光呈现物理滚动，每档旋转 151.072deg，四档累计 0／151.072／302.144／453.216deg；天体本身不得随圈旋转。
- 清晨必须与白天同时从 scene、marker、node 三层区分：morning scene 是低饱和薰衣草蓝上空、桃粉到杏桃琥珀的低位晨曦带，marker／node 都只露低位约三分之一暖橙太阳并由单一象牙晨雾／地平线遮住，没有放射冠；day 保持鲜明蓝色场与高位完整黄日。正式实际尺寸差异证据为 scene 176×44 RMSE 97.136、node 32×32 RMSE 81.343、marker 20×20 RMSE 39.576；morning accent 继续沿用已审核的晨光与小云上展，day 双云横移、dusk 余晖横展、night 八星上升也不变，每主题仍只有一层 accent。
- 正式内容仍为 18 个当前 selected Image2 源；本轮替换 frame、roller、scene-morning、marker-morning、node-morning，旧 r5 五份完整 prompt、call ID、source path／SHA 必须以 `superseded` 历史保留。新正式 SHA-256 为 scene-morning `228b4461cabbd28a4d7e552eb01e15020dcda46b02803b5e8423099450f8c6e3`、marker-morning `c9dea9d91297a311d90305eacf6557c19a35ae00605e2a56115b6f41ececa443`、node-morning `e0e18e9eca155af6fda1eee2e90c2a97c2e7ad1641b03645f0db0dfddb252bee`、frame `ce7917df11a97664a0ae6b72ae4e1d3498e1f8ff104017bf9f0e5e855567866a`、roller `8f969ddad084c59dd507a81cdf940773fb55ae525e093ff55fd267cc36fb922e`。机械 atlas 为 scene `008b0739ff5165ab712f9e20bf6f5c94dac2f4b89735944631af31acabe66027`、marker `97044eedb7c02ad7a4930871955f01be393190339a5174c71d95069560485b29`、node `93b4964d9df08c9ad975c18854d13eaab5899763e0eea7a5c659cac2eb1ffe2f`、未变的 accent `8d416dc6c2780024b60a3028f676284fa712fa4f9b1e0b9bc470dbe0434b9e54`。
- 17 个非 frame 内容继续按原生 cell 机械纵向打包成四张 atlas，roller 继续位于 `node-atlas.png` 第五格，只有 `frame.png` 独立，运行时固定 5 个 URL且禁止单独请求 `roller.png`；不得放宽 Quick Transfer 网络 trace 预算。自动时段与手动覆盖到下一真实边界、跨标签同步、pending request、last-request-wins、可中断 transform／opacity、键盘与 motion-off 即时、reduced 移除位置运动并限制 140ms opacity、low／Save-Data 省略 accent 等契约不变。Quick Transfer 继续为 1.0.10；本轮不修改 MCP／CLI／Worker／游戏／后台／自动新闻业务。

## 2026-08-10 四时段壁纸开关陶瓷滚轮版发布契约

- 当前最终公开记录使用 `seed-update-2026-08-10-wallpaper-switch-ceramic-roll` 与 slug `2026-08-10-wallpaper-switch-ceramic-roll`，发布时间为 `2026-08-10T00:20:00.000Z`。三语 `site-updates` 完整 fallback、Home 最新五条投影、Functions seed、schema seed、公开 CSS／JS／API／文章 seed 统一使用 `20260810-wallpaper-switch-ceramic-roll-r1`，顶栏最近更新日期为 2026-08-10。此前 `calm-redesign` ID／slug、`20260810-wallpaper-switch-calm-r1` 和 r4 只保留为未上线迭代及 8 月 9 日历史事实，不能再作为当前长期契约。
- 当前图像契约为 `20260810-wallpaper-time-switch-r5`：176×44 控件整条只显示当前时段场景，完整暖象牙壳面覆盖外轮廓，内部精确裁切 `inset(5px 6px round 17px)`；正式 `frame.png` 中心开口 alpha bbox 为 `[36,29,842,190]`。36×36 选择器固定 top 4px，四档 left 为 4／48／92／136px；32×32 天体在选择器内以 2px inset 居中。独立暖象牙 roller 与 thumb 同步平移并按每档 140deg 旋转，天体保持正立。未选节点为 20×20、四种高辨识的平滑高分辨率陶瓷／珐琅图标，浏览器必须使用 `image-rendering:auto`，不得退回像素画、空白珍珠、通用圆点或透明环。
- 正式素材共 18 个互不复用的 Image2／imagegen 内容源：4 scene、4 smooth marker v2、4 node、4 accent、1 frame 与 1 roller。morning 只使用晨光与小云上展，day 使用双云横移，dusk 使用余晖横展，night 使用八星上升；每个主题始终只有一层 accent。除 frame 外的 17 个内容按声明顺序机械纵向打包成 scene／marker／node／accent 四张 atlas；roller 固定为 `node-atlas.png` 的第五个原生 192×192 cell，node atlas 为 192×960、SHA-256 为 `0589cfd12b1894e33f8f72f348ec03934bd21c7ffb9b701add571fa43baee3e9`，`frame.png` 是唯一 standalone 文件。运行时固定 5 个 URL并禁止单独请求 `roller.png`；不得通过放宽 Quick Transfer trace 预算容纳额外请求。smooth marker v2 的 marker atlas SHA-256 为 `a05fa5bb1b6cdaa5381eb363a7a7a944e20d59e3f0a444c6d776e7e1af357850`。`wallpaper-time-switch.source.json` 必须保留每个选中与弃用调用的完整真实 prompt、call ID、来源路径／SHA、机械处理、浏览器实际尺寸 QA、18 个正式文件与 4 张 atlas SHA；不得臆造、复用视觉 cell、代码绘制或改色。
- thumb 位移与 roller 转动共享 `var(--motion-window)` 与 `cubic-bezier(0.77,0,0.175,1)`，场景和天体使用 `var(--motion-standard)`；所有快速换档只使用可中断、可重定向的 transform／opacity transition，不使用 keyframes、layout motion、`transition: all`、ease-in 或 stagger delay。键盘和 motion-off 立即提交；reduced 移除 thumb／roller 位置运动并只保留不超过 140ms opacity；low performance／Save-Data 不加载 accent，但保持场景、四节点、自动时段和手动覆盖语义。

## 2026-08-09 游戏 MCP 暂停保活发布与待验收状态

- 当前生产站长 OAuth Worker 的精确 version ID 是 `849d8328-87db-4ac8-819a-ce725fc06349`，内部版本 `0.3.1`，当前承接 100% 流量。它承载 9 项文章、8 项外链视频和 6 项浏览器游戏工具候选，但视频条目的 `availableTransports` 尚未包含 `remote-mcp`，游戏条目的 `availableTransports` 仍为空；公开 `site_capabilities` 继续只返回已晋级的四项文章读取能力。工具存在于生产 bundle 不等于对应生命周期已经验收或可用性已经晋级。一次包含暂停观察实验和未验收 registry promotion 的 `f9951348-5a68-417c-8875-9817faa192fd` 发布已回滚，不能作为当前生产或验收证据。
- 外链视频管理的完整生产点检只绑定精确历史 bundle `377d494b-8f90-40ad-998f-863d209e1978`：YouTube／Bilibili／b23.tv 规范化、原子发布、同 `operationId` 同载荷重放、管理列表／详情、元数据刷新、`expectedUpdatedAt` CAS、`confirm: true` 删除、公开缺失回读、RFC 7009 grant 撤销与旧 access token 401 均通过，临时视频记录已删除。该证据不能跨 bundle 复用；当前 `849d...` 必须重新完成对应视频生命周期，在最终可用性 promotion 和复验前，视频条目的 `availableTransports` 继续不包含 `remote-mcp`。
- 2048 的生产候选点检已通过玩家一次性配对、语义 `actionId`、revision CAS、暂停和 grant 撤销。为处理暂停后的首次空闲断线，Pages 游戏壳已上线每 8 秒发送精确文本 `ping`、忽略边缘精确 `pong` 的心跳，且线上精确资源字节已经核验；但真实 Chrome 标签在后台约 5 分钟后受到强计时器节流，页面心跳停止得足够久，中继仍以 `GAME_BROWSER_DISCONNECTED` 结束。四款游戏的完整配对／动作／暂停／玩家恢复／确认关闭闭环因此仍未验收通过，不能改变 registry 可用面。
- 当前生产 Worker `849d8328-87db-4ac8-819a-ce725fc06349` 保留 Cloudflare WebSocket Hibernation 的 `setWebSocketAutoResponse("ping", "pong")`，并已包含 paused-observe 下行保活：已鉴权、已绑定 owner／grant 的 `game_browser_observe` 命中 `paused` 状态时先取得 browser socket；缺失或精确 `socket.send("pong")` 失败就标记断线并返回 `GAME_BROWSER_DISCONNECTED`，成功后只沿用现有 `lastControllerAt` 持久化并返回缓存的暂停快照，不更新 `lastBrowserAt`。它不读取 provider、不生成新 observation、不执行 action、不改变 revision，也不引入新协议消息；只有持续轮询 paused observe 的客户端能获得这条下行保活，生产验收 helper 使用 1.5–10 秒间隔，客户端契约不得超过 20 秒。它不是 Worker 主动周期定时器，客户端停止轮询后没有永久保活承诺，恢复仍只能由浏览器玩家触发 `user_resume`。
- `849d...` 已承接 100% 流量，正式域名的 protected-resource／authorization-server metadata、未鉴权 `401 WWW-Authenticate` challenge 和非 allowlist pathname `404` 已通过；这只证明新 bundle 已部署且基础路由／鉴权边界在线，不代表业务生命周期验收。四款游戏的真实 OAuth／DO／浏览器闭环和 `377d...` 曾通过的视频生命周期都必须绑定 `849d...` 重新执行；当前四游戏未验收，registry 不变。后续最终 availability promotion 若再次产生新 Worker，视频与游戏闭环仍须独立重验。Kittens Game 继续受 WET PAWS LICENSE 约束并保持 `NO_AGENT`，真实视频文件上传仍需独立私有 R2 二进制数据面。
- 公开更新继续沿用 `seed-update-2026-08-09-game-video-mcp-candidate` 与同一 slug，三语正文原位改为当前生产事实；公开 API、文章 seed、主模块与 Home 数据缓存版本为 `20260809-game-video-mcp-heartbeat-r1`。融合主线时必须保留后续新增的更新项并继续让 Home 只投影最新五项。本热修不修改共享 registry 或 Quick Transfer 受管路径，也不再次升版 Quick Transfer；本发布继承主线当前 v1.0.10，互传协议和独立缓存不由本热修滚动。

## 2026-08-09 游戏浏览器接管与视频 MCP 初始本地候选（历史阶段）

- 新 bundle 在上线前补齐 RFC 7009 refresh-token 撤销与 D1 grant／审计的原子同步。固定 provider 版本的 O(1) grant 记录只用于在删除前精确核对 current／previous refresh-token hash；调用 provider 前必须先写 grant 级、确定性的 D1 `pending` intent，RFC 7009 返回成功后仍须显式确认幂等的整 grant 删除完成，防止并发 refresh 轮换让标准 200 成为空操作，最后再以同一 D1 batch 记录 `rfc7009-refresh-token` 并把唯一审计完成为 `success`。access-token-only 撤销不得误撤整个 D1 grant；provider 已删除、D1 首次失败时从强一致 intent 返回稳定失败并允许同请求恢复，不能依赖最终一致 KV 的删除后反查，也不能把 token、client secret 或原始撤销表单写入响应或日志。
- 当前仓库候选为 2048、Hextris、A Dark Room 与人生重开补齐受审计的浏览器语义 bridge。页面只把当前 revision 的不透明 `actionId` 交给 Agent；禁止选择器、脚本、原始按键、坐标、URL、任意 DOM 调用或原始存档注入。共享浏览器宿主负责显式玩家配对、一次只保留一个 pending command、revision CAS、超时和断线失效，并提供可见的锁定、暂停、收回控制与关闭入口；玩家暂停／收回／关闭或页面断线后必须立即释放控制，AI 不能自行恢复。
- 下一版站长 OAuth Worker 的本地候选注册 `game_browser_pair`、`game_browser_observe`、`game_browser_actions`、`game_browser_act`、`game_browser_pause` 与 `game_browser_close`。所有工具要求独立非默认 `games:play` scope、active grant 与当前管理员角色；中继状态由 Durable Object 承担，配对码一次性、短时、绑定站长和 OAuth client。registry 中 `games.browser.*` 的目标 transport 包含远程 MCP／browser adapter，但 `availableTransports` 继续为空：未完成新 Worker 部署、Production OAuth 同意、DO 配对和真实浏览器完整闭环前，不得对外宣称可用。
- 游戏命令的持久 outcome 审计属于命令完成语义，而不只是附加日志。调用尝试与最终结果必须分开记录，`success`、`pending`、`error` 使用各自状态；结果审计写入失败时工具必须返回 `MCP_OAUTH_AUDIT_FAILED`，不得把动作报告为成功。调用方可用同一 `clientActionId` 重试，DO 收据会复用既有结果而不会重复执行浏览器动作。
- Kittens Game 因 WET PAWS LICENSE 继续保持 `agentControl.enabled = false`／`NO_AGENT`。除非取得上游明确许可或完成法律确认，不得为它增加语义 bridge、配对或任何 Agent 控制；另外四款游戏的许可和实现不能用于推导 Kittens 可控。
- 视频 MCP 第一阶段的本地候选只覆盖 YouTube、Bilibili 与 b23.tv 外链记录：新增候选公开读 `videos_list`／`video_get`，并准备站长管理列表／详情、原子发布、CAS 更新、受限元数据刷新和确认删除。八项工具都未部署；`content.videos.list/get` 也继续不把 `remote-mcp` 加入 `availableTransports`，因此既有生产 `site_capabilities` 仍只发现四项文章能力。发布／更新／删除继续要求当前管理员复核、唯一 `operationId`、canonical payload hash、持久 D1 幂等收据与审计；更新／删除携带 `expectedUpdatedAt`，删除另需 `confirm: true`。这不是视频文件上传或托管，远程 MCP 不接受也不读取本机路径、Base64、原始字节或客户端文件。
- schema 中的 `agent_video_receipts` 用于候选视频原子操作的持久收据；`video_upload_sessions` 只为将来独立文件数据面保留持久结构，不表示上传 API、R2 bucket 或远程 MCP 上传已经配置。真实文件上传必须另建私有 R2 二进制数据面，完成分片、内容哈希、配额、扫描、提交、超时中止和孤儿清理后再改变 registry 的空 `availableTransports`。
- 本阶段仍是本地候选，未提交、未部署、未做 Production D1 migration，也没有生产 OAuth／DO／真实浏览器验收。2026-08-09 通过的九工具知识库闭环只绑定既有 Worker bundle `fa295db6-302a-4a20-a2b1-ffe1ddafd75b`，不能作为新候选的验收证据。公开候选记录为 `seed-update-2026-08-09-game-video-mcp-candidate`，公开 API／文章 seed／主模块与 Home 数据缓存版本为 `20260809-game-video-mcp-candidate-r2`。共享能力注册表命中 Quick Transfer 受管路径，因此 Quick Transfer 从 1.0.8 精确升至 1.0.9，并同步 fragment、工具目录与懒加载缓存链；这只是共享 registry 治理升版，未改变互传协议、房间、口令、加密、私有 R2、配额、Multipart、鉴权或 24 小时生命周期。在线画板版本与独立缓存不随本候选滚动。
- Windows checkout 可能只把 GPL 文本换行为 CRLF。Hextris Agent 的许可证门禁先把 CRLF 规范为 LF，再核对固定 GPLv3 SHA-256、完整标题和 Agent／浏览器 source 两份全文一致；除换行外的任何正文变化仍会失败关闭。

## 2026-08-09 四时段壁纸开关

- 本节保留 r4 的 2026-08-09 历史实现事实；当前长期尺寸、素材、动效、公开记录与缓存契约已经由上方 2026-08-10 r5 陶瓷滚轮版完整取代。
- 主站右上角提供 morning／day／dusk／night 四段壁纸开关，固定为 176×44 椭圆。整条轨道在任一时刻只显示当前时段的一幅安静色场，严禁恢复成四张缩略景并排的拼轨。四个节点始终可见：未激活节点使用各时段独有的 20×20 低对比浮雕语义标记，不得退回空白珍珠、通用圆点或透明圆环；激活节点换成 32×32 实心天体，依次为半露晨日、正午全日、低位落日和月亮，top 为 6px，四档 left 为 6／50／94／138px。
- 默认状态继续按访问设备本地时间的四个真实边界切换：05:00 morning、11:00 day、17:00 dusk、20:00 night。用户手动选择时立即切换，并只覆盖到下一真实时段边界；边界到达后清除覆盖并恢复自动时间状态。覆盖优先写入 `localStorage`，不可用时使用 `sessionStorage` 兜底，刷新后可恢复；成功写入本地存储的覆盖通过 `storage` 事件同步其他标签页。URL `?wallpaper=` 仍是显式预览优先级，不改写持久覆盖。
- 每个主题只允许一层稀疏 accent：morning 是四根分离的短晨光，day 是一朵矮小云，dusk 是一条极薄短余晖，night 是七颗稀疏小星。day 与 night 的基础 scene 已分别通过额外 Image2 修正为无云、无星的纯净色场，语义天气只在选中后由单层 accent 出现；不得恢复 far／mid／accent 堆叠、行星、密集景物或 0／35／70ms 错峰。选择器使用 220ms transform，当前场景使用 180ms 淡入；morning／day／dusk／night 的单层 accent 分别用 200／210／190／220ms 的轻微上浮、横移、展开或升起，但全部 `transition-delay: 0ms`。所有换档只用可中断、可重定向的 transform／opacity transition，不使用 keyframes，并遵守 last-request-wins。
- 当前 17 个不同的最终视觉内容源均由 Image2／imagegen 生成并由 `wallpaper-time-switch.source.json` 锁定真实尺寸、SHA-256、来源图与机械处理过程：4 张 880×220 scene、4 张 144×144 marker、4 张 192×192 node、4 张 480×160 accent 和 1 张 880×220 frame。此次精修记录 6 次 Image2 来源调用，累计调用从 14 增至 20；旧绿键 dusk 草稿因源图自带黄绿色外晕而明确弃用，采用洋红键 v2，官方 chroma helper 后只允许 alpha bounds、透明定位和机械缩放。night marker 与 dusk accent 使用预乘 alpha Bilinear 避免 Lanczos 下采样绿偏，其他精修图保留 Lanczos；不允许代码重绘或改色。随后为避免单层稳定态过素，只把 morning／day／dusk 的既有 RGBA 裁切在透明画布上做整数像素位移；三者裁切 SHA 与 alpha≥8 像素数均前后相同，没有新增 Image2 调用、重采样、改色或重绘，累计仍为 20。发布时把 16 个非 frame 内容按声明顺序机械纵向打包为 `scene-atlas.png` 880×880、`marker-atlas.png` 144×576、`node-atlas.png` 192×768、`accent-atlas.png` 480×640，`frame.png` 独立，运行时固定 5 个唯一图片请求；最终 accent atlas SHA-256 为 `a1af92a465eeeeb6e7a47ac61bb62dc27cbca115e90b54fa0be325b98968169c`。不同 cell 不得重采样、混合、重复或跨语义复用，也不得用 CSS／Canvas／SVG path／代码几何绘制视觉主体。键盘与 motion-off 即时提交；reduced 只保留不超过 140ms 的纯 opacity；low performance／Save-Data 跳过 accent，但保持完整色场、四个语义节点和时间行为。图像 token 为 `20260809-wallpaper-time-switch-r4`；当日 `20260809-wallpaper-switch-calm-r1` 只是未上线草稿公开 token，最终由上方 8 月 10 日契约取代。该功能完全位于公开前端与浏览器存储，不接入 D1、MCP、能力注册、CLI 或远程 Worker。

## 2026-08-09 主站、Android 移动壳与后台动效精修

- 公共按钮、Knowledge 卡片与壁纸选择环统一使用 140ms 按下、90ms 松开的非对称节奏；键盘输入不等待按压、滚动或状态退场。四套壁纸换档特效只在 Home 首次进入时加载并预解码，非 Home 路由不产生这些装饰资源请求；手动选档使用显式 pending promise 保留乐观状态和最终持久化所有权，clock／focus／pageshow 只能复用同一请求，跨标签更新会使旧请求失效并重新协调。

- 公开主站统一采用短促 strong ease-out 进入、strong ease-in-out 的 FLIP 位移和可中断的浮层状态机。账户 popover 从右上展开，桌面 modal 居中、移动 sheet 从底部展开；重复开关会从当前计算帧继续，关闭副作用只提交一次。账户登录／注册／已登录状态只做低频 opacity + 4px 过渡，键盘触发不等待动画。
- Android／窄屏移动壳保持既定方向滑动与共享 Dock 选中底板，底板只通过 transform／opacity 移动，收起把手使用 scaleX；Home 左右滑动按真实移动距离与速度判定。Knowledge 的搜索、分类、回顶和卡片反馈在键盘、reduced、off 模式下不触发空间跳动，骨架屏使用单层 transform 扫光；Chat 只在用户不在底部时显示可中断的未读提示。
- `prefers-reduced-motion` 只保留短促 opacity／颜色语义并移除位移，站内 motion-off 硬停；键盘 click、Enter／Space、Escape 立即提交，hover 动效仅在支持 hover 的细指针设备启用。后台同步了触发按钮级 busy／`aria-busy`、压力条、移动抽屉／遮罩、对话框、地图 tooltip 与 Quick Transfer 请求反馈；后台私有细节记录在 `admin/docs/`，没有写入公开更新正文。
- 公共缓存 token 为 `20260809-motion-polish-r2`，后台为 `20260809-admin-motion-polish-r2`，Transfer 管理为 `20260809-transfer-motion-r2`；公开更新 `seed-update-2026-08-09-motion-polish` 同步 fallback、Home 五条投影、Functions 和 schema seed。Quick Transfer 在最新 1.0.9 之上精确升级至 1.0.10，但业务协议、口令、AES-GCM、私有 R2、滚动配额、鉴权与发布后 24 小时生命周期不变。本轮没有修改 MCP／能力注册、CLI、远程 Worker 或其维护文档。

## 2026-08-09 站长远程 MCP OAuth 生产写闭环验收

- 独立生产 Worker `lusu-site-admin-mcp` 已部署，canonical resource 为 `https://lusu575.com/mcp`，2026-08-09 完成真实站长浏览器 OAuth 验收的 version ID 为 `fa295db6-302a-4a20-a2b1-ffe1ddafd75b`。它用标准 OAuth 2.1 authorization code + PKCE S256、精确 RFC 8707 resource、动态注册／CIMD 和 `content:read`／`content:write`／`content:delete` 最小 scope 暴露九个工具：`site_capabilities`、`content_list`、`content_search`、`article_get`、`article_manage_list`、`article_manage_get`、`article_publish`、`article_update`、`article_delete`。它不接受站点设备 Bearer，不传递 `lusu_session`，也不把 OAuth token、code、state、cookie、IP、回调或文章正文写入日志。
- 远程管理工具与 Pages 设备通道复用 `functions/api/agent-article-service.mjs`；发布／更新／删除继续把条件 mutation、三语内容、审计和幂等收据放在同一 D1 batch。OAuth provider token 经 provider 公共 `unwrapToken()` 解包后仍独立复核过期时间、精确 audience、client、scope 与 D1 active grant；管理员角色丢失会撤销 grant，并让下一次调用返回标准 401 challenge。动态注册限流使用 HMAC-IP 与 D1 原子 UPSERT，授权页使用一次性 KV flow、登录态、CSRF、三语同意信息和 loopback 警告。
- OAuth `grantRef` 是 16–128 位 base64url 标识，合法首字符包括 `-` 与 `_`。授权 flow、D1 ledger 和 transport-neutral 文章服务必须使用同一精确契约；设备 Agent token 的较宽内部引用格式仍独立校验，不能用统一正则误拒绝合法 OAuth grant，也不能借兼容修复放宽设备 token 或允许点、冒号、斜线进入 OAuth grant。
- 生产 `OAUTH_KV` 已绑定，Production D1 migration 已完成；远程迁移成功判定会逐项回读 `mcp_oauth_grants`、`mcp_oauth_audit_log`、`mcp_oauth_registration_limits` 三张表、完整关键列集和五个必需索引，并继续遵守单组最多五项的 Production D1 复合查询上限。正式域名 OAuth protected-resource／authorization-server metadata、DCR、未鉴权 `401 WWW-Authenticate` challenge、浏览器 Origin 拒绝和非 allowlist pathname 拒绝的线上 smoke 已通过。相关九项能力的 `availableTransports` 已包含 `remote-mcp`。独立 `workers/site-mcp/` 只保留四个公开工具的复用注册层与非 canonical 无 OAuth 目标，生产入口和五个站长工具均由 `workers/site-admin-mcp/` 承载。
- 2026-08-09 真实站长在普通顶层浏览器 OAuth 页面核对并点击 Allow 后，验收确认 `tools/list` 九个工具与 `site_capabilities` 四项公开能力均正确，并完整通过受控文章原子发布、同载荷幂等回放、管理列表／详情读取、最新 revision CAS 更新、zh／en／ja 三语公开回读、`confirm: true` 永久删除、三语删除后 404 和 grant 撤销；临时验收文章已删除。该结论只适用于上述精确生产 Worker bundle；以后每个新的生产 Worker bundle 都必须重新完成真实浏览器 OAuth 与同等完整闭环，不得拿历史验收冒充当前版本验收。全站所有功能的远程 MCP 与已打开浏览器游戏的配对／接管仍未实现。

## 2026-08-07 AI 能力层第七阶段：人生重开与知识库原子 MCP

- 主能力层新增 `life-restart` 集成式本地游戏适配器，固定适配 `VickScarlet/remake` commit `a10861eed93296c96d0e0fca98c82e86f4dfda4b` 的 MIT 语义，并对项目内 `zh-cn` age／talents／events 数据逐文件校验固定 SHA-256。当前仅支持 Custom 模式和 `choose_talents`、`allocate_properties`、逐年 `advance`、终局 `restart_life`、确认 reset。状态 schema v2 为每轮保存起点 checkpoint；恢复时从该 checkpoint 按固定数据、版本化 PRNG 和动作数重放当前人生，再与完整状态深比较，不能信任调用方保存的年龄、历史描述、已见事件、激活天赋、随机状态或 revision 等派生字段。它不导入浏览器／云存档，不提供页面 bridge、配对、观看或接管；`en-us` 数据与中文文件字节相同，因此目录只声明中文 Agent 内容。
- 通用 `GameSessionStore` 在加入第二个集成适配器前完成独立锁硬化：锁是包含随机 owner／heartbeat marker 的非空目录，记录 PID 与进程实例 token；存活或不可确认 owner 一律失败关闭，陈旧恢复与释放都先按精确 token／身份迁入私有 retiring 路径，再核验内容哈希和文件身份。会话 rename、close、TTL 删除及并发 create 在不可逆操作前执行 owner fence，Windows sharing violation 只做有界重试；`observe`／`actions` 保持零写入、零续期、零清理。超过 4 KiB 且压缩后确实更小的 action 幂等结果使用带原始长度与 SHA-256 的 `deflate-raw-base64-v1` 存储；解压输出限制为 96 KiB，非规范 Base64、长度／哈希篡改和膨胀输入失败关闭，既有未压缩收据继续兼容。该实现没有复制或导入 GPL Hextris 代码。
- 本地 stdio MCP 0.7.0 新增知识库管理员工具：`article_manage_list`、`article_manage_get`、`article_publish`、`article_publish_files`、`article_update`、`article_delete`。`article_publish` 在一个 D1 batch 中原子写入文章、zh／en／ja 三语正文、审计事件和持久幂等收据；`operationId + canonical payload SHA-256` 支持精确重试并拒绝异载荷或跨动作复用。文件发布只读取 MCP allow-root 内真实、非符号链接、有效 UTF-8 的 Markdown，路径不离开本地进程。更新和删除要求 `expectedUpdatedAt` CAS，删除还要求 `confirm: true` 与独立 `content:delete` scope；两者也把条件 mutation、审计与收据放进同一 batch。收据由周期健康检查按 180 天边界有界清理，调用方必须永久生成新 operationId，只有保留窗口内保证精确重放。
- `content:write` 与 `content:delete` 是非默认、管理员专属设备授权 scope。普通 Agent Bearer 仍不继承 admin，也不能访问 `/api/admin/*`；授权页和每次 `/api/agent/articles*` 请求都会重新核对令牌所属账号当前仍为管理员。通用文章 Agent 明确拒绝 `site-updates`、`daily-ai-news`、`tool-radar`，不能绕过公开更新或专用自动投递规则。该第七阶段记录时，独立 `workers/site-mcp/` 仍是未部署的公开只读目标且不包含写工具；当前生产远程状态以上方最新部署段为准。
- 公开三语更新、fallback、Home 最近五条、Functions seed、schema seed、公开 API／文章 seed／主模块缓存统一使用本阶段知识库写入版本；共享 registry／SiteClient／CLI／stdio MCP／Agent Auth 属于 Quick Transfer 受治理路径，因此 Quick Transfer 从 1.0.6 精确升至 1.0.7，业务房间、密码、加密、R2、multipart、配额与 24 小时生命周期未改变；在线画板保持 1.0.7。

## 2026-08-07 AI 能力层第六阶段：Hextris 独立游戏进程

- 游戏机器目录现在真实区分两种适配面：2048 继续是主能力层内的 `integrated` 本地会话并保留页面语义 bridge；Hextris 新增 `dedicated-process` 本地会话，但明确没有 browser bridge、页面配对、观看或接管。其余三款游戏仍只可发现。目录 `agentOnly` 只返回前两款，并逐项返回 `localSession`、`browserBridge`、`browserPairing` 与 `surface`，不能再用单一布尔值扩大承诺。
- Hextris Agent 是 `games/hextris/agent/` 下自包含的 GPL-3.0-or-later 程序，包含确定性引擎、独立会话存储、专用 CLI、专用 stdio MCP、测试、完整许可证与来源／修改说明。它不导入主站 `lib/capabilities/`、`cli/` 或 `mcp/local/`；主 `lusu` CLI 和通用 MCP 也不静态包含它。当前只能把它作为单独进程启动，未经单独的兼容性评估和站点所有者明确许可证决定，不得把实现并入通用能力层。
- 专用 Agent 由用户从 GitHub 源码仓库取得和在本机运行，`config/public-production-build.json` 整目录排除 `games/hextris/agent/`，不把含包元数据的本地进程复制到 Pages `dist`；浏览器 Hextris、完整浏览器许可证和 NOTICE 仍正常部署。这个构建边界不改变专用 CLI／MCP 的源码可得性。
- 引擎只接受 `{ type: "place", lane: 0..5 }` 语义动作；可选种子使 incoming block 和状态演进可复现。专用会话继续使用 revision CAS、`clientActionId` 最近 128 条幂等收据、32 会话／256 KiB／24 小时闲置上限，以及带随机 token marker 的非空目录锁。锁记录 PID、进程实例与心跳；存活 owner 一律失败关闭，只有精确陈旧 owner 才可恢复；释放先把同一 token marker 进入 retiring 状态，写入／删除在原子替换前再次执行 owner fence，旧 owner 或恢复者都不能删除 successor。observe／actions 真正只读且不续期，reset／close 必须显式确认；这些保证只适用于隔离模拟会话，不代表浏览器游戏控制。
- 浏览器 Hextris 副本补齐 GPL-3.0-or-later 全文、SPDX／修改说明和上游 attribution；2048 也补回完整 MIT 文本与来源说明。公开三语更新为 `seed-update-2026-08-07-hextris-agent`，同步 fallback、Home 最近五条、Functions seed 与 schema seed，公开 API／文章 seed／主模块缓存版本为 `20260807-hextris-agent-r1`；在线画板保持 1.0.7，Quick Transfer 保持 1.0.6。该阶段当时独立远程 MCP Worker 尚未部署；当前状态以上方最新部署段为准。
- 发布凭据扫描覆盖受管理源码及工作树中新建源码，但按精确路径排除子项目已忽略的 `自动新闻/data/mcp-runs/` 本地运行证据。该目录会保存外部检索正文，可能自然出现形似 JWT 的文本；排除只作用于这个运行证据前缀，不改变密钥识别规则，也不扩大到其他源码目录。
- 异步回归不能用固定次数的 1ms 计时轮询推断请求已经开始；Chat 私房切换测试由 mock 请求直接发出 deferred 信号，再断言 single-flight 与 busy 状态，避免 Linux 共享 runner 的计时器饥饿造成假失败。

## 2026-08-06 AI 能力层第五阶段：在线画板图片闭环

- 两轮生产闭环先后确认 Phase 5 Pages 全局 mutation gate 漏列精确 Agent 图片上传和 Agent Yjs 场景更新。1.0.6 将 raster 特例严格扩展到 `POST /api/whiteboard/agent/assets` 的 PNG／JPEG／WebP；1.0.7 只让精确 `POST /api/whiteboard/agent/scene` 且 `application/vnd.yjs-update` 跳过 JSON 门禁。两项例外都在同源检查之后，后续 Agent Bearer、scope、tokenId 绑定房间令牌、operation ID、正文／容量限制、图片和只追加场景校验均未放宽；跨源、相邻路径、非 POST 和其他 MIME 继续失败关闭。两次修复都未命中 Quick Transfer 受管路径，因此 Quick Transfer 保持 1.0.6；公开记录沿用原文章，表示／文章 seed／白板公开模块缓存修订为 `20260806-whiteboard-agent-images-r3`，Quick Transfer 模块缓存继续使用 r1。
- 在线画板 Agent 通道新增真实图片上传、当前房资源下载与高层图片放置。`whiteboard:assets` 是独立、非默认 scope：上传要求 `whiteboard:write + whiteboard:assets`，原图读取要求 assets 加场景 read（现有 write 可满足 read）；场景中的图片分支也必须由 Pages 通过 internal secret 保护的内部 header 显式授权，只有普通 write 的客户端仍被 DO 拒绝。
- 图片只接受最大 5 MiB、严格容器边界、关键块段、声明宽高和像素数均通过检查的 PNG／JPEG／WebP；该边界不宣称完整像素解码。Agent Bearer 与绑定当前 tokenId 的房间访问令牌保持分离；资源只存当前房私有 R2，Pages／DO 都不接受 URL、Base64、SVG、HTML 或跨房 asset。CLI 使用真实常规文件，stdio MCP 进一步执行 allow-root／realpath／链接逃逸防护；下载默认独占创建、不覆盖已有文件，结果不回显本机绝对路径、令牌、口令或内部房间 ID。
- Durable Object 的 scene validator 保持只追加：新增图片只能引用当前房已经完成 R2 提交且逐字段匹配的权威 `ImageMeta`，规范 `assets` 记录必须被本次新增图片引用；允许未修改地复用既有规范记录和多次放置同图。既有元素／资源的修改或删除、孤立资源、伪造元数据、链接、绑定、`customData`、未知根和任意 Yjs 字节注入继续失败关闭。
- Agent 图片上传使用与 scene 分离的主体 + operation ID + 图片 SHA-256 收据。DO 先固定 pending 收据并据此预留容量，写入 R2 后再以事务提交 `ImageMeta`、房间用量与 committed 收据；中断后同字节重试只补全同一资源，不重复计数，异载荷复用 ID 返回冲突。pending 资源不能被 scene 引用，房间锁定也阻止新上传和 pending 续传；未引用清理、每房 100 张／100 MiB、公共房永久保留规则和密码房空房 24 小时生命周期继续生效。
- 本地 CLI 提供 `whiteboard asset put|get`，stdio MCP 提供对应图片上传／下载工具；`whiteboard draw`／`whiteboard_draw` 的 allowlist 新增 `image`，但仍不提供编辑、删除或任意 Yjs。JSON 导出保留资源引用，简化 SVG／PNG 导出继续忽略图片并返回警告。该阶段当时独立 `workers/site-mcp/` 尚未部署且没有增加远程写入；当前生产九工具仍不包含白板能力。
- Capability registry 新增冻结的 `requiredScopes` 与 `anyOfScopes` 机器契约，用于表达“全部满足”与“至少一个”而不让 AI 客户端只凭单值主 scope 猜权限；图片上传是 write+assets，图片下载是 assets+(read|write)，图片场景追加是 write+assets。
- 在线画板按受管路径从 1.0.4 精确升至 1.0.5。共享 Agent Auth、registry、`SiteClient`、CLI、stdio MCP 与测试同时命中 Quick Transfer 治理范围，因此互传从 1.0.5 升至 1.0.6；互传业务协议、口令、AES-GCM 文字、私有 R2 文件、滚动配额、Multipart、鉴权与 24 小时过期均未改变。公开记录为 `seed-update-2026-08-06-whiteboard-agent-images`，表示／文章 seed／主模块缓存版本为 `20260806-whiteboard-agent-images-r1`。

## 2026-08-06 Agent 设备授权浏览器确认修复

- 生产设备授权页点击 Allow 曾稳定返回 `AGENT_ORIGIN_REJECTED`。根因不是账号、主域登录态或跨站 GET：授权／令牌管理 HTML 的 `Referrer-Policy: no-referrer` 会让浏览器非 CORS 表单 POST 发送字面值 `Origin: null`，随后被服务端精确同源检查正确拒绝；同一问题也影响 `/api/agent-auth/tokens/manage` 的逐个撤销和全部撤销。
- 修复只把授权与令牌管理 HTML 改为 `Referrer-Policy: strict-origin`，使 POST 保留当前授权页的精确来源且不携带路径或 `user_code` 查询；JSON 响应继续使用 `no-referrer`。精确 Origin、HttpOnly 登录态和双提交／D1 绑定 CSRF 都没有放宽，缺失／`null`／当前页面异源／攻击者 Origin 仍失败关闭。
- 授权 GET 允许从 CLI、Codex 或外部网页打开的顶层 `navigate + document`，不再因 `Sec-Fetch-Site: cross-site` 单独拒绝；iframe、图片、XHR/fetch 等非顶层上下文继续拒绝。GET 只轮换短期 CSRF 绑定，不批准、拒绝或签发令牌；授权决定仍只发生在通过同源与 CSRF 的 POST。
- 因修改命中共享 `functions/api/agent-auth.mjs`，Quick Transfer 按治理规则从 1.0.4 精确升至 1.0.5；互传房间、口令、AES-GCM 文字、私有 R2、Multipart、配额、鉴权和发布完成后 24 小时生命周期均未改变。公开更新为 `seed-update-2026-08-06-agent-auth-form-origin`，表示／文章 seed／主模块缓存版本为 `20260806-agent-auth-form-origin-r1`；该修复发布时独立远程 MCP Worker 尚未部署。

## 2026-08-06 AI 能力层第四阶段：日语账号进度闭环

- “日语的言外之意”新增面向本地 CLI／stdio MCP 的账号能力：`japanese-subtext:progress:read` 读取当前关卡、已解锁关卡、通关／奖牌汇总、可选单关进度与最多 90 天的有界活动；`japanese-subtext:progress:write` 提交语义答题。两项 scope 都不是设备登录默认权限，Agent Bearer 只映射自己的普通用户记录，不能继承 admin 或读取他人进度。
- Agent 写入不复用浏览器完整进度快照 PUT。调用方只能提交已解锁关卡 ID、关卡 revision、64 位 contentHash、完整逐题选项、进度 expectedRevision 与 operationId；服务端重新读取锁定题库并计算分数、通关、奖牌、尝试次数、活动和下一关解锁，拒绝客户端派生字段、旧题库、旧 revision、漏题／重题／未知选项和同 ID 异载荷。
- Agent 辅助答题固定按 `bilingual` 记录，`usedTranslation`／`usedKana` 为 true、`usedListeningMode` 为 false，通关奖牌最高为 bronze，不能冒充纯听训练金牌。Agent 活动按固定站点时区 `Asia/Shanghai` 归日，进度响应显式返回该时区。幂等收据绑定用户、operationId 与 canonical payload SHA-256；相同载荷在 180 天保留窗口内重放不重复计次，换载荷复用返回 409；客户端必须永久生成新 operationId，不能把过期清理后的旧 ID 当成可复用 ID。浏览器 Cookie GET／PUT 的多设备合并语义保持不变。
- 设备码授权轮询在一次网络失败、请求中止或 408／425／500／502／503／504 等明确瞬态故障后，会在设备码剩余有效期内有界退避继续；不会输出访问令牌、代理值或底层网络细节。批准和一次性令牌签发仍由站点用户在浏览器明确完成。
- 本次不改日语公开界面、250 关题库、音频或存档兼容边界，因此工具 `appVersion` 保持 1.0.3、`contentVersion` 保持 1.0.2。因 `agent-auth.mjs`、registry、`SiteClient`、CLI、stdio MCP 与相关测试属于 Quick Transfer 共享受管路径，Quick Transfer 从 1.0.3 精确升至 1.0.4，但互传房间、口令、加密、R2、Multipart、配额、鉴权与 24 小时生命周期均未改变；在线画板未命中受管路径，仍为 1.0.4。
- 该第四阶段记录时，独立 `workers/site-mcp/` 尚未部署，且没有接入日语账号读写或其他远程写能力。公开更新记录为 `seed-update-2026-08-06-japanese-agent-progress`，公开/API/文章 seed 与主模块缓存版本为 `20260806-japanese-agent-progress-r1`；该阶段的正式上线仍必须完成本地门禁、Production D1 migration／回读、GitHub `main` 合并、Pages 部署与正式域名点检后再记录为已发布。

## 2026-08-06 AI 能力层第三阶段：公开只读能力扩展

- 本地 CLI 与 stdio MCP 在既有文章列表／搜索／详情和视频列表之外，补齐单个视频详情、真实工具目录、游戏目录，以及“日语的言外之意”等级／关卡列表／单关详情。工具目录只公开在线画板、Quick Transfer 和日语工具三项真实入口；占位卡片没有稳定 `toolId`，不得进入机器能力面。
- 游戏能力把 `games/catalog.json` 投影为有界安全字段：稳定 ID、三语标题与摘要、语言支持、同源启动路径、许可证／仓库和真实 Agent 支持状态。`sourceEntry`、存储键、默认值、内部语言映射与任意启动参数不对机器客户端开放；当前只有 2048 声明隔离本地会话与页面语义 bridge，其他游戏不得误报为可接管。
- 日语题库能力只访问固定 catalog、五个固定 level index 和由关卡 ID 推导的固定 batch，验证 schema/contentVersion、250 关计数、唯一 ID、64 位 SHA-256、`textLocked: true` 与路径边界；输出省略批次路径、内部音频文本和构建字段。它只读取公开题库，不读写用户进度，应用版本仍为 1.0.3、内容兼容版本仍为 1.0.2。
- 新适配器统一限制 zh／en／ja、ID、查询长度、列表上限、响应字节与同源／GitHub URL；CLI、MCP 和测试复用 `SiteClient`／目录适配器，不复制业务规则。该第三阶段记录时，`workers/site-mcp/` 尚未部署且只保留原来的公开文章只读实现，本阶段没有新增公网 MCP 地址或远程写能力。
- 本地 credential 现在与设备登录时的规范化 HTTP(S) origin 绑定；`--base-url`、`LUSU_BASE_URL` 或 MCP `baseUrl` 切到 Preview／其他 origin 时不会复用、发送或删除生产 Bearer。只有操作者显式提供的 stdin／环境 token 才绑定当前覆盖 origin，CLI 普通命令、auth status/logout 与 stdio MCP 共用同一匹配规则。
- 因 registry、`SiteClient`、CLI 与本地 MCP 位于 Quick Transfer 的共享受管路径，Quick Transfer 按治理规则从 1.0.2 精确升至 1.0.3；房间、口令、文字加密、文件存储、配额、Multipart、鉴权和 24 小时生命周期均未改变。
- 因固定工具目录同时新增 `whiteboard` 能力域和 `/tools/whiteboard/` 入口契约，在线画板按治理规则从 1.0.3 精确升至 1.0.4；三项工具契约按工具拆分，白板与 Quick Transfer 只追踪各自专属模块。共享目录的可见版本再以项目 `toolId` 锚点、有界窗口和精确模板校验，既避免机器入口或卡片版本变化绕过升版，也不让无关工具变化误触。画板房间协议、Agent scope、Yjs／DO／R2 与生命周期均未改变。
- 本批公开记录为 `seed-update-2026-08-06-agent-read-breadth`，公开/API/文章 seed 与主模块缓存版本为 `20260806-agent-read-breadth-r1`。Phase 3 已通过 PR #8 合并到 `main`，提交为 `48bf92c9ce1dd2423eea902fcee2ee287075efb9`，GitHub 触发的 Cloudflare Pages Production 部署和正式域名只读点检均通过；该阶段范围明确不部署独立远程 MCP Worker。
- 本地最终验证：根测试 522 / 522，白板前端 8 / 8、Worker 44 / 44，Quick Transfer 50 / 50，2048 14 / 14，未部署远程 MCP 工程 4 / 4；Lint、TypeScript、21 模块公共依赖图、子项目治理、正式构建和连续双构建复现均通过。Headless 公开界面 release 审计通过 192 项（147 个路由／语言／视口组合），A Dark Room 旋转专项通过；产物清单 SHA-256 为 `044bb4a3ea16f1685854b6148d54ba4cd595af9d8dece78321b9d15a2fecae0c`。Production D1 迁移／回读、Pages deployment 与公开线上点检也已完成；Quick Transfer 的真实文件全链路仍需一次用户设备授权后再验。

## 2026-08-06 AI 能力层第二阶段：在线画板与 2048

- 在线画板子项目升级到 `v1.0.3`。站点 Agent Auth 新增非默认 `whiteboard:read`／`whiteboard:write` scope；Pages 提供 Agent 加入与 scene GET/POST，并将 Agent Bearer、绑定当前 tokenId 的房间访问令牌和 DO 内部授权分层。密码仍只通过同源 HTTPS 请求体交给服务端 HMAC 映射，不进入 argv、URL、日志、遥测、MCP 输出或本地明文状态。
- Durable Object 的 Agent 更新保持严格追加式：调用方必须先读取最新完整 Yjs scene，单次只新增 1–50 个受支持的高层元素；图片还必须具有独立 assets 授权，并逐字段引用当前房已完成 R2 提交的权威资源。服务端在候选文档上拒绝既有元素／资源修改或删除、孤立资源、嵌入、链接、绑定、customData 与未知根数据，并对文字、坐标、点数、更新字节和完整文档大小设限。`operationId + payload SHA-256` 幂等收据、文档增量与版本在同一 DO transaction 落盘；同载荷重试不重复绘制，换载荷复用 ID 返回冲突，锁定房拒绝写入。
- `cli/lusu.mjs` 与本地 stdio MCP 已实现白板加入、scene 摘要、图片上传／下载、追加高层元素或当前房图片，以及本地 JSON／SVG／PNG 导出。私房只允许隐藏 stdin 或 `env:NAME` secret reference；本地 `whiteboards.json` 保存不透明 `board_...` 句柄、房型、到期时间、访问令牌与可选引用，不保存密码或图片路径。句柄 read-modify-write 使用跨进程 owner-token 锁，同目录 0600 临时文件 fsync 后原子替换目标，避免并发加入／401 刷新丢写和崩溃截断。简化 SVG／PNG 当前忽略图片并返回警告；编辑、删除与任意 Yjs 注入仍不属于能力面。
- 2048 成为首个游戏 Agent adapter。浏览器游戏与本地会话共用纯确定性引擎，页面保留 `window.gamePage.save` 并新增冻结的语义 `window.gamePage.agent` bridge；本地 CLI／MCP 通过 `create -> observe -> actions -> act` 运行隔离会话，使用 revision CAS、clientActionId 最近 128 条去重、状态／会话数／闲置 TTL 上限和原子文件锁。锁包含唯一 owner、进程实例／PID 与心跳，释放前复核所有权；observe／actions 不落盘、不刷新过期时间，只有真实动作续期。重置与关闭需要显式确认。当前没有页面配对传输，因此不是接管已打开浏览器里的游戏。
- 该第二阶段记录时，`workers/site-mcp/` 仍是未部署的公开只读工程，不含白板或游戏工具。白板专用 Agent HTTP 通道使用站点设备令牌而非标准 OAuth，只服务当前本地 CLI／stdio MCP 边界；该阶段任何真正公网远程写入仍必须另行实现第一方 OAuth 2.1、最小 scope、撤销、审计与独立审核。
- 本批公开更新为 `seed-update-2026-08-06-whiteboard-2048-agent`，公开/API/文章 seed 与主模块／2048 缓存版本为 `20260806-whiteboard-2048-agent-r1`。生产发布固定先迁移并回读 Production D1，再部署和验证兼容 `lusu-whiteboard-do` Worker，最后合并 GitHub `main` 触发 Pages；独立远程 MCP 不在本批部署范围内。上线结论必须以 D1、Worker、Pages 和正式域名的实际回读为准。
- 本地验证结果：根测试 498 / 498、2048 14 / 14、白板前端 8 项与 Worker 44 / 44、远程只读 MCP 4 / 4；Lint、TypeScript、子项目治理、生产构建、双构建复现与 192 项 Headless public UI release 审计全部通过。产物清单 SHA-256 为 `111eb9274dc2e91398c0d8da974a2ed33852301cc67149886ab0c16e2d160df9`；这些结果不代替线上 D1／Worker／Pages 验收。

## 2026-08-06 AI 能力层第一阶段（历史基线）

- 站点新增统一能力注册表 `lib/capabilities/registry.mjs`，用一份可机读目录管理内容、工具、游戏与后续适配状态。`transport` 只是该能力长期希望接入的目标面，`availableTransports` 才是当前已经实现、可向 AI 客户端承诺的真实面；查询、文档和工具列表均不得把目标面当成已上线能力。
- 该阶段真实可用的本地接入面是 `cli/lusu.mjs` 与 `mcp/local/server.mjs` 的 stdio MCP：支持能力查询、公开文章列表／搜索／详情、每日 AI 新闻、视频列表，以及授权后的 Quick Transfer 进房、列表、发送文字、上传、下载和删除。这两个入口都从 `自动新闻/integrations/lusu-site/network-fetch.mjs` 取得共享代理感知 fetch 并注入 `SiteClient`；`SiteClient` 本身只依赖注入的 fetch，不自行读取或输出代理值与凭据。Quick Transfer 因适配层升级到 v1.0.2，未扩大它对文件加密、容量或 24 小时生命周期的原有承诺。
- 机器授权由 `functions/api/agent-auth.mjs` 提供设备码确认和可撤销、有期限的最小权限令牌，范围固定为 `content:read`、`transfer:read`、`transfer:write`、`transfer:delete`。Agent Bearer 始终作为普通机器身份，不能进入管理接口或继承账号的 admin 角色；Quick Transfer 房间口令不发往服务端，不进命令行、URL、持久明文、日志或遥测，文字密钥在本地派生。
- `workers/site-mcp/` 是与 Pages 分离的无状态远程 MCP Worker 工程，目前只直接读取公开文章能力。该 Worker 仅完成仓库实现与本地验证，未部署、未配置正式域名，也没有远程写能力。当时在线画板、游戏 AI 接管及其余站内能力仅纳入 `planned`；后续本地能力状态以上方第二阶段记录和 registry 的 `availableTransports` 为准，任何对外远程写操作仍须先完成标准 OAuth 授权、逐能力权限与独立安全审核。
- 长期设计、本地使用和远程运维边界集中在 `docs/agent-capabilities/README.md`。本批公开更新为 `seed-update-2026-08-06-agent-capabilities`，表示版本为 `20260806-agent-capabilities-quick-transfer-r1`；记录的是本地仓库能力和未部署远程工程，不表示生产 D1 迁移、Worker 发布或正式 MCP 地址已完成。

## 2026-08-06 网站使用指南与密码房攻略

- Knowledge 新增固定分类 `site-guides`，公开名称固定为“网站使用指南 / Website Guides / サイト利用ガイド”。筛选顺序为 `daily-ai-news`、`tool-radar`、`site-guides`、其他动态分类，`site-updates` 始终最后；即使暂时没有文章，三个固定内容专区也必须保留入口和各自三语空状态。
- 首篇指南 article id 为 `seed-site-guide-whiteboard-chat-password-rooms-2026-08-06`，公开 slug 为 `whiteboard-chat-password-room-guide`。Functions 与 `cloudflare/schema.sql` 都提供 zh／en／ja seed，metadata 采用 insert-only，避免后续管理员编辑被启动 seed 覆盖；正文图片固定使用 `assets/images/articles/site-guides/` 下的四张内容哈希 URL，并在 Knowledge 图片尺寸表登记 1440×900 与 390×844 原始尺寸。
- 这篇文章只是把匿名聊天室与在线画板放在同一篇攻略里，不代表功能合并：同一密码不会让两项工具共享房间或状态。聊天室要求至少 6 字符，消息在浏览器端加密但不能宣传为绝对端到端安全；其私房按最后一条新消息计算 24 小时。画板密码为 4–128 字符，链接与本地存储不包含密码，画布仍同步服务端；其私房从最后一条真实连接离开后计算 24 小时，重入取消、再次空房重计，到期清理整房与图片。
- 本批公开更新记录为 `seed-update-2026-08-06-site-guides-password-rooms`，公开/API/文章 seed 版本为 `20260806-site-guides-password-rooms-r2`，Home 与顶栏日期为 2026-08-06。四张文章截图使用完整文件 SHA-256 作为查询版本键，避免部署前的 SPA 回退响应沿用旧缓存。此次没有修改 `tools/whiteboard/`、`workers/whiteboard/` 或 `docs/whiteboard/` tracked paths，因此不得连带提升画板 v1.0.2。

## 2026-08-06 每日 AI 新闻防漏审与证据事件复核

- 8 月 6 日漏新闻的根因不是抓取量不足：正式运行 `run-20260805T230214Z-c0ddb215` 已取得 1,997 条候选、403 条编辑信号候选和 29 条 RSS 候选，并发布 9 条；但临时编辑脚本把绝大多数拒稿按候选 ID 轮换套入 4 组固定分数与少量结论模板。豆包／SeedRealtime 等线索实际已进入候选索引，却没有得到逐事件、逐来源判断。此前只拦截“90% 完全相同类别与分数”的校验无法识别这种轮换模板。
- 2026-08-07 起的新 coverage manifest 除 `priorityReviewPolicy: all-discovered-candidates` 外，必须声明 `protectedEventReviewPolicy: evidence-backed-protected-events-v1`，删除该字段也会 fail closed。对应的 `coverageAudit.protectedEventReview` 独立于少于 5 条才触发的 `secondPass`：无论已入选多少条，都必须把全部 `editorialSignals`、RSS、实际受保护类别和 selected／merged 候选按 `eventKey + eventStage` 恰好聚类一次，并记录直达可靠 HTTPS 来源、事件当前阶段首次可靠发布时间、事实边界与四项具体评分理由。入选事件必须是 `verified-in-window`；无可靠证据时使用 `insufficient-evidence` 且不得伪造时间，窗口外事件使用有证据的 `outside-publication-window`。
- Google News、Reddit、Hacker News 与 Bing 聚合页不能作为受保护事件的最终证据 URL。校验器还会拒绝候选量充足时只轮换不超过 8 组评分和不超过 32 种结论开头的批量拒稿，并拒绝至少一半事件复用相同证据摘要或评分理由。自动任务不得按候选 ID、hash、数组下标或标题模板生成编辑判断；脚本只能序列化已经完成的逐事件复核。
- 字节跳动发现不再依靠一个综合大 OR 查询：豆包中文／英文产品动态、Seed 通用模型、SeedRealtime／Seed-ASR／Seed-TTS／全双工语音分别成为 required 查询；原 `bytedance-models-zh` 降为小规模补充，Seedance／Seedream／Dreamina 继续保留独立创意模型通道。本次只修复后续生产链路和校验，没有自动重发或改写 8 月 6 日已发布日报。

## 2026-08-04 Daily AI News 代理感知投递与只读回读恢复

- 8 月 4 日自动任务不是生成或落库失败：Horizon 运行 `run-20260803T230334Z-73cc08cf` 在精确窗口内取得 2,064 条候选，8 条入选、101 条 merged、1,955 条具体 rejected，正式 validator 通过；生产 POST 已收到 `daily-ai-news + published`，随后只有日文公开 GET 抛出 `fetch failed`。再次以冻结 `daily_run.json` 只读核对后，中英日三版 slug、分类、语言、标题和正文全部逐字一致，所以本期不得再走 manual recovery 或重复 POST。
- 本机 Clash／Mihomo 使用 Fake-IP DNS，`lusu575.com` 可解析到 `198.18.0.0/15`；系统 curl／PowerShell 会通过系统代理成功，而 Node 原生 `fetch` 默认不会自动继承这条代理链。自动新闻所有正式 Node 外联必须使用 `自动新闻/integrations/lusu-site/network-fetch.mjs`：它以 Undici `EnvHttpProxyAgent` 读取大小写兼容的 `HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY`，无值时直连。不得打印代理 URL、代理凭证或投递 Token，也不得通过修改 Clash 订阅来维持生产可用性。
- 每日 AI 新闻生产 POST 在单次执行中严格发送一次。POST 明确返回 published 后，zh／en／ja 公开回读可分别对网络失败及 408／425／429／500／502／503／504 做最多 3 次只读 GET 尝试，且总预算不能越过自动 08:00 或人工恢复午夜截止；正文不一致、非瞬时 HTTP 或重试耗尽仍停止并标记需人工核对，绝不能再发 POST。工具雷达的生产目录、线上图片、POST 和三语回读也复用同一代理客户端，避免周更重复遭遇相同 Fake-IP 问题。
- Undici `7.29.0` 是直接、精确锁定的生产依赖，不再依靠 Wrangler 的传递依赖；根级 override 同步约束根依赖树使用该版本，并将受影响的 `brace-expansion` 依赖分别固定到 `1.1.18`／`5.0.9`。拥有独立 `package-lock.json` 的子项目不会继承根 override，必须在自己的 `package.json` 中重复所需安全 override 并单独执行完整 `npm audit`；`workers/site-mcp` 因此也固定 `undici 7.29.0`。Node.js 22 验证使用官方 SHA-256 校验的 v22.23.1 便携运行时；默认系统 Node 版本不能替代发布记录中的实际运行时证据。依赖更新后必须以严格 `npm ci` 重建并确认生产与每个独立锁文件的完整 `npm audit` 均为 0 漏洞。Windows 上不能用已有平台限定 `node_modules` 直接重写根 lockfile；应在不含 `node_modules` 的干净目录中用 Node.js 22 和 `--include=optional --include=peer` 生成，再以严格 `npm ci` 或 dry-run 验证 Linux／Cloudflare 所需的 optional peer 条目仍在。

## 2026-08-03 每日 AI 新闻编辑退化防护

- 8 月 3 日短稿的直接原因不是消息源不足：Horizon 在精确窗口内输出 1,399 条候选，67 个 required query 和 11 个 required group 均签收，但编辑记录将全部候选归为 `other`，其中 1,393 条机械落在 3／4 分。线上文章与运行稿一致，因此这是分类、评分和二审退化，不是前端漏显示。
- 新候选索引会在已知聚焦通道中，用中文、英文、日文和韩文的明确变化词标记模型／产品、能力／可用性、开发者工具、价格／额度、芯片／存储／机器人／智能设备／自动驾驶／数据中心基础设施、重大科技金融和 AI 监管／安全变化。这些信号不强制刊发，但强制候选进入与信号相符的受保护类别深审，不能用 `other + 4 分` 批量掉过。非中英日韩来源仍在全候选审阅中，这四种语言只是常用信号种子，不是来源白名单。
- 拒稿语义现在有硬性一致性：`below-importance-threshold` 表示候选确有实质变化但读者价值低于 7 分，因此 `substantiveChange` 必须为 true；`no-material-change` 则必须为 false。对 50 条以上候选全部归为 `other`，或 90% 以上拒稿共用同一编辑类别与完整四项评分模板的运行，校验器必须关闭投递。
- 入选少于 5 条时，二审 `completedAt` 必须严格晚于 `candidateIndexReviewedAt`；`reconsideredCandidateIds` 必须至少覆盖全部编辑信号候选、全部 RSS 候选与受保护类别的 5／6 分拒稿，也可以加入其他仍需复查的索引候选。这是防止空签收的最低复查清单，不改变“5 条仅触发复审、不强制凑数”的长期规则。本次修复只改工作流与本地校验，没有自动改写线上历史日报。

## 2026-08-02 免费额度余量、搜索发现与生产监控

- 当前流量策略优先保护必要业务：默认站内 D1 估算在 30,000 行进入预警、50,000 行进入硬保护；正常档页面／点击／文章采样均为 100%，预警档为 25%／10%／50%，硬保护档为 0%／0%／10%。这组阈值为当前 100,000 rows-written／UTC 日免费额度预留至少一半余量；实际官方用量只在只读 Cloudflare Analytics 连接成功后展示，站内估算不得冒充账单。仅精确等于 2026-08-01 旧默认 JSON 的存量配置自动迁移，任何管理员自定义值保持不变。
- 公开 telemetry 的 page view 已经建立匿名 cookie、身份行和访客资料，因此首访不得再串行调用单独 identify；同一目标一秒内的重复 click 由浏览器抑制，服务端原有采样、限频与去重继续作为可信边界。公共遥测保护判定复用最多 5 分钟的站内用量快照，减少反复读取当天事件；后台人工面板继续每 30 秒强制获取新快照。180 天有界后台清理必须独立覆盖 page view、click 和 article view，单表异常不能阻止其他表尝试清理。
- `sitemap.xml` 是固定 canonical 资产：origin 为 `https://lusu575.com`，首页 `lastmod` 来自最新已发布内容，首页／日语工具／公开文章均输出 zh、en、ja 和 x-default alternate。`/articles/<slug>` 的边缘 HTML 同步输出这组 alternate，并在 Article JSON-LD 中给出文章 URL、Person 作者和 Organization 发布者。
- 仓库包含低流量生产冒烟脚本与 GitHub workflow：在主线 `Verify` 成功后及每 12 小时检查 `/api/health`、Home、sitemap、一个文章直达页和一个哈希静态资产；使用超时、有界重试和并发取消，不通过高频探测消耗免费额度。该 workflow 只有提交到 GitHub 后才会运行；未实测生产不得声称监控已生效。
- `www` 到 apex 的永久跳转不能由 Pages Functions 之前的 `_redirects` 可靠替代，仍列为 Cloudflare Dashboard 配置与验收项；Cloudflare Web Analytics／RUM 也必须在 Dashboard 实际启用并取得真实数据后才能声称完成。当前环境没有可用 Chrome DevTools 性能 MCP，因此本次只完成代码、合同测试和低频线上探针，不把静态审计冒充真实 Core Web Vitals trace。
- 本批公开记录为 `seed-update-2026-08-02-traffic-discovery-monitoring`，公开／API 表示版本与文章 seed 标记为 `20260802-traffic-discovery-monitoring-r1`；Home 继续只投影最新五条且不带正文，顶部最近更新日期为 2026-08-02。后台 JS query 独立为 `20260802-traffic-budget-r1`，未变化的后台 CSS 保持原 query。

## 2026-08-01 画板 v1.0.2 安静同步与空房休眠

- 公共画板和所有密码房显式共用同一个 `ALL_ROOM_SKETCH_APP_STATE`：暖白纸、石墨线、hachure、roughness 2、92% 不透明度。当前没有按房型分支的第二主题；用户仍可修改颜色、线宽和工具。
- 可见客户端每 60 秒发送纯文本 `ping`，`WhiteboardRoom` 用 `WebSocketRequestResponsePair("ping", "pong")` 在边缘自动响应；普通保活不进入 WebSocket message handler，也不唤醒已休眠 DO。标签页连续隐藏 60 秒后先有界排空未确认 Yjs 更新，再以 `page-hidden` 正常关闭；回到前台重新取票、连接并差异同步。
- Yjs 文档更新只在真实变化时按 250／500／1000ms 批处理；游标降为 100ms 临时广播。每次 ACK 仍以 DO SQLite transaction 中的 update + `room:meta` 为准，不先确认；删除了 update 成功后第二次重复 `room:meta` 写入，持续绘制期间 D1 `whiteboard_rooms` 摘要最多约每 60 秒同步一次。没有画布变化就没有文档帧或持久化写入。
- 有真实 socket 的房间从每 15 秒闹钟改为每 5 分钟失联兜底，使用业务消息与 auto-response 的最近时间判断 7 分钟超时；稳定成员数不再每轮重复更新 `lastActiveAt`、DO 元数据和 D1。设置 Alarm 前比较现有计划，避免每次唤醒重写相同或更晚时间。
- 空公共房不再安排周期生命周期 Alarm，画布仍永久保留；ticket JTI、未引用资源或限频状态只按真实到期时间生成一次性任务。空密码房仍以最后离开为起点安排 24 小时整房删除，重入取消、再空重计。
- 连接提示延迟 3 秒：短暂抖动完全不新增提示，持续重连只在画布角落显示小状态，不再用中央横幅或“发生了错误”打断绘画；权限、协议、容量和文件错误仍显示明确可处理信息。公开记录为 `seed-update-2026-08-01-whiteboard-calm-efficient-sync`，表示与 article seed 版本为 `20260801-whiteboard-calm-sync-r1`；协议变化继续要求先部署验证 Worker，再合并 `main` 发布 Pages。
- 子项目版本与内部资源缓存键保持独立：本次没有修改 Quick Transfer 的受治理实现，因此它继续使用 `v1.0.1` 和 `20260801-whiteboard-reliable-sketch-r1`；主站或画板发布只更新真实发生变化的资产，不得为了统一字符串而让未变化子项目触发虚假版本升级。

## 2026-08-01 画板可靠保存、铅笔草图风与子项目版本治理

- 画板的“发生了错误”和重进后线条消失具有同一根因：Excalidraw 每次变化都立即发一个 Yjs update，快速绘制会超过小文档每连接 24 update/s 限制；Worker 以 `1008/rate_limited` 关闭后，旧客户端将所有 1008 当作不可恢复权限错误，且在没有持久化回执的情况下已丢弃发送队列。这是服务端同步协议问题，与访客电脑或所在网络无关。
- `1.0.1` 客户端将连续更新用 `Y.mergeUpdates` 合并，一次仅保留一个 in-flight update，并按 Worker 下发的 60/200/600 ms 间隔发送。Worker 仅在增量和 `room:meta` 版本已持久化后回复 `update-accepted`；未回执时断线会重新入队并在重连后幂等重传。`rate_limited`、`sync_budget_exceeded` 和回执超时属于可恢复故障；真实访问、禁用和协议错误才终止重连。
- 公共房 `public-v1` 的线条、已引用图片和快照不参与空房 TTL，在 DO 重启、用户退出和重进后继续保留，只有管理员显式清空才删除。密码房仍在最后一条真实连接离开后计时 24 小时，重入取消，再次为空重计，到期整房清理 DO/R2/D1 索引。
- 画板的默认画布为暖白纸张，新元素默认使用石墨色、hachure 填充、roughness 2 和轻微透明度；这仅是可编辑的铅笔草图默认值，不禁止用户调色或选择其他工具。
- 在线画板和 Quick Transfer 现作为总站下的独立子项目治理，治理根分别为 `docs/whiteboard/` 和 `docs/transfer/`。两者均以 `VERSION` + `project.json` 保存独立版本，并维护 `README.md`、`CHANGELOG.md`、`AGENTS.md`与兼容入口 `AGENT.md`。任何命中各自 tracked paths 的更改都必须把该子项目版本精确增加 `0.0.1`，写子项目更新日志，同步所有受影响文档和根 `CHANGELOG.md`；CI 通过 `npm run check:subprojects` 核对。
- 本批公开记录为 `seed-update-2026-08-01-whiteboard-reliable-sketch`，公开/API 表示版本与文章 seed 标记为 `20260801-whiteboard-reliable-sketch-r1`。协议有新 Worker 回执依赖，因此发布必须先部署并验证 `lusu-whiteboard-do`，再合并 `main` 触发 Pages；未实际认证 Cloudflare 时不得宣称远端成功。

## 2026-08-01 账号恢复、D1 写入降压与后台流量保护

- 生产登录失败的直接原因不是访客网络：Cloudflare Pages Functions 的生产运行时会拒绝 PBKDF2 迭代数超过 100,000，而 2026-07-26 的 600,000 次策略会在旧 25,000 次哈希验证成功后的升级阶段抛出 5xx。账号新哈希、管理员密码重置和旧记录升级现统一为 PBKDF2-HMAC-SHA256 100,000 次；25,000 次记录成功登录后条件升级，100,000 次记录不重复写回。不能因为本地 Node／Miniflare 能执行更高迭代数就再次提高，生产平台行为是兼容边界。
- 公开账号提示现区分 `status = 0` 的本机／链路网络错误与 `5xx` 服务端暂不可用，不再把后端故障统一写成“检查网络”。密码、哈希、session 和账号标识仍不进入前端、日志或遥测。
- `ensureArticleSchema()` 只创建表和索引，不再在每个新隔离实例中执行完整文章 seed。`seedArticleTestData()` 先读取 `site_runtime_state.article_seed_version`；只有版本不是当前 `20260801-whiteboard-calm-sync-r1` 才在一个 D1 batch 中执行文章／三语 seed，并把当前版本标记作为最后一条写入。全新 `schema.sql` 也在全部 seed 完成后写同一标记，避免运行时再次重放。
- 管理后台新增“流量与写入”面板和 `/api/admin/traffic-control`。默认站内保护阈值为 UTC 自然日估算 60,000／80,000 行；正常采样为 100/100/100，预警为页面 50%、点击 25%、文章 75%，硬保护为页面 10%、点击 0%、文章 25%。总开关和分项开关只控制非必要遥测；登录、云存档、聊天室、互传与画板业务写入不受自动关闭。配置保存在 `site_runtime_state.traffic_control_settings_v1`，使用 `expectedUpdatedAt` 条件保存，陈旧页面返回 409 并保留输入。
- 面板的站内估算只覆盖可识别的页面／身份、点击、文章阅读和登录成功事件，并显式标为非账单数据。精确 `rowsWritten` 可选通过 Cloudflare GraphQL Analytics 只读连接获取；需要运行时配置 `CLOUDFLARE_ANALYTICS_API_TOKEN`、`CLOUDFLARE_ANALYTICS_ACCOUNT_ID`、`CLOUDFLARE_ANALYTICS_D1_DATABASE_ID`。Token 只放 Pages Production Secret，不写代码、文档值、聊天、日志或 Git；未配置时面板必须明确显示“未连接”，站内保护仍可运行。
- 本批公开记录为 `seed-update-2026-08-01-service-reliability`，公开／API／后台资源版本为 `20260801-service-reliability-r1`。远端 D1、GitHub `main`、Cloudflare Pages 与正式域名状态仍须以本次实际发布核验为准，不能从本地文件推断成功。

## 2026-08-01 每日 AI 新闻韩国模型查询分片

- 韩国开放模型发现不再使用跨厂商的 `korean-model-releases-ko` 大型 OR。该查询在 2026-08-01 固定窗口连续触发 99+1 真实截断；正式目录现固定为 `lg-exaone-open-ko`、`lg-exaone-release-ko`、`lg-ai-research-other-ko`、`naver-hyperclova-model-releases-ko`、`upstage-solar-model-releases-ko` 五条互补查询，并已在同一窗口真实运行中分别以 26、6、10、46、13 条返回通过上限门禁。
- 五条分片都保持韩文／韩国、`required: true`、`mustReview: true`、`coverageGroup: open-models` 和 `reviewLane: open-weight-releases`。EXAONE 的开放／权重与普通发布动作通过排除词分流，LG AI Research 其他查询显式排除 EXAONE，NAVER／HyperCLOVA 与 Upstage／Solar 各自独立。以后单条 required 查询再次真实截断时，应继续按厂商或事件动作缩窄并保留完整签收，不能把截断签成成功、跳过韩文或恢复跨厂商宽查询。

## 2026-08-01 画板支线接管与本地构建隔离

- `agent/multiplayer-whiteboard` 已在 Node.js 22.23.2 下同步 lockfile，并以普通 merge 合入截至 `c8abc571` 的最新 `main`（含每日 AI 新闻完整候选复核与韩国模型查询分片）；后续验证以合并后的支线为准，不能只引用原始 `a7f1f80c` 的旧测试结果。
- `.codex-worktrees/` 是其他 Codex 任务的独立 checkout，不属于当前仓库源码。Git、构建守卫和仓库密钥扫描必须忽略该目录，避免旧工作树内容污染当前构建或产生虚假安全结果；不得通过删除其他任务工作树来让构建通过。
- Cloudflare Production D1 对复合 `SELECT` 的上限是 5 项；远程迁移的分组校验必须在写入前检查每条查询的 `UNION ALL` 项数，并把更多校验拆成多条查询。不能因 schema／索引导入成功就忽略随后校验器的非零退出，也不能用本地 SQLite 接受更长复合查询来推断生产 D1 会接受。
- Cloudflare 生产 D1、Durable Object Worker、Pages external binding、Secret、PR 合并和正式域名仍须按画板发布顺序逐项实际核验，本地通过不能替代远端状态。

## 2026-07-31 每日 AI 新闻完整发现审阅

- 正式日报不再以 priority、聚焦查询或指定来源决定审阅边界。精确窗口内写入 `candidate_index.json` 的每个候选都必须进入 `complete-discovery-review`，并在兼容字段 `coverageAudit.priorityReview.decisions` 中恰好得到一次 `selected`、`merged` 或具体 `rejected` 处置；`priority` 只决定审阅顺序。新 manifest 使用 `priorityReviewPolicy: all-discovered-candidates`，其 `mustReviewCandidateIds` 必须等于全部 candidate index 编号。
- 时间资格以事件当前阶段第一次由可靠来源公开的可核对时间为准；Google News、RSS 等聚合器的收录／刷新时间和 Reddit、Hacker News 等社区发帖时间都不能替代它。社区源只用于发现，候选事实与时间必须回到官网、规范原帖、可靠媒体、论文或其他一手来源核实。
- 多模态覆盖必须独立检查 Seedance 等视频、图像和语音产品的发布、延期、开放范围、API、权重与可用性变化。每一条发现候选都要处置，不能因综合查询未标 priority、文章已有五条或来源只是可选补充而静默跳过。

## 2026-07-30 工具区多人实时在线画板

- 仓库已实现独立页面 `/tools/whiteboard/`，入口只属于现有**工具区**（内部兼容 route 仍为 `resources`）；返回操作回工具区，不新增或恢复“资源区”页面、入口、路由、分类或旧结构。页面无需登录，提供公共画板与自行输入相同密码进入的隔离密码房。
- 画板前端采用 React + Excalidraw，协同层采用 Yjs 对象级 CRDT 与 awareness 等效临时状态。Pages Functions 负责统一匿名身份、密码 HMAC、Origin、短期票据、限频与管理员鉴权，再通过 external binding `WHITEBOARD_ROOMS` 把请求交给独立脚本 `lusu-whiteboard-do` 的 SQLite-backed `WhiteboardRoom` Durable Object。DO 使用 WebSocket Hibernation、压缩快照和有界增量；鼠标、选区、绘制中、焦点和暂离状态只广播，不写 D1、DO storage 或 R2。
- 全站匿名互动统一使用 `anonymous_identities` 和 HttpOnly `lusu_anonymous` 凭证。服务端只保存凭证 SHA-256，并维护永久 `anonymous_id`、临时名字、稳定颜色、创建时间和身份版本；聊天室与画板读取同一名字和颜色，登录用户也不暴露账号名称。改名跨标签同步只广播无名字、颜色、匿名 ID 或凭证的版本变化信号，接收方必须重新请求服务端权威身份。词根笛卡尔积超过一万种，改名约 30 秒冷却并有短窗次数限制；画板房内由 DO 原子查重，多标签共享同一房内展示身份。
- 密码先做 NFKC 与首尾空格规范化，再由 `WHITEBOARD_ROOM_HMAC_SECRET` 进行 HMAC-SHA256 映射；明文密码不进入 URL、房间 ID、D1 主键、LocalStorage、History、埋点或普通日志。WebSocket 票据通过 `Sec-WebSocket-Protocol` 传递，DO 会原子消费短期 `jti`，避免断开或休眠唤醒后的票据重放。
- 每个房间的 Yjs 文档、快照、增量、票据消费记录和资源清单由对应 DO 保存；D1 的 `whiteboard_rooms`、`whiteboard_assets`、`whiteboard_bans`、`whiteboard_admin_audit` 只作跨房管理索引、封禁和审计。图片只接受经过真实字节类型、尺寸、像素、频率和容量校验的 PNG/JPEG/WebP，写入私有 R2 前缀 `whiteboard/v1/<roomId>/<assetId>`，画布只保留资源 ID，不长期保存大 Base64。
- 在线画板入口使用 `assets/images/generated-icons/whiteboard.png` 的 192×192 RGBA 独立素材；该素材由 image2 生成后仅做确定性尺寸适配，`assets/images/generated-icons/whiteboard.source.json` 锁定生成/发布尺寸、最终 SHA-256 和仅机械 resize 的处理声明。在线画板后续新增或替换图标、插画、装饰等素材只能使用 image2 生成，不得用 CSS、Canvas、SVG 路径或代码几何拼凑替代；CSS 只负责布局、状态和响应式交互。
- 公共画板固定为 `public-v1`，不执行空房 TTL；管理员可以查看状态、连接和容量，清空、切换只读、移除异常连接，并按匿名 ID 或 IP 哈希临时封禁。密码房最后一条真实连接关闭或心跳超时后写入 `emptySince` 和 `deleteAt = emptySince + 24h`；24 小时内重入会取消旧计划，再次为空从新离开时间重新计算。Alarm 清理前重新检查房型、真实连接、截止时间和代次，先幂等清理房间 R2 前缀及索引，再删除文档状态；失败时退避重试。
- Pages 需要四个用途独立且至少 32 UTF-8 bytes 的 Secret：`WHITEBOARD_ROOM_HMAC_SECRET`、`WHITEBOARD_TICKET_SECRET`、`WHITEBOARD_INTERNAL_SECRET`、`WHITEBOARD_IP_HASH_SALT`。独立 Worker 只读取与 Pages 相同的 `WHITEBOARD_INTERNAL_SECRET`；真实值只在各环境的 Secret 配置中维护。Production external binding 指向 `WhiteboardRoom@lusu-whiteboard-do`；根配置提交态的 Preview 使用 `PREVIEW_API_DISABLED=true` 以及空 D1、R2、Durable Object bindings，不得引用未部署的 Worker 或回退 Production 数据。`workers/whiteboard/wrangler.preview.jsonc` 只作为隔离 `lusu-whiteboard-do-preview` 的部署配置；只有 Preview D1/R2、DO namespace、精确 Origin 与独立 Secret 全部创建、迁移和验收后，才可先部署该 Worker，再经审查接入 Pages Preview binding 并开启 API。Worker 的 `v1` migration 创建 SQLite-backed DO namespace，migration tag 和 namespace 均不得删除或改写。
- 正确发布顺序是本地 D1/类型/Lint/测试/构建验证，获授权后远端 D1 migration，随后先部署带 `v1` migration 的 DO Worker，再核对 Pages external binding，最后合并 `main` 触发 Pages Git 部署。Pages Dashboard 固定使用框架 `None`、Build command `npm run build`、Build output directory `dist`、Root directory `/`；标准构建先跑仓库守卫，再原子生成内容哈希 `dist/`。回滚时先阻止新连接并回滚 Pages 入口／binding，再部署兼容的上一版 Worker；保留 DO namespace、`v1` migration、D1 新表和既有数据。当前文档只记录仓库实现与本地发布准备，不代表 Cloudflare Dashboard、远端迁移、生产部署或正式域名已经验证。
- 详细协议、限制、部署和回滚步骤见 `docs/whiteboard/README.md` 与 `workers/whiteboard/README.md`；开源依赖及 MIT 许可证归属见 `tools/whiteboard/THIRD_PARTY_NOTICES.md`。

## 2026-07-30 每日 AI 新闻当天人工补发

- 每日定时任务继续固定在 `Asia/Shanghai` 07:00 启动，并把 08:00 作为自动发布硬截止；自动任务失败、超时或被普通重跑时只能关闭本期，永远不得自行转入人工补发。
- 当天自动任务失败后，只有站长在当前 Codex 交互任务中明确要求重新生成并公开该日新闻，才可读取 `自动新闻/integrations/lusu-site/MANUAL_RECOVERY.md` 并使用独立 `--manual-recovery` 入口。人工入口仅在该 `reportDate` 对应的北京时间当天 08:00（含）至次日 00:00（不含）开放，同时要求 `--confirm-report-date` 和已完整验证运行记录的 canonical SHA-256；午夜前不足 45 秒时同样拒绝发起请求。
- 人工补发仍使用原日期的精确 `[前一日 07:00, 当日 07:00)` 窗口，不能改成补发前 24 小时。生产脚本仍先执行完整 `readAndValidateRun`，因此 schemaVersion 4、Horizon 成功态、candidate index 原始 UTF-8 摘要、coverage manifest v2、required query／group 签收、全部候选处置、低产量复审、事件阶段去重和中英日三语格式都不能绕过。
- 人工与自动模式共用同一正式 `daily-ai-news` 接口、Bearer 凭证、enabled、显式 auto-publish、限流、slug 冲突、服务端 payload hash、幂等和三语公开回读门禁。请求状态不明或公开回读失败时仍禁止自动再次 POST；只有站长再次明确指示，并复用同一稿件和幂等键时，才可重新核对。
- `--print-run-sha256` 只读加载并完整验证指定运行记录后输出 canonical SHA-256，供站长授权范围内的人工双确认使用；确认后任何稿件字段变化都会使指纹失效。该操作门禁用于防误投、错稿和确认后篡改，不替代站长的明确交互授权。

## 2026-07-29 知识库安全 Markdown 链接与图片占位

- 知识库正文的标题、段落、列表、引用、说明框与显式图片图注共用安全行内 Markdown 渲染；`[名称](https://...)` 只在目标是无账号凭证的绝对 HTTPS URL 时创建可点击链接。相对地址、协议相对地址、HTTP、`javascript:`、`data:`、`blob:`、`file:`、`mailto:`、`tel:` 及包含用户名或密码的 URL 都保持为不可执行文字。
- 文章链接继续通过 `document.createElement("a")`、`textContent` 与净化后的 `href` 构建，不使用 `innerHTML`；外部链接固定 `target="_blank"` 与 `rel="noreferrer noopener"`。不支持的复杂 Markdown 保留原文，不能为了“渲染成功”而放宽协议或 HTML 边界。
- 工具雷达首期七张官方实图在 `articleImageDimensionMap` 登记真实宽高，让原生懒加载和异步解码前就预留正确比例；旧自绘说明图不再保留尺寸登记。文章正文必须使用 `<assetPath>?v=<SHA-256 前 12 位>` 的内容哈希图片地址，生产预检必须请求完全相同的 URL，再校验 MIME、大小与完整 SHA-256，避免 Cloudflare 边缘把资源上线前的 HTML fallback 当成图片缓存。官方页面复核截图在滚动到目标后还要有界等待可视懒加载媒体并确认自然尺寸和解码成功，不能把尚未请求或已经损坏的图片保存进验收截图。
- 本批公开记录为 `seed-update-2026-07-29-knowledge-markdown-links`，公共／API 表示版本为 `20260729-knowledge-markdown-links-r1`。

## 2026-07-29 工具雷达正式上线、周更与永久去重

- Knowledge 新增稳定分类 `tool-radar`，公开名称固定为中文“工具雷达”、English “Tool Radar”、日本語“ツールレーダー”。它即使无文章也保留入口，固定排在 `daily-ai-news` 之后、普通分类与 `site-updates` 之前；文章沿用普通知识库摘要与 `h2`／`h3` 目录规则，不继承每日新闻阅读特例。
- 站长已审阅首期试稿并明确授权正式上线。生产任务固定为 `Asia/Shanghai` 每周二 22:00 启动；每期目标 6–10 个工具，少于 3 个合格工具时整期不投递，不以数量替代核验。允许后续介绍能力相近的不同产品；服务端以规范化 `toolKey` 与 canonical 官网 URL 永久阻止精确重复，疑似改名、换域名或被收购的产品还必须对历史名称与别名做人工目录复核，身份未排除重复前不得投递。
- 发现范围包括设计／动效／UI／UX 参考、AI 开发与内容生产、视频、效率、科学上网辅助、中文友好、本地部署等实用或新奇工具。每项至少核对官网身份、核心能力、价格／免费层、登录要求、中文支持、本地部署或 AI 辅助部署、基本用法、案例与适用场景；宣传性或不稳定信息必须标注核验状态，不能由搜索摘要直接定稿。
- 最终文章提供 zh／en／ja 三语完整标题、摘要与正文。H1 固定使用本地化栏目名前缀，并同时写明读者具体痛点、与入选数量完全一致的阿拉伯数字，以及至少两个具体任务范围或收益；抽象主题、隐喻、口号或日期不能单独充当标题。来源证据留在内部运行记录；公开正文可保留经过核对的官网链接。图片仅在权利与稳定性明确且已保存为 `assets/images/articles/` 项目内资源时使用，不热链外部图片，也不因缺图阻断本期。
- 工具雷达的内部 `profile`／`evidence` 仍保存完整十项事实底稿，但公开正文固定采用真人分享式叙事，不把内部字段直接排成验收表：写作前先确定一句话叙事主线，按读者完成任务的自然顺序安排工具，让整期像可直接念出的口播稿一样从开场问题、两到四个连续阶段走到选择建议，而不是按热度或收集顺序堆产品卡片。H1 后直接使用按本期主题自然命名的利益点式开场 H2，并用恰好两段有依据的真实任务场景导语引出全部工具 H3；每个工具使用以运行记录 `displayName` 开头的利益点式 H3（`### 工具名称｜一句利益点`），正文恰好写三个不带机械字段小标题的自然段，依次说明“它是什么／能做什么”“替读者省掉什么／怎么开始”“案例或示例／适合谁／必要限制”，相邻工具用上一节结尾或下一节开头自然接力。最后一个 H2 以会话式语气回应开场并给出按任务选择的建议；开场与收尾 H2 都随本期主题自然命名，不套用固定栏目文案。允许基于证据表达个人编辑判断，但没有真实使用记录时不得虚构亲测、使用时长或本人效果；局限顺手写进相关段落，不另设醒目的“缺点”框，也不使用过度 emoji、夸张营销词或点击诱饵。
- 工具雷达以每个工具一张有语义的真实图片为正常目标、最多两张；选图与截图必须按 `自动新闻/integrations/lusu-site/tool-radar/VISUAL_METHOD.md` 执行。图片先从网上发现，再回到对应工具的官网、官方功能页、官方文档、官方仓库或官方媒体核实，只允许真实产品界面、官方案例或真实成果；本站自绘说明图、AI 生成图、统一模板卡、仿界面概念图、搜索结果缩略图与第三方转载图全部禁止，找不到合格实图就无图。取图前先写视觉任务卡，明确“读者问题、要证明的结论、必须出现的 2–5 个元素、单图或双图关系与三语图注规划”；单图连同图注必须独立说清工具／功能、动作或步骤及结果／价值，双图只能组成输入／输出、操作／结果、前后或连续步骤。关键内容不得被遮挡或截断；逐张通过三秒测试、正文宽度可读性、版权、隐私、稳定性和本地资产检查后才可进入运行记录与三语正文。素材优先级为有明确许可／授权的官方真实素材、标明来源和权利边界的官方公开页面有限编辑性截图、无图；正式入库保存 `sourcePageUrl`、`sourceAssetUrl` 或截图 selector／锚点、`visualSourceType`、权利依据与说明、核对日期、SHA-256、三语 alt 与图注，并在投递前确认 Pages 线上字节一致。
- 每个工具只把五项上手门槛收进一行紧凑信息，三语字段固定为中文 `**上手信息：** 收费：…；登录：…；中文支持：…；本地部署：…；AI 接入：…`、English `**Practical details:** Pricing: …; Sign-in: …; Chinese support: …; Local deployment: …; AI setup: …`、日本語 `**利用メモ：** 料金：…；ログイン：…；中国語対応：…；ローカル導入：…；AI 導入：…`。三语必须保持同一工具、顺序、事实、编辑判断与限制。
- `tool-radar` 使用独立的 `article_delivery_channels` 配置、Bearer 凭证与投递事件。机器入口固定分类、非置顶并拒绝调用方越权字段；通道启用与 auto-publish 是两个独立显式闸门，当前生产通道只在两项都已明确启用时自动公开。服务端在同一原子写入中登记本期全部工具，目录重复返回冲突并阻止半篇文章或部分目录落库。
- 管理后台“自动投递”页在 `daily-ai-news` 与 `tool-radar` 间切换，分别显示计划、地址、凭证、开关和历史，不共享一次性令牌或状态。公开更新记录起点为 `seed-update-2026-07-29-tool-radar-live`；当前首期视觉修订把七张自绘概念图原位替换为官方真实界面、案例或成果，并保留同一文章、slug、分类、发布时间和永久目录记录。站点资源先合并到 GitHub `main`，由 Cloudflare Pages 正常自动部署；生产投递按登记顺序逐张预检线上图片，对瞬时网络／明确瞬时 HTTP 故障最多尝试三次，但每张图仍必须同时通过 200、与扩展名一致的 MIME、大小和精确 SHA-256，持续失败不得放行。
- 首期审阅稿保存在 `自动新闻/integrations/lusu-site/tool-radar/trials/2026-07-21/`，包含同一组七个工具的 `zh.md`、`en.md`、`ja.md` 与 `run.json`。该记录继续固定为 `trial-local + trial + not-delivered`，只作历史审阅依据；正式首期必须重新取得已认证目录快照、生成独立 production 运行并完成线上回读，不能把 trial 原地改成生产记录。

## 2026-07-28 知识库完整归档可见性

- Knowledge 的首屏 12 条与“加载更多”只是 DOM 渲染分段，不是 API 数据分页。公共列表和前端必须使用同一个 `PUBLIC_ARTICLE_ARCHIVE_LIMIT = 500`，让搜索、分类、计数和分段渲染建立在完整摘要归档上；不能把接口恢复为 50 条后让未置顶旧文章静默消失。
- 分类按钮由已加载文章动态生成。若列表接口截断唯一使用某分类的旧文章，该分类也会一起消失；回归数据必须超过 50 条，并固定包含未置顶的 `ai-agent-workflow-guide` 与 `ai` 分类。
- “从提问到上线：普通人如何用 AI Agent 放大执行力”仍为 `published` 且 `is_pinned = 0`。取消置顶只改变排序，不改变公开状态和分类可见性。
- 本批公开记录为 `seed-update-2026-07-28-knowledge-archive-visibility`，公共／API 表示版本为 `20260728-knowledge-archive-r1`。
- 本批本地证据为公共模块图 20 / 20、全量测试 327 / 327、发布级 Headless 192 / 192、A Dark Room 浏览器回归、静态构建和连续两次一致的生产构建。

## 2026-07-28 文章置顶持久化与固定阅读侧栏

- `seed-ai-agent-workflow-guide-2026-06-14` 是后台可维护的普通文章。其元数据 seed 只在记录缺失时插入，不能在 Functions 冷启动或重复执行 `cloudflare/schema.sql` 时 upsert 覆盖 `is_pinned`、`updated_at` 等管理员状态。
- `site_runtime_state.article_ai_agent_workflow_pin_repair_v1` 只负责把部署前已被旧 seed 强制恢复为置顶的线上记录一次性改回未置顶。标记存在后，后台重新置顶或取消置顶都必须原样保留。
- `.article-reader-sidebar` 同时拥有“返回文章列表”和文章目录；桌面与横屏由这一整个侧栏 sticky 定位，返回按钮本身保持普通流布局并位于目录上方，不能再用两个不同 `top` 的 sticky 元素制造覆盖。
- 目录点击使用 `#article-detail.scrollTo({ behavior: "auto" })` 精确落到阅读区顶部安全线，然后同步标题焦点、URL hash 与唯一 `aria-current`。IntersectionObserver 的激活线与同一落点一致，点击后不得回退显示上一章节。
- 本批公开记录为 `seed-update-2026-07-28-article-pin-sidebar-navigation`，公共／API 表示版本为 `20260728-article-pin-sidebar-r2`；后台脚本版本为 `20260728-admin-article-pin-persistence-r1`。
- 2026-07-27 schema v3 历史 one-shot 的来源回归不再依赖 Git 忽略的完整 Horizon 本地运行目录。测试只可显式传入受限的紧凑 provenance fixture；正式 schema v4 运行禁止使用该覆盖入口。
- 本批本地证据为公共模块图 20 / 20、全量测试 326 / 326、文章专项 16 / 16、发布级 Headless 192 / 192、A Dark Room 浏览器回归、静态构建和连续两次一致的生产构建。

## 2026-07-28 知识库阅读导航与每日欢迎规则

- 知识库文章目录项不设固定高度；统一 `line-height` 和上下 padding 后由多行标题自然撑高。桌面／横屏的目录列表占用侧栏剩余高度并独立纵向滚动，右侧与底部必须保留滚动安全空间，滚到末尾时最后一项应完整落在列表视口内。短竖屏仍使用横向目录，但标题允许换行并自然增加高度，不得恢复 `white-space: nowrap` 或 44px 固定行高裁切。
- `#article-detail` 是文章唯一纵向滚动 owner。“返回文章列表”位于 sticky `.article-reader-sidebar` 内并与目录作为一个整体固定；“回到顶部”是 fixed 控件，但其 right／bottom 由公共帧管线根据 `.article-detail-card`、文章窗口和 `.xp-taskbar`／移动 Dock 的实时边界写入，必须位于正文阅读区右下角。点击回顶只调用文章详情容器的 `scrollTo()`，不滚动 document，并把焦点交给文章标题。
- `site-updates` 是专属更新日志分类。Knowledge 的“全部”Tab 列表和数量都必须排除它；只有 `site-updates` 专属“更新记录”Tab 显示这些文章。直达文章、搜索专属分类和 Home 最近更新不受影响。
- 欢迎弹窗使用访问设备本地日期格式 `YYYY-MM-DD` 保存到 `lusu-welcome-day`。每天首次打开任意公开路由时显示一次，并在弹窗实际打开时立刻同步 localStorage、sessionStorage 和页面内存；同一天后续导航／刷新不重复显示，第二天本地日期变化后再次显示。`welcome=0` 和 `welcome=1` 继续作为审计／预览的明确关闭与强制覆盖。
- 本批公开记录为 `seed-update-2026-07-28-knowledge-reader-welcome-fixes`，公共版本为 `20260728-knowledge-reader-welcome-r1`。文章专项回归固定覆盖 359×500、375×667、390×844、844×390、1280×720 与 1440×900，检查多行标题自然高度、目录末项、返回按钮位置、回顶滚动 owner、正文卡片边界及更新 Tab 筛选。
- 当前本地证据为公共模块图 20 / 20、全量测试 326 / 326、文章专项 16 / 16、发布级 Headless 192 / 192 与静态构建通过。完整公共 UI 命令中的本批关联场景也全部通过，但仍有 5 个未改动的桌面壁纸网络观察样本没有捕获到请求；发布级动态桌面壁纸预载检查通过，因此该观察项不应误记为本批知识库或欢迎功能失败。

## 2026-07-28 每日 AI 新闻覆盖审阅规则

- 修复后的 7 月 28 日正式复跑以 27 个英／中／日／韩检索种子覆盖全部 required group，得到 863 条精确窗口候选并选出 8 条；同 slug 三语线上文章已原位修订，原 `created_at`／`published_at` 保持不变，公开 zh／en／ja 接口均与 schema v4 校验稿一致。
- 发现查询必须区分“请求成功但无结果”和“请求／解析失败”。Google News 查询使用两路受控并发，失败最多重试两次，仍失败则 `fetchStatus` 不能为 success，正式运行必须关闭；不得把内部错误后返回的空数组当作没有新闻。候选索引与 SHA-256 必须基于实际写盘的确定性 UTF-8 字节，不能让 Windows 换行转换造成清单与文件指纹不一致。
- 2026-07-28 的短稿复盘确认：严格 24 小时窗口内 Horizon 实际产出 383 条候选，最终只有两条并非抓取总量不足，而是编辑记录只处理了两条入选和少量排除项，没有逐个签收重点实体／主题查询，也没有在低产量时启动第二轮补查；光刻机与部分中文厂商等明确主题还缺少专门检索。
- 正式工作流使用 schema v4，coverage manifest 使用 schemaVersion 2。Horizon 运行除完整 `daily_candidates.json` 外还提供紧凑 candidate index 与 coverage manifest；编辑记录必须完成 required query 和 entity group 的覆盖审阅签收，并对 candidate index 全部候选逐条处置。初选少于 5 条时强制执行低产量第二轮审阅和定向补查，但 5 条不是最低配额，复核后仍可少于 5 条或无稿，绝不能用窗口外、重复或低价值消息凑数。
- `自动新闻/integrations/lusu-site/runs/2026-07-28-coverage-revision.json` 在 coverage manifest v2 落地前生成，校验器只按已登记的 run、路径与 SHA-256 指纹允许这一份 schema v4 + manifest v1 历史兼容记录。该例外不得复制、改写或作为新运行模板；所有后续正式运行都必须生成 coverage manifest v2，并在兼容字段 `priorityReview` 中完成全部候选处置。
- 发现层不限制来源语言；可靠的中文、英文、日文、韩文及其他语言来源都可以进入候选，并以重点实体的英中日韩常用别名帮助发现。长期重点包括 Anthropic、OpenAI／GPT／Sam Altman／Codex、Thinking Machines／Inkling、LG AI Research／K-EXAONE 等开放模型与韩国模型实验室、Kimi／月之暗面、智谱／GLM、千问／Qwen、MiniMax、混元、美团龙猫、字节跳动／豆包／Seed，以及 Seedance 等视频、图像和语音多模态产品；芯片／光刻／存储、机器人、智能设备、数据中心能源／散热／网络和科技金融也在范围内。
- 聚焦查询最多保留 99 条并请求第 100 条作为截断探针：只有实际返回第 100 条才标记 result-limit，恰好只有 99 条不视为截断。高流量的跨厂商查询只能作补充发现；required 产品动态查询按厂商和语言拆分，当前日文 OpenAI／ChatGPT／Codex、Anthropic／Claude、Gemini／DeepMind 使用三条独立必查入口，避免窗口外旧消息先占满单条结果上限。正式入口的默认回看只取 24 小时，并按实际启动时刻向上扩到足以覆盖精确窗口的整小时数，不再固定多取 48 小时。聚合时间不能代替事件当前阶段的首次可靠发布时间。TechCrunch AI、VentureBeat AI、Ars Technica AI、雷峰网和 36氪属于可选补充；Reddit 与 Hacker News 只作发现，所有返回候选仍须处置并回到可靠来源核验。站长已授权把 Tibo `@thsottiaux` 的 X 帖子纳入选题；已移除会返回同名医疗噪声且无法提取规范原帖的 Bing RSS，改由 required 的 `codex-operations-en` 聚焦查询同时检查 Tibo 姓名、账号及 Codex／ChatGPT Work 运营变化。当前不是完整登录时间线或 X API。
- 跨日去重按 `eventKey + eventStage` 判断，不再把同一主体的全部后续永久视为重复。同一事件同一阶段继续排除；正式发布、正式开源／开放权重等实质新阶段可以作为 material update 入选，但内部记录必须指出前序故事和实质变化。

## 2026-07-28 每日 AI 新闻阅读格式

- `daily-ai-news` 文章详情不再显示投递摘要；摘要仍保留给知识库列表、分享卡片与搜索元数据使用，边缘直达页的 `noscript` 正文同样不重复显示摘要。
- 三语标题必须采用“栏目名 + 竖线 + 当天要闻标题”，并完整复用各语言正文第一条要闻的三级标题：中文 `每日 AI 新闻｜<今日要闻标题>`、英文 `Daily AI News | <Lead Story headline>`、日文 `毎日AIニュース｜<今日のトップニュース見出し>`。标题不再只写日期，日期由发布时间和固定 slug 表达，传闻不得进入整篇标题。
- 公开正文在内容型标题后直接进入“今日要闻”，不得显示采集窗口、筛选范围或制作说明；这些时间信息只保存在 Horizon 候选与内部运行记录中。
- 每条新闻必须使用唯一的三级标题。每日 AI 新闻的文章目录只列出这些逐条新闻标题，不再把“今日要闻 / 主要新闻 / 传闻”三个栏目名当作目录；普通知识库文章继续沿用原有目录规则。
- 三语测试占位文章 `daily-ai-news-test-placeholder` 已从 Functions seed 与 schema seed 删除，部署后的幂等数据修补会同时删除线上旧记录，并移除 2026-07-27 三语样稿正文中的采集窗口导语。后续工作流校验器会拒绝标题后的公开导语和重复新闻标题。
- 本批公开缓存与 API 表示版本为 `20260728-daily-ai-news-reader-r1`；更新记录为 `seed-update-2026-07-28-daily-ai-news-reader-format`。

## 2026-07-28 每日 AI 新闻生产运行规则

- 每日 AI 新闻已获正式上线授权。只允许 `daily-ai-news` 专用通道在管理员显式启用 auto-publish 配置后自动公开；机器调用方仍不能自行提交分类、状态、置顶或发布时间。未启用该配置时，入口仍只落三语草稿。
- 每天固定按 `Asia/Shanghai` 07:00 启动。候选与成稿窗口严格为此前 24 小时、左闭右开，即 `[前一日 07:00, 当日 07:00)`；所有入选项必须有准确时间并位于该窗口内。抓取、复核、三语生成、验证、投递和受控公开必须在 08:00 前成功完成。
- 08:00 是自动任务硬截止，自动任务不允许迟到补发。Horizon 不可用、无合格新闻、来源／格式／三语验证失败、令牌或通道校验失败、幂等／slug 冲突未安全处理，或任一阶段超时，均须关闭本期且不公开；只允许在 07:00–08:00 的剩余时间内进行受保护重试。失败不得降级为手工浏览伪造自动采集，也不得留下半公开文章。站长明确授权的当天人工恢复属于上文单列流程，不是自动失败分支，并继续保留全部正式门禁。
- `自动新闻/integrations/lusu-site/runs/2026-07-27-2300.json` 已于 2026-07-28 通过生产链路作为一次性历史测试公开为 `daily-ai-news-2026-07-27`；zh / en / ja 三个公开接口和文章直达页均验收通过。再次投递返回幂等命中，远端仍只有一篇文章与一条投递事件。该样稿今后仍只能显式使用 `--one-shot-history`，正式每日任务不得复用。

## 2026-07-27 每日 AI 新闻本地生成工作流

- Horizon 是每日 AI 新闻不可绕过的数据入口。本站配置和适配层位于 `自动新闻/integrations/lusu-site/`；`npm.cmd run ai-news:horizon:fetch -- --date <日期> --start <开始> --end <结束>` 真实调用 Horizon 原生多来源抓取、网址规范化和跨来源去重，再按 `Asia/Shanghai` 固定成稿时刻之前的精确 24 小时输出 `data/mcp-runs/<run_id>/daily_candidates.json`、紧凑候选索引和 coverage manifest v2。窗口采用左闭右开边界，入选项必须以事件当前阶段首次可靠发布时间核定且不能越界，聚合收录时间和社区发帖时间不能代替。发现不设语言限制；宽泛查询只作补充，OpenAI／Codex 关键人物与产品运营变化、Anthropic、开放权重、Thinking Machines／LG AI Research 等开放及韩国模型实验室、主要中国模型厂商、中国光刻／存储和 Seedance 等多模态产品使用独立 required 查询，并由指定 RSS、Reddit 与 Hacker News 等社区源补充早期线索。Google News 查询最多保留 99 条并请求第 100 条判断真实截断；单个可选补充源失败不阻断整期。RSS 瞬时失败由 Horizon 自带 RSS 抓取器定向重试；Horizon 不可用时本期停止，禁止静默改成手工浏览冒充自动采集。
- Codex 只从当次 Horizon 候选中做重要性判断、一手来源复核、近 30 天按 `eventKey + eventStage` 去重、无外链完整文章合成、日文补齐和受控投递。同一事件的新阶段只有在记录前序故事和 material difference 后才可再次入选。`horizon.config.json` 当前已指向本地 Ollama `qwen3.6:27b`，但正式适配入口只调用 Horizon 的 `fetch_items`、来源重试和跨源去重，不调用 `score_items` 或 AI 富化；因此本地模型目前不是每日采集的硬依赖，也没有保存云端模型密钥。以后若启用原生评分／富化，只能增强 Horizon 阶段，不能绕过候选来源证明。
- 每日新闻数量不设固定值，只使用 0–10 重要性评分中的 7 分门槛。初选少于 5 条必须完成低产量第二轮审阅和定向补查，但不得把 5 条当成最低配额；没有达到门槛的内容时报告“今日无稿”，不得拿窗口外消息、重复公告或低价值更新凑数。同一合作由多家公司分别公告时仍按一个故事处理。正文固定按“今日要闻 / 主要新闻 / 传闻”排列：要闻恰好一条且已经核实，传闻单独放置并使用条件语气，不在每条下重复“未证实”提示。
- 一手来源 URL、筛选理由和评分只保存在内部运行记录；公开文章是一篇独立完整的 zh / en / ja 三语正文，不包含网址、Markdown 链接、来源／参考资料章节、相关阅读跳转或内部评分。新闻正文以准确陈述事实为主；每条末尾的 AI 解读必须明显短于正文，通常一至两句，只挑最关键的影响、现实门槛、隐含限制或下一步观察点，不复述新闻，也不要求每条都刻意找问题。
- `自动新闻/integrations/lusu-site/ARTICLE_STYLE.md` 是所有后续日报的唯一固定格式与文风标准，未来代理必须先读。正式工作流 schema v4 和校验器会硬性检查三语标题均为固定栏目名前缀加各自第一条要闻标题、标题后直接进入首个栏目、三段栏目顺序、每条使用唯一三级标题、一段事实正文、恰好一条一至两句且短于事实段的 AI 解读、以解读结束，以及不得逐条重复传闻核实状态；语义层继续按该文件禁止纯日期标题、标题党、新闻复述、空泛套话、强行挑错和无依据扩写。schema v3 只保留给已登记的一次性历史样稿兼容，不得作为新的正式日报。
- `npm.cmd run ai-news:validate` 除检查入选故事、重要性、重复键、三段结构、逐条 AI 解读、三语完整性和正文无链接外，还会读取对应 Horizon 候选文件，核对 `runId`、精确 24 小时窗口、candidate index、coverage manifest v2、required query／entity group 签收、真实结果上限状态、低产量第二轮审阅，以及每个发现候选的 `selected / merged / rejected` 处置和入选来源映射。明确的用量／额度规则变化会标记 `usage-policy-change`，必须归类为用量或额度规则，不能用“重要性不足／例行消息／超出范围”拒绝；普通 token、推理内存、模型路由和性能优化不会被误标。同一额度事件的原帖、媒体和社区候选必须选一个代表项，其余合并。`npm.cmd run ai-news:deliver:local` 临时启用本地投递通道并启动一次 Pages 预览，走正式 `POST /api/automation/daily-ai-news` 契约后立即关闭服务、暂停通道并清除临时令牌。
- 当前最新审阅记录为 `自动新闻/integrations/lusu-site/runs/2026-07-28-coverage-revision.json`：精确窗口候选索引 863 条，最终保留 8 条并通过 schema v4 三语校验；其 manifest v1 只适用上文所述的固定指纹历史例外。`runs/2026-07-27-2300.json` 继续作为仅允许 `--one-shot-history` 的生产链路历史样稿，`runs/2026-07-27.json` 仅保留为更早的本地记录。
- 正式每日运行已获明确授权，按本文件顶部的 07:00–08:00 生产运行规则执行；不因该授权新增或保存模型／搜索／第三方密钥。自动公开仅限显式启用 auto-publish 的专用通道，其他通道和未配置通道继续草稿优先。本机 Codex 已创建并启用本地任务 `ai-7-8`（“每日 AI 新闻：7点生成，8点前发布”），按当前电脑的北京时间每天 07:00 运行；它不是云端托管任务，因此电脑、Codex 与网络需要在 07:00–08:00 保持可用。

## 2026-07-27 每日 AI 新闻分区、受控投递与自动公开入口

- 知识库新增稳定分类标识 `daily-ai-news`，公开显示名固定为中文“每日 AI 新闻”、English “Daily AI News”、日本語“毎日AIニュース”。该分类在筛选栏中固定排在普通分类之前、`site-updates` 之前，即使当前没有已发布文章也保留入口；专用空状态使用三语文案。
- 三语测试占位文章 `daily-ai-news-test-placeholder` 已在完成分类、列表与详情链路验证后删除；全新 D1、fallback 与线上数据都不得重新补回该占位文章。
- 管理后台新增“自动投递”模块，位置在“知识库文章”之后。管理员可启用／暂停每日 AI 新闻入口，生成、轮换或撤销令牌，复制投递地址，并查看最近事件；令牌明文只在生成或轮换成功后显示一次，D1 只保存 SHA-256 摘要和末尾提示。
- 机器投递入口固定为 `POST /api/automation/daily-ai-news`，配置和事件审计使用 `article_delivery_channels`、`article_delivery_events`。调用必须使用有效 Bearer 令牌并提供 zh / en / ja 三语标题、摘要和正文；机器入口始终强制分类为 `daily-ai-news`、非置顶、无封面，并拒绝调用方提交分类、状态、置顶等越权字段。默认创建无发布时间的 draft；仅专用通道的显式 auto-publish 配置开启时才创建 published 并写入公开时间。
- 投递入口具备请求体上限、按来源与通道限流、幂等键和 slug 冲突保护；事件表只记录必要状态、文章引用和规范化内容的 SHA-256 指纹，不记录文章正文或令牌。相同幂等键只有在内容指纹一致且原文章仍存在时才作为成功重放；内容变化或草稿被删除会明确返回冲突并要求新键。未鉴权请求只初始化轻量通道表，不执行文章 seed。管理员接口继续要求 `users.role = admin`，机器入口不复用管理员 cookie。
- 正式生产调度按 07:00 启动并在 08:00 截止；仓库不保存搜索／发布密钥，本地 Ollama 配置当前也不进入正式抓取调用链，部署不会自动创建其他计划任务。站长可随时暂停通道或关闭 auto-publish；关闭、撤销令牌、验证失败或超时后均只能保留草稿或失败事件，绝不自动公开。
- 每日 AI 新闻当前公开阅读版本为 `20260728-daily-ai-news-coverage-r1`（公开主脚本、知识库模块和 API 表示版本）；后台主脚本为 `20260728-daily-ai-news-doc-sync-r1`，后台样式仍为 `20260727-daily-ai-news-inbox-r1`。覆盖复核更新记录使用 `seed-update-2026-07-28-daily-ai-news-coverage-review`，并已同步完整 fallback、Home 最新五条无正文投影、Functions seed 和 schema seed。
- 最终本地验证为 D1 迁移、静态构建和 300 / 300 项全量测试通过；只读查询确认测试文章有三种翻译，通道初始为 `enabled = 0` 且没有令牌。生产启用、令牌生成与 auto-publish 配置必须作为显式受审计操作完成。

## 2026-07-26 全站安全与可靠性加固

- 账号与公开写接口在进入业务逻辑前校验同源、JSON `Content-Type` 和流式请求体上限。登录、注册按网络来源与规范化账号标识使用持久化 D1 限流；重复邮箱、站长保留邮箱和并发注册统一返回 `400 + REGISTRATION_FAILED`，公开界面不再枚举账号是否存在。本节当时采用的 600,000 次 PBKDF2 后经生产运行时证据确认不兼容；当前策略已按本文顶部 2026-08-01 规则修正为 100,000 次，不能恢复旧值。
- `api_rate_limits` 保存短期限流桶。页面、点击与文章阅读写入同时做速率上限和重复抑制；每日健康检查用 `waitUntil` 分批清理过期 session、365 天前登录记录、180 天前分析记录和 2 天前限流桶，每表单次最多 5,000 行。意外 5xx 只向客户端返回稳定通用错误，不暴露内部异常。
- 旧 D1 迁移必须先补齐聊天、禁言和 Transfer 历史表的缺失列，再执行依赖索引与完整 schema；`scripts/d1-migrate-local.mjs` 和 `scripts/d1-migrate-remote.mjs` 都覆盖真正 legacy fixture。全新 schema 同时创建 `api_rate_limits` 和 Transfer 设置 revision。
- 后台文章、视频、视频分类、社交链接、视频元数据刷新与删除均使用读取时的 `expectedUpdatedAt` 条件写入；陈旧标签页返回 `409 + CONTENT_CONFLICT` 并保留输入。文章翻译与视频分类关系和主记录在同一 D1 batch 内受版本条件保护。Transfer 设置同样使用 revision；清空房间或清理 R2 仅部分成功时返回非 2xx 和可重试失败列表，不能伪报全部完成。
- `/articles/<slug>` 由 `functions/articles/[slug].js` 在边缘读取已发布文章，并为直接访问输出文章专属 title、description、Open Graph、Twitter、canonical、Article JSON-LD 与安全 `noscript` 正文；不存在的文章返回 404 / noindex，D1 暂时失败时保留可运行主壳。
- 游戏目录与日语工具可选 manifest 都有 7 秒超时、Abort、版本缓存和本地回退；网络失败不能阻塞内置游戏、本地题目或已有存档。生产构建必须把日语音频 manifest 改写到同源绝对路径并保留版本 query，转换保持严格一次匹配。首页壁纸预载与实际 CSS 选择同一格式、宽度和版本，减少动态模式在首屏同步判定，避免重复或瞬时动态请求。
- 全局响应头补齐 CSP、Permissions Policy、HSTS、nosniff、referrer policy 与同源 framing；Pages Functions 的 JSON/XML 也显式携带相同安全边界，`/admin/` 额外拒绝任何 framing。锁定 Wrangler `4.118.0` 时 compatibility date 使用其本地 workerd 可启动的 `2026-07-17`，调整日期后必须真实启动 `wrangler pages dev`，不能只通过静态配置校验。根 `wrangler.jsonc` 只能使用 Cloudflare Pages Git 构建支持的字段，不声明会导致 Pages 拒绝部署的 Worker-only `observability` 或非标准 `secrets` 元数据；独立清理 Worker 可在自己的配置中保留 observability。GitHub Actions 固定第三方 action 的不可变 commit，并运行本地 D1、全量测试、模块图、静态构建、可重复生产构建及两套 Headless 发布审计；共享 runner 的首页首屏 TBT 固定采样三次并以中位数对原 350ms 预算判定，其他场景仍采样一次，网络体积、load、CLS、内存、运行时错误等结构性门槛逐样本检查且任一失败都会阻断。每个样本完成计时采集后先回收旧导航文档再读取全局 DOM 计数，避免把前一页面的可回收对象误算为当前页面节点。
- 本批公开缓存版本为 `20260726-security-reliability-r1`，公开更新记录为 `seed-update-2026-07-26-security-reliability-hardening`；后台脚本为 `20260726-admin-concurrency-safety-r1`，Transfer 管理资源为 `20260726-admin-transfer-safety-r1`。正式发布路径仍是 GitHub `main` 触发 Cloudflare Pages，本地修复不等于已推送或部署。
- 2026-07-26 最终本地证据：D1 legacy 迁移通过；297 / 297 测试、20 个公共模块、静态构建、双次一致生产构建（manifest SHA-256 `fbc56fe9f178f2d00fb050f80d872b558985d47b6117f0325b620f64c74797bd`）、192 / 192 发布矩阵和 A Dark Room 同文档旋转审计通过；Pages dev 健康、文章、404 与未登录后台路由冒烟通过。没有执行远端 D1、push 或部署。

## 2026-07-26 匿名聊天室统一图标规格

- 匿名聊天室只保留 `assets/images/icon-chatroom.png` 这一张规范资源，Home 桌面入口、移动 Home 应用网格、窗口标题栏、桌面任务栏／移动 Dock、欢迎快捷入口、Chat 页头和消息头像全部引用它；不要重新引入 `icon-chatroom-clean.png` 或 `icon-chatroom-desktop.png` 的双资源分叉。
- 当前资源为 96×96 RGBA、透明角点和硬像素边缘，主体 71×73，四边留 10–13px 透明安全区。Home 继续使用桌面 82px、移动 54px 映射；18–54px 小槽位继续使用既有 contain 映射，不额外放大，以保持各位置视觉尺寸适度。公开缓存版本为 `20260726-chatroom-icon-redraw-r2`，更新记录为 `seed-update-2026-07-26-chatroom-icon-redraw`。

## 2026-07-26 全界面移动游戏与弹窗点检规则

- `games/game-shell.css` 的外层 document 固定占用一个 `100dvh`，不得同时承担页面纵向滚动；共享壳使用“顶栏 + 剩余游戏区”网格，iframe 获取剩余高度并由游戏内容自己滚动。359×500、390×844、844×390 都要精确确认外层横／纵滚动为 false，返回、登录、下载、导入、云存档与冲突操作不得缩到 44px 以下。
- 上游嵌入游戏不能把固定桌面文档宽度带进手机 iframe。A Dark Room 窄屏按实际面板宽度移动，声音选择窗完整落在视口内并提供 zh／en／ja 文案；运行中 resize／orientationchange 必须重新测量两层滑轨、当前偏移与资源面板归属，compact→desktop 要恢复 700px 和原资源面板。Kittens Game 在 ≤900px 使用营火→资源→日志单列，顶部工具栏自然换为两行且 Steam／Version 不裁切，全部可见关键控件不小于 44px，`clientWidth` 必须等于 `scrollWidth`；>900px 保留原三栏。
- Life Restart 的移动补丁只对 `pointer: coarse` 生效，运行时必须把主操作与所有可见 `btn*` hitArea 扩到至少 44px；竖屏将工具操作从主流程分离，短横屏改为底部横排，`pointer: fine` 的桌面几何必须与上游保持一致。修改或升级上游后，需同时回归粗指针竖屏、粗指针短横屏与细指针桌面。
- 嵌入副本不得运行与本站无关的上游统计、原站账号、本机开发桥接或未使用主题的外部字体请求。Kittens Game 固定关闭 Google Analytics、KGNet 登录／同步和 `localhost:7780`，首屏只加载当前主题、切换时按需加载，并按站点语言设置 iframe 文档 `lang`；同时保留本站 localStorage、JSON 备份和账号云存档链路。以后升级上游时必须重新扫描全部非本站请求。
- 视频正常播放与最大化继续使用完整窗口；只有 `.video-player-fallback` 失败／不支持状态收敛为居中紧凑决策窗。359×500 欢迎窗可扩大到安全区内的可用高度，桌面模态遮罩必须让窗口与壁纸建立清楚层级，不能靠捕获入场动画中的半透明帧判断最终状态。
- 本轮公开记录为 `seed-update-2026-07-26-interface-audit-fixes`，主站缓存版本为 `20260726-interface-audit-fixes-r2`，共享游戏壳为 `20260726-game-mobile-shell-r1`，A Dark Room 内部资源为 `20260726-a-dark-room-mobile-r2`，Kittens Game `buildRevision` 为 `4`、移动 CSS query 为 `20260726-mobile-r3`，Life Restart 内部缓存为 `20260726-life-mobile-touch-r1`；Home 继续只投影最新五条无正文摘要。最终本地结果为 261 / 261 测试、20 个公开模块、可重复生产构建（manifest SHA-256 `dd99d2a75ea725c9efc34cc4e6b0671821dad9a22f0b6ed140f74d54f9f6d5cb`）、190 / 190 发布矩阵、147 / 147 完整公共 UI 审计与 58 / 58 Tools／Quick Transfer 专项。本地 Headless／CDP 结论不等同真实 iOS／Android 浏览器 chrome、软键盘或完整读屏认证。

## 2026-07-26 工具区三语显示名与兼容规则

- 原“资源区”的公开显示名固定为中文“工具区”、English “Tools”、日本語“ツール”；首页桌面入口、窗口标题、任务栏、移动 Dock、Appbar、文档元信息、空状态和 Quick Transfer 返回操作必须保持一致。
- 这次只改显示层。内部 route/hash 继续使用 `resources` / `#resources`，DOM、CSS、模块、API、统计键和审计命名继续使用稳定的 `resource-*` / `resources` 技术标识，不能为了显示改名破坏旧收藏链接、Quick Transfer、筛选状态或统计归组。
- 旧文章标签值“资源区 / Resources / リソース”保留为兼容输入，但渲染时统一显示新名称；既有 changelog 和旧 `site-updates` 正文中的旧称属于发布历史，不做追溯改写。
- 本轮公开记录为 `seed-update-2026-07-26-resources-to-tools`，公开缓存版本为 `20260726-tools-rename-r1`；Home 继续只投影最新五条无正文摘要。当前本地结果为 Tools／Quick Transfer 三语六视口专项 58 / 58、全量测试 242 / 242、20 个公开模块依赖图、可重复生产构建与发布矩阵 190 / 190。

## 2026-07-26 手机文章首屏与统一点检规则

- 按需 route CSS 的固定级联顺序是：主壳基础样式 → route 样式 → `link[data-mobile-shell-style]` 移动样式 → motion 样式。`ensureRouteStylesheet()` 必须把 route 样式插在移动 marker 之前，不能再 append 到文档末尾；移动几何仍由 `css/mobile-ios-shell.css` 最终裁决，并为文章侧栏保留高优先级 `min-height: 0` 防线。
- 手机文章首屏必须用精确 CDP viewport 同时守卫 359×500、390×844、844×390：初始 `#article-detail.scrollTop` 为 0，侧栏计算最小高度不大于 1px，第一段至少可见 20px，正文总可见量至少分别为 44px、200px、44px；不能只断言父容器无 overflow 或卡片已进入 DOM。
- 文章进度的 100% 终点是 `.markdown-body` 正文末尾，不包含为 Dock 保留的安全尾距。顶部状态的回顶按钮必须使用原生 `hidden` 退出键盘与读屏顺序，并在激活后把焦点交给 `tabindex="-1"` 的文章标题。目录列表和按钮使用 API 返回的实际文章语言，目录导航标签仍使用界面语言；含内部按钮的横向容器不得再增加空白容器 Tab 停靠点。
- 视觉收起不等于可访问性收起：移动 Dock 收起时必须同步 `inert`、`aria-hidden="true"` 与视觉隐藏，并在收起前把已有焦点移到 44px 展开按钮。图片若已有同文可见 `figcaption`，图片使用空 `alt` 避免重复朗读。844×390 英文 Resources 卡继续使用内容高度，所有说明、标签与主操作必须在卡片边界内。
- 本轮公开记录为 `seed-update-2026-07-26-mobile-article-first-screen`，公开缓存版本为 `20260726-mobile-reading-qa-r1`；Home 继续只投影最新五条无正文摘要。当前本地结果为文章专项 10 / 10、Resources 58 / 58、完整公共 UI 审计 147 / 147、全量测试 240 / 240 与发布矩阵 190 / 190；这些 Headless / CDP 结果仍不等同真实 iOS / Android 软键盘、safe area、浏览器 chrome 或完整读屏器认证。

## 2026-07-26 公开主站 30 项功能与界面优化规则

- 游戏云存档写入使用乐观并发控制：客户端每次 PUT 都必须携带最近一次 GET／恢复／同步获得的精确 `expectedUpdatedAt`；首次创建显式传 `null`。服务端只允许 `null` 原子插入不存在的记录，或用 `WHERE updated_at = ?` 更新匹配版本；未命中返回 `409 + SAVE_CONFLICT`，旧页面、并发标签页或其他设备不能无条件覆盖新存档。
- 检测到较新的云存档时，`games/game-shell.js` 必须立即停止 30 秒自动同步和隐藏页／退出／导入等全部上传路径，并显示三语 XP 冲突窗口。用户可以先下载本地 JSON 备份，再明确恢复云端、用本地覆盖当前云端版本或暂不处理；取消、Escape 和外点都只暂停，不得暗中上传。覆盖动作仍受服务端版本校验保护；恢复云端前必须重新 GET 并核对仍是弹窗所示版本，变化时不得应用旧快照。
- 云存档版本基线属于当前标签页，只能写入 `sessionStorage`（不可用时退回当前页面内存），不得与游戏本体一起写入跨标签页共享的 `localStorage`。当前标签页没有已知云版本且本地、云端同时存在时必须进入冲突流程，不能借用其他标签页的新版本号自动上传旧本地数据。
- Quick Transfer 的公开安全说明必须区分两条边界：文字在浏览器使用 AES-GCM；图片、视频和文件不使用房间口令加密，只由 HTTPS 传输、私有 R2 与服务端鉴权保护，且不进行病毒／恶意软件扫描。明文口令不发往服务端；配额是滚动 24 小时，不得写成自然日“今日剩余”。
- PC 任务栏连接托盘不再静态宣称 `ONLINE`。`js/features/connection-status.mjs` 以 `/api/health` 的 `2xx + { ok:true, db:true }` 为唯一在线依据，显示 checking / online / degraded / offline 四态；5 秒超时，在线 60 秒复查，异常按 10／20／40／60 秒退避，隐藏页面时中止。浏览器 `online` 事件只触发复查，不能直接宣称恢复；状态可点击重试、三语播报且不循环闪烁，移动 Dock 继续隐藏该非高频托盘。
- 账号状态检查与 Chat 网络恢复也必须保持真实：账号 GET 有界超时并在稳定 popover 内提供原位重试，不重建或清空编辑字段；Chat 只有成功刷新历史后才从 reconnecting 进入 online，失败时显示可聚焦手动重试。密码房进入与返回公开房必须单飞，读取历史失败不得宣布进入成功。
- Knowledge 搜索使用 NFKC／大小写归一后的多词 AND 匹配；搜索、分类与清空要同步重置真实列表滚动和 History 快照。Videos／Resources 重建分类按钮后恢复原筛选焦点；空视频分类优先提供“显示全部”，网站更新只是次操作。
- `html.lang` 在主壳加载前只接受 zh／en／ja query 并尽早写入；文章卡与详情标题、摘要、正文按 API 返回的实际文章语言标注，回退内容不能继续冒充当前界面语言。移动语言按钮显示完整当前语言名，并在 aria-label／title 中同时说明当前与下一语言。
- 手机 Resources 卡完整显示说明，将事实字段、标签和主操作分层，CTA 排在标签前且保持 44px；Games 卡直接展示全部语言支持，简介可读三行，二级许可／来源使用至少 44px 的原生 `details/summary`，后台刷新失败时保留并明确标示上次成功目录。
- `/api/health` 只返回固定 `{ ok, db }` 健康契约，不再公开用户数量。公开缓存版本为 `20260726-mobile-reading-qa-r1`；三语更新记录与 Home 最新五条投影以本批 `2026-07-26` 记录为准。

## 2026-07-21 桌面任务栏选中态规则

- PC 端当前任务按钮继续使用蓝色按下背景与内凹层级，但不再使用黄色底边、黄色外描边或常亮光晕；键盘操作的 `:focus-visible` 焦点环必须保留，不能为了视觉降噪破坏可访问性。移动 Dock 的透明选中底板与样式不受影响。
- 本轮公开记录为 `seed-update-2026-07-21-desktop-taskbar-active`，公开入口与模块缓存版本统一使用 `20260721-desktop-taskbar-active-r1`；Home 仍只投影最新五条无正文摘要。

## 2026-07-20 公共界面、状态与动效精修规则

- Chat 除移动小屏外还必须把 1280×720 当作短桌面硬门槛：窗口标题、两行身份／房间控制、日志、输入区和页脚都要位于可用窗口内，只有日志轨道可弹性收缩。响应式几何继续只写在 `css/mobile-ios-shell.css`，`css/routes/chatroom.css` 只提供无媒体查询的基础网格；字数计数属于输入状态行，不能作为独立列挤压正文。
- 视频卡缩略图是带视频标题可访问名称的原生 `button`，并保持 16:9；不得退回无键盘语义的装饰 `div`，也不得重新添加遮挡封面的蓝色播放圆圈。iframe 的 8 秒超时必须绑定当前 request generation 与 settled 状态，旧 timer / load / error 不能覆盖新的播放器；失败卡内并排提供重试与原视频入口，重试后恢复合理焦点。
- Knowledge、Videos、Resources、Games、Blog 与 About 的 loading / empty / error 使用共同 `.content-state` 视觉语言。加载和空状态使用 polite status，真实错误使用 alert；重新渲染不得让键盘焦点消失。Knowledge 正文保持约 72ch 可读行长，Resources 窄屏元信息至少 12px 并自然换行。
- `data-motion="off"` 是全局即时提交契约，不只是把 token 改成 1ms：必须关闭硬编码 transition / animation、Dock smooth scroll 与选中底板滑动、骨架循环和主题整页快照；reduced 同样不得保留非必要循环。disabled、`aria-disabled` 或 inert 控件不产生按压反馈，最大化／还原的 FLIP 必须使用真实前后几何。
- 本轮公开记录为 `seed-update-2026-07-20-ui-motion-polish`，主 CSS、移动壳、动效脚本、公共入口与路由懒加载资源统一使用 `20260720-ui-motion-polish-r1`。Home 最近更新继续只投影最新五条无正文摘要。

## 2026-07-19 历史视频封面缓存恢复规则

- 生产 D1 中历史 Bilibili 手动封面使用受限 `data:image` 保存，并通过 `/api/videos/:videoId/thumbnail` 同源端点公开；排查“旧封面不显示”时先分别核对公开列表字段、代理端点状态与全新浏览器渲染，不能在确认数据丢失前要求管理员重新上传。
- `/api/videos` 与单视频详情的 ETag 必须覆盖完整公开响应，不能只使用视频行 `updated_at` 等不足以描述代码转换、分类或封面 URL 的局部种子，否则纯代码修复会被已有浏览器的 304 永久遮蔽。
- 上传封面的同源代理 URL 必须以视频 `updated_at`（或等价内容版本）作为 query 版本。这样历史空缓存会在兼容修复后失效，管理员之后替换同一视频封面时也不会继续命中旧图；前端接受的固有尺寸边界必须与服务端 960×540 上限保持一致。

## 2026-07-19 内容窗口、封面、图标与账号规则

- `site-updates` 是普通时间线日志，永远不得置顶。Functions 创建或更新该分类文章时强制 `is_pinned = 0`，schema / seed 会清理历史错误值，Knowledge 前端对缓存中的旧置顶值也必须按非置顶处理；其他知识文章仍可正常置顶。
- Knowledge 标题栏只保留关闭键，不再提供最小化、最大化或还原状态；以后不要恢复无对应窗口逻辑的装饰性控制。视频模态的独立最大化逻辑不受影响。
- 后台本地视频封面会生成最大 960×540 的受限 `data:image`。公开视频接口必须允许这组尺寸并继续保持 320KB、受限 MIME 和受控同源缩略图端点，不能因为前台尺寸上限更小而让已保存的 Bilibili 手动封面消失。
- Resources 的临时互传入口与五款游戏使用 `assets/images/generated-icons/` 下各自的 192×192 RGBA 图标；图标由图像生成流程制作并透明化，不用 CSS / Canvas 几何替代。新图标必须验证 alpha、透明角点、尺寸和文件预算。
- 账号稳定 DOM 仍同时持有登录／注册字段，但 `[hidden]` 必须在作者 CSS 中可靠生效：登录只显示邮箱和一次密码，注册才显示确认密码；登录后隐藏完整表单，只显示登录成功状态与退出账号按钮，不公开显示账号邮箱。

## 2026-07-19 公共服务恢复与发布守卫

- `articleTranslationsStatements(env, articleId, translations, now)` 的每一次 seed 调用都必须显式传入确定的 UTC ISO 时间；D1 不接受 `undefined` bind。`tests/article-seed-bindings.test.mjs` 会构造完整文章 seed batch 并拒绝任何未定义参数，知识库故障排查应先运行该测试和三语 `/api/articles` smoke。
- Cloudflare Pages 会把存在的 `.html` 静态片段重定向到 clean URL。Quick Transfer 仍只接受当前页面同源地址，但固定允许 `/fragments/quick-transfer.html` 与 `/fragments/quick-transfer` 两个精确 pathname；不得用 `startsWith`、后缀或跨源放宽白名单。
- 本地 Wrangler 预览与 Production 一样会在全部 API 前校验两个独立、至少 32 bytes 的 `CHAT_IP_HASH_SALT` / `ANALYTICS_IP_HASH_SALT`。本地值只放已忽略的 `.dev.vars`；交付预览地址前必须先探测 `/api/health`，不得把缺盐导致的全 API 503 当成单个业务故障。

## 2026-07-19 管理后台离开保护与互传文件治理

- `/admin/` 文章、视频、视频分类、聊天、账号和社交链接表单的未保存状态只由真实输入 / change 或明确表单操作维护；程序自动补入的排序、分类选项和详情值不得在离开时被误判为编辑。
- 主后台侧栏通过“互传文件管理”进入独立受保护的 `/admin/transfer.html`。该页分页展示文件、发送账号、保存时间、过期时间、大小和存储状态；管理员可永久删除 R2 对象及对应 D1 记录，删除失败保留重试状态。
- 本轮属于后台私有更新，仅同步根项目历史、后台页面内 `adminUpdates` 与后台专用文档；不写入公开三语 `site-updates`、Home 最近更新或公开 fallback。

## 2026-07-18 资源区透明图集与排版回归

- `assets/transfer/quick-transfer-icons-source.png` 是带洋红色键背景的构建源，不得由页面引用或直接缩放为生产图集。`scripts/build-transfer-icon-atlas.mjs` 负责色键、边缘去色、缩放并生成 168×168 RGBA 的 `quick-transfer-icons.png`；资产测试必须覆盖 alpha、整体透明率、16 个 sprite cell 的透明角点与可见像素比例。同一 Sharp / libvips 运行时双次构建要求 PNG 字节一致，但 Windows 与 Linux 的 PNG 压缩流不作为跨平台契约；跨平台 CI 解码 RGBA 并使用严格像素差阈值验证视觉等价。
- Resources 桌面窗口当前宽度上限为 960px，卡片高度由标题、说明、元信息、标签和 CTA 自然决定；移动端不得恢复固定卡片高度或用裁剪隐藏内容，主操作继续保持至少 44px。当前两项资源本身都可用，不显示重复的“可获取”状态。
- Quick Transfer loader 与实现层分别只能暂存并恢复自己接管前的 `resource-categories` / `resource-list` 精确 hidden 状态。关闭互传必须回到打开前的列表几何，不得无条件显示空分类栏，也不得让列表闪失。
- Windows 上直接传给 Chrome 的窄 `--window-size` 可能被系统最小窗口宽度钳制到约 500 CSS px。资源布局回归使用 `npm.cmd run audit:resources-layout` 的 CDP 精确 viewport，断言 layout/visual viewport 后，以中、英、日三语覆盖 359×500、375×667、390×844、760×900、844×390、1280×720 的列表、登录和返回状态；当前 58 / 58 个受控检查通过，Headless 结论仍不等同真机。
- Windows Headless 的 `Page.captureScreenshot({ fromSurface: false })` 可能得到空白图，单次 `fromSurface: true` 又可能漏掉固定 Dock / 顶栏等合成层。资源专项审计必须先预热捕获、等待双 `requestAnimationFrame`，再保存第二张 `fromSurface: true` 截图，并逐张人工确认固定层存在；几何断言不能替代这一步。

## 2026-07-18 公开主站 100 项优化收口

- 公开主站保留根目录 Git → Cloudflare Pages 自动部署链；Pages Git 集成执行标准 `npm.cmd run build`，先通过 `scripts/build-check.mjs` 守卫，再由 `scripts/build-production.mjs` 原子生成被 Git 忽略的 `dist/` 部署产物。产物使用内容哈希文件名、可定位 sourcemap、白名单 manifest 与分层 `_headers`；`dist/` 是 Pages 构建输出但不提交 Git，手动 Wrangler 发布仍不是正式部署源。
- Home 四时段桌面壁纸、动态主题层和非 Home 窗口背景提供 AVIF / WebP 响应式档位与 PNG fallback；首屏只预加载当前时段和当前壳的主图，动态图层只挂载当前主题所需节点。任何同路径位图重压缩仍需同步公开 query，不能依赖浏览器猜测内容已变化。
- Home、顶栏、任务栏或移动 Dock 在进入业务路由之前已可见的图标，其样式必须由始终加载的主壳 CSS 所有，不得依赖 `css/routes/` 懒加载样式。Chat 的 Home 入口、标题栏、短屏头像和 Dock 必须使用同一真实资产并通过解码检查。
- 公开列表请求统一经有界 ETag / SWR / last-known-good 缓存：304 复用缓存，短暂失败保留最后成功内容并提供可控重试，强制重试必须能绕过新鲜缓存。视频列表只返回受控封面 URL/尺寸，禁止重新内联不受限 base64 大图。
- Quick Transfer 使用 `(created_at,id)` 稳定游标、`sync_generation` 重置语义、单飞刷新、键控 DOM 更新、队列背压与幂等键；旧 D1 升级必须先补 `transfer_rooms.sync_generation`、`transfer_items.idempotency_key` 等列，再执行依赖这些列的索引文件，迁移验证不得用超出 D1 SQLite compound-select 上限的单条探针。
- 移动 App 外框可延伸到半透明 Dock 后方以保留至少 80% 的视觉工作区，但必须用等量内部安全尾距保证真实内容、Chat composer 与最后一个操作仍位于 Dock 上方。359×500、375×667、390×844、844×390 的三语子项包含/相交、44px、横向可发现性、forced-colors、日文字体和 normal/reduced/off/low-performance 四档动效都是发布闸门。
- 页面路由、Home 进入 App 与移动 Dock 切换只动画当前页面/窗口表面，不得使用会捕获固定顶栏、任务栏或 Dock 的整页 `document.startViewTransition()` 快照。动效回归必须在 `prefers-reduced-motion: no-preference` + full 模式下采集起始、60ms、140ms 和稳定帧，并验证 Dock 节点身份、透明度、几何和快速连续切换的最终路由。
- Chat 每次逻辑发送必须使用稳定 `clientRequestId`：同一草稿的失败重试复用 ID，服务端在限流前查询已提交重放，并由 `(visitor_id, room_key, client_request_id)` 唯一索引处理并发竞态。私聊重试即使 AES-GCM 随机 IV 产生不同密文，也必须返回首次存储的消息；旧 D1 必须先补 `client_request_id` 列再建索引。
- `npm.cmd run verify:public-site-release` 是本地统一收口入口；它必须覆盖单元/合约测试、模块图、静态构建守卫、生产产物复现性和隔离 Headless UI 矩阵。Headless 结果不等同真实 iOS / Android、完整读屏器或生产部署验证；没有推送权限时只完成本地验收并明确保留线上步骤。
- Headless 审计的独立顶层场景必须通过唯一审计 query 触发新文档并确认 CDP `loaderId`，不得让上一场景的 route 模块、内存缓存、焦点或 Dock 状态污染冷启动结论；刻意验证 SPA Hash、Back / Forward、视频重试或 Dock 连续动效的步骤继续保留同文档。跨页面 DOM 计数必须限定到场景容器，例如 Knowledge 分页只查询 `#knowledge-list`。移动 App 的窗口背景与 Dock 相交不是内容遮挡，验收应测真实末端内容、composer、反馈和页脚。当前本地结果为 192 / 192 测试、142 / 142 完整 UI 审计、190 / 190 发布矩阵和可复现生产构建通过。

## 2026-07-18 账号、文章、Chat 与隐私可靠性

- 公开账号表单由 `js/features/account.mjs` 一次创建稳定 DOM。初始化、语言/模式切换、弹层开关和请求失败只能同步现有节点，不得通过 `replaceChildren()` 丢失邮箱、密码、确认字段、模式或焦点；登录/注册各自只有一个主提交动作，退出失败必须保留真实登录态。
- 账号 popover 的 return focus 以实际触发源为准；Home 顶栏与 Resources/Transfer 上下文都必须覆盖 Escape、外点、移动 44px 关闭、首错焦点和键盘避让。Transfer 未登录状态只保留一个任务卡与一个主登录 CTA，登录后继续原 Transfer 任务。
- 文章阅读时外层 document 必须严格等于 viewport，`#article-detail` 是唯一纵向滚动所有者；进度状态位于 Knowledge 窗口内，实际轨道保持约 4px、与正文零交叠，并同时提供三语可见含义、百分比和准确 ARIA 值。
- Chat 发送期间只锁重复提交，输入继续可编辑；异步完成只可清空未经再次编辑的提交草稿。359×500 普通房维持约 177px、私聊维持至少约 119px，折叠安全说明必须提供 44px 入口，关闭时不得覆盖日志。
- 公共 Chat API 不得把服务端隐藏 `visitor_id` 作为旧消息 fallback 返回；密码、私聊内容、草稿、Secret 和完整标识不得进入 DOM 泄漏、storage、History、日志或 telemetry。安全 DOM 与外链/iframe/fragment 白名单由测试和构建闸门共同保护。

## 2026-07-18 路由与数据按需加载

- `js/main.js` 只静态加载 shell、账号、路由核心、三语字典和约 8KB 的 `js/data/home-content.mjs`。Knowledge、Videos、Resources、Games、Chat 首次进入时通过 `createRouteModuleRegistry()` 单飞加载并永久复用；Knowledge、Videos、Games、Chat 的绘制 CSS 位于 `css/routes/`，移动几何仍只由 `css/mobile-ios-shell.css` 负责。
- Home 不得请求未进入路由的业务 chunk 或 `/api/articles`、`/api/videos`、`games/catalog.json`、social、Chat、Transfer 数据。Videos、Resources、Blog fallback 分别随对应路由加载；`js/data/content.mjs` 保留完整更新 seed 来源，但不进入 Home 初始模块图。
- Quick Transfer 的 loader、`css/transfer.css`、`js/transfer.js` 与 `fragments/quick-transfer.html` 仅在 Resources 真实 CTA 点击后加载。进入 Resources 本身不得创建 `#transfer-app`、暴露 `window.QuickTransfer`、请求 Transfer API 或轮询；首次成功后资产、DOM 与业务实例永久复用，离开竞态不得初始化。
- seed-backed `site-updates` 除完整 `js/data/content.mjs`、Functions 和 schema 外，还必须同步 `js/data/home-content.mjs` 的最近五条无正文摘要投影，供 Home 顶部日期和欢迎更新使用。

## 2026-07-18 主站 UI / UX 100 项优化执行计划

- 新增 `docs/PUBLIC_SITE_UI_UX_100_OPTIMIZATION_PLAN.md`，把 2026-07-17 主站静态审计、31 张有效截图和精确 CDP 几何测量整理为可供 Codex 分批执行的 100 项工作计划；每项包含优先级、代码范围、依赖和完成判定。
- 计划明确保护当前 XP + Pixel Art + Y2K / Neo-XP 身份、四时段 Home 构图和已通过的默认移动/844×390 横屏布局；内部横向滚动只作为可发现性问题处理，不再误报为页面级横向破版。359×500 Chat 实测普通房约 177px、私聊约 119px；长期 QA 门槛已同步校准为普通房至少 160px、私聊至少 115px 或提供可折叠工具区、844×390 至少 150px，并要求安全说明、输入、反馈和 Dock 同时可达。
- 本轮只新增执行文档和维护记录，没有修改公开主站 UI、业务代码、Functions、D1、公开三语 `site-updates` 或资源 query。
- 首个依赖闭合批次已完成 `OPT-001 + OPT-081`。`scripts/public-ui-audit.mjs` 通过 `npm.cmd run audit:public-ui` 启动隔离的一次性 Headless Chrome 与本地只读静态服务器，固定 day 主题、关闭动效并使用受控文章 / Chat API fixture；精确覆盖 359×500、375×667、390×844、844×390、1280×720、1440×900 Chat，以及 844×390 文章目录 + 正文。审计输出写入被 Git 忽略的 `output/public-ui-audit/`，结束时必须关闭浏览器并删除临时 profile；`scripts/build-check.mjs` 同步守卫命令、视口集合、500px 伪手机拒绝和关键几何断言。本批不改变公开 UI 或生产数据。
- 第二个依赖闭合批次完成 `OPT-011 + OPT-023`。`index.html` 必须在首个阻塞样式前根据受白名单约束的 `?wallpaper=` 或本地时间写入 `html[data-time-theme]`；CSS 的桌面窗口背景、Home 壁纸与移动壁纸都从该根属性选择首个资源，不能恢复 `#wallpaper-root data-time="day"` 或只等待 body 属性。`js/main.js` 首次复用该主题，并在时钟更新时同步 html、body、Home 与壁纸舞台。
- 每个 `.page` 的第一层必须保留一个 `.sr-only` H1，section 用 `aria-labelledby` 指向它；移动端即使隐藏桌面 titlebar，活动路由仍要在辅助技术树中暴露唯一 H1。视觉 titlebar 文本使用普通元素并隐藏重复播报；公共列表卡片标题和安全 Markdown 标题从 H2 开始。页面最前的三语 skip link 通过受控点击聚焦 `#main-content`，不得把 `#main-content` 交给旧路由解析而误回 Home。
- `scripts/public-ui-audit.mjs` 现在除 7 个截图/几何场景外，还模拟上海本地 morning/day/dusk/night 与 day 时段的 night 调试覆盖，记录所有桌面/移动主题资源请求并拒绝跨时段资产；语义矩阵覆盖 8 路由 × zh/en/ja 的 DOM 与 CDP AX Tree，并在 359×500、390×844、844×390 复测代表语言。完整运行共 77 项检查，仍使用隔离临时 profile、受控本地 fixture，不能等同真实设备或完整读屏器认证。
- 本批三语更新记录为 `seed-update-2026-07-18-theme-accessibility-foundation`，公开资源 query 为 `20260718-theme-a11y-foundation-r1`；只更新 seed/fallback 与源码，不连接生产 D1、不推送、不部署。
- 第三个依赖闭合批次完成 `OPT-024 + OPT-026 + OPT-061`。路由提交后的自动焦点必须统一落到目标 `.page` 的稳定 H1，不得选搜索框、输入框或无意义首按钮；首次加载不主动抢焦点，首个 Tab 仍是 skip link。文章详情只有在最终标题内容就绪后才聚焦 `#article-detail-title`，返回列表、浏览器前进/后退与 URL 必须同步，任何延迟 rAF 都要先验证当前路由和文章标识，不能在快速导航后抢回陈旧焦点。
- 顶栏账号层是非模态 popover：容器使用带三语可访问名称的 `role=group`，触发器维护 `aria-expanded/controls`；Escape 和外点关闭后焦点归还触发源。打开后首字段/状态聚焦、移动端 44px 可见关闭按钮以及全部 App 层级回归仍属于后续 `OPT-059`，不得因本批标记 `OPT-026` 完成而跳过。
- 主 CSS 不得再在 `body` 上全局隐藏 caret；文本输入、textarea 和可编辑内容使用零优先级 `caret-color: auto` 恢复平台光标。自动审计必须对 Transfer 密码框与 composer 做真实键盘输入，而不只读取 computed style：覆盖选中文字后键入替换、Backspace 删除及 1280×720 / 390×844 可见 caret。
- `scripts/public-ui-audit.mjs` 当前共 95 项检查：继续覆盖 1280×720 zh/en/ja 全路由、359×500 zh、390×844 en、844×390 ja 语义矩阵和既有 Chat / 文章截图，并新增路由离开控制、文章列表/详情历史往返及 Transfer 真键入。该结果是 Headless Chrome 烟测，不等同真实设备软键盘或完整读屏器认证。
- 本批三语更新记录为 `seed-update-2026-07-18-focus-popover-caret`，`style.css` 与 `main.js` 公开资源 query 为 `20260718-focus-popover-caret-r1`；只更新 seed/fallback 与源码，不连接生产 D1、不推送、不部署。
- 第四个依赖闭合批次完成 `OPT-021`。公开路由的 `history.state.lusuPublicState` 使用版本 1、独立 entry id 和白名单规范化；Knowledge 列表条目只保存 category、searchTerm、内部 scrollTop，文章条目只保存 slug、详情 scrollTop 与 `history/default` 返回模式。URL 是 route/slug 的唯一权威来源，搜索词不进入 URL，账号、Chat 草稿、临时互传口令和内容不得进入 History 状态。
- 从 Knowledge 列表打开文章前，必须先用 `replaceState` 捕获来源列表，再 Push 文章条目；来源文章的站内返回只能 `history.back()`，直链文章返回则以 `replaceState` 进入默认 Knowledge，避免离站和重复历史条目。`syncLanguageUrl()` 必须保留现有 state；`history.scrollRestoration` 保持 `manual`，列表和详情滚动通过 passive listener + 单帧 replace 同步，并在 DOM 稳定后恢复。
- History 恢复必须先按 URL 校验/清洗 state，再恢复分类与搜索、渲染 DOM、恢复内部滚动，最后按 OPT-024 只聚焦一次稳定标题。详情请求同时校验 request id、slug 和语言；相同详情不得重复渲染并清零阅读位置，旧语言响应不得覆盖当前语言。
- `scripts/public-ui-audit.mjs` 当前共 99 项检查；在 1280×720 与 390×844 受控文章列表中验证分类 + Unicode 搜索 + 非零列表滚动、详情滚动、站内返回、浏览器 Back / Forward、直链默认返回、未知版本/损坏 state 清洗、外部根字段保留与焦点去重。公开三语更新为 `seed-update-2026-07-18-knowledge-history-restoration`，`main.js` query 为 `20260718-knowledge-history-r1`；未连接生产 D1、未推送、未部署。
- 第五个依赖闭合批次完成 `OPT-022 + OPT-025`。八个公开 route 的文档元信息必须从单一 `routeMetaConfig` 派生：Home 使用站点标题，其余使用“路由标题 | 站点标题”；每个 route 有三语独立 description，canonical 固定为 `https://lusu575.com/?lang=<lang>#<route>`（Home 无 Hash），不得带 wallpaper、welcome、hover 或审计参数。Hash canonical 是当前 SPA 的运行时一致性约定，不代表搜索引擎或社交抓取器已获得独立路径 SSR/预渲染。
- `applyDocumentMeta()` 是 canonical、description、OG 与 Twitter 的唯一完整 DOM 写入口。route 使用默认分享图、1672×941 和三语图片 alt；文章使用正式 `/articles/<slug>?lang=<lang>`、`og:type=article` 与安全白名单封面，自定义封面尺寸未知时必须移除 width/height。加载、失败、离开详情、同路由提交、语言切换和 History 恢复都要覆盖全部字段，不能保留旧文章信息；元信息 helper 不得写 History。
- 欢迎窗与视频窗属于真正模态：`.skip-link` 与 `.site-shell` 是两个 `data-modal-background` 根，打开后由 `syncModalIsolation()` 原生设为 inert，并记住/恢复此前 inert 状态；异常双模态只让 video 优先、另一层 inert。打开顺序是保存真实触发源、显示、同步隔离、聚焦 Close；关闭顺序是隐藏、重算/解除隔离、再归还焦点。完整关闭动画提交前不得提前解除 inert，reduced/off 模式必须立即提交。
- 视频打开调用必须显式携带实际点击的 `[data-video-id/index]` 按钮，不能只依赖触控设备不可靠的 `document.activeElement`。归还目标失效时依次回退到仍活动的模态与当前路由稳定 H1；两个 dialog 保持 `aria-modal=true`、label 与 `tabindex=-1`，手机关闭控件不小于 44×44px。
- `scripts/public-ui-audit.mjs` 当前共 108 项检查，并输出六张欢迎/视频模态精确视口截图；三语八路由、三语文章、文章离开去残留、inert/AX Tree、Tab 圈定、程序化背景聚焦阻断、Escape、full/reduced 关闭时序、焦点归还和移动关闭几何均由本地 fixture 验证。公开更新为 `seed-update-2026-07-18-route-metadata-modal-focus`，`main.js` query 为 `20260718-route-meta-modal-r1`；未连接生产 D1、未推送、未部署。
- 第六个依赖闭合批次完成 `OPT-002 + OPT-007`。`js/main.js` 的八个公开路由必须通过 `registerRouteLifecycle()` / `transitionRouteLifecycle()` 显式进入和离开；路由临时监听、timer、rAF、Observer 和 Fetch 都登记到当前 scope，离开时先 Abort 再清理。相同 route 的无操作导航不得重入；语言切换可以有意重启唯一活动 scope，但不能更新隐藏 route 或重复绑定。
- Knowledge、Videos、Games、About 的请求只在对应 route 活动时发生；Home 不得恢复全量文章、视频、游戏或社交列表预取。Chat 的 timer 在离开或 `document.hidden` 后必须为零，恢复可见后再立即刷新并调度。Quick Transfer 通过 `routeEnter/routeLeave` 与 Resources 对齐，离开时必须清理事件 AbortController、poll timer、Fetch controller、XHR、上传 transport 和 retry delay，且不得削弱 HttpOnly、AES-GCM、R2、Multipart、配额或 24 小时协议。
- 响应式与移动布局的唯一权威文件是 `css/mobile-ios-shell.css`；`css/style.css` 不再承载媒体查询布局，`css/motion-system.css` 只能定义动效或明确限定到桌面壳的层级。`scripts/build-check.mjs` 会解析三份 CSS，并拒绝关键移动 selector/property 的跨文件重复或越权；不要用 `!important` 或更高特异性绕过该边界。
- `window.__lusuRouteLifecycleAudit()` 与 `QuickTransfer.lifecycleSnapshot()` 仅暴露隐私安全的资源计数供本地 QA 使用。`scripts/public-ui-audit.mjs` 当前共 110 项检查，在 1280×720 与 390×844 注入延迟 Fetch 并连续遍历八 route，要求 inactive listener/observer/timer/frame/request/AbortController 归零、Chat/Transfer 无残留、同 route 不重复绑定。公开更新为 `seed-update-2026-07-18-route-lifecycle-mobile-css`，JS query 为 `20260718-route-lifecycle-r1`，三份主 CSS query 为 `20260718-route-lifecycle-css-r1`；未连接生产 D1、未推送、未部署。
- 第七个依赖闭合批次完成 `OPT-020`。`js/mobile-shell.js` 的 `window.LusuFramePipeline` 是公开主站唯一 viewport 调度器：window resize、VisualViewport resize / scroll 各只绑定一次；同键任务在同帧合并，所有 `measure/read` 完成后才执行任何 `mutate/write`，写阶段新任务只能进入下一帧。新增消费者必须使用 `schedule/request` 或 `subscribeViewport`，不得在 `main.js`、`ui-motion.js`、`transfer.js` 恢复第二套原生 viewport 监听或嵌套布局 rAF。
- Home 壁纸舞台与路由图标几何、Knowledge 文章进度与目录、移动 Dock、动效层以及 Quick Transfer 的聚焦控件都使用该管线；route 级订阅随 scope 退出，Transfer 订阅随事件作用域解绑。视口宽高、键盘偏移与 Dock 几何在一次写阶段提交，`visualViewport.scale !== 1` 时键盘偏移必须为 0，避免把页面缩放误判为软键盘。
- 性能档只允许 `normal` / `low`。Save-Data 或浏览器明确报告不超过 2 个逻辑核心 / 2GiB 内存时进入 `low`；能力未知保持 `normal`。低档关闭大面积 blur / backdrop-filter / filter、循环环境动效、常驻 `will-change` 与全页 View Transition，并使用高对比实色回退；normal 档视觉不变。构建守卫同时检查唯一原生绑定、消费者契约、三份 CSS low 规则与 cache query。
- `scripts/public-ui-audit.mjs` 当前共 117 项检查：事件风暴必须恰好产生一帧、一次读阶段和一次写阶段；390×844 / 844×390 核对 CSS 视口变量与 Dock；原生 2× page scale 不得产生键盘偏移；Save-Data、2 核、未知能力档位及低档大面积绘制效果均受控验证。`performance-low-390x844.png` 已人工复核清楚可读，但 Headless Chrome 不模拟真实 iOS / Android 屏幕软键盘。公开更新为 `seed-update-2026-07-18-frame-pipeline-low-performance`，JS query 为 `20260718-frame-pipeline-low-r1`，三份主 CSS query 为 `20260718-frame-pipeline-low-css-r1`；未连接生产 D1、未推送、未部署。
- 第八个依赖闭合批次完成 `OPT-028`。固定移动壳不解锁 body、site-shell 或 page；非 Home 活动 App 窗口通过含 route ID 的高特异性规则保留休眠式 `overflow-y:auto` 逃生通道，只在真实内容增长时生效。文章阅读态继续由 `.article-detail` 独占滚动，Home 桌面、Appbar 与 Dock 保持固定。
- Knowledge、Videos、Resources、Games、Blog、About、Chat 的内部 owner 及 Transfer room entry / room / login gate 允许合理的纵向滚动链。移动通用聚焦恢复只使用 keyed `mobile-shell:focus-reveal`：measure 阶段查找最近且当前真正可滚动的祖先，mutate 阶段仅写其 `scrollTop`。Home 只接纳已打开的账号层，Transfer 暂保留已有专用恢复并不新增原生 viewport 监听；完整软键盘 / 地址栏 / 安全区 / 旋转状态继续归 `OPT-085`。
- `scripts/public-ui-audit.mjs` 当前共 122 项检查：新增 359×500 Chat 内容增长、390×844→390×500→390×844 受限高度代理、文章 / About 真实 owner、2× page scale 聚焦恢复及 Home 零 document scroll。焦点几何审计必须先用 CDP `Page.bringToFront` 激活页面，否则 `activeElement` 可改变却不产生真实 focus 事件。默认 Chat 与文章截图已人工复核稳定。这些 Headless 受控代理不等同真实 iOS / Android 软键盘认证。公开更新为 `seed-update-2026-07-18-mobile-scroll-recovery`，JS query 为 `20260718-mobile-scroll-recovery-r1`，三份主 CSS 与 Transfer CSS query 为 `20260718-mobile-scroll-recovery-css-r1`；未连接生产 D1、未推送、未部署。
- 第九个依赖闭合批次完成 `OPT-085`。`window.LusuFramePipeline` 是移动端 viewport 事实的唯一来源：snapshot 统一包含 layout / visual 宽高、VisualViewport offset、方向、page scale、键盘状态/偏移与 `stable/browser-ui/keyboard/zoom` 模式，再于同一写阶段派生根 CSS 变量与 `data-mobile-*` 属性。其他模块不得从 `window.innerHeight`、`visualViewport`、方向或焦点几何重建第二套键盘/地址栏推断。
- 第十个依赖闭合批次完成 `OPT-003`，并确认 `OPT-073` 为 `DONE-PREEXISTING`。公开主站入口 `js/main.js` 是 ESM composition root；路由解析与生命周期位于 `js/core/`，三语与 fallback 内容位于 `js/core/i18n.mjs` / `js/data/content.mjs`，Knowledge、Videos、Resources、Games、Chat 分属 `js/routes/`，账号属于 `js/features/`。模块只能通过显式 factory 依赖共享唯一状态，不得导入入口或兄弟 route；`npm.cmd run check:public-modules` 拒绝缺失依赖、循环、越层导入和 route 顶层 DOM/网络/timer 副作用。最终 `main.js` 为 80,593 bytes，11-module graph、89 / 89 测试、构建与 135 / 135 无头 UI 审计通过；Chat 离开或隐藏后 scope timer / request 为零。
- 移动编辑控件的可见恢复只能经 `requestMobileFocusReveal()` / keyed `mobile-shell:focus-reveal`：先测量最近且当前真实可滚动的内部 owner，再仅写该 owner 的 `scrollTop`；不得使用全局 `scrollIntoView`、document scroll 或移动 Home、Appbar、Dock。Quick Transfer 必须委托此公共入口，不得恢复私有 viewport 订阅/焦点恢复。账号提交等异步状态更新必须保留表单并恢复最后编辑字段。
- 键盘打开时 Dock 可通过根 viewport 状态临时隐藏以释放可读高度，但不得改写 `body[data-mobile-dock]`、本地存储或用户的展开/收起偏好；键盘关闭后必须回到原用户状态。旋转、失焦锁存、超高反馈与 page scale 都必须保持有界收敛，不得让 Dock 永久隐藏或把当前输入推出可见区。
- `scripts/public-ui-audit.mjs` 当前共 135 项检查，使用受控 Headless Chrome 代理验证 Chat/密码房、账号 popover、Knowledge、Transfer、浏览器 UI 高度变化、旋转、page scale、Dock 两种偏好与 safe-area 能力检测。审计报告必须保留真实能力标志；没有在真实 iOS / Android 上触发软键盘、地址栏收缩或 safe-area 时，不得宣称已完成真机认证。最新公开更新仍为 `seed-update-2026-07-18-mobile-viewport-keyboard`，主 CSS 与 Transfer CSS query 为 `20260718-mobile-viewport-keyboard-css-r1`；fallback 已迁入 `js/data/content.mjs`，Functions seed 与 schema seed 保持同步；当前公共 ESM query 为 `20260718-public-modules-r1`，未连接生产 D1、未推送、未部署。

## 2026-07-17 手机顶栏、文章进度与临时互传发送修复

- 手机虚拟 OS 不再显示顶部时间与 `LUSU OS` 状态行，`--mobile-status-height` 固定为 `0px`；safe area、栏目 Appbar、首页入口和桌面顶栏继续保留。
- 手机知识库文章阅读态只显示进度条，不再同时显示栏目文字和百分比；返回、复制、回到顶部等真实控件必须继续可聚焦、可点击。
- 页面路由的自动焦点迁移不得选择 `input`、`textarea` 等编辑控件；手机从 Home、欢迎快捷入口或 Dock 进入知识库时只能聚焦可见的非编辑控件或窗口表面，不能未经用户点击就唤起软键盘。用户主动搜索、清空或重置后的显式聚焦继续保留。
- 临时互传的相册选择、通用文件选择、拖放和粘贴必须先进入输入区待发送托盘；只有用户再次提交 composer 后才能创建上传任务。文字 API 失败时不得清空附件，发送期间不得追加或移除同一批附件。
- 手机相册入口使用独立 `accept="image/*"` 的多选 file input，不能强制 `capture`；通用文件入口继续多选。待发送图片使用小尺寸 Object URL 预览并在移除、离房或发送后释放。
- 手机互传房间继续使用单一 `.transfer-room` 滚动路径，但 composer 必须处于正常文档流，不能用 sticky / fixed 层覆盖消息；竖屏房间使用纵向 Flex 流，toolbar、feed、composer 与 tasks 直接子项不可收缩并按真实内容高度依次排列，仅将 `position` 改为 static 不足以避免 Grid 轨道中的视觉溢出。短横屏显式恢复原有双栏 Grid。已发送图片使用占满卡片宽度且预留稳定高度的 `object-fit: contain` 预览框，普通文件使用占满可用宽度并包含类型图标、文件名、大小与 MIME 的文件卡片。所有附件保留下载按钮，每条成功解密文字末尾提供复制按钮和剪贴板回退。
- 本轮不修改 HttpOnly 登录、房间 key、AES-GCM、私有 R2、Multipart、配额、24 小时过期、下载鉴权或 `/api/transfer/*` 服务端协议。三语公开更新记录为 `seed-update-2026-07-17-mobile-transfer-send-fix`，资源 query 为 `20260717-mobile-transfer-send-r3`。
- 站长邮箱不得再写入公开源码；由 Cloudflare Pages Production / Preview 各自的加密 `OWNER_ADMIN_EMAILS` Secret 提供，可用逗号、分号或空白分隔多个地址。Functions 只能从请求 `env` 解析规范化 Set，用它执行 schema 后的管理员角色保持和后台账号不可降级检查；它不是登录或权限绕过。未配置时必须保持可用，不回退任何固定邮箱、不自动提升账号且不触发 503，现有 D1 `users.role`、当前账号不可自降级和最后管理员原子保护继续有效。

## 2026-07-16 临时互传上传、全窗拖放与视口高度修复

- Pages Functions 的文件路由依赖根 `wrangler.jsonc` 中 `TRANSFER_BUCKET` R2 binding；顶层 Production 使用 `lusu-temp-transfer`。`env.preview` 必须显式使用空 `d1_databases`、空 `r2_buckets` 与 `PREVIEW_API_DISABLED=true`，在独立 Preview 数据资源尚未创建、迁移和验收时关闭全部预览 API，绝不回退正式 D1/R2。Secret 的实际值继续在 Cloudflare 的 Production / Preview 环境分别管理；所需变量名由 `.env.example` 的空声明和运行时校验维护，不写入 Pages 不支持的顶层 `secrets` 元数据。构建必须校验这套映射，避免正式环境文字房间可用但文件路由持续返回 `TRANSFER_R2_NOT_BOUND`，也避免预览部署误用正式数据。
- 文件拖放热区覆盖整个互传窗口，只拦截 `DataTransfer.types` 包含 `Files` 的拖放；文字或链接拖放不得被阻断。全窗提示层不接收指针事件，drop、close、blur 与 dragend 都必须清理拖放状态。
- `r2Ready: false` 时客户端必须禁用文件选择并在排队前返回，不得生成上传进度到 100% 后才失败的任务；服务端稳定错误码继续用于诊断，公开 5xx 文案不暴露内部细节。
- 桌面互传窗口按 `100dvh` 的可用区域伸展，消息流吃满新增空间；移动端仍由 `--mobile-viewport-height`、单一 `.transfer-room` 滚动路径和 `visualViewport` 补偿控制。此处原有 sticky composer 已由 2026-07-17 的不可收缩正常流方案取代。
- 本批公开资源 query 为 `20260716-transfer-upload-window-r2`。

## 2026-07-16 手机文章与临时互传界面修复

- 手机端知识库文章的“回到顶部”控制放在 Appbar 可见区域时，固定 `.xp-topbar` 的非控件触控层必须允许点击穿透；Appbar 内实际的返回、复制、账号等交互控件继续单独接收指针事件。
- Resources 列表中的临时互传与日语学习卡片使用同一网格宽度、卡片高度节奏和内边距；标题、元信息、摘要与 CTA 不得因语言长度或内容量出现错位，窄屏信息应换行而不是隐藏。
- 跨语言动态元信息统一使用可稳定回退的 ASCII 分隔符，避免英文系统字体缺少全角标点字形时出现缺字符号。
- 临时互传的未登录入口、房间、消息流、上传任务、文件预览和输入区必须覆盖 359x500、375x667、390x844、430x932 与 844x390；短屏和软键盘出现时仍能到达登录与输入操作，不能用内部滚动锁住页面底部。
- 本轮只更新主站公开 UI 与交互，不修改房间口令派生、HttpOnly 会话、私有 R2、24 小时过期、普通账号配额、管理员 Multipart 权限、下载鉴权或 `/api/transfer/*` 接口。
- 三语公开更新记录为 `seed-update-2026-07-16-mobile-transfer-ui-polish`；本批公开资源 query 统一为 `20260716-mobile-transfer-ui-r1`。

## 2026-07-16 管理后台互动城市访问地图

- `/admin/` 实时大屏地图展示最近 14 天按国家、地区和城市精确分组、具备有效聚合经纬度的城市级聚合；桌面端支持滚轮缩放、拖拽、点击 / 悬停，触屏支持双指缩放与拖动，键盘可聚焦点位并查看城市 PV/UV。
- 底图使用项目内 Natural Earth 矢量路径并通过真实 SVG `<use>` 绘制，缩放 / 平移只修改根 SVG `viewBox`；不得退回 CSS background + transform 的栅格化放大链路。
- 城市点位使用真实 SVG `<g>` / `<circle>`，可见尺寸按 PV 调整，所有缩放级别的命中区至少 44px；地图详情与同数据列表不显示 IP、网络前缀、visitor id、hash 或其他隐藏标识。
- 本轮仅更新管理后台私有界面与后台文档，不进入公开 `site-updates`；后台资源 query 为 `20260716-admin-svg-vector-map-r1`，地图资源 query 为 `20260716-admin-world-map-svg-r1`，维护细节见 `admin/docs/ADMIN_PROJECT_CONTEXT.md`。

## 2026-07-16 管理后台移动与操作安全底座

- `/admin/` 窄屏导航使用分组抽屉；文章、视频、聊天室和账号使用列表 / 详情双态，主要移动触控目标至少 44px，长表单保存操作持续可见。
- 可编辑表单有未保存状态和站内离开保护，危险操作统一显示对象、影响与可恢复性；文章发布一次汇总中 / 英 / 日三语错误，服务端也要求三语正文完整。
- 账号页默认不自动选中用户，资料与密码重置分离；密码重置可选择撤销既有会话，服务端通过原子条件更新阻止最后一个管理员被降级。
- 本轮仅更新管理后台私有界面、后台接口和后台文档；不进入公开 `site-updates`。后台资源 query 为 `20260716-admin-safety-foundation-r1`，细节见 `admin/docs/ADMIN_PROJECT_CONTEXT.md`。

## 2026-07-16 临时互传

- “临时互传 / Quick Transfer / 一時転送”固定放在 Resources 资源区，未登录用户只能看到说明；创建或加入房间、列表、文字、上传、下载和删除全部由现有 HttpOnly 会话在服务端鉴权。
- 房间口令只在浏览器规范化并派生不可枚举的 room key 与文字 AES-GCM 密钥，服务端不接收明文口令；文件放入私有 `TRANSFER_BUCKET`，D1 只保存房间、元数据、配额、上传会话、分片和告警记录。
- 普通账号受保守免费池、单文件与个人配额限制；管理员只通过 `users.role = admin` 识别，可使用 R2 Multipart、暂停/恢复/取消和 GiB 级上传，不受普通业务频次与免费池暂停限制，但仍受并发稳定性、R2 平台边界和实际账单约束。
- 内容发布完成后保留 24 小时，过期后 API 立即拒绝访问；`workers/transfer-cleanup/` 每小时物理清理，R2 生命周期与未完成 Multipart 自动中止规则作为兜底。独立后台页位于 `/admin/transfer.html`，并由主后台侧栏“互传文件管理”进入。
- 本地开发要求 Node.js 22.13+，本地 API 同名变量只能写入已忽略的 `.dev.vars` 并独立生成；Production 值、`.dev.vars`、`.env` 和真实 Secret 不得进入 Git。

## 2026-07-15 GPTWork 可复现开发基线

- 普通站点开发的可复现运行时固定为 Node.js 22.13+、npm lockfile v3 和 Wrangler `4.118.0`；全新克隆使用 `npm ci`。纯本地环境从 `.env.example` 创建被忽略的 `.dev.vars`，GPTWork 使用平台注入的 process Secrets，不能再创建会遮蔽云端值的空 `.dev.vars`。
- 本地 Pages Functions 使用 `wrangler pages dev`，D1 binding 固定为 `DB`，`preview_database_id` 只用于本地模拟数据库；普通开发、CI 和 GPTWork 不需要 Cloudflare 登录、API Token、生产 D1 权限或本机 TTS 模型。
- API router 必须同时获得独立的 `CHAT_IP_HASH_SALT` 与 `ANALYTICS_IP_HASH_SALT`，两者至少 32 字节且不能相同。IP 标识使用 `HMAC-SHA256(secret, purpose + ":" + ip)` 做聊天 / 分析用途隔离；配置不合格时必须在任何 API 业务 D1 访问前返回通用 503，且日志不得输出 Secret 值或请求 IP。
- 聊天消息和网络来源禁言保存由聊天 Secret 自动派生的非敏感密钥代次。Secret 轮换后旧消息只供审计、不能新建网络来源禁言，旧禁言明确显示失效；服务端必须按消息编号读取当前代次目标，不能信任前端提交的 hash，也不得恢复公开 fallback。
- Pull Request 和 `main` 由 `.github/workflows/verify.yml` 执行 `npm ci`、本地 D1 空库初始化、`npm test`、`npm run build`；当前项目没有独立 lint / typecheck 工具链，不添加伪命令。正式部署仍是 GitHub `main` 触发 Cloudflare Pages。
- GPTWork 迁移清单和仅本地资源边界见 `docs/GPTWORK_MIGRATION_READINESS.md`；`output/`、`.wrangler/`、本机 TTS 配置、模型 / 参考声线和 `node_modules/` 不属于 GitHub 运行源。

## 2026-07-14 日本語の裏側 1.0.3 重答修复

- `/tools/japanese-subtext/` 当前公开应用版本为 `1.0.3`，题库、音频、云存档兼容边界继续使用 `contentVersion: 1.0.2`。`appVersion` 表示界面与交互发布，`contentVersion` 只在题库结构或存档兼容边界变化时增加；UI 热修不得连带伪造 250 关哈希或全量音频迁移。
- 错答后必须始终存在重新答题入口：结果弹窗不能由关闭按钮、Escape 或点击外侧直接丢弃，题面保留兜底重答按钮，查看解析后在解析正文之前显示重答；进入下一关只按本次 `attemptCleared` 判断，不得使用历史累计通关状态。
- 本次未修改正式题库、静态音频、关卡图片、进度 API 或 D1 存档结构；主站 Resources 显示应用版本 1.0.3，并通过三语更新记录明确内容兼容版本仍是 1.0.2。

## 2026-07-11 六项移动 Dock 尺寸与桌面选中态
- 六项移动 Dock 使用 340px 最大宽度、48px 单项触控宽度和更清晰的 34px 图标（Home 为 39px），不再保留八项时期的整栏长度；桌面任务栏选中态在导航请求开始时同步，页面转场结束后再次校准。

## 2026-07-11 日本語の裏側 1.0.2

- `/tools/japanese-subtext/` 是独立日语潜台词训练器，当时公开应用版本为 `1.0.2`；标题随界面语言显示为中文“日语的言外之意”、English “Behind the Japanese”、日本語“日本語の裏側”。模块复用一套数据驱动渲染器，题库是 `contentVersion` 管理的分批 JSON，不为单关创建 HTML，也不把 250 关内联到主站 `js/main.js`。
- 正式题库固定为 5×50 关：LEVEL 1=N3、LEVEL 2=N2、LEVEL 3–5=N1 / N1 高阶。每级前 5–10 关相对短，后续递增；每关都包含完整场景、问题、三语选项、答案、证据行和不作绝对化断言的语用解析。
- 内容展示、选项语言和音频设置彼此独立。正文支持纯听 / 日语 / 双语，选项支持 ja / zh / en；首次模式选择只出现一次，进入关卡不自动播放。播放器只保留一个音频实例，公开控件为播放/暂停、任意 seek 和倍速，句子/词块/选项文本本身可点击播放；离开关卡或页面隐藏时必须停止旧音频，播放高亮不得强制滚动页面。
- 音频只在题库审校并锁定后用本机隔离的 Kokoro-82M v1.0 + kokoro-onnx CPU 适配器预生成。句子、选项和词块必须先保存可审校假名，再进入 G2P；v4 适配器剥离 Misaki 音高半段，完整按官方顺序映射 P2R（原始 `j → y` 必须早于 `ʥ → j`），拒绝未知或超过 510 个的音素，避免句尾额外“いい”、“きょう”退化为“おう”及“や／ゆ／よ”偏成“じゃ／じゅ／じょ”。公开仓库不包含模型权重、本机绝对路径、实际 TTS 配置或参考声线；模型不注册服务、不随系统启动，批处理结束后保持关闭。静态题库通过稳定 ID 与 `audio/manifest.json`、关卡时间轴关联；每关 `sourceContentHash`、cue 顺序、reading/phoneme SHA-256、实际 CPU provider、模型与运行时 provenance、输出参数和发音表语义 SHA-256 都是发布门槛，正式校验还必须覆盖全量音素复算、ffprobe、文件 SHA-256、孤儿文件与静音检测。
- 每关使用一张与 setting、台词、题问、人物关系和关键道具映射的原创黑白四格漫画，保持统一线条、网点、分镜边框与 4:3 画幅；不接受来源不明图片、受版权保护角色或写实人物。图片必须由 `assets/stages/manifest.json` 锁定 SHA-256、960×720 尺寸、生成器版本和审查状态，并压缩、懒加载、适配固定验收视口。imagegen/image2 暂时网络不可用时，只能使用可复现的本地原创分镜生成器作为明确标注的 fallback，不能宣称为 AI 逐张绘制。
- 未登录进度保存在版本化本地存档；登录后通过独立 D1 表 `japanese_subtext_profiles` / `japanese_subtext_stage_progress` / `japanese_subtext_daily_activity` 和 GET/PUT `/api/tools/japanese-subtext/progress` 合并。日活动按用户本地日期与关卡稳定 ID 幂等记录，用于月历打卡、当前连续、最长连续和最近活动。服务端从 HttpOnly 会话取用户 ID，并校验 payload、关卡、解锁链、成绩和奖章；不得复用游戏存档表。跨设备合并必须保留已通关记录的 `firstClearMode`，较新的失败尝试不得生成 `cleared=true` 但首次通关模式为空的非法状态。
- 1.0.2 的桌面工具壳复用游戏区视觉结构：左上角返回个人站、右上角工具名称，中间突出存档同步；关卡区减少整屏最小高度与无效留白，解析页必须提供下一关入口。资源区 CTA 使用“开始”，非输入型标题、按钮和卡片文案默认不可选中。
- 面向用户的解析不得显示 `line-002` 等内部 ID；中文 UI 与日文题目必须分别使用简体中文和日文字体栈。发布门槛是题库与真实音频验证、自动测试、五视口 UI 回归、主站回归和文档/Skill/缓存/三语更新记录全部通过。工具说明见 `tools/japanese-subtext/README.md`，版本与维护规则见 `tools/japanese-subtext/MAINTENANCE.md`；每次公开更新固定增加 `0.0.1`。

## 2026-07-06 暗色前端加密密码房

- 匿名聊天室现在有普通大厅和密码房两种模式：普通大厅继续使用浅色 XP UI 和明文接口；密码房使用暗色 UI，浏览器用用户输入的密码派生房间标识和 AES-GCM 密钥。
- 密码房不提交、不保存明文密码；同一密码会派生同一 `room_key`，不同密码互相隔离。密码房消息以 `encryptedContent` 发送，D1 只保存密文，后端会拒绝密码房明文 `content`。
- `anonymous_chat_messages` 新增 `room_key`、`encrypted` 字段；旧消息默认 `room_key='public'`、`encrypted=0`。读取、发送、昵称占用、增量游标恢复和发送限流都按 `room_key` 隔离。
- 仅密码房执行 24 小时无发言清理：房间最新消息超过 24 小时后删除该房全部密文消息并释放房间；普通大厅消息保留原行为。
- 后台聊天室管理对加密消息只显示“密码房加密消息（后台无法解密）”，内容框锁定；管理员仍可隐藏、删除和按隐藏用户标识 / 网络来源禁言。
- 安全边界：这是网页端前端加密，不承诺绝对安全的完整 E2EE。弱密码可被猜中，房间标识本身也会给离线猜测提供验证目标；同时网页端仍需信任当前加载的站点 JS。
- 本次公开可见更新已补齐三语 `site-updates`、`js/main.js` fallback、Functions seed、schema seed、主站/后台资源 query、根目录 changelog、主站 Skill/README 和后台专用文档。
- 运行时 schema guard 的顺序很重要：旧 D1 表首次加载新聊天字段时，必须先通过 `ensureTableColumns()` 补 `room_key` / `encrypted`，再创建任何依赖 `room_key` 的索引；否则普通大厅会在迁移前读取失败。

## 2026-06-30 账号弹窗层级修复与更新记录补齐

- 主站右上角账号入口的弹窗修复分两层处理：`.xp-topbar` 允许弹窗向下溢出，同时 `.site-shell > header` 的层级高于 `.site-shell > main`，避免首页和各栏目 XP 窗口继续遮挡登录/注册弹窗。
- 本次不修改账号接口、登录/注册/退出提交逻辑、会话 cookie 或游戏云存档逻辑，只修正前端显示层级和缓存版本。
- 该修复属于公开可见更新，已补齐 `site-updates` 三语记录、`js/main.js` fallback、`functions/api/[[route]].js` Functions seed、`cloudflare/schema.sql` schema seed、根目录 changelog、项目上下文和主站 Skill；首页最近更新日期由 `content.updates` 自动读取到 `2026.06.30`。
- 后续维护顶栏账号入口、语言切换或其他顶栏浮层时，必须同时检查裁剪、header/main stacking context、移动端断点和资源 query，不能只看按钮 click handler。

## 2026-06-24 账号流程、入口清理与合并上线

- 主站欢迎窗口最近更新操作区已精简为只保留“查看更多网站更新”入口，公开聚合发现链接、入口按钮和对应公开接口已从主站代码与 Functions 路由中移除。
- 右上角账号弹窗改为由登录/注册按钮显式记录提交模式，回车默认登录，点击注册走注册流程；请求期间会临时锁定登录、注册和退出按钮，退出失败时前端也会回到未登录状态，避免界面卡住。
- `npm run deploy` 不再执行 Wrangler 手动发布，只输出合并到 GitHub `main` 后由 Cloudflare Pages 自动上线的提醒；正式发布链路继续保持 `GitHub main -> Cloudflare Pages Git 自动部署 -> lusu575.com`。
- 本次属于公开可见更新，已同步 `site-updates` 三语文章、`js/main.js` fallback、Functions seed、schema seed、根目录 changelog、主站 Skill 和 `main.js` cache query `20260624-account-cleanup-merge-r1`。

## 2026-06-23 公开体验、隐私与发布收口

- 主站已完成一轮公开体验收尾：按钮点击委托改为具体动作优先、通用路由最后兜底，覆盖账号、语言、筛选、文章、视频、弹窗关闭、重试和栏目跳转等常见入口，降低“按钮点了没反应”的风险。
- 视频弹窗和欢迎弹窗补齐初始焦点与关闭焦点恢复；知识库、视频、资源、游戏、聊天室等区域补充状态播报、筛选数量、重复按钮上下文和键盘焦点提示。
- 资源区和杂谈区不再公开展示没有真实链接或正文的占位卡片；Bilibili / Discord 在没有真实配置时默认隐藏；游戏来源链接只接受 GitHub 仓库地址。
- 前端与服务端访问统计继续收紧隐私边界，点击文本、路径、来源、链接和聚合键在写入前脱敏邮箱样式字符串，游戏壳层和主站本地存储读取失败时会退回当次会话状态。
- 最终公开更新已同步 `site-updates` 三语文章、`js/main.js` fallback、Functions seed、schema seed、首页最近更新日期和 `main.js` query；正式发布提交为 `cb4749d577ef7b9b320c6dfe1f3cf6037d47852d`。
- 发布后已清理本地忽略缓存和预览残留，包括 `.wrangler/`、`.wrangler-config/`、`.codex-remote-attachments/` 与 `.codex-wrangler-preview*.log`；`node_modules/` 作为依赖目录保留。

## 2026-06-22 底部导航与四时段窗口背景

- 主站底部任务栏从页面内 sticky 改为固定贴合浏览器视口下沿，切换知识库、视频区、资源区、游戏区、杂谈区、聊天室和关于我时不再被页面内容高度顶下去。
- 主窗口高度统一通过顶部栏、底部任务栏和窗口间距变量计算，桌面端和移动端都为底部栏预留空间，避免任务栏盖住正常窗口或和窗口控件重叠。
- 460px 以下窄屏手机单独提高 `--chrome-topbar-height` 预留值，覆盖顶部栏换行后的实际高度，避免 iPhone SE / 390px 宽度下窗口底部压进 118px 底部任务栏。
- 非首页窗口页不再使用蓝绿色兜底渐变，改为 `assets/images/window-backdrops/<time>.png` 专用四时段低干扰背景图，并叠加轻量现代遮罩；首页原有动态壁纸舞台、云层和 `?wallpaper=` 预览参数保持不变。
- 本次属于公开可见更新，已同步 `site-updates` 三语文章、`js/main.js` fallback、Functions seed、schema seed、根目录 changelog、主站 Skill 和主站 CSS/JS cache query。

## 2026-06-22 关于我联系方式图标归位

- 关于我窗口删除联系方式里的占位文案，将 X、GitHub、Bilibili、Instagram、Discord 五个入口移动到“联系方式”这一行内展示。
- 五个平台图标改为项目内本地 SVG 品牌图标资源，前端通过 CSS mask 渲染原应用图标形状和品牌色；主站仍只显示小图标按钮，不增加可见平台文字。
- 社交链接读取和后台维护逻辑不变：主站继续通过 `GET /api/social-links` 读取 D1 `site_runtime_state.about_social_links`，按钮保留 `aria-label` 并在新标签打开。
- 本次属于公开可见更新，已同步 `site-updates` 三语文章、`js/main.js` fallback、Functions seed、schema seed、根目录 changelog 和主站 CSS/JS cache query。

## 2026-06-20 关于我社交图标与后台链接管理

- 关于我窗口新增 X、GitHub、Bilibili、Instagram、Discord 五个小图标入口；主站只显示图标按钮，不增加可见文字，按钮保留 `aria-label` 并在新标签打开对应链接。
- 主站新增公开只读接口 `GET /api/social-links`，前端初始化时读取 D1 配置，接口不可用时回退到代码内默认链接。
- 后台新增“社交链接”页面，接口为 `GET /api/admin/social-links` 和 `PUT /api/admin/social-links`，继续通过 `requireAdmin` 限制 `users.role = admin` 才能读取或修改。
- 社交链接保存到 D1 `site_runtime_state` 的 `about_social_links` key；保存时只接受 http(s) URL，省略协议时由服务端补 `https://`。
- 本次属于公开可见更新，已同步 `site-updates` 三语文章、`js/main.js` fallback、Functions seed、schema seed、根目录 changelog、主站 Skill 和后台专用文档。

## 2026-06-19 主站四时段沉浸式桌面栏

- 首页顶部栏和底部任务栏新增 morning / day / dusk / night 四套无竖线的现代玻璃像素 HUD 样式，跟随现有本地时间判断与 `?wallpaper=morning|day|dusk|night` 预览参数切换。
- 顶部栏保留站点图标、站名、账号入口、语言切换和最近更新日期；底部任务栏保留 Start、现有窗口图标、导航入口、本地时间和在线状态，不替换原有图标资源。
- 本次只调整公开主站视觉层和缓存版本，顶部栏去掉旧版竖向栅格、底部栏改为更轻的 dock 式像素轨道，并同步 `site-updates` 三语更新文章、前端 fallback、Functions seed 与 schema seed；未修改 `/admin/`、账号接口、聊天接口、文章接口或游戏存档逻辑。

## 2026-06-16 后台视频封面上传

- 后台视频管理新增本地封面能力：管理员可选择 JPG、PNG、WEBP、AVIF 图片，浏览器端压缩裁切为 16:9 后写入现有 `videos.thumbnail_url` 字段。
- 后台新增从本地视频文件读取第一帧生成封面的控件；保存时如果封面为空且已选择本地视频，会先自动生成封面再提交。
- 该能力只处理视频封面，不上传、不托管本地视频文件；视频播放来源仍限 YouTube / youtu.be / Bilibili / b23.tv 白名单链接。
- 后端封面校验继续放行 YouTube / Bilibili 图片域名，并新增受限 `data:image` 封面白名单和大小上限，拒绝 SVG、HTML、任意 data URL 或过大封面。

## 2026-06-15 后台账号管理与登录态 UV 口径

- 后台新增“账号管理”页面，入口在 `/admin/` 侧边栏，位置位于“后台更新记录”上方。
- 后台账号接口：`GET /api/admin/accounts`、`GET /api/admin/accounts/:userId`、`PUT /api/admin/accounts/:userId`。
- 账号管理只允许 `users.role = admin` 访问，继续复用 `/api/admin/*` 的 `requireAdmin` 服务端权限校验。
- 账号页显示注册邮箱、角色、密码加密状态、最近登录、活跃会话、云存档数量、登录履历和近期站内活跃。
- 密码不明文展示，也不向后台前端返回 `password_hash`；修改密码只能通过“新密码”字段重置。真实账号数据只存在 Cloudflare D1，不写入 GitHub 仓库。
- D1 新增 `user_login_events` 表，记录成功登录/注册后的登录履历；只保存掩码 IP 前缀、IP hash、Cloudflare 地区字段、设备摘要和时间，不保存完整明文 IP。
- 访问统计改为登录账号优先识别：登录用户的页面访问、点击和文章阅读使用由账号 ID 派生的不可逆统计 ID，因此同一登录账号跨设备、多次访问仍只计为 1 个 UV；匿名访客继续使用 HttpOnly `lusu_visitor` cookie。
- 后台实时大屏增加自然语言说明，解释 PV、UV、在线访客和点击数据，减少只看缩写造成的误读。

本文档用于帮助新的 AI / Codex 对话快速理解鲁肃个人站。它只保留项目总说明和核心事实；长期维护规则、强约束和踩坑点已拆分到项目专用 Skill。

## 项目背景与介绍

- 项目名称：鲁肃的个人站
- 英文名称：LuSu's Personal Site
- GitHub 仓库：`lusu575/lusu-personal-site`
- 本地目录：以当前 Git checkout 根目录为准；维护脚本不得依赖某台机器的固定盘符路径。
- 当前主分支：`main`
- 当前正式域名：`https://lusu575.com`
- 当前备用 Pages 域名：`https://lusu-personal-site-9hd.pages.dev`
- 站点定位：个人空间，用于记录 AI、游戏、工具、素材、视频、知识库和杂谈内容。
- 风格目标：桌面端保持 Windows XP + Pixel Art + Y2K 并升级为 Neo-XP / Pixel Glass OS；移动端使用原创、受 iOS 交互启发的虚拟手机 OS，两端共享同一业务状态。

## 技术栈

- 前端：HTML + CSS + JavaScript；在线画板独立使用 React、Excalidraw、Yjs
- 后端：Cloudflare Pages Functions；在线画板房间权威服务使用独立 Cloudflare Durable Object Worker
- 数据：Cloudflare D1；在线画板另使用 Durable Object SQLite 和私有 R2
- AI 接入：共享能力注册表 + 本地 Node.js CLI / stdio MCP；生产 OAuth remote MCP 位于 `https://lusu575.com/mcp`，当前提供四个公开读取工具与五个站长知识库工具
- 部署：Cloudflare Pages Git 自动部署
- 依赖管理：npm / package-lock
- Cloudflare CLI：Wrangler

## 正式部署方式

正式部署链路：

```text
GitHub main -> Cloudflare Pages Git 自动部署 -> lusu575.com
```

Cloudflare Pages 项目状态：

- 项目名：`lusu-personal-site`
- Git Provider：已连接 GitHub
- 生产分支：`main`
- 自定义域名：`lusu575.com`、`www.lusu575.com`
- D1 数据库：`lusu_personal_site`
- D1 绑定名：`DB`
- D1 database_id：`55087326-4cf0-4002-8229-f202af774da4`

部署说明：

- 网站代码以 GitHub `main` 为源头。
- 修改 GitHub `main` 后，Cloudflare Pages 自动同步并部署到 `lusu575.com`。
- Vercel 不再是这个站点的正式部署入口。
- Cloudflare Pages 构建设置固定为：框架预设 `None`，构建命令 `npm run build`，构建输出目录 `dist`，根目录 `/`。根 `wrangler.jsonc` 的 `pages_build_output_dir` 也必须为 `dist`。
- `wrangler pages deploy .` 只用于本地手动应急部署，不是 GitHub 自动部署链路。
- 每次提交 main 后，必须核对 `origin/main` 最新 commit、Cloudflare Pages 最新成功生产部署 commit、线上 `index.html` 中 CSS/JS query 版本三者一致；如果线上页面与本地不一致，优先检查资源 query、Cloudflare/浏览器缓存和最新部署状态。

## 主要功能

- 单页、单业务状态的双呈现壳个人站：桌面端 Neo-XP，移动端原创虚拟手机 OS
- 桌面首页图标入口；移动 Home 的 App grid 与 Dock 复用同一组既有路由
- 首页使用四时段像素壁纸：基础静态底图位于 `assets/images/wallpapers/`，按用户本地时间切换 morning / day / dusk / night。桌面 Home 在 normal/full 动效档下只加载当前主题约 5.17 秒的第一版 H3 整帧往返视频；每段由第一版源帧 `0..62 + 61..1` 组成 24fps 序列，先经双向光流补为 48fps、248 帧，再用 `RealESRGAN_x4plus_anime_6B` 对全部帧逐帧 AI 超分，交付 1080p／2160p。第二版静态底一次超分再叠局部 mask／gain 差分的方案已经弃用；当前视频不含小女孩或电视 cameo。手机、low performance、Save-Data、reduced／off 不请求视频，静态底图始终兜底。本地调试可用 `?wallpaper=morning` / `?wallpaper=day` / `?wallpaper=dusk` / `?wallpaper=night` 强制预览指定时段。
- 顶部栏和底部任务栏：保留 XP 桌面结构与原有图标，并跟随 morning / day / dusk / night 四时段切换无竖线的现代玻璃像素 HUD 色温与高光
- 知识库、视频区、工具区、游戏区、杂谈区、匿名聊天室、关于我
- 工具区中的多人实时在线画板：`/tools/whiteboard/`，支持公共房、密码房、实时鼠标与名字、图片、PNG/SVG 导出和移动端绘制
- 关于我窗口含 X、GitHub、Bilibili、Instagram、Discord 五个可点击小图标入口，链接从 D1 `site_runtime_state.about_social_links` 读取，后台可维护
- 中文 / English / 日本語 三语切换
- 主站右上角账号入口
- 游戏页统一外壳和云存档能力
- 数据库化三语文章系统：文章内容保存在 Cloudflare D1，网站按当前语言读取 zh / en / ja 内容
- Cloudflare Pages Functions 后端接口
- 本地 CLI / stdio MCP 能力层：公开内容读取与经设备码授权的 Quick Transfer 操作
- Cloudflare D1 持久化账号、会话、游戏存档、聊天室消息和文章内容
- 独立中文管理后台：`/admin/` 仅允许 `users.role = admin` 的站长账号访问，复用主站账号系统，但后台页面、项目介绍和后台更新记录单独维护，不公开到主站知识库。
- 访问与点击埋点：主站通过独立 `js/telemetry.js` 记录 PV、UV、访问来源、地理位置聚合和点击事件；访客使用 HttpOnly 隐藏 ID 识别，前台不显示该 ID；点击目标文本、页面路径、来源、链接、元素标识和点击聚合键中的邮箱样式文本（含 URL 编码和双重编码形态）会在前端与服务端写入前脱敏。

## 数据库化三语文章系统

文章系统第一阶段只做数据库化内容管理和前台读取，不做自动翻译、翻译按钮或 retranslate 接口。

文章存储：

- 文章代码和展示逻辑仍保存在 GitHub。
- 文章内容保存在 Cloudflare D1。
- 每篇文章用一条 `articles` 保存通用信息。
- 每篇文章用 `article_translations` 保存三语内容：`zh`、`en`、`ja`。
- 后台发布文章时要求一次性提供 zh / en / ja 三种内容。
- 正文使用 Markdown 保存。

前台读取规则：

- 当前网站语言为中文时，请求 `lang=zh` 并显示中文内容。
- 当前网站语言为 English 时，请求 `lang=en` 并显示英文内容。
- 当前网站语言为 日本語 时，请求 `lang=ja` 并显示日文内容。
- 如果当前语言版本不存在，fallback 到中文 `zh`。
- 如果中文也不存在，fallback 到任意已有语言版本。
- 知识库区域已改为从 `/api/articles` 读取文章列表，点击后从 `/api/articles/:slug` 读取详情。
- 文章详情公开地址使用 `/articles/<slug>`，可以通过 `https://lusu575.com/articles/<slug>` 直接分享和访问单篇文章；内部 `article_id` 只用于数据库和后台管理，不在公开链接或公开 API 中外显。旧的 `#knowledge/article/<slug>` hash 入口仅作为兼容入口保留。
- 网站切换语言时，文章列表和当前文章详情会重新请求对应语言版本。
- 文章发布时间在前端按用户所在时区显示到秒，不显示时区名；后端时间字段应保持 ISO/UTC 语义，避免被浏览器误读成本地时间。后台文章编辑器显示管理员本地时间，保存时统一转换为 UTC ISO；后端也会规范化 `published_at`，确保不同地区用户看到同一个绝对时间的本地化结果。
- 从文章详情关闭知识库后，再次打开知识库默认回到知识库首页，不保留上一次打开的文章详情。
- 知识库固定使用 `site-updates` 作为“网站更新记录”分类，分类入口排在最后。
- 每次代码合并、功能上线或可见更新，都要在 `site-updates` 分类发布一篇 zh / en / ja 三语真实文章，包含主标题、简介和正文。
- 这条是合并验收门槛，不是可选文档项；如果无法通过后台直接发布，也必须在同一次代码变更里补齐 seed 与 fallback，确认知识库、欢迎弹窗“最近更新”和右上角最新日期都能读到这次更新。
- 首页欢迎弹窗右侧“最近更新”自动读取 `site-updates` 分类文章；“查看更多更新”跳转到知识库并筛选该分类。
- 通过 seed 维护 `site-updates` 时，必须同时更新 `functions/api/[[route]].js` 的 `articleSeedStatements`、`cloudflare/schema.sql` 和 `js/data/content.mjs` 的本地 fallback `content.updates`，避免线上 D1、手动 migration 和 D1 不可用兜底显示不一致。
- 2026-06-11 已清理三篇文章系统测试内容：`xp-site-notes`、`local-ai-workflow`、`fallback-check`；当前保留真实 `site-updates` 更新文章。
- 文章详情前端使用 slug + 请求语言缓存和请求状态保护，避免语言切换或重渲染时重复拉取同一详情并卡在“读取中”。
- 文章正文渲染器支持基础 Markdown、有序/无序列表、blockquote、`text` 代码块蓝色说明框、白名单路径 `assets/images/articles/` 下的文章图片，以及无账号凭证的绝对 HTTPS Markdown 链接；正文与显式图注都必须用 DOM/textContent 构建，不能直接插入未处理 HTML。外链使用 `target="_blank"` 与 `rel="noreferrer noopener"`，危险协议、相对地址和含用户名或密码的 URL 保持不可执行文字。

公开接口：

- `GET /api/articles?lang=zh`
- `GET /api/articles?lang=en`
- `GET /api/articles?lang=ja`
- `GET /api/articles/:slug?lang=zh`
- `GET /api/articles/:slug?lang=en`
- `GET /api/articles/:slug?lang=ja`
- `GET /api/social-links`

后台接口：

- `GET /api/admin/articles`
- `POST /api/admin/articles`
- `PUT /api/admin/articles/:articleId`
- `DELETE /api/admin/articles/:articleId`

权限：

- `users` 表新增 `role` 字段：`user` / `admin`。
- Pages Functions 的 schema guard 会为旧 `users` 表自动补 `role` 列。
- 只有 `role = admin` 的登录用户可以访问后台文章接口。
- 普通登录用户只能继续使用游戏云存档等原有能力，不能管理文章。
- `/admin/` 后台文章编辑页会一次性保存 zh / en / ja 三种内容，但编辑界面只显示当前选择的语言面板。

Markdown 安全：

- 文章详情第一阶段只支持基础 Markdown。
- 前端详情正文使用 DOM 节点和 `textContent` 构造，不直接把未处理 Markdown/HTML 插入页面。
- 聊天室仍保持纯文本渲染规则不变。

## 管理后台、访问监控与埋点

后台入口：

- 页面：`/admin/`
- 静态文件：`admin/index.html`、`admin/admin.css`、`admin/admin.js`
- 访问拦截：`functions/admin/_middleware.js`
- 权限：复用主站 `lusu_session` HttpOnly cookie 和 `users.role = admin`，非 admin 只能看到后台登录/拒绝页，不能读取后台静态资源或后台 API 数据。
- 后台只使用中文文案；后台项目介绍和后台更新记录保存在后台页面内，其中后台更新记录是独立标签页，不写入主站知识库 `site-updates`，也不对外公开。

后台能力：

- 实时监控大屏：显示今日 PV、UV、周期 PV/UV、今日点击、在线访客、今日聊天数。
- 访问来源：按 Cloudflare `request.cf` 和请求头记录国家、region/省份、城市、colo、时区、经纬度；IP 只保存 hash 和掩码前缀，不保存完整明文 IP。
- 地图界面：后台使用本地 Natural Earth SVG 世界轮廓，根据 Cloudflare 城市级聚合经纬度绘制 SVG 圆点；点位详情只展示城市 / 地区、PV/UV 和最近访问时间，不展示 IP、掩码网络前缀或隐藏访客标识。
- 点击埋点：记录站内按钮、链接、桌面入口、筛选、文章和视频等点击目标，保存路径、route、目标文本、元素标识和屏幕尺寸；目标文本、路径、来源、链接、元素标识和点击聚合键写入前会对邮箱样式文本（含 URL 编码和双重编码形态）脱敏，不记录输入框内容。
- 知识库文章：后台可新建、编辑、发布、删除文章；保存和发布时要求 zh / en / ja 三语标题与正文齐全。
- 视频管理：后台可维护 YouTube / Bilibili / b23.tv 视频和视频分类；服务端解析链接、生成规范化播放器地址，并在后台预览、保存或刷新时抓取标题、简介、作者、发布时间和封面。
- 聊天室管理：后台可查看隐藏访客 ID、client id、IP hash/IP 前缀、来源地；可编辑、隐藏/恢复、删除消息，并按隐藏访客 ID 或 IP hash 禁言。
- 互传文件管理：后台可分页查看当前保存的文件、发送账号、大小、保存 / 过期时间和状态，搜索具体占用项，并永久删除私有 R2 对象及对应 D1 记录。
- 社交链接管理：后台可修改关于我窗口中 X、GitHub、Bilibili、Instagram、Discord 五个图标按钮的跳转地址；配置保存到 `site_runtime_state.about_social_links`，主站只读展示图标入口。
- 后台更新记录：后台私有更新说明独立于“后台说明”，每次后台更新后同步维护页面内记录和 `admin/docs/ADMIN_CHANGELOG.md`。

公开埋点接口：

- `POST /api/analytics/identify`
- `POST /api/analytics/page-view`
- `POST /api/analytics/click`

文章访问埋点：
- `GET /api/articles/:slug` 在成功返回已发布文章详情时，会额外写入 `article_view_events`，按隐藏 `lusu_visitor` 统计单篇文章 PV/UV、语言和来源地理信息；后台热门文章、文章列表和文章详情统计均以该表为准。

后台接口：

- `GET /api/admin/me`
- `GET /api/admin/analytics/overview`
- `GET /api/admin/articles`
- `GET /api/admin/articles/:articleId`
- `POST /api/admin/articles`
- `PUT /api/admin/articles/:articleId`
- `DELETE /api/admin/articles/:articleId`
- `GET /api/admin/chat/messages`
- `PUT /api/admin/chat/messages/:messageId`
- `DELETE /api/admin/chat/messages/:messageId`
- `GET /api/admin/chat/bans`
- `POST /api/admin/chat/bans`
- `DELETE /api/admin/chat/bans/:banId`
- `GET /api/admin/social-links`
- `PUT /api/admin/social-links`

访客 ID 规则：

- `lusu_visitor` 是后台识别用 HttpOnly cookie，前台页面不显示、不通过公开接口返回。
- 聊天室前端仍保留本地 client id 只用于“我的消息”显示；后台禁言和审计使用隐藏 `lusu_visitor` 对应的服务器 visitor_id。
- 即使用户修改聊天室昵称，后台仍可通过隐藏 visitor_id 识别同一访客。

## 账号与云存档

账号系统只服务于游戏自动云存档，不影响普通网站浏览。

前端入口：

- 主站右上角：`#account-widget`
- 登录 UI：`js/main.js`
- 游戏页：显示云存档状态，支持同步和退出

后端位置：

```text
functions/api/[[route]].js
```

相关接口：

- `/api/health`
- `/api/auth/me`
- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/logout`
- `/api/saves/:gameId`
- `/api/articles`
- `/api/articles/:slug`

存档同步逻辑：

- 游戏本体仍然使用浏览器 `localStorage`。
- `games/game-shell.js` 收集 `games/catalog.json` 中声明的 storage keys。
- 登录后进入游戏页，会读取云端存档。
- 如果云端存档比本地已知存档更新，会暂停全部上传并显示可下载本地备份的三语冲突处理窗口。
- 本地有存档时只会携带精确 `expectedUpdatedAt` 上传到 D1；服务端原子条件写入，版本不匹配返回 `SAVE_CONFLICT`。
- 自动同步间隔：30 秒。
- 切出页面时会尝试 flush 游戏自己的保存函数并同步；存在冲突或尚未核对云端版本时不上传。

安全和限制：

- 密码使用 PBKDF2-SHA256 哈希。
- 会话使用 HttpOnly cookie：`lusu_session`。
- 单个游戏存档最大约 1MB。
- 如果后续要支持大量用户或更复杂账号能力，应迁移到更完整的 Auth 方案。

## 匿名聊天室

当前聊天室是 XP 像素风匿名聊天室 MVP：

- 未登录访客可直接发言。
- 聊天室与在线画板共用服务端验证的全站匿名身份；高熵凭证只保存在 HttpOnly `lusu_anonymous` Cookie，D1 只保存凭证 SHA-256，浏览器不能任意修改永久 `anonymous_id`。
- 服务端安全词根会生成超过一万种临时名字和稳定颜色；用户只能请求随机换名，约 30 秒冷却并限制短期次数，不开放自由昵称。历史消息保留发送时的名字。
- 前端首次进入加载最近消息，后续保持 `after/message_id` 增量拉取。
- 有新消息时继续 5 秒刷新；无新消息时逐步降到 15 秒和 30 秒；窗口不在前台时降低轮询频率；用户发送消息后立即刷新一次。
- 聊天内容必须纯文本渲染。
- 聊天消息时间在前端按用户所在时区显示；当天消息显示本地时间和时区，旧消息显示本地日期、时间和时区。

前端入口：

- 桌面图标：`data-route="chatroom"`
- 页面：`#chatroom`
- 逻辑：`js/main.js`
- 样式：`css/style.css`

后端接口：

- `GET /api/chat/messages?limit=100`
- `GET /api/chat/messages?after=<message_id>&limit=100`
- `GET /api/chat/nickname`
- `POST /api/chat/messages`

D1 表：`anonymous_chat_messages`

保存字段：

- `message_id`
- `visitor_id`
- `nickname`
- `content`
- `created_at`
- `hidden`
- `ip_hash`

公开聊天室仍不做私聊、图片发送、表情包、WebSocket、在线状态或多聊天室房间；管理能力已放到独立 `/admin/` 后台。

## 游戏区

当前游戏区只保留能在本站直接打开、不跳转外站的本地游戏入口：

- `kittens-game`
- `a-dark-room`
- `2048`
- `hextris`
- `life-restart`

2026-06-11 已删除 `vue-xiuxiangame`、`cultivation-world-simulator`、`XianTu`、`react-xiuxian-game`、`Daoyou`、`freeciv-web`、`OpenTTD` 等外部入口展示；这些项目需要构建链路、后端服务、外部服务器或原生客户端，不适合作为本站静态游戏直接部署。

2026-06-12 已将 `VickScarlet/lifeRestart` 以本地静态游戏形式接入 `games/life-restart/`：
- 上游项目需要先构建，临时源码内使用 `npm.cmd install`、`npm.cmd run xlsx2json`、`npm.cmd run build`；上游推荐 pnpm，但本机无 pnpm 时 npm 可执行同名脚本。
- 构建产物目录为上游 `template/public`，本站仅提交该目录复制后的 `games/life-restart/source/` 以及 `source/LICENSE.txt`。
- 上游 Vite 配置 `base: './'`，可在 Cloudflare Pages 子目录 `/games/life-restart/source/` 下通过相对路径加载资源。
- 语言支持：中文 `zh-cn`、English `en-us`；暂无日本語资源，站点日语界面进入时默认启动 English。
- 上游游戏启动函数读取 query 参数 `language`，不是本站通用的 `lang`；`games/catalog.json` 必须保留 `languageQueryParam: "language"`，否则切换 English 会回落到中文。
- 本地存档键已记录到 `games/catalog.json`：`theme`、`times`、`extendTalent`、`ATLT`、`AEVT`、`ACHV`、`uniqueWaTaShi`。

游戏列表：

- 主站不再使用独立游戏大厅页。
- `js/main.js` 读取 `games/catalog.json` 生成游戏列表。
- 内置游戏使用本站 `games/<game-id>/` 和 `game-shell`；需要后端、构建或外部服务的开源项目先作为外部入口展示。
- 多语言支持较完整的游戏优先排在列表顶部；每张卡片必须显示中文 / English / 日本語支持状态。

游戏页统一使用：

- `games/game-shell.js`
- `games/game-shell.css`

游戏页能力：

- 返回个人站游戏区
- 协议与上游仓库展示
- 本地存档导出
- JSON 存档导入
- 登录后自动云端存档

游戏语言：

- 网站支持中文 / English / 日本語 三语切换。
- 后续新增游戏时，游戏标签或信息里必须标明中文、English、日本語是否支持。
- 网站切换语言时优先展示对应语言。
- 如果游戏不支持当前语言，默认启动英语版本。

## D1 数据表

- `users`
- `sessions`
- `user_login_events`
- `game_saves`
- `anonymous_identities`
- `anonymous_chat_messages`
- `chat_bans`
- `whiteboard_rooms`
- `whiteboard_assets`
- `whiteboard_bans`
- `whiteboard_admin_audit`
- `articles`
- `article_translations`
- `videos`
- `video_categories`
- `video_category_relations`
- `site_runtime_state`（视频分类 seed 标记、关于我社交链接等轻量运行时配置）
- `site_visitors`
- `analytics_page_views`
- `analytics_click_events`
- `article_view_events`

## 主要文件结构

```text
/
├── index.html
├── CHANGELOG.md
├── PROJECT_CONTEXT.md
├── design-qa-mobile-os.md
├── README.md
├── package.json
├── package-lock.json
├── wrangler.jsonc
├── _headers
├── _redirects
├── assets/
├── admin/
│   ├── index.html
│   ├── admin.css
│   ├── admin.js
│   └── docs/
│       ├── ADMIN_PROJECT_CONTEXT.md
│       ├── ADMIN_SKILL.md
│       └── ADMIN_CHANGELOG.md
├── cloudflare/
│   ├── README.md
│   └── schema.sql
├── css/
│   ├── style.css
│   ├── mobile-ios-shell.css
│   └── motion-system.css
├── functions/
│   ├── admin/
│   │   └── _middleware.js
│   └── api/
│       ├── [[route]].js
│       ├── agent-auth.mjs
│       ├── anonymous-identity.mjs
│       ├── public-content-service.mjs
│       └── whiteboard-service.mjs
├── lib/
│   └── capabilities/
├── cli/
│   └── lusu.mjs
├── mcp/
│   └── local/
│       └── server.mjs
├── games/
│   ├── catalog.json
│   ├── game-shell.css
│   ├── game-shell.js
│   ├── 2048/
│   ├── hextris/
│   ├── kittens-game/
│   ├── a-dark-room/
│   └── life-restart/
│       （新增游戏必须优先本地静态部署，不要只做外部跳转入口）
├── tools/
│   └── whiteboard/
│       ├── index.html
│       ├── src/
│       └── THIRD_PARTY_NOTICES.md
├── workers/
│   ├── site-mcp/  (公开读取工具注册层与独立无 OAuth 目标)
│   ├── site-admin-mcp/  (生产 OAuth remote MCP)
│   └── whiteboard/
│       ├── src/
│       └── wrangler.jsonc
├── docs/
│   └── agent-capabilities/
├── js/
│   ├── main.js
│   ├── mobile-shell.js
│   ├── ui-motion.js
│   └── telemetry.js
└── skills/
    └── lusu-personal-site-skill/
        ├── SKILL.md
        └── README.md
```

## 本地开发方式

安装依赖：

```powershell
npm.cmd ci
```

本地初始化 D1：

```powershell
npm.cmd run d1:migrate:local
```

远端执行 D1 schema：

```powershell
npm.cmd run d1:migrate:remote
```

如果需要把当前账号设为管理员，先正常注册/登录账号，再在 D1 中将对应邮箱的用户角色更新为 `admin`：

```powershell
$env:XDG_CONFIG_HOME=(Join-Path (Get-Location) '.wrangler-config')
npx.cmd wrangler d1 execute lusu_personal_site --remote --command "update users set role = 'admin' where email = '你的邮箱'"
```

本地启动 Cloudflare Pages：

```powershell
npm.cmd run dev
```

在线画板还需在另一终端启动本地 Durable Object Worker，并让根 `.dev.vars` 的四个画板 Secret 与 `workers/whiteboard/.dev.vars` 的共享 internal secret 使用独立本地测试值：

```powershell
npm.cmd run whiteboard:dev
```

提交前至少执行：

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run whiteboard:test
npm.cmd run build
npm.cmd run build:production:verify
```

本地访问：

```text
http://127.0.0.1:8788/index.html
```

健康检查：

```text
/api/health
```

PowerShell 注意：

- PowerShell 可能禁止 `npm.ps1` / `npx.ps1`，优先用 `npm.cmd`、`npx.cmd`。
- 本机 Wrangler 登录临时配置目录可能是 `.wrangler-config/`。
- `.wrangler/`、`.wrangler-config/`、`node_modules/`、`.codex-remote-attachments/` 都是本地生成内容，不得提交。

## 项目专用 Skill 索引

长期维护规则、强约束、踩坑点和每次改动必须检查的事项已拆分到：

```text
skills/lusu-personal-site-skill/SKILL.md
skills/lusu-personal-site-skill/README.md
```

管理后台有单独的专用文档和 Skill。凡是修改 `/admin/` 页面、后台样式、后台脚本、后台权限、后台 API、后台统计、后台视频管理、后台聊天室治理或后台专用文档，必须额外先读取：

```text
admin/docs/ADMIN_PROJECT_CONTEXT.md
admin/docs/ADMIN_SKILL.md
admin/docs/ADMIN_CHANGELOG.md
```

这些后台文档只服务管理后台，不等同于主站 `PROJECT_CONTEXT.md`、根目录 `CHANGELOG.md` 或主站项目 Skill；后台私有更新仍不得写入主站知识库 `site-updates`。

该 Skill 覆盖以下内容：

- 每次修改后必须更新 `CHANGELOG.md`
- 项目信息变化时必须更新 `PROJECT_CONTEXT.md`
- 新增长期注意事项、维护规则、踩坑点时必须同步补充到 Skill
- XP / Pixel Art / Y2K 视觉风格约束
- 中文 / English / 日本語 可见文案维护规则
- 前端和手机端适配检查
- 首页四时段静态像素壁纸和动画接口维护规则
- 聊天室纯文本安全渲染规则
- 只美化不动功能时的改动边界
- Cloudflare Pages Git 自动部署注意事项
- 游戏区新增游戏和游戏语言支持规则
- 双域名缓存、Wrangler、D1 和本地验证踩坑点

## 后续可扩展方向

- 真正文章详情页
- 资源上传与下载管理
- 评论系统
- 搜索功能
- Markdown 内容系统
- Cloudflare R2 文件存储
- 更完善的账号资料页

这些扩展都应优先保持现有 XP / Y2K / 像素桌面风格，不要把网站改成普通现代模板。

## 2026-06-15 视频系统更新

- 视频区已从本地占位卡片改为 D1 驱动的可管理视频系统。
- D1 新增 `videos`、`video_categories`、`video_category_relations`；“全部”分类不入库，由前端自动生成。
- 公开视频接口：
  - `GET /api/videos?lang=zh|en|ja`
  - `GET /api/videos/:videoId?lang=zh|en|ja`
- 后台视频接口：
  - `GET /api/admin/videos`
  - `POST /api/admin/videos`
  - `PUT /api/admin/videos/:videoId`
  - `DELETE /api/admin/videos/:videoId`
  - `POST /api/admin/videos/preview-url`
  - `POST /api/admin/videos/:videoId/refresh-metadata`
- 后台视频分类接口：
  - `GET /api/admin/video-categories`
  - `POST /api/admin/video-categories`
  - `PUT /api/admin/video-categories/:categoryId`
  - `DELETE /api/admin/video-categories/:categoryId`
- 后台“视频管理”和“视频分类管理”模块仍只允许 `users.role = admin` 访问。
- 后端只接受 YouTube / youtu.be / Bilibili / b23.tv 白名单链接，由服务端解析并生成规范化 `embed_url`；前端和后台预览不得直接 iframe 用户输入的任意 URL。
- 视频元数据只在后台预览、首次保存、URL 变化保存或刷新时抓取，并缓存到 D1；已有视频 URL 未变化的普通保存不重新抓取外部元数据，公开视频访问不重新抓取。后台应尽量自动补齐标题、简介、作者、发布时间和封面，Bilibili 抓取遇到 API 风控或 HTTP 412 时使用详情接口、移动页、`__INITIAL_STATE__`、`__NEXT_DATA__`、meta、结构化数据和页面状态备用解析。
- 视频排序规则：置顶视频走独立队列，只要 `pinned = 1` 就一定排在未置顶视频前面；多个置顶视频按 `pinned_sort_order` 从大到小显示，未置顶视频按 `sort_order` 从大到小显示。后台新建视频默认取当前最大普通排序 +10、当前最大置顶排序 +10，方便新视频保持在前面。
- 视频分类排序也使用数值越大越靠前的语义，后台新建分类默认 +10；默认分类 seed 只在全新视频分类表首次创建时初始化，已有表会通过 `site_runtime_state.video_categories_default_seeded` 标记为已处理，不应覆盖或补回后台维护过的 slug、中文名、英文名、日文名、排序、启用状态和已删除分类。
- 公开视频接口必须返回服务端保存的 `original_url`，用于主站“打开原地址”按钮；`embed_url` 只用于站内 iframe 播放，不要把 embed 地址当作原链接展示。
- 主站视频区从 `/api/videos` 读取列表和分类，使用安全 DOM/textContent 渲染，点击后在 XP 风格站内窗口加载 lazy iframe。
- 主站视频卡片必须保持统一尺寸；封面图片要铺满卡片封面区域，缺少封面或封面加载失败时显示同尺寸像素风占位图。
- 主站视频窗口的站内“全屏”语义是 XP 窗口最大化/还原，不要直接对 YouTube / Bilibili iframe 调用浏览器 Fullscreen API；播放器自带全屏由 iframe 内部控件自己处理。
- 跨域 iframe 内部按钮热区无法由父页面精确重写，父页面要用遮罩、透明点击防护区和收窄本站按钮热区来减少默认信息栏和底部空白误触。
- 视频区埋点复用 `js/telemetry.js`，覆盖分类筛选、视频点击、播放器打开和播放失败，不记录后台输入内容。
