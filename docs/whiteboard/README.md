# 在线画板架构与运维

**当前子项目版本：1.0.1**

本目录是在线画板的治理根：`VERSION` / `project.json` 保存独立版本，`CHANGELOG.md` 保存子项目更新，`AGENTS.md` 约束维护流程，`AGENT.md` 仅作兼容入口。任何画板更改都必须把该版本精确增加 `0.0.1`，并同步本目录全部受影响文档和根项目记录。

在线画板是鲁肃个人站**工具区**中的独立工具页：`/tools/whiteboard/`。它不新增或恢复“资源区”页面、入口、路由或分类；主站内部继续保留 `resources` 兼容键，用户可见文字统一为“工具区 / Tools / ツール”。

## 架构

浏览器中的 Excalidraw 与 Yjs 只和同源 Pages Functions 建立房间会话。Pages Functions 负责统一匿名身份、密码 HMAC、短期票据、Origin 校验与入口限频，再把已验证的 WebSocket 转交对应的 `WhiteboardRoom` Durable Object。Durable Object 是单房间权威状态，使用自身 SQLite 保存快照与增量，使用私有 R2 保存该房间图片，并把低频房间摘要、封禁与审计写入 D1。

- Excalidraw 提供选择、自由画笔、直线、箭头、矩形、椭圆、文本、颜色、线宽、多选、复制粘贴、缩放平移、撤销重做、图片和导出基础能力。
- 新建元素默认使用暖白纸张背景、石墨色线条、高 roughness、hachure 填充和轻微透明度，作为可继续调整的铅笔草图默认风格。
- Yjs 文档把画布元素按 element ID 保存为独立 CRDT 记录，保留 `isDeleted`、`version`、`versionNonce` 和层级顺序。客户端只发送 Yjs 增量，不上传完整画布覆盖服务端。
- 每个房间对应一个 `WhiteboardRoom` Durable Object。房间之间没有共享文档、票据、连接或 R2 路径。
- 鼠标、名字标签、选区、绘制、焦点和暂离状态只通过 WebSocket 广播，不写 D1、DO SQLite 或 R2。
- Durable Object 使用 WebSocket Hibernation API；连接附件只保存恢复连接所需的小型元数据，画布始终可从持久化快照和增量重建。

## 统一匿名身份

`GET /api/anonymous-identity` 建立或读取全站匿名身份。HttpOnly、Secure、SameSite=Lax 的 `lusu_anonymous` Cookie 只保存高熵凭证，D1 仅保存凭证 SHA-256，不保存原文。

每条身份记录包含：

- 永久不复用的内部 `anonymous_id`
- 安全词根组合产生的临时名字
- 受控颜色
- 创建时间
- 身份版本
- 改名冷却和短期次数

词库笛卡尔积超过一万种，并排除容易冒充权限的词。浏览器不能读取内部 ID 或凭证；聊天室和画板都从同一接口取得公开名字、颜色和版本。改名后，页面只通过 BroadcastChannel 或 storage 发送不含名字、颜色、匿名 ID 和凭证的版本变化信号；其他标签页随即使用共享 HttpOnly Cookie 重新向服务端读取权威身份，重新可见时也会刷新。登录账号进入匿名互动功能时仍使用这套匿名身份，不暴露账号名称。

旧 `lusu_visitor` 只在首次建立新身份时作为同浏览器迁移线索，不再被当作可验证凭证。临时互传当前不公开匿名身份；未来如展示身份，必须使用同一服务。

改名通过 `POST /api/anonymous-identity/name/rotate` 完成。服务端执行约 30 秒冷却和短窗次数限制；画板重新建立房间会话，由 Durable Object 在当前在线成员集合中原子查重并广播。

## 房间访问

公共画板的内部名称固定为 `public-v1`。密码房密码只出现在同源 HTTPS `POST /api/whiteboard/rooms/join` 的 JSON 请求体中：

1. 服务端对密码执行 Unicode NFKC 和首尾空格规范化。
2. 校验长度与 IP 哈希尝试频率。
3. 使用 `HMAC-SHA256(WHITEBOARD_ROOM_HMAC_SECRET, domain + password)` 生成稳定、不可逆的房间标识。
4. 返回短期 WebSocket 票据和较长期房间访问票据，不返回内部 `roomId`。

密码、房间 HMAC 输入和画布内容不进入 URL、LocalStorage、History、埋点或日志。最近房间只在本地保存“公共/密码房”和最近使用时间，重新进入密码房仍需输入密码。

WebSocket 票据通过 `Sec-WebSocket-Protocol` 发送，不放入查询参数。Pages Functions 验证票据、精确 Origin、身份和 IP 哈希后，通过 external Durable Object binding 转发；公开响应只协商固定协议 `whiteboard.v1`。

## 保存、增量与资源

Durable Object SQLite 保存：

- 房间元数据与 epoch
- 压缩 Yjs 文档快照
- 有界增量更新
- 已消费的短期票据
- 房间资源清单

达到更新数量或字节阈值时合并为新快照并删除已合并增量。D1 只保存跨房间管理所需的低频摘要，不保存每个鼠标事件或完整画布。

客户端会合并快速连续绘制产生的 Yjs update，并按 Worker 随文档大小下发的间隔逐个发送。Worker 只在增量与文档版本已持久化后返回 `update-accepted`；客户端在收到回执前保留原更新，限流、断线或回执丢失时重连重传，不再把未落盘线条当作已完成。显式退出会给未确认更新一个有界的排空时间。

图片上传支持文件选择、手机相册、拖拽和剪贴板。浏览器在 Excalidraw 读取前只放行 PNG、JPEG 和 WebP；HEIC/HEIF、SVG、GIF、AVIF、BMP、空 MIME 及其他未支持格式直接拒绝。服务端再校验 magic bytes、文件大小、尺寸、像素数、频率和房间容量。R2 key 使用 `whiteboard/v1/<opaque-room>/<asset-id>`，画布只保存资源 ID。读取必须携带当前房间访问票据，不能跨房间获取资源。

工具区入口图标 `assets/images/generated-icons/whiteboard.png` 由 image2 生成并保存为项目内 192×192 RGBA PNG。`assets/images/generated-icons/whiteboard.source.json` 记录 image2、256×256 生成输出、192×192 发布输出、最终 SHA-256，以及唯一的 nearest-neighbor 机械 resize；守卫测试会同时核对 manifest、真实图片元数据与字节哈希。在线画板新增或替换图标、插画、装饰等素材时只能使用 image2；不得用 CSS、Canvas、SVG 路径或代码几何拼凑素材。布局、交互状态和响应式适配仍由 CSS 完成。

## 24 小时生命周期

公共画板的线条、已引用图片和快照永不按空房 TTL 删除，只有管理员显式清空才会删除。密码房采用以下规则：

1. 有真实连接时清空 `emptySince` 和 `deleteAt`。
2. 最后一个连接关闭或被心跳超时回收时，记录 `emptySince`，并设置 `deleteAt = emptySince + 24h`。
3. Durable Object Alarm 安排清理；Alarm 是至少一次执行，因此所有步骤都必须幂等。
4. 24 小时内重新加入会取消旧删除计划。
5. 再次变空时使用新的最后离开时间重新计算。
6. Alarm 触发后再次检查房间类型、真实连接、持久化截止时间和清理代次。
7. 到期后按可重试顺序删除房间 R2 前缀、资源元数据、快照、增量和房间摘要。
8. R2 或 D1 清理失败会保留 DO 删除状态与重试计数，并按退避重新安排 Alarm；重复 Alarm 不会误删已重新活跃的房间。

客户端每 25 秒发送心跳。服务端定期回收长时间无心跳的异常连接；页面刷新、浏览器崩溃、断网、手机切后台、网络切换和多标签都不依赖 `beforeunload`。

## 限制与滥用控制

默认限制由 Worker 常量集中维护，生产变更需同步测试与文档。Pages 对同一 IP 哈希的图片代理额外限制为每分钟 20 次、每小时 200 次、每分钟 50 MiB、每小时 250 MiB；Worker 再执行每身份每分钟 10 次、每 IP 每分钟 20 次和单房 100 张／100 MiB 的限制。实时连接为每房 64、每身份 4、每 IP 哈希 8；每 IP 每分钟最多 4 次完整／差异同步及 32 MiB 同步响应，文档上限 15 MiB，Yjs 更新按文档体积降为每秒 24／6／2 次。

- 单房连接数和同匿名身份连接数
- IP 哈希入房尝试、WebSocket 建连和图片上传频率
- 每用户消息频率、游标频率和突发量
- 单消息和 Yjs 增量字节数
- 单房对象数量、文档大小、资源数量与资源总字节
- 单图大小、宽高与总像素
- Origin、票据、匿名凭证和 internal secret 校验

完整 IP、设备、城市、密码、匿名凭证、房间标识、图片原文件名和画布内容不得进入公开 UI、埋点或普通日志。

## 管理后台

`/admin/` 的“在线画板”面板沿用现有管理员会话，可执行：

- 查看房间、连接、对象、文档和资源容量摘要
- 查看有错误记录的房间、去重错误计数和自动清理房间累计数
- 查看公共画板状态
- 清空公共画板
- 切换公共画板只读/可编辑
- 移除异常连接
- 按内部匿名 ID 或 IP 哈希临时封禁
- 删除异常密码房

后台不读取或展示画布正文、匿名凭证或完整 IP。`whiteboard_metrics` 只保存有界聚合计数；房间的 `last_error` 只保存短错误码，不保存异常正文、请求载荷或画布内容。清空、锁定、移除、封禁和删除均写入 `whiteboard_admin_audit`，只保存操作范围和非敏感摘要。

## Cloudflare 绑定和 Secret

Pages Production：

- `DB`：现有 D1
- `WHITEBOARD_ROOMS`：external Durable Object binding，class `WhiteboardRoom`，script `lusu-whiteboard-do`
- `WHITEBOARD_ROOM_HMAC_SECRET`：密码到房间标识
- `WHITEBOARD_TICKET_SECRET`：房间访问和短期 WebSocket 票据
- `WHITEBOARD_INTERNAL_SECRET`：Pages 到 Worker 的内部调用鉴权
- `WHITEBOARD_IP_HASH_SALT`：画板用途独立 IP HMAC

独立 Worker Production：

- `DB`：现有 D1
- `WHITEBOARD_BUCKET`：现有私有 R2 桶，使用独立 `whiteboard/v1/` 前缀
- `WHITEBOARD_INTERNAL_SECRET`：Pages 到 Worker 的内部调用鉴权

三个房间／票据／IP Secret 只由 Pages Functions 使用；独立 Worker 不接收密码，也不需要这些值。`WHITEBOARD_INTERNAL_SECRET` 是唯一在 Pages 与 Worker 两侧配置且值必须一致的画板 Secret。四个值均至少 32 UTF-8 bytes、用途独立，并在 Preview 与 Production 分别配置。仓库只提交名称和用途。

Preview Worker 必须使用独立的 `workers/whiteboard/wrangler.preview.jsonc`：脚本／DO namespace 为 `lusu-whiteboard-do-preview`，R2 为 `lusu-temp-transfer-preview`，不得绑定 Production R2。该文件是部署独立 Preview Worker 的配置，不表示 Pages Preview 已经可以引用它。根 `wrangler.jsonc` 的提交态 `env.preview` 固定为 `PREVIEW_API_DISABLED=true`、`d1_databases: []`、`r2_buckets: []`、`durable_objects.bindings: []`；不得出现 Production D1 ID／名称、Production R2 桶名，或引用尚未部署的 Preview Worker。只有独立 Preview D1 已创建并迁移、精确 Preview Origin、独立 Secret 与所需独立 R2 全部配置和验收，并先成功部署 Preview Worker 后，才可在经审查的 Pages Preview 配置中绑定独立资源并开启 API。Worker 的 `DB` 为可选跨房管理索引，因此仓库中的 Preview Worker 配置有意不绑定 Production D1。

## 部署与迁移顺序

1. `npm ci`
2. `npm run d1:migrate:local`
3. `npm run lint`
4. `npm run typecheck`
5. `npm test`
6. `npm run whiteboard:test`
7. `npm run build`
8. `npm run build:production:verify`
9. Preview 默认保持 `PREVIEW_API_DISABLED=true` 且 D1/R2/DO 空绑定；如本次获准启用 Preview，先创建并迁移独立 Preview D1，再部署 `lusu-whiteboard-do-preview`，核对独立 Secret、R2／DO namespace 与精确 Preview Origin，最后才把 Pages Preview binding 接入该 Worker。
10. 执行并核验获授权的 Production `npm run d1:migrate:remote`；这一步必须先于读取新表的 Production Worker 与 Pages 部署。
    - Production D1 单条复合 `SELECT` 最多 5 项；迁移器会在远端写入前检查分组校验项数。新增校验时必须拆分超限的 `UNION ALL`，并以真实 D1 回读为准。
11. 部署 `lusu-whiteboard-do` Worker 及 SQLite Durable Object migration。
12. 在 Pages Production 核对 external DO binding；Preview 只有完成第 9 步全部隔离条件后才可开启并核对 binding。
13. 合并 PR，由 `main` 触发 Pages Git 部署。
14. 验证正式域名、后台、聊天室、工具区、互传和登录。

Cloudflare Pages Dashboard 固定使用框架 `None`、Build command `npm run build`、Build output directory `dist`、Root directory `/`。标准构建会先执行仓库守卫，再把画板入口中的占位脚本／样式改写为内容哈希 bundle 并原子生成 `dist/`；不得把仓库根目录直接作为 Pages 静态输出。

Pages 项目不能创建 Durable Object，独立 Worker 必须先部署。不要在 DO namespace 尚不存在时先合并 Pages binding。

## 回滚

应用回滚顺序固定为：

1. 先阻止新画板连接，并用上一条已验证的 Git 提交回滚 Pages 入口或 external binding。
2. 再部署与现有 room epoch、快照和 Alarm 兼容的上一版 Worker；现有房间可在兼容 Worker 上继续运行或自然到期。
3. 保留 SQLite Durable Object namespace、`v1` migration、D1 新表、room epoch、快照、Alarm 与 R2 数据；不得通过删除 binding、namespace 或数据完成回滚。
4. Secret 轮换采用新增值后重新部署，不把旧值写进仓库或日志；只有经授权并确认无引用后才执行数据清理。

## 验收测试

本地单元和 Workers Vitest 覆盖：房间 HMAC、票据、Origin、跨房隔离、Yjs 增量、持久化恢复、名字查重、限频、图片校验、公共锁定/清空、最后离开、重入取消、重复 Alarm，以及 D1 清理故障后的状态保留与恢复重试。

启用并完成隔离配置后的 Preview 与正式环境还必须使用至少两个独立浏览器上下文，覆盖公共房、同/异密码房、并发修改、断线重连、多标签、PNG/SVG 导出、图片四种输入路径、iPhone/Android 竖横屏、软键盘、后台恢复和 Wi-Fi/移动网络切换。测试账号名称、密码和画布内容不得写入日志或截图元数据。

## 开源依赖

Excalidraw、Yjs、y-protocols 和 lib0 使用 MIT 许可证。构建产物保留必要的许可证归属；依赖版本、项目链接和官方许可证链接见 `tools/whiteboard/THIRD_PARTY_NOTICES.md`。本项目不依赖 excalidraw.com 托管协作服务。
