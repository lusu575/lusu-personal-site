# 临时互传 CHANGELOG

本日志只记录临时互传子项目。根项目发布历史仍写入仓库根 `CHANGELOG.md`。

## 1.0.2 - 2026-08-06

- 新增站内设备码授权、最小权限 Agent Bearer、自助查看/撤销令牌和持久化限频；Agent 身份始终按普通用户处理，管理接口继续只接受 HttpOnly Cookie 管理员会话。
- 本地 CLI 与 stdio MCP 接入既有临时互传协议，可加入密码房、列出与收发文字/文件、下载和删除；口令只通过隐藏输入、stdin 或环境变量 `secretRef` 进入本地进程，授权服务不接收口令或派生 `roomKey`，本地状态不保存明文口令或文字密钥。
- scope 明确拆分为 `transfer:read`、`transfer:write` 与 `transfer:delete`：join 属于 write，Multipart abort 与条目删除属于 delete；畸形 Authorization、跨来源写入和 Bearer 访问后台均失败关闭。
- 把 Agent 授权、能力注册、站点客户端、互传加密、本地状态、CLI、stdio MCP 与对应定向测试加入精确受管路径。当前远程 MCP 仍仅提供公开只读内容能力，本次未部署生产环境。

## 1.0.1 - 2026-08-01

- 建立独立版本、项目清单、AGENT/AGENTS、更新日志和文档联动门禁。
- 在工具标题区和工具区卡片同步显示独立 `v1.0.1` 与本次更新日期；本次不改变口令派生、AES-GCM、R2、Multipart、配额、鉴权或 24 小时过期协议。

## 1.0.0 - 2026-07-16

- 初次提供登录限定临时房、浏览器端加密文字、私有 R2 文件、普通上传、管理员 Multipart、Range 下载和 24 小时清理。
