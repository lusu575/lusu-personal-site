# Cloudflare Pages + D1 配置

本站使用 Cloudflare Pages Functions 和 D1。普通本地开发只使用 `.wrangler/` 中的本地 D1，不需要 `wrangler login`、Cloudflare API Token 或生产数据库权限。

## 全新克隆后的本地启动

需要 Node.js 22.13+。纯本地 Windows 开发在仓库根目录执行：

```powershell
npm.cmd ci
Copy-Item .env.example .dev.vars
# 填写两个独立、随机且至少 32 字节的盐，并用测试邮箱填写站长配置
npm.cmd run d1:migrate:local
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

Linux 纯本地开发使用 `cp .env.example .dev.vars`。GPTWork 应把三个 Secret 注入 process environment，并直接执行 npm 命令；已注入时不要创建 `.dev.vars`，否则空文件可能遮蔽云端值。Wrangler 从 `wrangler.jsonc` 读取 Pages 和 D1 配置；`preview_database_id` 让本地开发使用模拟 D1，不会连接生产数据库。本地状态、`.dev.vars` 和依赖目录均被 Git 忽略。

打开：

- `http://127.0.0.1:8788/`
- `http://127.0.0.1:8788/api/health`

健康检查应返回 HTTP 200，且响应中的 `ok` 和 `db` 为 `true`；不要依赖本地 `userCount` 的具体数值。

## 环境变量和 Secrets

运行时配置包含以下三个 Secret：

- `CHAT_IP_HASH_SALT`：聊天室限流与禁言所用的 IP HMAC key。
- `ANALYTICS_IP_HASH_SALT`：分析事件所用的 IP HMAC key。
- `OWNER_ADMIN_EMAILS`：需要保持管理员角色的站长邮箱列表，可用逗号、分号或空白分隔。

两者必须分别生成，UTF-8 长度至少 32 字节；不得互相复用，也不得写进代码、README、`.env.example`、命令历史或 Git。缺少、过短或两者相同时，API router 会在任何 API 业务 D1 访问前返回通用 503，并且只记录变量名称。

`OWNER_ADMIN_EMAILS` 只从请求运行时 `env` 读取并规范化，用于把匹配账号保持为 `users.role = admin` 以及阻止后台降级，不是登录或鉴权 bypass。缺失或为空时不会回退公开源码、不会自动提升账号，也不会触发上述 503；数据库现有角色、当前登录管理员不可自降级和最后管理员原子保护仍然有效。

纯本地开发只使用被忽略的 `.dev.vars`。GPTWork 使用平台注入的 process environment，不创建 `.dev.vars`。两种方式都不要创建或提交 `.env`、`.dev.vars.*` 或 `.env.*`。

## Cloudflare Preview 和 Production

在 Cloudflare Dashboard 的 Pages 项目 `lusu-personal-site` 中，分别检查 Preview 与 Production：

1. D1 binding 名称为 `DB`，指向获准使用的 D1 数据库。
2. 以加密 Secret 方式配置 `CHAT_IP_HASH_SALT`。
3. 以加密 Secret 方式配置 `ANALYTICS_IP_HASH_SALT`。
4. 以加密 Secret 方式配置 `OWNER_ADMIN_EMAILS`，并确认邮箱列表属于当前环境。
5. 在部署使用这些变量的提交之前完成配置。

只有获授权的运维人员才可远程修改 Secret。Wrangler 的交互式命令如下；它会修改 Cloudflare 远程状态，本地或 GPTWork 验证流程不得自动执行：

```powershell
npx.cmd wrangler pages secret put CHAT_IP_HASH_SALT --project-name lusu-personal-site
npx.cmd wrangler pages secret put ANALYTICS_IP_HASH_SALT --project-name lusu-personal-site
npx.cmd wrangler pages secret put OWNER_ADMIN_EMAILS --project-name lusu-personal-site
```

需要区分 Preview 与 Production 时，优先在 Dashboard 中明确选择环境并逐项核对，避免把值写到错误环境。

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

## 发布方式

正式发布链路固定为：GitHub Pull Request 审查并合并到 `main`，随后由 Cloudflare Pages Git 集成自动部署。`npm run deploy` 只输出提示，不执行手工发布；不要把 `wrangler pages deploy` 当成常规发布步骤。

## IP 哈希升级兼容性

当前实现使用带用途域隔离的 HMAC-SHA256。聊天消息和网络来源禁言同时保存由 Secret 自动派生的非敏感密钥代次；首次从旧固定盐切换或以后轮换 Secret 时，旧记录会被明确标记为旧代次。后台不会再从旧消息创建表面成功但无法匹配的禁言，旧禁言显示“密钥已轮换”；只有新代次消息能用于重新建立网络来源禁言。用户标识禁言不受影响，分析历史仍会形成新旧两个时期。不要恢复公开 fallback，也不要为了兼容把旧 Secret 写入仓库。

`cloudflare/schema.sql` 定义表和 seed，`cloudflare/schema-indexes.sql` 定义依赖新增列的代次索引。`npm run d1:migrate:local` 与获授权后人工运行的 `npm run d1:migrate:remote` 都会先执行基础 schema，再检查旧表、补齐缺失列，最后创建并核验索引；已有云端 D1 的 `ensureChatSchema()` 仍在聊天 / 后台聊天接口查询前提供同顺序的运行时兜底。不要删除运行时 schema guard，也不要把依赖新列的索引提前放进静态 schema 的旧表执行路径。

## 可选外部服务

后台视频链接预览、首次保存和刷新元数据会访问 YouTube / Bilibili；网络受限时这些操作可能降级或失败，但不阻塞 `npm test`、`npm run build`、`/api/health` 或普通站点启动。日语训练器离线语音再生成另需 Python、Kokoro、ffmpeg、模型和参考声线，它们不属于普通云端开发依赖。
