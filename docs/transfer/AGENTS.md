# 临时互传子项目维护规则

本目录是“临时互传 / Quick Transfer / 一時転送”子项目的治理根，当前版本见 `VERSION` 与 `project.json`。实现因 Pages Functions、主站懒加载与独立清理 Worker 的边界分布在多个目录，`project.json.trackedPaths` 是受治理范围。

## 开始前必读

1. 仓库根 `AGENTS.md`
2. 仓库根 `PROJECT_CONTEXT.md`
3. 仓库根 `skills/lusu-personal-site-skill/SKILL.md`
4. 本目录 `README.md`
5. 本目录 `CHANGELOG.md` 最新版本

涉及 `/admin/transfer.html` 时还必须读取三个后台专用文档。

## 版本与文档硬规则

- 任何互传代码、样式、图片、API、清理 Worker、测试、配置或文档变化，都必须把独立版本精确增加 `0.0.1`。
- 同一次改动必须同步：`VERSION`、`project.json.version`、本目录 `CHANGELOG.md`、本目录 `README.md` 的当前版本、公开界面版本号，以及受影响的安全/部署说明。
- 同时更新根 `CHANGELOG.md`。项目事实、行为或运维流程变化时更新根 `PROJECT_CONTEXT.md`；形成长期规则时同步根专用 Skill 及其 README。
- 公开可见变化继续遵守根项目三语 `site-updates`、四处 seed/fallback 与缓存 query 规则；纯后台私有变化只写后台日志，但仍写本子项目日志。
- `AGENT.md` 只指向本文件。长期规则变化时更新本文件，并核对根 `AGENTS.md` 的子项目索引。

## 安全与生命周期

- 浏览器用户接口继续使用 HttpOnly `lusu_session`。机器客户端只允许使用设备码授权签发的 scoped Agent Bearer；任何畸形 `Authorization` 都必须失败关闭，不能回退到 Cookie。管理员接口只接受 Cookie 会话并由 `users.role = admin` 判断，Agent Bearer 永远按普通用户处理且不得访问 `/api/admin/*`。
- Agent scope 固定按操作划分：GET/HEAD 使用 `transfer:read`；`room/join`、文字发送、普通上传和 Multipart 初始化/分片/完成使用 `transfer:write`；条目删除与 Multipart abort 使用 `transfer:delete`。新增路由时必须先归类 scope，不能让只读令牌进入 join 或修改流程。
- 房间明文口令不得离开浏览器或本地 CLI/MCP 进程。授权服务不得接收口令或派生 `roomKey`；互传业务 API 仍按既有协议接收派生 `roomKey`。CLI 禁止命令行口令，只可隐藏输入或 stdin；stdio MCP 只接受 `env:NAME` secret reference。本地状态不得保存明文口令或文字密钥。
- 文字使用浏览器或本地客户端 AES-GCM；文件只准确描述为 HTTPS + 私有 R2 + 服务端鉴权，不能宣称文件端到端加密或已做病毒扫描。
- 设备码、用户码与访问令牌必须限时、限频、哈希落库且支持本人撤销；令牌管理页复用 Cookie 会话和 CSRF，当前令牌撤销使用 Bearer 自撤销接口。令牌、口令、`secretRef` 对应值与完整本地凭据不得进入日志、埋点、截图元数据、MCP 输出或 Git。
- 列表和下载以 D1 `expires_at` 的发布完成后 24 小时逻辑过期为准。房间过期或后台删除后必须中止 Multipart 并物理删除 R2 对象、D1 条目、会话和房间，不保留备份或可重用的关闭墓碑；同一密码再进入时必须是新空房。部分失败时保持 `deleting` 和写入锁，由清理 Worker、后台或下次加入重试，不得伪报完成。
- 上传、Multipart、删除、CAS、幂等、Generation、队列背压和部分失败语义不得被 UI 改动绕过。密钥、Webhook、真实邮箱、文件内容和口令不得进入日志、埋点、截图元数据或 Git。

## 界面与验证

- 工具固定留在 Tools（内部 `resources` route）并按真实 CTA 懒加载；关闭后恢复打开前分类和列表几何。
- zh/en/ja 与 359×500、375×667、390×844、430×932、844×390、1280×720 都要检查登录、房间、消息、文件卡、任务、composer、版本标识和 44px 触控。
- 至少运行 `npm.cmd run transfer:test`、Agent/CLI/MCP 定向测试、`npm.cmd run lint`、`npm.cmd run build`、`npm.cmd run build:production:verify`、相关 UI 审计与 `git diff --check`。
- 正式发布仍由 GitHub `main` 触发 Pages；清理 Worker、R2 binding、生命周期和预算提醒必须按本目录 README 单独核验，未核验不得声称成功。
