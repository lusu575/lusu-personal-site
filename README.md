# lusu-personal-site

## 多人实时在线画板

- 当前独立版本为 `1.0.4`；本次升版把白板的固定机器入口纳入受追踪工具目录契约，不改变房间、场景或绘制协议。公共画板与所有密码房的新建元素继续统一使用暖白纸张、石墨线条、hachure 填充与高 roughness 的铅笔草图默认值，当前不按房型提供第二套主题。
- 现有**工具区**新增 `/tools/whiteboard/` 独立页面，无需登录即可进入公共画板，或由参与者自行输入相同密码进入完全隔离的密码房；分享链接不携带密码，返回按钮回到工具区，不新增或恢复“资源区”。
- 前端按路由懒加载 React、Excalidraw、Yjs 和 awareness 等效状态；`WhiteboardRoom` Durable Object 通过 WebSocket Hibernation 维护对象级 CRDT、快照和增量，鼠标、选区、绘制状态与在线状态只实时广播、不写入 D1。
- 匿名聊天室与画板共用服务端验证的 `lusu_anonymous` 身份、临时名字和稳定颜色。名字组合超过一万种，房内由后端原子查重；跨标签页只广播无身份数据的“版本已变化”信号，再由各页面向服务端刷新。改名有约 30 秒冷却和短期次数限制，不开放任意昵称，也不向其他用户暴露登录名、IP 或设备信息。
- 密码经 NFKC、trim 后以服务端 HMAC-SHA256 映射为不可逆房间 ID；明文不进入 URL、存储、埋点或普通日志。公共房不执行 TTL；密码房最后一名真实用户离开后保留 24 小时，重入取消旧 Alarm，再次为空重新计时，清理前会再次核对连接和截止时间。
- 快速画线只在画布真实变化时合并为 250／500／1000ms 有界增量；只有 Worker 确认已持久化的更新才从本地队列移除，限流或断线时自动重连重传。可见页保活由边缘自动应答而不唤醒休眠 DO，隐藏页 60 秒后排空并停放连接；空公共房不周期轮询且内容持续保留，密码房仍按最后离开 24 小时清理。
- 图片只接受校验后的 PNG/JPEG/WebP，保存到私有 R2 的房间前缀，画布仅保存资源 ID；清空画布和删除房间会幂等清理无引用资源。管理员可查看容量、连接、错误与自动清理计数，清空或锁定公共画板、移除异常连接、临时封禁以及删除空密码房。
- 受 `whiteboard:read`／`whiteboard:write`／`whiteboard:assets` 非默认 scope 约束的本地 CLI／stdio MCP 可加入房间、读取 scene、上传或下载当前房图片、追加最多 50 个安全高层元素或已提交图片，并本地导出 JSON／SVG／PNG。Agent Bearer 与房间令牌分离，服务端只接受追加式 Yjs 更新和幂等 operation ID；不支持编辑／删除、未授权或跨房图片写入及任意 Yjs 注入。
- 画板工具卡图标是 image2 生成的项目内 PNG；`assets/images/generated-icons/whiteboard.source.json` 锁定生成器、生成/发布尺寸、最终 SHA-256，并声明发布前仅做机械 resize。在线画板后续所有图标、插画和装饰素材也只能由 image2 生成，不使用 CSS、Canvas、SVG 路径或代码几何拼凑素材。
- 详细架构、限制、绑定、测试、部署和回滚见 `docs/whiteboard/README.md` 与 `workers/whiteboard/README.md`。仓库中的配置和代码不代表 Cloudflare 远端迁移、生产部署或正式域名已经验证。

## 临时互传

- 当前独立版本为 `1.0.5`；版本、更新日志和 AI 维护约定位于 `docs/transfer/`。本次升版修复共享 Agent Auth 的浏览器确认与令牌管理表单，精确同源、登录态和 CSRF 边界保持不变，也不改变互传协议。
- 工具区（English `Tools` / 日本語 `ツール`，内部 route 仍为 `resources`）提供登录限定的“临时互传 / Quick Transfer / 一時転送”，支持 24 小时房间、加密文字、私有 R2 文件和 Range 视频播放。
- 工具区中的临时互传与日语学习卡片使用一致的网格宽度和卡片节奏；互传入口、登录、房间、消息、上传任务、文件预览与输入区已适配窄竖屏、短屏、软键盘和手机横屏。
- 相册、通用文件、拖放与粘贴附件都会先进入输入区待发送托盘，再由“发送”统一启动上传；手机提供独立的多选相册入口，文字失败时附件仍可重试。
- 待发送图片使用可移除的小缩略图，消息流图片保持紧凑，普通文件显示图标卡片；附件提供下载按钮，成功解密的文字提供复制按钮。
- 互传房间支持整个窗口拖入文件；桌面窗口与消息区会随浏览器可用高度伸展，手机继续使用单滚动路径。
- 普通账号受 95 MiB 单文件、个人/房间/频率及全站 8 GiB 免费池限制；只有 D1 `users.role = admin` 可用 Multipart 上传数百 MB 到数 GB 文件。
- 根 `wrangler.jsonc` 已在顶层声明 Production 的私有 `TRANSFER_BUCKET`；Pages Preview 显式不绑定 R2，避免预览部署误用正式文件，待单独创建 Preview 桶后再启用。部署前仍需按 `docs/transfer/README.md` 确认正式桶已创建，并部署清理 Worker、生命周期与 Cloudflare 官方预算提醒。
- 本地建议 Node.js 22.13+；本地同名变量放在 Git 忽略的 `.dev.vars` 并独立生成，不得提交 `.dev.vars`、`.env` 或真实密钥。

## AI 能力层 / MCP / CLI

- 第一阶段建立了统一能力注册表 `lib/capabilities/registry.mjs`。`transport` 表示长期目标接入面，`availableTransports` 才表示当前已实现且允许客户端调用的接入面；两者不得混用。
- 已实现的本地入口为 `cli/lusu.mjs` 和 `mcp/local/server.mjs`。它们可读取能力目录、文章／每日 AI 新闻、视频详情、三项真实工具、五个游戏的安全目录，以及日语潜台词 5 个等级／250 关；也可对授权后的 Quick Transfer 与在线画板执行受限操作，并运行隔离的本地 2048 Agent 会话。两个入口都复用业务适配层；网络能力向 `SiteClient` 注入站点共享的代理感知 fetch，不输出代理值或凭据。可用 `npm.cmd run lusu -- --help` 查看 CLI，用 `npm.cmd run mcp:local` 启动 stdio MCP。
- 本地机器客户端通过网站设备码页面由账号持有者确认，令牌按 `content:read`、Transfer 与 Whiteboard 的最小 scope 授权；删除和画板 scope 均非默认。机器 Bearer 令牌不能获得管理员权限；房间口令不放进命令行、URL、日志或分析数据，Transfer 文字密钥始终在本地派生。
- 2048 适配器使用共享纯引擎、revision CAS 和 clientActionId 去重；CLI／MCP 会话与已打开的浏览器隔离，不应描述为远程接管现有游戏。页面只预留了冻结的语义 Agent bridge，并保留原有云存档兼容入口。
- `workers/site-mcp/` 是独立的远程 MCP Worker 工程，当前只提供公开内容的只读能力。代码和本地测试已就绪，但未部署、未提供正式远程 MCP 地址，也没有在线画板、游戏或其他写工具；这些本地能力不改变远程 OAuth 前置条件。
- 能力盘点、安全边界、本地使用和远程部署前清单见 `docs/agent-capabilities/README.md`。

鲁肃的个人站，一个保留 Windows XP + Pixel Art + Y2K 桌面识别度、同时提供原创移动虚拟 OS 的个人空间。

## GPTWork / 全新克隆启动

普通站点开发只需要 Node.js 22.13+、npm 和仓库中的文件，不需要登录 Cloudflare，也不会访问生产 D1。

纯本地 Windows 开发在仓库根目录执行：

```powershell
npm.cmd ci
Copy-Item .env.example .dev.vars
# 填写现有三个运行时配置和四个画板 Secret 的本地测试值；不要提交 .dev.vars
npm.cmd run d1:migrate:local
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run whiteboard:test
npm.cmd run game:test
npm.cmd run build
npm.cmd run dev
```

Linux / macOS 对应命令为：

```bash
npm ci
npm run d1:migrate:local
npm run lint
npm run typecheck
npm test
npm run whiteboard:test
npm run game:test
npm run build
npm run dev
```

GPTWork 先在云端 Secrets 中配置下列运行时值，再执行 `npm ci`、本地迁移、Lint、类型检查、测试、生产构建和开发命令。GPTWork 已注入 process environment 时不要创建 `.dev.vars`，空的本地文件会遮蔽云端值；Linux 纯本地开发才使用 `cp .env.example .dev.vars` 并填写本地测试值。

本地站点默认位于 `http://127.0.0.1:8788/`，健康检查为 `http://127.0.0.1:8788/api/health`；本地 D1 数据位于被 Git 忽略的 `.wrangler/`，与生产数据库完全分离。

云端 Production 需要配置 D1 binding `DB`，并在部署使用它的提交前配置以下加密 Secret（只配置名称，不写入仓库）：

- `CHAT_IP_HASH_SALT`
- `ANALYTICS_IP_HASH_SALT`
- `OWNER_ADMIN_EMAILS`
- `WHITEBOARD_ROOM_HMAC_SECRET`
- `WHITEBOARD_TICKET_SECRET`
- `WHITEBOARD_INTERNAL_SECRET`
- `WHITEBOARD_IP_HASH_SALT`

`OWNER_ADMIN_EMAILS` 接受逗号、分号或空白分隔的邮箱列表。Functions 只从运行时环境读取它，用于保护已经在 D1 中具有 `admin` 角色的站长账号：阻止公开抢注、后台改邮箱和降级；它不会授予管理员权限，也不是权限绕过。站长账号必须先通过受控方式在 D1 中建立并授予 `admin`。缺失时不会使用源码 fallback、不会自动提升任何账号，也不会令全站返回 503；既有 D1 角色和最后管理员原子保护仍然工作。

四个画板 Secret 必须用途独立、随机且至少 32 UTF-8 bytes。Pages Functions 读取全部四个；独立画板 Worker 只读取与对应 Pages 环境相同的 `WHITEBOARD_INTERNAL_SECRET`。Preview 与 Production 使用隔离值，真实值不得写入仓库、文档或日志。

根 `wrangler.jsonc` 提交态的 `env.preview` 固定为 `PREVIEW_API_DISABLED=true` 且 `d1_databases: []`、`r2_buckets: []`、`durable_objects.bindings: []`；Cloudflare Pages 预览子域名也会在任何 D1 调用前关闭 `/api/*`。因此未完成隔离配置的 Preview 会 fail closed，不会读写 Production D1/R2/DO，也不会因引用尚未部署的 Preview Worker 而令整次预览发布失败。只有创建并迁移独立 Preview D1、独立 R2（如需文件能力）、Preview Worker/DO namespace、精确 Origin 与独立 Secret，并先成功部署 Preview Worker 后，才可在经审查的 Preview 配置中绑定这些独立资源并关闭该开关。

常用校验命令：`npm run lint`、`npm run typecheck`、`npm test`、`npm run whiteboard:test`、`npm run game:test`、`npm run build`、`npm run build:production:verify`。标准 `npm run build` 会先执行 `scripts/build-check.mjs` 仓库守卫，全部通过后再由 `scripts/build-production.mjs` 原子生成被 Git 忽略的 `dist/`；`build:production:verify` 额外执行两次候选构建并比对清单，验证可复现性。

Cloudflare Pages Git 部署必须与仓库契约保持一致：框架预设 `None`，Build command 为 `npm run build`，Build output directory 为 `dist`，Root directory 为 `/`。根 `wrangler.jsonc` 的 `pages_build_output_dir` 同样固定为 `dist`。正式部署仍由 GitHub `main` 触发 Cloudflare Pages 自动部署，不能把仓库根目录或未构建的 `tools/whiteboard/dist/*` 占位引用直接发布；画板 Durable Object Worker 必须在 Pages 使用 external binding 前单独部署。GPTWork 不需要生产 D1 权限或 Cloudflare API Token，除非站长另行授权远程运维。

只有获得生产数据变更授权后，才可人工执行 `npm.cmd run d1:migrate:remote`。该命令会先应用基础 schema，再用 PRAGMA 只补旧 Chat / Transfer 表缺失的兼容列，随后创建依赖索引并分组核验；普通本地开发、测试和 CI 不得调用，也不得用删除远端 D1 的方式迁移。

后台视频链接预览、首次保存或刷新元数据时会访问 YouTube / Bilibili；网络受限时只有这些管理功能会降级或失败，普通安装、测试、构建、健康检查与站点启动不依赖它们。Python、Kokoro、ffmpeg、本机 TTS 配置、参考声线和模型权重只在重新生成日语训练器语音时需要。完整迁移清单见 `docs/GPTWORK_MIGRATION_READINESS.md`，Cloudflare 配置见 `cloudflare/README.md`。

## 当前状态

- 首页使用 morning / day / dusk / night 四时段像素壁纸，并已接入无云底图 + 单朵独立云层的动态云层效果。
- 公开主站使用“同一业务状态、两套呈现壳”：桌面端是 Neo-XP / Pixel Glass OS，移动端是带 App Home 和 safe-area 适配的虚拟手机系统；手机壳已移除重复的时间与 `LUSU OS` 状态行。真实毛玻璃 Dock 在 Home 与栏目 App 内持续悬浮，保留 Home、知识库、视频、工具、游戏、聊天室六个高频入口；杂谈与关于仍从 Home 图标进入。Dock 可横向滑动、切换并收起，账号和语言操作仍只在 Home。
- 手机知识库文章的回顶控制与固定 Appbar 已完成触控层隔离；非控件区域不会拦截回顶点击，返回、复制等真实 Appbar 控件保持可用，阅读进度只保留进度条而不重复显示栏目文字与百分比。
- 桌面图标打开只淡入目标窗口，任务栏返回 Home 只轻滑入图标区；壁纸、顶栏和任务栏不进入这两条转场。模块间 route 只让新页面低位移淡入，旧窗口快照隐藏，不使用 3D 书页翻动、双边框叠影、整屏闪白或点击原点巨幅缩放；移动 Home 使用紧凑固定行高图标网格，真实 Dock 以共享选中底板连续滑动。
- 知识库文章内容保存在 Cloudflare D1，正式文章需要同时维护中文 / English / 日本語 三语内容。
- 关于我窗口提供 X、GitHub、Bilibili、Instagram、Discord 小图标入口，链接从 `GET /api/social-links` 公开只读读取。
- `/admin/` 是独立中文管理后台，只有 `users.role = admin` 的站长账号可以访问，用于文章、视频、社交链接、访问监控、点击埋点、聊天室和在线画板治理；`OWNER_ADMIN_EMAILS` 只负责保持配置账号的 D1 角色，不替代这项服务端鉴权。
- 主站访问与点击数据通过 `js/telemetry.js` 上报；不记录输入框内容、密码、未发送聊天内容或文章草稿。
- 匿名聊天室公开侧保持纯文本渲染，后台可隐藏、恢复、删除消息，并按隐藏访客 ID 或 IP hash 禁言。
- 游戏区只保留可在本站本地打开的静态游戏入口，不做外部跳转入口。
- 工具区提供多人实时在线画板，支持公共房、密码房、实时鼠标与临时名字、成员列表、图片、PNG/SVG 导出、自动重连、只读状态和手机触控。
- 站点 AI 能力层已提供本地 CLI、stdio MCP、设备码授权、Quick Transfer、受限画板追加／导出、隔离 2048 会话，以及视频详情、真实工具、五个游戏和 250 个日语关卡的安全只读目录；独立远程 MCP Worker 仍为未部署的公开文章只读实现，其他游戏控制、浏览器配对、聊天写入和日语进度写入尚未宣告可用。
- 工具区提供独立工具“日语的言外之意 / Behind the Japanese / 日本語の裏側”：当前应用版本 `1.0.3`、内容兼容版本 `1.0.2`，包含 5 个难度、250 个 N3–N1 潜台词训练关卡，支持纯听/日语/双语模式、逐句与词块离线语音、月历打卡、本地进度和账号云同步；每关配有响应式黑白四格场景图，维护规则见 `tools/japanese-subtext/MAINTENANCE.md`。

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
- 统一匿名身份：`functions/api/anonymous-identity.mjs`、`js/features/anonymous-identity.mjs`
- 在线画板：`tools/whiteboard/`
- 画板房间 Worker：`workers/whiteboard/`
- 画板架构与运维：`docs/whiteboard/README.md`
- AI 能力注册表：`lib/capabilities/registry.mjs`
- 本地 CLI / stdio MCP：`cli/lusu.mjs`、`mcp/local/server.mjs`
- 远程只读 MCP Worker（未部署）：`workers/site-mcp/`
- AI 能力架构与运维：`docs/agent-capabilities/README.md`
- D1 schema：`cloudflare/schema.sql`
- 日语潜台词训练器：`tools/japanese-subtext/`（维护与离线语音说明见其 `README.md`）
- 项目上下文：`PROJECT_CONTEXT.md`
- 项目专用 Skill：`skills/lusu-personal-site-skill/SKILL.md`
- 后台专用文档：`admin/docs/ADMIN_PROJECT_CONTEXT.md`、`admin/docs/ADMIN_SKILL.md`、`admin/docs/ADMIN_CHANGELOG.md`
