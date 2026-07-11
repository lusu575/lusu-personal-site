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
- 如果改动涉及 `/admin/` 管理后台、后台权限、后台 API、后台统计、后台视频管理、后台社交链接管理、后台聊天室治理或后台专用文档，必须额外先读取 `admin/docs/ADMIN_PROJECT_CONTEXT.md`、`admin/docs/ADMIN_SKILL.md` 和必要时的 `admin/docs/ADMIN_CHANGELOG.md`。
- 桌面端保持 Windows XP + Pixel Art + Y2K，并沿 Neo-XP / Pixel Glass OS 演进；移动端使用原创、受 iOS 交互启发的虚拟手机 OS，不能只压缩桌面 XP 布局。
- 可见文案必须维护中文 / English / 日本語。
- 改首页、窗口、任务栏、图标、弹窗、游戏外壳等前端内容时，必须检查手机端适配。
- “日本語の裏側”位于 `tools/japanese-subtext/`，固定采用版本化分批 JSON 和不可随意变更的关卡 ID；改关要增加 `revision`，先审校锁文，再只重建受内容哈希影响的音频。
- 题库、音频 manifest 与时间轴必须同步并分别验证；每关 source hash、cue 顺序、CPU provider、输出参数和发音表 canonical SHA-256 必须与锁定题库一致，正式发布要对 10,088 件音频做全量 ffprobe、SHA-256、孤儿文件和静音检测。TTS 模型、权重、实际配置、本机路径和参考声线不提交，模型只作离线批处理且生成结束后关闭，不安装服务或自启动。
- 声线必须来源和许可清晰；保留 `NOTICE-japanese-voices.md` 与设置面板三语署名链接，不使用来源不明或模仿受保护动漫角色的声线。
- 工具学习进度使用独立 D1 表，不得与游戏存档混用；跨设备合并必须保留已通关记录的首次通关模式。所有题库字符串安全渲染，图片只来自本工具资产目录，音频只从 manifest 解析。
- 新工具图片只允许彩色儿童蜡笔或抽象 Q 版四格，不使用黑白线稿；图片要压缩、懒加载、响应式且不挤占移动端首屏。
- 发布日语工具前必须通过题库、真实音频、自动测试、主站构建和 375×667 / 390×844 / 844×390 / 768×1024 / 1365×900 五视口回归，并同步文档、Skill、缓存版本与唯一三语更新记录。
- 首页四时段壁纸基础图放在 `assets/images/wallpapers/`；时间段统一为 05:00-10:59 morning、11:00-16:59 day、17:00-19:59 dusk、20:00-04:59 night。
- 首页保留 `wallpaper-root` / `wallpaper-stage` 舞台坐标结构和动画 layer DOM/class；当前 morning / day / dusk / night 四时段均已启用无云底图 + 独立云层的动态云层。
- 顶部栏和底部任务栏跟随同一套 `body[data-time-theme]` 四时段主题；维护顶部栏、任务栏、Start、任务按钮、账号入口、语言切换或状态托盘时，必须同时检查四套外观，保持无竖线的现代玻璃像素 HUD 方向，并保留现有图标资源。
- 维护右上角账号入口、语言切换或其他顶栏浮层时，必须同时检查 `.xp-topbar` 的裁剪行为和 `.site-shell > header` / `.site-shell > main` 的 stacking context；账号弹窗必须能从按钮下方溢出显示，且 `header` 必须高于 `main`，否则首页会像点了没反应、其他栏目会被窗口遮挡。
- 每次改动都必须写记录并更新日期：至少更新 `CHANGELOG.md`；公开可见更新还必须补 `PROJECT_CONTEXT.md`、`content.updates`、`site-updates` 三语记录、相关 seed 和资源 query，确保首页最近更新日期真的变化。
- 底部任务栏必须固定贴合浏览器视口下沿，窗口高度、页面 padding、文章阅读浮层和移动端断点都要为它预留空间，避免导航被顶下去或盖住正常窗口。
- 旧版 460px 以下“两行 XP 顶栏”规则只用于兼容历史样式；当前移动壳必须按虚拟手机 OS 的状态区、全屏 App、Dock 和 Home 控制校验，不能恢复成压缩桌面布局。
- 非首页窗口页背景必须跟随 `body[data-time-theme]` 的四时段专用图片 `assets/images/window-backdrops/<time>.png`，并保持比首页更低干扰、更简单的现代遮罩，不要恢复成单一蓝绿色渐变，也不要直接复用首页大场景图。
- 关于我窗口的 X、GitHub、Bilibili、Instagram、Discord 必须保持小图标按钮展示，链接从 `GET /api/social-links` 公开读取，后台通过 `GET/PUT /api/admin/social-links` 修改并保存到 `site_runtime_state.about_social_links`。
- 本地调试动态壁纸可用 `?wallpaper=morning` / `?wallpaper=day` / `?wallpaper=dusk` / `?wallpaper=night` 强制预览指定时间段；预览模式可临时加快动画，不要为了预览硬编码当前时间。
- 首页动态壁纸动画只使用 CSS `transform` / `opacity`，必须支持减少动态、页面隐藏暂停和手机端降级；降级时回到对应静态壁纸。
- 聊天室用户内容必须纯文本渲染，不能用 `innerHTML` 插入访客昵称或消息。
- 聊天室前端应保持 `after/message_id` 增量拉取，空闲和后台时降频，发送后立即刷新；不要每次重复拉最近 100 条。
- 聊天室普通大厅固定 `room_key='public'`，密码房使用暗色 UI 和浏览器端 Web Crypto 前端加密；密码房只提交密文 `encryptedContent`，不得保存密码或后台解密。
- 密码房的读取、发送、随机昵称占用、发送限流和增量游标恢复都必须按 `room_key` 隔离；仅密码房在 24 小时无发言后删除该房密文消息，普通大厅不受影响。
- 聊天室 schema guard 必须先补新增列再建依赖新增列的索引；不要在旧 D1 表缺少 `room_key` / `encrypted` 时提前创建房间索引。
- 维护密码房时只能称为前端加密或浏览器端加密，不承诺绝对安全 E2EE；必须提醒弱密码可能被猜中，网页端仍信任当前加载的站点 JS。
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
- 管理后台固定为 `/admin/`，后台静态文件放在 `admin/`，并通过 `functions/admin/_middleware.js` 和 `/api/admin/*` 双层校验 `users.role = admin`。
- 后台专用文档固定放在 `admin/docs/`，包括 `ADMIN_PROJECT_CONTEXT.md`、`ADMIN_SKILL.md` 和 `ADMIN_CHANGELOG.md`；后台细节优先以这些文档为准，不要只靠主站文档推断。
- 后台只需要中文；后台项目介绍和后台更新记录单独维护，不写入主站知识库 `site-updates`，不公开展示。
- 纯后台私有更新不写入主站 `site-updates`；如果后台改动同时改变主站公开可见体验，公开侧仍要补三语网站更新文章、schema seed 和 `js/main.js` fallback。
- 后台与埋点关键文件包括 `admin/index.html`、`admin/admin.css`、`admin/admin.js`、`functions/admin/_middleware.js`、`functions/api/[[route]].js`、`js/telemetry.js` 和 `cloudflare/schema.sql`。
- 后台视频封面可使用平台图片 URL，或选择 JPG、PNG、WEBP、AVIF 本地图片压缩为受限 `data:image`；本地视频首帧只用于生成封面，不代表支持本地视频托管或放宽视频链接白名单。
- 主站访问/点击埋点使用独立 `js/telemetry.js`；不得记录输入框内容、密码、未发送聊天内容或文章草稿；点击目标文本、页面路径、来源、链接、元素标识和点击聚合键中的邮箱样式文本（含 URL 编码和双重编码形态）必须在前端和服务端写入前脱敏。
- 文章访问 PV/UV 使用服务端 `GET /api/articles/:slug` 写入 `article_view_events`，后台单篇文章统计以该表为准，不要只依赖前端页面级 PV。
- 后台访客识别使用 HttpOnly `lusu_visitor` 隐藏 ID，不在前台 UI 或公开 API 中展示；聊天室后台禁言使用隐藏 visitor_id 或 IP hash。
- IP 信息只保存 hash、掩码前缀和 Cloudflare 来源地字段，不向普通前台暴露完整明文 IP。
- 文章发布时间和聊天室消息时间必须按用户所在时区显示；文章发布时间不显示时区名，后端时间保持 ISO/UTC 语义，前端再转换到用户本机时区；后台文章编辑器显示管理员本地时间，保存时转换为 UTC ISO，后端再次规范化 `published_at`。
- 从知识库文章详情关闭窗口或返回桌面后，再次打开知识库应回到知识库首页。
- 每次合并代码、上线功能或做可见更新时，必须在知识库 `site-updates`（网站更新记录）分类发布一篇 zh / en / ja 三语真实文章，包含主标题、简短简介和正文。
- 这条是合并前验收门槛；如果不能通过后台发布，也要在同一次变更中补齐 seed 与 fallback，确认知识库、欢迎弹窗最近更新和右上角最新日期能读到本次更新。
- 通过 seed 维护网站更新记录时，必须同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` 的本地 fallback 最近更新。
- 首页欢迎弹窗右侧“最近更新”自动读取 `site-updates` 分类文章，“查看更多更新”跳转到该分类。
- 当前主站不提供公开聚合入口；不要恢复相关按钮、发现链接或公开输出接口，除非用户重新明确要求，并同步补齐三语文案、种子、构建守卫和部署说明。
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

如果本次只维护管理后台，应改为：

```text
请先读取 PROJECT_CONTEXT.md、skills/lusu-personal-site-skill/SKILL.md、admin/docs/ADMIN_PROJECT_CONTEXT.md 和 admin/docs/ADMIN_SKILL.md，再继续维护后台。
```
## 2026-06-15 视频系统规则

- 视频区现在是 D1 驱动的可管理系统，核心表为 `videos`、`video_categories`、`video_category_relations`。
- 维护视频功能时必须保持服务端解析链接、服务端生成 `embed_url`、后台 admin 权限校验、前台安全 DOM 渲染和元数据 D1 缓存。
- 支持的链接域名限定为 YouTube、youtu.be、Bilibili、b23.tv；不要把用户输入的任意 URL 直接放进 iframe。
- 公开视频接口必须返回 `original_url` 给“打开原地址”；站内窗口最大化/还原不要直接 fullscreen iframe，平台播放器自己的全屏交给 iframe 内部控件。
- 跨域播放器热区不能由父页面精确改写，遇到默认信息栏或底部空白误触时，用站内遮罩、透明点击防护区和收窄本站按钮热区兜底。
- YouTube / Bilibili 元数据只在后台预览、首次保存、URL 变化保存或刷新元数据时抓取；已有视频 URL 未变化的普通保存不要重新抓取外部元数据。
- 后台封面可使用 YouTube / Bilibili 图片 URL，或本地 JPG、PNG、WEBP、AVIF 图片压缩后的受限 `data:image`；不得允许 SVG、HTML、任意 data URL 或任意图片域名。
- 从本地视频截首帧只生成封面，不上传或托管视频文件，也不改变 YouTube / Bilibili / b23.tv 链接白名单。
- 视频排序语义为置顶独立队列优先；置顶视频一定排在未置顶视频前面，多个置顶视频按 `pinned_sort_order` 从大到小显示，未置顶视频和视频分类按 `sort_order` 从大到小显示，新建默认取对应队列最大排序 +10。
- Bilibili 元数据遇到 HTTP 412 或页面结构变化时，优先尝试详情接口、移动页、页面 `__INITIAL_STATE__` / `__NEXT_DATA__`、meta、结构化数据和更宽的页面状态兜底，不放宽白名单或 iframe 安全边界。
- 默认视频分类 seed 只在全新 `video_categories` 表首次创建时初始化；已有表通过 `site_runtime_state.video_categories_default_seeded` 视为已处理，不要覆盖或补回后台维护过的 `slug`、`name_zh`、`name_en`、`name_ja`、`sort_order`、`enabled` 和已删除分类。
- 主站所有视频卡片必须保持统一尺寸，封面铺满区域；缺少封面或加载失败时使用同尺寸像素风占位图。
- 修改视频区前台、后台或样式后，同步更新缓存 query、`CHANGELOG.md`、`PROJECT_CONTEXT.md`、本 Skill 与网站更新记录。
