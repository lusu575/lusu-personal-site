# 鲁肃个人站管理后台专用 PROJECT_CONTEXT

> 管理后台专用说明：本文档只描述 `/admin/` 管理后台。它不等同于主站根目录 `PROJECT_CONTEXT.md`，也不能替代主站项目上下文。新的 AI / Codex 对话如果只维护后台，应先读本文档和 `admin/docs/ADMIN_SKILL.md`；如果维护主站整体，仍以根目录 `PROJECT_CONTEXT.md` 和 `skills/lusu-personal-site-skill/SKILL.md` 为准。

## 2026-07-16 互动城市访问地图

- 实时大屏地图当前展示最近 14 天按国家、地区和城市精确分组的城市级聚合，只使用具备有效聚合经纬度的数据行；地图仍使用项目内本地世界轮廓，不请求第三方在线地图或瓦片。
- 桌面端支持滚轮缩放、拖拽平移和点击 / 悬停城市点位；触屏支持双指缩放与拖动；键盘可聚焦城市点位并打开同一详情。点位和地图控件的触控目标至少 44px。
- 城市详情与替代数据列表展示城市 / 地区、PV 浏览量、UV 独立访客、聚合坐标和最近访问时间，不展示 IP、网络前缀、visitor id、hash 或其他隐藏标识。
- 当前后台资源版本为 `20260716-admin-interactive-map-r1`；本轮是后台私有更新，不进入主站 `site-updates`。

## 2026-07-16 移动与操作安全基线

- 窄屏后台导航为固定分组抽屉，不占业务内容首屏；文章、视频、聊天室和账号采用列表 / 详情双态，并通过浏览器历史返回列表。移动端与粗指针主要操作命中区至少 44px。
- 文章、视频、聊天和账号编辑维护表单快照与未保存状态；切换模块、切换条目、新建、移动返回和刷新前均需走离开保护，保存失败不能丢失输入。
- 文章发布一次汇总 slug 及 zh / en / ja 标题、正文的全部错误，并可从摘要直接切换语言、定位字段；前端和后台 API 都要求三语正文完整。
- 删除、封禁、停用禁言和账号敏感修改统一使用上下文确认框；已发布文章删除必须输入路径标识。访问地图点位没有动作时保持非交互，并提供同数据地区列表。
- 账号模块加载后默认不选中任何账号；资料 / 角色与密码重置拆分。密码重置可选择撤销该账号既有会话，服务端原子条件更新保证最后一个管理员不能被降级。
- 当前后台资源版本为 `20260716-admin-safety-foundation-r1`。这些是后台私有事实，不进入主站 `site-updates`。

## 2026-07-16 临时互传管理

- 临时互传管理使用独立受保护页面 `/admin/transfer.html`，从现有后台跳转或直接打开；其 API 继续由服务端数据库角色鉴权，不能信任客户端管理员状态。
- 页面只展示治理所需元数据和用量，不默认预览用户内容，也不展示房间明文口令；危险操作必须确认并记录审计。
- 可监控普通用户免费池、管理员大文件任务、清理状态和站内费用估算，并可暂停普通上传、暂停全部上传、触发清理与测试告警。
- Cloudflare 官方 1/3/5 美元账单提醒、R2 binding、生命周期及清理 Worker 部署属于站长人工配置，站内估算不得冒充官方账单。

## 定位

- 后台名称：鲁肃个人站管理后台
- 后台入口：`/admin/`
- 本地页面：`admin/index.html`
- 临时互传管理页：`admin/transfer.html`
- 样式文件：`admin/admin.css`
- 前端逻辑：`admin/admin.js`
- 后台访问拦截：`functions/admin/_middleware.js`
- 后台 API：`functions/api/[[route]].js` 中的 `/api/admin/*`
- 主要用途：站长维护个人站内容、视频、关于我社交链接、访问统计、点击埋点和聊天室治理。
- 文案范围：后台只使用中文文案，不进入主站中文 / English / 日本語 三语窗口体系。
- 更新范围：后台项目介绍和后台更新记录属于后台私有内容，不写入主站知识库 `site-updates`，也不公开展示到首页最近更新。

## 和主站的关系

- 后台和主站同属 `lusu575/lusu-personal-site` 仓库，同用 Cloudflare Pages Functions 和 D1。
- 后台复用主站账号系统、`lusu_session` HttpOnly cookie、`users.role = admin` 权限。
- 后台页面、样式、脚本和私有说明必须放在 `admin/` 或 `admin/docs/` 下，不混进主站首页窗口、主站 CSS 或主站三语文案体系。
- 主站公开更新记录继续由知识库 `site-updates` 分类维护；后台私有更新记录使用 `admin/docs/ADMIN_CHANGELOG.md` 和后台“后台更新记录”标签页内的 `adminUpdates`。
- 主站总上下文仍是根目录 `PROJECT_CONTEXT.md`；后台细节优先看本文档。

## 权限模型

- `/admin/*` 静态后台资源由 `functions/admin/_middleware.js` 拦截。
- 中间件读取 `lusu_session`，校验 D1 `sessions` 和 `users`，只有 `users.role = admin` 的账号可进入。
- `functions/admin/_middleware.js` 不再把站长邮箱白名单作为访问旁路；站长邮箱必须在 D1 中拥有 `users.role = admin` 才能通过后台静态资源校验。
- 未登录访问后台 HTML 时返回后台登录页；已登录但非 admin 时返回拒绝页。
- 所有 `/api/admin/*` 接口必须继续在服务端调用 `requireAdmin`，不能只依赖前端隐藏按钮或静态中间件。

## 当前模块

- 实时大屏：查看今日 PV、UV、周期 PV/UV、今日点击、在线访客、今日聊天数、真实世界地图来源点位、每日趋势、小时趋势、热门页面和热门文章。
- 访问来源：按国家、省份/地区、城市、IP 掩码前缀和 Cloudflare 经纬度聚合访问来源；访问地图使用本地真实世界地图轮廓资源，不加载第三方在线地图瓦片。
- 点击埋点：查看站内按钮、链接、桌面入口、筛选、文章、视频等点击目标和最近点击事件；目标文本、页面路径、来源、链接、元素标识和点击聚合键中的邮箱样式文本（含 URL 编码和双重编码形态）写入前会脱敏为 `[email]`。
- 知识库文章：新建、编辑、发布、删除文章；编辑界面按当前选择语言显示面板，但保存和发布要求 zh / en / ja 三语标题与正文齐全。
- 视频管理：维护 YouTube / Bilibili / b23.tv 视频，服务端识别链接、抓取标题、简介、作者、发布时间、封面和规范化 `embed_url`，支持草稿、发布、隐藏、排序、置顶、置顶排序、删除和刷新元数据。元数据只在后台预览、首次保存、URL 变化保存或刷新时抓取，已有视频 URL 未变化的普通保存不重新抓取外部元数据。封面可使用平台图片 URL，或在后台选择 JPG、PNG、WEBP、AVIF 本地图片后压缩写入 `thumbnail_url`；也可从本地视频文件读取第一帧生成封面，但这只生成封面，不上传或托管本地视频。置顶视频进入独立置顶队列并一定排在未置顶视频前面；多个置顶视频按 `pinned_sort_order` 从大到小显示，未置顶视频按 `sort_order` 从大到小显示，新建视频默认普通排序最大值 +10、置顶排序最大值 +10；后台编辑区只展示检查用小播放器，避免 iframe 预览占满页面。
- 视频分类管理：维护视频区分类标签，支持 slug、中文名、English、日本語、排序和启用状态；分类排序同样是数值越大越靠前，新建默认 +10；默认分类 seed 只在全新视频分类表首次创建时初始化，已有表会通过 `site_runtime_state.video_categories_default_seeded` 标记为已处理，不覆盖或补回后台维护过的 slug、分类名、排序、启用状态和已删除分类；“全部”分类只由前台生成，不写入数据库。
- 聊天室管理：查看聊天记录，编辑普通大厅明文消息，隐藏/恢复、删除消息，并按隐藏 visitor id 或 IP hash 禁言；密码房加密消息只显示“密码房加密消息（后台无法解密）”，不能编辑内容，但仍可隐藏、删除和禁言来源。网络来源 hash 带非敏感密钥代次，只有当前代次消息可新建网络来源禁言；旧代次消息仅供审计，旧禁言显示为“密钥已轮换”。禁言是否生效、是否过期由后台 API 按实际拦截条件计算。
- 社交链接管理：维护主站关于我窗口的 X、GitHub、Bilibili、Instagram、Discord 五个图标跳转；保存到 `site_runtime_state.about_social_links`，只允许 http(s) 链接，主站只显示小图标不显示平台文字。
- 后台更新记录：展示后台私有更新说明，每次后台更新后必须同步维护页面内 `adminUpdates` 和 `admin/docs/ADMIN_CHANGELOG.md`。
- 后台说明：展示后台项目介绍，不对外公开。

## 后台接口

- `GET /api/admin/me`
- `GET /api/admin/analytics/overview`
- `GET /api/admin/articles`
- `GET /api/admin/articles/:articleId`
- `POST /api/admin/articles`
- `PUT /api/admin/articles/:articleId`
- `DELETE /api/admin/articles/:articleId`
- `GET /api/admin/videos`
- `POST /api/admin/videos`
- `PUT /api/admin/videos/:videoId`
- `DELETE /api/admin/videos/:videoId`
- `POST /api/admin/videos/preview-url`
- `POST /api/admin/videos/:videoId/refresh-metadata`
- `GET /api/admin/video-categories`
- `POST /api/admin/video-categories`
- `PUT /api/admin/video-categories/:categoryId`
- `DELETE /api/admin/video-categories/:categoryId`
- `GET /api/admin/chat/messages`
- `PUT /api/admin/chat/messages/:messageId`
- `DELETE /api/admin/chat/messages/:messageId`
- `GET /api/admin/chat/bans`
- `POST /api/admin/chat/bans`
- `DELETE /api/admin/chat/bans/:banId`
- `GET /api/admin/social-links`
- `PUT /api/admin/social-links`

## 相关公开接口

后台依赖主站公开侧产生或读取部分数据，但这些接口不是后台专用接口：

- `POST /api/analytics/identify`
- `POST /api/analytics/page-view`
- `POST /api/analytics/click`
- `GET /api/articles`
- `GET /api/articles/:slug`
- `GET /api/videos`
- `GET /api/videos/:videoId`
- `GET /api/social-links`
- `GET /api/chat/messages`
- `POST /api/chat/messages`

## D1 数据表

后台直接或间接依赖以下 D1 表：

- `users`
- `sessions`
- `user_login_events`
- `articles`
- `article_translations`
- `article_view_events`
- `videos`
- `video_categories`
- `video_category_relations`
- `site_runtime_state`（视频分类默认 seed 标记、关于我社交链接等运行时配置）
- `site_visitors`
- `analytics_page_views`
- `analytics_click_events`
- `anonymous_chat_messages`
- `chat_bans`

## 隐私和安全事实

- 后台访客识别使用 HttpOnly `lusu_visitor`，前台 UI 和公开 API 不展示该隐藏 ID。
- 聊天室前台本地 client id 只用于“我的消息”显示；后台禁言和审计使用隐藏 visitor id 或 IP hash。
- 密码房聊天消息在 D1 中只保存密文，后台没有密码、密钥或解密能力；后台治理只能看到房间类型、加密状态、隐藏 visitor id、IP hash、来源字段和时间等审计信息。
- IP 信息只保留 hash、掩码前缀和 Cloudflare 提供的国家、region/省份、城市、colo、时区、经纬度等聚合字段。
- 埋点不得记录输入框内容、密码、文章草稿、后台表单内容或未发送聊天内容；点击目标文本、页面路径、来源、链接、元素标识和点击聚合键中的邮箱样式文本（含 URL 编码和双重编码形态）写入前必须脱敏。
- 聊天室内容和昵称必须纯文本渲染；后台展示也要避免把用户内容当 HTML 执行。
- 后台视频 iframe 只能使用服务端规范化生成的 `embed_url`，不得直接信任管理员输入的任意 URL。
- 社交链接保存时只接受 http(s) URL；前台关于我窗口只显示图标按钮，不能把后台填写的链接文字作为 HTML 或可见文案注入页面。

## 部署和缓存

- 正式部署链路仍是 `GitHub main -> Cloudflare Pages Git 自动部署 -> lusu575.com`。
- 后台静态资源随主站一起部署，不单独部署。
- 修改 `admin/admin.js` 或 `admin/admin.css` 后，必须同步更新 `admin/index.html` 中对应 CSS / JS query 版本，减少线上缓存继续加载旧后台资源。
- 修改后台 API、D1 schema 或权限逻辑时，需要同步检查 `functions/api/[[route]].js`、`functions/admin/_middleware.js` 和 `cloudflare/schema.sql`。
- 后台文档更新只改 `admin/docs/`、根目录 `CHANGELOG.md` 以及必要的 README 索引，不需要发布主站 `site-updates` 文章。

## 本地验证

安装依赖：

```powershell
npm.cmd install
```

本地初始化 D1：

```powershell
npm.cmd run d1:migrate:local
```

本地启动 Cloudflare Pages：

```powershell
npm.cmd run dev
```

本地访问：

```text
http://127.0.0.1:8788/admin/
```

静态检查：

```powershell
npm.cmd run build
```

注意事项：

- PowerShell 优先使用 `npm.cmd` / `npx.cmd`。
- `.wrangler/`、`.wrangler-config/`、`node_modules/`、`.codex-remote-attachments/` 是本地生成内容，不得提交。
- 如果本地没有 admin 账号，需要先注册/登录主站账号，再在 D1 中把对应 `users.role` 更新为 `admin`。

## 2026-06-20 社交链接管理模块

- 后台新增“社交链接”模块，导航位置在“账号管理”和“后台更新记录”之间。
- 接口为 `GET /api/admin/social-links`、`PUT /api/admin/social-links`，全部必须继续使用 `requireAdmin`。
- 后台表单维护 X、GitHub、Bilibili、Instagram、Discord 五个跳转地址；保存时服务端补齐省略的 `https://`，拒绝非 http(s) URL。
- 配置保存到 `site_runtime_state` 的 `about_social_links` key；公开主站通过 `GET /api/social-links` 只读获取。
- 主站关于我窗口只显示图标按钮，不显示后台填写的链接文字；后台预览列表也必须用 DOM/textContent 渲染。

## 2026-06-15 账号管理模块

- 后台新增“账号管理”模块，导航位置在“后台更新记录”上方。
- 账号接口为 `GET /api/admin/accounts`、`GET /api/admin/accounts/:userId`、`PUT /api/admin/accounts/:userId`，全部必须继续使用 `requireAdmin`。
- 账号页显示注册邮箱、角色、密码加密状态、最近登录、活跃会话、云存档数量、登录履历和近期站内活跃。
- 密码只能重置，不能明文展示，不能把 `password_hash` 返回给浏览器，也不能把真实账号资料写入 GitHub 仓库。
- 登录履历由 D1 表 `user_login_events` 提供，只记录成功登录/注册后的时间、掩码 IP 前缀、IP hash、Cloudflare 地区字段和设备摘要，不保存完整明文 IP。
- 统计埋点对已登录用户使用不可逆账号统计 ID 合并 UV，同一账号跨设备访问只算 1 个 UV；匿名访客继续按 HttpOnly `lusu_visitor` cookie 统计。
