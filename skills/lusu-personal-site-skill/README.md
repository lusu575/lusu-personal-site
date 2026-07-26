# 鲁肃个人网站专用Skill

## 用途

本目录是鲁肃个人站的项目专用 Skill，用于保存长期维护规则、强约束和踩坑点。新的 AI / Codex 对话在维护 `lusu575/lusu-personal-site` 时，应优先读取：

```text
skills/lusu-personal-site-skill/SKILL.md
```

`PROJECT_CONTEXT.md` 只保留项目总说明和核心事实；具体规则以本 Skill 为准。

## 当前规则清单

- 正式发布仍由 GitHub `main` 触发根目录 Cloudflare Pages；`dist/` 仅用于被忽略的内容哈希生产构建验证，不提交、不替换部署根。缓存必须区分 HTML、哈希资产、未哈希源码与 API/JSON。
- 大图/图集按真实槽位提供 AVIF/WebP 与 fallback，首屏只预加载当前主题和壳；动态主题只挂载当前图层，同路径位图变化仍要更新 query。
- 公共列表请求采用有界 ETag/SWR/LKG，失败保留成功内容且强制重试可绕过新鲜缓存；ETag 覆盖完整公开响应，不能只取数据库行时间等局部种子，同源媒体代理 URL 以内容或行更新时间版本击穿旧缓存。Transfer 使用稳定复合游标、generation、键控 DOM、幂等和背压。旧 D1 必须先补列再建依赖索引。
- 收口时运行统一 release 验证、生产构建复现性和本地 D1 迁移；Headless 不代表真机/完整读屏/线上部署，无外部授权时只报告本地完成。
- 独立 Headless 场景必须以唯一 query 创建新文档并验证 `loaderId`，避免 Hash-only 导航沿用 route 模块和内存缓存；刻意的 SPA History/重试/连续动效流程除外。DOM 断言限定到场景容器，移动窗口背景可延伸到 Dock 后方，真实内容与操作不可被遮挡。
- 账号表单必须保持稳定 DOM；登录/注册、字段错误、忙碌/退出失败、实际触发源焦点归还和移动 44px 关闭必须一起回归。Transfer 未登录态只保留一个上下文登录任务。
- 账号状态检查使用有界超时并在稳定 popover 内原位重试；Chat 只有消息刷新成功后才能标记 online，失败保留 reconnecting 和可聚焦手动重试。密码房切换必须单飞，历史读取失败不能显示 ready。
- 文章阅读只允许正文详情纵向滚动，4px 左右进度轨道与正文零交叠并有三语/ARIA 百分比；Chat 发送不得清空在途新草稿，359×500 保护普通约 177px、私聊至少约 119px及可折叠安全说明。
- Chat 还必须通过 1280×720 短桌面回归：标题、身份／房间两行控制、日志、输入区和页脚都在任务栏上方，只有日志可收缩；字数计数放入输入状态行，媒体几何只写在 `mobile-ios-shell.css`。
- Chat 重试复用稳定 `clientRequestId`，服务端在限流前重放首次成功消息，并用 `(visitor_id, room_key, client_request_id)` 唯一索引防并发重复；私聊随机 IV 不得破坏幂等。旧 D1 必须先补 `client_request_id` 列再建索引。
- 公共 Chat 不返回服务端隐藏 visitor id；密码、私聊、草稿、Secret、完整标识不进入 DOM 泄漏、持久存储、History、日志或 telemetry，外链/iframe/fragment 白名单不得放宽。
- 文章 translation seed 每次都要显式传 UTC ISO 时间；全量 bind 测试必须拒绝 `undefined`。Quick Transfer fragment 只允许同源 `/fragments/quick-transfer.html` 与 Cloudflare clean URL `/fragments/quick-transfer` 两个精确路径。
- 交付本地 Wrangler 预览前先检查 `/api/health`；`.dev.vars` 中两个独立、至少 32 bytes 的本地隐私盐缺失时会让全部 API 返回 503，真实值不得输出或提交。
- PC 任务栏不得用静态 `ONLINE` 冒充服务状态；只有 `/api/health` 的严格健康响应可进入在线态，检查中／异常／离线要有三语文字、独立静态状态灯、键盘重试和隐藏页中止。健康接口只返回 `{ ok, db }`，不公开用户计数。
- 每次修改项目后，必须更新 `CHANGELOG.md`。
- 项目信息变化时，必须更新 `PROJECT_CONTEXT.md`。
- 新增长期注意事项、维护规则、踩坑点时，必须同步补充到本 Skill。
- Skill 规则变化时，必须同步更新本 README。
- 如果改动涉及 `/admin/` 管理后台、后台权限、后台 API、后台统计、后台视频管理、后台社交链接管理、后台聊天室治理或后台专用文档，必须额外先读取 `admin/docs/ADMIN_PROJECT_CONTEXT.md`、`admin/docs/ADMIN_SKILL.md` 和必要时的 `admin/docs/ADMIN_CHANGELOG.md`。
- 桌面端保持 Windows XP + Pixel Art + Y2K，并沿 Neo-XP / Pixel Glass OS 演进；移动端使用原创、受 iOS 交互启发的虚拟手机 OS，不能只压缩桌面 XP 布局。
- 可见文案必须维护中文 / English / 日本語。
- 临时互传固定放在工具区（内部 `resources` route）并复用现有登录；手机非 Home 的 Tools App 必须能直接到达登录，短屏、横屏和软键盘状态下消息、任务与输入区都要可达。手机房间只保留一个滚动容器，composer 必须处于正常文档流，不能以 sticky / fixed 层覆盖已发送卡片；仅改成 static 不足以避免 Grid 轨道视觉溢出，竖屏房间使用纵向 Flex 且直接子项必须不可收缩，短横屏再显式恢复双栏 Grid，并验证 composer 与图片/文件卡的二维交集为零。普通账号受 95 MiB、个人/房间/频率和全站免费池限制，只有 D1 admin 可用 R2 Multipart 大文件。24 小时过期、私有 R2、清理 Worker 和 Dashboard 人工绑定规则见 `docs/transfer/README.md`。
- Quick Transfer 只能称文字为浏览器 AES-GCM 加密；图片、视频和文件不使用房间口令加密，只由 HTTPS、私有 R2 与服务端鉴权保护，且不做病毒／恶意软件扫描。明文口令不发服务器，配额按滚动 24 小时描述，公开卡片、房间提示和历史 seed 不得扩大安全承诺。
- 工具区同列表工具卡必须共享网格宽度和卡片高度节奏；zh/en/ja 的标题、元信息、说明与 CTA 不得相交或被 `nowrap`、隐藏滚动条、裁剪吞掉。
- Knowledge 使用 NFKC 多词 AND 搜索，并在搜索／筛选时复位真实滚动和 History；Videos／工具区（内部 `resources` route）重建分类按钮后恢复同一焦点，空视频分类优先提供“显示全部”。首屏只接受 zh／en／ja 并尽早设置文档语言，文章 fallback 标注实际内容语言。
- 手机工具区卡片完整显示说明并分离事实、标签和 44px CTA；Games 卡直接显示全部语言支持，简介最多三行，许可／来源使用至少 44px 的原生展开控件，后台刷新失败时明确保留的是缓存目录。
- 五游戏共享壳固定为一个 `100dvh` 网格，外层不滚动，iframe 使用剩余空间；359×500、390×844、844×390 必须测量外层滚动、iframe 可达性以及返回／存档控件 44px 热区。
- 上游游戏嵌入后不能保留固定桌面宽度、第三方统计、原站账号、localhost 开发桥接或未使用主题的外部字体请求；窄屏必须满足 `scrollWidth <= clientWidth`。A Dark Room 声音提示维护三语，且横竖屏切换后重算滑轨与资源面板；Kittens Game 关闭 Google Analytics、KGNet 与 `localhost:7780`，只按需加载当前主题并同步 iframe 文档语言，窄屏顶部工具栏自然换为两行且 Steam／Version 不裁切，全部可见关键控件保持至少 44px，但本站 localStorage、JSON 备份和账号云存档必须继续可用。
- Life Restart 只在粗指针运行时采用移动几何：主操作和所有可见 `btn*` hitArea 至少 44px，竖屏将工具与主流程分离，短横屏把工具放到底部横排；细指针桌面几何保持上游原样。升级上游后必须分别复测粗指针竖屏、粗指针短横屏和细指针桌面，不得用全局缩放掩盖命中区不足。
- Quick Transfer 洋红键源图不能直接作为生产 atlas；使用项目构建脚本生成 168×168 RGBA 透明图集，并用 alpha、整体透明率和 16 个 sprite 单元角点/像素比例守卫整张图集。同一 Sharp / libvips 运行时双次构建要求字节一致，跨 Windows / Linux 则解码 RGBA 做严格像素差比较，不比较平台相关的 PNG 压缩流。工具区（`resources`）打开再关闭 Transfer 必须恢复原分类栏与列表 hidden 状态，不能显示空工具条。
- Windows 窄屏截图不要信任直接 Chrome `--window-size`；系统可能钳制到约 500 CSS px。移动验收必须使用 CDP 精确 viewport，先校验 layout/visual viewport，再判断 359×500、375×667、390×844、760×900、844×390 的排版。Windows Headless 保存截图时先预热捕获、等待双 `requestAnimationFrame`，再保存第二张 `fromSurface: true`；`fromSurface: false` 可能空白，单帧可能漏掉固定顶栏或 Dock，必须逐图确认。
- 本地建议 Node.js 22.13+；同名 API 变量使用 Git 忽略的 `.dev.vars` 和独立本地值，绝不提交 `.dev.vars`、`.env`、真实邮箱、Webhook 或密钥。
- 改首页、窗口、任务栏、图标、弹窗、游戏外壳等前端内容时，必须检查手机端适配。
- 移动 QA 不能只看父容器 overflow：固定复测 359×500、375×667、390×844、430×932、844×390，并测量子项交叠、输入可达性和 Chat 日志容量。359×500 普通房日志可读区至少 160px，私聊展开至少 115px 或提供可折叠工具区，844×390 至少 150px；安全说明、反馈、输入和 Dock 必须同时可达。文章首屏在 359×500、390×844、844×390 必须分别保留至少 44px、200px、44px 正文可见量，第一段至少显示 20px，阅读侧栏 computed min-height 不大于 1px。旧 260px 短竖屏目标已由 2026-07-17 精确截图审计证明不适合作为固定门槛。
- 公开主站的 window resize 与 VisualViewport resize / scroll 只能由 `window.LusuFramePipeline` 原生监听并产生唯一 viewport 模型；新增消费者使用 keyed measure/mutate、viewport 订阅或共享聚焦显示请求。功能模块与 Transfer 不得新建私有 `visualViewport` / resize 监听或聚焦滚动逻辑。性能档固定为 normal / low：Save-Data 或明确不超过 2 核 / 2GiB 才进入 low，未知能力保持 normal；low 使用实色高对比回退并停止大面积绘制效果，normal 档视觉不变。page scale 不得误判为软键盘。
- 公开主站使用 ESM 模块图：`js/main.js` 只做 composition，`js/core/` 提供无业务副作用的核心能力，`js/data/` 提供静态内容，`js/features/` 提供跨路由功能，`js/routes/` 提供路由域。route 模块不得导入入口或兄弟 route，也不得在顶层查询 DOM、请求网络或启动 timer；改动后运行 `npm.cmd run check:public-modules`。
- Home 只静态加载五条无正文更新摘要；五个业务 route JS 与四个 route paint CSS 首次进入时单飞加载并常驻复用，移动几何继续只放 `mobile-ios-shell.css`。懒加载 route CSS 固定插在 `link[data-mobile-shell-style]` 之前，维持基础 → route → mobile → motion 的级联顺序，不能 append 到末尾重新覆盖移动几何。Home、顶栏、任务栏或 Dock 在进入 route 前已可见的图标规则必须放始终加载的主 CSS，不得依赖 route CSS；冷启动 Home 要检查背景图与真实图片解码。Quick Transfer loader/CSS/client/fragment 只允许在工具区的真实 CTA 点击后请求，点击前不得出现完整 DOM、全局 facade、API 或轮询。
- 匿名聊天室只保留 `assets/images/icon-chatroom.png` 这一张 96×96 RGBA 规范资源，Home、标题栏、任务栏／Dock、欢迎快捷入口和聊天头像全部共用；不要恢复 `icon-chatroom-clean.png` / `icon-chatroom-desktop.png` 双资源。18–54px 小槽位继续使用 contain，不额外放大。
- 固定移动壳不解锁整页滚动；非 Home 活动 App 用含 route ID 的规则保留按需纵向逃生通道，文章详情仍是唯一阅读 owner。聚焦恢复必须通过唯一帧管线，保留当前焦点与输入，且只修改最近真实内部 owner 的 `scrollTop`，不移动 document、Home、Appbar 或 Dock。账号面板延迟 autofocus 不得覆盖面板内已有焦点。
- 软键盘打开只临时隐藏 Dock，不改写用户的 expanded / collapsed 状态。用户主动收起 Dock 时，滚动区必须同步 inert、aria-hidden 和视觉隐藏，并把已有焦点移到展开按钮；opacity / pointer-events 不能替代可访问性隐藏。文章回顶激活后把焦点交给标题，目录正文使用文章实际语言、目录导航标签保留界面语言，带按钮的横向容器不能再增加空白 Tab 停靠点。CDP 高度、缩放或 safe-area 代理只是几何回归，不得宣称真实软键盘、safe area 或浏览器 chrome 已验证；真机标志在未完成真机实测前保持 false。Headless 焦点审计先执行 CDP `Page.bringToFront`，避免未激活页只改 `activeElement` 却不触发 focus 事件。
- 页面 route、App 打开和移动 tab 只动画当前页面/窗口表面，不使用会覆盖固定顶栏、任务栏或 Dock 的整页 View Transition。full motion 审计需要采集起始、60ms、140ms 和稳定帧，检查 Dock 节点身份、几何、透明度与 40ms 快速连续切换的最终路由。
- motion off 必须同步停止硬编码过渡、Dock smooth scroll／选中滑动、骨架循环与主题快照；disabled / aria-disabled / inert 控件不播放按压反馈，maximize/restore 以真实几何做 FLIP。视频缩略图保持原生 16:9 button，不恢复遮图播放圆圈；播放器超时按 generation + settled 收口，失败卡并排提供重试与原视频，统一 `.content-state` 和重试焦点。
- “日语的言外之意 / Behind the Japanese / 日本語の裏側”位于 `tools/japanese-subtext/`，固定采用版本化分批 JSON 和不可随意变更的关卡 ID；每次公开应用更新增加 `appVersion`，只有题库结构或存档兼容边界变化时才增加 `contentVersion`，改关另增 `revision`，完整流程见 `tools/japanese-subtext/MAINTENANCE.md`。
- 题库、音频 manifest 与时间轴必须同步并分别验证；日语先使用审校读音，再进入 G2P/Kokoro。Misaki 音素与音高标记必须分离，完整 P2R 要保持 `j → y` 早于 `ʥ → j`，未知或超长音素必须失败关闭。每关 source hash、cue、reading/phoneme hash、实际 CPU provider、模型/运行时 provenance、输出参数和发音表 canonical SHA-256 必须一致；发布前做全量音素复算、ffprobe、SHA-256、孤儿文件和静音检测。模型只作离线批处理，结束后关闭，不安装服务或自启动。
- 声线必须来源和许可清晰；保留 `NOTICE-japanese-voices.md` 与设置面板三语署名链接，不使用来源不明或模仿受保护动漫角色的声线。
- 工具学习进度使用独立 D1 表，不得与游戏存档混用；跨设备合并必须保留已通关记录的首次通关模式。所有题库字符串安全渲染，图片只来自本工具资产目录，音频只从 manifest 解析。
- 日语工具错答后必须在题面与解析顶部保留重新答题入口；结果弹窗不能通过关闭、Escape 或外侧点击留下已提交死路，下一关只按本次答题是否通过判断。
- 日语工具每关配图使用映射 setting、人物、台词、题问和道具的原创黑白四格漫画，统一线条、网点、边框和 4:3 画幅；图片 manifest 必须锁定 960×720、SHA-256、生成器和审查状态。imagegen 不可用时允许明确标注的本地原创 fallback，但不能冒充 AI 逐图产物。
- 发布日语工具前必须通过题库、真实音频、自动测试、主站构建和 359×500 / 375×667 / 390×844 / 844×390 / 1365×900 五视口回归，并同步文档、Skill、缓存版本与唯一三语更新记录。
- 首页四时段壁纸基础图放在 `assets/images/wallpapers/`；时间段统一为 05:00-10:59 morning、11:00-16:59 day、17:00-19:59 dusk、20:00-04:59 night。
- 首页保留 `wallpaper-root` / `wallpaper-stage` 舞台坐标结构和动画 layer DOM/class；当前 morning / day / dusk / night 四时段均已启用无云底图 + 独立云层的动态云层。
- 顶部栏和底部任务栏跟随同一套 `body[data-time-theme]` 四时段主题；维护顶部栏、任务栏、Start、任务按钮、账号入口、语言切换或状态托盘时，必须同时检查四套外观，保持无竖线的现代玻璃像素 HUD 方向，并保留现有图标资源。
- PC 端活动任务按钮保留蓝色按下态与内凹层级，但不使用黄色底边、黄色外描边或常亮光晕；键盘 `:focus-visible` 焦点环和移动 Dock 的选中底板保持不变。
- 维护右上角账号入口、语言切换或其他顶栏浮层时，必须同时检查 `.xp-topbar` 的裁剪行为和 `.site-shell > header` / `.site-shell > main` 的 stacking context；账号弹窗必须能从按钮下方溢出显示，且 `header` 必须高于 `main`，否则首页会像点了没反应、其他栏目会被窗口遮挡。
- 每次改动都必须写记录并更新日期：至少更新 `CHANGELOG.md`；公开可见更新还必须补 `PROJECT_CONTEXT.md`、`content.updates`、`site-updates` 三语记录、相关 seed 和资源 query，确保首页最近更新日期真的变化。
- 底部任务栏必须固定贴合浏览器视口下沿，窗口高度、页面 padding、文章阅读浮层和移动端断点都要为它预留空间，避免导航被顶下去或盖住正常窗口。
- 手机文章回顶等控制放在 Appbar 可见区域时，要验证真实触控命中层：顶栏空白层不能拦截控制，返回、复制、账号等真实控件仍需可操作。
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
- GPTWork / 全新克隆开发固定使用 Node.js 22.13+、`npm ci`、仓库 lockfile 和本地 D1；纯本地环境使用 `.env.example` -> `.dev.vars`，GPTWork 使用 process Secrets 且不创建 `.dev.vars`。不得依赖固定盘符、父目录依赖、本机全局工具或生产数据库。
- Cloudflare Preview 与 Production 都必须检查 D1 binding `DB`，并分别配置独立、随机、至少 32 字节且不能相同的 `CHAT_IP_HASH_SALT` 和 `ANALYTICS_IP_HASH_SALT`；不得提交真实值、固定 fallback 或跨用途复用。
- IP hash 使用按 `chat` / `analytics` 隔离的 HMAC-SHA256。聊天消息和网络来源禁言带非敏感密钥代次；Secret 轮换后旧消息只供审计、旧网络禁言标记失效，服务端拒绝从旧代次新建禁言。
- 普通 CI / GPTWork 不需要 Cloudflare API Token、生产 D1 权限、本机 TTS 配置、模型权重或参考声线；`output/`、Wrangler 状态、依赖和本地 TTS 配置均不得提交。
- 项目没有真实 lint / typecheck 工具链时应明确标为“未配置”，不能增加空的成功占位；迁移清单见 `docs/GPTWORK_MIGRATION_READINESS.md`。
- 后续新增游戏时，必须在游戏标签或信息里标明中文、English、日本語是否支持。
- 游戏云存档 PUT 必须携带精确 `expectedUpdatedAt`，服务端以原子 insert-only／条件 update 实施 CAS 并在未命中时返回 `409 + SAVE_CONFLICT`。云版本基线必须保存在标签页级 `sessionStorage`，不得与游戏存档共用跨标签页 `localStorage`。发现较新云存档后，客户端先锁住计时、隐藏页、退出、导入和手动同步等全部上传路径；三语冲突窗应允许先下载本地备份，任何显式覆盖仍受 CAS 保护，“恢复云端”也要先重新 GET 并拒绝过时快照。
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
- 纯后台私有更新不写入主站 `site-updates`；如果后台改动同时改变主站公开可见体验，公开侧仍要补三语网站更新文章、schema seed 和 `js/data/content.mjs` fallback。
- 后台与埋点关键文件包括 `admin/index.html`、`admin/admin.css`、`admin/admin.js`、`functions/admin/_middleware.js`、`functions/api/[[route]].js`、`js/telemetry.js` 和 `cloudflare/schema.sql`。
- 后台视频封面可使用平台图片 URL，或选择 JPG、PNG、WEBP、AVIF 本地图片压缩为受限 `data:image`；本地视频首帧只用于生成封面，不代表支持本地视频托管或放宽视频链接白名单。
- 主站访问/点击埋点使用独立 `js/telemetry.js`；不得记录输入框内容、密码、未发送聊天内容或文章草稿；点击目标文本、页面路径、来源、链接、元素标识和点击聚合键中的邮箱样式文本（含 URL 编码和双重编码形态）必须在前端和服务端写入前脱敏。
- 文章访问 PV/UV 使用服务端 `GET /api/articles/:slug` 写入 `article_view_events`，后台单篇文章统计以该表为准，不要只依赖前端页面级 PV。
- 后台访客识别使用 HttpOnly `lusu_visitor` 隐藏 ID，不在前台 UI 或公开 API 中展示；聊天室后台禁言使用隐藏 visitor_id 或 IP hash。
- IP 信息只保存 hash、掩码前缀和 Cloudflare 来源地字段，不向普通前台暴露完整明文 IP。
- 文章发布时间和聊天室消息时间必须按用户所在时区显示；文章发布时间不显示时区名，后端时间保持 ISO/UTC 语义，前端再转换到用户本机时区；后台文章编辑器显示管理员本地时间，保存时转换为 UTC ISO，后端再次规范化 `published_at`。
- 从知识库文章详情关闭窗口或返回桌面后，再次打开知识库应回到知识库首页。
- 每次合并代码、上线功能或做可见更新时，必须在知识库 `site-updates`（网站更新记录）分类发布一篇 zh / en / ja 三语真实文章，包含主标题、简短简介和正文。
- `site-updates` 只按发布时间展示，永远不置顶；后台、seed、schema、fallback 和知识库排序都必须把该分类保持为 `is_pinned = 0`，旧缓存中的错误置顶值也不能显示标记。
- 这条是合并前验收门槛；如果不能通过后台发布，也要在同一次变更中补齐 seed 与 fallback，确认知识库、欢迎弹窗最近更新和右上角最新日期能读到本次更新。
- 通过 seed 维护网站更新记录时，必须同步 `functions/api/[[route]].js`、`cloudflare/schema.sql`、`js/data/content.mjs` 的完整 fallback，以及 `js/data/home-content.mjs` 的最近五条无正文 Home 摘要投影。
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
