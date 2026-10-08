# Cloudflare 费用保护与受控启用

**候选实现，尚未合并或生产部署。** 用户要求接近费用风险时熔断，维持日常使用。代码的 paused/disabled 默认值用于未核实环境，不是长期停用的运营方案。生产须先完成最低账户核对，再按本文件一次性初始化已验证的额度和启用功能；不能先合并，让 Pages 提前发布半套方案。

此保护限制应用对共享资源的消耗，不能承诺零账单。静态页面和本地游戏继续提供。动态暂停不删除账号、存档、画板或文件，未确认的云保存也不视为成功。/api/health 的 db:null 明确表示没有探测 D1，只报告配置和保护版本。

## 准入及分池

Pages 与四个 Worker 使用现有 D1 cost_guard_budgets。每个池只有一条永久策略行，以池名称作为 id；行缺失、计量异常、D1 不可用、复核过期或套餐未核实均拒绝。先读、再条件 UPDATE 原子占用额度；并发的最后份额只能成功一次。拒绝不写 D1 日志或计数，已预留额度不因后续业务拒绝退款。负缓存最多 60 秒，不缓存无界肯定准入。

| 池 id | 每日上限 | 每月上限 | 用途 |
| --- | --- | --- | --- |
| dynamic | 500 | 5,000 | Pages/HTTP API、登录、存档、管理及 MCP |
| realtime | 2,880 | 10,000 | 白板和游戏 DO 请求；WebSocket 有界预付批次 |
| cleanup | 24 | 744 | 互传每小时 cron |
| whiteboard-cleanup | 2,880 | 30,000 | 白板房间 alarm，包含活跃房维护和过期删除 |
| relay-cleanup | 240 | 5,000 | 游戏中继 deadline 与清理 |

白板高频 awareness 不逐条占用 HTTP API 额度。每个 DO 预付一次实时封套，最多复用 1,024 条消息、60 秒；剩余 D1/存储操作接近用尽时重新申请，操作配额不会随消息重置。任何二进制更新仍须持久化成功后 ACK。DO 构造函数不访问存储，所有原生存储操作均使用当前已准入封套；原有无唤醒 ping/pong 保留。实时预算用尽仅影响该类服务，不挤占登录/存档额度。应用 API 的白板 join/上传等 HTTP 请求仍受 dynamic 保护。

每份准入最多：256 条 D1 语句、16 次 R2 A、32 次 R2 B、64 次 R2 删除/中止、8 次 DO fetch、256 次 DO storage 调用、32 次 KV 调用。所有池的月上限相加，对应最多 811,904 次 R2 A 和 1,623,808 次 R2 B；这些是保守操作上限，不是精确账单。D1 语句、DO 存储调用不等于计费行数，索引及扫描仍可能放大。因此严格启用只支持已核实 Workers Free/D1 硬配额条件；Paid 或未知不能靠声明成 free 绕过。

拒绝的普通限流请求不更新任何分钟/小时/请求/字节桶；多桶准入在同一 SQL 原子完成。可选访问遥测在进入预算与身份处理前停止，旧 hard 模式不保留文章采样。公开文章搜索超过 1,000 候选拒绝，不做无界扫描或伪装完整的截断结果。

## 日常使用与复核

复核有效期最长 30 天，不要求每日人工续期。日/月计数在同一条件 UPDATE 中按 UTC 推进；月切换只更新现存、仍有效策略的计数，不建新策略、不延长 valid_until、不改限额，也不动物理存储。异常日期、未来日期、异常计数均拒绝。缺失策略不能通过跨月自动恢复，删除台账不能刷出新额度。

每次操作封套最多 60 秒，且不能越过配置或数据库的复核截止时间。/api/health 返回 reviewExpiresAt；续期应在维护计划中提前完成，并只更新已经复核的期限及必要的 enabled，保留当期计数和存储预留。没有新账户证据时不能自动续期。到期返回 COST_GUARD_REVIEW_EXPIRED，静态内容仍可用。套餐、绑定、其他消费者或绕过入口变化时立即暂停相应功能并重新核实，不等待期限届满。

## 物理存储与清理恢复

白板、互传、管理员及所有上传分片共享 cost_guard_storage 的 8 GiB 保守高水位。R2 put/uploadPart 在调用前原子预留实际字节；单次最多 95 MiB，未知长度拒绝，流以 FixedLengthStream 限制实际长度。完成多段上传不会再授予额度。覆盖、重试、失败、未完成分片及孤立对象均保守计入；过期、abort、delete 不自动退款。管理员没有费用豁免。

仅确认物理删除或确认不存在后，才移除相应业务记录。互传每次最多选择 10 个候选，房间每批最多 8 个会话/8 个条目；外键级联不能提前删除未中止的会话。白板每批最多删除 32 个对象，未完成保留元数据并安排一分钟后的下一批；65/100 图房间会跨批完成。公共白板从不套用私有房 TTL。管理员主动 clear 的未完成批次明确返回可重试状态，不误报成功。

白板和游戏清理使用各自预算，不与每小时互传 cron 竞争。预算耗尽的 alarm 在下一个 UTC 日有限重试；数据库异常等拒绝最多一小时后重试。恢复调度只允许当前仍有效的已核实 Free 配置，每次 alarm 最多写一次原生 DO alarm，不写 D1 错误日志或修改业务元数据；一个 DO 只有一个待执行 alarm。配置暂停、过期或套餐未知不重排；需重新核实后通过已知房间的有界管理操作恢复。原生 Free 存储本身不可用时重排也可能失败，必须保留状态并人工恢复，不声称绝对可用。

回收物理预留前，在所有部署和外部写入源暂停上传，确认全部在途上传结束或中止，并至少等待当前 60 秒准入失效；单凭等待 60 秒不能证明 R2 写入已完成。盘点整个桶的现存对象和未完成分片，包括其他前缀。无法确认静止基线时不得降低 reserved_bytes。暂停时已有 R2/DO/D1/KV 数据仍占用存储，可能继续收费。

## 最低账户核对与启用

1. 只读核实 Workers 套餐与 D1 真正的 Free 硬配额、DO/KV 限额及其他项目的日/月用量。域名 Free 不是 Workers Free；D1 Free 超额会停查询，R2 是含免费额度的按量服务。
2. 核对 Pages、whiteboard、transfer-cleanup、site-mcp、site-admin-mcp 是否存在、实际版本及全部绑定。核实整个 R2 账户的存储和操作余量、对象及未完成分片，关闭或控制所有 r2.dev/自定义公开入口/旧 Worker/外部写入绕过。不得自动创建尚不存在的 Worker。
3. 核对真实 cron、对象存储类别和生命周期；不能把默认生命周期当作已验证，也不能给公共白板新增整桶 TTL。保留现有 WhiteboardRoom/GameRelaySession namespace 和 migration。
4. 准备一次有界维护窗口，在受保护的各部署启用前执行增量 cloudflare/schema-cost-guard.sql。它仅建两张空表，不授权、不删除业务数据。不要重放整份历史 schema.sql。
5. 首次人工创建上表中需要启用的永久策略行：id 为池名，revision=20261008-v1，enabled=1，valid_until 为未来不超过 30 天的 Unix 毫秒，day 为当前 UTC 日期，初始计数 0，限额不高于表中值，并按实际共享余量进一步降低。已有记录只续期，不清零。初始化 verified=1 的共享存储行前必须有完整物理基线；limit_bytes<=8589934592，reserved_bytes 不小于真实总量。旧候选曾使用 lane:YYYY-MM 的记录，不能迁移成零额度；在暂停状态人工核对其已用量并保留。
6. 五个部署设置一致的 COST_GUARD_REVIEW=20261008-v1、COST_GUARD_WORKERS_PLAN=free、COST_GUARD_UNTIL=<ISO UTC>，以及经核实的 COST_GUARD_MODE=strict、COST_GUARD_FEATURES 列表。功能名为 api、admin、articles、transfer、whiteboard、public-mcp、owner-mcp；只开启实际存在且需要的功能。清理用 COST_GUARD_CLEANUP=enabled，可与动态功能独立启用。
7. 按 transfer-cleanup、已有 public/owner MCP、whiteboard、最后 Pages 的顺序协调发布。独立 Worker 先兼容旧 Pages；保护拒绝返回明确 503，不改鉴权与保存格式。全部预算和功能已准备好后，正式配置应受控启用，不能无限期使用仓库的未核实暂停值。任一步受阻记录已发布/未发布版本并保持明确状态，不先合并触发部分上线。
8. 发布 smoke 当前锁定 paused 预览合同；正式启用发布必须在同一审查中明确修改为目标模式，并验证一次无副作用的真实准入、提交 SHA、资源哈希、各 Worker version/deployment 与保护变量。不能把任意 503 或旧提交当作通过。

这些代码、测试、只读核对和已验证预算内的日/月推进、清理、正常发布属于已有授权。套餐变化、新增服务、扩大 OAuth scope 或其他持久权限需另行明确授权；不得为方便放宽。

## 当前验证与授权状态

PR #41 为 draft。持续协作、独立清理额度、大房间分批清理与日/月推进修复已重新通过完整本地发布门禁：1,016 项单元/集成测试、223 项公开 UI 检查及 A Dark Room 浏览器审计，包含可复现构建、lint 与类型检查；CI 必须以 PR 最新提交的结果为准。线上静态 manifest 只读确认仍为 main@9854301ea93fee3abdeb14dad3fec55fa2b27da0，尚未生产发布保护。

用户已明确允许打开最小 Wrangler OAuth：account:read、user:read、workers_scripts:write、workers_routes:write、zone:read，以及 Wrangler 隐式 offline_access。两次官方浏览器流程均未在时限内收到回调，尚未确认登录成功。用户随后明确要求登录晚点处理，因此当前不重试登录、不合并或部署，先完成可独立验证的代码和草稿 PR。最终确认、MFA/CAPTCHA 由用户完成，不把授权码、回调链接或 token 发到对话。回调 localhost:8976 必须到达原电脑；不能直接换电脑完成后期待这里收到回调。此范围不自动包含 D1/R2 额外管理权限，缺什么只报告具体项，不自行增加。

实际套餐、四个 Worker 生产版本/绑定、桶公开入口、生命周期和账户用量尚未核实。仓库没有既有 Actions 部署 secrets；Pages 的分支预览成功不能证明 Worker 全部上线。没有升级套餐、新建付费服务、读取密钥内容或扩大至额外未获准范围。

## 验证与回滚

执行 npm run verify:public-site-release、本地 D1 增量迁移、子项目治理检查，以及四个 Worker dry-run。费用测试覆盖原子最后份额/字节、501 次持续 awareness、混合 cron/多房间 alarm、预算恢复、65/100 图跨批删除、未知计量、管理员、D1 故障、拒绝不写库、删除/abort 失败和日/月推进。身份、OAuth scope、存档 CAS 与原生事务继续保持回归。

回滚先保持费用保护或对应停用措施，再回退业务代码。保留用户数据、预算计数和物理高水位，不重建 DO namespace，不删除 R2 或回退用户存档。直接恢复没有保护的旧 Worker 会重新暴露风险；发布后应记录每个实际 version id 才有精确回退对象。

即使动态全暂停，已存数据、Paid 请求本身、旧部署、直接 R2、其他消费者及延迟账单仍可能收费。账单提醒不是硬上限，应用计数不是精确费用保证。

官方依据：[D1 定价](https://developers.cloudflare.com/d1/platform/pricing/)、[R2 定价](https://developers.cloudflare.com/r2/pricing/)、[Workers 限额](https://developers.cloudflare.com/workers/platform/limits/)、[R2 生命周期](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)。
