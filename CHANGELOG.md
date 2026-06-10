# CHANGELOG.md

本文件记录鲁肃个人站的功能、界面、后端、部署与项目约定变更。每次修改项目后都应同步更新这里，方便后续 AI / Codex 对话快速了解最近改动。

## 2026-06-10

- 将聊天室窗口标题从 `XP 匿名聊天室 - LuSu's Chat Room` 简化为 `匿名聊天室`，并更新 `main.js` 版本号避免旧缓存。
- 修复聊天室上线后的域名缓存与界面问题：
  - `index.html` 为 `js/main.js` 增加版本号，避免 `lusu575.com` 继续使用旧 JS 导致 `navChatroom` 不翻译、聊天室入口点击无效。
  - 新增 `assets/images/icon-chatroom-clean.png`，替换带蓝色底色的聊天室图标资源。
  - 调整聊天室桌面图标尺寸，和现有桌面图标更一致。
  - 优化聊天室消息布局，让头像、发送人和消息气泡更紧凑，并强化自己的消息与他人消息的左右和颜色区分。
  - 任务栏「杂谈区」图标改为记事本图标，「匿名聊天室」改为小聊天室图标，避免两个入口使用同一个气泡图标。
- 新增「XP 像素风匿名聊天室」MVP。
- 新增桌面图标、任务栏入口和 `chatroom` 页面，风格参考 Windows XP / Pixel Art / Y2K 聊天窗口。
- 新增 `assets/images/icon-chatroom.png`，由用户提供的聊天室图标参考图裁切制作。
- 新增三语文案：中文 / English / 日本語。
- 前端支持未登录访客直接发言、随机昵称、昵称本地保存、昵称修改、300 字限制、3 秒发送冷却、首次加载最近 100 条、5 秒轮询新增消息、页面恢复激活立即刷新。
- 前端聊天内容使用 DOM `textContent` 纯文本渲染，避免把用户内容作为 HTML 插入。
- Cloudflare Pages Functions 新增：
  - `GET /api/chat/messages`
  - `POST /api/chat/messages`
- Cloudflare D1 schema 新增 `anonymous_chat_messages` 表，字段包含 `message_id`、`visitor_id`、`nickname`、`content`、`created_at`、`hidden`、`ip_hash`。
- 后端新增 visitor_id 3 秒限速、IP hash 每分钟基础限流、昵称和消息长度校验、单次最多返回 100 条消息。
- 聊天室接口增加 D1 schema guard：如果本地或首发环境尚未迁移聊天室表，会自动执行 `create table if not exists`；正式上线仍建议执行 D1 migration。
- 更新 `PROJECT_CONTEXT.md`，加入每次修改后维护 `CHANGELOG.md` 的约定。
