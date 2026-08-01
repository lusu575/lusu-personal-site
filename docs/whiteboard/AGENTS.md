# 在线画板子项目维护规则

本目录是“在线画板”子项目的治理根，当前版本见 `VERSION` 与 `project.json`。个人站根项目仍负责统一发布，画板拥有独立版本和更新日志。

## 开始前必读

1. 仓库根 `AGENTS.md`
2. 仓库根 `PROJECT_CONTEXT.md`
3. 仓库根 `skills/lusu-personal-site-skill/SKILL.md`
4. 本目录 `README.md`
5. 本目录 `CHANGELOG.md` 最新版本
6. `workers/whiteboard/README.md`

## 版本与文档硬规则

- 任何画板代码、样式、图片、协议、Worker、测试、配置或文档变化，都必须把独立版本精确增加 `0.0.1`；不跳号，不只改根项目版本。
- 同一次改动必须同步：`VERSION`、`project.json.version`、本目录 `CHANGELOG.md`、本目录 `README.md` 的当前版本、公开界面版本号，以及受影响的协议/运维说明。
- 同时更新根 `CHANGELOG.md`。项目事实、行为或运维流程变化时更新根 `PROJECT_CONTEXT.md`；形成长期规则时同步根专用 Skill 及其 README。
- 公开可见变化继续遵守根项目三语 `site-updates`、四处 seed/fallback 与缓存 query 规则。子项目日志不能替代根项目发布记录。
- `AGENT.md` 只指向本文件，不维护重复规则。长期规则变化时更新本文件，并核对根 `AGENTS.md` 的子项目索引。

## 稳定性与数据规则

- Excalidraw 变更通过 Yjs 对象级 CRDT 发送。连续绘制必须合并为有界更新，并等待 Worker 持久化 ACK；未确认批次在断线后重新入队，不能因限速或网络切换静默丢线条。
- Worker 必须先持久化 Yjs 更新和房间元数据，再向来源连接发送 `update-accepted`。Yjs 重发保持幂等；不得先 ACK 后落盘。
- `rate_limited`、同步预算和普通连接波动是可恢复状态；访问拒绝、无效票据和协议破坏才可停止自动重连。短暂波动不得弹大横幅或通用错误，持续超过有界延迟后只显示不遮挡画布的小状态；真正不可恢复或需用户处理的错误仍保留具体类别。
- 没有 Yjs 变化就不得产生文档写入。可见连接使用不会唤醒休眠 DO 的静态 WebSocket auto-response；标签页长期隐藏时先排空未确认更新再停放连接。空公共房不得周期轮询，空密码房只保留真实待办和 24 小时删除 Alarm；D1 房间摘要必须低频于 DO 权威写入。
- 公共房 `public-v1` 的画布与资源不按空房 TTL 删除，除非管理员明确清空。密码房从最后一条有效连接离开起 24 小时无人重入时整房幂等删除；重入必须取消旧删除计划。
- 密码、票据、Cookie、完整匿名 ID、IP、画布正文和图片内容不得进入日志、埋点、截图元数据或 Git。

## 视觉规则

- 公共画板与所有密码房必须使用同一套暖纸底、石墨灰、hachure 与高 roughness 铅笔草图默认值；当前不得按房型切换主题或只给公共房启用，同时保留 Excalidraw 工具能力和本站 XP/Pixel/Y2K 外壳。
- 视觉调整不得修改已有元素的数据语义，不得用全屏遮罩、持续滤镜或低对比度换取风格。
- zh/en/ja、桌面、359×500、375×667、390×844、844×390 都要检查工具栏、告警、成员面板、导出与退出保存状态。

## 验证与发布

- 至少运行 `npm.cmd run lint`、`npm.cmd run typecheck`、`npm.cmd run whiteboard:test`、`npm.cmd run build`、`npm.cmd run build:production:verify` 与 `git diff --check`。
- Worker 协议变化必须先部署并验证 `lusu-whiteboard-do`，再确认 Pages external binding，最后通过 GitHub PR/CI 合并 `main`。Cloudflare 未认证或任何检查失败时不得宣称上线。
- 不删除或重写 Durable Object namespace、`WhiteboardRoom` 类或 `v1` migration。
