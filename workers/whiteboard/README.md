# 在线画板 Durable Object Worker

`lusu-whiteboard-do` 是在线画板的房间权威服务。Cloudflare Pages Functions 负责同源 API、密码 HMAC、匿名凭证、Origin、管理员会话和访问票据校验；本 Worker 只接受带共享内部 Secret 的可信转发，并把每个 `roomId` 路由到独立的 `WhiteboardRoom`。

## 绑定与 Secret

Worker 配置见 `wrangler.jsonc`：

- `WHITEBOARD_ROOMS`：`WhiteboardRoom` Durable Object namespace。
- `WHITEBOARD_BUCKET`：复用现有私有 R2 bucket，仅使用 `whiteboard/v1/<roomId>/` 前缀。
- `DB`：D1 跨房间管理索引；DO storage 仍是单房间权威状态。
- `ALLOWED_ORIGINS`：Pages 已验证后传入的原始客户端 Origin 白名单。
- `WHITEBOARD_INTERNAL_SECRET`：Pages 与 Worker 共用、至少 32 字符的随机 Secret。只通过 Cloudflare Secret 配置，不能提交真实值。

首次部署前：

```bash
npx wrangler secret put WHITEBOARD_INTERNAL_SECRET --config workers/whiteboard/wrangler.jsonc
npx wrangler deploy --config workers/whiteboard/wrangler.jsonc
```

Pages 项目必须把 `WHITEBOARD_ROOMS` 绑定到脚本 `lusu-whiteboard-do` 的 `WhiteboardRoom`。Pages 与 Worker 的 `WHITEBOARD_INTERNAL_SECRET` 必须相同。该 Worker 的 `v1` migration 使用 SQLite-backed Durable Object；已创建 namespace 后不要删除或改写 migration tag。

隔离 Preview 使用独立的 `wrangler.preview.jsonc`，只绑定 `lusu-whiteboard-do-preview` 与 `lusu-temp-transfer-preview`，不回退 Production D1/R2：

```bash
npx wrangler secret put WHITEBOARD_INTERNAL_SECRET --config workers/whiteboard/wrangler.preview.jsonc
npx wrangler deploy --config workers/whiteboard/wrangler.preview.jsonc
```

Preview 的精确站点 Origin 和 Pages 独立 D1 仍需在部署前配置；未配置完成时保持 Preview API 关闭。

本地开发把 `.dev.vars.example` 复制为未追踪的 `.dev.vars`，再分别启动 Worker 与 Pages。Pages 本地 binding 指向 `WhiteboardRoom@lusu-whiteboard-do`。

## Pages → DO 内部合约

所有请求都必须包含：

- `x-whiteboard-internal-secret`
- `x-whiteboard-room-id`：公共房固定 `public-v1`；密码房固定为 `wb_` 加 43 字符 base64url HMAC 结果。
- `x-whiteboard-room-type`：`public` 或 `private`，必须与 room ID 类型一致。

用户请求还包含：

- `x-whiteboard-anonymous-id`
- `x-whiteboard-display-name-b64`：显示名 UTF-8 字节的无 padding base64url；禁止传非 ASCII header。DO 使用 fatal UTF-8 解码并再次执行长度、禁用词与冒充名称过滤。
- `x-whiteboard-identity-color`
- `x-whiteboard-identity-version`
- `x-whiteboard-ip-hash`
- `x-whiteboard-ticket-jti`
- `x-whiteboard-client-origin`

Pages 必须先验证服务端签名匿名身份、访问票据、Origin 与房间声明，不能把客户端提供的内部 header 原样透传。Worker 不接收密码，也不记录密码、身份值、画布正文或图片内容。

WebSocket ticket 的 `jti` 在 DO storage 中以 5 分钟过期时间原子消费。即使连接已关闭或 DO 被重新唤醒，同一 ticket 也不能在其 90 秒有效期内重放；Alarm 会删除过期记录，避免公共房无限累积。

### 路径

| 方法与路径 | 用途 | 附加要求 |
| --- | --- | --- |
| `GET /realtime` | WebSocket 升级 | `Upgrade: websocket`，subprotocol `whiteboard.v1`，完整身份 headers |
| `POST /assets` | 上传图片二进制 | 完整身份 headers；图片由 DO 按 magic bytes 和真实尺寸验证 |
| `GET /assets/:assetId` | 读取当前房间图片 | Pages 先验证当前房间 access token |
| `POST /identity` | 可选的在房身份刷新 | Pages 完成服务端身份换名后使用；第一版客户端也可通过重连刷新 |
| `POST /admin` | 房间管理 | `x-whiteboard-admin-authorized: 1` |
| `GET /status` | 直接读取状态 | `x-whiteboard-admin-authorized: 1`；Pages 当前也可用 `/admin` 的 `status` action |

`/admin` action：

- `{"action":"status"}`
- `{"action":"clear"}`
- `{"action":"set-lock","locked":true}`
- `{"action":"kick","connectionId":"..."}` 或按 `anonymousId`
- `{"action":"ban","kind":"anonymousId|ipHash","key":"...","durationSeconds":3600}`
- `{"action":"unban","kind":"anonymousId|ipHash","key":"..."}`
- `{"action":"delete-room"}`，仅允许无连接的密码房；公共房只能清空。

## WebSocket 协议

二进制帧首字节是消息类型：

- `0x00`：Yjs update，双向。加入时服务端立即发送当前完整 state update；之后持久化增量并广播。
- `0x01`：Yjs state vector，客户端发出后服务端以 `0x00` 返回差异。

客户端文本消息：

- `heartbeat`、`focus`
- `sync-request`
- `awareness`：世界坐标 cursor、短 selection 列表、drawing/focused/away。此类状态只广播，不写 DO storage 或 D1。

服务端文本消息：

- `ready`
- `participant-join`、`participant-update`、`participant-leave`
- `heartbeat-ack`
- `readonly`、`lock-state`
- `update-rejected`
- `document-cleared`
- 广播后的 `awareness`，只公开房间级 `presenceId`、显示名与颜色，不公开永久 `anonymousId` 或 IP hash。

同一匿名身份的多个标签页共用一个房间内名称和 `presenceId`；不同身份同名时，DO 在单线程房间内原子查重并附加短随机后缀。客户端不能通过 WebSocket 任意改名。

## 持久化与并发

- Yjs `elements` map 是对象级 CRDT；客户端不能以整张旧画布覆盖服务端。
- 每个 update 先在候选 Y.Doc 上校验对象数和完整文档大小，再写 `document:update:*`。
- update 与对应 `room:meta` 版本在同一个 storage transaction 提交；持久化失败时不会留下“有增量、无版本”或覆盖下一版本的半提交状态。
- 达到 64 个增量或 2 MiB 增量后写快照并删除已合并增量。Cloudflare SQLite-backed DO 的单个 key + value 上限是 2 MB，因此小快照继续保存在 `document:snapshot`，超过 1 MiB 时由该 key 保存 manifest、正文按 `document:snapshot:chunk:*` 分片；manifest、全部分片、元数据和旧增量删除在同一个 transaction 中提交。加载逻辑兼容上线前的单值快照。
- `YjsDocumentStore` 缓存当前完整编码大小。每个连接通常每秒最多 24 个 update；文档超过 5 MiB 时降为 6 个，超过 10 MiB 时降为 2 个，限制候选文档复制与重编码的 CPU 放大。
- 文档、房间元数据、禁用列表、图片元数据和 Alarm 存 DO storage。
- 鼠标、选区、绘制中、焦点和暂离状态仅在 WebSocket 广播。
- D1 `whiteboard_rooms` 与 `whiteboard_assets` 是 best-effort fleet index；DO 与 R2 是权威数据。索引失败不阻断房间写入，后台对账可清除孤立索引行。可治理故障只以短错误码写入房间 `last_error`，并用 `whiteboard_metrics` 累计去重错误和成功自动清理次数；不记录请求体或画布内容。
- 上传后给前端一小时把 asset ID 写入 Yjs `assets` map；Alarm 会删除超过该安全宽限期仍未被引用的 R2 对象、DO image metadata 和 D1 asset index。引用变化会安排 15 分钟内的有界复查，公共房不会因无 TTL 而永久保留孤立上传。

限制包括：每房 64 条连接、每身份 4 条连接、每 IP hash 8 条连接、单帧 256 KiB、每秒 24/6/2 个自适应 Yjs update、每秒 30 个 awareness、每 IP hash 每分钟 4 次完整/差异同步请求与 32 MiB 同步响应预算、5,000 个活动对象、15 MiB 文档、5 MiB 单图、100 张/100 MiB 单房图片。图片只接受经过真实字节结构检查的 PNG、JPEG、WebP；SVG、HTML、脚本、伪造类型、超尺寸或截断内容会被拒绝。

心跳扫描、密码房 TTL、ticket JTI 清理、未引用资源检查和上传/同步限频状态清理共用 DO 唯一 Alarm。任何限频状态写入都会立即重算并设置最早 Alarm，即使公共房没有 WebSocket、图片校验失败或请求已触发限频，也不会留下永久 rate key；到期处理后会删除状态并再次按剩余任务重排 Alarm。

## 24 小时生命周期

公共房永不进入 TTL 删除。密码房规则：

1. 最后一条有效连接关闭或被 55 秒心跳超时清除时，写 `emptySince` 和 `deleteAt = emptySince + 24h`。
   DO 恢复时若 storage 仍声称有人在线、但 `getWebSockets()` 没有恢复连接，也会从恢复时刻重新进入这套空房流程；不能由残留 `onlineCount` 阻止清理。DO 内首次创建的密码房在 WebSocket 真正接纳前同样先处于 24 小时待清理状态。
2. 24 小时内任意连接加入会原子清空两个字段，并把 Alarm 改为心跳扫描。
3. 房间再次为空会从新的离开时间重新计算。
4. Alarm 执行时重新读取真实 WebSocket 数、`emptySince` 和 `deleteAt`；任何条件不满足都不删除。
5. 到期后先分批删除 `whiteboard/v1/<roomId>/` R2 对象；失败时指数退避重试，不先删权威元数据。
6. R2 清理成功后移除 D1 asset、ban、room 索引，再 `deleteAll()`。重复 Alarm 无状态可删，保持幂等。

管理员清空会先清除该房间 R2 图片和 asset 索引，再重置 Yjs 文档与资源用量；锁定状态会广播并拒绝新的 Yjs update 和图片上传。

## 验证

```bash
node node_modules/typescript/lib/tsc.js -p workers/whiteboard/tsconfig.json --pretty false
npx vitest run --config workers/whiteboard/vitest.config.mts
npx wrangler deploy --dry-run --config workers/whiteboard/wrangler.jsonc
```

Vitest Workers pool 覆盖密码房到期、24 小时内重连取消、重复 Alarm 幂等及 D1 ban 清理、公共房不删除、跨房间 Yjs 隔离、ticket 重放、多标签身份版本与房内名字查重、每 IP 连接上限、同步请求/响应预算、无连接失败上传的 rate Alarm 与到期 prune、5/10 MiB 真实分片快照和自适应 update 限频、公共房清空资源、未引用图片回收、内部 Secret、图片 magic bytes/尺寸和 UTF-8 名称 header。

## 回滚

1. 先把 Pages `WHITEBOARD_ROOMS` binding 和入口回滚到上一版本，阻止新连接。
2. 保留 `lusu-whiteboard-do` 和 namespace，部署上一份兼容 Worker；不要删除 `v1` migration 或复用 namespace 名。
3. 若需下线，先等待/移除活跃连接，按 room prefix 清理 R2，并备份或清理 D1 fleet index。
4. Secret 泄露时同时轮换 Pages 与 Worker 的 `WHITEBOARD_INTERNAL_SECRET`，两侧切换期间请求会安全失败。
