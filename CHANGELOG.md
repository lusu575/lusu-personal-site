# CHANGELOG.md

本文件记录鲁肃个人站的功能、界面、后端、部署与项目约定变更。每次修改项目后都应同步更新这里，方便后续 AI / Codex 对话快速了解最近改动。

## 2026-06-15

- 管理后台第一版保守型视觉优化：
  - 优化 `/admin/` 后台整体观感，统一侧边栏、顶部栏、XP 面板、按钮、表格、状态标签、空状态和提示信息，保持中文后台和轻量 XP / 像素风元素。
  - 改善实时大屏、文章管理、访问来源、点击埋点和聊天室管理在桌面、平板、移动端的阅读布局，修正移动端侧边栏高度和编辑区滚动边界。
  - 后台私有更新记录新增“后台视觉优化第一版”，继续与主站知识库 `site-updates` 分开维护。
  - 新增轻量 `npm run build` 静态检查脚本，用于验证后台入口、资源引用、关键面板、JS 语法和 CSS 基础结构。
- 文章访问埋点与 PV/UV：
  - 新增 `article_view_events` 文章访问事件表，公开文章详情接口 `/api/articles/:slug` 每次成功读取文章时会按隐藏 `lusu_visitor` 记录文章 PV、UV、语言、访问来源和掩码 IP 信息。
  - 后台实时大屏新增“热门文章”表，按最近周期展示文章标题、slug、PV、UV 和最近访问时间。
  - 后台文章列表和文章编辑详情新增文章总 PV/UV、今日 PV/UV 显示，方便在发布和维护文章时直接查看单篇访问表现。
  - `js/telemetry.js` 新增 `history.pushState` / `history.replaceState` 监听，修复前端路由切换到文章详情时页面级 PV 可能漏记的问题。
- 网站更新记录维护闭环补齐：
  - 新增 `seed-update-2026-06-15-clouds-docs-maintenance` 三语 `site-updates` 文章，公开记录四时段动态云层和维护文档补齐，本篇文章会驱动首页最近更新和右上角最新日期。
  - 同步更新 `functions/api/[[route]].js` 的文章 seed、`cloudflare/schema.sql` 的 D1 seed，以及 `js/main.js` 的本地 fallback 最近更新，避免 D1 不可用时回退到旧日期。
  - 更新 `index.html` 主脚本 query 为 `20260615-site-updates-maintenance`，减少线上继续加载旧 fallback 最近更新的可能。
  - 在项目上下文和专用 Skill 中补充：更新 `site-updates` seed 时必须同步 API seed、D1 schema 和本地 fallback 最近更新。

- 后台文章保存 500 修复：
  - 修复 Pages Functions 路由分发未 `await` 异步处理函数的问题，避免后台文章保存、后台权限检查和表单校验错误绕过统一 `try/catch`，被 Cloudflare 直接返回 1101 / HTTP 500。
  - 后台接口现在会正常返回 JSON 格式的 401 / 403 / 400 / 500 错误，便于前端显示真实原因。

- 独立管理后台与访问监控：
  - 新增 `/admin/` 中文管理后台，包含实时监控大屏、知识库文章管理、访问来源、点击埋点、聊天室管理、后台项目介绍和私有后台更新记录。
  - 新增 `functions/admin/_middleware.js`，后台静态资源也会复用主站账号 `lusu_session` 并校验 `users.role = admin`；非管理员只能看到后台登录/拒绝页。
  - 后台文章编辑支持按当前选择语言显示中文 / English / 日本語面板，但保存和发布时要求三语标题与正文齐全。
  - 新增访问与点击埋点接口：`/api/analytics/identify`、`/api/analytics/page-view`、`/api/analytics/click`，主站通过独立 `js/telemetry.js` 上报 PV、UV、地理来源和点击目标。
  - 新增后台统计接口 `/api/admin/analytics/overview`，按最近周期返回 PV/UV、今日点击、在线访客、国家/省份/城市/IP 前缀、热门页面、点击热点和最近事件。
  - 新增 HttpOnly `lusu_visitor` 隐藏访客 ID；前台不显示该 ID，聊天室公开接口继续返回本地 client id 用于“我的消息”显示，后台使用隐藏 visitor_id 做识别和禁言。
  - 聊天室后台新增消息编辑、隐藏/恢复、删除、按隐藏 visitor_id 或 IP hash 禁言；D1 新增 `chat_bans`、`site_visitors`、`analytics_page_views`、`analytics_click_events`。
  - 更新 `cloudflare/schema.sql`、`PROJECT_CONTEXT.md`、项目专用 Skill 和 README，记录后台权限、埋点隐私和后台更新记录不混入主站 `site-updates` 的规则。
  - 补齐根目录 README 的当前项目状态、后台、埋点与上线链路说明，并将首页右上角“最近更新日期”的静态兜底文本同步为 `2026.06.15`；实际显示仍由 `site-updates` / `content.updates` 自动计算。

- 首页四时段动态云层扩展：
  - 将 morning / dusk / night 也接入与 Day 相同的动态云层方式：各自使用 `assets/images/wallpaper-dynamic/<time>/base-clean.png` 作为无云底图，并叠加单朵独立透明云层。
  - morning / dusk 各拆出 7 朵中高空移动云，night 拆出 7 朵夜色云；低地平线云保留静态，避免移动后贴近地面或山坡。
  - 四个时间段的云层都改为按同一主风向慢速错相漂移，速度和相位逐朵打散，避免所有云一起移动或排布过于规律。
  - `?wallpaper=morning` / `?wallpaper=day` / `?wallpaper=dusk` / `?wallpaper=night` 均可强制预览对应动态壁纸，预览模式继续临时加快位移。
  - 更新 CSS / JS query 为 `20260615-all-clouds-natural`，减少缓存加载旧壁纸逻辑。
  - 更新 `PROJECT_CONTEXT.md` 和项目专用 Skill，记录四时段动态云层状态。

- 首页 Day 动态云层 MVP：
  - 首页 Day 时段改用 `assets/images/wallpaper-dynamic/day/base-clean.png` 作为无云 clean plate。
  - 接入 5 张独立透明云层 PNG，按 1672x941 舞台坐标定位，并用 CSS `transform` 做慢速、错相、同一主风向的横向漂移。
  - 将 Day 云层改为从原始 `day.png` 抠出的原尺寸云块，缩小云彩并下放位置，避免云层过大或过度贴近顶部。
  - 继续微调 Day 云层：顶部云进一步下移，所有云改为同一主风向下的错相漂移，速度只小幅加快，并打散左右位置避免过度对称。
  - 增加页面隐藏暂停和 `prefers-reduced-motion` / 小屏兜底：减少动态或移动端会回到原静态 Day 壁纸。
  - 新增本地预览参数 `?wallpaper=day`，可不受当前时间段限制直接查看 Day 动态云层；预览模式会临时加快云层位移以便肉眼确认动画。
  - 更新 CSS / JS query 为 `20260615-day-cloud-natural`，减少缓存加载旧壁纸逻辑。
  - 更新 `PROJECT_CONTEXT.md` 和项目专用 Skill，记录 Day 动态云层已从预留接口进入 MVP 状态。

- 首页 Day 动态云层资源草图：
  - 使用 imagegen 生成 Day 时段像素云层草图，保存到 `assets/images/wallpaper-dynamic/day/`。
  - 将云层拆分为 5 张独立透明 PNG，并额外生成蓝底预览图用于检查云层高度、像素边缘和后续独立移动分层。
  - 生成 Day 时段 `base-clean.png` 无云底图，作为后续动态云层叠加的 clean plate。

- 首页动态壁纸实验回退：
  - 移除本地云层、树、水面反光和电视小女孩相关测试逻辑与生成素材。
  - 首页恢复为四时段静态像素壁纸，只保留既有 `wallpaper-root` / `wallpaper-stage` 舞台和预留 layer 结构。
  - 本地仓库分支清理为只保留 `main`。

## 2026-06-14

- 知识库长文阅读体验优化：
  - 知识库阅读窗口改为随浏览器视口扩展，长文章在桌面端可使用更多宽度和高度。
  - 文章详情公开地址支持 `/articles/<slug>`，便于通过域名直接分享和访问单篇文章链接；内部 `article_id` 不在公开链接和公开 API 中外显。
  - Markdown 渲染补充有序列表、文章图片和 `text` 代码块蓝色说明框，修复长编号列表被挤成一行的问题。
  - 为《从提问到上线：普通人如何用 AI Agent 放大执行力》加入 Codex 与 GPT 聊天截图，并同步写入 zh / en / ja 三语 seed。
  - 新增 `_redirects` 规则，让 Cloudflare Pages 直接访问 `/articles/*` 时返回主页面并由前端加载文章详情。
  - 更新 CSS / JS 资源 query 为 `20260615-article-direct-paths`，减少线上缓存继续加载旧阅读样式的可能。

- 知识库发布《从提问到上线：普通人如何用 AI Agent 放大执行力》：
  - 检查并修正终版文章的 Markdown 格式、中英文空格、大小写和个别易误解表述。
  - 新增 zh / en / ja 三语文章 seed，分类为 AI，并设为置顶文章。
  - 新增同日三语网站更新记录文章，便于首页最近更新展示。

## 2026-06-12

- 首页壁纸清晰度修复：
  - 将 `assets/images/wallpapers/` 下的 morning / day / dusk / night 四张首页实际加载壁纸替换为用户提供的 `1672x941` 高清原图，避免全屏时继续放大半尺寸底图。
  - 首页壁纸舞台比例从 `836 / 470` 更新为 `1672 / 941`，并为底图启用像素渲染，减少浏览器平滑缩放造成的发糊。
  - 更新壁纸 URL、CSS 和 JS query 版本为 `20260612-hd-wallpapers`，并补充三语网站更新记录 seed。
- Life Restart 英语启动修复：
  - 修复《人生重开模拟器》切换 English 后仍显示中文的问题；上游启动参数读取 `language=en-us`，不是本站游戏外壳默认的 `lang=en-us`。
  - `games/game-shell.js` 新增按游戏配置选择语言 query 参数名的能力，`games/catalog.json` 为 `life-restart` 配置 `languageQueryParam: "language"`。
- Life Restart 本地静态接入：
  - 拉取并构建 `VickScarlet/lifeRestart`，构建链路为 `npm.cmd install`、`npm.cmd run xlsx2json`、`npm.cmd run build`，产物目录为上游 `template/public`。
  - 新增 `games/life-restart/`，将构建产物部署到 `games/life-restart/source/`，并通过统一 `games/game-shell.js` 外壳加载，不做外部跳转入口。
  - 更新 `games/catalog.json`，新增 Life Restart 卡片，标明中文 / English 支持、日本語暂不支持；日语站点入口默认启动 English。
  - 补充 lifeRestart 本地存档键 `theme`、`times`、`extendTalent`、`ATLT`、`AEVT`、`ACHV`、`uniqueWaTaShi`，用于本地导入导出和登录后的云存档同步。
  - 调整 `games/game-shell.js` 的语言 fallback：当前语言不支持时优先启动 English，再 fallback 到中文。
  - 更新 `PROJECT_CONTEXT.md`、`README.md` 和项目专用 Skill，记录 lifeRestart 后续升级构建和存档键检查注意事项。
- 2048 和 Hextris 遮罩显示修复：
  - 为两个游戏的结束/继续遮罩补充 `.overlay[hidden] { display: none; }`，避免 `.overlay { display: grid; }` 覆盖浏览器默认 hidden 样式，导致新局也一直显示“继续玩”或“游戏结束”。
  - 为两个游戏内页的 `styles.css` 引用增加 `20260612-overlay-hidden-fix` query，减少线上继续加载旧游戏样式缓存的可能。
- 首页四时段壁纸重制：
  - 使用 image2 参照用户提供的四张四时段像素壁纸重新制作 `morning.png`、`day.png`、`dusk.png`、`night.png`，保持原构图和 `836x470` 站点尺寸。
  - 删除四张图中电视机屏幕里的雪花/噪点，改为干净的深色玻璃屏，并优化四个时段的整体配色。
  - 更新壁纸 URL 与首页 CSS query 版本为 `20260612-clean-tv-wallpapers`，减少线上继续显示旧壁纸缓存的可能。
- 首页标题文案微调：
  - 删除首页主标题下方的英文副标题 `LuSu's Personal Site`，只保留站点标题和“开发施工中”文案。
- 游戏、聊天室和知识库读取优化：
  - `2048` 和 `Hextris` 的站点外壳只同步历史最高分，不再把当前对局、结束状态或语言键写入云存档；检测到旧云端数据时会静默合并最高分，不再弹出恢复对局确认。
  - 匿名聊天室消息时间去掉本机时区/地区名称，当天只显示时间，旧消息显示日期和时间。
  - 首页壁纸主文案改为“开发施工中”。
  - 知识库文章详情增加前端内存缓存，并让文章 seed 数据每个边缘运行实例只初始化一次，减少重复进入详情页和连续读取时的等待。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260612-game-chat-article-fix`，减少线上浏览器继续加载旧逻辑的可能。
- 首页时间壁纸与游戏可玩性修复：
  - 新增 `homepage-morning.png`、`homepage-day.png`、`homepage-evening.png`、`homepage-night.png` 四张首页像素壁纸，并按用户本地时间自动切换：早上 6:00-10:00，白天 10:00-16:00，傍晚 16:00-19:30，晚上 19:30-次日 6:00。
  - 首页欢迎弹窗问候语改为使用同一套本地时间分段，页面停留时会随底部时钟刷新同步检查时间主题。
  - 知识库文章发布日期继续按用户本地时间显示到秒，但不再显示本机时区名称。
  - `2048` 和 `Hextris` 恢复本地或云端存档时，如果读到已结束或不可继续的局面，会自动开启新局，避免进入后直接显示继续玩/游戏结束遮罩。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260612-time-wallpaper-game-fix`，减少线上缓存继续加载旧资源的可能。
- 首页四时段静态像素壁纸接口：
  - 使用 image2 / imagegen 重新绘制一张四时段统一构图母版，并裁切为 `assets/images/wallpapers/morning.png`、`day.png`、`dusk.png`、`night.png` 四张清晰基础壁纸。
  - 首页壁纸和欢迎弹窗问候语统一使用新时间段：05:00-10:59 morning，11:00-16:59 day，17:00-19:59 dusk，20:00-04:59 night。
  - 首页保留 `wallpaper-root` / `wallpaper-stage` 舞台和云、树冠、电视雪花、小女孩、星星、水面光效等 layer DOM/class，供后续新线程继续做动画。
  - 当前所有动画 layer 默认关闭，不显示电视雪花、云、树冠、星星或水面动效；页面只展示四时段静态底图。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260612-static-wallpaper`。
  - 底图与后续动画层会使用同一套 cover 裁切尺寸，避免后续电视雪花等小图层随视口错位。

## 2026-06-11

- 时间、知识库和窗口尺寸整理：
  - 知识库文章发布时间和匿名聊天室消息时间统一按用户所在时区显示，并显示到秒；旧消息/文章会带本机时区名，避免把 UTC 时间误读成本地时间。
  - 从文章详情关闭知识库后会清空当前文章状态，再次打开知识库时回到知识库首页。
  - 关于我窗口改为更紧凑的尺寸；知识库、视频区、资源区、游戏区、杂谈区保持更统一的普通内容窗口大小，匿名聊天室继续使用专用尺寸。
  - 首页中文视频区、资源区、杂谈区三个入口由“施工中”改为“待定”，英文/日文同步改为 TBD / 未定，并放宽桌面图标标题区域以尽量显示完整。
  - 新增网站更新记录文章 `2026-06-11-time-window-library-fix`，同步写入 zh / en / ja 三语 seed；更新 `index.html` 的 CSS / JS query 为 `20260611-time-window-library-fix`。

- 游戏区本地直玩整理：
  - 检查游戏区外部入口后，保留可静态部署到本站的 `2048` 和 `hextris`，并新增 `games/2048/`、`games/hextris/` 本地游戏目录。
  - `2048` 和 `hextris` 均接入统一 `games/game-shell.js` 外壳，支持本地 JSON 导入导出、登录后的云存档同步、站点语言参数启动和移动端界面适配。
  - `games/catalog.json` 收敛为猫国建设者、小黑屋、2048、Hextris 四个本地入口，不再跳转外部站点。
  - 删除游戏区目录中的 Life Restart、修仙类 AI/后端项目、Freeciv-web、OpenTTD 等外部入口展示；这些项目当前需要外部服务、构建链路、后端或原生客户端，不适合直接作为本站静态游戏部署。
  - 更新 `js/main.js` 最近更新记录，并将 `index.html` 的主脚本 query 调整为 `20260611-local-games`，减少线上继续加载旧游戏目录脚本的可能。

- 站点图标统一：
  - 使用桌面“关于我”入口同款电视头像作为统一母版，重新导出顶部标题图标 `lusu-tv-head-64.png`、浏览器图标 `favicon-32.png` 和 `apple-touch-icon.png`。
  - 保持三个资源各自尺寸适配不同场景：标题栏小图标 64px、favicon 32px、移动端收藏图标 180px。
  - 为 favicon、apple touch icon、顶部标题图标以及 CSS / JS 资源引用加入 `20260611-unified-tv-icon` query，减少浏览器继续使用旧图标缓存的可能。

- 视频区双排卡片错位修复：
  - 将视频区专用 `.video-grid` 从 CSS Grid 改为 flex 换行布局，避免第二排卡片被上一排内容高度误伤而插入第一排卡片内部。
  - 桌面端保持三列卡片，中等屏幕改为两列，移动端改为单列，第二排始终从上一排完整卡片下方开始。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260611-video-flex-wrap-fix`，减少线上缓存继续加载旧视频区样式的可能。

- 首页欢迎弹窗最近更新显示修复：
  - 修复最近更新列表项按钮被父级网格压缩到图标列的问题，恢复标题、摘要和日期显示。
  - 为最近更新按钮和文本列补充 `min-width: 0` 与跨列布局，避免小窗口下文字再次被挤没。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260611-welcome-updates-fix`，减少线上缓存继续加载旧样式的可能。

- 桌面“关于我”图标抠图修复：
  - 新增 `assets/images/lusu-tv-head-desktop-icon.png` 作为桌面图标专用头像资源，在右下角保留更大的透明安全边距，避免电视外壳和阴影看起来被裁掉。
  - 将桌面 `.avatar-icon` 改为引用专用图标资源，并保持 `90px` 显示尺寸，保留右侧电视厚度和桌面入口辨识度。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260611-icon-crop-fix`，减少线上缓存继续加载旧图标样式的可能。

- 视频区网格排版修复：
  - 为视频区单独取消通用卡片网格的等分行高，避免“全部”分类下多张视频卡片互相挤占高度。
  - 视频分类只剩一张卡片时不再被强制拉满整个列表区域，保持与多卡片状态一致的自然卡片高度。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260611-video-grid-flow-fix`，减少线上缓存继续加载旧样式的可能。

- 首页、知识库、视频区和聊天室显示修复：
  - 匿名聊天室当天消息只显示时分秒，非当天消息显示日期 + 时间。
  - 知识库删除顶部“返回桌面 / 刷新 / 路径”工具栏，为文章区域释放更多高度。
  - 知识库详情页隐藏左侧分类栏，只在知识库列表首页显示分类。
  - 知识库文章详情的标题、简介和正文合并到同一个阅读面板，避免拆成两个视觉模块。
  - 视频区卡片统一缩略图比例、卡片高度、标题/简介槽位和按钮位置，修复同排大小不一和位置重叠。
  - 首页桌面图标去掉蓝色底框并整体下移，避免图标靠上和显示不全。
  - 首页文案、桌面图标和各板块标题栏禁止鼠标选中，减少误选中文本影响沉浸感。
  - 首页三个建设中入口恢复“施工中 / Developing / 開発中”文案，并保持单行显示。
  - 首页欢迎弹窗最近更新固定显示最近 5 篇 `site-updates` 文章，不再无限拉长或出现内部滚动条。
  - 新增真实网站更新记录文章 `2026-06-11-knowledge-video-home-fix`，一次性写入 zh / en / ja 三语标题、简介和正文。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260611-knowledge-video-home-fix`，减少线上缓存导致的显示不一致。

- 游戏区扩展、文章时间和首页排版修复：
  - 知识库文章列表和详情页的发布时间从日期改为显示到时分秒。
  - 首页欢迎弹窗右侧“最近更新”改为最多显示 4 条，限制列表高度，并在 D1 文章暂不可用时回退到本地更新数组，避免弹窗被长内容撑高。
  - 新增真实网站更新记录文章 `2026-06-11-game-library-time-layout`，一次性写入 zh / en / ja 三语标题、简介和正文。
  - 游戏区新增人生重启模拟器、我的文字修仙全靠刷、修仙世界模拟器、仙途、React 修仙小游戏、万界道友、2048、Hextris、Freeciv-web、OpenTTD 等开源项目入口。
  - 游戏区保留猫国建设者和小黑屋内置入口，并将人生重启模拟器、猫国建设者、小黑屋等多语言支持游戏优先排在最上方。
  - 游戏卡片新增外部开源项目打开能力，显示中文 / English / 日本語支持状态，并随站点语言切换卡片标题和简介。
  - 首页主标题、英文副标题和桌面图标文案缩短，字号和单行显示策略调整，优先保证图标排版。
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260611-game-library-time-layout`，减少线上缓存导致的显示不一致。

- 同步部署与页面显示修复：
  - 更新 `index.html` 中 CSS / JS query 版本为 `20260611-sync-layout-chat`，减少本地已提交但线上浏览器继续加载旧资源导致的显示不一致。
  - 视频区和资源区卡片改为固定缩略图比例、固定按钮高度、固定标题/简介行数和一致网格行高，修复“全部”和分类页卡片错位、拉伸、按钮贴边或不可见的问题。
  - 首页桌面图标中“视频区 / 资源区 / 杂谈区”新增三语“建设中 / Under construction / 工事中”标记，任务栏和窗口标题保持原名称。
  - 小黑屋 `a-dark-room` 新增本站语言覆盖脚本，补齐 Penrose 事件中文和日文缺失文案，避免事件弹窗正文继续回退英文。
  - 知识库 seed 清理三篇测试文章：`xp-site-notes`、`local-ai-workflow`、`fallback-check`；线上请求文章接口时会同步删除 D1 中已有测试数据。
  - 知识库文章详情增加 slug + 请求语言缓存和请求状态保护，避免频繁切换语言后重复拉取并卡在“读取中”。
  - 新增真实网站更新记录文章 `2026-06-11-sync-layout-chat`，一次性写入 zh / en / ja 三语标题、简介和正文。
  - 匿名聊天室轮询改为自适应增量拉取：首次加载最近消息，后续保持 `after/message_id`，有新消息 5 秒刷新，无新消息逐步降到 15 秒和 30 秒，页面后台时降频，用户发送后立即刷新一次。
  - 同步更新 `PROJECT_CONTEXT.md`、项目专用 Skill 和 Skill README，补充部署后必须核对 GitHub main、Cloudflare 最新成功部署 commit、线上 CSS/JS query 版本的规则。

- 收尾并改造网站更新记录：
  - 保留并完善 `/api/saves/:gameId` 未登录和游戏编号校验，未登录时显式返回 JSON 401/400，避免线上返回 Cloudflare 1101。
  - 知识库新增 `site-updates`（网站更新记录）分类，并在分类列表中排在最后。
  - 新增一篇“网站更新记录接入知识库”真实文章，三语写入 zh / en / ja，包含主标题、简介和正文。
  - 首页欢迎弹窗右侧“最近更新”改为自动读取知识库 `site-updates` 分类文章，标题和简介过长时省略，可点击跳转文章详情。
  - 首页欢迎弹窗“查看更多更新”改为跳转知识库并筛选“网站更新记录”分类。
  - 首页欢迎弹窗左侧改为站长施工公告，替换原来的更新介绍区域。
  - 视频区和资源区改进内部滚动、卡片高度、简介行数和按钮间距，避免按钮被长简介挤出或贴边。
  - 文章详情渲染时会去掉与详情标题重复的 Markdown 开头标题，避免标题和简介重复显示。
  - 默认语言改为优先跟随浏览器/系统语言；用户手动切换语言后会保存选择，直到再次切换。
  - 将每次合并/上线必须发布 `site-updates` 三语文章的规则补充到项目专用 Skill 和 README。
- 新增数据库化三语文章系统第一阶段：
  - Cloudflare D1 新增 `articles` 和 `article_translations` 两张文章表，文章通用信息与 zh / en / ja 三语内容分表保存。
  - `users` 表新增 `role` 字段，Pages Functions 启动时会为旧表自动补列；后台文章管理接口仅允许 `role = admin` 的用户访问。
  - 新增公开接口 `GET /api/articles?lang=zh|en|ja` 和 `GET /api/articles/:slug?lang=zh|en|ja`，按当前语言读取文章，缺失时回退到中文，再回退到任意已有语言。
  - 新增基础后台接口 `GET /api/admin/articles`、`POST /api/admin/articles`、`PUT /api/admin/articles/:articleId`、`DELETE /api/admin/articles/:articleId`，不包含自动翻译、翻译按钮或 retranslate 接口。
  - 后台发布文章时要求一次性提供 zh / en / ja 三种内容；正文以 Markdown 保存。
  - 知识库区域改为从 D1 读取文章列表和文章详情，网站切换语言时会重新请求对应语言版本。
  - 前端 Markdown 详情使用安全 DOM 构造和 `textContent` 渲染基础 Markdown，不直接把正文作为未处理 HTML 插入。
  - `cloudflare/schema.sql` 加入三篇测试文章，其中两篇包含完整 zh / en / ja，另一篇仅中文用于验证 fallback。
  - Pages Functions 的文章接口会幂等补入同一批测试文章，避免远端 D1 尚未手动 migration 或边缘运行态已建空表时线上文章列表为空。
  - 更新首页 JS 资源 query 版本号，避免浏览器继续加载旧知识库逻辑。
  - 将数据库化三语文章系统的长期维护规则同步补充到项目专用 Skill 和 README。
  - 为 `/api/saves/:gameId` 增加显式未登录和游戏编号校验响应，避免线上未登录冒烟测试返回 Cloudflare 1101。
- 永久化更新日期和缓存踩坑规则：
  - 右上角“最近更新日期”改为从 `content.updates` 最大日期自动生成，不再依赖手动维护的写死常量。
  - 将 JS / CSS / 强视觉资源变更必须同步更新资源 query 版本号的规则补充到项目专用 Skill 和 README。
- 修复线上更新可见性：
  - 将站点右上角“最近更新日期”同步更新为 `2026.06.11`。
  - 欢迎弹窗的最近更新列表新增游戏区卡片整理记录。
  - 更新首页 CSS / JS 资源版本号，避免浏览器继续加载旧缓存导致线上看起来没有变化。
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
