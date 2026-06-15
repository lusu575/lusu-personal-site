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

## 每次改动必须执行

- 每次修改项目后，必须同步更新 `CHANGELOG.md`，记录日期、功能、界面、后端、部署、文档或规则变化。
- 项目信息变化时，必须同步更新 `PROJECT_CONTEXT.md`，保持项目背景、技术栈、部署方式、主要功能、文件结构和本地开发方式准确。
- 新增长期注意事项、维护规则、踩坑点或约束时，必须同步补充到本 Skill。
- 本 Skill 规则变化时，必须同步更新 `skills/lusu-personal-site-skill/README.md`。
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
- 当前首页动画层默认关闭，只展示四时段静态底图；云、树冠、电视雪花、小女孩、星星、水面光效等 DOM/class 是预留接口。
- 后续启用首页壁纸动画时，只使用 CSS `transform` / `opacity`，不要用 JS 每帧修改 `left` / `top`，不要使用整屏 GIF、整屏 APNG 或大视频循环。
- 后续启用首页动态壁纸时，必须支持 `prefers-reduced-motion`、页面隐藏时暂停动画、手机端减少图层数量和动画强度。
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
- 首页欢迎弹窗右侧“最近更新”自动读取 `site-updates` 分类文章；不要再把右侧更新列表改回只读写死数组。
- 首页欢迎弹窗“查看更多更新”应跳转到知识库并筛选 `site-updates` 分类。
- 修改文章系统 schema、接口、前台知识库渲染或发布流程时，必须同步更新 `PROJECT_CONTEXT.md` 和 `CHANGELOG.md`。
- 文章发布时间和聊天室消息时间必须按用户所在时区显示；文章发布时间不显示时区名，聊天室消息仍按聊天规则显示时间信息；后端保存/返回时间应保持 ISO/UTC 语义，前端格式化时再转换到用户本机时区，避免把 UTC 误当成本地时间。
- 从知识库文章详情关闭窗口或返回桌面后，再次打开知识库应回到知识库首页，不应继续停留在上一次文章详情。

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
  - `assets/images/homepage-pixel-coast.png`
  - `assets/images/lusu-tv-head-256.png`
  - `assets/images/lusu-about-avatar-256.png`
  - `assets/images/start-windows-pixel.png`
- 聊天室图标资源：
  - `assets/images/icon-chatroom-clean.png`

替换这些资源后，要检查桌面端和手机端显示效果。
