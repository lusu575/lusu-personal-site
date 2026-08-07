# 外部 AI 接入 LuSu 站点 MCP

本文说明外部 AI 客户端如何连接 LuSu 个人站的公网 MCP，以及授权时必须保留的安全边界。

## 连接地址

正式 canonical MCP resource 固定为：

```text
https://lusu575.com/mcp
```

它是无状态 Streamable HTTP 端点，不提供旧式 `/sse`，也不接受网站设备码令牌、`lusu_session` Cookie 或 URL 查询参数中的 Bearer token。客户端必须通过该 resource 发现并完成站点 OAuth 2.1 授权。

仓库实现或本地测试通过不等于该地址已经上线；只有 production Worker、OAuth KV、主域路由、D1 schema、真实客户端登录和线上工具点检全部通过后，才可把它标记为可用。

## 首次授权

1. 先在浏览器顶层页面登录 `https://lusu575.com`。
2. 在 AI 客户端添加上面的 MCP URL，并选择 OAuth／Authenticate。
3. 客户端会打开 LuSu 站点自己的授权页。核对客户端名称、client ID、回调主机、resource 和逐项 scope。
4. 只批准本次确实需要的权限。完成后回到 AI 客户端刷新工具列表。

授权页只读取主域现有的 HttpOnly 登录态；网站 Cookie 不会交给 AI。不要把浏览器 Cookie、授权码、access token、refresh token 或任何本地设备令牌复制给 AI、写进提示词或提交到仓库。

## Scope

| Scope | 用途 | 建议 |
| --- | --- | --- |
| `content:read` | 读取已公开文章、知识库和 Daily AI News | 首次连接的最小权限 |
| `content:write` | 管理文章、三语原子发布和 CAS 更新 | 仅站长账号，确需写入时再授权 |
| `content:delete` | 永久删除普通知识库文章 | 独立高风险权限；仍需 `confirm: true`、CAS 和 operationId |

`site-updates`、`daily-ai-news`、`tool-radar` 继续走各自受治理的发布通道，通用文章 MCP 无权创建、改写或删除这些分类。远程 MCP 也不提供 `article_publish_files`：云端 Worker 不能读取 AI 客户端机器上的本地路径；调用方应把三语 Markdown 正文作为受限结构化参数交给 `article_publish`。

## 常见客户端

### Codex CLI / Codex IDE

在 Codex MCP 配置中加入：

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

当前 Codex CLI 也可直接添加并固定同一 resource；若较旧安装没有 `--oauth-resource`，使用上面的 TOML：

```powershell
codex mcp add lusu --url https://lusu575.com/mcp --oauth-resource https://lusu575.com/mcp
```

### Claude Code

```powershell
claude mcp add --transport http lusu https://lusu575.com/mcp
claude mcp login lusu
```

也可以在 Claude Code 的 `/mcp` 面板选择 LuSu 并完成 OAuth 登录。Claude.ai／Cowork／Claude Desktop 的远程自定义连接器填写同一个 URL；Claude Desktop 应从 Settings → Connectors 添加，不把远程 URL 写进本地 `claude_desktop_config.json`。团队套餐可能只允许 Owner／Primary Owner 创建连接器，再由成员 Connect。

### Cursor

项目或用户级 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "lusu": {
      "url": "https://lusu575.com/mcp"
    }
  }
}
```

保存后由 Cursor 打开 OAuth 登录。服务端优先支持 Client ID Metadata Documents，同时保留 Dynamic Client Registration 作为旧客户端兼容入口。

### ChatGPT

ChatGPT Web 当前通过 Developer mode 添加开发中的远程 MCP：在 Settings → Security and login 中启用 Developer mode，再打开 `https://chatgpt.com/plugins`，点击 `+` 并填入 `https://lusu575.com/mcp`，随后完成 OAuth。日常调用从 ChatGPT Work 的 Plugins 中选择该连接；它不会读取 Codex 本机的 `config.toml`。当前 Full MCP（含 write／modify）beta 仅 Business、Enterprise、Edu 的 Web 版开放，Pro 的 Developer mode 只连接 read／fetch MCP；Business 由 admin／owner、Enterprise／Edu 由 RBAC 决定开发模式权限。移动端、Agent mode 和 Deep Research 也不能等同完整写工具支持。无论客户端产品面如何变化，服务端 scope、CAS、确认与管理员复核都不会放宽。

### 自建 Agent

自建客户端应按 MCP 2026-07-28 Authorization 完成 RFC 9728 discovery、OAuth authorization code + PKCE S256、RFC 8707 resource binding 和 refresh-token rotation，再通过 `Authorization: Bearer ...` 调用 `/mcp`。禁止 token passthrough，也不要把访问令牌放在 query string。

## 写操作调用纪律

- `article_publish`：每次新动作生成永久唯一的 `operationId`；完全相同的重试会读回原收据，异载荷复用同一 ID 会冲突。
- `article_update`：先调用 `article_manage_get` 取得最新 `updatedAt`，再把它作为 `expectedUpdatedAt`。
- `article_delete`：另需 `content:delete`、最新 `expectedUpdatedAt`、新 `operationId` 和 `confirm: true`。
- scope 不足时，客户端应重新走 OAuth 增量授权，不得要求用户粘贴 token。
- 账号被降为非管理员、grant 被撤销或 provider token 失效后，下一次管理调用立即拒绝。

## 官方协议参考

- [MCP Streamable HTTP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [Cloudflare Remote MCP transport](https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/)
- [Cloudflare MCP authorization](https://developers.cloudflare.com/agents/model-context-protocol/protocol/authorization/)
- [Codex Streamable HTTP MCP](https://learn.chatgpt.com/docs/extend/mcp#streamable-http-servers)
- [Codex MCP configuration schema](https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json)
- [Claude Code MCP](https://code.claude.com/docs/en/mcp)
- [Claude remote custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Cursor MCP](https://docs.cursor.com/context/model-context-protocol)
- [ChatGPT Developer mode connection](https://developers.openai.com/plugins/deploy/connect-chatgpt#enable-developer-mode)
- [ChatGPT Developer mode and Full MCP availability](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta)
