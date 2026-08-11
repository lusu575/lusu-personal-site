# AI 能力层：架构与运行手册

本目录记录个人站“同一份业务能力，同时服务网站 API、CLI 与 MCP”的当前边界。前七阶段已经搭好统一能力清单、本地 CLI、本地 stdio MCP、设备码授权、Quick Transfer、受限的在线画板 Agent 通道（含真实图片闭环）、2048 与人生重开模拟器的集成式游戏适配器、独立 GPL 进程边界内的 Hextris 游戏适配器、知识库文章的管理员原子发布／CAS 更新／确认删除、视频／工具／游戏／日语题库的公开只读目录，以及日语账号进度读取与受控答题。生产 OAuth remote MCP 位于 `https://lusu575.com/mcp`，当前精确 Worker version 为 `849d8328-87db-4ac8-819a-ce725fc06349`，内部版本 `0.3.1`，承接 100% 流量；metadata、未鉴权 401 与非 allowlist pathname 404 基础线上点检已通过，但当前 bundle 尚未完成外链视频或四款浏览器游戏的 bundle-specific 生命周期。历史视频验收只绑定 `377d494b-8f90-40ad-998f-863d209e1978`，已上线的 Pages 心跳也曾在 Chrome 后台约 5 分钟强节流验收中断线。视频条目的 `availableTransports` 尚未包含 `remote-mcp`，游戏条目的 `availableTransports` 仍为空；公开 `site_capabilities` 继续只列已晋级的四项文章读取能力。这不是“全站所有功能已经接入”或“浏览器游戏已经可从生产 MCP 接管”的声明。

仓库 0.4.0 候选只扩展既有 `video_publish` 的输入便利性：工具总数仍为 23，scope 仍为 `content:write`，发布结果仍直接是 `status=published`。AI 可以只提交唯一 `operationId` 和 YouTube／Bilibili／b23.tv 链接，其余展示元数据由服务端有界补全；这不是新增工具或当前生产已经升级的声明。

首次候选曾临时部署为精确 Worker `9b0bd726-2c15-414c-bdff-fc5179b4e003`。DCR、PKCE、站长 OAuth 与 23 项工具发现通过，但链接-only YouTube 发布因标题解析失败而零写入返回 `VIDEO_METADATA_TITLE_UNAVAILABLE`；grant 已撤销，生产已回滚到 0.3.1 `849d8328-87db-4ac8-819a-ce725fc06349`。仓库候选随后加入有界的官方 YouTube watch page 兜底，但尚未重新部署或生产验收；只有站长再次明确授权后才能重跑闭环，registry 保持不变。

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
- `content list|search|get|daily`：读取公开文章和 Daily AI News；`content manage-list|manage-get|publish|update|delete` 通过管理员批准的非默认 scope 管理普通知识库文章。
- `videos list|get`：读取并筛选公开视频，或按稳定 ID 获取单个视频详情。
- `tools list|get`：读取三项真实可用工具的本地安全目录；占位卡片不会进入结果。
- `games list|get`：读取五个站内游戏的安全目录，可用 `--agent-only` 只看已实现 Agent adapter 的游戏。
- `japanese-subtext levels|stages|get|progress|attempt`：读取 5 个难度、250 个锁定关卡和账号有界进度，或提交由服务端判分的语义答题；进度与答题需要独立、非默认 scope。
- `auth login|status|logout`：设备码登录、检查身份和撤销当前令牌。
- `transfer join|ls|send|put|get|rm`：加入密码房、列出或传输内容；删除必须显式加 `--yes`。
- `whiteboard join|scene|draw|asset put|asset get|export`：加入公共／密码房、读取场景摘要、上传／下载当前房真实图片、追加高层图形或图片并在本地导出；不支持修改／删除既有元素或资源，也不接受任意 Yjs 字节。
- `game create|observe|actions|act|close`：通过主 CLI 运行隔离的本地 2048 或人生重开模拟器会话；重置和关闭都需要显式确认。
- `games/hextris/agent/cli.mjs create|observe|actions|act|reset|close`：通过独立 GPL 进程运行确定性的 Hextris 本地会话；它不导入主 CLI，也不连接已经打开的浏览器页面。

示例（不包含任何真实凭证）：

```powershell
node .\cli\lusu.mjs content search MCP --lang zh
node .\cli\lusu.mjs auth login --scopes content:read,content:write,content:delete
node .\cli\lusu.mjs content publish --input .\article.json
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
node .\cli\lusu.mjs game create life-restart
node .\games\hextris\agent\cli.mjs create --seed 123
```

默认站点地址是 `https://lusu575.com`。本地联调可使用全局参数 `--base-url <URL>` 或 `LUSU_BASE_URL` 指向实际预览地址。存储凭据严格绑定登录时的规范化 HTTP(S) origin；切到 Preview 或其他 origin 后不会复用、发送或删除原 origin 的 Bearer。确需给当前覆盖 origin 提供令牌时，只能由操作者显式通过 `--token-stdin` 或受控进程的 `LUSU_ACCESS_TOKEN` 注入。不要把生产令牌写进命令历史；常规使用优先采用 `auth login` 为目标 origin 创建的本机凭据文件。

主 CLI 本地状态目录按以下顺序解析：`LUSU_CONFIG_DIR`、Windows 的 `%APPDATA%\lusu-cli`、其他系统的 `~/.config/lusu-cli`。其中的 `credentials.json`、`rooms.json`、`whiteboards.json` 与 `game-sessions/` 是本机私有状态，不得提交、上传或复制进日志。Hextris 独立进程另按 `LUSU_HEXTRIS_AGENT_DIR`、Windows 的 `%APPDATA%\lusu-hextris-agent`、其他系统的 `~/.config/lusu-hextris-agent` 解析自己的状态根，不能与主 CLI 状态目录混用。白板句柄和游戏会话 ID 都是不透明本地引用，不是服务器房间 ID 或授权凭证。白板句柄更新使用跨进程 owner-token 锁和同目录临时文件原子替换；游戏会话使用 token marker 非空目录锁、PID／进程实例／心跳校验、同 token retiring 释放和提交前 owner fence，不能退回无锁 read-modify-write、先截断目标文件，或采用可能误删 successor 的“读 owner 后按公共路径删除”流程。

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
- 知识库管理：`article_manage_list`、`article_manage_get`、`article_publish`、`article_publish_files`、`article_update`、`article_delete`
- 公开目录：`tools_list`、`tools_get`、`games_list`、`game_get`
- 日语题库与进度：`japanese_subtext_levels`、`japanese_subtext_stages`、`japanese_subtext_stage_get`、`japanese_subtext_progress_get`、`japanese_subtext_attempt_submit`
- Quick Transfer：`transfer_join`、`transfer_list`、`transfer_send_text`、`transfer_upload`、`transfer_download`、`transfer_delete`
- 在线画板：`whiteboard_join`、`whiteboard_scene`、`whiteboard_asset_upload`、`whiteboard_asset_download`、`whiteboard_draw`、`whiteboard_export`
- 2048／人生重开模拟器：`game_create`、`game_observe`、`game_actions`、`game_act`、`game_reset`、`game_close`

Hextris 不注册到上述通用服务。它由 `node .\games\hextris\agent\mcp-server.mjs` 启动专用 stdio MCP 进程，只公开 `hextris_session_create`、`hextris_session_observe`、`hextris_session_actions`、`hextris_session_act`、`hextris_session_reset` 与 `hextris_session_close`。这个进程及其引擎、存储和测试全部位于 `games/hextris/agent/`，不静态导入主站 `lib/capabilities/`、`cli/` 或 `mcp/local/`；完整 GPL 文本和来源说明随该目录发布。

本地 MCP 的公开内容、知识库管理、视频、游戏目录、日语题库／进度、Quick Transfer 与在线画板使用网站 API 或站点静态 JSON，因此依赖网络；工具目录来自受审查的本地公开数据模块。知识库写入、Quick Transfer、在线画板和日语账号进度还需要有效的 Agent Bearer 令牌及对应 scope。2048 与人生重开模拟器由通用进程在本机运行，Hextris 由专用进程在本机运行，它们都不发送站点请求。通用 CLI 与 stdio MCP 会向 `SiteClient` 注入项目共享的代理感知 `fetch`，按 `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` 工作；代理值、凭据和原始令牌不得写入日志或 MCP 输出。

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
| `content:write` | 管理并原子发布普通知识库文章；仅当前站点管理员可批准，默认登录不授予。 |
| `content:delete` | 永久删除符合 CAS revision 的普通知识库文章；仅当前站点管理员可批准，默认登录不授予。 |
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

Agent Bearer 仍只代表一个普通机器会话，不能进入 `/api/admin/*` 或绕过 Quick Transfer 的权限边界。知识库写入是唯一的专用管理员 Agent 通道：`content:write`／`content:delete` 只能由当前管理员在设备授权页批准，每次请求还会重新核对令牌所属账号仍为管理员；这不会把管理员角色写进或返回给机器 principal。

### 知识库文章的原子 MCP 边界

- `article_publish` 在一个 D1 batch 中同时写入文章元数据、zh／en／ja 三语正文、审计事件和幂等收据；任何一步失败都不会留下半篇文章。`operationId` 与 canonical payload SHA-256 绑定，完全相同的重试返回原结果，换载荷或换动作复用 ID 返回 409。
- `article_publish_files` 先在本地 MCP 内读取 `LUSU_MCP_ALLOW_ROOT` 下三个真实、非符号链接、有效 UTF-8 的 `.md`／`.markdown` 文件，每个最多 200,000 字节；绝对路径和 `contentFile` 不会发送到网站或进入工具输出，随后调用同一原子发布事务。
- `article_update` 必须提供 `expectedUpdatedAt` 和新 `operationId`。服务端在同一 batch 中完成 CAS、指定语言／元数据更新、审计和收据；陈旧 revision 不覆盖新内容。
- `article_delete` 必须同时提供 `confirm: true`、`expectedUpdatedAt`、独立 `content:delete` scope 与 `operationId`。精确重试即使文章已经删除也能读取原收据；不同载荷复用 ID 会失败。
- publish／update／delete 收据由周期健康检查按 180 天边界分批清理。调用方必须永久生成新的 `operationId`，不得把过期后的旧 ID 当成可复用 ID；只有收据仍在保留窗口内时，服务端才保证精确重试返回原结果。
- `site-updates`、`daily-ai-news` 与 `tool-radar` 是受治理发布通道，通用文章 Agent 工具明确拒绝创建、修改或删除这些分类；它们继续遵守各自的公开更新／自动投递规则。
- Pages 设备通道仍通过专用 `/api/agent/articles*` 暴露给已授权管理员令牌；生产站长远程 OAuth Worker 复用同一 transport-neutral 文章服务，不复制发布规则。`workers/site-mcp/` 只提供四个公开读取工具的复用注册层；五个站长工具始终留在 `workers/site-admin-mcp/` 的 OAuth 边界内。

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

## 7. 游戏隔离会话、页面桥与许可证边界

浏览器接管候选与下述隔离会话是两条不同的数据面。候选页面桥覆盖 2048、Hextris、A Dark Room 与人生重开，并共享冻结的语义协议：页面只返回有界 observation、current revision 和不透明 `actionId`；调用方不能提交选择器、脚本、原始按键、坐标、URL、任意 DOM 命令或原始存档。浏览器必须由玩家显式生成一次性配对码并保留可见的锁定、暂停、收回／断开和关闭控制；同一页面一次只允许一个 pending command，revision 不匹配、超时、断线或玩家收回后都失败关闭。当前生产候选 bundle 已承载这些工具，但四游戏真实闭环未通过，远程工具仍不在 `availableTransports`。

2048 点检在暂停后等待玩家恢复时出现空闲 WebSocket 断线。当前生产 Worker `849d...` 保留 Cloudflare Hibernation 的 `setWebSocketAutoResponse("ping", "pong")`；Pages 页面每 8 秒发送精确应用层文本 `ping` 并忽略精确 `pong`，且线上精确字节已经核验。该自动响应不唤醒 Durable Object、不调用 provider snapshot、不生成 observation／action、不改变 revision，也不写中继存储；但 Chrome 标签在后台约 5 分钟后受到强计时器节流，页面停发足够久后真实连接仍断开，因此仅靠这条边缘自动响应不能算作完整暂停保活。

当前生产 Worker `849d...` 已部署 paused `game_browser_observe` 下行保活：仅在已鉴权、已绑定 owner／grant 的暂停状态中先取得 browser socket，并发送精确原始文本 `pong`；socket 缺失或发送失败时标记断线并返回 `GAME_BROWSER_DISCONNECTED`。成功后只更新既有控制器活跃时间、持久化中继状态并返回缓存的暂停快照，不更新 `lastBrowserAt`、不读 provider、不生成新 observation、不执行 action、不改变 revision，也不新增协议消息类型。只有持续轮询 paused observe 的客户端获得这条下行帧：生产验收 helper 使用 1.5–10 秒间隔，客户端契约不得超过 20 秒；它不是 Worker 主动周期，客户端停止轮询后不保证永久保活。浏览器恢复继续只接受玩家 `user_resume`。该逻辑已部署但尚未完成生产生命周期验收；四款游戏仍须绑定 `849d...` 逐一重跑配对、动作、暂停、后台等待、玩家恢复、确认关闭和 grant 撤销。

主能力层的集成式游戏适配器支持 `2048` 与 `life-restart`。`game_create` 创建本机隔离会话，之后按 `observe -> actions -> act` 协议执行：

- observation 和 action 都是有界 JSON；AI 只能选择当前适配器声明的语义动作。2048 只接受 `up`／`down`／`left`／`right`，人生重开只接受下文的阶段化动作；两者都不能接收选择器、脚本、按键或任意页面调用。
- 每次动作必须带当前 `expectedRevision` 和唯一 `clientActionId`。revision 不匹配会拒绝，最近 128 个 action ID 用于幂等重试；相同 ID 搭配不同动作会拒绝。
- 会话数量、序列化状态大小和闲置 TTL 都有上限，并使用本地锁和原子替换持久化。超过 4 KiB 且确实变小的 action 幂等结果以 deflate-raw、原始长度和 SHA-256 存储，解压输出最多 96 KiB；非规范 Base64、篡改或膨胀输入失败关闭，旧的未压缩收据继续可读。这样保留最近 128 个完整结果时，长轨迹不会无谓耗尽默认 512 KiB 会话上限。`game_observe`／`game_actions` 是真实只读操作，不写文件、不延长 TTL；只有动作更新会续期。`game_reset`、CLI `--reset` 与 `game_close` 是破坏性操作，必须显式确认。
- 2048 页面加载同一份纯引擎，并公开冻结的语义桥，保留既有 `window.gamePage.save` 兼容性。当前本地 CLI／MCP 隔离会话仍不与页面配对；下一 bundle 的浏览器工具候选使用独立的玩家配对／DO 中继，未完成生产验收前不能把这段页面实现描述为生产远程接管。
- 人生重开模拟器当前只支持 Custom 模式，动作固定为从本轮候选中 `choose_talents`、按精确点数 `allocate_properties`、每次 `advance` 一年、终局 `restart_life` 和确认重置。状态 schema v2 固定源 commit、中文数据 SHA-256、日历年份、版本化 PRNG 和每轮起点 checkpoint；恢复时从 checkpoint 重放所选天赋、属性分配与逐年动作，再与整个状态深比较。单独或互不一致地篡改年龄、历史描述、已见事件、激活天赋、随机状态或 revision 会被拒绝；该重放不是对可以同时重写整个本地状态和程序的攻击者提供密码学认证。它也不接受选择器、脚本、URL、路径、原始存档或任意状态补丁。
- 人生重开模拟器读取项目内 `zh-cn` 的 age／talents／events 数据并逐文件校验固定 SHA-256。当前 `en-us` 文件与中文文件字节相同，因此隔离 Agent 目录只声明 `contentLanguages: ["zh"]`，不冒充完整英文剧情。隔离会话不导入浏览器 localStorage／云存档；浏览器页面的语义 bridge 属于独立的下一 bundle 候选，不会让这套本机会话自动获得配对能力。

Hextris 使用相同的语义动作原则，但保持独立 GPL 进程边界：

- `games/hextris/agent/engine.mjs` 只接受 `place` 加 0–5 号 lane，使用可复现种子产生 incoming block，并返回有界状态；不接受选择器、脚本、任意按键或浏览器控制命令。
- 专用 CLI／MCP 的会话独立于浏览器游戏和主站 2048 会话，继续执行 revision CAS、`clientActionId` 最近 128 条幂等收据、数量／状态大小／24 小时闲置上限、token marker 非空目录锁与原子替换。锁对存活 PID／进程实例失败关闭，只恢复精确陈旧 owner；释放使用同 token retiring marker，所有持久化和删除在提交前执行 owner fence，旧 owner 不能误删 successor。observe／actions 不写文件、不续期；reset／close 必须显式确认。
- Hextris 的 GPL 专用进程仍只服务本地隔离会话，机器目录继续用 `agent.surface: "dedicated-process"` 与 2048 的 `"integrated"` 区分。浏览器页面另有不静态导入专用引擎的语义 bridge 候选，但它的远程配对／观看／动作必须经过新 Worker、DO 与真实浏览器验收，不能把 GPL 进程的既有本地测试当作证据。
- Hextris 浏览器副本和专用 Agent 程序均保留 GPL-3.0-or-later 全文、上游归属和本地修改说明。未经单独许可证评估与站点所有者明确决定，不得把这个实现静态导入主站通用 CLI／MCP 或共享能力库。

## 8. 公开目录与日语题库的安全投影

第三阶段的目录工具读取的是公开内容，但仍不把面向浏览器的原始 manifest 直接交给 AI：

- 工具目录只返回带稳定 `toolId` 的在线画板、Quick Transfer 和日语工具。示例占位卡、未完成资源和任意外链不进入机器能力面。
- 游戏目录只返回稳定 ID、三语标题／摘要、语言支持、固定同源启动路径、许可证／仓库和真实 Agent 支持状态；不返回 `sourceEntry`、存储键／默认值、内部语言映射或任意启动查询。本地会话面仍将 2048／人生重开标记为 integrated、Hextris 标记为 dedicated-process；浏览器候选面则只按审计结果为 2048、Hextris、A Dark Room、人生重开标记语义 bridge，并让 Kittens 明确返回许可证阻断。目录中的 bridge 标记不代表远程配对已经出现在 `availableTransports`。
- 日语能力只访问固定 catalog、五个 level index 和由合法 `L1-001` 至 `L5-050` ID 推导出的固定 batch。适配器限制 JSON 字节、条目和搜索结果，验证 schema、`contentVersion: 1.0.2`、250 关计数、唯一 ID、64 位 SHA-256、`textLocked: true` 与关卡哈希；输出省略 batch 路径、内部音频文本和构建字段。
- 所有公开目录参数只接受 zh／en／ja、白名单 ID、1–5 等级和有界 limit／query。URL 必须是固定站内路径或安全 GitHub HTTPS 地址，调用方不能借参数读取任意文件或 URL。

这些目录本身仍是只读发现面；账号日语进度由下节独立 scope 和专用 API 承担，不把浏览器原始存档混入目录响应。工具目录来自本地模块，因此只在 CLI／本地 MCP 可用；游戏和日语数据虽由正式站点提供，当前生产远程 MCP 的九个工具也没有接入这些目录。这保留了第三阶段“没有远程接线”的历史范围，同时以本节当前工具清单为准。

## 9. 日语账号进度与受控答题

日语进度能力只服务本地 CLI／stdio MCP 使用的站点 Agent Bearer，不属于独立远程 MCP Worker：

- `GET /api/tools/japanese-subtext/agent-progress` 需要 read scope，只返回 revision、当前与已解锁关卡、通关／奖牌／尝试汇总、可选单关进度和默认 30 天、最多 90 天的近期活动。它不返回邮箱、userId、D1 行、完整 5,000 行活动并集，也不会因为读取而创建 profile、增加 revision 或刷新活动。
- `POST /api/tools/japanese-subtext/attempts` 需要 write scope，只接受 `stageId`、`stageRevision`、`contentHash`、完整的逐题 `answers`、`expectedRevision` 和 `operationId`。额外字段、未解锁关、旧题库、漏题、重题、未知选项与过大正文都会失败关闭。
- 服务端从固定同源题库重新加载锁定关卡并权威判分。调用方不能提交 score、medal、cleared、attempts、unlockedStageIds、时间戳或 userId；Agent 辅助答题固定按 bilingual 记录，最高只能得到 bronze，不能冒充纯听金牌。
- revision CAS 防止覆盖并发浏览器／Agent 进度；operationId 与 canonical payload SHA-256 形成幂等收据。相同载荷在 180 天收据保留窗口内重试会返回原结果且不重复计次，不同载荷复用同一 ID 返回 409；客户端必须永久生成新的 operationId，不得在收据过期清理后复用旧 ID。
- Agent 活动日固定按站点 `Asia/Shanghai` 日界线计算，GET 投影的 `activity.timeZone` 会明确返回这一口径；浏览器应用仍按设备本地日记录其原生会话，两者的计分、奖牌、解锁与合并规则相同。
- 浏览器现有 Cookie `GET/PUT /api/tools/japanese-subtext/progress` 继续负责原应用的完整快照合并，没有改成 Agent 接口。此次未修改公开应用、题库和存档兼容边界，所以 appVersion 仍为 1.0.3、contentVersion 仍为 1.0.2。

## 10. 远程 Cloudflare MCP：生产 OAuth 入口与公开注册层

生产 Worker `lusu-site-admin-mcp` 已部署到 canonical resource `https://lusu575.com/mcp`；当前精确 version ID 为 `849d8328-87db-4ac8-819a-ce725fc06349`，内部版本 `0.3.1`，承接 100% 流量。生产 `OAUTH_KV` 已绑定，Production D1 migration 已完成；当前精确 bundle 的正式域名 protected-resource／authorization-server metadata、未鉴权 `401 WWW-Authenticate` challenge 和非 allowlist pathname `404` 线上 smoke 已通过。这些基础检查不等于 DCR、浏览器 OAuth 或任一业务生命周期已经对新 bundle 完成验收。

历史 Worker `fa295db6-302a-4a20-a2b1-ffe1ddafd75b` 曾由站长在普通顶层浏览器完成 OAuth Allow，并通过九工具知识库完整生命周期；`377d494b-8f90-40ad-998f-863d209e1978` 曾通过外链视频规范化、原子发布、同载荷重放、管理回读、元数据刷新、CAS、确认删除、公开缺失与 grant 撤销。两组证据都只绑定各自精确 bundle，不能跨版本复用。当前 `849d...` 内部仍注册 23 项工具（9 项文章、8 项外链视频、6 项浏览器游戏），但尚未完成适用的文章／视频／游戏生产生命周期；以后每个新的生产 Worker bundle 都必须重新完成真实浏览器 OAuth 和对应完整闭环，不得用任一历史验收替代当前版本证据。

九项文章工具构成已验证的基础工具集：

| 工具 | scope | 当前边界 |
| --- | --- | --- |
| `site_capabilities` | `content:read` | 有界列出当前远程公开能力。 |
| `content_list` | `content:read` | 按语言／分类列出已发布文章摘要。 |
| `content_search` | `content:read` | 有界搜索已发布文章摘要。 |
| `article_get` | `content:read` | 按公开 slug 读取一篇已发布文章。 |
| `article_manage_list` | `content:write` | 读取草稿／已发布／归档的管理列表。 |
| `article_manage_get` | `content:write` | 读取一篇管理文章及全部现有翻译。 |
| `article_publish` | `content:write` | 以唯一 `operationId` 原子发布完整 zh／en／ja 普通知识库文章。 |
| `article_update` | `content:write` | 以 `expectedUpdatedAt` 和新 `operationId` 做 CAS 更新。 |
| `article_delete` | `content:delete` | 永久删除；还必须有最新 CAS、新 `operationId` 和字面值 `confirm: true`。 |

### 当前生产候选 bundle（尚未晋级远程可用面）

当前生产 `849d...` 在同一 OAuth Worker 中承载以下游戏工具，并已包含 paused-observe 下行 `pong`。Production D1／Durable Object 和 OAuth 基础链路曾用于候选点检，但四款真实浏览器的配对／动作／暂停／后台等待／玩家恢复／关闭完整验收尚未绑定当前 bundle 完成；它们要求独立非默认 `games:play`、active grant 与当前管理员复核，registry 的 `games.browser.*.availableTransports` 仍为空。新逻辑已部署不等于生产验收通过。

| 候选工具 | 作用 | 关键边界 |
| --- | --- | --- |
| `game_browser_pair` | 使用玩家页面生成的一次性码配对。 | 码绑定站长、OAuth client 和短时会话；不能代替玩家同意。 |
| `game_browser_observe` | 请求当前有界语义快照。 | 不读取 DOM、不截图，返回 current revision。 |
| `game_browser_actions` | 读取当前可用的不透明动作 ID。 | 只返回 bridge 在同 revision 提供的 `actionId`。 |
| `game_browser_act` | 执行一个语义动作。 | 要求 expected revision；拒绝 selector、script、key、coordinate 与 URL。 |
| `game_browser_pause` | 立即暂停 AI 控制。 | 只有浏览器中的玩家可以恢复或重新配对。 |
| `game_browser_close` | 永久关闭本次配对。 | 释放锁；后续必须生成新配对码。 |

候选 bridge 只覆盖 2048、Hextris、A Dark Room 与人生重开。Kittens Game 因 WET PAWS LICENSE 保持 `NO_AGENT`，未经明确许可／法律确认不得加入语义 bridge 或控制面。

当前 `849d...` bundle 还承载候选公开视频读 `videos_list`／`video_get`，以及六项站长工具：`video_manage_list`、`video_manage_get`、`video_publish`、`video_update`、`video_refresh_metadata`、`video_delete`。这八项的外链记录生产生命周期只在历史 `377d...` 精确 bundle 通过，当前版本必须重验；`content.videos.list/get` 继续不把 remote MCP 放进 `availableTransports`，因此生产 `site_capabilities` 仍只列出四项文章能力。第一阶段只处理 YouTube、Bilibili 与 b23.tv 外链记录；`video_publish` 把记录与审计／幂等收据原子提交，更新和删除要求 `expectedUpdatedAt`，删除另需 `confirm: true`，所有写操作都要求唯一 `operationId`、active grant 和当前管理员复核。

0.4.0 候选不改动上述工具清单、授权或直接发布语义，只把 `video_publish` 的 `title`、`description`、`thumbnailUrl`、`authorName` 与 `publishedAt` 变为可选覆盖项。只有 `operationId` 与 `originalUrl` 必填；省略字段会从固定平台 provider 有界取得，显式字段优先。收据查询和同意图哈希校验发生在 provider 网络访问之前，因此完全相同的重试直接回放原结果；若标题既未提供也无法补全，则以 `VIDEO_METADATA_TITLE_UNAVAILABLE` 失败，并保持视频、分类、收据和审计零写入。显式标题存在时，其他元数据获取失败可使用安全默认值并记录受限错误。该候选的精确生产 Worker version 与真实 OAuth 最小载荷闭环仍须部署后回填，不能复用历史 `377d...` 的验收。

视频候选不接受文件内容。远程 MCP 不读取本机路径、Base64、原始字节或客户端机器上的文件；真实托管上传尚未配置。`video_upload_sessions` 只是为未来独立数据面预留的 schema，不表示上传 API 或 R2 已可用。后续如启用，必须建立私有 R2 二进制数据面，并独立完成分片、配额、内容哈希、扫描、提交、中止、过期与孤儿清理验收。

`content:write` 和 `content:delete` 都是站长专用非默认 scope；管理列表／详情虽然是只读工具，也因包含非公开管理数据而要求 write scope。客户端必须保留 publish／update／delete 的逐次人类审批，尤其不得把 `article_delete` 设为“始终允许”。服务端 scope、管理员实时复核、CAS、幂等和 `confirm: true` 是强制边界，但不能替代调用前对目标和参数的人工确认。

公开工具实现位于 `workers/site-mcp/`。该目录保留四个公开读取工具的复用注册层和独立无 OAuth 目标，不是 canonical 生产入口；生产 `workers/site-admin-mcp/` 创建自己的 MCP SDK server，在 OAuth 后注册这四个公开工具，再加入五个站长工具。本地 `article_publish_files` 需要 allow-root 与真实文件边界，永远不进入远程面。独立资源模板 `lusu://articles/{slug}{?lang}` 也不注册到当前生产 owner server。

远程设计与身份边界：

- `/mcp` 提供无状态 Streamable HTTP MCP，每个请求创建新的 `McpServer`；生产端点不提供旧式 `/sse`。
- 四个公开工具通过 `DB` binding 直接读取共享 D1 的已发布文章，不经过公开网站 HTTP。Daily AI News 用 `content_list(category: "daily-ai-news")` 找到文章，再调用 `article_get`，不是单独的发布或自动化工具。
- OAuth 2.1 authorization code + 强制 PKCE S256；authorization 与 token 都必须带唯一、精确的 RFC 8707 resource `https://lusu575.com/mcp`。
- 浏览器只使用现有 HttpOnly `lusu_session` 确认站长身份，Cookie 不交给 MCP 客户端；远程入口拒绝站点设备 Bearer。Provider token 解包后仍独立复核到期、audience、client、scope、D1 active grant 与当前管理员角色。
- 动态注册兼容 DCR 和 CIMD；回调最多四个，默认只收 HTTPS，HTTP 仅允许 loopback 并在三语同意页警告。注册按 HMAC-IP 使用 D1 原子 UPSERT 限流；未验证的 `software_statement` 拒绝。
- 短期 authorization state、PKCE 与 consent flow 放在独立 KV；grant 与审计放在 D1。Worker 禁用 workers.dev 和持久 observability，路由先用 query-safe wildcard 命中，再由代码中的精确 pathname allowlist 收窄。
- 缺 scope 时以标准 `mcp/www_authenticate` 发起增量授权；账号降级、grant 撤销或 provider token 失效会让下一次管理调用返回标准挑战。

生产 owner Worker 使用 `compatibility_date: 2026-08-07`。复用注册层的独立目标仍固定 `2026-08-06` 与 `nodejs_compat`；其本地 dev／Vitest workerd override 只是本地兼容措施，不是生产入口版本。外部 AI 的 Codex、Claude、Cursor、ChatGPT 与自建 Agent 连接步骤见 `REMOTE_MCP_CONNECT.md`。

本地验证：

```powershell
Set-Location .\workers\site-mcp
npm.cmd install
npm.cmd run typecheck
npm.cmd test
npm.cmd run dev

Set-Location ..\site-admin-mcp
npm.cmd install
npm.cmd run check
```

普通本地开发不要加 `--remote`，不要连接生产 D1，也不要执行 `wrangler deploy`。后续生产迁移、Secret 轮换或 Worker 发布仍须站点所有者明确批准；任何路径都不能把网站 `lusu_session` cookie 或设备令牌转交给 MCP。

## 11. 仍是 inventory / planned 的能力

- 白板读取、图片上传／下载、高层追加和本地导出、主能力层的隔离 2048／人生重开模拟器会话，以及专用 GPL 进程中的隔离 Hextris 会话已经在本地 CLI／stdio MCP 可用；它们不表示公网远程 MCP 写入、白板任意编辑／删除，或浏览器游戏接管已经完成。
- 五个游戏的安全目录已经可读，其中 2048 与人生重开模拟器是集成式本地会话适配器、Hextris 是独立进程适配器。生产候选已为 2048、Hextris、A Dark Room 与人生重开补齐语义 bridge；Pages ping／pong 与当前 `849d...` paused-observe 下行保活均已部署，但 `game_browser_pair`／`observe`／`actions`／`act`／`pause`／`close` 仍须以该精确 Worker 与已上线 Pages commit 完成 `games:play` OAuth、Durable Object 和四游戏真实浏览器验收后才能进入 `availableTransports`。Kittens Game 的 WET PAWS 条款继续阻止接入，必须先取得明确许可／法律确认；游戏云存档通用写入也仍需单独适配与授权。
- 外链视频管理只在精确历史 bundle `377d...` 完成生产生命周期，当前 `849d...` 必须重验；0.4.0 的最小 `video_publish` 载荷仍是待部署候选，registry 远程面尚未晋级。真视频文件上传没有配置；schema 预留、文件名、R2 设计或未来工具 ID 都不能被解释为当前可以上传本机文件。
- 日语等级／关卡公开内容和账号进度闭环已经可用；聊天写入、任意完整进度快照写入、游戏存档写入等条目仍只是既有 API 的 inventory 或受限入口，没有通用 CLI/MCP 写适配器。
- Daily AI News、Tool Radar 的生产发布能力是 `restricted`，不会出现在公开远程 MCP 或通用本地 MCP 中。

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

Set-Location ..\site-admin-mcp
npm.cmd run check
```

还应验证以下安全契约：

- 注册表筛选只把 `availableTransports` 中确实存在的适配器显示为可用。
- CLI 拒绝 argv 中的房间口令，MCP schema 拒绝 `password` 字段，只接受环境 `secretRef`。
- 缺 scope 的令牌得到拒绝；Agent Bearer 不能访问管理员端点。
- 知识库 publish 的文章、三语正文、审计与 receipt 必须同批成功或同批回滚；非管理员、缺 scope、受治理分类、过大／额外字段、异载荷 operationId 重放、陈旧 CAS 与未确认删除都必须失败关闭。本地 Markdown 发布还要验证 allow-root、符号链接、UTF-8、扩展名与大小，且不外泄路径。
- 日语进度 GET 不改变 revision／活动；答题拒绝未解锁关、旧题库／进度、额外派生字段、漏题／重题／未知选项，并覆盖同 operationId 同载荷重放与异载荷冲突。除已声明的日界线口径外，计分、奖牌、活动合并和解锁语义必须与浏览器 `recordAttempt()` 一致。
- 白板 Agent Bearer 与房间访问令牌保持分离；追加验证只在独立 assets scope、可信内部 header 和当前房已提交元数据同时满足时接受规范图片，并继续拒绝既有修改／删除、孤立资源与未知根。scene／asset operation ID 的重试与冲突均有覆盖。
- 2048、人生重开模拟器与 Hextris 的 CAS、action ID 重放、状态篡改、会话上限、TTL，以及重置／关闭确认均有覆盖；共享存储还必须验证压缩收据精确重放、旧格式兼容、哈希／长度／Base64 篡改和有界解压。人生重开必须验证固定数据哈希、同 seed 重放、v2 checkpoint 全状态重放、伪造年龄／历史／事件集合／激活天赋失败关闭、阶段／天赋冲突／精确属性点／逐年推进／终局继承与中文内容边界；Hextris 还必须验证确定性种子、lane 边界和独立进程未导入主能力层。三者的测试都不声称连接已打开的浏览器。
- 浏览器候选必须逐款验证 bridge 只接受 current-revision opaque `actionId`，拒绝 selector／script／raw key／coordinate／URL，且一次只保留一个 pending command；还要覆盖一次性配对码、错误 client／owner、过期、CAS 冲突、玩家 pause／take-back／close、断线解锁和 Kittens `NO_AGENT`。Worker 单元测试或静态页面测试都不能代替生产 OAuth + DO + 真实浏览器闭环。
- 视频候选必须验证 YouTube／Bilibili／b23.tv 白名单、原子记录＋审计＋收据、同 `operationId` 同载荷重放、异载荷冲突、`expectedUpdatedAt` CAS、`confirm: true` 删除和管理员降级撤销；所有远程 schema 都必须拒绝 local path、Base64 与 raw bytes。预留 `video_upload_sessions` 不能让测试把真文件上传标记为可用。
- 公开工具／游戏／日语适配器拒绝 traversal、恶意 ID、任意 URL、超限 JSON、重复 ID、版本／计数／hash／`textLocked` 不匹配，并确认输出不含源文件路径、存储键、题库 batch 路径或内部音频文本。
- allow-root 的相对路径、绝对路径、`..`、链接逃逸及不存在父目录均有覆盖。
- 下载已有文件时失败且原文件字节不变；失败下载不留下半成品。
- 公开远程工具只能读取已发布文章，返回内容和结果大小有界；站长工具必须按精确 OAuth scope、active grant、当前管理员角色、operationId、CAS 与确认条件失败关闭。两者的错误输出都不能泄露 SQL、token、code、state、Cookie、原始 IP、回调或文章正文。

部署边界：

- 个人站的正常发布路径仍是合并到 GitHub `main` 后由 Cloudflare Pages 自动部署；不要把手工 Wrangler Pages 部署当成常规路径。
- `workers/site-mcp` 是第一阶段保留下来的独立公开注册层／无 OAuth 目标；canonical 生产地址由已经部署的 `workers/site-admin-mcp` 承载。当前 version `849d8328-87db-4ac8-819a-ce725fc06349`（内部 `0.3.1`）承接 100% 流量，其 metadata、401 与非 allowlist pathname 404 基础线上 smoke 已完成；视频生命周期证据只绑定历史 `377d494b-8f90-40ad-998f-863d209e1978`，四游戏生命周期也未对当前 bundle 完成。历史 `fa295db6-302a-4a20-a2b1-ffe1ddafd75b` 的九工具知识库验收同样不得跨 bundle 复用；已上线 Pages ping／pong 曾在 Chrome 后台长暂停验收断线，paused-observe 下行保活现已部署到 `849d...`，但尚未完成四游戏生产验收。当前 bundle 必须重跑适用的文章／视频／游戏闭环并取得精确 version 证据；随后 availability promotion 若再次生成 Worker bundle，还必须再次重验。Pages 仍由 GitHub `main` 自动部署，不能用站长 Worker 的 Wrangler 发布代替 Pages 发布。
- 本地 CLI 与 stdio MCP 本身不需要服务器部署；它们调用的 Agent Auth／Transfer／Whiteboard API 必须先存在于目标站点。白板 Pages Agent 路由依赖新的 Durable Object 协议，因此发布时必须先部署并验证兼容 Worker，再让 Pages 使用新路由。
- Hextris 专用 Agent 也只从源码仓库在本机启动；生产构建整目录排除 `games/hextris/agent/`，不会把其 Node 包、会话存储或 stdio 服务复制到 Pages `dist`。浏览器 Hextris 与 `games/hextris/source/COPYING` 继续作为静态站点内容发布。
- 任何验证命令都不得使用生产凭据、生产房间口令或 `--remote` D1。

回滚时优先撤回代码或恢复上一版 Pages/Worker 路由；不要为了紧急回滚直接删除 D1 表。若 Agent Auth 已经上线，应先通过令牌管理页撤销令牌，再停用新入口，并保留哈希令牌记录与审计记录用于排查。生产站长 OAuth Worker 回滚应先撤销 active grants／路由，再保留 D1 grant 与审计证据，不删除账本；任何历史 bundle 的成功验收都不能补写成当前或回滚后 bundle 的成功证据。
