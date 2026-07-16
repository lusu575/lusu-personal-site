# 临时互传维护与部署

## 当前边界

- 入口位于主站“资源区”，不是新的顶层 route 或 Dock App。
- 所有用户接口复用现有 `lusu_session` HttpOnly 会话；管理员仅由 D1 `users.role = 'admin'` 判断。
- 房间口令在浏览器规范化并派生 `roomKey` 与文字 AES-GCM key，明文口令不进入 API、D1、R2、日志或埋点。
- 文字是客户端加密；文件不是端到端加密。文件依赖 HTTPS、私有 R2、随机对象键、登录/房间鉴权、24 小时过期和危险类型强制下载。
- 第一版没有病毒扫描，UI 必须继续提示只下载可信来源文件。
- 普通账号单文件默认 95 MiB；95 MiB 是为了低于 Cloudflare Free/Pro 账户 100 MB 请求体上限。管理员更大文件必须走 Multipart Upload。
- 管理员“不限频次”只是不受普通用户业务频次与免费池暂停影响；客户端使用有界队列，桌面最多同时处理 2 个文件任务、手机最多 1 个任务，单任务分片并发分别最多 4 / 2，且继续受 R2、浏览器、网络和账户账单边界约束。

## 本地要求

1. 建议 Node.js `22.13+`，`package.json` 已声明 `>=22.13.0`。
2. 执行 `npm install`。
3. 把 `docs/transfer/dev-vars.example` 的变量名复制到仓库根目录 `.dev.vars`，只填写本地独立值。
4. 本地 secret / webhook token 必须重新生成，不得复用 Preview 或 Production 值。
5. `.dev.vars`、`.env`、`.env.*`、真实邮箱、真实 webhook URL 与任何密钥不得提交 GitHub；这些路径已加入 `.gitignore`。
6. 执行 `npm.cmd run d1:migrate:local`。
7. 开发临时互传 API 时执行 `npm.cmd run transfer:dev`。该命令通过 `--r2 TRANSFER_BUCKET` 提供本地 R2 模拟绑定，不需要 Production R2 密钥；其他页面仍可使用现有 `npm.cmd run dev`。
8. 执行 `npm.cmd run transfer:test` 与 `npm.cmd run build`。

不要把 Production R2 Access Key 放入前端或 `.dev.vars`。Pages Functions 和清理 Worker都通过绑定访问 R2，不需要浏览器持有永久 R2 密钥。

## Cloudflare 人工配置

仓库代码不能替站长完成以下 Dashboard 操作。完成前不得宣称文件功能已经上线。

### 1. 创建私有 R2 桶

- Production：`lusu-temp-transfer`
- Preview：`lusu-temp-transfer-preview`
- Storage class：Standard
- 不启用公开 `r2.dev` URL，不绑定公共自定义域名。
- 本功能通过同源 Pages Functions 下载，不需要跨域浏览器直传，因此默认不需要 R2 CORS。

### 2. Pages 绑定

在 Cloudflare Pages 项目 Settings / Bindings 中，为 Production 与 Preview 分别增加 R2 binding：

```text
Variable name: TRANSFER_BUCKET
Production bucket: lusu-temp-transfer
Preview bucket: lusu-temp-transfer-preview
```

根 `wrangler.jsonc` 不预先声明尚未创建的线上桶，避免首次推送 `main` 时因不存在的资源让 Pages 全站部署失败；Production / Preview 必须在 Dashboard 创建桶后分别绑定并验证。

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

在两个桶中增加前缀 `transfer/` 的生命周期规则：

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

- `npm.cmd run transfer:test`：内存 D1 与模拟 R2，覆盖登录、普通账号限制、管理员角色、1 GiB 完整分片、5 GiB 分片规划、Range 和 schema。
- `/api/transfer/config`：确认 `r2Ready: true`，且普通/管理员配置与角色相符。
- 普通账号：小文件上传、配额拒绝、24 小时剩余、删除。
- 管理员：1 GiB 以上分片、暂停/恢复/取消、刷新后重选同文件续传。
- 下载：未登录拒绝、过期拒绝、视频 seek 返回 206 和正确 `Content-Range`。
- 清理：在 `/admin/transfer.html` 手动运行，确认 `transfer_cleanup_runs` 与 R2 对象数量变化。
- 资源区：桌面与手机都确认临时互传和日语学习卡片使用相同网格宽度与卡片节奏；zh/en/ja 的标题、元信息、说明和 CTA 不相交、不裁剪。
- 未登录手机入口：从非 Home 的 Resources App 直接打开临时互传，登录操作必须可见且可用，不能依赖被 `.topbar-actions` 隐藏的账号按钮。
- 移动端：359x500、375x667、390x844、844x390，zh/en/ja，检查输入框、任务操作、视频比例、无横向溢出和 44px 触控；短屏与横屏必须能滚动到输入区，软键盘打开时聚焦控件保持在 `visualViewport` 内。
- 滚动边界：不要用嵌套滚动或 `overscroll-behavior` 把输入区锁在页面底部之外；消息流可滚动，但登录、发送与上传任务必须始终存在可到达路径。

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
