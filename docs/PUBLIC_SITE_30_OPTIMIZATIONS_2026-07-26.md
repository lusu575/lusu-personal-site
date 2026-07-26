# 公开主站 30 项功能与界面优化完成清单

日期：2026-07-26
状态：30 / 30 已实现并通过本地发布门禁。

| # | 实际改动 | 主要落点 |
|---:|---|---|
| 1 | 云存档 PUT 使用 `expectedUpdatedAt` 做原子 CAS，陈旧写入返回 `409 SAVE_CONFLICT`。 | `functions/api/[[route]].js` |
| 2 | 云存档冲突改为三语 XP 决策窗口，不再静默覆盖。 | `games/game-shell.js` |
| 3 | 冲突窗口把下载本地 JSON 备份放在首要位置。 | `games/game-shell.js` |
| 4 | 恢复云端前重新 GET 并核对版本，拒绝应用弹窗中的旧快照。 | `games/game-shell.js` |
| 5 | 云版本基线改为标签页级 `sessionStorage`，避免跨标签页借用版本号。 | `games/game-shell.js` |
| 6 | 冲突未解决时锁住自动、手动、隐藏页、退出和导入等全部上传路径。 | `games/game-shell.js` |
| 7 | Quick Transfer 明确只有文字使用浏览器端 AES-GCM。 | `js/data/resources-content.mjs`、`js/transfer.js` |
| 8 | 文件说明改为 HTTPS、私有 R2 与服务端鉴权，不再宣称口令端到端加密。 | `fragments/quick-transfer.html`、`js/transfer.js` |
| 9 | 配额改为滚动 24 小时，并明确不提供病毒／恶意软件扫描。 | `js/data/resources-content.mjs`、`js/transfer.js` |
| 10 | `/api/health` 检查 D1，只在 HTTP 与数据库都健康时返回在线依据。 | `functions/api/[[route]].js` |
| 11 | PC 托盘提供 checking / online / degraded / offline 四种真实状态。 | `js/features/connection-status.mjs` |
| 12 | 连接检查加入 5 秒超时、异常退避、单飞、后台中止与手动复查。 | `js/features/connection-status.mjs` |
| 13 | 账号状态检查加入 8 秒超时和稳定 popover 内原位重试，保留输入与焦点。 | `js/features/account.mjs` |
| 14 | Chat 只有刷新成功后才进入 online；失败保持 reconnecting。 | `js/routes/chatroom.mjs` |
| 15 | Chat 增加可聚焦的手动重试，成功后回到消息输入。 | `index.html`、`js/routes/chatroom.mjs` |
| 16 | 密码房进入／退出单飞；历史读取失败不再误报 ready。 | `js/routes/chatroom.mjs` |
| 17 | Knowledge 搜索、清空和分类切换重置真实列表滚动与 History 快照。 | `js/routes/knowledge.mjs` |
| 18 | Knowledge 搜索使用 NFKC 归一后的多关键词 AND 匹配。 | `js/routes/knowledge.mjs` |
| 19 | Videos 与 Resources 重建筛选按钮后恢复原筛选焦点。 | `js/routes/videos.mjs`、`js/routes/resources.mjs` |
| 20 | 视频空分类把“显示全部”设为主操作，网站更新降为次操作。 | `js/routes/videos.mjs` |
| 21 | 游戏目录后台刷新失败时保留并明确提示上次成功列表。 | `js/routes/games.mjs` |
| 22 | 首屏只接受 zh / en / ja，并在壳脚本前尽早设置 `html.lang`。 | `index.html` |
| 23 | 文章列表与详情按 API 实际内容语言设置 `lang`，包括 fallback。 | `js/routes/knowledge.mjs` |
| 24 | 移动语言按钮显示完整当前语言，并播报当前与下一语言。 | `js/mobile-shell.js`、`index.html` |
| 25 | Chat 密码提示与专用错误节点关联，短密码设置 `aria-invalid`。 | `index.html`、`js/routes/chatroom.mjs` |
| 26 | Chat 300 字计数通过 `aria-describedby` 关联输入框。 | `index.html` |
| 27 | Transfer 口令输入关联安全说明与反馈状态。 | `fragments/quick-transfer.html`、`js/transfer.js` |
| 28 | 上传区域移除伪按钮式键盘代理，只保留原生文件选择器。 | `fragments/quick-transfer.html`、`js/transfer.js` |
| 29 | 移动资源卡完整显示说明，将事实、标签和 44px CTA 分层，短横屏保持 CTA 可见。 | `js/routes/resources.mjs`、`css/style.css`、`css/mobile-ios-shell.css` |
| 30 | 游戏卡直接显示全部语言支持，简介三行，二级信息使用 44px 原生展开控件。 | `js/routes/games.mjs`、`css/routes/games.css`、`css/mobile-ios-shell.css` |

## 发布边界

- 本批未连接生产 D1。
- 本批未推送 GitHub、未触发 Cloudflare Pages 部署。
- Headless Chrome 用于自动几何与截图回归，不等同真实手机、完整读屏或线上登录态验证。
