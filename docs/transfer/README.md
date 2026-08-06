# 临时互传维护与部署

**当前子项目版本：1.0.4**

本目录是临时互传的治理根：`VERSION` / `project.json` 保存独立版本，`CHANGELOG.md` 保存子项目更新，`AGENTS.md` 约束分布在主站、Pages Functions、后台和清理 Worker 中的实现，`AGENT.md` 仅作兼容入口。任何互传更改都必须把该版本精确增加 `0.0.1`，并同步本目录全部受影响文档和根项目记录。

## 当前边界

- 入口位于主站“工具区 / Tools / ツール”（内部 route 仍为 `resources`），不是新的顶层 route 或 Dock App。
- 浏览器界面继续复用现有 `lusu_session` HttpOnly 会话；本地 CLI 与 stdio MCP 通过设备码授权取得有期限、可撤销、最小权限的 Agent Bearer。管理员仍仅由 Cookie 会话中的 D1 `users.role = 'admin'` 判断，Agent Bearer 不得进入 `/api/admin/*`，即使授权账号本身是管理员也按普通用户能力执行。
- 房间口令在浏览器规范化并派生 `roomKey` 与文字 AES-GCM key，明文口令不进入 API、D1、R2、日志或埋点。
- 文字是客户端加密；文件不是端到端加密。文件依赖 HTTPS、私有 R2、随机对象键、登录/房间鉴权、24 小时过期和危险类型强制下载。
- 第一版没有病毒扫描，UI 必须继续提示只下载可信来源文件。
- 普通账号单文件默认 95 MiB；95 MiB 是为了低于 Cloudflare Free/Pro 账户 100 MB 请求体上限。管理员更大文件必须走 Multipart Upload。
- 管理员“不限频次”只是不受普通用户业务频次与免费池暂停影响；客户端使用有界队列，桌面最多同时处理 2 个文件任务、手机最多 1 个任务，单任务分片并发分别最多 4 / 2，且继续受 R2、浏览器、网络和账户账单边界约束。

## Agent、CLI 与 stdio MCP

- `npm.cmd run lusu -- auth login` 启动设备码授权：CLI 只展示一次性用户码并打开站内确认页，登录用户明确批准请求的 scope 后才签发 Bearer。`auth status` 查看当前授权，`auth logout` 撤销当前令牌；浏览器也可在 `/api/agent-auth/tokens/manage` 查看和撤销本人令牌。
- CLI 已提供 `transfer join / ls / send / put / get / rm`；本地 stdio MCP 已提供对应的加入、列表、文字发送、上传、下载与删除工具。它们复用同一互传 API、24 小时过期、配额、幂等与对象清理语义，不创建第二套房间或存储协议。
- 共享 CLI／stdio MCP 能力面同时提供公开内容目录，以及经独立 scope 授权的日语学习进度读取与服务端判分答题。设备码轮询可从短暂网络失败中有界恢复；这些能力不需要也不会复用 Transfer 房间口令。Quick Transfer 因共享受管入口发生变化升至 1.0.4，但业务协议、安全边界与生命周期保持不变。
- 设备登录保存的 Agent credential 只绑定签发时的 HTTP(S) origin；通过 `--base-url`、`LUSU_BASE_URL` 或 MCP 配置切到 Preview／其他 origin 时不会把原 Bearer 发过去，也不会在跨 origin logout 中删除它。当前覆盖 origin 只能使用操作者显式提供的 stdin／环境 token 或重新完成设备登录。
- 房间口令只从 CLI 的隐藏输入或 `--password-stdin` 读取，禁止作为命令行参数；stdio MCP 只接受 `env:NAME` 形式的 `secretRef`。授权服务既不会接收房间口令，也不会接收派生后的 `roomKey`。互传业务 API 仍按原协议接收派生 `roomKey`，本地房间状态只保存 `roomKey` 与可选环境变量引用，不保存明文口令或文字密钥。
- `transfer:read` 用于配置、列表、上传状态和下载等 GET/HEAD；`transfer:write` 用于 `room/join`、发送文字、普通上传以及 Multipart 初始化、分片与完成；`transfer:delete` 用于删除条目和中止 Multipart。默认设备授权的互传权限只包含 read/write（另含公开内容所需的 `content:read`），删除能力必须明确追加。
- CLI 与 stdio MCP 下载都默认拒绝覆盖已有文件；stdio MCP 的上传和下载还必须位于显式允许的目录根内。访问令牌、本地房间状态和环境变量都属于敏感本机数据，不得提交、打印到日志或传入 MCP 工具输出。当前远程 MCP 只开放公开只读内容能力，未开放远程互传，也未执行生产部署。

## 本地要求

1. 建议 Node.js `22.13+`，`package.json` 已声明 `>=22.13.0`。
2. 执行 `npm install`。
3. 把 `docs/transfer/dev-vars.example` 的变量名复制到仓库根目录 `.dev.vars`，只填写本地独立值。
4. 本地 secret / webhook token 必须重新生成，不得复用 Preview 或 Production 值。
5. `.dev.vars`、`.env`、`.env.*`、真实邮箱、真实 webhook URL 与任何密钥不得提交 GitHub；这些路径已加入 `.gitignore`。
6. 执行 `npm.cmd run d1:migrate:local`。
7. 开发临时互传 API 时执行 `npm.cmd run transfer:dev`。该命令通过 `--r2 TRANSFER_BUCKET` 提供本地 R2 模拟绑定，不需要 Production R2 密钥；其他页面仍可使用现有 `npm.cmd run dev`。
8. 图标源图变化时执行 `npm.cmd run build:transfer-icons`；再执行 `npm.cmd run transfer:test` 与 `npm.cmd run build`。
9. 验证本地 Agent 入口时执行 `npm.cmd run lusu -- --help` 与 `npm.cmd run mcp:local`；stdio MCP 由宿主进程管理标准输入输出，不要把令牌、口令或 `secretRef` 对应值写进仓库配置。

不要把 Production R2 Access Key 放入前端或 `.dev.vars`。Pages Functions 和清理 Worker都通过绑定访问 R2，不需要浏览器持有永久 R2 密钥。

## Cloudflare 人工配置

仓库代码不能替站长完成以下 Dashboard 操作。完成前不得宣称文件功能已经上线。

### 1. 创建私有 R2 桶

- Production（必须）：`lusu-temp-transfer`
- Preview（可选，启用预览文件上传前再创建）：`lusu-temp-transfer-preview`
- Storage class：Standard
- 不启用公开 `r2.dev` URL，不绑定公共自定义域名。
- 本功能通过同源 Pages Functions 下载，不需要跨域浏览器直传，因此默认不需要 R2 CORS。

### 2. Pages 绑定

根 `wrangler.jsonc` 已在顶层声明 Production R2 binding，并通过 `env.preview.r2_buckets: []` 让 Preview 文件上传安全关闭。Git 部署必须保留以下状态：

```text
Variable name: TRANSFER_BUCKET
Production bucket: lusu-temp-transfer
Preview: no R2 binding (r2Ready: false)
```

`preview_bucket_name` 只用于 Wrangler 本地/远程开发，不能替代 Pages Preview deployment 的 `env.preview`。由于 D1 与 R2 binding 不是 Pages 环境自动继承项，`env.preview` 必须完整重述它们。Secret 的实际值继续在 Cloudflare 的 Production / Preview 环境分别管理，所需变量名由 `.env.example` 的空声明和运行时校验维护；根 Pages 配置不得加入不受支持的顶层 `secrets` 元数据。

Production 桶必须先在同一 Cloudflare 账户中创建。若 Pages 项目曾在 Dashboard 保存过旧绑定，确认变量名与桶名和根 `wrangler.jsonc` 一致，并在改动后重新部署；Production 上线验收要求 `/api/transfer/config` 的登录响应中 `r2Ready: true`。

以后启用 Preview 文件上传时，先创建独立的 `lusu-temp-transfer-preview`，再把 `env.preview.r2_buckets` 改为该桶并同步构建守卫；不得让 Preview 继承或指向 Production 桶。

### 3. D1 migration

在启用入口前先对现有 `lusu_personal_site` 执行增量 schema：

```powershell
npm.cmd run d1:migrate:remote
```

`cloudflare/schema.sql` 使用 `create table if not exists`、`create index if not exists` 与 `on conflict do nothing`，不得通过删除线上 D1 重建。

### 4. 独立清理 Worker

Pages Functions 没有 `scheduled()` Cron 入口，因此小时清理位于 `workers/transfer-cleanup/`。在 Cloudflare Workers Builds 中把同一 GitHub 仓库连接到独立 Worker，工作目录保持仓库根目录，并使用：

```text
Deploy command: npx wrangler deploy --config workers/transfer-cleanup/wrangler.jsonc
```

确认 Worker 的 `DB` 与 `TRANSFER_BUCKET` 绑定指向与 Production Pages 相同的 D1 和 R2。Cron `17 * * * *` 每小时执行；每周日 UTC 03:17 额外核对 48 小时以上的孤立对象。

主站正式发布链路仍是 `GitHub main -> Cloudflare Pages Git 自动部署`；独立清理 Worker 不能替代或改写 Pages 发布。

### 5. R2 生命周期兜底

在 Production 桶以及任何已启用的独立 Preview 桶中增加前缀 `transfer/` 的生命周期规则：

- 完成对象：2 天后删除，作为应用 24 小时逻辑过期与小时清理的兜底。
- 未完成 Multipart Upload：1 天后中止。

R2 生命周期通常在到期后的 24 小时内完成物理删除，因此列表和下载始终以 D1 `expires_at` 为准，不能只依赖生命周期。

### 6. 费用报警

Cloudflare 官方预算提醒是人工配置：

1. Dashboard 打开 Manage Account / Billing / Billable Usage。
2. 选择 Create budget alert。
3. 分别创建 USD 1、USD 3、USD 5 阈值。
4. 通知发送到 Cloudflare 账户中已验证的站长邮箱。
5. 保存后记录配置结果，但不要把邮箱或账单截图提交公开仓库。

官方提醒按账户实际用量和每日预测工作。站内 `/admin/transfer.html` 只用 D1 元数据估算 Standard R2 的 10 GB-month、100 万 Class A、1000 万 Class B 免费额度及超额费用，不能替代官方账单。

可选站内通知变量：

- `TRANSFER_ALERT_WEBHOOK_URL`
- `TRANSFER_ALERT_EMAIL`
- `TRANSFER_ALERT_THRESHOLDS=1,3,5`

未配置 webhook 时，后台仍保存站内告警并明确显示“邮件/Webhook 报警尚未配置”。

## API 与数据

用户 API：`/api/transfer/*`；后台 API：`/api/admin/transfer/*`。实现集中于 `functions/api/transfer-service.mjs`，由现有 `functions/api/[[route]].js` 调度。

D1 表：

- `transfer_rooms`
- `transfer_items`
- `transfer_upload_sessions`
- `transfer_upload_parts`
- `transfer_usage_daily`
- `transfer_storage_daily`
- `transfer_usage_monthly`
- `transfer_settings`
- `transfer_alerts`
- `transfer_cleanup_runs`
- `transfer_audit_log`

普通用户默认值：95 MiB/文件、300 MiB/滚动 24 小时、30 文件/日、3 次初始化/分钟、1 个并发上传、1 GiB/房间、100 项/房间、8 GiB 全站普通池。Class A / B 与存储预算分别保留到免费额度约 70% / 70% / 80%。

## 验证

- `npm.cmd run transfer:test`：内存 D1 与模拟 R2，覆盖浏览器会话、Agent Bearer scope、普通账号限制、管理员角色、1 GiB 完整分片、5 GiB 分片规划、Range 和 schema。
- Agent 定向测试：`node --test tests/agent-auth.test.mjs tests/transfer-capability-crypto.test.mjs tests/site-capabilities-client.test.mjs tests/lusu-cli.test.mjs tests/local-mcp-server.test.mjs`，覆盖设备码、令牌撤销、口令本地派生、CLI/MCP 秘密边界与文件路径保护。
- `/api/transfer/config`：确认 `r2Ready: true`，且普通/管理员配置与角色相符。
- 普通账号：小文件上传、配额拒绝、24 小时剩余、删除。
- 管理员：1 GiB 以上分片、暂停/恢复/取消、刷新后重选同文件续传。
- 下载：未登录拒绝、过期拒绝、视频 seek 返回 206 和正确 `Content-Range`。
- 清理：在 `/admin/transfer.html` 手动运行，确认 `transfer_cleanup_runs` 与 R2 对象数量变化。
- 工具区：桌面与手机都确认临时互传和日语学习卡片使用相同网格宽度与卡片节奏；zh/en/ja 的标题、元信息、说明和 CTA 不相交、不裁剪。
- 图标与返回状态：生产图集必须为 168×168 RGBA，16 格四角透明且没有洋红方块；执行 `npm.cmd run audit:resources-layout`，以 zh/en/ja 和 359×500、375×667、390×844、760×900、844×390、1280×720 确认 Tools（`resources`）→ 登录任务 → 返回 Tools 恢复原分类栏/列表状态与几何，当前受控矩阵为 58 / 58。
- 未登录手机入口：从非 Home 的 Tools App（内部 `resources` route）直接打开临时互传，登录操作必须可见且可用，不能依赖被 `.topbar-actions` 隐藏的账号按钮。
- 移动端：359x500、375x667、390x844、430x932、844x390，zh/en/ja，使用文字消息、大图消息与文件卡组合检查输入框、任务操作、视频比例、无横向溢出和 44px 触控；竖屏发送、选择照片和选择文件按钮与任一图片/文件卡的二维交集必须为零，横屏保持原有左右双栏且互不相交。短屏与横屏必须能滚动到输入区，软键盘打开时聚焦控件保持在 `visualViewport` 内。
- 滚动边界：不要用嵌套滚动或 `overscroll-behavior` 把输入区锁在页面底部之外；竖屏 `.transfer-room` 使用纵向 Flex 作为唯一滚动路径，toolbar/feed/composer/tasks 直接子项不可收缩，短横屏显式恢复双栏 Grid，登录、发送与上传任务必须始终存在可到达路径。

## 故障与回滚

1. 首先在 `/admin/transfer.html` 暂停普通上传；严重问题时暂停全部上传。
2. 保留下载与清理 Worker，让已完成对象按 24 小时规则退出。
3. 回滚主站 Git 提交，由 Pages Git 自动部署旧版本；不要手工覆盖 Pages 生产产物。
4. 不要立即删除 R2 桶、D1 表或清理 Worker，否则已发布对象可能无法按期删除。
5. 确认所有对象和未完成分片已清理后，才可解除绑定或删除桶。
6. 如果 D1 与 R2 不一致，先保持上传关闭，运行带 reconciliation 的手动清理并检查审计；不要通过全量 list 作为每次请求的实时统计。

## 官方参考

- [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [R2 object and multipart limits](https://developers.cloudflare.com/r2/platform/limits/)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [R2 lifecycle rules](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
