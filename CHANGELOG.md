# CHANGELOG.md

本文件记录鲁肃个人站的功能、界面、后端、部署与项目约定变更。每次修改项目后都应同步更新这里，方便后续 AI / Codex 对话快速了解最近改动。

## 2026-08-06

- 完成 AI 能力层第二阶段：在线画板升级到 `v1.0.3`，新增非默认 `whiteboard:read`／`whiteboard:write` scope、Agent join 与 scene GET/POST。Agent Bearer 与绑定当前 tokenId 的房间令牌严格分离；Durable Object 只接受基于最新完整状态的追加式 Yjs 更新，单次最多新增 50 个文字／基础图形／线条／箭头，禁止修改、删除、图片、嵌入、链接、绑定与未知根数据。`operationId + payload SHA-256` 收据与文档版本原子持久化，安全处理重试、冲突和锁定状态，密码房写入重计空房 24 小时但不伪造在线成员。
- 本地 CLI／stdio MCP 新增 `whiteboard join|scene|draw|export` 与对应四个 MCP 工具；密码只能从 stdin 或环境变量引用取得，本地只保存不透明画板句柄、短期房间令牌和可选 secret reference，不回显口令或内部 room ID。`whiteboards.json` 的 read-modify-write 由跨进程 owner-token 锁串行化，并用同目录私有临时文件 fsync 后原子替换，防止并发 join／刷新丢凭据或崩溃截断 JSON。导出支持 JSON／简化 SVG／PNG，当前明确忽略图片资源；不暴露任意 Yjs、编辑或删除能力。独立 `workers/site-mcp/` 仍未部署且只读，本次专用站点 Agent HTTP 通道不冒充标准 OAuth 公网写入口。
- 新增首个游戏 Agent 适配器：2048 浏览器页面与本地会话共用确定性纯引擎，并保留既有 `window.gamePage.save`；冻结的页面语义 bridge 只接受 observe/actions/act。CLI／stdio MCP 提供隔离的 create／observe／actions／act／reset／close 会话，使用 revision CAS、`clientActionId` 最近 128 条去重、状态／数量／TTL 上限和原子本地持久化，重置与关闭要求显式确认。会话锁使用唯一 owner、PID／进程实例、心跳和所有权校验，旧持有者不能删除接管者的锁；observe／actions 是不写文件、不续 TTL 的真实只读操作。当前不会与已经打开的浏览器配对，不能宣称接管现有玩家会话。
- 三语公开更新 `seed-update-2026-08-06-whiteboard-2048-agent` 已同步 fallback、Home 最新五条投影、Functions seed 与 schema seed；公开/API/文章 seed、主模块及 2048 资源缓存版本为 `20260806-whiteboard-2048-agent-r1`。本条只记录本地仓库实现与验证，不表示 Production Worker、Pages、D1 或远程 MCP 已经发布。
- 第二阶段本地门禁通过：根测试 498 / 498、2048 专项 14 / 14、白板前端 8 项与 Worker 44 / 44、远程只读 MCP 4 / 4、Lint、类型检查、子项目版本治理、生产构建及连续两次可复现构建均通过；Headless 公开 UI release 审计通过 192 项，覆盖 147 个路由／语言／视口组合。最终构建清单 SHA-256 为 `111eb9274dc2e91398c0d8da974a2ed33852301cc67149886ab0c16e2d160df9`。发布前审计另为独立 `workers/site-mcp` 锁文件补齐 `undici 7.29.0` override，避免子项目脱离根 override 后继续解析到已知漏洞版本；主项目与该子项目都必须各自通过完整 `npm audit`。
- 完成 AI 能力层第一阶段：新增统一 capability registry，用 `transport` 记录长期目标、用 `availableTransports` 记录当前真实可用面；本地 CLI 和 stdio MCP 现可查询能力、文章／每日 AI 新闻与视频，并对经授权的 Quick Transfer 执行进房、列表、发文字、上传、下载和删除。在线画板、游戏 AI 接管和其余站内能力仅进入 `planned` 盘点，未夸大为已接入。
- 补强 Production D1 上线门禁：远程 migration 在报告成功前除既有 schema、兼容列、索引和 seed 外，还会分组回读三张 Agent Auth 表及五个 Agent 索引；每组严格不超过 D1 的 5 项复合 `SELECT` 上限，避免设备授权 schema 部分缺失时误报迁移完成。
- 新增设备码授权、可撤销令牌与 `content:read`、`transfer:read`、`transfer:write`、`transfer:delete` 最小 scope；设备申请与令牌轮询使用原子限频，令牌上限在签发事务内校验，“全部撤销”同时取消已批准未兑换授权。Agent Bearer 固定为普通机器角色，不能继承 admin 或访问 Transfer 管理端。Quick Transfer 口令只从隐藏输入／stdin 或本地环境变量引用取得，不进命令行、URL、日志或持久明文；子项目因此适配升级到 v1.0.2，不改变文件仍只由 HTTPS、私有 R2 与服务端鉴权保护的安全边界。
- 新增独立 `workers/site-mcp/` 无状态远程 MCP Worker 工程，当前只暴露公开文章的只读能力；代码完成不等于上线，该 Worker 未部署、未配置正式地址，远程写能力仍须先完成 OAuth 和独立安全审核。三语 `site-updates` 记录 `seed-update-2026-08-06-agent-capabilities` 已同步公开 `fallback`、Home 最新五条投影、Functions seed 与 schema seed，公开/API/文章 seed 与资源表示版本为 `20260806-agent-capabilities-quick-transfer-r1`；本条只记录仓库实现，不表示生产 D1 迁移、推送或部署已完成。
- 本地交付门禁已通过：根测试 468 / 468、白板 Node 8 项与 Vitest 35 / 35、远程 MCP Worker 4 / 4、Lint、根类型检查、子项目版本检查、58 / 58 条三语响应式界面审计、正式生产构建及连续两次完全一致的构建校验；可复现构建清单 SHA-256 为 `b9cea768fd795cc24bc6f8f173e21c239923c033137383b3d5eacafc6bfa8981`。
- 修复“网站使用指南”首次部署未通过门禁与图片旧缓存问题：把两组 8 月 6 日文章 seed 放回 `articleSeedStatements()` 的返回数组，并把 `cloudflare/schema.sql` 中被新 seed 截断的 8 月 2 日更新记录移到完整语句边界；四张截图改用各自完整 SHA-256 作为查询版本键，避开部署前缓存的 SPA HTML 回退响应，公开/API/文章 seed 版本同步提升到 `20260806-site-guides-password-rooms-r2`。修复候选已在独立干净副本中通过 440 / 440 全量测试、D1 338 + 9 条本地初始化命令、正式生产构建及连续两次完全一致的构建校验；其他并行任务的未提交改动未纳入本次修复。
- 知识库新增固定 `site-guides` 专区，三语显示为“网站使用指南 / Website Guides / サイト利用ガイド”，固定排在每日 AI 新闻、工具雷达之后和普通分类、网站更新之前；发布三语《密码房怎么用：匿名聊天室 + 在线画板轻松上手》，用四张来自正式站点的 1440×900 电脑端与 390×844 手机端实拍图分别说明两项独立功能。正文明确聊天室与画板不会因同一密码互通，分别说明 6 字符／4–128 字符入口、浏览器端加密边界、分享方式及两种不同的 24 小时清理规则。三语 `site-updates` 记录 `seed-update-2026-08-06-site-guides-password-rooms` 已同步 `content` fallback、Home 最新五条投影、Functions seed 与 schema seed；公开/API/文章 seed 和 main.js cache query 更新为 `20260806-site-guides-password-rooms-r2`，顶部日期更新到 2026-08-06。本次只新增文章、知识库接线和文章图片，没有命中在线画板子项目 tracked paths，因此画板仍为 v1.0.2。
- 根治 Daily AI News “抓到却漏审”的最新绕过方式：复盘 8 月 6 日正式运行发现，1,997 条候选中的豆包／SeedRealtime 等受保护线索已经进入索引，但临时编辑脚本按候选 ID 轮换套用 4 组评分和少量拒稿模板；旧校验只拦截单一模板占 90%，因此结构完整的批量伪审阅仍能通过。校验器新增少量评分／结论轮换检测，已用同一份正式运行记录验证其会准确 fail closed，并新增 hash／下标轮换回归。
- coverage manifest 新增 `protectedEventReviewPolicy: evidence-backed-protected-events-v1`，并从 2026-08-07 起强制存在、不可通过删除字段降级。后续正式运行无论已选多少条，都必须在 `coverageAudit.protectedEventReview` 中把全部编辑信号、RSS、受保护类别和 selected／merged 候选按事件阶段恰好覆盖一次，记录直达可靠 HTTPS 来源、当前阶段首次可靠发布时间、证据摘要及四项具体评分理由；聚合页不能冒充证据，无来源不得伪填时间，至少一半事件复用同一证据／理由也会关闭投递。`secondPass` 仍只由少于 5 条触发，两道门禁互不替代。
- 拆分字节跳动发现入口：豆包中文／英文产品动态、Seed 通用模型、SeedRealtime／Seed-ASR／Seed-TTS／全双工语音改为独立 required + must-review 查询，原综合 `bytedance-models-zh` 降为补充，Seedance／Seedream／Dreamina 专项保持不变。同步工作流、自动任务提示、写作规范、项目上下文、AGENTS、维护 Skill／README 与 Python／Node 回归；本次未自动改写或重发已经发布的 8 月 6 日日报。
- 修复依赖审计门禁发现的安全版本：直接依赖 Undici 从 `7.28.0` 精确升级到 `7.29.0`，并通过最小 override 将传递链中的 `brace-expansion` 固定到已修复的 `1.1.18`／`5.0.9`；严格 `npm ci` 后要求生产与完整 `npm audit` 均为 0 漏洞，不能用跳过安装或审计的方式放行。

## 2026-08-04

- 核对当天 Daily AI News 生产状态：Horizon 对固定窗口 `[2026-08-03 07:00, 2026-08-04 07:00)` 取得 2,064 条候选，完整处置为 8 条入选、101 条合并、1,955 条有依据拒绝，schema v4 正式校验通过。生产接口已经确认 `published`，任务只是在随后日文公开回读中报 `fetch failed`；通过显式代理再次只读核验后，zh／en／ja 三版均与冻结运行记录逐字一致，因此没有重复 POST 或人工补发。
- 修复本机 Clash Fake-IP 环境下 Node 原生 `fetch` 不读取系统代理、把成功发布误报成回读失败的根因：新增共用 `network-fetch.mjs`，以直接依赖的 Undici `EnvHttpProxyAgent` 安全读取 `HTTP_PROXY`／`HTTPS_PROXY`／`NO_PROXY`，无代理环境保持直连，且不记录代理地址、凭证或 Token；每日 AI 新闻和工具雷达的生产目录、资产、POST 与公开回读统一复用该客户端。
- 公开文章回读对网络异常和 408／425／429／指定 5xx 最多执行 3 次有界只读 GET，始终受原 08:00／同日恢复截止预算约束；正文不匹配、非瞬时状态或预算耗尽仍立即 fail closed，生产 POST 在一次执行中仍只允许发送一次，绝不会因回读失败自动重发。新增代理选择、资源关闭、瞬时 GET 恢复与持续失败回归，并使用官方 SHA-256 校验的 Node.js 22.23.1 完成严格 `npm ci` 和线上三语只读集成验证。

## 2026-08-03

- 复盘最近三期每日 AI 新闻的编辑产物：8 月 1‑3 日候选数分别为 1,978、1,484 和 1,399，而入选数由 17 降到 4 和 1。8 月 3 日将全部 1,399 条候选都归为 `other`，并将 1,393 条机械评为 3／4 分；94 组发现查询、67 个 required query 和 11 个 required group 均完成，确认短稿主因是整批分类／评分退化，不是 Horizon 没抓到消息或网站漏显示。
- 增加编辑召回硬门禁：Horizon 在聚焦通道中用中英日韩变化词标记模型／产品、能力／可用性、开发工具、价格／额度、芯片／存储／机器人／智能设备／自动驾驶／数据中心基础设施、重大科技金融和 AI 监管／安全变化，校验器强制对应受保护类别，并检查拒稿理由与 `substantiveChange` 语义一致。对 50 条以上候选全部归为 `other`、或 90% 以上拒稿复制同一编辑类别与完整四项评分模板的运行直接 fail closed。
- 低于 5 条的二次审阅不再只允许布尔签收：完成时间必须严格晚于初审，`reconsideredCandidateIds` 至少列出所有带编辑信号的候选、RSS 候选和受保护类别的 5／6 分拒稿，同时允许主动加入其他索引候选。5 条仍只是复审触发器，不是刊发配额；本次未覆盖或重新投递线上 8 月 3 日文章。

## 2026-08-02

- 完成以免费额度余量为优先的流量保护优化：公开页首次访问不再先发 `/api/analytics/identify` 再发 page view，页面浏览自身负责匿名身份和访客资料登记；同一目标一秒内的重复点击在浏览器侧直接抑制。默认 D1 保护阈值由 60,000／80,000 收紧到 30,000／50,000 站内估算行，预警采样改为页面 25%／点击 10%／文章 50%，硬保护为 0%／0%／10%，为账号、云存档、Chat、Transfer 与 Whiteboard 等必要业务保留至少一半当前免费写入余量。公共遥测判定复用 5 分钟用量快照以减少当天聚合读取，后台面板仍按 30 秒获取新快照；仅仍精确等于旧默认 JSON 的设置自动迁移，管理员自定义策略不覆盖，低写入预案同步进一步收紧。
- 完整补齐分析数据留存：健康检查的有界 `waitUntil` 清理现分别覆盖 `analytics_page_views`、`analytics_click_events` 与此前遗漏的 `article_view_events`，统一保留 180 天且每表独立检查、限量删除。后台阈值说明、默认输入、页面内更新记录、专用上下文与维护规则已同步，后台 JS cache query 更新为 `20260802-traffic-budget-r1`。
- 改善搜索发现与文章分享元数据：`sitemap.xml` 固定使用 `https://lusu575.com`，首页 `lastmod` 来自最新已发布内容而非请求当天，并为首页、日语学习工具和所有公开文章加入 zh／en／ja／x-default `hreflang`；文章边缘直达页补充 alternate links、Article URL、Person 作者与 Organization 发布者 JSON-LD。公开主脚本／API 表示版本更新为 `20260802-traffic-discovery-monitoring-r1`，三语 `site-updates` 记录 `seed-update-2026-08-02-traffic-discovery-monitoring` 已同步 fallback、Home 最新五条投影、Functions seed 与 schema seed，顶部日期更新到 2026-08-02。
- 新增低流量生产冒烟监控：`scripts/production-smoke.mjs` 用有界超时与最多五次重试检查健康接口、首页 canonical 与入口模块、稳定 sitemap／hreflang、一个文章直达页的结构化元数据和一个内容哈希资产的 immutable 缓存；GitHub workflow 在 `Verify` 的 `main` 成功后及每 12 小时运行，默认每轮约三次 Functions／D1 路径读取，持续失败明确让任务失败。`www` 永久跳转与 Cloudflare Web Analytics／RUM 仍需在 Dashboard 单独配置和线上验收，本次未声称已启用，也未执行推送或部署。

## 2026-08-01

- 在线画板升级到 `v1.0.2`：公共画板和所有密码房显式共用唯一铅笔草图默认值；Yjs 文档更新改为仅在真实变化时按 250／500／1000ms 合并发送，游标为 100ms 临时广播，持续绘制期间 D1 房间摘要最多约每分钟同步一次，并去掉每次增量后的重复元数据写入。可见页每 60 秒的 `ping/pong` 改由 Durable Object WebSocket auto-response 在边缘完成，不唤醒休眠房间；隐藏页 60 秒后先排空未确认画线再停放连接。有 socket 的失联巡检由 15 秒降为 5 分钟，稳定成员不重复写活跃状态，空公共房不再周期轮询，密码房继续最后离开 24 小时删除。短暂连接波动保持无提示，持续重连只显示延迟 3 秒的角落小状态，权限／协议／容量错误仍明确显示。三语 `site-updates` 记录 `seed-update-2026-08-01-whiteboard-calm-efficient-sync` 同步 fallback、Home、Functions 与 schema seed，公开表示版本为 `20260801-whiteboard-calm-sync-r1`。未改动的 Quick Transfer 继续保留自身 `v1.0.1` 与既有内部 asset cache key，主站／画板发版不得连带滚动其他子项目版本或内部资源键。
- 修复画板频繁弹出“发生了错误”并在重进后丢线的根因：快速绘制不再逐事件冲击 Worker 的 24/6/2 update/s 限制，客户端会合并 Yjs 增量、一次保留一个未确认更新，并只在 Worker 确认 DO storage 已持久化后移除；限流、断线或回执超时会按退避重连并幂等重传，显式退出也给队列有界排空时间。Worker 新增持久化后 `update-accepted` 回执和 60/200/600 ms 自适应发送建议；新增 30 次快速更新、限流断线重传、回执排空和公共画布重启恢复回归。公共画布默认永久保留，只能由管理员显式清空；密码房仍在最后一人离开后 24 小时整房删除，重入取消、再空重计。
- 在线画板默认改为暖白纸张、石墨色、hachure 填充、roughness 2 的铅笔草图风，房间与大厅显示独立 `v1.0.1`。画板和 Quick Transfer 各新增 `VERSION`、`project.json`、`README.md`、`CHANGELOG.md`、`AGENTS.md` 与 `AGENT.md`，Quick Transfer 也显示独立 `v1.0.1`；工具区两张卡片的版本和日期已同步，Headless 审计从过期的两卡计数改为逐语言确认画板、互传和日语工具三张真实卡片。任何子项目更新都必须精确增加 `0.0.1`、写独立更新日志并同步全部受影响文档和根记录，新增 `npm run check:subprojects` 与 CI 差异门禁自动校验。三语 `site-updates` 记录 `seed-update-2026-08-01-whiteboard-reliable-sketch` 同步 fallback、Home 五条投影、Functions seed 与 schema seed，公开表示版本为 `20260801-whiteboard-reliable-sketch-r1`。
- 修复 Cloudflare Pages PR Preview 在全部构建与资产上传成功后仍因 `Script lusu-whiteboard-do-preview not found` 失败的问题：根 `wrangler.jsonc` 的提交态 Preview 既然已使用 `PREVIEW_API_DISABLED=true` 和空 D1/R2，就同步显式使用空 Durable Object bindings，不再引用尚未部署的 Preview Worker。Production 的 `WhiteboardRoom@lusu-whiteboard-do` binding、独立 Preview Worker 配置模板和隔离要求保持不变；只有 Preview D1/R2、DO namespace、精确 Origin 与独立 Secret 全部创建、迁移和验收后，才允许先部署 Preview Worker、再经审查把 Pages Preview binding 接入。
- 发布门禁把 `sharp` 从 `0.34.5` 升级到 `0.35.3`、Wrangler 从 `4.111.0` 升级到 `4.118.0`，消除图片处理与 Wrangler/Miniflare 依赖链的高危安全告警；两项继续精确锁定并要求在 Node.js 22 下执行严格 `npm ci`、完整依赖审计和真实 `wrangler pages dev` 冒烟，不能用 `audit fix --force` 或跳过 CI 放行。
- 修复生产账号登录把服务端故障误报为“请检查网络”的根因：Cloudflare Pages Functions 的生产运行时拒绝超过 100,000 次的 PBKDF2，而旧实现会在 25,000 次旧哈希验证成功后尝试升级到 600,000 次并直接触发 5xx。新密码、管理员重置和旧记录条件升级统一使用 PBKDF2-HMAC-SHA256 100,000 次；25,000 次记录登录后升级，既有 100,000 次记录保持不变。账号前端现在区分本地网络失败与服务端暂不可用，并新增 API 与 workerd 兼容性回归。
- 降低 D1 写入放大并新增后台“流量与写入”保护面板：运行时 schema 检查不再夹带整套文章 seed；完整文章与三语翻译只在 `site_runtime_state.article_seed_version` 未达到当前发布版本时执行，成功后持久标记，后续隔离实例只读标记。后台新增站内可识别写入压力、分项估算、UTC 重置时间、可选 Cloudflare 官方 `rowsWritten` 状态，以及遥测总开关、识别／浏览／点击／文章开关、60,000／80,000 默认阈值和正常／预警／硬保护三档采样；保存使用 revision/CAS，自动刷新不覆盖未保存输入。保护策略只降低非必要遥测，不自动关闭登录、云存档、聊天、互传或在线画板，站内估算也不会冒充 Cloudflare 账单。三语 `site-updates` 记录 `seed-update-2026-08-01-service-reliability` 已同步 fallback、Functions seed 与 schema seed，公共表示版本为 `20260801-service-reliability-r1`。
- 修复每日 AI 新闻韩文开放模型 required 查询的稳定截断：原 `korean-model-releases-ko` 把 LG AI Research／EXAONE、NAVER／HyperCLOVA 与 Upstage／Solar 及多类动作塞进同一大型 OR，99+1 探针持续命中第 100 条并按规则关闭整期。正式目录改为 5 个互补的 required + must-review 查询，分别覆盖 EXAONE 开放／权重动作、EXAONE 普通发布、LG AI Research 其他模型、NAVER／HyperCLOVA、Upstage／Solar；EXAONE 两条以动作排除词分流，LG 其他查询显式排除 EXAONE，保留相同 `open-models` 覆盖组和 `open-weight-releases` 审阅通道。该拆分已在 2026-08-01 固定窗口真实运行中全部通过 99+1 上限门禁；新增目录回归，禁止旧宽查询回归，并锁定 5 条查询的韩文／韩国、required、must-review、厂商别名、动作词与去重排除条件。本次仅调整内部发现目录、测试和维护文档，不改变公开 UI，也不新增 `site-updates`。
- 接管并整合 `agent/multiplayer-whiteboard`：使用 Node.js 22.23.2 补齐 `package-lock.json` 中 Vitest/Vite 可选 Sass watcher 依赖，使严格 `npm ci` 可重现；把截至 `c8abc571` 的最新 `main`（含每日 AI 新闻完整候选复核与韩国模型查询分片）通过普通 merge 合入支线并同时保留画板上下文。构建守卫和仓库密钥扫描现在明确忽略本机 `.codex-worktrees/`，避免把其他 Codex 任务的独立 checkout 当作当前仓库源码，同时新增锁定该隔离规则的生产构建回归。该记录不代表远端 D1、Durable Object Worker、Pages binding、PR 合并或生产域名已经完成验证。
- 修复生产 D1 迁移器在 schema 与索引已成功写入后误报失败的问题：Cloudflare Production D1 的复合 `SELECT` 最多接受 5 项，原最后一组 7 项 `UNION ALL` 校验会收到 `too many terms in compound SELECT`。画板表校验现拆成 5 项与 4 项两组，并补查 `whiteboard_admin_audit`、`whiteboard_metrics`；迁移器在任何远端写入前先锁定每组不超过 5 项，新增对应回归。

## 2026-07-31

- 修复每日 AI 新闻“抓到候选但未进入编辑审阅”的根因：此前 7 月 31 日运行共抓到 1,899 条候选，却只把 849 条标为 must-review，剩余 1,050 条在成稿前没有逐条处置，导致 Seedance 2.5、Inkling-Small、K-EXAONE 2.0、GitHub 堆叠拉取请求及重要企业／金融动态等被静默漏掉。正式 Horizon 运行现使用 `all-discovered-candidates + complete-discovery-review`，候选索引中的每条消息都必须得到 selected、merged 或带具体理由的 rejected 处置；优先级只调整审阅顺序，不再缩小审阅范围。新增必查的中英日韩多模态模型、Thinking Machines／LG AI Research 等开放模型实验室与韩国模型厂商查询，并把 r/Seedance_AI、r/MachineLearning、r/LocalLLaMA、r/codex、r/OpenAI 与 Hacker News 作为补充发现入口；社区与聚合时间不能代替事件首发时间，线索仍须回到官方或可靠来源核实。同步修复 Reddit 相对链接被误当本地路径、Hacker News 枚举类型未命中来源归属，以及校验器未反向约束每篇入选稿件都必须拥有 selected 处置的问题，新增来源规范化、全候选处置和多模态覆盖回归。

## 2026-07-30

- 工具区新增完整的多人实时在线画板：独立 `/tools/whiteboard/` 页面按路由懒加载 Excalidraw、Yjs 与 React，提供公共房和服务端 HMAC 映射的隔离密码房、对象级 CRDT、WebSocket Hibernation、实时彩色鼠标与临时名字、成员／连接状态、图片上传、PNG／SVG 导出、只读和自动重连，并完成手机触控与三语入口；聊天室和画板统一到服务端验证的 `lusu_anonymous` 匿名身份，安全词根组合超过一万种且由房间 DO 原子查重。新增 `WhiteboardRoom` Durable Object、D1 管理索引、私有 R2 房间前缀、公共房管理操作、连接／对象／消息／容量／Origin／票据／IP 哈希限制，以及密码房最后一人离开后 24 小时 Alarm 保留、重入取消和幂等清理。同步四个只提交名称与用途的画板 Secret、external binding、SQLite DO `v1` migration、部署顺序、R2 清理与保数据回滚说明；Production Worker Origin 仅保留正式 HTTPS 域名，Pages Preview 默认关闭 API 且不绑定 Production D1/R2，image2 入口素材新增尺寸、SHA-256 与仅机械 resize 的来源 manifest 和守卫测试。三语 `site-updates` 记录 `seed-update-2026-07-30-multiplayer-whiteboard` 已同步完整 fallback、Home 投影、Functions seed 与 schema seed，公共／API 表示版本为 `20260730-multiplayer-whiteboard-r1`。本条记录的是仓库实现与本地发布准备；Cloudflare Dashboard 配置、远端 D1 migration、PR 合并、生产部署和正式域名验证仍须按运维清单实际完成，不得据此视为已上线。
- 修复每日 AI 新闻遗漏 Codex 五小时限制恢复消息的两层原因：原 Tibo 补充源只是宽泛 Bing 搜索，抓回的结果是同名慢阻肺噪声；真正进入 must-review 的 X／媒体／Reddit 限额候选又被编辑层统一误归为 `developer-tool`、`substantiveChange:false` 和 4 分后全部拒绝。站长现已授权把 Tibo `@thsottiaux` 的 X 帖子纳入选题；移除无效 Bing RSS，新增 required 的 Tibo／Codex 独立必查查询，同时覆盖姓名、账号及 Codex／ChatGPT Work 运营关键词，本次真实重跑命中 X、英文媒体和日文媒体的五小时限制候选。candidate index 新增 `editorialSignals`：must-review 中明确的额度／五小时窗口变化必须归类为 `usage-policy` 或 `material-price-quota`，不得用重要性不足、例行消息或超出范围拒绝，同一事件的其他 must-review 来源全部合并；识别规则同时排除普通 token、推理内存、模型路由和性能优化，避免误标及校验误停。同步工作流、自动任务提示、项目上下文、AGENTS 与维护 Skill，并新增日英中韩用量变更识别、误标防护和低分淘汰回归。
- 将每日 AI 新闻的过时单日硬编码恢复入口改为长期可复用的当天人工补发模式：自动任务仍以北京时间 08:00 为硬截止并且绝不自行迟发；只有站长在当前 Codex 交互任务中明确授权后，才可在该 `reportDate` 当天 08:00 至次日 00:00 同时确认日期与完整 schemaVersion 4 运行记录的 canonical SHA-256。人工模式继续使用 `[前一日 07:00, 当日 07:00)` 固定窗口，并完整保留 Horizon 成功态、candidate index 原始字节摘要、coverage manifest v2、required／must-review、三语、专用通道、auto-publish、限流、幂等、slug 冲突和三语公开回读门禁；午夜前不足 45 秒或任一确认不匹配时拒绝投递。新增只读 `--print-run-sha256` 与 `MANUAL_RECOVERY.md`，同步 workflow、自动任务提示、项目上下文和维护 Skill。

## 2026-07-29

- 线上视觉复核继续收尾工具雷达：知识库行内解析原先只处理代码与粗体，导致正文和显式图注里的 `[名称](https://...)` 原样显示；现只把无账号凭证的绝对 HTTPS 地址用安全 DOM／`textContent` 渲染为外链，危险协议、相对地址、HTTP 与凭证 URL 均保持不可执行文字。七张官方实图改登记真实宽高，旧自绘图尺寸映射移除。复核同时发现部分 Cloudflare 边缘曾把资产上线前的 HTML 回退页缓存为图片响应，因此三语正文现在强制使用 `<assetPath>?v=<SHA-256 前 12 位>`，投递器用同一精确缓存键核对 200、MIME 与完整哈希；截图工具也会等待并解码可视图片，失败时不再保存带破图 alt 的“成功”截图。每周二 22:00 自动任务与长期文档同步采用这套规则；新增三语公开更新 `seed-update-2026-07-29-knowledge-markdown-links`，公共／API 表示版本更新为 `20260729-knowledge-markdown-links-r1`。
- 为站长明确授权的 7 月 29 日故障补发增加一次性人工恢复门禁：只接受已完成 1,915 条候选覆盖审阅、入选 24 条且通过三语校验的固定运行记录，并同时锁定日期、24 小时窗口、Horizon 运行、候选索引 SHA-256、完整稿件 SHA-256、slug、幂等键和当日失效时间；正常 07:00–08:00 自动发布规则不变，正式定时任务禁止使用恢复参数。
- 按站长反馈重做工具雷达图片链路：首期七张本站自绘概念图改为 60fps、Mobbin、ChatCut、Remotion、Repomix、Context7 与 Pinokio 的官方真实界面、官方案例或真实成果，每张保存官方来源页、直接素材或精确截图锚点、权利说明、SHA-256 和三语 alt／图注；已发布文章通过后台 CAS 在同一 slug 原位换图，不重跑机器投递、不改发布时间、永久工具目录或首发幂等事件。周更契约、自动任务提示词和校验器同步禁止自绘说明图、AI 生成图、统一模板卡、仿界面概念图、搜索缩略图与第三方转载图；没有合格官方实图时固定使用 `image: null`。新增三语公开更新 `seed-update-2026-07-29-tool-radar-real-visuals`，同步 fallback、Home、Functions 与 schema seed，公共缓存／API 表示版本更新为 `20260729-tool-radar-real-visuals-r1`。
- 修复每日 AI 新闻 7 月 29 日运行被单条日文必查查询超限关闭：原先把 OpenAI／ChatGPT／Codex、Anthropic／Claude、Gemini／DeepMind 合在一起的日文产品动态查询拆成三条独立 required + must-review 入口，并分别归入既有厂商审阅分区；99+1 截断探针、超限关闭和中／英／日三语门禁继续保留。正式抓取的默认回看从固定 48 小时收紧为 24 小时，并只按实际启动时刻向上扩到足以覆盖精确窗口，避免窗口外旧消息挤占查询结果。
- 修复工具雷达首期生产图片预检在多图并发读取时被单次瞬时 `fetch failed` 中止：投递前现按登记顺序逐张检查图片，网络错误与 408／425／429／指定 5xx 最多三次有界重试；持续失败仍然关闭投递，且每张图继续强制 HTTP 200、与扩展名一致的 MIME、5 MiB 大小上限和精确 SHA-256。新增瞬时恢复、持续网络失败、持续 503、错误 MIME 与错误哈希回归；本项只修复投递前门禁，没有执行文章 POST。
- “工具雷达 / Tool Radar / ツールレーダー”正式上线：首期以独立 production 运行发布 60fps、Mobbin、ChatCut、Remotion、Repomix、Context7 与 Pinokio 七项工具的 zh／en／ja 完整文章；2026-07-21 的 `trial-local + trial + not-delivered` 审阅记录继续只作历史依据，没有被原地改成生产记录。
- 正式周更任务获站长授权，固定于 `Asia/Shanghai` 每周二 22:00 启动。每期目标 6–10 个、少于 3 个关闭投递；来源核验、真人分享式口播叙事、三语一致、结构化工具清单、线上回读任一失败都不发布半成品。
- 独立 `tool-radar` 通道、Bearer 凭证和 auto-publish 显式开启后才允许自动公开；通道启用与自动公开仍是两个互不替代的闸门。`tool_radar_catalog` 通过永久工具键与 canonical 官网 URL 阻止同一产品重复收录，疑似改名、换域名或被收购的候选继续人工复核历史名称和别名。
- 首期七个工具各使用一张本站原创语义说明图，按“输入／动作／结果”完整表达用途，不复制产品界面或使用空截图。所有文章图片先随 GitHub `main` 由 Cloudflare Pages 正常部署，生产投递再逐张核对线上可读取性与远程 SHA-256；不允许外部热链或用本机临时路径绕过门禁。
- 三语 `site-updates` 公开更新记录统一为 `seed-update-2026-07-29-tool-radar-live`，公开 fallback、Home 最近更新、Functions seed 与 schema seed 保持一致；公共、API 和后台缓存／表示版本统一为 `20260729-tool-radar-live-r1`。后台自动投递说明同步显示工具雷达正式任务已启用，原 7 月 28 日“待首期授权”的记录作为当时历史保留。

## 2026-07-28

- 再次收口工具雷达的标题、口播叙事与每周视觉工作流：H1 必须同时包含明确读者痛点、与入选工具数完全一致的阿拉伯数字，以及至少两个具体任务范围或收益；首期标题固定为“AI 总做不出你想要的效果？7 个设计、视频、代码与本地 AI 工具”。整篇先确定一句话主线并按真实工作顺序推进，首期三语顺序统一为 `60fps → Mobbin → ChatCut → Remotion → Repomix → Context7 → Pinokio`；每个工具恰好三个自然段，依次说明“是什么／能做什么”“省掉什么／怎么开始”“案例或示例／适合谁／必要限制”，相邻工具自然接力。新增 `VISUAL_METHOD.md`，把选图从单次修稿提升为固定周更方法：先写读者问题、视觉结论、2–5 个必须出现的元素、信息角色和三语图注规划，再按原创可复现演示、明确许可官方素材、原创说明图、无图的顺序取材；单图必须自洽，双图只能形成同组且有先后的输入／输出、操作／结果、前后或连续步骤。`run.schema.json`、`workflow.json` 与 `validate-run.mjs` 现强制每张已采用图片登记 `captureBrief`、三语 `caption`、`framing`／`sequence` 和五项全通过的 `visualQa`，并检查本期内复核时间、本地文件、SHA-256、图注邻接、双图角色／顺序和关键内容未截断；无合格图仍可使用 `image: null`。首期本地审稿页移除固定 16:10 强裁切，每组图新增“这张图要说明什么／看图顺序／完整性检查／图注／权利状态”证据卡；60fps 改为同一 Storyboard 的起点至 final state，Remotion 改为 Prompt 输入至输出结果，Mobbin、ChatCut、Repomix、Context7 与 Pinokio 均裁到完整语义边界。官网截图仍只供本地审稿，不代表转载授权，正式发布须重新取得合格素材与权利依据；首期运行记录继续保持 `image: null`、`trial-local + trial + not-delivered`。工具雷达专项 28 / 28、全量测试 371 / 371 与静态构建通过；未投递、未发布、未部署，也未创建或启用定时任务。
- 新增知识库固定分类“工具雷达 / Tool Radar / ツールレーダー”，固定排在“每日 AI 新闻”之后；建立目标时段为每周二北京时间 22:00 的多来源工具发现与三语成稿流程，每期目标 6–10 个、少于 3 个关闭投递，逐项核对功能、费用、登录、中文、本地／AI 辅助部署、用法、案例与场景。服务端 `tool_radar_catalog` 以规范化工具键和官网 URL 阻止精确重复；改名、换域名或被收购的疑似同产品须人工核对历史名称与别名，未排除重复前不得投递。首期使用 `trial + not-delivered` 本地试稿，生产投递器硬拒绝 trial；在站长审稿并再次明确授权前不创建定时任务、不投递、不开启通道或 auto-publish。后台自动投递页可在每日新闻与工具雷达两条独立通道间切换，凭证、启用和 auto-publish 互不共用且新通道默认关闭；图片只允许项目内安全资源。同步三语公开更新记录 `seed-update-2026-07-28-tool-radar-weekly`、Home 最新五条、Functions／schema seed、项目与后台维护文档；公共缓存／API 版本为 `20260728-tool-radar-r1`，后台 CSS／JS 版本为 `20260728-tool-radar-weekly-r1`。
- 完成首期本地不可投递试稿 `tool-radar-2026-07-21`：收录 60fps、ChatCut、Mobbin、Remotion、Repomix、Context7、Pinokio 七项，生成 zh／en／ja 完整正文和结构化官方证据记录；核对并区分 ChatCut 当前 ChatGPT/Codex 桌面插件与旧 Claude Code-only skill，常规剪辑免费、仅生成新内容消耗积分。因来源图片再发布权利不明确，本期不放图片也不热链。正式校验通过 `tools=7`，记录保持 `catalogAudit=trial-local`、`delivery.mode=trial`、`status=not-delivered`，未调用投递器。
- 收口工具雷达验收发现的契约边界：后台维护说明改为机器入口按各专用通道固定创建对应分类；本地投递令牌长度与服务端统一为 32–128 位 secret；文档与公开更新不再把跨域改名误写成服务端可自动完全识别，而是明确精确工具键／官网 URL 唯一约束加历史名称、别名人工复核。
- 本批最终验证通过：工具雷达试稿校验、51 / 51 相关接口与工作流回归、359 / 359 全量测试、静态构建，以及覆盖 Home、Knowledge、三语和关键视口的 192 / 192 Headless Chrome 发布审计；未推送、未部署，也未连接生产通道。
- 收口每日 AI 新闻的三处维护说明滞后：后台自动投递页改为明确本机定时任务 `ai-7-8` 已启用并每天 07:00 开始；项目与后台上下文改为如实记录 Horizon 已配置本地 Ollama `qwen3.6:27b`，但当前正式入口只执行抓取、来源重试和去重，不调用原生 AI 评分／富化；最新审阅记录更新为 `2026-07-28-coverage-revision.json`，并明确其 manifest v1 是按固定指纹登记的唯一历史兼容例外，后续正式运行仍必须使用 manifest v2 与完整 `priorityReview`。后台私有更新记录同步，后台 JS query 与构建守卫更新为 `20260728-daily-ai-news-doc-sync-r1`；未改变工作流逻辑、生产通道、令牌或主站公开内容。
- 修复每日 AI 新闻“抓到了却仍被静默漏选”和重点消息源不足：宽泛的大型 OR 查询降为补充，OpenAI／Codex 关键人物与产品运营变化、Anthropic、开放权重、Qoder、OpenRouter、GPT-Live、主要中国模型厂商、微信 WeLM、美团 CatPaw、中国光刻与存储改为独立 required 查询；新增 OpenRouter Blog、Qoder Announcements、量子位官网 RSS 及低门槛 r/codex、r/OpenAI 早期发现源。社区源不再逐帖抓评论，避免 Reddit 限流拖慢早晨链路，线索仍须回到一手来源核验。
- Horizon coverage manifest 升级为 v2，新增 result-limit、review source 与 must-review 证明。Google News 查询最多保留 99 条并请求第 100 条作为探针，只有实际返回第 100 条才判定截断，恰好只有 99 条不再误报；`mustReviewCandidateIds` 同时汇总聚焦查询和指定 RSS／社区发现源命中。schema v4 编辑记录必须逐条选入、合并或具体拒绝这些候选，并用 `sourceCandidateIds` 关联索引。
- Horizon 的跨来源 URL 合并会保留完整 `feed_names`／`subreddits` 来源集合，指定必审来源即使不是内容最丰富的主项，也不会在首次合并后丢失身份。
- GitHub 的 v1 历史兼容回归改为核对仓库内登记身份与固定指纹，不再尝试读取 Git 忽略的本地完整 Horizon 运行目录；本地历史数据仍由同一严格指纹约束，CI 不会因缺少个人机器产物而误报失败。
- 新增 TechCrunch AI、VentureBeat AI、Ars Technica AI、雷峰网、36氪及无需账号的 Tibo 公开检索源作为可选补充。单个补充源失败不阻断整期，但已抓到的候选必须进入审阅，最终事实仍回到可靠或一手来源核验；当前没有直接接入 Tibo 的 X，未来 X 直连仍需用户明确授权。
- 补充源健康检查不再把“HTTP 成功但返回网页或损坏订阅”误记成真正空结果：无法识别的 RSS／Atom 会进入有界重试和失败记录；必需源最多重试两次，可选源只重试一次并缩短单次等待，避免失效源悄悄漏新闻或拖过 08:00。自动审阅同时把外部标题、摘要和正文统一视为不可信新闻数据，忽略其中试图改流程、执行命令或索取凭证的文字。
- 固化读者价值选题口径：重大模型／产品、能力／可用性、用量规则、实用开发者工具和可信且显著的价格／额度变化使用同一 7 分门槛，达到门槛后不得因“只是产品新闻”或受众较窄而排除；临时促销、纯娱乐与小型维护仍可低于门槛。时间窗口与事件阶段去重规则未改。
- 修复“从提问到上线：普通人如何用 AI Agent 放大执行力”取消置顶后从知识库列表和分类栏消失：文章详情始终处于 `published`，实际原因是公共列表接口只返回最新 50 条摘要，取消置顶后该文按 6 月 14 日原发布日期落到截断边界之外，唯一的 `ai` 分类也因前端只看到截断列表而消失。
- 公共文章摘要归档上限提升为 500，Knowledge 前端显式请求同一容量；首屏仍只渲染 12 条并通过“加载更多”分批展开，搜索、分类和计数则覆盖完整归档。新增超过 50 条受控文章的回归，固定验证未置顶旧文章和 `ai` 分类仍可发现。
- 新增三语公开更新记录 `seed-update-2026-07-28-knowledge-archive-visibility`，同步完整 fallback、Home 最新五条、Functions 与 schema seed；公共／API 表示版本更新为 `20260728-knowledge-archive-r1`。
- 本批完整发布门禁通过：公共模块图 20 / 20、全量测试 327 / 327、发布级 Headless 192 / 192、A Dark Room 浏览器回归、静态构建以及连续两次一致的生产构建均成功。
- 修复普通 seed 文章的后台置顶状态被冷启动覆盖：`seed-ai-agent-workflow-guide-2026-06-14` 改为仅在缺失时插入元数据，并通过 `site_runtime_state.article_ai_agent_workflow_pin_repair_v1` 一次性把“从提问到上线：普通人如何用 AI Agent 放大执行力”恢复为未置顶；后续后台置顶／取消置顶及 row revision 均不会被种子重写。
- 将“返回文章列表”移入 `.article-reader-sidebar` 并置于目录上方，桌面与横屏由整个侧栏统一 sticky，不再用两个独立吸顶偏移造成重叠；目录点击改为正文容器内的精确即时定位，使目标标题、URL hash、焦点与 `aria-current` 同步到同一章节。
- 新增三语公开更新记录 `seed-update-2026-07-28-article-pin-sidebar-navigation`，同步完整 fallback、Home 最新五条、Functions 与 schema seed；公共／API 版本更新为 `20260728-article-pin-sidebar-r2`，后台主脚本更新为 `20260728-admin-article-pin-persistence-r1`。
- 修复 GitHub Actions 的历史日报校验红灯：2026-07-27 schema v3 one-shot 改用仓库内紧凑 provenance fixture，不再依赖被忽略的本地 Horizon 完整运行目录；覆盖入口只允许已登记历史窗口，schema v4 正式运行会明确拒绝。
- 最终本地验证为公共模块图 20 / 20、全量测试 326 / 326、文章专项 16 / 16、发布级 Headless 192 / 192、A Dark Room 浏览器回归及静态构建全部通过；生产产物连续两次构建清单一致。
- 修复知识库文章页目录与阅读导航：目录项取消固定高度，以统一行高和上下内边距承载多行标题；目录列表改为占用侧栏剩余高度，并在右侧和底部保留滚动安全区，最后几条标题不再被裁切或压到滚动条箭头。桌面、短竖屏和短横屏规则均同步处理。
- “返回文章列表”改为文章阅读容器内的左上角吸顶控件，正文滚动时保持原位；“回到顶部”由帧管线根据正文卡片、文章窗口和任务栏／移动 Dock 的实际几何固定在阅读区右下角，点击只滚动 `#article-detail` 并把焦点归还文章标题。
- 知识库“全部”筛选现明确排除 `site-updates`，按钮计数也使用同一过滤结果；网站更新日志只在“更新记录”专属 Tab 显示。欢迎弹窗从长期版本标记改为访问设备的本地自然日标记，每天首次打开任意公开页面时显示一次，并在实际打开时立即记录当天。
- 新增三语公开更新记录 `seed-update-2026-07-28-knowledge-reader-welcome-fixes`，同步 `content.updates`、Home 最新五条投影、Functions seed 与 schema seed；主脚本、知识库模块、路由／移动样式和 API 表示版本更新为 `20260728-knowledge-reader-welcome-r1`，静态最近更新日期同步为 2026.07.28。
- 本批最终本地验证为 20 个公共模块、326 / 326 项测试与静态构建通过；文章专项在 359×500、375×667、390×844、844×390、1280×720、1440×900 共 16 / 16 项通过，发布级 Headless 矩阵 192 / 192 通过。完整公共 UI 审计中的文章 History、更新记录筛选、欢迎弹窗和全部本批关联场景均通过；整套命令仍单独报告 5 个既有桌面壁纸网络观察场景“未观察到请求”，同次发布审计的桌面动态壁纸预载检查通过，本批没有改动壁纸链路。
- 每日 AI 新闻标题改为内容导向的固定格式：中文 `每日 AI 新闻｜<今日要闻标题>`、英文 `Daily AI News | <Lead Story headline>`、日文 `毎日AIニュース｜<今日のトップニュース見出し>`；竖线后必须完整复用正文第一条要闻标题，日期继续由发布时间和 slug 表达。schema v4 校验器会拒绝纯日期标题或与头条不一致的标题，7 月 28 日三语文章同步改为 Anthropic 开放权重立场标题。
- 使用修复后的正式流程重跑 7 月 28 日窗口：27 个多语主题查询全部完成，得到 863 条精确窗口候选，最终保留 8 条并通过 schema v4 来源、覆盖、去重、三语结构和 AI 解读校验。线上同 slug 文章已原位替换为中、英、日 8 条版本，保留原创建／发布时间，三个公开接口与校验稿完全一致；公开缓存与 API 表示版本同步更新为 `20260728-daily-ai-news-coverage-r1`。
- 修复 Horizon 的两个本地漏报／阻断点：Google News 抓取器即使内部报错后返回空数组，也不再被记作“真实空结果”；查询改为两路受控并发、失败最多重试两次，仍失败则整期关闭。候选索引改为直接写入确定性的 UTF-8 字节后计算 SHA-256，避免 Windows 自动换行让清单指纹与文件不一致。
- 已更新现有 Codex 定时任务 `ai-7-8`，继续每天北京时间 07:00 启动，并明确执行不限语言的可靠来源发现、失败与真实空结果区分、完整覆盖签收和少于 5 条时的第二轮审阅；未创建重复任务。
- 排查 2026-07-28 每日 AI 新闻仅保留两条的原因：Horizon 在精确 24 小时窗口内实际提供了 383 条候选，短稿不是抓取总量不足，而是编辑阶段只登记了两条入选和少量排除项，没有逐一签收重点实体／主题查询，也没有在低产量时启动补查；光刻机与部分国产模型等明确主题同时缺少专门检索。
- 每日 AI 新闻工作流升级为 schema v4：Horizon 产物新增紧凑候选索引与 coverage manifest，编辑运行必须记录 required query／entity group 的覆盖签收。初选少于 5 条只会强制启动第二轮审阅和定向补查，不是最低条数，复核后仍可少于 5 条或无稿，禁止用窗口外、重复或低价值内容凑数。
- 新闻发现不再限制来源语言，可靠的中文、英文、日文、韩文及其他语言来源均可进入复核，并用重点厂商的英中日韩常用别名提高召回；长期覆盖 AI 模型厂商，以及芯片／光刻／存储、机器人、智能设备、数据中心能源与网络、科技金融。跨日去重改为 `eventKey + eventStage`，同一事件的正式发布、开放权重等实质新阶段可在记录 material update 后再次入选。
- 调整每日 AI 新闻文章详情：投递摘要不再显示在标题下方，但继续保留给知识库列表、分享卡片和搜索元数据；边缘直达页的 `noscript` 正文同样不重复摘要。
- 每日 AI 新闻正文改为日期标题后直接进入“今日要闻”，移除公开的采集窗口／筛选说明；2026-07-27 三语样稿由幂等数据修补同步更新，真实窗口继续只保存在 Horizon 候选与内部运行记录。
- 每日 AI 新闻目录改为逐条列出全部新闻的唯一标题，不再只显示“今日要闻 / 主要新闻 / 传闻”；普通知识库文章继续沿用原目录规则。工作流、固定文风、自动任务提示和校验器同步固化该规则，并拒绝标题后公开导语或重复新闻标题。
- 删除三语“每日 AI 新闻测试占位”文章的 Functions seed 与 schema seed；部署后的同批数据修补会精确删除线上旧占位记录，分类本身继续保留。
- 新增三语公开更新记录 `seed-update-2026-07-28-daily-ai-news-reader-format` 并同步四处 seed / fallback；公开主脚本、知识库模块和 API 表示版本更新为 `20260728-daily-ai-news-reader-r1`。
- 完成每日 AI 新闻生产收口：`main` 最新版本已由 Cloudflare Pages 成功部署，远端 D1 迁移完成，`daily-ai-news` 专用通道与 auto-publish 已启用；2026-07-27 三语样稿已作为一次性历史测试公开为 `daily-ai-news-2026-07-27`，中英日 API、文章直达页与重复投递幂等均通过，远端保持一篇文章和一条投递事件。本机 Codex 定时任务 `ai-7-8` 已启用，每天北京时间 07:00 启动并在 08:00 硬截止前完成或失败关闭；本地模式要求电脑、Codex 与网络在该时段可用。
- 稳定 GitHub 共享 runner 上的公开页面性能验收：首页首屏 TBT 固定测量三次并以中位数对原有 350ms 预算判定，其他性能场景仍只测一次；`performance-traces.json` 保留全部原始样本、中位数和最大值。请求数、传输／解码字节、load、CLS、DOM／监听器、堆内存和运行时错误仍逐样本检查，任一次结构性失败都会阻断，不通过取最佳值或放宽阈值掩盖；每个样本在读取全局 DOM 计数前回收可回收的旧导航文档，避免多样本本身制造节点假超限。
- 修复 Cloudflare Pages Git 构建兼容性：根 `wrangler.jsonc` 移除 Pages 不支持的 Worker-only `observability` 与非标准 `secrets` 元数据，变量名继续由 `.env.example` 空声明和运行时校验维护，独立清理 Worker 的 observability 保留在自己的配置中；构建守卫同步禁止这些会让 Pages 拒绝部署的顶层字段。每日新闻失败关闭说明同时区分“投递前失败”和“已返回 published 后公开核验失败”，后者停止自动重试并转人工核对，避免误报未公开。
- 记录每日 AI 新闻正式生产授权：仅 `daily-ai-news` 专用通道在显式 auto-publish 配置启用后可自动公开；每天按北京时间 07:00 启动，使用此前精确 24 小时左闭右开窗口，抓取、复核、三语校验、投递和受控公开必须在 08:00 前完成，超时或任一失败均不补发、不公开。
- 将 2026-07-27 Horizon 三语样稿定为生产链路测试输入，要求与正式运行一样保留 Horizon 来源证明、令牌、限流、幂等、slug 冲突和失败关闭约束；历史样稿只能通过显式 one-shot 参数投递，正式任务不能复用该参数。
- 自动投递通道新增默认关闭的 `auto_publish` 开关；仅在通道启用、凭证有效且该开关开启时，服务端才创建已公开文章并写入公开时间，否则仍保存草稿。后台新增独立开关与危险操作确认，撤销凭证会同时暂停通道和关闭自动公开；旧 D1 会在执行完整 schema 前安全补列。
- Horizon 生产投递固定为 `lusu575.com`，从 Git 忽略的根目录 `.dev.vars` 安全读取专用凭证；投递成功后必须在截止前核验中、英、日三个公开文章接口。生产通道使用 pending → 远端启用 → 本地 active 的两阶段配置，屏幕不显示完整凭证。
- 公开 `site-updates` 记录继续使用稳定 ID `seed-update-2026-07-27-daily-ai-news-inbox`，标题已改为“每日 AI 新闻正式上线”；`js/data/content.mjs` fallback、Home 投影、Functions seed 与 schema seed 四处完全同步。主站、知识库、API 与后台主脚本版本更新为 `20260728-daily-ai-news-production-r1`；后台样式继续使用 `20260727-daily-ai-news-inbox-r1`。

## 2026-07-27

- 将本次试稿确认的文章格式与文风固化为长期工作流契约。新增 `自动新闻/integrations/lusu-site/ARTICLE_STYLE.md`，记录固定日期标题、24 小时窗口导语、“今日要闻 / 主要新闻 / 传闻”三段顺序、中性事实标题、一段式新闻正文、逐条 AI 解读和传闻条件语气；`AGENTS.md` 要求后续代理先读取该标准。工作流升级为 schema v3，校验器新增固定三语标题、窗口导语、AI 解读一至两句且短于事实段、单条以 AI 解读结束、禁止重复传闻核实标签等硬性检查，专项测试增至 11 项并全部通过；现有 12 条试稿仍通过新版规则。
- 每日 AI 新闻工作流升级为固定成稿时刻前的精确 24 小时窗口，采用“包含开始、不包含结束”的边界；Horizon 主题发现扩展到 AI、芯片与存储、机器人、AI 设备、自动驾驶、数据中心／散热／能源／网络和科技金融。新版校验器要求每条入选新闻具有准确发布时间并位于窗口内，正文固定为“今日要闻 / 主要新闻 / 传闻”，传闻只用独立分区和条件语气区分，不再逐条重复“未证实”。每条新闻的 AI 解读统一为明显短于正文的一至两句，只挑关键影响、现实门槛、隐含限制或下一步观察点，不复述新闻，也不为了找问题而硬挑问题。
- 完成北京时间 2026-07-26 23:00 至 2026-07-27 23:00 的 Horizon 试运行：合并前 416 条、合并后 411 条、窗口内 350 条，最终按重要性和一手核验保留 12 条，覆盖 Kimi K3 完整权重、存储芯片、工程代理、AI 安全、液冷、自动驾驶、机器人、工作研究和科技金融，并将两条市场消息单列为传闻。三语本地样稿保存在 `自动新闻/integrations/lusu-site/runs/2026-07-27-2300.json`，已通过来源、24 小时窗口、三段结构、逐条 AI 解读和正文无链接验证；没有投递到本地 D1，没有发布、调度、推送或部署。
- 在 `自动新闻/integrations/lusu-site/` 建立以 Horizon 为必经数据入口的个人站工作流。新增 Horizon 原生配置和抓取入口，真实调用其多来源抓取、网址规范化与跨来源去重；RSS 单源发生瞬时失败时仍由 Horizon 自带抓取器定向重试，不改用手工浏览冒充采集。Codex 只从本次 Horizon 运行产物中做重要性判断、一手来源复核、近 30 天故事去重和三语整稿。
- 完成 2026-07-27 Horizon 实跑：最终稳定运行从 Hacker News、RSS、Reddit、OSS Insight 与 Google News 共取得 113 条合并后候选，并按 `Asia/Shanghai` 自然日筛出 74 条。编辑层不写死条数，最终保留 Kimi K3 发布预告、Open Secure AI Alliance、SSI 与 NVIDIA 合作、Cosmos-H-Dreams 四件事；发布方日期为 7 月 26 日的 Agent Toolkit 与 Vera CPU 消息明确排除，OpenAI 工作任务研究保留为未入选候选。样稿记录真实 `horizonRunId`，验证器会反查 Horizon `daily_candidates.json`，禁止把非 Horizon 来源冒充自动采集。
- 新增 `npm.cmd run ai-news:horizon:fetch`、`npm.cmd run ai-news:validate` 与 `npm.cmd run ai-news:deliver:local`。Horizon 的锁定依赖已安装在其被忽略的本地 `.venv`，没有填写云端模型密钥；当前由 Horizon 负责采集和初次跨源去重，Codex 承担编辑判断与成文。此前写入本地 D1 的两条消息草稿属于早期规则试投，未作为本次 Horizon 实跑验收稿覆盖；新稿先给站长审阅。没有创建每日定时任务，没有连接生产 D1，没有自动发布、推送或部署。后台私有更新记录与 JS 缓存版本同步为 `20260727-daily-ai-news-local-workflow-r1`。
- 知识库新增固定分区“每日 AI 新闻 / Daily AI News / 毎日AIニュース”。该分区即使暂时没有文章也会保留入口，并新增一篇三语“每日 AI 新闻测试占位”公开文章，用来确认分类、列表和文章详情链路；正文明确标注为测试内容，不冒充真实新闻。
- 管理后台在“知识库文章”之后新增“自动投递”页面。站长可查看固定投递目标、开启或暂停入口、复制地址、生成／轮换／撤销一次性显示的访问令牌，并查看最近投递结果；投递成功后可直接进入知识库文章列表审阅。
- 新增每日 AI 新闻专用投递接口与 D1 配置／事件表。外部投递固定写入 `daily-ai-news` 分类，只能创建不置顶、无封面、无发布时间的三语草稿；服务端校验 Bearer 令牌、正文大小、重复请求、slug 冲突和频率上限，不接受调用方改写分类、发布状态或置顶状态。令牌只保存 SHA-256 摘要和提示，不保存或回传完整明文。未鉴权请求只初始化轻量通道表，不触发文章种子；幂等记录保存规范化内容指纹，同一标记改投不同内容或原草稿已删除时明确返回冲突，不再假报成功。
- 当前只完成网站、后台和安全投递入口的本地改造；没有创建每日定时任务，没有填入任何模型或平台密钥，没有自动发布文章，也没有连接生产 D1、推送或部署。公开与后台资源版本统一为 `20260727-daily-ai-news-inbox-r1`，三语 `site-updates` 记录 `seed-update-2026-07-27-daily-ai-news-inbox` 已同步完整 fallback、Home 最新五条投影、Functions seed 与 schema seed。
- 新增自动投递 API、后台页面、知识库固定分类、全新 schema 与公开资源契约测试。最终本地 D1 迁移、静态构建和 300 / 300 项全量测试通过；只读核对确认测试文章为 published、三种翻译齐全，投递通道仍为暂停且没有令牌。同时修正游戏存档测试中已到期的固定 session 时间与公共壳日期断言。仅有既存的 Node 模块类型性能警告，没有失败项。

## 2026-07-26

- 完成公开站点、Cloudflare 后端与管理后台的一次性安全加固：所有账号及写请求增加同源、JSON 类型和流式正文上限；登录／注册按 IP 与账号标识写入 D1 限流，重复邮箱、站长保留邮箱和并发注册统一返回不可枚举的 `REGISTRATION_FAILED`。PBKDF2-HMAC-SHA256 新哈希提升至 600,000 次，旧 25,000／100,000 次哈希在成功登录后自动升级；意外 5xx 不再把内部异常返回浏览器。
- 分析写入增加频率上限与重复抑制，文章阅读计数只在去重写入成功后增加；每日健康检查分批清理过期 session、365 天登录记录、180 天 page/click 记录和 2 天限流桶。`cloudflare/schema.sql` 新增 `api_rate_limits`，Wrangler compatibility date 固定为当前锁定运行时可启动的 `2026-07-17`，并补齐采样日志／追踪与运行时变量边界。
- 修复 legacy D1 初始化顺序：本地与远端迁移先为聊天、禁言、Transfer 历史表补列，再执行依赖索引与完整 schema，并用真正旧库 fixture 验证保留数据和幂等升级。CI 固定 `actions/checkout`、`actions/setup-node` 到不可变 commit，执行本地 D1、全量测试、公共模块图、静态构建、可重复生产构建、公共 UI 与 A Dark Room Headless 发布审计。
- 后台文章、视频、视频分类、社交链接、元数据刷新与删除加入 `expectedUpdatedAt` 乐观并发控制；文章翻译和视频分类关系与主记录原子受保护。陈旧后台标签页会保留当前输入并显示合并提示，不再静默覆盖或删除较新内容。后台 JS query 更新为 `20260726-admin-concurrency-safety-r1`。
- 临时互传设置采用 revision 条件更新；清空房间、过期清理和 R2 删除出现部分失败时返回非 2xx、失败对象及重试信息。管理页补齐离开保护、并发冲突恢复、全局写锁、可访问危险确认、搜索取消／序列、分区加载降级、键盘表格和孤立对象清理；Transfer 管理资源版本为 `20260726-admin-transfer-safety-r1`。
- 新增 `functions/articles/[slug].js`，直接访问 `/articles/<slug>` 时在边缘输出文章专属 title、description、Open Graph、Twitter、canonical、Article JSON-LD 与安全 `noscript` 正文；不存在的文章返回 404 / noindex，数据库暂时失败仍保留前端 fallback 主壳。全站与后台响应头同步补齐 CSP、frame、Permissions Policy、HSTS、referrer policy 与 nosniff 边界。
- 游戏目录和日语工具可选 manifest 加入 7 秒超时、Abort、版本缓存及本地回退，网络异常不再阻塞内置内容或已有存档；日语题目先渲染、音频异步加载，并清理重复 `noMedal` 键。生产构建的日语工具路径转换现严格匹配一次并保留音频 manifest 版本 query，既不会把新缓存版本丢进产物，也不会在重复／缺失引用时静默继续。首页壁纸预载与 CSS 使用完全一致的候选资源，首屏同步识别 reduced motion，避免重复下载或瞬时请求动态壁纸。
- 公开入口、样式与 ESM 模块缓存版本统一为 `20260726-security-reliability-r1`；三语 `site-updates` 记录 `seed-update-2026-07-26-security-reliability-hardening` 已同步完整 fallback、Home 最新五条无正文投影、Functions seed 与 schema seed。账号错误文案同步为不可枚举注册失败和限流提示；本批未连接生产 D1、未推送、未部署。
- 本批最终本地门禁全绿：legacy 本地 D1 迁移完成，297 / 297 单元与契约测试、20 个公共模块依赖图、静态构建、两次完全一致的生产构建（11,494 个文件、392.14 MiB，manifest SHA-256 `fbc56fe9f178f2d00fb050f80d872b558985d47b6117f0325b620f64c74797bd`）、192 / 192 Headless Chrome 发布矩阵与 A Dark Room 390→844→390 同文档旋转审计均通过。真实 `wrangler pages dev` 冒烟确认健康接口 200、版本文章 200 / 专属 canonical、缺失文章 404 / noindex、未登录后台 401 / noindex 且 Functions 安全响应头完整；临时服务和浏览器进程均已关闭。未连接生产 D1、未推送、未部署。
- 重绘并直接替换匿名聊天室唯一规范资源 `assets/images/icon-chatroom.png`：新图保持 96×96 RGBA 与 XP 像素聊天终端／粉青双气泡语义，将非透明主体由旧图的 93×90 收敛为 71×73，四边保留 10–13px 透明安全区；桌面 Home 82px 与移动 Home 54px 映射不变，18–54px 小槽位继续使用 contain。Home、窗口标题栏、桌面任务栏／移动 Dock、欢迎快捷入口、Chat 页头和消息头像现全部引用新图，`icon-chatroom-clean.png` 已删除，生产构建也不再排除规范资源。公开缓存版本统一为 `20260726-chatroom-icon-redraw-r2`，三语 `site-updates` 记录 `seed-update-2026-07-26-chatroom-icon-redraw` 已同步完整 fallback、Home 最新五条无正文投影、Functions seed 与 schema seed，并新增尺寸、Alpha、透明角点、文件预算与旧资源不得残留守卫；本批不需要直接写入生产 D1。
- 匿名聊天室图标批次验证通过：261 / 261 全量测试、20 个公开模块依赖图、静态构建、147 / 147 公共 UI 审计与两次完全一致的生产构建均通过，生产 manifest SHA-256 为 `d13af5e9cfa49d3d83c674f11ebfeca469b3c5fa40954d7303c254447d95ed7a`；生产产物只包含新的 `icon-chatroom.png`，旧 `clean` / `desktop` 路径及引用均为零，截图核对覆盖桌面／移动 Home、标题栏、任务栏／Dock、欢迎入口和 Chat 头像，仅保留既有日语工具 `noMedal` 重复键警告。
- 完成全界面点检后的移动游戏修复：A Dark Room 在窄屏按实际面板宽度滑动，资源、主操作与声音选择窗不再沿用 700px 桌面几何，声音提示同步中文／English／日本語；同页横竖屏切换会重新测量两层滑轨、当前偏移与资源面板归属，返回桌面宽度时恢复原 700px 布局。Kittens Game 将上游 1300px 三栏在 ≤900px 改为营火→资源→日志单列，顶部工具栏在窄屏自然换为两行，Steam／Version 完整显示不裁切，全部可见关键控件与折叠／日志热区保持至少 44px，桌面三栏不变。
- Kittens Game 的嵌入副本移除上游 Google Analytics，禁用只适用于原站的 KGNet 登录／同步和 `localhost:7780` 桥接请求，只加载当前主题并在切换时按需加载，避免为未使用主题请求 Google Fonts；文档语言在首屏按中文／English／日本語同步，内部构建修订提升为 `4`，移动 CSS query 为 `20260726-mobile-r3`。这些变更不影响本站游戏 localStorage、JSON 备份或账号云存档。2048“新游戏”、Hextris 核心操作及五游戏共享壳的返回、登录、下载、导入和云存档控件同步达到移动 44px。
- Life Restart 新增仅在粗指针环境启用的运行时移动适配：主操作与所有可见 `btn*` hitArea 均保持至少 44px，竖屏把工具操作与主流程分离，短横屏将工具放入底部横排；细指针桌面几何维持上游原样。内部缓存版本为 `20260726-life-mobile-touch-r1`。
- 五游戏共享壳固定为一个 `100dvh` 网格，外层 document 不再滚动，工具区按短屏压缩，iframe 使用剩余空间并成为游戏内容的滚动主体；共享壳版本为 `20260726-game-mobile-shell-r1`，2048／Hextris 内部样式版本为 `20260726-mobile-touch-r1`。
- 公共 UI 同步收口：359×500 欢迎窗增加首屏可读容量；视频内嵌失败时使用紧凑决策窗，不再保留大面积空白；桌面模态遮罩提高背景层级对比，Tools／About 长文案使用更自然的换行。主站入口与 ESM 模块缓存版本统一为 `20260726-interface-audit-fixes-r2`，A Dark Room 本轮四项内部资源统一为 `20260726-a-dark-room-mobile-r2`。
- 新增 A Dark Room、Kittens Game、共享游戏壳和公共弹窗／更新投影专项契约测试；三语 `site-updates` 记录 `seed-update-2026-07-26-interface-audit-fixes` 已同步完整 fallback、Home 最新五条无正文投影、Functions seed 与 schema seed。未连接生产 D1，未推送、未部署。
- 本批最终门禁全绿：261 / 261 单元与契约测试、20 个公开模块依赖图、静态构建、两次完全一致的生产构建（manifest SHA-256 `dd99d2a75ea725c9efc34cc4e6b0671821dad9a22f0b6ed140f74d54f9f6d5cb`）、190 / 190 发布矩阵、147 / 147 完整公共 UI 审计及 58 / 58 Tools／Quick Transfer 三语专项均通过；A Dark Room 同页 390→844→390 旋转、Kittens 顶栏完整换行与 Life Restart 两种手机方向的真实触摸也分别通过。仅保留既有日语工具 `noMedal` 重复键警告；未连接生产 D1、未推送、未部署。
- 公开“资源区”显示名统一更名为中文“工具区”、English “Tools”、日本語“ツール”，并同步首页桌面入口、窗口标题、任务栏／移动 Dock、Appbar、文档元信息、空状态、Quick Transfer 返回操作、后台访问路径标签与三语维护文档。旧文章中的“资源区 / Resources / リソース”标签继续兼容，但在当前界面统一显示新名称。
- 本次只调整公开显示层：内部 `resources` 路由、`#resources` 收藏链接、DOM／CSS、模块、API、统计和审计标识均保持不变；新增精确三语名称、Transfer 返回文案与深链兼容回归。公开缓存版本更新为 `20260726-tools-rename-r1`，后台脚本版本为 `20260726-admin-tools-label-r1`；三语 `site-updates` 记录 `seed-update-2026-07-26-resources-to-tools` 已同步完整 fallback、Home 最新五条无正文投影、Functions seed 与 schema seed。未连接生产 D1，未推送、未部署。
- 更名批次最终验证通过：Tools／Quick Transfer 三语六视口专项 58 / 58（同时真实点击两种返回入口），全量测试 242 / 242、20 个公开模块依赖图、静态构建、两次完全一致的生产构建（manifest SHA-256 `2bc1790f7806a02721c53a23d354a6b36b8df81ad69d5938249bbffbd91c82d5`）及发布矩阵 190 / 190 均通过；残留扫描确认当前运行时没有旧栏目名，也没有 `#tools` 等错误技术迁移。仅保留既有日语工具 `noMedal` 重复键警告。
- 修复用户截图中的手机 Knowledge 文章首屏大面积空白：根因是懒加载 `css/routes/knowledge.css` 被追加到 `css/mobile-ios-shell.css` 之后，同等优先级下重新写回桌面侧栏 `min-height`。`index.html` 现为移动样式增加稳定 marker，`js/main.js` 将全部 route CSS 固定插在移动样式之前，移动样式再以高优先级规则保护阅读侧栏；359×500、390×844、844×390 首屏分别可见约 109px、346px、82px 正文，而原 390×844 截图正文可见量为 0。
- 统一修复点检发现的移动端问题：844×390 英文 Resources 卡改为按内容高度排布，不再有 20.75px 子项越界；文章短竖屏把返回与目录同排，常规目录允许完整换行；阅读进度在正文末尾完成，不把 Dock 安全尾距算入正文。收起 Dock 同时使用 `inert`、`aria-hidden` 与 `visibility:hidden`，回顶按钮在顶部原生 `hidden`，激活后焦点交还 `#article-detail-title`；目录使用文章实际语言并移除重复容器 Tab 停靠点，图片空 `alt` 配合可见 `figcaption` 避免重复朗读。
- 公开缓存版本统一更新为 `20260726-mobile-reading-qa-r1`；三语 `site-updates` 记录 `seed-update-2026-07-26-mobile-article-first-screen` 已同步 `js/data/content.mjs` 完整 fallback、`js/data/home-content.mjs` 最新五条无正文投影、Functions seed 与 schema seed。文章专项 10 / 10、Resources 三语布局 58 / 58、完整公共 UI 审计 147 / 147 均通过；最终 `npm.cmd run verify:public-site-release` 全绿，包含 240 / 240 测试、20 个模块依赖图、静态构建、两次完全一致的生产构建（manifest SHA-256 `69f50b9df664d7afdbb317744795fdb8068d10e734115ee9ddd911f1799314a9`）与 190 / 190 发布矩阵。仅保留既有日语工具 `noMedal` 重复键警告；未连接生产 D1、未推送、未部署。
- 完成用户审计清单的 30 项功能与界面优化：在原有云存档 CAS／冲突备份、Quick Transfer 真实安全边界和四态连接检测基础上，补齐账号 8 秒超时与原位重试、聊天室真实重连与手动重试、密码房单飞切换、知识库多词 AND 搜索和滚动／History 复位、视频／资源筛选焦点恢复、视频空分类“显示全部”主操作，以及游戏目录后台刷新失败的缓存提示。
- 三语与无障碍同步收口：首屏按受支持 query 提前设置 `html.lang`，文章列表和回退正文使用 API 实际语言；移动语言按钮完整显示当前语言并播报下一语言；Chat 密码错误、300 字计数与 Quick Transfer 口令说明均关联输入控件，上传区移除伪按钮键盘代理并保留原生文件选择器。资源卡在手机完整展示说明，将事实字段、标签和 CTA 分层；游戏卡直接显示中／英／日支持情况，简介放宽到三行，原生详情控件统一 44px。
- 新增／扩展账号、Chat、Knowledge、Videos、Resources、Games、连接状态、云存档冲突、Transfer 与公共壳专项回归；Home 懒加载审计将 `/api/health` 识别为壳层健康检查而非业务 API。公开缓存版本统一更新为 `20260726-complete-30-optimization-r1`；三语更新记录继续使用 `seed-update-2026-07-26-trust-safety-status` 的稳定 ID，并已将标题、摘要和正文扩展为完整 30 项说明，同步完整 fallback、Home 五条投影、Functions seed 与 schema seed。
- 云存档冲突改为明确的三语 XP 决策窗口：发现较新云端版本后立即锁住 30 秒计时、切后台、退出、导入和手动同步等全部上传入口；用户可先下载本地 JSON 备份，再选择恢复云端、明确以本地覆盖当前云端版本或暂不处理。Escape、外点与取消都只暂停，不会再沿旧分支把本地存档反向写回；恢复云端前会重新获取并核对当前版本，弹窗停留期间再次变化时刷新冲突而不应用旧快照。
- 游戏存档 API 新增原子乐观并发控制。客户端每次 PUT 携带精确 `expectedUpdatedAt`，首次创建显式传 `null`；D1 只允许首次原子插入或版本匹配的条件更新，陈旧页面／并发标签页／其他设备竞争时返回 `409 + SAVE_CONFLICT` 并保留新云端数据。客户端云版本基线改为标签页级 `sessionStorage`，不再从共享 `localStorage` 借用其他标签页的新版本号上传旧进度；服务端成功写入的版本时间也保证严格递增。五个游戏入口同步更新共享 JS／CSS 缓存版本，短横屏冲突警告与 44px 决策操作保持可见。
- Quick Transfer 的资源卡、登录说明、房间安全提示、上传配额与历史更新文案统一到真实边界：文字在浏览器使用 AES-GCM；图片、视频和文件不使用房间口令加密，只通过 HTTPS、私有 R2 与服务端鉴权保护，且不做病毒／恶意软件扫描；配额明确为滚动 24 小时，拖放明确先进入待发送附件。
- PC 任务栏静态 `ONLINE` 改为可点击重试的真实服务状态：初始检查中，只有 `/api/health` 返回 `2xx + ok:true + db:true` 才显示在线；浏览器离线、服务异常和健康恢复各有独立三语文字与静态状态灯。探测使用 5 秒超时、在线 60 秒复查及 10／20／40／60 秒异常退避，页面隐藏时中止；移动 Dock 继续隐藏该非高频托盘。健康接口不再查询或公开用户数量，只返回 `{ ok, db }`。
- 新增云存档 CAS、冲突 UI、连接状态机和 Quick Transfer 三语安全边界回归测试；三语 `site-updates` 记录 `seed-update-2026-07-26-trust-safety-status` 已同步 `js/data/content.mjs` 完整 fallback、`js/data/home-content.mjs` 最新五条无正文投影、Functions seed 与 schema seed；同时更新 `PROJECT_CONTEXT.md`、主站 Skill／README 和构建守卫。未连接生产 D1，未推送、未部署。
- 最终 `npm.cmd run verify:public-site-release` 全绿：236 / 236 单元与契约测试、20 个公开模块依赖图、静态构建、两次完全一致的生产构建（manifest SHA-256 `83e1d7be5a3446de6c130435b9e2791f01430c6e2c8627b381a9da1abc821897`）及 190 / 190 Headless Chrome 发布矩阵均通过；另有 142 / 142 完整公共 UI 审计通过。仅保留既有日语工具 `noMedal` 重复键警告；本轮未连接生产 D1、未推送、未部署。

## 2026-07-21

- 移除 PC 端底部任务栏当前任务按钮的黄色底边、黄色外描边与常亮光晕，保留蓝色按下背景、内凹层级和清晰文字对比；键盘 `:focus-visible` 焦点环继续保留，移动 Dock 的选中底板、滑动与触控范围不变。
- 公开缓存版本统一为 `20260721-desktop-taskbar-active-r1`；三语 `site-updates` 记录 `seed-update-2026-07-21-desktop-taskbar-active` 已同步 `js/data/content.mjs` 完整 fallback、`js/data/home-content.mjs` 最新五条无正文投影、Functions seed 与 schema seed，并更新项目上下文、主站 Skill／README 和构建守卫。未连接生产 D1、未推送、未部署。
- 上线前统一门禁先捕获并修复 Videos 在 844×390 三语横屏中的 44px 操作按钮越出卡片问题；最终 `npm.cmd run verify:public-site-release` 全绿，包含 203 / 203 全量测试、19 个公开模块依赖图、静态构建、190 / 190 发布矩阵，以及两次一致的可重复生产构建（manifest SHA-256 `b8815ecda47c5403cc7395359cb3c25c6d02f7887d967655c3afd78f439ad045`）。另有 142 / 142 完整公共 UI 审计通过，桌面任务栏截图确认活动按钮不再显示黄色常亮层；仅保留既有日语工具 `noMedal` 重复键警告。

## 2026-07-20

- 完成公开主站 30 项界面与美观度精修：1280×720 Chat 改为日志弹性收缩并完整保留 composer／footer，移动短屏与 844×390 横屏使用两行身份／房间结构，字数计数并入输入状态行；视频卡保持真实 16:9，欢迎窗口改为桌面 2×2 快捷入口与移动单滚动容器，Knowledge 使用宽屏双列与 72ch 正文，Resources 元信息、全站字号、图标光学尺寸、最近更新、顶栏分组、任务栏 active、路由 accent 和卡片边界同步整理。
- 完成交互、状态与动效收口：视频封面改为带标题可访问名称的原生按钮，播放器失败卡内相邻提供重试和原视频，8 秒 iframe 超时使用 request generation + settled 防止旧 timer 覆盖新结果；Knowledge、Videos、Resources、Games、Blog 与 About 统一 `.content-state`，真实错误使用 alert，重试后恢复焦点。disabled／aria-disabled／inert 控件不再产生按压反馈，maximize／restore 使用真实前后几何 FLIP，关闭与最小化方向明确，主题切换移除 root View Transition。
- motion off 现在硬停止硬编码 transition／animation、Dock smooth scroll 与选中滑动、骨架循环和主题快照；reduced 同步停止非必要循环，full 模式仅保留克制的品牌骨架扫描。移动文章 Appbar 保留路由身份，Dock 与正文小字提升可读性，同时减少重复描边并保持 44px 触控目标。
- 公开缓存版本统一为 `20260720-ui-motion-polish-r1`；三语 `site-updates` 记录 `seed-update-2026-07-20-ui-motion-polish` 已同步 `js/data/content.mjs` 完整 fallback、`js/data/home-content.mjs` 最新五条无正文投影、Functions seed 与 schema seed，并更新项目上下文、主站 Skill／README、构建守卫与 UI 审计契约。未连接生产 D1、未推送、未部署。

- 验证通过：`npm.cmd run build`、203 / 203 全量测试、19 个公开模块依赖图、142 / 142 公共 UI 审计、58 / 58 Resources / Quick Transfer 专项矩阵、3 / 3 视频播放器专项，以及两次一致的可重复生产构建（manifest SHA-256 `63569f4fc70fcc0fcfa646e8657680ab214de7b3a76d36e254857faa535728e5`）。生产构建仅保留既有日语训练工具 `noMedal` 重复键警告；本轮未连接生产 D1、未推送、未部署。

## 2026-07-19

- 恢复既有浏览器中的历史 Bilibili 手动封面：线上核对确认 11 张旧封面仍完整保存在 D1、同源代理均返回有效 JPEG，空白来自 `/api/videos` 旧 ETag 只依赖数据库行时间，代码修复后仍返回 304 并复用旧空响应。公开视频列表与详情现按完整响应生成 ETag，本地上传封面代理 URL 同时携带视频更新时间版本，历史空缓存和今后换图的旧缓存都会自动失效；前端 960×540 固有尺寸边界也与服务端一致。公开缓存版本为 `20260719-video-thumbnail-cache-r2`，三语 `site-updates` 记录 `seed-update-2026-07-19-historical-video-thumbnail-cache` 已同步 `js/data/content.mjs` 完整 fallback、Home 五条投影、Functions seed 与 schema seed。

- 修复知识库、视频、资源、游戏和账号区的公开体验：全部 `site-updates` 更新日志改为非置顶，Functions 后台文章写入会强制该分类 `is_pinned = 0`，schema 迁移也会清理历史置顶；知识库标题栏删除无实际用途的最小化与缩放／还原，只保留关闭。公开视频封面上限由 640×360 对齐到后台真实上传的 960×540、继续保持 320KB 限制，Bilibili 手动封面恢复显示，所有视频封面的蓝色圆圈移除。使用图像生成流程新增临时互传和五款游戏的六枚 192×192 RGBA 独立图标；登录仅显示一次密码，确认密码仅注册显示，登录后隐藏完整表单并只留成功状态与退出。公开缓存版本为 `20260719-content-experience-fixes-r1`，三语 `site-updates` 记录 `seed-update-2026-07-19-content-experience-fixes` 已同步 `js/data/content.mjs` 完整 fallback、Home 五条投影、Functions seed 与 schema seed。

- 恢复知识库、日语与临时互传联动服务：修复 `seed-update-2026-07-18-frame-pipeline-low-performance` 三语文章 seed 漏传时间戳、导致 D1 bind `undefined` 并使 `/api/articles` 全语言返回 500 的问题；Quick Transfer 严格同源白名单现兼容 `/fragments/quick-transfer.html` 与 Cloudflare clean URL `/fragments/quick-transfer`，不再把生产重定向误判为非法片段。本地预览补齐两个独立隐私盐并恢复 `/api/health`；新增全量文章 seed bind 与片段 URL 正反例测试。公开缓存版本为 `20260719-service-recovery-r1`，三语 `site-updates` 记录 `seed-update-2026-07-19-service-recovery` 已同步完整 fallback、Home 五条投影、Functions seed 与 schema seed。

- 管理后台修复未编辑也触发离开保存确认的问题：dirty 状态改由真实表单输入维护，异步默认排序、视频分类选项和详情填充不再被误判为人工编辑；主后台新增“互传文件管理”入口，独立受保护页支持分页查看文件、发送账号、保存 / 过期时间和状态，并可永久删除 R2 对象及 D1 记录。后台脚本、管理接口、回归测试和后台私有文档已同步；本次未修改公开主站 UI、三语 `site-updates`、Home 最近更新或公开 fallback。

- 修复 GitHub Actions Linux runner 对 Quick Transfer 图集的跨平台可重复性误报：Sharp / libvips 在 Windows 与 Linux 上可能生成像素等价但 PNG 压缩字节不同的文件，因此同一运行时的双次构建继续要求逐字节一致，跨平台提交图则改为解码 RGBA 后使用严格的通道、alpha 与大差值比例阈值比较；原有尺寸、透明角点、16 格可见比例和洋红残留检查保持不变。本项只修复 CI 门禁，不改变公开图集、资源 query、页面行为或生产数据。

## 2026-07-18

- 修复 Resources / 临时互传的紫色图标根因：`quick-transfer-icons-source.png` 保留为洋红抠图源，新增可重复构建脚本先做柔和色键与边缘去色，再生成 168×168 RGBA 透明生产图集；16 个 sprite 单元均由透明角点与可见像素比例测试保护，公开资产扫描未发现第二个同类运行时文件。Resources 桌面窗口收敛到 960px，资源图标统一 42px 槽位，卡片改为内容自然高度并移除重复“可获取”标签，移动卡片不再被固定高度撑空；互传登录任务在桌面使用紧凑自适应高度、在移动壳按可用空间居中，窄屏及 760px 临界宽度去掉重复标题图标，打开/关闭会精确恢复原分类栏和列表状态。新增 `npm.cmd run audit:resources-layout`，以中、英、日三语精确覆盖 359×500、375×667、390×844、760×900、844×390、1280×720 的列表→登录→返回流程及 Home/Games 同壳参考，58/58 检查和截图已通过；Windows Headless 截图改为预热后双帧 `fromSurface: true`，避免单帧漏掉固定合成层。公共缓存版本升级为 `20260718-resource-icons-layout-r1`，三语记录 `seed-update-2026-07-18-resource-icons-layout` 的 fallback、Home 五条投影、Functions seed 与 schema seed已同步。独立管理页的共享图集与样式 query 也同步到同一版本，构建检查会拒绝全仓运行时图集 query 漂移，并以本条公开记录守卫四处 seed 一致性。未连接生产 D1，未推送，未部署。

- 对 100 项优化进行二次稳定性复查：修复冷启动 Home 的 Chat 图标因规则误置于懒加载 route CSS 而空白、聊天室标题栏误用 Blog 图标以及 359×500 / 844×390 短屏头像被隐藏的问题；移动 route / App 打开 / Dock tab 改为只动画当前页面表面，避免整页 View Transition 快照在约 220ms 内遮住真实 Dock。新增 full-motion 起始、60ms、140ms、稳定帧、40ms 快速连续切换、Dock 节点身份/可见性与 359×500 / 390×844 / 844×390 截图守卫。公开资产统一升级为 `20260718-public-site-100-r2`，三语记录已同步 fallback、Home 投影、Functions seed 与 schema seed。未连接生产 D1，未推送，未部署。

- 二次复查最终门禁全部通过：知识库分页审计改为只统计 `#knowledge-list`，避免把隐藏 Home 更新卡误算为文章列表；独立 Headless 场景统一追加唯一 `audit-stage` 并要求 CDP 返回新文档 `loaderId`，防止同文档 JS 内存缓存污染冷启动、请求中止和几何结论；移动端允许窗口背景延伸到半透明 Dock 后方，但 composer、反馈、页脚和真实内容仍必须零交叠。最终通过 192 / 192 全量测试、19 模块依赖图、普通构建、双次一致的生产构建（manifest SHA-256 `ef8606fbab8d6e2be2e3e8bec806cfaba63497af4ccd2de4b5b6269aa6ce5313`）、142 / 142 完整 UI 审计、190 / 190 发布矩阵和 Dock / Chat 图标逐帧专项；预览继续位于本地 `127.0.0.1:8788`，未连接生产 D1、未推送、未部署。

- 完成公开主站 `OPT-001—OPT-100` 全量收口：在保留 Windows XP + Pixel Art + Y2K 视觉的前提下，完成路由作用域与按需加载、响应式主题图与图集轻量化、Knowledge / Videos / Resources / Games / Blog / About 可用性、账号 / Chat / Quick Transfer 的可恢复交互与幂等保护、三语状态保留、移动 Dock / 短屏 / 横屏 / 粗指针布局、减少动效 / forced-colors / 键盘焦点与语义烟测。动态壁纸的 1920px 组从约 15.18 MiB 收敛到约 0.61 MiB，入口图标与 UI / Transfer 图集合计约缩小 96.5%；Chat 新增稳定 `clientRequestId` 重放与数据库唯一约束，Transfer 使用房间代次、增量游标和幂等任务。本地 / 获授权远端 D1 runner 均固定为基础 schema → PRAGMA 检查 → 仅补缺列 → 依赖索引 → 分组核验，本地兼容迁移 248 + 1 + 4 commands 通过，本轮未连接远端 D1。三语公开记录 `seed-update-2026-07-18-public-site-100-complete` 与公共资源版本 `20260718-public-site-100-r1` 已同步；统一发布闸门覆盖 185 / 185 全量测试、19 模块依赖图、可复现生产构建、147 个三语响应式组合和 190 / 190 项 Headless Chrome 审计。未推送、未部署、未改动生产数据。

- 完成第十二个依赖闭合批次 `OPT-037 + OPT-038 + OPT-056—OPT-060 + OPT-077 + OPT-079 + OPT-097`：文章阅读态只保留正文详情滚动，document 精确等于视口，原覆盖层改为零交叠的 4px 进度轨道；账号改为稳定 DOM、明确登录/注册、完整字段错误/忙碌/退出失败和焦点闭环，Quick Transfer 未登录态收敛为单一上下文任务卡；Chat 发送保留在途新草稿，359×500 普通/私聊容量及 44px 安全说明达标；公共 Chat 隐藏标识、敏感数据与外链/iframe 白名单新增安全闸门。三语记录 `seed-update-2026-07-18-reliable-forms-reading-chat`、主资源 `20260718-reliable-flows-r1` 与 Transfer `20260718-transfer-account-r1` 已同步；112/112 测试、本地 D1 245+2、完整构建和 140/140 Headless Chrome 审计通过。未连接生产数据、未推送、未部署。

- 完成第十一个依赖闭合批次 `OPT-004 + OPT-005 + OPT-006`：公开主站使用 `20260718-route-lazy-r1` 按需加载五个业务路由、四份重 CSS 与各路由 fallback 数据，Home 初始投影仅保留最新五条无正文摘要；Quick Transfer 的 loader、client、CSS 与 fragment 只在真实 CTA 点击后单飞加载，支持重试、离开竞态丢弃与永久复用。三语公开记录 `seed-update-2026-07-18-route-lazy-transfer` 已同步 `js/data/content.mjs` 完整 fallback、`js/data/home-content.mjs` Home fallback、Functions seed 与 schema seed；97/97 测试、完整构建与 137/137 Headless Chrome 精确视口/按需网络审计通过。未连接生产数据、未推送、未部署。

- 完成第十个依赖闭合批次 `OPT-003`，并将 `OPT-073` 复核为 `DONE-PREEXISTING`：公开主站入口改为 ESM composition root，将 router、route lifecycle、i18n、fallback 内容、Knowledge/Article、Videos、Resources、Games、Account 与 Chat 拆入 `js/core/`、`js/data/`、`js/features/`、`js/routes/`；新增 `npm.cmd run check:public-modules` 检查模块缺失、循环、越层依赖和 route 顶层副作用，主入口从约 359KB 收敛到 80,593 bytes。最终 11-module graph、89 / 89 测试、构建与 135 / 135 无头 UI 审计全部通过；Chat 离开/隐藏后 timer 与 request 为零。`index.html` 公共模块 query 统一为 `20260718-public-modules-r1`；本批为不可见重构，不新增 `site-updates`，未连接生产数据、未推送、未部署。

- 新增 `docs/PUBLIC_SITE_UI_UX_100_OPTIMIZATION_PLAN.md`：将主站 UI、UX、动效、视觉、流畅性、可读性、易用性、响应式、无障碍、性能和发布质量的审计结果整理为恰好 100 项 Codex 可执行任务，并为每项提供状态、优先级、代码范围、依赖和完成判定。
- 工作计划纳入截图复核后的校准事实：默认精确移动视口不存在页面级横向破版，竖屏/横屏 Dock 未遮挡主要操作，844×390 Chat 与文章结构应作为已通过基线保护；短屏 Chat 使用实测 177px/119px 日志容量，不再沿用不现实的 260px 目标。
- 同步修订主站 Skill 与 README 的长期移动 QA 规则：359×500 Chat 普通房至少保留 160px 日志可读区，私聊至少 115px 或提供可折叠工具区，844×390 至少 150px；验收还必须确认私聊安全说明、输入、反馈和 Dock 同时可达，不能单靠父容器无 overflow 判定通过。
- 文档规定按 1–5 项小批次实施、先检查现状、允许 `DONE-PREEXISTING`、每批执行测试/构建/精确截图/缓存与三语更新检查，并禁止无授权推送或部署。本轮仅新增计划和维护文档，未修改公开 UI、Functions、D1、三语 `site-updates` 或前端资源 query。
- 启动首个执行批次 `OPT-001 + OPT-081`：新增 `npm.cmd run audit:public-ui`，以隔离的一次性 Headless Chrome、固定 day 主题、关闭动效和受控本地 API fixture 捕获 6 个 Chat 精确视口及 844×390 文章双栏；命令会断言真实 CDP viewport、页面宽度、活动窗口、固定 Dock、短屏 Chat 容量和文章目录 / 正文几何，并在结束时关闭浏览器、删除临时 profile。构建检查同步守卫视口矩阵、500px 伪手机拒绝逻辑与审计命令。本批没有修改公开 UI、Functions、D1、三语 `site-updates` 或前端资源 query。
- 完成第二个依赖闭合批次 `OPT-011 + OPT-023`：阻塞 CSS 前的内联 bootstrap 会按 `?wallpaper=` 或本地时间把 morning / day / dusk / night 写入 `html[data-time-theme]`，桌面窗口背景、动态壁纸和移动壁纸从首个请求即命中真实时段，不再由硬编码 day 触发跨时段双下载；主脚本继续同步 html、body、Home 与壁纸舞台，并保留运行时跨时段切换。
- 全站首个 Tab 现在显示三语 Neo-XP“跳到主内容”入口并聚焦稳定 main Landmark，不改变当前 hash 路由；Home、Knowledge、Videos、Resources、Games、Blog、Chat 与 About 各自拥有唯一、跨桌面/移动都可访问的 H1，标题栏重复视觉文本从辅助技术树隐藏，卡片与安全 Markdown 标题从 H2 开始。
- `npm.cmd run audit:public-ui` 扩展为 77 项自动检查：模拟四个本地时段与 `?wallpaper=night` 覆盖，分别审计桌面/移动实际资源请求；在 zh/en/ja 下逐路由核对首个 Tab、活动 H1、隐藏路由和 CDP AX Tree，并继续保护精确视口、Chat 容量、文章双栏与 Dock 几何。当前 Headless Chrome 全部通过。
- 本批公开 `site-updates` 使用 `seed-update-2026-07-18-theme-accessibility-foundation`，已同步 `js/main.js` fallback、Functions seed 与 schema seed；`style.css`、`mobile-ios-shell.css`、`main.js` 资源 query 统一为 `20260718-theme-a11y-foundation-r1`。未连接生产 D1，未推送或部署。
- 完成第三个依赖闭合批次 `OPT-024 + OPT-026 + OPT-061`：路由提交后的程序化焦点统一落到目标页面稳定 H1，首次加载仍保留 skip link 为第一个 Tab；文章详情只在最终标题就绪后聚焦，返回列表与浏览器前进/后退会同步 URL、阅读态和焦点，快速连续导航也会拒绝陈旧 rAF 抢焦点。
- 账号入口明确为带三语 label 的非模态 `role=group` popover，触发器继续维护 `aria-expanded/controls`，Escape 与外点关闭后归还触发源焦点；打开后聚焦首字段、移动 44px 可见关闭按钮和全路由层级复核仍按计划留给 `OPT-059`。
- 移除全局 `body { caret-color: transparent; }`，以零优先级 editable 规则恢复文本输入光标；Headless Chrome 在 1280×720 与 390×844 对 Transfer 密码框和 composer 执行真实键入替换、Backspace 删除与 caret 可见性验证，均通过。
- `npm.cmd run audit:public-ui` 扩展到 95 / 95 项：覆盖 1280×720 zh/en/ja 全路由、359×500 zh、390×844 en、844×390 ja 语义矩阵，以及路由离开控制、文章历史往返和 Transfer 真键入；既有 Chat 与文章截图继续保留。`npm.cmd run build` 通过。
- 本批公开 `site-updates` 使用 `seed-update-2026-07-18-focus-popover-caret`，已同步 `js/main.js` fallback、Functions seed 与 schema seed；`style.css`、`main.js` 资源 query 统一为 `20260718-focus-popover-caret-r1`。未连接生产 D1，未推送或部署。
- 完成第四个依赖闭合批次 `OPT-021`：Knowledge 的每个浏览器 History 条目使用带版本和白名单清洗的站内状态，保存分类、Unicode 搜索词、列表滚动位置、文章 slug、详情阅读位置与返回模式；URL 始终是路由权威来源，未知版本、URL/state 冲突及异常滚动值会安全重建，其他根级 History 字段仍被保留。
- 从分类或搜索结果打开文章前会原地更新来源列表条目；站内返回与浏览器 Back 恢复原分类、搜索、列表位置及单次标题焦点，Forward 重开同文并恢复阅读位置。直接文章链接的返回会替换当前条目为默认 Knowledge，不创建重复条目、不把访客带离站点；History 状态不保存账号、Chat 草稿、互传口令或内容。
- 文章列表与详情请求加入 slug + 语言 + request id 竞态保护，旧语言或陈旧请求不能覆盖当前文章；相同详情不再因重复渲染清零阅读位置，短暂列表错误也不会闪回错误视图。`npm.cmd run audit:public-ui` 现为 99 / 99 项，在 1280×720 与 390×844 覆盖站内返回、Back / Forward、直链默认返回、损坏状态清洗、滚动恢复与焦点去重。
- 本批公开 `site-updates` 使用 `seed-update-2026-07-18-knowledge-history-restoration`，已同步 `js/main.js` fallback、Functions seed 与 schema seed；仅 `main.js` query 更新为 `20260718-knowledge-history-r1`，未改动 CSS query。未连接生产 D1，未推送或部署。
- 完成第五个依赖闭合批次 `OPT-022 + OPT-025`：Home、Knowledge、Videos、Resources、Games、Blog、Chat、About 使用唯一三语配置派生独立 document title、description、canonical、Open Graph 与 Twitter 字段；路由 canonical 只保留白名单语言和真实 Hash，清除壁纸、欢迎与审计参数，同路由、语言切换及 History 恢复都会重写完整元信息。
- 文章详情继续使用安全 slug 正式路径和白名单封面；自定义封面没有可信尺寸时移除首页尺寸，默认分享图恢复 1672×941 与三语 alt。文章加载/失败先恢复 Knowledge 元信息，最终响应才写文章信息；离开详情后不会残留文章 type、标题、简介、封面或 canonical。
- 欢迎窗与视频窗打开后以原生 `inert` 同时隔离 skip link 与站点壳，并让异常双模态只保留顶层可交互；Tab/Shift+Tab 圈定、Escape、完整关闭动画期间持续隔离、减少动态立即提交及触发源/稳定标题焦点归还均纳入守卫。视频卡显式传递真实点击按钮，手机关闭入口继续实测不小于 44×44px。
- `npm.cmd run audit:public-ui` 扩展到 108 / 108 项：三语八路由逐项核对 canonical、OG/Twitter 全字段，三语文章验证封面尺寸清理与离开详情去残留；桌面、359×500、390×844、844×390 覆盖欢迎/视频模态的 inert、AX Tree、正反 Tab、程序化逃逸阻断、Escape、动效模式、焦点归还和关闭控件几何，并输出模态截图。
- 本批公开 `site-updates` 使用 `seed-update-2026-07-18-route-metadata-modal-focus`，已同步 `js/main.js` fallback、Functions seed 与 schema seed；`main.js` query 更新为 `20260718-route-meta-modal-r1`，CSS query 不变。未连接生产 D1，未推送或部署。
- 完成第六个依赖闭合批次 `OPT-002 + OPT-007`：八个公开主路由统一使用显式 `enter/leave` 作用域，路由级事件、定时器、动画帧、Observer、请求计数和 `AbortController` 有统一登记与清理；同一路由重复导航保持幂等，语言切换通过受控重启更新活动路由，不向隐藏路由叠加监听或请求。
- Knowledge、Videos、Games 与 About 的列表请求随离开路由中止，Home 不再预取这些隐藏数据；Chat 只在活动且可见时轮询，离开或隐藏后 timer 为零。Quick Transfer 在 Resources 进入时绑定、离开时关闭并清理监听、轮询、Fetch、XHR 和重试等待，安全会话、AES-GCM、R2、Multipart 与配额协议未改变。
- 将 `style.css` 尾部 11 组响应式媒体规则按原顺序迁入 `mobile-ios-shell.css`，选择器和值不变；`motion-system.css` 的相关层级规则限定到桌面壳。构建检查现在解析三份主 CSS，并逐条拒绝移动关键组件的跨文件布局重复或越权声明。
- `npm.cmd run audit:public-ui` 扩展到 110 / 110 项：在 1280×720 与 390×844 连续遍历全部路由，注入可中止的延迟请求，验证 inactive timer/listener/observer/frame/request/AbortController 归零、Chat/Transfer 清理及同路由不重复绑定；既有三语语义、元信息、模态、History、Caret 和精确视口截图全部通过。
- 本批公开 `site-updates` 使用 `seed-update-2026-07-18-route-lifecycle-mobile-css`，已同步 `js/main.js` fallback、Functions seed 与 schema seed；主 JS query 为 `20260718-route-lifecycle-r1`，三份主 CSS query 为 `20260718-route-lifecycle-css-r1`。未连接生产 D1，未推送或部署。
- 完成第七个依赖闭合批次 `OPT-020`：在 `js/mobile-shell.js` 建立唯一 `window.LusuFramePipeline`，window resize、VisualViewport resize / scroll 各保留一个原生监听；同键任务在一帧内合并，所有布局读取先于样式写入，写阶段新增任务自动进入下一帧。管线暴露 `request/schedule/subscribeViewport/requestViewport/dispose` 与隐私安全 snapshot，供运行时和本地审计复用。
- Home 壁纸舞台与桌面图标几何、Knowledge 文章进度与目录高亮、移动 Dock、动效层及 Quick Transfer 聚焦控件已接入统一管线；旧的 route resize、独立滚动 rAF、动效 resize 和 Transfer VisualViewport 监听被移除，相关订阅随 route / 事件 scope 解绑。原生 page scale 不为 1 时键盘偏移固定为 0，避免把页面缩放当作软键盘。
- 新增 `normal/low` 绘制档：Save-Data 或明确不超过 2 个逻辑核心 / 2GiB 设备内存时启用 low，能力未知保持 normal。low 关闭大面积 blur、backdrop-filter、壁纸 filter、循环云层、常驻 `will-change` 与全页 View Transition，并为顶部栏、任务栏、Dock、账户层和模态遮罩提供实色高对比回退；normal 档 XP / Pixel Art / Y2K 视觉不变。
- `scripts/build-check.mjs` 新增唯一 viewport 原生绑定、keyed measure/mutate 消费端、档位与三份主 CSS 降级守卫；`npm.cmd run audit:public-ui` 扩展到 117 / 117 项，覆盖 40 组同帧事件风暴、390×844 / 844×390 视口与 Dock、2× page scale、Save-Data、2 核、未知能力以及 low 截图大面积绘制效果。`performance-low-390x844.png` 人工复核清楚可读；该 Headless 审计不等同真实 iOS / Android 屏幕软键盘认证。
- 本批公开 `site-updates` 使用 `seed-update-2026-07-18-frame-pipeline-low-performance`，已同步 `js/main.js` fallback、Functions seed、schema seed、项目上下文与主站 Skill / README；主 JS query 为 `20260718-frame-pipeline-low-r1`，三份主 CSS query 为 `20260718-frame-pipeline-low-css-r1`。未连接生产 D1，未推送或部署。
- 完成第八个依赖闭合批次 `OPT-028`：固定移动壳继续锁定 body、site-shell 与 page，但七个非 Home 活动 App 窗口现在有休眠式纵向溢出逃生通道。route-specific ID 选择器明确压过既有 ID 级 `overflow:hidden`；只有内容确实增长时才产生滚动。Knowledge 文章阅读仍由 `.article-detail` 独占 owner，Home 固定构图不变。
- Knowledge、Videos、Resources、Games、Blog、About 与 Chat 的既有内部 owner 允许在边界后把剩余滚动交给活动窗口；Quick Transfer 的 room entry、room 与 login gate 同步使用纵向链和 focus padding，不改变 HttpOnly 会话、AES-GCM、R2、Multipart 或配额边界。移动 App 聚焦会通过 keyed `mobile-shell:focus-reveal` 先测量最近真实纵向 owner，再只写其 `scrollTop`；不使用全局 `scrollIntoView`，不移动 document、Appbar 或 Dock。
- `npm.cmd run audit:public-ui` 扩展到 122 / 122 项：覆盖 359×500 Chat 内容增长、390×844→390×500→390×844 受限高度恢复、文章 / About 真实滚动 owner、2倍 page scale 焦点恢复和 Home 零文档滚动。首次审计真实捕获到 ID 特异性覆盖和未激活 CDP Page 不派发 focus 事件，修复后通过；默认 359×500、390×844 Chat 与 844×390 文章截图人工复核无裁切、交叉或 Dock 回归。Headless 受限高度和缩放不等同真实 iOS / Android 软键盘认证。
- 本批公开 `site-updates` 使用 `seed-update-2026-07-18-mobile-scroll-recovery`，已同步 `js/main.js` fallback、Functions seed、schema seed、PROJECT_CONTEXT 与主站 Skill / README；公开 JS query 为 `20260718-mobile-scroll-recovery-r1`，三份主 CSS 与 Transfer CSS query 为 `20260718-mobile-scroll-recovery-css-r1`。未连接生产 D1，未推送或部署。
- 完成第九个依赖闭合批次 `OPT-085`：`window.LusuFramePipeline` 的移动 viewport snapshot 统一提供 layout / visual 宽高、VisualViewport offset、方向、page scale、键盘偏移与 `stable/browser-ui/keyboard/zoom` 模式，并在同一写阶段同步 CSS 变量和根数据属性。旋转会继承已知键盘状态，失焦后用 400ms 有界收敛清理锁存，原生 page scale 不会被误判成软键盘。
- Chat、密码房、Knowledge、账号 popover 与 Quick Transfer 的编辑控件统一委托 `requestMobileFocusReveal()`；它只测量最近的真实内部滚动 owner，并只修改该 owner 的 `scrollTop`。Transfer 删除私有 viewport / `scrollIntoView` 链路；账号真实点击提交失败后会恢复用户最后编辑的字段，避免异步状态替换表单或丢失焦点。软键盘打开时 Dock 只临时隐藏，不改写用户的展开/收起偏好。
- `npm.cmd run audit:public-ui` 扩展到 135 / 135 项：新增 Chat 编辑区、密码房、账号错误恢复、Knowledge、Transfer 入口/房间 composer、浏览器 UI 高度代理、旋转往返、原生 page scale、Dock 两种用户偏好和 safe-area 能力检测。该 Headless Chrome 结果明确不代表真实 iOS / Android 软键盘、浏览器地址栏或安全区认证。
- 本批公开 `site-updates` 使用 `seed-update-2026-07-18-mobile-viewport-keyboard`，已同步 `js/main.js` fallback、`functions/api/[[route]].js` Functions seed 与 `cloudflare/schema.sql` schema seed；公开 JS query 为 `20260718-mobile-viewport-keyboard-r1`，主 CSS 与 Transfer CSS query 为 `20260718-mobile-viewport-keyboard-css-r1`。未连接生产 D1，未推送或部署。

## 2026-07-17

- 修复手机端从首页、欢迎快捷入口或 Dock 进入知识库时，路由焦点误落到搜索框并自动弹出输入法的问题；自动焦点现在只落到可见的非编辑控件，没有合适控件时落到窗口表面，用户主动点击搜索后的输入与清空聚焦行为保持不变。
- 二次修复手机端临时互传按钮覆盖图片的问题：竖屏房间从会把消息行收缩到约 180px 的 Grid 改为纵向 Flex 正常流，并将 toolbar、feed、composer、tasks 直接子项设为不可收缩；消息按完整内容高度结束后才排列 composer，短横屏显式恢复原有双栏 Grid。发送后图片继续使用全宽稳定预览框，文件信息卡继续占满可用宽度。
- 构建检查读取文本时统一 CRLF / LF 换行，避免 Windows 工作区因后台 SVG `viewBox` 的多行守卫产生误报；知识库自动焦点，以及互传竖屏 Flex、直接子项不可收缩和横屏重新 Grid 均已加入静态回归守卫。
- 默认 `npm test` 与 GitHub 校验入口现已纳入 `tests/transfer/*.test.mjs`，互传服务、schema 与客户端 UI 合约不再只靠单独命令执行。
- 手机虚拟 OS 移除顶部时间与 `LUSU OS` 状态行，栏目 Appbar、首页入口和桌面顶栏保持不变；知识库文章阅读态去掉与进度条重复的栏目文字和百分比，只保留进度条与真实可操作的返回、复制、回顶控件。
- 临时互传的相册、文件、拖放与粘贴附件统一先进入输入区待发送托盘，只有再次点击“发送”才创建上传任务；文字请求失败或存储临时不可用时附件继续保留，发送期间锁定重复添加和移除操作，期间新输入的文字不会被旧请求完成回调清空。
- 手机端新增不强制调用相机的多选相册入口，同时保留通用多文件入口；待发送图片显示小缩略图并可单独移除，发送后的图片限制在消息卡片内，普通文件使用文件图标卡片。
- 图片、视频、音频与普通文件继续提供下载按钮；每条成功解密的文字末尾新增三语复制按钮和旧移动浏览器剪贴板回退。登录、AES-GCM、R2、Multipart、配额、24 小时过期和服务端权限边界均未改变。
- 新增临时互传客户端 UI 合约测试与移动文章构建守卫；公开 `site-updates` 记录使用 `seed-update-2026-07-17-mobile-transfer-send-fix`，已同步 `js/main.js` fallback、Functions seed 与 schema seed，相关主站资源 query 更新为 `20260717-mobile-transfer-send-r3`。
- 管理员邮箱从公开 Functions 源码迁移到运行时 `OWNER_ADMIN_EMAILS`：支持逗号、分号或空白分隔并统一规范化，配置中的站长账号仍会自动保持 `users.role = admin` 且不能在后台降级。`wrangler.jsonc` 与空值 `.env.example` 只声明变量名，真实值必须在 Cloudflare Pages 的 Production / Preview 分别提前配置为加密 Secret；缺失时不回退源码、不自动提权，也不会让 API 返回 503，既有 D1 角色、自身账号降级保护与“最后一个管理员”原子保护继续生效。本项是私有配置迁移，不新增公开 `site-updates` 或前端缓存 query。

## 2026-07-16

- 修复临时互传文件上传在 Cloudflare Pages 缺少 `TRANSFER_BUCKET` 时统一报“服务暂时不可用”的部署缺口：根 `wrangler.jsonc` 现在声明 Production 私有 R2 桶，并完整保留 Preview 的非继承配置；独立 Preview 桶未创建时预览文件上传显式关闭，不会误用正式桶。构建会阻止正式绑定再次遗漏；客户端在 R2 未就绪时不再创建显示 100% 后失败的假上传任务。
- 临时互传房间的整个窗口改为文件拖放热区，只处理真实文件拖放，不干扰文字、链接、按钮或输入框；拖入文件时显示全窗口投放提示，单次放下只创建一组任务。
- 桌面临时互传窗口移除 760px 高度封顶，按浏览器可用视口伸展，消息内容区获得新增空间；手机端继续使用既有单滚动路径、软键盘与安全区适配。公开资源 query 更新为 `20260716-transfer-upload-window-r2`。
- 修复手机端知识库文章“回到顶部”按钮被固定 Appbar 触控层拦截的问题；文章阅读状态下只让 Appbar 非控件区域穿透触控，返回、复制等真实控件仍可交互。
- 重新整理资源区卡片网格：临时互传与日语学习卡片使用相同宽度和卡片节奏，标题、元信息、说明与 CTA 对齐；窄屏元信息允许自然换行，不再以裁剪或隐藏滚动条掩盖内容。
- 统一顶部最近更新、知识库元信息、资源元信息、游戏错误与杂谈日期的可见分隔符，避免英文环境缺少全角标点字形时显示方框。
- 完成临时互传入口、登录、房间、消息、上传任务、文件预览与输入区的手机适配，覆盖窄竖屏、短屏、软键盘和手机横屏，保证输入控件可见且主要触控目标可用。
- 本次仅调整公开交互和响应式 UI，临时互传的安全、配额、角色、存储、过期与 API 边界均未变化。公开记录使用 `seed-update-2026-07-16-mobile-transfer-ui-polish`，已同步三语 fallback、Functions seed、schema seed、维护文档与资源 query `20260716-mobile-transfer-ui-r1`。

- 管理后台城市访问地图改为全矢量渲染：Natural Earth 世界陆地路径通过真实 SVG `<use>` 绘制，缩放和平移改由根 SVG `viewBox` 完成，不再把 CSS 背景层栅格化后放大；100% 至 500% 缩放均保持清晰。
- 城市点位改为真实 SVG `<g>` / `<circle>`，不再使用 HTML 元素与 CSS 伪元素拼接；可见圆点按 PV 调整，至少 44px 的鼠标 / 触屏命中区在所有缩放级别保持稳定。
- 最近 14 天城市级精确聚合、鼠标滚轮、拖拽、点击 / 悬停、双指缩放、键盘操作、PV/UV 详情和同数据城市列表保持不变；后台资源 query 更新为 `20260716-admin-svg-vector-map-r1`，地图资源 query 为 `20260716-admin-world-map-svg-r1`。
- 管理后台完成首轮实质性 UX 与操作安全改造：移动端分组抽屉、文章 / 视频 / 聊天 / 账号列表详情双态、44px 触控目标、持久保存栏、未保存离开保护和上下文危险操作确认。
- 文章发布改为一次汇总并定位中 / 英 / 日三语全部缺失字段，服务端同步强制三语正文；地图增加可读地区列表，视频封面不再拉伸同排字段，聊天室治理区分高频与危险操作。
- 账号默认不再自动选中，资料与密码重置分离；密码重置可选择撤销会话，服务端用原子更新保护最后一个管理员。资源 query 更新为 `20260716-admin-safety-foundation-r1`。
- 本轮属于后台私有改造，未修改公开主站界面、三语 `site-updates`、主站 fallback 或生产 D1 数据。

- 资源区新增仅登录用户可用的“临时互传 / Quick Transfer / 一時転送”：同一房间口令进入同一 24 小时临时房间，可发送加密文字、图片、视频和普通文件；公开更新记录使用 `seed-update-2026-07-16-quick-transfer`，已同步三语 `site-updates`、主站 `fallback`、Functions seed 与 schema seed。
- 普通账号执行单文件、24 小时累计量、文件数、并发和全站免费池限制；只有数据库 `users.role = admin` 的管理员可以使用 R2 Multipart 数百 MiB、GiB 级上传及断点续传。下载支持 Range 与视频拖动，所有文件到期后先逻辑拒绝，再由清理 Worker 和 R2 生命周期兜底删除。
- 新增独立 `/admin/transfer.html` 监控和治理页、费用估算与 1/3/5 美元站内报警；Cloudflare 官方账单提醒、Production/Preview R2 binding 和清理 Worker 部署仍按文档由站长人工完成。主站 `main.js` cache query 更新为 `20260716-quick-transfer-r1`。
- 本地基线为 Node.js 22.13+；本地 API 变量写入被 Git 忽略的 `.dev.vars`，使用独立生成的值，`.dev.vars`、`.env` 与真实密钥绝不提交。

## 2026-07-15

- 补齐 GPTWork / 全新克隆的可复现开发基线：Node.js 22.13+、Wrangler `4.111.0`、`.nvmrc`、兼容 Node 22 且不依赖测试子进程的标准 `npm test`、本地 `wrangler pages dev`、`.env.example`、更完整的本地与敏感文件忽略规则，以及 Pull Request / `main` 的最小 GitHub Actions test + build 校验；纯本地使用 `.dev.vars`，GPTWork 使用平台注入的 process Secrets 且不创建会遮蔽云端值的空文件。
- `wrangler.jsonc` 声明 D1 `preview_database_id` 和两个 required secrets；根 README、Cloudflare 配置文档、项目上下文、项目专用 Skill 与 `docs/GPTWORK_MIGRATION_READINESS.md` 记录安装、D1 初始化、命令清单、云端绑定、仅本地资源边界和安全 PR 流程。固定盘符运维示例改为当前 checkout 相对路径，`design-qa.md` 明确历史截图属于未提交的本地证据。项目当前没有真实 lint / typecheck 工具链，明确标记为未配置，不增加伪命令。
- 聊天与分析 IP 标识删除仓库固定盐及跨用途 fallback，改为 `HMAC-SHA256(secret, purpose + ":" + ip)`；`CHAT_IP_HASH_SALT` / `ANALYTICS_IP_HASH_SALT` 必须独立、至少 32 字节且不能相同，配置不合格时会在任何 API 业务 D1 访问前返回通用 503，日志只记录不合格变量名。
- 聊天消息与网络来源禁言新增非敏感 `ip_hash_key_id` 代次：后台只允许从当前代次消息新建网络来源禁言，服务端按消息编号读取目标并拒绝旧代次；旧禁言显示为“密钥已轮换”，过期 / 生效状态改由服务端按实际拦截条件计算，避免后台误报。全新库由基础 schema 建列，复合索引拆到 `schema-indexes.sql`；本地迁移脚本和云端 `ensureChatSchema()` 都先补列再建索引，避免旧表直接创建新索引失败。同步更新后台 JS query、后台上下文、Skill、私有 changelog 和页面内 `adminUpdates`，不写入公开 `site-updates`。
- 新增运行时 Secret、IP HMAC 行为、仓库敏感文件 / 常见凭据形态回归测试和构建守卫，覆盖 fail-fast 不触碰 D1、相同 Secret 拒绝、响应 / 日志不泄露 Secret 或 IP、聊天 / 分析用途与密钥隔离、请求 IP 优先级，以及 `.env.example` 只保留空变量声明；统一根测试入口覆盖 Functions 与日语训练器现有测试。
- 首轮 Node 22 CI 揭示旧 Wrangler `4.99.0` 的 npm 10 审计结果包含 4 项高危传递依赖；升级并精确锁定到兼容 Node 22 的 `4.111.0`，随附的 `undici`、`ws`、`miniflare` 与 `esbuild` 修复后，npm 10 / npm 11 完整依赖审计均回到 0 项。
- 修复 `cloudflare/schema.sql` 遗漏 `seed-update-2026-07-10-premium-interaction-mobile-os` 父文章、导致空库插入三语翻译时触发外键失败的问题；新增内存 SQLite 空库初始化、外键完整性、旧聊天表带历史数据补列和二次执行幂等测试，CI 也会实际执行一次 Wrangler 本地 D1 初始化。
- 部署兼容性提醒：首次改用 HMAC 或以后轮换 Secret 会让历史 IP hash 禁言无法继续匹配；现已通过代次字段明确隔离并阻止从旧消息创建无效禁言，既有旧网络禁言仍无法重算，只能等待新消息后重新建立。本次未访问生产 D1、未写入真实 Secret、未修改公开 UI，因此不新增三语 `site-updates` 或主站前端缓存 query。

## 2026-07-14

- “日本語の裏側”应用维护版 `1.0.3`：
  - 修复错答后关闭结果弹窗、点击弹窗外或查看解析时失去重新答题入口的死路；题面与解析顶部都会保留重新答题按钮，结果弹窗禁止通过关闭按钮、Escape 或遮罩点击绕过操作。
  - 下一关入口只按本次提交的 `attemptCleared` 判断，历史上已经通关的关卡再次答错时仍显示重答，不会误显示下一关。
  - 新增纯状态回归测试，并补强页面契约测试，覆盖错答、答对、历史通关后答错、结果弹窗不可误关闭和解析区重答入口。
  - 正式拆分 `appVersion` 与 `contentVersion`：公开应用版本为 `1.0.3`，250 关题库、10,088 件静态音频、云进度 API 与存档兼容边界继续保持 `1.0.2`，不为 UI 热修伪造全库内容迁移。
  - 工具与主站缓存键更新为 `20260714-japanese-subtext-v103-retry-r1`；三语 `site-updates` 记录 `seed-update-2026-07-14-japanese-subtext-retry-hotfix` 已同步 `js/main.js` fallback、Functions seed 与 schema seed。

## 2026-07-11

- 手机端六项 Dock 改为专用紧凑宽度：整栏最大宽度收至 340px，单项保持 48px 触控宽度，同时把主图标提升到 34px、Home 图标提升到 39px；桌面任务栏在导航点击时立即同步选中态，不再等待页面转场提交。
- Mobile Dock and calm-motion reset shipped as `seed-update-2026-07-10-premium-interaction-mobile-os`; the Dock now keeps six high-frequency routes and omits About/Notes on mobile.
- Public shell assets use cache key `20260711-calm-motion-r13`; desktop and mobile navigation transitions were reduced, resized, and kept in sync.

- “日本語の裏側”维护版 `1.0.2`：
  - 语音管线升级为 `kokoro-ja-mp3-v4` 并执行全库重置：句子、选项和词块先锁定可审校假名，显示继续保留汉字；Misaki 音高半段不再送进 Kokoro，完整按官方顺序规范化 P2R（含原始 `j → y` 滑音），未知音素直接阻断生成，修复句尾额外“いい”、“今日（きょう）”漏掉 `ky` 后退化成“おう”，以及“や／ゆ／よ”误向“じゃ／じゅ／じょ”偏移的根因。题库测试逐处守卫“今日”的 `きょう / きょー` 读音，正式构建另要求 9,838 个非场景任务完成全量音素哈希复算。
  - 最终 v4 音频为 10,088 件 / 250 关（250 场景、2,400 句、2,445 选项、4,993 词块），共 316,038,600 bytes、38,601.484 秒；9,838/9,838 reading / phoneme / task hash 复算错误 0，10,088/10,088 全量 ffprobe、静音、实体 SHA-256、时间轴、精确引用和孤儿检查通过。生成器与审计器改为共用同一读音归一化/G2P/P2R 函数，避免审计漏掉生成时的二次假名归一化；L1-001 三个代表样本未出现长停顿后的分离尾音。
  - PC 端工具页改为游戏壳式顶栏与内容框架：左上角返回个人站、右上角显示工具名，中间突出存档同步；移除多层整屏最小高度造成的大块留白，关卡场景、问题和解析按桌面宽度重新排布。
  - 查看解析后补充“进入下一关”入口；资源区 CTA 从下载语义改为“开始 / Start / 開始”。非输入型标题、按钮和卡片文案默认不可选中，输入框与可编辑区域仍可正常选择文字。
  - 学习记录改为按本地日期聚合的月历打卡，显示当前连续、最长连续、总打卡天数与最近活动；新增独立 `japanese_subtext_daily_activity` D1 表，云端以日期和关卡稳定 ID 幂等合并，不复用游戏存档。
  - 关卡插图方向改为每关一张贴合题目情境的原创黑白四格漫画，统一人物、线条、网点、分镜边框和 4:3 画幅，并继续使用压缩、懒加载和响应式适配。
  - imagegen 两次重试均遇到网络错误，改用明确标注的本地原创分镜 fallback；生成器读取整关 setting、全体角色、台词、题问、证据与关键道具，250 张 960×720 WebP 由独立 manifest 的 SHA-256、尺寸、生成器版本和自动场景映射状态锁定，不冒充 AI 逐张产物。
  - 打卡云同步请求上限从 256 KiB 调整为 1 MiB，D1 合并态限制为最新 400 天/5000 行；旧版缺少 `activityDays` 时按关卡 `updatedAt` 尽量迁移最后活动日期，月历切月后恢复键盘焦点。
  - 工具入口与所有嵌套 ESM 依赖统一使用 `20260711-japanese-subtext-v102-r2` 缓存键；离线长时录音的 manifest 原子替换增加 Windows 瞬时文件占用重试，避免索引器短暂锁定导致整库任务中断；本地分片诊断目录纳入 Git 忽略范围；图片 manifest 的构建守卫移回日语工具发布合约作用域，避免顶层引用局部变量导致构建异常。
  - 工具版本、manifest、题库索引、云进度 API、Resources 卡片与构建守卫同步到 `1.0.2`；主站 `main.js` query 更新为 `20260711-japanese-subtext-v102-r2`。唯一 `site-updates` 记录 `seed-update-2026-07-11-japanese-subtext-trainer` 已同步 fallback、Functions seed 与 schema seed。

- “日本語の裏側”维护版 `1.0.1`：
  - 主站入口改为“开始挑战”，只保留听力训练、潜台词和支持（云存档）标签；移除可获取、等级、关卡数、男女声和本地/云端进度标签。工具与资源卡标题随 zh / en / ja 显示“日语的言外之意”/“Behind the Japanese”/“日本語の裏側”。
  - 中文界面使用简体中文字体栈，日语台词节点明确标记日语字体，修复中日字形混用导致的汉字形态和大小不一致。
  - 关卡播放器移除上一句、下一句、从头播放、重播、单句重播、静音和自动播放；保留播放/暂停、进度 seek、倍速，以及直接点击句子/词块播放。播放高亮不再调用 `scrollIntoView()`。
  - 首次进入关卡只显示一次听力/日语/双语模式选择；日语和双语模式直接显示对应正文，听力模式由用户主动播放。训练设置右下角按钮改为“确认”。
  - 答题后使用奖牌结果弹窗提供查看解析和下一关/重新挑战操作，选项不再插入会撑高布局的可见“正确答案”标签；题干与解析中的 `line-002` / `line 002` 统一改为自然的第几句台词。
  - 离线语音生成改为假名优先：句子使用人工审校 `readingJa`，词块使用 `reading`，其余表记先经 PyOpenJTalk 转成假名再交给 Kokoro；为“今日/きょう”增加明确读音覆盖，并按最终假名任务哈希增量重录。
  - 新增 `tools/japanese-subtext/MAINTENANCE.md`，固定每次公开维护版本增加 `0.0.1`，并记录版本、题库 revision、音频、缓存、三语更新和模型关闭清单。
  - 主站 `main.js` 缓存 query 更新为 `20260711-japanese-subtext-v101-r1`，其余移动/桌面壳资源继续使用最新 `20260711-calm-motion-r13`；唯一 `site-updates` 记录 `seed-update-2026-07-11-japanese-subtext-trainer` 已同步 fallback、Functions seed 与 schema seed。
  - 工具自身 CSS / ESM 缓存 query 更新为 `20260711-japanese-subtext-r14`。
  - 假名优先流程全库重录 10,088 件静态音频（250 场景 / 2,400 句 / 2,445 选项 / 4,993 词块），共 335,218,248 bytes、40,998.333 秒；reconciliation 为 0 生成 / 10,088 复用，完整 ffprobe + 静音校验 10,088 / 10,088 通过。临时分级根与缓存共清理 29,496 个文件（约 2.371 GiB），Kokoro 生成进程全部退出。

- 新增独立日语潜台词训练工具“日本語の裏側”（`/tools/japanese-subtext/`）：
  - 题库按版本化 JSON 分成 5 个等级、每级 50 关，难度从 N3、N2 递进到 N1 高阶；前段短关帮助熟悉玩法，后段逐步增加多人关系、信息差、不可靠叙述和开放解释。
  - 支持纯听、日语、双语三种正文模式，假名提示和选项 ja / zh / en 独立切换；逐句、词块和日语选项均有稳定音频 ID，播放器支持自动播放、暂停/继续、重播、前后句、倍速、静音和任意进度 seek。
  - 本地存档可离线游玩，登录后通过独立 D1 表和 `/api/tools/japanese-subtext/progress` 合并云端进度，不复用游戏存档表；空云端或同步失败不会覆盖本地通关。
  - 离线语音采用隔离安装、许可清晰的 Kokoro-82M / kokoro-onnx CPU 流程，使用 4 个官方日语女声与 1 个官方日语男声。模型权重和本机配置不提交、不设服务或自启动，录制结束后浏览器只读取预生成静态音频。
  - 工具图标、等级封面和响应式关卡插图统一使用彩色儿童蜡笔与抽象 Q 版四格，不使用黑白线稿。
  - 主站资源区新增安全白名单入口；唯一三语更新记录使用 `seed-update-2026-07-11-japanese-subtext-trainer`，并同步 `site-updates` fallback / Functions seed / schema seed。公开主站 `style.css` 与 `main.js` query 更新为 `20260711-japanese-subtext-r1`，工具自身 CSS/JS query 独立维护；题库、音频、API、存档和播放器均有自动验证与测试。
  - 发布守卫硬校验工具必需文件、锁定的 5×50 关目录与批次哈希、Resources 三语入口、独立 API/D1 表、sitemap、缓存与重定向、安全 DOM API，并且只有 `generation-state` 标记完成、manifest 覆盖 250 关 / 10,088 件静态音频且全部引用文件非空时才能通过。`jp-subtext:release-check` 将 10,088 件音频的 ffprobe 与静音检测设为不可省略的全量门槛；manifest 另与锁定题库 `sourceContentHash`、逐句 cue 顺序、最终输出参数和发音表 SHA-256 精确绑定，并拒绝孤儿 MP3 / timeline。验收证据集中在 `tools/japanese-subtext/reports/release-report.md`。
  - 真实浏览器回归覆盖声音门、场景/逐句/词块/选项播放与重试、进度 seek、答题解锁、三语界面、五种视口、弹窗焦点和 Resources 入口；设置面板保留三语声线署名/许可入口。跨设备合并会保留较早通关记录的首次通关模式，不会被较新的失败尝试破坏。工具全部 ESM 子模块 query 为 `20260711-japanese-subtext-r11`。
  - 验收报告必须显式记录 `RELEASE:AUDIO_VALIDATION:PASS` 和 `RELEASE:BROWSER_QA:PASS`；`reports/final-stats.json` 保留题材、技能、声线、长度与音频的完整真实统计，构建守卫同步校验 250 关、610 题、两种彩色插图和 10,088 件音频分类总数。
  - 正式音频共 10,088 件 / 250 关：250 个场景、2,400 句、2,445 个选项、4,993 个词块，共 341,455,752 bytes（325.64 MiB）和 41,778.912 秒。全库 reconciliation 为 0 重建 / 10,088 复用，quick 与两轮真实全量 ffprobe + ffmpeg 静音校验均通过；`jp-subtext:release-check` 退出码 0，Node 41/41、Python TTS 15/15、主站 `250/10088 release contract` 通过。
  - 音频完成后清理 19,323 个派生缓存/日志文件（2.108 GiB），保留全部正式 MP3。Kokoro/generate_audio 进程、Windows 服务、计划任务、Run 与 Startup 项均为 0，模型保持关闭且不自启动；生成 manifest 锁定 `CPUExecutionProvider`，未触碰用户原有 IndexTTS。

## 2026-07-06

- 匿名聊天室新增暗色前端加密密码房：
  - 聊天室角落新增“密码房”按钮，输入不少于 6 个字符的密码后，浏览器用 Web Crypto 派生同一房间标识和 AES-GCM 密钥；同密码进入同一暗色房间，不同密码互相隔离。
  - 密码房消息只向后端提交 `encryptedContent`，后端拒收密码房明文 `content`；普通匿名大厅继续使用原有浅色 XP UI 和明文接口。
  - `anonymous_chat_messages` 新增 `room_key`、`encrypted` 字段和房间相关索引，旧消息默认留在 `public` 普通大厅；读取、发送、昵称占用、增量游标恢复和发送限流均按房间隔离。
  - 密码房 24 小时无人发言时自动删除该房间全部密文消息并释放房间；普通大厅不受影响。
  - 后台聊天室管理显示“密码房加密消息（后台无法解密）”，禁止编辑密文内容，但保留隐藏、删除、按用户标识或网络来源禁言。
  - 同步补齐 `site-updates` 三语记录、`js/main.js` fallback、Functions seed、schema seed、后台文档、项目上下文、主站 Skill/README、构建检查和主站/后台资源 query `20260706-private-chat-rooms-r1`。
  - 安全边界说明：这是前端加密，D1 只存密文；弱密码仍可能被猜中，网页端加密仍需要信任当前加载的站点 JS。
- 密码房上线热修复：
  - 修复现有 D1 聊天表还没有 `room_key` / `encrypted` 字段时，运行时 schema guard 先创建 `room_key` 索引导致普通大厅读取失败的问题。
  - `ensureChatSchema()` 现在先创建旧字段兼容索引，再补齐新字段，最后创建所有房间相关索引；构建检查新增对应顺序守卫。
  - 同步更新 2026-07-06 `site-updates` 三语说明、前端 fallback、schema seed 和主站脚本 query `20260706-private-chat-rooms-r2`，记录这次普通大厅恢复读取的修复。

## 2026-06-30

- 账号弹窗层级修复收口：
  - 顶栏所在的 `header` 明确提升到主内容 `main` 之上，账号弹窗不再被首页内容或知识库、视频区、资源区、游戏区、聊天室、关于我等窗口遮挡。
  - 顶栏继续使用可溢出显示，账号弹窗可以从按钮下方展开；登录、注册、退出、会话 cookie、云存档和账号接口逻辑不变。
  - 同步补齐公开 `site-updates` 三语记录：`js/main.js` fallback、`functions/api/[[route]].js` Functions seed、`cloudflare/schema.sql` schema seed，并更新首页 CSS/JS cache query 到 `20260630-account-popover-layer-r2`。
  - 补充项目上下文和主站 Skill，明确账号弹窗这类顶栏浮层必须同时检查顶栏裁剪和 header/main 层级。

- 修复主站右上角账号按钮点击后看似无响应的问题：顶栏不再裁剪账号弹窗，登录/注册弹窗可以正常从按钮下方展开；本次不改账号接口、登录注册提交逻辑或云存档逻辑。
- 主站 CSS 缓存版本更新为 `20260630-account-popover-clip-r1`，避免线上继续加载旧的顶栏裁剪样式。

## 2026-06-24

- 账号流程、入口清理与合并上线：
  - 删除主站公开聚合入口相关内容：移除首页发现链接、欢迎窗口按钮、前端语言同步逻辑、对应公开路由和对应公开更新 seed。
  - 右上角账号弹窗改为按钮显式提交模式：回车默认登录，点击注册走注册流程；登录、注册和退出请求期间会锁定按钮，退出异常时前端仍回到未登录状态。
  - `npm run deploy` 改为提示“合并到 GitHub main 后由 Cloudflare Pages 自动上线”，不再执行 Wrangler 手动发布命令。
  - 新增三语 `site-updates` 文章“账号流程与合并上线整理 / Account Flow and Merge Launch / アカウント操作とマージ公開の整理”，并同步 `js/main.js` fallback、`functions/api/[[route]].js` Functions seed、`cloudflare/schema.sql` schema seed、首页最近更新日期和主站脚本版本。
  - 主站 main.js cache query 更新为 `20260624-account-cleanup-merge-r1`。

## 2026-06-23

- 本地收尾清理与文档归档：
  - 删除未被 Git 跟踪、且已在 `.gitignore` 中忽略的本地预览和附件残留：`.wrangler/`、`.wrangler-config/`、`.codex-remote-attachments/`、`.codex-wrangler-preview.log` 和 `.codex-wrangler-preview.err.log`。
  - 保留 `node_modules/`，它是本地依赖目录，不属于本次备份或临时残留清理范围。
  - 复扫常见备份 / 临时命名后，没有发现需要删除的已跟踪备份文件；匹配到的 `temporal*` 文件属于第三方游戏源码中的正常 Babel helper。
  - `PROJECT_CONTEXT.md` 顶部补充 2026-06-23 公开体验、隐私、发布和本地清理收口摘要，方便后续对话直接接续。

- 最终公开体验、无障碍和隐私收尾：
  - 新增三语 `site-updates` 文章“公开体验、无障碍和隐私收尾 / Public UX, Accessibility, and Privacy Wrap-up / 公開体験・アクセシビリティ・プライバシー仕上げ”，公开说明只覆盖按钮、弹窗、资源空状态、社交入口、游戏来源链接和访问统计隐私等用户可见变化。
  - 同步 `js/main.js` fallback 最近更新、`functions/api/[[route]].js` Functions seed、`cloudflare/schema.sql` schema seed、首页最近更新日期和主站脚本版本，保持接口、D1 兜底和本地 fallback 一致。
  - 主站 main.js cache query 更新为 `20260623-public-loop-summary-r1`，`20260623-click-delegation-r1` 已由最终收尾版本覆盖。
- 主站按钮点击委托收口：
  - 全站点击监听器会先把点击目标归一为可匹配元素，再处理按钮动作，避免特殊点击目标没有 `closest()` 时打断后续交互。
  - 账号、重试、语言、筛选、文章、视频、弹窗关闭等具体按钮优先处理，通用 `data-route` 路由跳转改为最后兜底，减少按钮被误当成路由点击导致“点了没反应”的风险。
  - 弹窗关闭按钮处理后会立即返回，不再继续落到账号弹窗外点击等后续分支。
  - 主站 main.js cache query 更新为 `20260623-click-delegation-r1`；`20260623-hidden-dialog-focus-r1` 已由当前版本覆盖。

- 主站社交图标隐藏与弹窗初始焦点修复：
  - 关于我窗口中未配置的 Bilibili / Discord 图标现在会被 CSS 真正隐藏，不再因组件自身 `display` 样式占位成不可点击的死图标。
  - 欢迎弹窗和视频弹窗打开后会明确聚焦标题栏关闭按钮，不再误选带关闭属性的背景层，键盘用户进入弹窗时能立即落在可操作控件上。
  - 主站 main.js cache query 更新为 `20260623-hidden-dialog-focus-r1`；CSS cache query 更新为 `20260623-hidden-dialog-focus-r1`；`20260623-honest-empty-states-r1` 已由当前版本覆盖。

- 主站资源区和杂谈区占位内容收口：
  - 资源区公开渲染只展示已有真实下载或外链的条目；当前没有真实可获取资源时，显示三语“资源区正在整理中”空状态并引导去知识库。
  - 资源分类按钮数量改为统计真实可获取资源，避免示例工具包、素材包、配置模板被误看成已发布资源。
  - 杂谈区公开渲染只展示正式发布、带链接或带正文的条目；现有本地示例草稿不再显示成文章卡片，改为三语整理中空状态。
  - 主站 main.js cache query 更新为 `20260623-honest-empty-states-r1`；`20260623-resource-social-source-r1` 已由当前版本覆盖。

- 主站资源占位、社交链接和游戏来源安全收口：
  - 英文视频区说明将 `Saves` 调整为 `Favorites`，和收藏语义保持一致。
  - 公开社交链接接口不再给 Bilibili / Discord 返回泛平台占位地址；前端读取接口时会按小写已知平台归一化，真实配置仍会正常显示。
  - 资源卡片没有真实下载或外链时只显示类型和“待补链接”状态，不再展示版本、大小、更新时间，避免把占位条目误看成可下载资源。
  - 游戏卡片来源链接和游戏入口壳层的上游仓库链接统一走 GitHub 仓库守卫，并把游戏壳本地存档读取顺序调整为优先真实本地存储、再回退到本轮会话映射。
  - 主站 main.js cache query 更新为 `20260623-resource-social-source-r1`；`20260623-url-social-quicklinks-r1` 已由当前版本覆盖。

- 本地构建检查稳定性与筛选无障碍收口：
  - 视频、资源、游戏和状态播报相关断言从 `main.js` 逐字 token 清单改为函数作用域内的结构匹配，减少正常整理代码时的误报。
  - 知识库和视频筛选按钮补充选中状态，资源待开放按钮改为可聚焦的 `aria-disabled` 状态，桌面入口改为导航区域，视频弹窗的原地址链接会带上当前视频标题。
  - 知识库文章卡片的阅读入口会带上文章标题，杂谈区占位按钮也改为可聚焦的 `aria-disabled` 状态并带上条目标题，减少重复按钮文案带来的上下文缺失。
  - 知识库搜索无结果时新增“显示全部文章”恢复入口，会同时清空搜索并回到全部分类；知识库搜索计数和聊天室反馈补充状态播报，底部任务栏标签改为带三语标签的导航区域。
  - 欢迎弹窗和视频弹窗打开后会把焦点移入关闭按钮，普通关闭时尽量回到触发位置；欢迎快捷入口、最近更新跳转和深链同步会关闭欢迎弹窗但不恢复旧焦点，Escape 只在弹窗实际打开时关闭对应弹窗。
  - 知识库和视频分类筛选按钮新增数量徽标，复用资源区的像素小徽标样式；筛选前就能看到每类文章或视频数量，按钮读屏标签也同步追加数量。
  - 游戏目录读取成功但列表为空时，会显示可重试的 XP 风格空状态，不再留下空白窗口；目录结构异常时继续走失败状态，方便排查配置问题。
  - 资源区无链接条目的右侧操作位改为非交互“待补链接”状态文本，不再让键盘停在没有实际动作的按钮上；可下载或外链资源的真实操作入口不变。
  - 聊天室发送时会在同步校验通过后立刻进入忙碌状态，临时锁定输入框和发送按钮并播报“正在发送”，慢网或首次取昵称时不再重复提交同一条消息；成功、失败或昵称冲突处理结束后都会恢复输入。
  - 聊天室增量拉取的 `after` 游标如果指向已被后台物理删除的消息，会先从消息编号恢复时间戳继续拉取后续可见消息，无法恢复时再回退到最近消息，避免打开中的客户端持续错过新消息；本地构建检查新增对应路由烟测，覆盖同毫秒后续消息的恢复路径。
  - 聊天室顶部同步状态会显示当前约 5 秒、15 秒或 30 秒刷新节奏，并在语言切换后保持对应状态；该文案保持普通可见文本，不额外加入读屏播报。
  - 游戏目录读取结果会在前端缓存，切换语言、筛选或重绘页面时不再重复请求 `/games/catalog.json`；只有首次进入或点击“重新读取游戏列表”时才会重新拉取，减少弱网闪烁。
  - 知识库文章详情读取失败时会在正文区域显示可重试入口，深链打开文章遇到临时网络错误时不再只能刷新整页。
  - 知识库文章详情目录会把当前章节同步为 `aria-current`，目录按钮会关联对应标题；点击目录后焦点进入目标标题，键盘和读屏用户不再停留在目录按钮上。
  - 欢迎弹窗和视频弹窗打开时会把 Tab / Shift+Tab 焦点圈定在当前弹窗内，避免键盘焦点跑到背后的桌面、任务栏或页面内容；Escape 关闭逻辑和原有焦点恢复保持不变。
  - 文章列表与详情接口请求改为显式跳过浏览器缓存，后台发布或更新文章后，公开知识库和最近更新更容易拿到最新内容。
  - 关于页头像的替代文本接入三语同步，切换英文或日文时不再继续读出中文头像描述。
  - 语言偏好、欢迎弹窗记忆、聊天室访客编号、昵称和发送冷却改为安全读写本地存储；隐私模式或浏览器禁用存储时，主站脚本仍会继续加载并使用当次会话内的默认状态。
  - 文章列表重新读取成功后会清空详情页会话缓存，减少后台更新文章后同一页面会话继续看到旧详情的机会。
  - 首页 `hover` 预览参数会先校验为已知栏目，再生成桌面图标选择器，避免破损或恶意查询参数打断脚本尾段初始化。
  - 从文章详情切到其他栏目或知识库列表时，会同步清理旧文章阅读状态，避免回到知识库时仍停在上一篇文章详情。
  - 知识库文章详情渲染成功后会同步浏览器标题、描述、canonical、OG 和 Twitter 分享信息；离开文章详情、打开新详情加载中或详情加载失败时恢复站点默认 meta，文章封面只使用安全白名单路径，避免旧文章分享信息残留。
  - 直接通过地址栏或外部链接打开知识库文章详情时，会把解析到的文章标识传入路由切换流程，避免旧文章状态清理逻辑误清空当前深链文章。
  - 聊天室发送冷却时间从本地存储恢复时会忽略非法、负数或未来时间戳，避免被污染的本地值让用户长时间无法发送新消息；冷却判断继续沿用 3 秒节奏。
  - 常用按钮补齐统一的黄色键盘焦点外圈，桌面图标、任务栏、窗口工具栏、筛选按钮、卡片操作和 XP 按钮在键盘导航时更容易辨认；减少动画偏好下会同步压缩过渡延迟和持续时间。
  - 知识库搜索框恢复可见输入光标；460px 以下窄屏首页入口明确保持单列列表式布局，避免后续 620px 双列规则覆盖手机端布局意图。
  - 知识库文章 hash 兼容 `#knowledge/article/<slug>` 与短格式 `#knowledge/<slug>`，从外部或旧链接进入时不会被识别成首页。
  - 前端埋点收紧隐私边界：页面路径只保留站内规范路径和白名单语言参数，外部来源与外链只保留来源站点，自动点击埋点不再从可见文本、标题或 aria 标签采集完整文案，仅使用显式稳定标签。
  - 游戏壳层的本地存档读写改为安全封装；浏览器隐私模式、禁用存储或本地存储写入失败时，会退回当次会话内的临时存档映射，游戏入口仍可加载并继续使用本地工具。
  - 5 个游戏入口页的 `game-shell.js` query 更新为 `20260623-game-shell-storage-safe-r1`，避免继续加载旧壳层脚本。
  - 游戏和资源外链收紧到 HTTPS 白名单：游戏本地启动继续只走 `entry`，游戏仓库只接受 GitHub 仓库地址，资源外链必须显式标记为外部且来自可信来源；本地资源路径仍拒绝路径穿越。
  - 欢迎弹窗快捷入口顺序改为聊天室、游戏区、知识库和最近更新，跟推荐文案保持一致；Bilibili 和 Discord 没有真实配置时默认隐藏，避免访客点到泛平台首页。
  - 主站 main.js cache query 更新为 `20260623-url-social-quicklinks-r1`，CSS cache query 更新为 `20260623-mobile-caret-layout-r1`，telemetry cache query 更新为 `20260623-analytics-privacy-r1`；当轮曾更新为 `20260623-article-short-hash-r1`、`20260623-chat-cooldown-clamp-r1`、`20260623-focus-reduced-motion-r1`、`20260623-route-article-deeplink-r1`、`20260623-article-detail-meta-r1`、`20260623-hover-cache-guard-r1`、`20260623-storage-safe-r1`、`20260623-article-cache-avatar-alt-r1`、`20260623-dialog-toc-a11y-r1`、`20260623-article-toc-focus-a11y-r1`、`20260623-game-cache-detail-retry-r1`、`20260623-chat-sync-status-r1`、`20260623-chat-sending-state-r2`、`20260623-chat-sending-state-r1`、`20260623-resource-pending-semantics-r1`、`20260623-game-empty-state-r1`、`20260623-filter-counts-a11y-r1`、`20260623-modal-focus-a11y-r1`、`20260623-search-chat-status-a11y-r1`、`20260623-card-link-context-a11y-r1`、`20260623-filter-pressed-modal-a11y-r1`、`20260623-filter-badge-a11y-r1`、`20260623-rss-desktop-a11y-r1` 和 `20260623-card-action-a11y-r1`（随后由当前版本覆盖）。
- RSS 标题同步与 14:00 收口守卫：
  - `syncRssLinks()` 会同时同步可见 RSS 按钮和 RSS alternate 发现链接的 `href` / `title`，避免标题同步逻辑分散在多处。
  - 桌面栏目容器的无脚本初始 `aria-label` 改为中文默认，并继续由 `desktopIconsAria` 在脚本加载后随语言切换同步。
  - 视频缩略图按钮和卡片播放按钮的读屏标签会追加当前视频标题，让键盘和读屏用户在进入播放器前获得更明确的上下文。
  - 资源卡片下载/外链/待开放按钮、游戏卡片启动按钮和源码链接的读屏标签会追加对应条目标题，减少重复按钮名带来的上下文缺失。
  - 资源筛选按钮补充选中状态，资源状态徽标、资源标题图标、游戏语言徽标和云存档徽标继续收紧读屏上下文。
  - 知识库、视频区和游戏区的加载/失败状态补充温和的状态播报；视频区只播报文案区域，重试按钮继续作为独立操作控件。
  - 本地构建检查补充可见 RSS 链接标题同步和桌面栏目中文默认标签断言，并将最终公开汇总守卫的 `published_at` 口径校准为 2026-06-23 14:00（Asia/Shanghai）对应的 UTC 时间；最终 `site-updates`、fallback、Functions seed、schema seed 与首页日期仍保留到收尾阶段一次性落地。
  - 最终公开汇总守卫补强三语内容完整性检查：一旦最终 token 写入业务文件，会同时验证 Functions seed 与 schema seed 的 zh/en/ja 标题、摘要和正文都已填充。
  - 本地构建检查新增前端 telemetry 隔离环境烟测，验证 page-view 与 click payload 在发送前已脱敏普通邮箱、URL 编码邮箱和双重编码邮箱形态；后端烟测同步覆盖点击事件和访客画像写入参数，并集中维护邮箱样本与 `[email]` 断言。
  - 主站 main.js cache query 当轮曾更新为 `20260623-filter-badge-a11y-r1`（随后由 `20260623-modal-focus-a11y-r1` 覆盖）；再早的 `20260623-rss-desktop-a11y-r1` 和 `20260623-card-action-a11y-r1` 也已由当前版本覆盖。
- 主站点击委托路由匹配与无障碍状态收口：
  - 修复 `body[data-route]` 被通用 `[data-route]` 点击分支误识别为路由按钮的问题，语言切换、筛选、文章操作、视频弹窗和账号弹窗外点击不再被当前路由抢走。
  - 本地构建检查新增路由分支必须排除 `body[data-route]` 的断言；主站 main.js cache query 当轮曾更新为 `20260623-account-expanded-a11y-r1`（随后由 `20260623-chat-sending-state-r2` 覆盖）。
  - 构建检查继续收紧点击委托防回归：禁止裸 `[data-route]` 点击匹配，并验证账号入口、退出登录和三类重试按钮仍先于路由分支处理。
  - 账号入口按钮补充 `aria-controls` 与 `aria-expanded`，打开、关闭和切换账号弹窗时同步展开状态。
  - 欢迎弹窗标题星标和状态小图标补充 `aria-hidden`，与快捷入口装饰图标保持一致；构建检查同步验证这两个无障碍属性。
  - 欢迎快捷入口和最近更新按钮的装饰箭头、视频占位符、资源空状态与最近更新空状态图标继续补充 `aria-hidden`，避免读屏把装饰符号读进按钮或状态文案。
  - 构建检查新增主站静态 i18n 防漏键扫描，交叉验证 `index.html` 绑定和 `t("...")` 调用在 zh/en/ja 翻译表中都有对应键。
  - 构建检查的点击路由、动态装饰图标和 i18n 扫描改用更稳健的匹配方式，并把 `cloudflare/schema.sql` 纳入必读文件；最终公开更新 token 出现后，会条件启用同一 seed 与 06-23 小节同步断言。
  - 后台私有更新记录将本次脱敏资源说明收窄为“后台 JS query”，避免误读为 CSS/JS 资源版本同时变更。

## 2026-06-22

- 主站首屏、键盘焦点、聊天室稳定性与埋点隐私小修：
  - `index.html` 中无脚本初始“最近更新日期”同步为 `2026.06.22`，避免脚本加载前短暂显示旧日期。
  - 语言切换导航的初始 `aria-label` 改为中文，并为底部任务栏聊天室小图标补充 `aria-hidden`；脚本加载后的三语同步逻辑不变。
  - 欢迎弹窗快捷入口新增“匿名聊天室”，复用现有三语 `navChatroom` 文案；快捷入口装饰图标改为屏幕阅读器忽略。
  - 桌面图标和底部任务栏按钮新增清晰的 `:focus-visible` 键盘焦点样式；移动端底部任务栏标签轨道新增轻量横向滚动提示，保持 XP 像素玻璃风格。
  - 资源区和杂谈区桌面图标标题去掉 “TBD” 提示，具体施工状态保留在窗口内卡片文案中。
  - 账号登录/注册弹窗的邮箱和密码输入框补充三语 `aria-label`，placeholder 继续作为输入提示。
  - RSS alternate 发现链接的标题会跟随当前语言同步；无脚本初始标题和可见 RSS 按钮标题改为中文默认。
  - 修复匿名聊天室空房间轮询可能错过第一条新消息的问题；当本地还没有真实 `lastMessageId` 时，增量刷新不再发送假 `after` 游标，改为请求最近少量消息。
  - 知识库、视频区和游戏区读取失败状态新增重新读取按钮，复用现有读取逻辑，减少临时网络失败后的恢复成本。
  - 点击埋点隐私边界收紧：账号顶部按钮不再把已登录邮箱放进可点击按钮文本；前端与服务端对目标文本、页面路径、来源、链接、元素标识和点击聚合键中的邮箱样式文本（含 URL 编码和双重编码形态）统一脱敏，输入框内容采集边界不变。
  - 后台私有更新记录同步说明本次点击埋点脱敏；后台点击热点和最近点击只展示脱敏后的分析文本，不改变点击采集范围、统计聚合、权限或接口路径。
  - 本地构建检查补充公开入口、重试按钮顺序、RSS 标题同步和埋点邮箱脱敏烟测，编码邮箱和双重编码邮箱都会在写入参数前被验证为脱敏。
  - 主站 CSS cache query 更新为 `20260622-mobile-taskbar-cue-r1`，主站 main.js cache query 当轮曾更新为 `20260622-retry-rss-title-r1`（随后由 2026-06-23 主脚本版本覆盖），telemetry cache query 更新为 `20260622-analytics-email-redact-r1`，后台 JS query 更新为 `20260622-admin-analytics-email-redact-r1`。

- 主站底部导航与四时段窗口背景：
  - 底部任务栏改为固定贴合浏览器视口下沿，切换知识库、视频区、资源区、游戏区、杂谈区、聊天室和关于我时不再被页面高度顶下去。
  - 主站窗口高度统一按顶部栏、底部任务栏和窗口间距变量计算，桌面端与移动端都为底栏预留空间，避免底栏盖住正常窗口或和窗口控件重叠。
  - 补测手机端后，提高 460px 以下窄屏顶部栏高度预留，修复 iPhone SE / 390px 宽度下部分窗口底部压进底部任务栏的问题。
  - 新增 `assets/images/window-backdrops/` 四张窗口页专用低干扰背景，跟随 morning / day / dusk / night 切换，并叠加轻量现代遮罩；首页动态壁纸舞台、云层和 `?wallpaper=` 预览参数保持不变。
  - 更新主站 CSS/JS query 为 `20260622-fixed-dock-window-backdrops-r3`，并同步 `site-updates` 三语文章、前端 fallback、Functions seed、schema seed、项目上下文和主站 Skill。

- 管理后台全局等高空白收口：
  - `/admin/` 第 42 轮 loop 按全局后台界面重新收口布局，实时大屏、访问来源、点击埋点、内容编辑和统计覆盖等多栏区域统一取消默认等高拉伸。
  - 今日访问总览、实时页面表现、访问来源和点击埋点统计卡片改成满宽上下流式排列，侧栏改为内容高度并保留滚动，短卡片不再被旁边长列表撑出大块空白。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r41`；不增加接口请求，不改变导航顺序、权限、统计口径或主站公开更新边界。

- 管理后台实时大屏排版与顶栏操作收口：
  - `/admin/` 第 41 轮 loop 收紧实时大屏首屏卡片排版，地图、页面概览、地区概览和实时页面表现不再互相拉伸出大块空白。
  - 删除侧边栏数字气泡和右上角退出按钮，将“顶部”改为右下角浮动按钮，并把实时大屏标题改为“鲁肃个人站管理后台”。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r39`；不增加接口请求，不改变导航顺序、权限、统计口径或主站公开更新边界。

- 管理后台侧边栏已加载概况：
  - `/admin/` 第 40 轮 loop 在侧边栏底部新增“已加载”概况行，按当前本地状态显示文章、视频、消息和账号数量。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r38`；不增加接口请求，不改变导航顺序、权限或数据读取时机。

- 管理后台侧边栏徽标单位优化：
  - `/admin/` 第 39 轮 loop 将侧边栏数量徽标的悬停提示改为对应单位，并把访问来源、点击埋点也接入已有概览数量。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r37`；不增加接口请求，不改变导航顺序、权限或数据读取时机。

- 管理后台侧边栏数量徽标：
  - `/admin/` 第 38 轮 loop 在侧边栏的文章、视频、视频分类、聊天室、账号、社交链接和后台更新记录入口右侧新增小数量徽标，数据加载后自动显示已加载数量。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r36`；不增加接口请求，不改变导航顺序、权限或数据读取时机。

- 管理后台历史更新记录术语收口：
  - `/admin/` 第 37 轮 loop 将后台更新记录历史条目中的网络地址缩写、语言代码、页面绑定、后台接口、主站公开更新分类等技术词改成更自然的中文回看文案。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r35`；只调整后台私有记录展示，不改变接口、权限、数据字段或主站公开更新边界。

- 管理后台网络来源文案中文化：
  - `/admin/` 第 36 轮 loop 将访问来源表、聊天室禁言按钮、聊天详情、登录履历和后台说明里不必要的网络地址缩写、接口缩写和权限字段表达改为“网络来源”“网络前缀”“隐藏网络指纹”“后台接口”“管理员角色”等中文说明。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r34`；只调整后台可见文案，不改变字段名、接口参数、禁言逻辑、权限或主站公开更新边界。

- 管理后台更新记录概览：
  - `/admin/` 第 35 轮 loop 在后台更新记录列表上方新增概览条，显示全部记录、最新日记录、循环记录、概览优化、文案优化和最新一轮编号。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r33`；不增加接口请求，不改变后台权限、数据来源或主站公开更新边界。

- 管理后台社交链接状态概览：
  - `/admin/` 第 34 轮 loop 在社交链接图标预览上方新增状态概览条，显示全部入口、已设置、自定义、默认链接、有更新记录和待补链接数量，并将哔哩哔哩入口在后台预览中中文显示。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r32`；不增加接口请求，不改变社交链接保存、权限或主站图标展示。

- 管理后台账号列表状态概览：
  - `/admin/` 第 33 轮 loop 在账号列表筛选框下方新增状态概览条，随筛选显示全部 / 当前显示、管理员、普通用户、当前活跃、有云存档和有登录记录数量。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r31`；不增加接口请求，不改变账号详情、重置密码、权限或主站公开更新边界。

- 管理后台禁言列表治理概览：
  - `/admin/` 第 32 轮 loop 在禁言列表上方新增治理概览条，随筛选显示全部 / 当前显示、生效中、已停用、按用户、按 IP 和有原因数量。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r30`；不增加接口请求，不改变禁言创建、停用、权限或主站公开更新边界。

- 管理后台聊天记录治理概览：
  - `/admin/` 第 31 轮 loop 在聊天记录列表上方新增治理概览条，随筛选显示已加载 / 当前显示、可见、已隐藏、有来源、有用户标识和可禁言数量。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r29`；不增加接口请求，不改变消息编辑、隐藏、删除、禁言、权限或主站公开更新边界。

- 管理后台视频分类状态概览：
  - `/admin/` 第 30 轮 loop 在视频分类列表上方新增状态概览条，随筛选显示全部 / 当前显示、启用、停用、已被使用、可删除和最高排序。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r28`；不增加接口请求，不改变分类保存、停用、排序、删除、权限或主站公开更新边界。

- 管理后台视频列表状态概览：
  - `/admin/` 第 29 轮 loop 在视频管理列表上方新增状态概览条，随筛选显示全部 / 当前显示、已发布、草稿、隐藏、置顶和需补资料数量。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r27`；不增加接口请求，不改变视频保存、发布、隐藏、置顶、权限或主站公开更新边界。

- 管理后台文章列表状态概览：
  - `/admin/` 第 28 轮 loop 在知识库文章列表上方新增状态概览条，随筛选显示全部 / 当前显示、已发布、草稿、归档、置顶和三语完整数量。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r26`；不增加接口请求，不改变文章保存、发布、删除、权限或主站公开更新边界。

- 管理后台更新记录技术词收口：
  - `/admin/` 第 27 轮 loop 将后台页面内更新记录里的资源版本技术词统一收口为“资源版本”，保留版本号但减少后台可见英文术语。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r25`；不改变资源加载方式、接口权限、部署流程或主站公开更新边界。

- 管理后台表单占位提示中文化：
  - `/admin/` 第 26 轮 loop 将文章路径标识、文章封面、视频链接、视频分类路径标识和哔哩哔哩社交链接的占位提示改成中文说明式文案。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r24`；不改变字段名、保存逻辑、平台白名单、接口权限或主站公开更新边界。

- 管理后台视频列表可识别性优化：
  - `/admin/` 第 25 轮 loop 将视频列表和视频编辑标题的兜底展示从原始链接 / 内部编号改为更自然的中文提示或作者名，并把原始平台值显示为“哔哩哔哩”。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r23`；不改变视频保存字段、平台白名单、接口权限或主站公开更新边界。

- 管理后台实时页面表现比例条：
  - `/admin/` 第 24 轮 loop 将实时大屏右侧的“实时访问排行”改为“实时页面表现”比例条，展示中文页面名、浏览量、访客数和最近访问时间。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r22`；不新增接口请求，不改变统计口径、权限、隐私处理或主站公开更新边界。

- 管理后台最近点击页面概览：
  - `/admin/` 第 23 轮 loop 在点击埋点页的“最近点击”列表上方新增“点击页面概览”比例条，按页面聚合已加载点击事件；筛选点击后概览同步收窄。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r21`；不新增接口请求，不改变点击采集、聚合、隐私处理、权限或主站公开更新边界。

- 管理后台地区来源比例概览：
  - `/admin/` 第 22 轮 loop 在访问来源页的地区明细表上方新增“地区来源概览”比例条，筛选后同步展示匹配来源前 6 条的浏览 / 访客表现。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r20`；不新增接口请求，不改变统计口径、IP 脱敏、表格复制逻辑、权限或主站公开更新边界。

- 管理后台最近点击本地筛选：
  - `/admin/` 第 21 轮 loop 在点击埋点页的“最近点击”列表上方新增本地筛选框，可按点击目标、页面、来源和屏幕尺寸快速定位已加载事件；筛选计数显示“显示 X / 共 Y”。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r19`；不新增接口请求，不改变点击采集、聚合、隐私处理、权限或主站公开更新边界。

- 管理后台地区来源明细本地筛选：
  - `/admin/` 第 20 轮 loop 在访问来源页的“省份 / 地区 / IP 来源”明细表上方新增本地筛选框，可按国家、地区、城市和 IP 前缀快速定位来源；筛选计数显示“显示 X / 共 Y”。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r18`；不新增接口请求，不改变统计口径、IP 脱敏、表格复制逻辑、权限或主站公开更新边界。

- 管理后台标识文案中文化：
  - `/admin/` 第 19 轮 loop 将视频表单里的编号标签改为“平台视频编号”，聊天室详情和禁言按钮里的识别字段改为“用户标识 / 前端临时标识”。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r17`；不改变字段名、DOM 绑定、接口参数、隐私边界或主站公开更新边界。

- 管理后台禁言列表本地筛选：
  - `/admin/` 第 18 轮 loop 在禁言列表上方新增本地筛选框，可按禁言对象、原因、生效状态和来源类型快速定位记录；筛选计数显示“显示 X / 共 Y”。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r16`；不新增接口请求，不改变禁言创建、停用、权限或主站公开更新边界。

- 管理后台聊天室消息本地筛选：
  - `/admin/` 第 17 轮 loop 在聊天记录列表上方新增“筛选已加载消息”，可按昵称、内容、来源和隐藏状态快速定位当前加载的聊天记录；筛选计数显示“显示 X / 共 Y”。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r15`；不新增接口请求，不改变聊天隐藏、删除、禁言、权限或主站公开更新边界。

- 管理后台账号列表本地筛选：
  - `/admin/` 第 16 轮 loop 在账号列表上方新增本地筛选框，可按邮箱、角色、密码状态和活跃信息快速定位账号；账号概览仍显示全量状态，筛选时列表计数显示“显示 X / 共 Y”。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r14`；不新增接口请求，不改变账号读取、重置密码、权限或主站公开更新边界。

- 管理后台视频分类本地筛选：
  - `/admin/` 第 15 轮 loop 在视频分类列表上方新增本地筛选框，可按分类名、路径标识和排序快速定位分类，并在筛选时显示“显示 X / 共 Y”。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r13`；不新增接口请求，不改变分类保存、停用、排序、删除、权限或主站公开更新边界。

- 管理后台视频列表本地筛选：
  - `/admin/` 第 14 轮 loop 在视频列表上方新增本地筛选框，可按标题、作者、平台和链接快速定位视频，并在筛选时显示“显示 X / 共 Y”。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r12`；不新增接口请求，不改变视频保存、识别、发布、删除、权限或主站公开更新边界。

- 管理后台文章列表本地筛选：
  - `/admin/` 第 13 轮 loop 在知识库文章列表上方新增本地筛选框，可按标题、路径标识、分类和标签快速缩小列表，并在筛选时显示“显示 X / 共 Y”。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r11`；不新增接口请求，不改变文章保存、发布、删除、权限或主站公开更新边界。

- 管理后台统计与治理文案去英文缩写：
  - `/admin/` 第 12 轮 loop 将实时大屏里的 `PV / UV` 解释改为“浏览量 / 独立访客”，把聊天室消息详情和禁言提示里的 `IP hash` 改为“隐藏 IP 指纹”。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r10`；只调整后台运行界面文案，不改变接口字段、权限、隐私边界或主站公开更新边界。

- 关于我联系方式图标归位：
  - 删除关于我窗口联系方式里的占位文案，把 X、GitHub、Bilibili、Instagram、Discord 五个入口移动到“联系方式”这一行内展示。
  - 新增 `assets/images/social/` 本地 SVG 品牌图标资源，主站通过 CSS mask 渲染原应用图标形状和品牌色，继续只显示小图标按钮和 `aria-label`。
  - 社交链接读取、后台维护接口、D1 配置和新标签打开行为不变；本次同步 `site-updates` 三语文章、前端 fallback、Functions seed、schema seed、项目上下文和主站 CSS/JS query。
  - 更新主站 CSS/JS query 为 `20260622-about-social-icons-r1`。

- 管理后台运行文案去除 slug 直出：
  - `/admin/` 第 11 轮 loop 将文章保存校验、视频分类列表摘要和分类完整提示里的 `slug` 直出改为“路径标识”。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r9`，只调整中文可读性，不改变字段名、接口参数、权限或主站公开更新边界。

- 管理后台文章列表标题化：
  - `/admin/` 第 10 轮 loop 将知识库文章列表主标题从路径标识改为文章标题，路径标识退到次级信息，减少靠 slug 识别文章的成本。
  - 后台文章列表接口补充读取已有标题字段；后台 CSS/JS query 更新为 `20260622-admin-insight-r8`，不改变权限、保存逻辑、D1 schema 或主站公开更新边界。

- 管理后台顶部说明中文化：
  - `/admin/` 第 9 轮 loop 优化面板切换后的顶部说明：文章说明不再显示 `zh / en / ja`，视频和社交链接说明减少平台名堆叠，访问来源说明补充“掩码 IP 前缀”。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r7`，不改变功能逻辑、接口、权限或主站公开更新边界。

- 管理后台未知路径显示收口：
  - `/admin/` 第 8 轮 loop 将页面显示兜底从原始路径改为“站内页面”，避免未登记页面在排行、洞察、账号活跃和点击事件中再次露出 `/xxx` 或语言参数。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r6`，只调整展示层，不改变接口原始数据、权限或主站公开更新边界。

- 管理后台统计覆盖文案校准：
  - `/admin/` 第 7 轮 loop 将侧边栏和实时大屏里的“已选站点 / 追踪项”改为“页面 / 地区 / 文章覆盖”，今日访问副标题改为“多少个页面有访问”。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r5`，不改变统计接口、权限、D1 schema 或主站公开更新边界。

- 管理后台实时洞察摘要：
  - `/admin/` 第 6 轮 loop 在实时大屏顶部新增访问洞察摘要，直接显示最热页面、主要地区、热门文章和最高点击动作。
  - 摘要使用中文页面名、中文地区名和中文指标表达；后台 CSS/JS query 更新为 `20260622-admin-insight-r4`，不改变后台接口、权限或主站公开更新边界。

- 管理后台热门文章图表化：
  - `/admin/` 第 5 轮 loop 将实时大屏热门文章从表格改为文章表现比例条，主数字显示浏览量，副信息显示访客、分类和最近访问时间。
  - 文章分类在概览中尽量显示为中文；后台 CSS/JS query 更新为 `20260622-admin-insight-r3`，后台权限、接口、D1 schema 和主站公开更新边界不变。

- 管理后台访问来源与点击热点图表化：
  - `/admin/` 第 4 轮 loop 继续减少后台统计长表格：访问来源页的国家来源改为中文地区比例条，点击埋点页的点击热点改为按目标聚合的比例条。
  - 最近点击事件减少直接显示 `data_route`、`target_key` 等技术字段，改用“目标位置”等中文说明；地区 / IP 来源明细表保留复制掩码 IP 前缀的工具用途。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r2`；后台权限、接口、D1 schema、统计口径和主站公开更新边界不变。

- 管理后台实时大屏图表化与侧边栏优化：
  - `/admin/` 将实时城市分布、页面概览、地区概览提前到首屏，原热门页面和国家/地区长表格改为中文名称比例条概览，减少截图中那类长列表占屏。
  - 后台运行时会把 `/`、`/#videos`、`/?lang=zh`、文章 slug 等访问路径显示为首页、视频区、知识库和已知文章中文名；`TW`、`US`、`SG`、`CN` 等地区码显示为中文地区名。
  - 顶部横向小标签导航改为左侧栏，保持当前白底细边框数据后台风格；后台权限、接口、D1 schema 和主站公开 `site-updates` 边界不变。
  - 后台 CSS/JS query 更新为 `20260622-admin-insight-r1`；本次为后台私有 UI 更新，未写入主站 `site-updates`、`js/main.js` fallback 或公开最近更新。

- 管理后台实用性与中文可读性优化：
  - `/admin/` 首屏实时面板、站点追踪摘要、访问排行、追踪项说明、数据卡片口径、文章路径标识、三语编辑标签和视频分类路径标识改为更直观的中文后台文案。
  - 移除数据卡片里的 `Quota/token` 模板残留，改为真实统计口径说明；恢复实时大屏的浏览 / 访客说明，并把表格标题尽量改成“浏览 / 访客”。
  - 窄屏表格增加“左右滑动查看完整表格”提示，补强焦点轮廓、表头换行和状态文字可读性。
  - 后台 CSS/JS query 更新为 `20260622-admin-usability-r2`；本次只调整后台私有 UI、文案和可读性，未写入主站 `site-updates`、`js/main.js` fallback 或公开最近更新。

## 2026-06-21

- 管理后台参考图优先实时面板重做：
  - `/admin/` 在上一版极简后台基础上再次推倒重做，进一步贴近参考图的 Google Analytics 实时数据跟踪布局：顶部标题与按钮、跟踪网站横条、左侧实时总览与灰度地图、右侧网站实时排名、下方 property 卡片矩阵按例图重新组织。
  - 保留全部后台模块、原导航顺序、表单字段、DOM 绑定 ID、后台 API、权限校验、视频安全解析、聊天室治理、账号安全边界和 D1 schema。
  - 后台 CSS/JS query 更新为 `20260621-admin-ga-realtime-r2`；本次仍是后台私有视觉更新，未写入主站 `site-updates`、`js/main.js` fallback 或公开最近更新。
- 管理后台极简数据工作台重做：
  - `/admin/` 从旧 XP 面板风改为接近 Google Analytics 实时面板的白底极简数据工作台，重做侧栏、顶部栏、数据卡片、趋势图、榜单表格、地图、表单、状态和移动端布局。
  - 保留全部后台模块、原导航顺序、表单字段、DOM 绑定 ID、后台 API、权限校验、视频安全解析、聊天室治理和账号安全边界；未改 D1 schema。
  - 实时大屏调整为趋势和榜单优先、灰度世界地图压轴的阅读顺序，更贴近参考图的视觉节奏。
  - 后台 CSS/JS query 更新为 `20260621-admin-ga-realtime-r2`；本次是后台私有视觉更新，未写入主站 `site-updates`、`js/main.js` fallback 或公开最近更新。

## 2026-06-20

- 关于我社交图标与后台链接管理：
  - 关于我窗口新增 X、GitHub、Bilibili、Instagram、Discord 五个纯图标按钮，不增加可见平台文字；按钮可点击并在新标签打开对应链接。
  - 新增公开只读接口 `GET /api/social-links`，主站初始化时读取 D1 配置，失败时回退默认链接。
  - `/admin/` 新增“社交链接”页面，可维护五个平台跳转地址；新增 `GET /api/admin/social-links`、`PUT /api/admin/social-links`，继续要求 `users.role = admin`。
  - 社交链接保存到 `site_runtime_state.about_social_links`，服务端只接受 http(s) URL，并可自动补齐省略的 `https://`。
  - 同步新增三语 `site-updates` 文章“关于我社交图标上线 / About Social Icons / プロフィールのSNSアイコン”、前端 fallback、Functions seed、schema seed、后台私有更新记录、项目上下文和 Skill 规则。
  - 更新主站 CSS/JS query 为 `20260620-about-social-links-r1`，后台 CSS/JS query 为 `20260620-admin-social-links-r1`。

## 2026-06-19

- 主站四时段沉浸式桌面栏：
  - 重新设计首页顶部栏和底部任务栏，新增 morning / day / dusk / night 四套无竖线的现代玻璃像素 HUD 主题，跟随现有本地时间与 `?wallpaper=` 预览机制切换。
  - 保留原有图标资源、导航入口、语言切换、账号入口、本地时间和在线状态逻辑，只调整公开主站视觉层。
  - 顶部栏去除旧版竖向栅格，改为柔和光斑、横向光带和半透明玻璃层；底部任务栏改为更轻的 dock 式像素轨道、激活态按钮、Start 按钮和状态托盘的主题化层次。
  - 新增三语 `site-updates` 文章“四时段沉浸式桌面栏 / Immersive Time-of-Day Chrome / 時間帯別の没入デスクトップバー”，并同步前端 fallback、Cloudflare Functions seed、schema seed。
  - 更新 `index.html` 的主站 CSS/JS query 为 `20260619-immersive-chrome-r2`；未修改 `/admin/`、账号接口、聊天接口、文章接口或游戏存档逻辑。

- 管理后台访问地图投影修复：
  - `/admin/` 实时大屏访问地图点位改为按本地世界地图 SVG 实际可见的 2:1 地图框投影，修复宽屏下经纬度点按整块蓝色面板计算导致落点偏离真实地图的问题。
  - 切回实时大屏和窗口尺寸变化后会重新计算点位位置；后台 JS query 更新为 `20260619-admin-map-projection-r001`，未写入主站 `site-updates` 或首页最近更新。

- 管理后台访问地图真实化：
  - `/admin/` 实时大屏访问地图改为本地真实世界地图轮廓资源，来源点按现有 Cloudflare 经纬度聚合字段投影到国家、地区和城市位置。
  - 点位标签和悬停信息显示来源地区、PV/UV 与掩码 IP 前缀，继续不展示完整明文 IP，也不接入第三方在线地图瓦片服务。
  - 同步更新后台页面内 `adminUpdates`、`admin/docs/ADMIN_CHANGELOG.md` 和后台 CSS/JS query 为 `20260619-admin-real-map-r001`；未写入主站 `site-updates` 或首页最近更新。

- 管理后台夜间 loop 合并记录：
  - 按 2026-06-19 08:00（Asia/Shanghai）截止完成 `/admin/` 后台 loop，只保留一条合并记录，不写 checkpoint 流水记录。
  - 本轮集中加固后台局部失败态、忙碌锁定、面板语义状态、侧边栏键盘导航、视频本地封面处理反馈和后台入口安全响应头。
  - `/admin/*` 仍只允许 `users.role = admin`；后台私有更新只同步到 `adminUpdates` 和 `admin/docs/ADMIN_CHANGELOG.md`，未写入主站 `site-updates`、`js/main.js` fallback 或公开最近更新。
  - 扩展 `scripts/build-check.mjs`，覆盖后台结构、权限、响应头、异常 session、畸形 cookie、局部失败提示和公共 API 基础响应；更新后台 JS query 为 `20260619-admin-loop-r014`。

- 主站发现与收口循环记录：
  - 本轮在独立 `codex/main-site-loop-20260619-night` 工作树中处理主站公开侧，避开 `/admin/` 页面、后台私有更新、后台权限和管理接口。
  - 补齐首页 canonical、Open Graph、Twitter Card、manifest、robots 和 sitemap 入口；`/sitemap.xml` 与 `/api/sitemap.xml` 都返回 XML，并包含三语首页与文章 URL。
  - 主站语言切换会同步 `html lang`、页面 title/description、canonical、OG/Twitter meta、RSS alternate 和语言按钮 `aria-pressed` 状态。
  - 新增一篇三语 `site-updates` 文章“主站发现与收口记录 / Main Site Discovery Wrap-up / メインサイト発見性の仕上げ”，并同步前端 fallback 最近更新。
  - `npm.cmd run build` 已覆盖文章、视频、sitemap、manifest、robots、主站脚本和遥测脚本检查；本地多视口扫描未发现页面错误或横向溢出。

## 2026-06-18

- 管理后台视觉改版循环合并记录：
  - 将本线程今天的 `/admin/` 后台视觉改版循环合并成 1 条后台私有更新记录，避免后台更新页逐条展示 checkpoint。
  - 本轮集中优化后台登录/拒绝访问状态、整体布局、顶部状态、数据卡片、图表空态、表格横向滚动提示、长文本展示、复制按钮、锁定态、空态、焦点态和移动端滚动边界。
  - 后台入口继续只允许 `users.role = admin` 访问；后台私有更新只写入 `adminUpdates` 与 `admin/docs/ADMIN_CHANGELOG.md`，不写入主站 `site-updates`、首页最近更新或主端资源。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r101`。

- 管理后台图表空态位置优化：
  - 实时大屏的每日 PV/UV 和今日小时走势在暂无图表数据时，空态提示改为靠近图表顶部显示。
  - 空态提示不再继承柱状图底部对齐方式，空数据时更像明确提示牌而不是落在图表底边。
  - 只调整后台图表空态视觉位置，不改变 PV/UV 聚合、小时走势、图表绘制或接口权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r62`。

- 管理后台聊天室隐藏筛选开关优化：
  - 聊天室管理顶部“显示隐藏”筛选开关补充手型指针、键盘焦点描边和勾选高亮态。
  - 筛选开关和后台按钮、分类勾选标签的交互反馈更统一，开启显示隐藏记录时状态更醒目。
  - 只调整后台聊天筛选开关视觉，不改变隐藏消息读取、聊天列表刷新、消息治理或权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r61`。

- 管理后台顶部刷新状态点优化：
  - 顶部“等待刷新/正在刷新/错误”状态条补充小状态点，和表单状态提示的视觉语言保持一致。
  - 忙碌状态显示蓝色点，错误状态显示红色点，普通状态显示绿色点，后台全局刷新反馈更容易扫读。
  - 只调整后台顶部状态条视觉，不改变自动刷新、手动刷新、数据读取、错误处理或权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r60`。

- 管理后台禁言列表卡片辅助焦点优化：
  - 聊天室禁言列表的禁言卡片补充键盘聚焦能力和可见焦点框，长访客标识、IP 来源和禁言原因更容易逐条审阅。
  - 禁言卡片继续保留完整悬停标题与辅助标签，停用按钮逻辑和忙碌状态保持不变。
  - 只调整后台禁言列表卡片可读性，不改变禁言创建、停用、IP hash、IP 前缀或权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r59`，JS query 为 `20260618-admin-visual-r100`。

- 管理后台文章语言标签锁定态优化：
  - 文章三语编辑的中文、English、日本語语言标签在读取详情、保存或删除期间补充明确的锁定视觉态。
  - 语言标签禁用时显示后台统一的斜纹忙碌背景和 progress 指针，减少保存中误以为还能切换语言的错觉。
  - 只调整后台文章语言标签视觉状态，不改变 zh / en / ja 三语编辑、保存校验、发布或权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r58`。

- 管理后台聊天室访客识别空态优化：
  - 聊天室管理未选择消息、记录被清空或删除后，访客识别区域显示统一空态提示，不再留下空白或普通文本。
  - 空态文案明确提示“选择消息后查看访客识别信息”，减少误以为访客 ID、IP hash 或 IP 前缀读取失败的困惑。
  - 只调整后台聊天室编辑区空态展示，不改变消息编辑、隐藏/恢复、删除、禁言或访客识别字段逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r99`。

- 管理后台账号概览统计标签优化：
  - 账号管理顶部概览的注册账号数、管理员数和活跃账号数改为带小状态点的统计标签，扫读层级更清楚。
  - 概览标签补充稳定的内联布局和间距，长数字或窄屏换行时不挤压账号列表。
  - 只调整后台账号概览视觉展示，不改变账号列表、登录履历、会话状态、密码重置或权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r57`。

- 管理后台私有更新记录卡片辅助标签优化：
  - 后台更新记录列表里的更新卡片补充键盘聚焦、悬停标题和完整 `aria-label` 摘要。
  - 更新记录的阅读体验与最近点击、账号履历等事件卡片保持一致，长更新说明也能通过辅助标签完整读取。
  - 只调整后台私有更新记录卡片展示，不新增后台更新条目，不写入主站知识库或公开最近更新。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r98`。

- 管理后台复制按钮忙碌状态优化：
  - 后台复制按钮在复制中或无内容提示期间同步设置 `aria-busy=true`，恢复后回到 `false`。
  - 表格 IP 前缀、聊天室访客识别、文章 slug、视频链接和视频分类 slug 的复制反馈更一致。
  - 只调整后台复制按钮状态反馈，不改变复制内容、剪贴板调用、访客标识脱敏或表单保存逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r97`。

- 管理后台访问地图空态提示优化：
  - 访问地图暂无数据时的“等待访问数据”改为独立像素提示牌，避免文字和地图背景混在一起。
  - 移除地图空态提示的零散行内定位样式，统一由后台 CSS 控制展示位置、边框和换行。
  - 只调整后台访问地图空态视觉，不改变访问统计、地图点位、来源聚合或接口权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r56`，JS query 为 `20260618-admin-visual-r96`。

- 管理后台视频分类勾选标签换行优化：
  - 视频管理里的分类勾选标签补充稳定的 inline-flex 布局、间距和断词规则，长分类名不会撑宽编辑区。
  - 勾选框保持固定宽度，分类名称可在标签内自然换行，手机端编辑视频时更容易扫读。
  - 只调整后台视频分类勾选区视觉排版，不改变视频分类读取、选择、保存、排序或权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r55`。

- 管理后台表单内复制按钮对齐优化：
  - 文章 slug、视频播放器地址和视频分类 slug 的表单内复制按钮改为填满所在网格列，和相邻输入框对齐更稳定。
  - 平板和手机单列布局下复制按钮也保持全宽触控区域，减少按钮漂在一侧的割裂感。
  - 只调整后台表单内复制按钮视觉对齐，不改变复制字段、文章三语保存、视频链接或分类保存逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r54`。

- 管理后台访问地图低位点标签优化：
  - 访问地图中靠近底部的来源点标签改为向上显示，减少标签被地图容器底边裁切的风险。
  - 保留原有地图点位、PV/UV 标题和来源聚合，只调整后台地图点位标签的视觉位置。
  - 只改变后台访问地图展示，不改变国家/地区/IP 前缀统计、坐标兜底、脱敏字段或接口权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r53`，JS query 为 `20260618-admin-visual-r95`。

- 管理后台手机端导航滚动边界优化：
  - 520px 以下窄屏恢复后台导航区内部滚动上限，避免十个后台标签把实时内容区推得过低。
  - 导航仍保持两列按钮和原有后台标签顺序，矮屏手机上可在导航框内滚动选择功能区。
  - 只调整后台侧边栏移动端视觉滚动边界，不改变后台入口、标签切换、数据读取或权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r52`。

- 管理后台复制小按钮交互统一：
  - 访问来源表格的 IP 前缀复制按钮和聊天室访客识别信息复制按钮补充手型指针、键盘焦点描边和按下反馈。
  - 小型复制按钮的交互状态更贴近后台 XP 按钮体系，鼠标和键盘操作时都更容易确认当前动作。
  - 只调整后台复制按钮视觉交互，不改变复制内容、访客标识、IP hash、IP 前缀脱敏或聊天治理逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r51`。

- 管理后台登录与拒绝访问状态反馈优化：
  - 后台登录页输入框和登录按钮补充清晰的像素风焦点描边，键盘操作时更容易确认当前位置。
  - 登录提交过程中按钮文案同步变为“正在登录...”，并设置忙碌状态；登录失败或网络错误后恢复按钮文案与可点击状态。
  - 登录状态提示补充 `aria-atomic`，减少读屏读取时只播报片段的风险。
  - 只调整 `/admin/` 入口登录/拒绝访问页的展示与状态反馈，不改变 session cookie、密码提交字段、users.role = admin 校验或后台权限逻辑。

- 管理后台最近点击长文本可读性优化：
  - 最近点击事件卡片的页面、时间、来源和目标路由改为带中文标签的两行摘要，长路径和长路由更容易扫读。
  - 事件详情行补充块级换行、宽度约束和轻量分隔线，减少手机端被长目标文本或长路径撑出横向滚动的风险。
  - 只调整后台点击埋点展示样式与文案，不改变点击采集字段、设备尺寸记录、来源脱敏或接口权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r50`，JS query 为 `20260618-admin-visual-r94`。

- 管理后台账号详情小面板移动端优化：
  - 账号详情的登录履历、近期活跃和会话状态三块小面板在平板/手机单列时取消内部 300px 滚动限制，改为随内容自然展开。
  - 小面板空态增加稳定最小高度，并在单列布局下拉开间距，选择账号前后更容易扫读。
  - 只调整后台账号详情面板的视觉与滚动边界，不改变账号读取、登录履历、会话状态、密码重置或权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r49`。

- 管理后台动态表格辅助标签修正：
  - 后台动态刷新表格摘要时保留“窄屏可横向滑动查看完整表格”说明，避免运行后覆盖掉初始 HTML 辅助标签。
  - 热门表格、访问来源表格和点击热点表格的悬停文本与辅助标签都会带上横向滚动提示。
  - 只修正后台表格辅助标签生成，不改变统计查询、来源聚合、点击埋点字段、IP 脱敏或接口逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r93`。

- 管理后台表格横向滚动提示优化：
  - 热门页面、热门文章、访问来源和点击热点表格在移动端显示“窄屏可横向滑动查看完整表格”的提示条，减少宽表格被误以为内容缺失。
  - 表格滚动区的辅助标签同步补充横向滑动说明，键盘聚焦或辅助技术读取时也能确认滚动边界。
  - 只调整后台表格滚动提示和可读性，不改变 PV/UV、来源聚合、点击埋点字段、IP 脱敏或接口逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r48`。

- 管理后台聊天与账号按钮手机宽度修正：
  - 补充手机断点下的覆盖规则，确保聊天管理和账号管理表单操作按钮在窄屏继续保持全宽排列。
  - 修正中等宽度按钮均分规则对手机全宽按钮的优先级影响，避免账号保存按钮在 390px 视口下只占局部宽度。
  - 只修正后台表单按钮响应式样式，不改变聊天治理、账号保存、密码重置或权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r47`。

- 管理后台聊天与账号操作按钮排列优化：
  - 聊天室管理的保存、隐藏、删除和禁言按钮在中等宽度下改为更稳定的均分换行，减少长按钮挤压和宽度忽大忽小。
  - 账号管理的保存账号按钮补充稳定宽度，和旁边状态提示分区更清楚；手机端仍保持全宽按钮。
  - 只调整后台聊天和账号表单按钮排列，不改变消息编辑、隐藏/恢复、删除、禁言、账号保存、密码重置或权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r46`。

- 管理后台编辑区保存栏滚动边界优化：
  - 后台文章、视频、视频分类、聊天室和账号编辑表单增加底部滚动留白，减少聚焦或滚动到末尾时内容贴近 sticky 保存栏。
  - 底部保存操作栏增加轻微上沿阴影和底部内边距，保留随手保存的效率，同时让它和正文内容分层更清楚。
  - 视频链接工具行继续保持非 sticky、无阴影，不受底部保存栏样式影响。
  - 只调整后台编辑区视觉滚动边界，不改变保存、发布、删除、禁言、账号更新或权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r45`。

- 管理后台视频封面空预览优化：
  - 视频管理编辑区在没有封面时显示更稳定的像素风空预览框，避免“暂无封面”只占一条窄栏、和普通输入框混淆。
  - 空预览框保持固定最小高度和居中提示，小屏下继续随容器收缩，不新增资源、不读取额外图片。
  - 只调整后台封面预览空态样式，不改变本地封面压缩、首帧生成、封面保存、外链预览或权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r44`。

- 管理后台视频链接工具行 sticky 覆盖修正：
  - 将视频链接工具行的非 sticky 覆盖规则改为更具体的 `.form-actions.compact-actions`，避免被底部表单操作栏通用样式覆盖。
  - 后台视频编辑区的识别、刷新和复制按钮继续保持稳定换行，不再以底部保存栏方式黏住滚动区。
  - 只修正本轮 CSS 覆盖顺序，不改变视频链接识别、元数据刷新、复制、保存、发布或权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r43`。

- 管理后台视频链接工具行滚动边界优化：
  - 视频管理编辑区的“自动识别/获取信息、刷新元数据、复制原链接”工具行改回普通表单工具行，不再继承底部保存操作栏的 sticky 定位。
  - 工具行按钮在平板和手机宽度下保留稳定换行与可点击宽度，减少编辑区滚动时遮挡内容或挤压文本的风险。
  - 只调整后台视频编辑区视觉布局，不改变视频链接识别、元数据刷新、复制、保存、发布或权限逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r42`。

- 管理后台列表锁定提示辅助标签优化：
  - 文章、视频、视频分类、聊天记录和账号列表卡片在保存、删除、读取或治理操作锁定期间，会同步更新悬停文本与辅助标签。
  - 忙碌结束后列表卡片恢复各自的完整摘要标签，便于键盘和辅助技术用户确认当前可切换项。
  - 只统一列表锁定提示，不改变列表读取、选择、保存、删除、聊天治理、账号保存或权限逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r92`。

- 管理后台新建按钮辅助标签优化：
  - 知识库文章、视频管理和视频分类管理的“新建”按钮会在可操作、保存中和删除中状态下同步更新悬停文本与辅助标签。
  - 忙碌时按钮会明确提示等待保存或删除完成后再新建，减少编辑区和列表切换时的状态误读。
  - 只统一新建按钮状态提示，不改变文章、视频、视频分类的新建、保存、删除、排序或权限逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r91`。

- 管理后台复制按钮临时状态辅助标签优化：
  - 复制 slug、视频链接、播放器地址、聊天来源标识等按钮在“已复制”“复制失败”“无内容”状态下同步更新悬停文本与辅助标签。
  - 临时状态结束后会恢复按钮原本的 `title` 与 `aria-label`，避免复制反馈残留到后续操作。
  - 只统一复制反馈提示，不改变剪贴板写入、字段读取、访客标识脱敏或后台数据展示逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r90`。

- 管理后台账号与视频元数据按钮辅助标签优化：
  - 账号管理保存按钮会随未选择账号、详情读取中和保存中状态同步更新悬停文本与辅助标签，已可保存时也明确标注“保存当前账号设置”。
  - 视频管理的“自动识别/获取信息”和“刷新元数据”按钮改为复用统一按钮提示同步，忙碌、未选择视频和可操作状态下都会同时更新 `title` 与 `aria-label`。
  - 只统一按钮状态提示，不改变账号保存、密码重置、视频链接识别、元数据刷新、接口或权限逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r89`。

- 管理后台视频分类表单按钮辅助标签优化：
  - 视频分类编辑区的保存分类和删除分类按钮会随未选择、占用保护、保存中和删除中状态同步更新悬停文本与辅助标签。
  - 只统一按钮状态提示，不改变视频分类保存、启停、占用保护或删除逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r88`。

- 管理后台视频表单按钮辅助标签优化：
  - 视频管理编辑区的保存、保存并发布和删除按钮会随元数据预览/刷新、保存中和删除中状态同步更新悬停文本与辅助标签。
  - 只统一按钮状态提示，不改变视频链接解析、元数据刷新、封面处理、保存、发布或删除逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r87`。

- 管理后台文章表单按钮辅助标签优化：
  - 知识库文章编辑区的保存、保存并发布和删除按钮会随新建、详情读取、保存中和删除中状态同步更新悬停文本与辅助标签。
  - 只统一按钮状态提示，不改变文章三语校验、保存、发布、删除接口或权限逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r86`。

- 管理后台禁言列表提示优化：
  - 聊天室禁言列表容器补充动态悬停文本和辅助标签，空态明确提示暂无记录。
  - 每条禁言卡片补充生效状态、禁言类型、目标、原因、创建时间和到期状态的完整摘要，刷新与停用按钮同步更新 `title` 和 `aria-label`；不改变禁言读取、停用或新增逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r85`。

- 管理后台聊天室治理按钮辅助标签优化：
  - 聊天记录编辑区的保存、隐藏/恢复、删除、按用户 ID 禁言和按 IP 来源禁言按钮会随未选择、忙碌和可操作状态同步更新悬停文本与辅助标签。
  - 只统一按钮状态提示，不改变聊天消息保存、隐藏/恢复、删除、禁言接口或权限逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r84`。

- 管理后台账号详情列表容器提示优化：
  - 账号详情中的登录履历、近期活跃和会话状态列表补充完整悬停文本与辅助标签，未选择账号时也能读到“选择账号后查看”。
  - 有账号详情时三块列表会标明记录数量，事件卡仍复用已有完整提示；不新增账号敏感字段，不展示密码哈希、session token 或完整明文 IP。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r83`。

- 管理后台账号列表整卡摘要优化：
  - 账号管理概览和账号列表容器补充动态悬停文本与辅助标签，空态明确提示暂无账号。
  - 每个账号卡片补充邮箱、角色、密码保存状态、活跃会话数、最近登录、登录次数和云存档数量的完整摘要，并用 `aria-pressed` 标识当前选中项；不展示密码哈希、session token 或完整 IP，也不改变账号读取、保存或权限逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r82`。

- 管理后台视频分类列表整卡摘要优化：
  - 视频分类管理列表容器补充动态悬停文本和辅助标签，空态明确提示暂无分类。
  - 每个分类卡片补充分类名、slug、启停状态、占用视频数量、删除前关联提示和排序值的完整摘要，并用 `aria-pressed` 标识当前选中项；不改变分类保存、启停、占用保护或删除逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r81`。

- 管理后台视频列表整卡摘要优化：
  - 视频管理列表容器补充动态悬停文本和辅助标签，空态明确提示暂无视频。
  - 每个视频卡片补充标题、状态、平台、排序、置顶状态、作者、发布时间、更新时间和元数据提示的完整摘要，并用 `aria-pressed` 标识当前选中项；不改变视频查询、保存、删除、置顶或元数据刷新逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r80`。

- 管理后台文章列表整卡摘要优化：
  - 知识库文章列表容器补充动态悬停文本和辅助标签，空态明确提示暂无文章。
  - 每篇文章卡片补充包含 slug、状态、分类、三语完整度、PV/UV 和更新时间的完整提示，并用 `aria-pressed` 标识当前选中项；不改变文章列表查询、详情读取、保存、发布或删除逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r79`。

- 管理后台聊天室消息卡片可读性优化：
  - 聊天记录列表容器补充动态悬停文本和辅助标签，空态会明确区分“暂无聊天记录”和“暂无可见聊天记录”。
  - 每条聊天消息卡片补充包含昵称、可见/隐藏状态、来源、时间和内容摘要的完整提示，并用 `aria-pressed` 标识当前选中项；不改变消息编辑、隐藏、删除或禁言接口。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r78`。

- 管理后台最近事件完整提示优化：
  - 点击埋点“最近点击”列表补充动态悬停文本和辅助标签，可直接确认事件数量与设备尺寸覆盖情况。
  - 最近点击、账号登录履历和近期活跃等事件卡片补充整体悬停文本、辅助标签和键盘焦点样式，长路径、来源地和设备尺寸在窄屏下仍可完整读取。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r77`。

- 管理后台 IP 前缀复制按钮优化：
  - 访问来源的省份 / 地区 / IP 来源表格在已脱敏 IP 前缀旁新增行内“复制”按钮，便于站长复制 masked 前缀做排查。
  - 未记录 IP 前缀的行明确显示“未记录”且不显示复制按钮，不暴露完整明文 IP，也不改变访问来源采集、聚合或脱敏规则。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r76`。

- 管理后台访问来源表格摘要优化：
  - 国家来源和省份 / 地区 / IP 来源表格滚动区同步补充动态悬停文本和辅助标签，空态也能明确读到“暂无数据”。
  - 地区来源标题栏补充 PV 合计，和国家来源、热门表格的摘要口径保持一致；不改变来源聚合、IP 前缀脱敏或地图点位逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r75`。

- 管理后台热门表格标题汇总优化：
  - 热门页面、热门文章和点击热点标题栏从单纯数量改为显示“共 N · PV/点击合计 X”，表格滚动区同步补充完整悬停文本和辅助标签。
  - 空表格行的空状态文字也补充完整悬停提示，不改变热门页面、热门文章、点击热点的查询字段、排序或统计口径。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r74`。

- 管理后台图表空状态提示优化：
  - 访问地图、每日 PV / UV 和今日小时走势在暂无数据时补充完整悬停文本和辅助标签，空状态文字也同步拥有完整提示。
  - 有数据时图表容器会提示当前数据点数量，不改变地图点位、柱状图、PV / UV 统计口径或概览接口结构。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r73`。

- 管理后台实时大屏 KPI 卡片提示优化：
  - 实时大屏 KPI 卡片补充完整悬停文本、辅助标签和键盘焦点样式，聚焦时可读到指标名、数值和统计说明。
  - 卡片仍直接读取后台概览数据，不改变 PV / UV / 点击 / 在线访客 / 聊天消息统计口径或接口结构。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r72`。

- 管理后台顶部状态栏完整提示优化：
  - 顶部刷新状态栏现在会同步写入完整悬停文本和辅助标签，长错误、读取、刷新和静态面板提示在窄屏或换行时也能完整确认。
  - 只调整后台状态展示，不改变自动刷新、手动刷新、静态面板、登出或接口读取逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r71`。

- 管理后台视频封面预览来源提示优化：
  - 视频管理封面预览标签会区分“本地封面预览 · 已压缩为站内数据”“站内封面预览”和“链接封面预览 · 来源域名”，加载失败时也保留来源提示并补充完整悬停文本。
  - 只优化后台预览标签，不改变本地封面压缩、首帧生成、封面字段保存、外链封面加载或视频元数据识别逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r70`。

- 管理后台视频分类删除状态提示优化：
  - 选择视频分类后，编辑区会根据 `video_count` 明确提示“已有 N 个视频使用，删除前请先取消关联”或“当前分类未被视频使用，可以直接删除”。
  - 提示只读取已加载分类数据，不改变分类删除接口、占用保护、排序、启停状态或默认分类 seed 规则。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r68`。

- 管理后台视频置顶排序提示优化：
  - 视频管理表单的“置顶排序”字段新增短提示，未置顶时说明需先勾选置顶，置顶后说明置顶队列按该数值从大到小排列。
  - 提示和字段 title 会随置顶勾选状态同步，不改变视频保存、发布、置顶队列排序值、分类或封面处理逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r67`。

- 管理后台文章三语校验提示优化：
  - 文章保存 / 发布前的三语必填校验从 `zh` / `en` / `ja` 代码提示改为“中文 / 英文 / 日文”中文提示，缺失时仍自动切到对应语言编辑区。
  - 只调整后台表单提示文案，不放宽 zh / en / ja 标题和正文必填规则，不改变文章保存、发布、删除或主站知识库展示逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r66`。

- 管理后台禁言类型中文标签优化：
  - 聊天室禁言列表中的 `visitor` / `ip_hash` 类型改为显示“用户 ID”“IP 来源”，减少接口字段直出带来的理解成本。
  - 仅调整后台列表标签文案，不改变禁言创建、停用、有效期、隐藏 visitor id / IP hash / IP 前缀展示边界或普通用户权限。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r65`。

- 管理后台账号列表标题汇总优化：
  - 账号管理标题栏从“已加载 N 个账号”改为“共 N 个 · 管理员 A · 活跃 S”，和账号摘要保持一致，便于快速确认管理员账号和活跃会话规模。
  - 汇总直接读取已加载账号列表，不新增接口、不展示密码哈希或明文密码、不改变账号保存、密码重置、角色校验或 admin 权限逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r64`。

- 管理后台聊天隐藏消息计数优化：
  - 聊天室管理在勾选“显示隐藏”后，聊天列表标题改为“含隐藏 N 条 · H 条隐藏”，便于区分可见消息和已隐藏消息的治理状态。
  - 默认可见视图仍只显示可见消息数量，不新增访客标识、IP hash、IP 前缀或聊天内容采集字段，也不改变隐藏/恢复、删除和禁言接口。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r63`。

- 管理后台文章列表状态汇总优化：
  - 知识库文章列表标题栏从单纯总数改为“共 N 篇 · 已发布 P · 三语完整 C”，便于同时检查发布状态和 zh / en / ja 内容完整度。
  - 汇总直接读取已加载文章列表，不新增接口、不改变文章保存、发布、删除、三语校验或主站知识库展示逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r62`。

- 管理后台访问来源表头汇总优化：
  - 国家来源标题栏改为显示“共 N 个国家 · PV X”，地区 / IP 来源标题栏改为显示“共 N 条 · M 条含 IP 前缀”，方便快速确认来源覆盖和掩码前缀记录情况。
  - 汇总只读取已加载访问来源数组，继续只展示掩码 IP 前缀，不暴露完整明文 IP、不改访问来源接口或统计口径。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r61`。

- 管理后台点击埋点设备尺寸展示优化：
  - 最近点击标题栏从单纯事件数改为“共 N 条 · M 条含尺寸”，便于判断点击事件是否带有设备宽高信息。
  - 最近点击详情补充页面、来源、目标路由和“设备 W × H / 设备尺寸未记录”，只展示后台概览已有点击字段，不采集输入内容或草稿内容。
  - `functions/api/[[route]].js` 的后台概览最近点击查询补回已有 `screen_width` / `screen_height` 字段，不改 D1 schema、不改变普通用户权限或埋点写入规则；后台 JS query 更新为 `20260618-admin-visual-r60`。

- 管理后台项目介绍边界标签优化：
  - 后台项目介绍面板新增“/admin/ 固定入口”“仅管理员可访问”“私有记录不进主站”边界标签，帮助快速确认后台入口、权限和更新记录隔离规则。
  - 标签复用现有后台状态样式，仅优化静态说明可读性，不修改主站页面、不新增公开 `site-updates` 内容、不改变权限校验。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r59`。

- 管理后台私有更新记录扫读优化：
  - 后台更新记录标题栏新增“共 N 条 · 最近 YYYY-MM-DD”状态提示，便于确认后台私有记录规模和最近记录日期。
  - 每条后台记录标题与正文复用现有安全文本写入方式并补充完整悬停文本，不新增后台记录、不写入主站 `site-updates`。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r58`。

- 管理后台视频分类状态汇总优化：
  - 视频分类列表标题从单纯总数改为“共 N 个 · 启用 E · 停用 D · 占用 O”，便于快速确认前台可用分类和仍被视频关联的分类。
  - 汇总直接读取已加载分类数组，不新增接口、不改变分类启停、排序、删除限制、视频关联或默认分类 seed 规则。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r57`。

- 管理后台视频列表状态汇总优化：
  - 视频管理列表标题从单纯总数改为“共 N 个 · 已发布 P · 隐藏 H · 置顶 T”，便于快速确认公开视频、隐藏视频和置顶队列规模。
  - 汇总直接读取已加载视频数组，不新增接口、不改变视频排序、置顶队列、保存发布、封面处理或视频链接白名单。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r56`。

- 管理后台禁言生效数量提示优化：
  - 聊天室管理的禁言列表标题从单纯总数改为“共 N 条 · M 条生效中”，便于站长快速区分历史禁言和仍在生效的治理记录。
  - 数量直接读取已加载禁言数组，不新增接口、不改变禁言停用、禁言条件、隐藏 visitor id / IP hash 展示或普通用户权限。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r55`。

- 管理后台聊天筛选数量提示优化：
  - 聊天室管理的聊天记录数量提示改为区分“可见 N 条消息”和“含隐藏 N 条消息”，管理员切换“显示隐藏”后能直接确认当前筛选口径。
  - 空状态同步区分“暂无可见聊天记录”和“暂无聊天记录”，不改变聊天列表接口、隐藏/恢复、删除、禁言或隐私字段展示边界。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r54`。

- 管理后台账号详情小面板提示优化：
  - 账号详情里的“登录履历”“近期活跃”“会话状态”标题补充悬停说明和辅助标签，解释每组记录对应来源、设备、访问活跃或会话有效期。
  - 计数仍读取已加载账号详情数组，不新增接口、不改变登录履历、会话状态、账号保存、密码重置或 admin 权限逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r53`。

- 管理后台账号列表数量提示优化：
  - 账号管理列表标题栏改为在数据读取后显示“已加载 N 个账号”，和文章、视频、分类、聊天列表的数量提示保持一致。
  - 数量直接读取已加载账号数组，不新增接口、不改变账号排序、详情读取、密码重置、角色保存或 admin 权限逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r52`。

- 管理后台账号摘要提示优化：
  - 账号管理顶部的注册账号、管理员、活跃会话摘要徽章补充同文本 `title`，窄屏换行或内容被压缩时可悬停核对完整统计含义。
  - 复用既有安全文本 helper，不新增接口、不改变账号列表读取、角色保存、密码重置、登录履历或 admin 权限逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r51`。

- 管理后台编辑标题全文提示优化：
  - 顶部当前面板标题、文章/视频/视频分类/账号编辑标题和聊天记录选中 ID 统一补充同文本 `title`，长 slug、长视频标题、长邮箱或长 message id 可悬停核对全文。
  - 复用既有安全 `textContent` helper，不新增 HTML 拼接，不改变面板切换、详情读取、保存、删除或权限逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r50`。

- 管理后台禁言列表扫描优化：
  - 聊天室管理的禁言列表标题栏新增当前禁言条数提示，刷新后可直接确认治理记录规模。
  - 禁言对象、原因和生效时间补充全文悬停提示，长 visitor id、IP hash 或禁言原因换行后仍可快速核对完整内容。
  - 本轮不改变禁言接口、禁言条件、停用流程、隐藏访客 ID / IP hash 隐私边界或普通用户权限。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r49`。

- 管理后台列表数量提示优化：
  - 文章列表、视频列表、视频分类列表和聊天记录标题栏新增当前条数提示，方便在列表为空、筛选隐藏消息或刷新后快速确认数据量。
  - 数量直接读取前端已加载数组长度，不新增接口、不改变列表排序、筛选、选择、保存或删除逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r48`。

- 管理后台长 URL 输入框显示优化：
  - 视频链接、播放器地址、封面地址等 URL / 只读输入框在失焦时使用省略号显示，减少长链接让表单看起来拥挤的问题。
  - 输入框聚焦后仍恢复正常可横向查看和编辑，不改变复制按钮、视频解析、封面保存或任何表单 payload。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r41`。

- 管理后台 admin 权限兜底收紧：
  - `/admin/*` 静态后台和 `/api/admin/*` 会话读取不再把站长邮箱白名单临时视作 admin，后台访问继续以 D1 `users.role = admin` 为唯一准入结果。
  - 保留账号管理里“站长账号必须保持 admin”的防降级提示和运行时写回 admin 角色的迁移保护；它们最终仍落到 `users.role = admin`，不作为访问旁路。
  - 同步更新后台专用上下文中的权限模型说明；本轮不新增接口、不改变登录表单、不放宽普通用户能力，也不触碰公开主站页面或 `site-updates`。

- 管理后台趋势图天数提示容错优化：
  - 每日 PV / UV 趋势标题在后端未返回 `windowDays` 时回退显示最近 14 天，避免出现“最近 undefined 天”。
  - 本轮只增强后台标题文案容错，不改趋势数据、PV/UV 聚合、后台接口字段或权限校验。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r47`。

- 管理后台长状态标签可读性优化：
  - 文章、聊天、账号等列表里的中性状态标签遇到很长分类、来源或位置文本时，改为在徽章内自然换行，避免单行截断过重。
  - 发布、隐藏、禁言、生效中等短状态徽章保持原有 XP 小标签视觉；本轮不改列表数据、权限校验、接口字段或排序逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r40`。

- 管理后台趋势图数量提示优化：
  - 实时大屏每日趋势和今日小时走势的标题辅助文字补充当前柱数，和热门表、访问来源、点击埋点数量提示保持一致。
  - 每日趋势显示“最近 N 天 · M 条”，小时走势显示“UTC 聚合 · M 个小时”，直接使用现有趋势数组长度。
  - 本轮不改变 PV/UV 统计口径、趋势聚合、图表高度计算或后台接口。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r46`。

- 管理后台访问地图点位语义优化：
  - 实时大屏访问地图点位补充 `aria-label`，键盘或辅助技术聚焦时可直接读到来源位置、PV 和 UV。
  - 地图点位下方的短标签补充同文本 `title`，国家缩写和访问数被截断时仍可悬停核对全文。
  - 本轮只增强后台地图点位展示语义，不改变地理聚合、PV/UV 口径、地图坐标兜底或 IP 隐私处理。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r45`。

- 管理后台实时大屏热门表数量提示优化：
  - 实时大屏的“热门页面”和“热门文章”标题辅助文字改为显示当前表格行数，和访问来源、点击埋点数量提示保持一致。
  - 数量提示直接使用现有 overview 返回的热门页面/文章数组长度，不改变 PV/UV 统计口径、热门排序或文章访问统计来源。
  - 本轮只调整后台标题展示与 JS query，不触碰主端页面、公开更新体系、D1 schema 或 admin 权限校验。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r44`。

- 管理后台点击热点目标提示优化：
  - 点击埋点的“点击热点”表格为目标文本和 route / key 小字补充全文 `title`，长按钮文案、埋点 key 或路由值可悬停核对。
  - 该改动只增强后台表格展示，不改变点击事件采集字段、点击数 / UV 统计口径、隐私处理或后台接口。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r43`。

- 管理后台来源与点击数量提示优化：
  - 访问来源和点击埋点面板的标题辅助文字改为显示当前数据条数，包括国家数、地区/IP 来源数、点击目标数和最近点击事件数。
  - 数量提示直接使用现有概览数据长度，不改变 PV/UV 统计口径、来源聚合、点击埋点字段或后台接口。
  - 本轮只调整后台标题展示与 JS query，不触碰主端页面、公开更新体系、D1 schema 或 admin 权限校验。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r42`。

- 管理后台账号详情数量提示优化：
  - 账号详情里的“登录履历”“近期活跃”“会话状态”三个小面板在有数据时会显示记录数量，便于快速判断账号活跃度和会话情况。
  - 空状态仍显示原有中文提示，不改变账号详情接口、登录履历字段、会话字段、密码安全边界或 admin 权限校验。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r41`。

- 管理后台视频链接复制按钮优化：
  - 视频管理表单新增“复制原链接”和“复制播放器”按钮，便于管理员核对 YouTube / Bilibili 原地址和服务端规范化生成的播放器地址。
  - 复制按钮只读取当前表单值，空值时仅在按钮上短暂提示“无内容”，不触发元数据抓取、不改视频保存 payload，也不放宽 iframe 白名单。
  - 本轮不改变视频 URL 解析、embed_url 生成、封面处理、公开视频接口或后台权限校验。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r40`。

- 管理后台 slug 复制按钮优化：
  - 知识库文章表单和视频分类表单的 Slug 字段旁新增“复制 slug”按钮，便于站长在编辑、核对链接和排查分类时快速复制当前标识。
  - 复制按钮只读取当前后台表单里的 slug 输入值；空值时仅在按钮上短暂提示“无内容”，不提交表单、不写入数据。
  - 本轮不改变文章 slug / 视频分类 slug 的保存校验、接口字段、公开视频路径或后台权限校验。
  - 390px 手机宽度下复测文章和视频分类两个面板，新增复制按钮未造成页面级横向溢出。
  - 更新 `admin/index.html` 的后台 CSS / JS query 为 `20260618-admin-visual-r39`。

- 管理后台列表项全文提示优化：
  - 文章、视频、视频分类、聊天室和账号列表的标题、摘要、聊天内容、时间和元数据错误提示补充同文本 `title`，长 slug、标题、邮箱、路径和错误摘要可悬停查看全文。
  - 新增轻量 `setElementText()` helper 统一设置安全 `textContent` 与提示，不改变列表 DOM 结构、排序、筛选、选择或数据写入逻辑。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r38`。

- 管理后台聊天审计信息复制优化：
  - 聊天室管理里选中消息后，隐藏用户 ID、前端 client id、IP hash、IP 前缀和来源信息旁新增后台内“复制”按钮，便于站长治理时核对禁言对象。
  - 复制按钮只作用于后台已经展示的隐藏 ID、hash、掩码前缀和来源摘要，不新增采集字段，不展示完整明文 IP，也不改变禁言接口。
  - 复制成功或失败仅在按钮自身显示短暂反馈，不写入日志、不改变聊天消息内容、不影响保存/隐藏/删除/禁言流程。
  - 更新 `admin/index.html` 的后台 CSS / JS query 为 `20260618-admin-visual-r37`。

- 管理后台平板与桌面横向溢出复测：
  - 使用 768px 平板宽度与 1365px 桌面宽度静态后台壳依次切换 10 个后台标签页，页面级 `scrollWidth` 与视口宽度一致。
  - 两个视口下均未发现非表格/图表内部的横向越界元素；本轮新增的状态提示、三语标签语义和全文 title 辅助未破坏中大屏布局。
  - 本轮不改代码，仅记录本轮视觉与可用性小改后的平板/桌面滚动边界验证结果。

- 管理后台手机端横向溢出复测：
  - 使用 390px 手机宽度静态后台壳依次切换 10 个后台标签页，页面级 `scrollWidth` 与视口宽度一致。
  - 实时大屏、访问来源、点击埋点、文章、视频、视频分类、聊天室、账号、后台更新记录和后台说明均未发现非表格/图表内部的横向越界元素。
  - 本轮不改代码，仅记录本轮视觉与可用性小改后的手机端滚动边界验证结果。

- 管理后台表格单元格全文提示优化：
  - 热门页面、热门文章、访问来源、点击热点等后台表格单元格补充同文本 `title`，路径、slug、IP 前缀、时间和数值可悬停查看全文。
  - 堆叠单元格会把主文本与副文本合并为提示，便于横向滚动表格中快速核对文章 slug、分类和页面 route。
  - 本轮只增强后台表格展示提示，不改变统计数据、PV/UV 口径、IP 隐私处理或表格排序。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r36`。

- 管理后台事件卡片全文提示优化：
  - 最近点击、账号登录履历、近期活跃、会话状态和后台更新记录等事件卡片的标题与明细补充同文本 `title`，长路径、设备摘要和来源信息可悬停查看全文。
  - 继续使用 `textContent` 安全渲染事件内容，不展示完整明文 IP，也不改变后台统计、账号或聊天接口返回字段。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r35`。

- 管理后台状态徽标全文提示优化：
  - 状态徽标继续使用安全 `textContent` 渲染，并补充同文本 `title`，长分类名、平台名、地区来源或状态信息被截断时可悬停查看全文。
  - 该改动只影响后台列表和卡片里的徽标提示，不改变文章、视频、分类、聊天室、禁言或账号数据字段。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r34`。

- 管理后台文章三语缺失提示修复：
  - 文章表单改为走后台自定义校验，避免隐藏的 English / 日本語 必填字段被浏览器原生 required 拦截后没有中文提示。
  - 保存或发布时继续由 `articlePayload()` 一次性校验 zh / en / ja 标题与正文，并新增空 slug 的中文提示。
  - 当某个语言标题或正文缺失时，后台会自动切到对应语言面板，方便管理员直接补齐。
  - 状态提示红色识别补充“请补齐 / 请填写 / 请等待”，让保存前缺失项和详情读取等待提示更醒目。
  - 本轮不改变文章提交字段、三语保存要求、发布状态、后台文章接口或 admin 权限校验；仅让既有校验提示稳定显示。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r33`。

- 管理后台侧边栏导航语义验证：
  - 审查侧边栏 10 个后台导航入口，确认当前标签页会通过 `applyActivePanel()` 同步视觉 active 状态和 `aria-current="page"`。
  - 初始实时大屏入口已带当前页语义，切换访问来源、点击埋点、文章、视频、聊天室、账号、后台更新记录和后台说明时会移除旧入口的当前页标记。
  - 本轮不改代码，仅记录导航语义边界验证；后台导航顺序、标签页加载、权限校验和主站页面保持不变。

- 管理后台三语编辑标签语义优化：
  - 知识库文章 zh / en / ja 三语编辑标签补齐 `role="tab"`、`aria-selected`、`aria-controls` 和面板 `hidden` 状态，当前语言和当前编辑面板更明确。
  - 三语标签支持左右方向键切换焦点与面板，减少长文编辑时反复用鼠标切换语言的操作成本。
  - 本轮不改变文章保存 payload、三语标题/正文必填校验、发布状态、文章接口或 admin 权限校验。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r31`。

- 管理后台顶部刷新状态优化：
  - 顶部“等待刷新 / 正在读取 / 已刷新 / 失败”状态条复用后台状态分类逻辑，读取中显示蓝色，错误或 HTTP 4xx/5xx 显示红色。
  - 状态分类同时识别常见英文错误提示（not found / forbidden / unauthorized / internal server error），避免本地静态壳或边缘错误落成普通提示。
  - 状态色只服务视觉提示，不改变实时大屏自动刷新、手动刷新、标签页按需加载、退出后台或 API 错误处理逻辑。
  - 本轮仍只调整后台 CSS/JS 和资源 query，不触碰主端页面、公开更新、后台接口或权限校验。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r29`、JS query 为 `20260618-admin-visual-r30`。

- 管理后台状态提示色彩优化：
  - 表单底部状态条根据现有中文提示自动区分处理中、错误和普通成功状态，处理中显示蓝色，失败/权限/缺失类提示显示红色，成功提示保持绿色。
  - 该辅助只观察已有 `.form-status` 文本并切换展示 class，不改变保存、发布、删除、禁言、刷新元数据或账号保存的请求流程。
  - 忙碌态只匹配“正在 / 读取中 / 保存中 / 发布中”等明确进行中提示，避免“识别完成”“已生成播放器地址”这类成功提示被误判。
  - 后台仍只使用中文提示，不新增公开更新、不写入主站 `site-updates`，也不改变任何 admin 权限校验。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r27`、JS query 为 `20260618-admin-visual-r28`。

- 管理后台列表锁定态视觉优化：
  - 文章、视频、视频分类、聊天室和账号列表项在保存、删除、详情读取或刷新期间增加浅蓝斜纹禁用态，避免管理员误以为列表仍可切换。
  - 禁用态保留文字可读性、状态徽标和当前选中轮廓，只通过光标、边框和背景提示正在锁定。
  - 本轮只复用现有 `disabled` 状态做 CSS 呈现，不改变列表选择、数据写入、接口调用或 admin 权限校验。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r26`。

- 管理后台公开更新边界验证：
  - 搜索 `functions/api/[[route]].js`、`cloudflare/schema.sql`、`js/main.js`、`index.html`、后台页面和后台私有 changelog，确认本线程新增的后台视觉改版记录没有写入主站 `site-updates` seed、首页最近更新 fallback 或公开页面。
  - 本线程当前仍只在根 `CHANGELOG.md` 追加循环记录；后台私有更新记录等待循环结束后再合并成 1 条。
  - 本轮不改代码，仅记录公开更新边界验证结果；主端页面、主端资源、公开 API 和 D1 schema 保持不变。

- 管理后台表单锁定态视觉优化：
  - 后台输入框、文本域、下拉框在禁用或读取中时增加浅蓝斜纹锁定态，减少保存、读取详情、刷新元数据期间“字段为什么不能编辑”的误判。
  - 视频分类 fieldset 在元数据读取、保存或删除期间同步显示忙碌背景，和按钮忙碌态形成统一反馈。
  - 本轮只复用现有 disabled / `aria-busy` 状态做 CSS 呈现，不改变文章、视频、分类、聊天或账号的锁定逻辑、数据提交或权限校验。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r24`。

- 管理后台平板与桌面横向溢出验证：
  - 使用本地静态后台壳和系统 Chrome，在 768px 平板宽度与 1365px 桌面宽度下依次切换 10 个后台标签页。
  - 两个视口下所有后台标签页的页面级 `scrollWidth` 均等于视口宽度，未发现非表格/图表内部的横向溢出元素。
  - 本轮不改代码，仅记录平板和桌面滚动边界验证结果；后台权限、接口、数据读取和主站公开更新体系保持不变。

- 管理后台移动端横向溢出验证：
  - 使用本地静态后台壳和系统 Chrome，在 390px 手机宽度下依次切换实时大屏、访问来源、点击埋点、知识库文章、视频管理、视频分类管理、聊天室管理、账号管理、后台更新记录和后台说明。
  - 10 个后台标签页的页面级 `scrollWidth` 均等于视口宽度，未发现非表格/图表内部的横向溢出元素。
  - 本轮不改代码，仅记录移动端滚动边界验证结果；后台权限、接口、数据读取和主站公开更新体系保持不变。

- 管理后台说明与私有更新页阅读优化：
  - 后台项目介绍限制正文行宽并补齐长文本换行，减少说明页在宽屏上拉得过长。
  - 后台更新记录列表增加间距、标题蓝色层级和正文行高，便于阅读较长的后台私有更新说明。
  - 本轮只调整后台 CSS 和资源版本号，不新增后台私有更新记录，不写入主站 `site-updates`，也不改变后台更新记录数据来源。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r21`。

- 管理后台表单小控件可读性优化：
  - 后台表单里的“置顶”“启用”等复选框行增加浅色操作块边界，和普通字段标签区分更明显。
  - 排序、置顶排序、禁言时长和发布时间等数字/日期输入改用等宽数字，便于核对顺序与时间。
  - 下拉选择保留原有样式并补齐可点击光标；复选框使用后台蓝色强调色。
  - 本轮只调整后台 CSS 和资源版本号，不改变文章三语校验、视频排序语义、发布时间转换、禁言时长或权限校验。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r20`。

- 管理后台面板标题栏换行优化：
  - 后台各面板标题栏允许标题、说明、按钮和小筛选控件自然换行，减少窄屏或长标题下互相挤压。
  - 标题、说明文字补齐最小宽度和长文本换行；标题栏内的“新建”“刷新”和“显示隐藏”等控件保留清晰边界。
  - 本轮只调整后台 CSS 和资源版本号，不改变导航顺序、筛选逻辑、列表刷新、数据接口或权限校验。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r19`。

- 管理后台手机顶部工具区空白修复：
  - 修复手机端顶部工具区继承桌面 `flex-basis` 后在刷新状态和按钮之间留下大块空白的问题。
  - 顶部工具区现在按内容高度收缩，三列按钮仍保持紧凑排列，实时大屏首屏能更早露出数据区域。
  - 本轮只调整后台移动端 CSS 和资源版本号，不改变刷新、回到顶部、退出后台或权限校验逻辑。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r18`。

- 管理后台手机顶部工具区优化：
  - 手机端顶部栏的“刷新 / 顶部 / 退出”按钮由全宽堆叠改为三列紧凑工具栏，减少实时大屏标题区占屏高度。
  - 刷新状态提示仍独占一行并保留 aria-live，不影响刷新状态、回到顶部或退出后台的原有交互。
  - 本轮只调整后台移动端 CSS 和资源版本号，不改变刷新逻辑、退出逻辑、后台数据读取或权限校验。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r17`。

- 管理后台手机导航占屏优化：
  - 根据静态手机截图检查结果，将 520px 以下后台导航从单列改为两列紧凑网格，减少侧边栏在手机首屏占用的高度。
  - 后台更新记录和后台说明入口更容易在手机导航首屏内出现，仍保留 XP 按钮样式、焦点和点击区域。
  - 本轮只调整后台移动端 CSS 和资源版本号，不改变导航顺序、后台入口、权限校验或任何后台数据读取。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r16`。

- 管理后台说明与摘要提示块优化：
  - 实时大屏统计说明、账号安全提示和账号摘要块增加统一的左侧蓝色提示边与内阴影，后台说明类信息更容易和普通正文区分。
  - 账号摘要芯片补齐等宽数字、换行和最小宽度约束，账号总数、管理员数和活跃会话数更便于横向扫读。
  - 本轮只调整后台 CSS 和资源版本号，不改变账号数据读取、密码安全边界、统计说明文案或权限校验。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r15`。

- 管理后台宽表格滚动可用性优化：
  - 热门页面、热门文章、国家来源、省份地区/IP 来源和点击热点五个宽表格滚动区补齐键盘焦点入口与中文 aria 标签。
  - 表格滚动区聚焦时会显示 XP 风格焦点边框，方便键盘用户定位当前横向滚动区域。
  - 本轮只调整后台 HTML 语义、CSS 焦点样式和资源版本号，不改变表格数据、排序、统计口径或权限校验。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r14`。

- 管理后台实时大屏扫描优化：
  - 实时大屏 KPI 数字改为更清晰的蓝色等宽数字，标签层级更明确，便于快速扫读 PV、UV、点击和聊天数。
  - 每日趋势和小时趋势条增加键盘聚焦能力与 `aria-label`，聚焦或悬停时可明确对应时间段的 PV / UV，不只依赖鼠标悬停标题。
  - 访问地图点位补齐指针和键盘焦点样式，查看来源点位时更容易定位当前焦点。
  - 本轮只调整后台 CSS、趋势条 DOM 辅助属性和资源版本号，不改变统计接口、PV/UV 口径、地理聚合或隐私字段。
  - 更新 `admin/index.html` 的后台 CSS / JS query 为 `20260618-admin-visual-r13`。

- 管理后台视频封面工具区优化：
  - 视频管理的本地封面上传、从本地视频截首帧和清空封面操作区增加后台工具组边界，和普通输入字段区分更明显。
  - 文件选择按钮补齐悬停与键盘焦点样式，封面说明文字改为提示块，封面预览空状态增加稳定高度和长文本换行。
  - 本轮只调整后台 CSS 和资源版本号，不改变视频链接白名单、封面 data URL 校验、首帧生成逻辑、元数据抓取或后台权限校验。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r12`。

- 管理后台长标识展示优化：
  - 聊天审计信息、账号登录履历、账号近期活跃、会话记录、最近点击和禁言记录的卡片补齐栅格间距、长文本换行和最小宽度约束。
  - 聊天记录详情里的隐藏用户 ID、前端 client id、IP hash、IP 前缀和来源信息改为更清晰的分块展示，减少长标识撑破编辑区。
  - 禁言列表的“停用”按钮固定在卡片左侧起点，避免和长 visitor id / IP hash 挤在同一视觉行。
  - 本轮只调整后台 CSS 和资源版本号，不改变后台可见字段、隐私边界、禁言接口或账号管理接口。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r11`。

- 管理后台筛选与徽标可读性优化：
  - 三语文章编辑标签增加 XP 选中边界和焦点状态，当前语言面板更容易辨认。
  - 视频分类勾选区改为更稳定的后台筛选块样式，已选分类在现代浏览器中会有轻量高亮；停用分类仍保留原有禁用语义。
  - 列表状态徽标和 meta 行补齐最小宽度、换行和对齐约束，减少文章、视频、分类、聊天、账号列表在窄列里的挤压。
  - 本轮只调整后台 CSS 和资源版本号，不改变分类关联、文章三语校验、列表排序或权限校验。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r10`。

- 管理后台空状态提示优化：
  - 后台空列表、空表格和暂无数据提示增加统一的像素提示符、稳定行高和换行边界，访问来源、点击埋点、文章/视频/聊天室/账号等模块在无数据时更容易被识别。
  - 表格空状态改为内联弹性提示块，避免长中文提示压到表格边缘，同时继续使用安全 DOM 文本渲染。
  - 本轮只调整后台 CSS 和资源版本号，不改变空数据判断、接口返回、统计口径或权限校验。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r9`。

- 管理后台操作反馈视觉优化：
  - 后台保存、发布、删除、刷新、获取元数据等已进入处理中的按钮，现在会统一显示像素条纹忙碌态和小方块状态点，减少长表单里“点了没反应”的误判。
  - 表单底部状态提示改为更清晰的状态条样式，空状态提示不再占用多余操作区宽度，移动端按钮换行更稳定。
  - 本轮只复用已有 `aria-busy` 状态做视觉呈现，不新增接口请求、不改变文章/视频/聊天室/账号保存逻辑，也不削弱后台权限校验。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r8`。

- 管理后台回到顶部交互补强：
  - “顶部”按钮现在会同时重置当前后台标签页里的表单、列表、禁言列表、事件列表、更新记录和表格滚动容器，不只滚动外层页面。
  - 横向滚动过的表格也会回到左侧起点，方便访问来源和点击埋点表格查看完右侧时间列后快速回到路径/目标列。
  - 继续尊重 `prefers-reduced-motion`；本轮只调整后台前端滚动行为，不改变数据读取、写入或权限校验。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260618-admin-visual-r7`。

- 管理后台数据表格扫描优化：
  - 实时大屏、热门页面、热门文章、访问来源和点击埋点表格的 PV/UV/点击数值列改为等宽数字并右对齐，便于快速比较大小。
  - 最近访问时间列增加稳定宽度和等宽数字，路径、路由和 IP 前缀列增加更清晰的文本呈现，减少数据表格在横向滚动时的视觉跳动。
  - 仅为后台表格 DOM 增加展示 class 和 CSS，不改变统计接口、数据口径、隐私字段或排序逻辑。
  - 更新 `admin/index.html` 的后台 CSS / JS query 为 `20260618-admin-visual-r6`。

- 管理后台入口视觉截图验证：
  - 使用本地 Cloudflare Pages 预览和 Playwright 截图检查 `/admin/` 未登录入口，在 1365x900 桌面宽度和 390x844 手机宽度下，登录面板、状态角标、输入框、按钮和安全提示均未出现重叠或横向溢出。
  - 截图验证只覆盖未登录后台入口，不提交账号、不读取后台数据；验证后已停止本地预览服务并清理临时 `output/playwright` 产物。
  - 本轮不改代码，仅补充验证记录；后台权限、接口、D1 schema 和主站公开更新体系保持不变。

- 管理后台编辑表单可读性优化：
  - 后台表单新增聚焦态提示，站长在密集编辑文章、视频、分类、聊天和账号字段时更容易看出当前输入位置。
  - 只读字段使用更明确的浅蓝灰底色，便于区分平台、视频 ID、播放器地址、密码状态等不可直接编辑的信息。
  - 三语文章正文 Markdown 编辑区加高并使用等宽优先字体，长文编辑时更容易阅读段落、列表和代码片段。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r4`；本轮不改接口、权限或数据保存逻辑。

- 管理后台长页操作效率优化：
  - 顶部工具区新增“顶部”按钮，长文章编辑、视频管理、聊天室治理和账号详情页滚动到底部后可一键回到后台页面顶部。
  - 滚动行为尊重 `prefers-reduced-motion`，减少动态模式下直接跳转；普通模式使用平滑滚动。
  - 仅新增后台前端按钮、样式和点击事件，不读取、不提交、不暴露任何后台数据，也不改变后台接口或权限校验。
  - 更新 `admin/index.html` 的后台 CSS / JS query 为 `20260618-admin-visual-r3`。

- 管理后台访问状态页视觉改版：
  - 优化 `/admin/` 未登录和非 admin 拒绝访问时的状态页面，补齐 XP 风格面板、状态角标、访问说明、移动端宽度和提交中按钮锁定反馈。
  - 登录失败或网络异常会恢复按钮并显示中文状态提示，登录成功后仍走原有 `/api/auth/login` 和页面重载流程。
  - 仅调整 `functions/admin/_middleware.js` 返回的后台入口状态展示，未改变 `lusu_session`、`users.role = admin`、OWNER_ADMIN_EMAILS 兜底或 `/api/admin/*` 服务端权限校验。
  - 本轮仍不写入主站 `site-updates`，也不新增后台私有更新记录，等待本线程循环结束后合并成 1 条后台更新记录。

- 管理后台视觉改版第一轮：
  - 仅调整 `/admin/` 后台视觉与滚动边界，未触碰主端页面、主端资源、后台权限、后台接口或 D1 schema。
  - 优化实时大屏 KPI 卡片字号与栅格，减少中等宽度下拥挤和数字挤压。
  - 优化后台表格横向滚动、表头可读性、列表长文本换行、状态标签截断和表单状态提示盒，提升访问来源、点击埋点、文章/视频/账号/聊天室列表的扫描效率。
  - 优化移动端侧边栏导航滚动、顶部栏按钮换行和表单底部操作区边界，降低手机后台首屏被导航挤占和操作提示贴边的问题。
  - 更新 `admin/index.html` 的后台 CSS query 为 `20260618-admin-visual-r1`；后台私有更新记录本轮暂不新增，等待本线程循环结束后合并成 1 条。

- 主端页面视觉改版第一轮：
  - 在独立 `feature/main-visual-polish-cycle` 工作树中执行，避开并行后台线程的 `admin/`、后台接口和 D1 schema 改动。
  - 欢迎弹窗桌面宽度与最近更新栏略放宽，减轻三语标题和最近更新摘要的拥挤感，移动端仍保持单栏弹窗。
  - 匿名聊天室窗口改为受任务栏安全区约束的网格高度，桌面端消息区自动收缩，避免输入区和底部提示被任务栏遮挡。
  - 视频区加载/失败提示补齐 XP 风格空状态容器，资源卡片和游戏卡片的按钮宽度、间距与对齐方式更统一。
  - 本轮只更新 `CHANGELOG.md`，暂不新增主站 `site-updates` 文章；等待本线程循环结束后统一合并成 1 篇三语更新文章。

- 主端页面视觉改版第二轮：
  - 修复移动端知识库分类栏被网格拉成高竖条的问题，分类按钮恢复为横向 XP 胶囊入口，文章失败/空状态回到更靠上的内容区。
  - 收紧移动端关于我窗口头像区高度和头像显示尺寸，让资料字段与简介更早出现在首屏内。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r2`；仍未触碰后台目录、后台接口、D1 schema 或主站更新文章 seed。

- 主端页面视觉改版第三轮：
  - 游戏区移动端卡片从纯纵向堆叠改为封面与标题简介并排、启动按钮独占底行，减少单张游戏卡首屏占用。
  - 保持游戏入口、语言支持标签、来源链接和云存档标记不变，只调整移动端卡片网格和封面尺寸。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r3`。

- 主端页面视觉改版第四轮：
  - 视频区“正在读取”和“读取失败”从普通文字条改为与视频空状态一致的 XP 风格状态面板，补齐图标、标题和统一边框背景。
  - 状态面板继续使用 DOM / `textContent` 构建，不改变公开视频接口、分类筛选、播放器打开或外链按钮逻辑。
  - 更新 `index.html` 的 CSS / JS query 为 `20260618-main-visual-polish-r4`。

- 主端页面视觉改版第五轮：
  - 移动端视频区和资源区筛选栏改为单行横向滚动胶囊栏，避免资源分类按钮换成多行后占用过多首屏高度。
  - 筛选按钮保持 XP 风格、数量徽标和原有筛选逻辑不变，长分类名在按钮内省略显示。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r5`。

- 主端页面视觉改版第六轮：
  - 移动端欢迎窗的最近更新面板改为标题、更新列表、操作按钮三段式布局，限制列表高度，减少“查看更多更新 / RSS”按钮被长列表推到很深的位置。
  - 保持最近更新读取逻辑、文章链接、RSS 链接和三语文案不变，只调整移动端面板高度与内部布局。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r6`。

- 主端页面视觉改版第七轮：
  - 使用 320px 窄屏复查顶部栏、欢迎窗、资源区、游戏区、聊天室和关于我窗口，继续保持无横向溢出。
  - 修复窄屏聊天室底部提示和自动滚动开关被任务栏压住的问题，降低聊天室窗口最大高度、消息区最小高度和输入框最小高度。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r7`。

- 主端页面视觉改版第八轮：
  - 累计回归发现移动端知识库、视频区、资源区、游戏区和杂谈区普通窗口会延伸到任务栏后面，存在底部内容被遮挡风险。
  - 统一收紧这些普通窗口的移动端高度，并同步文章阅读态知识库窗口高度，让窗口底部和任务栏之间保留安全间距。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r8`。

- 主端页面视觉改版第九轮：
  - 使用 320px 窄屏按中文 / English / 日本語 复查资源区、游戏区、聊天室和关于我窗口，确认横向滚动只发生在资源筛选栏内部，页面本身无横向溢出。
  - 为移动端视频区和资源区横向筛选栏补充右侧内阴影提示，让可横向滑动的分类入口更容易被发现。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r9`。

- 主端页面视觉改版第十轮：
  - 桌面端视频区、资源区和杂谈区窗口底部原本几乎贴住任务栏，本轮小幅收紧窗口高度，保留更清楚的桌面安全缝隙。
  - 视频区保留较宽窗口和内部滚动，资源区、杂谈区继续沿用原有窗口结构，不改变卡片渲染或数据读取逻辑。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r10`。

- 主端页面视觉改版第十一轮：
  - 知识库文章列表里的读取中/读取失败提示改为更完整的 XP 状态面板，补齐图标、统一浅蓝背景和更稳定的高度。
  - 只调整 `content-list` 内的状态提示样式，不改变文章接口、搜索、分类筛选、详情读取或 Markdown 安全渲染。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r11`。

- 主端页面视觉改版第十二轮：
  - 复查移动端右上角账号入口，发现窄屏顶部栏变成两行后，账号弹窗仍按旧高度展开并覆盖语言按钮。
  - 在 460px 以下提高账号弹窗顶部定位并同步收紧最大高度，确保登录/注册弹窗从顶部栏下方展开。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r12`。

- 主端页面视觉改版第十三轮：
  - 为知识库列表、视频列表、资源列表、杂谈纸张、游戏列表、文章详情、欢迎窗和视频弹窗补充统一的 XP 风格滚动条颜色与滑块样式。
  - 保持任务栏、筛选栏和横向分类栏的隐藏滚动条策略不变，避免移动端横向胶囊栏露出原生滚动条。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r13`。

- 主端页面视觉改版第十七轮：
  - 复查游戏区移动端和桌面端窗口高度，发现游戏列表内容由外层窗口隐式承接滚动，容易被检测为窗口内容溢出。
  - 将游戏区 XP 窗口整理为纵向弹性布局，让 `game-list` 明确接管内部滚动，三语窄屏下保持窗口不撑破、页面不横向溢出。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r17`。

- 主端页面视觉改版第十八轮：
  - 复查首页欢迎弹窗窄屏表现，发现窗口高度几乎贴满视口底部，和其他移动端 XP 窗口的安全留白不一致。
  - 仅收紧移动端欢迎弹窗最大高度，让弹窗底部保留可见留白；最近更新操作区仍可通过弹窗内部滚动完整访问。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r18`。

- 主端页面视觉改版第二十二轮：
  - 复查资源区卡片和横向分类栏，发现 320px 日文界面下有资源标题被两行限制截断。
  - 移动端资源卡片标题放宽到三行并允许长词换行，保留桌面端卡片密度、按钮对齐和筛选栏内部横向滚动策略。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r22`。

- 主端页面视觉改版第二十八轮：
  - 全局回归扫描 320px、390px、760px 和桌面宽度，发现 760px 边界下普通窗口底部安全缝隙偏小，聊天室会轻微压到任务栏。
  - 收紧移动断点下知识库、视频区、资源区、游戏区、杂谈区窗口高度，并降低中等移动宽度聊天室消息区最小高度，恢复 18px 以上任务栏安全间距。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r28`。

- 主端页面视觉改版第三十二轮：
  - 增补手机横屏/短视口检查，发现 844x390 下知识库沿用桌面最小高度，740px 以下短高度里聊天室和关于我窗口会压进任务栏。
  - 新增短视口专属媒体查询：宽屏短高度只取消知识库最小高度，窄屏短高度只收紧聊天室和关于我窗口高度，避免影响正常竖屏布局。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r32`。

- 主端页面视觉改版第三十三轮：
  - 复查游戏区 catalog 读取失败态，发现 `game-list` 里的加载/失败文字未纳入统一 XP 状态面板样式。
  - 将游戏列表加载/失败提示接入与视频、卡片网格一致的浅蓝状态面板，保持目录读取、游戏入口和云存档逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r33`。

- 主端页面视觉改版第三十四轮：
  - 复查右上角账号入口，发现桌面端账号弹窗边框会与顶栏产生约 5px 重叠。
  - 仅将桌面端账号弹窗下移，移动端固定定位和登录/注册逻辑保持不变，三语表单仍完整可见。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r34`。

- 主端页面视觉改版第三十六轮：
  - 复查视频弹窗最大化状态，发现移动端和短横屏下最大化窗口底部会轻微超出视口。
  - 收紧移动断点下视频最大化窗口高度，让播放器、外链按钮和窗口边框完整留在视口内；桌面最大化规则和视频播放逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r36`。

- 主端页面视觉改版第三十九轮：
  - 复查游戏区 catalog 读取失败态，发现桌面端失败面板会让游戏窗口塌到约 204px 高，和正常游戏列表窗口观感不一致。
  - 为桌面游戏区窗口补充自适应最小高度，失败态和空态也能保留 XP 窗口的完整桌面体量；移动端和短视口仍按已有安全高度收缩。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r39`。

- 主端页面视觉改版第四十轮：
  - 截图复查 390px 日文首页，发现桌面图标在单列排列时把底部“杂谈/Blog”入口推到任务栏边缘，首屏观感像被切掉。
  - 620px 以下首页入口改为更紧凑的两列桌面图标阵列，轻微缩小图标视觉体量和标题行高，保持路由、按钮和图标资源不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r40`。

- 主端页面视觉改版第四十一轮：
  - 用临时文章数据复查文章详情页，发现移动端首屏被目录和“小贴士”占用过多，正文阅读卡片要滚到任务栏附近才出现。
  - 压缩移动端文章目录按钮、限制目录列表高度，并在窄屏隐藏“小贴士”说明；同时上移“回到顶部”按钮，和阅读进度条保留更清楚的间距。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r41`。

- 主端页面视觉改版第四十三轮：
  - 模拟已登录长邮箱账号复查右上角账号入口，发现 320px 日文界面顶部栏变为三行后，账号弹窗仍按两行高度展开并压住语言切换行。
  - 为 360px 以下极窄屏单独下移账号弹窗并收紧最大高度，未登录表单、已登录退出面板和账号接口逻辑保持不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r43`。

- 主端页面视觉改版第四十四轮：
  - 复查 2048 游戏外壳，发现 320px 日文界面里本地存档工具、云存档提示和协议栏把游戏 iframe 推到首屏较低位置。
  - 仅压缩移动端游戏外壳工具区：隐藏重复的说明段落、让下载/导入按钮并排、缩短协议栏高度并保留状态提示，游戏 iframe、存档导入导出和云存档逻辑不变。
  - 本轮只修改 `games/game-shell.css`，没有改动各游戏源代码、游戏存档逻辑或主站后台接口。

- 主端页面视觉改版第四十六轮：
  - 用临时长昵称和长消息复查匿名聊天室，发现 760px 宽度下消息区和输入区叠加后窗口底部会轻微压进任务栏。
  - 仅收紧移动断点下聊天室窗口最大高度，320px / 390px 的窄屏专属规则和消息 DOM / `textContent` 安全渲染逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r46`。

- 主端页面视觉改版第四十七轮：
  - 用较长最近更新列表复查欢迎弹窗，发现移动端和短横屏下弹窗底部会落到任务栏后面，长列表时底部操作区更容易被遮住。
  - 收紧 760px 以下欢迎弹窗最大高度，为 460px 以下和低高度横屏保留单独高度，让弹窗底边停在任务栏上方；最近更新列表和快捷入口继续通过弹窗内部滚动访问。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r47`。

- 主端页面视觉改版第五十轮：
  - 复查 320px 已登录长邮箱状态，发现顶部栏变高后首页最后一行桌面图标与任务栏只剩几像素间隙。
  - 在 360px 以下进一步压缩首页桌面图标尺寸、间距和标题字号，确保未登录与已登录长邮箱状态下入口都完整露出。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r50`。

- 主端页面视觉改版第五十一轮：
  - 复查 320px 文章阅读页，发现阅读进度条距离任务栏偏高，固定浮层会遮住更多标题和正文内容。
  - 在 460px 以下同步下移阅读进度条和“回到顶部”按钮，保留任务栏安全间隙和两个浮层之间的距离；文章 Markdown 渲染、目录、复制链接逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r51`。

- 主端页面视觉改版第五十二轮：
  - 回归第五十一轮后，发现 320px/390px 文章页的“回到顶部”按钮与阅读进度条间距过窄。
  - 微调 460px 以下“回到顶部”按钮位置，让浮层之间保持清晰间隔，同时继续避开底部任务栏。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r52`。

- 主端页面视觉改版第五十三轮：
  - 复查右上角账号入口，发现 760px 平板宽度下登录浮窗被拉成整行宽度，表单与按钮显得过大。
  - 将 760px 以下账号浮窗收束为贴右的小窗口，小屏仍按安全宽度自适应；登录、注册、登出与接口调用逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r53`。

- 主端页面视觉改版第五十四轮：
  - 复查视频播放器弹窗，发现 844×390 等短高横屏下普通播放器 iframe 按 16:9 撑高，导致动作栏落入内部滚动区并压近任务栏。
  - 在 460px 以下短高横屏中让普通视频弹窗改为固定高度 flex 列，播放器区域吃剩余空间，动作按钮保持可见；竖屏播放器和最大化模式不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r54`。

- 主端页面视觉改版第五十五轮：
  - 回归第五十四轮后，发现 760×390 下任务栏更高，普通视频弹窗底部仍会压入任务栏区域。
  - 进一步收紧 760px 以下短高横屏的视频弹窗高度，保留播放器可视面积与动作按钮位置；普通竖屏、桌面宽屏和最大化模式不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r55`。

- 主端页面视觉改版第五十六轮：
  - 抽查知识库接口失败态时，发现列表状态徽章显示成过小方块，和视频、游戏区的 XP 状态面板不统一。
  - 将知识库列表 `loading-text` 徽章改为清晰像素感感叹号，补齐字号、字重和高亮阴影；加载/失败文案与数据读取逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r56`。

- 主端页面视觉改版第五十七轮：
  - 抽查资源区移动端，发现 320px 下资源卡片在 grid 行高中互相压叠，按钮会覆盖下一张卡标题。
  - 将资源列表改为稳定的纵向 flex 堆叠，并清理列表内资源卡片旧外边距，交由列表 gap 控制间距；资源内容、分类和下载/占位按钮逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r57`。

- 主端页面视觉改版第五十八轮：
  - 回归第五十七轮后，发现资源卡片作为 flex 子项会默认收缩，导致正文和“准备中”按钮溢出卡片边界。
  - 将资源列表内卡片设为不收缩，让卡片高度随三语内容自然撑开；资源列表仍保持内部滚动。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r58`。

- 主端页面视觉改版第五十九轮：
  - 用同样量尺检查游戏区，发现移动端游戏卡片固定在 108px 高，语言支持标签和“开始游戏”按钮会溢出并压到下一张卡。
  - 将游戏列表改为纵向 flex 堆叠，并让游戏卡片不收缩，保留原有游戏入口、云存档和语言标签渲染逻辑。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r59`。

- 主端页面视觉改版第六十轮：
  - 复查关于我窗口，发现 760×390 与 844×390 短高横屏下资料卡被压缩为内部滚动，资料正文容易被隐藏。
  - 在 460px 以下短高场景改为由整个关于我窗口滚动，资料卡自然撑开；普通竖屏和桌面高度排版不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r60`。

- 主端页面视觉改版第六十一轮：
  - 回归欢迎弹窗尺寸，发现 760px 宽度下窗口底部与任务栏仍有约 1px 贴边。
  - 略微收紧 760px 以下、460px 以上区间的欢迎窗最大高度，保留内容内部滚动，避免压线到任务栏。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r61`。

- 主端页面视觉改版第六十二轮：
  - 复查首页桌面图标，发现 760px 宽度和 844×390 短横屏下图标阵列过高，底部入口会被任务栏切掉。
  - 为 621-760px 增加四列紧凑图标布局，并为短高横屏压缩首页标题与图标尺寸，保留 XP 桌面入口、路由和图标资源不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r62`。

- 主端页面视觉改版第六十三轮：
  - 回归第六十二轮后，发现 844×390 下首页图标与任务栏只剩约 11px 缝隙，略低于本轮安全阈值。
  - 将短高横屏首页图标阵列上移 2px，补足任务栏安全间距；普通桌面、760px 宽度和 320/390 手机布局不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r63`。

- 主端页面视觉改版第六十四轮：
  - 使用假数据压测匿名聊天室长昵称、长英文单词、多行消息和三语界面，确认消息与昵称仍通过文本节点渲染，不改真实聊天接口。
  - 修复 320px 窄屏和 760px 平板宽度下消息列表最小高度过硬、与输入区发生轻微挤压的问题，聊天日志高度改为随视口收缩。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r64`。

- 主端页面视觉改版第六十五轮：
  - 使用假视频数据压测超长分类名、超长英文标题和长作者名，发现视频筛选按钮和视频卡片标题在极端文本下会出现内部溢出。
  - 为视频筛选按钮补充文本节点容器和省略显示，并让视频/资源标题与视频作者信息允许长词换行；公开视频接口、播放器和分类筛选逻辑不变。
  - 更新 `index.html` 的 CSS / JS query 为 `20260618-main-visual-polish-r65`。

- 主端页面视觉改版第六十六轮：
  - 使用假长文复查知识库文章详情，发现极长英文标题和 Markdown 二级标题会把文章卡片撑出横向滚动。
  - 为文章详情标题、摘要和 Markdown 标题补充长词换行，并收紧短横屏文章阅读窗口高度，保留代码块内部横向滚动、目录、复制链接和阅读进度逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r66`。

- 主端页面视觉改版第六十七轮：
  - 复查 2048 游戏外壳，发现 760/844px 短横屏下工具区按移动端单列堆叠，导致游戏 iframe 首屏起点过低。
  - 为平板短横屏增加紧凑工具栏规则，隐藏重复说明、压缩云存档面板和协议栏，并防止日文工具标题被挤成竖排；游戏本体、导入导出和云存档逻辑不变。
  - 本轮只修改 `games/game-shell.css`，没有改动各游戏入口页、游戏源代码或后台接口。

- 主端页面视觉改版第六十八轮：
  - 使用长更新列表复查首页欢迎弹窗，发现 320/390px 下弹窗底部几乎贴住任务栏，最近更新列表在长标题时会被隐藏裁切。
  - 收紧极窄屏欢迎窗最大高度，并让移动端最近更新列表改为内部滚动；欢迎入口、RSS 链接和最近更新读取逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r68`。

- 主端页面视觉改版第六十九轮：
  - 复查首页桌面与任务栏，发现宽屏桌面图标两列四行会把底部头像入口压进任务栏，621px 边界任务栏最后按钮会横向露出。
  - 将宽屏首页桌面图标改为三列，缩短图标阵列高度；621-760px 任务栏标签保留内部横向滚动并增加右侧安全内距。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r69`。

- 主端页面视觉改版第七十轮：
  - 使用长视频标题复查视频播放器弹窗，发现桌面端和短横屏标题栏会被超长标题撑出横向滚动。
  - 将窗口标题栏的文本省略规则提升为全局规则，视频弹窗和其他 XP 窗口都能在长标题下保持标题栏宽度稳定；播放器和外链按钮逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r70`。

- 主端页面视觉改版第七十一轮：
  - 使用长搜索词和长分类名复查知识库列表，发现极端分类名会把移动端分类按钮拉得过宽。
  - 知识库分类按钮改为文本节点容器，并为移动端胶囊分类补充有限宽度、省略显示、`title` 和 `aria-label`；搜索、分类筛选、文章列表和文章详情逻辑不变。
  - 更新 `index.html` 的 CSS / JS query 为 `20260618-main-visual-polish-r71`。

- 主端页面视觉改版第七十二轮：
  - 使用极长杂谈标题、说明和标签复查杂谈区，发现 Notepad 占位卡片会被长词撑出横向滚动。
  - 为杂谈卡片补充子项最小宽度、长词换行和标签换行规则；杂谈占位按钮、文本安全渲染和路由逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r72`。

- 主端页面视觉改版第七十三轮：
  - 使用极长兴趣、联系字段和关于我正文复查关于我窗口，发现无空格长词会撑开资料卡片并在短视口里贴近任务栏。
  - 为关于我资料容器和简介补充最小宽度约束、长词换行、最大宽度保护和移动端安全高度；头像、资料结构、三语文案和路由逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r73`。

- 主端页面视觉改版第七十四轮：
  - 使用极长文章标题、正文和复制状态文案复查知识库文章详情，发现复制链接状态在极端长提示下会横向撑开文章卡片。
  - 为文章详情操作行和复制状态补充弹性宽度、长词换行和最大宽度保护；复制链接、阅读进度、目录和文章渲染逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r74`。

- 主端页面视觉改版第七十五轮：
  - 使用已登录状态和极长邮箱复查右上角账号入口，发现账号弹窗在桌面和短横屏会被无断点邮箱撑出横向滚动。
  - 为账号弹窗已登录面板和提示文本补充最小宽度、最大宽度和长词换行保护；登录、注册、退出和账号接口逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r75`。

- 主端页面视觉改版第七十六轮：
  - 使用极长资源标题、简介、版本号、大小和更新时间复查资源卡片，发现桌面端元信息行会被无断点字符串撑出横向滚动。
  - 为通用元信息行、元信息标签和资源主体补充最小宽度、最大宽度和长词换行保护；资源数据、下载/外链按钮和筛选逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r76`。

- 主端页面视觉改版第七十七轮：
  - 使用极长游戏标题、简介、语言标签和启动按钮文案复查游戏区卡片，发现桌面网格的按钮列会抢占主内容宽度并引发横向滚动。
  - 为游戏标题、简介和启动按钮补充最大宽度、长词换行和按钮宽度限制；游戏入口、语言支持、来源链接和云存档标记逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r77`。

- 主端页面视觉改版第七十八轮：
  - 使用极长接口错误文本复查知识库、视频区和游戏区的统一加载/错误面板，发现无断点错误信息会撑出横向滚动。
  - 为 `loading-text` 状态面板补充最小宽度、最大宽度、长词换行和普通空白换行规则，并收紧短横屏知识库窗口安全高度；接口请求、错误处理和数据渲染逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r78`。

- 主端页面视觉改版第七十九轮：
  - 使用极长昵称、聊天室状态、发送按钮和错误反馈文案复查匿名聊天室，发现发送区和状态行会被无断点文本撑出横向滚动。
  - 为聊天室状态行、发送按钮和底部反馈补充列宽上限、长词换行和最大宽度保护；昵称、消息渲染、输入计数、发送和轮询逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r79`。

- 主端页面视觉改版第八十轮：
  - 使用极长视频标题、简介、作者、分类和播放按钮文案复查视频区卡片，发现桌面播放按钮和分类栏会被无断点文本撑出横向滚动。
  - 为筛选按钮文本和视频播放按钮补充最大宽度、省略显示与长词换行保护；视频接口、分类筛选、播放器和外链逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r80`。

- 主端页面视觉改版第八十一轮：
  - 使用极长首页入口和任务栏标签复查首页桌面，发现 Start 按钮和任务栏按钮会被长导航文案撑出页面横向滚动。
  - 为 Start 按钮、任务栏标签、任务栏按钮、顶部栏和首页外壳补充最大宽度、省略显示和溢出保护；桌面入口、任务栏路由和三语切换逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r81`。

- 主端页面视觉改版第八十二轮：
  - 使用 `?welcome=1` 复查欢迎弹窗，发现 390px English / 日本語 下“查看更多更新 / RSS”按钮需要滚动较深才出现，短横屏最近更新面板也占用过多弹窗高度。
  - 仅压缩移动端和短横屏欢迎窗内的说明文字行高、快捷入口间距和最近更新面板高度；最近更新读取、文章链接、RSS 链接和三语文案不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r82`。

- 主端视觉改版循环最终更新文章：
  - 将本线程主端视觉改版循环合并为 1 篇三语 `site-updates` 文章“主端视觉改版循环更新 / Main Site Visual Polish Cycle / メインサイト視覚調整サイクル更新”。
  - 同步 `functions/api/[[route]].js` 运行时 seed、`cloudflare/schema.sql` 手动迁移 seed 和 `js/main.js` 本地 fallback 最近更新，并让 2026-06-18 的公开最近更新只露出这篇最终汇总。
  - 更新 `index.html` 的 JS query 为 `20260618-main-visual-polish-r83`；本项属于本线程结束阶段的主站公开更新记录同步，没有修改管理后台私有更新记录。

- 管理后台循环优化整合更新：将昨晚 `/admin/` 管理后台循环优化的多条 checkpoint 更新说明合并为一条后台私有更新记录；本轮集中完成后台渲染安全收口、账号与聊天室隐私保护、视频链接与 IP 前缀校验、表单写入/详情读取/列表刷新期间的锁定防护、重复请求和状态错位修复，并同步优化视频分类占用提示、置顶排序联动、封面预览隐私、移动端输入提示和后台移动端可读性；后台私有更新仍只写入 `adminUpdates` 与 `admin/docs/ADMIN_CHANGELOG.md`，不写入主站 `site-updates` 或 `js/main.js` 最近更新。

- 主站夜间更新汇总与文章浮层整理：
  - 将昨晚主站公开侧多篇细碎 `site-updates` 收口为一篇三语“主站夜间优化汇总 / Public Site Nightly Summary / メインサイト夜間更新まとめ”文章；公开文章列表、本地 fallback 最近更新和 RSS 均隐藏 2026-06-17 夜间与 2026-06-18 的单项记录，仅保留汇总入口。
  - 知识库文章详情里的“回到顶部”从标题操作区移到右下角浮动位置，阅读进度条移到窗口底部任务栏上方，并为桌面端和移动端预留底部阅读安全区。
  - 参考验收图重排知识库文章页：桌面端改为左侧文章目录、小贴士侧栏，右侧正文阅读卡片，底部阅读进度条和“回到顶部”按钮并排悬浮；移动端自动收为单栏。
  - 按参考图追加 10 轮文章页视觉打磨：阅读态知识库窗口保持站内 XP 窗口尺寸，不再拉伸占满整个网站；标题栏补最小化/最大化/关闭三按钮，进度条改成底部单行蓝色分段条，并把回到顶部按钮对齐到右侧同一行。
  - 更新 `index.html` 的 CSS / JS query 为 `20260618-article-contained-window`，并同步公开 Functions seed、D1 schema seed 和三语 fallback 最近更新。

- 资源空分类提示：
  - 资源区点击数量为 0 的分类时新增 XP 风格三语空状态，提示该分类仍在整理中。
  - 空状态的标题、说明和“显示全部资源”按钮均通过 DOM / `textContent` 构建，按钮只把资源筛选切回 `all`。
  - 更新 `index.html` 的 CSS / JS query 为 `20260618-resource-empty-state`，并新增同名三语 `site-updates` 更新文章。

- 资源分类数量徽标：
  - 资源区分类筛选按钮新增数量徽标，`全部 / All / すべて` 显示资源总数，各分类显示当前分类资源数量。
  - 分类按钮继续通过 DOM / `textContent` 构建，数量只来自本地 `content.resources`，不会改变下载/外链安全校验。
  - 更新 `index.html` 的 CSS / JS query 为 `20260618-resource-filter-counts`，并新增同名三语 `site-updates` 更新文章。

- 资源卡片状态徽标：
  - 资源区卡片 meta row 新增状态徽标：无安全 URL 时显示“准备中 / Coming soon / 準備中”，有可用 URL 时显示“可获取 / Ready / 利用可”。
  - 状态判断复用 `safeResourceUrl()`，下载/外链按钮继续只接受安全项目路径或 `http(s)` 链接；原有禁用按钮行为不变。
  - 更新 `index.html` 的 CSS / JS query 为 `20260618-resource-status-badges`，并新增同名三语 `site-updates` 更新文章。
- 游戏卡片信息增强：
  - 游戏区卡片会根据 catalog 的 `storage` 字段显示“云存档 / Cloud save / クラウド保存”徽标，进入游戏前能看到存档状态。
  - 有 `repo` 的游戏新增“来源 / Source / 出典”链接，链接先经过 `safeHttpUrl()` 校验并限制为 `http(s)`；入口 iframe 和云存档同步逻辑不变。
  - 更新 `index.html` 的 CSS / JS query 为 `20260618-game-info-badges`，并新增同名三语 `site-updates` 更新文章。
- 文章回到顶部按钮：
  - 知识库文章详情复制链接按钮旁新增三语“回到顶部 / Back to top / 先頭へ戻る”按钮，方便目录跳转后快速回到标题区。
  - 点击只滚动当前文章详情容器，并同步阅读进度条；不改变路由、正文 Markdown 渲染或后台接口。
  - 更新 `index.html` 的 CSS / JS query 为 `20260618-article-scroll-top`，并新增同名三语 `site-updates` 更新文章。
- 文章目录导航：
  - 知识库文章详情会在安全 Markdown 渲染后读取正文 `h2` / `h3`，生成三语“文章目录 / Contents / 目次”导航。
  - 目录按钮通过 DOM / `textContent` 创建，只允许滚动到内部 `article-heading-N` 目标；少于两个标题的短文不显示目录。
  - 更新 `index.html` 的 CSS / JS query 为 `20260618-article-toc`，并新增同名三语 `site-updates` 更新文章。
- 文章阅读进度条：
  - 知识库文章详情头部下方新增三语“阅读进度”槽条和百分比，长文滚动时能看到当前位置。
  - 进度条通过 `transform: scaleX()` 更新，并同步 `progressbar` 的 `aria-valuenow`；正文仍走安全 Markdown DOM 渲染。
  - 更新 `index.html` 的 CSS / JS query 为 `20260618-article-progress`，并新增同名三语 `site-updates` 更新文章。
- RSS 发现链接同步：
  - 首页 `<head>` 里的 RSS `rel="alternate"` 链接新增同步标记，语言切换时会跟随当前 `lang` 更新。
  - 欢迎窗口 RSS 按钮和浏览器/RSS 阅读器可发现的 feed 链接现在指向同一语言版本。
  - 更新 `index.html` 的 JS query 为 `20260618-rss-alternate-lang`，并新增同名三语 `site-updates` 更新文章。
- 文章链接保留语言：
  - 知识库文章卡片和欢迎窗口“最近更新”文章链接的真实 `href` 会带上当前 `lang` 参数，右键新开标签也保留语言。
  - 文章详情“复制文章链接”复用同一条链接生成逻辑，继续输出当前语言直链。
  - 更新 `index.html` 的 JS query 为 `20260618-article-link-lang`，并新增同名三语 `site-updates` 更新文章。
- 最近更新完整提示：
  - 欢迎窗口“最近更新”列表的每条链接新增完整 `title` 与 `aria-label`，包含标题、摘要和日期。
  - 屏幕上继续保留紧凑截断展示，链接提示和读屏名称使用 DOM / `textContent` 来源，不插入未处理 HTML。
  - 更新 `index.html` 的 JS query 为 `20260618-recent-update-labels`，并新增同名三语 `site-updates` 更新文章。
- RSS 按钮文案整理：
  - 欢迎窗口 RSS 按钮保留橙色 `RSS` 徽标，可见文案改为“订阅 / Feed / 購読”，避免重复显示 RSS。
  - 链接新增跟随当前语言切换的完整 `aria-label`，读屏仍可获得完整 RSS 订阅含义。
  - `?welcome=1` 现在会跳过“今日已看过”记录，方便复查欢迎窗口三语可见态；普通首访每日只弹一次逻辑不变。
  - 更新 `index.html` 的 JS query 为 `20260618-rss-button-label`，并新增同名三语 `site-updates` 更新文章。
- RSS 订阅入口：
  - 新增公开 `GET /api/rss.xml` / `/api/feed.xml`，按 `lang` 输出已发布文章和站点更新的 RSS XML。
  - 首页“最近更新”面板新增三语 RSS 链接，语言切换时会同步到当前语言的 feed。
  - 更新 `index.html` 的 CSS/JS query 为 `20260618-rss-feed-entry`，并新增同名三语 `site-updates` 更新文章。
- 静态图片尺寸提示：
  - 顶部品牌头像、聊天室头像、关于页头像和 Start 图标补充真实 `width` / `height` 属性，CSS 展示尺寸保持不变。
  - 帮助浏览器在图片解码前保留稳定比例，降低首屏和固定 UI 的布局不确定性。
  - 更新 `index.html` 的 JS query 为 `20260618-static-image-dimensions`，并新增同名三语 `site-updates` 更新文章。
- 文章标签本地化：
  - `tagLabels` 补齐安全、iframe、聊天室、云存档、筛选、图片、账号等公开文章标签的中文 / English / 日本語显示。
  - 知识库列表、文章详情和最近更新入口继续使用安全 DOM / `textContent` 输出标签，不改变文章数据。
  - 更新 `index.html` 的 JS query 为 `20260618-article-tag-locales`，并新增同名三语 `site-updates` 更新文章。
- 游戏 iframe 启动路径守卫：
  - `game-shell.js` 新增 `safeGameSourceEntry()`，只允许游戏 catalog 把 iframe 指向本地 `source/...html` 页面。
  - 游戏启动语言 query 参数名新增格式校验，异常配置会回退到 `lang`，不再直接拼进 iframe URL。
  - 5 个游戏入口页的 `game-shell.js` query 更新为 `20260618-game-frame-source-guard`，并新增同名三语 `site-updates` 更新文章。
- 聊天室昵称本地化：
  - 前端请求 `/api/chat/nickname` 时带上当前 `lang`，新随机昵称会跟随中文 / English / 日本語界面。
  - 本地 fallback 随机昵称拆分为三语词库，接口不可用时仍能生成与当前语言匹配的昵称。
  - 更新 `index.html` 的 JS query 为 `20260618-chat-nickname-locale`，并新增同名三语 `site-updates` 更新文章。
- 文章图片路径守卫：
  - 文章 Markdown 图片仍只允许 `assets/images/articles/` 下的项目资源，并继续通过安全 DOM 渲染。
  - `safeArticleImageSrc()` 新增 `..` 路径片段拒绝，避免图片路径逃出文章图片目录。
  - 更新 `index.html` 的 JS query 为 `20260618-article-image-path-guard`，并新增同名三语 `site-updates` 更新文章。
- 资源链接白名单：
  - 资源区下载/外链 URL 改为先经过 `safeHttpUrl()` 规范化；无效协议继续显示准备中按钮。
  - 本地资源路径只接受安全的 `assets/` 或 `downloads/` 路径，并拒绝 `..` 路径穿越片段。
  - 更新 `index.html` 的 JS query 为 `20260618-resource-url-allowlist`，并新增同名三语 `site-updates` 更新文章。
- 视频链接白名单：
  - 公开视频卡片缩略图在前端补充域名白名单，只接受 YouTube / Bilibili 图片域或本地 `data:image` 封面。
  - 播放窗口的“打开原地址”和 iframe `src` 也补充前端校验：原地址只接受 YouTube / Bilibili / b23，embed 只接受 YouTube embed 或 Bilibili player。
  - 更新 `index.html` 的 JS query 为 `20260618-video-url-allowlist`，并新增同名三语 `site-updates` 更新文章。
- 游戏链接白名单：
  - 游戏列表入口 URL 补充白名单校验：本地入口只接受 `games/catalog.json` 中的安全目录名，外部链接和仓库链接只接受 `http(s)`。
  - 游戏封面只接受 `assets/images/` 下的常见图片路径；无效封面回退到游戏图标，无效入口显示禁用按钮，不输出不可信链接。
  - 更新 `index.html` 的 JS query 为 `20260618-game-url-allowlist`，并新增同名三语 `site-updates` 更新文章。
- 游戏列表安全渲染：
  - 游戏区列表从字符串 `innerHTML` 模板改为 DOM / `textContent` 构建，游戏标题、简介、语言支持标签、许可证和加载/失败提示都按文本节点渲染。
  - 游戏封面懒加载与异步解码、入口链接、外部链接打开方式、云存档和游戏入口页逻辑保持不变。
  - 更新 `index.html` 的 JS query 为 `20260618-game-list-safe-dom`，并新增同名三语 `site-updates` 更新文章。
- 资源筛选安全渲染：
  - 资源区分类筛选按钮从字符串 `innerHTML` 拼接改为 DOM / `textContent` 构建，分类名、`data-filter`、active 状态和点击筛选行为保持不变。
  - 视频区筛选按钮此前已经是 DOM 渲染，本轮只补齐通用资源筛选路径；后台目录和管理接口未触碰。
  - 更新 `index.html` 的 JS query 为 `20260618-resource-filters-safe-dom`，并新增同名三语 `site-updates` 更新文章。
- 知识库筛选安全渲染：
  - 知识库分类筛选按钮从字符串 `innerHTML` 拼接改为 DOM / `textContent` 构建，分类名、`data-filter`、active 状态和点击筛选行为保持不变。
  - 配合上一轮文章卡片 DOM 渲染，知识库列表和筛选控件不再依赖文章/分类字符串拼接输出。
  - 更新 `index.html` 的 JS query 为 `20260618-knowledge-filters-safe-dom`，并新增同名三语 `site-updates` 更新文章。
- 知识库列表安全渲染：
  - 知识库文章列表从字符串 `innerHTML` 拼接改为 DOM / `textContent` 构建，标题、摘要、标签、发布日期和阅读入口都按纯文本节点渲染。
  - 搜索、分类筛选、文章详情直链、fallback 语言提示和阅读按钮行为保持不变。
  - 更新 `index.html` 的 JS query 为 `20260618-knowledge-list-safe-dom`，并新增同名三语 `site-updates` 更新文章。
- 最近更新安全渲染：
  - 首页“最近更新”列表从字符串 `innerHTML` 拼接改为 DOM / `textContent` 构建，标题、摘要、日期和图标都按纯文本节点渲染。
  - 文章直链、`site-updates` 工具图标、本地 fallback 图标和最近更新日期逻辑保持不变。
  - 更新 `index.html` 的 JS query 为 `20260618-recent-updates-safe-dom`，并新增同名三语 `site-updates` 更新文章。
- 最近更新图标优化：
  - 首页“最近更新”列表从文章 API 读取 `site-updates` 时，会显示更贴近网站更新的工具图标，不再把所有 API 文章都显示成书本图标。
  - 本地 fallback 最近更新继续保留各自图标；普通文章仍回退为书本图标。
  - 更新 `index.html` 的 JS query 为 `20260618-recent-update-icons`，并新增同名三语 `site-updates` 更新文章。
- 账号弹窗安全 DOM 渲染：
  - 顶部账号 / 云存档弹窗从模板字符串 `innerHTML` 改为 DOM / `textContent` 构建，邮箱、接口错误和状态提示都继续按纯文本显示。
  - 登录、注册、退出账号、语言切换后重渲染和云存档说明逻辑保持不变。
  - 更新 `index.html` 的 JS query 为 `20260618-account-safe-dom`，并新增同名三语 `site-updates` 更新文章。
- 游戏外壳安全 DOM 渲染：
  - 游戏入口页的云存档面板从字符串 `innerHTML` 拼接改为 DOM / `textContent` 构建，邮箱、状态提示和按钮文案继续按文本渲染。
  - 游戏入口页协议栏改为 DOM 构建，并限制协议文件为相对路径、上游仓库为 `http(s)` 链接；游戏 iframe、云存档同步和入口语言逻辑不变。
  - 为 5 个游戏入口页的 `game-shell.js` 增加 `20260618-game-shell-safe-dom` 缓存版本，并新增同名三语 `site-updates` 更新文章。
- 资源入口文案对齐：
  - 英文桌面入口从 `Files TBD` 改为 `Resources TBD`，日文入口从 `資料（未定）` 改为 `リソース（未定）`，和资源窗口标题保持一致。
  - 中文入口继续显示 `资源区（待定）`；只调整公开主站翻译和最近更新记录，不改变资源区路由、占位状态或数据。
  - 更新 `index.html` 的 JS query 为 `20260618-resource-label-sync`，并新增同名三语 `site-updates` 更新文章。
- 视频缩略图异步解码：
  - 公开视频卡片的缩略图在已有 `loading="lazy"` 基础上补充 `decoding="async"`，和文章配图、游戏封面图片的加载策略保持一致。
  - 视频列表、视频分类、播放窗口、外链白名单和公开视频 API 行为不变。
  - 更新 `index.html` 的 JS query 为 `20260618-video-thumb-decoding`，并新增同名三语 `site-updates` 更新文章。
- 资源占位提示补齐：
  - 资源区没有真实 URL 的“准备中 / Coming soon / 準備中”按钮增加当前语言的 `title`、`aria-label` 和 `aria-disabled`，明确这些占位项暂时没有下载或外链。
  - 继续保留既有 URL 白名单和禁用按钮行为，不新增无效链接，也不改变资源数据结构。
  - 更新 `index.html` 的 JS query 为 `20260618-resource-placeholder-hints`，并新增同名三语 `site-updates` 更新文章。
- 游戏外壳三语同步：
  - 统一游戏入口页的返回入口、加载状态、本地存档工具、导入导出按钮、云端存档面板、协议链接和状态提示，跟随 `?lang=zh|en|ja` 显示中文 / English / 日本語。
  - 游戏标题、iframe 标题和语言支持副标题改为使用当前语言；游戏本体 iframe、启动语言、云存档同步、导入导出逻辑不变。
  - 为 5 个游戏入口页的 `game-shell.js` 增加 `20260618-game-shell-locale` 缓存版本，并新增同名三语 `site-updates` 更新文章。
- 游戏语言标记三语同步：
  - 游戏卡片的语言支持标记从固定 `中文 / EN / 日本語` 改为跟随当前语言显示 `中文/英文/日文`、`Chinese/English/Japanese` 或 `中国語/英語/日本語`。
  - 不支持状态的 `title` 提示也改为三语文案；✓ / × 状态、游戏目录、云存档和入口链接逻辑保持不变。
  - 更新 `index.html` 的 JS query 为 `20260618-game-language-labels`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。
- 游戏封面异步解码：
  - 游戏区动态渲染的 `game-cover` 图片在已有 `loading="lazy"` 基础上补充 `decoding="async"`，减少打开游戏列表时的图片解码阻塞。
  - 只调整公开主站游戏列表图片属性和更新记录，不改变游戏目录、云存档、入口链接或游戏运行逻辑。
  - 更新 `index.html` 的 JS query 为 `20260618-game-cover-decoding`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。
- 杂谈菜单三语同步：
  - 杂谈区顶部 Notepad 风格菜单从固定英文 `File Edit View Help` 改为跟随中文 / English / 日本語 显示。
  - 只调整公开主站静态菜单文案和更新记录，不改杂谈卡片 DOM / `textContent` 安全渲染逻辑。
  - 更新 `index.html` 的 JS query 为 `20260618-notepad-menu-locale`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。
- 账号弹窗三语同步：
  - 顶部账号/云存档弹窗的登录、注册、邮箱、密码、云存档说明、退出账号和本地状态提示改为跟随当前语言显示。
  - 语言切换时会重新渲染账号控件；账号邮箱、错误信息和动态提示继续通过 `escapeHtml` 输出，避免把外部文本当作 HTML 执行。
  - 更新 `index.html` 的 JS query 为 `20260618-account-widget-locale`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。
- 无障碍标签三语同步：
  - 新增 `data-i18n-aria-label` / `data-i18n-title` 通用同步逻辑，让无障碍标签和提示标题也能跟随当前语言更新。
  - 品牌返回按钮、语言切换区域、桌面图标区域、页面关闭按钮、欢迎窗关闭按钮和视频弹窗关闭按钮补充中文 / English / 日本語 `aria-label`。
  - 更新 `index.html` 的 JS query 为 `20260618-aria-label-localization`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。
- 聊天室标题三语同步：
  - 修复英文 / 日文界面打开聊天室时窗口标题仍显示中文“匿名聊天室”的问题，现在标题会跟随当前语言显示为 `Chat Room` / `匿名チャット`。
  - 本轮只调整公开主站 `chatroomTitle` 翻译和更新记录，不改聊天室消息渲染、轮询、昵称或公开 API 安全逻辑。
  - 更新 `index.html` 的 JS query 为 `20260618-chatroom-title-locale`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。
- 图片加载细节优化：
  - 聊天室头像和关于页头像补充 `loading="lazy"` 与 `decoding="async"`，减少非当前窗口图片对首屏加载和解码的影响。
  - 文章 Markdown 配图在继续走 `assets/images/articles/` 白名单和安全 DOM 渲染的基础上补充异步解码，阅读长文时更平滑。
  - 更新 `index.html` 的 JS query 为 `20260618-image-loading-polish`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。
- 标签三语显示：
  - 文章列表、文章详情和杂谈卡片的常见中文 seed 标签会跟随中文 / English / 日本語 切换显示，减少英文/日文页面里的中文标签混杂。
  - 知识库本地搜索会同时匹配原始标签和当前语言标签，例如 English 下可用 `Reading`、`Routing` 等标签词继续搜索。
  - 更新 `index.html` 的 JS query 为 `20260618-trilingual-tags`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。
- 文章详情搜索条隐藏修复：
  - 知识库文章详情页会真正隐藏顶部搜索条，避免阅读文章时出现与当前详情无关的搜索控件。
  - 为 `.knowledge-searchbar[hidden]`、`.content-list[hidden]` 和 `.article-detail[hidden]` 补充明确 `display: none` 规则，防止组件自身 display 样式覆盖 HTML `hidden` 状态。
  - 更新 `index.html` 的 CSS / JS query 为 `20260618-article-detail-search-hide`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。
- 语言链接参数同步：
  - 用户点击中文 / English / 日本語 语言按钮后，地址栏 `lang=` 参数会同步更新为当前语言，复制当前页面链接时不再带旧语言。
  - 主站路由跳转会保留当前查询参数并刷新 `lang=`，文章详情、知识库、视频区、聊天室、游戏区等公开页面继续沿用当前语言上下文。
  - 更新 `index.html` 的 JS query 为 `20260618-language-url-sync`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。
- 杂谈区占位按钮修复：
  - 杂谈区没有真实文章详情入口时，卡片动作从无功能“阅读”改为三语“整理中 / Drafting / 準備中”禁用态。
  - 杂谈区卡片渲染从字符串拼接改为 DOM / `textContent` 构建，后续接入真实杂谈文章时降低 XSS 风险。
  - 更新 `index.html` 的 JS query 为 `20260618-blog-placeholders`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。

- 导航当前态增强：
  - 底部任务栏按钮和首页 Start 按钮会根据当前 route 同步 `active` 样式，首页 Start 按钮获得更明确的按下态。
  - 当前任务栏 / Start 按钮同步 `aria-current="page"`；首页桌面图标同步 `aria-pressed`，增强键盘与辅助技术识别。
  - 更新 `index.html` 的 CSS / JS query 为 `20260618-nav-active-state`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。

- 资源区占位按钮修复：
  - 资源区卡片没有真实下载地址或外部链接时，动作按钮改为三语“准备中 / Coming soon / 準備中”禁用态，不再输出会跳到页面顶部的 `href="#"`。
  - 资源区卡片渲染从字符串拼接改为 DOM / `textContent` 构建，后续接入真实资源 URL 时降低 XSS 风险；真实 `http(s)` 或项目内 `assets/`、`downloads/` 地址仍会生成下载/外链按钮。
  - 右上角“最近更新日期”改为按用户本地时区计算日期，避免北京时间 00:00 后发布的 UTC 文章仍显示前一天。
  - 更新 `index.html` 的 CSS / JS query 为 `20260618-resource-actions`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。

- 主端页面视觉改版收尾修正：
  - 抽检日语资源页 390px 小屏时，发现资源分类筛选按钮虽然不造成页面横向滚动，但会在隐藏滚动栏内延伸到视口外。
  - 仅将移动端资源区筛选栏改为两列自动换行，视频区筛选栏继续保持横向滑动；筛选数据、按钮计数和点击逻辑不变。
  - 更新 `index.html` 的 CSS query 为 `20260618-main-visual-polish-r84`。

- 主端视觉改版线上更新列表修正：
  - 将公开文章 API 的 2026-06-18 主端循环折叠保留目标同步为 `2026-06-18-main-visual-polish-cycle`，避免最终汇总文章可直接访问但不出现在更新列表中。
  - 只调整主站 `site-updates` 列表过滤目标；文章内容 seed、后台接口、后台页面和 D1 schema 不变。

## 2026-06-17

- 管理后台凭据表单语义优化：
  - `/admin/` 登录页和账号重置密码表单的邮箱输入保留邮箱格式校验，同时补齐标准 `username` 自动填充语义，减少浏览器表单提示。
  - 后台登录流程、账号保存流程、静态资源权限和 `/api/admin/*` 服务端权限校验不变；后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台首屏加载优化：
  - `/admin/` 初始化改为只读取管理员身份和当前实时大屏数据，文章、视频、聊天室、禁言和账号资料进入对应后台标签页时再按需加载。
  - 后台手动刷新改为刷新当前标签页数据；30 秒自动刷新只保留在实时大屏、访问来源和点击埋点统计面板内。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260617-lazy-panel-load`，减少线上继续加载旧后台脚本的概率；后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 文章直链欢迎窗修复：
  - 首次打开文章详情、知识库、视频区等非首页直链时，不再自动弹出欢迎窗口遮挡目标内容；首页首次访问仍保留欢迎弹窗。
  - `?welcome=0` 继续禁用欢迎窗，`?welcome=1` 可显式触发欢迎窗，便于人工检查欢迎窗口。
  - 更新 `index.html` 的 JS query 为 `20260617-route-aware-welcome`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。

- 视频区空状态增强：
  - 视频区在当前没有公开视频或筛选分类无结果时，显示 XP 风格空状态卡片，说明视频区内容正在整理中。
  - 空状态提供“查看网站更新”入口，复用现有知识库分类跳转，不影响已有视频卡片、播放窗口和后台视频数据。
  - 更新 `index.html` 的 CSS / JS query 为 `20260617-video-empty-state`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。

- 文章详情复制链接：
  - 知识库文章详情头部新增 XP 风格“复制文章链接”按钮，生成包含当前语言参数的直链，方便分享文章详情页。
  - 复制成功 / 失败状态使用中文 / English / 日本語 文案，通过 `textContent` 更新，不影响 Markdown 安全渲染。
  - 更新 `index.html` 的 CSS / JS query 为 `20260617-article-share-link`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。

- 知识库本地搜索：
  - 主站知识库窗口顶部新增 XP 风格搜索条，可在当前已加载文章中按标题、简介、分类、slug 和标签即时过滤。
  - 搜索状态会显示命中数量，清空按钮可一键恢复完整列表；输入和状态文案同步维护中文 / English / 日本語。
  - 手机端搜索条改为自然换行布局，保持知识库列表无横向溢出。
  - 顺手修复 fallback 视频数据打开播放窗口时标题显示为 `[object Object]` 的问题，弹窗标题和 iframe title 统一使用当前语言文本。
  - 更新 `index.html` 的 CSS / JS query 为 `20260617-knowledge-search`，并新增同名三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。

## 2026-06-16

- 视频卡片与分类持久化修复：
  - 主站视频卡片从 520px 收紧到 424px，封面区、正文行距和播放按钮间距同步压缩，减少图文信息下方的大块空白，同时保留标题、简介、来源/时间和播放按钮。
  - 视频分类默认 seed 改为首次建表初始化；已有 `video_categories` 表会写入 `site_runtime_state` 状态标记，之后后台删除默认标签或修改排序都不会被运行时 schema guard 自动补回。
  - `cloudflare/schema.sql` 同步增加 `site_runtime_state` 并让默认视频分类只在空库首次初始化，减少手动 migration 复原后台维护结果的风险；旧库缺 `pinned_sort_order` 时，相关队列索引继续交给运行时 guard 补列后创建，避免手动 schema 卡住。
  - 首页匿名聊天室桌面图标略微缩小并增加与名称的间距，避免图标底部和文字贴在一起。
  - `npm.cmd run build` 的运行时检查新增 `/api/videos?lang=zh` 路径，覆盖视频 schema guard；更新 `index.html` 的 CSS / JS query 为 `20260616-video-card-category-icon-fixes`、`admin/index.html` 的后台 JS query 为 `20260616-video-category-seed-state`，并新增同名三语 `site-updates` 更新文章。

- 视频区窗口自适应放大：
  - 主站视频区列表窗口从固定 760px 高度上限改为跟随浏览器可用高度计算，减少大屏桌面底部空白，能露出更多视频卡片。
  - 桌面端视频窗口宽度小幅放大到更适合宽屏的范围，保留三列卡片、分类筛选和内部滚动逻辑。
  - 手机端继续走既有小屏断点，保持单列视频列表、防横向溢出和弹窗安全高度。
  - 更新 `index.html` 的 CSS / JS query 为 `20260616-responsive-video-window`，并新增 `seed-update-2026-06-16-responsive-video-window` 三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。

- 后台视频置顶排序修复：
  - `videos` 新增独立 `pinned_sort_order`，置顶视频进入单独队列并始终排在未置顶视频之前。
  - 公开视频和后台视频列表统一按置顶优先、置顶排序从大到小、普通排序从大到小展示；旧库新增字段时会把已置顶视频的普通排序回填为置顶排序。
  - 后台视频表单新增“置顶排序”，列表徽章显示置顶排序值，勾选置顶时可自动补入当前置顶队列的下一个排序值。

- 后台视频封面上传增强：
  - 视频管理支持选择本地 JPG、PNG、WEBP、AVIF 图片作为封面，浏览器端会压缩裁切为 16:9 封面数据后写入现有 `thumbnail_url` 字段。
  - 新增“从本地视频截首帧”能力；当封面为空且已选择本地视频文件时，保存前会自动截取第一帧作为封面。
  - 后端封面校验继续限制 YouTube / Bilibili 图片域名，同时新增受限 `data:image` 封面白名单和大小上限，避免 SVG/HTML 或过大封面写入。

- 移动端与后台视频维护修复：
  - 默认视频分类 seed 改为只插入缺失分类，不再覆盖后台维护过的 slug、中文名、英文名、日文名、排序和启用状态，修复“AI实验”改名后又被还原的问题。
  - Bilibili 元数据抓取移除不必要的 `Origin` 请求头，增加详情接口、移动页、`__NEXT_DATA__`、页面标题和更多 meta 兜底；保存已有视频且 URL 未变化时不再重复抓取外部元数据。
  - 后台视频识别失败时会说明播放器地址已生成、标题/作者/封面可手动补全；新增重复视频拦截，并在分类勾选区标出停用分类。
  - 主站视频列表、视频播放窗口、资源区筛选、登录弹窗和登录成功账号弹窗补强手机端换行、单列、宽度和防溢出规则，尽量不影响桌面端布局。
  - 新增 `seed-update-2026-06-16-mobile-admin-video-fixes` 三语 `site-updates` 更新文章，并同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。

## 2026-06-15

- 后台账号管理与统计口径优化：
  - 后台新增“账号管理”页面，放在“后台更新记录”上方，可查看注册账号邮箱、角色、密码加密状态、登录履历、活跃会话和近期活跃。
  - 密码不在后台明文展示，也不向前端返回密码哈希；管理员只能通过填写新密码来重置账号密码，真实账号数据不写入 GitHub 仓库。
  - 新增 `user_login_events` D1 表记录成功登录/注册履历，仅保存掩码 IP 前缀、IP hash、地区、设备摘要和时间。
  - 埋点统计改为登录账号优先识别：已登录用户按同一不可逆账号统计 ID 合并，同一账号多设备访问也只计为 1 个 UV；匿名访问继续按隐藏访客 cookie 统计。
  - 后台实时大屏补充自然语言解释，说明 PV、UV、在线访客和点击数据的含义。
- 视频管理排序、Bilibili 元数据和卡片尺寸修复：
  - Bilibili 元数据抓取在 API 412 或页面状态变化时增加 meta、结构化数据和更宽的页面状态兜底，尽量补齐标题、简介、作者、发布时间和封面。
  - 视频公开列表和后台列表改为置顶优先，未置顶视频按 `sort_order` 从大到小显示；后台新建视频默认取当前最大排序 + 10。
  - 视频分类管理同步使用排序值越大越靠前的规则，新建分类默认 +10，并防止默认分类 seed 覆盖后台维护过的排序和启用状态。
  - 主站视频卡片改为统一固定高度，封面按钮移除默认内边距并让图片完全铺满，缺少封面时显示同尺寸像素风占位图。
  - “打开原地址”按钮保持真实外链并兼容旧 fallback 数据；首页视频区入口去掉“待定 / TBD / 未定”三语文案。
  - 新增 `seed-update-2026-06-15-video-management-sort-metadata` 三语 `site-updates` 更新文章，并同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。

- 视频播放器窗口交互修复：
  - 将站内视频窗口“全屏”从 iframe Fullscreen API 改为 XP 标题栏右上角最大化/还原按钮，避免和 YouTube / Bilibili 自带全屏逻辑混在一起；最大化状态可再次点击或按 Escape 退出。
  - 公开视频接口补回 `original_url`，前台“打开原地址”按钮会稳定打开 YouTube / Bilibili 原页面。
  - 视频 iframe 增加站内默认遮罩与透明点击防护区，收起默认顶部/底部信息栏，并减少底部空白区域误触平台“保存到待看”等按钮。
  - 视频卡片播放按钮热区从整行收窄到按钮本体，降低卡片底部空白误触。
  - 新增 `seed-update-2026-06-15-video-player-window-controls` 三语 `site-updates` 更新文章，并同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。
- 更新记录约束补强：
  - 在 `PROJECT_CONTEXT.md`、项目专用 Skill 和 Skill README 中强调：可见更新的三语 `site-updates` 文章是合并前验收门槛，不能当作事后可选补记。
  - 如果无法通过后台直接发布更新文章，也必须在同一次代码变更里补齐 API seed、D1 schema seed 和前端 fallback 最近更新。

- 首页任务栏上方绿色长条修复：
  - 确认截图中的绿色长条不是 night 底图像素，而是首页页面高度使用固定 `100vh - 108px` 估算后，未填满 `site-shell` 中间网格行，导致外层绿色草地渐变在任务栏上方露出。
  - 同步检查 morning / day / dusk / night 四个时段：同一布局缝隙都会存在，morning / day 因底部草色接近不明显，dusk / night 更容易看出，night 最突出。
  - 将 `main` 改为填满网格中间行的布局容器，页面使用父级高度而不再依赖固定像素估算，并更新首页 CSS / JS query 为 `20260615-video-window-home-gap-fix`，避免旧样式缓存继续显示露底长条。
  - 新增 `seed-update-2026-06-15-home-wallpaper-gap-fix` 三语 `site-updates` 文章，并同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 与 `js/main.js` fallback 最近更新。

- 管理后台视频和导航更新：
  - 后台视频预览改为检查用小播放器，避免 YouTube / Bilibili iframe 在编辑区撑满页面。
  - 后台视频元数据抓取补齐简介和发布时间链路：YouTube 增加页面元信息解析，Bilibili 增加浏览器化请求头、页面备用解析和 b23 短链兜底。
  - 新增独立“后台更新记录”标签页，并将后台导航顺序调整为实时大屏、访问来源、点击埋点、知识库文章、视频管理、视频分类管理、聊天室管理、后台更新记录、后台说明。
  - 更新后台专用 `ADMIN_SKILL`，强调每次后台更新后必须同步维护后台页面更新说明和 `admin/docs/ADMIN_CHANGELOG.md`。

- 视频区卡片与播放器修复：
  - 调整视频封面为固定 16:9 铺满显示，封面图片使用 `object-fit: cover` 对齐 YouTube / Bilibili 常见封面比例。
  - 修复视频介绍过长、播放按钮超出卡片和整张卡片都触发播放的问题，仅保留封面按钮与卡片内播放按钮作为播放热区。
  - 视频弹窗 iframe 改为铺满播放窗，打开时自动追加 YouTube / Bilibili autoplay 参数，并恢复“打开原地址”链接。
  - 视频播放窗支持拖拽调整大小，新增全屏按钮，并将标题栏星星替换为视频区同款图标。

- 主站文档补充后台文档指引：
  - 在 `PROJECT_CONTEXT.md` 的项目结构和 Skill 索引中补充 `admin/docs/` 后台专用文档入口。
  - 在主站项目 Skill 和 Skill README 中新增规则：凡是管理后台相关改动，必须额外读取 `admin/docs/ADMIN_PROJECT_CONTEXT.md`、`admin/docs/ADMIN_SKILL.md`，必要时读取 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台专用文档包：
  - 新增 `admin/docs/ADMIN_PROJECT_CONTEXT.md`、`admin/docs/ADMIN_SKILL.md` 和 `admin/docs/ADMIN_CHANGELOG.md`，单独记录 `/admin/` 后台上下文、维护约束和私有更新记录。
  - 根目录 README 补充后台专用文档索引，明确后台文档不等同于主站 `PROJECT_CONTEXT.md`、根目录 `CHANGELOG.md` 或主站项目 Skill。
  - 本次仅做文档体系拆分，不改后台功能、样式、接口、D1 schema，也不写入主站知识库 `site-updates`。

- 知识库接口 500 修复：
  - 修复视频系统更新 seed 文案中的 Markdown 反引号未转义问题，避免 Pages Function 执行 `articleSeedStatements` 时把 `/api/videos` 片段误当成 JavaScript 表达式并抛出 `api is not defined`，导致 `/api/articles` 返回 500。
  - `npm run build` 新增模拟 `/api/articles?lang=zh` 请求的运行时检查，即使没有真实 D1 也会执行文章 seed 路径，防止类似“语法检查通过、线上运行失败”的问题再次漏掉。

- 补发合并更新文章：
  - 新增 `seed-update-2026-06-15-icons-cloud-fixes` 三语 `site-updates` 文章，把窗口/任务栏图标更新、标题栏图标对齐微调和 night/dusk 云层残影修复合并记录到一篇文章里。
  - 同步更新 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新，避免有可见更新但没有公开更新文章。
- 分区窗口标题栏图标对齐微调：
  - 放大各分区窗口左上角标题图标的显示盒子和背景缩放，让图标在标题文字前更清晰。
  - 保持标题栏、窗口尺寸和底部任务栏布局不变，仅调整标题栏图标的显示大小与垂直对齐。

- 首页动态云层 clean 底图残留修复：
  - 修补 night 中景云层上方残留在 `base-clean.png` 里的细小云片，修复云层漂移后出现“上半截留在背景上”的视觉断裂。
  - 同步检查 morning / day / dusk / night 四个时段：morning 和 day 未发现同类残留，dusk 有一条较淡的同类残影并已一并清理。
  - 更新动态底图引用缓存版本为 `20260615-cloud-residual-fix`，并将首页 CSS query 合并为 `20260615-managed-videos-cloud-residual-fix`，避免浏览器继续加载旧 clean plate。

- 视频区真实管理系统上线：
  - 新增 `videos`、`video_categories`、`video_category_relations` D1 表，并在运行时 schema guard 与 `cloudflare/schema.sql` 同步维护。
  - 新增公开视频接口 `/api/videos`、`/api/videos/:videoId`，以及后台视频和视频分类 CRUD 接口，全部后台接口复用 `requireAdmin` 权限校验。
  - 后台新增“视频管理”和“视频分类管理”，支持输入 YouTube / Bilibili / b23.tv 链接、服务端自动识别、抓取元数据、手动覆盖、分类关联、状态、排序、置顶、删除和刷新元数据。
  - 主站视频区改为读取 D1 数据，分类标签由后台分类动态生成，“全部”仅由前端生成；视频在 XP 风格弹窗内 iframe 播放，不跳转外站。
  - 视频渲染改为安全 DOM/textContent，iframe src 只使用服务端规范化 embed URL，封面失败时显示像素风占位图。
  - 扩展 `js/telemetry.js` 支持 `data-video-id` 和播放器打开/播放失败埋点，不记录后台输入内容。
  - 新增三语 `site-updates` 文章 `2026-06-15-managed-video-system`，并同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 更新。
  - 更新 `index.html` 与 `admin/index.html` 的 CSS/JS query 到 `20260615-managed-videos`。

- 窗口与任务栏图标更新：
  - 使用 imagegen 参考新图标绘制并裁切 1:1 透明像素图标，新增知识库、视频区、资源区、游戏区、杂谈区、关于我六组窗口图标资源。
  - 底部任务栏快捷窗口图标改为固定尺寸图片图标，保持按钮高度和排列不变；匿名聊天室底部快捷图标保持原样。
  - 各页面窗口标题栏名称前图标改为对应区域图标，匿名聊天室仅替换打开后窗口左上角标题图标。
- 知识库文章发布时间链路加固：
  - 后台文章编辑器的发布时间改为本地日期时间选择器，编辑时把 UTC 发布时间转换为管理员本地时间显示。
  - 后台保存文章时将本地发布时间统一转换为 UTC ISO 后提交，后端再次规范化 `published_at`，确保 D1 保存绝对时间。
  - 公开知识库继续按访问者浏览器时区显示到秒，不显示时区名；不同时区用户会看到同一发布时间对应的各自本地时间。
  - 更新 `/admin/admin.js` query 为 `20260615-article-timezone-fix`，减少后台继续加载旧保存逻辑的可能。
  - 同步更新 `PROJECT_CONTEXT.md`、项目专用 Skill 和 Skill README 的时间维护规则。

- 首页动态云层线上速度修复：
  - 取消 `?wallpaper=` 预览模式的单独加速 CSS 分支，让预览和正式访问使用同一组云层动画周期。
  - 将 morning / day / dusk / night 四个时间段的正式 `--cloud-duration` 同步到原预览速度，修复线上正常访问明显慢于预览的问题。
  - 更新 `index.html` 的 CSS query 为 `20260615-cloud-speed-live`，减少线上继续加载旧云层速度样式的可能。

- 管理后台第一版保守型视觉优化：
  - 优化 `/admin/` 后台整体观感，统一侧边栏、顶部栏、XP 面板、按钮、表格、状态标签、空状态和提示信息，保持中文后台和轻量 XP / 像素风元素。
  - 改善实时大屏、文章管理、访问来源、点击埋点和聊天室管理在桌面、平板、移动端的阅读布局，修正移动端侧边栏高度和编辑区滚动边界。
  - 后台私有更新记录新增“后台视觉优化第一版”，继续与主站知识库 `site-updates` 分开维护。
  - 新增轻量 `npm run build` 静态检查脚本，用于验证后台入口、资源引用、关键面板、JS 语法和 CSS 基础结构。
- 首页动态云层速度与流畅度微调：
  - 将 morning / day / dusk / night 四个时段的云层漂移周期整体小幅缩短，让云朵移动比上一版略快，但仍保持慢速像素桌面氛围。
  - 为壁纸舞台和云层元素补充 `backface-visibility`、`contain`、初始 `translate3d` 和 `animation-fill-mode`，帮助浏览器更稳定地使用合成层，减少首帧跳动和动画卡顿。
  - 保持首页动态壁纸只使用 CSS `transform` / `opacity`，并继续保留 `prefers-reduced-motion`、页面隐藏暂停和小屏静态降级。
  - 新增 `seed-update-2026-06-15-cloud-speed-smoothness` 三语 `site-updates` 文章，并同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 与 `js/main.js` 的本地 fallback 最近更新。
  - 修正该更新文章的 `published_at` / 翻译更新时间为实际代码更新提交时间 `2026-06-15 20:41:45`（UTC+8），避免知识库显示为手填的 `17:30:00`。
  - 更新 `index.html` 的 CSS / JS query 为 `20260615-cloud-speed-smoothness`，减少线上继续加载旧动画参数的可能。
- 文章访问埋点与 PV/UV：
  - 新增 `article_view_events` 文章访问事件表，公开文章详情接口 `/api/articles/:slug` 每次成功读取文章时会按隐藏 `lusu_visitor` 记录文章 PV、UV、语言、访问来源和掩码 IP 信息。
  - 后台实时大屏新增“热门文章”表，按最近周期展示文章标题、slug、PV、UV 和最近访问时间。
  - 后台文章列表和文章编辑详情新增文章总 PV/UV、今日 PV/UV 显示，方便在发布和维护文章时直接查看单篇访问表现。
  - `js/telemetry.js` 新增 `history.pushState` / `history.replaceState` 监听，修复前端路由切换到文章详情时页面级 PV 可能漏记的问题。
- 网站更新记录维护闭环补齐：
  - 新增 `seed-update-2026-06-15-clouds-docs-maintenance` 三语 `site-updates` 文章，公开记录四时段动态云层和维护文档补齐，本篇文章会驱动首页最近更新和右上角最新日期。
  - 同步更新 `functions/api/[[route]].js` 的文章 seed、`cloudflare/schema.sql` 的 D1 seed，以及 `js/main.js` 的本地 fallback 最近更新，避免 D1 不可用时回退到旧日期。
  - 更新 `index.html` 主脚本 query 为 `20260615-site-updates-maintenance`，减少线上继续加载旧 fallback 最近更新的可能。
  - 在项目上下文和专用 Skill 中补充：更新 `site-updates` seed 时必须同步 API seed、D1 schema 和本地 fallback 最近更新。

- 后台文章保存 500 修复：
  - 修复 Pages Functions 路由分发未 `await` 异步处理函数的问题，避免后台文章保存、后台权限检查和表单校验错误绕过统一 `try/catch`，被 Cloudflare 直接返回 1101 / HTTP 500。
  - 后台接口现在会正常返回 JSON 格式的 401 / 403 / 400 / 500 错误，便于前端显示真实原因。

- 独立管理后台与访问监控：
  - 新增 `/admin/` 中文管理后台，包含实时监控大屏、知识库文章管理、访问来源、点击埋点、聊天室管理、后台项目介绍和私有后台更新记录。
  - 新增 `functions/admin/_middleware.js`，后台静态资源也会复用主站账号 `lusu_session` 并校验 `users.role = admin`；非管理员只能看到后台登录/拒绝页。
  - 后台文章编辑支持按当前选择语言显示中文 / English / 日本語面板，但保存和发布时要求三语标题与正文齐全。
  - 新增访问与点击埋点接口：`/api/analytics/identify`、`/api/analytics/page-view`、`/api/analytics/click`，主站通过独立 `js/telemetry.js` 上报 PV、UV、地理来源和点击目标。
  - 新增后台统计接口 `/api/admin/analytics/overview`，按最近周期返回 PV/UV、今日点击、在线访客、国家/省份/城市/IP 前缀、热门页面、点击热点和最近事件。
  - 新增 HttpOnly `lusu_visitor` 隐藏访客 ID；前台不显示该 ID，聊天室公开接口继续返回本地 client id 用于“我的消息”显示，后台使用隐藏 visitor_id 做识别和禁言。
  - 聊天室后台新增消息编辑、隐藏/恢复、删除、按隐藏 visitor_id 或 IP hash 禁言；D1 新增 `chat_bans`、`site_visitors`、`analytics_page_views`、`analytics_click_events`。
  - 更新 `cloudflare/schema.sql`、`PROJECT_CONTEXT.md`、项目专用 Skill 和 README，记录后台权限、埋点隐私和后台更新记录不混入主站 `site-updates` 的规则。
  - 补齐根目录 README 的当前项目状态、后台、埋点与上线链路说明，并将首页右上角“最近更新日期”的静态兜底文本同步为 `2026.06.15`；实际显示仍由 `site-updates` / `content.updates` 自动计算。

- 首页四时段动态云层扩展：
  - 将 morning / dusk / night 也接入与 Day 相同的动态云层方式：各自使用 `assets/images/wallpaper-dynamic/<time>/base-clean.png` 作为无云底图，并叠加单朵独立透明云层。
  - morning / dusk 各拆出 7 朵中高空移动云，night 拆出 7 朵夜色云；低地平线云保留静态，避免移动后贴近地面或山坡。
  - 四个时间段的云层都改为按同一主风向慢速错相漂移，速度和相位逐朵打散，避免所有云一起移动或排布过于规律。
  - `?wallpaper=morning` / `?wallpaper=day` / `?wallpaper=dusk` / `?wallpaper=night` 均可强制预览对应动态壁纸，预览模式继续临时加快位移。
  - 更新 CSS / JS query 为 `20260615-all-clouds-natural`，减少缓存加载旧壁纸逻辑。
  - 更新 `PROJECT_CONTEXT.md` 和项目专用 Skill，记录四时段动态云层状态。

- 首页 Day 动态云层 MVP：
  - 首页 Day 时段改用 `assets/images/wallpaper-dynamic/day/base-clean.png` 作为无云 clean plate。
  - 接入 5 张独立透明云层 PNG，按 1672x941 舞台坐标定位，并用 CSS `transform` 做慢速、错相、同一主风向的横向漂移。
  - 将 Day 云层改为从原始 `day.png` 抠出的原尺寸云块，缩小云彩并下放位置，避免云层过大或过度贴近顶部。
  - 继续微调 Day 云层：顶部云进一步下移，所有云改为同一主风向下的错相漂移，速度只小幅加快，并打散左右位置避免过度对称。
  - 增加页面隐藏暂停和 `prefers-reduced-motion` / 小屏兜底：减少动态或移动端会回到原静态 Day 壁纸。
  - 新增本地预览参数 `?wallpaper=day`，可不受当前时间段限制直接查看 Day 动态云层；预览模式会临时加快云层位移以便肉眼确认动画。
  - 更新 CSS / JS query 为 `20260615-day-cloud-natural`，减少缓存加载旧壁纸逻辑。
  - 更新 `PROJECT_CONTEXT.md` 和项目专用 Skill，记录 Day 动态云层已从预留接口进入 MVP 状态。

- 首页 Day 动态云层资源草图：
  - 使用 imagegen 生成 Day 时段像素云层草图，保存到 `assets/images/wallpaper-dynamic/day/`。
  - 将云层拆分为 5 张独立透明 PNG，并额外生成蓝底预览图用于检查云层高度、像素边缘和后续独立移动分层。
  - 生成 Day 时段 `base-clean.png` 无云底图，作为后续动态云层叠加的 clean plate。

- 首页动态壁纸实验回退：
  - 移除本地云层、树、水面反光和电视小女孩相关测试逻辑与生成素材。
  - 首页恢复为四时段静态像素壁纸，只保留既有 `wallpaper-root` / `wallpaper-stage` 舞台和预留 layer 结构。
  - 本地仓库分支清理为只保留 `main`。

## 2026-06-14

- 知识库长文阅读体验优化：
  - 知识库阅读窗口改为随浏览器视口扩展，长文章在桌面端可使用更多宽度和高度。
  - 文章详情公开地址支持 `/articles/<slug>`，便于通过域名直接分享和访问单篇文章链接；内部 `article_id` 不在公开链接和公开 API 中外显。
  - Markdown 渲染补充有序列表、文章图片和 `text` 代码块蓝色说明框，修复长编号列表被挤成一行的问题。
  - 为《从提问到上线：普通人如何用 AI Agent 放大执行力》加入 Codex 与 GPT 聊天截图，并同步写入 zh / en / ja 三语 seed。
  - 新增 `_redirects` 规则，让 Cloudflare Pages 直接访问 `/articles/*` 时返回主页面并由前端加载文章详情。
  - 更新 CSS / JS 资源 query 为 `20260615-article-direct-paths`，减少线上缓存继续加载旧阅读样式的可能。

- 知识库发布《从提问到上线：普通人如何用 AI Agent 放大执行力》：
  - 检查并修正终版文章的 Markdown 格式、中英文空格、大小写和个别易误解表述。
  - 新增 zh / en / ja 三语文章 seed，分类为 AI，并设为置顶文章。
  - 新增同日三语网站更新记录文章，便于首页最近更新展示。

## 2026-06-12

- 首页壁纸清晰度修复：
  - 将 `assets/images/wallpapers/` 下的 morning / day / dusk / night 四张首页实际加载壁纸替换为用户提供的 `1672x941` 高清原图，避免全屏时继续放大半尺寸底图。
  - 首页壁纸舞台比例从 `836 / 470` 更新为 `1672 / 941`，并为底图启用像素渲染，减少浏览器平滑缩放造成的发糊。
  - 更新壁纸 URL、CSS 和 JS query 版本为 `20260612-hd-wallpapers`，并补充三语网站更新记录 seed。
- Life Restart 英语启动修复：
  - 修复《人生重开模拟器》切换 English 后仍显示中文的问题；上游启动参数读取 `language=en-us`，不是本站游戏外壳默认的 `lang=en-us`。
  - `games/game-shell.js` 新增按游戏配置选择语言 query 参数名的能力，`games/catalog.json` 为 `life-restart` 配置 `languageQueryParam: "language"`。
- Life Restart 本地静态接入：
  - 拉取并构建 `VickScarlet/lifeRestart`，构建链路为 `npm.cmd install`、`npm.cmd run xlsx2json`、`npm.cmd run build`，产物目录为上游 `template/public`。
  - 新增 `games/life-restart/`，将构建产物部署到 `games/life-restart/source/`，并通过统一 `games/game-shell.js` 外壳加载，不做外部跳转入口。
  - 更新 `games/catalog.json`，新增 Life Restart 卡片，标明中文 / English 支持、日本語暂不支持；日语站点入口默认启动 English。
  - 补充 lifeRestart 本地存档键 `theme`、`times`、`extendTalent`、`ATLT`、`AEVT`、`ACHV`、`uniqueWaTaShi`，用于本地导入导出和登录后的云存档同步。
  - 调整 `games/game-shell.js` 的语言 fallback：当前语言不支持时优先启动 English，再 fallback 到中文。
  - 更新 `PROJECT_CONTEXT.md`、`README.md` 和项目专用 Skill，记录 lifeRestart 后续升级构建和存档键检查注意事项。
- 2048 和 Hextris 遮罩显示修复：
  - 为两个游戏的结束/继续遮罩补充 `.overlay[hidden] { display: none; }`，避免 `.overlay { display: grid; }` 覆盖浏览器默认 hidden 样式，导致新局也一直显示“继续玩”或“游戏结束”。
  - 为两个游戏内页的 `styles.css` 引用增加 `20260612-overlay-hidden-fix` query，减少线上继续加载旧游戏样式缓存的可能。
- 首页四时段壁纸重制：
  - 使用 image2 参照用户提供的四张四时段像素壁纸重新制作 `morning.png`、`day.png`、`dusk.png`、`night.png`，保持原构图和 `836x470` 站点尺寸。
  - 删除四张图中电视机屏幕里的雪花/噪点，改为干净的深色玻璃屏，并优化四个时段的整体配色。
  - 更新壁纸 URL 与首页 CSS query 版本为 `20260612-clean-tv-wallpapers`，减少线上继续显示旧壁纸缓存的可能。
- 首页标题文案微调：
  - 删除首页主标题下方的英文副标题 `LuSu's Personal Site`，只保留站点标题和“开发施工中”文案。
- 游戏、聊天室和知识库读取优化：
  - `2048` 和 `Hextris` 的站点外壳只同步历史最高分，不再把当前对局、结束状态或语言键写入云存档；检测到旧云端数据时会静默合并最高分，不再弹出恢复对局确认。
  - 匿名聊天室消息时间去掉本机时区/地区名称，当天只显示时间，旧消息显示日期和时间。
  - 首页壁纸主文案改为“开发施工中”。
  - 知识库文章详情增加前端内存缓存，并让文章 seed 数据每个边缘运行实例只初始化一次，减少重复进入详情页和连续读取时的等待。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260612-game-chat-article-fix`，减少线上浏览器继续加载旧逻辑的可能。
- 首页时间壁纸与游戏可玩性修复：
  - 新增 `homepage-morning.png`、`homepage-day.png`、`homepage-evening.png`、`homepage-night.png` 四张首页像素壁纸，并按用户本地时间自动切换：早上 6:00-10:00，白天 10:00-16:00，傍晚 16:00-19:30，晚上 19:30-次日 6:00。
  - 首页欢迎弹窗问候语改为使用同一套本地时间分段，页面停留时会随底部时钟刷新同步检查时间主题。
  - 知识库文章发布日期继续按用户本地时间显示到秒，但不再显示本机时区名称。
  - `2048` 和 `Hextris` 恢复本地或云端存档时，如果读到已结束或不可继续的局面，会自动开启新局，避免进入后直接显示继续玩/游戏结束遮罩。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260612-time-wallpaper-game-fix`，减少线上缓存继续加载旧资源的可能。
- 首页四时段静态像素壁纸接口：
  - 使用 image2 / imagegen 重新绘制一张四时段统一构图母版，并裁切为 `assets/images/wallpapers/morning.png`、`day.png`、`dusk.png`、`night.png` 四张清晰基础壁纸。
  - 首页壁纸和欢迎弹窗问候语统一使用新时间段：05:00-10:59 morning，11:00-16:59 day，17:00-19:59 dusk，20:00-04:59 night。
  - 首页保留 `wallpaper-root` / `wallpaper-stage` 舞台和云、树冠、电视雪花、小女孩、星星、水面光效等 layer DOM/class，供后续新线程继续做动画。
  - 当前所有动画 layer 默认关闭，不显示电视雪花、云、树冠、星星或水面动效；页面只展示四时段静态底图。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260612-static-wallpaper`。
  - 底图与后续动画层会使用同一套 cover 裁切尺寸，避免后续电视雪花等小图层随视口错位。

## 2026-06-11

- 时间、知识库和窗口尺寸整理：
  - 知识库文章发布时间和匿名聊天室消息时间统一按用户所在时区显示，并显示到秒；旧消息/文章会带本机时区名，避免把 UTC 时间误读成本地时间。
  - 从文章详情关闭知识库后会清空当前文章状态，再次打开知识库时回到知识库首页。
  - 关于我窗口改为更紧凑的尺寸；知识库、视频区、资源区、游戏区、杂谈区保持更统一的普通内容窗口大小，匿名聊天室继续使用专用尺寸。
  - 首页中文视频区、资源区、杂谈区三个入口由“施工中”改为“待定”，英文/日文同步改为 TBD / 未定，并放宽桌面图标标题区域以尽量显示完整。
  - 新增网站更新记录文章 `2026-06-11-time-window-library-fix`，同步写入 zh / en / ja 三语 seed；更新 `index.html` 的 CSS / JS query 为 `20260611-time-window-library-fix`。

- 游戏区本地直玩整理：
  - 检查游戏区外部入口后，保留可静态部署到本站的 `2048` 和 `hextris`，并新增 `games/2048/`、`games/hextris/` 本地游戏目录。
  - `2048` 和 `hextris` 均接入统一 `games/game-shell.js` 外壳，支持本地 JSON 导入导出、登录后的云存档同步、站点语言参数启动和移动端界面适配。
  - `games/catalog.json` 收敛为猫国建设者、小黑屋、2048、Hextris 四个本地入口，不再跳转外部站点。
  - 删除游戏区目录中的 Life Restart、修仙类 AI/后端项目、Freeciv-web、OpenTTD 等外部入口展示；这些项目当前需要外部服务、构建链路、后端或原生客户端，不适合直接作为本站静态游戏部署。
  - 更新 `js/main.js` 最近更新记录，并将 `index.html` 的主脚本 query 调整为 `20260611-local-games`，减少线上继续加载旧游戏目录脚本的可能。

- 站点图标统一：
  - 使用桌面“关于我”入口同款电视头像作为统一母版，重新导出顶部标题图标 `lusu-tv-head-64.png`、浏览器图标 `favicon-32.png` 和 `apple-touch-icon.png`。
  - 保持三个资源各自尺寸适配不同场景：标题栏小图标 64px、favicon 32px、移动端收藏图标 180px。
  - 为 favicon、apple touch icon、顶部标题图标以及 CSS / JS 资源引用加入 `20260611-unified-tv-icon` query，减少浏览器继续使用旧图标缓存的可能。

- 视频区双排卡片错位修复：
  - 将视频区专用 `.video-grid` 从 CSS Grid 改为 flex 换行布局，避免第二排卡片被上一排内容高度误伤而插入第一排卡片内部。
  - 桌面端保持三列卡片，中等屏幕改为两列，移动端改为单列，第二排始终从上一排完整卡片下方开始。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260611-video-flex-wrap-fix`，减少线上缓存继续加载旧视频区样式的可能。

- 首页欢迎弹窗最近更新显示修复：
  - 修复最近更新列表项按钮被父级网格压缩到图标列的问题，恢复标题、摘要和日期显示。
  - 为最近更新按钮和文本列补充 `min-width: 0` 与跨列布局，避免小窗口下文字再次被挤没。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260611-welcome-updates-fix`，减少线上缓存继续加载旧样式的可能。

- 桌面“关于我”图标抠图修复：
  - 新增 `assets/images/lusu-tv-head-desktop-icon.png` 作为桌面图标专用头像资源，在右下角保留更大的透明安全边距，避免电视外壳和阴影看起来被裁掉。
  - 将桌面 `.avatar-icon` 改为引用专用图标资源，并保持 `90px` 显示尺寸，保留右侧电视厚度和桌面入口辨识度。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260611-icon-crop-fix`，减少线上缓存继续加载旧图标样式的可能。

- 视频区网格排版修复：
  - 为视频区单独取消通用卡片网格的等分行高，避免“全部”分类下多张视频卡片互相挤占高度。
  - 视频分类只剩一张卡片时不再被强制拉满整个列表区域，保持与多卡片状态一致的自然卡片高度。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260611-video-grid-flow-fix`，减少线上缓存继续加载旧样式的可能。

- 首页、知识库、视频区和聊天室显示修复：
  - 匿名聊天室当天消息只显示时分秒，非当天消息显示日期 + 时间。
  - 知识库删除顶部“返回桌面 / 刷新 / 路径”工具栏，为文章区域释放更多高度。
  - 知识库详情页隐藏左侧分类栏，只在知识库列表首页显示分类。
  - 知识库文章详情的标题、简介和正文合并到同一个阅读面板，避免拆成两个视觉模块。
  - 视频区卡片统一缩略图比例、卡片高度、标题/简介槽位和按钮位置，修复同排大小不一和位置重叠。
  - 首页桌面图标去掉蓝色底框并整体下移，避免图标靠上和显示不全。
  - 首页文案、桌面图标和各板块标题栏禁止鼠标选中，减少误选中文本影响沉浸感。
  - 首页三个建设中入口恢复“施工中 / Developing / 開発中”文案，并保持单行显示。
  - 首页欢迎弹窗最近更新固定显示最近 5 篇 `site-updates` 文章，不再无限拉长或出现内部滚动条。
  - 新增真实网站更新记录文章 `2026-06-11-knowledge-video-home-fix`，一次性写入 zh / en / ja 三语标题、简介和正文。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260611-knowledge-video-home-fix`，减少线上缓存导致的显示不一致。

- 游戏区扩展、文章时间和首页排版修复：
  - 知识库文章列表和详情页的发布时间从日期改为显示到时分秒。
  - 首页欢迎弹窗右侧“最近更新”改为最多显示 4 条，限制列表高度，并在 D1 文章暂不可用时回退到本地更新数组，避免弹窗被长内容撑高。
  - 新增真实网站更新记录文章 `2026-06-11-game-library-time-layout`，一次性写入 zh / en / ja 三语标题、简介和正文。
  - 游戏区新增人生重启模拟器、我的文字修仙全靠刷、修仙世界模拟器、仙途、React 修仙小游戏、万界道友、2048、Hextris、Freeciv-web、OpenTTD 等开源项目入口。
  - 游戏区保留猫国建设者和小黑屋内置入口，并将人生重启模拟器、猫国建设者、小黑屋等多语言支持游戏优先排在最上方。
  - 游戏卡片新增外部开源项目打开能力，显示中文 / English / 日本語支持状态，并随站点语言切换卡片标题和简介。
  - 首页主标题、英文副标题和桌面图标文案缩短，字号和单行显示策略调整，优先保证图标排版。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260611-game-library-time-layout`，减少线上缓存导致的显示不一致。

- 同步部署与页面显示修复：
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260611-sync-layout-chat`，减少本地已提交但线上浏览器继续加载旧资源导致的显示不一致。
  - 视频区和资源区卡片改为固定缩略图比例、固定按钮高度、固定标题/简介行数和一致网格行高，修复“全部”和分类页卡片错位、拉伸、按钮贴边或不可见的问题。
  - 首页桌面图标中“视频区 / 资源区 / 杂谈区”新增三语“建设中 / Under construction / 工事中”标记，任务栏和窗口标题保持原名称。
  - 小黑屋 `a-dark-room` 新增本站语言覆盖脚本，补齐 Penrose 事件中文和日文缺失文案，避免事件弹窗正文继续回退英文。
  - 知识库 seed 清理三篇测试文章：`xp-site-notes`、`local-ai-workflow`、`fallback-check`；线上请求文章接口时会同步删除 D1 中已有测试数据。
  - 知识库文章详情增加 slug + 请求语言缓存和请求状态保护，避免频繁切换语言后重复拉取并卡在“读取中”。
  - 新增真实网站更新记录文章 `2026-06-11-sync-layout-chat`，一次性写入 zh / en / ja 三语标题、简介和正文。
  - 匿名聊天室轮询改为自适应增量拉取：首次加载最近消息，后续保持 `after/message_id`，有新消息 5 秒刷新，无新消息逐步降到 15 秒和 30 秒，页面后台时降频，用户发送后立即刷新一次。
  - 同步更新 `PROJECT_CONTEXT.md`、项目专用 Skill 和 Skill README，补充部署后必须核对 GitHub main、Cloudflare 最新成功部署 commit、线上 CSS/JS query 版本的规则。

- 收尾并改造网站更新记录：
  - 保留并完善 `/api/saves/:gameId` 未登录和游戏编号校验，未登录时显式返回 JSON 401/400，避免线上返回 Cloudflare 1101。
  - 知识库新增 `site-updates`（网站更新记录）分类，并在分类列表中排在最后。
  - 新增一篇“网站更新记录接入知识库”真实文章，三语写入 zh / en / ja，包含主标题、简介和正文。
  - 首页欢迎弹窗右侧“最近更新”改为自动读取知识库 `site-updates` 分类文章，标题和简介过长时省略，可点击跳转文章详情。
  - 首页欢迎弹窗“查看更多更新”改为跳转知识库并筛选“网站更新记录”分类。
  - 首页欢迎弹窗左侧改为站长施工公告，替换原来的更新介绍区域。
  - 视频区和资源区改进内部滚动、卡片高度、简介行数和按钮间距，避免按钮被长简介挤出或贴边。
  - 文章详情渲染时会去掉与详情标题重复的 Markdown 开头标题，避免标题和简介重复显示。
  - 默认语言改为优先跟随浏览器/系统语言；用户手动切换语言后会保存选择，直到再次切换。
  - 将每次合并/上线必须发布 `site-updates` 三语文章的规则补充到项目专用 Skill 和 README。
- 新增数据库化三语文章系统第一阶段：
  - Cloudflare D1 新增 `articles` 和 `article_translations` 两张文章表，文章通用信息与 zh / en / ja 三语内容分表保存。
  - `users` 表新增 `role` 字段，Pages Functions 启动时会为旧表自动补列；后台文章管理接口仅允许 `role = admin` 的用户访问。
  - 新增公开接口 `GET /api/articles?lang=zh|en|ja` 和 `GET /api/articles/:slug?lang=zh|en|ja`，按当前语言读取文章，缺失时回退到中文，再回退到任意已有语言。
  - 新增基础后台接口 `GET /api/admin/articles`、`POST /api/admin/articles`、`PUT /api/admin/articles/:articleId`、`DELETE /api/admin/articles/:articleId`，不包含自动翻译、翻译按钮或 retranslate 接口。
  - 后台发布文章时要求一次性提供 zh / en / ja 三种内容；正文以 Markdown 保存。
  - 知识库区域改为从 D1 读取文章列表和文章详情，网站切换语言时会重新请求对应语言版本。
  - 前端 Markdown 详情使用安全 DOM 构造和 `textContent` 渲染基础 Markdown，不直接把正文作为未处理 HTML 插入。
  - `cloudflare/schema.sql` 加入三篇测试文章，其中两篇包含完整 zh / en / ja，另一篇仅中文用于验证 fallback。
  - Pages Functions 的文章接口会幂等补入同一批测试文章，避免远端 D1 尚未手动 migration 或边缘运行态已建空表时线上文章列表为空。
  - 更新首页 JS 资源 query 版本号，避免浏览器继续加载旧知识库逻辑。
  - 将数据库化三语文章系统的长期维护规则同步补充到项目专用 Skill 和 README。
  - 为 `/api/saves/:gameId` 增加显式未登录和游戏编号校验响应，避免线上未登录冒烟测试返回 Cloudflare 1101。
- 永久化更新日期和缓存踩坑规则：
  - 右上角“最近更新日期”改为从 `content.updates` 最大日期自动生成，不再依赖手动维护的写死常量。
  - 将 JS / CSS / 强视觉资源变更必须同步更新资源 query 版本号的规则补充到项目专用 Skill 和 README。
- 修复线上更新可见性：
  - 将站点右上角“最近更新日期”同步更新为 `2026.06.11`。
  - 欢迎弹窗的最近更新列表新增游戏区卡片整理记录。
  - 更新首页 CSS / JS 资源版本号，避免浏览器继续加载旧缓存导致线上看起来没有变化。
- 调整游戏区卡片显示：
  - 删除游戏简介里“跟随网站语言载入”的说明。
  - 删除游戏卡片底部的英文游戏名和许可证标签，只保留语言支持标记。
  - 将游戏区窗口恢复为随内容收缩的尺寸，游戏列表后续内容较多时在列表内部纵向滚动。
- 调整聊天室、二级窗口和欢迎弹窗：
  - 聊天室新增 `GET /api/chat/nickname`，首次进入时按近期/已有聊天室昵称分配未占用的随机昵称。
  - 聊天室发言接口会阻止不同访客继续使用已被占用的昵称，前端遇到昵称冲突时会自动领取新昵称。
  - Pages Functions 新增账号、会话和游戏存档核心表的 D1 schema guard，避免本地空 D1 环境下 `/api/health` 直接失败。
  - 知识库、视频区、资源区、游戏区、杂谈区和关于我窗口改为固定在可视区域内，内容过多时使用窗口内部滚动条，避免整个浏览器页面滚动。
  - 知识库、视频区、资源区、杂谈区当前测试内容标题新增“占位符”标识，并同步中文 / English / 日本語 文案。
  - 欢迎弹窗标题改为“欢迎”，左侧主标题改为根据当前系统时间显示早上好 / 中午好 / 下午好 / 晚上好和当天日期。
  - 更新首页 CSS / JS 版本号，减少线上缓存继续加载旧资源的可能。
  - 更新 `PROJECT_CONTEXT.md` 的聊天室说明和接口清单。
- 整理项目文档结构：
  - 将 `PROJECT_CONTEXT.md` 精简为项目总说明，保留项目背景、项目介绍、技术栈、部署方式、主要功能、文件结构、本地开发方式、账号、云存档、聊天室、游戏区等核心信息。
  - 将长期维护规则、强约束和踩坑点拆分到 `skills/lusu-personal-site-skill/SKILL.md`。
  - 在 `PROJECT_CONTEXT.md` 保留项目专用 Skill 索引，方便新对话定位规则来源。
- 新增项目专用 Skill：
  - 新增 `skills/lusu-personal-site-skill/SKILL.md`，Skill 名称为「鲁肃个人网站专用Skill」。
  - 规则覆盖 CHANGELOG / PROJECT_CONTEXT 更新要求、XP Pixel Art Y2K 风格、三语文案、移动端适配、聊天室纯文本渲染、只美化不动功能、Cloudflare Pages Git 自动部署等约束。
- 新增 Skill 说明文档：
  - 新增 `skills/lusu-personal-site-skill/README.md`，说明 Skill 用途、当前规则清单和后续维护方式。
  - 约定后续 Skill 规则变化时同步更新 README。
- 新增游戏语言维护规则：
  - 后续新增游戏时，必须在游戏标签或信息里标明中文、English、日本語是否支持。
  - 网站切换语言时，游戏区优先展示对应语言。
  - 如果游戏不支持当前语言，默认启动英语版本。

## 2026-06-10

- 修复聊天室短消息和桌面图标细节：
  - 自己发送的短文本气泡改为右对齐，贴近自己的昵称和头像。
  - 统一桌面图标视觉尺寸，压小匿名聊天室图标，放大杂谈区和游戏区图标。
  - 更新首页 CSS 版本号，避免线上继续使用旧样式缓存。
- 将聊天室窗口标题从 `XP 匿名聊天室 - LuSu's Chat Room` 简化为 `匿名聊天室`，并更新 `main.js` 版本号避免旧缓存。
- 修复聊天室上线后的域名缓存与界面问题：
  - `index.html` 为 `js/main.js` 增加版本号，避免 `lusu575.com` 继续使用旧 JS 导致 `navChatroom` 不翻译、聊天室入口点击无效。
  - 新增 `assets/images/icon-chatroom-clean.png`，替换带蓝色底色的聊天室图标资源。
  - 调整聊天室桌面图标尺寸，和现有桌面图标更一致。
  - 优化聊天室消息布局，让头像、发送人和消息气泡更紧凑，并强化自己的消息与他人消息的左右和颜色区分。
  - 任务栏「杂谈区」图标改为记事本图标，「匿名聊天室」改为小聊天室图标，避免两个入口使用同一个气泡图标。
- 新增「XP 像素风匿名聊天室」MVP。
- 新增桌面图标、任务栏入口和 `chatroom` 页面，风格参考 Windows XP / Pixel Art / Y2K 聊天窗口。
- 新增 `assets/images/icon-chatroom.png`，由用户提供的聊天室图标参考图裁切制作。
- 新增三语文案：中文 / English / 日本語。
- 前端支持未登录访客直接发言、随机昵称、昵称本地保存、昵称修改、300 字限制、3 秒发送冷却、首次加载最近 100 条、5 秒轮询新增消息、页面恢复激活立即刷新。
- 前端聊天内容使用 DOM `textContent` 纯文本渲染，避免把用户内容作为 HTML 插入。
- Cloudflare Pages Functions 新增：
  - `GET /api/chat/messages`
  - `POST /api/chat/messages`
- Cloudflare D1 schema 新增 `anonymous_chat_messages` 表，字段包含 `message_id`、`visitor_id`、`nickname`、`content`、`created_at`、`hidden`、`ip_hash`。
- 后端新增 visitor_id 3 秒限速、IP hash 每分钟基础限流、昵称和消息长度校验、单次最多返回 100 条消息。
- 聊天室接口增加 D1 schema guard：如果本地或首发环境尚未迁移聊天室表，会自动执行 `create table if not exists`；正式上线仍建议执行 D1 migration。
- 更新 `PROJECT_CONTEXT.md`，加入每次修改后维护 `CHANGELOG.md` 的约定。
