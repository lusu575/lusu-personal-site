# PROJECT_CONTEXT.md

本文档用于帮助新的 AI / Codex 对话快速理解本项目。后续如果网站方向、功能、部署方式或注意事项变化，请同步更新这里。

## 项目基本信息

- 项目名称：鲁肃的个人站
- 英文名称：LuSu's Personal Site
- GitHub 仓库：`lusu575/lusu-personal-site`
- 本地目录：`F:\lusu575个人站`
- 当前主分支：`main`
- 当前正式域名：`https://lusu575.com`
- 当前备用 Pages 域名：`https://lusu-personal-site-9hd.pages.dev`
- 当前技术栈：HTML + CSS + JavaScript + Cloudflare Pages Functions + Cloudflare D1
- 当前风格目标：Windows XP + Pixel Art + Y2K + 可爱复古互联网桌面

## 当前部署状态

当前正式部署链路是：

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

重要说明：

- 网站代码仍以 GitHub `main` 为源头。
- 修改 GitHub `main` 后，Cloudflare Pages 应自动同步并部署到 `lusu575.com`。
- Vercel 不再是这个站点的正式部署入口。
- Cloudflare Pages 连接 GitHub 后，不要在构建设置里填写 `npx wrangler deploy` 或 `npx wrangler pages deploy .` 作为部署命令。GitHub 自动部署应由 Cloudflare Pages 自己完成。
- 如果 Cloudflare 后台要求构建设置，推荐保持静态站配置：框架预设 `None`，构建命令留空，构建输出目录 `/`，根目录 `/`。
- `wrangler pages deploy .` 只用于本地手动应急部署，不是 GitHub 自动构建命令。

## 当前已实现能力

- 单页 XP 桌面风格个人站
- 首页桌面图标入口
- 顶部 XP 蓝色栏和底部任务栏
- 知识库、视频区、资源区、游戏区、杂谈区、关于我
- 中文 / English / 日本語 三语切换
- 游戏区接入两款开源 H5 游戏：
  - `kittens-game`
  - `a-dark-room`
- 游戏页统一外壳：
  - 返回个人站游戏区
  - 协议与上游仓库展示
  - 本地存档导出
  - JSON 存档导入
  - 登录后自动云端存档
- 主站右上角账号入口：
  - 注册
  - 登录
  - 退出
  - 网站浏览不强制登录
- Cloudflare Pages Functions 后端：
  - `/api/health`
  - `/api/auth/me`
  - `/api/auth/register`
  - `/api/auth/login`
  - `/api/auth/logout`
  - `/api/saves/:gameId`
- Cloudflare D1 数据表：
  - `users`
  - `sessions`
  - `game_saves`

## 账号与云存档设计

账号系统只服务于游戏自动云存档，不影响普通网站浏览。

前端入口：

- 主站右上角 `#account-widget`
- 登录 UI 由 `js/main.js` 渲染
- 游戏页只显示云存档状态，不再作为主要登录入口

后端位置：

```text
functions/api/[[route]].js
```

存档同步逻辑：

- 游戏本体仍然使用浏览器 `localStorage`
- `games/game-shell.js` 负责收集 `games/catalog.json` 里声明的 storage keys
- 登录后进入游戏页，会读取云端存档
- 如果云端存档比本地已知存档更新，会询问是否恢复云端
- 本地有存档时会上传到 D1
- 自动同步间隔：30 秒
- 切出页面时会尝试 flush 游戏自己的保存函数并同步

安全和限制：

- 密码使用 PBKDF2-SHA256 哈希，边缘函数里使用较轻的迭代参数以避免 Cloudflare 免费环境 500。
- 会话使用 HttpOnly cookie：`lusu_session`
- 单个游戏存档最大约 1MB。
- 如果后续要支持大量用户或更复杂账号能力，应迁移到更完整的 Auth 方案。

## 游戏区维护注意点

- 当前主站不再使用独立的游戏大厅页，游戏列表由 `js/main.js` 读取 `games/catalog.json` 生成。
- 每个游戏保留独立目录：`games/<game-id>/`
- 游戏页统一使用：
  - `games/game-shell.js`
  - `games/game-shell.css`
- 新增游戏时必须在 `games/catalog.json` 补齐：
  - `id`
  - `entry`
  - `sourceEntry`
  - `license`
  - `storage.keys`
  - 必要时补 `storage.defaults`
- 如果 `storage.keys` 不完整，导出和云存档会找不到对应游戏存档。
- `kittens-game` 默认中文依赖：
  - `com.nuclearunicorn.kittengame.language=zh`
- `a-dark-room` 入口参数需要保留：
  - `lang=zh_cn&ignorebrowser=true`
- `a-dark-room` 的 jQuery 已改成本地 `lib/jquery.min.js`，不要恢复成外部 CDN。
- 本地验证游戏区不要直接打开 `file://`，应通过静态服务器访问，因为主站会 `fetch("games/catalog.json")`。

## 主要文件结构

```text
/
├── index.html
├── PROJECT_CONTEXT.md
├── README.md
├── package.json
├── package-lock.json
├── wrangler.jsonc
├── .gitignore
├── assets/
├── cloudflare/
│   ├── README.md
│   └── schema.sql
├── css/
│   └── style.css
├── functions/
│   └── api/
│       └── [[route]].js
├── games/
│   ├── catalog.json
│   ├── game-shell.css
│   ├── game-shell.js
│   ├── kittens-game/
│   └── a-dark-room/
└── js/
    └── main.js
```

## 本地开发与验证

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
http://127.0.0.1:8788/index.html
```

健康检查：

```text
/api/health
```

注意：

- PowerShell 可能禁止 `npm.ps1` / `npx.ps1`，优先用 `npm.cmd`、`npx.cmd`。
- 本机 Wrangler 登录临时配置目录可能是 `.wrangler-config/`，该目录已被 `.gitignore` 忽略，不得提交。
- `.wrangler/`、`.wrangler-config/`、`node_modules/`、`.codex-remote-attachments/` 都是本地生成内容，不得提交。

## GitHub 与 Cloudflare 同步检查

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

## 视觉设计原则

必须保留：

- Windows XP 桌面感
- 蓝色标题栏
- XP 风格按钮
- 任务栏和状态栏
- 像素图标
- 蓝天白云、草地、老互联网氛围
- 可爱、轻松、有一点 Y2K 的个人站气质

避免：

- 现代极简博客风
- 纯白卡片堆砌
- 大面积商务 landing page
- 过重的单色渐变背景
- 让移动端横向溢出

## 前端改动检查规则

- 每次修改首页、窗口、任务栏、图标、卡片、弹窗、游戏外壳或任意前端样式时，都必须同步检查手机端适配，避免横向溢出、顶部常驻区域占屏、弹窗超出屏幕、游戏 iframe 尺寸过大等问题。
- 每次新增或调整可见文案时，都必须同步维护中文 / English / 日本語 三种语言，不能只更新单一语言。
- 每次调整图标、按钮、任务栏标签、桌面入口或标题栏时，都必须检查图标和文字的垂直/水平对齐、换行、截断和小屏幕显示效果。
- 如果用户明确要求“只更新美化 / 不要动功能”，只修改 HTML/CSS/图片资源等视觉层，避免改动 `js/main.js` 的路由、登录、渲染数据、游戏加载等功能逻辑。
- 使用 imagegen / image2 生成项目资源时，生成文件必须复制到 `assets/images/` 等项目目录并由代码引用，不能只保留在 Codex 默认生成目录。
- 线上视觉验证要同时检查部署和缓存：确认 `origin/main` 最新提交、线上 CSS 是否包含新资源名、线上图片是否 200；Cloudflare/浏览器缓存可能导致旧效果继续显示，必要时使用缓存破坏参数或 `_headers` 调整缓存策略。
- 如果 `lusu575.com` 和 `www.lusu575.com` 出现视觉不一致，优先检查两个域名的 CSS/图片响应是否同版；涉及首页背景、任务栏、图标等强视觉资源时，建议同步更新 CSS 引用版本号（例如 `css/style.css?v=...`、图片 URL query）来强制刷新缓存。
- 当前首页主要视觉资源包括 `assets/images/homepage-pixel-coast.png`、`assets/images/lusu-tv-head-256.png`、`assets/images/lusu-about-avatar-256.png`、`assets/images/start-windows-pixel.png`。替换这些资源后要检查桌面端和手机端显示效果。

## 后续可扩展方向

- 后台管理内容
- 真正文章详情页
- 资源上传与下载管理
- 评论系统
- 搜索功能
- RSS
- Markdown 内容系统
- Cloudflare R2 文件存储
- 更完善的账号资料页

这些扩展都应优先保持现有 XP / Y2K / 像素桌面风格，不要把网站改成普通现代模板。
