# CHANGELOG.md

本文件记录鲁肃个人站的功能、界面、后端、部署与项目约定变更。每次修改项目后都应同步更新这里，方便后续 AI / Codex 对话快速了解最近改动。

## 2026-06-10

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
