---
name: lusu-personal-site-skill
description: 维护鲁肃个人站 lusu575/lusu-personal-site 时使用。适用于修改项目文档、前端界面、三语文案、聊天室、在线画板、游戏区、账号云存档、Cloudflare Pages Functions、D1、Durable Objects、R2、部署说明或长期维护规则。使用本 Skill 保持 XP Pixel Art Y2K 风格、更新 CHANGELOG 和 PROJECT_CONTEXT，并遵守项目安全与部署约束。
---

# 鲁肃个人网站专用Skill

## 公开主站发布收口规则

- AI 能力层以 `lib/capabilities/registry.mjs` 为唯一声明源。`transport` 是长期目标接入面，`availableTransports` 是当前已实现的真实接入面；CLI、MCP、文档与公开更新只能宣告后者。复合授权必须用冻结的 `requiredScopes`（全部满足）和 `anyOfScopes`（非空时至少一个）机器字段表达，不能只靠单值 `scope` 或自然语言。新增或改动能力时要先更新 registry 的权限、副作用、确认需求和实际 transport，再共享同一服务适配层；不得在 CLI、本地 MCP 和远程 MCP 重复业务规则。
- 本地 CLI 和 stdio MCP 使用账号持有者确认的设备码授权，令牌按 `content:read`、`transfer:read`、`transfer:write`、`transfer:delete`、`whiteboard:read`、`whiteboard:write`、`whiteboard:assets`、`japanese-subtext:progress:read`、`japanese-subtext:progress:write` 最小化请求；默认不授予删除、画板或日语进度 scope。Quick Transfer 查看／下载属于 read，进房／发文字／上传属于 write，项目删除和分片上传中止属于 delete；画板 write 只隐含场景 read，图片上传必须同时具有 write+assets，原图读取必须具有 assets 加 read/write。设备码轮询遇到网络／中止或明确瞬态 HTTP 故障时，只能在设备码有效期内有界退避，且不得输出 token、代理或底层网络细节。Agent Bearer 令牌永远是普通机器角色，不能继承 admin 或访问管理接口；管理功能继续只接受 HttpOnly 浏览器会话。
- 设备授权／令牌管理 HTML 若依赖 POST `Origin` 校验，绝不能使用会把浏览器表单来源序列化成 `null` 的 `Referrer-Policy: no-referrer`；HTML 使用 `strict-origin`，JSON 继续使用 `no-referrer`，既保留精确来源又不泄露带 `user_code` 的路径或查询。不得以接受缺失／`null` Origin 或 Referer fallback 修复；精确 Origin、登录态和双提交／D1 CSRF 必须保持。授权 GET 可接受从 CLI／外部链接打开的顶层文档导航，但必须拒绝 iframe 与图片、XHR/fetch 等子资源上下文。
- Quick Transfer 口令不得放入命令行参数、URL、History、日志、telemetry 或持久明文；CLI 只从隐藏输入／stdin 取得，MCP 只接受明确的本地环境变量引用，文字密钥始终在本地派生。下载必须限定允许根、默认不覆盖已有文件；能导致外部写入或删除的 MCP 工具必须如实标注副作用与非幂等语义。
- CLI 与 stdio MCP 必须复用 `自动新闻/integrations/lusu-site/network-fetch.mjs` 的共享代理感知 fetch，再把它注入 `SiteClient`；`SiteClient` 保持可注入网络边界，不把“本身使用平台 fetch”写成架构事实。代理 URL、代理凭据与 Agent Token 都不得输出、写日志或进入错误上下文。
- 本地存储的 Agent credential 必须绑定签发时的规范化 HTTP(S) origin。`--base-url`、`LUSU_BASE_URL` 或 MCP `baseUrl` 指向不同 origin 时，不得复用、发送或删除原 origin 的 token；只有显式 `--token-stdin`／`LUSU_ACCESS_TOKEN` 可由操作者绑定当前覆盖 origin。CLI 普通命令、auth status/logout 与 stdio MCP 必须共用同一 origin 匹配规则。
- `workers/site-admin-mcp/` 是生产站长 OAuth remote MCP，canonical resource 固定为 `https://lusu575.com/mcp`；当前生产 Worker version ID 为 `849d8328-87db-4ac8-819a-ce725fc06349`，内部版本 `0.3.1`，承接 100% 流量。当前精确 bundle 只完成 metadata、未鉴权 401 与非 allowlist pathname 404 基础线上点检，适用的真实生命周期仍须重跑。历史 bundle `fa295db6-302a-4a20-a2b1-ffe1ddafd75b` 的九工具知识库完整验收只适用于它自身，外链视频生命周期也只对历史 `377d494b-8f90-40ad-998f-863d209e1978` 通过；四游戏真实闭环仍未完成，视频条目的 `availableTransports` 尚未包含 `remote-mcp`，游戏条目的 `availableTransports` 仍为空。它必须继续使用 OAuth 2.1 authorization code、PKCE S256、精确 RFC 8707 resource、最小 scope、D1 grant／审计与每次管理员复核，绝不复用站点设备令牌或传递 `lusu_session`。每个新生产 Worker bundle 必须重新进行真实浏览器 OAuth 与对应完整闭环，不得用历史 bundle 的验收冒充当前版本成功。`workers/site-mcp/` 只保留公开读取工具的复用注册层与非 canonical 无 OAuth 目标；一次包含未验收 availability promotion 的发布必须回滚，不能靠文档先行扩大承诺。
- RFC 7009 撤销必须区分 access token 与 refresh token：前者只删除该 access token，D1 grant 保持 active；后者在 provider 删除前用固定版本 grant 记录 O(1) 精确核对 current／previous token hash，并先写 grant 级确定性 D1 `pending` intent；标准撤销响应成功后还要显式确认幂等的整 grant 删除完成，以抵御并发 refresh 轮换导致的成功空操作，随后才以单个 D1 batch 原子标记 revoked 与完成唯一审计。跨 provider／D1 恢复必须由强一致 D1 intent 驱动，不得依赖最终一致 KV 的删除后反查；D1 失败返回稳定错误并允许同请求恢复，不能虚报 200，也不能记录 token、client secret 或原始表单。升级 OAuth provider 时必须重审其 grant key／refresh-token hash 契约和生产等价回归。
- 浏览器游戏控制必须使用每款游戏受审计的语义 bridge，而不是通用 browser automation。2048、Hextris、A Dark Room 与人生重开候选只返回有界 observation、current revision 与不透明 `actionId`；任何 selector、script、raw key、coordinate、URL、DOM 或原始存档输入都失败关闭。配对必须由玩家显式生成一次性、短时、绑定 owner／OAuth client 的码；同页仅一个 pending command，动作使用 revision CAS，页面持续显示锁定、暂停、收回／断开和关闭控制，玩家操作或断线必须立即释放。`game_browser_pair`／`observe`／`actions`／`act`／`pause`／`close` 只有在 `games:play`、active grant、当前管理员复核、DO 中继与真实浏览器生产闭环全部通过后才能加入 `availableTransports`。
- 浏览器游戏 WebSocket 的保活只允许精确应用层文本 `ping`／`pong`。Cloudflare Hibernation `setWebSocketAutoResponse("ping", "pong")` 配合 Pages 每 8 秒发送 `ping`、忽略精确 `pong`，只能覆盖浏览器实际持续发帧的场景；生产 Chrome 标签进入后台约 5 分钟后的强计时器节流已经证明，不能把前台／短时心跳通过推导成长暂停闭环通过。paused 补救只可由已鉴权、owner／grant 绑定的 controller observe 触发：先验证 browser socket，再发送精确原始 `pong`，失败立即标记断线；成功只沿用现有 `lastControllerAt` 持久化并返回缓存暂停快照，不得更新 `lastBrowserAt`。它不得读取 provider、生成新 observation、执行 action、改变 revision、增加协议消息类型或让 AI 恢复。只有持续调用 paused observe 的控制器获得保活；生产验收 helper 使用 1.5–10 秒，客户端契约不得超过 20 秒。不得描述成服务端定时器或停止轮询仍永久保活，恢复仍只接受玩家 `user_resume`。部署状态与验收状态必须分别记录；当前 `849d...` 已部署该逻辑但尚未完成四游戏验收。任何新 Worker bundle 仍须绑定精确 version 与最终 Pages commit 逐款跑完配对、动作、暂停、后台等待、玩家恢复、确认关闭与撤销，静态／单元测试不能替代真实闭环。
- 浏览器游戏命令必须把最终 outcome 审计视为工具完成条件：调用尝试和 `success`／`pending`／`error` 结果分别持久记录，结果审计失败时返回稳定 `MCP_OAUTH_AUDIT_FAILED`，不得向调用方宣称动作成功。重试必须复用同一 `clientActionId` 与 DO 幂等收据，审计恢复后只能回放既有结果，不能再次驱动浏览器动作。
- Kittens Game 固定保持 `NO_AGENT`／`agentControl.enabled = false`，原因是 WET PAWS LICENSE。没有上游明确许可或法律确认时，不得为它增加 bridge、配对、观察、动作或存档 Agent；不得从其他四款游戏可控推导许可证允许。
- 视频 MCP 第一阶段只能读取／管理 YouTube／Bilibili／b23.tv 外链记录。即使精确候选 bundle 已通过原子发布、幂等重放、管理回读、元数据刷新、CAS、确认删除和撤销，`content.videos.list/get` 与六项站长工具也必须等最终 availability promotion 所在的新 bundle 重新验收后才能加入远程 `availableTransports`；既有生产 `site_capabilities` 继续只返回已正式晋级的能力。原子发布、CAS 更新、元数据刷新和确认删除复用当前管理员复核、D1 审计与持久 `operationId + canonical payload hash` 收据；更新／删除要求 `expectedUpdatedAt`，删除另需 `confirm: true`。远程 MCP 永远不读取本机路径、Base64、原始字节或 AI 客户端文件；在独立私有 R2 数据面完成分片、配额、内容哈希、扫描、提交、中止、过期和孤儿清理前，`video_upload_sessions` 预留表或 planned 能力不得被描述为真实文件上传可用。
- 浏览器 OAuth 同意 POST 必须把重复／并发提交当作服务端幂等边界：由持久 grant claim 选出唯一 leader，成功结果写短期 completion receipt，同一管理员会话、同一 decision、同一请求指纹与同一 per-flow 双提交 CSRF Cookie 才能回放原 302。每个 flow 使用独立 HttpOnly Cookie，并让成功后的 Cookie 与 receipt 同寿命，避免重叠 flow 相互覆盖或首个 302 清除后重放失败；不得用缺 Cookie fallback 放宽 CSRF。授权页 CSP 的 `form-action` 只能在 redirect URI 已通过协议安全检查且精确命中已注册 client 后，额外放行该 callback 的规范 origin；错误页继续只允许 `'self'`，不得使用通配 scheme、路径或不安全外跳。
- 站长 OAuth `grantRef` 由 base64url 随机字节生成，精确契约为 16–128 位 `[A-Za-z0-9_-]`，所以首字符 `-`／`_` 同样合法。授权 flow、ledger 和文章服务必须同步该契约；设备 Agent token reference 继续使用自己的首字符／字符集规则。不得用一个通用 principal 正则同时校验两种标识，也不得为修复 OAuth 边界而允许点、冒号、斜线或越界长度进入 grant。
- 公开工具、游戏和题库接入 CLI／MCP 时必须输出专用安全投影，不能原样转发前端 manifest：固定同源路径和数据版本，限制响应字节、条目数、语言、ID 与查询长度，拒绝 traversal／任意 URL；隐藏源文件入口、存储键、默认值、内部语言映射、批次路径和音频内部文本。工具占位卡片不得获得稳定 ID 或进入机器目录；游戏 Agent 支持必须逐项按真实适配器声明；日语关卡必须核对 catalog/index/batch 的版本、数量、唯一 ID、SHA-256 和 `textLocked` 后才能返回。
- 日语账号进度只通过专用有界投影读取；通用 Agent 写入必须使用语义答题操作，不能暴露浏览器完整快照 PUT。服务端只接受已解锁关卡的稳定 ID、revision、contentHash、完整逐题选项、expectedRevision 与 operationId，并自行计算分数、通关、奖牌、尝试次数、解锁和时间戳；调用方提供派生字段、旧题库、旧进度或同 ID 异载荷时失败关闭。Agent 辅助答题固定按 bilingual 记录、奖牌最高 bronze；`operationId + canonical payload SHA-256` 收据必须阻止重复计次。仅增加 Agent API／CLI／MCP 而不改公开应用、题库或存档兼容边界时，日语 `appVersion`／`contentVersion` 保持不变。
- 画板 Agent Bearer 与房间访问令牌必须分离，后者绑定当前 tokenId；密码只允许隐藏 stdin 或 `env:NAME` 引用，并通过同源 HTTPS 请求体交给服务端 HMAC 映射。Agent 写入必须基于最新完整 Yjs 状态，只追加经过 allowlist 的高层元素；只有同时具备 assets scope、可信内部 header 且引用当前房已提交 `ImageMeta` 的规范图片分支可通过。服务端必须拒绝既有修改／删除、未授权图片、嵌入、URL／Base64、链接／绑定、customData、孤立资源、未知根和任意二进制注入。`operationId + payload SHA-256` 收据要与更新／版本原子提交，严格处理重放与冲突。
- 本地隔离游戏会话与浏览器接管是不同数据面：本地 2048／人生重开和专用 Hextris 会话继续执行 revision CAS、clientActionId 幂等去重、状态／会话／TTL 上限及重置／关闭确认，不能因页面已有 bridge 就描述为连接浏览器。浏览器候选必须单独通过受审计配对／DO／OAuth／真实页面闭环后再改变可用面。
- 本地敏感状态的 read-modify-write 不得无锁覆盖或直接以 `"w"` 截断目标：白板句柄使用跨进程 owner-token 锁与同目录私有临时文件 fsync／原子替换；游戏锁还要使用 token marker 非空目录、进程实例、PID、心跳和提交前 owner fence。存活 PID 失败关闭；恢复／释放只能操作精确 token 与文件身份，必要的 retiring 阶段继续保留同一 token，绝不能先读 owner 再按公共路径删除而误伤 successor。标为只读的 observe／actions 不得 touch、续 TTL、删除过期文件或产生目录写入。
- 仓库凭据扫描必须覆盖已跟踪源码和当前工作树中尚未暂存的新源码，但不得递归读取明确 Git-ignored 的本地运行证据目录（例如 `自动新闻/data/mcp-runs/`）。应按精确路径排除运行证据，不能放宽 token／私钥识别规则，也不能用宽泛目录名跳过可能受管理的源码。
- 并发／single-flight 回归必须等待 mock、hook 或被测代码发出的确定事件；不得用“固定次数 × 1ms sleep”推断异步请求已经开始。确实只能轮询时应使用有界的真实 deadline 并在错误中报告条件，但优先使用 deferred gate 消除共享 runner 负载差异。
- 正式链路仍是仓库根目录由 GitHub `main` 触发 Cloudflare Pages；Dashboard 固定执行 `npm run build` 并发布 `dist`。标准构建必须先运行 `scripts/build-check.mjs` 守卫，再由 `scripts/build-production.mjs` 原子生成可复现、内容哈希、白名单和 sourcemap 可定位的 `dist/`；该目录是 Pages 构建输出但不得提交 Git。HTML、哈希资产、未哈希 CSS/JS、API/JSON 必须使用各自缓存策略，禁止用一个全局 `/*` immutable 规则覆盖。
- 壁纸、窗口背景、图标或图集优化必须先匹配真实槽位与像素风轮廓，再提供 AVIF/WebP 和可靠 fallback；首屏只预加载当前主题/壳，主题切换要卸载旧动态层。同路径二进制变化也必须更新公开 query。
- 文章、视频、游戏、社交等公开列表复用统一的有界 ETag / SWR / last-known-good 请求层；304 不重建列表，离线/短暂错误不清空成功内容，用户强制重试可绕过新鲜缓存且仍受单飞与生命周期 Abort 约束。ETag 必须覆盖完整公开响应，不能只取数据库行时间等不足以描述代码转换和关联数据的局部种子。视频封面禁止恢复无上限 base64 列表负载；同源封面代理 URL 必须带内容或行更新时间版本，后台换图与纯代码兼容修复都要能击穿旧浏览器缓存。
- Transfer 增量同步必须使用稳定复合游标与服务端 generation，客户端键控保留节点、媒体状态、焦点和滚动；上传/发送使用幂等键、队列背压、取消/重试与 URL 清理。D1 迁移一律先 `ALTER` 补列再建依赖索引，并同时验证旧库保留数据与 fresh install。
- 发布前运行统一 release 验证，覆盖测试、公共模块图、构建守卫、生产构建复现性、本地 D1 迁移和精确 Headless UI 矩阵。Headless 不能冒充真机、完整读屏或线上认证；无推送/部署授权时必须停在本地通过状态并清楚记录剩余线上步骤。
- CI 中第三方 GitHub Actions 必须固定到已核对 release 的不可变 commit；`qa:local` 与 CI 应复用完整 `verify:public-site-release`，不能只跑轻量 build。安全响应头、Wrangler compatibility date、Pages 配置字段或 release gate 改动都必须进入构建守卫。根 `wrangler.jsonc` 不得声明 Pages Git 部署不支持的 Worker-only `observability` 或非标准 `secrets` 元数据；独立 Worker 的 observability 留在其自身配置。共享 runner 的首页首屏 TBT 固定采样三次并以中位数对原预算判定，其他性能场景仍单次采样；请求数、字节、load、CLS、内存、运行时错误等结构性门槛必须逐样本检查，不得借中位数隐藏。
- `/articles/<slug>` 的独立边缘入口必须只读取已发布文章，输出文章级 title、description、Open Graph、Twitter、canonical 与 Article JSON-LD，并转义 `noscript` 可读正文；不存在的 slug 返回 404 / noindex，D1 暂时失败时不得把可由前端 fallback 恢复的主壳直接变成 5xx。
- 游戏目录、题库音频清单等可选远端 manifest 必须有有界超时、Abort、版本缓存和仓库内本地回退；可选网络失败不能阻塞内置内容、现有本地存档或已经加载成功的数据。日语工具的生产路径转换必须保留 manifest query 并坚持严格一次匹配，缺失或重复引用都要让构建失败。预加载的壁纸候选必须与实际 CSS 渲染使用完全相同的格式、尺寸和版本，且在首个资源请求前同步确定 reduced/off 动效状态。
- `wrangler.jsonc` 的 compatibility date 不得超过仓库锁定 Wrangler 所带 workerd 的支持上限；当前 Wrangler `4.118.0` 使用 `2026-07-17`。日期或 Wrangler 版本变化后必须真实启动一次 `wrangler pages dev` 并请求健康、文章、404 与后台入口，静态 schema/build 通过不能替代运行时启动验证。
- Headless 中每个独立审计场景必须用唯一 query 强制新文档，并确认 CDP 返回 `loaderId`；不要依赖 Hash-only `Page.navigate` 清空 route 模块或 30 秒内存缓存。刻意测试 SPA History、重试链或连续动效时才保留同文档。DOM 数量和交叠断言必须限定到真实场景容器；移动 App 外框可处于半透明 Dock 后方，但 composer、反馈、页脚和最后操作必须位于 Dock 上方。
- `.codex-worktrees/` 保存其他 Codex 任务的独立 checkout，不是当前发布源码。Git 忽略、递归构建守卫和仓库密钥扫描都必须跳过该目录；发现其中旧文件导致当前构建失败时应修正扫描边界，不得删除或改写其他任务工作树来换取通过。
- Production D1 的单条复合 `SELECT` 最多 5 项。远程迁移分组校验必须在任何写入前锁定该上限，超过时拆成多条查询；本地 SQLite 能执行更长的 `UNION ALL` 不能替代真实 D1 校验。新增生产持久层时，远程迁移成功判定必须显式回读每张表、运行时关键列和全部必需索引，并在 fresh-install 测试锁定同一契约；schema 文件执行成功不能替代这些 fail-closed 检查。
- Production D1 的 mutation `meta.changes` 可能包含外键级联影响行。校验按主键和 CAS 限定的删除时，应继续要求同批幂等收据恰好插入 1 行，并要求删除变更数至少为 1（或改用精确 `RETURNING`），不得假定 `meta.changes === 1`；首次响应必须是 `duplicate: false`，只有收据重放才为 `true`，并以生产等价级联计数回归覆盖。
- 独立 `package-lock.json` 不继承根 `package.json` 的 `overrides`。新增或更新根依赖时，必须盘点所有独立 npm 子项目，在各自清单重复必需的安全 override，并分别执行严格安装、测试与完整 `npm audit`；不能用根审计为子项目背书。Windows 重建根 lockfile 时必须使用不含现有 `node_modules` 的干净目录，并包含 optional 与 peer 依赖，再用严格 `npm ci` 验证；否则 Linux CI／Cloudflare 所需的平台 watcher 等条目可能被静默删掉。

## 账号、文章与 Chat 稳定性规则

- 账号表单必须保持稳定 DOM：语言/模式/身份状态/错误同步不得重建编辑字段；登录和注册各一个主提交，注册含确认密码，错误关联字段并聚焦首错，退出失败不得伪报成功。popover 必须归还实际触发源焦点，移动关闭不小于 44px。
- 账号初始状态检查必须使用有界超时；失败或超时在同一个稳定 popover 内提供原位重试，保留输入与现有编辑焦点。Chat 的 online 也只能在消息刷新成功后建立；失败继续显示 reconnecting 和可聚焦手动重试，不得仅凭浏览器 `online` 事件宣称恢复。
- 账号和其他公开写接口必须在业务读取前校验同源、允许的 JSON `Content-Type` 与流式正文上限。登录和注册按网络来源及规范化账号标识做持久化限流；注册的重复邮箱、站长保留邮箱和并发冲突必须返回相同状态、错误码与正文，公开文案不得暴露账号是否存在。
- 新密码固定使用 PBKDF2-HMAC-SHA256 100,000 次并把迭代数随哈希保存；这是 Cloudflare Pages Functions 生产平台的兼容上限，本地 Node／Miniflare 接受更高数值不能替代生产结论。登录按记录中的历史迭代数验证，旧 25,000 次哈希成功后条件升级，现有 100,000 次保持不变；超过生产上限的记录必须失败关闭并走受控密码重置，不能在请求里尝试高迭代派生。不得以加大 KDF 代替登录限流，也不得在错误、日志或统计中泄露密码或哈希。
- page view、click、article view 等匿名写入必须有来源限流与重复抑制；文章 PV 只在去重事件实际落库后增加。page view 已负责建立匿名 cookie、身份行和访客资料，公开首访不得再串行发送独立 identify 请求；同目标短时间重复点击应先在客户端抑制，服务端限频仍是可信边界。过期 session、登录履历、page view、click、article view 与限流桶必须按明确保留期分表、分批清理，每次有行数上限并通过 `waitUntil` 脱离健康响应关键路径；单表失败不能跳过其他独立表的清理尝试。
- 文章 schema guard 只负责表、列和索引，不能夹带整套文章／翻译 seed。完整 seed 必须通过 `site_runtime_state.article_seed_version` 做跨隔离实例的持久发布标记：版本匹配时零 seed 写入，版本变化时在一个 batch 中先执行全部 seed、最后写标记；测试必须同时证明 schema batch 不含 seed、当前标记会跳过 seed、fresh schema 在全部 seed 后写入同一版本。
- 后台流量保护只允许控制非必要 identify、page view、click 和 article view 遥测，不得自动关闭登录、云存档、Chat、Transfer 或 Whiteboard。当前默认以 30,000／50,000 估算行预警／硬保护，并在硬保护下使用 0%／0%／10% 页面／点击／文章采样，为必要业务保留至少一半当前免费写入余量；仅精确匹配旧默认 JSON 的配置可迁移，自定义值不得覆盖。公共遥测判定可复用最多 5 分钟用量快照以节省 D1 读取，后台面板必须绕过该缓存维持 30 秒人工观测。配置写入 `site_runtime_state` 时使用 revision/CAS；自动刷新不得覆盖 dirty 表单。站内事件系数只能标为估算，Cloudflare 官方 D1 `rowsWritten` 只有在只读 Analytics Token 实际连通时才显示，未配置／读取失败不能伪装为零或成功，Token 永不返回客户端或进入 Git。
- 生产冒烟监控必须低频、请求预算明确并有超时与有界重试；优先从 sitemap 复用一个文章 slug，避免为发现样本再调用列表 API。监控至少检查健康、Home、canonical sitemap／hreflang、一个文章直达页与一个哈希资产；未提交到 GitHub、未部署或未真实运行时不得声称线上告警已启用。`www` 永久跳转与真实用户性能监控属于 Dashboard 配置，必须线上验收后再记录为完成。
- Quick Transfer 未登录态只呈现一个上下文任务卡、一个主登录 CTA 和明确返回；登录完成要回到 Transfer，不得用红色 X 承担含糊返回语义。
- 文章阅读时 document 不滚动，`#article-detail` 是唯一纵向 owner；进度轨道约 4px、与正文零交叠，移动端保留可见含义与准确 ARIA 百分比。100% 必须按 `.markdown-body` 正文末尾计算，不能把 Dock 安全尾距计入正文。目录项不得固定高度或单行裁切，多行标题以统一行高／上下 padding 自然撑高，目录末尾保留滚动安全区；返回列表必须是 `.article-reader-sidebar` 的第一个子项，由桌面／横屏的整个 sticky 侧栏与目录一起固定，按钮本身不得再独立 sticky。目录点击要精确滚动 `#article-detail` 并让目标标题、hash、焦点和唯一 `aria-current` 同步。回顶通过帧管线测量正文卡片与任务栏／Dock 后固定在右下；顶部用原生 `hidden` 退出焦点顺序，激活后只滚动文章容器并把焦点交给 `tabindex="-1"` 的文章标题。
- Chat 发送只锁提交动作，用户可继续输入且旧请求不得清空新草稿。359×500 自动回归以普通房约 177px、私聊至少约 119px为目标；安全说明通过 44px 折叠入口提供，关闭时不占日志也不覆盖控件。
- Chat 同时以 1280×720 为短桌面硬门槛：标题、两行身份／房间控制、日志、composer 与 footer 必须完整落在窗口和任务栏上方，只有日志可弹性收缩；字数计数归入输入状态行。短屏／横屏几何只放 `css/mobile-ios-shell.css`，route CSS 不得新增 `@media`。
- Chat 发送失败重试必须复用同一 `clientRequestId`，新草稿或上一次已成功后才生成新 ID。服务端要在限流前重放首次成功结果，依靠 `(visitor_id, room_key, client_request_id)` 唯一索引防止并发重复；私聊不得因随机 IV 密文改变而产生第二条消息。旧 D1 先补 `client_request_id` 列、后建依赖索引。
- Chat 密码房进入和返回公开房必须单飞，相关按钮在切换期间进入真实 busy/disabled 状态；只有目标房间历史读取成功后才显示 ready。短密码错误要关联密码输入并设置 `aria-invalid`，失败恢复后焦点回到可继续操作的位置。
- 公共 Chat 绝不回退暴露服务端隐藏 visitor id；密码、私聊、草稿、Secret、完整标识不得进入 DOM 泄漏、storage、History、console 或 telemetry。修改渲染、链接、iframe、媒体或 Transfer fragment 时必须运行安全边界测试。
- 每次调用 `articleTranslationsStatements()` 都必须传入确定的 UTC ISO seed 时间；D1 会拒绝 `undefined` bind。文章或更新 seed 改动后必须运行全量 seed binding 回归和三语文章 API smoke，不能只靠静态 SQL 存在性判断。
- Cloudflare Pages 可能把 `/fragments/quick-transfer.html` 规范化到 `/fragments/quick-transfer`。互传 loader 只允许这两个同源精确 pathname；不得用前缀、后缀、尾斜杠或跨源规则代替精确白名单。
- 本地预览交付前先请求 `/api/health`。根 `.dev.vars` 必须包含两个互不相同且至少 32 bytes 的本地隐私盐，值只在本机生成、不得输出或提交；缺失会让全部 API 在进入业务路由前统一返回 503。

## 使用时机

维护当前 Git checkout / `lusu575/lusu-personal-site` 时使用本 Skill，尤其是以下任务：

- 修改网站代码、样式、文案、图片、游戏区、聊天室、账号、云存档或后端接口。
- 修改 `PROJECT_CONTEXT.md`、`CHANGELOG.md`、README、部署说明或维护规则。
- 新增游戏、页面、窗口、图标、弹窗、任务栏入口或长期注意事项。
- 如果任务涉及 `/admin/` 管理后台、后台样式、后台脚本、后台权限、后台 API、后台统计、后台视频管理、后台社交链接管理、后台聊天室治理或后台专用文档，必须同时读取 `admin/docs/ADMIN_PROJECT_CONTEXT.md`、`admin/docs/ADMIN_SKILL.md` 和 `admin/docs/ADMIN_CHANGELOG.md`，并以后台专用 Skill 约束为准处理后台细节。

## 每次改动必须执行

- 每次修改项目后，必须同步更新 `CHANGELOG.md`，记录日期、功能、界面、后端、部署、文档或规则变化。
- 项目信息变化时，必须同步更新 `PROJECT_CONTEXT.md`，保持项目背景、技术栈、部署方式、主要功能、文件结构和本地开发方式准确。
- 新增长期注意事项、维护规则、踩坑点或约束时，必须同步补充到本 Skill。
- 本 Skill 规则变化时，必须同步更新 `skills/lusu-personal-site-skill/README.md`。
- 后台专用文档或后台维护规则变化时，必须同步更新 `admin/docs/ADMIN_PROJECT_CONTEXT.md`、`admin/docs/ADMIN_SKILL.md` 或 `admin/docs/ADMIN_CHANGELOG.md` 中对应内容；不要把后台私有规则只写在主站文档里。
- 用户明确要求“只改文档”时，只修改文档文件，不改网站代码、样式、功能或资源。
- 用户明确要求“只美化 / 不动功能”时，只改视觉层文件，避免修改路由、登录、渲染数据、游戏加载、聊天室接口等功能逻辑。

## 风格与文案规则

- 桌面端保持 Windows XP + Pixel Art + Y2K + 可爱复古互联网桌面风格，并沿 Neo-XP / Pixel Glass OS 方向演进。
- 桌面端必须保留桌面感、蓝色标题栏、XP 风格按钮、任务栏、状态栏、像素图标、蓝天白云、草地和老互联网氛围；移动端使用原创、受 iOS 交互启发的虚拟手机 OS，不要把桌面 XP 布局压缩后继续当作手机界面。
- 避免现代极简博客风、商务 landing page、大面积纯白卡片堆砌、过重单色渐变背景。
- 可见文案必须维护中文 / English / 日本語 三种语言，不能只改一种语言。
- 调整图标、按钮、任务栏标签、桌面入口或标题栏时，必须检查图标和文字的对齐、换行、截断和小屏幕显示。
- 首页四时段壁纸基础图放在 `assets/images/wallpapers/`，按用户本地时间切换 `morning` / `day` / `dusk` / `night`。
- 首页壁纸必须保留 `wallpaper-root` / `wallpaper-stage` 舞台坐标结构；静态底图和后续动画图层要共享同一套 cover 裁切尺寸，不要直接用视口百分比硬贴小图层。
- 首页壁纸和欢迎弹窗问候语必须使用同一套时间段：05:00-10:59 morning，11:00-16:59 day，17:00-19:59 dusk，20:00-04:59 night。
- 右上角壁纸控制固定为 morning／day／dusk／night 四段循环开关，与上述时间段共用唯一时间模型。自动模式只在 05:00、11:00、17:00、20:00 的真实本地边界推进；手动选择只覆盖到下一边界，随后必须清除覆盖并恢复自动状态，不得把手动主题永久锁死。覆盖优先保存到 `localStorage`，不可用时才退到 `sessionStorage`；URL `?wallpaper=` 仅作显式预览，不写入覆盖。
- 四段开关的 scene、active node、semantic marker、accent、frame 和 roller 必须使用 `image2`／imagegen 生成的项目内位图及来源 manifest，禁止用 CSS、Canvas、SVG path 或代码几何临时绘制主体。176×44 控件保留四个 44px 目标；r6 暖象牙陶瓷椭圆壳的实测中心开口 half-open alpha bbox 为 `[18,20,861,201]`，运行时可视区固定 `clip-path: inset(4px 4px round 18px)`。未选中节点必须是四种高辨识、光滑拟物的时段图标，不得回退到圆点、珍珠、透明圈或像素化轮廓；清晨固定为低位暖橙半日加晨雾／地平线及薰衣草到杏桃色场，白天固定为高位完整太阳与鲜明蓝天，必须在 20／32／176×44 实际尺寸分别保持差异。选中 wrapper 为 36×36、top 4px，四档 x 为 4／48／92／136px；32×32 天体以 2px inset 放在轮内并始终正向。独立 roller 可见外径约 33.375px、开孔 30px、单边约 1.6875px，每档滚转 151.072deg，累计 0／151.072／302.144／453.216deg；必须和 thumb 共用 `transform var(--motion-window) var(--motion-ease-in-out)` 的可中断 transition，不得用 keyframes、`transition: all`、ease-in 或任何布局属性伪造滚动。该开关自身的精修记录 ID 为 `seed-update-2026-08-10-wallpaper-switch-slim-dawn`，公开 API／文章 seed／main token 为 `20260810-wallpaper-switch-route-motion-r1`，素材 manifest 发布 token 保持 `20260810-wallpaper-switch-slim-dawn-r1`，PNG 图像 token 为 `20260810-wallpaper-time-switch-r6`。
- 每个主题只允许一层不同的 accent：morning 是晨光与一朵小云向上展开，day 是两朵云水平横移，dusk 是低位余晖横向展开，night 是八颗稀疏星从下向上升起；四张基础 scene 不嵌入太阳、月亮、云、星或地景，禁止恢复 far／mid／accent 堆叠、行星、密集景物或 stagger。当前正式内容仍固定为 18 个不同 Image2 selected 源：4 scene、4 marker、4 node、4 accent、frame 和 roller；被替换的 r5 frame、roller、morning scene／marker／node 还要以完整 prompt、call ID、源路径／SHA 和 supersession 原因保留为历史，不能覆盖或删掉。manifest 必须记录官方 chroma helper或如实说明的等价 chroma 处理、机械 alpha trim／等比缩放／透明定位过程、实际尺寸 QA 与最终 SHA，不得臆造或用代码改色。除 frame 外的 17 个内容 cell 按 manifest 顺序机械纵向打包为 `scene-atlas.png` 880×880、`marker-atlas.png` 144×576、`node-atlas.png` 192×960、`accent-atlas.png` 480×640，其中 roller 固定为 node atlas 第五格；只有 `frame.png` 独立，运行时固定 5 个唯一图片 URL，禁止单独请求 `roller.png`，也不得通过放宽 Transfer trace 预算掩盖额外请求。任何 cell 都不得重采样、混合、重复或跨语义复用。图集要在开关实际可见的每个桌面公开路由加载和预解码，只有移动 App 紧凑栏等真正 `display:none` 的路由可跳过；回到 Home 并重新可见时必须再完成 readiness。开关内部动效不得以 `route !== home` 设为 static；整幅壁纸 crossfade 与动态云层则仍是 Home-only。键盘与 `data-motion="off"` 立即提交，reduced 移除 thumb／roller 位置运动且其他层只允许不超过 140ms 的纯 opacity，low performance／Save-Data 跳过 accent 但保留完整核心状态。pending request、last-request-wins 与点击瞬间的下一边界语义必须保持不变。
- 首页欢迎弹窗按访问设备本地自然日记录到 `lusu-welcome-day`；每天首次打开任意公开路由时必须显示一次，并在实际打开时立刻记录当天，不能继续使用长期版本号让后续日期永不再弹。`welcome=0`／`welcome=1` 只作为明确审计或预览覆盖。
- 顶部栏和底部任务栏也跟随同一套 `body[data-time-theme]` 四时段主题变量；维护 `.xp-topbar`、`.xp-taskbar`、Start、任务栏按钮、账号入口、语言切换或状态托盘时，必须同时检查 morning / day / dusk / night 四套外观，保持无竖线的现代玻璃像素 HUD 方向，并保留现有图标资源。
- PC 端活动任务按钮使用蓝色按下态与内凹层级，不使用黄色底边、黄色外描边或常亮光晕；仅键盘 `:focus-visible` 保留清楚焦点环。该规则不得改写移动 Dock 的选中底板。
- 维护右上角账号入口、语言切换或其他顶栏浮层时，必须同时检查 `.xp-topbar` 的裁剪行为和 `.site-shell > header` / `.site-shell > main` 的 stacking context。账号弹窗需要能从顶栏按钮下方溢出显示，且顶栏所在 `header` 必须高于主内容 `main`；否则会出现首页点击像没反应、其他栏目被窗口遮挡的问题。
- 修改账号入口、顶栏浮层或任何公开可见交互后，必须同步更新 `CHANGELOG.md`、`PROJECT_CONTEXT.md`、`content.updates` 的日期项、`site-updates` 三语记录、相关 seed、以及 CSS/JS query。不能只改代码不写记录，也不能只写 changelog 而不让首页最近更新日期变更。
- 桌面底部任务栏与移动真实 Dock 必须固定在浏览器视口下沿；移动 Dock 在 Home 和 App 内都保留，支持横向滑动、真实选中和 44px 横线收起/展开。维护窗口高度、页面 padding 或文章阅读浮层时，必须按 Dock 展开/收起状态与 safe area 预留空间，避免导航或固定控件盖住内容。
- 移动顶部高度由 `--mobile-header-height` 统一组合 safe area、状态区和 Appbar；不得把旧的“460px 以下两行 XP 顶栏”或 `--chrome-topbar-height` 当作新移动壳的布局来源。修改 `.xp-topbar`、`.topbar-actions`、语言按钮或账号入口后，必须复测 375x667、390x844 和横屏 844x390。
- 非首页窗口页背景必须跟随同一套 `body[data-time-theme]` 四时段背景图，当前资产为 `assets/images/window-backdrops/<time>.png`；它们必须比首页更低干扰、更简单、更现代。不要恢复成单一蓝绿色渐变，也不要把首页大场景图直接拿来压在窗口后面喧宾夺主。
- 当前四个时段均保留 CSS 动态云层与静态舞台作为永久兜底：`assets/images/wallpaper-dynamic/<time>/base-clean.png` 是无云底图，独立透明云层按 1672x941 舞台坐标摆放并沿同一主风向慢速错相漂移；morning / dusk / night 的低地平线云默认保持静态。符合播放资格时，桌面 Home 在该兜底之上使用用户确认的第一版 MiniMax H3 整帧视频；视频未就绪、失败或进入降级档时仍完整回到静态舞台。
- 本地调试动态壁纸可用 `?wallpaper=morning` / `?wallpaper=day` / `?wallpaper=dusk` / `?wallpaper=night` 强制预览指定时间段；该预览模式可以临时加快动画以便肉眼确认移动，不要为了预览硬编码当前时间。
- 首页壁纸的 CSS 图层仍只允许 `transform` / `opacity`，不得用 JS 每帧修改 `left` / `top`，也不得使用整屏 GIF 或 APNG。整屏视频仅对当前四时段壁纸开放严格渐进增强例外：只在桌面 Home、normal performance、Save-Data 关闭且站内 motion 为 full 时允许请求；每次只请求当前主题的一个 muted／loop／playsinline MP4，按 CSS 尺寸 × DPR 选择 1080p 或 2160p，不预载其他三段。正式内容使用第一版 H3 素材帧严格按 `0..62 + 61..1` 整理的约 5.17 秒整幅往返循环，不套第二版局部 mask／gain 合成，也不引入小女孩或电视随机 cameo。
- 正式 4K 视频链路固定为第一版 H3 源帧 `0..62 + 61..1` 组成 24fps 往返序列，先经双向光流补到 48fps、248 帧，再使用 `RealESRGAN_x4plus_anime_6B` 对全部帧逐帧 AI 超分，并分别输出 1920×1080 与 3840×2160。不得误写为使用原始 124 帧全段，不得恢复“静态底图只超分一次，再叠语义 mask、gain 与局部 H3 差分”的第二版生产方案，也不得用重复帧冒充光流补帧。
- 静态壁纸是永久兜底；视频只有在 canplay／play 成功后才能短淡入，加载或自动播放失败不得留空白。手机、low performance、Save-Data、`prefers-reduced-motion`、`data-motion="reduced"` 与 `off` 全部必须零视频请求；页面隐藏时暂停，离开 Home 或进入上述降级档时释放 `src` 与视频节点。当前渐进增强记录 ID／slug 为 `seed-update-2026-08-11-h3-first-version-video-sr-48fps`／`2026-08-11-h3-first-version-video-sr-48fps`，公开 API／文章 seed token 为 `20260811-h3-first-version-video-sr-48fps-r1`；8 月 10 日局部合成记录继续作为历史保留。
- 动态壁纸不能假设全站 motion runtime 与主模块只有一次固定初始化顺序。BFCache 恢复时主模块可能先读到旧 `off`，随后 `ui-motion` 才写回 `full`；壁纸控制器必须监听 motion mode 变化和 runtime ready，并在 `pageshow` 重新同步 route、theme、visibility 与播放资格。该生命周期修复的公开记录 ID／slug 为 `seed-update-2026-08-11-ambient-wallpaper-bfcache-fix`／`2026-08-11-ambient-wallpaper-bfcache-fix`，公开 API／文章 seed token 为 `20260811-ambient-wallpaper-bfcache-fix-r1`；不得借此放宽手机、low、Save-Data、reduced／off 的零视频请求边界。

## 双呈现壳、状态与动效规则

- 桌面 Neo-XP 与移动虚拟 OS 是同一站点的两套呈现壳，不是两套应用。`js/main.js` 是 ESM composition root，`js/core/`、`js/data/`、`js/features/`、`js/routes/` 通过显式 factory 依赖共享唯一业务状态；严禁在壳层或模块内复制、镜像或重新维护第二套路由、语言、账号、文章、视频、游戏、聊天室或主题状态。修改模块图后必须运行 `npm.cmd run check:public-modules`。
- Home 初始模块图只能包含 shell 必需能力和 `js/data/home-content.mjs` 的五条无正文更新摘要。Knowledge、Videos、工具区（内部 `resources` route）、Games、Chat 的 JS 以及 `css/routes/` 中四个重路由绘制样式按首次进入单飞加载、成功后常驻复用；route CSS 不得承载移动媒体布局，也不得承载 Home、顶栏、任务栏或 Dock 在进入路由前已可见的图标规则。这些 shell 资产映射必须位于始终加载的主 CSS，并在冷启动 Home 上检查 `background-image` / 图片解码。Quick Transfer loader、CSS、客户端和静态 fragment 必须等工具区真实 CTA 点击后才加载，进入 `resources` route 本身不得暴露全局 Transfer facade、挂载完整 DOM 或请求 API。
- 匿名聊天室只保留 `assets/images/icon-chatroom.png` 这一张 96×96 RGBA 规范资源，Home、标题栏、任务栏／Dock、欢迎快捷入口和聊天头像全部共用；不要恢复 `icon-chatroom-clean.png` / `icon-chatroom-desktop.png` 双资源。18–54px 小槽位继续使用 contain，不额外放大。
- `js/mobile-shell.js` 只能观察既有状态、维护 safe-area / `visualViewport` 等短生命周期呈现变量，并把导航委托给原有 `data-route` 元素；不得建立第二套路由器、账号状态或内容缓存。
- `window.LusuFramePipeline` 是公开主站唯一的 window resize / VisualViewport resize / scroll 监听与 viewport 模型。新增视口、Dock、滚动或聚焦几何工作必须使用 keyed `schedule/request`、`subscribeViewport` 或共享 `requestFocusReveal`，坚持一帧内全部 measure/read 先于 mutate/write；功能模块与 Transfer 不得建立私有 `visualViewport` / resize 监听、嵌套布局 rAF 或聚焦滚动逻辑，也不得把 page scale 当成软键盘。
- 固定移动壳不解锁 body / site-shell / page；非 Home 活动 App 的 route-specific `.xp-window` 必须保留休眠式 `overflow-y:auto` 逃生通道，并用含 route ID 的选择器超过既有 ID 级 `overflow:hidden`。文章阅读继续由 `.article-detail` 独占滚动。通用聚焦恢复只能经 FramePipeline 测量最近的真实内部纵向 owner，保留当前聚焦目标与已输入草稿，且只写该 owner 的 `scrollTop`；不得移动 document、Home、Appbar 或 Dock。账号面板的延迟 autofocus 在面板内已有焦点时必须放弃，不得抢走用户正在编辑的字段。
- 软键盘只是短生命周期呈现状态：打开时可临时隐藏 Dock，关闭后恢复，不得改写用户的 Dock expanded / collapsed 偏好。CDP 高度、缩放或 safe-area 代理只能证明几何回归，不得宣称通过了真实软键盘、safe area 或浏览器 chrome 验证；对应真机标志必须保持 false，直到真机实测完成。
- 性能档只允许 `normal` / `low`：Save-Data 或浏览器明确报告不超过 2 核 / 2GiB 时进入 low，能力未知保持 normal。low 必须关闭大面积 blur/filter、常驻 `will-change`、循环环境动效和全页 View Transition，同时提供高对比实色回退；不得靠隐藏功能、降低文字对比或改变 normal 档 XP / Pixel / Y2K 构图来通过。
- `js/ui-motion.js` 只负责过渡与动效编排；业务提交必须继续由现有处理函数完成，并保证一次用户操作只提交一次。动效失败、关闭或减少动态时，业务操作仍必须立即完成。
- 桌面 Home 图标进入模块不得捕获整张 Home 页面，只在实时壁纸上对目标 `.xp-window` 做克制淡入和 3px 上移归位；任务栏返回 Home 只动画 `.desktop-icons`，不得让顶层 Home 快照遮住任务栏。模块间 `route` 只让新活动页面轻淡入并小幅方向滑动，移动 Dock route 使用短促方向滑动和一个共享选中底板。页面路由、App 打开与移动 tab 不得调用会捕获整页固定 chrome 的 `document.startViewTransition()`；固定顶栏、桌面任务栏与移动 Dock 必须保持实时可见，fallback 不得克隆带 ID 的业务 DOM。full motion 回归必须拍摄切换起始、60ms、140ms 和稳定帧，验证 Dock 节点身份不变、全程可见，并覆盖 40ms 快速连续切换。
- `data-motion="off"` 必须真正停止硬编码 transition / animation、Dock smooth scroll 与选中滑动、骨架循环和主题快照；reduced 也停止非必要循环。disabled、`aria-disabled`、inert 后代不产生按压反馈；窗口 maximize/restore 的 FLIP 使用真实 before/after 几何，不能用固定缩放伪装。
- 键盘触发的跳转、筛选、回顶、Dock／壁纸选择和弹层开合必须立即提交，不得复用指针路径的 smooth scroll、弹跳或等待退出计时；触控开始要清除仅键盘态。Android／粗指针移动壳的 hover 规则必须被 `(hover: hover) and (pointer: fine)` 隔离，不能在触摸后留下粘滞位移。
- 视频缩略图必须是带标题可访问名称的原生 16:9 `button`，不得退回装饰 `div` 或恢复遮图播放圆圈。iframe 超时、load 与 error 都按当前 request generation + settled 状态收口；失败卡内相邻显示重试／原视频，loading / empty / error 使用共同 `.content-state`，真实错误为 alert，重试后保留合理键盘焦点。
- 不要克隆或 reparent 账号入口/弹窗、文章详情、视频弹窗、游戏或聊天等高耦合 DOM。移动壳应通过 CSS 和轻量装饰节点呈现现有内容，避免同一 ID、事件监听、焦点或异步请求产生两套生命周期。
- 公开呈现文件目前包括 `css/style.css`、`css/mobile-ios-shell.css`、`css/motion-system.css`、`js/main.js` 及其 `js/core/`、`js/data/`、`js/features/`、`js/routes/` 模块、`js/mobile-shell.js` 和 `js/ui-motion.js`。新增或修改任何公开 CSS、JS、图标、壁纸或强视觉资产时，必须同步 `index.html` 中对应 query；同一发布批次使用同一可追踪版本。
- 移动 Home 使用 App grid，真实 Dock 在 Home 与栏目 App 内持续悬浮；Dock 只保留 Home、Knowledge、Videos、Tools（内部 `resources` route）、Games、Chatroom 六个高频入口，Blog 与 About 仍从 Home 进入。六项在 375px 以上居中，359px 可短距离横滑；进入排除路由时选中底板必须隐藏。Dock 仍可由 44px 横线收起/展开，栏目内只保留单一 Appbar。
- Home 的 App grid 必须按 DOM 顺序从左到右、从上到下填充并使用固定行高；不得用 `1fr` 弹性行把图标在细长屏幕上纵向摊开。App 按钮热区应与可见图标加标题的实际盒接近，不得把整列或大块空白变成点击区，同时仍保持 44px 最小触控目标。
- 移动栏目保留可辨认的 App 外框和内容卡边界，但工具／筛选／标签区不得层层重复完整描边；优先用间距、浅底色和单侧 accent 建立层级。边框颜色从本站四时段/Neo-XP token 取值，修改后必须重测可读容量和子项相交，不能挤掉正文、聊天日志或按钮。
- 移动端固定复测 359x500、375x667、390x844、430x932 和 coarse pointer 横屏 844x390；至少验证 Home、Chat、账号弹窗、文章详情、视频弹窗和底部返回路径。验收不能只看“没有横向溢出”：App 窗口应至少占视口高度 80%，Games 列表要使用可用高度；359x500 Chat 普通房日志可读区至少保留 160px，私聊展开至少保留 115px 或提供可折叠工具区，844x390 横屏至少保留 150px，同时安全说明、输入、反馈和 Dock 不得相交。文章首屏必须在 359x500、390x844、844x390 精确测量：第一段至少显示 20px，正文总可见量至少为 44px、200px、44px，侧栏 computed min-height 不大于 1px。文章进度与回顶控制应放在移动 Appbar 的空余区域，不能覆盖复制按钮或正文。
- 懒加载 route CSS 必须插在 `link[data-mobile-shell-style]` 之前，固定保持基础样式 → route → mobile → motion 的级联顺序；不得 append 到文档末尾反向覆盖移动几何。收起 Dock 必须同时设置 inert、aria-hidden 和视觉隐藏，不能只用 opacity / pointer-events；目录列表与按钮使用文章实际语言，目录导航标签使用界面语言，带交互子项的横向容器不能再成为重复 Tab 停靠点。
- 手机文章阅读把回顶等控制放入 Appbar 可见区域时，必须同时检查视觉层和真实 hit-testing：固定 `.xp-topbar` 的装饰/空白区域不得拦截正文中的控制，Appbar 内返回、复制、账号等真实交互节点仍需单独恢复指针事件。
- 移动排版以“包含且不相交”为硬门槛：卡片内标题、摘要、元信息和 CTA 必须完全位于卡片内，结构子项不得伸进下一张卡；输入框、计数、发送按钮、密码房操作和 footer 文案不得相互覆盖。不得靠把按钮缩到 44px 以下、把反馈字缩到难读或用 `overflow: hidden` 掩盖排版错误来通过验收；横竖屏与 zh / en / ja 长文案都要做真实几何检查。
- 工具区同一列表中的工具卡必须共享同一网格列宽和卡片高度节奏；标题、元信息、说明、标签和 CTA 要在 zh/en/ja 与桌面/手机上对齐，窄屏元信息应自然换行，不得用 `nowrap`、隐藏滚动条或裁剪吞掉状态与日期。
- 搜索／筛选重绘必须保留键盘上下文：Knowledge 使用 NFKC 归一后的多词 AND 匹配，并在搜索、清空、分类切换时同步复位真实列表滚动与 History；Videos／工具区（内部 `resources` route）替换分类 DOM 后恢复同一筛选按钮焦点，空视频分类优先提供“显示全部”主操作。
- 首屏语言 query 只接受 zh／en／ja，并在壳脚本前尽早同步 `html.lang`。文章卡与详情按 API 实际内容语言设置 `lang`，包括 fallback；移动语言按钮必须显示完整当前语言，并在可访问名称中同时说明当前与下一语言。
- 手机工具区卡片不得裁剪说明，事实字段、标签和主 CTA 分层且 CTA 保持至少 44px；Games 卡直接显示全部语言支持，简介最多三行，许可／来源使用至少 44px 的原生 `details/summary`，后台刷新失败时保留并标示上次成功列表。
- Quick Transfer 的 `quick-transfer-icons-source.png` 是洋红键构建源，不能在页面中引用，也不能直接 resize 覆盖生产 atlas。必须通过 `scripts/build-transfer-icon-atlas.mjs` 先色键和边缘去色，再生成 168×168 RGBA 图集；测试同时检查 alpha、整体透明率以及 16 个 sprite cell 的四角透明与可见像素比例。修资源入口时要检查整张图集，不能只看第一格。同一 Sharp / libvips 运行时的双次构建应逐字节一致；Windows / Linux 之间不得把 PNG 压缩流当作稳定接口，跨平台门禁应解码 RGBA 并用严格像素差阈值比较。
- 工具区（`resources`）→ Quick Transfer → 工具区必须恢复打开前 `resource-categories` 与 `resource-list` 的精确 hidden 状态和列表几何，loader 与实现层不能用无条件显示互相覆盖。Windows 的直接 Chrome `--window-size` 在窄屏可能被钳制到约 500 CSS px；359×500 / 375×667 / 390×844 / 760×900 / 844×390 必须用 CDP 精确 viewport 并先断言 `innerWidth`、`innerHeight` 与 `visualViewport` 后再采信截图。Windows Headless 保存视觉证据时不要用可能空白的 `fromSurface: false`，也不要信任可能漏掉固定合成层的单帧结果；先预热捕获、等待双 `requestAnimationFrame`，再保存第二张 `fromSurface: true` 并逐张确认顶栏与 Dock。
- 全站关闭指针驱动视差，不得通过鼠标或触控位置移动壁纸、系统栏、窗口或内容层。慢速壁纸氛围只允许使用与输入无关的 `transform` / `opacity`，并在页面隐藏、`prefers-reduced-motion`、`data-motion="reduced"` 或 `off` 时回到稳定静态状态。
- 大面积页面、窗口和弹层只允许动画 `transform + opacity`，禁止动画 `filter`、`box-shadow`、`border-radius`、`left/top`、`width/height`，也禁止大面积 3D 透视或书页翻动。统一时长约为 instant 80ms、fast 140ms、standard 200ms、window 220ms、scene 300ms；指针按压采用约 140ms 按下、90ms 松开的非对称节奏，键盘不得复用该等待。`reduced` 与 `off` 必须立即提交导航和状态。
- 在线状态、托盘图标和其他状态提示不得持续闪烁。移动和桌面过渡都要短促、可中断，并禁止通过整页 `transform` 破坏 fixed 元素的包含块。
- PC 任务栏连接状态只能在 `/api/health` 返回 `2xx + ok:true + db:true` 后显示在线；浏览器 `online` 事件只触发复查，不能直接宣称恢复。检查中、服务异常、离线必须同时用文字和独立状态灯表达，支持键盘重试与三语播报；页面隐藏时中止探测，移动 Dock 不重复放置该托盘。
- 四时段移动竖版壁纸与位图 UI 资产使用 image2 生成并复制到项目资产目录；不要显示无法对应用户真实设备的模拟信号、Wi-Fi 或电量状态。不要把 Codex 临时生成目录或本地 QA 输出目录写进公开页面，QA 截图不提交仓库。
- 壳层改造必须保持现有公开路由、Pages Functions API、D1、HttpOnly 账号会话、游戏云存档、普通大厅与前端加密密码房、三语内容、视频系统和遥测隐私边界不变，除非用户另行明确授权功能变更。

## 关于我社交图标规则

- 关于我窗口的 X、GitHub、Bilibili、Instagram、Discord 入口必须保持小图标按钮展示，不额外增加可见平台文字；可为辅助技术保留 `aria-label`。
- 社交链接公开读取接口为 `GET /api/social-links`，后台维护接口为 `GET /api/admin/social-links` 和 `PUT /api/admin/social-links`。
- 社交链接运行时配置保存到 D1 `site_runtime_state` 的 `about_social_links` key；公开接口只读，修改必须走后台 admin 权限。
- 保存链接只允许 http(s) URL；不要支持 `javascript:`、`data:`、相对路径、任意 HTML 或把管理员填写的链接文字插入为可见文案。
- 维护关于我社交入口时，如改动 `js/main.js`、`css/style.css` 或 `admin/admin.js` / `admin/admin.css`，必须同步更新 `index.html` / `admin/index.html` 对应资源 query。

## 日本語の裏側维护规则

- `/tools/japanese-subtext/` 是可独立打开的工具；标题随界面语言显示为中文“日语的言外之意”、English “Behind the Japanese”、日本語“日本語の裏側”。题库固定为按 `contentVersion` 管理的分批 JSON，不为单关新建 HTML，也不得把 250 关整体内联进 `js/main.js`。
- 每次公开修改工具界面、交互或维护流程，独立 `appVersion` 固定增加 `0.0.1`，并同步 manifest、前端可见版本、工具区卡片、缓存、构建守卫和更新记录。只有题库结构、内容哈希或存档兼容边界变化时才增加 `contentVersion`，再同步题库、音频、API 与迁移说明；UI 热修不得伪造全库迁移。完整清单以 `tools/japanese-subtext/MAINTENANCE.md` 为准。
- 已发布关卡 ID 是持久主键，不得随意修改、重排或复用。修改关卡必须增加该关 `revision`；题库结构或兼容边界变化时再增加 `contentVersion`，并提供可解释的存档迁移策略。
- 先完成日语、语用和游戏性审校，再用构建器锁定文本。只有 `textLocked` 与内容哈希有效后才可生成正式音频；句子和日语选项使用可审校 `readingJa`，词块使用 `reading`，其他日语表记先经 PyOpenJTalk 转为明确假名再进入 G2P/Kokoro，画面继续显示原汉字表记。修改台词、读音、声线、语速或发音配置后，只重建最终任务哈希受影响的场景、句子、词块和选项。
- `content/*.json`、`audio/manifest.json`、各关时间轴和静态音频必须始终以稳定 ID 同步。v4 manifest 必须把每关 `sourceContentHash`、逐句 cue、reading/phoneme SHA-256、实际 CPU provider、模型/运行时 provenance、输出参数和发音表 canonical SHA-256 与锁定题库精确绑定；完整 P2R 必须保持原始 `j → y` 早于 `ʥ → j`。全量音素复算与 10,088 件音频的 ffprobe / SHA-256 / 静音 / 孤儿文件验证通过前不得发布。
- 本机 TTS 模型、权重、实际 `tts.local.json`、绝对路径与参考声线不得提交。TTS 只能作为本地离线批处理运行，不注册服务、不加入开机启动；批处理结束后必须退出，日常浏览和构建不得加载模型或占用 GPU/内存。
- 更换或新增声线时必须重新核对许可、来源和署名要求。`NOTICE-japanese-voices.md` 及设置面板的三语语音许可入口必须随静态音频一起保留，不使用来源不明或模仿受保护动漫角色的声线。
- 新增工具图标、封面和关卡图优先使用 imagegen/image2 生成并保存项目副本。若图像服务经重试仍因网络不可用，可使用项目内可复现的原创分镜生成器，但必须在插图 manifest 标记 fallback 生成器与自动审查状态，逐关读取 setting、人物、台词、题问和关键道具，且不得宣称为 AI 逐张绘制。当前每关配图为统一线条、网点、边框和 4:3 画幅的原创黑白四格；必须响应式、懒加载、不泄露答案，并由 SHA-256 和尺寸守卫锁定。
- 学习进度只能使用 `japanese_subtext_profiles` / `japanese_subtext_stage_progress`，不得与 `game_saves` 混用。云端从 HttpOnly 会话解析用户 ID，空云端或同步失败不能清空、降级或阻塞本地进度；跨设备合并不得让较新的失败尝试擦除已通关记录的 `firstClearMode`。
- 所有题库字符串使用安全 DOM API / `textContent` 渲染；插图路径限定在本工具 `assets/`，音频路径只从 manifest 解析。播放器只能存在一个活动音频实例，换关、返回地图、页面隐藏和离开页面必须停止旧音频。
- 面向用户的题干、选项和解析不得显示 `line-002` / `line 002` 等内部 ID；中文 UI 和日语题目分别使用中文/日文字体栈。进入关卡不得自动播放，播放不得强制滚动；公开播放器只保留播放/暂停、seek、倍速和文本点击播放。
- 错答后必须始终存在重新答题入口：结果弹窗不得通过关闭按钮、Escape 或外侧点击把页面留在已提交死路；题面保留兜底重答，解析正文之前也要提供重答。下一关只按本次 `attemptCleared` 判断，不得复用历史累计通关状态。
- 修改工具脚本、题库、音频 manifest、公开 CSS/JS 或图片后，要更新对应缓存版本，并同步 `CHANGELOG.md`、`PROJECT_CONTEXT.md`、`README.md`、本 Skill 说明以及唯一一篇三语 `site-updates` 记录。音频管线必须把 Misaki 的音素与音高标记分离，规范化 P2R 音素并对未知符号失败关闭，不能静默丢掉辅音或把音高标记读进成品。发布前运行 `jp-subtext:validate`、`jp-subtext:audio:validate -- --check-silence`、`jp-subtext:test` 与主站 `build`，并复测 359×500、375×667、390×844、844×390、1365×900。

## 前端和移动端检查

改首页、窗口、任务栏、图标、卡片、弹窗、游戏外壳或任意前端样式时，必须检查手机端适配：

- 避免横向溢出。
- 移动端必须按虚拟手机 OS 的 Home / 全屏 App 结构检查，不能只确认缩窄的桌面 XP 布局“还能显示”。
- 避免顶部常驻区域占屏过多；状态区、动态岛式装饰、账号入口和语言入口都要遵守 safe area。
- 避免弹窗超出屏幕。
- 避免游戏 iframe 尺寸过大。
- 所有主要触控目标至少 44x44 CSS px，并验证 `visualViewport` 改变时输入控件仍在底部 Home indicator 与 safe area 上方。
- 确认桌面端和手机端文字不重叠、不被图标遮挡、不从按钮或卡片中溢出。
- 手机端卡片、文案与按钮必须做二维相交检查；单看父卡片自身没有溢出不足以证明子按钮没有压住下一张卡。

## 匿名聊天室安全规则

- 聊天室用户内容必须纯文本渲染。
- 不得用 `innerHTML` 插入访客昵称或消息内容。
- 昵称和消息应使用 `textContent` 或等价安全 DOM API。
- 聊天室必须读取全站统一、服务端验证的匿名身份；不得继续把可编辑的 LocalStorage `visitor_id` 或自由昵称当作身份凭证。消息保持 1-300 字符，空消息不可发送，匿名身份至少 3 秒 1 条。
- 接口单次最多返回 100 条消息。
- 前端聊天室应保持 `after/message_id` 增量拉取：首次进入加载最近消息，有新消息时维持较快刷新，无新消息时逐步降频，窗口不在前台时暂停或降频，用户发送后立即刷新一次；不要每次重复拉最近 100 条。
- 聊天室有两种房间：普通大厅固定 `room_key='public'`，继续用浅色 XP UI 和明文 `content`；密码房用暗色 UI，前端通过 Web Crypto 从用户密码派生 `room_key` 和 AES-GCM 密钥，只提交 `encryptedContent`，后端必须拒收密码房明文 `content`。
- 密码房不得保存或回显明文密码，也不要把密码、密钥、未发送消息或草稿写入 analytics、localStorage、sessionStorage、URL、日志或后台 UI。刷新页面默认回普通大厅，不自动记住密码房。
- `anonymous_chat_messages` 必须保留 `room_key` 和 `encrypted` 字段；读取、发送、随机昵称占用、发送限流和 `after/message_id` 游标恢复都要按 `room_key` 隔离，旧消息默认留在 `public`。
- 修改聊天室表 schema guard 时，必须先用 `ensureTableColumns()` 补齐新增列，再创建依赖新增列的索引；旧 D1 表没有新列时，提前创建 `room_key` 索引会让普通大厅读取失败。
- 仅密码房执行 24 小时无发言清理：房间最新消息超过 24 小时后删除该房全部密文消息并释放房间；普通大厅不能被这条清理规则影响。
- 后台聊天室治理遇到 `encrypted=1` 的消息时，只显示“密码房加密消息”占位，不提供密文内容编辑或后台解密；隐藏、删除、按隐藏用户标识 / 网络来源禁言仍可用。
- 密码房只能称为“前端加密”或“浏览器端加密”，不要承诺绝对安全的完整 E2EE；需要说明弱密码可能被猜中，且网页端加密仍信任当前加载的站点 JS。
- 聊天室接口涉及 D1 表 `anonymous_chat_messages`，远端上线前仍建议执行正式 D1 migration。

## 在线画板与统一匿名身份规则

- 在线画板只放在现有工具区，公开入口固定为 `/tools/whiteboard/`，返回工具区；不得新增、恢复或伪装“资源区”页面、入口、route 或分类。
- 聊天室、画板及后续匿名互动必须共用 `anonymous_identities`、HttpOnly `lusu_anonymous` 凭证、永久 `anonymous_id`、临时名字与稳定颜色。服务端只保存凭证哈希；登录用户也默认使用匿名展示身份，不向其他访客泄露账号名、IP、设备或城市。
- 跨标签改名同步只能广播不含名字、颜色、匿名 ID 或凭证的版本变化信号；聊天室和画板收到 BroadcastChannel／storage 信号或重新可见时，必须使用 HttpOnly Cookie 向服务端重新读取身份，并让已入房画板重连完成房内原子查重。不得把身份正文写入 LocalStorage。
- 临时名字必须由安全词根组合生成并提供至少一万种结果，禁止权限冒充词与不安全内容。换名保持约 30 秒冷却和短窗次数限制；每个画板 DO 原子查重，多标签共享同一房内名字，不得显示完整匿名 ID 后缀。
- 密码必须先 NFKC 和 trim，再由 `WHITEBOARD_ROOM_HMAC_SECRET` 做 HMAC-SHA256 稳定映射。不得把明文密码写入 URL、房间 ID、D1、LocalStorage、History、埋点、客户端日志或普通服务端日志；错误信息不得泄露房间是否已存在。
- 画板基础绘图复用 Excalidraw，并保留其 MIT notice；协同使用 Yjs 对象级 CRDT、快照和有界增量，禁止由客户端反复上传完整画布覆盖权威状态。鼠标、选区、绘制中、焦点、暂离与在线状态只能通过 awareness 等效消息广播，不持久化。
- 公共画板与所有密码房当前共用唯一的暖纸、石墨、hachure、高 roughness 铅笔草图默认值；不得按房型分流或只给公共房启用。用户仍可编辑颜色、线宽和工具，未来新增主题必须由站长明确提出。
- 画板 Yjs update 必须在客户端合并和排队，不得把 Excalidraw 每次 `onChange` 直接当作一帧。一次只保留一个 in-flight update，Worker 必须在文档增量与元数据已持久化后才回 `update-accepted`；回执前断线、`rate_limited`、`sync_budget_exceeded` 或回执超时必须重连并幂等重传，不得清空未确认队列或统一报为不可恢复权限错误。
- 没有 Yjs 文档变化就不得产生文档写入。可见连接的普通保活必须优先使用 `setWebSocketAutoResponse()` 静态应答，不能周期唤醒休眠 DO；标签页长期隐藏时先排空未确认更新再停放连接。空公共房不得周期轮询，空密码房只保留真实待办与 24 小时删除 Alarm；连续绘制的 D1 房间摘要必须低频于 DO 权威事务。短暂连接波动保持无感，持续波动只显示延迟且不遮挡画布的小状态，不得弹通用大横幅。
- 每个房间由 external binding `WHITEBOARD_ROOMS` 路由到独立 `WhiteboardRoom` Durable Object；保持 WebSocket Hibernation、SQLite-backed storage、票据 `jti` 原子消费、房间隔离、断线宽限、auto-response 活性判断与重连。`workers/whiteboard/wrangler.jsonc` 的 `v1` migration 和 namespace 上线后不得删除、改名或重写。
- Pages Functions 必须配置用途独立、随机且至少 32 UTF-8 bytes 的 `WHITEBOARD_ROOM_HMAC_SECRET`、`WHITEBOARD_TICKET_SECRET`、`WHITEBOARD_INTERNAL_SECRET`、`WHITEBOARD_IP_HASH_SALT`；Worker 只读取与对应 Pages 环境相同的 `WHITEBOARD_INTERNAL_SECRET`。Preview 和 Production 均隔离真实值，任何真实值不得提交。
- 图片只接受严格容器边界、关键块段、声明尺寸、像素和容量校验后的真实 PNG/JPEG/WebP 字节；该边界不宣称完整像素解码。图片保存到私有 R2 `whiteboard/v1/<roomId>/<assetId>`；画布只保存资源 ID 与权威元数据投影，不长期保存大 Base64，不允许 URL、危险 SVG／HTML 或跨房读取。Agent 图片上传／原图读取必须额外要求非默认 `whiteboard:assets`，scene 图片分支只接受已完成 R2 提交的当前房 `ImageMeta`，由可信内部 header 向 DO 表达授权；普通 write-only Agent 继续拒绝图片。上传必须以独立 operation ID + byte hash 幂等，pending 资源不能被场景引用，锁定房不能新传或续传。场景仍只追加，可复用未修改的规范资源记录和多次放置同图，但不得改删既有元素／资源或创建孤立资源。
- Pages 全局 mutation gate 必须先执行精确同源检查，再只按完整方法、路由段和规范化 MIME 识别白板二进制入口：`POST /api/whiteboard/assets` 与 `POST /api/whiteboard/agent/assets` 仅限 PNG／JPEG／WebP，`POST /api/whiteboard/agent/scene` 仅限 `application/vnd.yjs-update`。不得使用前缀、通配路径、`image/*` 或 `/agent/*` 宽泛豁免，也不得在门禁 helper 中消费正文。安全 CLI 请求只能继续进入后续 Agent Bearer、scope、tokenId 绑定房间令牌、operation ID、正文／容量和图片／只追加场景校验；回归必须锁定精确入口缺令牌为 401、跨源为 403 且 schema 未写入、相邻路径／错误方法／错误 MIME 为 415。
- 在线画板的入口图标、插画与装饰素材只允许使用 image2 生成并保存为项目内图片；每项素材 manifest 必须锁定 generator=image2、生成/发布尺寸、最终 SHA-256，并列出仅允许的机械 resize，守卫同时校验真实图片。不得用 CSS、Canvas、SVG 路径或代码几何拼凑素材；CSS 只承担布局、状态和响应式交互。
- 公共房 `public-v1` 永不按空房 TTL 删除。密码房最后一条有效连接关闭或心跳超时后写 `emptySince` 与 `deleteAt = +24h`；重入取消旧 Alarm，再次为空重新计时。Alarm 必须再次检查连接、截止时间和代次，幂等清理房间 R2 前缀、D1 索引与 DO 状态，失败时重试。
- 在线画板和 Quick Transfer 是根项目下的独立子项目，治理根分别为 `docs/whiteboard/` 和 `docs/transfer/`。修改各自 `project.json` 定义的 tracked paths 时，必须把该子项目 `VERSION` 和显示版本相对基线精确增加 `0.0.1`，在独立 `CHANGELOG.md` 写本次版本，并同步 `README.md`、`AGENTS.md`、其他受影响文档与根 `CHANGELOG.md`。共享能力适配器或目录元数据一旦新增／改变某个受管工具的能力域、固定入口或协议语义，必须先把专属契约抽到该子项目可追踪的路径并正常升版，不能因实现文件位于通用目录而绕过治理；也不能用宽泛共享路径让无关的视频／游戏改动误触子项目升版。多个子项目共用一个可见目录文件时，`visibleVersionChecks` 必须用项目专属锚点、有界窗口和含 `{{version}}` 的精确模板锁定本项目条目，不能用全文件 `includes(version)` 让其他条目的同版本号掩盖漏改。主站或另一子项目发版不得仅为统一发布字符串而滚动未改变子项目的内部 asset cache key；真实修改受治理 loader 时仍必须正常升版。`AGENT.md` 仅可指向唯一权威 `AGENTS.md`，不得复制出第二份漂移规则；提交前必须在当前分支相对 `origin/main` 运行 `npm run check:subprojects`。
- 保留服务端人数、连接、消息、对象、文档、图片与频率上限；Origin、匿名凭证、房间票据、IP 哈希限流、跨房资源访问和异常连接都必须 fail closed。日志不得记录明文密码、完整画布、完整 IP 或公开完整匿名 ID。
- 管理后台必须复用 `users.role = admin` 鉴权，提供概览、房间状态、容量、短错误码与去重错误／自动清理聚合计数、公共房清空／锁定、连接移除、匿名 ID／IP 哈希临时封禁及空密码房删除；默认只显示截断标识，危险操作保持确认与审计。错误指标不得保存请求载荷或画布内容。
- 发布前执行本地 D1 migration、Lint、类型检查、全量测试、`whiteboard:test`、生产构建和跨会话／移动视口验证。获授权后先远端 D1 migration、再部署 DO Worker、核对 external binding，最后合并 `main` 触发 Pages；未完成远端检查时不得声称已经上线。
- 回滚时先阻止新连接并回滚 Pages 入口或 binding，再部署兼容的上一版 Worker；保留 DO namespace、`v1` migration、D1 表、快照、Alarm 与 R2 数据。完整协议、限制和操作顺序以 `docs/whiteboard/README.md`、`workers/whiteboard/README.md` 和 `cloudflare/README.md` 为准。

## 游戏区规则

- 游戏列表由 `js/routes/games.mjs` 通过 composition root 注入的 route fetch 读取 `games/catalog.json` 生成。
- 每个游戏保留独立目录：`games/<game-id>/`。
- 游戏页统一使用 `games/game-shell.js` 和 `games/game-shell.css`。
- 新增游戏时必须在 `games/catalog.json` 补齐：
  - `id`
  - `entry`
  - `sourceEntry`
  - `license`
  - `storage.keys`
  - 必要时补 `storage.defaults`
  - 中文 / English / 日本語 的支持情况
- 如果 `storage.keys` 不完整，导出和云存档会找不到对应游戏存档。
- 后续新增游戏时，必须在游戏标签或信息里标明中文、English、日本語是否支持。
- 为游戏增加 Agent 前必须先审计代码与素材许可证、来源、归属和完整许可证文本。强 copyleft 实现未经单独兼容性评估与站点所有者明确许可证决定，不得静态导入主站通用 `lib/capabilities/`、`cli/` 或 `mcp/local/`；采用独立进程时，引擎、状态、CLI、MCP、测试、许可证与 NOTICE 都留在游戏自己的目录，只通过进程启动边界使用，也不得把“隔离模拟”描述为浏览器配对或接管。
- 跨平台许可证完整性测试只能把 CRLF 规范成 LF 后再比较固定正文 SHA-256 与副本全文；不得跳过 hash、仅匹配标题、改写正文或做其他宽松归一化。这样允许 Windows Git checkout 的换行差异，但任何真实许可证内容变化仍失败关闭。
- 游戏目录下只供本机运行的 Agent 子树不得因 `games/` 整树复制而进入 Pages `dist`；在 `config/public-production-build.json` 按完整前缀排除，避免只删 `package.json` 后散发不可运行的残缺程序。对应 preferred source、许可证与 NOTICE 必须仍在公开源码仓库可得，浏览器游戏所需许可证不能随本地 Agent 一起排除。
- 游戏机器目录必须逐项返回真实 Agent profile：`localSession`、`browserBridge`、`browserPairing` 和 `surface`。`surface` 只允许表达已经实现的 `integrated`、`dedicated-process` 或 `none`；目录可发现、浏览器有存档、或存在独立模拟器都不能自动推导页面控制能力。
- 五游戏共享壳必须固定为单一 `100dvh` 网格：外层 document 横／纵都不滚动，iframe 获得工具区之外的剩余高度并作为游戏内容滚动主体。359×500、390×844、844×390 要测量外层滚动、iframe 可达性，以及返回、登录、下载、导入、云存档／冲突操作的 44px 热区，不能只看截图。
- 上游游戏嵌入本站后不得保留固定桌面宽度、与本站无关的第三方统计、原站账号同步、localhost／原生开发桥接或未使用主题触发的外部字体请求。窄屏 document 必须满足 `scrollWidth <= clientWidth`；A Dark Room 声音提示维护 zh／en／ja，并在同页 resize／orientationchange 后重算滑轨、偏移和资源面板归属；Kittens Game 固定关闭 Google Analytics、KGNet 和 `localhost:7780`，首屏只加载当前主题、切换时按需加载，把 iframe `lang` 同步到站点语言，且窄屏顶部工具栏自然换为两行，Steam／Version 不裁切、全部可见关键控件至少 44px，同时不得破坏本站 localStorage、JSON 备份与账号云存档。
- Life Restart 的移动几何只能在粗指针运行时启用：主操作与所有当前可见的 `btn*` hitArea 均不得小于 44px，竖屏把工具操作与主流程分开，短横屏把工具放到底部横排；细指针桌面几何必须保持上游原样。升级上游或调整补丁后，要分别验证粗指针竖屏、粗指针短横屏与细指针桌面，不能用全局缩放或永久改写桌面布局换取移动达标。
- 网站切换语言时，游戏区优先展示对应语言。
- 如果游戏不支持当前语言，默认启动英语版本。
- 本地验证游戏区不要直接打开 `file://`，应通过静态服务器访问，因为主站会 `fetch("games/catalog.json")`。
- `a-dark-room` 的 jQuery 已改成本地 `lib/jquery.min.js`，不要恢复成外部 CDN。

当前游戏特定注意点：

- `kittens-game` 语言设置使用 `com.nuclearunicorn.kittengame.language`。
- `a-dark-room` 语言参数使用 `lang`，简体中文对应 `zh_cn`。
- `a-dark-room` 入口仍需要保留 `ignorebrowser=true`。
- `life-restart` 来源为 `VickScarlet/lifeRestart`，接入时只提交上游 `template/public` 构建产物复制后的 `games/life-restart/source/`，不要提交临时源码、`node_modules` 或上游工作目录。
- `life-restart` 上游构建步骤为 `npm.cmd install`、`npm.cmd run xlsx2json`、`npm.cmd run build`（上游 README 使用 pnpm，本机没有 pnpm 时 npm 可执行同名脚本），产物目录为 `template/public`。
- `life-restart` 上游 Vite 配置 `base: './'`，静态资源应保持相对路径，适合 Cloudflare Pages 子目录 `/games/life-restart/source/`。
- `life-restart` 语言只支持中文 `zh-cn` 和 English `en-us`，暂无日本語；站点日语界面进入时应默认启动 English。
- `life-restart` 启动语言 query 参数名是 `language`，不是默认 `lang`；`games/catalog.json` 必须保留 `languageQueryParam: "language"`。
- `life-restart` 已知本地存档键为 `theme`、`times`、`extendTalent`、`ATLT`、`AEVT`、`ACHV`、`uniqueWaTaShi`，新增或升级上游版本时必须重新检查 `localStorage` 用法并同步 `games/catalog.json`。

## 账号与云存档规则

- 账号系统只服务于游戏自动云存档，不影响普通网站浏览。
- 游戏本体仍然使用浏览器 `localStorage`。
- 游戏本体的存档可以继续使用共享 `localStorage`，但客户端已知的云端 `updatedAt` 基线必须使用标签页级 `sessionStorage`（失败时仅退回当前页面内存）。无本标签页基线且本地、云端同时存在时必须进入冲突处理，禁止读取其他标签页留下的版本号后自动上传。
- `games/game-shell.js` 负责收集 `games/catalog.json` 里声明的 storage keys。
- 登录后进入游戏页，会读取云端存档。
- 如果云端存档比本地已知存档更新，必须先锁住全部上传入口并显示三语冲突处理；取消、Escape、外点、自动计时、隐藏页、退出和导入都不得覆盖较新的云端数据。
- 冲突窗口必须保留下载本地 JSON 备份、恢复云端、明确用本地覆盖当前云端版本和暂不处理；覆盖动作也必须经过服务端版本校验，不能使用原生 `confirm()` 后无条件 PUT。执行“恢复云端”前必须重新 GET；若云版本已变化，应刷新冲突信息并重新确认，不能落地弹窗打开时的旧快照。
- 每次存档 PUT 必须携带最近 GET／恢复／同步得到的精确 `expectedUpdatedAt`；首次创建显式传 `null`。服务端用原子 insert-only 或 `WHERE updated_at = ?` update，未命中固定返回 `409 + SAVE_CONFLICT`，禁止“先读再无条件写”。
- 自动同步间隔：30 秒。
- 切出页面时会尝试 flush 游戏自己的保存函数并同步；冲突锁定或云端版本尚未就绪时必须跳过上传。
- 密码使用 PBKDF2-SHA256 哈希。
- 会话使用 HttpOnly cookie：`lusu_session`。
- 单个游戏存档最大约 1MB。

## 数据库化三语文章规则

- 文章内容保存在 Cloudflare D1，网站代码仍保存在 GitHub。
- 文章通用信息使用 `articles` 表，三语内容使用 `article_translations` 表。
- 每篇正式发布文章应一次性提供 `zh`、`en`、`ja` 三种内容；第一阶段不做自动翻译。
- 不要新增自动翻译 API、翻译按钮、`translate` 或 `retranslate` 管理接口。
- 前台文章列表和详情必须按当前网站语言请求：`/api/articles?lang=zh|en|ja` 和 `/api/articles/:slug?lang=zh|en|ja`。
- 文章读取 fallback 顺序为：当前语言 -> 中文 `zh` -> 任意已有语言。
- 文章详情公开地址使用 `/articles/<slug>`，必须能通过 `https://lusu575.com/articles/<slug>` 直接分享和恢复单篇文章详情；内部 `article_id` 只用于数据库和后台管理，不能在公开链接或公开 API 中外显。旧的 `#knowledge/article/<slug>` 只作为兼容入口保留。
- 文章正文使用 Markdown 保存；前端渲染必须防 XSS，不能把未经处理的 Markdown 或 HTML 直接作为 `innerHTML` 插入页面。正文和显式图片图注里的 Markdown 链接只允许无账号凭证的绝对 HTTPS URL，并用 `createElement("a")`、`textContent` 和净化后的 `href` 构建；相对地址、危险协议、HTTP 及带用户名或密码的 URL 保持不可执行文字，外链固定 `target="_blank"` 与 `rel="noreferrer noopener"`。
- 文章正文可以使用安全的基础 Markdown、有序/无序列表、blockquote、`text` 代码块蓝色说明框和 `assets/images/articles/` 下的白名单文章图片；新增文章图片必须复制到项目资源目录，不要引用本机临时路径，并为已知图片登记真实宽高以稳定懒加载前布局。最终内容哈希 query 在对应资产真正部署前不得向正式域名发起请求，否则 SPA 回退 HTML 可能占用同一 CDN 缓存键；部署前检查使用部署预览域名或额外的临时非最终 query，部署成功后再用正文中的精确 URL 核对 200、MIME 和完整 SHA-256。若最终键已经被错误响应缓存，必须清除该精确缓存键或改用仍与真实字节绑定的新内容哈希键。
- 后台文章管理接口必须要求登录用户 `role = admin`；普通登录用户不能新建、编辑、删除或发布文章。
- `daily-ai-news` 是固定的“每日 AI 新闻 / Daily AI News / 毎日AIニュース”知识库分区；它应在筛选栏持续可见，即使没有已发布文章也不得消失。已删除的测试占位文章不得由 seed、fallback 或迁移重新补回。
- `tool-radar` 是固定的“工具雷达 / Tool Radar / ツールレーダー”知识库分区；即使暂时没有文章也保留入口，并固定排在 `daily-ai-news` 之后、普通分类和 `site-updates` 之前。它使用普通知识库摘要与目录规则，不得套用每日新闻隐藏摘要或逐条新闻目录的特例。
- `site-guides` 是固定的“网站使用指南 / Website Guides / サイト利用ガイド”知识库分区；即使暂时没有文章也保留入口，固定排在 `daily-ai-news`、`tool-radar` 之后、普通分类和 `site-updates` 之前。这里用于口语化、简单的站内功能攻略；把多个工具写在同一篇文章时必须明确它们仍是独立功能，不能暗示房间、密码或状态互通。涉及真实界面时优先使用匿名临时状态下取得的电脑端与手机端实拍图，截图不得包含密码、访客消息或个人信息，文章图登记原始尺寸并使用内容哈希 query；最终 query 只在资产上线后向正式域名验证，不能提前请求并缓存回退页。
- 每日 AI 新闻机器投递固定创建该分类的 zh / en / ja 三语文章；服务端固定非置顶、无封面，不接受调用方指定其他分类或发布状态。默认保存为草稿；仅 `daily-ai-news` 专用通道的显式 auto-publish 配置开启时，服务端才创建已公开文章并写入公开时间，其他情况仍须后台手动发布。
- 投递通道默认暂停，专用令牌只在生成／轮换时显示一次并仅保存哈希；入口必须保留正文上限、限流、幂等和 slug 冲突保护，事件记录不得保存正文或完整令牌。相同幂等键只有在规范化内容指纹一致且原草稿仍存在时才能成功重放；内容变化或原稿删除要明确冲突。未鉴权请求不得触发文章 seed。令牌撤销、通道暂停、auto-publish 关闭、验证失败或超时都必须关闭公开路径，不得留半公开文章。
- 每日生成适配层固定放在 `自动新闻/integrations/lusu-site/`。任何一期开始前必须完整读取同目录 `ARTICLE_STYLE.md`，不得临时更换内容型标题、三段栏目、事实段或 AI 解读格式。三语文章标题必须分别使用固定栏目名前缀加各自正文第一条要闻标题，不能只写日期；日期继续由发布时间与 slug 表达。生产运行固定每天 `Asia/Shanghai` 07:00 开始，窗口为此前精确 24 小时、左闭右开 `[前一日 07:00, 当日 07:00)`；随后运行带 `--start` / `--end` 的 `npm.cmd run ai-news:horizon:fetch`，由 Horizon 原生抓取器完成多源采集、网址规范化和跨来源去重，并把真实窗口、`runId`、`daily_candidates.json`、紧凑 candidate index 与 coverage manifest v2 写进运行记录。`horizon.config.json` 当前虽指向本地 Ollama `qwen3.6:27b`，正式入口仍只调用抓取、来源重试与去重，不调用 Horizon 原生 AI 评分或富化；不得把“已有模型配置”误写成“模型已参与正式生产”。精确窗口内 candidate index 的全部候选都必须进入完整发现审阅，不能只审聚焦查询、指定来源或 priority。公开正文的标题后必须直接进入首个栏目，不显示摘要、采集窗口或筛选说明；每条新闻使用唯一三级标题，供文章目录逐条列出全部新闻标题，目录不得只列三个栏目名。自动任务的抓取、核验、三语生成、投递和受控公开必须在 08:00 前完成；Horizon 不可用、无合格稿、校验失败或超时均停止且不发布，自动任务不得自行转入迟到补发，也不得以 Codex 手工浏览冒充自动采集。只有站长在交互任务中明确要求当天补发后，才可按 `MANUAL_RECOVERY.md` 在当天 08:00 至次日 00:00 使用日期与 canonical 稿件 SHA-256 双确认入口；固定窗口、schemaVersion 4、Horizon／覆盖产物、三语、通道、auto-publish、幂等和公开回读门禁全部不变。
- 发现层不得按语言排除来源；可靠的中文、英文、日文、韩文及其他语言来源都可进入复核，并应使用重点实体的英中日韩常用别名帮助发现。required query／entity group 至少覆盖 Anthropic、OpenAI／GPT／Sam Altman／Codex 关键人物与产品运营变化、Thinking Machines／Inkling、LG AI Research／K-EXAONE 等开放模型与韩国模型实验室、Kimi／月之暗面、智谱／GLM、千问／Qwen／千问办公、MiniMax、DeepSeek、混元、美团 LongCat／CatPaw、微信 WeLM、字节跳动／豆包／Seed 等模型厂商，以及 Seedance 等视频、图像、语音多模态产品的发布、延期、API、权重与可用范围变化；芯片／光刻／存储、机器人、智能设备、数据中心能源／散热／网络和科技金融也在范围内。宽泛的大型 OR 查询只能补充召回，不能代替重点人物、产品或单一厂商的独立 required 查询。字节跳动固定拆分豆包中英产品动态、Seed 通用模型、SeedRealtime／Seed-ASR／Seed-TTS／全双工语音和 Seedance／Seedream／Dreamina 创意模型查询；综合 `bytedance-models-zh` 只作补充。
- 韩国开放模型的 required 发现固定拆为五条互补韩文查询：EXAONE 开放／权重、EXAONE 普通发布、显式排除 EXAONE 的 LG AI Research 其他模型、NAVER／HyperCLOVA、Upstage／Solar。五条都必须保持 `required + mustReview + open-models + open-weight-releases`；EXAONE 开放与普通发布用动作排除词避免明显重叠。不得恢复跨厂商 `korean-model-releases-ko` 宽查询；任一分片再次触发 99+1 真实截断时，继续按厂商或事件动作缩窄并保留完整签收，不能跳过韩文或把截断签成成功。
- 发现查询必须把成功空结果与抓取／解析失败分开记录。Google News 等发现源使用低并发和有界重试；Google News 最多保留 99 条并请求第 100 条作为结果上限探针，实际返回第 100 条才标记截断并关闭 required 覆盖，只有 99 条不能误报。高流量的跨厂商查询只能作补充，required 产品动态查询必须按厂商和语言拆分；正式入口默认只回看 24 小时，再按实际启动时刻扩到足以覆盖精确窗口的整小时数，不能用固定 48 小时的窗口外旧消息挤占结果名额。时间资格必须使用事件当前阶段第一次由可靠来源公开的时间，不能用 Google News／RSS 聚合收录、刷新时间或社区发帖时间代替。重试后仍失败时不能把内部错误后的空数组算作“完整成功”。candidate index 必须以确定性 UTF-8 字节写盘，SHA-256 对实际写入的同一字节计算，避免 Windows 换行转换破坏来源证明。
- 新 manifest 使用 `priorityReviewPolicy: all-discovered-candidates`，并把精确窗口内全部候选加入 `complete-discovery-review` 通道；兼容字段 `mustReviewCandidateIds` 必须等于 candidate index 全部编号。每个候选都在 `coverageAudit.priorityReview` 中恰好处置一次：选入、并入同一事件，或用允许的理由具体说明拒绝；`priorityReview` 只是既有 schema 字段名，`priority` 只控制审阅顺序。2026-08-07 起的新 manifest 必须同时声明 `protectedEventReviewPolicy: evidence-backed-protected-events-v1`，删除该字段也会 fail closed；`coverageAudit.protectedEventReview` 必须独立于低条数 second pass，把全部编辑信号、RSS、受保护类别和 selected／merged 候选按 `eventKey + eventStage` 恰好聚类一次，并为每个事件保留直达可靠 HTTPS 来源、当前阶段首次可靠发布时间、证据摘要和四项具体评分理由。入选事件必须在窗口内核验；无可靠证据时必须 `insufficient-evidence` 且不得伪填时间，Google News、Reddit、Hacker News、Bing 聚合页不能作为最终证据。重大模型／产品、能力／可用性、用量规则、实用开发者工具或可信且显著的价格／额度变化按读者实际可用性使用同一 7 分门槛；达到门槛后不得仅以“产品型”“受众较窄”为由拒绝。候选标记 `usage-policy-change` 时必须归类为 `usage-policy` 或 `material-price-quota`，不能以重要性不足、例行消息或超出范围拒绝；普通 token、推理内存、模型路由或性能优化不能获得该标记。同一额度事件选一个代表项，其余来源全部 merged。临时促销、纯娱乐和小型维护可在低于门槛时拒绝；入选项必须用 `sourceCandidateIds` 反查 candidate index。
- 聚焦通道中的模型／产品、能力／可用性、开发者工具、价格／额度、芯片／存储／机器人／智能设备／自动驾驶／数据中心基础设施、重大科技金融和 AI 监管／安全变化必须产生对应 `editorialSignals`，并在评分前归入信号要求的受保护类别；信号只强制深审，不强制刊发。专用信号按用量规则、价格／额度、重大科技金融、监管／安全、芯片／基础设施优先；模型、能力和开发工具多信号可用任一实际匹配类别。`below-importance-threshold` 要求 `substantiveChange: true`，`no-material-change` 要求 false。对新的全候选正式运行，50 条以上候选全部归为 `other`、90% 以上拒稿共用一个完全相同的编辑类别与四项评分模板，或大量拒稿只轮换不超过 8 组评分与不超过 32 种结论模板，都是必须 fail closed 的编辑退化。至少一半受保护事件复用同一证据摘要或四项评分理由也必须关闭投递。不得按候选 ID、hash、数组下标或标题模板生成分类、分数、拒绝理由和证据记录；脚本只能序列化已经逐事件核验完成的判断。初选少于 5 条时，二审时间必须晚于初审，`reconsideredCandidateIds` 必须至少包含全部带信号候选、全部 RSS 候选和受保护类别的 5／6 分拒稿，同时允许添加其他索引候选。
- TechCrunch AI、VentureBeat AI、Ars Technica AI、雷峰网和 36氪只作可选补充。Reddit 与 Hacker News 只用于早期发现；每条返回候选仍须处置，但标题、评论与发帖时间不能单独支撑正式事实或时间资格，必须追溯到官方、可靠媒体或其他一手来源。站长已授权把 Tibo `@thsottiaux` 的 X 帖子纳入选题；移除会返回同名医疗噪声的 Bing RSS，改由 required 的 `codex-operations-en` 聚焦查询检查姓名、账号及 Codex／ChatGPT Work 运营变化。查询返回的 X、媒体和社区索引线索必须审阅，最终事实仍须回到规范原帖、可靠媒体或其他一手来源核验；它不代表完整登录时间线或 X API。
- 新闻数量不得写死，只使用重要性门槛决定收录；初选少于 5 条时必须启动低产量第二轮审阅和定向补查，但 5 条不是最低配额，复核后仍可少于 5 条或报告“今日无稿”，不得凑数。跨日去重按 `eventKey + eventStage` 处理：同一事件同一阶段继续排除，正式发布、正式开源／开放权重等实质新阶段只有在记录前序故事和 material difference 后才可作为更新入选。正文固定为“今日要闻 / 主要新闻 / 传闻”，传闻只靠独立分区和条件语气区分，不逐条重复“未证实”。每条 AI 解读通常一至两句、明显短于正文，只挑关键影响、现实门槛、隐含限制或下一步观察点，不复述新闻，也不为了找问题而硬挑问题。来源 URL、评分与筛选理由只留在内部运行记录，对外正文不得出现网址、Markdown 链接、来源／参考资料章节、相关阅读跳转或内部评分。
- 正式日报使用 schema v4；`npm.cmd run ai-news:validate` 必须反查对应 Horizon 候选文件，验证 candidate index、coverage manifest v2、required query／entity group 签收、required 真实结果上限、candidate index 全部候选逐条处置、`sourceCandidateIds` 映射和低产量第二轮审阅，并检查三语标题均为固定前缀加各自第一条要闻标题、标题后没有公开导语、三段顺序、新闻三级标题唯一、单段事实正文、逐条一至两句且短于事实段的 AI 解读、传闻无重复核实标签。`runs/2026-07-28-coverage-revision.json` 的 manifest v1 仅是按固定 run、路径与 SHA-256 登记的 schema v4 历史兼容例外，不得复制、改写或作为新运行模板；除该精确身份外，正式 schema v4 必须使用 manifest v2 和覆盖全部候选的 `priorityReview`。schema v3 只允许已登记的一次性历史样稿兼容，不得用于新的正式运行；历史 CI 可显式传入仓库内紧凑 provenance fixture，但该入口必须同时校验 one-shot 开关、schemaVersion 3 与登记窗口，schema v4 必须拒绝。不得让 CI 依赖 Git 忽略的完整本地 Horizon 运行目录，也不得删除或绕过格式、来源和覆盖证明。本地试投只允许通过 `npm.cmd run ai-news:deliver:local` 使用进程内临时令牌并走正式机器入口；无论成功失败都要停止预览、暂停通道和清除令牌。2026-07-27 样稿是生产链路测试输入，不能绕过相同的令牌、幂等、冲突、验证和 08:00 截止规则。
- 自动新闻正式 Node 外联必须复用 `自动新闻/integrations/lusu-site/network-fetch.mjs`，由精确锁定的 Undici 读取 `HTTP_PROXY`／`HTTPS_PROXY`／`NO_PROXY`，兼容本机 Clash Fake-IP 和无代理直连环境；不得记录代理值、代理凭证或投递 Token，也不得依赖修改 Clash 配置才能发布。生产 POST 每次执行最多一次；接口明确返回 published 后，三语公开核验只允许对网络错误和 408／425／429／500／502／503／504 做每语言最多 3 次、受原截止时间约束的只读 GET，正文不匹配、非瞬时状态或耗尽后仍 fail closed，绝不重发 POST。
- 工具雷达适配层固定在 `自动新闻/integrations/lusu-site/tool-radar/`，每次运行先完整读取其 `ARTICLE_STYLE.md`。正式任务已获授权，固定于北京时间每周二 22:00 启动；每期目标 6–10 个且少于 3 个就关闭投递。候选可以来自广泛发现源，但功能、费用／免费层、登录、中文支持、本地或 AI 辅助部署、用法、案例与场景必须回到官网或其他一手可靠资料核对，搜索摘要和聚合页不能单独支撑公开结论。首期 `trial + not-delivered` 记录只作历史审阅依据，不得原地改为 production。
- 工具雷达不能只按本期标题临时去重：调用投递前读取已认证的 `/api/automation/tool-radar/catalog`，文章提交携带全部 `tools[]`；服务端以 `tool_radar_catalog.tool_key` 和规范官网 URL 精确唯一约束，并与文章／翻译／事件在同一原子批次落库。任何精确重复都返回冲突，不能只写文章或只登记部分工具。自动唯一键无法自行证明跨域改名后的语义身份；疑似改名、换域名或被收购的产品必须对历史名称、官网和别名做人工目录复核，未排除重复前不得投递。同类能力的不同产品仍可在后续期数出现。
- 工具雷达必须生成 zh / en / ja 完整文章；H1 使用本地化栏目名前缀，并同时写明读者具体痛点、与本期入选数量完全一致的阿拉伯数字，以及至少两个具体任务范围或收益，不能只写抽象主题、隐喻、口号或日期。公开正文可写经过核验的官网链接；每个工具以一张有语义的真实图片为正常目标、最多两张，必须先从网上发现并回到官网、官方功能页、官方文档、官方仓库或官方媒体核实，只允许真实产品界面、官方案例或真实成果。只有权利、稳定性和来源明确并已放入 `assets/images/articles/` 时才允许引用，禁止外部热链和本机路径。正文图片地址必须精确写成 `<assetPath>?v=<SHA-256 前 12 位>`；站点资源必须先经 GitHub `main` → Cloudflare Pages 正常部署，生产预检再按登记顺序请求正文使用的同一精确缓存键，不能用未版本化 URL 代替。对瞬时网络或明确瞬时 HTTP 故障最多尝试三次，但 HTTP 200、与扩展名一致的 MIME、大小和完整远程 SHA-256 任一不合格仍须失败关闭。工具雷达的通道启用、凭证与 auto-publish 均独立于每日新闻，只有显式启用的专用通道和 auto-publish 才可自动公开，调用方不能自行选择公开状态。
- 工具雷达内部 `profile`／`evidence` 的完整事实字段只用于校验、去重和三语对齐，公开正文不得退化为十字段验收表。写作前先确定一句话叙事主线，按读者完成任务的自然顺序安排工具，让整期像口播稿一样从问题、连续阶段走到选择建议，而不是按热度或收集顺序堆卡片。H1 后直接写按本期主题自然命名的利益点式开场 H2，并在其下用恰好两段有依据的真实任务场景导语引出全部工具 H3；每个工具使用以运行记录 `displayName` 开头的利益点式 H3（`### 工具名称｜一句利益点`），正文恰好写三个不带机械字段小标题的自然短段落：第一段先讲它是什么、能做什么，第二段讲它替读者省掉什么、怎么开始，第三段讲有依据的案例或明确标注的示例、适合谁与必要局限；相邻工具用上一节结尾或下一节开头自然接力，不能反复报幕。最后一个 H2 用会话式语气回应开场并给出按任务选择的建议；开场与收尾 H2 都随本期主题自然命名，不套用固定栏目文案。可以表达基于证据的个人编辑判断，但未真实使用时不得虚构亲测、时长或本人效果；局限顺手说明，不设显眼“缺点”框，不堆 emoji，不用夸张、营销或点击诱饵。
- 工具雷达以每个工具一张有明确语义的图片为正常目标、最多两张，并必须按同目录 `VISUAL_METHOD.md` 先写视觉任务卡，再取图与裁切：明确读者问题、视觉结论、必须出现的关键元素、三语图注规划以及单图／双图关系。单图连同图注必须自洽地说明工具、动作或步骤与结果；双图只能形成输入／输出、操作／结果、前后或连续步骤。本站自绘说明图、AI 生成图、统一模板卡、仿界面概念图、搜索结果缩略图和第三方转载图全部禁止，失败时只能重截、继续寻找同一工具的官方真实界面／案例／成果，或从三语稿一起删除。关键内容不得被遮挡或截断；逐张通过三秒测试、正文宽度可读性、版权、隐私、稳定性和本地资产检查后才可进入运行记录与三语正文。采用官方公开页面有限编辑性截图时必须显著注明来源、保存权利边界且不得声称已授权；正式投递还必须验证 Pages 线上文件 SHA-256 与运行记录完全一致。
- 工具雷达每个工具的上手门槛只用一行三语紧凑信息：中文 `**上手信息：** 收费：…；登录：…；中文支持：…；本地部署：…；AI 接入：…`；English `**Practical details:** Pricing: …; Sign-in: …; Chinese support: …; Local deployment: …; AI setup: …`；日本語 `**利用メモ：** 料金：…；ログイン：…；中国語対応：…；ローカル導入：…；AI 導入：…`。三语文章必须保持同一工具、顺序、事实、编辑判断和限制。
- 每次合并代码、上线功能或做可见更新时，必须在知识库 `site-updates`（网站更新记录）分类发布一篇真实文章。
- 网站更新记录文章必须同时写入 zh / en / ja，包含主标题、简短简介和正文；正文要概括本次更新内容。
- `site-updates` 只是按时间排列的更新日志，已有和新增记录都不得置顶；后台写入、seed / schema、Home / Knowledge fallback 与前端排序必须把该分类保持为 `is_pinned = 0`，不能让旧缓存的错误值重新显示置顶标记。
- Knowledge 的“全部”Tab 列表与数量必须排除 `site-updates`；所有网站更新只在 `site-updates` 专属“更新记录”Tab 中显示。不要用仅隐藏按钮或仅改计数的两套逻辑，筛选与计数必须复用同一分类函数。
- Knowledge 首屏 12 条和“加载更多”只是前端渲染分段；公共列表 API 与前端必须共享 `PUBLIC_ARTICLE_ARCHIVE_LIMIT = 500` 并先取得完整摘要归档，使搜索、分类和计数覆盖未置顶旧文章。不得把 API 硬截断回 50 条，否则旧文章及其唯一分类会同时从列表消失。
- 后台文章、视频、视频分类、社交链接及任何会覆盖既有内容的刷新／删除必须携带读取时的 `expectedUpdatedAt`。服务端只允许版本匹配的条件写入，关系表与翻译等附属写入必须和主记录 CAS 原子收口；陈旧页返回统一 `409 + CONTENT_CONFLICT`，前端保留草稿并提示手动合并。
- 后台可编辑的普通 seed 文章不能在冷启动时 upsert 覆盖 `is_pinned`、`updated_at` 或其他管理员维护元数据；默认元数据只在记录缺失时插入。需要修复既有线上值时用 `site_runtime_state` 一次性标记，之后必须继续尊重后台的新选择。
- 这是合并前验收门槛，不是事后可选补记；如果本轮无法走后台发布，也必须在同一次变更中补齐 seed 与 fallback，确认知识库、欢迎弹窗“最近更新”和右上角最新日期都能读到这次更新。
- 如果网站更新记录通过 seed 维护，必须同时更新 `functions/api/[[route]].js` 的 `articleSeedStatements`、`cloudflare/schema.sql`、`js/data/content.mjs` 的完整 fallback `content.updates`，以及 `js/data/home-content.mjs` 的最近五条无正文摘要投影，避免线上 D1、手动 migration、Home 首屏和 D1 不可用兜底显示不一致。
- 首页欢迎弹窗右侧“最近更新”自动读取 `site-updates` 分类文章；不要再把右侧更新列表改回只读写死数组。
- 首页欢迎弹窗“查看更多更新”应跳转到知识库并筛选 `site-updates` 分类。
- 当前主站不提供公开聚合入口；不要恢复相关按钮、发现链接或公开输出接口，除非用户重新明确要求，并同步补齐三语文案、种子、构建守卫和部署说明。
- 修改文章系统 schema、接口、前台知识库渲染或发布流程时，必须同步更新 `PROJECT_CONTEXT.md` 和 `CHANGELOG.md`。
- 文章发布时间和聊天室消息时间必须按用户所在时区显示；文章发布时间不显示时区名，聊天室消息仍按聊天规则显示时间信息；后端保存/返回时间应保持 ISO/UTC 语义，前端格式化时再转换到用户本机时区，避免把 UTC 误当成本地时间。后台文章编辑器里的发布时间应显示为管理员本地时间，保存前转换为 UTC ISO，后端必须再次规范化 `published_at`。
- 从知识库文章详情关闭窗口或返回桌面后，再次打开知识库应回到知识库首页，不应继续停留在上一次文章详情。

## 管理后台与埋点规则

- 凡是后台相关改动，先读取 `admin/docs/ADMIN_PROJECT_CONTEXT.md` 和 `admin/docs/ADMIN_SKILL.md`；需要了解后台私有历史时再读 `admin/docs/ADMIN_CHANGELOG.md`。不要只依赖主站 `PROJECT_CONTEXT.md` 或本 Skill 推断后台细节。
- 管理后台入口固定为 `/admin/`，后台静态页面、样式、脚本应放在 `admin/` 目录，不要混进主站首页窗口、主站 CSS 或主站三语内容体系。
- 后台只需要中文文案；后台项目介绍和后台更新记录必须单独维护在后台内，不写入主站知识库 `site-updates`，也不要在首页最近更新里公开展示。
- 纯后台私有更新不写入主站 `site-updates`；如果后台改动同时改变主站公开可见体验，公开侧仍必须按网站更新记录规则补 `site-updates` 三语文章、schema seed 和 `js/data/content.mjs` fallback。
- `/admin/*` 必须通过 Pages Functions middleware 校验主站 `lusu_session`，只有 `users.role = admin` 的站长账号可以访问；所有 `/api/admin/*` 也必须继续做服务端 admin 校验。
- 后台文章编辑可以按当前选择语言显示单个语言面板，但保存/发布正式文章时必须一次性提交 zh / en / ja 三种标题与正文。
- 主站访问和点击埋点应使用独立 `js/telemetry.js`，避免把埋点逻辑写进主站可见 UI 流程；埋点脚本不得记录输入框内容、密码、正文草稿或聊天输入中的未发送内容；点击目标文本、页面路径、来源、链接、元素标识和点击聚合键中的邮箱样式文本（含 URL 编码和双重编码形态）必须在前端和服务端写入前脱敏。
- 文章访问 PV/UV 使用服务端 `GET /api/articles/:slug` 写入 `article_view_events`，按隐藏 `lusu_visitor` 统计；后台热门文章、文章列表和文章详情的文章 PV/UV 应以该表为准，不要只依赖前端页面级 PV。
- 访客后台识别使用 HttpOnly `lusu_visitor` cookie；该隐藏 visitor_id 不应在前台 UI 或公开 API 中展示。聊天室前端本地 client id 只能用于“我的消息”显示，后台禁言和审计使用隐藏 visitor_id。
- IP 信息只保存 hash 和掩码前缀，以及 Cloudflare 提供的国家、region/省份、城市等来源字段；不要把完整明文 IP 暴露给普通前台。
- 聊天室后台可以编辑、隐藏/恢复、删除消息，并按隐藏 visitor_id 或 IP hash 禁言；公开聊天室接口仍要保持纯文本渲染和频率限制。
- 修改后台 schema、埋点接口、后台 middleware 或禁言逻辑时，必须同步更新 `PROJECT_CONTEXT.md` 和 `CHANGELOG.md`。

## Cloudflare 部署规则

- 正式部署链路是 `GitHub main -> Cloudflare Pages Git 自动部署 -> lusu575.com`。
- 网站代码以 GitHub `main` 为源头。
- Vercel 不再是正式部署入口。
- Cloudflare Pages Git 自动部署不是 Wrangler 手动部署。
- 不要把 `npx wrangler deploy` 或 `npx wrangler pages deploy .` 写成 Git 自动部署命令。
- Cloudflare Pages Dashboard 构建设置固定为：框架预设 `None`，构建命令 `npm run build`，构建输出目录 `dist`，根目录 `/`；根 `wrangler.jsonc` 的 `pages_build_output_dir` 必须同步为 `dist`。
- `wrangler pages deploy .` 只用于本地手动应急部署。

常用检查命令：

```powershell
git status -sb
git log --oneline --decorate -5
$env:XDG_CONFIG_HOME=(Join-Path (Get-Location) '.wrangler-config'); npx.cmd wrangler pages project list
$env:XDG_CONFIG_HOME=(Join-Path (Get-Location) '.wrangler-config'); npx.cmd wrangler pages deployment list --project-name lusu-personal-site
```

期望状态：

- `git status -sb` 显示 `main...origin/main`，无未提交变更。
- Cloudflare `lusu-personal-site` 显示 `Git Provider: Yes`。
- Cloudflare 项目域名包含 `lusu575.com` 和 `www.lusu575.com`。
- 最新 Cloudflare 部署来源应为 GitHub `main` 的最新提交。
- `lusu575.com` 和 `www.lusu575.com` 应指向同一个 Cloudflare Pages 项目和同一个 GitHub `main` 构建产物。

## GPTWork 与运行时 Secret 规则

- 可复现开发基线是 Node.js 22.13+、`npm ci`、固定 Wrangler 版本和仓库中的 lockfile；不得依赖父目录 `node_modules`、本机全局包或未记录的安装步骤。
- 本地 Pages 启动使用 `wrangler pages dev`。纯本地环境先从 `.env.example` 创建被 Git 忽略的 `.dev.vars`；GPTWork 使用平台注入的 process Secrets，不能创建会遮蔽云端值的空 `.dev.vars`。两者再执行 `npm run d1:migrate:local`，且普通开发、CI 和 GPTWork 不得连接生产 D1。
- `DB` 是 D1 binding，不是写入 `.env.example` 的字符串变量。Production 必须检查 `DB` 并配置 `CHAT_IP_HASH_SALT`、`ANALYTICS_IP_HASH_SALT`、`OWNER_ADMIN_EMAILS` 和四个 `WHITEBOARD_*` 画板值；画板还要核对 external `WHITEBOARD_ROOMS` binding。根配置提交态的 Preview 必须使用 `PREVIEW_API_DISABLED=true` 和空 D1/R2/DO bindings，不得引用尚未部署的 Preview Worker；只有独立 Preview D1/R2、DO namespace、Origin 与 Secret 全部配置并迁移，且 Preview Worker 已先成功部署后才可接入 Pages Preview 并开启 API，绝不复用 Production 资源。
- 两个现有 salt 和四个画板 Secret 必须用途独立、随机、至少 32 UTF-8 bytes，不得互相 fallback、使用仓库固定值或写进代码 / 文档 / Git。Pages 读取全部四个画板 Secret，独立 Worker 只读取与对应 Pages 环境相同的 `WHITEBOARD_INTERNAL_SECRET`。运行时配置不合格时必须 fail closed，日志只记录变量名。
- IP hash 固定使用带 `chat` / `analytics` 用途隔离的 HMAC-SHA256。聊天消息与网络来源禁言必须保存非敏感密钥代次；Secret 轮换后旧消息只供审计，服务端必须按消息编号读取当前代次目标并拒绝旧代次禁言，不能只依赖后台按钮状态，也不得恢复旧公开盐。全新库由 `cloudflare/schema.sql` 建列，代次索引放在 `cloudflare/schema-indexes.sql`；`scripts/d1-migrate-local.mjs` 和已有库的 `ensureChatSchema()` 都必须先补列再建索引。
- 普通 GPTWork 开发不需要 `CLOUDFLARE_API_TOKEN`、生产 D1 权限、本机 TTS 配置、模型权重或参考声线。`output/`、`.wrangler/`、`.wrangler-config/`、`node_modules/` 和本地 TTS 配置不得提交。
- CI 和本地 release 验证使用无生产权限的 `npm ci`、本地 D1 空库初始化、真实 `npm run lint`、`npm run typecheck`、`npm test`、`npm run whiteboard:test`、`npm run build` 与生产构建验证；不得用永远成功的占位命令替代。
- 迁移事实和交接步骤以 `docs/GPTWORK_MIGRATION_READINESS.md`、根 `README.md` 和 `cloudflare/README.md` 为准。

## 本地开发和验证注意事项

- 建议使用 Node.js 22.13+；本地 Pages Functions / API 的同名变量只放在 Git 忽略的根目录 `.dev.vars`，并独立于 Production 生成。
- `.dev.vars`、`.env`、`.env.*`、真实邮箱、Webhook URL、R2 Access Key 和其他真实密钥绝不能提交 GitHub。
- 临时互传固定放在工具区（内部 `resources` route），不新增顶层 route、任务栏或移动 Dock。网站 UI 复用 HttpOnly 会话，本地 CLI / MCP 只能使用经设备码授予的 scoped Agent Bearer；管理员仍只由 D1 `users.role = admin` 判断且只能使用浏览器会话进入管理功能。
- 在线画板固定放在工具区并按路由懒加载；本地除 Pages 服务外还要运行 `npm run whiteboard:dev`，根 `.dev.vars` 与 Worker `.dev.vars` 的 internal secret 必须一致且只使用本地测试值。
- 未登录用户从手机 Tools App（内部 `resources` route）打开临时互传时必须能直接到达登录操作；不能只代理点击在非 Home 路由被隐藏的 `.topbar-actions`，账号弹窗也不能留在 `display: none` 的祖先内。
- 互传房间的消息流、上传任务和输入区必须在 359x500、375x667、390x844、430x932、844x390 及软键盘 `visualViewport` 缩小时保持可到达。手机房间保持单一 `.transfer-room` 滚动路径，composer 必须留在正常文档流，不能用 sticky / fixed 层覆盖已发送卡片；仅把 composer 改成 `position: static` 不够，竖屏房间必须使用纵向 Flex，toolbar/feed/composer/tasks 直接子项不可收缩，让消息按真实内容高度撑开，短横屏再显式恢复双栏 Grid。验收必须测量 composer 与图片、文件卡的二维交集为零，不得用嵌套滚动、过度 overscroll containment 或固定高度把登录、发送或上传操作锁在视口外。
- 普通互传默认 95 MiB/文件并受个人、房间、频率和全站免费池的服务端限制；管理员大文件必须使用 R2 Multipart。“不限频次”不等于无限并发或突破 R2 平台/账单边界。
- Transfer 设置必须以服务端 revision / `expectedUpdatedAt` 条件更新；清空房间、定时清理、简单上传和 Multipart ready 转换必须检查真实 D1 changes。只完成部分对象时返回非 2xx、失败对象和可重试信息；并发删除或 ready 竞态产生的 R2 对象必须清理，不能把部分失败或孤立对象伪报为成功。
- 房间明文口令不得发送服务端或进入 D1/R2/日志；文字可称浏览器 AES-GCM，文件只准确描述为 HTTPS + 私有 R2 + 服务端鉴权，未实现可靠流式 E2EE 或病毒扫描时不得声称已实现。
- 互传列表与下载必须以 `expires_at` 做 24 小时逻辑过期；独立 `workers/transfer-cleanup/` Worker 和 R2 生命周期兜底都要保留。
- R2 桶、Pages Production/Preview binding、清理 Worker、生命周期规则和 Cloudflare 官方预算提醒均是 Dashboard 人工步骤，代码交付不得虚假声称已配置完成。

- PowerShell 可能禁止 `npm.ps1` / `npx.ps1`，优先用 `npm.cmd`、`npx.cmd`。
- 本机 Wrangler 登录临时配置目录可能是 `.wrangler-config/`，该目录已被 `.gitignore` 忽略，不得提交。
- `.wrangler/`、`.wrangler-config/`、`node_modules/`、`.codex-remote-attachments/` 都是本地生成内容，不得提交。
- 使用 imagegen / image2 生成项目资源时，生成文件必须复制到 `assets/images/` 等项目目录并由代码引用，不能只保留在 Codex 默认生成目录。

## 线上缓存和双域名踩坑

- 线上视觉验证要同时检查部署和缓存：确认 `origin/main` 最新提交、线上 CSS 是否包含新资源名、线上图片是否 200。
- Cloudflare / 浏览器缓存可能导致旧效果继续显示，必要时使用缓存破坏参数或 `_headers` 调整缓存策略。
- `lusu575.com` 和 `www.lusu575.com` 的边缘缓存、浏览器缓存可能不同步。
- 如果两个域名视觉不一致，优先检查两个域名的 CSS / 图片响应是否同版。
- 涉及 `js/main.js`、`css/style.css`、首页背景、任务栏、图标等强视觉或交互资源时，必须同步更新 `index.html` 里的 CSS / JS query 版本号或图片 URL query，避免线上和用户浏览器继续加载旧缓存。
- 每次推送 `main` 后，必须核对 `origin/main` 最新 commit、Cloudflare Pages 最新成功生产部署 commit、线上 `index.html` 的 CSS/JS query 版本三者一致；如果线上线下显示不同，先查部署状态、资源 query 和 Cloudflare/浏览器缓存。
- 右上角“最近更新日期”由 `js/data/home-content.mjs` 的 `homeContent.updates` 最大日期自动生成；新增可见功能更新时先补完整 `content.updates`，再同步最近五条无正文 Home 投影，不要重新增加写死日期常量。

## 当前关键资源

- 首页主要视觉资源：
  - `assets/images/wallpapers/morning.png`
  - `assets/images/wallpapers/day.png`
  - `assets/images/wallpapers/dusk.png`
  - `assets/images/wallpapers/night.png`
  - `assets/images/wallpaper-dynamic/morning/base-clean.png`
  - `assets/images/wallpaper-dynamic/morning/cloud-*.png`
  - `assets/images/wallpaper-dynamic/day/base-clean.png`
  - `assets/images/wallpaper-dynamic/day/cloud-top-left.png`
  - `assets/images/wallpaper-dynamic/day/cloud-top-center.png`
  - `assets/images/wallpaper-dynamic/day/cloud-top-right.png`
  - `assets/images/wallpaper-dynamic/day/cloud-mid-left.png`
  - `assets/images/wallpaper-dynamic/day/cloud-mid-right.png`
  - `assets/images/wallpaper-dynamic/dusk/base-clean.png`
  - `assets/images/wallpaper-dynamic/dusk/cloud-*.png`
  - `assets/images/wallpaper-dynamic/night/base-clean.png`
  - `assets/images/wallpaper-dynamic/night/cloud-*.png`
  - `assets/images/window-backdrops/morning.png`
  - `assets/images/window-backdrops/day.png`
  - `assets/images/window-backdrops/dusk.png`
  - `assets/images/window-backdrops/night.png`
  - `assets/images/homepage-pixel-coast.png`
  - `assets/images/lusu-tv-head-256.png`
  - `assets/images/lusu-about-avatar-256.png`
  - `assets/images/start-windows-pixel.png`
- 聊天室图标资源：
  - `assets/images/icon-chatroom.png`（唯一规范资源；Home、标题栏、任务栏／Dock、欢迎快捷入口与聊天头像共用）
- 管理后台与埋点关键文件：
  - `admin/index.html`
  - `admin/admin.css`
  - `admin/admin.js`
  - `admin/docs/ADMIN_PROJECT_CONTEXT.md`
  - `admin/docs/ADMIN_SKILL.md`
  - `admin/docs/ADMIN_CHANGELOG.md`
  - `functions/admin/_middleware.js`
  - `functions/api/[[route]].js`
  - `js/telemetry.js`
  - `cloudflare/schema.sql`
- 在线画板关键文件：
  - `tools/whiteboard/`
  - `functions/api/anonymous-identity.mjs`
  - `functions/api/whiteboard-service.mjs`
  - `js/features/anonymous-identity.mjs`
  - `workers/whiteboard/`
  - `docs/whiteboard/README.md`

替换这些资源后，要检查桌面端和手机端显示效果。
## 视频系统维护规则（2026-06-15）

- 视频区使用 D1 表 `videos`、`video_categories`、`video_category_relations`；“全部”分类只由前端生成，不写入数据库。
- 后台视频和分类接口必须继续复用 `requireAdmin`，普通登录用户不得访问 `/api/admin/videos*` 或 `/api/admin/video-categories*`。
- 后端只允许解析 YouTube、youtu.be、Bilibili、b23.tv 白名单链接；iframe `src` 必须使用服务端规范化生成的 `embed_url`，不得直接信任用户输入 URL。
- 公开视频接口必须返回 `original_url` 供主站“打开原地址”使用；`embed_url` 只用于站内 iframe 播放，不要把 embed 地址当作原链接。
- 主站视频窗口的站内“全屏”应保持为 XP 窗口最大化/还原，不要直接对 YouTube / Bilibili iframe 调用浏览器 Fullscreen API；播放器自己的全屏由 iframe 内部控件处理。
- 跨域 iframe 内部按钮热区无法由父页面精确重写；遇到默认信息栏、底部空白误触或平台按钮误触时，优先用站内遮罩、透明点击防护区和收窄本站按钮热区兜底。
- YouTube / Bilibili 元数据只在后台预览、首次保存、URL 变化保存或刷新元数据时抓取，并缓存到 D1；已有视频 URL 未变化的普通保存不得重新抓取外部元数据，公开视频接口不得每次访问重新抓取。
- 后台视频封面可以使用平台图片 URL，或由管理员选择 JPG、PNG、WEBP、AVIF 本地图片后在浏览器端压缩裁切为受限 `data:image` 写入 `thumbnail_url`；不得放宽为 SVG、HTML、任意 data URL 或任意图片域名。
- 后台“从本地视频截首帧”只用于生成封面，不代表本站支持本地视频上传、托管或直接播放；不要因此放宽 YouTube / Bilibili / b23.tv 链接白名单和 iframe 安全边界。
- 远程视频管理与后台遵守同一外链白名单和原子服务边界；MCP schema 不得加入 `filePath`、`base64`、字节数组或可读任意 URL。`agent_video_receipts` 是外链 mutation 幂等证据，`video_upload_sessions` 只是未来文件数据面的预留状态，二者都不能单独证明 R2 上传已经配置或上线。
- Bilibili 元数据遇到 HTTP 412、页面状态变化或 API 风控时，必须保留白名单解析和服务端规范化 `embed_url`，并优先尝试详情接口、移动页、页面 `__INITIAL_STATE__` / `__NEXT_DATA__`、meta、结构化数据和更宽的页面状态兜底，不得放宽为任意 iframe。
- 视频排序语义为置顶独立队列优先；只要 `pinned = 1` 就一定排在未置顶视频前面，多个置顶视频按 `pinned_sort_order` 从大到小显示，未置顶视频按 `sort_order` 从大到小显示。新建视频默认取当前最大普通排序 +10、当前最大置顶排序 +10。视频分类排序仍使用 `sort_order` 数值越大越靠前的语义，新建分类默认 +10。
- 默认视频分类 seed 只允许在全新 `video_categories` 表首次创建时初始化；已有表必须通过 `site_runtime_state.video_categories_default_seeded` 视为已处理，不要覆盖或补回后台维护过的 `slug`、`name_zh`、`name_en`、`name_ja`、`sort_order`、`enabled` 和已删除分类，避免运行时 schema guard 把后台分类名、排序、停用状态或删除结果还原。
- 抓取失败时后台应显示可读原因，并允许管理员手动填写标题、简介、作者和封面；前台遇到不可播放或受限视频时显示站内不可播放提示。
- 主站视频卡片标题、简介、分类名必须使用 `textContent` 或安全 DOM API 渲染，不要把视频数据拼接成未转义 HTML。
- 主站所有视频卡片必须保持统一尺寸；视频封面要铺满封面区域，封面失败时保留同尺寸像素风默认占位图；移动端视频区必须单列适配且不得横向溢出。
- 视频埋点复用 `js/telemetry.js`，可记录分类筛选、视频点击、播放按钮点击、播放器打开和播放失败；不得记录后台输入框内容。
- 修改 `js/main.js`、`css/style.css`、`admin/admin.js`、`admin/admin.css` 或视频视觉资源后，必须更新 `index.html` / `admin/index.html` 的 query 版本号。
