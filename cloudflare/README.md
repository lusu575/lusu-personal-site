# Cloudflare Pages、D1、Durable Objects 与 R2 配置

本站使用 Cloudflare Pages Functions、D1，并为在线画板使用独立 Durable Object Worker 与私有 R2。普通本地开发只使用本地资源，不需要 `wrangler login`、Cloudflare API Token 或生产数据库权限。

## 全新克隆后的本地启动

需要 Node.js 22.13+。纯本地 Windows 开发在仓库根目录执行：

```powershell
npm.cmd ci
Copy-Item .env.example .dev.vars
# 填写七个运行时配置的独立本地测试值
npm.cmd run d1:migrate:local
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run whiteboard:test
npm.cmd run build
npm.cmd run dev
```

Linux 纯本地开发使用 `cp .env.example .dev.vars`。GPTWork 应把七个运行时值注入 process environment，并直接执行 npm 命令；已注入时不要创建 `.dev.vars`，否则空文件可能遮蔽云端值。Wrangler 从 `wrangler.jsonc` 读取 Pages 和 D1 配置；`preview_database_id` 让本地开发使用模拟 D1，不会连接生产数据库。本地状态、`.dev.vars` 和依赖目录均被 Git 忽略。

打开：

- `http://127.0.0.1:8788/`
- `http://127.0.0.1:8788/api/health`

健康检查应返回 HTTP 200，且响应中的 `ok` 和 `db` 为 `true`；不要依赖本地 `userCount` 的具体数值。

## Pages Git 构建设置

Cloudflare Dashboard 中 Pages 项目 `lusu-personal-site` 的 Production 与 Preview 构建设置必须保持一致：

- Framework preset：`None`
- Build command：`npm run build`
- Build output directory：`dist`
- Root directory：`/`

根 `wrangler.jsonc` 的 `pages_build_output_dir` 固定为 `dist`。标准 `npm run build` 先运行 `scripts/build-check.mjs` 守卫仓库、Pages 配置与公开边界，再运行 `scripts/build-production.mjs`，将白名单静态文件和内容哈希 bundle 原子写入被 Git 忽略的 `dist/`。Cloudflare Pages 只能发布该目录，不能把仓库根目录当作静态输出；否则 `/tools/whiteboard/` 中等待构建改写的脚本和样式占位路径会失效。`npm run build:production:verify` 会连续生成两个候选并比对 manifest，用于发布前的可复现性验证。

## 环境变量和 Secrets

Pages Functions 运行时配置包含：

- `CHAT_IP_HASH_SALT`：聊天室限流与禁言所用的 IP HMAC key。
- `ANALYTICS_IP_HASH_SALT`：分析事件所用的 IP HMAC key。
- `OWNER_ADMIN_EMAILS`：需要保持管理员角色的站长邮箱列表，可用逗号、分号或空白分隔。
- `WHITEBOARD_ROOM_HMAC_SECRET`：把规范化后的密码映射为不可逆房间 ID。
- `WHITEBOARD_TICKET_SECRET`：加密并签发短期房间票据。
- `WHITEBOARD_INTERNAL_SECRET`：Pages 与独立画板 Worker 之间的内部请求鉴权。
- `WHITEBOARD_IP_HASH_SALT`：画板限频和临时封禁所用的 IP HMAC key。

两个现有 salt 与四个画板 Secret 都必须按用途独立生成、随机且至少 32 UTF-8 bytes；不得跨用途或跨 Production／Preview 复用，也不得写进代码、README、`.env.example` 的值、命令历史或 Git。缺少、过短或不安全复用时，相关 API 会关闭并只记录变量名称，不记录值。

`OWNER_ADMIN_EMAILS` 只从请求运行时 `env` 读取并规范化，用于把匹配账号保持为 `users.role = admin` 以及阻止后台降级，不是登录或鉴权 bypass。缺失或为空时不会回退公开源码、不会自动提升账号，也不会触发上述 503；数据库现有角色、当前登录管理员不可自降级和最后管理员原子保护仍然有效。

纯本地开发只使用被忽略的 `.dev.vars`。GPTWork 使用平台注入的 process environment，不创建 `.dev.vars`。两种方式都不要创建或提交 `.env`、`.dev.vars.*` 或 `.env.*`。

## Cloudflare Preview 和 Production

在 Cloudflare Dashboard 的 Pages 项目 `lusu-personal-site` 中，Production 必须检查：

1. D1 binding 名称为 `DB`，指向 Production D1 数据库。
2. 以加密 Secret 方式配置 `CHAT_IP_HASH_SALT`。
3. 以加密 Secret 方式配置 `ANALYTICS_IP_HASH_SALT`。
4. 以加密 Secret 方式配置 `OWNER_ADMIN_EMAILS`，并确认邮箱列表属于当前环境。
5. 以加密 Secret 方式配置四个 `WHITEBOARD_*` 画板值。
6. 核对 external Durable Object binding `WHITEBOARD_ROOMS` 指向 `WhiteboardRoom@lusu-whiteboard-do`。
7. 在部署使用这些变量的提交之前完成配置。

仓库提交态的根 `wrangler.jsonc` 对 Preview 明确 fail closed：

- `env.preview.vars.PREVIEW_API_DISABLED = "true"`
- `env.preview.d1_databases = []`
- `env.preview.r2_buckets = []`
- `env.preview.WHITEBOARD_ROOMS` 仅指向隔离的 `WhiteboardRoom@lusu-whiteboard-do-preview`

这组配置不得填写 Production D1 的 ID／名称或 Production R2 桶名。顶层 D1 的 `preview_database_id: "DB"` 只供本地 `wrangler pages dev` 模拟 binding，不等于 Cloudflare Pages Preview 环境绑定。只有创建并迁移独立 Preview D1、按需创建独立 Preview R2、部署 Preview Worker/DO namespace、配置精确 Preview Origin 与独立 Secret 后，才能在经审查的 Preview 配置中绑定这些独立资源并把 `PREVIEW_API_DISABLED` 改为 `false`。任一项未完成时保持 API 关闭。

只有获授权的运维人员才可远程修改 Secret。Wrangler 的交互式命令如下；它会修改 Cloudflare 远程状态，本地或 GPTWork 验证流程不得自动执行：

```powershell
npx.cmd wrangler pages secret put CHAT_IP_HASH_SALT --project-name lusu-personal-site
npx.cmd wrangler pages secret put ANALYTICS_IP_HASH_SALT --project-name lusu-personal-site
npx.cmd wrangler pages secret put OWNER_ADMIN_EMAILS --project-name lusu-personal-site
npx.cmd wrangler pages secret put WHITEBOARD_ROOM_HMAC_SECRET --project-name lusu-personal-site
npx.cmd wrangler pages secret put WHITEBOARD_TICKET_SECRET --project-name lusu-personal-site
npx.cmd wrangler pages secret put WHITEBOARD_INTERNAL_SECRET --project-name lusu-personal-site
npx.cmd wrangler pages secret put WHITEBOARD_IP_HASH_SALT --project-name lusu-personal-site
```

配置 Preview 与 Production 时，必须在 Dashboard 中明确选择环境并逐项核对，避免把值写到错误环境；Preview Secret 不得复用 Production 值。

## 首次远程建库或迁移（仅获授权时）

现有项目不应重复创建 D1。只有新建独立 Cloudflare 项目时才执行：

```powershell
npm.cmd run d1:create
```

把返回的 `database_id` 写入经审查的 `wrangler.jsonc` 后，只有得到生产数据变更授权才执行：

```powershell
npm.cmd run d1:migrate:remote
```

普通迁移准备、CI 和 GPTWork 开发都不得执行远程迁移，也不得访问生产 D1。

`d1:migrate:remote` 由 `scripts/d1-migrate-remote.mjs` 执行，固定顺序为基础 `schema.sql`、PRAGMA 兼容列检查、仅缺失列的 `ALTER TABLE ... ADD COLUMN`、`schema-indexes.sql`、分组核验。它不会删除表或历史记录；任一列或索引未成功建立都会以失败退出。不得绕过该 runner 直接只执行 `schema.sql`，否则旧表可能缺少新列，后续索引无法安全创建。

## 在线画板绑定、迁移和生命周期

- Pages 的 `DB` 保存统一匿名身份与 `whiteboard_rooms`、`whiteboard_assets`、`whiteboard_bans`、`whiteboard_admin_audit` 管理索引；房间的 Yjs 文档、快照、增量、票据消费与 Alarm 状态由对应 `WhiteboardRoom` Durable Object 权威保存。
- 根 `wrangler.jsonc` 声明 external binding `WHITEBOARD_ROOMS`。独立脚本配置位于 `workers/whiteboard/wrangler.jsonc`，绑定同环境 D1、私有 `WHITEBOARD_BUCKET` 和允许的 Origin；当前桶内按 `whiteboard/v1/<roomId>/<assetId>` 隔离。Worker 只需要与对应 Pages 环境一致的 `WHITEBOARD_INTERNAL_SECRET`，不读取其余三个画板 Secret。
- `workers/whiteboard/wrangler.jsonc` 的 `v1` migration 通过 `new_sqlite_classes: ["WhiteboardRoom"]` 创建 SQLite-backed Durable Object namespace。已经上线后不得删除、改名、复用或重写该 migration tag 与 namespace；后续变更只能追加新 migration。
- 公共房 `public-v1` 永不因空房删除。密码房最后一条有效连接关闭或心跳超时后记录 `emptySince`，并设置 24 小时 `deleteAt` Alarm；重入会取消旧计划，再次为空重新计时。Alarm 清理前重查连接、房型、截止时间和代次，先幂等删除房间 R2 前缀与 D1 索引，再清理 DO 状态；失败会退避重试。
- 清空房间、删除密码房和一小时无引用上传清理都只处理对应房间前缀，不能扫描或删除其他房间、临时互传或桶内其他业务对象。

本地验证时，在根 Pages 开发服务之外另启一个终端：

```powershell
npm.cmd run whiteboard:dev
```

根 `.dev.vars` 填写四个独立画板测试值；`workers/whiteboard/.dev.vars` 只填写与根环境相同的 internal secret。不要提交任一文件或真实值。

获授权后的首次发布顺序固定为：

1. `npm ci`、本地 D1 migration、Lint、类型检查、全量测试、`whiteboard:test`、构建与生产构建验证。
2. 人工执行并核验 Production 远端 D1 migration；不得先部署会读取新表的 Production Worker 或 Pages。
3. 先部署带既有 `v1` migration 的 `lusu-whiteboard-do`，并核对 D1、R2、Origin 与 Worker internal secret。
4. 再核对 Pages Production 的四个 Secret 与 external binding；Preview 继续保持 fail closed，除非独立 Preview 数据资源已单独迁移和验收。
5. 通过 PR 合并 `main`，由 Pages Git 集成部署；最后再验证正式域名、跨会话协作、24 小时 Alarm 与原功能回归。

仓库中的绑定声明只表示预期配置，不证明 Cloudflare Dashboard、远端迁移、Worker、Pages 或正式域名已经部署和验证。

## 在线画板回滚

出现严重问题时，先阻止新画板连接并回滚 Pages 入口或 external binding，再部署与现有状态兼容的上一版 Worker。保留 Durable Object namespace、`v1` migration、D1 新表、快照、Alarm 和 R2 数据，禁止通过删除 namespace 或数据库完成回滚。若 `WHITEBOARD_INTERNAL_SECRET` 泄露，必须在同一维护窗口同步轮换对应环境的 Pages 与 Worker 值。只有经授权并确认无引用后才清理房间数据。

## 发布方式

正式 Pages 发布链路固定为：GitHub Pull Request 审查并合并到 `main`，随后由 Cloudflare Pages Git 集成自动部署。独立画板 Worker 按上一节在 Pages 使用 binding 前部署。`npm run deploy` 只输出提示，不执行手工 Pages 发布；不要把 `wrangler pages deploy` 当成常规发布步骤。

## IP 哈希升级兼容性

当前实现使用带用途域隔离的 HMAC-SHA256。聊天消息和网络来源禁言同时保存由 Secret 自动派生的非敏感密钥代次；首次从旧固定盐切换或以后轮换 Secret 时，旧记录会被明确标记为旧代次。后台不会再从旧消息创建表面成功但无法匹配的禁言，旧禁言显示“密钥已轮换”；只有新代次消息能用于重新建立网络来源禁言。用户标识禁言不受影响，分析历史仍会形成新旧两个时期。不要恢复公开 fallback，也不要为了兼容把旧 Secret 写入仓库。

`cloudflare/schema.sql` 定义表和 seed，`cloudflare/schema-indexes.sql` 定义依赖新增列的代次索引。`npm run d1:migrate:local` 与获授权后人工运行的 `npm run d1:migrate:remote` 都会先执行基础 schema，再检查旧表、补齐缺失列，最后创建并核验索引；已有云端 D1 的 `ensureChatSchema()` 仍在聊天 / 后台聊天接口查询前提供同顺序的运行时兜底。不要删除运行时 schema guard，也不要把依赖新列的索引提前放进静态 schema 的旧表执行路径。

## 可选外部服务

后台视频链接预览、首次保存和刷新元数据会访问 YouTube / Bilibili；网络受限时这些操作可能降级或失败，但不阻塞 `npm test`、`npm run build`、`/api/health` 或普通站点启动。日语训练器离线语音再生成另需 Python、Kokoro、ffmpeg、模型和参考声线，它们不属于普通云端开发依赖。
