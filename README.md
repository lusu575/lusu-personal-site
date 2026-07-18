# lusu-personal-site

## 临时互传

- 资源区提供登录限定的“临时互传 / Quick Transfer / 一時転送”，支持 24 小时房间、加密文字、私有 R2 文件和 Range 视频播放。
- Resources 中的临时互传与日语学习卡片使用一致的网格宽度和卡片节奏；互传入口、登录、房间、消息、上传任务、文件预览与输入区已适配窄竖屏、短屏、软键盘和手机横屏。
- 相册、通用文件、拖放与粘贴附件都会先进入输入区待发送托盘，再由“发送”统一启动上传；手机提供独立的多选相册入口，文字失败时附件仍可重试。
- 待发送图片使用可移除的小缩略图，消息流图片保持紧凑，普通文件显示图标卡片；附件提供下载按钮，成功解密的文字提供复制按钮。
- 互传房间支持整个窗口拖入文件；桌面窗口与消息区会随浏览器可用高度伸展，手机继续使用单滚动路径。
- 普通账号受 95 MiB 单文件、个人/房间/频率及全站 8 GiB 免费池限制；只有 D1 `users.role = admin` 可用 Multipart 上传数百 MB 到数 GB 文件。
- 根 `wrangler.jsonc` 已在顶层声明 Production 的私有 `TRANSFER_BUCKET`；Pages Preview 显式不绑定 R2，避免预览部署误用正式文件，待单独创建 Preview 桶后再启用。部署前仍需按 `docs/transfer/README.md` 确认正式桶已创建，并部署清理 Worker、生命周期与 Cloudflare 官方预算提醒。
- 本地建议 Node.js 22.13+；本地同名变量放在 Git 忽略的 `.dev.vars` 并独立生成，不得提交 `.dev.vars`、`.env` 或真实密钥。

鲁肃的个人站，一个保留 Windows XP + Pixel Art + Y2K 桌面识别度、同时提供原创移动虚拟 OS 的个人空间。

## GPTWork / 全新克隆启动

普通站点开发只需要 Node.js 22.13+、npm 和仓库中的文件，不需要登录 Cloudflare，也不会访问生产 D1。

纯本地 Windows 开发在仓库根目录执行：

```powershell
npm.cmd ci
Copy-Item .env.example .dev.vars
# 填写两个独立、随机且至少 32 字节的盐，并用测试邮箱填写站长配置；不要提交 .dev.vars
npm.cmd run d1:migrate:local
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

GPTWork 先在云端 Secrets 中配置下列三个变量，再执行 `npm ci`、`npm run d1:migrate:local`、`npm test`、`npm run build`、`npm run dev`。GPTWork 已注入 process environment 时不要创建 `.dev.vars`，空的本地文件会遮蔽云端值；Linux 纯本地开发才使用 `cp .env.example .dev.vars` 并填写本地测试值。

本地站点默认位于 `http://127.0.0.1:8788/`，健康检查为 `http://127.0.0.1:8788/api/health`；本地 D1 数据位于被 Git 忽略的 `.wrangler/`，与生产数据库完全分离。

云端运行需要在 Cloudflare Pages 的 Preview 和 Production 环境分别配置 D1 binding `DB`，并在部署使用它们的提交前分别配置以下加密 Secret（只配置名称，不写入仓库）：

- `CHAT_IP_HASH_SALT`
- `ANALYTICS_IP_HASH_SALT`
- `OWNER_ADMIN_EMAILS`

`OWNER_ADMIN_EMAILS` 接受逗号、分号或空白分隔的邮箱列表。Functions 只从运行时环境读取它，用于保护已经在 D1 中具有 `admin` 角色的站长账号：阻止公开抢注、后台改邮箱和降级；它不会授予管理员权限，也不是权限绕过。站长账号必须先通过受控方式在 D1 中建立并授予 `admin`。缺失时不会使用源码 fallback、不会自动提升任何账号，也不会令全站返回 503；既有 D1 角色和最后管理员原子保护仍然工作。

Cloudflare Pages 预览子域名会在任何 D1 调用前关闭 `/api/*`；自定义预览域名也可设置 `PREVIEW_API_DISABLED=true`。在独立 Preview D1 配置完成前，Preview API 会 fail closed，不会读写 Production D1。

常用校验命令：`npm test`、`npm run build`。项目目前未配置独立的 lint 和 typecheck 命令，不应以空命令伪装通过。正式部署仍由 GitHub `main` 触发 Cloudflare Pages 自动部署；GPTWork 不需要生产 D1 权限或 Cloudflare API Token，除非站长另行授权远程运维。

只有获得生产数据变更授权后，才可人工执行 `npm.cmd run d1:migrate:remote`。该命令会先应用基础 schema，再用 PRAGMA 只补旧 Chat / Transfer 表缺失的兼容列，随后创建依赖索引并分组核验；普通本地开发、测试和 CI 不得调用，也不得用删除远端 D1 的方式迁移。

后台视频链接预览、首次保存或刷新元数据时会访问 YouTube / Bilibili；网络受限时只有这些管理功能会降级或失败，普通安装、测试、构建、健康检查与站点启动不依赖它们。Python、Kokoro、ffmpeg、本机 TTS 配置、参考声线和模型权重只在重新生成日语训练器语音时需要。完整迁移清单见 `docs/GPTWORK_MIGRATION_READINESS.md`，Cloudflare 配置见 `cloudflare/README.md`。

## 当前状态

- 首页使用 morning / day / dusk / night 四时段像素壁纸，并已接入无云底图 + 单朵独立云层的动态云层效果。
- 公开主站使用“同一业务状态、两套呈现壳”：桌面端是 Neo-XP / Pixel Glass OS，移动端是带 App Home 和 safe-area 适配的虚拟手机系统；手机壳已移除重复的时间与 `LUSU OS` 状态行。真实毛玻璃 Dock 在 Home 与栏目 App 内持续悬浮，保留 Home、知识库、视频、资源、游戏、聊天室六个高频入口；杂谈与关于仍从 Home 图标进入。Dock 可横向滑动、切换并收起，账号和语言操作仍只在 Home。
- 手机知识库文章的回顶控制与固定 Appbar 已完成触控层隔离；非控件区域不会拦截回顶点击，返回、复制等真实 Appbar 控件保持可用，阅读进度只保留进度条而不重复显示栏目文字与百分比。
- 桌面图标打开只淡入目标窗口，任务栏返回 Home 只轻滑入图标区；壁纸、顶栏和任务栏不进入这两条转场。模块间 route 只让新页面低位移淡入，旧窗口快照隐藏，不使用 3D 书页翻动、双边框叠影、整屏闪白或点击原点巨幅缩放；移动 Home 使用紧凑固定行高图标网格，真实 Dock 以共享选中底板连续滑动。
- 知识库文章内容保存在 Cloudflare D1，正式文章需要同时维护中文 / English / 日本語 三语内容。
- 关于我窗口提供 X、GitHub、Bilibili、Instagram、Discord 小图标入口，链接从 `GET /api/social-links` 公开只读读取。
- `/admin/` 是独立中文管理后台，只有 `users.role = admin` 的站长账号可以访问，用于文章管理、视频管理、社交链接、访问监控、点击埋点和聊天室管理；`OWNER_ADMIN_EMAILS` 只负责保持配置账号的 D1 角色，不替代这项服务端鉴权。
- 主站访问与点击数据通过 `js/telemetry.js` 上报；不记录输入框内容、密码、未发送聊天内容或文章草稿。
- 匿名聊天室公开侧保持纯文本渲染，后台可隐藏、恢复、删除消息，并按隐藏访客 ID 或 IP hash 禁言。
- 游戏区只保留可在本站本地打开的静态游戏入口，不做外部跳转入口。
- 资源区提供独立工具“日语的言外之意 / Behind the Japanese / 日本語の裏側”：当前应用版本 `1.0.3`、内容兼容版本 `1.0.2`，包含 5 个难度、250 个 N3–N1 潜台词训练关卡，支持纯听/日语/双语模式、逐句与词块离线语音、月历打卡、本地进度和账号云同步；每关配有响应式黑白四格场景图，维护规则见 `tools/japanese-subtext/MAINTENANCE.md`。

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
