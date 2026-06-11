# CHANGELOG.md

本文件记录鲁肃个人站的功能、界面、后端、部署与项目约定变更。每次修改项目后都应同步更新这里，方便后续 AI / Codex 对话快速了解最近改动。

## 2026-06-11

- 调整游戏区卡片显示：
  - 删除游戏简介里“跟随网站语言载入”的说明。
  - 删除游戏卡片底部的英文游戏名和许可证标签，只保留语言支持标记。
  - 将游戏区窗口恢复为随内容收缩的尺寸，游戏列表后续内容较多时在列表内部纵向滚动。
- 调整聊天室、二级窗口和欢迎弹窗：
  - 聊天室新增 `GET /api/chat/nickname`，首次进入时按近期/已有聊天室昵称分配未占用的随机昵称。
  - 聊天室发言接口会阻止不同访客继续使用已被占用的昵称，前端遇到昵称冲突时会自动领取新昵称。
  - Pages Functions 新增账号、会话和游戏存档核心表的 D1 schema guard，避免本地空 D1 环境下 `/api/health` 直接失败。
  - 知识库、视频区、资源区、游戏区、杂谈区和关于我窗口改为固定在可视区域内，内容过多时使用窗口内部滚动条，避免整个浏览器页面滚动。
  - 知识库、视频区、资源区、杂谈区当前测试内容标题新增“占位符”标识，并同步中文 / English / 日本語 文案。
  - 欢迎弹窗标题改为“欢迎”，左侧主标题改为根据当前系统时间显示早上好 / 中午好 / 下午好 / 晚上好和当天日期。
  - 更新首页 CSS / JS 版本号，减少线上缓存继续加载旧资源的可能。
  - 更新 `PROJECT_CONTEXT.md` 的聊天室说明和接口清单。
- 整理项目文档结构：
  - 将 `PROJECT_CONTEXT.md` 精简为项目总说明，保留项目背景、项目介绍、技术栈、部署方式、主要功能、文件结构、本地开发方式、账号、云存档、聊天室、游戏区等核心信息。
  - 将长期维护规则、强约束和踩坑点拆分到 `skills/lusu-personal-site-skill/SKILL.md`。
  - 在 `PROJECT_CONTEXT.md` 保留项目专用 Skill 索引，方便新对话定位规则来源。
- 新增项目专用 Skill：
  - 新增 `skills/lusu-personal-site-skill/SKILL.md`，Skill 名称为「鲁肃个人网站专用Skill」。
  - 规则覆盖 CHANGELOG / PROJECT_CONTEXT 更新要求、XP Pixel Art Y2K 风格、三语文案、移动端适配、聊天室纯文本渲染、只美化不动功能、Cloudflare Pages Git 自动部署等约束。
- 新增 Skill 说明文档：
  - 新增 `skills/lusu-personal-site-skill/README.md`，说明 Skill 用途、当前规则清单和后续维护方式。
  - 约定后续 Skill 规则变化时同步更新 README。
- 新增游戏语言维护规则：
  - 后续新增游戏时，必须在游戏标签或信息里标明中文、English、日本語是否支持。
  - 网站切换语言时，游戏区优先展示对应语言。
  - 如果游戏不支持当前语言，默认启动英语版本。

## 2026-06-10

- 修复聊天室短消息和桌面图标细节：
  - 自己发送的短文本气泡改为右对齐，贴近自己的昵称和头像。
  - 统一桌面图标视觉尺寸，压小匿名聊天室图标，放大杂谈区和游戏区图标。
  - 更新首页 CSS 版本号，避免线上继续使用旧样式缓存。
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
