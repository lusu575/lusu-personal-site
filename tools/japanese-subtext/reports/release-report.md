# 日本語の裏側 1.0.2 发布验收报告

> 状态：**1.0.2 发布验收全部通过**。本文档只记录最终 manifest、全量验证和真实浏览器回归结果。

验收对象为 `/tools/japanese-subtext/` 的 1.0.2 发布候选。界面标题随语言显示“日语的言外之意 / Behind the Japanese / 日本語の裏側”。

## 1.0.3 UI 热修补充 — 2026-07-14

本次只修复答错后的交互死路：结果弹窗不再允许通过关闭按钮、Escape 或点击弹窗外部绕过结果操作；即使弹窗因浏览器或脚本原因被关闭，题目区仍保留“重新答题”。解析页也在正文前提供“重新答题”，并按**当前这一次作答**而非历史通关记录决定显示“重新答题”或“进入下一关”。

- 应用界面版本：`appVersion 1.0.3`
- 题库兼容版本：`contentVersion 1.0.2`
- 兼容边界：250 关题库、10,088 份音频、时间轴、云存档键和正式关卡图均未变更。
- Node 自动测试：`51/51` 通过。
- 内容校验：`250/250` 通过。
- 音频快速校验：`10,088/10,088` 通过。
- 真实无头 Chrome 交互回归：`HeadlessChrome/150`、`L1-001`、zh / en / ja，以及 359×500、375×667、390×844、844×390、1365×900 全部通过；Escape 与弹窗外点击不能绕过错题结果，强制关闭后的题面兜底重答、解析页正文前重答、正确作答下一关、历史已通关后本次答错仍显示重答均通过；所有视口横向溢出为 0，相关按钮高度为 44px，未捕获浏览器异常。
- 完整发布门禁：`npm.cmd run jp-subtext:release-check` 通过；250/250 关内容、10,088/10,088 音频（含 ffprobe 与静音检查）、51/51 Node 测试和 `build-check: ok` 全部通过。

## 发布门槛

| 门槛 | 当前证据 | 状态 |
| --- | --- | --- |
| 锁定题库 | `jp-subtext:validate:content`：5 级 × 50 关，250/250 通过 | 已通过 |
| 关卡插图 | 250 张逐关独立的 960×720 黑白四格 WebP，文件 SHA-256 与图片 manifest 一致 | 已通过 |
| Node 自动测试 | 题库、播放器、布局合约、打卡、云同步、API、图片与音频工具 49/49 通过 | 已通过 |
| Python TTS 测试 | 假名、完整 P2R、CPU provider、未知/超长音素、共享审计链路、哈希、断点续跑与 Windows 文件锁重试 25/25 通过 | 已通过 |
| 浏览器回归 | `v102-r2`、zh/en/ja、五个规定视口与桌面主流程 | 已通过 |
| 全量音频 | 10,088/10,088；音素审计 9,838/9,838；全量 ffprobe、静音、哈希、时间轴与孤儿检查通过 | 已通过 |
| 主站构建 | `npm.cmd run build`：`build-check: ok`，含 250/10,088 日语工具发布合约 | 已通过 |

## 1.0.2 主要变更

- 音频生成先使用已审查的句子/选项 `readingJa` 与词块 `reading`，界面继续显示原始汉字；所有出现“今日”的语音文本都有 `きょう / きょー` 全库测试守卫。
- Misaki 的音素与音高半段分离，完整按官方顺序执行 P2R，原始 `j → y` 早于 `ʥ → j`；未知音素和超过 510 个音素的任务直接失败，不再静默丢音。由此修复句尾额外“いい”、“きょう”退化成“おう”及“や／ゆ／よ”偏成“じゃ／じゅ／じょ”的根因。
- PC 端采用游戏区同类壳层：左上返回个人站、右上工具名、中间存档同步；关卡内容重新排布以减少大块空白。
- 解析页增加“进入下一关”；资源区操作改为“开始 / Start / 開始”；学习记录改为月历打卡。
- 普通标题、按钮与标签默认不可拖选，输入框和可编辑区仍可选择文字；点击句子播放不会强制改变滚动位置。
- 每关使用一张与 setting、角色、台词、题问、证据和关键道具对应的黑白四格场景图。

## 插图来源与边界

内置 imagegen 经两次重试均因网络错误不可用，因此本次使用明确标注的 `local-four-panel-v2` 本地原创 fallback。250 张图片由 `assets/stages/manifest.json` 锁定路径、SHA-256、960×720 尺寸、生成器版本和 `automated-scene-mapped` 状态；这些图片不宣称为 AI 逐张绘制。

## 音频最终数据

统计只允许来自最终发布用 `audio/manifest.json`，不得用生成速度或局部样本推算。

- 实际音频件数：

  <!-- AUTO:AUDIO_ITEM_COUNT:START -->
  `10,088（scene 250 / line 2,400 / option 2,445 / token 4,993）`
  <!-- AUTO:AUDIO_ITEM_COUNT:END -->

- 实际覆盖关卡：

  <!-- AUTO:AUDIO_STAGE_COUNT:START -->
  `250 / 250`
  <!-- AUTO:AUDIO_STAGE_COUNT:END -->

- 累计时长：

  <!-- AUTO:AUDIO_DURATION:START -->
  `38,601.484 秒（10 小时 43 分 21.484 秒）`
  <!-- AUTO:AUDIO_DURATION:END -->

- 文件总大小：

  <!-- AUTO:AUDIO_BYTES:START -->
  `316,038,600 bytes / 301.40 MiB`
  <!-- AUTO:AUDIO_BYTES:END -->

- 全量验证：

  <!-- AUTO:AUDIO_VALIDATION:START -->
  `PASS：9,838/9,838 个非场景任务的 reading / phoneme / task hash 复算错误 0（708.585 秒）；10,088/10,088 件音频的路径、SHA-256、24 kHz mono 64 kbps、时长、时间轴、引用、孤儿文件、ffprobe 与静音检查全部通过（1,354.165 秒）。L1-001 的“今日”“やわらかく”“じゃあ”代表音频没有长停顿后的分离尾音，结尾保留约 0.122–0.128 秒静音。`
  <!-- AUTO:AUDIO_VALIDATION:END -->
  <!-- RELEASE:AUDIO_VALIDATION:PASS -->

## 浏览器回归

<!-- AUTO:BROWSER_QA:START -->
`v102-r2` 已在 359×500、375×667、390×844、844×390、1365×900 完成 zh / en / ja 回归：

- 页面无横向溢出，关键触控目标不小于 44px；PC 顶栏、存档同步区、关卡重排和短横屏布局正常。
- 首次模式弹窗只出现一次，进入听力模式不会自动播放；听力、日语、双语三种模式正常。
- 解析页可进入下一关，末关返回关卡地图；结果弹窗不会在选项中插入撑高布局的“正确答案”文字。
- 月历月份切换、连续/累计打卡与本地/云端合并正常；Resources CTA 显示“开始 / Start / 開始”并进入对应语言标题的工具页。
- 句子和词块本身可播放，没有重复播放按钮；点击播放后页面滚动位置不变。
- 控制台除静态预览环境预期的 API 降级外无新增异常；测试用 Chromium 与临时服务均已关闭。
<!-- AUTO:BROWSER_QA:END -->
<!-- RELEASE:BROWSER_QA:PASS -->

## 最终发布命令

```powershell
npm.cmd run jp-subtext:validate
npm.cmd run jp-subtext:audio:validate -- --check-silence
npm.cmd run jp-subtext:test
npm.cmd run build
git diff --check
git diff --stat
```

完整音频验证必须包含音素复算、全量 ffprobe 和静音检查；`audio:validate:quick`、局部试听或单关 benchmark 不能代替正式门槛。

## 模型收尾

- Kokoro 只用于本次 CPU 离线预生成；网站运行时只读取静态 MP3 与 manifest。
- 正式校验后确认无本任务遗留的 TTS 进程、服务、计划任务或开机自启。
- 本次未额外安装 Zundamon / VOICEVOX，避免在已授权的一套离线模型之外引入第二套模型、额外角色许可审查与常驻资源占用。
