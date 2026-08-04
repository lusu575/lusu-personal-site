# 鲁肃个人站管理后台专用 PROJECT_CONTEXT

> 管理后台专用说明：本文档只描述 `/admin/` 管理后台。它不等同于主站根目录 `PROJECT_CONTEXT.md`，也不能替代主站项目上下文。新的 AI / Codex 对话如果只维护后台，应先读本文档和 `admin/docs/ADMIN_SKILL.md`；如果维护主站整体，仍以根目录 `PROJECT_CONTEXT.md` 和 `skills/lusu-personal-site-skill/SKILL.md` 为准。

## 2026-08-02 免费额度余量保护

- “流量与写入”默认阈值收紧为 30,000／50,000 站内估算行；正常档页面／点击／文章为 100%／100%／100%，预警档为 25%／10%／50%，硬保护档为 0%／0%／10%。按当前 D1 Free 的 100,000 rows-written／UTC 日口径，硬保护线为登录、云存档、Chat、Transfer、Whiteboard 和内容管理等必要业务保留至少一半写入余量。
- 迁移只对仍精确等于旧 60,000／80,000 默认 JSON 的记录执行 compare-and-swap；管理员保存过的自定义开关、阈值和采样率不覆盖。Fresh schema、API fallback、后台默认输入与测试必须继续保持一致。
- “低写入预案”现在填入 20,000／35,000 阈值，正常档为 50%／25%／75%，预警档为 10%／0%／25%，硬保护档全为 0%；它仍只填表、不自动保存。任何档位都不得自动关闭账号、存档、Chat、Transfer、Whiteboard 或管理员内容写入。
- 后台主脚本 query 为 `20260802-traffic-budget-r1`；CSS 未改，保持 `20260801-service-reliability-r1`。Cloudflare 官方 `rowsWritten` 规则不变：只有只读 Analytics 连接真实成功时显示，未配置或失败不能用站内估算或零值冒充。

## 2026-08-01 流量与 D1 写入保护面板

- 主后台在“点击埋点”之后新增“流量与写入”panel，打开时每 30 秒刷新。它展示 UTC 当日站内可识别写入估算、页面／点击／文章／登录事件构成、保护阈值、下一次 UTC 重置和当前正常／预警／硬保护状态。
- 默认阈值为 60,000／80,000 估算行；正常档页面／点击／文章均 100%，预警档为 50%／25%／75%，硬保护档为 10%／0%／25%。另提供总开关、访客识别、页面、点击、文章和自适应保护开关，以及只填入不自动保存的低写入预案与默认值恢复。
- 配置使用 `GET/PUT /api/admin/traffic-control`，继续要求 `lusu_session + users.role = admin`。D1 key 为 `site_runtime_state.traffic_control_settings_v1`；PUT 必须携带读取时的 `expectedUpdatedAt`，缺少返回 428，陈旧版本返回 409，前端保留当前输入。30 秒自动刷新只更新指标，不覆盖 dirty 表单。
- 自适应保护只作用于非必要 identify、page view、click 与 article view。登录、注册、云存档、Chat、Transfer 和 Whiteboard 业务路径不会被面板自动关闭；页面也不得提供会误导管理员删除生产数据或关停核心功能的一键动作。
- “站内估算”按现有 D1 限频桶、访客资料、原始事件和文章累计写入给出保守系数，但不是 Cloudflare 账单。可选官方区只有在 Pages Production 配置只读 Analytics Token、Account ID 和 D1 Database ID 后才显示 GraphQL `rowsWritten`；缺失显示“未连接”，失败显示真实错误。Token 不返回浏览器、不写日志／更新记录／文档值／Git。
- 当前后台 CSS／JS query 为 `20260801-service-reliability-r1`。

## 2026-07-30 在线画板治理面板

- `/admin/` 已在仓库中接入“在线画板治理”面板，继续复用现有 `lusu_session`、D1 `sessions` 和 `users.role = admin` 服务端鉴权，不新增画板专用管理员身份或公开管理入口。
- 概览展示房间总数、公共／密码房数量、当前连接、对象和资源容量；房间列表可查看房型、锁定状态、在线数、最后活动、空房删除时间及资源占用，并按需读取单房的连接与容量状态。
- 公共画板支持清空和只读／可编辑切换；房间治理支持移除单个异常连接或某匿名身份的连接，并按匿名 ID 或 IP 哈希设置有期限的临时封禁。空且异常的密码房可由管理员显式删除；公共房不能通过密码房删除入口移除。
- 后台只显示治理所需元数据和截断标识，不展示画布图形／文本正文、房间密码、完整匿名凭证、完整 IP 或可直接复用的完整 IP 哈希。确认框须说明对象和影响，清空、封禁、移除连接及删除房间均写管理审计。
- 对应接口为 `GET /api/admin/whiteboards/overview`、`GET /api/admin/whiteboards/rooms`、`GET /api/admin/whiteboards/rooms/:roomId/status`、`POST /api/admin/whiteboards/public/clear`、`PUT /api/admin/whiteboards/public/lock`、`DELETE /api/admin/whiteboards/rooms/:roomId`、`POST /api/admin/whiteboards/rooms/:roomId/kick` 和 `POST /api/admin/whiteboards/rooms/:roomId/ban`；每条路由都必须继续调用 `requireAdmin`。
- 当前记录只说明仓库代码与文档已经实现，不代表 Cloudflare external Durable Object binding、远端 D1 migration、独立 Worker、Pages 生产部署或正式域名已经验证。

## 2026-07-29 工具雷达正式周更与独立投递通道

- “自动投递”仍是一个后台 panel，但现在可在 `daily-ai-news` 与 `tool-radar` 两条通道间切换。两者的启用状态、auto-publish、凭证、地址和投递历史完全独立；切换通道时清除页面内只显示一次的令牌，不能把一条通道的明文或状态带到另一条。
- 工具雷达首期试稿已获站长确认，正式任务固定为北京时间每周二 22:00；每期目标 6–10 个、少于 3 个不投递。管理页只负责通道闸门与历史，不能绕过工作流的来源核验、三语、永久去重、图片语义与远程 SHA-256 门禁和最小数量校验。
- `POST /api/automation/tool-radar` 固定创建 `tool-radar`、非置顶的三语文章，并要求结构化 `tools[]`。服务端通过 `tool_radar_catalog.tool_key` 永久去重；目录登记、文章、翻译与投递事件必须原子完成，重复返回 409，不能残留半篇文章或部分目录。
- 已认证机器客户端可用 `GET /api/automation/tool-radar/catalog` 获取已收录工具身份后再选题；接口只返回去重所需目录，不返回令牌或后台配置。通道启用与 auto-publish 继续是两项独立显式闸门；当前生产自动公开只在两项均明确开启时生效，轮换或重建通道时仍应安全默认关闭。
- 主后台 CSS／JS query 仍为 `20260729-tool-radar-live-r1`；本次没有改变后台界面或通道 API。工具雷达图片规则已收紧为只能使用网上发现并回到官方来源核实的真实产品界面、官方案例或真实成果，自绘／生成／统一模板图全部禁止；资产仍先随 GitHub `main` 经 Cloudflare Pages 部署，机器投递再逐张验证线上 SHA-256。

## 2026-07-28 每日 AI 新闻生产自动公开规则

- 站长已明确授权正式每日运行：仅 `daily-ai-news` 专用通道在显式 auto-publish 配置启用时可自动公开。机器调用方仍不可提交发布状态；未启用时继续只创建草稿。
- 每天按北京时间 07:00 启动，使用严格的 `[前一日 07:00, 当日 07:00)` 精确 24 小时窗口。Horizon 抓取、编辑复核、三语校验、投递与受控公开都必须在 08:00 前完成；08:00 后不得补发。无合格稿、来源／格式／三语验证失败、令牌或通道校验失败、冲突未安全处理、Horizon 不可用或超时，均关闭本期且不公开。
- 2026-07-28 短稿复盘发现 Horizon 窗口内实际有 383 条候选，只有两条进入成稿是覆盖审阅缺口，不是抓取总量不足。正式 schema v4 因此要求 candidate index、coverage manifest、required query／entity group 签收；初选少于 5 条必须做低产量第二轮审阅，但不设最低条数、不允许凑数。可靠来源不受语言限制，发现层用多语别名补齐重点模型厂商及芯片／光刻／存储、机器人、智能设备、数据中心与科技金融。
- 修复后的同窗口正式复跑得到 863 条候选并选出 8 条，线上同 slug 三语文章已原位修订并保留原发布时间。发现查询把真实空结果与抓取／解析失败分开；有界重试后仍失败必须关闭本期。candidate index 的指纹必须来自实际写盘的确定性 UTF-8 字节，避免 Windows 换行转换导致验证失败。
- `runs/2026-07-28-coverage-revision.json` 的 coverage manifest v1 是 v2 落地前生成、按固定 run／路径／SHA-256 登记的唯一 schema v4 历史兼容例外；不得复制或改成其他运行。后续正式运行必须使用 manifest v2 并提供完整 `priorityReview`。
- `horizon.config.json` 已指向本地 Ollama `qwen3.6:27b`，但当前正式入口只执行 Horizon 抓取、来源重试与跨源去重，不调用原生 AI 评分或富化；本地模型目前不是 07:00–08:00 生产链路的硬依赖，仓库也不保存云端模型密钥。
- 投递前的跨日去重按 `eventKey + eventStage` 执行；同一事件的正式发布、开放权重等实质新阶段可在记录前序故事和 material difference 后作为更新处理。覆盖签收、低产量补查或 material update 证明不完整都属于验证失败，必须在 08:00 前关闭本期，不得绕过校验直接公开。
- 2026-07-27 样稿用于生产链路测试，不能绕过 Horizon 来源证明、令牌、限流、幂等、slug 冲突或失败关闭规则。暂停通道、撤销令牌或关闭 auto-publish 必须立刻关闭公开路径。

## 2026-07-27 每日 AI 新闻本地试运行

- `自动新闻/integrations/lusu-site/` 已增加个人站适配层。Horizon 是必经数据入口，真实负责多源抓取、网址规范化和跨来源去重；Codex 只在当次 Horizon 候选上按北京时间自然日、重要性与近 30 天记录收口。Horizon 不可用时停止，不能静默改成手工采集。
- 最终稿固定生成 zh / en / ja 三语完整文章，正文不放外链、参考资料、来源列表、评分或“阅读全文”跳转；来源只留在内部运行记录中供核验。
- 2026-07-27 Horizon 稳定实跑取得 113 条合并后候选，并筛出北京时间当日 74 条；真实样稿保留四件事并通过来源反查、日期、去重、三语和无外链检查。此前写入本地 D1 的两条消息稿是接入 Horizon 前的规则试投，仍为 `draft` 且未发布；2026-07-27 样稿改作生产链路测试输入。
- 每天定时运行与受控自动公开已获授权，具体边界以本文件顶部 07:00–08:00 生产规则为准。主后台 JS query 为 `20260728-daily-ai-news-production-r1`，CSS query 不变。

## 2026-07-27 每日 AI 新闻受控投递

- 主后台新增“自动投递”模块，导航位于“知识库文章”之后，固定管理 `daily-ai-news` 通道。页面可启用／暂停入口、复制投递地址、生成／轮换／撤销令牌、查看最近事件，并跳转到知识库文章列表审阅草稿。
- 完整令牌只在生成或轮换响应中返回一次；服务端只保存 SHA-256 摘要和末尾提示，后台刷新后不能恢复明文。撤销令牌会同时暂停通道。
- 机器入口 `POST /api/automation/daily-ai-news` 不使用管理员 cookie，而使用专用 Bearer 令牌。它固定创建 `daily-ai-news` 分类、非置顶、无封面的 zh / en / ja 三语文章；分类、状态、置顶等字段由服务端固定，不能由调用方覆盖。默认保存为无发布时间的草稿，只有专用通道的显式 auto-publish 配置开启时才创建已公开文章并写入公开时间。
- `article_delivery_channels` 保存通道开关、令牌摘要和 revision；`article_delivery_events` 保存幂等请求、规范化内容指纹、结果、文章引用和必要错误摘要，不保存文章正文或令牌。相同幂等键只有在指纹一致且原草稿仍存在时才能成功重放；内容变化或原稿已删除时返回冲突。未鉴权请求只初始化轻量通道表，通过令牌与启用状态校验后才准备文章 schema 和 seed。入口同时受请求体上限、来源／通道限流、幂等和 slug 冲突保护。
- 本机 Codex 定时任务 `ai-7-8` 已启用，每天北京时间 07:00 启动；受控自动公开已获授权，但不因此新增或保存模型／搜索／第三方密钥，也不会创建其他计划任务。站长仍可在“知识库文章”中检查草稿；关闭 auto-publish、暂停通道、撤销令牌、失败或超时后只允许保留草稿或失败事件，不能公开。主后台 CSS query 为 `20260727-daily-ai-news-inbox-r1`，JS query 为 `20260728-daily-ai-news-doc-sync-r1`。
- 本地 D1 迁移、静态构建和 300 / 300 项全量测试通过；只读核对确认测试文章三语齐全，投递通道暂停且没有令牌。没有启动长期服务、连接生产 D1、推送或部署。

## 2026-07-26 并发编辑与互传治理

- `GET /api/admin/articles/:id` 的 `article.updated_at`、视频／分类行的 `updated_at`、`GET /api/admin/social-links` 的顶层 `updatedAt` 是后台编辑基线。PUT、视频元数据刷新和 DELETE 必须提交 `expectedUpdatedAt`；主记录、文章翻译和视频分类关系原子受版本条件保护。陈旧版本统一返回 `409 + CONTENT_CONFLICT`，页面保留当前输入并提示人工合并。
- `GET /api/admin/transfer/settings` 返回 `settings.updatedAt`。设置保存和两个上传开关必须提交 `expectedUpdatedAt`；缺少版本返回 `428 TRANSFER_SETTINGS_VERSION_REQUIRED`，陈旧版本返回 `409 TRANSFER_SETTINGS_CONFLICT`，成功后以服务端新 revision 作为下一次基线。
- 互传清空房间与清理任务只有全部对象完成才返回 2xx；部分 R2 失败返回 502，并保留 `failed` / `failures` / `retry`。简单上传和 Multipart 完成会核对 D1 changes；记录被并发删除时清理刚写入对象，ready 竞态赢家存在时保留有效对象。
- Transfer 管理页维护真实 dirty / `beforeunload` / 站内离开保护、可访问上下文确认、全局 mutation lock、Abort + generation 搜索、分区加载降级、部分失败重试与可键盘滚动表格。主后台内容编辑沿用相同的草稿保留和冲突提示。
- 当前主后台 JS query 为 `20260726-admin-concurrency-safety-r1`，CSS 仍为 `20260719-admin-dirty-transfer-r1`；Transfer 管理脚本与页面缓存版本为 `20260726-admin-transfer-safety-r1`，共享生产图集仍为 `20260718-resource-icons-layout-r1`。

## 2026-07-26 工具区显示名同步

- 主站公开栏目显示名固定为中文“工具区”、English “Tools”、日本語“ツール”；后台热门页面、访问路径和账号活跃中的该路由中文名也显示为“工具区”。
- 内部稳定 route、hash、统计键与历史数据继续使用 `resources`，不得因显示改名破坏既有统计归组或旧链接。
- 当前后台 JS query 为 `20260726-admin-tools-label-r1`，CSS 仍为 `20260719-admin-dirty-transfer-r1`。

## 2026-07-19 公开文章与视频数据边界

- `site-updates` 只用于公开更新日志，后台文章 API 创建或更新该分类时必须强制 `is_pinned = 0`；客户端置顶复选框不能绕过服务端规则。其他文章分类继续允许置顶。
- 后台本地视频封面生成器会依次尝试 960×540、768×432、640×360，并受文本长度与服务端 320KB 上限约束；公开视频读取必须允许最大 960×540，避免后台保存成功但公开列表拒绝显示。
- 该批后台 JS query 为 `20260719-admin-public-content-r1`，CSS 为 `20260719-admin-dirty-transfer-r1`。

## 2026-07-19 未保存状态与互传文件治理

- 文章、视频、视频分类、聊天、账号和社交链接的离开保护由真实输入 / change 事件维护 dirty 状态；离开时不得重新把程序自动补入的默认排序、分类复选框或异步详情数据当成人工编辑。干净表单在相关数据加载完成后重建基线，真实编辑、保存失败与恢复流程继续保留提示。
- 主后台侧栏新增“互传文件管理”入口，打开仍受 `/admin/*` 中间件保护的独立 `/admin/transfer.html`；离开当前后台编辑模块前继续复用未保存保护。
- 互传文件列表展示文件名、发送账号、类型、大小、状态、保存时间和过期时间，支持搜索和分页。账号记录缺失时仍保留文件治理行，不因 inner join 隐藏实际占用。
- 管理员永久删除先删除私有 R2 对象，再删除 D1 `transfer_items` 记录并增加房间同步代次；R2 删除失败时保留 `delete_failed` 状态供清理任务重试，不能伪报空间已释放。
- 当前主后台资源版本为 `20260719-admin-dirty-transfer-r1`，互传管理脚本版本为 `20260719-admin-transfer-files-r1`；本轮只进入后台私有更新记录，不写入主站 `site-updates`。

## 2026-07-18 临时互传共享图集缓存同步

- `/admin/transfer.html` 与公开工具区（内部 `resources` route）/ Quick Transfer 共用 `assets/transfer/quick-transfer-icons.png`，当前生产图集为 168×168 RGBA 透明 4×4 atlas。
- 独立管理页的 `admin/transfer.css` 图集 query 与 `admin/transfer.html` 样式 query 已统一为 `20260718-resource-icons-layout-r1`，避免后台继续命中旧的洋红底色图集或包含旧 URL 的 CSS。
- 以后共享图集内容或版本变化时，必须同步检查公开 CSS、`admin/transfer.css` 内图集 URL 以及 `admin/transfer.html` 的样式 URL；构建检查会拒绝仓库运行时源码中不一致的图集 query。
- 本次只同步独立管理页的静态缓存链和后台专用文档，不改变管理 API、权限、D1、配额、清理或费用估算逻辑；后台私有记录不重复写入公开 `site-updates`。

## 2026-07-16 互动城市访问地图

- 实时大屏地图当前展示最近 14 天按国家、地区和城市精确分组的城市级聚合，只使用具备有效聚合经纬度的数据行；地图仍使用项目内本地世界轮廓，不请求第三方在线地图或瓦片。
- 世界底图由 `assets/images/admin-world-map.svg` 中的 Natural Earth 公共领域路径提供，后台通过真实 SVG `<use>` 引用 `#admin-world-map-scene`；城市点位是运行时创建的 SVG `<g>` / `<circle>`，不使用 CSS 伪元素绘制。
- 地图缩放 / 平移修改 `#visitor-map-svg` 的 `viewBox`，不会对 CSS 背景或地图 DOM 层执行 `transform: scale()`；100% 至 500% 均保持矢量渲染。城市圆点会按当前 viewBox 反算半径，确保可见大小和至少 44px 命中区不随缩放改变。
- 桌面端支持滚轮缩放、拖拽平移和点击 / 悬停城市点位；触屏支持双指缩放与拖动；键盘可聚焦城市点位并打开同一详情。点位和地图控件的触控目标至少 44px。
- 城市详情与替代数据列表展示城市 / 地区、PV 浏览量、UV 独立访客、聚合坐标和最近访问时间，不展示 IP、网络前缀、visitor id、hash 或其他隐藏标识。
- 当前后台资源版本为 `20260716-admin-svg-vector-map-r1`，地图资源版本为 `20260716-admin-world-map-svg-r1`；本轮是后台私有更新，不进入主站 `site-updates`。

## 2026-07-16 移动与操作安全基线

- 窄屏后台导航为固定分组抽屉，不占业务内容首屏；文章、视频、聊天室和账号采用列表 / 详情双态，并通过浏览器历史返回列表。移动端与粗指针主要操作命中区至少 44px。
- 文章、视频、聊天和账号编辑维护表单快照与未保存状态；切换模块、切换条目、新建、移动返回和刷新前均需走离开保护，保存失败不能丢失输入。
- 文章发布一次汇总 slug 及 zh / en / ja 标题、正文的全部错误，并可从摘要直接切换语言、定位字段；前端和后台 API 都要求三语正文完整。
- 删除、封禁、停用禁言和账号敏感修改统一使用上下文确认框；已发布文章删除必须输入路径标识。访问地图点位没有动作时保持非交互，并提供同数据地区列表。
- 账号模块加载后默认不选中任何账号；资料 / 角色与密码重置拆分。密码重置可选择撤销该账号既有会话，服务端原子条件更新保证最后一个管理员不能被降级。
- 当前后台资源版本为 `20260716-admin-safety-foundation-r1`。这些是后台私有事实，不进入主站 `site-updates`。

## 2026-07-16 临时互传管理

- 临时互传管理使用独立受保护页面 `/admin/transfer.html`，由主后台侧栏“互传文件管理”进入或直接打开；其 API 继续由服务端数据库角色鉴权，不能信任客户端管理员状态。
- 页面只展示治理所需元数据和用量，不默认预览用户内容，也不展示房间明文口令；危险操作必须确认并记录审计。
- 可监控普通用户免费池、管理员大文件任务、清理状态和站内费用估算，并可暂停普通上传、暂停全部上传、触发清理与测试告警。
- Cloudflare 官方 1/3/5 美元账单提醒、R2 binding、生命周期及清理 Worker 部署属于站长人工配置，站内估算不得冒充官方账单。

## 定位

- 后台名称：鲁肃个人站管理后台
- 后台入口：`/admin/`
- 本地页面：`admin/index.html`
- 临时互传管理页：`admin/transfer.html`
- 样式文件：`admin/admin.css`
- 前端逻辑：`admin/admin.js`
- 后台访问拦截：`functions/admin/_middleware.js`
- 后台 API：`functions/api/[[route]].js` 中的 `/api/admin/*`
- 主要用途：站长维护个人站内容、视频、关于我社交链接、访问统计、点击埋点、聊天室和在线画板治理。
- 文案范围：后台只使用中文文案，不进入主站中文 / English / 日本語 三语窗口体系。
- 更新范围：后台项目介绍和后台更新记录属于后台私有内容，不写入主站知识库 `site-updates`，也不公开展示到首页最近更新。

## 和主站的关系

- 后台和主站同属 `lusu575/lusu-personal-site` 仓库，同用 Cloudflare Pages Functions 和 D1。
- 后台复用主站账号系统、`lusu_session` HttpOnly cookie、`users.role = admin` 权限。
- 后台页面、样式、脚本和私有说明必须放在 `admin/` 或 `admin/docs/` 下，不混进主站首页窗口、主站 CSS 或主站三语文案体系。
- 主站公开更新记录继续由知识库 `site-updates` 分类维护；后台私有更新记录使用 `admin/docs/ADMIN_CHANGELOG.md` 和后台“后台更新记录”标签页内的 `adminUpdates`。
- 主站总上下文仍是根目录 `PROJECT_CONTEXT.md`；后台细节优先看本文档。

## 权限模型

- `/admin/*` 静态后台资源由 `functions/admin/_middleware.js` 拦截。
- 中间件读取 `lusu_session`，校验 D1 `sessions` 和 `users`，只有 `users.role = admin` 的账号可进入。
- `functions/admin/_middleware.js` 不再把站长邮箱白名单作为访问旁路；站长邮箱必须在 D1 中拥有 `users.role = admin` 才能通过后台静态资源校验。
- 未登录访问后台 HTML 时返回后台登录页；已登录但非 admin 时返回拒绝页。
- 所有 `/api/admin/*` 接口必须继续在服务端调用 `requireAdmin`，不能只依赖前端隐藏按钮或静态中间件。

## 当前模块

- 实时大屏：查看今日 PV、UV、周期 PV/UV、今日点击、在线访客、今日聊天数、真实世界地图来源点位、每日趋势、小时趋势、热门页面和热门文章。
- 访问来源：按国家、省份/地区、城市、IP 掩码前缀和 Cloudflare 经纬度聚合访问来源；访问地图使用本地真实世界地图轮廓资源，不加载第三方在线地图瓦片。
- 点击埋点：查看站内按钮、链接、桌面入口、筛选、文章、视频等点击目标和最近点击事件；目标文本、页面路径、来源、链接、元素标识和点击聚合键中的邮箱样式文本（含 URL 编码和双重编码形态）写入前会脱敏为 `[email]`。
- 知识库文章：新建、编辑、发布、删除文章；编辑界面按当前选择语言显示面板，但保存和发布要求 zh / en / ja 三语标题与正文齐全。后台保存的普通文章置顶状态和 row revision 不得被冷启动种子覆盖；`seed-ai-agent-workflow-guide-2026-06-14` 使用首次插入元数据和一次性修复标记后完全交由后台控制置顶。
- 自动投递：管理“每日 AI 新闻”专用通道、一次性令牌、显式 auto-publish 配置和最近投递事件，并进入知识库文章列表审阅；生产任务只在每日 07:00–08:00 的硬窗口内运行，失败不自动公开。
- 视频管理：维护 YouTube / Bilibili / b23.tv 视频，服务端识别链接、抓取标题、简介、作者、发布时间、封面和规范化 `embed_url`，支持草稿、发布、隐藏、排序、置顶、置顶排序、删除和刷新元数据。元数据只在后台预览、首次保存、URL 变化保存或刷新时抓取，已有视频 URL 未变化的普通保存不重新抓取外部元数据。封面可使用平台图片 URL，或在后台选择 JPG、PNG、WEBP、AVIF 本地图片后压缩写入 `thumbnail_url`；也可从本地视频文件读取第一帧生成封面，但这只生成封面，不上传或托管本地视频。置顶视频进入独立置顶队列并一定排在未置顶视频前面；多个置顶视频按 `pinned_sort_order` 从大到小显示，未置顶视频按 `sort_order` 从大到小显示，新建视频默认普通排序最大值 +10、置顶排序最大值 +10；后台编辑区只展示检查用小播放器，避免 iframe 预览占满页面。
- 视频分类管理：维护视频区分类标签，支持 slug、中文名、English、日本語、排序和启用状态；分类排序同样是数值越大越靠前，新建默认 +10；默认分类 seed 只在全新视频分类表首次创建时初始化，已有表会通过 `site_runtime_state.video_categories_default_seeded` 标记为已处理，不覆盖或补回后台维护过的 slug、分类名、排序、启用状态和已删除分类；“全部”分类只由前台生成，不写入数据库。
- 聊天室管理：查看聊天记录，编辑普通大厅明文消息，隐藏/恢复、删除消息，并按隐藏 visitor id 或 IP hash 禁言；密码房加密消息只显示“密码房加密消息（后台无法解密）”，不能编辑内容，但仍可隐藏、删除和禁言来源。网络来源 hash 带非敏感密钥代次，只有当前代次消息可新建网络来源禁言；旧代次消息仅供审计，旧禁言显示为“密钥已轮换”。禁言是否生效、是否过期由后台 API 按实际拦截条件计算。
- 在线画板治理：查看房间、连接、对象和资源容量概览；读取单房状态；清空或锁定公共画板；移除异常连接；按匿名 ID 或 IP 哈希设置有期限的临时封禁；删除异常且已为空的密码房。面板不读取或显示画布正文、密码、完整 IP、匿名凭证或完整 IP 哈希。
- 互传文件管理：通过主后台侧栏进入独立受保护页，分页查看当前 R2 / D1 文件和内容记录、发送账号、保存 / 过期时间及占用；可搜索、永久删除单项、清空 / 关闭房间、中止分片任务和执行过期清理。
- 社交链接管理：维护主站关于我窗口的 X、GitHub、Bilibili、Instagram、Discord 五个图标跳转；保存到 `site_runtime_state.about_social_links`，只允许 http(s) 链接，主站只显示小图标不显示平台文字。
- 后台更新记录：展示后台私有更新说明，每次后台更新后必须同步维护页面内 `adminUpdates` 和 `admin/docs/ADMIN_CHANGELOG.md`。
- 后台说明：展示后台项目介绍，不对外公开。

## 后台接口

- `GET /api/admin/me`
- `GET /api/admin/analytics/overview`
- `GET /api/admin/articles`
- `GET /api/admin/articles/:articleId`
- `POST /api/admin/articles`
- `PUT /api/admin/articles/:articleId`
- `DELETE /api/admin/articles/:articleId`
- `GET /api/admin/automation/daily-ai-news`
- `PUT /api/admin/automation/daily-ai-news`
- `POST /api/admin/automation/daily-ai-news/token`
- `DELETE /api/admin/automation/daily-ai-news/token`
- `GET /api/admin/videos`
- `POST /api/admin/videos`
- `PUT /api/admin/videos/:videoId`
- `DELETE /api/admin/videos/:videoId`
- `POST /api/admin/videos/preview-url`
- `POST /api/admin/videos/:videoId/refresh-metadata`
- `GET /api/admin/video-categories`
- `POST /api/admin/video-categories`
- `PUT /api/admin/video-categories/:categoryId`
- `DELETE /api/admin/video-categories/:categoryId`
- `GET /api/admin/chat/messages`
- `PUT /api/admin/chat/messages/:messageId`
- `DELETE /api/admin/chat/messages/:messageId`
- `GET /api/admin/chat/bans`
- `POST /api/admin/chat/bans`
- `DELETE /api/admin/chat/bans/:banId`
- `GET /api/admin/whiteboards/overview`
- `GET /api/admin/whiteboards/rooms`
- `GET /api/admin/whiteboards/rooms/:roomId/status`
- `POST /api/admin/whiteboards/public/clear`
- `PUT /api/admin/whiteboards/public/lock`
- `DELETE /api/admin/whiteboards/rooms/:roomId`
- `POST /api/admin/whiteboards/rooms/:roomId/kick`
- `POST /api/admin/whiteboards/rooms/:roomId/ban`
- `GET /api/admin/social-links`
- `PUT /api/admin/social-links`
- `GET /api/admin/transfer/overview`
- `GET /api/admin/transfer/items`
- `DELETE /api/admin/transfer/item/:itemId`
- `GET /api/admin/transfer/rooms`
- `POST /api/admin/transfer/room/:roomId/clear`
- `POST /api/admin/transfer/room/:roomId/close`
- `GET /api/admin/transfer/uploads`
- `POST /api/admin/transfer/upload/abort`
- `POST /api/admin/transfer/cleanup`

## 相关公开接口

后台依赖主站公开侧产生或读取部分数据，但这些接口不是后台专用接口：

- `POST /api/analytics/identify`
- `POST /api/analytics/page-view`
- `POST /api/analytics/click`
- `GET /api/articles`
- `GET /api/articles/:slug`
- `POST /api/automation/daily-ai-news`
- `GET /api/videos`
- `GET /api/videos/:videoId`
- `GET /api/social-links`
- `GET /api/chat/messages`
- `POST /api/chat/messages`

## D1 数据表

后台直接或间接依赖以下 D1 表：

- `users`
- `sessions`
- `user_login_events`
- `articles`
- `article_translations`
- `article_view_events`
- `article_delivery_channels`
- `article_delivery_events`
- `videos`
- `video_categories`
- `video_category_relations`
- `site_runtime_state`（视频分类默认 seed 标记、文章一次性数据修复标记、关于我社交链接等运行时配置）
- `site_visitors`
- `analytics_page_views`
- `analytics_click_events`
- `anonymous_chat_messages`
- `chat_bans`
- `anonymous_identities`
- `whiteboard_rooms`
- `whiteboard_assets`
- `whiteboard_bans`
- `whiteboard_admin_audit`

## 隐私和安全事实

- 后台访客识别使用 HttpOnly `lusu_visitor`，前台 UI 和公开 API 不展示该隐藏 ID。
- 聊天室前台本地 client id 只用于“我的消息”显示；后台禁言和审计使用隐藏 visitor id 或 IP hash。
- 密码房聊天消息在 D1 中只保存密文，后台没有密码、密钥或解密能力；后台治理只能看到房间类型、加密状态、隐藏 visitor id、IP hash、来源字段和时间等审计信息。
- IP 信息只保留 hash、掩码前缀和 Cloudflare 提供的国家、region/省份、城市、colo、时区、经纬度等聚合字段。
- 埋点不得记录输入框内容、密码、文章草稿、后台表单内容或未发送聊天内容；点击目标文本、页面路径、来源、链接、元素标识和点击聚合键中的邮箱样式文本（含 URL 编码和双重编码形态）写入前必须脱敏。
- 自动投递令牌的完整明文只允许在生成／轮换响应中显示一次；D1、后台更新记录、事件日志、浏览器持久化和普通错误信息都不得保存或输出完整令牌。机器入口只拥有新建固定分类文章的最小权限，不能读取后台数据或自行指定发布状态；默认创建草稿，受控公开只能由已启用 auto-publish 的专用通道执行。
- 聊天室内容和昵称必须纯文本渲染；后台展示也要避免把用户内容当 HTML 执行。
- 在线画板后台只处理房间、连接、容量、锁定、封禁和审计元数据，不返回画布图形／文本正文或密码。界面只显示操作所需的截断匿名标识和 IP 哈希提示，不显示完整匿名凭证、完整 IP 或可复制的完整 IP 哈希。
- 后台视频 iframe 只能使用服务端规范化生成的 `embed_url`，不得直接信任管理员输入的任意 URL。
- 社交链接保存时只接受 http(s) URL；前台关于我窗口只显示图标按钮，不能把后台填写的链接文字作为 HTML 或可见文案注入页面。

## 部署和缓存

- 正式部署链路仍是 `GitHub main -> Cloudflare Pages Git 自动部署 -> lusu575.com`。
- 后台静态资源随主站一起部署，不单独部署。
- 修改 `admin/admin.js` 或 `admin/admin.css` 后，必须同步更新 `admin/index.html` 中对应 CSS / JS query 版本，减少线上缓存继续加载旧后台资源。
- 修改后台 API、D1 schema 或权限逻辑时，需要同步检查 `functions/api/[[route]].js`、`functions/admin/_middleware.js` 和 `cloudflare/schema.sql`。
- 在线画板治理还依赖 Pages 到独立 `WhiteboardRoom` Worker 的 external binding；仓库声明不等于 Dashboard 已配置。发布前必须在获授权环境中先完成 D1 migration 和 Worker 部署，再核对 binding，最后由 `main` 触发 Pages Git 部署。
- 自动投递通道默认暂停；只有站长明确生成令牌、启用通道并显式配置 auto-publish 后，才允许每日生产任务在 07:00–08:00 内自动公开合格文章。部署网站不会自动创建其他计划任务，也不会替站长配置任何模型、搜索或第三方密钥。
- 后台文档更新只改 `admin/docs/`、根目录 `CHANGELOG.md` 以及必要的 README 索引，不需要发布主站 `site-updates` 文章。

## 本地验证

安装依赖：

```powershell
npm.cmd install
```

本地初始化 D1：

```powershell
npm.cmd run d1:migrate:local
```

本地启动 Cloudflare Pages：

```powershell
npm.cmd run dev
```

本地访问：

```text
http://127.0.0.1:8788/admin/
```

静态检查：

```powershell
npm.cmd run build
```

注意事项：

- PowerShell 优先使用 `npm.cmd` / `npx.cmd`。
- `.wrangler/`、`.wrangler-config/`、`node_modules/`、`.codex-remote-attachments/` 是本地生成内容，不得提交。
- 如果本地没有 admin 账号，需要先注册/登录主站账号，再在 D1 中把对应 `users.role` 更新为 `admin`。

## 2026-06-20 社交链接管理模块

- 后台新增“社交链接”模块，导航位置在“账号管理”和“后台更新记录”之间。
- 接口为 `GET /api/admin/social-links`、`PUT /api/admin/social-links`，全部必须继续使用 `requireAdmin`。
- 后台表单维护 X、GitHub、Bilibili、Instagram、Discord 五个跳转地址；保存时服务端补齐省略的 `https://`，拒绝非 http(s) URL。
- 配置保存到 `site_runtime_state` 的 `about_social_links` key；公开主站通过 `GET /api/social-links` 只读获取。
- 主站关于我窗口只显示图标按钮，不显示后台填写的链接文字；后台预览列表也必须用 DOM/textContent 渲染。

## 2026-06-15 账号管理模块

- 后台新增“账号管理”模块，导航位置在“后台更新记录”上方。
- 账号接口为 `GET /api/admin/accounts`、`GET /api/admin/accounts/:userId`、`PUT /api/admin/accounts/:userId`，全部必须继续使用 `requireAdmin`。
- 账号页显示注册邮箱、角色、密码加密状态、最近登录、活跃会话、云存档数量、登录履历和近期站内活跃。
- 密码只能重置，不能明文展示，不能把 `password_hash` 返回给浏览器，也不能把真实账号资料写入 GitHub 仓库。
- 登录履历由 D1 表 `user_login_events` 提供，只记录成功登录/注册后的时间、掩码 IP 前缀、IP hash、Cloudflare 地区字段和设备摘要，不保存完整明文 IP。
- 统计埋点对已登录用户使用不可逆账号统计 ID 合并 UV，同一账号跨设备访问只算 1 个 UV；匿名访客继续按 HttpOnly `lusu_visitor` cookie 统计。
