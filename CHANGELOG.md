# CHANGELOG.md

本文件记录鲁肃个人站的功能、界面、后端、部署与项目约定变更。每次修改项目后都应同步更新这里，方便后续 AI / Codex 对话快速了解最近改动。

## 2026-06-18

- 管理后台聊天筛选切换防护：聊天室保存、隐藏、删除或禁言操作进行中会临时禁用“显示隐藏”筛选，避免慢请求期间刷新消息列表导致当前选中记录丢失；同步更新后台私有更新记录和后台 JS query。

- 管理后台聊天治理期间切换防护：聊天室保存、隐藏、删除或禁言操作进行中会临时禁用消息列表，避免慢请求期间切换消息造成表单与处理对象错位；同步更新后台私有更新记录和后台 JS query。

- 管理后台账号保存期间切换防护：账号邮箱、角色或密码重置保存进行中会临时禁用账号列表，避免慢请求期间切换账号造成表单与提交对象错位；同步更新后台私有更新记录和后台 JS query。
- 管理后台视频分类写入期间切换防护：视频分类保存或删除进行中会临时禁用分类列表和新建按钮，避免慢请求期间切换分类造成表单与提交对象错位；同步更新后台私有更新记录和后台 JS query。
- 管理后台视频写入期间切换防护：视频保存或删除进行中会临时禁用视频列表和新建按钮，避免慢请求期间切换视频造成表单与提交对象错位；同步更新后台私有更新记录和后台 JS query。
- 管理后台文章写入期间切换防护：知识库文章保存或删除进行中会临时禁用文章列表和新建按钮，避免慢请求期间切换文章造成表单与提交对象错位；同步更新后台私有更新记录和后台 JS query。
- 管理后台文章详情读取失败防护：
  - `/admin/` 知识库文章选择后会清空旧编辑表单；详情未成功读取前禁用保存、发布和删除，接口失败时显示明确原因，减少旧文章内容误提交风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。
- 管理后台账号详情读取失败提示优化：
  - `/admin/` 账号管理在详情读取失败时会清空旧详情并显示明确失败原因；详情未成功读取前不允许保存账号，减少快速切换或接口失败时误提交旧表单的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。
- 管理后台 HTML 字符串 helper 清理：
  - `/admin/` 脚本移除已无调用的字符串 HTML helper，保留 DOM/textContent 渲染路径，减少后续维护误用拼接 HTML 的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台账号邮箱输入体验优化：
  - `/admin/` 账号管理邮箱输入框补充 email 键盘提示，并关闭自动大写和拼写检查，减少移动端账号编辑误输入。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台视频分类占用状态提示：
  - `/admin/` 视频分类列表对已有视频使用的分类显示“占用中”标签，帮助管理员点击前判断哪些分类不能直接删除。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台视频分类删除状态优化：
  - `/admin/` 选中仍有视频使用的分类时会直接禁用删除按钮，并提示先取消关联，减少视频分类管理里的无效删除操作。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台视频封面预览加载优化：
  - `/admin/` 视频封面预览图增加异步解码和 no-referrer，减少大图预览阻塞并避免向外部封面域名携带后台页面来源。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台输入键盘提示优化：
  - `/admin/` 的文章 slug、视频链接、封面地址和视频分类 slug 输入框补充移动端 URL 键盘提示，并关闭自动大写与拼写纠正，减少粘贴链接或 slug 时被输入法改写。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台视频链接 HTTPS 校验收紧：
  - 后台视频解析链路只接受 HTTPS 的 YouTube、Bilibili 和 b23.tv 地址；裸 Bilibili BV 号仍会由服务端规范化为 HTTPS 来源。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台 Bilibili BV 号校验收紧：
  - 后台视频解析链路只接受 `BV` 开头、总长 12 位的标准 Bilibili BV 号，避免超长或伪造 BV 号生成不规范的播放器地址。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台 YouTube 视频 ID 校验收紧：
  - `/api/admin/videos/preview-url` 等后台视频解析链路只接受 11 位 YouTube 标准 videoId，避免过短或伪造 ID 生成不规范的嵌入地址。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台来源 IP 头规范化：
  - 访问统计和聊天室记录请求来源时会清理 `CF-Connecting-IP` 与 `x-forwarded-for` 首段空白值，减少同一来源因请求头空格被拆分为不同哈希或掩码的情况。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台 Bilibili 页码解析修复：
  - 后台视频链接解析遇到异常 Bilibili `p` / `page` 页码时回落为第 1 页，并将有效页码限制在 1-99，避免播放器地址出现 `page=NaN`。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台 IPv4 来源掩码范围校验：
  - 访问统计和聊天室来源生成 IPv4 `/24` 掩码前，会校验四个地址段都在 0 到 255 之间，避免无效来源写入统计和审计字段。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台 IPv6 来源前缀规范化：
  - 访问统计和聊天室来源的 IPv6 掩码生成改为展开地址后保留前四段并输出规范 `/64` 前缀，避免压缩 IPv6 地址生成不规范审计前缀。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台禁言 IPv4 前缀范围校验：
  - `/api/admin/chat/bans` 的 IPv4 `/24` 前缀校验继续收紧，每个地址段必须在 0 到 255 之间，避免无效掩码前缀写入审计记录。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台禁言 IP 前缀脱敏校验：
  - `/api/admin/chat/bans` 新增 IP 前缀格式复查，只允许保存 `/24` 或 `/64` 掩码前缀，避免完整 IP 或任意文本进入禁言审计记录。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台账号密码状态脱敏优化：
  - `/api/admin/accounts` 和 `/api/admin/accounts/:userId` 改为只读取密码加密状态标记，不再在账号列表和详情处理链路中选择原始密码哈希字段。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台 KPI 卡片渲染安全优化：
  - `/admin/` 实时大屏 KPI 卡片改用 DOM API 与 `textContent` 渲染标题、数值和说明，移除后台脚本最后一处动态面板 HTML 字符串拼接。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台账号摘要渲染安全优化：
  - `/admin/` 账号管理顶部摘要改用 DOM API 与 `textContent` 渲染注册账号数、管理员数和活跃会话数，减少统计文案 HTML 拼接。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台趋势图渲染性能优化：
  - `/admin/` 实时大屏每日和小时趋势图改用 DOM API 渲染柱体、标签和 tooltip，减少整块 HTML 字符串重绘。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台访问来源地图渲染安全优化：
  - `/admin/` 访问来源地图点位改用 DOM API、`textContent`、`style` 和 `title` 属性渲染，减少来源地字段被误当作 HTML 的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台访问来源表格渲染安全优化：
  - `/admin/` 访问来源的国家、地区、城市和 IP 掩码前缀表格改用 DOM API 与 `textContent` 渲染，减少来源字段被误当作 HTML 的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台热门内容表格渲染安全优化：
  - `/admin/` 实时大屏的热门页面和热门文章表格改用 DOM API 与 `textContent` 渲染，减少路径、route、文章标题、slug 和分类被误当作 HTML 的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台点击埋点列表渲染安全优化：
  - `/admin/` 点击埋点的热点目标表格和最近点击事件改用 DOM API 与 `textContent` 渲染，减少路径、目标文本和来源字段被误当作 HTML 的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台视频分类列表渲染安全优化：
  - `/admin/` 视频分类管理列表的分类名、slug、启用状态、视频数量和排序改用 DOM API 与 `textContent` 渲染，减少分类字段被误当作 HTML 的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台视频分类勾选渲染安全优化：
  - `/admin/` 视频编辑表单里的分类勾选项改用 DOM API 与 `textContent` 渲染，减少分类名称被误当作 HTML 的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台视频列表渲染安全优化：
  - `/admin/` 视频管理列表的标题、平台、排序、作者、发布时间和元数据错误改用 DOM API 与 `textContent` 渲染，减少视频字段被误当作 HTML 的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台知识库文章列表渲染安全优化：
  - `/admin/` 知识库文章列表的 slug、状态、分类、语种数量和 PV/UV 摘要改用 DOM API 与 `textContent` 渲染，减少文章字段被误当作 HTML 的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台账号详情列表渲染安全优化：
  - `/admin/` 账号管理的登录履历、近期活跃和会话状态改用 DOM API 与 `textContent` 渲染，减少登录来源、路径或设备摘要被误当作 HTML 的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台账号列表渲染安全优化：
  - `/admin/` 账号管理列表的邮箱、角色、密码状态、活跃会话和登录摘要改用 DOM API 与 `textContent` 渲染，减少账号字段被误当作 HTML 的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台聊天室消息列表渲染安全优化：
  - `/admin/` 聊天室管理的昵称、消息摘要、可见状态和来源徽标改用 DOM API 与 `textContent` 渲染，减少聊天内容被误当作 HTML 的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台聊天室禁言列表渲染安全优化：
  - `/admin/` 聊天室管理的禁言状态、类型、对象、原因、时间和停用按钮改用 DOM API 与 `textContent` 渲染，减少禁言审计字段被误当作 HTML 的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台聊天室元信息渲染安全优化：
  - `/admin/` 聊天室管理的隐藏用户 ID、client id、IP hash、IP 前缀和来源信息改用 DOM API 与 `textContent` 渲染，减少审计字段被误当作 HTML 的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台更新记录渲染安全优化：
  - `/admin/` 后台更新记录改用 DOM API 和 `textContent` 渲染，减少维护时误把后台私有更新文案当作 HTML 执行的风险。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台表单状态换行稳定性优化：
  - `/admin/` 文章、视频、视频分类和账号表单状态提示增加弹性宽度与换行约束，长错误文案在桌面和移动端都不再挤压按钮。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台表单状态可访问性优化：
  - `/admin/` 文章、视频、视频分类和账号表单状态提示补充礼貌 live region 语义，让保存、删除和错误提示更容易被辅助技术感知。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台聊天室禁言列表忙碌态优化：
  - `/admin/` 禁言列表刷新和停用禁言时会显示“刷新中...”或“停用中...”，并临时禁用列表操作，减少重复请求。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台聊天室禁言按钮忙碌态优化：
  - `/admin/` 聊天室管理按隐藏用户 ID 或 IP 来源禁言时会临时禁用治理按钮，并显示“禁言中...”，减少重复禁言请求。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台聊天室治理按钮忙碌态优化：
  - `/admin/` 聊天室管理保存修改、隐藏/恢复或删除消息时会临时禁用治理按钮，并显示对应忙碌文案，减少重复提交。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台视频删除防重复操作优化：
  - `/admin/` 视频管理删除请求进行中会临时禁用保存、发布和删除按钮，并显示“删除中...”，减少重复删除操作。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台文章删除防重复操作优化：
  - `/admin/` 知识库文章删除请求进行中会临时禁用保存、发布和删除按钮，并显示“删除中...”，减少重复删除操作。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台视频分类保存删除防重复操作优化：
  - `/admin/` 视频分类管理保存或删除分类时会临时禁用保存、删除按钮，并显示“保存中...”或“删除中...”，减少重复分类变更。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台文章保存防重复提交优化：
  - `/admin/` 知识库文章保存或保存并发布时会临时禁用保存、发布和删除按钮，并显示“保存中...”或“发布中...”，减少重复文章写入，同时保留保存成功提示。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台视频保存防重复提交优化：
  - `/admin/` 视频管理保存或保存并发布时会临时禁用保存、发布和删除按钮，并显示“保存中...”或“发布中...”，减少重复视频写入，同时保留保存成功提示。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台视频元数据按钮忙碌态优化：
  - `/admin/` 视频管理在识别链接或刷新元数据时会临时禁用相关按钮并显示忙碌文案，减少重复外部元数据请求。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台账号保存防重复提交优化：
  - `/admin/` 账号管理保存时会临时禁用按钮并显示“保存中...”，未选择账号时不能提交，减少重复角色修改或密码重置。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台聊天室治理操作状态优化：
  - `/admin/` 聊天室管理在未选择记录时会禁用保存、隐藏、删除和禁言操作，选择记录后再恢复可用，减少误点和空操作。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台顶部状态文本换行优化：
  - `/admin/` 顶部状态提示增加宽度和换行约束，长错误文案在窄屏或中等宽度窗口下不会挤压刷新、退出按钮。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台退出中手动刷新防护：
  - `/admin/` 退出流程开始后会禁用顶部“刷新”按钮并拦截手动刷新入口，避免退出挂起时继续触发后台统计请求；退出失败后恢复原状态，并短暂保留错误提示。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台退出中暂停自动刷新：
  - `/admin/` 退出流程开始后会暂停 30 秒自动刷新，避免退出请求挂起时继续发送统计面板请求；退出失败后恢复自动刷新。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台导航当前项语义优化：
  - `/admin/` 侧边栏当前标签会同步 `aria-current="page"`，切换标签时自动更新，提升键盘浏览和辅助技术识别当前模块的准确性。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台退出按钮防连点优化：
  - `/admin/` 点击退出后会临时禁用按钮并显示“退出中...”，避免慢网络或连续点击时重复提交登出请求；失败时恢复按钮并显示错误。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台刷新状态可访问性优化：
  - `/admin/` 顶部刷新状态改为辅助技术可感知的 live status，刷新按钮会随当前标签、读取中和无需刷新状态更新无障碍说明。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台标签页记忆优化：
  - `/admin/` 会在当前浏览器会话中记住最后打开的后台标签页，刷新后回到上次工作位置；本地记忆值异常时回退到实时大屏。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台静态面板刷新状态优化：
  - `/admin/` 的后台更新记录和后台说明属于本地静态内容，进入后顶部刷新按钮显示“无需刷新”并禁用，减少无效点击和状态误解。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台自动刷新可见性优化：
  - `/admin/` 实时大屏、访问来源和点击埋点的 30 秒自动刷新会在页面隐藏时暂停，回到前台后再补一次刷新，减少后台标签页长期打开时的无效请求。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台刷新忙碌状态优化：
  - `/admin/` 面板数据读取中会禁用顶部“刷新”按钮并显示“刷新中...”，请求结束或失败后自动恢复，降低重复点击和状态误判。
  - 后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台面板请求合并优化：
  - `/admin/` 同一标签页数据正在读取时，快速切换或连续点击刷新会复用当前请求，减少重复后台请求和无意义重渲染。
  - 请求失败后仍会释放读取状态，保留后续切换或手动刷新重试能力；后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

## 2026-06-17

- 管理后台凭据表单语义优化：
  - `/admin/` 登录页和账号重置密码表单的邮箱输入保留邮箱格式校验，同时补齐标准 `username` 自动填充语义，减少浏览器表单提示。
  - 后台登录流程、账号保存流程、静态资源权限和 `/api/admin/*` 服务端权限校验不变；后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台首屏加载优化：
  - `/admin/` 初始化改为只读取管理员身份和当前实时大屏数据，文章、视频、聊天室、禁言和账号资料进入对应后台标签页时再按需加载。
  - 后台手动刷新改为刷新当前标签页数据；30 秒自动刷新只保留在实时大屏、访问来源和点击埋点统计面板内。
  - 更新 `admin/index.html` 的后台 JS query 为 `20260617-lazy-panel-load`，减少线上继续加载旧后台脚本的概率；后台私有细节记录在 `admin/docs/ADMIN_CHANGELOG.md`。

## 2026-06-16

- 视频卡片与分类持久化修复：
  - 主站视频卡片从 520px 收紧到 424px，封面区、正文行距和播放按钮间距同步压缩，减少图文信息下方的大块空白，同时保留标题、简介、来源/时间和播放按钮。
  - 视频分类默认 seed 改为首次建表初始化；已有 `video_categories` 表会写入 `site_runtime_state` 状态标记，之后后台删除默认标签或修改排序都不会被运行时 schema guard 自动补回。
  - `cloudflare/schema.sql` 同步增加 `site_runtime_state` 并让默认视频分类只在空库首次初始化，减少手动 migration 复原后台维护结果的风险；旧库缺 `pinned_sort_order` 时，相关队列索引继续交给运行时 guard 补列后创建，避免手动 schema 卡住。
  - 首页匿名聊天室桌面图标略微缩小并增加与名称的间距，避免图标底部和文字贴在一起。
  - `npm.cmd run build` 的运行时检查新增 `/api/videos?lang=zh` 路径，覆盖视频 schema guard；更新 `index.html` 的 CSS / JS query 为 `20260616-video-card-category-icon-fixes`、`admin/index.html` 的后台 JS query 为 `20260616-video-category-seed-state`，并新增同名三语 `site-updates` 更新文章。

- 视频区窗口自适应放大：
  - 主站视频区列表窗口从固定 760px 高度上限改为跟随浏览器可用高度计算，减少大屏桌面底部空白，能露出更多视频卡片。
  - 桌面端视频窗口宽度小幅放大到更适合宽屏的范围，保留三列卡片、分类筛选和内部滚动逻辑。
  - 手机端继续走既有小屏断点，保持单列视频列表、防横向溢出和弹窗安全高度。
  - 更新 `index.html` 的 CSS / JS query 为 `20260616-responsive-video-window`，并新增 `seed-update-2026-06-16-responsive-video-window` 三语 `site-updates` 更新文章，同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。

- 后台视频置顶排序修复：
  - `videos` 新增独立 `pinned_sort_order`，置顶视频进入单独队列并始终排在未置顶视频之前。
  - 公开视频和后台视频列表统一按置顶优先、置顶排序从大到小、普通排序从大到小展示；旧库新增字段时会把已置顶视频的普通排序回填为置顶排序。
  - 后台视频表单新增“置顶排序”，列表徽章显示置顶排序值，勾选置顶时可自动补入当前置顶队列的下一个排序值。

- 后台视频封面上传增强：
  - 视频管理支持选择本地 JPG、PNG、WEBP、AVIF 图片作为封面，浏览器端会压缩裁切为 16:9 封面数据后写入现有 `thumbnail_url` 字段。
  - 新增“从本地视频截首帧”能力；当封面为空且已选择本地视频文件时，保存前会自动截取第一帧作为封面。
  - 后端封面校验继续限制 YouTube / Bilibili 图片域名，同时新增受限 `data:image` 封面白名单和大小上限，避免 SVG/HTML 或过大封面写入。

- 移动端与后台视频维护修复：
  - 默认视频分类 seed 改为只插入缺失分类，不再覆盖后台维护过的 slug、中文名、英文名、日文名、排序和启用状态，修复“AI实验”改名后又被还原的问题。
  - Bilibili 元数据抓取移除不必要的 `Origin` 请求头，增加详情接口、移动页、`__NEXT_DATA__`、页面标题和更多 meta 兜底；保存已有视频且 URL 未变化时不再重复抓取外部元数据。
  - 后台视频识别失败时会说明播放器地址已生成、标题/作者/封面可手动补全；新增重复视频拦截，并在分类勾选区标出停用分类。
  - 主站视频列表、视频播放窗口、资源区筛选、登录弹窗和登录成功账号弹窗补强手机端换行、单列、宽度和防溢出规则，尽量不影响桌面端布局。
  - 新增 `seed-update-2026-06-16-mobile-admin-video-fixes` 三语 `site-updates` 更新文章，并同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。

## 2026-06-15

- 后台账号管理与统计口径优化：
  - 后台新增“账号管理”页面，放在“后台更新记录”上方，可查看注册账号邮箱、角色、密码加密状态、登录履历、活跃会话和近期活跃。
  - 密码不在后台明文展示，也不向前端返回密码哈希；管理员只能通过填写新密码来重置账号密码，真实账号数据不写入 GitHub 仓库。
  - 新增 `user_login_events` D1 表记录成功登录/注册履历，仅保存掩码 IP 前缀、IP hash、地区、设备摘要和时间。
  - 埋点统计改为登录账号优先识别：已登录用户按同一不可逆账号统计 ID 合并，同一账号多设备访问也只计为 1 个 UV；匿名访问继续按隐藏访客 cookie 统计。
  - 后台实时大屏补充自然语言解释，说明 PV、UV、在线访客和点击数据的含义。
- 视频管理排序、Bilibili 元数据和卡片尺寸修复：
  - Bilibili 元数据抓取在 API 412 或页面状态变化时增加 meta、结构化数据和更宽的页面状态兜底，尽量补齐标题、简介、作者、发布时间和封面。
  - 视频公开列表和后台列表改为置顶优先，未置顶视频按 `sort_order` 从大到小显示；后台新建视频默认取当前最大排序 + 10。
  - 视频分类管理同步使用排序值越大越靠前的规则，新建分类默认 +10，并防止默认分类 seed 覆盖后台维护过的排序和启用状态。
  - 主站视频卡片改为统一固定高度，封面按钮移除默认内边距并让图片完全铺满，缺少封面时显示同尺寸像素风占位图。
  - “打开原地址”按钮保持真实外链并兼容旧 fallback 数据；首页视频区入口去掉“待定 / TBD / 未定”三语文案。
  - 新增 `seed-update-2026-06-15-video-management-sort-metadata` 三语 `site-updates` 更新文章，并同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。

- 视频播放器窗口交互修复：
  - 将站内视频窗口“全屏”从 iframe Fullscreen API 改为 XP 标题栏右上角最大化/还原按钮，避免和 YouTube / Bilibili 自带全屏逻辑混在一起；最大化状态可再次点击或按 Escape 退出。
  - 公开视频接口补回 `original_url`，前台“打开原地址”按钮会稳定打开 YouTube / Bilibili 原页面。
  - 视频 iframe 增加站内默认遮罩与透明点击防护区，收起默认顶部/底部信息栏，并减少底部空白区域误触平台“保存到待看”等按钮。
  - 视频卡片播放按钮热区从整行收窄到按钮本体，降低卡片底部空白误触。
  - 新增 `seed-update-2026-06-15-video-player-window-controls` 三语 `site-updates` 更新文章，并同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新。
- 更新记录约束补强：
  - 在 `PROJECT_CONTEXT.md`、项目专用 Skill 和 Skill README 中强调：可见更新的三语 `site-updates` 文章是合并前验收门槛，不能当作事后可选补记。
  - 如果无法通过后台直接发布更新文章，也必须在同一次代码变更里补齐 API seed、D1 schema seed 和前端 fallback 最近更新。

- 首页任务栏上方绿色长条修复：
  - 确认截图中的绿色长条不是 night 底图像素，而是首页页面高度使用固定 `100vh - 108px` 估算后，未填满 `site-shell` 中间网格行，导致外层绿色草地渐变在任务栏上方露出。
  - 同步检查 morning / day / dusk / night 四个时段：同一布局缝隙都会存在，morning / day 因底部草色接近不明显，dusk / night 更容易看出，night 最突出。
  - 将 `main` 改为填满网格中间行的布局容器，页面使用父级高度而不再依赖固定像素估算，并更新首页 CSS / JS query 为 `20260615-video-window-home-gap-fix`，避免旧样式缓存继续显示露底长条。
  - 新增 `seed-update-2026-06-15-home-wallpaper-gap-fix` 三语 `site-updates` 文章，并同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 与 `js/main.js` fallback 最近更新。

- 管理后台视频和导航更新：
  - 后台视频预览改为检查用小播放器，避免 YouTube / Bilibili iframe 在编辑区撑满页面。
  - 后台视频元数据抓取补齐简介和发布时间链路：YouTube 增加页面元信息解析，Bilibili 增加浏览器化请求头、页面备用解析和 b23 短链兜底。
  - 新增独立“后台更新记录”标签页，并将后台导航顺序调整为实时大屏、访问来源、点击埋点、知识库文章、视频管理、视频分类管理、聊天室管理、后台更新记录、后台说明。
  - 更新后台专用 `ADMIN_SKILL`，强调每次后台更新后必须同步维护后台页面更新说明和 `admin/docs/ADMIN_CHANGELOG.md`。

- 视频区卡片与播放器修复：
  - 调整视频封面为固定 16:9 铺满显示，封面图片使用 `object-fit: cover` 对齐 YouTube / Bilibili 常见封面比例。
  - 修复视频介绍过长、播放按钮超出卡片和整张卡片都触发播放的问题，仅保留封面按钮与卡片内播放按钮作为播放热区。
  - 视频弹窗 iframe 改为铺满播放窗，打开时自动追加 YouTube / Bilibili autoplay 参数，并恢复“打开原地址”链接。
  - 视频播放窗支持拖拽调整大小，新增全屏按钮，并将标题栏星星替换为视频区同款图标。

- 主站文档补充后台文档指引：
  - 在 `PROJECT_CONTEXT.md` 的项目结构和 Skill 索引中补充 `admin/docs/` 后台专用文档入口。
  - 在主站项目 Skill 和 Skill README 中新增规则：凡是管理后台相关改动，必须额外读取 `admin/docs/ADMIN_PROJECT_CONTEXT.md`、`admin/docs/ADMIN_SKILL.md`，必要时读取 `admin/docs/ADMIN_CHANGELOG.md`。

- 管理后台专用文档包：
  - 新增 `admin/docs/ADMIN_PROJECT_CONTEXT.md`、`admin/docs/ADMIN_SKILL.md` 和 `admin/docs/ADMIN_CHANGELOG.md`，单独记录 `/admin/` 后台上下文、维护约束和私有更新记录。
  - 根目录 README 补充后台专用文档索引，明确后台文档不等同于主站 `PROJECT_CONTEXT.md`、根目录 `CHANGELOG.md` 或主站项目 Skill。
  - 本次仅做文档体系拆分，不改后台功能、样式、接口、D1 schema，也不写入主站知识库 `site-updates`。

- 知识库接口 500 修复：
  - 修复视频系统更新 seed 文案中的 Markdown 反引号未转义问题，避免 Pages Function 执行 `articleSeedStatements` 时把 `/api/videos` 片段误当成 JavaScript 表达式并抛出 `api is not defined`，导致 `/api/articles` 返回 500。
  - `npm run build` 新增模拟 `/api/articles?lang=zh` 请求的运行时检查，即使没有真实 D1 也会执行文章 seed 路径，防止类似“语法检查通过、线上运行失败”的问题再次漏掉。

- 补发合并更新文章：
  - 新增 `seed-update-2026-06-15-icons-cloud-fixes` 三语 `site-updates` 文章，把窗口/任务栏图标更新、标题栏图标对齐微调和 night/dusk 云层残影修复合并记录到一篇文章里。
  - 同步更新 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 最近更新，避免有可见更新但没有公开更新文章。
- 分区窗口标题栏图标对齐微调：
  - 放大各分区窗口左上角标题图标的显示盒子和背景缩放，让图标在标题文字前更清晰。
  - 保持标题栏、窗口尺寸和底部任务栏布局不变，仅调整标题栏图标的显示大小与垂直对齐。

- 首页动态云层 clean 底图残留修复：
  - 修补 night 中景云层上方残留在 `base-clean.png` 里的细小云片，修复云层漂移后出现“上半截留在背景上”的视觉断裂。
  - 同步检查 morning / day / dusk / night 四个时段：morning 和 day 未发现同类残留，dusk 有一条较淡的同类残影并已一并清理。
  - 更新动态底图引用缓存版本为 `20260615-cloud-residual-fix`，并将首页 CSS query 合并为 `20260615-managed-videos-cloud-residual-fix`，避免浏览器继续加载旧 clean plate。

- 视频区真实管理系统上线：
  - 新增 `videos`、`video_categories`、`video_category_relations` D1 表，并在运行时 schema guard 与 `cloudflare/schema.sql` 同步维护。
  - 新增公开视频接口 `/api/videos`、`/api/videos/:videoId`，以及后台视频和视频分类 CRUD 接口，全部后台接口复用 `requireAdmin` 权限校验。
  - 后台新增“视频管理”和“视频分类管理”，支持输入 YouTube / Bilibili / b23.tv 链接、服务端自动识别、抓取元数据、手动覆盖、分类关联、状态、排序、置顶、删除和刷新元数据。
  - 主站视频区改为读取 D1 数据，分类标签由后台分类动态生成，“全部”仅由前端生成；视频在 XP 风格弹窗内 iframe 播放，不跳转外站。
  - 视频渲染改为安全 DOM/textContent，iframe src 只使用服务端规范化 embed URL，封面失败时显示像素风占位图。
  - 扩展 `js/telemetry.js` 支持 `data-video-id` 和播放器打开/播放失败埋点，不记录后台输入内容。
  - 新增三语 `site-updates` 文章 `2026-06-15-managed-video-system`，并同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 和 `js/main.js` fallback 更新。
  - 更新 `index.html` 与 `admin/index.html` 的 CSS/JS query 到 `20260615-managed-videos`。

- 窗口与任务栏图标更新：
  - 使用 imagegen 参考新图标绘制并裁切 1:1 透明像素图标，新增知识库、视频区、资源区、游戏区、杂谈区、关于我六组窗口图标资源。
  - 底部任务栏快捷窗口图标改为固定尺寸图片图标，保持按钮高度和排列不变；匿名聊天室底部快捷图标保持原样。
  - 各页面窗口标题栏名称前图标改为对应区域图标，匿名聊天室仅替换打开后窗口左上角标题图标。
- 知识库文章发布时间链路加固：
  - 后台文章编辑器的发布时间改为本地日期时间选择器，编辑时把 UTC 发布时间转换为管理员本地时间显示。
  - 后台保存文章时将本地发布时间统一转换为 UTC ISO 后提交，后端再次规范化 `published_at`，确保 D1 保存绝对时间。
  - 公开知识库继续按访问者浏览器时区显示到秒，不显示时区名；不同时区用户会看到同一发布时间对应的各自本地时间。
  - 更新 `/admin/admin.js` query 为 `20260615-article-timezone-fix`，减少后台继续加载旧保存逻辑的可能。
  - 同步更新 `PROJECT_CONTEXT.md`、项目专用 Skill 和 Skill README 的时间维护规则。

- 首页动态云层线上速度修复：
  - 取消 `?wallpaper=` 预览模式的单独加速 CSS 分支，让预览和正式访问使用同一组云层动画周期。
  - 将 morning / day / dusk / night 四个时间段的正式 `--cloud-duration` 同步到原预览速度，修复线上正常访问明显慢于预览的问题。
  - 更新 `index.html` 的 CSS query 为 `20260615-cloud-speed-live`，减少线上继续加载旧云层速度样式的可能。

- 管理后台第一版保守型视觉优化：
  - 优化 `/admin/` 后台整体观感，统一侧边栏、顶部栏、XP 面板、按钮、表格、状态标签、空状态和提示信息，保持中文后台和轻量 XP / 像素风元素。
  - 改善实时大屏、文章管理、访问来源、点击埋点和聊天室管理在桌面、平板、移动端的阅读布局，修正移动端侧边栏高度和编辑区滚动边界。
  - 后台私有更新记录新增“后台视觉优化第一版”，继续与主站知识库 `site-updates` 分开维护。
  - 新增轻量 `npm run build` 静态检查脚本，用于验证后台入口、资源引用、关键面板、JS 语法和 CSS 基础结构。
- 首页动态云层速度与流畅度微调：
  - 将 morning / day / dusk / night 四个时段的云层漂移周期整体小幅缩短，让云朵移动比上一版略快，但仍保持慢速像素桌面氛围。
  - 为壁纸舞台和云层元素补充 `backface-visibility`、`contain`、初始 `translate3d` 和 `animation-fill-mode`，帮助浏览器更稳定地使用合成层，减少首帧跳动和动画卡顿。
  - 保持首页动态壁纸只使用 CSS `transform` / `opacity`，并继续保留 `prefers-reduced-motion`、页面隐藏暂停和小屏静态降级。
  - 新增 `seed-update-2026-06-15-cloud-speed-smoothness` 三语 `site-updates` 文章，并同步 `functions/api/[[route]].js`、`cloudflare/schema.sql` 与 `js/main.js` 的本地 fallback 最近更新。
  - 修正该更新文章的 `published_at` / 翻译更新时间为实际代码更新提交时间 `2026-06-15 20:41:45`（UTC+8），避免知识库显示为手填的 `17:30:00`。
  - 更新 `index.html` 的 CSS / JS query 为 `20260615-cloud-speed-smoothness`，减少线上继续加载旧动画参数的可能。
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
