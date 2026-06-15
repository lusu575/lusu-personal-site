# lusu-personal-site

鲁肃的个人站，一个 Windows XP + Pixel Art + Y2K 桌面风格的个人空间。

## 当前状态

- 首页使用 morning / day / dusk / night 四时段像素壁纸，并已接入无云底图 + 单朵独立云层的动态云层效果。
- 知识库文章内容保存在 Cloudflare D1，正式文章需要同时维护中文 / English / 日本語 三语内容。
- `/admin/` 是独立中文管理后台，只有 `users.role = admin` 的站长账号可以访问，用于文章管理、访问监控、点击埋点和聊天室管理。
- 主站访问与点击数据通过 `js/telemetry.js` 上报；不记录输入框内容、密码、未发送聊天内容或文章草稿。
- 匿名聊天室公开侧保持纯文本渲染，后台可隐藏、恢复、删除消息，并按隐藏访客 ID 或 IP hash 禁言。
- 游戏区只保留可在本站本地打开的静态游戏入口，不做外部跳转入口。

## 维护备注

- 正式部署链路：GitHub `main` -> Cloudflare Pages Git 自动部署 -> `lusu575.com`。
- 继续维护项目前，先读取 `PROJECT_CONTEXT.md` 和 `skills/lusu-personal-site-skill/SKILL.md`。
- 每次修改项目后，同步更新 `CHANGELOG.md`；项目事实或长期规则变化时，同步更新 `PROJECT_CONTEXT.md` 和项目专用 Skill。
- 后台项目介绍和后台更新记录只维护在后台内，不写入主站知识库 `site-updates`，也不公开展示到首页最近更新。
- 涉及 `js/main.js`、`css/style.css`、首页壁纸、图标等强视觉或交互资源时，记得同步更新 `index.html` 的资源 query，避免线上缓存继续加载旧文件。
- `games/life-restart/` 来自 `VickScarlet/lifeRestart`，上游需要先执行 `xlsx2json` 和 `build`，本站提交构建产物 `template/public` 对应的 `games/life-restart/source/`。
- lifeRestart 当前支持中文和 English，暂无日本語；日语站点入口默认启动 English。它的启动语言参数名是 `language`，不是本站多数游戏使用的 `lang`。

## 关键文件

- 主站入口：`index.html`
- 主站样式：`css/style.css`
- 主站逻辑：`js/main.js`
- 访问埋点：`js/telemetry.js`
- 后台页面：`admin/index.html`、`admin/admin.css`、`admin/admin.js`
- 后台访问拦截：`functions/admin/_middleware.js`
- 后端 API：`functions/api/[[route]].js`
- D1 schema：`cloudflare/schema.sql`
- 项目上下文：`PROJECT_CONTEXT.md`
- 项目专用 Skill：`skills/lusu-personal-site-skill/SKILL.md`
