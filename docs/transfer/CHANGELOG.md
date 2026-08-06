# 临时互传 CHANGELOG

本日志只记录临时互传子项目。根项目发布历史仍写入仓库根 `CHANGELOG.md`。

## 1.0.5 - 2026-08-06

- 修复共享 Agent Auth 的浏览器确认页：授权与令牌管理 HTML 不再使用会把表单 POST 变成 `Origin: null` 的 `no-referrer`，改为只发送来源站点、不携带路径或 `user_code` 查询的 `strict-origin`；JSON 响应继续使用 `no-referrer`。
- POST 仍严格要求当前授权页的精确 Origin、有效登录态和双提交 CSRF；缺失／`null`／当前页面异源／攻击者 Origin 继续拒绝。授权页允许从 CLI、Codex 或外部链接打开的顶层文档导航，同时继续拒绝 iframe 与非文档子资源。
- 本次修改命中 Quick Transfer 的共享受管授权入口，因此从 1.0.4 精确升至 1.0.5；互传房间、口令派生、AES-GCM 文字、私有 R2 文件、配额、Multipart、鉴权与发布完成后 24 小时过期语义均未改变。

## 1.0.4 - 2026-08-06

- 共享 `Agent Auth`、能力注册表、`SiteClient`、本地 CLI 与 stdio MCP 增加日语账号进度读取和受控答题提交；读取与写入使用两个独立、非默认 scope，服务端负责判分、奖牌、尝试次数与解锁，调用方不能伪造派生结果。
- 设备码授权轮询遇到短暂网络、超时或明确瞬态 HTTP 故障时会在设备码有效期内有界退避重试，不再因一次网络抖动立即退出；令牌、口令和底层网络细节仍不输出。
- 本次修改命中 Quick Transfer 的共享受管入口，因此按治理规则从 1.0.3 精确升至 1.0.4；互传房间、口令派生、AES-GCM 文字、私有 R2 文件、配额、Multipart、鉴权与发布完成后 24 小时过期语义均未改变。

## 1.0.3 - 2026-08-06

- 共享的能力注册表、`SiteClient`、本地 CLI 与 stdio MCP 增加公开视频详情、三项真实工具目录、五个游戏的安全目录投影，以及日语潜台词 5 个等级／250 关的只读发现能力。
- 新目录适配器只接受固定站内路径、稳定 ID、受限语言与有界 JSON；游戏输出不暴露存储键或源文件入口，日语输出校验内容版本、关卡哈希和 `textLocked`，工具目录不把占位卡片误报为可用工具。
- 本地存储 Agent credential 绑定设备登录时的 HTTP(S) origin；CLI／MCP 覆盖到 Preview 或其他 origin 时不会复用、发送或误删原 Bearer，只有显式 stdin／环境 token 才用于当前覆盖 origin。
- 本次命中 Quick Transfer 的共享受管能力入口，因此按治理规则精确升版；没有改变互传房间、口令、AES-GCM 文字、私有 R2 文件、配额、Multipart、鉴权或发布完成后 24 小时过期协议。
- Quick Transfer 的固定工具契约改为独立受管模块；共享工具目录按 `toolId` 锚点、有界窗口和精确版本模板校验，其他工具恰好相同的版本号不能掩盖本卡片漏改，也不会因无关工具契约变化误触升版。

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
