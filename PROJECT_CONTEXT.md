# PROJECT_CONTEXT.md

## 2026-07-06 暗色前端加密密码房

- 匿名聊天室现在有普通大厅和密码房两种模式：普通大厅继续使用浅色 XP UI 和明文接口；密码房使用暗色 UI，浏览器用用户输入的密码派生房间标识和 AES-GCM 密钥。
- 密码房不提交、不保存明文密码；同一密码会派生同一 `room_key`，不同密码互相隔离。密码房消息以 `encryptedContent` 发送，D1 只保存密文，后端会拒绝密码房明文 `content`。
- `anonymous_chat_messages` 新增 `room_key`、`encrypted` 字段；旧消息默认 `room_key='public'`、`encrypted=0`。读取、发送、昵称占用、增量游标恢复和发送限流都按 `room_key` 隔离。
- 仅密码房执行 24 小时无发言清理：房间最新消息超过 24 小时后删除该房全部密文消息并释放房间；普通大厅消息保留原行为。
- 后台聊天室管理对加密消息只显示“密码房加密消息（后台无法解密）”，内容框锁定；管理员仍可隐藏、删除和按隐藏用户标识 / 网络来源禁言。
- 安全边界：这是网页端前端加密，不承诺绝对安全的完整 E2EE。弱密码可被猜中，房间标识本身也会给离线猜测提供验证目标；同时网页端仍需信任当前加载的站点 JS。
- 本次公开可见更新已补齐三语 `site-updates`、`js/main.js` fallback、Functions seed、schema seed、主站/后台资源 query、根目录 changelog、主站 Skill/README 和后台专用文档。

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
- 本地目录：`F:\lusu575个人站`
- 当前主分支：`main`
- 当前正式域名：`https://lusu575.com`
- 当前备用 Pages 域名：`https://lusu-personal-site-9hd.pages.dev`
- 站点定位：个人空间，用于记录 AI、游戏、工具、资源、视频、知识库和杂谈内容。
- 风格目标：Windows XP + Pixel Art + Y2K + 可爱复古互联网桌面。

## 技术栈

- 前端：HTML + CSS + JavaScript
- 后端：Cloudflare Pages Functions
- 数据库：Cloudflare D1
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
- Cloudflare Pages 构建设置建议保持静态站配置：框架预设 `None`，构建命令留空，构建输出目录 `/`，根目录 `/`。
- `wrangler pages deploy .` 只用于本地手动应急部署，不是 GitHub 自动部署链路。
- 每次提交 main 后，必须核对 `origin/main` 最新 commit、Cloudflare Pages 最新成功生产部署 commit、线上 `index.html` 中 CSS/JS query 版本三者一致；如果线上页面与本地不一致，优先检查资源 query、Cloudflare/浏览器缓存和最新部署状态。

## 主要功能

- 单页 XP 桌面风格个人站
- 首页桌面图标入口
- 首页使用四时段像素壁纸：基础静态底图位于 `assets/images/wallpapers/`，按用户本地时间切换 morning / day / dusk / night。四个时段均已接入动态云层，分别使用 `assets/images/wallpaper-dynamic/<time>/base-clean.png` 作为无云底图，并叠加从对应原始壁纸抠出的独立透明云层；云层沿用 `wallpaper-root` / `wallpaper-stage` 舞台坐标结构，只用 CSS `transform` / `opacity` 做同一主风向下的慢速错相漂移，并支持减少动态、小屏和页面隐藏暂停降级。本地调试可用 `?wallpaper=morning` / `?wallpaper=day` / `?wallpaper=dusk` / `?wallpaper=night` 强制预览指定动态壁纸，预览模式会临时加快云层位移以便肉眼确认动画。树冠、电视雪花、小女孩、星星、水面光效等层仍作为后续动画接口保留。
- 顶部栏和底部任务栏：保留 XP 桌面结构与原有图标，并跟随 morning / day / dusk / night 四时段切换无竖线的现代玻璃像素 HUD 色温与高光
- 知识库、视频区、资源区、游戏区、杂谈区、匿名聊天室、关于我
- 关于我窗口含 X、GitHub、Bilibili、Instagram、Discord 五个可点击小图标入口，链接从 D1 `site_runtime_state.about_social_links` 读取，后台可维护
- 中文 / English / 日本語 三语切换
- 主站右上角账号入口
- 游戏页统一外壳和云存档能力
- 数据库化三语文章系统：文章内容保存在 Cloudflare D1，网站按当前语言读取 zh / en / ja 内容
- Cloudflare Pages Functions 后端接口
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
- 通过 seed 维护 `site-updates` 时，必须同时更新 `functions/api/[[route]].js` 的 `articleSeedStatements`、`cloudflare/schema.sql` 和 `js/main.js` 的本地 fallback `content.updates`，避免线上 D1、手动 migration 和 D1 不可用兜底显示不一致。
- 2026-06-11 已清理三篇文章系统测试内容：`xp-site-notes`、`local-ai-workflow`、`fallback-check`；当前保留真实 `site-updates` 更新文章。
- 文章详情前端使用 slug + 请求语言缓存和请求状态保护，避免语言切换或重渲染时重复拉取同一详情并卡在“读取中”。
- 文章正文渲染器支持基础 Markdown、有序/无序列表、blockquote、`text` 代码块蓝色说明框，以及白名单路径 `assets/images/articles/` 下的文章图片；仍必须用 DOM/textContent 构建，不能直接插入未处理 HTML。

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
- 地图界面：后台使用本地真实世界地图轮廓资源，根据 Cloudflare 经纬度聚合数据绘制来源点位；点位只展示地区、PV/UV 和掩码 IP 前缀，不展示完整明文 IP。
- 点击埋点：记录站内按钮、链接、桌面入口、筛选、文章和视频等点击目标，保存路径、route、目标文本、元素标识和屏幕尺寸；目标文本、路径、来源、链接、元素标识和点击聚合键写入前会对邮箱样式文本（含 URL 编码和双重编码形态）脱敏，不记录输入框内容。
- 知识库文章：后台可新建、编辑、发布、删除文章；保存和发布时要求 zh / en / ja 三语标题与正文齐全。
- 视频管理：后台可维护 YouTube / Bilibili / b23.tv 视频和视频分类；服务端解析链接、生成规范化播放器地址，并在后台预览、保存或刷新时抓取标题、简介、作者、发布时间和封面。
- 聊天室管理：后台可查看隐藏访客 ID、client id、IP hash/IP 前缀、来源地；可编辑、隐藏/恢复、删除消息，并按隐藏访客 ID 或 IP hash 禁言。
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
- 如果云端存档比本地已知存档更新，会询问是否恢复云端。
- 本地有存档时会上传到 D1。
- 自动同步间隔：30 秒。
- 切出页面时会尝试 flush 游戏自己的保存函数并同步。

安全和限制：

- 密码使用 PBKDF2-SHA256 哈希。
- 会话使用 HttpOnly cookie：`lusu_session`。
- 单个游戏存档最大约 1MB。
- 如果后续要支持大量用户或更复杂账号能力，应迁移到更完整的 Auth 方案。

## 匿名聊天室

当前聊天室是 XP 像素风匿名聊天室 MVP：

- 未登录访客可直接发言。
- 首次进入会按近期/已有聊天室昵称分配不重复随机昵称，随机昵称和 visitor_id 保存在 `localStorage`。
- 支持修改昵称，历史消息保留原昵称。
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
- `anonymous_chat_messages`
- `chat_bans`
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
│   └── style.css
├── functions/
│   ├── admin/
│   │   └── _middleware.js
│   └── api/
│       └── [[route]].js
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
├── js/
│   ├── main.js
│   └── telemetry.js
└── skills/
    └── lusu-personal-site-skill/
        ├── SKILL.md
        └── README.md
```

## 本地开发方式

安装依赖：

```powershell
npm.cmd install
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
$env:XDG_CONFIG_HOME='F:\lusu575个人站\.wrangler-config'
npx.cmd wrangler d1 execute lusu_personal_site --remote --command "update users set role = 'admin' where email = '你的邮箱'"
```

本地启动 Cloudflare Pages：

```powershell
npm.cmd run dev
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
