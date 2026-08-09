# 外部 AI 接入 LuSu 站点 MCP

本文说明外部 AI 客户端如何连接 LuSu 个人站的生产 MCP，以及授权和写操作必须保留的安全边界。

## 生产地址与当前验收状态

正式 canonical MCP resource 固定为：

```text
https://lusu575.com/mcp
```

截至 2026-08-09，生产 Worker `lusu-site-admin-mcp` 已部署；完成真实站长浏览器 OAuth 验收的 version ID 为 `fa295db6-302a-4a20-a2b1-ffe1ddafd75b`，Production D1 migration 已完成。正式域名的 OAuth protected-resource／authorization-server metadata、Dynamic Client Registration、未鉴权 `401 WWW-Authenticate` challenge、浏览器 Origin 拒绝和精确 pathname 拒绝均已完成线上 smoke。

该地址是无状态 Streamable HTTP 端点，不提供旧式 `/sse`，也不接受网站设备码令牌、`lusu_session` Cookie 或 URL 查询参数中的 Bearer token。客户端必须通过该 resource 发现并完成站点 OAuth 2.1 授权。

真实站长已在普通顶层浏览器 OAuth 页面核对并手动点击 Allow。该精确 bundle 的生产验收已通过 9 个工具、4 项公开 capability、受控测试文章原子发布、同载荷幂等重试、管理列表／详情读取、CAS 更新、zh／en／ja 公开回读、确认删除、三语删除后 404 与 grant 撤销；临时文章已删除。该结果只适用于上述精确 Worker bundle，每个新生产 bundle 都必须重新执行真实浏览器 OAuth 与同等闭环，不能用历史验收替代。全站所有能力的远程 MCP 和浏览器游戏配对／接管仍未实现。

## 生产 MCP 的 9 个工具

| 工具 | 所需 scope | 作用与安全属性 |
| --- | --- | --- |
| `site_capabilities` | `content:read` | 查看当前远程公开能力；只读、有界、幂等。 |
| `content_list` | `content:read` | 按语言／分类列出已发布文章摘要；Daily AI News 用 `category: "daily-ai-news"` 查询。 |
| `content_search` | `content:read` | 在已发布文章摘要中做有界搜索。 |
| `article_get` | `content:read` | 按公开 slug 读取一篇已发布文章的有界 Markdown。 |
| `article_manage_list` | `content:write` | 列出草稿、已发布或归档的管理视图；虽为只读调用，但会看到非公开管理数据。 |
| `article_manage_get` | `content:write` | 读取一篇管理文章及全部现有翻译；虽为只读调用，但属于站长管理面。 |
| `article_publish` | `content:write` | 原子发布完整 zh／en／ja 普通知识库文章；需唯一 `operationId`，受治理分类会被拒绝。 |
| `article_update` | `content:write` | 以最新 `expectedUpdatedAt` 做 CAS 更新，并以新 `operationId` 保证精确重试。 |
| `article_delete` | `content:delete` | 永久删除普通文章；必须同时提供最新 CAS、唯一 `operationId` 和字面值 `confirm: true`。 |

远程 MCP 不提供 `article_publish_files`：云端 Worker 不能读取 AI 客户端机器上的本地路径；调用方应把三语 Markdown 正文作为受限结构化参数交给 `article_publish`。`site-updates`、`daily-ai-news`、`tool-radar` 继续走各自受治理的发布通道，通用文章 MCP 无权创建、改写或删除这些分类。

## 首次授权

1. 先在普通浏览器顶层页面登录 `https://lusu575.com`。
2. 在 AI 客户端添加上面的 MCP URL，并选择 OAuth／Authenticate。
3. 客户端会打开 LuSu 站点自己的授权页。核对客户端名称、client ID、回调主机、resource 和逐项 scope。
4. 只批准本次确实需要的权限，站长本人在正常浏览器页面手动点击 Allow；完成后回到 AI 客户端刷新工具列表。

授权页只读取主域现有的 HttpOnly 登录态；网站 Cookie 不会交给 AI。不要把浏览器 Cookie、授权码、access token、refresh token 或任何本地设备令牌复制给 AI、写进提示词或提交到仓库。

## Scope 与确认规则

| Scope | 用途 | 建议 |
| --- | --- | --- |
| `content:read` | 读取已公开文章、知识库和 Daily AI News | 首次连接的最小权限。 |
| `content:write` | 查看管理文章、三语原子发布和 CAS 更新 | 仅站长账号；确需写入时再授权。 |
| `content:delete` | 永久删除普通知识库文章 | 独立高风险权限；仅在明确删除任务中临时授权。 |

服务端 scope、管理员实时复核、CAS、幂等和 `confirm: true` 是强制边界，但不能替代客户端的人类确认。连接后应保留客户端的工具审批：

- `article_publish` 调用前逐项检查 slug、分类、三语标题／正文、公开时间和 `operationId`。
- `article_update` 调用前先用 `article_manage_get` 取得最新 `updatedAt`，展示差异并让站长确认。
- `article_delete` 不得设为“始终允许”；每次都要展示文章 ID／slug、最新 revision 和永久删除后果，再由站长明确批准。
- scope 不足时重新走 OAuth 增量授权，不得要求用户粘贴 token。

## 常见客户端

### Codex CLI / IDE / Codex app

Codex CLI、IDE 扩展和 Codex app 使用同一套 `config.toml` MCP 配置。在 Codex MCP 配置中加入：

```toml
[mcp_servers.lusu]
url = "https://lusu575.com/mcp"
auth = "oauth"
oauth_resource = "https://lusu575.com/mcp"
```

随后执行登录并按浏览器提示批准：

```powershell
codex mcp login lusu
```

当前 Codex CLI 也可直接添加并固定同一 resource：

```powershell
codex mcp add lusu --url https://lusu575.com/mcp --oauth-resource https://lusu575.com/mcp
codex mcp login lusu
```

若安装版本不识别 `--oauth-resource`，使用上面的 TOML 配置并升级 Codex；不要删除精确 resource 后改成粘贴 Bearer token。

### Claude Code

下面命令把服务器加入当前项目的默认 local scope：

```powershell
claude mcp add --transport http lusu https://lusu575.com/mcp
claude mcp login lusu
```

也可以在 Claude Code 的 `/mcp` 面板选择 LuSu 并完成 OAuth。若希望该连接跨项目私有可用，把 `--scope user` 放在服务器名之前：

```powershell
claude mcp add --transport http --scope user lusu https://lusu575.com/mcp
```

### Claude.ai / Cowork / Claude Desktop

远程自定义连接器当前可用于 Claude、Cowork 和 Claude Desktop 的 Free、Pro、Max、Team、Enterprise；Free 当前最多一个自定义连接器。个人套餐从 Customize／Settings → Connectors 添加同一个 URL。Team／Enterprise 需要 Owner 或 Primary Owner 先在 Organization settings → Connectors 添加，成员再分别 Connect。

Claude Desktop 的远程连接器通过 Claude 账号从云端连接，不把该 URL 写进本地 `claude_desktop_config.json`；本地 config 文件属于另一套本机 stdio MCP 机制。

### Cursor

项目级 `.cursor/mcp.json`，或用户级 `~/.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "lusu": {
      "url": "https://lusu575.com/mcp"
    }
  }
}
```

保存后由 Cursor 打开 OAuth 登录；Cursor Agent CLI 也可以运行：

```powershell
agent mcp login lusu
```

Cursor 官方文档确认 Streamable HTTP、OAuth 和 Dynamic Client Registration；生产服务保留 DCR 兼容入口。服务端同时支持 Client ID Metadata Documents，但不要把它误写成 Cursor 当前文档已经要求或确认使用 CIMD。Cursor 默认会在 MCP 工具运行前请求批准，写入和删除工具应继续逐次审批。

### ChatGPT

ChatGPT 的菜单会随 beta 调整。当前应在账号／工作区允许 Developer mode 后，从 Settings 或 Workspace Settings 的 Apps → Create（有些账号仍显示 Plugins 入口）创建远程 app，填入 `https://lusu575.com/mcp`，选择 OAuth，执行 Scan Tools 并完成授权。ChatGPT 不会读取 Codex 本机的 `config.toml`。

当前范围限制：

- Full MCP（含 write／modify）beta 仅面向 ChatGPT Business、Enterprise、Edu 的 Web 版。
- Business 只有 admin／owner 可启用 Developer mode 和创建／发布 app；Enterprise／Edu 可由管理员通过 RBAC 授权开发者和使用者。
- Pro 的 Developer mode 只能连接 read／fetch MCP，不能使用本站五个管理工具完成写入或删除。
- 移动端不提供该完整自定义 MCP 面；Agent mode 不使用 custom apps；Deep Research 只使用 read／fetch，不执行 write。
- ChatGPT 可能根据 app 权限、调用上下文和风险要求再次确认写操作；无论客户端是否弹窗，本站 scope、CAS、`operationId`、`confirm: true` 和管理员复核都不会放宽。

### 自建 Agent

自建客户端应按 MCP 2026-07-28 Authorization 完成 RFC 9728 discovery、OAuth authorization code + PKCE S256、RFC 8707 resource binding 和 refresh-token rotation，再通过 `Authorization: Bearer ...` 调用 `/mcp`。禁止 token passthrough，也不要把访问令牌放在 query string。

## 写操作调用纪律

- `article_publish`：每次新动作生成永久唯一的 `operationId`；完全相同的重试会读回原收据，异载荷复用同一 ID 会冲突。
- `article_update`：先调用 `article_manage_get` 取得最新 `updatedAt`，再把它作为 `expectedUpdatedAt`。
- `article_delete`：另需 `content:delete`、最新 `expectedUpdatedAt`、新 `operationId` 和 `confirm: true`。
- 账号被降为非管理员、grant 被撤销或 provider token 失效后，下一次管理调用立即拒绝。
- 每个 AI 客户端首次连接仍须站长本人在正常 OAuth 页面核对并手动 Allow；每个新生产 Worker bundle 也必须重新完成原子发布、同载荷重放、管理回读、CAS 更新、三语公开回读、确认删除／404 与撤销闭环，不得把历史 bundle 的验收写成当前版本成功。

## 官方参考

- [MCP Streamable HTTP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [Cloudflare Remote MCP transport](https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/)
- [Cloudflare MCP authorization](https://developers.cloudflare.com/agents/model-context-protocol/protocol/authorization/)
- [Codex Streamable HTTP MCP](https://learn.chatgpt.com/docs/extend/mcp#streamable-http-servers)
- [Codex MCP configuration schema](https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json)
- [Claude Code MCP](https://code.claude.com/docs/en/mcp)
- [Claude remote custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Cursor MCP](https://cursor.com/docs/mcp)
- [Cursor Agent MCP commands](https://cursor.com/docs/cli/reference/parameters#mcp)
- [ChatGPT Developer mode connection](https://developers.openai.com/plugins/deploy/connect-chatgpt#enable-developer-mode)
- [ChatGPT Developer mode and Full MCP availability](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta)
