---
name: 鲁肃个人网站专用Skill
description: 维护鲁肃个人站 lusu575/lusu-personal-site 时使用。适用于修改项目文档、前端界面、三语文案、聊天室、游戏区、账号云存档、Cloudflare Pages Functions、D1、部署说明或长期维护规则。使用本 Skill 保持 XP Pixel Art Y2K 风格、更新 CHANGELOG 和 PROJECT_CONTEXT，并遵守项目安全与部署约束。
---

# 鲁肃个人网站专用Skill

## 使用时机

维护 `F:\lusu575个人站` / `lusu575/lusu-personal-site` 时使用本 Skill，尤其是以下任务：

- 修改网站代码、样式、文案、图片、游戏区、聊天室、账号、云存档或后端接口。
- 修改 `PROJECT_CONTEXT.md`、`CHANGELOG.md`、README、部署说明或维护规则。
- 新增游戏、页面、窗口、图标、弹窗、任务栏入口或长期注意事项。
- 如果任务涉及 `/admin/` 管理后台、后台样式、后台脚本、后台权限、后台 API、后台统计、后台视频管理、后台聊天室治理或后台专用文档，必须同时读取 `admin/docs/ADMIN_PROJECT_CONTEXT.md`、`admin/docs/ADMIN_SKILL.md` 和 `admin/docs/ADMIN_CHANGELOG.md`，并以后台专用 Skill 约束为准处理后台细节。

## 每次改动必须执行

- 每次修改项目后，必须同步更新 `CHANGELOG.md`，记录日期、功能、界面、后端、部署、文档或规则变化。
- 项目信息变化时，必须同步更新 `PROJECT_CONTEXT.md`，保持项目背景、技术栈、部署方式、主要功能、文件结构和本地开发方式准确。
- 新增长期注意事项、维护规则、踩坑点或约束时，必须同步补充到本 Skill。
- 本 Skill 规则变化时，必须同步更新 `skills/lusu-personal-site-skill/README.md`。
- 后台专用文档或后台维护规则变化时，必须同步更新 `admin/docs/ADMIN_PROJECT_CONTEXT.md`、`admin/docs/ADMIN_SKILL.md` 或 `admin/docs/ADMIN_CHANGELOG.md` 中对应内容；不要把后台私有规则只写在主站文档里。
- 用户明确要求“只改文档”时，只修改文档文件，不改网站代码、样式、功能或资源。
- 用户明确要求“只美化 / 不动功能”时，只改视觉层文件，避免修改路由、登录、渲染数据、游戏加载、聊天室接口等功能逻辑。

## 风格与文案规则

- 保持 Windows XP + Pixel Art + Y2K + 可爱复古互联网桌面风格。
- 必须保留桌面感、蓝色标题栏、XP 风格按钮、任务栏、状态栏、像素图标、蓝天白云、草地和老互联网氛围。
- 避免现代极简博客风、商务 landing page、大面积纯白卡片堆砌、过重单色渐变背景。
- 可见文案必须维护中文 / English / 日本語 三种语言，不能只改一种语言。
- 调整图标、按钮、任务栏标签、桌面入口或标题栏时，必须检查图标和文字的对齐、换行、截断和小屏幕显示。
- 首页四时段壁纸基础图放在 `assets/images/wallpapers/`，按用户本地时间切换 `morning` / `day` / `dusk` / `night`。
- 首页壁纸必须保留 `wallpaper-root` / `wallpaper-stage` 舞台坐标结构；静态底图和后续动画图层要共享同一套 cover 裁切尺寸，不要直接用视口百分比硬贴小图层。
- 首页壁纸和欢迎弹窗问候语必须使用同一套时间段：05:00-10:59 morning，11:00-16:59 day，17:00-19:59 dusk，20:00-04:59 night。
- 当前四个时段均已启用动态云层：`assets/images/wallpaper-dynamic/<time>/base-clean.png` 作为无云底图，独立透明云层按 1672x941 舞台坐标摆放并沿同一主风向慢速错相漂移；morning / dusk / night 的低地平线云默认保留静态，避免移动后像贴在地面。
- 本地调试动态壁纸可用 `?wallpaper=morning` / `?wallpaper=day` / `?wallpaper=dusk` / `?wallpaper=night` 强制预览指定时间段；该预览模式可以临时加快动画以便肉眼确认移动，不要为了预览硬编码当前时间。
- 首页壁纸动画只使用 CSS `transform` / `opacity`，不要用 JS 每帧修改 `left` / `top`，不要使用整屏 GIF、整屏 APNG 或大视频循环。
- 首页动态壁纸必须支持 `prefers-reduced-motion`、页面隐藏时暂停动画、手机端减少图层数量和动画强度；减少动态或小屏降级时应回到对应静态壁纸。
- 云、树冠/树叶/花瓣等尚未从底图完全拆分时，默认使用静态底图兜底，不启用同位置移动叠层，避免重影；电视机本体不做动画，只允许屏幕区域动。

## 前端和移动端检查

改首页、窗口、任务栏、图标、卡片、弹窗、游戏外壳或任意前端样式时，必须检查手机端适配：

- 避免横向溢出。
- 避免顶部常驻区域占屏过多。
- 避免弹窗超出屏幕。
- 避免游戏 iframe 尺寸过大。
- 确认桌面端和手机端文字不重叠、不被图标遮挡、不从按钮或卡片中溢出。

## 匿名聊天室安全规则

- 聊天室用户内容必须纯文本渲染。
- 不得用 `innerHTML` 插入访客昵称或消息内容。
- 昵称和消息应使用 `textContent` 或等价安全 DOM API。
- 前后端都要保留校验：昵称 2-16 字符，消息 1-300 字符，空消息不可发送，visitor_id 至少 3 秒 1 条。
- 接口单次最多返回 100 条消息。
- 前端聊天室应保持 `after/message_id` 增量拉取：首次进入加载最近消息，有新消息时维持较快刷新，无新消息时逐步降频，窗口不在前台时暂停或降频，用户发送后立即刷新一次；不要每次重复拉最近 100 条。
- 聊天室接口涉及 D1 表 `anonymous_chat_messages`，远端上线前仍建议执行正式 D1 migration。

## 游戏区规则

- 游戏列表由 `js/main.js` 读取 `games/catalog.json` 生成。
- 每个游戏保留独立目录：`games/<game-id>/`。
- 游戏页统一使用 `games/game-shell.js` 和 `games/game-shell.css`。
- 新增游戏时必须在 `games/catalog.json` 补齐：
  - `id`
  - `entry`
  - `sourceEntry`
  - `license`
  - `storage.keys`
  - 必要时补 `storage.defaults`
  - 中文 / English / 日本語 的支持情况
- 如果 `storage.keys` 不完整，导出和云存档会找不到对应游戏存档。
- 后续新增游戏时，必须在游戏标签或信息里标明中文、English、日本語是否支持。
- 网站切换语言时，游戏区优先展示对应语言。
- 如果游戏不支持当前语言，默认启动英语版本。
- 本地验证游戏区不要直接打开 `file://`，应通过静态服务器访问，因为主站会 `fetch("games/catalog.json")`。
- `a-dark-room` 的 jQuery 已改成本地 `lib/jquery.min.js`，不要恢复成外部 CDN。

当前游戏特定注意点：

- `kittens-game` 语言设置使用 `com.nuclearunicorn.kittengame.language`。
- `a-dark-room` 语言参数使用 `lang`，简体中文对应 `zh_cn`。
- `a-dark-room` 入口仍需要保留 `ignorebrowser=true`。
- `life-restart` 来源为 `VickScarlet/lifeRestart`，接入时只提交上游 `template/public` 构建产物复制后的 `games/life-restart/source/`，不要提交临时源码、`node_modules` 或上游工作目录。
- `life-restart` 上游构建步骤为 `npm.cmd install`、`npm.cmd run xlsx2json`、`npm.cmd run build`（上游 README 使用 pnpm，本机没有 pnpm 时 npm 可执行同名脚本），产物目录为 `template/public`。
- `life-restart` 上游 Vite 配置 `base: './'`，静态资源应保持相对路径，适合 Cloudflare Pages 子目录 `/games/life-restart/source/`。
- `life-restart` 语言只支持中文 `zh-cn` 和 English `en-us`，暂无日本語；站点日语界面进入时应默认启动 English。
- `life-restart` 启动语言 query 参数名是 `language`，不是默认 `lang`；`games/catalog.json` 必须保留 `languageQueryParam: "language"`。
- `life-restart` 已知本地存档键为 `theme`、`times`、`extendTalent`、`ATLT`、`AEVT`、`ACHV`、`uniqueWaTaShi`，新增或升级上游版本时必须重新检查 `localStorage` 用法并同步 `games/catalog.json`。

## 账号与云存档规则

- 账号系统只服务于游戏自动云存档，不影响普通网站浏览。
- 游戏本体仍然使用浏览器 `localStorage`。
- `games/game-shell.js` 负责收集 `games/catalog.json` 里声明的 storage keys。
- 登录后进入游戏页，会读取云端存档。
- 如果云端存档比本地已知存档更新，会询问是否恢复云端。
- 本地有存档时会上传到 D1。
- 自动同步间隔：30 秒。
- 切出页面时会尝试 flush 游戏自己的保存函数并同步。
- 密码使用 PBKDF2-SHA256 哈希。
- 会话使用 HttpOnly cookie：`lusu_session`。
- 单个游戏存档最大约 1MB。

## 数据库化三语文章规则

- 文章内容保存在 Cloudflare D1，网站代码仍保存在 GitHub。
- 文章通用信息使用 `articles` 表，三语内容使用 `article_translations` 表。
- 每篇正式发布文章应一次性提供 `zh`、`en`、`ja` 三种内容；第一阶段不做自动翻译。
- 不要新增自动翻译 API、翻译按钮、`translate` 或 `retranslate` 管理接口。
- 前台文章列表和详情必须按当前网站语言请求：`/api/articles?lang=zh|en|ja` 和 `/api/articles/:slug?lang=zh|en|ja`。
- 文章读取 fallback 顺序为：当前语言 -> 中文 `zh` -> 任意已有语言。
- 文章详情公开地址使用 `/articles/<slug>`，必须能通过 `https://lusu575.com/articles/<slug>` 直接分享和恢复单篇文章详情；内部 `article_id` 只用于数据库和后台管理，不能在公开链接或公开 API 中外显。旧的 `#knowledge/article/<slug>` 只作为兼容入口保留。
- 文章正文使用 Markdown 保存；前端渲染必须防 XSS，不能把未经处理的 Markdown 或 HTML 直接作为 `innerHTML` 插入页面。
- 文章正文可以使用安全的基础 Markdown、有序/无序列表、blockquote、`text` 代码块蓝色说明框和 `assets/images/articles/` 下的白名单文章图片；新增文章图片必须复制到项目资源目录，不要引用本机临时路径。
- 后台文章管理接口必须要求登录用户 `role = admin`；普通登录用户不能新建、编辑、删除或发布文章。
- 每次合并代码、上线功能或做可见更新时，必须在知识库 `site-updates`（网站更新记录）分类发布一篇真实文章。
- 网站更新记录文章必须同时写入 zh / en / ja，包含主标题、简短简介和正文；正文要概括本次更新内容。
- 这是合并前验收门槛，不是事后可选补记；如果本轮无法走后台发布，也必须在同一次变更中补齐 seed 与 fallback，确认知识库、欢迎弹窗“最近更新”和右上角最新日期都能读到这次更新。
- 如果网站更新记录通过 seed 维护，必须同时更新 `functions/api/[[route]].js` 的 `articleSeedStatements`、`cloudflare/schema.sql` 和 `js/main.js` 的本地 fallback `content.updates`，避免线上 D1、手动 migration 和 D1 不可用兜底显示不一致。
- 首页欢迎弹窗右侧“最近更新”自动读取 `site-updates` 分类文章；不要再把右侧更新列表改回只读写死数组。
- 首页欢迎弹窗“查看更多更新”应跳转到知识库并筛选 `site-updates` 分类。
- 修改文章系统 schema、接口、前台知识库渲染或发布流程时，必须同步更新 `PROJECT_CONTEXT.md` 和 `CHANGELOG.md`。
- 文章发布时间和聊天室消息时间必须按用户所在时区显示；文章发布时间不显示时区名，聊天室消息仍按聊天规则显示时间信息；后端保存/返回时间应保持 ISO/UTC 语义，前端格式化时再转换到用户本机时区，避免把 UTC 误当成本地时间。后台文章编辑器里的发布时间应显示为管理员本地时间，保存前转换为 UTC ISO，后端必须再次规范化 `published_at`。
- 从知识库文章详情关闭窗口或返回桌面后，再次打开知识库应回到知识库首页，不应继续停留在上一次文章详情。

## 管理后台与埋点规则

- 凡是后台相关改动，先读取 `admin/docs/ADMIN_PROJECT_CONTEXT.md` 和 `admin/docs/ADMIN_SKILL.md`；需要了解后台私有历史时再读 `admin/docs/ADMIN_CHANGELOG.md`。不要只依赖主站 `PROJECT_CONTEXT.md` 或本 Skill 推断后台细节。
- 管理后台入口固定为 `/admin/`，后台静态页面、样式、脚本应放在 `admin/` 目录，不要混进主站首页窗口、主站 CSS 或主站三语内容体系。
- 后台只需要中文文案；后台项目介绍和后台更新记录必须单独维护在后台内，不写入主站知识库 `site-updates`，也不要在首页最近更新里公开展示。
- `/admin/*` 必须通过 Pages Functions middleware 校验主站 `lusu_session`，只有 `users.role = admin` 的站长账号可以访问；所有 `/api/admin/*` 也必须继续做服务端 admin 校验。
- 后台文章编辑可以按当前选择语言显示单个语言面板，但保存/发布正式文章时必须一次性提交 zh / en / ja 三种标题与正文。
- 主站访问和点击埋点应使用独立 `js/telemetry.js`，避免把埋点逻辑写进主站可见 UI 流程；埋点脚本不得记录输入框内容、密码、正文草稿或聊天输入中的未发送内容。
- 文章访问 PV/UV 使用服务端 `GET /api/articles/:slug` 写入 `article_view_events`，按隐藏 `lusu_visitor` 统计；后台热门文章、文章列表和文章详情的文章 PV/UV 应以该表为准，不要只依赖前端页面级 PV。
- 访客后台识别使用 HttpOnly `lusu_visitor` cookie；该隐藏 visitor_id 不应在前台 UI 或公开 API 中展示。聊天室前端本地 client id 只能用于“我的消息”显示，后台禁言和审计使用隐藏 visitor_id。
- IP 信息只保存 hash 和掩码前缀，以及 Cloudflare 提供的国家、region/省份、城市等来源字段；不要把完整明文 IP 暴露给普通前台。
- 聊天室后台可以编辑、隐藏/恢复、删除消息，并按隐藏 visitor_id 或 IP hash 禁言；公开聊天室接口仍要保持纯文本渲染和频率限制。
- 修改后台 schema、埋点接口、后台 middleware 或禁言逻辑时，必须同步更新 `PROJECT_CONTEXT.md` 和 `CHANGELOG.md`。

## Cloudflare 部署规则

- 正式部署链路是 `GitHub main -> Cloudflare Pages Git 自动部署 -> lusu575.com`。
- 网站代码以 GitHub `main` 为源头。
- Vercel 不再是正式部署入口。
- Cloudflare Pages Git 自动部署不是 Wrangler 手动部署。
- 不要把 `npx wrangler deploy` 或 `npx wrangler pages deploy .` 写成 Git 自动部署命令。
- 如果 Cloudflare 后台要求构建设置，推荐静态站配置：框架预设 `None`，构建命令留空，构建输出目录 `/`，根目录 `/`。
- `wrangler pages deploy .` 只用于本地手动应急部署。

常用检查命令：

```powershell
git status -sb
git log --oneline --decorate -5
$env:XDG_CONFIG_HOME='F:\lusu575个人站\.wrangler-config'; npx.cmd wrangler pages project list
$env:XDG_CONFIG_HOME='F:\lusu575个人站\.wrangler-config'; npx.cmd wrangler pages deployment list --project-name lusu-personal-site
```

期望状态：

- `git status -sb` 显示 `main...origin/main`，无未提交变更。
- Cloudflare `lusu-personal-site` 显示 `Git Provider: Yes`。
- Cloudflare 项目域名包含 `lusu575.com` 和 `www.lusu575.com`。
- 最新 Cloudflare 部署来源应为 GitHub `main` 的最新提交。
- `lusu575.com` 和 `www.lusu575.com` 应指向同一个 Cloudflare Pages 项目和同一个 GitHub `main` 构建产物。

## 本地开发和验证注意事项

- PowerShell 可能禁止 `npm.ps1` / `npx.ps1`，优先用 `npm.cmd`、`npx.cmd`。
- 本机 Wrangler 登录临时配置目录可能是 `.wrangler-config/`，该目录已被 `.gitignore` 忽略，不得提交。
- `.wrangler/`、`.wrangler-config/`、`node_modules/`、`.codex-remote-attachments/` 都是本地生成内容，不得提交。
- 使用 imagegen / image2 生成项目资源时，生成文件必须复制到 `assets/images/` 等项目目录并由代码引用，不能只保留在 Codex 默认生成目录。

## 线上缓存和双域名踩坑

- 线上视觉验证要同时检查部署和缓存：确认 `origin/main` 最新提交、线上 CSS 是否包含新资源名、线上图片是否 200。
- Cloudflare / 浏览器缓存可能导致旧效果继续显示，必要时使用缓存破坏参数或 `_headers` 调整缓存策略。
- `lusu575.com` 和 `www.lusu575.com` 的边缘缓存、浏览器缓存可能不同步。
- 如果两个域名视觉不一致，优先检查两个域名的 CSS / 图片响应是否同版。
- 涉及 `js/main.js`、`css/style.css`、首页背景、任务栏、图标等强视觉或交互资源时，必须同步更新 `index.html` 里的 CSS / JS query 版本号或图片 URL query，避免线上和用户浏览器继续加载旧缓存。
- 每次推送 `main` 后，必须核对 `origin/main` 最新 commit、Cloudflare Pages 最新成功生产部署 commit、线上 `index.html` 的 CSS/JS query 版本三者一致；如果线上线下显示不同，先查部署状态、资源 query 和 Cloudflare/浏览器缓存。
- 右上角“最近更新日期”由 `js/main.js` 的 `content.updates` 最大日期自动生成；新增可见功能更新时要补一条 `content.updates`，不要重新增加写死日期常量。

## 当前关键资源

- 首页主要视觉资源：
  - `assets/images/wallpapers/morning.png`
  - `assets/images/wallpapers/day.png`
  - `assets/images/wallpapers/dusk.png`
  - `assets/images/wallpapers/night.png`
  - `assets/images/wallpaper-dynamic/morning/base-clean.png`
  - `assets/images/wallpaper-dynamic/morning/cloud-*.png`
  - `assets/images/wallpaper-dynamic/day/base-clean.png`
  - `assets/images/wallpaper-dynamic/day/cloud-top-left.png`
  - `assets/images/wallpaper-dynamic/day/cloud-top-center.png`
  - `assets/images/wallpaper-dynamic/day/cloud-top-right.png`
  - `assets/images/wallpaper-dynamic/day/cloud-mid-left.png`
  - `assets/images/wallpaper-dynamic/day/cloud-mid-right.png`
  - `assets/images/wallpaper-dynamic/dusk/base-clean.png`
  - `assets/images/wallpaper-dynamic/dusk/cloud-*.png`
  - `assets/images/wallpaper-dynamic/night/base-clean.png`
  - `assets/images/wallpaper-dynamic/night/cloud-*.png`
  - `assets/images/homepage-pixel-coast.png`
  - `assets/images/lusu-tv-head-256.png`
  - `assets/images/lusu-about-avatar-256.png`
  - `assets/images/start-windows-pixel.png`
- 聊天室图标资源：
  - `assets/images/icon-chatroom-clean.png`
- 管理后台与埋点关键文件：
  - `admin/index.html`
  - `admin/admin.css`
  - `admin/admin.js`
  - `admin/docs/ADMIN_PROJECT_CONTEXT.md`
  - `admin/docs/ADMIN_SKILL.md`
  - `admin/docs/ADMIN_CHANGELOG.md`
  - `functions/admin/_middleware.js`
  - `functions/api/[[route]].js`
  - `js/telemetry.js`
  - `cloudflare/schema.sql`

替换这些资源后，要检查桌面端和手机端显示效果。
## 视频系统维护规则（2026-06-15）

- 视频区使用 D1 表 `videos`、`video_categories`、`video_category_relations`；“全部”分类只由前端生成，不写入数据库。
- 后台视频和分类接口必须继续复用 `requireAdmin`，普通登录用户不得访问 `/api/admin/videos*` 或 `/api/admin/video-categories*`。
- 后端只允许解析 YouTube、youtu.be、Bilibili、b23.tv 白名单链接；iframe `src` 必须使用服务端规范化生成的 `embed_url`，不得直接信任用户输入 URL。
- 公开视频接口必须返回 `original_url` 供主站“打开原地址”使用；`embed_url` 只用于站内 iframe 播放，不要把 embed 地址当作原链接。
- 主站视频窗口的站内“全屏”应保持为 XP 窗口最大化/还原，不要直接对 YouTube / Bilibili iframe 调用浏览器 Fullscreen API；播放器自己的全屏由 iframe 内部控件处理。
- 跨域 iframe 内部按钮热区无法由父页面精确重写；遇到默认信息栏、底部空白误触或平台按钮误触时，优先用站内遮罩、透明点击防护区和收窄本站按钮热区兜底。
- YouTube / Bilibili 元数据只在后台预览、首次保存、URL 变化保存或刷新元数据时抓取，并缓存到 D1；已有视频 URL 未变化的普通保存不得重新抓取外部元数据，公开视频接口不得每次访问重新抓取。
- 后台视频封面可以使用平台图片 URL，或由管理员选择 JPG、PNG、WEBP、AVIF 本地图片后在浏览器端压缩裁切为受限 `data:image` 写入 `thumbnail_url`；不得放宽为 SVG、HTML、任意 data URL 或任意图片域名。
- 后台“从本地视频截首帧”只用于生成封面，不代表本站支持本地视频上传、托管或直接播放；不要因此放宽 YouTube / Bilibili / b23.tv 链接白名单和 iframe 安全边界。
- Bilibili 元数据遇到 HTTP 412、页面状态变化或 API 风控时，必须保留白名单解析和服务端规范化 `embed_url`，并优先尝试详情接口、移动页、页面 `__INITIAL_STATE__` / `__NEXT_DATA__`、meta、结构化数据和更宽的页面状态兜底，不得放宽为任意 iframe。
- 视频排序语义为置顶独立队列优先；只要 `pinned = 1` 就一定排在未置顶视频前面，多个置顶视频按 `pinned_sort_order` 从大到小显示，未置顶视频按 `sort_order` 从大到小显示。新建视频默认取当前最大普通排序 +10、当前最大置顶排序 +10。视频分类排序仍使用 `sort_order` 数值越大越靠前的语义，新建分类默认 +10。
- 默认视频分类 seed 只允许在全新 `video_categories` 表首次创建时初始化；已有表必须通过 `site_runtime_state.video_categories_default_seeded` 视为已处理，不要覆盖或补回后台维护过的 `slug`、`name_zh`、`name_en`、`name_ja`、`sort_order`、`enabled` 和已删除分类，避免运行时 schema guard 把后台分类名、排序、停用状态或删除结果还原。
- 抓取失败时后台应显示可读原因，并允许管理员手动填写标题、简介、作者和封面；前台遇到不可播放或受限视频时显示站内不可播放提示。
- 主站视频卡片标题、简介、分类名必须使用 `textContent` 或安全 DOM API 渲染，不要把视频数据拼接成未转义 HTML。
- 主站所有视频卡片必须保持统一尺寸；视频封面要铺满封面区域，封面失败时保留同尺寸像素风默认占位图；移动端视频区必须单列适配且不得横向溢出。
- 视频埋点复用 `js/telemetry.js`，可记录分类筛选、视频点击、播放按钮点击、播放器打开和播放失败；不得记录后台输入框内容。
- 修改 `js/main.js`、`css/style.css`、`admin/admin.js`、`admin/admin.css` 或视频视觉资源后，必须更新 `index.html` / `admin/index.html` 的 query 版本号。
