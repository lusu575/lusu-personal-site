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

## 主要功能

- 单页 XP 桌面风格个人站
- 首页桌面图标入口
- 顶部 XP 蓝色栏和底部任务栏
- 知识库、视频区、资源区、游戏区、杂谈区、匿名聊天室、关于我
- 中文 / English / 日本語 三语切换
- 主站右上角账号入口
- 游戏页统一外壳和云存档能力
- Cloudflare Pages Functions 后端接口
- Cloudflare D1 持久化账号、会话、游戏存档和聊天室消息

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
- 前端每 5 秒轮询新消息，页面恢复激活时立即刷新。
- 聊天内容必须纯文本渲染。

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

当前第一版不做私聊、图片发送、表情包、WebSocket、在线状态、管理后台、多聊天室房间。

## 游戏区

当前游戏区接入两款开源 H5 游戏：

- `kittens-game`
- `a-dark-room`

游戏列表：

- 主站不再使用独立游戏大厅页。
- `js/main.js` 读取 `games/catalog.json` 生成游戏列表。

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
├── js/
│   └── main.js
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
- 聊天室纯文本安全渲染规则
- 只美化不动功能时的改动边界
- Cloudflare Pages Git 自动部署注意事项
- 游戏区新增游戏和游戏语言支持规则
- 双域名缓存、Wrangler、D1 和本地验证踩坑点

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
