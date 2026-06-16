# 鲁肃个人站管理后台专用 PROJECT_CONTEXT

> 管理后台专用说明：本文档只描述 `/admin/` 管理后台。它不等同于主站根目录 `PROJECT_CONTEXT.md`，也不能替代主站项目上下文。新的 AI / Codex 对话如果只维护后台，应先读本文档和 `admin/docs/ADMIN_SKILL.md`；如果维护主站整体，仍以根目录 `PROJECT_CONTEXT.md` 和 `skills/lusu-personal-site-skill/SKILL.md` 为准。

## 定位

- 后台名称：鲁肃个人站管理后台
- 后台入口：`/admin/`
- 本地页面：`admin/index.html`
- 样式文件：`admin/admin.css`
- 前端逻辑：`admin/admin.js`
- 后台访问拦截：`functions/admin/_middleware.js`
- 后台 API：`functions/api/[[route]].js` 中的 `/api/admin/*`
- 主要用途：站长维护个人站内容、视频、访问统计、点击埋点和聊天室治理。
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
- `functions/admin/_middleware.js` 还保留 `OWNER_ADMIN_EMAILS` 兜底名单，用于站长邮箱直接通过后台静态资源校验。
- 未登录访问后台 HTML 时返回后台登录页；已登录但非 admin 时返回拒绝页。
- 所有 `/api/admin/*` 接口必须继续在服务端调用 `requireAdmin`，不能只依赖前端隐藏按钮或静态中间件。

## 当前模块

- 实时大屏：查看今日 PV、UV、周期 PV/UV、今日点击、在线访客、今日聊天数、每日趋势、小时趋势、热门页面和热门文章。
- 访问来源：按国家、省份/地区、城市、IP 掩码前缀聚合访问来源。
- 点击埋点：查看站内按钮、链接、桌面入口、筛选、文章、视频等点击目标和最近点击事件。
- 知识库文章：新建、编辑、发布、删除文章；编辑界面按当前选择语言显示面板，但保存和发布要求 zh / en / ja 三语标题与正文齐全。
- 视频管理：维护 YouTube / Bilibili / b23.tv 视频，服务端识别链接、抓取标题、简介、作者、发布时间、封面和规范化 `embed_url`，支持草稿、发布、隐藏、排序、置顶、置顶排序、删除和刷新元数据。元数据只在后台预览、首次保存、URL 变化保存或刷新时抓取，已有视频 URL 未变化的普通保存不重新抓取外部元数据。封面可使用平台图片 URL，或在后台选择 JPG、PNG、WEBP、AVIF 本地图片后压缩写入 `thumbnail_url`；也可从本地视频文件读取第一帧生成封面，但这只生成封面，不上传或托管本地视频。置顶视频进入独立置顶队列并一定排在未置顶视频前面；多个置顶视频按 `pinned_sort_order` 从大到小显示，未置顶视频按 `sort_order` 从大到小显示，新建视频默认普通排序最大值 +10、置顶排序最大值 +10；后台编辑区只展示检查用小播放器，避免 iframe 预览占满页面。
- 视频分类管理：维护视频区分类标签，支持 slug、中文名、English、日本語、排序和启用状态；分类排序同样是数值越大越靠前，新建默认 +10；默认分类 seed 不覆盖后台维护过的 slug、分类名、排序和启用状态；“全部”分类只由前台生成，不写入数据库。
- 聊天室管理：查看聊天记录，编辑、隐藏/恢复、删除消息，并按隐藏 visitor id 或 IP hash 禁言。
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

## 相关公开接口

后台依赖主站公开侧产生或读取部分数据，但这些接口不是后台专用接口：

- `POST /api/analytics/identify`
- `POST /api/analytics/page-view`
- `POST /api/analytics/click`
- `GET /api/articles`
- `GET /api/articles/:slug`
- `GET /api/videos`
- `GET /api/videos/:videoId`
- `GET /api/chat/messages`
- `POST /api/chat/messages`

## D1 数据表

后台直接或间接依赖以下 D1 表：

- `users`
- `sessions`
- `articles`
- `article_translations`
- `article_view_events`
- `videos`
- `video_categories`
- `video_category_relations`
- `site_visitors`
- `analytics_page_views`
- `analytics_click_events`
- `anonymous_chat_messages`
- `chat_bans`

## 隐私和安全事实

- 后台访客识别使用 HttpOnly `lusu_visitor`，前台 UI 和公开 API 不展示该隐藏 ID。
- 聊天室前台本地 client id 只用于“我的消息”显示；后台禁言和审计使用隐藏 visitor id 或 IP hash。
- IP 信息只保留 hash、掩码前缀和 Cloudflare 提供的国家、region/省份、城市、colo、时区、经纬度等聚合字段。
- 埋点不得记录输入框内容、密码、文章草稿、后台表单内容或未发送聊天内容。
- 聊天室内容和昵称必须纯文本渲染；后台展示也要避免把用户内容当 HTML 执行。
- 后台视频 iframe 只能使用服务端规范化生成的 `embed_url`，不得直接信任管理员输入的任意 URL。

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
## 2026-06-15 账号管理模块

- 后台新增“账号管理”模块，导航位置在“后台更新记录”上方。
- 账号接口为 `GET /api/admin/accounts`、`GET /api/admin/accounts/:userId`、`PUT /api/admin/accounts/:userId`，全部必须继续使用 `requireAdmin`。
- 账号页显示注册邮箱、角色、密码加密状态、最近登录、活跃会话、云存档数量、登录履历和近期站内活跃。
- 密码只能重置，不能明文展示，不能把 `password_hash` 返回给浏览器，也不能把真实账号资料写入 GitHub 仓库。
- 登录履历由 D1 表 `user_login_events` 提供，只记录成功登录/注册后的时间、掩码 IP 前缀、IP hash、Cloudflare 地区字段和设备摘要，不保存完整明文 IP。
- 统计埋点对已登录用户使用不可逆账号统计 ID 合并 UV，同一账号跨设备访问只算 1 个 UV；匿名访客继续按 HttpOnly `lusu_visitor` cookie 统计。
