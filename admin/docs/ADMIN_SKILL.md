---
name: 鲁肃个人站管理后台专用 Skill
description: 维护鲁肃个人站 `/admin/` 管理后台时使用。只适用于后台页面、后台样式、后台脚本、后台权限、后台 API、后台统计、后台视频管理、后台聊天室治理和后台专用文档；不要把它误当成主站总 Skill。
---

# 鲁肃个人站管理后台专用 Skill

> 管理后台专用说明：本 Skill 只约束 `/admin/` 管理后台维护工作，不等同于主站 `skills/lusu-personal-site-skill/SKILL.md`。维护主站首页、知识库公开展示、游戏区、聊天室公开侧、首页壁纸或三语主站文案时，仍必须读取主站 Skill。

## 使用时机

- 修改 `admin/index.html`、`admin/admin.css`、`admin/admin.js`。
- 修改 `functions/admin/_middleware.js`。
- 修改 `/api/admin/*` 后台接口、后台权限、后台统计、后台文章管理、后台视频管理、后台视频分类管理、后台社交链接管理或后台聊天室治理。
- 修改后台专用文档：`admin/docs/ADMIN_PROJECT_CONTEXT.md`、`admin/docs/ADMIN_SKILL.md`、`admin/docs/ADMIN_CHANGELOG.md`。
- 修改后台页面内“后台项目介绍”或后台私有更新记录。

## 文档边界

- 后台专用上下文写入 `admin/docs/ADMIN_PROJECT_CONTEXT.md`。
- 后台专用规则和注意事项写入 `admin/docs/ADMIN_SKILL.md`。
- 后台专用更新记录写入 `admin/docs/ADMIN_CHANGELOG.md`。
- 每次后台功能、界面、接口、权限、视频管理、聊天室治理或后台文档更新后，必须同步维护后台页面内 `adminUpdates` 和 `admin/docs/ADMIN_CHANGELOG.md`；这是后台私有更新记录，不写入主站知识库 `site-updates`。
- 根目录 `PROJECT_CONTEXT.md` 只保留全站总事实和后台索引，不复制后台细节。
- 根目录 `CHANGELOG.md` 只记录项目级变更；后台私有细节优先写入 `admin/docs/ADMIN_CHANGELOG.md`。
- 后台私有更新不得写入主站知识库 `site-updates`，也不得加入 `js/main.js` 的首页最近更新 fallback。
- 如果一次后台改动同时改变主站公开可见体验（例如关于我图标、公开视频区展示），公开侧仍按主站 Skill 发布 `site-updates` 三语文章和 fallback；后台私有细节仍单独记录在 `adminUpdates` 与 `admin/docs/ADMIN_CHANGELOG.md`。

## 改动边界

- 后台静态页面、样式、脚本必须放在 `admin/`。
- 后台访问拦截必须放在 `functions/admin/_middleware.js`。
- 后台服务端接口必须继续使用 `/api/admin/*`。
- 不要把后台组件混进主站首页窗口、主站 CSS、主站桌面图标或主站三语内容体系。
- 用户明确要求“只做后台文档”时，只修改 `admin/docs/`、根目录 `CHANGELOG.md` 和必要 README 索引，不改功能代码。
- 用户明确要求“只美化后台”时，只改 `admin/admin.css` 和必要的后台 HTML class/结构，不改 API、权限、数据写入或主站逻辑。

## 后台文案和界面

- 后台只使用中文文案。
- 后台视觉可以保留轻量 Windows XP / 像素风元素，但要优先服务管理效率和可读性。
- 后台不需要主站中文 / English / 日本語 三语切换。
- 后台表格、表单、按钮、状态、空状态和错误提示必须清楚，不隐藏真实失败原因。
- 移动端后台需要保持可读、可滚动、无横向溢出；侧边栏和编辑区不能卡死。
- 后台导航默认从上到下为：实时大屏、访问来源、点击埋点、知识库文章、视频管理、视频分类管理、聊天室管理、账号管理、社交链接、后台更新记录、后台说明。

## 权限和安全

- `/admin/*` 必须由 `functions/admin/_middleware.js` 校验 `lusu_session` 和 `users.role = admin`。
- 所有 `/api/admin/*` 必须继续在服务端调用 `requireAdmin`，不得只依赖前端隐藏入口。
- 普通登录用户不能读取后台静态资源、后台 API 数据、后台统计、后台聊天审计或后台视频管理数据。
- 后台 API 错误应返回 JSON，方便前端显示真实原因。
- 不得新增绕过 admin 权限的调试接口、临时接口或公开管理接口。

## 隐私和埋点

- 后台不得记录输入框内容、密码、文章草稿、后台表单内容或未发送聊天内容。
- IP 信息只保留 hash、掩码前缀和 Cloudflare 地理聚合字段，不展示完整明文 IP。
- 后台访问地图使用本地真实世界地图轮廓资源和现有 Cloudflare 经纬度聚合字段，不接入第三方在线地图瓦片服务，也不为了地图展示保存或暴露完整明文 IP。
- 后台访问地图点位必须按本地世界地图 SVG 实际可见的 2:1 地图框投影，不要把经纬度直接映射到整块 `.pixel-map` 蓝色容器；宽屏、窄屏、切回实时大屏或窗口尺寸变化后都要保持点位和大陆轮廓对齐。
- 后台访客识别使用 HttpOnly `lusu_visitor` 对应的隐藏 visitor id；前台公开 UI 和公开 API 不展示该 ID。
- 聊天室前台 client id 只用于“我的消息”显示；后台禁言和审计使用隐藏 visitor id 或 IP hash。
- 聊天室昵称和消息在后台展示、编辑和保存时仍要保持纯文本安全，不把用户内容当 HTML 执行。

## 文章管理

- 后台文章编辑可以按当前选择语言显示单个语言面板。
- 保存和发布正式文章时必须一次性提交 zh / en / ja 三种标题与正文。
- 文章发布时间在后台编辑器显示管理员本地时间，保存前转换为 UTC ISO；后端必须再次规范化 `published_at`。
- 文章 PV/UV 以服务端 `article_view_events` 为准，不要只依赖前端页面级 PV。
- 后台文章管理接口必须继续要求 admin 权限。

## 视频管理

- 后台视频链接只支持 HTTPS 的 YouTube、youtu.be、Bilibili、b23.tv 白名单来源；YouTube videoId 必须是 11 位标准字符，Bilibili BV 号必须是 `BV` 开头、总长 12 位的标准格式。
- 视频链接必须由服务端解析，并由服务端生成规范化 `embed_url`。
- 前台和后台 iframe `src` 只能使用服务端规范化后的 `embed_url`，不得直接信任管理员输入 URL。
- YouTube / Bilibili 元数据只在后台预览、首次保存、URL 变化保存或刷新时抓取，并缓存到 D1；已有视频 URL 未变化的普通保存不得重新抓取外部元数据，公开视频访问不得每次重新抓取。元数据抓取应尽量补齐标题、简介、作者、发布时间和封面；抓取失败时要保留可读错误并允许管理员手动填写。
- 后台封面可以使用 YouTube / Bilibili 平台图片 URL，也可以由管理员选择 JPG、PNG、WEBP、AVIF 本地图片后在浏览器端压缩裁切为受限 `data:image` 写入 `thumbnail_url`；不得放宽为 SVG、HTML、任意 data URL 或任意图片域名。
- “从本地视频截首帧”只用于生成封面，不代表本站支持本地视频上传或托管；不要因此放宽 `parseVideoUrl()` 的 YouTube / Bilibili / b23.tv 白名单和 iframe 安全边界。
- Bilibili 抓取遇到 API 风控或 HTTP 412 时，应优先保留服务端白名单解析和规范化 `embed_url`，并使用浏览器化请求头、详情接口、移动页、页面 `__INITIAL_STATE__` / `__NEXT_DATA__`、meta、结构化数据、更宽的页面状态备用解析或 b23 跳转兜底，不得放宽为任意 iframe。
- 视频置顶必须走独立置顶队列：只要 `pinned = 1` 就一定排在未置顶视频前面；多个置顶视频按 `pinned_sort_order` 从大到小显示，未置顶视频按 `sort_order` 从大到小显示。后台新建视频默认取当前最大普通排序 +10、当前最大置顶排序 +10；视频分类仍按 `sort_order` 从大到小显示，新建分类默认 +10。
- 默认视频分类 seed 只允许在全新 `video_categories` 表首次创建时初始化；已有表必须通过 `site_runtime_state.video_categories_default_seeded` 视为已处理，不得覆盖或补回后台维护过的 slug、中文名、英文名、日文名、排序、启用状态和已删除分类，避免冷启动或迁移后把后台设置还原。
- 后台视频预览只是编辑检查用，不应占满编辑区；播放器容器要限制宽度、高度并在小屏单列适配。
- “全部”视频分类只由前台生成，不写入 `video_categories`。
- 删除视频分类前要考虑已有视频关联，避免破坏公开视频筛选。

## 社交链接管理

- 社交链接管理页面只放在 `/admin/`，所有接口必须继续调用 `requireAdmin`。
- 后台只维护关于我窗口的 X、GitHub、Bilibili、Instagram、Discord 五个跳转 URL，不管理可见平台文字。
- 配置保存到 D1 `site_runtime_state` 的 `about_social_links` key；公开主站通过 `GET /api/social-links` 只读读取。
- 保存时只允许 http(s) URL，管理员省略协议时可由服务端补 `https://`；不得支持 `javascript:`、`data:`、相对路径或任意 HTML。
- 主站关于我窗口必须只显示小图标按钮，不把后台填写的链接文字作为可见文案输出；按钮保留 `aria-label` 供辅助技术使用。
- 后台预览列表也必须用 DOM/textContent 渲染，不得使用 `innerHTML` 拼接链接。

## 聊天室管理

- 后台可编辑、隐藏/恢复、删除聊天消息。
- 后台可按隐藏 visitor id 或 IP hash 禁言。
- 公开聊天室接口仍必须保持纯文本渲染、长度限制和频率限制。
- 禁言原因和禁言时长属于后台治理信息，不公开给普通访客。

## 缓存和版本

- 修改 `admin/admin.css` 后，必须更新 `admin/index.html` 中 CSS query。
- 修改 `admin/admin.js` 后，必须更新 `admin/index.html` 中 JS query。
- 如果同时修改主站 `js/main.js`、`css/style.css` 或强视觉资源，还要按主站 Skill 更新 `index.html` query。
- 后台文档更新不需要改后台资源 query。

## 每次后台改动后的检查

- 后台功能或样式变更后运行 `npm.cmd run build`。
- 文档变更后检查 `admin/docs/` 标题和首段是否明确写着“管理后台专用 / 不等同于主站文档”。
- 每次后台更新后检查“后台更新记录”标签页的 `adminUpdates` 与 `admin/docs/ADMIN_CHANGELOG.md` 已同步记录本次变更。
- 搜索确认后台私有更新没有写进 `site-updates` seed、`js/main.js` fallback 最近更新或公开知识库。
- 检查根目录 `CHANGELOG.md` 只记录项目级摘要，后台细节写入 `admin/docs/ADMIN_CHANGELOG.md`。
## 2026-06-15 账号管理安全规则

- 账号管理页面必须只放在 `/admin/` 后台，并且所有账号接口必须继续调用 `requireAdmin`。
- 后台可显示邮箱、角色、密码加密状态、登录履历、活跃会话和近期活跃，但不能显示明文密码。
- 后台接口不能返回 `password_hash`、session token、完整明文 IP 或其他可直接接管账号的敏感值。
- 修改密码只能通过“新密码”字段重置；保存后前端必须清空密码输入框。
- 登录履历只记录成功登录/注册后的安全摘要：时间、掩码 IP 前缀、IP hash、地区和设备摘要。
- 登录用户的埋点 UV 使用不可逆账号统计 ID 合并；匿名访客继续使用 HttpOnly `lusu_visitor` cookie。
- 不要把真实账号邮箱、密码、哈希、session、登录记录或 D1 数据写进 GitHub 仓库、文档 seed、公开 `site-updates` 或前端 fallback。
