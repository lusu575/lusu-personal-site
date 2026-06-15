# 鲁肃个人网站专用Skill

## 用途

本目录是鲁肃个人站的项目专用 Skill，用于保存长期维护规则、强约束和踩坑点。新的 AI / Codex 对话在维护 `lusu575/lusu-personal-site` 时，应优先读取：

```text
skills/lusu-personal-site-skill/SKILL.md
```

`PROJECT_CONTEXT.md` 只保留项目总说明和核心事实；具体规则以本 Skill 为准。

## 当前规则清单

- 每次修改项目后，必须更新 `CHANGELOG.md`。
- 项目信息变化时，必须更新 `PROJECT_CONTEXT.md`。
- 新增长期注意事项、维护规则、踩坑点时，必须同步补充到本 Skill。
- Skill 规则变化时，必须同步更新本 README。
- 保持 Windows XP + Pixel Art + Y2K + 可爱复古互联网桌面风格。
- 可见文案必须维护中文 / English / 日本語。
- 改首页、窗口、任务栏、图标、弹窗、游戏外壳等前端内容时，必须检查手机端适配。
- 首页四时段壁纸基础图放在 `assets/images/wallpapers/`；时间段统一为 05:00-10:59 morning、11:00-16:59 day、17:00-19:59 dusk、20:00-04:59 night。
- 首页保留 `wallpaper-root` / `wallpaper-stage` 舞台坐标结构和动画 layer DOM/class，但当前默认只显示静态底图；后续启用动画时，底图和动画层必须共享同一套 cover 裁切尺寸。
- 后续首页动态壁纸动画只使用 CSS `transform` / `opacity`，必须支持减少动态、页面隐藏暂停和手机端降级。
- 聊天室用户内容必须纯文本渲染，不能用 `innerHTML` 插入访客昵称或消息。
- 聊天室前端应保持 `after/message_id` 增量拉取，空闲和后台时降频，发送后立即刷新；不要每次重复拉最近 100 条。
- 用户要求只美化、不动功能时，只改视觉层，避免改功能逻辑。
- 用户要求只改文档时，只修改文档文件，不改网站代码、样式、功能或资源。
- Cloudflare Pages Git 自动部署是正式部署链路，不要把 `npx wrangler deploy` 或 `npx wrangler pages deploy .` 写成 Git 自动部署命令。
- 后续新增游戏时，必须在游戏标签或信息里标明中文、English、日本語是否支持。
- 网站切换语言时，游戏区优先展示对应语言。
- 如果游戏不支持当前语言，默认启动英语版本。
- `kittens-game` 语言设置使用 `com.nuclearunicorn.kittengame.language`；`a-dark-room` 简体中文语言参数为 `zh_cn`，并保留 `ignorebrowser=true`。
- `life-restart` 来源为 `VickScarlet/lifeRestart`，升级时需要重新执行 `xlsx2json` 和 `build`，仅提交 `template/public` 对应的静态产物；它只支持中文和 English，日语站点入口默认启动 English，且启动语言 query 参数名是 `language`。
- `life-restart` 存档键为 `theme`、`times`、`extendTalent`、`ATLT`、`AEVT`、`ACHV`、`uniqueWaTaShi`，升级上游版本时必须重新检查并同步 `games/catalog.json`。
- 本地验证游戏区应通过静态服务器访问，不要直接打开 `file://`。
- 文章内容保存在 Cloudflare D1，代码保存在 GitHub；正式发布文章应同时写入 zh / en / ja 三种内容。
- 文章系统第一阶段不做自动翻译，不新增翻译按钮、`translate` 或 `retranslate` 接口。
- 文章详情公开地址使用 `/articles/<slug>`，必须能通过域名直接分享和恢复单篇文章详情；内部 `article_id` 不在公开链接或公开 API 中外显。
- 文章 Markdown 渲染必须防 XSS，不能把未经处理的 Markdown 或 HTML 直接作为 `innerHTML` 插入页面；文章图片只引用 `assets/images/articles/` 下的项目内资源，不引用本机临时路径。
- 后台文章管理接口必须要求 `users.role = admin`，普通登录用户不能管理文章。
- 文章发布时间和聊天室消息时间必须按用户所在时区显示；文章发布时间不显示时区名，后端时间保持 ISO/UTC 语义，前端再转换到用户本机时区。
- 从知识库文章详情关闭窗口或返回桌面后，再次打开知识库应回到知识库首页。
- 每次合并代码、上线功能或做可见更新时，必须在知识库 `site-updates`（网站更新记录）分类发布一篇 zh / en / ja 三语真实文章，包含主标题、简短简介和正文。
- 首页欢迎弹窗右侧“最近更新”自动读取 `site-updates` 分类文章，“查看更多更新”跳转到该分类。
- Cloudflare 部署检查命令和期望状态保留在 `SKILL.md`。
- 线上验证要注意 Cloudflare 缓存和 `lusu575.com` / `www.lusu575.com` 双域名缓存差异。
- 修改 `js/main.js`、`css/style.css` 或强视觉资源时，必须同步更新 `index.html` 中的资源 query 版本号，避免线上继续显示旧缓存。
- 每次推送 `main` 后，必须核对 `origin/main` 最新 commit、Cloudflare Pages 最新成功生产部署 commit、线上 `index.html` 的 CSS/JS query 版本三者一致；线上线下显示不同先查部署状态、资源 query 和 Cloudflare/浏览器缓存。
- 右上角“最近更新日期”从 `content.updates` 的最大日期自动生成；新增可见更新时补 `content.updates`，不要恢复写死日期。

## 后续维护方式

当项目出现新的长期规则、反复踩坑点或协作约束时：

1. 更新 `skills/lusu-personal-site-skill/SKILL.md`。
2. 同步更新本 `README.md` 的规则清单或维护方式。
3. 如果项目事实发生变化，同时更新根目录 `PROJECT_CONTEXT.md`。
4. 在根目录 `CHANGELOG.md` 记录本次文档或规则变化。

新对话中可以直接说明：

```text
请先读取 PROJECT_CONTEXT.md 和 skills/lusu-personal-site-skill/SKILL.md，再继续维护项目。
```
