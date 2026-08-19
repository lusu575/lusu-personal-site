---
name: 鲁肃个人站管理后台专用 Skill
description: 维护鲁肃个人站 `/admin/` 管理后台时使用。只适用于后台页面、后台样式、后台脚本、后台权限、后台 API、后台统计与流量保护、后台视频管理、后台聊天室与在线画板治理和后台专用文档；不要把它误当成主站总 Skill。
---

# 鲁肃个人站管理后台专用 Skill

## MiniMax H3 管理后台规则

- MiniMax H3 必须保持独立的 `/admin/minimax-h3.html` 页面，依赖现有 `/admin/*` 中间件，公共 Tools 卡片只负责跳转。
- 页面只读展示真实 Runner、固定控制器、ComfyUI、Bridge、磁盘和队列状态；不伪造在线心跳，不嵌入或代理原版 ComfyUI，不接收媒体字节。
- ComfyUI 与 Bridge 只使用家庭端 `127.0.0.1:8188` 和 `127.0.0.1:8791`；P2 任务操作必须等待真实 Agent、Runner、Bridge 和 GPU canary 证据，执行与传输开关默认关闭。
- H3 图标使用明确表现 AI 视频生成的 image2 光栅资产，不使用代码绘制；新增页面、导航和缓存版本必须同步根 CHANGELOG、后台文档、`adminUpdates` 和构建检查。

> 管理后台专用说明：本 Skill 只约束 `/admin/` 管理后台维护工作，不等同于主站 `skills/lusu-personal-site-skill/SKILL.md`。维护主站首页、知识库公开展示、游戏区、聊天室公开侧、首页壁纸或三语主站文案时，仍必须读取主站 Skill。

## 使用时机

- 修改 `admin/index.html`、`admin/admin.css`、`admin/admin.js`。
- 修改 `functions/admin/_middleware.js`。
- 修改 `/api/admin/*` 后台接口、后台权限、后台统计与流量保护、后台文章管理、后台视频管理、后台视频分类管理、后台社交链接管理、后台聊天室或在线画板治理。
- 修改后台专用文档：`admin/docs/ADMIN_PROJECT_CONTEXT.md`、`admin/docs/ADMIN_SKILL.md`、`admin/docs/ADMIN_CHANGELOG.md`。
- 修改后台页面内“后台项目介绍”或后台私有更新记录。

## 临时互传后台规则

- 临时互传管理保持独立页 `/admin/transfer.html`，主后台通过侧栏“互传文件管理”入口跳转；不要再复制一套 Transfer 表格和状态到 `admin/index.html`，也不要让独立页绕过当前编辑模块的未保存离开保护。
- 互传管理页只展示必要元数据，不显示明文房间口令，不默认预览用户文件；管理员操作仍须调用 `/api/admin/transfer/*` 并由服务端数据库角色鉴权。
- 文件列表必须显示发送账号、保存时间、过期时间、大小和真实存储状态，并支持遍历全部结果；用户账号记录缺失时不能隐藏仍占 R2 / D1 空间的文件。
- 单项永久删除必须先删除 R2 对象，再删除 D1 记录并更新房间同步代次。R2 删除失败时应保留可重试状态，不得只删数据库记录后留下孤立计费对象，也不得向管理员伪报成功。
- Transfer 设置读取必须返回 revision，保存和上传开关必须携带 `expectedUpdatedAt`；缺失版本拒绝，陈旧版本返回 409 并让页面保留当前输入。清空房间、清理任务和 R2 删除仅部分成功时必须返回非 2xx、失败对象与重试信息，不能把已处理数量当成全部成功。
- 简单上传和 Multipart ready 转换必须检查 D1 `changes`；记录在 R2 写入期间被并发删除时，清理新对象并保留可恢复错误。多个管理操作共用写锁，搜索和分页请求使用 Abort / generation 拒绝旧响应覆盖新筛选。
- 普通账号免费池与管理员豁免的判断都在服务端执行。管理员“不限频次”不等于无限网络并发，也不突破 Cloudflare、R2、浏览器或账单边界。
- 站内费用是估算值，不能宣称等同 Cloudflare 正式账单；官方 1 / 3 / 5 美元预算提醒必须记录为 Dashboard 人工配置。
- 本地 API 建议 Node.js 22.13+；同名变量放入被 Git 忽略的 `.dev.vars`，本地值独立生成。不得提交 `.dev.vars`、`.env`、真实邮箱、令牌、Webhook 或其他密钥。
- 独立管理页与公开工具区（内部 `resources` route）/ Quick Transfer 共用生产图集 `assets/transfer/quick-transfer-icons.png`。图集内容或版本变化时，必须使用同一发布 token 同步更新公开引用、`admin/transfer.css` 的图集 query 与 `admin/transfer.html` 的样式 query；不能只更新主站而让后台继续缓存旧图集。
- 修改独立管理页或主后台入口时同步更新页面内 `adminUpdates`、根 `CHANGELOG.md`、`admin/docs/ADMIN_PROJECT_CONTEXT.md`、本 Skill 和 `admin/docs/ADMIN_CHANGELOG.md`。

## 流量与 D1 写入保护规则

- “流量与写入”保持为主后台普通 panel，位于访问统计的点击埋点之后；不得把控制项放到公开主站，所有 `GET/PUT /api/admin/traffic-control` 都必须调用 `requireAdmin`。
- 站内估算必须说明覆盖范围、系数与局限，不能称为 Cloudflare 账单或官方额度。官方 `rowsWritten` 只有在只读 Cloudflare Analytics 连接实际成功时显示；未配置显示“未连接”，查询失败显示失败，不能用 0 冒充成功。
- Cloudflare Analytics Token 只能作为 Pages Production Secret 注入服务端；不得返回浏览器、拼入 DOM、日志、错误详情、测试快照、文档值或 Git。Account ID 与 Database ID 也从运行时环境读取，Preview 不得复用 Production Token。
- 设置保存使用 `site_runtime_state.traffic_control_settings_v1` 与 `expectedUpdatedAt` 条件更新；缺版本拒绝，陈旧版本返回 409。自动刷新可以更新指标，但 dirty 表单、revision 基线与冲突提示必须保留，不能静默覆盖管理员输入。
- 自适应采样和开关只允许作用于匿名访客识别、页面浏览、点击和文章阅读等非必要遥测。登录／注册、账号会话、游戏云存档、Chat、Transfer、Whiteboard、管理员操作和内容写入不得被自动关停；要减少这些业务写入必须另做明确评审和授权。
- 已知搜索／AI／SEO 爬虫、安全扫描、synthetic monitor、Headless 与脚本客户端必须在匿名遥测 schema、身份、Cookie、限流和事件写入前短路；公开文章仍可抓取，但不得因此写文章阅读事件或累计 `view_count`。
- 自动化客户端分类是基于真实观测 User-Agent 的高置信启发式，必须覆盖 `GoogleOther` 等不含 `bot` 的已知名称。不得按国家、单页访问或普通浏览器版本判定爬虫；历史数据不得为美化报表而破坏性删除。
- 代码级遥测短路不等于 Cloudflare WAF。没有创建并回读 `http_request_firewall_custom` 规则前，后台和维护记录不得宣称扫描路径已在边缘拦截；也不得用全站 Pages middleware 让静态资源进入 Functions 计额。
- 当前免费额度保护默认值固定为 30,000／50,000 估算行；正常档页面／点击／文章 100%／100%／100%，预警档 25%／10%／50%，硬保护档 0%／0%／10%。低写入预案使用 20,000／35,000、50%／25%／75%、10%／0%／25%、0%／0%／0%。只有存量设置仍精确等于旧默认 JSON 时才允许 compare-and-swap 迁移；不得用版本升级覆盖管理员自定义策略。
- 默认阈值与采样要在 schema、API 默认值、后台输入和测试中保持一致。修改默认值、估算系数或保护范围时同步更新项目上下文、后台上下文、页面内私有更新、根与后台 changelog，并重新验证关闭某分项后对应原始事件确实不落库。阈值必须为必要业务留出清晰余量，不能把免费额度全部分配给可丢弃遥测。

## 在线画板后台治理规则

- 在线画板治理保持在现有 `/admin/` 主后台 panel，继续复用 `lusu_session`、D1 `sessions` 和 `users.role = admin`；所有 `/api/admin/whiteboards/*` 路由都必须调用 `requireAdmin`，不得新增公开管理接口或依赖前端隐藏按钮鉴权。
- 概览和列表只展示房间数量、房型、锁定状态、在线连接、对象与资源容量、最后活动、空房删除时间和必要错误状态；按需读取单房连接与容量，不轮询或下载画布正文。
- 公共画板只允许清空以及切换只读／可编辑，不能走密码房删除入口。清空、锁定、kick、临时 ban 和删除异常私房必须使用带对象与影响说明的确认，并写入 `whiteboard_admin_audit`。
- kick 可定位单连接或某匿名身份在该房的连接；临时 ban 只允许受限时长，并按匿名 ID 或 IP 哈希目标执行。界面默认使用截断标识，不能显示或复制完整匿名凭证、完整 IP 或完整 IP 哈希。
- 删除密码房前必须由服务端再次确认房型和真实在线数；只允许删除异常且为空的密码房，不得因陈旧列表状态误删已重入房间。部分 R2／D1／DO 清理失败必须返回真实失败并允许重试，不能伪报成功。
- 后台不得展示或记录画布图形／文本正文、明文密码、房间口令、完整 IP、完整匿名凭证或 WebSocket 票据；普通日志和后台更新记录也不得包含这些内容。
- 当前仓库实现不等同 Cloudflare 生产部署。没有实际核对远端 D1 migration、external Durable Object binding、Worker、Pages 部署和正式域名时，文档与交付报告必须明确写“未验证”。

## 每日 AI 新闻与工具雷达自动投递规则

- “自动投递”是主后台中的普通 panel，固定排在“知识库文章”之后；用同一选择器管理 `daily-ai-news` 与 `tool-radar`，不要为任一通道另建重复页面。切换时必须清除一次性明文令牌并重新读取所选通道，不能混用状态或历史。
- 通道配置、令牌生成／轮换／撤销和事件读取使用 `/api/admin/automation/daily-ai-news*`，每条路由都必须调用 `requireAdmin`。机器投递入口 `POST /api/automation/daily-ai-news` 使用专用 Bearer 令牌，不复用管理员 cookie，也不能获得后台读取权限。
- 工具雷达沿用相同契约的 `/api/admin/automation/tool-radar*` 与 `POST /api/automation/tool-radar`，但配置、凭证与 auto-publish 完全独立。其已认证 `GET /api/automation/tool-radar/catalog` 只提供永久去重目录，不能暴露通道配置、令牌摘要或其他后台数据。
- 令牌明文只在生成或轮换成功时返回一次；D1 只保存 SHA-256 摘要和末尾提示。不得把完整令牌写入页面持久化、日志、事件表、文档、测试快照或 Git。
- 机器投递只能按各自专用通道创建固定分类文章：`daily-ai-news` 只能创建每日新闻，`tool-radar` 只能创建工具雷达。服务端固定 `is_pinned = 0`、无封面，并拒绝调用方提交 category、status、is_pinned、cover_image_url、published_at 等越权字段。默认状态为 draft 且无发布时间；只有对应专用通道显式启用 auto-publish 时，服务端才创建 published 状态并写入公开时间。调用方不得直接发布或改写其他文章。
- 每次投递都要求 zh / en / ja 三语标题、摘要和正文，并执行正文大小、频率、幂等键和 slug 冲突保护；事件表只记录必要元数据、规范化内容指纹和错误摘要，不记录正文。相同幂等键只有在内容指纹一致且原草稿仍存在时才能作为成功重放；内容变化或原稿已删除必须返回冲突并要求新键。
- 公开机器请求应先用轻量通道表完成来源限流、Bearer 校验和启用状态判断；未鉴权或暂停请求不得触发文章 seed。只有验证通过后才准备文章与投递事件表。
- 通道默认暂停；生成令牌不等于启用，撤销令牌必须同时暂停。正式授权已覆盖每日生产运行：只有站长明确生成令牌、启用通道并显式启用 auto-publish 后，才允许自动公开；暂停、撤销、关闭 auto-publish、验证失败或超时必须关闭公开路径。后台不得自行保存模型密钥或建立范围外的计划任务。
- 本地生成适配层固定放在 `自动新闻/integrations/lusu-site/`：必须先运行 Horizon 原生抓取入口完成多源采集、网址规范化和跨来源去重，运行记录保存可反查的 `runId`、候选文件、紧凑 candidate index 与 coverage manifest；Horizon 不可用时停止，不能由 Codex 手工采集顶替。`horizon.config.json` 当前虽指向本地 Ollama `qwen3.6:27b`，正式适配入口仍只调用抓取、来源重试和去重，不调用 Horizon 原生 AI 评分或富化；不得因看见模型配置就误报它已参与正式生产。生产任务每天北京时间 07:00 开始，严格使用 `[前一日 07:00, 当日 07:00)` 的精确 24 小时窗口；Codex 负责复核、重要性门槛、三语整稿、无外链正文和个人站投递格式。所有阶段必须在 08:00 前完成，失败或超时不得补发。
- 正式日报使用 schema v4，并在投递前完成 required query／entity group 覆盖签收；初选少于 5 条必须执行低产量第二轮审阅和定向补查，但 5 条不是最低配额，复核后可以少于 5 条或无稿，禁止凑数。发现不限制来源语言，应以英中日韩常用别名覆盖重点模型厂商，以及芯片／光刻／存储、机器人、智能设备、数据中心能源／网络和科技金融。跨日去重按 `eventKey + eventStage`；正式发布、开放权重等实质新阶段须记录前序故事和 material difference。任一覆盖、补查或更新阶段证明缺失都应视为验证失败并关闭本期，不能进入自动公开。
- `runs/2026-07-28-coverage-revision.json` 的 manifest v1 只是一份按固定 run、路径和 SHA-256 登记的 schema v4 历史兼容例外；不得复制、改写或作为新任务模板。除该精确身份外，所有正式 schema v4 运行都必须使用 coverage manifest v2 并填写完整 `priorityReview`。
- 发现源的“成功但空”与“抓取／解析失败”必须分开记录；低并发有界重试后仍失败就关闭本期，不能把内部错误后的空数组算作没有新闻。candidate index 必须以确定性 UTF-8 字节写盘，并对实际写入字节计算 SHA-256，确保 Windows 本地任务与校验器使用同一来源证明。
- 本地试投只使用临时令牌，投递结束必须停止预览、撤销令牌并暂停通道。2026-07-27 样稿用于生产链路测试，仍须通过相同的来源、令牌、大小、频率、幂等、slug 冲突、验证和失败关闭闸门。
- 工具雷达正式任务已获授权，固定于每周二北京时间 22:00 启动；目标 6–10 个、少于 3 个就不投递。请求必须携带与正文一致的结构化 `tools[]`；`tool_radar_catalog.tool_key` 与规范官网 URL 提供服务端精确唯一约束，目录登记必须和文章、三语翻译、投递事件原子落库，重复时整体返回 409。疑似改名、换域名或被收购的产品必须对历史名称、官网和别名做人工目录复核，身份未排除重复前不得作为新工具投递。同类不同产品允许后续介绍。每个工具通常使用一张有明确语义的项目内真实图、最多两张；图片必须从网上发现并回到官网、官方功能页、官方文档、官方仓库或官方媒体核实，只允许真实产品界面、官方案例或真实成果，自绘／生成／统一模板／第三方转载图一律拒绝。资产先经 GitHub `main` → Cloudflare Pages 部署，再由生产投递核对远程 SHA-256。通道启用与 auto-publish 仍是两项独立显式闸门，只有两项都开启时才自动公开。
- 修改这套能力时同步更新页面内 `adminUpdates`、根 `CHANGELOG.md`、`PROJECT_CONTEXT.md`、`admin/docs/ADMIN_PROJECT_CONTEXT.md`、本 Skill、`admin/docs/ADMIN_CHANGELOG.md`，以及公开可见变化所需的三语 `site-updates` 与缓存 query。

## 文档边界

- 后台专用上下文写入 `admin/docs/ADMIN_PROJECT_CONTEXT.md`。
- 后台专用规则和注意事项写入 `admin/docs/ADMIN_SKILL.md`。
- 后台专用更新记录写入 `admin/docs/ADMIN_CHANGELOG.md`。
- 每次后台功能、界面、接口、权限、视频管理、聊天室治理或后台文档更新后，必须同步维护后台页面内 `adminUpdates` 和 `admin/docs/ADMIN_CHANGELOG.md`；这是后台私有更新记录，不写入主站知识库 `site-updates`。
- 根目录 `PROJECT_CONTEXT.md` 只保留全站总事实和后台索引，不复制后台细节。
- 根目录 `CHANGELOG.md` 只记录项目级变更；后台私有细节优先写入 `admin/docs/ADMIN_CHANGELOG.md`。
- 后台私有更新不得写入主站知识库 `site-updates`，也不得加入 `js/main.js` 的首页最近更新 fallback。
- 如果一次后台改动同时改变主站公开可见体验（例如关于我图标、公开视频区展示），公开侧仍按主站 Skill 发布 `site-updates` 三语文章和 fallback；后台私有细节仍单独记录在 `adminUpdates` 与 `admin/docs/ADMIN_CHANGELOG.md`。

## 改动边界

- 后台静态页面、样式、脚本必须放在 `admin/`。
- 后台访问拦截必须放在 `functions/admin/_middleware.js`。
- 后台服务端接口必须继续使用 `/api/admin/*`。
- 不要把后台组件混进主站首页窗口、主站 CSS、主站桌面图标或主站三语内容体系。
- 用户明确要求“只做后台文档”时，只修改 `admin/docs/`、根目录 `CHANGELOG.md` 和必要 README 索引，不改功能代码。
- 用户明确要求“只美化后台”时，只改 `admin/admin.css` 和必要的后台 HTML class/结构，不改 API、权限、数据写入或主站逻辑。

## 后台文案和界面

- 后台只使用中文文案。
- 后台视觉可以保留轻量 Windows XP / 像素风元素，但要优先服务管理效率和可读性。
- 后台不需要主站中文 / English / 日本語 三语切换。
- 后台表格、表单、按钮、状态、空状态和错误提示必须清楚，不隐藏真实失败原因。
- 移动端后台需要保持可读、可滚动、无横向溢出；侧边栏使用不占文档流的抽屉，文章、视频、聊天室和账号使用真正的列表 / 详情双态，不能让用户先滚过完整列表才能操作详情。
- 移动端与粗指针环境中的主要按钮、导航、输入和复选标签命中区至少 44px；必须保留清晰的键盘焦点和减少动态效果适配。
- 长表单的主保存操作需要持续可见。文章、视频、聊天和账号等可编辑表单必须由真实输入 / change 或明确表单操作维护 dirty 状态，并在切换模块、条目、新建、移动返回或刷新前提供保存、放弃、留下选择；异步加载、默认排序、分类选项重建或纯点击不得触发未保存提示，保存失败不能清除 dirty 或输入内容。
- 会覆盖既有内容的后台写入、元数据刷新和删除必须携带读取时的 `expectedUpdatedAt`。服务端使用条件更新／删除并让文章翻译、视频分类关系等附属写入与主记录原子受保护；陈旧页面返回统一 `409 + CONTENT_CONFLICT`。前端不得自动重载丢掉草稿，应保留输入并提示复制或手动合并。
- 删除、封禁、停用禁言和账号敏感修改使用共享上下文确认框，说明对象、影响和可恢复性；取消为安全默认，危险操作不能成为回车默认动作。
- 后台导航默认从上到下为：实时大屏、访问来源、点击埋点、流量与写入、知识库文章、自动投递、视频管理、视频分类管理、聊天室管理、在线画板治理、互传文件管理、账号管理、社交链接、后台更新记录、后台说明；互传入口打开独立受保护页面，不伪装为本页 panel。
- 后台反馈动效应短于 300ms，并优先只改变 `transform`／`opacity`；不要为抽屉、进度或列表状态动画 `width`、`height`、`top` 等布局属性。只有持续等待的 spinner 可以使用克制的线性循环。
- 键盘触发、Escape 和减少动态效果偏好必须立即完成抽屉、对话框等关键状态切换；减少动态效果只保留有语义的 opacity／颜色反馈并移除位移，hover 动效只在支持 hover 的细指针设备启用。
- 抽屉与 backdrop 必须同步且可中断，退出完成后才能 `hidden`；异步忙碌节点必须让 `.is-loading`／`.is-busy`、spinner 和 `aria-busy` 使用同一真实请求状态，不能让视觉状态与辅助技术读到的状态分叉。
- 全局 mutation 仍按既有队列串行，但只允许真实触发该请求的按钮显示 spinner／`aria-busy`；不要把同页所有 mutation 按钮一起变成视觉忙碌。复制按钮只在实际剪贴板 Promise 期间忙碌，成功／失败短反馈应有界复原；Transfer notice 必须预留稳定槽位，不能用消息出现／消失推动表格和操作区跳动。

## 权限和安全

- `/admin/*` 必须由 `functions/admin/_middleware.js` 校验 `lusu_session` 和 `users.role = admin`。
- 所有 `/api/admin/*` 必须继续在服务端调用 `requireAdmin`，不得只依赖前端隐藏入口。
- 普通登录用户不能读取后台静态资源、后台 API 数据、后台统计、后台聊天／画板审计或后台视频管理数据。
- 后台 API 错误应返回 JSON，方便前端显示真实原因。
- 不得新增绕过 admin 权限的调试接口、临时接口或公开管理接口。

## 隐私和埋点

- 后台不得记录输入框内容、密码、文章草稿、后台表单内容或未发送聊天内容；点击埋点的目标文本、页面路径、来源、链接、元素标识和点击聚合键中的邮箱样式文本（含 URL 编码和双重编码形态）写入前必须脱敏。
- IP 信息只保留 hash、掩码前缀和 Cloudflare 地理聚合字段，不展示完整明文 IP。
- 后台访问地图使用本地真实世界地图轮廓资源和现有 Cloudflare 经纬度聚合字段，不接入第三方在线地图瓦片服务，也不为了地图展示保存或暴露完整明文 IP。
- 后台访问地图底图必须保持真实 SVG 节点渲染，使用项目内 Natural Earth 路径和 1000×500 viewBox；缩放 / 平移修改根 SVG `viewBox`，不得退回 CSS background、滤镜、伪元素或 `transform: scale()` 放大地图层。
- 城市点位必须使用真实 SVG `<g>` / `<circle>`，不得用 HTML 绝对定位元素或 CSS `::before` / `::after` 拼圆点。点位按同一 1000×500 经纬度投影与底图对齐，并在 resize 和 100% 至 500% 缩放时反算 SVG 半径，使可见尺寸和至少 44px 命中区保持稳定。
- 当前互动地图固定使用最近 14 天按国家、地区和城市精确分组、具备有效聚合经纬度的城市级聚合数据；不得退回国家中心随机兜底，也不得把不同城市合并成不可核对的装饰点。
- 互动地图需要同时支持桌面鼠标滚轮缩放、拖拽、点击 / 悬停，触屏双指缩放与拖动，以及键盘聚焦并打开城市详情；城市点位和地图控件的触控目标至少 44px，地图下方继续提供同一聚合数据的可读城市列表。
- 城市详情可展示城市 / 地区、PV/UV、聚合坐标和最近访问时间，不展示 IP、掩码网络前缀、visitor id、hash 或其他隐藏标识。没有真实筛选或详情动作的地图点位仍必须保持非交互，不得伪装成按钮。
- 后台访客识别使用 HttpOnly `lusu_visitor` 对应的隐藏 visitor id；前台公开 UI 和公开 API 不展示该 ID。
- 聊天室前台 client id 只用于“我的消息”显示；后台禁言和审计使用隐藏 visitor id 或 IP hash。
- 聊天网络来源 hash 和对应禁言必须记录非敏感密钥代次；后台只允许从当前代次消息创建网络来源禁言，服务端必须按消息编号读取目标并拒绝旧代次，不能仅依赖前端禁用按钮。Secret 轮换后旧 hash 仅供审计，不能假装仍然生效；禁言的生效 / 过期状态必须由服务端按与 `activeChatBan()` 相同的条件返回，后台不能只看 `active` 字段自行判断。
- 聊天室昵称和消息在后台展示、编辑和保存时仍要保持纯文本安全，不把用户内容当 HTML 执行。
- 画板治理 API 和界面只处理连接、容量、房间状态、锁定、封禁和审计元数据；不得读取、返回或渲染画布正文、房间密码、完整 IP、完整匿名凭证或完整 IP 哈希。

## 文章管理

- 后台文章编辑可以按当前选择语言显示单个语言面板。
- 保存和发布正式文章时必须一次性提交 zh / en / ja 三种标题与正文。
- `site-updates` 是公开更新日志，不允许置顶；后台文章 API 必须忽略该分类的置顶提交并强制保存为 `is_pinned = 0`，其他分类的置顶规则保持不变。
- 后台可编辑的普通 seed 文章不能在冷启动时用 upsert 重写 `is_pinned`、`updated_at` 或其他管理员维护的元数据。默认元数据应只在缺失时插入；必须修复既有线上值时，使用 `site_runtime_state` 一次性标记，修复完成后继续尊重后台的新选择。
- 发布前必须一次列出 slug 及 zh / en / ja 全部阻断项；错误摘要可以切换语言并聚焦对应字段，不能只提示第一个错误。后台 API 也必须把三语正文作为必填，不能只信任前端。
- 文章发布时间在后台编辑器显示管理员本地时间，保存前转换为 UTC ISO；后端必须再次规范化 `published_at`。
- 文章 PV/UV 以服务端 `article_view_events` 为准，不要只依赖前端页面级 PV。
- 后台文章管理接口必须继续要求 admin 权限。

## 视频管理

- 后台视频链接只支持 HTTPS 的 YouTube、youtu.be、Bilibili、b23.tv 白名单来源；YouTube videoId 必须是 11 位标准字符，Bilibili BV 号必须是 `BV` 开头、总长 12 位的标准格式。
- 视频链接必须由服务端解析，并由服务端生成规范化 `embed_url`。
- 前台和后台 iframe `src` 只能使用服务端规范化后的 `embed_url`，不得直接信任管理员输入 URL。
- YouTube / Bilibili 元数据只在后台预览、首次保存、URL 变化保存或刷新时抓取，并缓存到 D1；已有视频 URL 未变化的普通保存不得重新抓取外部元数据，公开视频访问不得每次重新抓取。元数据抓取应尽量补齐标题、简介、作者、发布时间和封面；抓取失败时要保留可读错误并允许管理员手动填写。
- 后台封面可以使用 YouTube / Bilibili 平台图片 URL，也可以由管理员选择 JPG、PNG、WEBP、AVIF 本地图片后在浏览器端压缩裁切为受限 `data:image` 写入 `thumbnail_url`；不得放宽为 SVG、HTML、任意 data URL 或任意图片域名。
- “从本地视频截首帧”只用于生成封面，不代表本站支持本地视频上传或托管；不要因此放宽 `parseVideoUrl()` 的 YouTube / Bilibili / b23.tv 白名单和 iframe 安全边界。
- Bilibili 抓取遇到 API 风控或 HTTP 412 时，应优先保留服务端白名单解析和规范化 `embed_url`，并使用浏览器化请求头、详情接口、移动页、页面 `__INITIAL_STATE__` / `__NEXT_DATA__`、meta、结构化数据、更宽的页面状态备用解析或 b23 跳转兜底，不得放宽为任意 iframe。
- 视频置顶必须走独立置顶队列：只要 `pinned = 1` 就一定排在未置顶视频前面；多个置顶视频按 `pinned_sort_order` 从大到小显示，未置顶视频按 `sort_order` 从大到小显示。后台新建视频默认取当前最大普通排序 +10、当前最大置顶排序 +10；视频分类仍按 `sort_order` 从大到小显示，新建分类默认 +10。
- 默认视频分类 seed 只允许在全新 `video_categories` 表首次创建时初始化；已有表必须通过 `site_runtime_state.video_categories_default_seeded` 视为已处理，不得覆盖或补回后台维护过的 slug、中文名、英文名、日文名、排序、启用状态和已删除分类，避免冷启动或迁移后把后台设置还原。
- 后台视频预览只是编辑检查用，不应占满编辑区；播放器容器要限制宽度、高度并在小屏单列适配。
- “全部”视频分类只由前台生成，不写入 `video_categories`。
- 删除视频分类前要考虑已有视频关联，避免破坏公开视频筛选。

## 社交链接管理

- 社交链接管理页面只放在 `/admin/`，所有接口必须继续调用 `requireAdmin`。
- 后台只维护关于我窗口的 X、GitHub、Bilibili、Instagram、Discord 五个跳转 URL，不管理可见平台文字。
- 配置保存到 D1 `site_runtime_state` 的 `about_social_links` key；公开主站通过 `GET /api/social-links` 只读读取。
- 保存时只允许 http(s) URL，管理员省略协议时可由服务端补 `https://`；不得支持 `javascript:`、`data:`、相对路径或任意 HTML。
- 主站关于我窗口必须只显示小图标按钮，不把后台填写的链接文字作为可见文案输出；按钮保留 `aria-label` 供辅助技术使用。
- 后台预览列表也必须用 DOM/textContent 渲染，不得使用 `innerHTML` 拼接链接。

## 聊天室管理

- 后台可编辑普通大厅明文聊天消息，隐藏/恢复、删除聊天消息。
- 后台可按隐藏 visitor id 或 IP hash 禁言。
- 聊天治理界面将消息详情与禁言记录分层；保存、隐藏 / 恢复是高频操作，删除和两类封禁必须收进明确的危险操作区并走上下文确认。
- 公开聊天室接口仍必须保持纯文本渲染、长度限制和频率限制。
- 禁言原因和禁言时长属于后台治理信息，不公开给普通访客。
- 密码房加密消息必须显示为“密码房加密消息（后台无法解密）”这类占位说明，不展示密文本身，不提供后台解密，不允许编辑内容。
- 密码房加密消息仍可隐藏、删除、按隐藏 visitor id 或 IP hash 禁言；保存时只提交允许治理的字段，不能把占位说明当成消息正文写回。

## 缓存和版本

- 修改 `admin/admin.css` 后，必须更新 `admin/index.html` 中 CSS query。
- 修改 `admin/admin.js` 后，必须更新 `admin/index.html` 中 JS query。
- 修改 `admin/transfer.css` 或它引用的共享图集后，必须同步更新 `admin/transfer.html` 的 CSS query，并让图集 query 与公开侧使用同一发布 token。
- 如果同时修改主站 `js/main.js`、`css/style.css` 或强视觉资源，还要按主站 Skill 更新 `index.html` query。
- 后台文档更新不需要改后台资源 query。

## 每次后台改动后的检查

- 后台功能或样式变更后运行 `npm.cmd run build`。
- 文档变更后检查 `admin/docs/` 标题和首段是否明确写着“管理后台专用 / 不等同于主站文档”。
- 每次后台更新后检查“后台更新记录”标签页的 `adminUpdates` 与 `admin/docs/ADMIN_CHANGELOG.md` 已同步记录本次变更。
- 搜索确认后台私有更新没有写进 `site-updates` seed、`js/main.js` fallback 最近更新或公开知识库。
- 检查根目录 `CHANGELOG.md` 只记录项目级摘要，后台细节写入 `admin/docs/ADMIN_CHANGELOG.md`。
## 2026-06-15 账号管理安全规则

- 账号管理页面必须只放在 `/admin/` 后台，并且所有账号接口必须继续调用 `requireAdmin`。
- 后台可显示邮箱、角色、密码加密状态、登录履历、活跃会话和近期活跃，但不能显示明文密码。
- 后台接口不能返回 `password_hash`、session token、完整明文 IP 或其他可直接接管账号的敏感值。
- 修改密码只能通过“新密码”字段重置；保存后前端必须清空密码输入框。
- 账号列表加载后不得自动选中首个账号；未选择账号时资料和安全操作保持禁用。资料 / 角色修改与密码重置使用独立提交流程。
- 密码重置必须让管理员明确选择是否撤销该账号既有会话；服务端必须通过原子条件更新保护最后一个管理员，不能只靠前端按钮禁用或站长邮箱特例。
- 登录履历只记录成功登录/注册后的安全摘要：时间、掩码 IP 前缀、IP hash、地区和设备摘要。
- 登录用户的埋点 UV 使用不可逆账号统计 ID 合并；匿名访客继续使用 HttpOnly `lusu_visitor` cookie。
- 不要把真实账号邮箱、密码、哈希、session、登录记录或 D1 数据写进 GitHub 仓库、文档 seed、公开 `site-updates` 或前端 fallback。
