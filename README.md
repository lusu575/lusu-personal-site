# lusu-personal-site

鲁肃的个人站，一个保留 Windows XP + Pixel Art + Y2K 桌面识别度、同时提供原创移动虚拟 OS 的个人空间。

## 当前状态

- 首页使用 morning / day / dusk / night 四时段像素壁纸，并已接入无云底图 + 单朵独立云层的动态云层效果。
- 公开主站使用“同一业务状态、两套呈现壳”：桌面端是 Neo-XP / Pixel Glass OS，移动端是带状态栏、App Home 和 safe-area 适配的虚拟手机系统。真实毛玻璃 Dock 在 Home 与栏目 App 内持续悬浮，保留 Home、知识库、视频、资源、游戏、聊天室六个高频入口；杂谈与关于仍从 Home 图标进入。Dock 可横向滑动、切换并收起，账号和语言操作仍只在 Home。
- 桌面图标打开只淡入目标窗口，任务栏返回 Home 只轻滑入图标区；壁纸、顶栏和任务栏不进入这两条转场。模块间 route 只让新页面低位移淡入，旧窗口快照隐藏，不使用 3D 书页翻动、双边框叠影、整屏闪白或点击原点巨幅缩放；移动 Home 使用紧凑固定行高图标网格，真实 Dock 以共享选中底板连续滑动。
- 知识库文章内容保存在 Cloudflare D1，正式文章需要同时维护中文 / English / 日本語 三语内容。
- 关于我窗口提供 X、GitHub、Bilibili、Instagram、Discord 小图标入口，链接从 `GET /api/social-links` 公开只读读取。
- `/admin/` 是独立中文管理后台，只有 `users.role = admin` 的站长账号可以访问，用于文章管理、视频管理、社交链接、访问监控、点击埋点和聊天室管理。
- 主站访问与点击数据通过 `js/telemetry.js` 上报；不记录输入框内容、密码、未发送聊天内容或文章草稿。
- 匿名聊天室公开侧保持纯文本渲染，后台可隐藏、恢复、删除消息，并按隐藏访客 ID 或 IP hash 禁言。
- 游戏区只保留可在本站本地打开的静态游戏入口，不做外部跳转入口。
- 资源区提供独立工具“日语的言外之意 / Behind the Japanese / 日本語の裏側”：当前公开应用版本为 `1.0.3`、内容兼容版本为 `1.0.2`；下一候选边界为应用 `1.0.4`、内容 `1.0.3`。工具包含 5 个难度、250 个 N3–N1 潜台词训练关卡，支持纯听/日语/双语模式、逐句与词块离线语音、月历打卡、本地进度和账号云同步。候选语音由 AivisSpeech `aivisspeech-1.2.0-aivmx-v3` 管线按人工审校假名在 CPU 上离线生成；候选关卡图由 `gpt-image-2` 按完整题面逐张生成，在 250 张关卡图和两张背景全部完成前不得发布，维护规则见 `tools/japanese-subtext/MAINTENANCE.md`。

## 维护备注

- 正式部署链路：GitHub `main` -> Cloudflare Pages Git 自动部署 -> `lusu575.com`。
- 继续维护项目前，先读取 `PROJECT_CONTEXT.md` 和 `skills/lusu-personal-site-skill/SKILL.md`。
- 只维护 `/admin/` 管理后台时，额外读取 `admin/docs/ADMIN_PROJECT_CONTEXT.md` 和 `admin/docs/ADMIN_SKILL.md`；这些是后台专用文档，不等同于主站总文档。
- 每次修改项目后，同步更新 `CHANGELOG.md`；项目事实或长期规则变化时，同步更新 `PROJECT_CONTEXT.md` 和项目专用 Skill。
- 后台项目介绍和后台更新记录只维护在后台内，不写入主站知识库 `site-updates`，也不公开展示到首页最近更新；若后台改动同时影响主站公开可见体验，公开侧仍按主站规则补网站更新文章。
- 涉及 `js/main.js`、`css/style.css`、首页壁纸、图标等强视觉或交互资源时，记得同步更新 `index.html` 的资源 query，避免线上缓存继续加载旧文件。
- `games/life-restart/` 来自 `VickScarlet/lifeRestart`，上游需要先执行 `xlsx2json` 和 `build`，本站提交构建产物 `template/public` 对应的 `games/life-restart/source/`。
- lifeRestart 当前支持中文和 English，暂无日本語；日语站点入口默认启动 English。它的启动语言参数名是 `language`，不是本站多数游戏使用的 `lang`。

## 关键文件

- 主站入口：`index.html`
- 主站基础样式：`css/style.css`
- 桌面/共享动效样式：`css/motion-system.css`
- 移动虚拟 OS 样式：`css/mobile-ios-shell.css`
- 主站业务逻辑：`js/main.js`
- 共享交互动效：`js/ui-motion.js`
- 移动呈现壳：`js/mobile-shell.js`
- 访问埋点：`js/telemetry.js`
- 后台页面：`admin/index.html`、`admin/admin.css`、`admin/admin.js`
- 后台访问拦截：`functions/admin/_middleware.js`
- 后端 API：`functions/api/[[route]].js`
- D1 schema：`cloudflare/schema.sql`
- 日语潜台词训练器：`tools/japanese-subtext/`（维护与离线语音说明见其 `README.md`）
- 项目上下文：`PROJECT_CONTEXT.md`
- 项目专用 Skill：`skills/lusu-personal-site-skill/SKILL.md`
- 后台专用文档：`admin/docs/ADMIN_PROJECT_CONTEXT.md`、`admin/docs/ADMIN_SKILL.md`、`admin/docs/ADMIN_CHANGELOG.md`
