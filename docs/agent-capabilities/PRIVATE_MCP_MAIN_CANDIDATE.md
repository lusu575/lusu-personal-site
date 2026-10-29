# 主线兼容私人 MCP 0.5.0 本地候选

## 基线与边界

基于 main 9854301ea93fee3abdeb14dad3fec55fa2b27da0，隔离分支 codex/private-owner-mcp-release。旧工作区未搬移或覆盖。资源先按 Git blob 校验：相同内容使用同盘硬链接，不同/缺失内容从该基线物化；node_modules 使用 junction，不复制依赖。资源链接仅用于读取，禁止在候选中编辑硬链接资源。

保留主线 GAME_RELAY / GameRelaySession / v1 migration、/mcp/browser-games/connect、games:play、OAuth 撤销及主线视频服务。既有游戏 relay 的 pairing、CAS、receipt、断线、暂停、关闭及无 scope 拒绝测试继续执行。候选添加精确 MCP_OWNER_USER_ID 检查，其他管理员同样拒绝；没有生产身份或凭据值。

## 79 个工具

| 分组 | 数量 |
| --- | ---: |
| 主线公共内容读取（仍需本人鉴权） | 6 |
| 文章列表/详情/投稿/编辑/删除，支持草稿、发布、归档下架 | 5 |
| 主线浏览器游戏配对/观察/动作/暂停/关闭 | 6 |
| 主线视频管理及后台视频/分类 | 11 |
| 账号资料、会话与现有管理 | 4 |
| 公共大厅读发及聊天治理 | 9 |
| 画板管理及完整 PNG | 9 |
| 互传后台 | 13 |
| H3 Runner/任务 | 5 |
| 统计、流量、社交链接、自动化设置 | 7 |
| 新增猫国及本地浏览器队列 | 4 |

旧基线的 71 工具结果不代表本候选。本候选新增 51 个后台工具及 5 个浏览器工具，保留主线 23 个工具；video_delete/video_refresh_metadata 不重复注册，使用主线 CAS/幂等实现。视频沿用 content:write/content:delete，不添加旧候选 videos:write。

## 本候选验证

- 真实浏览器 5/5：猫国队列到真实页面操作与结果、画板图片像素到 MCP、Home/Tools 日期版本、画板三语四尺寸及 Escape。
- 补充文章种子与 OAuth ledger 7/7；保留历史种子断言并同步本次新 release marker 和五项首页投影。

- 151 项：文章、视频、私人 MCP 协议、CLI、画板图像契约、画板/互传服务及客户端、子项目治理。
- Worker 38 项：主线 OAuth/撤销/game relay/视频及新增本人身份拒绝。
- 画板 Worker 57 项通过；两个 Worker 的 TypeScript 通过。
- build-check 通过。生产构建连续两次一致，11742 文件、461.49 MiB，manifest SHA-256：069b94048244a622badd81e70c15aac8f52c54d16fef4af14e1ca0efc5782f56。
- npm.cmd run build 的包装环境若无法定位 node，直接执行同一 build-check.mjs、build-production.mjs；构建产物位于本候选 dist，而不是原工作区。
- 浏览器测试使用临时配置、全新猫国存档和内存数据库；生产 OAuth、R2/DO 真实写操作未执行。

## 使用与配置差异（仅提案，未启用）

唯一入口仍为 https://lusu575.com/mcp。必须先明确配置本人稳定 users.id 为 MCP_OWNER_USER_ID；缺少配置时拒绝，不以管理员角色或显示名替代。

| 配置 | 当前主线 | 后续候选需要 |
| --- | --- | --- |
| DB / OAUTH_KV | 已声明 | 复用，禁止重建 |
| GAME_RELAY / GameRelaySession / migration v1 | 已声明 | 原样保留，不删除/迁移 namespace |
| MCP_OWNER_USER_ID | 未声明 | 经本人已登录会话核对稳定 ID 后显式配置 |
| OAuth scopes | content:read, content:write, content:delete, games:play | 新增 admin:read、admin:write，由本人重新同意；旧 grant 不自动扩权 |
| TRANSFER_BUCKET | MCP Worker 未声明；Pages 使用 lusu-temp-transfer | 如启用互传后台，为 MCP Worker 增加对现有桶的绑定 |
| WHITEBOARD_ROOMS | MCP Worker 未声明；Pages 使用 WhiteboardRoom@lusu-whiteboard-do | 如启用治理，为 MCP Worker 增加现有 external DO 绑定 |
| 秘密 | 当前配置仅声明 ANALYTICS_IP_HASH_SALT | 安全渠道核对/配置 CHAT_IP_HASH_SALT，以及画板 TICKET_SECRET、INTERNAL_SECRET、IP_HASH_SALT；必须与现有服务匹配，不轮换共享值 |
| D1 | 现有主线 schema | cloudflare/private-mcp-browser-jobs.sql 只创建队列表/索引，不含 seed 或 UPDATE/DELETE；不运行整份初始化 SQL |

这些绑定/scopes 属于持久访问扩展，尚未获生产启用授权；wrangler.jsonc 保持主线原样。没有创建或配置凭据，也没有重新尝试此前未认证的 Cloudflare 管理查询或通过改日志路径绕过该查询的 EPERM。

Pages 后续只能通过审查合并 main 后 Git 集成发布；MCP Worker 单独发布。现有 whiteboard DO、transfer-cleanup 无需本次重部署。发布前记录实际当前部署版本并准备保留 owner-only 门的回滚版本；不能盲退到允许其他管理员的旧版。新增队列表可保留，避免破坏数据；代码回滚不自动撤销已经发生的业务写操作。

浏览器桥接：在明确选定的本机隔离浏览器中打开猫国 source 页面或已授权画板页面（private-mcp=1）。已有本人 OAuth access token 仅通过 LUSU_MCP_ACCESS_TOKEN 环境变量传入：

    node cli/private-browser-companion.mjs --cdp-url http://127.0.0.1:PORT --target-id ID --browser-id private-browser-0001

--once 处理一次，Ctrl+C 停止。AI 使用同一 browserId 提交 kittens_command/whiteboard_snapshot，再查询 browser_command_result。queued 不代表执行；execution-unknown 不得自动重放。建造/研究一次一项；采集/分工 count 为 1–10。任务 60 秒有效，最多 32 个在途；新提交清理过期一天以上的旧结果，没有独立清理定时器。PNG 最大 2 MiB、5000 元素，缺少图片素材失败。

## 2026-10-29 发布授权后补充检查

用户已批准本候选推送、Pages/MCP 发布、本人身份限制、admin scopes、现有 R2/DO 绑定及最小队列表迁移。未授权新登录、生产 OAuth grant 创建或秘密配置。正式 Cloudflare whoami 返回既有 auth token 过期且无法刷新，尚未启动登录。

完整主测试 854/854、公开 MCP 6/6、管理 MCP 38/38、ESLint、主站浏览器 223 项及小黑屋回归通过。新增 schema 末尾 release marker 与历史种子断言同步，未执行远程全库 schema。npm 包装器的子命令 PATH 故障，使用 package.json 对应脚本直接执行各门禁。
