# Design QA：手机文章首屏、工具区更名与全界面修复

Date: 2026-07-26

## 结论

本轮已完成用户指出的手机文章首屏大面积空白、公开“资源区”改名为“工具区”，并对公共主站、弹窗、三语界面、五款游戏及共享游戏壳进行统一设计 QA。当前本地证据中未发现 P0、P1 或 P2 遗留问题；XP／Pixel Art／Y2K 桌面语言和移动虚拟 OS 结构均保留，功能路由、旧收藏链接、Quick Transfer、游戏本地存档及账号云存档边界未因视觉调整而改变。

## 来源证据

- 用户原始截图：`C:\Users\lusu\AppData\Local\Temp\codex-clipboard-911bab70-96bd-4a94-bf46-30bc229eacf6.png`，967×1776。图中 390×844 等效手机文章首屏在目录与正文卡片之间出现大块空白，正文标题位于首屏底部附近，首段实际可见量为 0。
- 根因证据：按需加载的 `css/routes/knowledge.css` 被插入到 `css/mobile-ios-shell.css` 之后，同等优先级下把桌面文章侧栏 `min-height` 写回移动布局；问题不是文章数据缺失，也不是用户误滚动。
- 修复后文章证据：`output/interface-audit-fixes-20260726/public-ui-final/article-first-screen-390x844.png`。初始滚动位置为 0，文章标题、操作和多段正文进入首屏；受控测量中 359×500、390×844、844×390 的正文可见量分别约为 109px、346px、82px。
- 工具区桌面证据：`output/interface-audit-fixes-20260726/tools-desktop-after.png`；公开显示为“工具区”，卡片节奏、元信息、标签和操作保持完整。
- About 桌面证据：`output/interface-audit-fixes-20260726/about-desktop-final.png`；中文“工具折腾”等短语不再孤字断行，窗口宽度和遮罩层级稳定。
- 自动化原始记录：`output/interface-audit-fixes-20260726/public-ui-final/summary.json` 与 `output/interface-audit-fixes-20260726/resources-final-r2/resources-visual-summary.json`。

`output/` 和用户临时附件均为本机 QA 证据，不属于生产页面依赖，也不作为部署产物提交。

## Before / After 组合对比

下面两张组合图都把修复前后状态放在同一画布中进行人工比对，而不是只凭单张截图判断。

### 游戏与共享游戏壳

![游戏修复前后组合图](output/interface-audit-fixes-20260726/compare-games-before-after.png)

可见差异包括：共享壳把固定工具区与游戏内容正确分层；2048、Hextris 的主操作达到手机触控尺寸；A Dark Room 的窄屏面板和声音选择不再被 700px 桌面几何裁断；Kittens Game 从桌面三栏改为移动单列。组合图生成后又完成了两项末轮收口：Kittens 顶部工具栏自然换为两行并完整显示 Steam／版本号，Life Restart“立即重开”和三个角落操作均达到 44px。

末轮独立证据：

- `output/kittens-mobile-wrap-final.png`
- `output/life-restart-touch-audit/final-390x844.png`
- `output/life-restart-touch-audit/final-844x390.png`
- `output/life-restart-touch-audit/final.json`

### 欢迎窗与视频失败弹窗

![弹窗修复前后组合图](output/interface-audit-fixes-20260726/compare-modals-before-after.png)

修复后 359×500 欢迎窗利用更多安全可用高度；视频正常播放仍保留完整播放器窗口，只有失败／不支持状态收敛为紧凑决策窗。竖屏和短横屏不再用大面积黑色占位，桌面遮罩也能清楚区分弹窗、页面和壁纸层级。

## 五轮迭代

1. **手机文章首屏。** 修正 route CSS 注入顺序，固定为主壳基础样式 → route 样式 → mobile 样式 → motion 样式，并为移动文章侧栏补上高优先级 `min-height: 0` 防线。同步确认阅读进度只计算 Markdown 正文、回顶按钮顶部隐藏、激活后焦点回到文章标题，移动 Dock 不遮住正文。
2. **工具区三语更名。** 首页入口、窗口标题、桌面任务栏、移动 Dock、Appbar、空状态、文章标签映射、Quick Transfer 返回操作和维护文档统一为中文“工具区”、English “Tools”、日本語“ツール”。内部 `resources` route、`#resources` 深链、DOM／CSS／API／统计标识保持不变，避免破坏旧链接和既有功能。
3. **公共界面与弹窗。** 扩大 359×500 欢迎窗可读容量；压缩视频失败弹窗；提高桌面模态遮罩对比；修复 Tools／About 的 CJK 孤字与长文案换行；复查 Home、Knowledge、Videos、Tools、Games、Chat、Blog、About 的层级、裁剪、滚动和 Dock 占位。
4. **游戏移动体验。** 五游戏共享壳改为单一 `100dvh` 网格，外层文档不滚动，iframe 使用剩余高度。A Dark Room 按实时面板宽度移动并支持同页旋转重算；Kittens Game 在 ≤900px 使用营火→资源→日志单列，同时停用上游统计、KGNet、localhost 桥接和未用主题字体请求；2048、Hextris 与 Life Restart 的主要操作补齐 44px。
5. **独立发布审查与视觉扫尾。** 代码复查进一步发现并修复 A Dark Room 缓存版本和 orientationchange 恢复、Kittens 文档语言／主题懒加载／外部字体、Kittens 顶栏裁字以及 Life Restart“立即重开”不足 44px。最终逐张复看文章、工具、About、弹窗、共享壳和五款游戏截图，再运行专项几何与发布门禁。

## 界面与视口矩阵

| 范围 | 视口／状态 | 语言 | 重点结论 |
| --- | --- | --- | --- |
| 手机文章首屏 | 359×500、390×844、844×390 | zh，并检查实际文章语言标记 | 初始 `scrollTop=0`；首段至少可见 20px；正文可见量达到 44／200／44px 门槛；目录与正文无相交 |
| 公共主站 | 359×500、375×667、390×844、430×932、844×390、1280×720、1440×900 的适用场景 | zh／en／ja | Home 与各 App 路由、Chat、文章、视频、欢迎窗、低性能档和短桌面场景均无审计失败 |
| Tools／Quick Transfer | 359×500、375×667、390×844、760×900、844×390、1280×720 | zh／en／ja | 54 个三语流程状态加 4 个 Home／Games 参照状态，共 58 个；列表、登录、两种返回入口和旧 `#resources` 深链均可用 |
| 共享游戏壳 | 359×500、390×844、844×390 | zh／en／ja | 外层横纵滚动为 false；返回、登录、下载、导入、云存档和冲突操作不小于 44px |
| A Dark Room | 390×844 ↔ 844×390，同一文档连续旋转；另有桌面状态 | zh／en／ja | 两层滑轨、当前偏移和资源面板归属会重算；回桌面恢复 700px；声音窗完整可见 |
| Kittens Game | 390×844 与 >900px 桌面 | zh／en／ja | 手机单列、桌面三栏；35 个关键操作不小于 44px；Steam／版本号完整换行；无页面横向溢出和非本站外部请求 |
| Life Restart | 390×844、844×390 | zh／en；ja 按目录规则回退 en | “立即重开”及 GitHub／保存／主题操作均至少 44px，中心点击能触发状态转换 |
| 2048／Hextris | 359×500、390×844、844×390 | zh／en／ja | 新游戏、左右操作和共享壳控制达到 44px，游戏区保持可达 |

## 视觉、交互与无障碍点检

- **视觉一致性：** 继续使用现有 XP 蓝色标题栏、像素图标、任务栏、四时段背景和移动磨砂 Dock；没有把页面改成现代极简卡片站，也没有用占位图、Emoji 或 CSS 绘图替代现有资产。
- **文字与三语：** 当前可见栏目名称为“工具区／Tools／ツール”；zh／en／ja 的标题、摘要、元信息、按钮和返回操作均检查换行、截断和卡片边界。历史更新正文和兼容标签中的旧称作为历史／输入兼容保留，不属于当前导航漏改。
- **44px 触控目标：** Dock 收起／展开、App 返回、弹窗关闭、共享游戏壳控制及各游戏关键操作均按至少 44×44 CSS px 检查；未通过缩小按钮或隐藏内容来消除溢出。
- **溢出与滚动归属：** 主站固定壳不承担意外 document 滚动；文章详情、Chat 日志、Tools 列表和游戏 iframe 各自保留唯一可理解的滚动主体。检查了 `clientWidth`／`scrollWidth`、子项越界、卡片相交和 Dock 遮挡，而不只检查父容器的 `overflow` 属性。
- **弹窗与层级：** 欢迎窗、视频失败窗、账号浮层和游戏冲突窗检查 z-index、裁剪、遮罩、关闭按钮、Escape、外点行为及滚动锁；桌面 header 仍高于 main，浮层可以从顶栏按钮下方完整溢出。
- **键盘与焦点：** App 返回、文章目录／回顶、筛选重绘、Quick Transfer 返回、弹窗关闭和 Dock 收起均保留可聚焦路径；收起 Dock 同步使用 `inert`、`aria-hidden` 和视觉隐藏，焦点先移到 44px 展开按钮。测试覆盖浏览器 DOM 焦点与键盘行为，但不把它表述为完整读屏认证。
- **功能边界：** “工具区”仅改变公开显示名；`resources` 技术标识、Quick Transfer、筛选、统计、文章兼容标签和旧深链继续工作。游戏改动保留 localStorage、JSON 导入导出和本站账号云存档链路。
- **隐私与网络：** Kittens 嵌入副本不再发出 Google Analytics、KGNet、localhost 桥接或未使用主题 Google Fonts 请求；主题切换按需加载本地样式。

## 最终验证数字

<!-- FINAL_VERIFICATION_BLOCK_START：主任务最后一次同批次重跑后，仅更新本段 -->

| 门禁 | 当前记录 |
| --- | --- |
| Release 单元／契约测试 | 261 / 261 |
| 公共 ESM 依赖图 | 20 modules |
| 公共 UI 精确 CDP 审计 | 147 / 147 |
| Tools／Quick Transfer 三语六视口专项 | 58 / 58 |
| Headless 发布矩阵 | 190 / 190 |
| 生产构建 | 两次构建内容一致 |
| 最近一次完整门禁 manifest SHA-256 | `dd99d2a75ea725c9efc34cc4e6b0671821dad9a22f0b6ed140f74d54f9f6d5cb` |
| 已知非阻断输出 | 仅既有日语工具 `noMedal` 重复键警告 |

上述数字来自 Kittens 顶栏换行、Life Restart 44px 末轮精修及三语更新记录同步后的同一批次最终门禁；A Dark Room 同页旋转另有 1 / 1 浏览器专项，Kittens 与 Life Restart 另有精确 CDP 几何和真实触摸证据。

<!-- FINAL_VERIFICATION_BLOCK_END -->

## 遗留 P3 与证据边界

- **P3：真机系统界面。** Headless Chrome／CDP 已验证精确 CSS 视口和代理几何，但仍不能替代真实 iOS／Android 的可折叠浏览器 chrome、软键盘、物理 safe area、触控手势和完整读屏器流程；需要真机回归后才能关闭该项。
- **P3：A Dark Room 深层流程。** 当前覆盖首页、房间／资源面板、声音选择、同页横竖屏和桌面恢复；世界、路径、太空等后期状态及真实移动设备上的长手势／音频权限仍需单独游玩验证。
- **P3：Kittens Game 深层流程。** 当前覆盖首屏三语、营火／资源／日志、顶部工具栏、主题按需加载、网络请求和关键触控目标；全部后期面板、长周期存档、所有主题组合与真实设备长时运行仍需专项回归。

这些 P3 是截图和本地自动化无法完全证明的设备／深层内容边界，不代表当前已测界面存在可复现阻断。

final result: passed

---

# Design QA：每日 AI 新闻 RSS 入口

Date: 2026-08-19

## 结论

本轮以用户提供的 1045×542 截图为唯一视觉来源，将 RSS 入口放在“关于我”简介下方的独立区域，不并入社交链接。受管预览服务两次启动后均自行停止，云浏览器无法连接，因此不以源码或构建结果冒充视觉验收通过。

## 证据与受阻项

- 来源截图：`/workspace/scratch/b51a02981de0/upload/d6909bad-49d3-40b6-aefe-0d58c0d67c52.png`
- 目标状态：中文、`#about` 路由、1045×542 CSS px。
- 实现截图：不可用；预览报告 ready 后停止，浏览器返回 connection refused。
- [P1] 尚未用浏览器确认 RSS 行的精确高度、间距、换行和按钮视觉平衡。
- 语言链接、XML 输出、44px 移动触控目标已有自动化测试覆盖，但按钮跳转与浏览器控制台尚未在受管浏览器中实测。

## 下一轮验收

恢复可用的受管预览后，在同一画布比较来源截图和实现截图；再切换英文、日文并检查链接参数，最后补一张移动视口截图与控制台记录。

final result: blocked
