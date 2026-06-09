# PROJECT_CONTEXT.md

本文件用于帮助新的 AI / Codex 对话快速理解本项目。后续如果网站方向、内容、部署方式或注意事项变化，可以直接编辑这里。

## 项目基本信息

- 项目名称：鲁肃的个人站
- 英文名：LuSu's Personal Site
- 日文名：魯粛の個人サイト
- GitHub 仓库：`lusu575/lusu-personal-site`
- 本地目录：`F:\lusu575个人站`
- 项目类型：静态 H5 网站原型
- 当前版本目标：Windows XP + 卡通像素风个人主页
- 当前实现方式：单页静态站，使用 HTML + CSS + JavaScript，无后端、无数据库

## 网站定位

这是鲁肃的个人主页，同时作为知识库、视频展示、资源下载、杂谈博客和个人资料入口使用。

核心风格关键词：

- Windows XP
- Pixel Art
- Y2K
- Cartoon UI
- MSN Messenger
- QQ2005
- 蓝天白云
- XP 窗口
- 像素图标
- 复古按钮
- 桌面文件夹

重要原则：不要把网站改成现代极简博客。这个项目的识别度来自 XP 桌面、可爱复古互联网、像素图标和老式窗口界面。

## 当前页面结构

当前是一个单页应用式静态原型，`index.html` 中包含 6 个 section：

1. 首页 Home
2. 知识库 Knowledge Base
3. 视频区 Videos
4. 资源区 Resources
5. 杂谈区 Blog / Talk
6. 关于我 About

页面切换由 `js/main.js` 控制，不依赖路由框架。

## 已实现功能

- 首页 XP 桌面风格
- XP 蓝色顶部栏
- XP 任务栏
- 五个桌面图标入口
- 知识库 XP 文件夹窗口
- 视频区卡片网格
- 视频播放弹窗占位
- 资源区下载中心卡片
- 杂谈区 XP 记事本窗口
- 关于我个人资料卡
- 中文 / English / 日本語 三语切换
- 分类筛选
- 手机端响应式布局
- 云朵漂移、图标 hover、ONLINE 状态点闪烁等轻量动画

## 暂未实现

- 后台管理
- 登录
- 评论
- 数据库
- 真实文章详情页
- 真实资源上传
- 真实视频 iframe 嵌入
- 搜索功能
- RSS
- Markdown 内容系统

后续可以逐步增强，但第一版应该继续保持静态、轻量、容易部署。

## 文件结构

```text
/
├── index.html
├── PROJECT_CONTEXT.md
├── README.md
├── css/
│   └── style.css
├── js/
│   └── main.js
└── assets/
    ├── icons/
    │   └── .gitkeep
    ├── images/
    │   └── .gitkeep
    └── downloads/
        └── .gitkeep
```

## 主要文件说明

### `index.html`

负责页面结构。当前所有页面都写在这一个文件中，通过 section 切换显示。

不要轻易拆成多页面，除非用户明确要做正式站点结构或接入内容系统。

### `css/style.css`

负责全部视觉风格，包括：

- XP 顶部栏
- XP 窗口
- 任务栏
- 桌面背景
- 草地
- 云朵
- 像素图标
- 卡片
- 弹窗
- 手机端适配

修改样式时要注意保持 XP / Y2K / 像素卡通风，不要改成普通 Tailwind 风或现代卡片博客。

### `js/main.js`

负责数据和交互，包括：

- 三语字典
- 示例文章数据
- 示例视频数据
- 示例资源数据
- 杂谈数据
- 页面切换
- 语言切换
- 分类筛选
- 视频弹窗

后续替换文章、视频、资源，优先修改 `content` 对象和 `translations` / `labels` 字典。

## 内容替换指南

### 替换知识库文章

在 `js/main.js` 中修改：

```js
content.knowledge
```

每篇文章包含：

- `category`
- `tags`
- `updated`
- `title.zh / title.en / title.ja`
- `desc.zh / desc.en / desc.ja`

### 替换视频

在 `js/main.js` 中修改：

```js
content.videos
```

每个视频包含：

- `category`
- `platform`
- `color`
- `url`
- `title`
- `desc`

当前视频弹窗只是播放器占位。后续如果要嵌入 Bilibili / YouTube，需要增加 embed URL 字段和 iframe 渲染逻辑。

### 替换资源

在 `js/main.js` 中修改：

```js
content.resources
```

小文件可以放到：

```text
assets/downloads/
```

大文件建议只放外部链接，例如：

- 网盘
- Cloudflare R2
- GitHub Release
- B站评论区链接
- 其他 CDN

### 替换图片和图标

当前第一版主要使用 CSS 绘制像素图标，没有依赖真实图片。

后续资源位置建议：

- 图标：`assets/icons/`
- 背景图、头像、插图：`assets/images/`
- 下载文件：`assets/downloads/`

## 多语言注意事项

当前支持：

- `zh`：中文
- `en`：English
- `ja`：日本語

新增页面文案时，必须同步补齐三语字段，避免切换语言后出现中文残留或 undefined。

每次新增功能、按钮、卡片、状态提示、导航文案或任何可见 UI 文案，都必须同时适配中文、英文和日文。不要只加中文文案，也不要让新文案绕过 `translations`、`labels` 或三语内容字段。

涉及三语的主要位置：

- `translations`
- `labels`
- `content.*.title`
- `content.*.desc`

## 视觉设计注意事项

必须保留：

- Windows XP 窗口
- 蓝色标题栏
- XP 任务栏
- 桌面图标入口
- 像素风图标
- 卡通文件夹 / 软盘 / 电视 / 聊天气泡 / 头像
- 老互联网按钮感
- 状态栏
- ONLINE 状态
- 蓝天白云和草地

避免：

- 现代极简博客
- 大面积纯白卡片
- 过度扁平化
- 复杂前端框架堆叠
- 太商业化的 landing page
- 与 XP 风格无关的大渐变光效
- 让手机端变成难操作的小桌面

手机端要求：

- 首页入口纵向排列
- 保留 XP 风格边框和图标
- 文字清晰
- 不要互相遮挡
- 不要横向溢出

## 技术约束

- 第一版保持静态网站
- 不依赖后端
- 不依赖数据库
- 不依赖构建工具
- 可以直接本地打开 `index.html`
- 方便部署到 Vercel、Cloudflare Pages 或 GitHub Pages

如果后续引入框架，需要先确认：

- 是否真的需要 React / Vue / Astro / Next.js
- 是否仍能保留 XP 桌面风格
- 是否会影响“直接打开即可预览”的便利性

## 部署建议

当前项目可以直接部署为静态站。

适合平台：

- GitHub Pages
- Cloudflare Pages
- Vercel
- Netlify

如果使用 Cloudflare Pages / Vercel：

- Build command 留空
- Output directory 使用项目根目录

## Git / GitHub 信息

- 仓库名：`lusu-personal-site`
- 远端地址：`https://github.com/lusu575/lusu-personal-site.git`
- 当前主分支：`main`

本地曾使用的 Git 程序路径：

```text
F:\AI\Apps\Hermes\Home\git\cmd\git.exe
```

当前工作区路径包含中文字符。如果工具遇到路径编码问题，应优先使用完整绝对路径和 `-LiteralPath`。

## 已知环境注意事项

- 系统 PATH 里可能没有 `git`，需要使用上面的 Git 完整路径。
- 运行 Git 时可能遇到 `dubious ownership`，可临时使用：

```powershell
& 'F:\AI\Apps\Hermes\Home\git\cmd\git.exe' -c safe.directory='F:/lusu575个人站' status
```

- 推送 GitHub 可能需要用户完成 GitHub 登录授权。
- 当前项目根目录可写，但 `.git` 操作有时需要提升权限。

## 给后续 AI / Codex 的工作建议

开始修改前请先阅读：

1. `PROJECT_CONTEXT.md`
2. `index.html`
3. `css/style.css`
4. `js/main.js`

修改时请遵守：

- 不要重构成复杂工程，除非用户明确要求。
- 不要删除 XP / 像素 / 复古互联网风格。
- 新增文案要补齐中文、英文、日文。
- 每次新增功能、按钮或可见文案，都要同步适配 English 和 日本語。
- 每次新增功能、页面、卡片、弹窗、导航或按钮，都要自动检查并适配手机端，不能只做桌面端。
- 新增内容优先放进 `js/main.js` 的静态数据。
- 新增图片、图标、下载资源时使用 `assets/` 下对应目录。
- 修改后至少检查桌面端和手机端。
- 若做 Git 操作，先确认当前状态，避免覆盖用户后续手动修改。

## 后续可编辑备忘

这里留给鲁肃后续自己补充：

```text
- 真实 B站主页：
- 真实 YouTube 频道：
- 头像图片路径：
- 主要联系方式：
- 常用资源下载地址：
- Cloudflare Pages 项目名：
- Vercel 项目名：
- 自定义域名：
- 以后想新增的页面：
- 不希望 AI 改动的内容：
```
