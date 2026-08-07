# AI 能力层：架构与运行手册

本目录记录个人站“同一份业务能力，同时服务网站 API、CLI 与 MCP”的当前边界。前五阶段已经搭好统一能力清单、本地 CLI、本地 stdio MCP、设备码授权、Quick Transfer、受限的在线画板 Agent 通道（含真实图片闭环）、首个 2048 游戏适配器、视频／工具／游戏／日语题库的公开只读目录，以及日语账号进度读取与受控答题，并保留一个独立的 Cloudflare 远程 MCP Worker 工程；它不是“全站所有功能已经接入”或“远程写入已经上线”的声明。

## 1. 先看能力注册表，不要靠猜

统一清单位于 `lib/capabilities/registry.mjs`。每项能力都包含 `id`、`domain`、主 `scope`、风险、幂等性、破坏性以及两组容易混淆的传输字段：

- `transport` 是目标传输面：表示架构希望这项能力最终可以从哪些入口使用。
- `availableTransports` 是当前已经有具体适配器、现在可以调用的传输面。

因此，看到 `transport: ["local-mcp", "cli"]` 不代表本地 MCP 或 CLI 已经实现。调用方必须至少同时检查：

```js
capability.status === "available"
  && capability.availableTransports.includes("local-mcp")
```

状态含义如下：

| `status` | 含义 |
| --- | --- |
| `available` | 至少一个声明的适配器已经可用，具体以 `availableTransports` 为准。 |
| `existing-api` | 站内已有底层 API，但 CLI/MCP 适配器未必存在；不能把目标 `transport` 当成可调用能力。 |
| `adapter-planned` | 只是纳入治理清单和后续设计，当前不得调用。 |
| `restricted` | 受限或高危能力，只保留原有受保护入口，不应暴露给通用 AI 客户端。 |

`requiredScopes` 是必须全部满足的 scope，`anyOfScopes` 非空时还必须至少满足其中一个；两者均是冻结、可机读的授权契约。不要只读取单值 `scope` 推断复合权限。例如图片上传要求 `whiteboard:write + whiteboard:assets`，图片下载要求 `whiteboard:assets + (whiteboard:read 或 whiteboard:write)`。

列出能力：

```powershell
node .\cli\lusu.mjs capabilities
node .\cli\lusu.mjs capabilities --domain transfer --transport local-mcp
```

能力清单用于发现与治理，不是权限凭证。真正执行时仍需通过相应 API 的身份、scope、参数和文件边界校验。

## 2. 本地 CLI

要求 Node.js 22.13 或更新版本。仓库根目录安装依赖后可直接运行：

```powershell
npm.cmd install
node .\cli\lusu.mjs help
```

当前 CLI 支持：

- `capabilities`：查看统一能力清单。
- `content list|search|get|daily`：读取公开文章和 Daily AI News。
- `videos list|get`：读取并筛选公开视频，或按稳定 ID 获取单个视频详情。
- `tools list|get`：读取三项真实可用工具的本地安全目录；占位卡片不会进入结果。
- `games list|get`：读取五个站内游戏的安全目录，可用 `--agent-only` 只看已实现 Agent adapter 的游戏。
- `japanese-subtext levels|stages|get|progress|attempt`：读取 5 个难度、250 个锁定关卡和账号有界进度，或提交由服务端判分的语义答题；进度与答题需要独立、非默认 scope。
- `auth login|status|logout`：设备码登录、检查身份和撤销当前令牌。
- `transfer join|ls|send|put|get|rm`：加入密码房、列出或传输内容；删除必须显式加 `--yes`。
- `whiteboard join|scene|draw|asset put|asset get|export`：加入公共／密码房、读取场景摘要、上传／下载当前房真实图片、追加高层图形或图片并在本地导出；不支持修改／删除既有元素或资源，也不接受任意 Yjs 字节。
- `game create|observe|actions|act|close`：运行隔离的本地 2048 会话；重置和关闭都需要显式确认。

示例（不包含任何真实凭证）：

```powershell
node .\cli\lusu.mjs content search MCP --lang zh
node .\cli\lusu.mjs videos get VIDEO_ID
node .\cli\lusu.mjs games list --agent-only --lang en
node .\cli\lusu.mjs japanese-subtext stages --level 2 --limit 10 --lang ja
node .\cli\lusu.mjs auth login
node .\cli\lusu.mjs auth login --scopes japanese-subtext:progress:read,japanese-subtext:progress:write
node .\cli\lusu.mjs auth login --scopes whiteboard:read,whiteboard:write,whiteboard:assets
node .\cli\lusu.mjs japanese-subtext progress --stage-id L1-001 --days 30
node .\cli\lusu.mjs japanese-subtext attempt --input .\attempt.json
$env:LUSU_ROOM_SECRET | node .\cli\lusu.mjs transfer join --password-stdin
node .\cli\lusu.mjs whiteboard join --public
node .\cli\lusu.mjs whiteboard asset put BOARD_HANDLE .\image.png --operation-id wb_asset_0001
node .\cli\lusu.mjs game create 2048
```

默认站点地址是 `https://lusu575.com`。本地联调可使用全局参数 `--base-url <URL>` 或 `LUSU_BASE_URL` 指向实际预览地址。存储凭据严格绑定登录时的规范化 HTTP(S) origin；切到 Preview 或其他 origin 后不会复用、发送或删除原 origin 的 Bearer。确需给当前覆盖 origin 提供令牌时，只能由操作者显式通过 `--token-stdin` 或受控进程的 `LUSU_ACCESS_TOKEN` 注入。不要把生产令牌写进命令历史；常规使用优先采用 `auth login` 为目标 origin 创建的本机凭据文件。

本地状态目录按以下顺序解析：`LUSU_CONFIG_DIR`、Windows 的 `%APPDATA%\lusu-cli`、其他系统的 `~/.config/lusu-cli`。其中的 `credentials.json`、`rooms.json`、`whiteboards.json` 与 `game-sessions/` 是本机私有状态，不得提交、上传或复制进日志。白板句柄和游戏会话 ID 都是不透明本地引用，不是服务器房间 ID 或授权凭证。白板句柄更新使用跨进程 owner-token 锁和同目录临时文件原子替换；游戏会话使用带 owner／进程／心跳校验的独立锁，不能退回无锁 read-modify-write 或先截断目标文件。

## 3. 本地 stdio MCP

启动命令：

```powershell
node .\mcp\local\server.mjs
```

在支持 stdio MCP 的客户端中，将 `command` 配为 Node.js，将 `args` 配为该脚本的绝对路径。例如下面仅为结构示意，路径应改成客户端所在机器的仓库路径：

```json
{
  "command": "node",
  "args": ["F:\\lusu575个人站\\mcp\\local\\server.mjs"],
  "env": {
    "LUSU_MCP_ALLOW_ROOT": "F:\\AI交换区"
  }
}
```

不要在 MCP 配置文件中填写房间口令或真实访问令牌。先用 CLI 完成设备码登录即可复用本地凭据；房间口令只通过下文的 `secretRef` 从启动 MCP 进程的本地环境读取。

当前本地 MCP 工具：

- 发现：`capabilities_list`
- 公开内容：`content_list`、`content_search`、`content_get`、`daily_news_get`、`videos_list`、`video_get`
- 公开目录：`tools_list`、`tools_get`、`games_list`、`game_get`
- 日语题库与进度：`japanese_subtext_levels`、`japanese_subtext_stages`、`japanese_subtext_stage_get`、`japanese_subtext_progress_get`、`japanese_subtext_attempt_submit`
- Quick Transfer：`transfer_join`、`transfer_list`、`transfer_send_text`、`transfer_upload`、`transfer_download`、`transfer_delete`
- 在线画板：`whiteboard_join`、`whiteboard_scene`、`whiteboard_asset_upload`、`whiteboard_asset_download`、`whiteboard_draw`、`whiteboard_export`
- 2048：`game_create`、`game_observe`、`game_actions`、`game_act`、`game_reset`、`game_close`

本地 MCP 的公开内容、视频、游戏目录、日语题库／进度、Quick Transfer 与在线画板使用网站 API 或站点静态 JSON，因此依赖网络；工具目录来自受审查的本地公开数据模块。Quick Transfer、在线画板和日语账号进度还需要有效的 Agent Bearer 令牌及对应 scope。2048 隔离会话完全在本机运行，不发送站点请求。CLI 与 stdio MCP 会向 `SiteClient` 注入项目共享的代理感知 `fetch`，按 `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` 工作；代理值、凭据和原始令牌不得写入日志或 MCP 输出。

## 4. 设备码授权、scope 与令牌管理

`lusu auth login` 使用站点自己的设备码流程：

1. CLI 向 `POST /api/agent-auth/device/start` 申请设备码。
2. CLI 显示并通常打开返回的 `verificationUriComplete`；用户必须先在网站登录，再核对八位用户码和请求的 scopes。
3. 用户在浏览器中允许或拒绝，CLI 以服务器指定间隔轮询 `POST /api/agent-auth/device/token`。
4. 允许后，原始访问令牌只返回一次；服务器只保存其哈希。CLI 将令牌写入本机私有状态。

设备码有效期为 10 分钟，建议轮询间隔为 5 秒；访问令牌有效期为 30 天。服务器会限制设备码申请、查询频率以及单个账户的有效令牌数量。CLI 遇到网络失败、请求中止或 408／425／500／502／503／504 等明确瞬态故障时，只会在设备码剩余有效期内有界退避继续；不会把访问令牌、代理值或底层网络细节写到输出。

浏览器授权确认页和令牌管理页使用 `Referrer-Policy: strict-origin`：普通 HTML 表单可以携带当前页面的精确来源站点，但不会泄露包含 `user_code` 的路径或查询；JSON 响应继续使用 `no-referrer`。所有授权、拒绝和撤销 POST 仍必须同时通过有效登录态、精确 Origin 与双提交／D1 绑定的 CSRF，缺失或 `null` Origin、与授权页不同的同站异源和任意攻击者来源都拒绝。授权 GET 可由 CLI、Codex 或外部网页作为顶层文档打开，但 iframe、图片及 fetch/XHR 等非顶层上下文继续拒绝。

当前可申请 scopes：

| scope | 用途 |
| --- | --- |
| `content:read` | 读取公开内容。 |
| `transfer:read` | 查看已加入的 Quick Transfer 房间并下载。 |
| `transfer:write` | 加入房间、发送文本和上传文件。 |
| `transfer:delete` | 删除房间项目或中止分片上传；默认登录不授予。 |
| `whiteboard:read` | 加入画板并读取场景；默认登录不授予。 |
| `whiteboard:write` | 追加受支持的画板元素，并隐含读取；默认登录不授予。 |
| `whiteboard:assets` | 访问画板原始图片字节；上传还要求 write，下载还要求 read 或 write，场景图片分支还要求 write；默认登录不授予。 |
| `japanese-subtext:progress:read` | 读取令牌所属账号的有界日语学习进度；默认登录不授予。 |
| `japanese-subtext:progress:write` | 提交令牌所属账号的受控日语答题；默认登录不授予。 |

默认请求 `content:read,transfer:read,transfer:write`。确实需要删除时，应在登录时单独请求最小增量权限，例如：

```powershell
node .\cli\lusu.mjs auth login --scopes content:read,transfer:read,transfer:write,transfer:delete
```

管理入口与机器接口：

- `/api/agent-auth/tokens/manage`：已登录的网站用户查看、逐个撤销或全部撤销自己的 Agent 令牌；“全部撤销”也会取消已批准但尚未兑换的设备授权，避免它在撤销后再签发新令牌。
- `GET /api/agent-auth/me`：Bearer 客户端检查当前用户、scope 和到期时间。
- `DELETE /api/agent-auth/tokens/current`：撤销正在使用的 Bearer 令牌；`lusu auth logout` 会调用它并清理本机凭据。

Agent Bearer 只代表一个普通机器会话。即使所属网站账户是管理员，它也不能借此进入管理员接口或绕过 Quick Transfer 的权限边界。

## 5. Quick Transfer 的秘密与文件边界

### 房间口令

房间口令必须只在本机出现：

- CLI 只接受隐藏交互输入或 `--password-stdin`，明确拒绝 `--password` 和 `--password=...`。
- 本地 MCP 的 `transfer_join` 只接受形如 `env:LUSU_ROOM_SECRET` 的 `secretRef`；MCP 参数只包含引用名，不能包含口令本身。
- 口令不能进入 argv、MCP tool 参数、日志、响应或网站服务器。
- 本机会从口令派生房间键和文本加密键；服务器只接收派生的房间键及已经加密的文本，不接收原始口令。
- `roomHandle` 是本机不透明句柄，不是口令。状态文件不会持久化原始口令或文本密钥；MCP 可保存环境变量引用，以便后续在本机重新派生文本密钥。

文件上传沿用 Quick Transfer 现有文件传输语义；“文本在本机加密”不应被误写成“所有文件内容都端到端加密”。

### allow-root

stdio MCP 的文件工具必须受 `LUSU_MCP_ALLOW_ROOT` 限制。Windows 上多个根目录用分号分隔；未配置时，默认只允许 MCP 进程的当前工作目录。

```powershell
$env:LUSU_MCP_ALLOW_ROOT = "F:\AI交换区;F:\可下载目录"
node .\mcp\local\server.mjs
```

`fileRef` 可以是相对于第一个根目录的路径，也可以是位于任一允许根内的绝对路径。读取时会解析真实路径，写入时会解析真实父目录，从而阻止 `..` 或链接把访问逃逸到允许根之外。

CLI 的 `transfer put|get` 是操作者直接给出的本机路径，不套用 MCP 的 allow-root；在无人值守 AI 场景应优先使用受 allow-root 约束的 stdio MCP。

### no-clobber

CLI 和 MCP 下载都不覆盖已有文件。目标文件以独占创建方式打开；文件已经存在时直接失败，传输中途失败时清理本次未完成文件。调用方不得通过“先删除再下载”绕过这条默认保护，除非用户明确授权了单独的文件删除动作。

## 6. 在线画板 Agent 的双令牌、图片与追加边界

白板 CLI／MCP 使用站点专用 Agent HTTP 路由，不属于 `workers/site-mcp/`，也不是标准 OAuth 公网远程写能力：

- Agent Bearer 只证明用户和 `whiteboard:read`／`whiteboard:write`／`whiteboard:assets` scope；加入房间后还必须携带独立、短期且绑定当前 Agent tokenId 的房间访问令牌。两者不能互换，也不得进入 URL。write 只隐含场景 read；上传图片必须同时具备 write+assets，下载原图必须具备 assets 加 read/write。
- 密码房口令只允许 CLI 隐藏输入／`--password-stdin`，或 MCP 的 `env:NAME` `secretRef`。MCP schema 不接受明文 `password`；口令经同源 HTTPS 请求体送到服务端做 HMAC 房间映射，本地句柄和响应永不回显它。
- 绘制前必须获取最新完整 Yjs 状态。适配器只从高层文字／矩形／椭圆／菱形／线条／箭头／图片描述创建确定性 Excalidraw 元素；单次最多 50 个。图片只能引用当前房已经完成 R2 提交、逐字段匹配 DO 权威 `ImageMeta` 的资源。没有 assets scope 的 write-only 请求、pending 或跨房资源、URL／Base64／SVG／HTML、伪造元数据、孤立资源、既有元素／资源改删、链接／绑定／`customData`／未知根数据都会由服务端拒绝；规范既有资源可继续被引用，同图可放置多次。
- `whiteboard asset put`／`whiteboard_asset_upload` 只读取最大 5 MiB 的真实常规 PNG／JPEG／WebP，并严格验证容器边界、关键块段、声明宽高与像素数；该边界不宣称完整像素解码。MCP 还拒绝 allow-root 外路径和符号链接。上传使用独立 operation ID + byte SHA-256 收据，同字节重试完成同一资源，换字节复用 ID 冲突。`whiteboard asset get`／`whiteboard_asset_download` 只读取当前房资源，目标独占创建且不覆盖；MCP 输出不包含本机绝对路径、令牌或内部房间 ID。
- `operationId` 与载荷 SHA-256 形成每房幂等收据。同一载荷安全重试，不同载荷不得复用 ID；房间锁定时写入失败。公共房不设空房 TTL；密码房 Agent 写入会重置空房 24 小时期限，但不计在线人数。
- `whiteboard_export` 只在 MCP allow-root 内独占创建目标，不覆盖现有文件。JSON 保留高层元素和图片资源引用；简化 SVG／PNG 当前忽略图片字节并返回警告，不能当作浏览器 Excalidraw 的像素级等价导出。

## 7. 2048 隔离会话与页面桥

首个游戏适配器只支持 `2048`。`game_create` 创建本机隔离会话，之后按 `observe -> actions -> act` 协议执行：

- observation 和 action 都是有界 JSON；AI 只能选择引擎声明的 `up`／`down`／`left`／`right` 语义动作，不能发送选择器、脚本、按键或任意页面调用。
- 每次动作必须带当前 `expectedRevision` 和唯一 `clientActionId`。revision 不匹配会拒绝，最近 128 个 action ID 用于幂等重试；相同 ID 搭配不同动作会拒绝。
- 会话数量、序列化状态大小和闲置 TTL 都有上限，并使用本地锁和原子替换持久化。`game_observe`／`game_actions` 是真实只读操作，不写文件、不延长 TTL；只有动作更新会续期。`game_reset`、CLI `--reset` 与 `game_close` 是破坏性操作，必须显式确认。
- 2048 页面加载同一份纯引擎，并公开冻结的 `window.gamePage.agent` 语义桥，保留既有 `window.gamePage.save` 兼容性。当前 CLI／MCP 不与已经打开的浏览器页面配对，所以这是隔离模拟会话，不是远程接管或观看现有玩家会话。

## 8. 公开目录与日语题库的安全投影

第三阶段的目录工具读取的是公开内容，但仍不把面向浏览器的原始 manifest 直接交给 AI：

- 工具目录只返回带稳定 `toolId` 的在线画板、Quick Transfer 和日语工具。示例占位卡、未完成资源和任意外链不进入机器能力面。
- 游戏目录只返回稳定 ID、三语标题／摘要、语言支持、固定同源启动路径、许可证／仓库和真实 Agent 支持状态；不返回 `sourceEntry`、存储键／默认值、内部语言映射或任意启动查询。只有 2048 标记本地隔离会话与页面语义 bridge，其他游戏仍只是可发现、不可接管。
- 日语能力只访问固定 catalog、五个 level index 和由合法 `L1-001` 至 `L5-050` ID 推导出的固定 batch。适配器限制 JSON 字节、条目和搜索结果，验证 schema、`contentVersion: 1.0.2`、250 关计数、唯一 ID、64 位 SHA-256、`textLocked: true` 与关卡哈希；输出省略 batch 路径、内部音频文本和构建字段。
- 所有公开目录参数只接受 zh／en／ja、白名单 ID、1–5 等级和有界 limit／query。URL 必须是固定站内路径或安全 GitHub HTTPS 地址，调用方不能借参数读取任意文件或 URL。

这些目录本身仍是只读发现面；账号日语进度由下节独立 scope 和专用 API 承担，不把浏览器原始存档混入目录响应。工具目录来自本地模块，因此只在 CLI／本地 MCP 可用；游戏和日语数据虽由正式站点提供，独立远程 MCP Worker 本阶段仍未接线或部署。

## 9. 日语账号进度与受控答题

日语进度能力只服务本地 CLI／stdio MCP 使用的站点 Agent Bearer，不属于独立远程 MCP Worker：

- `GET /api/tools/japanese-subtext/agent-progress` 需要 read scope，只返回 revision、当前与已解锁关卡、通关／奖牌／尝试汇总、可选单关进度和默认 30 天、最多 90 天的近期活动。它不返回邮箱、userId、D1 行、完整 5,000 行活动并集，也不会因为读取而创建 profile、增加 revision 或刷新活动。
- `POST /api/tools/japanese-subtext/attempts` 需要 write scope，只接受 `stageId`、`stageRevision`、`contentHash`、完整的逐题 `answers`、`expectedRevision` 和 `operationId`。额外字段、未解锁关、旧题库、漏题、重题、未知选项与过大正文都会失败关闭。
- 服务端从固定同源题库重新加载锁定关卡并权威判分。调用方不能提交 score、medal、cleared、attempts、unlockedStageIds、时间戳或 userId；Agent 辅助答题固定按 bilingual 记录，最高只能得到 bronze，不能冒充纯听金牌。
- revision CAS 防止覆盖并发浏览器／Agent 进度；operationId 与 canonical payload SHA-256 形成幂等收据。相同载荷在 180 天收据保留窗口内重试会返回原结果且不重复计次，不同载荷复用同一 ID 返回 409；客户端必须永久生成新的 operationId，不得在收据过期清理后复用旧 ID。
- Agent 活动日固定按站点 `Asia/Shanghai` 日界线计算，GET 投影的 `activity.timeZone` 会明确返回这一口径；浏览器应用仍按设备本地日记录其原生会话，两者的计分、奖牌、解锁与合并规则相同。
- 浏览器现有 Cookie `GET/PUT /api/tools/japanese-subtext/progress` 继续负责原应用的完整快照合并，没有改成 Agent 接口。此次未修改公开应用、题库和存档兼容边界，所以 appVersion 仍为 1.0.3、contentVersion 仍为 1.0.2。

## 10. 远程 Cloudflare MCP：当前只是未部署的公开只读面

独立工程位于 `workers/site-mcp/`。它当前没有部署，也没有 OAuth；不要把仓库中的 Worker 配置理解为线上端点已经存在。

设计边界：

- `/mcp` 提供无状态 Streamable HTTP MCP，每个请求创建新的 `McpServer`。
- `GET /health` 只返回健康信息。
- Worker 通过 `DB` binding 直接读取与个人站共享的 D1 公共文章数据，不经过公开网站 HTTP，也不接触草稿、房间、文件、聊天写入、存档、白板写入、发布或管理员操作。
- 当前公开工具为 `site_capabilities`、`content_list`、`content_search`、`article_get`。
- 另有公开文章资源模板 `lusu://articles/{slug}{?lang}`。
- Daily AI News 通过 `content_list(category: "daily-ai-news")` 找到文章，再调用 `article_get`，不是单独的发布或自动化工具。
- 保留 MCP handler 默认的 Host 与浏览器 Origin 校验，不得改成通配放行。

部署目标 `compatibility_date` 是 `2026-08-06`，并启用 `nodejs_compat`。当前锁定的 Wrangler 所带本地 workerd 最多支持 `2026-07-29`，所以 `npm.cmd run dev` 和 Vitest 只在本地使用 `2026-07-29` override；这个 override 不是生产目标，升级 Wrangler/workerd 后应移除。

本地验证：

```powershell
Set-Location .\workers\site-mcp
npm.cmd install
npm.cmd run typecheck
npm.cmd test
npm.cmd run dev
```

本地开发不要加 `--remote`，不要连接生产 D1，也不要执行 `wrangler deploy`。远程写操作必须等第一方 OAuth 2.1、用户映射、最小 scope 与审计边界完成后再单独设计；不能把网站 `lusu_session` cookie 转交给 MCP。

### 10.1 每日 AI 新闻 owner-only 远程发布候选

`workers/daily-ai-news-mcp/` 是与公开只读 Worker 完全分离的受限工程，只
用于 GPTWork 每日任务提交已经通过正式门禁的最终三语文章。它不是公开
内容服务，也不能加入 `workers/site-mcp/`。

- Cloudflare Access Managed OAuth 在边缘提供授权流程，Worker 仍必须在
  源站验证 `Cf-Access-Jwt-Assertion` 的签名、issuer、audience、必需身份／
  时间 claims 和精确 owner email，并拒绝错误 Host 与任何 browser Origin；
  缺配置、缺 JWT、非 owner 或验证失败全部拒绝。
- MCP 只注册 `publish_daily_ai_news`。调用方不能控制 slug、分类、状态、
  标签、封面、置顶和时间；只接受当天完整 zh／en／ja 最终稿。
- 正常自动窗口固定为 `Asia/Shanghai` 07:00–08:00。相同最终稿重放返回
  既有结果，同日不同内容返回冲突；不存在换 slug 或轮换键绕过分支。发布
  前只读核对现有专用 channel 的 enabled+auto-publish，成功前从正式站三语
  公开 API 精确回读 slug、category、status、语言、标题、摘要和正文。回读
  携带真实跨站 Worker 来源，使现有 read-source gate 跳过 article-view、
  visitor profile 与 view-count 写入。
- Worker 只绑定现有 Production D1，并只写 `articles` 与
  `article_translations`；不绑定 KV／R2／DO／Queue，不写投递事件、通道
  状态、候选、草稿、运行记录或缓存。
- 当前代码和本地测试不等于远端已经可用。Access 应用、Managed OAuth、
  Worker 部署、GPTWork connector 和定时写确认都通过验收也还不够：当前
  tool 只能校验最终文章结构，不能证明完整 Horizon/editorial run 已通过
  正式 validator。服务端能够验证当次完整运行包，或能验证绑定日期和精确
  三语内容 hash 的短时可信签名回执后，才能把
  `automation.daily-ai-news.publish` 的 `remote-mcp` 加入
  `availableTransports` 并停用本机兼容计划；在此之前只允许站长逐次确认的
  交互试投，定时任务只生成不上传。

## 11. 仍是 inventory / planned 的能力

- 白板读取、图片上传／下载、高层追加和本地导出，以及隔离的 2048 会话已经在本地 CLI／stdio MCP 可用；它们不表示远程 MCP 写入、白板任意编辑／删除，或浏览器游戏接管已经完成。
- 五个游戏的安全目录已经可读，但除隔离 2048 外，其他游戏的语义动作 adapter、已打开浏览器游戏的配对／观看／控制，以及游戏云存档通用写入仍需单独适配与授权。
- 日语等级／关卡公开内容和账号进度闭环已经可用；聊天写入、任意完整进度快照写入、游戏存档写入等条目仍只是既有 API 的 inventory 或受限入口，没有通用 CLI/MCP 写适配器。
- Daily AI News、Tool Radar 的生产发布能力是 `restricted`，不会出现在
  公开远程 MCP 或通用本地 MCP 中。Daily AI News 的独立 owner-only 远程
  候选在生产验收前也保持 unavailable。

后续接入必须先补可验证的业务适配层、输入/输出 schema、身份与 scope、幂等/确认机制和审计，再将对应传输加入 `availableTransports`。不能只改 `transport` 或工具描述来宣称完成。

## 12. 验证、部署与回滚边界

合并前至少执行：

```powershell
npm.cmd run transfer:test
npm.cmd run whiteboard:test
npm.cmd run game:test
npm.cmd test
npm.cmd run build
npm.cmd run build:production:verify
npm.cmd run check:subprojects
git diff --check
git diff --stat

Set-Location .\workers\site-mcp
npm.cmd run typecheck
npm.cmd test
```

还应验证以下安全契约：

- 注册表筛选只把 `availableTransports` 中确实存在的适配器显示为可用。
- CLI 拒绝 argv 中的房间口令，MCP schema 拒绝 `password` 字段，只接受环境 `secretRef`。
- 缺 scope 的令牌得到拒绝；Agent Bearer 不能访问管理员端点。
- 日语进度 GET 不改变 revision／活动；答题拒绝未解锁关、旧题库／进度、额外派生字段、漏题／重题／未知选项，并覆盖同 operationId 同载荷重放与异载荷冲突。除已声明的日界线口径外，计分、奖牌、活动合并和解锁语义必须与浏览器 `recordAttempt()` 一致。
- 白板 Agent Bearer 与房间访问令牌保持分离；追加验证只在独立 assets scope、可信内部 header 和当前房已提交元数据同时满足时接受规范图片，并继续拒绝既有修改／删除、孤立资源与未知根。scene／asset operation ID 的重试与冲突均有覆盖。
- 2048 CAS、action ID 重放、状态篡改、会话上限、TTL，以及重置／关闭确认均有覆盖；测试不声称连接已打开的浏览器。
- 公开工具／游戏／日语适配器拒绝 traversal、恶意 ID、任意 URL、超限 JSON、重复 ID、版本／计数／hash／`textLocked` 不匹配，并确认输出不含源文件路径、存储键、题库 batch 路径或内部音频文本。
- allow-root 的相对路径、绝对路径、`..`、链接逃逸及不存在父目录均有覆盖。
- 下载已有文件时失败且原文件字节不变；失败下载不留下半成品。
- 远程 MCP 只能读取已发布文章，返回内容和结果大小有界，错误输出不泄露 SQL 或凭据。

部署边界：

- 个人站的正常发布路径仍是合并到 GitHub `main` 后由 Cloudflare Pages 自动部署；不要把手工 Wrangler Pages 部署当成常规路径。
- `workers/site-mcp` 是独立 Worker，第一阶段明确不部署。未来部署必须由站点所有者单独批准，并先复核 D1 binding、公开数据范围、域名/Origin、限流、监控与认证路线。
- 本地 CLI 与 stdio MCP 本身不需要服务器部署；它们调用的 Agent Auth／Transfer／Whiteboard API 必须先存在于目标站点。白板 Pages Agent 路由依赖新的 Durable Object 协议，因此发布时必须先部署并验证兼容 Worker，再让 Pages 使用新路由。
- 任何验证命令都不得使用生产凭据、生产房间口令或 `--remote` D1。

回滚时优先撤回代码或恢复上一版 Pages/Worker 路由；不要为了紧急回滚直接删除 D1 表。若 Agent Auth 已经上线，应先通过令牌管理页撤销令牌，再停用新入口，并保留哈希令牌记录与审计记录用于排查。当前远程 MCP 尚未部署，因此不存在需要回滚的线上 MCP 实例。
