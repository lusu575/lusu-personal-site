# PROJECT_CONTEXT.md

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
- 顶部 XP 蓝色栏和底部任务栏
- 知识库、视频区、资源区、游戏区、杂谈区、匿名聊天室、关于我
- 中文 / English / 日本語 三语切换
- 主站右上角账号入口
- 游戏页统一外壳和云存档能力
- 数据库化三语文章系统：文章内容保存在 Cloudflare D1，网站按当前语言读取 zh / en / ja 内容
- Cloudflare Pages Functions 后端接口
- Cloudflare D1 持久化账号、会话、游戏存档、聊天室消息和文章内容
- 独立中文管理后台：`/admin/` 仅允许 `users.role = admin` 的站长账号访问，复用主站账号系统，但后台页面、项目介绍和后台更新记录单独维护，不公开到主站知识库。
- 访问与点击埋点：主站通过独立 `js/telemetry.js` 记录 PV、UV、访问来源、地理位置聚合和点击事件；访客使用 HttpOnly 隐藏 ID 识别，前台不显示该 ID。

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
- 文章发布时间在前端按用户所在时区显示到秒，不显示时区名；后端时间字段应保持 ISO/UTC 语义，避免被浏览器误读成本地时间。
- 从文章详情关闭知识库后，再次打开知识库默认回到知识库首页，不保留上一次打开的文章详情。
- 知识库固定使用 `site-updates` 作为“网站更新记录”分类，分类入口排在最后。
- 每次代码合并、功能上线或可见更新，都要在 `site-updates` 分类发布一篇 zh / en / ja 三语真实文章，包含主标题、简介和正文。
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
- 后台只使用中文文案；后台项目介绍和后台更新记录保存在后台页面内，不写入主站知识库 `site-updates`，也不对外公开。

后台能力：

- 实时监控大屏：显示今日 PV、UV、周期 PV/UV、今日点击、在线访客、今日聊天数。
- 访问来源：按 Cloudflare `request.cf` 和请求头记录国家、region/省份、城市、colo、时区、经纬度；IP 只保存 hash 和掩码前缀，不保存完整明文 IP。
- 地图界面：后台根据访问聚合数据绘制像素风地图点位。
- 点击埋点：记录站内按钮、链接、桌面入口、筛选、文章和视频等点击目标，保存路径、route、目标文本、元素标识和屏幕尺寸，不记录输入框内容。
- 知识库文章：后台可新建、编辑、发布、删除文章；保存和发布时要求 zh / en / ja 三语标题与正文齐全。
- 聊天室管理：后台可查看隐藏访客 ID、client id、IP hash/IP 前缀、来源地；可编辑、隐藏/恢复、删除消息，并按隐藏访客 ID 或 IP hash 禁言。

公开埋点接口：

- `POST /api/analytics/identify`
- `POST /api/analytics/page-view`
- `POST /api/analytics/click`

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
- `game_saves`
- `anonymous_chat_messages`
- `chat_bans`
- `articles`
- `article_translations`
- `site_visitors`
- `analytics_page_views`
- `analytics_click_events`

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
│   └── admin.js
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
- RSS
- Markdown 内容系统
- Cloudflare R2 文件存储
- 更完善的账号资料页

这些扩展都应优先保持现有 XP / Y2K / 像素桌面风格，不要把网站改成普通现代模板。
