const state = {
  user: null,
  activePanel: "dashboard",
  overview: null,
  regionFilter: "",
  clickFilter: "",
  articles: [],
  selectedArticleId: "",
  articleFilter: "",
  articleDetailReady: false,
  articleLang: "zh",
  articleSaving: false,
  articleSavingMode: "",
  articleDeleting: false,
  videos: [],
  selectedVideoId: "",
  videoFilter: "",
  videoCategories: [],
  selectedVideoCategoryId: "",
  videoCategoryFilter: "",
  videoCategoryBusy: false,
  videoCategoryBusyMode: "",
  videoPreviewing: false,
  videoMetadataRefreshing: false,
  videoCoverProcessing: false,
  videoCoverProcessingMode: "",
  videoSaving: false,
  videoSavingMode: "",
  videoDeleting: false,
  chatMessages: [],
  selectedMessageId: "",
  chatFilter: "",
  chatActionBusy: false,
  chatActionBusyMode: "",
  chatMessagesLoading: false,
  bans: [],
  banFilter: "",
  banListBusy: false,
  banListBusyMode: "",
  banBusyId: "",
  accounts: [],
  selectedAccountId: "",
  accountFilter: "",
  accountDetail: null,
  accountSaving: false,
  socialLinks: [],
  socialLinksSaving: false,
  mobileNavOpen: false,
  mobileNavReturnFocus: null,
  masterDetail: {
    articles: { view: "list", scrollTop: 0, focusId: "" },
    videos: { view: "list", scrollTop: 0, focusId: "" },
    chat: { view: "list", scrollTop: 0, focusId: "" },
    accounts: { view: "list", scrollTop: 0, focusId: "" }
  },
  editorTracking: {},
  confirmDialogResolve: null,
  confirmDialogReturnFocus: null,
  confirmDialogExpected: "",
  unsavedDialogResolve: null,
  unsavedDialogReturnFocus: null,
  handlingPopState: false,
  chatGovernanceTab: "message",
  mapViewport: {
    scale: 1,
    x: 0,
    y: 0,
    pointers: new Map(),
    dragStart: null,
    pinchStart: null,
    moved: false,
    suppressClick: false,
    pinnedKey: "",
    visibleKey: "",
    rows: [],
    rowsByKey: new Map(),
    pointElements: new Map(),
    pendingRows: null,
    pendingRenderTimer: null
  },
  loadedPanels: {},
  loadingPanels: {},
  statusHoldUntil: 0,
  timer: null,
  mapResizeTimer: null
};

const ACTIVE_PANEL_STORAGE_KEY = "lusu-admin-active-panel";
const ADMIN_HISTORY_STATE_KEY = "lusuAdminView";
const MOBILE_ADMIN_MEDIA = window.matchMedia("(max-width: 920px)");
const WORLD_MAP_ASPECT_RATIO = 1000 / 500;
const MAP_MIN_SCALE = 1;
const MAP_MAX_SCALE = 5;
const MAP_ZOOM_STEP = 0.5;
const MAP_KEYBOARD_PAN_STEP = 72;
const MAP_DRAG_THRESHOLD = 5;
const LOCAL_COVER_ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"]);
const LOCAL_COVER_ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);
const LOCAL_COVER_ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/ogg", "video/quicktime"]);
const LOCAL_COVER_ALLOWED_VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "mov", "webm", "ogv"]);
const LOCAL_COVER_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const LOCAL_VIDEO_FRAME_MAX_SOURCE_BYTES = 768 * 1024 * 1024;
const LOCAL_COVER_MAX_DATA_URL_CHARS = 360000;
const LOCAL_COVER_SIZES = [
  [960, 540],
  [768, 432],
  [640, 360]
];
const SOCIAL_LINK_PLATFORMS = [
  { platform: "x", label: "X（推特）", default_url: "https://x.com/lusu575" },
  { platform: "github", label: "GitHub", default_url: "https://github.com/lusu575" },
  { platform: "bilibili", label: "哔哩哔哩", default_url: "https://space.bilibili.com/" },
  { platform: "instagram", label: "Instagram", default_url: "https://www.instagram.com/lusu575/" },
  { platform: "discord", label: "Discord", default_url: "https://discord.com/" }
];

const panelMeta = {
  dashboard: ["鲁肃个人站管理后台", "实时访问工作台"],
  visits: ["访问来源", "按国家、省份、城市和掩码网络前缀查看每日访问。"],
  clicks: ["点击埋点", "查看站内各位置点击、浏览访客和最近事件。"],
  articles: ["知识库文章", "一次编辑中文、英文、日文三种版本，按当前选择语言显示编辑区。"],
  videos: ["视频管理", "输入视频链接后由服务端识别并缓存标题、简介、发布时间和封面，也可上传本地封面。"],
  videoCategories: ["视频分类管理", "维护视频区顶部标签，支持新增、编辑、停用、排序和安全删除。"],
  chat: ["聊天室管理", "编辑、隐藏、删除聊天记录，按隐藏用户标识或网络来源禁言。"],
  accounts: ["账号管理", "查看注册账号、重置密码、确认登录履历和近期活跃。"],
  socialLinks: ["社交链接", "维护主站关于我窗口里的社交入口跳转。"],
  updates: ["后台更新记录", "后台自己的私有更新说明，每次后台更新后同步记录。"],
  docs: ["后台说明", "后台项目说明，不混入主站知识库。"]
};

const overviewPanels = new Set(["dashboard", "visits", "clicks"]);
const staticPanels = new Set(["updates", "docs"]);
const validPanels = new Set(Object.keys(panelMeta));

const adminUpdates = [
  {
    date: "2026-07-16",
    title: "可缩放城市访问地图",
    body: "实时大屏访问地图升级为最近 14 天按国家、地区和城市精确分组的城市级聚合视图：桌面端支持鼠标滚轮缩放、拖拽平移及点击或悬停查看城市 PV/UV，触屏支持双指缩放和拖动，键盘可聚焦点位并打开同一城市详情；地图控件与点位使用至少 44px 触控目标。详情展示城市、地区、PV/UV 和最近访问时间，不展示 IP、网络前缀或隐藏标识等敏感数据。后台资源版本更新为 20260716-admin-interactive-map-r1。"
  },
  {
    date: "2026-07-16",
    title: "移动与操作安全底座",
    body: "管理后台完成第一阶段移动与操作安全底座：移动端使用可关闭并回收焦点的导航抽屉，文章、视频、聊天和账号使用列表/详情双态；编辑表单增加未保存保护、三语错误定位和上下文危险确认；地图补充非交互点位与同数据替代列表，视频封面脱离元数据网格，聊天室治理分层，账号默认不选中并拆分资料保存与密码重置。后台资源版本更新为 20260716-admin-safety-foundation-r1。"
  },
  {
    date: "2026-07-15",
    title: "网络来源禁言增加哈希代次保护",
    body: "聊天消息与网络来源禁言会记录非敏感的哈希密钥代次。后台只允许从当前代次消息新建网络来源禁言；旧代次消息只供审计，相关按钮会禁用，旧禁言会标记为“密钥已轮换”。禁言是否生效、是否过期由服务端按实际拦截条件返回，避免后台误报。后台 JS query 更新为 20260715-chat-ip-hash-generation-r1。"
  },
  {
    date: "2026-07-06",
    title: "密码房加密消息治理显示",
    body: "聊天室管理支持主站暗色密码房：后台列表会把加密消息显示为“密码房加密消息（后台无法解密）”，状态概览增加密码房数量，详情表单锁定密文内容编辑；隐藏、删除、按隐藏用户标识或网络来源禁言继续可用。后台 JS query 更新为 20260706-private-chat-rooms-r1。"
  },
  {
    date: "2026-06-22",
    title: "点击埋点邮箱样式文本脱敏",
    body: "点击埋点隐私边界收紧：主站账号入口不再把已登录邮箱放进可点击按钮文本，前端埋点和后端写入会对目标文本、页面路径、来源、链接、元素标识和点击聚合键中的邮箱样式文本（含 URL 编码和双重编码形态）统一替换为 [email]；后台点击热点和最近点击只展示脱敏后的分析文本。后台 JS query 更新为 20260622-admin-analytics-email-redact-r1；不改变点击采集范围、统计聚合、权限或接口路径。"
  },
  {
    date: "2026-06-22",
    title: "后台全局等高空白收口",
    body: "第 42 轮 loop 按全局后台界面重新收口布局：实时大屏、访问来源、点击埋点、内容编辑和统计覆盖等多栏区域统一取消默认等高拉伸，实时页面表现、访问来源和点击埋点的统计卡片不再被强行并排撑出空白，短卡片不再被旁边长列表拖出大块留白；侧栏也改为内容高度并保留滚动。后台资源版本更新为 20260622-admin-insight-r41；不增加接口请求，不改变权限、导航顺序或统计口径。"
  },
  {
    date: "2026-06-22",
    title: "实时大屏排版收紧与顶栏操作收口",
    body: "第 41 轮 loop 收紧实时大屏首屏排版：地图、页面表现、地区概览和实时页面表现不再互相拉伸出大块空白；侧栏数字气泡功能已移除，只保留文字导航和底部已加载概况；右上角退出按钮已删除，“顶部”改为右下角浮动按钮，首页标题改为“鲁肃个人站管理后台”。后台资源版本更新为 20260622-admin-insight-r39；不增加接口请求，不改变权限、导航顺序或统计口径。"
  },
  {
    date: "2026-06-22",
    title: "侧边栏新增已加载概况",
    body: "第 40 轮 loop 在侧边栏底部新增“已加载”概况行，按当前本地状态显示文章、视频、消息和账号数量；与数量徽标共用状态，不增加接口请求，方便先判断哪些模块已有内容。后台资源版本更新为 20260622-admin-insight-r38。"
  },
  {
    date: "2026-06-22",
    title: "侧边栏徽标单位优化",
    body: "第 39 轮 loop 将侧边栏数量徽标的悬停提示改为对应单位，并把访问来源、点击埋点也接入已有概览数量；徽标继续只复用已加载状态，不增加接口请求。后台资源版本更新为 20260622-admin-insight-r37。"
  },
  {
    date: "2026-06-22",
    title: "侧边栏新增数量徽标",
    body: "第 38 轮 loop 在侧边栏的文章、视频、视频分类、聊天室、账号、社交链接和后台更新记录入口右侧新增小数量徽标；数据加载后自动显示已加载数量，不新增接口请求，帮助站长快速识别各模块是否已有内容。后台资源版本更新为 20260622-admin-insight-r36。"
  },
  {
    date: "2026-06-22",
    title: "历史更新记录术语收口",
    body: "第 37 轮 loop 将后台更新记录历史条目中的网络地址缩写、语言代码、页面绑定、后台接口、主站公开更新分类等技术词进一步改成中文回看文案，减少打开更新记录时的英文术语密度；只调整后台私有记录展示，后台资源版本更新为 20260622-admin-insight-r35。"
  },
  {
    date: "2026-06-22",
    title: "网络来源文案中文化",
    body: "第 36 轮 loop 将访问来源表、聊天室禁言按钮、聊天详情、登录履历和后台说明里不必直出的网络地址缩写、接口缩写和权限字段表达改为“网络来源”“后台接口”“管理员角色”等中文说明；只调整后台可见文案，后台资源版本更新为 20260622-admin-insight-r34。"
  },
  {
    date: "2026-06-22",
    title: "后台更新记录新增概览",
    body: "第 35 轮 loop 在后台更新记录列表上方新增概览条，显示全部记录、最新日记录、循环记录、概览优化、文案优化和最新一轮编号，让回看维护历史时先看到结构再进入长列表；不增加接口请求，后台资源版本更新为 20260622-admin-insight-r33。"
  },
  {
    date: "2026-06-22",
    title: "社交链接预览新增状态概览",
    body: "第 34 轮 loop 在社交链接图标预览上方新增状态概览条，显示全部入口、已设置、自定义、默认链接、有更新记录和待补链接数量，并将哔哩哔哩入口在后台预览中中文显示；不改变社交链接接口和主站图标展示，后台资源版本更新为 20260622-admin-insight-r32。"
  },
  {
    date: "2026-06-22",
    title: "账号列表新增状态概览",
    body: "第 33 轮 loop 在账号列表筛选框下方新增状态概览条，按当前筛选结果显示全部/当前显示、管理员、普通用户、当前活跃、有云存档和有登录记录数量，减少逐条看账号状态的压力；不改变账号详情和密码逻辑，后台资源版本更新为 20260622-admin-insight-r31。"
  },
  {
    date: "2026-06-22",
    title: "禁言列表新增治理概览",
    body: "第 32 轮 loop 在禁言列表上方新增治理概览条，按当前筛选结果显示全部/当前显示、生效中、已停用、按用户、按网络来源和有原因数量，方便快速判断治理状态；不改变停用逻辑，后台资源版本更新为 20260622-admin-insight-r30。"
  },
  {
    date: "2026-06-22",
    title: "聊天记录新增治理概览",
    body: "第 31 轮 loop 在聊天记录列表上方新增治理概览条，按当前筛选结果显示已加载/当前显示、可见、已隐藏、有来源、有用户标识和可禁言数量，方便先判断治理范围；不增加接口请求，后台资源版本更新为 20260622-admin-insight-r29。"
  },
  {
    date: "2026-06-22",
    title: "视频分类新增状态概览",
    body: "第 30 轮 loop 在视频分类列表上方新增状态概览条，按当前筛选结果显示全部/当前显示、启用、停用、已被使用、可删除和最高排序，减少逐条看分类状态的压力；不增加接口请求，后台资源版本更新为 20260622-admin-insight-r28。"
  },
  {
    date: "2026-06-22",
    title: "视频列表新增状态概览",
    body: "第 29 轮 loop 在视频管理列表上方新增状态概览条，按当前筛选结果显示全部/当前显示、已发布、草稿、隐藏、置顶和需补资料数量，减少只读视频条目的压力；不增加接口请求，后台资源版本更新为 20260622-admin-insight-r27。"
  },
  {
    date: "2026-06-22",
    title: "文章列表新增状态概览",
    body: "第 28 轮 loop 在知识库文章列表上方新增状态概览条，按当前筛选结果显示全部/当前显示、已发布、草稿、归档、置顶和三语完整数量，先看结构再看明细；不增加接口请求，后台资源版本更新为 20260622-admin-insight-r26。"
  },
  {
    date: "2026-06-22",
    title: "后台更新记录技术词收口",
    body: "第 27 轮 loop 将后台更新记录里反复出现的资源版本技术词收口为“资源版本”，减少站长回看历史记录时遇到的英文术语；只调整后台可见文案，后台资源版本更新为 20260622-admin-insight-r25。"
  },
  {
    date: "2026-06-22",
    title: "后台表单占位提示中文化",
    body: "第 26 轮 loop 将文章路径标识、封面路径、视频链接、视频分类路径标识和哔哩哔哩社交链接的占位提示改成更自然的中文说明；字段值和保存逻辑保持不变，后台资源版本更新为 20260622-admin-insight-r24。"
  },
  {
    date: "2026-06-22",
    title: "视频列表标题和平台显示优化",
    body: "第 25 轮 loop 将视频列表和编辑标题的兜底显示从原始链接 / 内部编号改为“待补全标题的视频”或作者名，平台徽章将原始平台值显示为“哔哩哔哩”；只调整后台展示层，后台资源版本更新为 20260622-admin-insight-r23。"
  },
  {
    date: "2026-06-22",
    title: "实时访问排行改为页面表现比例条",
    body: "第 24 轮 loop 将实时大屏右侧的“实时访问排行”改为“实时页面表现”比例条，直接显示中文页面名、浏览量、访客数和最近访问时间；减少长列表阅读压力，后台资源版本更新为 20260622-admin-insight-r22。"
  },
  {
    date: "2026-06-22",
    title: "最近点击增加页面概览",
    body: "第 23 轮 loop 在点击埋点页的“最近点击”列表上方新增“点击页面概览”比例条，按页面聚合已加载点击事件；筛选点击后概览同步收窄，事件列表仍保留用于排查细节。后台资源版本更新为 20260622-admin-insight-r21。"
  },
  {
    date: "2026-06-22",
    title: "地区来源明细增加比例概览",
    body: "第 22 轮 loop 在访问来源页的地区明细表上方新增“地区来源概览”比例条，筛选后同步展示匹配来源的前 6 条浏览/访客表现；网络前缀表格仍保留用于复制和排查。后台资源版本更新为 20260622-admin-insight-r20。"
  },
  {
    date: "2026-06-22",
    title: "最近点击新增本地筛选",
    body: "第 21 轮 loop 在点击埋点页的“最近点击”列表上方新增本地筛选框，可按点击目标、页面、来源和屏幕尺寸快速定位已加载事件；计数同步显示“显示 X / 共 Y”。后台资源版本更新为 20260622-admin-insight-r19。"
  },
  {
    date: "2026-06-22",
    title: "地区来源明细新增本地筛选",
    body: "第 20 轮 loop 在访问来源页的“省份 / 地区 / 网络来源”明细表上方新增本地筛选框，可按国家、地区、城市和网络前缀快速定位来源；计数同步显示“显示 X / 共 Y”。后台资源版本更新为 20260622-admin-insight-r18。"
  },
  {
    date: "2026-06-22",
    title: "后台标识文案中文化",
    body: "第 19 轮 loop 将视频表单里的编号标签改为“平台视频编号”，聊天室详情和禁言按钮里的识别字段改为“用户标识 / 前端临时标识”，减少后台运行界面的英文缩写直出。后台资源版本更新为 20260622-admin-insight-r17。"
  },
  {
    date: "2026-06-22",
    title: "禁言列表新增本地筛选",
    body: "第 18 轮 loop 在禁言列表上方新增本地筛选框，可按禁言对象、原因、生效状态和来源类型快速定位记录；计数同步显示“显示 X / 共 Y”。后台资源版本更新为 20260622-admin-insight-r16。"
  },
  {
    date: "2026-06-22",
    title: "聊天室消息新增本地筛选",
    body: "第 17 轮 loop 在聊天记录列表上方新增“筛选已加载消息”，可按昵称、内容、来源和隐藏状态快速定位当前加载的聊天记录；计数同步显示“显示 X / 共 Y”。后台资源版本更新为 20260622-admin-insight-r15。"
  },
  {
    date: "2026-06-22",
    title: "账号列表新增本地筛选",
    body: "第 16 轮 loop 在账号列表上方新增本地筛选框，可按邮箱、角色、密码状态和活跃信息快速定位账号；账号概览仍显示全量状态，列表计数显示“显示 X / 共 Y”。后台资源版本更新为 20260622-admin-insight-r14。"
  },
  {
    date: "2026-06-22",
    title: "视频分类新增本地筛选",
    body: "第 15 轮 loop 在视频分类列表上方新增本地筛选框，可按分类名、路径标识和排序快速定位分类；计数同步显示“显示 X / 共 Y”。后台资源版本更新为 20260622-admin-insight-r13。"
  },
  {
    date: "2026-06-22",
    title: "视频列表新增本地筛选",
    body: "第 14 轮 loop 在视频列表上方新增本地筛选框，可按标题、作者、平台和链接快速定位视频；计数同步显示“显示 X / 共 Y”，与文章列表保持一致。后台资源版本更新为 20260622-admin-insight-r12。"
  },
  {
    date: "2026-06-22",
    title: "文章列表新增本地筛选",
    body: "第 13 轮 loop 在知识库文章列表上方新增本地筛选框，可按标题、路径标识、分类和标签快速缩小列表；计数同步显示“显示 X / 共 Y”，不增加接口请求。后台资源版本更新为 20260622-admin-insight-r11。"
  },
  {
    date: "2026-06-22",
    title: "统计与治理文案去英文缩写",
    body: "第 12 轮 loop 将实时大屏里的浏览量/独立访客解释写成自然语言，聊天室消息详情和禁言提示里的网络地址指纹改为“隐藏网络指纹”，减少后台运行时的英文缩写直出。后台资源版本更新为 20260622-admin-insight-r10。"
  },
  {
    date: "2026-06-22",
    title: "后台运行文案收口路径标识",
    body: "第 11 轮 loop 将文章保存校验、视频分类列表摘要和分类完整提示里的路径标识字段直出改为“路径标识”，让后台运行界面尽量使用中文说明；字段名和接口参数仍保持不变。后台资源版本更新为 20260622-admin-insight-r9。"
  },
  {
    date: "2026-06-22",
    title: "文章列表改用标题识别",
    body: "第 10 轮 loop 将知识库文章列表的主标题从路径标识改为文章标题，路径标识退到次级信息，减少站长在文章管理里靠路径标识识别内容的成本。后台文章列表接口只补充读取已有标题字段，不改变权限、保存逻辑或数据库结构；后台资源版本更新为 20260622-admin-insight-r8。"
  },
  {
    date: "2026-06-22",
    title: "顶部面板说明继续中文化",
    body: "第 9 轮 loop 将后台切换面板后的顶部说明继续中文化：文章说明不再显示语言代码，视频说明减少平台名堆叠，访问来源说明补充“掩码网络前缀”，社交链接说明改为“社交入口”。后台资源版本更新为 20260622-admin-insight-r7，功能逻辑和接口不变。"
  },
  {
    date: "2026-06-22",
    title: "未知页面路径显示收口",
    body: "第 8 轮 loop 将页面显示兜底从原始路径改为“站内页面”，避免未登记页面在排行、洞察、账号活跃和点击事件中再次露出 /xxx 或带语言参数的技术路径。后台资源版本更新为 20260622-admin-insight-r6，接口原始数据仍保留给排查使用，权限和数据写入不变。"
  },
  {
    date: "2026-06-22",
    title: "统计覆盖文案校准",
    body: "第 7 轮 loop 将侧边栏和实时大屏里的“已选站点 / 追踪项”改为更贴近真实数据的“页面 / 地区 / 文章覆盖”，避免把统计结果误读为后台配置数量。后台资源版本更新为 20260622-admin-insight-r5，统计接口、权限和数据写入不变。"
  },
  {
    date: "2026-06-22",
    title: "实时大屏新增访问洞察摘要",
    body: "第 6 轮 loop 在实时大屏顶部新增访问洞察摘要条，直接提炼最热页面、主要地区、热门文章和最高点击动作，减少站长在多张图表之间来回寻找结论。摘要继续使用中文页面名、中文地区名和中文指标表达；后台资源版本更新为 20260622-admin-insight-r4，接口和权限不变。"
  },
  {
    date: "2026-06-22",
    title: "热门文章改为表现比例条",
    body: "第 5 轮 loop 将实时大屏里的热门文章从表格改为文章表现比例条，和页面概览、地区概览、国家来源、点击热点保持同一套阅读方式；主数字展示浏览量，副信息展示访客、分类和最近访问时间。后台资源版本更新为 20260622-admin-insight-r3，后台权限、文章接口和主站公开更新边界不变。"
  },
  {
    date: "2026-06-22",
    title: "访问来源与点击热点继续图表化",
    body: "第 4 轮 loop 继续减少后台统计页的长表格：访问来源页的国家来源改为中文地区比例条，点击埋点页的点击热点改为按目标聚合的比例条；地区和网络来源明细表保留为工具表，方便继续复制掩码网络前缀。后台资源版本更新为 20260622-admin-insight-r2，权限、接口和数据写入不变。"
  },
  {
    date: "2026-06-22",
    title: "后台实时大屏图表化与侧边栏优化",
    body: "按新的 loop 目标继续优化管理后台：将实时城市分布、页面概览和地区概览提前到首屏，原先很长的热门页面/国家表格改为中文名称和比例条；页面路径会显示为首页、视频区、知识库、聊天室等中文名称，地区码改为中文地区名；顶部小标签导航改为左侧栏，保留现有白底数据后台风格、权限、接口和页面绑定边界。"
  },
  {
    date: "2026-06-22",
    title: "后台首屏中文化与信息口径优化",
    body: "优化管理后台首屏、编辑区和窄屏阅读体验：将实时面板标题、站点追踪摘要、访问排行、追踪项说明、文章路径标识、三语编辑标签、分类路径标识和表格指标标题改为更直观的中文表达；恢复浏览 / 访客统计口径说明，给窄屏表格增加滑动提示，并移除卡片里的模板残留词。后台风格、导航顺序、页面绑定、权限和后台接口边界保持不变，本次仍是后台私有更新。"
  },
  {
    date: "2026-06-21",
    title: "参考图优先实时面板重做",
    body: "按参考图再次推翻上一版通用卡片后台，改为更接近实时数据跟踪的白底仪表盘：顶部标题与跟踪网站条、左侧实时总览和灰度地图、右侧网站实时排名、下方属性卡片矩阵重新组织；全部后台模块、导航顺序、表单字段、页面绑定、权限和后台接口边界继续保留，后台私有更新不写入主站公开更新分类。"
  },
  {
    date: "2026-06-21",
    title: "极简数据工作台重做",
    body: "后台整体改为接近实时数据面板的白底极简风格：保留全部模块、导航顺序、表单字段和权限边界，重做侧栏、顶部栏、数据卡片、榜单表格、趋势图、地图、编辑表单、状态和移动端布局。后台私有更新仍只记录在管理后台内，不写入主站公开更新分类。"
  },
  {
    date: "2026-06-20",
    title: "关于我社交链接管理",
    body: "后台新增“社交链接”页，可维护主站关于我窗口中的 X、GitHub、哔哩哔哩、Instagram 和 Discord 跳转地址；配置保存到运行时配置表，主站通过公开只读接口读取并只展示小图标。"
  },
  {
    date: "2026-06-19",
    title: "访问地图投影对齐修复",
    body: "修复宽屏下面板蓝色背景和真实世界地图 SVG 可见区域不一致导致的点位偏移；来源点现在按 SVG 实际显示的 2:1 地图框重新投影，并在窗口尺寸变化后自动重算，确保经纬度落在对应城市和大陆位置。"
  },
  {
    date: "2026-06-19",
    title: "访问地图真实底图与经纬度点位",
    body: "实时大屏访问地图改为本地真实世界地图轮廓，来源点按访问经纬度投影到国家、地区和城市位置；点位悬停与辅助标签显示浏览量/访客数、来源地区和掩码网络前缀，继续不展示完整网络地址。"
  },
  {
    date: "2026-06-19",
    title: "管理后台夜间 loop 可用性与权限加固",
    body: "本轮按 2026-06-19 08:00 截止完成后台 loop 合并记录：增强文章、视频、视频分类、聊天室、禁言和账号面板的局部失败提示与忙碌锁定，补齐面板/三语编辑区语义状态、侧边栏键盘导航和视频封面本地处理反馈；后台入口继续只允许管理员角色访问，并统一安全响应头、数据库/会话异常和畸形 cookie 兜底。后台私有更新仍只保留在管理后台，不写入主站公开更新或前台本地兜底。"
  },
  {
    date: "2026-06-18",
    title: "管理后台视觉改版循环更新",
    body: "本轮后台视觉改版集中改善登录与拒绝访问状态、侧边栏/顶部栏/内容区滚动边界、实时大屏卡片与图表空态、访问来源与点击埋点长文本展示、文章/视频/分类/聊天室/账号管理的按钮、状态、复制、锁定和空态反馈；同时收紧后台入口只认管理员角色，后台私有更新仍只保留在管理后台内，不写入主站公开更新。"
  },
  {
    date: "2026-06-18",
    title: "管理后台循环优化整合更新",
    body: "昨晚后台循环优化已合并为一条记录：重点完成后台渲染安全收口、账号与聊天室隐私保护、视频链接与网络前缀校验、表单写入/详情读取/列表刷新期间的锁定防护、重复请求和状态错位修复，以及视频分类、置顶排序、封面预览、输入提示和移动端可读性优化。后台私有更新继续只记录在后台内，不写入主站公开更新。"
  },
  {
    date: "2026-06-17",
    title: "后台凭据表单语义优化",
    body: "后台登录页和账号重置密码表单的邮箱输入保留邮箱格式校验，同时补齐浏览器标准 username 自动填充语义，减少浏览器表单提示；站长登录、账号保存和 admin 权限复查保持不变。"
  },
  {
    date: "2026-06-17",
    title: "后台首屏按需加载优化",
    body: "后台打开时只读取管理员身份和当前实时大屏数据；文章、视频、聊天室、禁言和账号资料会在进入对应标签页或手动刷新时再加载，减少首屏请求和敏感数据的无谓读取；概览读取失败后仍可切换或手动刷新重试。"
  },
  {
    date: "2026-06-16",
    title: "视频分类 seed 持久化修复",
    body: "视频分类默认标签改为只在全新视频分类表首次创建时初始化；已有后台分类表会写入 seed 状态标记，之后删除默认标签或调整排序都不会被冷启动自动补回。"
  },
  {
    date: "2026-06-16",
    title: "视频置顶独立队列排序修复",
    body: "视频管理新增独立置顶排序值；勾选置顶的视频会先进入置顶队列，公开视频和后台列表都优先显示置顶队列，多个置顶视频再按置顶排序值从大到小排列，未置顶视频继续按普通排序显示。"
  },
  {
    date: "2026-06-16",
    title: "视频封面本地上传与首帧生成",
    body: "视频管理支持上传 JPG、PNG、WEBP、AVIF 本地图片作为封面，并会压缩成适合卡片展示的封面数据；也可从本地视频文件读取第一帧生成封面，保存时如果封面为空会优先使用已选择的视频首帧。"
  },
  {
    date: "2026-06-16",
    title: "视频分类与 Bilibili 元数据维护修复",
    body: "默认视频分类初始化改为只补缺失项，不再覆盖后台改过的分类名称；视频保存时如果链接没有变化，不再反复抓取外部元数据。Bilibili 抓取补强请求头、详情接口、移动页和页面数据兜底，抓取失败时会提示可手动补全；同时新增重复视频拦截和停用分类标识。"
  },
  {
    date: "2026-06-15",
    title: "账号管理和统计口径优化",
    body: "新增后台账号管理页，可查看邮箱、角色、密码加密状态、登录履历、活跃会话和近期站内活跃；密码只允许重置，不展示明文或哈希。统计埋点改为登录账号优先识别，同一登录账号的访问统一计为 1 个独立访客，并补充自然语言说明。"
  },
  {
    date: "2026-06-15",
    title: "视频排序和 Bilibili 元数据兜底修复",
    body: "视频和视频分类改为置顶优先、排序值越大越靠前，新建默认追加 +10；哔哩哔哩抓取在平台接口返回 412 后继续尝试页面元信息、结构化数据和页面状态解析；默认分类初始化标记不再覆盖后台维护过的排序和启用状态。"
  },
  {
    date: "2026-06-15",
    title: "视频元数据和后台更新记录优化",
    body: "压缩后台视频播放器预览尺寸，增强 YouTube / Bilibili 标题、简介、作者、发布时间和封面抓取；Bilibili 增加浏览器化请求头、页面备用解析和 b23 短链兜底；新增独立“后台更新记录”标签页并调整后台导航顺序。"
  },
  {
    date: "2026-06-15",
    title: "后台视觉优化第一版",
    body: "完成保守型后台视觉优化：统一侧边栏、顶部栏、卡片、按钮、表格、状态标签、空状态和移动端布局，后台更新记录继续独立于主站网站更新记录。"
  },
  {
    date: "2026-06-15",
    title: "文章浏览与访客统计",
    body: "文章详情接口新增服务端访问事件记录，后台大屏新增热门文章表，文章列表和编辑详情显示每篇文章的总浏览、总访客、今日浏览和今日访客。"
  },
  {
    date: "2026-06-15",
    title: "管理后台 MVP 接入",
    body: "新增独立 /admin/ 后台、实时监控大屏、三语文章编辑、访问来源地图、点击埋点、聊天室编辑删除和禁言能力。"
  }
];

const countryPositions = {
  CN: [104, 35],
  US: [-98, 39],
  JP: [139, 36],
  KR: [127, 36],
  SG: [104, 1.3],
  GB: [-2, 54],
  DE: [10, 51],
  FR: [2, 47],
  CA: [-106, 56],
  AU: [134, -25],
  RU: [90, 61],
  IN: [78, 22],
  BR: [-51, -10]
};

const countryNames = {
  AD: "安道尔",
  AE: "阿联酋",
  AL: "阿尔巴尼亚",
  AR: "阿根廷",
  AT: "奥地利",
  AU: "澳大利亚",
  BE: "比利时",
  BR: "巴西",
  CA: "加拿大",
  CH: "瑞士",
  CN: "中国大陆",
  DE: "德国",
  ES: "西班牙",
  FI: "芬兰",
  FR: "法国",
  GB: "英国",
  HK: "中国香港",
  ID: "印度尼西亚",
  IN: "印度",
  IT: "意大利",
  JP: "日本",
  KR: "韩国",
  MO: "中国澳门",
  MY: "马来西亚",
  NL: "荷兰",
  PH: "菲律宾",
  PL: "波兰",
  RU: "俄罗斯",
  SE: "瑞典",
  SG: "新加坡",
  TH: "泰国",
  TR: "土耳其",
  TW: "中国台湾",
  US: "美国",
  VN: "越南"
};

const pageRouteLabels = {
  home: "首页",
  videos: "视频区",
  knowledge: "知识库",
  resources: "资源区",
  games: "游戏区",
  chatroom: "聊天室",
  about: "关于我",
  article: "知识库文章"
};

const articleSlugLabels = {
  "ai-agent-workflow-guide": "AI 代理工作流指南",
  "ai-agent-article": "AI 代理文章",
  "2026-06-11-knowledge-video-home-fix": "知识库视频首页修复记录",
  "2026-06-14-ai-agent-article": "AI 代理文章记录",
  "2026-06-15-cloud-speed-smoothness": "云朵速度平滑优化",
  "2026-06-15-icons-cloud-fixes": "图标云修复",
  "2026-06-15-video-player-window-controls": "视频播放器窗口控制",
  "2026-06-16-mobile-admin-video-fixes": "移动端后台视频修复",
  "2026-06-16-responsive-video-window": "响应式视频窗口记录",
  "2026-06-16-video-card-category-icon-fixes": "视频卡片分类图标修复",
  "2026-06-18-main-visual-polish-cycle": "主站视觉打磨记录"
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const editorConfigs = {
  articles: { form: "#article-form", indicator: "#article-dirty-indicator", label: "文章" },
  videos: { form: "#video-form", indicator: "#video-dirty-indicator", label: "视频" },
  videoCategories: { form: "#video-category-form", indicator: "", label: "视频分类" },
  chat: { form: "#chat-form-admin", indicator: "#chat-dirty-indicator", label: "聊天记录" },
  accounts: { form: "#account-form", indicator: "#account-dirty-indicator", label: "账号" },
  socialLinks: { form: "#social-links-form", indicator: "", label: "社交链接" }
};

const masterDetailConfigs = {
  articles: { list: "#article-list", title: "#article-editor-title", idAttribute: "articleId" },
  videos: { list: "#video-list-admin", title: "#video-editor-title", idAttribute: "adminVideoId" },
  chat: { list: "#chat-list", title: "#chat-detail-title", idAttribute: "messageId" },
  accounts: { list: "#account-list", title: "#account-editor-title", idAttribute: "accountId" }
};

function editorForm(panel) {
  const selector = editorConfigs[panel]?.form;
  return selector ? $(selector) : null;
}

function editorTracking(panel) {
  if (!editorConfigs[panel]) {
    return null;
  }
  if (!state.editorTracking[panel]) {
    state.editorTracking[panel] = {
      initialized: false,
      baseline: "",
      baselineValues: [],
      dirty: false,
      lastSavedAt: ""
    };
  }
  return state.editorTracking[panel];
}

function editorFieldElements(panel) {
  const forms = panel === "accounts"
    ? [$("#account-form"), $("#account-password-form")].filter(Boolean)
    : [editorForm(panel)].filter(Boolean);
  if (!forms.length) {
    return [];
  }
  return forms.flatMap((form) => Array.from(form.elements)).filter((field) => {
    if (!(field instanceof HTMLElement)) {
      return false;
    }
    const type = String(field.type || "").toLowerCase();
    if (["button", "submit", "reset", "file"].includes(type)) {
      return false;
    }
    if (panel === "chat" && ["ban_reason", "ban_hours"].includes(field.name)) {
      return false;
    }
    if (panel === "accounts" && field.name === "password_status") {
      return false;
    }
    return Boolean(field.name || field.id || field.value);
  });
}

function editorFieldKey(field, index) {
  const type = String(field.type || field.tagName || "").toLowerCase();
  const optionValue = type === "checkbox" || type === "radio" ? String(field.value || "") : "";
  return `${field.name || field.id || "field"}:${type}:${optionValue}:${index}`;
}

function editorComparableValue(field) {
  const type = String(field.type || "").toLowerCase();
  if (type === "password") {
    return field.value ? "pending-password" : "";
  }
  if (type === "checkbox" || type === "radio") {
    return Boolean(field.checked);
  }
  if (field instanceof HTMLSelectElement && field.multiple) {
    return Array.from(field.selectedOptions).map((option) => option.value);
  }
  return String(field.value || "");
}

function editorComparableSnapshot(panel) {
  return JSON.stringify(editorFieldElements(panel).map((field, index) => [
    editorFieldKey(field, index),
    editorComparableValue(field)
  ]));
}

function editorRestorableSnapshot(panel) {
  return editorFieldElements(panel).map((field, index) => {
    const type = String(field.type || "").toLowerCase();
    let value = type === "password" ? "" : String(field.value || "");
    if (type === "checkbox" || type === "radio") {
      value = Boolean(field.checked);
    }
    return { index, key: editorFieldKey(field, index), type, value };
  });
}

function ensureEditorIndicator(panel) {
  const config = editorConfigs[panel];
  if (!config) {
    return null;
  }
  let indicator = config.indicator ? $(config.indicator) : null;
  if (indicator) {
    return indicator;
  }
  const actions = editorForm(panel)?.querySelector(".form-actions");
  if (!actions) {
    return null;
  }
  indicator = document.createElement("span");
  indicator.className = "edit-state";
  indicator.id = `${panel}-dirty-indicator`;
  indicator.setAttribute("aria-live", "polite");
  const status = actions.querySelector(".form-status");
  actions.insertBefore(indicator, status || null);
  config.indicator = `#${indicator.id}`;
  return indicator;
}

function syncEditorIndicator(panel) {
  const tracking = editorTracking(panel);
  const indicator = ensureEditorIndicator(panel);
  if (!tracking || !indicator) {
    return;
  }
  indicator.classList.toggle("is-dirty", tracking.dirty);
  if (tracking.dirty) {
    setElementText(indicator, "未保存");
    indicator.title = `${editorConfigs[panel].label}有未保存更改`;
    return;
  }
  const savedText = tracking.lastSavedAt ? `已保存 ${tracking.lastSavedAt}` : "已保存";
  setElementText(indicator, savedText);
  indicator.title = savedText;
}

function captureEditorBaseline(panel, options = {}) {
  const tracking = editorTracking(panel);
  if (!tracking || !editorForm(panel)) {
    return;
  }
  tracking.baseline = editorComparableSnapshot(panel);
  tracking.baselineValues = editorRestorableSnapshot(panel);
  tracking.initialized = true;
  tracking.dirty = false;
  if (options.saved) {
    tracking.lastSavedAt = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date());
  }
  syncEditorIndicator(panel);
}

function refreshEditorDirtyState(panel) {
  const tracking = editorTracking(panel);
  if (!tracking || !editorForm(panel)) {
    return false;
  }
  if (!tracking.initialized) {
    captureEditorBaseline(panel);
    return false;
  }
  tracking.dirty = editorComparableSnapshot(panel) !== tracking.baseline;
  syncEditorIndicator(panel);
  return tracking.dirty;
}

function isEditorDirty(panel) {
  return refreshEditorDirtyState(panel);
}

function restoreEditorBaseline(panel) {
  const tracking = editorTracking(panel);
  const fields = editorFieldElements(panel);
  if (!tracking?.initialized) {
    return;
  }
  tracking.baselineValues.forEach((item, index) => {
    const field = fields[index];
    if (!field || item.key !== editorFieldKey(field, index)) {
      return;
    }
    if (item.type === "checkbox" || item.type === "radio") {
      field.checked = Boolean(item.value);
    } else {
      field.value = item.value;
    }
  });
  if (panel === "articles") {
    clearArticleValidation();
    updateArticleLanguageStates();
  } else if (panel === "videos") {
    const form = editorForm(panel);
    renderVideoThumbnailPreview(form?.elements?.thumbnail_url?.value || "");
    renderAdminVideoPreview(form?.elements?.embed_url?.value || "");
    syncVideoPinnedSortHint();
  } else if (panel === "chat") {
    syncChatActionState();
  } else if (panel === "accounts") {
    syncAccountSaveButton();
  } else if (panel === "socialLinks") {
    renderSocialLinkPreviewFromForm();
  }
  tracking.dirty = false;
  syncEditorIndicator(panel);
}

function hasAnyDirtyEditor() {
  return Object.keys(editorConfigs).some((panel) => isEditorDirty(panel));
}

function activeEditorPanel() {
  return editorConfigs[state.activePanel] ? state.activePanel : "";
}

function isEditorBusy(panel) {
  if (panel === "articles") {
    return isArticleWriteBusy() || isArticleDetailPending();
  }
  if (panel === "videos") {
    return isVideoEditBusy();
  }
  if (panel === "videoCategories") {
    return isVideoCategoryWriteBusy();
  }
  if (panel === "chat") {
    return isChatInteractionBusy();
  }
  if (panel === "accounts") {
    return isAccountWriteBusy() || isAccountDetailPending();
  }
  if (panel === "socialLinks") {
    return state.socialLinksSaving;
  }
  return false;
}

function focusableElements(container) {
  return $$([
    "button:not([disabled])",
    "a[href]",
    "input:not([disabled])",
    "textarea:not([disabled])",
    "select:not([disabled])",
    "summary",
    "[tabindex]:not([tabindex='-1'])"
  ].join(","), container).filter((item) => !item.hidden && item.getClientRects().length > 0);
}

function trapFocus(event, container) {
  if (event.key !== "Tab") {
    return;
  }
  const items = focusableElements(container);
  if (!items.length) {
    event.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openMobileNav(opener = document.activeElement) {
  if (!MOBILE_ADMIN_MEDIA.matches || state.mobileNavOpen) {
    return;
  }
  const sidebar = $("#admin-sidebar");
  const backdrop = $("#mobile-nav-backdrop");
  state.mobileNavOpen = true;
  state.mobileNavReturnFocus = opener instanceof HTMLElement ? opener : $("#mobile-nav-toggle");
  document.body.classList.add("admin-nav-open");
  sidebar.inert = false;
  backdrop.hidden = false;
  $("#mobile-nav-toggle").setAttribute("aria-expanded", "true");
  window.requestAnimationFrame(() => {
    const active = sidebar.querySelector(".nav-button.active");
    (active || $("#mobile-nav-close"))?.focus();
  });
}

function closeMobileNav(options = {}) {
  const restoreFocus = options.restoreFocus !== false;
  const sidebar = $("#admin-sidebar");
  const backdrop = $("#mobile-nav-backdrop");
  state.mobileNavOpen = false;
  document.body.classList.remove("admin-nav-open");
  backdrop.hidden = true;
  $("#mobile-nav-toggle").setAttribute("aria-expanded", "false");
  sidebar.inert = MOBILE_ADMIN_MEDIA.matches;
  if (restoreFocus) {
    const target = state.mobileNavReturnFocus;
    window.requestAnimationFrame(() => target?.isConnected && target.focus());
  }
  state.mobileNavReturnFocus = null;
}

function syncMobileNavMode() {
  if (!MOBILE_ADMIN_MEDIA.matches) {
    closeMobileNav({ restoreFocus: false });
    $("#admin-sidebar").inert = false;
    return;
  }
  if (!state.mobileNavOpen) {
    $("#admin-sidebar").inert = true;
    $("#mobile-nav-backdrop").hidden = true;
  }
}

function settleConfirmDialog(result) {
  const dialog = $("#admin-confirm-dialog");
  const resolve = state.confirmDialogResolve;
  const returnFocus = state.confirmDialogReturnFocus;
  state.confirmDialogResolve = null;
  state.confirmDialogReturnFocus = null;
  state.confirmDialogExpected = "";
  if (dialog.open) {
    dialog.close();
  }
  resolve?.(Boolean(result));
  window.requestAnimationFrame(() => returnFocus?.isConnected && returnFocus.focus());
}

function openConfirmDialog(options = {}) {
  if (state.confirmDialogResolve) {
    return Promise.resolve(false);
  }
  const dialog = $("#admin-confirm-dialog");
  const inputWrap = $("#admin-confirm-input-wrap");
  const input = $("#admin-confirm-input");
  const submit = $("#admin-confirm-submit");
  setElementText($("#admin-confirm-title"), options.title || "确认操作");
  setElementText($("#admin-confirm-object"), options.object || "未选择");
  setElementText($("#admin-confirm-state"), options.state || "未知");
  setElementText($("#admin-confirm-impact"), options.impact || "请检查本次操作影响。");
  setElementText($("#admin-confirm-recovery"), options.recovery || "请检查后再继续。");
  setElementText(submit, options.confirmLabel || "确认");
  state.confirmDialogExpected = String(options.expectedText || "");
  input.value = "";
  inputWrap.hidden = !state.confirmDialogExpected;
  setElementText(
    $("#admin-confirm-input-hint"),
    state.confirmDialogExpected ? `请输入“${state.confirmDialogExpected}”后继续。` : ""
  );
  submit.disabled = Boolean(state.confirmDialogExpected);
  state.confirmDialogReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return new Promise((resolve) => {
    state.confirmDialogResolve = resolve;
    dialog.showModal();
    window.requestAnimationFrame(() => $("#admin-confirm-cancel").focus());
  });
}

function settleUnsavedDialog(choice) {
  const dialog = $("#admin-unsaved-dialog");
  const resolve = state.unsavedDialogResolve;
  const returnFocus = state.unsavedDialogReturnFocus;
  state.unsavedDialogResolve = null;
  state.unsavedDialogReturnFocus = null;
  if (dialog.open) {
    dialog.close();
  }
  resolve?.(choice);
  if (choice === "stay") {
    window.requestAnimationFrame(() => returnFocus?.isConnected && returnFocus.focus());
  }
}

function openUnsavedDialog(panel, description) {
  if (state.unsavedDialogResolve) {
    return Promise.resolve("stay");
  }
  const dialog = $("#admin-unsaved-dialog");
  const label = editorConfigs[panel]?.label || "当前内容";
  setElementText($("#admin-unsaved-title"), `${label}有未保存更改`);
  setElementText($("#admin-unsaved-description"), description || "继续离开会丢弃当前表单里尚未保存的内容。");
  setElementText($("#admin-unsaved-status"), "");
  state.unsavedDialogReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return new Promise((resolve) => {
    state.unsavedDialogResolve = resolve;
    dialog.showModal();
    window.requestAnimationFrame(() => $("#admin-unsaved-stay").focus());
  });
}

async function saveEditorForPanel(panel) {
  if (panel === "articles") {
    return saveArticle();
  }
  if (panel === "videos") {
    return saveVideo();
  }
  if (panel === "videoCategories") {
    return saveVideoCategory();
  }
  if (panel === "chat") {
    return saveChatMessage();
  }
  if (panel === "accounts") {
    const passwordForm = $("#account-password-form");
    if (passwordForm?.elements?.password?.value) {
      const passwordSaved = await resetAccountPassword();
      if (!passwordSaved) {
        return false;
      }
    }
    if (refreshEditorDirtyState("accounts")) {
      return saveAccountProfile();
    }
    return true;
  }
  if (panel === "socialLinks") {
    return saveSocialLinks();
  }
  return true;
}

async function confirmEditorCanLeave(panel, description) {
  if (!editorConfigs[panel] || !isEditorDirty(panel)) {
    return true;
  }
  if (isEditorBusy(panel)) {
    setStatus(`${editorConfigs[panel].label}正在处理，请完成后再离开。`, { holdMs: 2500 });
    return false;
  }
  const choice = await openUnsavedDialog(panel, description);
  if (choice === "stay") {
    return false;
  }
  if (choice === "save") {
    const saved = await saveEditorForPanel(panel);
    if (!saved || isEditorDirty(panel)) {
      return false;
    }
    return true;
  }
  restoreEditorBaseline(panel);
  return true;
}

async function runGuardedTransition(panel, description, action) {
  if (!(await confirmEditorCanLeave(panel, description))) {
    return false;
  }
  const result = await action();
  return result !== false;
}

function masterDetailLayout(panel) {
  return document.querySelector(`[data-master-detail="${panel}"]`);
}

function masterDetailList(panel) {
  const selector = masterDetailConfigs[panel]?.list;
  return selector ? $(selector) : null;
}

function selectedItemSelector(panel, id) {
  const attribute = {
    articles: "data-article-id",
    videos: "data-admin-video-id",
    chat: "data-message-id",
    accounts: "data-account-id"
  }[panel];
  return attribute && id ? `[${attribute}="${CSS.escape(String(id))}"]` : "";
}

function rememberMasterListContext(panel, focusId = "") {
  const detailState = state.masterDetail[panel];
  const list = masterDetailList(panel);
  if (!detailState) {
    return;
  }
  detailState.scrollTop = list?.scrollTop || 0;
  detailState.focusId = focusId || detailState.focusId;
}

function setMasterDetailView(panel, view, options = {}) {
  const detailState = state.masterDetail[panel];
  const layout = masterDetailLayout(panel);
  if (!detailState || !layout) {
    return;
  }
  detailState.view = view === "detail" ? "detail" : "list";
  layout.classList.toggle("is-mobile-detail", detailState.view === "detail");
  if (detailState.view === "detail" && options.focus !== false) {
    const title = $(masterDetailConfigs[panel].title);
    if (title) {
      title.tabIndex = -1;
      window.requestAnimationFrame(() => title.focus());
    }
  } else if (detailState.view === "list" && options.restore !== false) {
    window.requestAnimationFrame(() => {
      const list = masterDetailList(panel);
      if (list) {
        list.scrollTop = detailState.scrollTop || 0;
      }
      const selector = selectedItemSelector(panel, detailState.focusId);
      const target = selector ? document.querySelector(selector) : null;
      (target || list)?.focus?.();
    });
  }
}

function currentAdminHistoryView() {
  return {
    panel: state.activePanel,
    view: state.masterDetail[state.activePanel]?.view || "list"
  };
}

function replaceAdminHistoryView(panel = state.activePanel, view = "list") {
  const next = { ...(history.state || {}) };
  next[ADMIN_HISTORY_STATE_KEY] = { panel, view };
  history.replaceState(next, "");
}

function pushAdminDetailHistory(panel) {
  const next = { ...(history.state || {}) };
  next[ADMIN_HISTORY_STATE_KEY] = { panel, view: "detail" };
  history.pushState(next, "");
}

function enterMobileDetail(panel, focusId = "") {
  if (!MOBILE_ADMIN_MEDIA.matches || !state.masterDetail[panel]) {
    return;
  }
  rememberMasterListContext(panel, focusId);
  setMasterDetailView(panel, "detail");
  const current = history.state?.[ADMIN_HISTORY_STATE_KEY];
  if (current?.panel !== panel || current?.view !== "detail") {
    pushAdminDetailHistory(panel);
  }
}

async function leaveMobileDetail(panel) {
  if (!state.masterDetail[panel] || state.masterDetail[panel].view !== "detail") {
    return true;
  }
  const current = history.state?.[ADMIN_HISTORY_STATE_KEY];
  if (current?.panel === panel && current?.view === "detail") {
    history.back();
    return true;
  }
  return runGuardedTransition(panel, "返回列表会放弃当前详情里尚未保存的更改。", async () => {
    setMasterDetailView(panel, "list");
    replaceAdminHistoryView(panel, "list");
  });
}

async function handleAdminPopState(event) {
  if (state.handlingPopState) {
    return;
  }
  const target = event.state?.[ADMIN_HISTORY_STATE_KEY];
  if (!target || !validPanels.has(target.panel)) {
    return;
  }
  state.handlingPopState = true;
  const current = currentAdminHistoryView();
  const editorPanel = activeEditorPanel();
  const allowed = await confirmEditorCanLeave(editorPanel, "浏览器返回会离开当前详情，未保存内容将被丢弃。");
  if (!allowed) {
    const restore = { ...(history.state || {}) };
    restore[ADMIN_HISTORY_STATE_KEY] = current;
    history.pushState(restore, "");
    state.handlingPopState = false;
    return;
  }
  applyActivePanel(target.panel);
  rememberActivePanel(target.panel);
  Object.keys(state.masterDetail).forEach((panel) => {
    setMasterDetailView(panel, panel === target.panel ? target.view : "list", {
      focus: false,
      restore: panel === target.panel
    });
  });
  updateRefreshButton();
  await loadPanelData(target.panel);
  state.handlingPopState = false;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      window.location.reload();
    }
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function formatTime(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function countryDisplayName(value) {
  const code = String(value || "").trim().toUpperCase();
  if (!code) {
    return "未知地区";
  }
  return countryNames[code] || code;
}

function languageDisplayName(value) {
  const labels = {
    zh: "中文访问",
    en: "英文访问",
    ja: "日文访问"
  };
  return labels[String(value || "").toLowerCase()] || "";
}

function categoryDisplayName(value) {
  const labels = {
    note: "随笔",
    knowledge: "知识库",
    "site-updates": "网站更新",
    update: "更新记录",
    guide: "指南",
    ai: "AI"
  };
  const key = String(value || "").trim();
  if (!key) {
    return "";
  }
  return labels[key] || key;
}

function parsePageReference(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "home") {
    return { pathname: "/", hash: "", lang: "", slug: "", raw };
  }
  try {
    const url = new URL(raw, window.location.origin);
    const slug = url.pathname.startsWith("/articles/")
      ? decodeURIComponent(url.pathname.replace("/articles/", "").replace(/\/$/, ""))
      : "";
    return {
      pathname: url.pathname || "/",
      hash: decodeURIComponent(url.hash || "").replace(/^#/, ""),
      lang: url.searchParams.get("lang") || "",
      slug,
      raw
    };
  } catch {
    const cleaned = raw.replace(/^\//, "").replace(/^#/, "");
    return { pathname: raw.startsWith("/") ? raw : "/", hash: cleaned, lang: "", slug: "", raw };
  }
}

function pageDisplayInfo(value, route = "") {
  const parsed = parsePageReference(value || route);
  const routeKey = String(route || "").trim();
  const detailParts = [];
  const langText = languageDisplayName(parsed.lang);
  if (langText) {
    detailParts.push(langText);
  }
  if (parsed.slug) {
    return {
      label: articleSlugLabels[parsed.slug] || "知识库文章",
      detail: ["知识库文章", ...detailParts].filter(Boolean).join(" · "),
      raw: parsed.raw
    };
  }
  const sectionKey = routeKey && routeKey !== "home" ? routeKey : parsed.hash;
  const label = pageRouteLabels[sectionKey] || pageRouteLabels[routeKey] || (parsed.pathname === "/" ? "首页" : "站内页面");
  return {
    label,
    detail: detailParts.join(" · "),
    raw: parsed.raw
  };
}

function pageDisplayName(value, route = "") {
  return pageDisplayInfo(value, route).label;
}

function pageDisplayDetail(value, route = "") {
  const info = pageDisplayInfo(value, route);
  return info.detail || "站内页面";
}

function fileExtension(file) {
  return String(file?.name || "").split(".").pop()?.toLowerCase() || "";
}

function assertAllowedFile(file, typeSet, extensionSet, maxBytes, label) {
  if (!file) {
    throw new Error(`请选择${label}。`);
  }
  const type = String(file.type || "").toLowerCase();
  const extension = fileExtension(file);
  if ((!type || !typeSet.has(type)) && !extensionSet.has(extension)) {
    throw new Error(`${label}格式不支持。`);
  }
  if (file.size > maxBytes) {
    throw new Error(`${label}文件过大，请先压缩后再选择。`);
  }
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("封面图片读取失败，请换一张图片。"));
    image.src = src;
  });
}

function onceMediaEvent(target, eventName, timeoutMs, message) {
  if (eventName === "loadedmetadata" && target.readyState >= 1) {
    return Promise.resolve();
  }
  if (eventName === "loadeddata" && target.readyState >= 2) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(message));
    }, timeoutMs);
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error(message));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      target.removeEventListener(eventName, done);
      target.removeEventListener("error", fail);
    };
    target.addEventListener(eventName, done, { once: true });
    target.addEventListener("error", fail, { once: true });
  });
}

function drawCoverToCanvas(source, width, height, targetWidth, targetHeight) {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  context.fillStyle = "#f7fbff";
  context.fillRect(0, 0, targetWidth, targetHeight);
  const scale = Math.max(targetWidth / width, targetHeight / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const x = (targetWidth - drawWidth) / 2;
  const y = (targetHeight - drawHeight) / 2;
  context.drawImage(source, x, y, drawWidth, drawHeight);
  return canvas;
}

function coverCanvasDataUrl(source, sourceWidth, sourceHeight) {
  if (!sourceWidth || !sourceHeight) {
    throw new Error("无法读取封面尺寸。");
  }
  const qualities = [0.86, 0.76, 0.66, 0.56];
  for (const [width, height] of LOCAL_COVER_SIZES) {
    const canvas = drawCoverToCanvas(source, sourceWidth, sourceHeight, width, height);
    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= LOCAL_COVER_MAX_DATA_URL_CHARS) {
        return dataUrl;
      }
    }
  }
  throw new Error("封面压缩后仍然过大，请换一张更简单的图片。");
}

async function imageFileToCoverDataUrl(file) {
  assertAllowedFile(
    file,
    LOCAL_COVER_ALLOWED_IMAGE_TYPES,
    LOCAL_COVER_ALLOWED_IMAGE_EXTENSIONS,
    LOCAL_COVER_MAX_SOURCE_BYTES,
    "封面图片"
  );
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(objectUrl);
    return coverCanvasDataUrl(image, image.naturalWidth, image.naturalHeight);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function videoFileToCoverDataUrl(file) {
  assertAllowedFile(
    file,
    LOCAL_COVER_ALLOWED_VIDEO_TYPES,
    LOCAL_COVER_ALLOWED_VIDEO_EXTENSIONS,
    LOCAL_VIDEO_FRAME_MAX_SOURCE_BYTES,
    "本地视频"
  );
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  try {
    video.src = objectUrl;
    video.load();
    await onceMediaEvent(video, "loadedmetadata", 12000, "视频信息读取失败，无法截取首帧。");
    const targetTime = Number.isFinite(video.duration) && video.duration > 0.2 ? 0.08 : 0;
    if (targetTime > 0) {
      video.currentTime = targetTime;
      await onceMediaEvent(video, "seeked", 12000, "视频首帧定位失败，请换一个视频文件。");
    } else {
      await onceMediaEvent(video, "loadeddata", 12000, "视频画面读取失败，请换一个视频文件。");
    }
    return coverCanvasDataUrl(video, video.videoWidth, video.videoHeight);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function thumbnailSourceLabel(value) {
  if (!value) {
    return "暂无封面";
  }
  if (/^data:image\//i.test(value)) {
    return "本地封面预览 · 已压缩为站内数据";
  }
  if (/^\//.test(value) || /^assets\//i.test(value)) {
    return "站内封面预览";
  }
  try {
    const url = new URL(value, window.location.origin);
    return `链接封面预览 · ${url.hostname || "未知来源"}`;
  } catch (error) {
    return "链接封面预览";
  }
}

function toLocalDateTimeInputValue(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function normalizePublishedAtForApi(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return undefined;
  }
  const date = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    throw new Error("发布时间格式不正确，请使用日期时间选择器或 ISO 时间。");
  }
  return date.toISOString();
}

function createEmptyStateElement(text) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  setElementText(empty, text);
  return empty;
}

function setElementText(element, text) {
  element.textContent = text;
  element.title = text;
  return element;
}

function createTableCell(text, className = "") {
  const cell = document.createElement("td");
  if (className) {
    cell.className = className;
  }
  cell.textContent = text;
  cell.title = text;
  return cell;
}

function createCopyableCodeTableCell(value, label) {
  const text = value || "未记录";
  const cell = document.createElement("td");
  const group = document.createElement("span");
  const code = document.createElement("code");
  cell.className = "table-code table-copy-cell";
  cell.title = `${label}：${text}`;
  group.className = "table-copy-group";
  code.className = "table-copy-value";
  code.textContent = text;
  code.title = text;
  group.append(code);
  if (value) {
    const button = document.createElement("button");
    button.className = "table-inline-copy";
    button.type = "button";
    button.textContent = "复制";
    button.title = `复制${label}`;
    button.setAttribute("aria-label", `复制${label}`);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyAdminText(value, button);
    });
    group.append(button);
  }
  cell.append(group);
  return cell;
}

function createMetricTableCell(value) {
  return createTableCell(formatNumber(value), "table-metric");
}

function createTimeTableCell(value) {
  return createTableCell(formatTime(value), "table-time");
}

function createStackedTableCell(primaryText, secondaryText, className = "") {
  const cell = document.createElement("td");
  const secondary = document.createElement("small");
  if (className) {
    cell.className = className;
  }
  cell.title = [primaryText, secondaryText].filter(Boolean).join(" · ");
  cell.append(document.createTextNode(primaryText), document.createElement("br"));
  secondary.textContent = secondaryText;
  secondary.title = secondaryText;
  cell.append(secondary);
  return cell;
}

function createEmptyTableRow(colspan, text) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  const empty = document.createElement("span");
  cell.colSpan = colspan;
  empty.className = "empty-inline";
  setElementText(empty, text);
  cell.append(empty);
  row.append(cell);
  return row;
}

function syncTableWrapLabel(tbody, label) {
  const wrap = tbody?.closest?.(".table-wrap");
  if (!wrap || !label) {
    return;
  }
  const fullLabel = `${label}，窄屏可横向滑动查看完整表格`;
  wrap.title = fullLabel;
  wrap.setAttribute("aria-label", fullLabel);
}

function syncBoxLabel(element, label) {
  if (!element || !label) {
    return;
  }
  element.title = label;
  element.setAttribute("aria-label", label);
}

function syncButtonHint(button, hint) {
  if (!button || !hint) {
    return;
  }
  button.title = hint;
  button.setAttribute("aria-label", hint);
}

function createStatusBadgeElement(text, tone = "neutral") {
  const safeTone = String(tone || "neutral").replace(/[^a-z0-9_-]/gi, "");
  const badge = document.createElement("span");
  badge.className = "status-badge";
  if (safeTone) {
    badge.classList.add(safeTone);
  }
  badge.textContent = text;
  badge.title = text;
  return badge;
}

function articleStatusLabel(status) {
  const labels = {
    draft: "草稿",
    published: "已发布",
    archived: "已归档"
  };
  return labels[status] || status || "未知";
}

function getStatusTone(text) {
  const value = (text || "").trim();
  const isBusy = Boolean(value) && /正在|读取中|保存中|发布中|删除中|刷新中|识别中|停用中|隐藏中|恢复中/.test(value);
  const isError = Boolean(value) && (/失败|错误|不能|请先|请补齐|请填写|请等待|缺少|无效|过大|不支持|异常|拒绝|权限|HTTP\s*[45]\d\d/.test(value) || /\b(not found|forbidden|unauthorized|internal server error|error)\b/i.test(value));
  return {
    busy: isBusy && !isError,
    error: isError
  };
}

function applyStatusTone(element) {
  const tone = getStatusTone(element.textContent);
  element.classList.toggle("is-busy", tone.busy);
  element.classList.toggle("is-error", tone.error);
}

function setStatus(text, options = {}) {
  const force = Boolean(options.force);
  if (!force && Date.now() < state.statusHoldUntil) {
    return;
  }
  const refreshState = $("#refresh-state");
  setElementText(refreshState, text);
  refreshState.setAttribute("aria-label", text);
  applyStatusTone(refreshState);
  if (options.holdMs) {
    state.statusHoldUntil = Date.now() + options.holdMs;
  } else if (force) {
    state.statusHoldUntil = 0;
  }
}

function panelDataKey(panel) {
  return overviewPanels.has(panel) ? "overview" : panel;
}

function updateRefreshButton() {
  const button = $("#manual-refresh");
  const panelName = panelMeta[state.activePanel]?.[0] || "当前标签";
  const staticPanel = staticPanels.has(state.activePanel);
  const busy = !staticPanel && Boolean(state.loadingPanels[panelDataKey(state.activePanel)]);
  const buttonText = staticPanel ? "无需刷新" : (busy ? "刷新中..." : "刷新");
  const buttonLabel = staticPanel ? `${panelName}无需刷新` : (busy ? `${panelName}正在刷新` : `刷新${panelName}`);
  button.disabled = staticPanel || busy;
  button.setAttribute("aria-busy", busy ? "true" : "false");
  button.setAttribute("aria-label", buttonLabel);
  button.title = staticPanel ? `${panelName}为本地内容，无需刷新` : buttonLabel;
  button.textContent = buttonText;
}

function getStoredActivePanel() {
  try {
    const panel = window.sessionStorage.getItem(ACTIVE_PANEL_STORAGE_KEY);
    return validPanels.has(panel) ? panel : "dashboard";
  } catch (error) {
    return "dashboard";
  }
}

function rememberActivePanel(panel) {
  try {
    window.sessionStorage.setItem(ACTIVE_PANEL_STORAGE_KEY, panel);
  } catch (error) {
    // 忽略浏览器隐私模式或存储策略导致的写入失败。
  }
}

async function loadPanelData(panel, options = {}) {
  if (staticPanels.has(panel)) {
    setStatus("当前标签为本地内容，无需刷新。");
    updateRefreshButton();
    return;
  }

  const key = panelDataKey(panel);
  const force = Boolean(options.force);
  if (state.loadingPanels[key]) {
    if (!overviewPanels.has(panel)) {
      setStatus("当前标签正在读取，请稍候...");
    }
    updateRefreshButton();
    return state.loadingPanels[key];
  }
  if (!force && state.loadedPanels[key]) {
    return;
  }

  state.loadingPanels[key] = (async () => {
    try {
      let completionStatus = "";
      if (!overviewPanels.has(panel)) {
        setStatus(force ? "正在刷新当前标签..." : "正在读取当前标签...");
      }

      if (overviewPanels.has(panel)) {
        await loadOverview();
      } else if (panel === "articles") {
        try {
          await loadArticles();
        } catch (error) {
          renderArticleListNotice(`读取文章列表失败：${error.message}`, "文章列表错误");
          throw new Error(`文章列表：${error.message}`);
        }
      } else if (panel === "videos") {
        const videoResults = await Promise.allSettled([loadVideoCategories(), loadVideos()]);
        const videoErrors = [];
        if (videoResults[0].status === "rejected") {
          const message = videoResults[0].reason?.message || "未知错误";
          renderVideoCategoryChecksNotice(`读取视频分类失败：${message}`, "视频分类错误");
          videoErrors.push(`视频分类：${message}`);
        }
        if (videoResults[1].status === "rejected") {
          const message = videoResults[1].reason?.message || "未知错误";
          renderVideoListNotice(`读取视频列表失败：${message}`, "视频列表错误");
          videoErrors.push(`视频列表：${message}`);
        }
        if (videoErrors.length) {
          throw new Error(videoErrors.join("；"));
        }
      } else if (panel === "videoCategories") {
        try {
          await loadVideoCategories();
        } catch (error) {
          renderVideoCategoryListNotice(`读取分类列表失败：${error.message}`, "分类列表错误");
          throw new Error(`分类列表：${error.message}`);
        }
      } else if (panel === "chat") {
        const chatResults = await Promise.allSettled([loadChatMessages(), loadBans()]);
        const chatErrors = [];
        if (chatResults[0].status === "rejected") {
          const message = chatResults[0].reason?.message || "未知错误";
          renderChatListNotice(`读取聊天记录失败：${message}`, "聊天记录错误");
          chatErrors.push(`聊天记录：${message}`);
        }
        if (chatResults[1].status === "rejected") {
          const message = chatResults[1].reason?.message || "未知错误";
          renderBanListNotice(`读取禁言列表失败：${message}`, "禁言列表错误");
          chatErrors.push(`禁言列表：${message}`);
        }
        if (chatErrors.length) {
          throw new Error(chatErrors.join("；"));
        }
      } else if (panel === "accounts") {
        try {
          const accountResult = await loadAccounts();
          completionStatus = accountResult?.partialError || "";
        } catch (error) {
          renderAccountListNotice(`读取账号列表失败：${error.message}`, "账号列表错误");
          throw new Error(`账号列表：${error.message}`);
        }
      } else if (panel === "socialLinks") {
        try {
          await loadSocialLinks();
        } catch (error) {
          renderSocialLinkPreviewNotice(`读取社交链接失败：${error.message}`, "社交链接错误");
          throw new Error(`社交链接：${error.message}`);
        }
      }

      state.loadedPanels[key] = Date.now();
      if (!overviewPanels.has(panel)) {
        setStatus(completionStatus || `已读取 ${panelMeta[panel][0]}`);
      }
    } catch (error) {
      setStatus(error.message);
    } finally {
      delete state.loadingPanels[key];
      updateRefreshButton();
      updateSidebarLoadedSummary();
    }
  })();

  updateRefreshButton();
  return state.loadingPanels[key];
}

function applyActivePanel(panel) {
  state.activePanel = panel;
  $$(".nav-button").forEach((button) => {
    const active = button.dataset.panel === panel;
    button.classList.toggle("active", active);
    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
  $$(".panel").forEach((item) => {
    const active = item.id === `${panel}-panel`;
    item.classList.toggle("active", active);
    item.hidden = !active;
    item.setAttribute("aria-hidden", active ? "false" : "true");
  });
  setElementText($("#panel-title"), panelMeta[panel][0]);
  setElementText($("#panel-subtitle"), panelMeta[panel][1]);
  if (panel === "dashboard" && state.overview) {
    window.requestAnimationFrame(renderVisitorMapFromOverview);
  }
}

async function switchPanel(panel, options = {}) {
  if (!validPanels.has(panel)) {
    return false;
  }
  if (panel === state.activePanel) {
    if (state.mobileNavOpen) {
      closeMobileNav({ restoreFocus: false });
    }
    if (options.focusTitle) {
      window.requestAnimationFrame(() => $("#panel-title")?.focus());
    }
    return true;
  }
  const previousPanel = state.activePanel;
  return runGuardedTransition(
    activeEditorPanel(),
    `切换到“${panelMeta[panel][0]}”会离开当前编辑内容。`,
    async () => {
      if (state.masterDetail[previousPanel]) {
        setMasterDetailView(previousPanel, "list", { focus: false, restore: false });
      }
      applyActivePanel(panel);
      rememberActivePanel(panel);
      if (state.masterDetail[panel]) {
        setMasterDetailView(panel, "list", { focus: false, restore: true });
      }
      replaceAdminHistoryView(panel, "list");
      updateRefreshButton();
      if (state.mobileNavOpen) {
        closeMobileNav({ restoreFocus: false });
      }
      await loadPanelData(panel);
      if (options.focusTitle) {
        window.requestAnimationFrame(() => $("#panel-title")?.focus());
      }
      return true;
    }
  );
}

async function handleNavKeydown(event, index, buttons) {
  const nextIndex = {
    ArrowDown: (index + 1) % buttons.length,
    ArrowRight: (index + 1) % buttons.length,
    ArrowUp: (index - 1 + buttons.length) % buttons.length,
    ArrowLeft: (index - 1 + buttons.length) % buttons.length,
    Home: 0,
    End: buttons.length - 1
  }[event.key];
  if (nextIndex === undefined) {
    return;
  }
  event.preventDefault();
  const next = buttons[nextIndex];
  const switched = await switchPanel(next.dataset.panel);
  (switched ? next : buttons[index]).focus();
}

function autoRefreshActivePanel() {
  if (document.hidden || !overviewPanels.has(state.activePanel)) {
    return false;
  }
  loadPanelData(state.activePanel, { force: true });
  return true;
}

async function loadMe() {
  const payload = await api("/api/admin/me");
  state.user = payload.user;
  $("#admin-email").textContent = payload.user.email;
}

async function loadOverview() {
  setStatus("正在刷新数据...");
  const payload = await api("/api/admin/analytics/overview?days=14");
  state.overview = payload;
  renderOverview();
  setStatus(`已刷新 ${formatTime(payload.generatedAt)}`);
}

function renderOverview() {
  if (!state.overview) {
    return;
  }
  $("#analytics-explainer").textContent = "统计口径：浏览量是页面被打开的次数，独立访客数是去重后的访客人数。已登录账号按账号合并，同一账号多设备、多次访问也只算 1 个独立访客；匿名访问继续按隐藏访客标识统计。";
  renderDashboardHero(state.overview.cards || {});
  renderDashboardInsightStrip();
  renderKpis(state.overview.cards);
  renderDailyChart(state.overview.daily || []);
  renderHourlyChart(state.overview.hourly || []);
  if (state.activePanel === "dashboard") {
    renderMap(overviewMapRows());
  }
  renderTopPages(state.overview.topPages || []);
  renderTopArticles(state.overview.topArticles || []);
  renderDashboardCountries(state.overview.countries || []);
  renderSiteRankings(state.overview.topPages || []);
  renderVisitTables();
  renderClickPanels();
}

function renderDashboardHero(cards) {
  const topPages = state.overview?.topPages || [];
  const countries = state.overview?.countries || [];
  const topArticles = state.overview?.topArticles || [];
  const pageCount = topPages.length;
  const countryCount = countries.length;
  const articleCount = topArticles.length;
  setElementText($("#dashboard-live-total"), formatNumber(cards.todayPv));
  setElementText($("#dashboard-live-subtitle"), `近 5 分钟活跃 · ${formatNumber(cards.onlineVisitors)} 个访客 / ${formatNumber(pageCount)} 个页面有访问`);
  setElementText($("#tracked-sites-count"), formatNumber(pageCount));
  setElementText($("#tracked-properties-count"), formatNumber(countryCount));
  setElementText($("#tracked-property-summary"), `${formatNumber(pageCount)} 个页面 · ${formatNumber(countryCount)} 个地区 · ${formatNumber(articleCount)} 篇文章`);
}

function renderDashboardInsightStrip() {
  const box = $("#dashboard-insight-strip");
  if (!box) {
    return;
  }
  const overview = state.overview || {};
  const topPage = overview.topPages?.[0];
  const topCountry = overview.countries?.[0];
  const topArticle = overview.topArticles?.[0];
  const topClick = overview.topClicks?.[0];
  const items = [
    topPage ? {
      label: "最热页面",
      value: pageDisplayName(topPage.path || topPage.route, topPage.route),
      detail: `浏览 ${formatNumber(topPage.pv)}`
    } : null,
    topCountry ? {
      label: "主要地区",
      value: countryDisplayName(topCountry.country),
      detail: `浏览 ${formatNumber(topCountry.pv)}`
    } : null,
    topArticle ? {
      label: "热门文章",
      value: topArticle.title || articleSlugLabels[topArticle.slug] || "未命名文章",
      detail: `浏览 ${formatNumber(topArticle.pv)}`
    } : null,
    topClick ? {
      label: "最高点击",
      value: clickTargetDisplayName(topClick),
      detail: `点击 ${formatNumber(topClick.clicks)}`
    } : null
  ].filter(Boolean);
  syncBoxLabel(box, items.length ? "访问洞察摘要" : "访问洞察摘要：暂无数据");
  if (!items.length) {
    box.replaceChildren(createEmptyStateElement("暂无可提炼的访问洞察"));
    return;
  }
  box.replaceChildren(...items.map(createInsightSummaryChip));
}

function createInsightSummaryChip(item) {
  const chip = document.createElement("article");
  const label = document.createElement("span");
  const value = document.createElement("strong");
  const detail = document.createElement("small");
  const text = `${item.label}：${item.value}，${item.detail}`;
  chip.className = "dashboard-insight-chip";
  chip.tabIndex = 0;
  chip.title = text;
  chip.setAttribute("aria-label", text);
  setElementText(label, item.label);
  setElementText(value, item.value);
  setElementText(detail, item.detail);
  chip.append(label, value, detail);
  return chip;
}

function renderKpis(cards = {}) {
  const items = [
    ["今日页面浏览", cards.todayPv, "所有页面打开次数，刷新也会计入。", 0],
    ["今日独立访客", cards.todayUv, "登录账号按账号合并；匿名访客按隐藏访客标识计算。", 3],
    [`最近 ${state.overview?.windowDays || 14} 天浏览`, cards.totalPv, "这段时间内站内页面被打开的总次数。", 5],
    [`最近 ${state.overview?.windowDays || 14} 天访客`, cards.totalUv, "用于判断真实触达人数，登录用户多设备仍合并为 1 个独立访客。", 7],
    ["今日点击动作", cards.todayClicks, "按钮、卡片、筛选和播放等可点击操作次数。", 9],
    ["正在活跃", cards.onlineVisitors, "最近 5 分钟内有访问记录的访客或登录账号。", 11],
    ["今日聊天消息", cards.todayMessages, "匿名聊天室今天实际发出的消息数。", 13]
  ];
  const topPages = state.overview?.topPages || [];
  const countries = state.overview?.countries || [];
  const sparkRows = state.overview?.hourly?.length ? state.overview.hourly : (state.overview?.daily || []);
  $("#kpi-grid").replaceChildren(...items.map(([label, value, hint, offset], index) => {
    const card = document.createElement("article");
    const header = document.createElement("div");
    const title = document.createElement("h3");
    const number = document.createElement("strong");
    const lists = document.createElement("div");
    const quota = document.createElement("small");
    card.className = "kpi-card property-card";
    const formattedValue = formatNumber(value);
    const cardLabel = `${label}：${formattedValue}。${hint}`;
    card.tabIndex = 0;
    card.title = cardLabel;
    card.setAttribute("aria-label", cardLabel);
    header.className = "property-card-head";
    lists.className = "property-card-lists";
    quota.className = "property-quota";
    setElementText(title, label);
    setElementText(number, formattedValue);
    setElementText(quota, `口径：${hint}`);
    header.append(title, number);
    lists.append(
      createPropertyMiniList("热门页面", rotateRows(topPages, index).slice(0, 4), "path", "pv"),
      createPropertyMiniList("国家 / 地区", rotateRows(countries, index).slice(0, 3), "country", "pv")
    );
    card.append(header, createSparkBars(sparkRows, offset), lists, quota);
    return card;
  }));
}

function rotateRows(rows, offset) {
  if (!rows.length) {
    return [];
  }
  const normalized = offset % rows.length;
  return [...rows.slice(normalized), ...rows.slice(0, normalized)];
}

function createSparkBars(rows, offset = 0) {
  const spark = document.createElement("div");
  spark.className = "property-sparkline";
  if (!rows.length) {
    spark.classList.add("is-empty");
    return spark;
  }
  const sample = rotateRows(rows, offset).slice(0, 24);
  const max = Math.max(1, ...sample.map((row) => Number(row.pv || 0)));
  sample.forEach((row) => {
    const bar = document.createElement("span");
    const height = Math.max(2, Math.round((Number(row.pv || 0) / max) * 100));
    bar.style.height = `${height}%`;
    bar.title = `浏览 ${formatNumber(row.pv)} / 访客 ${formatNumber(row.uv)}`;
    spark.append(bar);
  });
  return spark;
}

function createPropertyMiniList(titleText, rows, labelKey, valueKey) {
  const box = document.createElement("div");
  const title = document.createElement("h4");
  box.className = "property-mini-list";
  setElementText(title, titleText);
  box.append(title);
  if (!rows.length) {
    const empty = document.createElement("p");
    setElementText(empty, titleText.includes("国家") ? "暂无地区数据" : "暂无页面数据");
    box.append(empty);
    return box;
  }
  rows.forEach((row) => {
    const item = document.createElement("p");
    const label = document.createElement("span");
    const value = document.createElement("strong");
    const labelText = labelKey === "country"
      ? countryDisplayName(row.country)
      : pageDisplayName(row.path || row.route || row.title, row.route);
    setElementText(label, labelText);
    setElementText(value, formatNumber(row[valueKey]));
    item.append(label, value);
    box.append(item);
  });
  return box;
}

function renderDailyChart(rows) {
  const windowDays = state.overview?.windowDays || 14;
  $("#daily-range").textContent = `最近 ${windowDays} 天 · ${formatNumber(rows.length)} 条`;
  renderBars($("#daily-chart"), rows, "day");
}

function renderHourlyChart(rows) {
  $("#hourly-range").textContent = `服务器时间 · ${formatNumber(rows.length)} 个小时`;
  renderBars($("#hourly-chart"), rows, "hour");
}

function renderBars(container, rows, labelKey) {
  const chartLabel = labelKey === "hour" ? "今日小时走势" : "每日浏览 / 访客";
  if (!rows.length) {
    const emptyText = `${chartLabel}：暂无图表数据`;
    container.title = emptyText;
    container.setAttribute("aria-label", emptyText);
    container.replaceChildren(createEmptyStateElement("暂无图表数据"));
    return;
  }
  const chartText = `${chartLabel}：${formatNumber(rows.length)} 条数据`;
  container.title = chartText;
  container.setAttribute("aria-label", chartText);
  const max = Math.max(1, ...rows.map((row) => Number(row.pv || 0)));
  container.replaceChildren(...rows.map((row) => {
    const height = Math.max(2, Math.round((Number(row.pv || 0) / max) * 100));
    const label = labelKey === "hour" ? String(row.hour || "").slice(11, 16) : String(row.day || "").slice(5);
    const cell = document.createElement("div");
    const stack = document.createElement("div");
    const fill = document.createElement("div");
    const labelNode = document.createElement("div");
    const pointLabel = `${label}：浏览 ${formatNumber(row.pv)} / 访客 ${formatNumber(row.uv)}`;
    cell.className = "bar-cell";
    cell.tabIndex = 0;
    cell.setAttribute("role", "img");
    cell.setAttribute("aria-label", pointLabel);
    cell.title = pointLabel;
    stack.className = "bar-stack";
    fill.className = "bar-fill";
    fill.style.height = `${height}%`;
    labelNode.className = "bar-label";
    labelNode.textContent = label;
    stack.append(fill);
    cell.append(stack, labelNode);
    return cell;
  }));
}

function renderMap(rows) {
  if (state.mapViewport.pointers.size) {
    state.mapViewport.pendingRows = rows;
    return;
  }
  state.mapViewport.pendingRows = null;
  const map = $("#visitor-map");
  const points = $("#visitor-map-points");
  const list = $("#visitor-map-list");
  const focusedNode = document.activeElement?.closest?.(".map-point, .map-data-focus");
  const focusedKey = focusedNode?.dataset.mapKey || "";
  const focusedKind = focusedNode?.classList.contains("map-data-focus") ? "list" : "point";
  const windowDays = Number(state.overview?.windowDays || 14);
  const data = rows
    .filter((row) => Number(row.pv || 0) > 0 && isUsableCoordinate(Number(row.latitude), Number(row.longitude)))
    .sort((a, b) => Number(b.pv || 0) - Number(a.pv || 0))
    .slice(0, 80);
  setElementText($("#visitor-map-range"), `最近 ${formatNumber(windowDays)} 天 · 城市聚合`);
  state.mapViewport.rows = data;
  state.mapViewport.rowsByKey = new Map();
  state.mapViewport.pointElements = new Map();
  if (!data.length) {
    const emptyText = `城市访问地图：最近 ${formatNumber(windowDays)} 天暂无带经纬度的城市访问数据`;
    map.setAttribute("aria-label", emptyText);
    map.classList.add("is-empty");
    const empty = document.createElement("span");
    empty.className = "map-empty";
    setElementText(empty, "暂无可定位的城市访问数据");
    points.replaceChildren(empty);
    clearMapSelection();
    resetMapViewport({ announce: false });
    list?.replaceChildren(createEmptyStateElement("暂无地图来源数据"));
    return;
  }
  map.classList.remove("is-empty");
  const mapLabel = `可缩放城市访问地图：最近 ${formatNumber(windowDays)} 天共 ${formatNumber(data.length)} 个城市点；可使用滚轮、双指或缩放按钮查看`;
  map.setAttribute("aria-label", mapLabel);
  const max = Math.max(...data.map((row) => Number(row.pv || 0)), 1);
  const mapBounds = getVisibleMapBounds(map);
  points.replaceChildren(...data.map((row, index) => {
    const lon = Number(row.longitude);
    const lat = Number(row.latitude);
    const { left, top } = projectCoordinateToVisibleMap(lon, lat, mapBounds);
    const size = 12 + Math.round((Number(row.pv || 0) / max) * 18);
    const label = mapPlaceLabel(row);
    const key = mapLocationKey(row, index);
    const point = document.createElement("span");
    const pointLabel = document.createElement("span");
    point.className = "map-point";
    point.tabIndex = 0;
    point.setAttribute("role", "button");
    point.dataset.mapKey = key;
    point.dataset.mapLeft = String(left);
    point.dataset.mapTop = String(top);
    point.style.left = `${left}%`;
    point.style.top = `${top}%`;
    point.style.setProperty("--point-size", `${size}px`);
    point.style.zIndex = String(10 + Math.round((Number(row.pv || 0) / max) * 20));
    const pointTitle = `${label}；PV 浏览量 ${formatNumber(row.pv)}；UV 独立访客 ${formatNumber(row.uv)}。点击可固定详情。`;
    point.setAttribute("aria-pressed", state.mapViewport.pinnedKey === key ? "true" : "false");
    pointLabel.className = "map-point-label";
    setElementText(pointLabel, pointTitle);
    point.append(pointLabel);
    state.mapViewport.rowsByKey.set(key, row);
    state.mapViewport.pointElements.set(key, point);
    return point;
  }));
  renderMapDataList(data);
  clampMapViewport();
  applyMapViewport();
  if (state.mapViewport.pinnedKey && state.mapViewport.rowsByKey.has(state.mapViewport.pinnedKey)) {
    showMapLocation(state.mapViewport.pinnedKey, { pin: true });
  } else {
    clearMapSelection();
  }
  restoreMapFocus(focusedKey, focusedKind);
}

function renderMapDataList(rows) {
  const list = $("#visitor-map-list");
  if (!list) {
    return;
  }
  if (!rows.length) {
    list.replaceChildren(createEmptyStateElement("暂无地图来源数据"));
    return;
  }
  list.replaceChildren(...rows.map((row, index) => {
    const item = document.createElement("article");
    const action = document.createElement("button");
    const place = document.createElement("strong");
    const metrics = document.createElement("span");
    const detail = document.createElement("small");
    const label = mapPlaceLabel(row);
    const key = mapLocationKey(row, index);
    const detailText = [
      `坐标 ${Number(row.latitude).toFixed(2)}, ${Number(row.longitude).toFixed(2)}`,
      row.last_seen_at ? `最近访问 ${formatTime(row.last_seen_at)}` : "最近访问未记录"
    ].join(" · ");
    item.className = "map-data-item";
    item.setAttribute("role", "listitem");
    action.className = "map-data-focus";
    action.type = "button";
    action.dataset.mapKey = key;
    action.setAttribute("aria-controls", "visitor-map");
    action.setAttribute("aria-label", `在地图中查看 ${label}，PV 浏览量 ${formatNumber(row.pv)}，UV 独立访客 ${formatNumber(row.uv)}`);
    setElementText(place, label);
    setElementText(metrics, `PV ${formatNumber(row.pv)} / UV ${formatNumber(row.uv)}`);
    setElementText(detail, detailText);
    action.append(place, metrics);
    item.append(action, detail);
    return item;
  }));
}

function restoreMapFocus(key, kind) {
  if (!key) {
    return;
  }
  const target = kind === "list"
    ? [...$$("#visitor-map-list .map-data-focus")].find((item) => item.dataset.mapKey === key)
    : state.mapViewport.pointElements.get(key);
  target?.focus({ preventScroll: true });
}

function overviewMapRows() {
  if (!state.overview) {
    return [];
  }
  return state.overview.cities || [];
}

function renderVisitorMapFromOverview() {
  renderMap(overviewMapRows());
}

function mapLocationKey(row, index = 0) {
  const place = [row.country, row.region, row.city].map((value) => String(value || "").trim()).join("|");
  if (place.replaceAll("|", "")) {
    return place;
  }
  return `${Number(row.latitude).toFixed(4)}|${Number(row.longitude).toFixed(4)}|${index}`;
}

function mapRegionLabel(row) {
  return [countryDisplayName(row.country), row.region].filter(Boolean).join(" · ") || "地区未记录";
}

function showMapLocation(key, options = {}) {
  const row = state.mapViewport.rowsByKey.get(key);
  const point = state.mapViewport.pointElements.get(key);
  const tooltip = $("#visitor-map-tooltip");
  if (!row || !point || !tooltip) {
    return false;
  }
  if (options.pin) {
    state.mapViewport.pinnedKey = key;
  }
  state.mapViewport.visibleKey = key;
  state.mapViewport.pointElements.forEach((item, itemKey) => {
    const active = itemKey === key;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", state.mapViewport.pinnedKey === itemKey ? "true" : "false");
  });
  setElementText($("#visitor-map-tooltip-city"), row.city || row.region || countryDisplayName(row.country) || "未知城市");
  setElementText($("#visitor-map-tooltip-region"), mapRegionLabel(row));
  setElementText($("#visitor-map-tooltip-pv"), formatNumber(row.pv));
  setElementText($("#visitor-map-tooltip-uv"), formatNumber(row.uv));
  setElementText($("#visitor-map-tooltip-time"), row.last_seen_at ? `最近访问 ${formatTime(row.last_seen_at)}` : "最近访问未记录");
  tooltip.hidden = false;
  positionMapTooltip();
  if (options.announce) {
    announceMap(`${mapPlaceLabel(row)}，PV 浏览量 ${formatNumber(row.pv)}，UV 独立访客 ${formatNumber(row.uv)}`);
  }
  return true;
}

function positionMapTooltip() {
  const map = $("#visitor-map");
  const tooltip = $("#visitor-map-tooltip");
  const point = state.mapViewport.pointElements.get(state.mapViewport.visibleKey);
  if (!map || !tooltip || tooltip.hidden || !point) {
    return;
  }
  tooltip.style.visibility = "hidden";
  const mapRect = map.getBoundingClientRect();
  const pointRect = point.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const gap = 10;
  const edge = 8;
  const pointCenterX = pointRect.left + pointRect.width / 2 - mapRect.left;
  let left = pointCenterX - tooltipRect.width / 2;
  let top = pointRect.top - mapRect.top - tooltipRect.height - gap;
  if (top < edge) {
    top = pointRect.bottom - mapRect.top + gap;
  }
  left = clampNumber(left, edge, Math.max(edge, mapRect.width - tooltipRect.width - edge));
  top = clampNumber(top, edge, Math.max(edge, mapRect.height - tooltipRect.height - edge));
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
  tooltip.style.visibility = "";
}

function restorePinnedMapTooltip() {
  if (state.mapViewport.pinnedKey && state.mapViewport.rowsByKey.has(state.mapViewport.pinnedKey)) {
    showMapLocation(state.mapViewport.pinnedKey, { pin: true });
    return;
  }
  hideMapTooltip();
}

function hideMapTooltip() {
  const tooltip = $("#visitor-map-tooltip");
  state.mapViewport.visibleKey = "";
  state.mapViewport.pointElements.forEach((point, key) => {
    point.classList.toggle("is-active", key === state.mapViewport.pinnedKey);
  });
  if (tooltip) {
    tooltip.hidden = true;
    tooltip.style.removeProperty("left");
    tooltip.style.removeProperty("top");
    tooltip.style.removeProperty("visibility");
  }
}

function clearMapSelection(options = {}) {
  const hadSelection = Boolean(state.mapViewport.pinnedKey || state.mapViewport.visibleKey);
  state.mapViewport.pinnedKey = "";
  state.mapViewport.pointElements.forEach((point) => {
    point.classList.remove("is-active");
    point.setAttribute("aria-pressed", "false");
  });
  hideMapTooltip();
  if (hadSelection && options.announce) {
    announceMap("已关闭城市详情");
  }
}

function announceMap(message) {
  setElementText($("#visitor-map-announcement"), message);
}

function clampMapViewport() {
  const map = $("#visitor-map");
  const viewport = state.mapViewport;
  if (!map) {
    return;
  }
  const width = map.clientWidth;
  const height = map.clientHeight;
  viewport.scale = clampNumber(viewport.scale, MAP_MIN_SCALE, MAP_MAX_SCALE);
  const minX = Math.min(0, width - width * viewport.scale);
  const minY = Math.min(0, height - height * viewport.scale);
  viewport.x = clampNumber(viewport.x, minX, 0);
  viewport.y = clampNumber(viewport.y, minY, 0);
  if (viewport.scale === MAP_MIN_SCALE) {
    viewport.x = 0;
    viewport.y = 0;
  }
}

function applyMapViewport(options = {}) {
  const map = $("#visitor-map");
  const world = $("#visitor-map-world");
  if (!map || !world) {
    return;
  }
  clampMapViewport();
  const viewport = state.mapViewport;
  world.style.setProperty("--map-scale", String(viewport.scale));
  world.style.setProperty("--map-inverse-scale", String(1 / viewport.scale));
  world.style.setProperty("--map-x", `${viewport.x}px`);
  world.style.setProperty("--map-y", `${viewport.y}px`);
  map.classList.toggle("is-zoomed", viewport.scale > MAP_MIN_SCALE + 0.001);
  syncMapControls();
  positionMapTooltip();
  if (options.announce) {
    announceMap(options.announce);
  }
}

function syncMapControls() {
  const viewport = state.mapViewport;
  const zoomOut = $("#visitor-map-zoom-out");
  const zoomIn = $("#visitor-map-zoom-in");
  const reset = $("#visitor-map-reset");
  const zoomStatus = $("#visitor-map-zoom-status");
  const zoomLabel = `${Math.round(viewport.scale * 100)}%`;
  if (zoomStatus?.textContent !== zoomLabel) {
    setElementText(zoomStatus, zoomLabel);
  }
  if (zoomOut) {
    zoomOut.disabled = viewport.scale <= MAP_MIN_SCALE + 0.001;
  }
  if (zoomIn) {
    zoomIn.disabled = viewport.scale >= MAP_MAX_SCALE - 0.001;
  }
  if (reset) {
    reset.disabled = viewport.scale <= MAP_MIN_SCALE + 0.001 && Math.abs(viewport.x) < 0.5 && Math.abs(viewport.y) < 0.5;
  }
}

function setMapZoom(nextScale, clientX, clientY, options = {}) {
  const map = $("#visitor-map");
  if (!map) {
    return false;
  }
  const viewport = state.mapViewport;
  const scale = clampNumber(nextScale, MAP_MIN_SCALE, MAP_MAX_SCALE);
  if (Math.abs(scale - viewport.scale) < 0.001) {
    return false;
  }
  const rect = map.getBoundingClientRect();
  const anchorX = Number.isFinite(clientX) ? clampNumber(clientX - rect.left, 0, rect.width) : rect.width / 2;
  const anchorY = Number.isFinite(clientY) ? clampNumber(clientY - rect.top, 0, rect.height) : rect.height / 2;
  const worldX = (anchorX - viewport.x) / viewport.scale;
  const worldY = (anchorY - viewport.y) / viewport.scale;
  viewport.scale = scale;
  viewport.x = anchorX - worldX * scale;
  viewport.y = anchorY - worldY * scale;
  applyMapViewport(options);
  return true;
}

function resetMapViewport(options = {}) {
  state.mapViewport.scale = MAP_MIN_SCALE;
  state.mapViewport.x = 0;
  state.mapViewport.y = 0;
  applyMapViewport({ announce: options.announce === false ? "" : "地图已复位到 100%" });
}

function panMapBy(deltaX, deltaY, options = {}) {
  const viewport = state.mapViewport;
  const previousX = viewport.x;
  const previousY = viewport.y;
  viewport.x += deltaX;
  viewport.y += deltaY;
  applyMapViewport(options);
  return Math.abs(previousX - viewport.x) > 0.1 || Math.abs(previousY - viewport.y) > 0.1;
}

function focusMapLocation(key) {
  const map = $("#visitor-map");
  const point = state.mapViewport.pointElements.get(key);
  const row = state.mapViewport.rowsByKey.get(key);
  if (!map || !point || !row) {
    return false;
  }
  const targetScale = Math.max(state.mapViewport.scale, 2.25);
  const left = Number(point.dataset.mapLeft || 50) / 100;
  const top = Number(point.dataset.mapTop || 50) / 100;
  state.mapViewport.scale = targetScale;
  state.mapViewport.x = map.clientWidth / 2 - map.clientWidth * left * targetScale;
  state.mapViewport.y = map.clientHeight / 2 - map.clientHeight * top * targetScale;
  applyMapViewport();
  showMapLocation(key, { pin: true, announce: true });
  point.focus({ preventScroll: true });
  return true;
}

function handleMapWheel(event) {
  const delta = clampNumber(event.deltaY, -120, 120);
  const nextScale = state.mapViewport.scale * Math.exp(-delta * 0.0025);
  if (!setMapZoom(nextScale, event.clientX, event.clientY)) {
    return;
  }
  event.preventDefault();
  const map = event.currentTarget;
  map.classList.add("is-interacting");
  window.clearTimeout(state.mapViewport.wheelTimer);
  state.mapViewport.wheelTimer = window.setTimeout(() => map.classList.remove("is-interacting"), 120);
}

function mapPointerDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function beginMapPinch(map) {
  const pointers = [...state.mapViewport.pointers.values()].slice(0, 2);
  if (pointers.length < 2) {
    return;
  }
  const rect = map.getBoundingClientRect();
  const midpointX = (pointers[0].x + pointers[1].x) / 2 - rect.left;
  const midpointY = (pointers[0].y + pointers[1].y) / 2 - rect.top;
  state.mapViewport.pinchStart = {
    distance: Math.max(1, mapPointerDistance(pointers[0], pointers[1])),
    scale: state.mapViewport.scale,
    worldX: (midpointX - state.mapViewport.x) / state.mapViewport.scale,
    worldY: (midpointY - state.mapViewport.y) / state.mapViewport.scale
  };
  state.mapViewport.dragStart = null;
  state.mapViewport.moved = true;
  state.mapViewport.suppressClick = true;
  map.classList.add("is-interacting");
  state.mapViewport.pointers.forEach((_, pointerId) => {
    try {
      map.setPointerCapture(pointerId);
    } catch {
      // The pointer may already have ended between events.
    }
  });
}

function handleMapPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }
  const map = event.currentTarget;
  state.mapViewport.pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    pointerType: event.pointerType
  });
  if (state.mapViewport.pointers.size === 1) {
    state.mapViewport.dragStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      mapX: state.mapViewport.x,
      mapY: state.mapViewport.y,
      pointerType: event.pointerType
    };
    state.mapViewport.moved = false;
  } else if (state.mapViewport.pointers.size === 2) {
    beginMapPinch(map);
  }
}

function handleMapPointerMove(event) {
  const map = event.currentTarget;
  const pointer = state.mapViewport.pointers.get(event.pointerId);
  if (!pointer) {
    return;
  }
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  if (state.mapViewport.pointers.size >= 2) {
    if (!state.mapViewport.pinchStart) {
      beginMapPinch(map);
    }
    const pointers = [...state.mapViewport.pointers.values()].slice(0, 2);
    const start = state.mapViewport.pinchStart;
    const rect = map.getBoundingClientRect();
    const midpointX = (pointers[0].x + pointers[1].x) / 2 - rect.left;
    const midpointY = (pointers[0].y + pointers[1].y) / 2 - rect.top;
    const distance = Math.max(1, mapPointerDistance(pointers[0], pointers[1]));
    state.mapViewport.scale = clampNumber(start.scale * (distance / start.distance), MAP_MIN_SCALE, MAP_MAX_SCALE);
    state.mapViewport.x = midpointX - start.worldX * state.mapViewport.scale;
    state.mapViewport.y = midpointY - start.worldY * state.mapViewport.scale;
    applyMapViewport();
    event.preventDefault();
    return;
  }
  const drag = state.mapViewport.dragStart;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }
  if (drag.pointerType === "touch" && state.mapViewport.scale <= MAP_MIN_SCALE + 0.001) {
    return;
  }
  const deltaX = event.clientX - drag.x;
  const deltaY = event.clientY - drag.y;
  const dragThreshold = drag.pointerType === "touch" ? 9 : MAP_DRAG_THRESHOLD;
  if (!state.mapViewport.moved && Math.hypot(deltaX, deltaY) < dragThreshold) {
    return;
  }
  if (!state.mapViewport.moved) {
    state.mapViewport.moved = true;
    state.mapViewport.suppressClick = true;
    map.classList.add("is-interacting");
    try {
      map.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is a progressive enhancement for mouse and touch drags.
    }
  }
  state.mapViewport.x = drag.mapX + deltaX;
  state.mapViewport.y = drag.mapY + deltaY;
  applyMapViewport();
  event.preventDefault();
}

function handleMapPointerEnd(event) {
  const map = $("#visitor-map");
  if (!state.mapViewport.pointers.has(event.pointerId)) {
    return;
  }
  state.mapViewport.pointers.delete(event.pointerId);
  if (map?.hasPointerCapture?.(event.pointerId)) {
    map.releasePointerCapture(event.pointerId);
  }
  if (state.mapViewport.pointers.size === 1) {
    const [pointerId, pointer] = state.mapViewport.pointers.entries().next().value;
    state.mapViewport.pinchStart = null;
    state.mapViewport.dragStart = {
      pointerId,
      x: pointer.x,
      y: pointer.y,
      mapX: state.mapViewport.x,
      mapY: state.mapViewport.y,
      pointerType: pointer.pointerType
    };
    return;
  }
  if (state.mapViewport.pointers.size > 1) {
    beginMapPinch(map);
    return;
  }
  state.mapViewport.dragStart = null;
  state.mapViewport.pinchStart = null;
  map?.classList.remove("is-interacting");
  if (state.mapViewport.moved) {
    state.mapViewport.suppressClick = true;
    window.setTimeout(() => {
      state.mapViewport.suppressClick = false;
    }, 0);
  }
  state.mapViewport.moved = false;
  schedulePendingMapRender();
}

function handleMapLostPointerCapture(event) {
  if (event.target !== event.currentTarget) {
    return;
  }
  handleMapPointerEnd(event);
}

function clearMapPointers() {
  const map = $("#visitor-map");
  state.mapViewport.pointers.clear();
  state.mapViewport.dragStart = null;
  state.mapViewport.pinchStart = null;
  state.mapViewport.moved = false;
  state.mapViewport.suppressClick = false;
  map?.classList.remove("is-interacting");
  schedulePendingMapRender();
}

function schedulePendingMapRender() {
  if (!state.mapViewport.pendingRows || state.mapViewport.pointers.size || state.mapViewport.pendingRenderTimer) {
    return;
  }
  state.mapViewport.pendingRenderTimer = window.setTimeout(() => {
    state.mapViewport.pendingRenderTimer = null;
    if (state.mapViewport.pointers.size || !state.mapViewport.pendingRows) {
      return;
    }
    const rows = state.mapViewport.pendingRows;
    state.mapViewport.pendingRows = null;
    renderMap(rows);
  }, 0);
}

function handleMapKeydown(event) {
  const point = event.target.closest(".map-point");
  if (point && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    point.click();
    return;
  }
  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    setMapZoom(state.mapViewport.scale + MAP_ZOOM_STEP, undefined, undefined, { announce: `地图缩放至 ${Math.round(clampNumber(state.mapViewport.scale + MAP_ZOOM_STEP, MAP_MIN_SCALE, MAP_MAX_SCALE) * 100)}%` });
    return;
  }
  if (event.key === "-") {
    event.preventDefault();
    setMapZoom(state.mapViewport.scale - MAP_ZOOM_STEP, undefined, undefined, { announce: `地图缩放至 ${Math.round(clampNumber(state.mapViewport.scale - MAP_ZOOM_STEP, MAP_MIN_SCALE, MAP_MAX_SCALE) * 100)}%` });
    return;
  }
  if (event.key === "Home" || event.key === "0") {
    event.preventDefault();
    resetMapViewport();
    return;
  }
  if (event.key === "Escape") {
    if (state.mapViewport.pinnedKey || state.mapViewport.visibleKey) {
      event.preventDefault();
      clearMapSelection({ announce: true });
    }
    return;
  }
  const movement = {
    ArrowLeft: [MAP_KEYBOARD_PAN_STEP, 0],
    ArrowRight: [-MAP_KEYBOARD_PAN_STEP, 0],
    ArrowUp: [0, MAP_KEYBOARD_PAN_STEP],
    ArrowDown: [0, -MAP_KEYBOARD_PAN_STEP]
  }[event.key];
  if (movement && panMapBy(...movement)) {
    event.preventDefault();
    announceMap(`地图位置已移动，当前缩放 ${Math.round(state.mapViewport.scale * 100)}%`);
  }
}

function handleMapClick(event) {
  if (state.mapViewport.suppressClick) {
    event.preventDefault();
    return;
  }
  const point = event.target.closest(".map-point");
  if (point) {
    const key = point.dataset.mapKey || "";
    if (state.mapViewport.pinnedKey === key) {
      clearMapSelection({ announce: true });
    } else {
      showMapLocation(key, { pin: true, announce: true });
    }
    return;
  }
  if (!event.target.closest(".map-tooltip")) {
    clearMapSelection({ announce: true });
  }
}

function handleMapPointerOver(event) {
  if (event.pointerType === "touch") {
    return;
  }
  const point = event.target.closest(".map-point");
  if (!point || point.contains(event.relatedTarget)) {
    return;
  }
  showMapLocation(point.dataset.mapKey || "");
}

function handleMapPointerOut(event) {
  if (event.pointerType === "touch") {
    return;
  }
  const point = event.target.closest(".map-point");
  if (!point || point.contains(event.relatedTarget)) {
    return;
  }
  if (document.activeElement === point) {
    return;
  }
  restorePinnedMapTooltip();
}

function handleMapFocusIn(event) {
  const point = event.target.closest(".map-point");
  if (point) {
    showMapLocation(point.dataset.mapKey || "", { announce: true });
  }
}

function handleMapFocusOut(event) {
  if (!event.target.closest(".map-point")) {
    return;
  }
  window.setTimeout(() => {
    if (!$("#visitor-map")?.contains(document.activeElement) || !document.activeElement.closest?.(".map-point")) {
      restorePinnedMapTooltip();
    }
  }, 0);
}

function handleMapDataListClick(event) {
  const action = event.target.closest(".map-data-focus");
  if (action) {
    focusMapLocation(action.dataset.mapKey || "");
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    $("#visitor-map")?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  }
}

function getVisibleMapBounds(map) {
  const rect = map.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return { left: 0, top: 0, width: 100, height: 100 };
  }
  const containerAspect = rect.width / rect.height;
  if (containerAspect > WORLD_MAP_ASPECT_RATIO) {
    const width = (WORLD_MAP_ASPECT_RATIO / containerAspect) * 100;
    return {
      left: (100 - width) / 2,
      top: 0,
      width,
      height: 100
    };
  }
  const height = (containerAspect / WORLD_MAP_ASPECT_RATIO) * 100;
  return {
    left: 0,
    top: (100 - height) / 2,
    width: 100,
    height
  };
}

function projectCoordinateToVisibleMap(lon, lat, bounds) {
  const lonRatio = clampNumber((lon + 180) / 360, 0, 1);
  const latRatio = clampNumber((90 - lat) / 180, 0, 1);
  const edgePadding = 1.4;
  return {
    left: clampNumber(
      bounds.left + lonRatio * bounds.width,
      bounds.left + edgePadding,
      bounds.left + bounds.width - edgePadding
    ),
    top: clampNumber(
      bounds.top + latRatio * bounds.height,
      bounds.top + edgePadding,
      bounds.top + bounds.height - edgePadding
    )
  };
}

function isUsableCoordinate(lat, lon) {
  return Number.isFinite(lat)
    && Number.isFinite(lon)
    && lat >= -90
    && lat <= 90
    && lon >= -180
    && lon <= 180
    && (Math.abs(lat) > 0.0001 || Math.abs(lon) > 0.0001);
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mapPlaceLabel(row) {
  return [countryDisplayName(row.country), row.region, row.city].filter(Boolean).join(" / ") || "未知位置";
}

function renderTopPages(rows) {
  const box = $("#top-pages");
  const pvTotal = rows.reduce((sum, row) => sum + Number(row.pv || 0), 0);
  const visibleRows = rows.slice(0, 6);
  const countText = rows.length
    ? `展示前 ${formatNumber(visibleRows.length)} / 共 ${formatNumber(rows.length)} 个页面 · 浏览 ${formatNumber(pvTotal)}`
    : "0 个页面";
  setElementText($("#top-pages-count"), countText);
  syncBoxLabel(box, rows.length ? `页面概览：${countText}` : "页面概览：暂无数据");
  if (!rows.length) {
    box.replaceChildren(createEmptyStateElement("暂无页面访问数据"));
    return;
  }
  const max = Math.max(1, ...visibleRows.map((row) => Number(row.pv || 0)));
  box.replaceChildren(...visibleRows.map((row, index) => createInsightBarItem({
    rank: index + 1,
    label: pageDisplayName(row.path || row.route, row.route),
    detail: pageDisplayDetail(row.path || row.route, row.route) || "站内页面",
    value: row.pv,
    secondaryValue: row.uv,
    max,
    lastSeenAt: row.last_seen_at
  })));
}

function createInsightBarItem({ rank, label, detail, value, secondaryValue, max, lastSeenAt, primaryLabel = "浏览", secondaryLabel = "访客" }) {
  const item = document.createElement("article");
  const rankNode = document.createElement("span");
  const body = document.createElement("div");
  const title = document.createElement("strong");
  const meta = document.createElement("small");
  const track = document.createElement("i");
  const fill = document.createElement("span");
  const metrics = document.createElement("b");
  const pv = Number(value || 0);
  const uv = Number(secondaryValue || 0);
  const width = Math.max(4, Math.round((pv / Math.max(1, Number(max || 0))) * 100));
  const lastSeen = lastSeenAt ? ` · 最近 ${formatTime(lastSeenAt)}` : "";
  const itemLabel = `${rank}. ${label}：${primaryLabel} ${formatNumber(pv)}，${secondaryLabel} ${formatNumber(uv)}${lastSeen}`;
  item.className = "insight-bar-item";
  item.tabIndex = 0;
  item.setAttribute("role", "listitem");
  item.title = itemLabel;
  item.setAttribute("aria-label", itemLabel);
  rankNode.className = "insight-bar-rank";
  body.className = "insight-bar-body";
  meta.className = "insight-bar-meta";
  track.className = "insight-bar-track";
  fill.className = "insight-bar-fill";
  metrics.className = "insight-bar-value";
  fill.style.width = `${width}%`;
  setElementText(rankNode, String(rank));
  setElementText(title, label || "未记录页面");
  setElementText(meta, [detail, `${secondaryLabel} ${formatNumber(uv)}`, lastSeenAt ? `最近 ${formatTime(lastSeenAt)}` : ""].filter(Boolean).join(" · ") || "暂无细节");
  setElementText(metrics, `${formatNumber(pv)} ${primaryLabel}`);
  track.append(fill);
  body.append(title, meta, track);
  item.append(rankNode, body, metrics);
  return item;
}

function renderTopArticles(rows) {
  const box = $("#top-articles");
  const pvTotal = rows.reduce((sum, row) => sum + Number(row.pv || 0), 0);
  const visibleRows = rows.slice(0, 8);
  const countText = rows.length
    ? `展示前 ${formatNumber(visibleRows.length)} / 共 ${formatNumber(rows.length)} 篇 · 浏览 ${formatNumber(pvTotal)}`
    : "0 篇文章";
  setElementText($("#top-articles-count"), countText);
  syncBoxLabel(box, rows.length ? `热门文章：${countText}` : "热门文章：暂无数据");
  if (!rows.length) {
    box.replaceChildren(createEmptyStateElement("暂无热门文章数据"));
    return;
  }
  const max = Math.max(1, ...visibleRows.map((row) => Number(row.pv || 0)));
  box.replaceChildren(...visibleRows.map((row, index) => createInsightBarItem({
    rank: index + 1,
    label: row.title || articleSlugLabels[row.slug] || "未命名文章",
    detail: row.category ? `分类：${categoryDisplayName(row.category)}` : "知识库文章",
    value: row.pv,
    secondaryValue: row.uv,
    max,
    lastSeenAt: row.last_seen_at
  })));
}

function renderVisitTables() {
  const overview = state.overview || {};
  const countryBox = $("#country-table");
  const countries = overview.countries || [];
  const countryPvTotal = countries.reduce((sum, row) => sum + Number(row.pv || 0), 0);
  const visibleCountries = countries.slice(0, 8);
  const countryCountText = countries.length
    ? `展示前 ${formatNumber(visibleCountries.length)} / 共 ${formatNumber(countries.length)} 个地区 · 浏览 ${formatNumber(countryPvTotal)}`
    : "0 个地区";
  setElementText($("#country-table-count"), countryCountText);
  syncBoxLabel(countryBox, countries.length ? `国家来源：${countryCountText}` : "国家来源：暂无数据");
  if (!countries.length) {
    countryBox.replaceChildren(createEmptyStateElement("暂无国家来源数据"));
  } else {
    const max = Math.max(1, ...visibleCountries.map((row) => Number(row.pv || 0)));
    countryBox.replaceChildren(...visibleCountries.map((row, index) => createInsightBarItem({
      rank: index + 1,
      label: countryDisplayName(row.country),
      detail: "访问来源",
      value: row.pv,
      secondaryValue: row.uv,
      max,
      lastSeenAt: row.last_seen_at
    })));
  }

  const regionTable = $("#region-table");
  const regionBars = $("#region-bars");
  const regions = overview.regions || [];
  const regionPrefixCount = regions.filter((row) => row.ip_prefix).length;
  const regionPvTotal = regions.reduce((sum, row) => sum + Number(row.pv || 0), 0);
  const regionFilterText = normalizeFilterText(state.regionFilter);
  const visibleRegions = regionFilterText
    ? regions.filter((row) => regionMatchesFilter(row, regionFilterText))
    : regions;
  const regionCountText = regions.length
    ? `${regionFilterText ? `显示 ${formatNumber(visibleRegions.length)} / ` : ""}共 ${formatNumber(regions.length)} 条 · 浏览 ${formatNumber(regionPvTotal)} · ${formatNumber(regionPrefixCount)} 条含网络前缀`
    : "0 条来源";
  setElementText($("#region-table-count"), regionCountText);
  syncTableWrapLabel(regionTable, regions.length ? `地区与网络来源：${regionCountText}` : "地区与网络来源：暂无数据");
  syncBoxLabel(regionBars, regions.length ? `地区来源概览：${regionCountText}` : "地区来源概览：暂无数据");
  if (!regions.length) {
    regionBars.replaceChildren(createEmptyStateElement("暂无地区来源数据"));
    regionTable.replaceChildren(createEmptyTableRow(5, "暂无地区来源数据"));
    return;
  }
  if (!visibleRegions.length) {
    regionBars.replaceChildren(createEmptyStateElement("没有匹配的地区来源"));
    regionTable.replaceChildren(createEmptyTableRow(5, "没有匹配的地区来源，换个国家、地区、城市或网络前缀试试。"));
    return;
  }
  renderRegionBars(regionBars, visibleRegions);
  regionTable.replaceChildren(...visibleRegions.map((row) => {
    const place = mapPlaceLabel(row);
    const tableRow = document.createElement("tr");
    tableRow.append(
      createTableCell(place),
      createCopyableCodeTableCell(row.ip_prefix || "", "网络前缀"),
      createMetricTableCell(row.pv),
      createMetricTableCell(row.uv),
      createTimeTableCell(row.last_seen_at)
    );
    return tableRow;
  }));
}

function renderClickPanels() {
  const overview = state.overview || {};
  const topClicks = $("#top-clicks");
  const topRows = overview.topClicks || [];
  const clickTotal = topRows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const clickCountText = topRows.length
    ? `共 ${formatNumber(topRows.length)} 个目标 · 点击 ${formatNumber(clickTotal)}`
    : "0 个目标";
  setElementText($("#top-clicks-count"), clickCountText);
  syncBoxLabel(topClicks, topRows.length ? `点击热点：${clickCountText}` : "点击热点：暂无数据");
  if (!topRows.length) {
    topClicks.replaceChildren(createEmptyStateElement("暂无点击热点数据"));
  } else {
    const visibleClicks = topRows.slice(0, 8);
    const max = Math.max(1, ...visibleClicks.map((row) => Number(row.clicks || 0)));
    topClicks.replaceChildren(...visibleClicks.map((row, index) => createInsightBarItem({
      rank: index + 1,
      label: clickTargetDisplayName(row),
      detail: pageDisplayName(row.path || row.route, row.route),
      value: row.clicks,
      secondaryValue: row.uv,
      max,
      lastSeenAt: row.last_seen_at,
      primaryLabel: "点击",
      secondaryLabel: "访客"
    })));
  }

  const recentClicks = overview.recentClicks || [];
  const recentClickPageBars = $("#recent-click-page-bars");
  const clickFilterText = normalizeFilterText(state.clickFilter);
  const visibleRecentClicks = clickFilterText
    ? recentClicks.filter((row) => clickEventMatchesFilter(row, clickFilterText))
    : recentClicks;
  const clickSizeCount = recentClicks.filter((row) => Number(row.screen_width || 0) > 0 && Number(row.screen_height || 0) > 0).length;
  const recentCountText = recentClicks.length
    ? `${clickFilterText ? `显示 ${formatNumber(visibleRecentClicks.length)} / ` : ""}共 ${formatNumber(recentClicks.length)} 条 · ${formatNumber(clickSizeCount)} 条含尺寸`
    : "0 条事件";
  setElementText($("#recent-clicks-count"), recentCountText);
  syncBoxLabel($("#recent-clicks"), recentClicks.length ? `最近点击：${recentCountText}` : "最近点击：暂无数据");
  syncBoxLabel(recentClickPageBars, recentClicks.length ? `点击页面概览：${recentCountText}` : "点击页面概览：暂无数据");
  if (!recentClicks.length) {
    recentClickPageBars.replaceChildren(createEmptyStateElement("暂无点击页面概览"));
  } else if (!visibleRecentClicks.length) {
    recentClickPageBars.replaceChildren(createEmptyStateElement("没有匹配的点击页面"));
  } else {
    renderRecentClickPageBars(recentClickPageBars, visibleRecentClicks);
  }
  renderEventList("#recent-clicks", visibleRecentClicks, clickFilterText ? "没有匹配的点击事件，换个目标、页面、来源或尺寸试试。" : "暂无点击事件", (row) => (
    createEventItemElement(clickTargetDisplayName(row), [
      `页面：${pageDisplayName(row.path || row.route, row.route)} · 时间：${formatTime(row.created_at)} · 来源：${mapPlaceLabel(row)}`,
      `目标位置：${clickRouteDisplayName(row)} · ${formatClickScreenSize(row)}`
    ])
  ));
}

function renderRecentClickPageBars(box, rows) {
  const pageRows = aggregateRecentClicksByPage(rows).slice(0, 6);
  const max = Math.max(1, ...pageRows.map((row) => row.clicks));
  box.replaceChildren(...pageRows.map((row, index) => createInsightBarItem({
    rank: index + 1,
    label: row.label,
    detail: row.detail,
    value: row.clicks,
    secondaryValue: row.targets,
    max,
    lastSeenAt: row.lastSeenAt,
    primaryLabel: "点击",
    secondaryLabel: "目标"
  })));
}

function aggregateRecentClicksByPage(rows) {
  const pages = new Map();
  rows.forEach((row) => {
    const label = pageDisplayName(row.path || row.route, row.route);
    const detail = pageDisplayDetail(row.path || row.route, row.route) || "站内页面";
    const key = `${label}::${detail}`;
    const item = pages.get(key) || { label, detail, clicks: 0, targets: new Set(), lastSeenAt: "" };
    item.clicks += 1;
    item.targets.add(clickTargetDisplayName(row));
    if (!item.lastSeenAt || new Date(row.created_at || 0) > new Date(item.lastSeenAt || 0)) {
      item.lastSeenAt = row.created_at || item.lastSeenAt;
    }
    pages.set(key, item);
  });
  return [...pages.values()]
    .map((item) => ({ ...item, targets: item.targets.size }))
    .sort((a, b) => (b.clicks - a.clicks) || (new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0)));
}

function clickEventMatchesFilter(row, filterText) {
  if (!filterText) {
    return true;
  }
  const searchText = [
    clickTargetDisplayName(row),
    clickRouteDisplayName(row),
    pageDisplayName(row.path || row.route, row.route),
    pageDisplayDetail(row.path || row.route, row.route),
    mapPlaceLabel(row),
    row.country,
    row.region,
    row.city,
    row.ip_prefix,
    formatClickScreenSize(row),
    formatTime(row.created_at)
  ].filter(Boolean).join(" ").toLowerCase();
  return searchText.includes(filterText);
}

function clickTargetDisplayName(row) {
  const text = String(row.target_text || "").trim();
  if (text) {
    return text;
  }
  const key = String(row.target_key || row.data_route || row.tag_name || "").trim();
  if (!key) {
    return "未知点击";
  }
  const cleaned = key
    .replace(/^#/, "")
    .replace(/^data[-_]?route[:=]?/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return cleaned ? `目标：${cleaned}` : "未知点击";
}

function clickRouteDisplayName(row) {
  const route = String(row.data_route || row.target_key || "").trim();
  if (!route) {
    return "未记录目标位置";
  }
  const page = pageDisplayName(route, route);
  return page === "站内页面" ? clickTargetDisplayName(row) : page;
}

function renderDashboardCountries(rows) {
  const box = $("#dashboard-countries");
  const count = $("#dashboard-countries-count");
  if (!box || !count) {
    return;
  }
  const pvTotal = rows.reduce((sum, row) => sum + Number(row.pv || 0), 0);
  const visibleRows = rows.slice(0, 6);
  const countText = rows.length
    ? `展示前 ${formatNumber(visibleRows.length)} / 共 ${formatNumber(rows.length)} 个地区 · 浏览 ${formatNumber(pvTotal)}`
    : "0 个地区";
  setElementText(count, countText);
  syncBoxLabel(box, rows.length ? `地区概览：${countText}` : "地区概览：暂无数据");
  if (!rows.length) {
    box.replaceChildren(createEmptyStateElement("暂无地区来源数据"));
    return;
  }
  const max = Math.max(1, ...visibleRows.map((row) => Number(row.pv || 0)));
  box.replaceChildren(...visibleRows.map((row, index) => createInsightBarItem({
    rank: index + 1,
    label: countryDisplayName(row.country),
    detail: row.region || row.city || "访问来源",
    value: row.pv,
    secondaryValue: row.uv,
    max,
    lastSeenAt: row.last_seen_at
  })));
}

function renderSiteRankings(rows) {
  const list = $("#site-rankings");
  const count = $("#site-rankings-count");
  if (!list || !count) {
    return;
  }
  const rankingRows = rows.slice(0, 6);
  const pvTotal = rows.reduce((sum, row) => sum + Number(row.pv || 0), 0);
  const countText = rows.length
    ? `展示前 ${formatNumber(rankingRows.length)} / 共 ${formatNumber(rows.length)} 个页面 · 浏览 ${formatNumber(pvTotal)}`
    : "0 个页面";
  setElementText(count, countText);
  syncBoxLabel(list, rankingRows.length ? `实时页面表现：${countText}` : "实时页面表现：暂无数据");
  if (!rankingRows.length) {
    list.replaceChildren(createEmptyStateElement("暂无实时页面数据"));
    return;
  }
  const max = Math.max(1, ...rankingRows.map((row) => Number(row.pv || 0)));
  list.replaceChildren(...rankingRows.map((row, index) => createInsightBarItem({
    rank: index + 1,
    label: pageDisplayName(row.path || row.route, row.route),
    detail: pageDisplayDetail(row.path || row.route, row.route) || "站内页面",
    value: row.pv,
    secondaryValue: row.uv,
    max,
    lastSeenAt: row.last_seen_at
  })));
}

function formatClickScreenSize(row) {
  const width = Number(row.screen_width || 0);
  const height = Number(row.screen_height || 0);
  return width > 0 && height > 0
    ? `设备 ${formatNumber(width)} × ${formatNumber(height)}`
    : "设备尺寸未记录";
}

async function loadArticles() {
  const payload = await api("/api/admin/articles");
  state.articles = payload.articles || [];
  if (state.selectedArticleId && !state.articles.some((article) => article.article_id === state.selectedArticleId)) {
    resetArticleForm();
    $("#article-status").textContent = "当前文章已不在列表中，已清空编辑表单。";
    return;
  }
  renderArticleList();
}

function renderArticleList() {
  const list = $("#article-list");
  const publishedCount = state.articles.filter((article) => article.status === "published").length;
  const completeTranslationCount = state.articles.filter((article) => Number(article.translation_count || 0) >= 3).length;
  const filterText = normalizeFilterText(state.articleFilter);
  const visibleArticles = filterText
    ? state.articles.filter((article) => articleMatchesArticleFilter(article, filterText))
    : state.articles;
  const countText = state.articles.length
    ? `${filterText ? `显示 ${formatNumber(visibleArticles.length)} / ` : ""}共 ${formatNumber(state.articles.length)} 篇 · 已发布 ${formatNumber(publishedCount)} · 三语完整 ${formatNumber(completeTranslationCount)}`
    : "0 篇文章";
  setElementText($("#article-list-count"), countText);
  renderArticleStatusOverview(visibleArticles, Boolean(filterText));
  syncBoxLabel(list, state.articles.length ? `文章列表：${countText}` : "文章列表：暂无文章");
  updateSidebarLoadedSummary();
  if (!state.articles.length) {
    list.replaceChildren(createEmptyStateElement("暂无文章，点击右上角“新建”开始。"));
    syncArticleListBusyState();
    return;
  }
  if (!visibleArticles.length) {
    list.replaceChildren(createEmptyStateElement("没有匹配的文章，换个标题、路径标识、分类或标签试试。"));
    syncArticleListBusyState();
    return;
  }

  list.replaceChildren(...visibleArticles.map((article) => {
    const item = document.createElement("button");
    const title = document.createElement("span");
    const meta = document.createElement("span");
    const summary = document.createElement("span");
    item.className = "list-item";
    if (article.article_id === state.selectedArticleId) {
      item.classList.add("active");
    }
    item.type = "button";
    item.dataset.articleId = article.article_id || "";
    item.disabled = isArticleWriteBusy();
    item.dataset.readyTitle = articleListLabel(article);
    item.title = item.dataset.readyTitle;
    item.setAttribute("aria-label", item.dataset.readyTitle);
    item.setAttribute("aria-pressed", article.article_id === state.selectedArticleId ? "true" : "false");
    title.className = "list-title";
    setElementText(title, adminArticleDisplayTitle(article));
    meta.className = "list-meta";
    meta.append(
      createStatusBadgeElement(articleStatusLabel(article.status), article.status || "neutral"),
      createStatusBadgeElement(`${article.translation_count || 0}/3 语种`, Number(article.translation_count || 0) >= 3 ? "visible" : "warning"),
      createStatusBadgeElement(categoryDisplayName(article.category) || "未分类", "neutral")
    );
    summary.className = "list-subtle";
    setElementText(summary, `标识：${article.slug || "未记录"} · 浏览 ${formatNumber(article.article_pv)} / 访客 ${formatNumber(article.article_uv)} · 更新 ${formatTime(article.updated_at)}`);
    item.append(title, meta, summary);
    return item;
  }));
  syncArticleListBusyState();
}

function renderArticleStatusOverview(articles, isFiltered) {
  const box = $("#article-status-overview");
  if (!box) {
    return;
  }
  const rows = articles || [];
  const items = [
    [isFiltered ? "当前显示" : "全部文章", rows.length],
    ["已发布", rows.filter((article) => article.status === "published").length],
    ["草稿", rows.filter((article) => article.status === "draft").length],
    ["归档", rows.filter((article) => article.status === "archived").length],
    ["置顶", rows.filter((article) => Number(article.is_pinned || article.pinned || 0) > 0).length],
    ["三语完整", rows.filter((article) => Number(article.translation_count || 0) >= 3).length]
  ];
  box.replaceChildren(...items.map(([label, value]) => createListOverviewItem(label, value)));
}

function createListOverviewItem(label, value) {
  const item = document.createElement("span");
  const text = document.createElement("span");
  const number = document.createElement("strong");
  item.className = "list-overview-item";
  setElementText(text, label);
  setElementText(number, formatNumber(value));
  item.append(text, number);
  return item;
}

function updateSidebarLoadedSummary() {
  const target = $("#sidebar-loaded-summary");
  if (!target) {
    return;
  }
  const parts = [
    state.articles.length ? `文章 ${formatNumber(state.articles.length)}` : "",
    state.videos.length ? `视频 ${formatNumber(state.videos.length)}` : "",
    state.chatMessages.length ? `消息 ${formatNumber(state.chatMessages.length)}` : "",
    state.accounts.length ? `账号 ${formatNumber(state.accounts.length)}` : ""
  ].filter(Boolean);
  setElementText(target, parts.length ? `已加载：${parts.slice(0, 4).join(" · ")}` : "内容数据按需加载");
}

function adminUpdateRoundNumber(item) {
  const match = String(item?.body || "").match(/第\s*(\d+)\s*轮/i);
  return match ? Number(match[1]) : 0;
}

function normalizeFilterText(value) {
  return String(value || "").trim().toLowerCase();
}

function articleMatchesArticleFilter(article, filterText) {
  if (!filterText) {
    return true;
  }
  const searchText = [
    adminArticleDisplayTitle(article),
    article.slug,
    article.category,
    categoryDisplayName(article.category),
    article.tags,
    article.status,
    articleStatusLabel(article.status)
  ].filter(Boolean).join(" ").toLowerCase();
  return searchText.includes(filterText);
}

function renderArticleListNotice(text, label = "文章列表提示") {
  const list = $("#article-list");
  setElementText($("#article-list-count"), label);
  syncBoxLabel(list, `${label}：${text}`);
  list.replaceChildren(createEmptyStateElement(text));
  syncArticleListBusyState();
}

function articleListLabel(article) {
  const status = articleStatusLabel(article.status);
  const translationCount = Number(article.translation_count || 0);
  const translationLabel = translationCount >= 3 ? "三语完整" : `三语缺 ${formatNumber(3 - translationCount)} 项`;
  return [
    adminArticleDisplayTitle(article),
    `路径标识 ${article.slug || "未记录"}`,
    status,
    categoryDisplayName(article.category) || "未分类",
    `${formatNumber(translationCount)}/3 语种，${translationLabel}`,
    `浏览 ${formatNumber(article.article_pv)} / 访客 ${formatNumber(article.article_uv)}`,
    `更新 ${formatTime(article.updated_at)}`
  ].join("；");
}

function adminArticleDisplayTitle(article = {}) {
  return article.title
    || article.translations?.zh?.title
    || article.translations?.en?.title
    || article.translations?.ja?.title
    || articleSlugLabels[article.slug]
    || article.slug
    || "未命名文章";
}

async function selectArticle(articleId) {
  state.selectedArticleId = articleId;
  state.articleDetailReady = false;
  resetArticleEditorForSelection(articleId, "正在读取文章详情...");
  renderArticleList();
  syncArticleSaveButtons();
  try {
    const payload = await api(`/api/admin/articles/${encodeURIComponent(articleId)}`);
    if (state.selectedArticleId !== articleId) {
      return;
    }
    state.articleDetailReady = true;
    fillArticleForm(payload.article);
  } catch (error) {
    if (state.selectedArticleId === articleId) {
      state.articleDetailReady = false;
      resetArticleEditorForSelection(articleId, `读取文章详情失败：${error.message}`);
      syncArticleSaveButtons();
    }
  }
}

function resetArticleEditorForSelection(articleId, statusText) {
  const form = $("#article-form");
  const article = state.articles.find((item) => item.article_id === articleId);
  setElementText($("#article-editor-title"), article ? `读取中：${adminArticleDisplayTitle(article)}` : "正在读取文章");
  form.reset();
  form.elements.slug.value = article?.slug || "";
  form.elements.category.value = article?.category || "note";
  form.elements.status.value = article?.status || "draft";
  $("#delete-article").disabled = true;
  $("#article-status").textContent = statusText;
}

function resetArticleForm() {
  state.selectedArticleId = "";
  state.articleDetailReady = false;
  setElementText($("#article-editor-title"), "新建文章");
  $("#article-form").reset();
  $("#article-form").elements.category.value = "note";
  $("#article-form").elements.status.value = "draft";
  $("#delete-article").disabled = true;
  $("#article-status").textContent = "";
  setArticleLang(state.articleLang);
  clearArticleValidation();
  updateArticleLanguageStates();
  syncArticleSaveButtons();
  renderArticleList();
  captureEditorBaseline("articles");
}

function fillArticleForm(article) {
  const form = $("#article-form");
  setElementText($("#article-editor-title"), `编辑：${adminArticleDisplayTitle(article)}`);
  form.elements.slug.value = article.slug || "";
  form.elements.category.value = article.category || "note";
  form.elements.tags.value = (article.tags || []).join(", ");
  form.elements.cover_image.value = article.cover_image || "";
  form.elements.status.value = article.status || "draft";
  form.elements.published_at.value = toLocalDateTimeInputValue(article.published_at);
  form.elements.is_pinned.checked = Number(article.is_pinned || 0) === 1;
  ["zh", "en", "ja"].forEach((lang) => {
    const item = article.translations?.[lang] || {};
    form.elements[`title_${lang}`].value = item.title || "";
    form.elements[`summary_${lang}`].value = item.summary || "";
    form.elements[`content_${lang}`].value = item.content_markdown || "";
  });
  $("#delete-article").disabled = false;
  $("#article-status").textContent = `文章访问：总浏览 ${formatNumber(article.article_pv)} / 总访客 ${formatNumber(article.article_uv)}，今日浏览 ${formatNumber(article.article_today_pv)} / 今日访客 ${formatNumber(article.article_today_uv)}`;
  clearArticleValidation();
  updateArticleLanguageStates();
  syncArticleSaveButtons();
  captureEditorBaseline("articles");
}

function setArticleLang(lang) {
  state.articleLang = lang;
  $$(".lang-tab").forEach((button) => {
    const active = button.dataset.articleLang === lang;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
    button.tabIndex = active ? 0 : -1;
  });
  $$(".language-editor").forEach((panel) => {
    const active = panel.dataset.langPanel === lang;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
    panel.setAttribute("aria-hidden", active ? "false" : "true");
  });
}

function clearArticleValidation() {
  const summary = $("#article-error-summary");
  if (summary) {
    summary.hidden = true;
  }
  $("#article-error-list")?.replaceChildren();
  $$("#article-form .field-error[data-article-error]").forEach((item) => item.remove());
  $$("#article-form [aria-invalid='true']").forEach((field) => {
    field.removeAttribute("aria-invalid");
    const describedBy = String(field.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter((id) => id && !id.startsWith("article-error-"));
    if (describedBy.length) {
      field.setAttribute("aria-describedby", describedBy.join(" "));
    } else {
      field.removeAttribute("aria-describedby");
    }
  });
}

function articleValidationErrors() {
  const form = $("#article-form");
  const errors = [];
  if (!form.elements.slug.value.trim()) {
    errors.push({ name: "slug", lang: "", message: "请填写文章路径标识，用于生成公开文章地址。" });
  }
  ["zh", "en", "ja"].forEach((lang) => {
    if (!form.elements[`title_${lang}`].value.trim()) {
      errors.push({
        name: `title_${lang}`,
        lang,
        message: `请填写${articleLangLabel(lang)}标题。`
      });
    }
    if (!form.elements[`content_${lang}`].value.trim()) {
      errors.push({
        name: `content_${lang}`,
        lang,
        message: `请填写${articleLangLabel(lang)}正文（Markdown）。`
      });
    }
  });
  return errors;
}

function updateArticleLanguageStates(errors = articleValidationErrors()) {
  ["zh", "en", "ja"].forEach((lang) => {
    const stateNode = $(`[data-lang-state="${lang}"]`);
    if (!stateNode) {
      return;
    }
    const count = errors.filter((error) => error.lang === lang).length;
    stateNode.classList.toggle("has-errors", count > 0);
    stateNode.classList.toggle("is-complete", count === 0);
    setElementText(stateNode, count ? `缺 ${count} 项` : "完整");
    stateNode.title = count ? `${articleLangLabel(lang)}还有 ${count} 项必填内容` : `${articleLangLabel(lang)}必填内容完整`;
  });
}

function focusArticleValidationError(error) {
  if (error.lang) {
    setArticleLang(error.lang);
  }
  window.requestAnimationFrame(() => {
    const field = $("#article-form")?.elements?.[error.name];
    field?.scrollIntoView({ block: "center", behavior: "smooth" });
    field?.focus();
  });
}

function renderArticleValidation(errors) {
  clearArticleValidation();
  updateArticleLanguageStates(errors);
  if (!errors.length) {
    return;
  }
  const summary = $("#article-error-summary");
  const list = $("#article-error-list");
  errors.forEach((error) => {
    const field = $("#article-form")?.elements?.[error.name];
    if (field) {
      const errorText = document.createElement("small");
      const errorId = `article-error-${error.name}`;
      errorText.className = "field-error";
      errorText.dataset.articleError = error.name;
      errorText.id = errorId;
      setElementText(errorText, error.message);
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("aria-describedby", errorId);
      field.closest("label")?.append(errorText);
    }
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    setElementText(button, error.message);
    button.addEventListener("click", () => focusArticleValidationError(error));
    item.append(button);
    list.append(item);
  });
  summary.hidden = false;
  summary.focus();
}

function validateArticleDraft(options = {}) {
  const errors = articleValidationErrors();
  if (options.render !== false) {
    renderArticleValidation(errors);
  } else {
    updateArticleLanguageStates(errors);
  }
  return errors;
}

function articlePayload(statusOverride = "") {
  const form = $("#article-form");
  const errors = validateArticleDraft();
  if (errors.length) {
    const error = new Error(`发布前还有 ${errors.length} 项必填内容需要处理。`);
    error.validationErrors = errors;
    throw error;
  }
  const slug = form.elements.slug.value.trim();
  const translations = {};
  ["zh", "en", "ja"].forEach((lang) => {
    const title = form.elements[`title_${lang}`].value.trim();
    const summary = form.elements[`summary_${lang}`].value.trim();
    const content = form.elements[`content_${lang}`].value.trim();
    translations[lang] = { title, summary, content_markdown: content };
  });
  return {
    slug,
    category: form.elements.category.value.trim() || "note",
    tags: form.elements.tags.value.split(/[，,]/).map((item) => item.trim()).filter(Boolean),
    cover_image: form.elements.cover_image.value.trim(),
    status: statusOverride || form.elements.status.value,
    is_pinned: form.elements.is_pinned.checked,
    published_at: normalizePublishedAtForApi(form.elements.published_at.value),
    translations
  };
}

function articleLangLabel(lang) {
  return {
    zh: "中文",
    en: "英文",
    ja: "日文"
  }[lang] || "当前语言";
}

async function saveArticle(statusOverride = "") {
  if (state.articleSaving) {
    return false;
  }
  if (state.selectedArticleId && !state.articleDetailReady) {
    $("#article-status").textContent = "请等待文章详情读取完成后再保存。";
    syncArticleSaveButtons();
    return false;
  }
  state.articleSaving = true;
  state.articleSavingMode = statusOverride === "published" ? "publish" : "save";
  syncArticleSaveButtons();
  const status = $("#article-status");
  try {
    status.textContent = "正在保存...";
    const payload = articlePayload(statusOverride);
    const path = state.selectedArticleId
      ? `/api/admin/articles/${encodeURIComponent(state.selectedArticleId)}`
      : "/api/admin/articles";
    const method = state.selectedArticleId ? "PUT" : "POST";
    const result = await api(path, { method, body: JSON.stringify(payload) });
    state.selectedArticleId = result.articleId || state.selectedArticleId;
    status.textContent = "已保存。";
    await loadArticles();
    if (state.selectedArticleId) {
      await selectArticle(state.selectedArticleId);
      status.textContent = "已保存。";
    }
    captureEditorBaseline("articles", { saved: true });
    return true;
  } catch (error) {
    status.textContent = error.message;
    refreshEditorDirtyState("articles");
    return false;
  } finally {
    state.articleSaving = false;
    state.articleSavingMode = "";
    syncArticleSaveButtons();
  }
}

function syncArticleSaveButtons() {
  const saveButton = $("#save-article");
  const publishButton = $("#publish-article");
  const deleteButton = $("#delete-article");
  const busy = isArticleWriteBusy();
  const existingArticleNotReady = Boolean(state.selectedArticleId && !state.articleDetailReady);
  if (saveButton) {
    const savingDraft = state.articleSaving && state.articleSavingMode !== "publish";
    const hint = existingArticleNotReady
      ? "请先等待文章详情读取完成"
      : (state.articleDeleting
      ? "正在删除文章"
      : (state.articleSaving ? "正在保存文章" : "保存当前文章"));
    saveButton.disabled = busy || existingArticleNotReady;
    saveButton.textContent = savingDraft ? "保存中..." : "保存";
    saveButton.setAttribute("aria-busy", savingDraft ? "true" : "false");
    syncButtonHint(saveButton, hint);
  }
  if (publishButton) {
    const publishing = state.articleSaving && state.articleSavingMode === "publish";
    const hint = existingArticleNotReady
      ? "请先等待文章详情读取完成"
      : (state.articleDeleting
      ? "正在删除文章"
      : (state.articleSaving ? "正在保存文章" : "保存并发布当前文章"));
    publishButton.disabled = busy || existingArticleNotReady;
    publishButton.textContent = publishing ? "发布中..." : "保存并发布";
    publishButton.setAttribute("aria-busy", publishing ? "true" : "false");
    syncButtonHint(publishButton, hint);
  }
  if (deleteButton) {
    const hint = existingArticleNotReady
      ? "请先等待文章详情读取完成"
      : (busy
      ? (state.articleDeleting ? "正在删除文章" : "正在保存文章")
      : (state.selectedArticleId ? "删除当前文章" : "请先选择已保存文章"));
    deleteButton.disabled = busy || !state.selectedArticleId || existingArticleNotReady;
    deleteButton.textContent = state.articleDeleting ? "删除中..." : "删除";
    deleteButton.setAttribute("aria-busy", state.articleDeleting ? "true" : "false");
    syncButtonHint(deleteButton, hint);
  }
  syncArticleFormBusyState();
  syncArticleListBusyState();
}

function isArticleWriteBusy() {
  return state.articleSaving || state.articleDeleting;
}

function syncArticleFormBusyState() {
  const locked = isArticleWriteBusy() || isArticleDetailPending();
  const busyTitle = isArticleDetailPending() ? articleDetailPendingFormTitle() : articleBusyFormTitle();
  $$("#article-form input, #article-form textarea, #article-form select").forEach((field) => {
    field.disabled = locked;
    field.setAttribute("aria-busy", locked ? "true" : "false");
    if (locked) {
      field.title = busyTitle;
    } else {
      field.removeAttribute("title");
    }
  });
  $$(".lang-tab").forEach((button) => {
    button.disabled = locked;
    button.setAttribute("aria-busy", locked ? "true" : "false");
    if (locked) {
      button.title = busyTitle;
    } else {
      button.removeAttribute("title");
    }
  });
}

function isArticleDetailPending() {
  return Boolean(state.selectedArticleId && !state.articleDetailReady && !isArticleWriteBusy());
}

function articleDetailPendingFormTitle() {
  return "正在读取文章详情，完成后再编辑表单";
}

function articleBusyFormTitle() {
  if (state.articleDeleting) {
    return "正在删除文章，完成后再编辑表单";
  }
  return state.articleSavingMode === "publish"
    ? "正在发布文章，完成后再编辑表单"
    : "正在保存文章，完成后再编辑表单";
}

function syncArticleListBusyState() {
  const busy = isArticleWriteBusy();
  const busyTitle = state.articleDeleting ? "正在删除文章，完成后再切换" : "正在保存文章，完成后再切换";
  const newButton = $("#new-article");
  if (newButton) {
    const hint = busy
      ? (state.articleDeleting ? "正在删除文章，完成后再新建" : "正在保存文章，完成后再新建")
      : "新建文章";
    newButton.disabled = busy;
    syncButtonHint(newButton, hint);
  }
  $$("#article-list .list-item").forEach((item) => {
    const hint = busy ? busyTitle : (item.dataset.readyTitle || "打开这篇文章");
    item.disabled = busy;
    syncButtonHint(item, hint);
  });
}

async function deleteArticle() {
  if (state.articleSaving || state.articleDeleting || !state.selectedArticleId) {
    return;
  }
  const article = state.articles.find((item) => item.article_id === state.selectedArticleId) || {};
  const published = article.status === "published";
  const confirmed = await openConfirmDialog({
    title: published ? "删除已发布文章" : "删除文章",
    object: article.title_zh || article.title || article.slug || state.selectedArticleId,
    state: articleStatusLabel(article.status),
    impact: published ? "文章将立即从公开知识库消失，现有链接会失效。" : "文章记录及三种语言内容将被永久删除。",
    recovery: `无法在后台撤销，只能从备份恢复；操作人：${state.user?.email || "当前管理员"}。`,
    expectedText: published ? String(article.slug || "") : "",
    confirmLabel: "确认删除"
  });
  if (!confirmed) {
    return;
  }
  state.articleDeleting = true;
  syncArticleSaveButtons();
  const status = $("#article-status");
  try {
    status.textContent = "正在删除...";
    await api(`/api/admin/articles/${encodeURIComponent(state.selectedArticleId)}`, { method: "DELETE" });
    resetArticleForm();
    await loadArticles();
    status.textContent = "已删除。";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    state.articleDeleting = false;
    syncArticleSaveButtons();
  }
}

function videoStatusLabel(status) {
  return ({ draft: "草稿", published: "已发布", hidden: "隐藏" })[status] || status || "未知";
}

function videoPlatformLabel(platform) {
  const value = String(platform || "").toLowerCase();
  return ({
    youtube: "YouTube",
    bilibili: "哔哩哔哩",
    b23: "哔哩哔哩短链"
  })[value] || platform || "未知平台";
}

function adminVideoDisplayTitle(video) {
  return video?.title || video?.author_name || "待补全标题的视频";
}

async function loadVideos() {
  const payload = await api("/api/admin/videos");
  state.videos = payload.videos || [];
  if (state.selectedVideoId && !state.videos.some((video) => video.video_id === state.selectedVideoId)) {
    resetVideoForm();
    $("#video-status").textContent = "当前视频已不在列表中，已清空编辑表单。";
    return;
  }
  renderVideoList();
  renderVideoCategoryChecks();
  if (!state.selectedVideoId) {
    applyNewVideoSortDefault();
  }
}

async function loadVideoCategories() {
  const payload = await api("/api/admin/video-categories");
  state.videoCategories = payload.categories || [];
  if (state.selectedVideoCategoryId && !state.videoCategories.some((category) => category.category_id === state.selectedVideoCategoryId)) {
    resetVideoCategoryForm();
    $("#video-category-status").textContent = "当前分类已不在列表中，已清空编辑表单。";
    return;
  }
  renderVideoCategoryList();
  renderVideoCategoryChecks();
  if (!state.selectedVideoCategoryId) {
    applyNewVideoCategorySortDefault();
  }
}

function renderVideoList() {
  const list = $("#video-list-admin");
  const publishedCount = state.videos.filter((video) => video.status === "published").length;
  const hiddenCount = state.videos.filter((video) => video.status === "hidden").length;
  const pinnedCount = state.videos.filter((video) => video.pinned).length;
  const filterText = normalizeFilterText(state.videoFilter);
  const visibleVideos = filterText
    ? state.videos.filter((video) => videoMatchesVideoFilter(video, filterText))
    : state.videos;
  const countText = state.videos.length
    ? `${filterText ? `显示 ${formatNumber(visibleVideos.length)} / ` : ""}共 ${formatNumber(state.videos.length)} 个 · 已发布 ${formatNumber(publishedCount)} · 隐藏 ${formatNumber(hiddenCount)} · 置顶 ${formatNumber(pinnedCount)}`
    : "0 个视频";
  setElementText($("#video-list-count"), countText);
  renderVideoStatusOverview(visibleVideos, Boolean(filterText));
  syncBoxLabel(list, state.videos.length ? `视频列表：${countText}` : "视频列表：暂无视频");
  updateSidebarLoadedSummary();
  if (!state.videos.length) {
    list.replaceChildren(createEmptyStateElement("暂无视频，先粘贴一个 YouTube 或 Bilibili 链接。"));
    syncVideoListBusyState();
    return;
  }
  if (!visibleVideos.length) {
    list.replaceChildren(createEmptyStateElement("没有匹配的视频，换个标题、作者、平台或链接试试。"));
    syncVideoListBusyState();
    return;
  }

  list.replaceChildren(...visibleVideos.map((video) => {
    const item = document.createElement("button");
    const title = document.createElement("span");
    const meta = document.createElement("span");
    const summary = document.createElement("span");
    item.className = "list-item";
    if (video.video_id === state.selectedVideoId) {
      item.classList.add("active");
    }
    item.type = "button";
    item.dataset.adminVideoId = video.video_id || "";
    item.disabled = isVideoEditBusy();
    item.dataset.readyTitle = videoListLabel(video);
    item.title = item.dataset.readyTitle;
    item.setAttribute("aria-label", item.dataset.readyTitle);
    item.setAttribute("aria-pressed", video.video_id === state.selectedVideoId ? "true" : "false");
    title.className = "list-title";
    setElementText(title, adminVideoDisplayTitle(video));
    meta.className = "list-meta";
    meta.append(
      createStatusBadgeElement(videoStatusLabel(video.status), video.status || "neutral"),
      createStatusBadgeElement(videoPlatformLabel(video.platform), "neutral"),
      createStatusBadgeElement(`排序 ${formatNumber(video.sort_order)}`, "neutral")
    );
    if (video.pinned) {
      meta.append(createStatusBadgeElement(`置顶排序 ${formatNumber(pinnedSortOrderValue(video))}`, "visible"));
    }
    summary.className = "list-subtle";
    setElementText(summary, `${video.author_name || "作者未记录"} · 发布时间 ${formatTime(video.published_at) || "未记录"} · 更新 ${formatTime(video.updated_at) || "未记录"}`);
    item.append(title, meta, summary);
    if (video.metadata_error) {
      const metadataError = document.createElement("span");
      metadataError.className = "list-subtle";
      setElementText(metadataError, video.metadata_error);
      item.append(metadataError);
    }
    return item;
  }));
  syncVideoListBusyState();
}

function renderVideoStatusOverview(videos, isFiltered) {
  const box = $("#video-status-overview");
  if (!box) {
    return;
  }
  const rows = videos || [];
  const items = [
    [isFiltered ? "当前显示" : "全部视频", rows.length],
    ["已发布", rows.filter((video) => video.status === "published").length],
    ["草稿", rows.filter((video) => video.status === "draft").length],
    ["隐藏", rows.filter((video) => video.status === "hidden").length],
    ["置顶", rows.filter((video) => Number(video.pinned || 0) > 0).length],
    ["需补资料", rows.filter((video) => Boolean(video.metadata_error)).length]
  ];
  box.replaceChildren(...items.map(([label, value]) => createListOverviewItem(label, value)));
}

function videoMatchesVideoFilter(video, filterText) {
  if (!filterText) {
    return true;
  }
  const searchText = [
    video.title,
    video.author_name,
    video.platform,
    video.original_url,
    video.embed_url,
    video.external_id,
    videoStatusLabel(video.status)
  ].filter(Boolean).join(" ").toLowerCase();
  return searchText.includes(filterText);
}

function renderVideoListNotice(text, label = "视频列表提示") {
  const list = $("#video-list-admin");
  setElementText($("#video-list-count"), label);
  syncBoxLabel(list, `${label}：${text}`);
  list.replaceChildren(createEmptyStateElement(text));
  syncVideoListBusyState();
}

function videoListLabel(video) {
  const pinnedText = video.pinned
    ? `已置顶，置顶排序 ${formatNumber(pinnedSortOrderValue(video))}`
    : "未置顶";
  const metadataText = video.metadata_error
    ? `元数据提示：${video.metadata_error}`
    : "元数据正常";
  return [
    adminVideoDisplayTitle(video),
    videoStatusLabel(video.status),
    videoPlatformLabel(video.platform),
    `排序 ${formatNumber(video.sort_order)}`,
    pinnedText,
    `作者 ${video.author_name || "未记录"}`,
    `发布时间 ${formatTime(video.published_at) || "未记录"}`,
    `更新 ${formatTime(video.updated_at) || "未记录"}`,
    metadataText
  ].join("；");
}

function renderVideoCategoryChecks() {
  const box = $("#video-category-checks");
  if (!box) {
    return;
  }
  const selected = new Set(selectedVideo()?.category_ids || []);
  const enabledCount = state.videoCategories.filter((category) => category.enabled).length;
  const checkLabel = state.videoCategories.length
    ? `视频分类选项：共 ${formatNumber(state.videoCategories.length)} 个，启用 ${formatNumber(enabledCount)} 个`
    : "视频分类选项：暂无分类";
  syncBoxLabel(box, checkLabel);
  if (!state.videoCategories.length) {
    const empty = document.createElement("span");
    empty.className = "empty-inline";
    empty.textContent = "暂无分类";
    box.replaceChildren(empty);
    return;
  }

  box.replaceChildren(...state.videoCategories.map((category) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    label.className = "mini-check";
    if (!category.enabled) {
      label.classList.add("is-disabled");
    }
    input.type = "checkbox";
    input.name = "category_ids";
    input.value = category.category_id || "";
    input.checked = selected.has(category.category_id);
    input.disabled = !category.enabled && !selected.has(category.category_id);
    label.append(input, document.createTextNode(category.name_zh || category.slug || ""));
    if (!category.enabled) {
      label.append(createStatusBadgeElement("停用", "hidden"));
    }
    return label;
  }));
}

function renderRegionBars(box, rows) {
  const visibleRows = rows.slice(0, 6);
  const max = Math.max(1, ...visibleRows.map((row) => Number(row.pv || 0)));
  box.replaceChildren(...visibleRows.map((row, index) => createInsightBarItem({
    rank: index + 1,
    label: mapPlaceLabel(row),
    detail: row.ip_prefix ? `网络前缀 ${row.ip_prefix}` : "地区来源",
    value: row.pv,
    secondaryValue: row.uv,
    max,
    lastSeenAt: row.last_seen_at,
    primaryLabel: "浏览",
    secondaryLabel: "访客"
  })));
}

function regionMatchesFilter(row, filterText) {
  if (!filterText) {
    return true;
  }
  const searchText = [
    countryDisplayName(row.country),
    row.country,
    row.region,
    row.city,
    row.ip_prefix,
    mapPlaceLabel(row)
  ].filter(Boolean).join(" ").toLowerCase();
  return searchText.includes(filterText);
}

function renderVideoCategoryChecksNotice(text, label = "视频分类提示") {
  const box = $("#video-category-checks");
  if (!box) {
    return;
  }
  const empty = document.createElement("span");
  empty.className = "empty-inline";
  setElementText(empty, text);
  syncBoxLabel(box, `${label}：${text}`);
  box.replaceChildren(empty);
}

function selectedVideo() {
  return state.videos.find((item) => item.video_id === state.selectedVideoId);
}

function nextSortOrder(items) {
  const max = items.reduce((result, item) => Math.max(result, Number(item.sort_order || 0)), 0);
  return max + 10;
}

function pinnedSortOrderValue(video) {
  return Number(video?.pinned_sort_order ?? video?.sort_order ?? 0);
}

function nextPinnedSortOrder(items) {
  const pinnedVideos = items.filter((item) => Number(item.pinned || 0) === 1);
  const max = pinnedVideos.reduce((result, item) => Math.max(result, pinnedSortOrderValue(item)), 0);
  return max + 10;
}

function applyNewVideoSortDefault() {
  const form = $("#video-form");
  const sortField = form?.elements?.sort_order;
  const pinnedSortField = form?.elements?.pinned_sort_order;
  if (sortField) {
    sortField.value = String(nextSortOrder(state.videos));
  }
  if (pinnedSortField) {
    pinnedSortField.value = "";
  }
}

function applyNewVideoCategorySortDefault() {
  const field = $("#video-category-form")?.elements?.sort_order;
  if (field) {
    field.value = String(nextSortOrder(state.videoCategories));
  }
}

function resetVideoForm() {
  state.selectedVideoId = "";
  setElementText($("#video-editor-title"), "新建视频");
  $("#video-form").reset();
  $("#video-form").elements.status.value = "draft";
  applyNewVideoSortDefault();
  $("#delete-video").disabled = true;
  $("#video-status").textContent = "";
  $("#admin-video-preview").replaceChildren();
  $("#video-cover-file").value = "";
  $("#video-frame-file").value = "";
  syncVideoMetadataButtons();
  syncVideoSaveButtons();
  renderVideoThumbnailPreview();
  renderVideoList();
  renderVideoCategoryChecks();
  captureEditorBaseline("videos");
}

function fillVideoForm(video) {
  const form = $("#video-form");
  setElementText($("#video-editor-title"), `编辑：${adminVideoDisplayTitle(video)}`);
  form.elements.original_url.value = video.original_url || "";
  form.elements.platform.value = video.platform || "";
  form.elements.external_id.value = video.external_id || "";
  form.elements.embed_url.value = video.embed_url || "";
  form.elements.thumbnail_url.value = video.thumbnail_url || "";
  form.elements.author_name.value = video.author_name || "";
  form.elements.published_at.value = toLocalDateTimeInputValue(video.published_at);
  form.elements.status.value = video.status || "draft";
  form.elements.sort_order.value = Number(video.sort_order || 0);
  form.elements.pinned.checked = Boolean(video.pinned);
  form.elements.pinned_sort_order.value = video.pinned ? pinnedSortOrderValue(video) : "";
  form.elements.title.value = video.title || "";
  form.elements.description.value = video.description || "";
  $("#delete-video").disabled = false;
  $("#video-status").textContent = video.metadata_error || "";
  syncVideoMetadataButtons();
  syncVideoSaveButtons();
  renderVideoList();
  renderVideoCategoryChecks();
  renderAdminVideoPreview(video.embed_url);
  $("#video-cover-file").value = "";
  $("#video-frame-file").value = "";
  renderVideoThumbnailPreview(video.thumbnail_url || "");
  captureEditorBaseline("videos");
}

function renderAdminVideoPreview(embedUrl) {
  const preview = $("#admin-video-preview");
  preview.replaceChildren();
  if (!embedUrl) {
    return;
  }
  const iframe = document.createElement("iframe");
  iframe.src = embedUrl;
  iframe.loading = "lazy";
  iframe.allowFullscreen = true;
  iframe.title = "后台播放器预览";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allow = "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  preview.appendChild(iframe);
}

function renderVideoThumbnailPreview(value = "") {
  const preview = $("#video-thumbnail-preview");
  if (!preview) {
    return;
  }
  const thumbnail = String(value || $("#video-form")?.elements?.thumbnail_url?.value || "").trim();
  preview.replaceChildren();
  preview.classList.toggle("is-empty", !thumbnail);
  const label = document.createElement("span");
  const sourceLabel = thumbnailSourceLabel(thumbnail);
  setElementText(label, sourceLabel);
  preview.appendChild(label);
  if (!thumbnail) {
    return;
  }
  const image = document.createElement("img");
  image.alt = "视频封面预览";
  image.decoding = "async";
  image.loading = "lazy";
  image.referrerPolicy = "no-referrer";
  image.src = thumbnail;
  image.addEventListener("error", () => {
    image.remove();
    setElementText(label, `${sourceLabel} · 无法预览，请检查链接或重新上传。`);
    preview.classList.add("is-empty");
  }, { once: true });
  preview.appendChild(image);
}

function setVideoThumbnailValue(value, message = "") {
  const form = $("#video-form");
  form.elements.thumbnail_url.value = value || "";
  renderVideoThumbnailPreview(value || "");
  if (message) {
    $("#video-status").textContent = message;
  }
  refreshEditorDirtyState("videos");
}

async function handleLocalCoverFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  state.videoCoverProcessing = true;
  state.videoCoverProcessingMode = "cover";
  syncVideoSaveButtons();
  $("#video-status").textContent = "正在压缩本地封面...";
  try {
    const dataUrl = await imageFileToCoverDataUrl(file);
    setVideoThumbnailValue(dataUrl, "本地封面已填入，保存后会显示在视频卡片中。");
  } catch (error) {
    $("#video-status").textContent = error.message;
  } finally {
    event.target.value = "";
    state.videoCoverProcessing = false;
    state.videoCoverProcessingMode = "";
    syncVideoSaveButtons();
  }
}

async function handleVideoFrameFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  state.videoCoverProcessing = true;
  state.videoCoverProcessingMode = "frame";
  syncVideoSaveButtons();
  $("#video-status").textContent = "正在截取本地视频首帧...";
  try {
    const dataUrl = await videoFileToCoverDataUrl(file);
    setVideoThumbnailValue(dataUrl, "已截取第一帧作为封面，保存后生效。");
  } catch (error) {
    $("#video-status").textContent = error.message;
  } finally {
    event.target.value = "";
    state.videoCoverProcessing = false;
    state.videoCoverProcessingMode = "";
    syncVideoSaveButtons();
  }
}

async function ensureVideoThumbnailBeforeSave() {
  const form = $("#video-form");
  if (form.elements.thumbnail_url.value.trim()) {
    return;
  }
  const file = $("#video-frame-file").files?.[0];
  if (!file) {
    return;
  }
  $("#video-status").textContent = "封面为空，正在从本地视频截取首帧...";
  const dataUrl = await videoFileToCoverDataUrl(file);
  setVideoThumbnailValue(dataUrl);
}

function clearVideoThumbnail() {
  setVideoThumbnailValue("", "封面已清空。");
  $("#video-cover-file").value = "";
  $("#video-frame-file").value = "";
}

function applyPreviewToVideoForm(video) {
  const form = $("#video-form");
  form.elements.platform.value = video.platform || "";
  form.elements.external_id.value = video.external_id || "";
  form.elements.embed_url.value = video.embed_url || "";
  form.elements.title.value = video.title || form.elements.title.value;
  form.elements.description.value = video.description || form.elements.description.value;
  form.elements.thumbnail_url.value = video.thumbnail_url || form.elements.thumbnail_url.value;
  form.elements.author_name.value = video.author_name || form.elements.author_name.value;
  form.elements.published_at.value = toLocalDateTimeInputValue(video.published_at) || form.elements.published_at.value;
  $("#video-status").textContent = video.metadata_error
    ? `已生成播放器地址；元数据受限，请手动补全：${video.metadata_error}`
    : "识别完成";
  renderAdminVideoPreview(video.embed_url);
  renderVideoThumbnailPreview(form.elements.thumbnail_url.value);
  refreshEditorDirtyState("videos");
}

async function previewVideoUrl() {
  if (state.videoPreviewing || state.videoMetadataRefreshing) {
    return;
  }
  const form = $("#video-form");
  const requestUrl = form.elements.original_url.value.trim();
  if (!requestUrl) {
    $("#video-status").textContent = "请先填写视频链接。";
    syncVideoMetadataButtons();
    return;
  }
  state.videoPreviewing = true;
  syncVideoSaveButtons();
  $("#video-status").textContent = "正在识别...";
  try {
    const payload = await api("/api/admin/videos/preview-url", {
      method: "POST",
      body: JSON.stringify({ url: requestUrl })
    });
    if (form.elements.original_url.value !== requestUrl) {
      $("#video-status").textContent = "链接已变化，请重新识别。";
      return;
    }
    applyPreviewToVideoForm(payload.video || {});
  } catch (error) {
    $("#video-status").textContent = error.message;
  } finally {
    state.videoPreviewing = false;
    syncVideoSaveButtons();
  }
}

function syncVideoMetadataButtons() {
  const previewButton = $("#preview-video-url");
  const refreshButton = $("#refresh-video-metadata");
  const hasRequestUrl = Boolean($("#video-form")?.elements?.original_url?.value.trim());
  const writeBusy = isVideoWriteBusy();
  const metadataBusy = isVideoMetadataBusy();
  const busy = metadataBusy || writeBusy;
  if (previewButton) {
    previewButton.disabled = busy || !hasRequestUrl;
    previewButton.textContent = state.videoPreviewing ? "识别中..." : "自动识别/获取信息";
    previewButton.setAttribute("aria-busy", state.videoPreviewing ? "true" : "false");
    const previewHint = !hasRequestUrl
      ? "请先填写视频链接"
      : (state.videoPreviewing
      ? "正在识别视频链接"
      : (writeBusy || state.videoCoverProcessing ? videoBusyMetadataTitle("识别") : "自动识别视频链接并获取元数据"));
    syncButtonHint(previewButton, previewHint);
  }
  if (refreshButton) {
    const hasVideo = Boolean(state.selectedVideoId);
    refreshButton.disabled = busy || !hasVideo;
    refreshButton.textContent = state.videoMetadataRefreshing ? "刷新中..." : "刷新元数据";
    refreshButton.setAttribute("aria-busy", state.videoMetadataRefreshing ? "true" : "false");
    let refreshHint = "刷新当前视频的外部元数据";
    if (writeBusy || state.videoCoverProcessing) {
      refreshHint = videoBusyMetadataTitle("刷新");
    } else if (!hasVideo) {
      refreshHint = "请先选择已保存视频";
    } else if (state.videoPreviewing) {
      refreshHint = "正在识别视频链接";
    } else if (state.videoMetadataRefreshing) {
      refreshHint = "正在刷新外部元数据";
    }
    syncButtonHint(refreshButton, refreshHint);
  }
}

function videoBusyMetadataTitle(action) {
  if (state.videoCoverProcessing) {
    return `${videoCoverProcessingTitle()}，完成后再${action}元数据`;
  }
  if (state.videoDeleting) {
    return `正在删除视频，完成后再${action}元数据`;
  }
  return state.videoSavingMode === "publish"
    ? `正在发布视频，完成后再${action}元数据`
    : `正在保存视频，完成后再${action}元数据`;
}

function videoPayload(statusOverride = "") {
  const form = $("#video-form");
  return {
    original_url: form.elements.original_url.value.trim(),
    title: form.elements.title.value.trim(),
    description: form.elements.description.value.trim(),
    thumbnail_url: form.elements.thumbnail_url.value.trim(),
    author_name: form.elements.author_name.value.trim(),
    published_at: normalizePublishedAtForApi(form.elements.published_at.value),
    status: statusOverride || form.elements.status.value,
    sort_order: Number(form.elements.sort_order.value || 0),
    pinned: form.elements.pinned.checked,
    pinned_sort_order: form.elements.pinned.checked ? Number(form.elements.pinned_sort_order.value || 0) : 0,
    category_ids: Array.from($("#video-category-checks").querySelectorAll("input:checked")).map((input) => input.value)
  };
}

function handleVideoPinnedChange() {
  const form = $("#video-form");
  const field = form?.elements?.pinned_sort_order;
  if (!form?.elements?.pinned?.checked) {
    if (field) {
      field.value = "";
    }
    syncVideoFormBusyState();
    refreshEditorDirtyState("videos");
    return;
  }
  if (field && Number(field.value || 0) === 0) {
    field.value = String(nextPinnedSortOrder(state.videos));
  }
  syncVideoFormBusyState();
  refreshEditorDirtyState("videos");
}

function syncVideoPinnedSortHint() {
  const form = $("#video-form");
  const hint = $("#video-pinned-sort-hint");
  const field = form?.elements?.pinned_sort_order;
  const pinned = Boolean(form?.elements?.pinned?.checked);
  const text = pinned
    ? "置顶队列按这个数值从大到小排列。"
    : "勾选置顶后设置，数值越大越靠前。";
  if (hint) {
    setElementText(hint, text);
  }
  if (field && !isVideoEditBusy()) {
    field.title = text;
  }
}

async function saveVideo(statusOverride = "") {
  if (state.videoSaving) {
    return false;
  }
  state.videoSaving = true;
  state.videoSavingMode = statusOverride === "published" ? "publish" : "save";
  syncVideoSaveButtons();
  const status = $("#video-status");
  try {
    status.textContent = "正在保存...";
    await ensureVideoThumbnailBeforeSave();
    const path = state.selectedVideoId
      ? `/api/admin/videos/${encodeURIComponent(state.selectedVideoId)}`
      : "/api/admin/videos";
    const method = state.selectedVideoId ? "PUT" : "POST";
    const result = await api(path, { method, body: JSON.stringify(videoPayload(statusOverride)) });
    state.selectedVideoId = result.videoId || state.selectedVideoId;
    status.textContent = "已保存";
    await loadVideos();
    const video = selectedVideo();
    if (video) {
      fillVideoForm(video);
      status.textContent = video.metadata_error ? `已保存；${video.metadata_error}` : "已保存";
    }
    captureEditorBaseline("videos", { saved: true });
    return true;
  } catch (error) {
    status.textContent = error.message;
    refreshEditorDirtyState("videos");
    return false;
  } finally {
    state.videoSaving = false;
    state.videoSavingMode = "";
    syncVideoSaveButtons();
  }
}

function syncVideoSaveButtons() {
  const saveButton = $("#video-form button[type='submit']");
  const publishButton = $("#publish-video");
  const deleteButton = $("#delete-video");
  const busy = isVideoEditBusy();
  const metadataBusy = isVideoMetadataBusy();
  if (saveButton) {
    const savingDraft = state.videoSaving && state.videoSavingMode !== "publish";
    const hint = state.videoDeleting
      ? "正在删除视频"
      : (state.videoSaving
      ? "正在保存视频"
      : (metadataBusy ? videoMetadataBusyTitle() : "保存当前视频"));
    saveButton.disabled = busy;
    saveButton.textContent = savingDraft ? "保存中..." : "保存";
    saveButton.setAttribute("aria-busy", savingDraft ? "true" : "false");
    syncButtonHint(saveButton, hint);
  }
  if (publishButton) {
    const publishing = state.videoSaving && state.videoSavingMode === "publish";
    const hint = state.videoDeleting
      ? "正在删除视频"
      : (state.videoSaving
      ? "正在保存视频"
      : (metadataBusy ? videoMetadataBusyTitle() : "保存并发布当前视频"));
    publishButton.disabled = busy;
    publishButton.textContent = publishing ? "发布中..." : "保存并发布";
    publishButton.setAttribute("aria-busy", publishing ? "true" : "false");
    syncButtonHint(publishButton, hint);
  }
  if (deleteButton) {
    const hint = busy
      ? (state.videoDeleting
      ? "正在删除视频"
      : (state.videoSaving ? "正在保存视频" : videoMetadataBusyTitle()))
      : (state.selectedVideoId ? "删除当前视频" : "请先选择已保存视频");
    deleteButton.disabled = busy || !state.selectedVideoId;
    deleteButton.textContent = state.videoDeleting ? "删除中..." : "删除";
    deleteButton.setAttribute("aria-busy", state.videoDeleting ? "true" : "false");
    syncButtonHint(deleteButton, hint);
  }
  syncVideoFormBusyState();
  syncVideoMetadataButtons();
  syncVideoListBusyState();
}

function isVideoWriteBusy() {
  return state.videoSaving || state.videoDeleting;
}

function isVideoMetadataBusy() {
  return state.videoPreviewing || state.videoMetadataRefreshing || state.videoCoverProcessing;
}

function isVideoEditBusy() {
  return isVideoWriteBusy() || isVideoMetadataBusy();
}

function syncVideoFormBusyState() {
  const busy = isVideoEditBusy();
  const busyTitle = videoBusyFormTitle();
  $$("#video-form input, #video-form textarea, #video-form select").forEach((field) => {
    const categoryOptionDisabled = shouldDisableVideoCategoryOption(field);
    const pinnedSortDisabled = shouldDisableVideoPinnedSortField(field);
    field.disabled = busy || categoryOptionDisabled || pinnedSortDisabled;
    field.setAttribute("aria-busy", busy ? "true" : "false");
    if (busy) {
      field.title = busyTitle;
    } else if (pinnedSortDisabled) {
      field.title = "勾选置顶后再设置置顶排序";
    } else if (field.name === "pinned_sort_order") {
      field.title = "置顶队列按这个数值从大到小排列";
    } else {
      field.removeAttribute("title");
    }
  });
  syncVideoPinnedSortHint();
  const categoryFieldset = $("#video-form .category-checks");
  if (categoryFieldset) {
    categoryFieldset.disabled = busy;
    categoryFieldset.setAttribute("aria-busy", busy ? "true" : "false");
    if (busy) {
      categoryFieldset.title = busyTitle;
    } else {
      categoryFieldset.removeAttribute("title");
    }
  }
  const clearButton = $("#clear-video-thumbnail");
  if (clearButton) {
    clearButton.disabled = busy;
    clearButton.setAttribute("aria-busy", busy ? "true" : "false");
    syncButtonHint(clearButton, busy ? busyTitle : "清空封面");
  }
}

function shouldDisableVideoCategoryOption(field) {
  const option = field.closest?.("#video-category-checks .mini-check");
  return Boolean(option?.classList.contains("is-disabled") && !field.checked);
}

function shouldDisableVideoPinnedSortField(field) {
  return field?.name === "pinned_sort_order" && !$("#video-form")?.elements?.pinned?.checked;
}

function videoBusyFormTitle() {
  if (state.videoPreviewing) {
    return "正在识别视频链接，完成后再编辑表单";
  }
  if (state.videoMetadataRefreshing) {
    return "正在刷新视频元数据，完成后再编辑表单";
  }
  if (state.videoCoverProcessing) {
    return `${videoCoverProcessingTitle()}，完成后再编辑表单`;
  }
  if (state.videoDeleting) {
    return "正在删除视频，完成后再编辑表单";
  }
  return state.videoSavingMode === "publish"
    ? "正在发布视频，完成后再编辑表单"
    : "正在保存视频，完成后再编辑表单";
}

function videoMetadataBusyTitle() {
  if (state.videoPreviewing) {
    return "正在识别视频链接";
  }
  if (state.videoMetadataRefreshing) {
    return "正在刷新视频元数据";
  }
  return videoCoverProcessingTitle();
}

function videoSelectionBusyTitle(action) {
  if (state.videoPreviewing) {
    return `正在识别视频链接，完成后再${action}`;
  }
  if (state.videoMetadataRefreshing) {
    return `正在刷新视频元数据，完成后再${action}`;
  }
  if (state.videoCoverProcessing) {
    return `${videoCoverProcessingTitle()}，完成后再${action}`;
  }
  if (state.videoDeleting) {
    return `正在删除视频，完成后再${action}`;
  }
  return `正在保存视频，完成后再${action}`;
}

function videoCoverProcessingTitle() {
  return state.videoCoverProcessingMode === "frame"
    ? "正在截取本地视频首帧"
    : "正在压缩本地封面";
}

function syncVideoListBusyState() {
  const busy = isVideoEditBusy();
  const busyTitle = videoSelectionBusyTitle("切换");
  const newButton = $("#new-video");
  if (newButton) {
    const hint = busy ? videoSelectionBusyTitle("新建") : "新建视频";
    newButton.disabled = busy;
    syncButtonHint(newButton, hint);
  }
  $$("#video-list-admin .list-item").forEach((item) => {
    const hint = busy ? busyTitle : (item.dataset.readyTitle || "打开这个视频");
    item.disabled = busy;
    syncButtonHint(item, hint);
  });
}

function selectVideo(videoId) {
  state.selectedVideoId = videoId;
  const video = selectedVideo();
  if (video) {
    fillVideoForm(video);
  }
}

async function deleteVideo() {
  if (state.videoSaving || state.videoDeleting || !state.selectedVideoId) {
    return;
  }
  const video = selectedVideo() || {};
  const confirmed = await openConfirmDialog({
    title: "删除视频",
    object: adminVideoDisplayTitle(video),
    state: videoStatusLabel(video.status),
    impact: "视频记录会从管理列表和主站视频区移除。",
    recovery: `无法在后台撤销，需要重新添加原始链接；操作人：${state.user?.email || "当前管理员"}。`,
    confirmLabel: "确认删除"
  });
  if (!confirmed) {
    return;
  }
  state.videoDeleting = true;
  syncVideoSaveButtons();
  const status = $("#video-status");
  try {
    status.textContent = "正在删除...";
    await api(`/api/admin/videos/${encodeURIComponent(state.selectedVideoId)}`, { method: "DELETE" });
    resetVideoForm();
    await loadVideos();
    status.textContent = "已删除。";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    state.videoDeleting = false;
    syncVideoSaveButtons();
  }
}

async function refreshVideoMetadata() {
  if (state.videoPreviewing || state.videoMetadataRefreshing) {
    return;
  }
  if (!state.selectedVideoId) {
    return previewVideoUrl();
  }
  const videoId = state.selectedVideoId;
  state.videoMetadataRefreshing = true;
  syncVideoSaveButtons();
  $("#video-status").textContent = "正在刷新元数据...";
  try {
    const payload = await api(`/api/admin/videos/${encodeURIComponent(videoId)}/refresh-metadata`, { method: "POST" });
    if (state.selectedVideoId !== videoId) {
      return;
    }
    const refreshedVideo = payload.video || {};
    applyPreviewToVideoForm(refreshedVideo);
    $("#video-status").textContent = refreshedVideo.metadata_error
      ? `元数据刷新受限，请手动补全：${refreshedVideo.metadata_error}`
      : "元数据已刷新。";
    await loadVideos();
  } catch (error) {
    $("#video-status").textContent = error.message;
  } finally {
    state.videoMetadataRefreshing = false;
    syncVideoSaveButtons();
  }
}

function renderVideoCategoryList() {
  const list = $("#video-category-list-admin");
  const enabledCount = state.videoCategories.filter((category) => category.enabled).length;
  const disabledCount = state.videoCategories.length - enabledCount;
  const occupiedCount = state.videoCategories.filter((category) => Number(category.video_count || 0) > 0).length;
  const filterText = normalizeFilterText(state.videoCategoryFilter);
  const visibleCategories = filterText
    ? state.videoCategories.filter((category) => videoCategoryMatchesFilter(category, filterText))
    : state.videoCategories;
  const countText = state.videoCategories.length
    ? `${filterText ? `显示 ${formatNumber(visibleCategories.length)} / ` : ""}共 ${formatNumber(state.videoCategories.length)} 个 · 启用 ${formatNumber(enabledCount)} · 停用 ${formatNumber(disabledCount)} · 占用 ${formatNumber(occupiedCount)}`
    : "0 个分类";
  setElementText($("#video-category-list-count"), countText);
  renderVideoCategoryStatusOverview(visibleCategories, Boolean(filterText));
  syncBoxLabel(list, state.videoCategories.length ? `视频分类列表：${countText}` : "视频分类列表：暂无分类");
  updateSidebarLoadedSummary();
  if (!state.videoCategories.length) {
    list.replaceChildren(createEmptyStateElement("暂无视频分类。"));
    syncVideoCategoryListBusyState();
    return;
  }
  if (!visibleCategories.length) {
    list.replaceChildren(createEmptyStateElement("没有匹配的分类，换个分类名、路径标识或排序试试。"));
    syncVideoCategoryListBusyState();
    return;
  }

  list.replaceChildren(...visibleCategories.map((category) => {
    const item = document.createElement("button");
    const title = document.createElement("span");
    const meta = document.createElement("span");
    const summary = document.createElement("span");
    item.className = "list-item";
    if (category.category_id === state.selectedVideoCategoryId) {
      item.classList.add("active");
    }
    item.type = "button";
    item.dataset.adminVideoCategoryId = category.category_id || "";
    item.disabled = isVideoCategoryWriteBusy();
    item.dataset.readyTitle = videoCategoryListLabel(category);
    item.title = item.dataset.readyTitle;
    item.setAttribute("aria-label", item.dataset.readyTitle);
    item.setAttribute("aria-pressed", category.category_id === state.selectedVideoCategoryId ? "true" : "false");
    title.className = "list-title";
    setElementText(title, category.name_zh || category.slug || "");
    meta.className = "list-meta";
    meta.append(
      createStatusBadgeElement(category.enabled ? "启用" : "停用", category.enabled ? "visible" : "hidden"),
      createStatusBadgeElement(`${category.video_count || 0} 个视频`, "neutral")
    );
    if (Number(category.video_count || 0) > 0) {
      meta.append(createStatusBadgeElement("占用中", "warning"));
    }
    summary.className = "list-subtle";
    setElementText(summary, `标识：${category.slug || "未记录"} · 排序 ${formatNumber(category.sort_order)}`);
    item.append(title, meta, summary);
    return item;
  }));
  syncVideoCategoryListBusyState();
}

function renderVideoCategoryStatusOverview(categories, isFiltered) {
  const box = $("#video-category-status-overview");
  if (!box) {
    return;
  }
  const rows = categories || [];
  const linkedCount = rows.filter((category) => Number(category.video_count || 0) > 0).length;
  const topSort = rows.reduce((result, category) => Math.max(result, Number(category.sort_order || 0)), 0);
  const items = [
    [isFiltered ? "当前显示" : "全部分类", rows.length],
    ["启用", rows.filter((category) => category.enabled).length],
    ["停用", rows.filter((category) => !category.enabled).length],
    ["已被使用", linkedCount],
    ["可删除", Math.max(0, rows.length - linkedCount)],
    ["最高排序", topSort]
  ];
  box.replaceChildren(...items.map(([label, value]) => createListOverviewItem(label, value)));
}

function videoCategoryMatchesFilter(category, filterText) {
  if (!filterText) {
    return true;
  }
  const searchText = [
    category.name_zh,
    category.name_en,
    category.name_ja,
    category.slug,
    category.enabled ? "启用" : "停用",
    `排序 ${formatNumber(category.sort_order)}`,
    `视频 ${formatNumber(category.video_count)}`
  ].filter(Boolean).join(" ").toLowerCase();
  return searchText.includes(filterText);
}

function renderVideoCategoryListNotice(text, label = "分类列表提示") {
  const list = $("#video-category-list-admin");
  setElementText($("#video-category-list-count"), label);
  syncBoxLabel(list, `${label}：${text}`);
  list.replaceChildren(createEmptyStateElement(text));
  syncVideoCategoryListBusyState();
}

function videoCategoryListLabel(category) {
  const linkedVideos = Number(category.video_count || 0);
  return [
    category.name_zh || category.slug || "未命名分类",
    `路径标识 ${category.slug || "未记录"}`,
    category.enabled ? "启用" : "停用",
    `占用视频 ${formatNumber(linkedVideos)} 个`,
    linkedVideos > 0 ? "删除前需先取消关联" : "未被视频使用",
    `排序 ${formatNumber(category.sort_order)}`
  ].join("；");
}

function selectedVideoCategory() {
  return state.videoCategories.find((item) => item.category_id === state.selectedVideoCategoryId);
}

function resetVideoCategoryForm() {
  state.selectedVideoCategoryId = "";
  setElementText($("#video-category-editor-title"), "新建分类");
  $("#video-category-form").reset();
  $("#video-category-form").elements.enabled.checked = true;
  applyNewVideoCategorySortDefault();
  $("#delete-video-category").disabled = true;
  $("#video-category-status").textContent = "";
  syncVideoCategoryButtons();
  renderVideoCategoryList();
  captureEditorBaseline("videoCategories");
}

function fillVideoCategoryForm(category) {
  const form = $("#video-category-form");
  setElementText($("#video-category-editor-title"), `编辑：${category.name_zh || category.slug}`);
  form.elements.slug.value = category.slug || "";
  form.elements.name_zh.value = category.name_zh || "";
  form.elements.name_en.value = category.name_en || "";
  form.elements.name_ja.value = category.name_ja || "";
  form.elements.sort_order.value = Number(category.sort_order || 0);
  form.elements.enabled.checked = Boolean(category.enabled);
  $("#delete-video-category").disabled = Number(category.video_count || 0) > 0;
  $("#video-category-status").textContent = videoCategoryUsageStatus(category);
  syncVideoCategoryButtons();
  renderVideoCategoryList();
  captureEditorBaseline("videoCategories");
}

function videoCategoryUsageStatus(category) {
  const linkedVideos = Number(category?.video_count || 0);
  return linkedVideos > 0
    ? `已有 ${formatNumber(linkedVideos)} 个视频使用，删除前请先取消关联。`
    : "当前分类未被视频使用，可以直接删除。";
}

function videoCategoryPayload() {
  const form = $("#video-category-form");
  return {
    slug: form.elements.slug.value.trim(),
    name_zh: form.elements.name_zh.value.trim(),
    name_en: form.elements.name_en.value.trim(),
    name_ja: form.elements.name_ja.value.trim(),
    sort_order: Number(form.elements.sort_order.value || 0),
    enabled: form.elements.enabled.checked
  };
}

async function saveVideoCategory(event) {
  event?.preventDefault?.();
  if (state.videoCategoryBusy) {
    return false;
  }
  state.videoCategoryBusy = true;
  state.videoCategoryBusyMode = "save";
  syncVideoCategoryButtons();
  const status = $("#video-category-status");
  try {
    status.textContent = "正在保存...";
    const path = state.selectedVideoCategoryId
      ? `/api/admin/video-categories/${encodeURIComponent(state.selectedVideoCategoryId)}`
      : "/api/admin/video-categories";
    const method = state.selectedVideoCategoryId ? "PUT" : "POST";
    const result = await api(path, { method, body: JSON.stringify(videoCategoryPayload()) });
    state.selectedVideoCategoryId = result.categoryId || state.selectedVideoCategoryId;
    status.textContent = "已保存";
    await loadVideoCategories();
    const category = selectedVideoCategory();
    if (category) {
      fillVideoCategoryForm(category);
      status.textContent = "已保存";
    }
    captureEditorBaseline("videoCategories", { saved: true });
    return true;
  } catch (error) {
    status.textContent = error.message;
    refreshEditorDirtyState("videoCategories");
    return false;
  } finally {
    state.videoCategoryBusy = false;
    state.videoCategoryBusyMode = "";
    syncVideoCategoryButtons();
  }
}

function syncVideoCategoryButtons() {
  const saveButton = $("#save-video-category");
  const deleteButton = $("#delete-video-category");
  if (saveButton) {
    const saving = state.videoCategoryBusy && state.videoCategoryBusyMode === "save";
    const hint = state.videoCategoryBusy ? "正在处理视频分类" : "保存当前视频分类";
    saveButton.disabled = state.videoCategoryBusy;
    saveButton.textContent = saving ? "保存中..." : "保存分类";
    saveButton.setAttribute("aria-busy", saving ? "true" : "false");
    syncButtonHint(saveButton, hint);
  }
  if (deleteButton) {
    const deleting = state.videoCategoryBusy && state.videoCategoryBusyMode === "delete";
    const category = selectedVideoCategory();
    const hasLinkedVideos = Number(category?.video_count || 0) > 0;
    const hint = state.videoCategoryBusy
      ? "正在处理视频分类"
      : (!state.selectedVideoCategoryId
        ? "请先选择已保存分类"
        : (hasLinkedVideos ? "已有视频使用，先取消关联后再删除" : "删除当前视频分类"));
    deleteButton.disabled = state.videoCategoryBusy || !state.selectedVideoCategoryId || hasLinkedVideos;
    deleteButton.textContent = deleting ? "删除中..." : "删除分类";
    deleteButton.setAttribute("aria-busy", deleting ? "true" : "false");
    syncButtonHint(deleteButton, hint);
  }
  syncVideoCategoryFormBusyState();
  syncVideoCategoryListBusyState();
}

function isVideoCategoryWriteBusy() {
  return state.videoCategoryBusy;
}

function syncVideoCategoryFormBusyState() {
  const busy = isVideoCategoryWriteBusy();
  const busyTitle = videoCategoryBusyFormTitle();
  $$("#video-category-form input").forEach((field) => {
    field.disabled = busy;
    field.setAttribute("aria-busy", busy ? "true" : "false");
    if (busy) {
      field.title = busyTitle;
    } else {
      field.removeAttribute("title");
    }
  });
}

function videoCategoryBusyFormTitle() {
  return state.videoCategoryBusyMode === "delete"
    ? "正在删除视频分类，完成后再编辑表单"
    : "正在保存视频分类，完成后再编辑表单";
}

function syncVideoCategoryListBusyState() {
  const busy = isVideoCategoryWriteBusy();
  const busyTitle = state.videoCategoryBusyMode === "delete" ? "正在删除分类，完成后再切换" : "正在保存分类，完成后再切换";
  const newButton = $("#new-video-category");
  if (newButton) {
    const hint = busy
      ? (state.videoCategoryBusyMode === "delete" ? "正在删除分类，完成后再新建" : "正在保存分类，完成后再新建")
      : "新建视频分类";
    newButton.disabled = busy;
    syncButtonHint(newButton, hint);
  }
  $$("#video-category-list-admin .list-item").forEach((item) => {
    const hint = busy ? busyTitle : (item.dataset.readyTitle || "打开这个视频分类");
    item.disabled = busy;
    syncButtonHint(item, hint);
  });
}

function selectVideoCategory(categoryId) {
  state.selectedVideoCategoryId = categoryId;
  const category = selectedVideoCategory();
  if (category) {
    fillVideoCategoryForm(category);
  }
}

async function deleteVideoCategory() {
  if (state.videoCategoryBusy) {
    return;
  }
  const category = selectedVideoCategory();
  if (!category) {
    return;
  }
  if (Number(category.video_count || 0) > 0) {
    $("#video-category-status").textContent = `已有 ${category.video_count} 个视频使用，不能直接删除。`;
    return;
  }
  const confirmed = await openConfirmDialog({
    title: "删除视频分类",
    object: category.name_zh || category.name || category.slug || category.category_id,
    state: category.active === false ? "已停用 · 0 个视频" : "启用中 · 0 个视频",
    impact: "分类会从后台和主站分类入口永久移除。",
    recovery: `无法在后台撤销，只能重新创建；操作人：${state.user?.email || "当前管理员"}。`,
    confirmLabel: "确认删除"
  });
  if (!confirmed) {
    return;
  }
  state.videoCategoryBusy = true;
  state.videoCategoryBusyMode = "delete";
  syncVideoCategoryButtons();
  try {
    $("#video-category-status").textContent = "正在删除...";
    await api(`/api/admin/video-categories/${encodeURIComponent(category.category_id)}`, { method: "DELETE" });
    resetVideoCategoryForm();
    await loadVideoCategories();
    $("#video-category-status").textContent = "已删除。";
  } catch (error) {
    $("#video-category-status").textContent = error.message;
  } finally {
    state.videoCategoryBusy = false;
    state.videoCategoryBusyMode = "";
    syncVideoCategoryButtons();
  }
}

async function loadChatMessages() {
  if (state.chatMessagesLoading) {
    return;
  }
  state.chatMessagesLoading = true;
  syncChatActionState();
  try {
    const includeHidden = $("#include-hidden-chat")?.checked ? "1" : "0";
    const payload = await api(`/api/admin/chat/messages?limit=100&includeHidden=${includeHidden}`);
    state.chatMessages = payload.messages || [];
    if (state.selectedMessageId && !state.chatMessages.some((message) => message.message_id === state.selectedMessageId)) {
      state.selectedMessageId = "";
      resetChatForm("当前记录已不在列表中", "已清空编辑表单。");
    }
    renderChatMessages();
  } finally {
    state.chatMessagesLoading = false;
    syncChatActionState();
  }
}

function renderChatMessages() {
  const list = $("#chat-list");
  const includeHidden = Boolean($("#include-hidden-chat")?.checked);
  const hiddenCount = state.chatMessages.filter((message) => Number(message.hidden) === 1).length;
  const filterText = normalizeFilterText(state.chatFilter);
  const visibleMessages = filterText
    ? state.chatMessages.filter((message) => chatMessageMatchesFilter(message, filterText))
    : state.chatMessages;
  const baseCountText = includeHidden && state.chatMessages.length
    ? `含隐藏 ${formatNumber(state.chatMessages.length)} 条 · ${formatNumber(hiddenCount)} 条隐藏`
    : `${includeHidden ? "含隐藏" : "可见"} ${formatNumber(state.chatMessages.length)} 条消息`;
  const countText = state.chatMessages.length && filterText
    ? `显示 ${formatNumber(visibleMessages.length)} / ${baseCountText}`
    : baseCountText;
  setElementText($("#chat-list-count"), countText);
  renderChatStatusOverview(visibleMessages, Boolean(filterText));
  syncBoxLabel(list, state.chatMessages.length ? `聊天记录：${countText}` : `聊天记录：${includeHidden ? "暂无聊天记录" : "暂无可见聊天记录"}`);
  updateSidebarLoadedSummary();
  if (!state.chatMessages.length) {
    list.replaceChildren(createEmptyStateElement(includeHidden ? "暂无聊天记录" : "暂无可见聊天记录"));
    syncChatActionState();
    return;
  }
  if (!visibleMessages.length) {
    list.replaceChildren(createEmptyStateElement("当前已加载消息中没有匹配结果，换个昵称、内容、来源或隐藏状态试试。"));
    syncChatActionState();
    return;
  }

  list.replaceChildren(...visibleMessages.map((message) => {
    const item = document.createElement("button");
    const title = document.createElement("span");
    const meta = document.createElement("span");
    const content = document.createElement("span");
    const createdAt = document.createElement("span");
    item.className = "list-item";
    if (message.message_id === state.selectedMessageId) {
      item.classList.add("active");
    }
    item.type = "button";
    item.dataset.messageId = message.message_id || "";
    item.disabled = isChatInteractionBusy();
    item.dataset.readyTitle = chatMessageListLabel(message);
    item.title = item.dataset.readyTitle;
    item.setAttribute("aria-label", item.dataset.readyTitle);
    item.setAttribute("aria-pressed", message.message_id === state.selectedMessageId ? "true" : "false");
    title.className = "list-title";
    setElementText(title, message.nickname || "");
    meta.className = "list-meta";
    meta.append(
      Number(message.hidden) ? createStatusBadgeElement("已隐藏", "hidden") : createStatusBadgeElement("可见", "visible"),
      createStatusBadgeElement(chatRoomBadgeLabel(message), isEncryptedChatMessage(message) ? "warning" : "neutral"),
      createStatusBadgeElement([message.country, message.region, message.city].filter(Boolean).join(" / ") || "未知来源", "neutral")
    );
    content.className = "list-subtle";
    setElementText(content, chatMessageDisplayContent(message));
    createdAt.className = "list-subtle";
    setElementText(createdAt, formatTime(message.created_at));
    item.append(title, meta, content, createdAt);
    return item;
  }));
  syncChatActionState();
}

function renderChatStatusOverview(messages, isFiltered) {
  const box = $("#chat-status-overview");
  if (!box) {
    return;
  }
  const rows = messages || [];
  const hiddenCount = rows.filter((message) => Number(message.hidden) === 1).length;
  const encryptedCount = rows.filter(isEncryptedChatMessage).length;
  const withPlace = rows.filter((message) => [message.country, message.region, message.city].some(Boolean)).length;
  const withVisitor = rows.filter((message) => Boolean(message.visitor_id)).length;
  const withBanSource = rows.filter((message) => Boolean(
    message.visitor_id || (message.ip_hash && isCurrentChatIpHash(message))
  )).length;
  const items = [
    [isFiltered ? "当前显示" : "已加载", rows.length],
    ["可见", Math.max(0, rows.length - hiddenCount)],
    ["已隐藏", hiddenCount],
    ["密码房", encryptedCount],
    ["有来源", withPlace],
    ["有用户标识", withVisitor],
    ["可禁言", withBanSource]
  ];
  box.replaceChildren(...items.map(([label, value]) => createListOverviewItem(label, value)));
}

function chatMessageMatchesFilter(message, filterText) {
  if (!filterText) {
    return true;
  }
  const visibility = Number(message.hidden) === 1 ? "已隐藏" : "可见";
  const room = chatRoomBadgeLabel(message);
  const searchText = [
    message.nickname,
    chatMessageDisplayContent(message),
    visibility,
    room,
    message.country,
    message.region,
    message.city,
    message.ip_prefix,
    message.visitor_id,
    formatTime(message.created_at)
  ].filter(Boolean).join(" ").toLowerCase();
  return searchText.includes(filterText);
}

function isEncryptedChatMessage(message) {
  return Number(message?.encrypted) === 1;
}

function isCurrentChatIpHash(message) {
  return Number(message?.ip_hash_current) === 1;
}

function chatMessageDisplayContent(message) {
  return isEncryptedChatMessage(message) ? "密码房加密消息（后台无法解密）" : (message?.content || "");
}

function chatRoomBadgeLabel(message) {
  return isEncryptedChatMessage(message) || (message?.room_key && message.room_key !== "public") ? "密码房" : "普通房间";
}

function renderChatListNotice(text, label = "聊天记录提示") {
  const list = $("#chat-list");
  setElementText($("#chat-list-count"), label);
  syncBoxLabel(list, `${label}：${text}`);
  list.replaceChildren(createEmptyStateElement(text));
  syncChatActionState();
}

function chatMessageListLabel(message) {
  const visibility = Number(message.hidden) === 1 ? "已隐藏" : "可见";
  const nickname = message.nickname || "未命名访客";
  const place = [message.country, message.region, message.city].filter(Boolean).join(" / ") || "未知来源";
  const content = chatMessageDisplayContent(message) || "空消息";
  return `${nickname}；${visibility}；${chatRoomBadgeLabel(message)}；${place}；${formatTime(message.created_at)}；${content}`;
}

function selectChatMessage(messageId) {
  const message = state.chatMessages.find((item) => item.message_id === messageId);
  if (!message) {
    return;
  }
  state.selectedMessageId = messageId;
  renderChatMessages();
  const form = $("#chat-form-admin");
  form.elements.nickname.value = message.nickname || "";
  form.elements.content.value = chatMessageDisplayContent(message);
  setElementText($("#chat-selected-id"), message.message_id);
  $("#chat-meta").replaceChildren(...[
    ["房间类型", chatRoomBadgeLabel(message)],
    ["内容状态", isEncryptedChatMessage(message) ? "密码房加密消息，后台不能解密或编辑内容" : "普通明文消息"],
    ["隐藏用户标识", message.visitor_id || ""],
    ["前端临时标识", message.client_id || ""],
    ["隐藏网络指纹", message.ip_hash || ""],
    [
      "网络指纹代次",
      !message.ip_hash
        ? "未记录"
        : (isCurrentChatIpHash(message) ? "当前代次，可用于禁言" : "旧代次，仅供审计，不能新建禁言")
    ],
    ["网络前缀", message.ip_prefix || ""],
    ["来源", [message.country, message.region, message.city].filter(Boolean).join(" / ") || "未知"]
  ].map(([label, value]) => createChatMetaItem(label, value)));
  setChatGovernanceTab("message", { focus: false });
  syncChatActionState();
  captureEditorBaseline("chat");
}

function selectedChatMessage() {
  return state.chatMessages.find((item) => item.message_id === state.selectedMessageId);
}

function resetChatForm(selectedText = "未选择", metaText = "") {
  $("#chat-form-admin").reset();
  setElementText($("#chat-selected-id"), selectedText);
  $("#chat-meta").replaceChildren(createEmptyStateElement(metaText || "选择消息后查看访客识别信息。"));
  syncChatActionState();
  captureEditorBaseline("chat");
}

function setChatGovernanceTab(tab, options = {}) {
  const nextTab = tab === "bans" ? "bans" : "message";
  state.chatGovernanceTab = nextTab;
  $$('[data-chat-governance-tab]').forEach((button) => {
    const active = button.dataset.chatGovernanceTab === nextTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
    button.tabIndex = active ? 0 : -1;
    if (active && options.focus) {
      button.focus();
    }
  });
  const messagePanel = $("#chat-message-governance");
  const bansPanel = $("#chat-bans-governance");
  const showMessage = nextTab === "message";
  messagePanel.hidden = !showMessage;
  messagePanel.classList.toggle("active", showMessage);
  bansPanel.hidden = showMessage;
  bansPanel.classList.toggle("active", !showMessage);
  setElementText($("#chat-detail-title"), showMessage ? "消息详情" : "禁言记录");
}

function syncChatActionState() {
  const message = selectedChatMessage();
  const hasMessage = Boolean(message);
  const busy = isChatInteractionBusy();
  const saveButton = $("#chat-form-admin button[type='submit']");
  const toggleButton = $("#toggle-chat-hidden");
  const deleteButton = $("#delete-chat-message");
  const visitorBanButton = $("#ban-chat-visitor");
  const ipBanButton = $("#ban-chat-ip");
  const actionButtons = [
    saveButton,
    toggleButton,
    deleteButton
  ].filter(Boolean);
  actionButtons.forEach((button) => {
    button.disabled = busy || !hasMessage;
    button.setAttribute("aria-busy", busy ? "true" : "false");
    if (!hasMessage) {
      button.setAttribute("aria-disabled", "true");
    } else if (busy) {
      button.removeAttribute("aria-disabled");
    } else {
      button.removeAttribute("aria-disabled");
    }
  });
  if (saveButton) {
    saveButton.textContent = state.chatActionBusyMode === "save" ? "保存中..." : "保存修改";
    syncButtonHint(
      saveButton,
      chatActionButtonHint(isEncryptedChatMessage(message) ? "保存昵称或隐藏状态；加密内容不能编辑" : "保存当前聊天记录修改", hasMessage, busy)
    );
  }
  if (toggleButton) {
    const hidden = hasMessage && Number(message.hidden) === 1;
    const label = hidden ? "恢复消息" : "隐藏消息";
    const busyLabel = hidden ? "恢复中..." : "隐藏中...";
    toggleButton.textContent = state.chatActionBusyMode === "toggle" ? busyLabel : label;
    syncButtonHint(toggleButton, chatActionButtonHint(label, hasMessage, busy));
  }
  if (deleteButton) {
    deleteButton.textContent = state.chatActionBusyMode === "delete" ? "删除中..." : "删除";
    syncButtonHint(deleteButton, chatActionButtonHint("删除当前聊天记录", hasMessage, busy));
  }
  if (visitorBanButton) {
    const missingVisitorId = hasMessage && !message.visitor_id;
    visitorBanButton.disabled = busy || !hasMessage || missingVisitorId;
    visitorBanButton.setAttribute("aria-busy", busy ? "true" : "false");
    visitorBanButton.setAttribute("aria-disabled", visitorBanButton.disabled ? "true" : "false");
    visitorBanButton.textContent = state.chatActionBusyMode === "banVisitor" ? "禁言中..." : "禁言用户标识";
    syncButtonHint(
      visitorBanButton,
      missingVisitorId ? "这条记录没有隐藏用户标识，无法按用户禁言" : chatActionButtonHint("按隐藏用户标识禁言", hasMessage, busy)
    );
  }
  if (ipBanButton) {
    const missingIpHash = hasMessage && !message.ip_hash;
    const staleIpHash = hasMessage && Boolean(message.ip_hash) && !isCurrentChatIpHash(message);
    ipBanButton.disabled = busy || !hasMessage || missingIpHash || staleIpHash;
    ipBanButton.setAttribute("aria-busy", busy ? "true" : "false");
    ipBanButton.setAttribute("aria-disabled", ipBanButton.disabled ? "true" : "false");
    ipBanButton.textContent = state.chatActionBusyMode === "banIp" ? "禁言中..." : "禁言网络来源";
    syncButtonHint(
      ipBanButton,
      missingIpHash
        ? "这条记录没有隐藏网络指纹，无法按网络来源禁言"
        : (staleIpHash
          ? "这条记录使用旧代次网络指纹；请等待该来源产生新消息"
          : chatActionButtonHint("按网络来源禁言", hasMessage, busy))
    );
  }
  syncChatListBusyState();
  syncChatFilterBusyState();
  syncChatFormBusyState();
}

function chatActionButtonHint(readyHint, hasMessage, busy) {
  if (!hasMessage) {
    return "请先选择聊天记录";
  }
  if (busy) {
    return chatInteractionBusyTitle();
  }
  return readyHint;
}

function isChatActionBusy() {
  return state.chatActionBusy;
}

function isChatMessagesLoading() {
  return state.chatMessagesLoading;
}

function isChatInteractionBusy() {
  return isChatActionBusy() || isChatMessagesLoading();
}

function isChatFilterBusy() {
  return isChatInteractionBusy();
}

function syncChatListBusyState() {
  const busy = isChatInteractionBusy();
  const busyTitle = isChatMessagesLoading() ? "正在读取聊天记录，完成后再切换" : chatActionBusyListTitle();
  $$("#chat-list .list-item").forEach((item) => {
    const hint = busy ? busyTitle : (item.dataset.readyTitle || "打开这条聊天记录");
    item.disabled = busy;
    syncButtonHint(item, hint);
  });
}

function chatActionBusyListTitle() {
  return {
    save: "正在保存聊天记录，完成后再切换",
    toggle: "正在处理聊天可见性，完成后再切换",
    delete: "正在删除聊天记录，完成后再切换",
    banVisitor: "正在禁言用户标识，完成后再切换",
    banIp: "正在禁言网络来源，完成后再切换"
  }[state.chatActionBusyMode] || "正在处理聊天记录，完成后再切换";
}

function syncChatFilterBusyState() {
  const checkbox = $("#include-hidden-chat");
  if (!checkbox) {
    return;
  }
  const busy = isChatFilterBusy();
  const title = busy ? chatFilterBusyTitle() : "显示或隐藏已隐藏聊天记录";
  checkbox.disabled = busy;
  checkbox.title = title;
  checkbox.closest("label")?.setAttribute("title", title);
}

function chatFilterBusyTitle() {
  if (isChatActionBusy()) {
    return chatActionBusyFilterTitle();
  }
  if (isChatMessagesLoading()) {
    return "正在读取聊天记录，完成后再调整筛选";
  }
  return "显示或隐藏已隐藏聊天记录";
}

function chatActionBusyFilterTitle() {
  return {
    save: "正在保存聊天记录，完成后再调整筛选",
    toggle: "正在处理聊天可见性，完成后再调整筛选",
    delete: "正在删除聊天记录，完成后再调整筛选",
    banVisitor: "正在禁言用户标识，完成后再调整筛选",
    banIp: "正在禁言网络来源，完成后再调整筛选"
  }[state.chatActionBusyMode] || "正在处理聊天记录，完成后再调整筛选";
}

function syncChatFormBusyState() {
  const busy = isChatInteractionBusy();
  const message = selectedChatMessage();
  const encrypted = isEncryptedChatMessage(message);
  const title = busy ? (isChatMessagesLoading() ? "正在读取聊天记录，完成后再编辑表单" : chatActionBusyFormTitle()) : "";
  $$("#chat-form-admin input, #chat-form-admin textarea").forEach((field) => {
    const lockedEncryptedContent = encrypted && field.name === "content";
    field.disabled = busy || lockedEncryptedContent;
    field.setAttribute("aria-busy", busy ? "true" : "false");
    if (lockedEncryptedContent) {
      field.title = "密码房加密消息不能在后台解密或编辑内容";
    } else if (title) {
      field.title = title;
    } else {
      field.removeAttribute("title");
    }
  });
}

function chatActionBusyFormTitle() {
  return {
    save: "正在保存聊天记录，完成后再编辑表单",
    toggle: "正在处理聊天可见性，完成后再编辑表单",
    delete: "正在删除聊天记录，完成后再编辑表单",
    banVisitor: "正在禁言用户标识，完成后再编辑表单",
    banIp: "正在禁言网络来源，完成后再编辑表单"
  }[state.chatActionBusyMode] || "正在处理聊天记录，完成后再编辑表单";
}

function chatInteractionBusyTitle() {
  return isChatMessagesLoading() ? "正在读取聊天记录" : "正在处理聊天记录";
}

function setChatActionBusy(mode) {
  state.chatActionBusy = Boolean(mode);
  state.chatActionBusyMode = mode || "";
  syncChatActionState();
}

function showChatActionError(error) {
  setElementText($("#chat-selected-id"), `操作失败：${error.message}`);
}

async function saveChatMessage(event) {
  event?.preventDefault?.();
  if (state.chatActionBusy) {
    return false;
  }
  const message = selectedChatMessage();
  if (!message) {
    return false;
  }
  setChatActionBusy("save");
  const form = $("#chat-form-admin");
  const body = {
    nickname: form.elements.nickname.value,
    hidden: Number(message.hidden) === 1
  };
  if (!isEncryptedChatMessage(message)) {
    body.content = form.elements.content.value;
  }
  try {
    await api(`/api/admin/chat/messages/${encodeURIComponent(message.message_id)}`, {
      method: "PUT",
      body: JSON.stringify(body)
    });
    await loadChatMessages();
    selectChatMessage(message.message_id);
    captureEditorBaseline("chat", { saved: true });
    setElementText($("#chat-selected-id"), `已保存 ${message.nickname || message.message_id} · 操作人 ${state.user?.email || "当前管理员"}`);
    return true;
  } catch (error) {
    showChatActionError(error);
    refreshEditorDirtyState("chat");
    return false;
  } finally {
    setChatActionBusy("");
  }
}

async function toggleChatHidden() {
  if (state.chatActionBusy) {
    return;
  }
  const message = selectedChatMessage();
  if (!message) {
    return;
  }
  if (!(await confirmEditorCanLeave("chat", "切换消息可见性会重新读取详情，请先处理未保存的昵称或正文。"))) {
    return;
  }
  setChatActionBusy("toggle");
  try {
    await api(`/api/admin/chat/messages/${encodeURIComponent(message.message_id)}`, {
      method: "PUT",
      body: JSON.stringify({ hidden: Number(message.hidden) !== 1 })
    });
    await loadChatMessages();
    selectChatMessage(message.message_id);
    const action = Number(message.hidden) === 1 ? "恢复" : "隐藏";
    setElementText($("#chat-selected-id"), `${action}成功：${message.nickname || message.message_id} · 操作人 ${state.user?.email || "当前管理员"}`);
  } catch (error) {
    showChatActionError(error);
  } finally {
    setChatActionBusy("");
  }
}

async function deleteChatMessage() {
  if (state.chatActionBusy) {
    return;
  }
  const message = selectedChatMessage();
  if (!message) {
    return;
  }
  if (!(await confirmEditorCanLeave("chat", "永久删除会丢弃当前消息尚未保存的编辑内容。"))) {
    return;
  }
  const confirmed = await openConfirmDialog({
    title: "永久删除聊天消息",
    object: `${message.nickname || "未命名访客"} · ${formatTime(message.created_at) || message.message_id}`,
    state: `${chatRoomBadgeLabel(message)} · ${Number(message.hidden) === 1 ? "已隐藏" : "当前可见"}`,
    impact: "这条消息会从聊天室记录中永久删除。",
    recovery: "不可恢复；如只是日常治理，优先使用隐藏消息。",
    confirmLabel: "永久删除"
  });
  if (!confirmed) {
    return;
  }
  setChatActionBusy("delete");
  try {
    await api(`/api/admin/chat/messages/${encodeURIComponent(message.message_id)}`, { method: "DELETE" });
    state.selectedMessageId = "";
    resetChatForm();
    await loadChatMessages();
    setElementText($("#chat-selected-id"), `已删除 ${message.nickname || message.message_id} · 操作人 ${state.user?.email || "当前管理员"}`);
  } catch (error) {
    showChatActionError(error);
  } finally {
    setChatActionBusy("");
  }
}

async function banSelectedChat(type) {
  if (state.chatActionBusy || state.banListBusy) {
    return;
  }
  const message = selectedChatMessage();
  if (!message) {
    return;
  }
  if (type === "visitor" && !message.visitor_id) {
    showChatActionError(new Error("这条记录没有隐藏用户标识，无法按用户禁言。"));
    return;
  }
  if ((type === "ip_hash" || type === "ip") && !message.ip_hash) {
    showChatActionError(new Error("这条记录没有隐藏网络指纹，无法按网络来源禁言。"));
    return;
  }
  if ((type === "ip_hash" || type === "ip") && !isCurrentChatIpHash(message)) {
    showChatActionError(new Error("这条记录使用旧代次网络指纹；请等待该来源产生新消息后再禁言。"));
    return;
  }
  const form = $("#chat-form-admin");
  const reason = form.elements.ban_reason.value.trim() || "后台禁言";
  const durationHours = Number(form.elements.ban_hours.value || 0);
  const networkBan = type === "ip_hash" || type === "ip";
  const targetLabel = networkBan
    ? (message.ip_prefix || "当前网络来源")
    : (message.nickname || message.visitor_id || "当前用户标识");
  const confirmed = await openConfirmDialog({
    title: networkBan ? "禁言网络来源" : "禁言用户标识",
    object: targetLabel,
    state: `${chatRoomBadgeLabel(message)} · ${Number(message.hidden) === 1 ? "消息已隐藏" : "消息可见"}`,
    impact: `${durationHours > 0 ? `${durationHours} 小时` : "长期"}禁止继续发送消息；原因：${reason}。`,
    recovery: `可在禁言记录中停用；执行人：${state.user?.email || "当前管理员"}。`,
    confirmLabel: "确认禁言"
  });
  if (!confirmed) {
    return;
  }
  setChatActionBusy(type === "ip_hash" || type === "ip" ? "banIp" : "banVisitor");
  setBanListBusy("refresh");
  const body = {
    type,
    reason,
    durationHours,
    messageId: message.message_id,
    visitorId: message.visitor_id
  };
  try {
    await api("/api/admin/chat/bans", { method: "POST", body: JSON.stringify(body) });
    await loadBans();
    setElementText($("#chat-selected-id"), `禁言成功：${targetLabel} · 操作人 ${state.user?.email || "当前管理员"}`);
    setChatGovernanceTab("bans", { focus: true });
  } catch (error) {
    showChatActionError(error);
  } finally {
    setBanListBusy("");
    setChatActionBusy("");
  }
}

async function loadBans() {
  const payload = await api("/api/admin/chat/bans");
  state.bans = payload.bans || [];
  renderBans();
}

function renderBans() {
  const list = $("#ban-list");
  const activeCount = state.bans.filter(isEffectiveChatBan).length;
  const filterText = normalizeFilterText(state.banFilter);
  const visibleBans = filterText
    ? state.bans.filter((ban) => banMatchesFilter(ban, filterText))
    : state.bans;
  const countText = state.bans.length
    ? `${filterText ? `显示 ${formatNumber(visibleBans.length)} / ` : ""}共 ${formatNumber(state.bans.length)} 条 · ${formatNumber(activeCount)} 条生效中`
    : "0 条禁言";
  setElementText($("#ban-list-count"), countText);
  renderBanStatusOverview(visibleBans, Boolean(filterText));
  syncBoxLabel(list, state.bans.length ? `禁言列表：${countText}` : "禁言列表：暂无记录");
  if (!state.bans.length) {
    list.replaceChildren(createEmptyStateElement("暂无禁言记录"));
    syncBanListButtons();
    return;
  }
  if (!visibleBans.length) {
    list.replaceChildren(createEmptyStateElement("没有匹配的禁言记录，换个对象、原因、状态或来源类型试试。"));
    syncBanListButtons();
    return;
  }

  list.replaceChildren(...visibleBans.map((ban) => {
    const item = document.createElement("article");
    const meta = document.createElement("div");
    const target = document.createElement("small");
    const duration = document.createElement("small");
    item.className = "ban-item";
    item.tabIndex = 0;
    meta.className = "list-meta";
    item.title = banListLabel(ban);
    item.setAttribute("aria-label", item.title);
    const statusLabel = chatBanStatusLabel(ban);
    meta.append(
      createStatusBadgeElement(statusLabel, isEffectiveChatBan(ban) ? "active" : "off"),
      createStatusBadgeElement(banTypeLabel(ban.ban_type), "neutral")
    );
    const targetText = `${ban.visitor_id || ban.ip_prefix || ban.ip_hash || ""} · ${ban.reason || ""}`;
    const durationText = `${formatTime(ban.created_at)}${ban.expires_at ? ` 到 ${formatTime(ban.expires_at)}` : " · 长期"}`;
    target.textContent = targetText;
    target.title = targetText;
    duration.textContent = durationText;
    duration.title = durationText;
    item.append(meta, target, duration);
    if (ban.active) {
      const button = document.createElement("button");
      button.className = "xp-button";
      button.type = "button";
      button.dataset.disableBan = ban.ban_id || "";
      button.textContent = "停用";
      syncButtonHint(button, "停用这条禁言");
      item.append(button);
    }
    return item;
  }));
  syncBanListButtons();
}

function renderBanStatusOverview(bans, isFiltered) {
  const box = $("#ban-status-overview");
  if (!box) {
    return;
  }
  const rows = bans || [];
  const activeCount = rows.filter(isEffectiveChatBan).length;
  const expiredCount = rows.filter((ban) => ban.active && Number(ban.expired) === 1).length;
  const staleCount = rows.filter((ban) => (
    ban.active && Number(ban.expired) !== 1 && !isCurrentChatBanTarget(ban)
  )).length;
  const userCount = rows.filter((ban) => ban.ban_type === "visitor").length;
  const ipCount = rows.filter((ban) => ban.ban_type === "ip_hash" || ban.ban_type === "ip").length;
  const reasonCount = rows.filter((ban) => Boolean(ban.reason)).length;
  const items = [
    [isFiltered ? "当前显示" : "全部禁言", rows.length],
    ["生效中", activeCount],
    ["已停用/失效", Math.max(0, rows.length - activeCount)],
    ["已过期", expiredCount],
    ["密钥已轮换", staleCount],
    ["按用户", userCount],
    ["按网络来源", ipCount],
    ["有原因", reasonCount]
  ];
  box.replaceChildren(...items.map(([label, value]) => createListOverviewItem(label, value)));
}

function banMatchesFilter(ban, filterText) {
  if (!filterText) {
    return true;
  }
  const target = ban.visitor_id || ban.ip_prefix || ban.ip_hash || "";
  const searchText = [
    chatBanStatusLabel(ban),
    banTypeLabel(ban.ban_type),
    ban.ban_type,
    target,
    ban.reason,
    ban.ip_prefix,
    formatTime(ban.created_at),
    formatTime(ban.expires_at),
    ban.expires_at ? "有期限" : "长期"
  ].filter(Boolean).join(" ").toLowerCase();
  return searchText.includes(filterText);
}

function renderBanListNotice(text, label = "禁言列表提示") {
  const list = $("#ban-list");
  setElementText($("#ban-list-count"), label);
  syncBoxLabel(list, `${label}：${text}`);
  list.replaceChildren(createEmptyStateElement(text));
  syncBanListButtons();
}

function banListLabel(ban) {
  const target = ban.visitor_id || ban.ip_prefix || ban.ip_hash || "未记录目标";
  const reason = ban.reason || "未记录原因";
  const expires = ban.expires_at ? `到期 ${formatTime(ban.expires_at)}` : "长期";
  return [
    chatBanStatusLabel(ban),
    banTypeLabel(ban.ban_type),
    `目标 ${target}`,
    `原因 ${reason}`,
    `创建 ${formatTime(ban.created_at) || "未记录"}`,
    expires
  ].join("；");
}

function isCurrentChatBanTarget(ban) {
  return !["ip_hash", "ip"].includes(ban?.ban_type) || Number(ban?.target_current) === 1;
}

function isEffectiveChatBan(ban) {
  return Number(ban?.effective) === 1;
}

function chatBanStatusLabel(ban) {
  if (!ban?.active) {
    return "已停用";
  }
  if (Number(ban?.expired) === 1) {
    return "已过期";
  }
  return isCurrentChatBanTarget(ban) ? "生效中" : "密钥已轮换";
}

function banTypeLabel(type) {
  return {
    visitor: "用户标识",
    ip_hash: "网络来源"
  }[type] || type || "未知类型";
}

function setBanListBusy(mode = "", banId = "") {
  state.banListBusy = Boolean(mode);
  state.banListBusyMode = mode;
  state.banBusyId = banId;
  syncBanListButtons();
}

function syncBanListButtons() {
  const refreshButton = $("#refresh-bans");
  if (refreshButton) {
    const refreshing = state.banListBusyMode === "refresh";
    refreshButton.disabled = state.banListBusy;
    refreshButton.textContent = refreshing ? "刷新中..." : "刷新";
    refreshButton.setAttribute("aria-busy", refreshing ? "true" : "false");
    syncButtonHint(refreshButton, state.banListBusy ? "正在读取禁言列表" : "刷新禁言列表");
  }
  $$("[data-disable-ban]").forEach((button) => {
    const disabling = state.banListBusyMode === "disable" && button.dataset.disableBan === state.banBusyId;
    button.disabled = state.banListBusy;
    button.textContent = disabling ? "停用中..." : "停用";
    button.setAttribute("aria-busy", disabling ? "true" : "false");
    syncButtonHint(button, state.banListBusy ? "正在处理禁言记录" : "停用这条禁言");
  });
}

async function refreshBans() {
  if (state.banListBusy) {
    return;
  }
  setBanListBusy("refresh");
  try {
    await loadBans();
  } catch (error) {
    renderBanListNotice(`读取禁言列表失败：${error.message}`, "禁言列表错误");
  } finally {
    setBanListBusy("");
  }
}

async function disableBan(banId) {
  if (state.banListBusy) {
    return;
  }
  const ban = state.bans.find((item) => item.ban_id === banId);
  if (!ban) {
    return;
  }
  const confirmed = await openConfirmDialog({
    title: "停用禁言",
    object: ban.visitor_id || ban.ip_prefix || ban.ip_hash || banId,
    state: `${chatBanStatusLabel(ban)} · ${banTypeLabel(ban.ban_type)}`,
    impact: "停用后，该目标将不再被这条禁言记录拦截。",
    recovery: `如需再次限制，必须重新建立禁言；操作人：${state.user?.email || "当前管理员"}。`,
    confirmLabel: "确认停用"
  });
  if (!confirmed) {
    return;
  }
  setBanListBusy("disable", banId);
  try {
    await api(`/api/admin/chat/bans/${encodeURIComponent(banId)}`, { method: "DELETE" });
    await loadBans();
    setElementText($("#chat-selected-id"), `已停用禁言：${ban.reason || banId} · 操作人 ${state.user?.email || "当前管理员"}`);
  } catch (error) {
    renderBanListNotice(`停用禁言失败：${error.message}`, "禁言列表错误");
  } finally {
    setBanListBusy("");
  }
}

async function loadAccounts() {
  const payload = await api("/api/admin/accounts");
  state.accounts = payload.accounts || [];
  renderAccountSummary();
  renderAccountList();
  if (state.selectedAccountId && !state.accounts.some((account) => account.id === state.selectedAccountId)) {
    state.selectedAccountId = "";
    state.accountDetail = null;
    resetAccountForm();
    renderAccountDetail();
    $("#account-status").textContent = "当前账号已不在列表中，已清空编辑表单。";
    syncAccountSaveButton();
  }
  return {};
}

function renderAccountSummary() {
  const total = state.accounts.length;
  const admins = state.accounts.filter((account) => account.role === "admin").length;
  const active = state.accounts.filter((account) => Number(account.active_sessions || 0) > 0).length;
  const summary = $("#account-summary");
  const countText = total
    ? `共 ${formatNumber(total)} 个 · 管理员 ${formatNumber(admins)} · 活跃 ${formatNumber(active)}`
    : "暂无账号数据";
  setElementText($("#account-list-count"), countText);
  syncBoxLabel(summary, total ? `账号概览：${countText}` : "账号概览：暂无账号数据");
  if (!total) {
    summary.replaceChildren(createEmptyStateElement("暂无账号数据，注册账号后会显示角色、登录和云存档概览。"));
    return;
  }
  const items = [
    `共 ${formatNumber(total)} 个注册账号`,
    `${formatNumber(admins)} 个管理员`,
    `${formatNumber(active)} 个账号有活跃会话`
  ];
  summary.replaceChildren(...items.map((text) => {
    const item = document.createElement("span");
    setElementText(item, text);
    return item;
  }));
}

function renderAccountList() {
  const list = $("#account-list");
  const filterText = normalizeFilterText(state.accountFilter);
  const visibleAccounts = filterText
    ? state.accounts.filter((account) => accountMatchesFilter(account, filterText))
    : state.accounts;
  const admins = state.accounts.filter((account) => account.role === "admin").length;
  const active = state.accounts.filter((account) => Number(account.active_sessions || 0) > 0).length;
  const countText = state.accounts.length
    ? `${filterText ? `显示 ${formatNumber(visibleAccounts.length)} / ` : ""}共 ${formatNumber(state.accounts.length)} 个 · 管理员 ${formatNumber(admins)} · 活跃 ${formatNumber(active)}`
    : "暂无账号数据";
  setElementText($("#account-list-count"), countText);
  renderAccountStatusOverview(visibleAccounts, Boolean(filterText));
  syncBoxLabel(list, state.accounts.length ? `账号列表：${countText}` : "账号列表：暂无账号");
  updateSidebarLoadedSummary();
  if (!state.accounts.length) {
    list.replaceChildren(createEmptyStateElement("还没有注册账号。"));
    syncAccountListBusyState();
    return;
  }
  if (!visibleAccounts.length) {
    list.replaceChildren(createEmptyStateElement("没有匹配的账号，换个邮箱、角色、密码状态或活跃信息试试。"));
    syncAccountListBusyState();
    return;
  }

  list.replaceChildren(...visibleAccounts.map((account) => {
    const item = document.createElement("button");
    const title = document.createElement("span");
    const meta = document.createElement("span");
    const summary = document.createElement("span");
    item.className = "list-item";
    if (account.id === state.selectedAccountId) {
      item.classList.add("active");
    }
    item.type = "button";
    item.dataset.accountId = account.id || "";
    item.disabled = isAccountWriteBusy();
    item.dataset.readyTitle = accountListLabel(account);
    item.title = item.dataset.readyTitle;
    item.setAttribute("aria-label", item.dataset.readyTitle);
    item.setAttribute("aria-pressed", account.id === state.selectedAccountId ? "true" : "false");
    title.className = "list-title";
    setElementText(title, account.email || "");
    meta.className = "list-meta";
    meta.append(
      createStatusBadgeElement(account.role === "admin" ? "管理员" : "普通用户", account.role === "admin" ? "active" : "neutral"),
      createStatusBadgeElement(account.password_status || "已加密保存", "visible"),
      createStatusBadgeElement(`${formatNumber(account.active_sessions)} 个活跃会话`, Number(account.active_sessions || 0) ? "active" : "off")
    );
    summary.className = "list-subtle";
    setElementText(summary, `最近登录：${formatTime(account.last_login_at) || "暂无记录"} · 登录 ${formatNumber(account.login_count)} 次 · 云存档 ${formatNumber(account.save_slots)} 个`);
    item.append(title, meta, summary);
    return item;
  }));
  syncAccountListBusyState();
}

function renderAccountStatusOverview(accounts, isFiltered) {
  const box = $("#account-status-overview");
  if (!box) {
    return;
  }
  const rows = accounts || [];
  const adminCount = rows.filter((account) => account.role === "admin").length;
  const activeCount = rows.filter((account) => Number(account.active_sessions || 0) > 0).length;
  const saveCount = rows.filter((account) => Number(account.save_slots || 0) > 0).length;
  const loginCount = rows.filter((account) => Boolean(account.last_login_at)).length;
  const items = [
    [isFiltered ? "当前显示" : "全部账号", rows.length],
    ["管理员", adminCount],
    ["普通用户", Math.max(0, rows.length - adminCount)],
    ["当前活跃", activeCount],
    ["有云存档", saveCount],
    ["有登录记录", loginCount]
  ];
  box.replaceChildren(...items.map(([label, value]) => createListOverviewItem(label, value)));
}

function accountMatchesFilter(account, filterText) {
  if (!filterText) {
    return true;
  }
  const role = account.role === "admin" ? "管理员" : "普通用户";
  const searchText = [
    account.email,
    role,
    account.role,
    account.password_status,
    `${formatNumber(account.active_sessions)} 个活跃会话`,
    `最近登录 ${formatTime(account.last_login_at) || "暂无记录"}`,
    `登录 ${formatNumber(account.login_count)} 次`,
    `云存档 ${formatNumber(account.save_slots)} 个`
  ].filter(Boolean).join(" ").toLowerCase();
  return searchText.includes(filterText);
}

function renderAccountListNotice(text, label = "账号列表提示") {
  const summary = $("#account-summary");
  const list = $("#account-list");
  setElementText($("#account-list-count"), label);
  syncBoxLabel(summary, `${label}：${text}`);
  syncBoxLabel(list, `${label}：${text}`);
  summary.replaceChildren(createEmptyStateElement(text));
  list.replaceChildren(createEmptyStateElement(text));
  syncAccountListBusyState();
  syncAccountSaveButton();
}

function accountListLabel(account) {
  const role = account.role === "admin" ? "管理员" : "普通用户";
  return [
    account.email || "未记录邮箱",
    role,
    account.password_status || "已加密保存",
    `${formatNumber(account.active_sessions)} 个活跃会话`,
    `最近登录 ${formatTime(account.last_login_at) || "暂无记录"}`,
    `登录 ${formatNumber(account.login_count)} 次`,
    `云存档 ${formatNumber(account.save_slots)} 个`
  ].join("；");
}

async function selectAccount(accountId) {
  state.selectedAccountId = accountId;
  state.accountDetail = null;
  resetAccountForm("正在读取账号详情...");
  $("#account-status").textContent = "正在读取账号详情...";
  renderAccountList();
  renderAccountDetail();
  syncAccountSaveButton();
  try {
    const detail = await api(`/api/admin/accounts/${encodeURIComponent(accountId)}`);
    if (state.selectedAccountId !== accountId) {
      return;
    }
    state.accountDetail = detail;
    state.accounts = upsertById(state.accounts, detail.account, "id");
    fillAccountForm(detail.account);
    renderAccountSummary();
    renderAccountList();
    renderAccountDetail();
    $("#account-status").textContent = "";
    return true;
  } catch (error) {
    if (state.selectedAccountId === accountId) {
      state.accountDetail = null;
      resetAccountForm("账号详情读取失败");
      renderAccountDetail();
      $("#account-status").textContent = `读取账号详情失败：${error.message}`;
    }
    return false;
  } finally {
    if (state.selectedAccountId === accountId) {
      syncAccountSaveButton();
    }
  }
}

function fillAccountForm(account) {
  const form = $("#account-form");
  const passwordForm = $("#account-password-form");
  setElementText($("#account-editor-title"), `编辑：${account.email}`);
  form.elements.email.value = account.email || "";
  form.elements.role.value = account.role || "user";
  form.elements.password_status.value = account.password_status || "已加密保存，不能查看原文";
  passwordForm.elements.password.value = "";
  passwordForm.elements.revoke_sessions.checked = true;
  captureEditorBaseline("accounts");
  syncAccountSaveButton();
}

function resetAccountForm(title = "选择账号后编辑") {
  const form = $("#account-form");
  const passwordForm = $("#account-password-form");
  setElementText($("#account-editor-title"), title);
  form.elements.email.value = "";
  form.elements.role.value = "user";
  form.elements.password_status.value = "已加密保存，不能查看原文";
  passwordForm.elements.password.value = "";
  passwordForm.elements.revoke_sessions.checked = true;
  captureEditorBaseline("accounts");
  syncAccountSaveButton();
}

function markAccountSavedWhilePreservingPasswordDraft() {
  const passwordForm = $("#account-password-form");
  const password = passwordForm.elements.password.value;
  const revokeSessions = passwordForm.elements.revoke_sessions.checked;
  passwordForm.elements.password.value = "";
  passwordForm.elements.revoke_sessions.checked = true;
  captureEditorBaseline("accounts", { saved: true });
  passwordForm.elements.password.value = password;
  passwordForm.elements.revoke_sessions.checked = revokeSessions;
  refreshEditorDirtyState("accounts");
}

async function saveAccountProfile(event) {
  event?.preventDefault?.();
  if (state.accountSaving) {
    return false;
  }
  if (!state.selectedAccountId) {
    $("#account-status").textContent = "请先选择一个账号。";
    syncAccountSaveButton();
    return false;
  }
  if (!state.accountDetail || state.accountDetail.account?.id !== state.selectedAccountId) {
    $("#account-status").textContent = "请等待账号详情读取完成后再保存。";
    syncAccountSaveButton();
    return false;
  }
  const form = $("#account-form");
  const payload = {
    email: form.elements.email.value.trim(),
    role: form.elements.role.value
  };
  const existingAccount = state.accountDetail.account;
  if (payload.role !== existingAccount.role) {
    const confirmed = await openConfirmDialog({
      title: payload.role === "admin" ? "授予管理员权限" : "移除管理员权限",
      object: existingAccount.email || state.selectedAccountId,
      state: existingAccount.role === "admin" ? "当前为管理员" : "当前为普通用户",
      impact: payload.role === "admin"
        ? "保存后，该账号将可以进入管理后台并执行管理操作。"
        : "保存后，该账号将失去管理后台访问权限；当前管理员和最后一个管理员不能被降级。",
      recovery: `可以由其他管理员再次调整角色；操作人：${state.user?.email || "当前管理员"}。`,
      confirmLabel: payload.role === "admin" ? "确认授权" : "确认降级"
    });
    if (!confirmed) {
      return false;
    }
  }
  state.accountSaving = true;
  syncAccountSaveButton();
  $("#account-status").textContent = "正在保存账号资料...";
  try {
    const detail = await api(`/api/admin/accounts/${encodeURIComponent(state.selectedAccountId)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    state.accountDetail = detail;
    state.accounts = upsertById(state.accounts, detail.account, "id");
    form.elements.email.value = detail.account.email || "";
    form.elements.role.value = detail.account.role || "user";
    form.elements.password_status.value = detail.account.password_status || "已加密保存，不能查看原文";
    setElementText($("#account-editor-title"), `编辑：${detail.account.email}`);
    renderAccountSummary();
    renderAccountList();
    renderAccountDetail();
    markAccountSavedWhilePreservingPasswordDraft();
    $("#account-status").textContent = `已保存账号资料。操作人：${state.user?.email || "当前管理员"}。`;
    return true;
  } catch (error) {
    $("#account-status").textContent = error.message;
    refreshEditorDirtyState("accounts");
    return false;
  } finally {
    state.accountSaving = false;
    syncAccountSaveButton();
  }
}

async function resetAccountPassword(event) {
  event?.preventDefault?.();
  if (state.accountSaving) {
    return false;
  }
  if (!state.selectedAccountId || state.accountDetail?.account?.id !== state.selectedAccountId) {
    setElementText($("#account-status"), "请先选择账号并等待详情读取完成。");
    syncAccountSaveButton();
    return false;
  }
  const form = $("#account-password-form");
  const password = form.elements.password.value;
  const revokeSessions = Boolean(form.elements.revoke_sessions.checked);
  if (password.length < 8) {
    setElementText($("#account-status"), "新密码至少需要 8 个字符。");
    form.elements.password.focus();
    return false;
  }
  const account = state.accountDetail.account;
  const confirmed = await openConfirmDialog({
    title: "重置账号密码",
    object: account.email || state.selectedAccountId,
    state: account.password_status || "密码已加密保存",
    impact: revokeSessions
      ? "新密码将立即生效，并撤销该账号的其他登录会话。"
      : "新密码将立即生效，现有登录会话将继续保留。",
    recovery: `密码原文无法取回，只能再次重置；操作人：${state.user?.email || "当前管理员"}。`,
    confirmLabel: "确认重置"
  });
  if (!confirmed) {
    return false;
  }
  state.accountSaving = true;
  syncAccountSaveButton();
  setElementText($("#account-status"), "正在重置密码...");
  try {
    const detail = await api(`/api/admin/accounts/${encodeURIComponent(state.selectedAccountId)}`, {
      method: "PUT",
      body: JSON.stringify({ password, revokeSessions })
    });
    state.accountDetail = detail;
    state.accounts = upsertById(state.accounts, detail.account, "id");
    $("#account-form").elements.password_status.value = detail.account.password_status || "已加密保存，不能查看原文";
    form.elements.password.value = "";
    form.elements.revoke_sessions.checked = true;
    const tracking = editorTracking("accounts");
    tracking.lastSavedAt = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date());
    refreshEditorDirtyState("accounts");
    renderAccountSummary();
    renderAccountList();
    renderAccountDetail();
    setElementText(
      $("#account-status"),
      revokeSessions ? "密码已重置，其他登录会话已撤销。" : "密码已重置，现有登录会话已保留。"
    );
    return true;
  } catch (error) {
    setElementText($("#account-status"), error.message);
    refreshEditorDirtyState("accounts");
    return false;
  } finally {
    state.accountSaving = false;
    syncAccountSaveButton();
  }
}

function syncAccountSaveButton() {
  const profileButton = $("#save-account-profile");
  const passwordButton = $("#reset-account-password");
  if (!profileButton || !passwordButton) {
    syncAccountFormBusyState();
    syncAccountListBusyState();
    return;
  }
  const hasAccount = Boolean(state.selectedAccountId);
  const hasLoadedAccount = Boolean(state.accountDetail?.account?.id === state.selectedAccountId);
  const passwordReady = Boolean($("#account-password-form")?.elements?.password?.value);
  profileButton.disabled = state.accountSaving || !hasAccount || !hasLoadedAccount;
  passwordButton.disabled = state.accountSaving || !hasAccount || !hasLoadedAccount || !passwordReady;
  profileButton.textContent = state.accountSaving ? "处理中..." : "保存账号资料";
  passwordButton.textContent = state.accountSaving ? "处理中..." : "确认重置密码";
  profileButton.setAttribute("aria-busy", state.accountSaving ? "true" : "false");
  passwordButton.setAttribute("aria-busy", state.accountSaving ? "true" : "false");
  let hint = "保存当前账号资料";
  if (!hasAccount) {
    hint = "请先选择账号";
  } else if (!hasLoadedAccount) {
    hint = "请先等待账号详情读取完成";
  } else if (state.accountSaving) {
    hint = "正在保存账号";
  }
  syncButtonHint(profileButton, hint);
  syncButtonHint(
    passwordButton,
    !hasAccount
      ? "请先选择账号"
      : (!hasLoadedAccount
        ? "请先等待账号详情读取完成"
        : (state.accountSaving ? "正在处理账号" : (passwordReady ? "重置当前账号密码" : "请先输入新密码")))
  );
  syncAccountFormBusyState();
  syncAccountListBusyState();
}

function isAccountWriteBusy() {
  return state.accountSaving;
}

function syncAccountListBusyState() {
  const busy = isAccountWriteBusy();
  $$("#account-list .list-item").forEach((item) => {
    const hint = busy ? "正在保存账号，完成后再切换" : (item.dataset.readyTitle || "打开这个账号");
    item.disabled = busy;
    syncButtonHint(item, hint);
  });
}

function syncAccountFormBusyState() {
  const hasLoadedAccount = Boolean(state.selectedAccountId && state.accountDetail?.account?.id === state.selectedAccountId);
  const locked = isAccountWriteBusy() || !hasLoadedAccount;
  const title = !state.selectedAccountId
    ? "请先选择账号"
    : (isAccountDetailPending() ? accountDetailPendingFormTitle() : accountBusyFormTitle());
  $$("#account-form input, #account-form select, #account-password-form input").forEach((field) => {
    field.disabled = locked;
    field.setAttribute("aria-busy", locked ? "true" : "false");
    if (locked) {
      field.title = title;
    } else {
      field.removeAttribute("title");
    }
  });
}

function isAccountDetailPending() {
  return Boolean(state.selectedAccountId && !state.accountDetail && !isAccountWriteBusy());
}

function accountDetailPendingFormTitle() {
  return "正在读取账号详情，完成后再编辑表单";
}

function accountBusyFormTitle() {
  return "正在保存账号，完成后再编辑表单";
}

function fillSocialLinksForm(links = state.socialLinks) {
  const form = $("#social-links-form");
  if (!form) {
    return;
  }
  const byPlatform = new Map((links || []).map((item) => [item.platform, item]));
  SOCIAL_LINK_PLATFORMS.forEach((platform) => {
    const field = form.elements[platform.platform];
    if (!field) {
      return;
    }
    const item = byPlatform.get(platform.platform) || platform;
    field.value = item.url || item.default_url || platform.default_url;
  });
  syncSocialLinksFormBusyState();
}

function resetSocialLinksFormToDefaults() {
  const form = $("#social-links-form");
  if (!form || state.socialLinksSaving) {
    return;
  }
  SOCIAL_LINK_PLATFORMS.forEach((item) => {
    form.elements[item.platform].value = item.default_url;
  });
  renderSocialLinkPreviewFromForm();
  refreshEditorDirtyState("socialLinks");
  setElementText($("#social-links-status"), "已填入默认链接，保存后才会写入数据库。");
}

function socialLinksPayloadFromForm() {
  const form = $("#social-links-form");
  return {
    links: SOCIAL_LINK_PLATFORMS.reduce((result, platform) => {
      result[platform.platform] = form.elements[platform.platform].value.trim();
      return result;
    }, {})
  };
}

async function loadSocialLinks() {
  const payload = await api("/api/admin/social-links");
  state.socialLinks = normalizeAdminSocialLinks(payload.links || []);
  fillSocialLinksForm(state.socialLinks);
  renderSocialLinkPreview();
  captureEditorBaseline("socialLinks");
  setElementText($("#social-links-status"), "");
}

function normalizeAdminSocialLinks(links) {
  const byPlatform = new Map((links || []).map((item) => [item.platform, item]));
  return SOCIAL_LINK_PLATFORMS.map((platform) => {
    const item = byPlatform.get(platform.platform) || {};
    return {
      platform: platform.platform,
      label: item.label || platform.label,
      url: item.url || item.default_url || platform.default_url,
      default_url: item.default_url || platform.default_url,
      updated_at: item.updated_at || ""
    };
  });
}

function socialLinksFromForm() {
  const form = $("#social-links-form");
  if (!form) {
    return normalizeAdminSocialLinks([]);
  }
  const savedByPlatform = new Map(state.socialLinks.map((item) => [item.platform, item]));
  return SOCIAL_LINK_PLATFORMS.map((platform) => ({
    ...platform,
    ...(savedByPlatform.get(platform.platform) || {}),
    url: form.elements[platform.platform]?.value.trim() || ""
  }));
}

function renderSocialLinkPreviewFromForm() {
  renderSocialLinkPreview(socialLinksFromForm());
}

function renderSocialLinkPreview(linksOverride = null) {
  const list = $("#social-link-preview-list");
  if (!list) {
    return;
  }
  const links = linksOverride || (state.socialLinks.length ? state.socialLinks : normalizeAdminSocialLinks([]));
  const countText = `${formatNumber(links.length)} 个入口`;
  setElementText($("#social-link-preview-count"), countText);
  renderSocialLinkStatusOverview(links);
  syncBoxLabel(list, `社交链接预览：${countText}`);
  updateSidebarLoadedSummary();
  list.replaceChildren(...links.map((item) => {
    const article = document.createElement("article");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    const code = document.createElement("code");
    const url = item.url || item.default_url || "";
    const displayLabel = socialPlatformDisplayLabel(item);
    const label = `${displayLabel}；${url}`;
    article.className = "event-item social-link-preview-item";
    article.tabIndex = 0;
    article.title = label;
    article.setAttribute("aria-label", label);
    setElementText(title, displayLabel);
    meta.className = "list-meta";
    meta.append(createStatusBadgeElement("公开图标", "visible"));
    if (item.updated_at) {
      meta.append(createStatusBadgeElement(`更新 ${formatTime(item.updated_at)}`, "neutral"));
    }
    setElementText(code, url || "未设置");
    article.append(title, meta, code);
    return article;
  }));
  syncSocialLinksFormBusyState();
}

function socialPlatformDisplayLabel(item) {
  const value = String(item?.platform || "").toLowerCase();
  const localLabel = SOCIAL_LINK_PLATFORMS.find((platform) => platform.platform === value)?.label;
  return localLabel || item?.label || item?.platform || "社交入口";
}

function renderSocialLinkStatusOverview(links) {
  const box = $("#social-link-status-overview");
  if (!box) {
    return;
  }
  const rows = links || [];
  const configuredCount = rows.filter((item) => Boolean(item.url || item.default_url)).length;
  const customCount = rows.filter((item) => Boolean(item.url) && item.url !== item.default_url).length;
  const defaultCount = rows.filter((item) => Boolean(item.default_url) && (!item.url || item.url === item.default_url)).length;
  const updatedCount = rows.filter((item) => Boolean(item.updated_at)).length;
  const missingCount = rows.filter((item) => !item.url && !item.default_url).length;
  const items = [
    ["全部入口", rows.length],
    ["已设置", configuredCount],
    ["自定义", customCount],
    ["默认链接", defaultCount],
    ["有更新记录", updatedCount],
    ["待补链接", missingCount]
  ];
  box.replaceChildren(...items.map(([label, value]) => createListOverviewItem(label, value)));
}

function renderSocialLinkPreviewNotice(text, label = "社交链接提示") {
  const list = $("#social-link-preview-list");
  if (!list) {
    return;
  }
  setElementText($("#social-link-preview-count"), label);
  syncBoxLabel(list, `${label}：${text}`);
  list.replaceChildren(createEmptyStateElement(text));
  syncSocialLinksFormBusyState();
}

function syncSocialLinksFormBusyState() {
  const form = $("#social-links-form");
  if (!form) {
    return;
  }
  const locked = state.socialLinksSaving;
  $$("#social-links-form input, #social-links-form button").forEach((field) => {
    field.disabled = locked;
    field.setAttribute("aria-busy", locked ? "true" : "false");
    if (locked) {
      field.title = "正在保存社交链接";
    } else if (field.id !== "save-social-links" && field.id !== "reset-social-links-defaults") {
      field.removeAttribute("title");
    }
  });
  const saveButton = $("#save-social-links");
  if (saveButton) {
    saveButton.textContent = locked ? "保存中..." : "保存链接";
    syncButtonHint(saveButton, locked ? "正在保存社交链接" : "保存社交链接");
  }
  const resetButton = $("#reset-social-links-defaults");
  if (resetButton && !locked) {
    syncButtonHint(resetButton, "恢复默认社交链接");
  }
}

async function saveSocialLinks(event) {
  event?.preventDefault?.();
  if (state.socialLinksSaving) {
    return false;
  }
  state.socialLinksSaving = true;
  setElementText($("#social-links-status"), "正在保存社交链接...");
  syncSocialLinksFormBusyState();
  try {
    const payload = await api("/api/admin/social-links", {
      method: "PUT",
      body: JSON.stringify(socialLinksPayloadFromForm())
    });
    state.socialLinks = normalizeAdminSocialLinks(payload.links || []);
    fillSocialLinksForm(state.socialLinks);
    renderSocialLinkPreview();
    captureEditorBaseline("socialLinks", { saved: true });
    setElementText($("#social-links-status"), "已保存，主站关于我图标将读取新的跳转地址。");
    state.loadedPanels[panelDataKey("socialLinks")] = Date.now();
    return true;
  } catch (error) {
    setElementText($("#social-links-status"), error.message);
    refreshEditorDirtyState("socialLinks");
    return false;
  } finally {
    state.socialLinksSaving = false;
    syncSocialLinksFormBusyState();
  }
}

function createEventItemElement(titleText, detailTexts) {
  const item = document.createElement("article");
  const title = document.createElement("strong");
  const itemLabel = [titleText, ...detailTexts].filter(Boolean).join("；");
  item.className = "event-item";
  item.tabIndex = 0;
  item.title = itemLabel;
  item.setAttribute("aria-label", itemLabel);
  title.textContent = titleText;
  title.title = titleText;
  item.append(title);
  detailTexts.forEach((text) => {
    const detail = document.createElement("small");
    detail.textContent = text;
    detail.title = text;
    item.append(detail);
  });
  return item;
}

async function copyAdminText(value, button) {
  const originalText = button.textContent;
  const originalTitle = button.getAttribute("title") || "";
  const originalAriaLabel = button.getAttribute("aria-label") || "";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("当前浏览器不支持剪贴板");
    }
    await navigator.clipboard.writeText(value);
    button.textContent = "已复制";
    syncButtonHint(button, "已复制到剪贴板");
  } catch (error) {
    button.textContent = "复制失败";
    syncButtonHint(button, error.message || "复制失败");
  } finally {
    window.setTimeout(() => {
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
      button.textContent = originalText;
      if (originalTitle) {
        button.title = originalTitle;
      } else {
        button.removeAttribute("title");
      }
      if (originalAriaLabel) {
        button.setAttribute("aria-label", originalAriaLabel);
      } else {
        button.removeAttribute("aria-label");
      }
    }, 1200);
  }
}

function copyFieldValue(selector, button, label) {
  const field = $(selector);
  const value = field?.value?.trim() || "";
  if (!value) {
    const originalText = button.textContent;
    const originalTitle = button.getAttribute("title") || "";
    const originalAriaLabel = button.getAttribute("aria-label") || "";
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "无内容";
    syncButtonHint(button, `请先填写${label}`);
    window.setTimeout(() => {
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
      button.textContent = originalText;
      if (originalTitle) {
        button.title = originalTitle;
      } else {
        button.removeAttribute("title");
      }
      if (originalAriaLabel) {
        button.setAttribute("aria-label", originalAriaLabel);
      } else {
        button.removeAttribute("aria-label");
      }
    }, 1200);
    return;
  }
  copyAdminText(value, button);
}

function createChatMetaItem(label, value) {
  const text = value || "未记录";
  const item = document.createElement("span");
  const labelNode = document.createElement("strong");
  const valueNode = document.createElement("code");
  item.className = "chat-meta-line";
  item.title = `${label}：${text}`;
  labelNode.className = "chat-meta-label";
  labelNode.textContent = `${label}：`;
  valueNode.className = "chat-meta-value";
  valueNode.textContent = text;
  valueNode.title = text;
  item.append(labelNode, valueNode);
  if (value) {
    const copyButton = document.createElement("button");
    copyButton.className = "meta-copy-button";
    copyButton.type = "button";
    copyButton.textContent = "复制";
    copyButton.title = `复制${label}`;
    copyButton.setAttribute("aria-label", `复制${label}`);
    copyButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyAdminText(value, copyButton);
    });
    item.append(copyButton);
  }
  return item;
}

function renderEventList(selector, items, emptyText, createItem, boxLabel = "") {
  const box = $(selector);
  if (boxLabel) {
    syncBoxLabel(box, boxLabel);
  }
  if (!items.length) {
    box.replaceChildren(createEmptyStateElement(emptyText));
    return;
  }
  box.replaceChildren(...items.map(createItem));
}

function setMiniPanelTitle(selector, label, count, hint = "") {
  const title = $(selector);
  if (!title) {
    return;
  }
  const normalizedCount = Number(count || 0);
  const titleText = normalizedCount ? `${label}（${formatNumber(normalizedCount)}）` : label;
  const countHint = normalizedCount ? `${formatNumber(normalizedCount)} 条记录` : "";
  const titleHint = [hint, countHint].filter(Boolean).join("；");
  title.textContent = titleText;
  title.title = titleHint ? `${label}：${titleHint}` : titleText;
  title.setAttribute("aria-label", title.title);
}

function renderAccountDetail() {
  const detail = state.accountDetail;
  if (!detail) {
    setMiniPanelTitle("#login-history-title", "登录履历", 0, "成功登录或注册后的来源和设备摘要");
    setMiniPanelTitle("#account-activity-title", "近期活跃", 0, "最近访问、点击或文章阅读记录");
    setMiniPanelTitle("#account-sessions-title", "会话状态", 0, "当前会话有效期和过期状态");
    renderEventList("#login-history", [], "选择账号后查看登录履历。", () => null, "登录履历：选择账号后查看");
    renderEventList("#account-activity", [], "选择账号后查看近期活跃。", () => null, "近期活跃：选择账号后查看");
    renderEventList("#account-sessions", [], "选择账号后查看会话状态。", () => null, "会话状态：选择账号后查看");
    return;
  }

  setMiniPanelTitle("#login-history-title", "登录履历", detail.loginHistory?.length || 0, "成功登录或注册后的来源和设备摘要");
  setMiniPanelTitle("#account-activity-title", "近期活跃", detail.activity?.length || 0, "最近访问、点击或文章阅读记录");
  setMiniPanelTitle("#account-sessions-title", "会话状态", detail.sessions?.length || 0, "当前会话有效期和过期状态");
  renderEventList("#login-history", detail.loginHistory || [], "这个账号还没有登录履历。", (event) => (
    createEventItemElement(loginEventLabel(event.event_type), [
      `${formatTime(event.created_at)} · ${locationText(event)}`,
      `网络来源：${event.ip_prefix || "未记录"} · 设备：${shortUserAgent(event.user_agent)}`
    ])
  ), `登录履历：共 ${formatNumber(detail.loginHistory?.length || 0)} 条记录`);

  renderEventList("#account-activity", detail.activity || [], "这个账号近期没有站内活跃记录。", (item) => (
    createEventItemElement(activityLabel(item), [
      `${formatTime(item.created_at)} · ${pageDisplayName(item.path || item.route, item.route)}`,
      [item.detail, pageDisplayDetail(item.path || item.route, item.route), locationText(item)].filter(Boolean).join(" · ")
    ])
  ), `近期活跃：共 ${formatNumber(detail.activity?.length || 0)} 条记录`);

  renderEventList("#account-sessions", detail.sessions || [], "这个账号没有会话记录。", (session) => (
    createEventItemElement(session.active ? "当前有效" : "已过期", [
      `登录时间：${formatTime(session.created_at)}`,
      `到期时间：${formatTime(session.expires_at)}`
    ])
  ), `会话状态：共 ${formatNumber(detail.sessions?.length || 0)} 条记录`);
}

function loginEventLabel(type) {
  return type === "register" ? "注册后自动登录" : "登录成功";
}

function activityLabel(item) {
  const labels = {
    page_view: "浏览页面",
    click: "点击操作",
    article_view: "阅读文章"
  };
  return labels[item.type] || "站内活跃";
}

function locationText(row) {
  return mapPlaceLabel(row);
}

function shortUserAgent(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "未记录";
  }
  if (/Edg\//.test(text)) {
    return "Edge 浏览器";
  }
  if (/Chrome\//.test(text)) {
    return "Chrome 浏览器";
  }
  if (/Firefox\//.test(text)) {
    return "Firefox 浏览器";
  }
  if (/Safari\//.test(text)) {
    return "Safari 浏览器";
  }
  return Array.from(text).slice(0, 80).join("");
}

function upsertById(items, nextItem, key) {
  if (!nextItem?.[key]) {
    return items;
  }
  const index = items.findIndex((item) => item[key] === nextItem[key]);
  if (index === -1) {
    return [nextItem, ...items];
  }
  const copy = [...items];
  copy[index] = nextItem;
  return copy;
}

function renderAdminUpdates() {
  const box = $("#admin-updates");
  renderAdminUpdatesOverview();
  const countText = adminUpdates.length
    ? `共 ${formatNumber(adminUpdates.length)} 条 · 最近 ${adminUpdates[0]?.date || "未知日期"}`
    : "暂无后台更新记录";
  setElementText($("#admin-updates-count"), countText);
  syncBoxLabel(box, adminUpdates.length ? `后台更新记录：${countText}` : "后台更新记录：暂无记录");
  updateSidebarLoadedSummary();
  if (!adminUpdates.length) {
    box.replaceChildren(createEmptyStateElement("暂无后台更新记录。"));
    return;
  }
  box.replaceChildren(...adminUpdates.map((item) => {
    const article = document.createElement("article");
    const title = document.createElement("strong");
    const body = document.createElement("small");
    const articleLabel = `${item.date} · ${item.title}；${item.body}`;
    article.className = "event-item";
    article.tabIndex = 0;
    article.title = articleLabel;
    article.setAttribute("aria-label", articleLabel);
    setElementText(title, `${item.date} · ${item.title}`);
    setElementText(body, item.body);
    article.append(title, body);
    return article;
  }));
}

function renderAdminUpdatesOverview() {
  const box = $("#admin-updates-overview");
  if (!box) {
    return;
  }
  if (!adminUpdates.length) {
    box.replaceChildren(createListOverviewItem("全部记录", 0));
    return;
  }
  const latestDate = adminUpdates[0]?.date || "";
  const latestRound = adminUpdates.reduce((max, item) => Math.max(max, adminUpdateRoundNumber(item)), 0);
  const textOf = (item) => `${item.title || ""} ${item.body || ""}`;
  const items = [
    ["全部记录", adminUpdates.length],
    ["最新日记录", latestDate ? adminUpdates.filter((item) => item.date === latestDate).length : 0],
    ["循环记录", adminUpdates.filter((item) => adminUpdateRoundNumber(item) > 0).length],
    ["概览优化", adminUpdates.filter((item) => /概览|比例条|图表|图|状态/.test(textOf(item))).length],
    ["文案优化", adminUpdates.filter((item) => /中文|文案|可读|识别|占位|技术词/.test(textOf(item))).length],
    ["最新一轮", latestRound]
  ];
  box.replaceChildren(...items.map(([label, value]) => createListOverviewItem(label, value)));
}

function scrollAdminToTop() {
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const behavior = prefersReducedMotion ? "auto" : "smooth";
  $$(".panel.active .editor-form, .panel.active .article-list, .panel.active .chat-list, .panel.active .ban-list, .panel.active .event-list, .panel.active .admin-updates, .panel.active .table-wrap").forEach((box) => {
    box.scrollTo({ top: 0, left: 0, behavior });
  });
  window.scrollTo({ top: 0, behavior });
}

function syncFormStatusTone(status) {
  applyStatusTone(status);
}

function initFormStatusTones() {
  $$(".form-status").forEach((status) => {
    syncFormStatusTone(status);
    const observer = new MutationObserver(() => syncFormStatusTone(status));
    observer.observe(status, { childList: true, characterData: true, subtree: true });
  });
}

function handleMapResize() {
  if (!state.overview || state.activePanel !== "dashboard") {
    return;
  }
  if (state.mapResizeTimer) {
    window.clearTimeout(state.mapResizeTimer);
  }
  state.mapResizeTimer = window.setTimeout(() => {
    state.mapResizeTimer = null;
    renderVisitorMapFromOverview();
  }, 120);
}

function bindEvents() {
  $$(".nav-button").forEach((button, index, buttons) => {
    button.addEventListener("click", () => switchPanel(button.dataset.panel, { focusTitle: true }));
    button.addEventListener("keydown", (event) => handleNavKeydown(event, index, buttons));
  });
  $("#mobile-nav-toggle").addEventListener("click", (event) => openMobileNav(event.currentTarget));
  $("#mobile-nav-close").addEventListener("click", () => closeMobileNav());
  $("#mobile-nav-backdrop").addEventListener("click", () => closeMobileNav());
  $("#admin-sidebar").addEventListener("keydown", (event) => {
    if (state.mobileNavOpen && MOBILE_ADMIN_MEDIA.matches) {
      trapFocus(event, event.currentTarget);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.mobileNavOpen && !$("#admin-confirm-dialog").open && !$("#admin-unsaved-dialog").open) {
      event.preventDefault();
      closeMobileNav();
    }
  });
  MOBILE_ADMIN_MEDIA.addEventListener?.("change", syncMobileNavMode);
  $("#manual-refresh").addEventListener("click", async () => {
    const panel = activeEditorPanel();
    await runGuardedTransition(panel, "手动刷新会重新读取当前模块，未保存内容可能被覆盖。", () => (
      loadPanelData(state.activePanel, { force: true })
    ));
  });
  $("#region-table-filter").addEventListener("input", (event) => {
    state.regionFilter = event.currentTarget.value;
    renderVisitTables();
  });
  $("#recent-clicks-filter").addEventListener("input", (event) => {
    state.clickFilter = event.currentTarget.value;
    renderClickPanels();
  });
  $("#back-to-top").addEventListener("click", scrollAdminToTop);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      autoRefreshActivePanel();
    }
  });
  window.addEventListener("resize", handleMapResize);
  window.addEventListener("blur", clearMapPointers);
  window.addEventListener("pointerup", handleMapPointerEnd);
  window.addEventListener("pointercancel", handleMapPointerEnd);
  window.addEventListener("popstate", handleAdminPopState);
  window.addEventListener("beforeunload", (event) => {
    if (!hasAnyDirtyEditor()) {
      return;
    }
    event.preventDefault();
    event.returnValue = "";
  });
  $$('[data-detail-back]').forEach((button) => {
    button.addEventListener("click", () => leaveMobileDetail(button.dataset.detailBack));
  });

  const visitorMap = $("#visitor-map");
  visitorMap.addEventListener("wheel", handleMapWheel, { passive: false });
  visitorMap.addEventListener("pointerdown", handleMapPointerDown);
  visitorMap.addEventListener("pointermove", handleMapPointerMove);
  visitorMap.addEventListener("pointerup", handleMapPointerEnd);
  visitorMap.addEventListener("pointercancel", handleMapPointerEnd);
  visitorMap.addEventListener("lostpointercapture", handleMapLostPointerCapture);
  visitorMap.addEventListener("pointerover", handleMapPointerOver);
  visitorMap.addEventListener("pointerout", handleMapPointerOut);
  visitorMap.addEventListener("focusin", handleMapFocusIn);
  visitorMap.addEventListener("focusout", handleMapFocusOut);
  visitorMap.addEventListener("click", handleMapClick);
  visitorMap.addEventListener("keydown", handleMapKeydown);
  $("#visitor-map-zoom-in").addEventListener("click", () => {
    const nextScale = clampNumber(state.mapViewport.scale + MAP_ZOOM_STEP, MAP_MIN_SCALE, MAP_MAX_SCALE);
    setMapZoom(nextScale, undefined, undefined, { announce: `地图缩放至 ${Math.round(nextScale * 100)}%` });
  });
  $("#visitor-map-zoom-out").addEventListener("click", () => {
    const nextScale = clampNumber(state.mapViewport.scale - MAP_ZOOM_STEP, MAP_MIN_SCALE, MAP_MAX_SCALE);
    setMapZoom(nextScale, undefined, undefined, { announce: `地图缩放至 ${Math.round(nextScale * 100)}%` });
  });
  $("#visitor-map-reset").addEventListener("click", () => resetMapViewport());
  $("#visitor-map-list").addEventListener("click", handleMapDataListClick);

  const confirmDialog = $("#admin-confirm-dialog");
  $("#admin-confirm-cancel").addEventListener("click", () => settleConfirmDialog(false));
  $("#admin-confirm-submit").addEventListener("click", () => settleConfirmDialog(true));
  $("#admin-confirm-input").addEventListener("input", (event) => {
    $("#admin-confirm-submit").disabled = event.currentTarget.value !== state.confirmDialogExpected;
  });
  confirmDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    settleConfirmDialog(false);
  });
  confirmDialog.addEventListener("click", (event) => {
    if (event.target === confirmDialog) {
      settleConfirmDialog(false);
    }
  });
  confirmDialog.addEventListener("keydown", (event) => {
    trapFocus(event, confirmDialog);
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.target === $("#admin-confirm-cancel")) {
        settleConfirmDialog(false);
      }
    }
  });

  const unsavedDialog = $("#admin-unsaved-dialog");
  $("#admin-unsaved-stay").addEventListener("click", () => settleUnsavedDialog("stay"));
  $("#admin-unsaved-discard").addEventListener("click", () => settleUnsavedDialog("discard"));
  $("#admin-unsaved-save").addEventListener("click", () => settleUnsavedDialog("save"));
  unsavedDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    settleUnsavedDialog("stay");
  });
  unsavedDialog.addEventListener("click", (event) => {
    if (event.target === unsavedDialog) {
      settleUnsavedDialog("stay");
    }
  });
  unsavedDialog.addEventListener("keydown", (event) => trapFocus(event, unsavedDialog));

  const dirtyForms = [
    ["articles", "#article-form"],
    ["videos", "#video-form"],
    ["videoCategories", "#video-category-form"],
    ["chat", "#chat-form-admin"],
    ["accounts", "#account-form"],
    ["accounts", "#account-password-form"],
    ["socialLinks", "#social-links-form"]
  ];
  dirtyForms.forEach(([panel, selector]) => {
    const form = $(selector);
    const handleDirtyInput = () => {
      refreshEditorDirtyState(panel);
      if (panel === "articles") {
        updateArticleLanguageStates();
      } else if (panel === "accounts") {
        syncAccountSaveButton();
      } else if (panel === "socialLinks") {
        renderSocialLinkPreviewFromForm();
      }
    };
    form.addEventListener("input", handleDirtyInput);
    form.addEventListener("change", handleDirtyInput);
  });

  $("#new-article").addEventListener("click", async () => {
    if (isArticleWriteBusy()) {
      return;
    }
    await runGuardedTransition("articles", "新建文章会清空当前编辑内容。", async () => {
      resetArticleForm();
      enterMobileDetail("articles");
    });
  });
  $("#article-list").addEventListener("click", async (event) => {
    const item = event.target.closest("[data-article-id]");
    if (item && !isArticleWriteBusy()) {
      const articleId = item.dataset.articleId;
      await runGuardedTransition("articles", "打开其他文章会离开当前编辑内容。", async () => {
        rememberMasterListContext("articles", articleId);
        await selectArticle(articleId);
        enterMobileDetail("articles", articleId);
      });
    }
  });
  $("#article-list-filter").addEventListener("input", (event) => {
    state.articleFilter = event.currentTarget.value;
    renderArticleList();
  });
  $$(".lang-tab").forEach((button, index, tabs) => {
    button.addEventListener("click", () => setArticleLang(button.dataset.articleLang));
    button.addEventListener("keydown", (event) => {
      const nextIndex = {
        ArrowRight: (index + 1) % tabs.length,
        ArrowLeft: (index - 1 + tabs.length) % tabs.length,
        Home: 0,
        End: tabs.length - 1
      }[event.key];
      if (nextIndex === undefined) {
        return;
      }
      event.preventDefault();
      const next = tabs[nextIndex];
      setArticleLang(next.dataset.articleLang);
      next.focus();
    });
  });
  $("#article-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveArticle();
  });
  $("#copy-article-slug").addEventListener("click", (event) => {
    copyFieldValue("#article-form input[name='slug']", event.currentTarget, "文章路径标识");
  });
  $("#publish-article").addEventListener("click", () => saveArticle("published"));
  $("#delete-article").addEventListener("click", deleteArticle);
  $("#new-video").addEventListener("click", async () => {
    if (isVideoEditBusy()) {
      return;
    }
    await runGuardedTransition("videos", "新建视频会清空当前编辑内容。", async () => {
      resetVideoForm();
      enterMobileDetail("videos");
    });
  });
  $("#video-list-admin").addEventListener("click", async (event) => {
    const item = event.target.closest("[data-admin-video-id]");
    if (item && !isVideoEditBusy()) {
      const videoId = item.dataset.adminVideoId;
      await runGuardedTransition("videos", "打开其他视频会离开当前编辑内容。", async () => {
        rememberMasterListContext("videos", videoId);
        selectVideo(videoId);
        enterMobileDetail("videos", videoId);
      });
    }
  });
  $("#video-list-filter").addEventListener("input", (event) => {
    state.videoFilter = event.currentTarget.value;
    renderVideoList();
  });
  $("#preview-video-url").addEventListener("click", previewVideoUrl);
  $("#refresh-video-metadata").addEventListener("click", refreshVideoMetadata);
  $("#video-form").elements.original_url.addEventListener("input", syncVideoMetadataButtons);
  $("#copy-video-original-url").addEventListener("click", (event) => {
    copyFieldValue("#video-form input[name='original_url']", event.currentTarget, "视频原始链接");
  });
  $("#copy-video-embed-url").addEventListener("click", (event) => {
    copyFieldValue("#video-form input[name='embed_url']", event.currentTarget, "视频播放器地址");
  });
  $("#video-cover-file").addEventListener("change", handleLocalCoverFileChange);
  $("#video-frame-file").addEventListener("change", handleVideoFrameFileChange);
  $("#clear-video-thumbnail").addEventListener("click", clearVideoThumbnail);
  $("#video-form").elements.pinned.addEventListener("change", handleVideoPinnedChange);
  $("#video-form").elements.thumbnail_url.addEventListener("input", (event) => {
    renderVideoThumbnailPreview(event.target.value);
  });
  $("#video-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveVideo();
  });
  $("#publish-video").addEventListener("click", () => saveVideo("published"));
  $("#delete-video").addEventListener("click", deleteVideo);
  $("#new-video-category").addEventListener("click", async () => {
    if (isVideoCategoryWriteBusy()) {
      return;
    }
    await runGuardedTransition("videoCategories", "新建分类会清空当前编辑内容。", resetVideoCategoryForm);
  });
  $("#video-category-list-admin").addEventListener("click", async (event) => {
    const item = event.target.closest("[data-admin-video-category-id]");
    if (item && !isVideoCategoryWriteBusy()) {
      await runGuardedTransition("videoCategories", "打开其他分类会离开当前编辑内容。", () => (
        selectVideoCategory(item.dataset.adminVideoCategoryId)
      ));
    }
  });
  $("#video-category-list-filter").addEventListener("input", (event) => {
    state.videoCategoryFilter = event.currentTarget.value;
    renderVideoCategoryList();
  });
  $("#video-category-form").addEventListener("submit", saveVideoCategory);
  $("#copy-video-category-slug").addEventListener("click", (event) => {
    copyFieldValue("#video-category-form input[name='slug']", event.currentTarget, "视频分类路径标识");
  });
  $("#delete-video-category").addEventListener("click", deleteVideoCategory);
  $("#include-hidden-chat").addEventListener("change", async (event) => {
    if (isChatFilterBusy()) {
      return;
    }
    const allowed = await confirmEditorCanLeave("chat", "调整隐藏记录筛选会重新读取消息列表。");
    if (!allowed) {
      event.currentTarget.checked = !event.currentTarget.checked;
      return;
    }
    loadChatMessages().catch((error) => {
      renderChatListNotice(`读取聊天记录失败：${error.message}`, "聊天记录错误");
    });
  });
  $("#chat-list").addEventListener("click", async (event) => {
    const item = event.target.closest("[data-message-id]");
    if (item && !isChatInteractionBusy()) {
      const messageId = item.dataset.messageId;
      await runGuardedTransition("chat", "打开其他聊天记录会离开当前编辑内容。", async () => {
        rememberMasterListContext("chat", messageId);
        selectChatMessage(messageId);
        enterMobileDetail("chat", messageId);
      });
    }
  });
  $("#chat-list-filter").addEventListener("input", (event) => {
    state.chatFilter = event.currentTarget.value;
    renderChatMessages();
  });
  $("#chat-form-admin").addEventListener("submit", saveChatMessage);
  $("#toggle-chat-hidden").addEventListener("click", toggleChatHidden);
  $("#delete-chat-message").addEventListener("click", deleteChatMessage);
  $("#ban-chat-visitor").addEventListener("click", () => banSelectedChat("visitor"));
  $("#ban-chat-ip").addEventListener("click", () => banSelectedChat("ip_hash"));
  $("#refresh-bans").addEventListener("click", refreshBans);
  $("#ban-list").addEventListener("click", (event) => {
    const item = event.target.closest("[data-disable-ban]");
    if (item) {
      disableBan(item.dataset.disableBan);
    }
  });
  $("#ban-list-filter").addEventListener("input", (event) => {
    state.banFilter = event.currentTarget.value;
    renderBans();
  });
  $$('[data-chat-governance-tab]').forEach((button, index, tabs) => {
    button.addEventListener("click", () => setChatGovernanceTab(button.dataset.chatGovernanceTab));
    button.addEventListener("keydown", (event) => {
      const nextIndex = {
        ArrowRight: (index + 1) % tabs.length,
        ArrowLeft: (index - 1 + tabs.length) % tabs.length,
        Home: 0,
        End: tabs.length - 1
      }[event.key];
      if (nextIndex === undefined) {
        return;
      }
      event.preventDefault();
      setChatGovernanceTab(tabs[nextIndex].dataset.chatGovernanceTab, { focus: true });
    });
  });
  $("#account-list").addEventListener("click", async (event) => {
    const item = event.target.closest("[data-account-id]");
    if (item && !isAccountWriteBusy()) {
      const accountId = item.dataset.accountId;
      await runGuardedTransition("accounts", "打开其他账号会离开当前资料和密码草稿。", async () => {
        rememberMasterListContext("accounts", accountId);
        await selectAccount(accountId);
        enterMobileDetail("accounts", accountId);
      });
    }
  });
  $("#account-list-filter").addEventListener("input", (event) => {
    state.accountFilter = event.currentTarget.value;
    renderAccountList();
  });
  $("#account-form").addEventListener("submit", saveAccountProfile);
  $("#account-password-form").addEventListener("submit", resetAccountPassword);
  $("#social-links-form").addEventListener("submit", saveSocialLinks);
  $("#reset-social-links-defaults").addEventListener("click", resetSocialLinksFormToDefaults);
}

async function init() {
  bindEvents();
  initFormStatusTones();
  renderAdminUpdates();
  updateSidebarLoadedSummary();
  resetArticleForm();
  resetVideoForm();
  resetVideoCategoryForm();
  resetChatForm();
  resetAccountForm();
  setChatGovernanceTab("message", { focus: false });
  state.socialLinks = normalizeAdminSocialLinks([]);
  fillSocialLinksForm(state.socialLinks);
  renderSocialLinkPreview();
  captureEditorBaseline("socialLinks");
  syncMobileNavMode();
  try {
    applyActivePanel(getStoredActivePanel());
    replaceAdminHistoryView(state.activePanel, "list");
    await loadMe();
    await loadPanelData(state.activePanel, { force: true });
    state.timer = window.setInterval(autoRefreshActivePanel, 30000);
  } catch (error) {
    setStatus(error.message);
  }
}

init();
