# 日本語の裏側 发布验收报告

> 状态：**发布验收全部通过**。本文档不把估算值、抽样结果或生成中状态写成正式通过。

验收对象是 `/tools/japanese-subtext/` 的 `main` 发布候选。标题随界面语言显示为“日语的言外之意 / Behind the Japanese / 日本語の裏側”，题库版本为 `1.0.1`。
题材、训练技能、声线、长度递进和音频的完整机器可读统计保存在 `reports/final-stats.json`；正式构建会校验其与题库和音频 manifest 一致。

## 发布门槛摘要

| 门槛 | 期望 | 当前证据 | 状态 |
| --- | --- | --- | --- |
| 锁定题库 | 5 级 × 50 关，LEVEL 1=N3、LEVEL 2=N2、LEVEL 3–5=N1 | `npm.cmd run jp-subtext:validate:content`：250/250 通过 | 已通过 |
| Node 自动测试 | 题库、播放器、存档、云同步、音频工具与合并器全部通过 | `npm.cmd run jp-subtext:test`：41/41 通过 | 已通过 |
| Python TTS 测试 | 稳定 ID、哈希、断点续跑、时间轴、模型适配、发布指纹与假名预处理覆盖 | 隔离 Kokoro 环境 `unittest`：16/16 通过 | 已通过 |
| D1 schema | 专用 `japanese_subtext_profiles` / `japanese_subtext_stage_progress`，不复用 `game_saves` | Wrangler 本地执行 `cloudflare/schema.sql`：193 条命令全部成功 | 已通过 |
| 图片风格 | 31 张彩色关卡图：25 张儿童蜡笔、6 张 Q 版四格，黑白线稿 0 | `content/generation-state.json` 与资产文件 | 已通过 |
| 全量音频 | 250 个场景、2,400 句、2,445 选项、4,993 词块，合计 10,088 件 | 最终 manifest：10,088 件 / 250 关 / 缺失 0 | 已通过 |
| 真实音频校验 | 全部 MP3 为 24 kHz、mono、64 kbps，manifest/hash/时间轴/实体文件一致且非静音 | 全量 ffprobe + ffmpeg：10,088/10,088 通过，见下方证据 | 已通过 |
| 浏览器回归 | 359×500、375×667、390×844、844×390、1365×900；三语标题、首次模式、结果弹窗和训练器主流程 | `r14` 真实 Chromium 定向回归，见下方证据 | 已通过 |
| 主站构建 | 全量音频完成后 `npm.cmd run build` 通过 | `build-check: ok (... Japanese subtext 250/10088 release contract)` | 已通过 |

完整 `npm.cmd run jp-subtext:release-check` 已在允许启动本机 ffprobe/ffmpeg 的环境中以退出码 0 完成：题库 250/250、真实音频 10,088/10,088、Node 41/41、主站 `250/10088 release contract` 全部通过。沙箱内一次调用因统一阻止外部媒体进程而返回 EPERM，不计作内容校验；获批后的同命令完整复验通过。

## 音频实际数据

以最终 `audio/manifest.json` 为唯一统计来源；不从单关 benchmark 或生成速率外推。下列数据均来自合并、全库 reconciliation 与真实全量校验后的最终 manifest。

- 实际音频件数：
  <!-- AUTO:AUDIO_ITEM_COUNT:START -->
  `10,088（scene 250 / line 2,400 / option 2,445 / token 4,993）`
  <!-- AUTO:AUDIO_ITEM_COUNT:END -->
- 实际覆盖关卡：
  <!-- AUTO:AUDIO_STAGE_COUNT:START -->
  `250 / 250`
  <!-- AUTO:AUDIO_STAGE_COUNT:END -->
- 全部音频累计时长：
  <!-- AUTO:AUDIO_DURATION:START -->
  `40,998.333 秒（11 小时 23 分 18.333 秒）`
  <!-- AUTO:AUDIO_DURATION:END -->
- 全部音频字节数 / MiB：
  <!-- AUTO:AUDIO_BYTES:START -->
  `335,218,248 bytes / 319.69 MiB`
  <!-- AUTO:AUDIO_BYTES:END -->
- 全量 ffprobe、hash、时间轴与引用验证：
  <!-- AUTO:AUDIO_VALIDATION:START -->
  `PASS: 10,088 audio artifacts across 250 stages are valid. 路径、SHA-256、24 kHz mono 64 kbps、题库 sourceContentHash、逐句 cue 顺序、时间轴、精确引用、孤儿文件与静音均通过；缺失 0、孤儿 0、静音 0。`
  <!-- AUTO:AUDIO_VALIDATION:END -->
  <!-- RELEASE:AUDIO_VALIDATION:PASS -->
- 声学静音检查：`node tools/japanese-subtext/scripts/validate-audio.mjs --check-silence` 已对全部 10,088 件执行 ffprobe + ffmpeg `volumedetect`，真实耗时 1,186.8 秒（19 分 46.8 秒），结果 10,088/10,088 通过。

## 浏览器与主站回归（实测后填入）

### 1.0.1 / r14 定向回归

- 首次进入 L1-001 只显示一次听力 / 日语 / 双语模式弹窗；选择听力模式后没有自动播放，台词隐藏且问题保持锁定。刷新后不再重复弹窗。
- 日语模式直接显示纯日语台词并解锁问题；设置面板不存在自动播放和静音控件，右下角为“确认”。句子本身可点击播放，没有额外句子播放按钮；播放器只保留播放/暂停、进度 seek 和倍速。
- 正确作答后显示奖牌结果弹窗及“查看解析 / 进入下一关”；选项没有可见“正确答案”文字。解析中的内部 line ID 已显示为“第二句台词 / the second line / 2番目の台詞”。
- zh / en / ja 页面标题分别为“日语的言外之意 / Behind the Japanese / 日本語の裏側”。中文界面与日语台词使用分离的 `lang` 与字体栈。
- 359×500、375×667、390×844、844×390、1365×900 的 `scrollWidth === clientWidth`；可见按钮、选择框和外层选择卡命中框最小高度 44px。
- 在 390×844 下滚动到 `scrollY=300` 后点击句子播放，500ms 后仍为 300，确认播放不会强制画面上移。
- 主站中文 Resources 卡实测只显示版本、更新时间、听力训练、潜台词、支持（云存档），CTA 为“开始挑战”；点击后进入中文标题工具页。主站 CSS/JS 和工具 style/app/6 个 ESM 子模块分别携带 `20260711-japanese-subtext-v101-r1` 与 `20260711-japanese-subtext-r14`，全部返回 200。
- 静态预览控制台只有缺少 `/api/tools/japanese-subtext/progress` 的预期 404 与本地进度降级 warning，没有额外 JavaScript 异常；验收 Chromium 和临时服务器均已关闭。

### 1.0.0 历史基线

已在真实浏览器流程中发现并修复“从头播放 / 重播”只归零、不继续发声的问题；随后又修复首次切换到新 source（声音门、token 或 option）时 `load()` 后媒体仍处于 paused 的竞态，播放器现在会对新 source 二次检查 paused 状态并重试发声。最终根因修复是严格区分“未设置截止点”的 `null` 与真正的 0 秒，并忽略新 source 初始位置的过期 `ended` 事件，防止场景未播完就解锁题目。内部截止使用事件抑制，避免异步 native `pause` 把句子结束状态从 stopped 覆盖回 paused。单个句子、词块或选项音频失败时也不再禁用仍然有效的场景音频，失败 source 会失效化以支持同 ID 重试，“重新加载”会在同一用户操作中重新请求并播放当前场景；只有 manifest 级失败才进入全局文字兜底。设置面板另加入三语“语音来源与许可”链接，直达日语声线署名 NOTICE；跨设备进度合并新增“较新失败记录不得擦除较早首次通关模式”的回归。所有 ESM 子模块与入口共用同一缓存版本，训练器公开 CSS/JS cache query 为 `20260711-japanese-subtext-r12`。这些是已验证的单项修复与自动测试，不代替下方五视口完整回归。

<!-- AUTO:BROWSER_QA:START -->
Playwright CLI 使用三个独立会话对公开缓存版本 `20260711-japanese-subtext-r10` 做了真实 Chromium 回归，结果通过：

- Dashboard 与 L1-001 在 375×667、390×844、844×390、768×1024、1365×900 均无横向溢出；Dashboard 可见操作与关卡页 38 个有效命中框均无小于 44px 的目标。无遮挡截图保存在忽略目录 `output/playwright/`。
- L1-010 彩色蜡笔图与 L1-046 全彩 Q 版四格图均实际请求带内容哈希的 WebP，`loading=lazy`、原图 960×540、`object-fit: contain`，五视口内不越界；视觉检查未出现黑白线稿。L1-001 按蓝图为 `illustration.enabled=false`。
- 首次声音门默认自动播放；0.35 秒与 1 秒时真实 `Audio.currentTime` 持续前进，问题表单保持隐藏，只有场景自然播放到 10.483 秒并收到 `ended` 后才解锁。播放、暂停、续播、从头播放、重播和真实鼠标拖动 seek 均通过；拖到约 65% 后 `currentTime` 从 0.195 秒变为 7.143 秒。
- 逐句片段在首句 cue 终点 4.901 秒停止，状态回到“语音已准备好 / 播放”且不解锁；再次播放会从完整场景 0 秒开始并可自然结束解锁。词块 0.854 秒与选项 4.643 秒均在一次点击后真实发声。受控中断首个 `scene.mp3` 请求后，`r10` 的“重新加载”产生第二次请求、隐藏错误操作并实际恢复播放。
- 错答、正确答案标记、0% 反馈、重新作答、100% 通关、铜牌、五段解析、下一关导航和 L1-002 解锁均通过；本地进度记录 `cleared=true`、`bestScore=100`、`attempts=2`。
- 纯听模式隐藏 `#transcript` 台词，日语模式显示正文与假名，双语模式显示中文译文；选项语言 ja/zh/en 与界面 zh/en/ja 独立切换正确，日语界面的双语正文不会混入中文。
- 设置与学习记录弹窗均支持初始焦点、Escape、外部点击关闭和焦点恢复。375×667 下三语设置面板为 337×643，底部操作完整可见，内容区可滚动；“语音来源与许可 / Voice Credits & Licenses / 音声の出典とライセンス”均为 44px 高并指向声线 NOTICE。
- 页面返回关卡地图会把音频重置到 0 并停止；`visibilityState=hidden` 的事件路径同样停止并重置音频。
- 主站 Resources 在 zh/en/ja 均显示本地化卡片和 CTA，安全链接为 `/tools/japanese-subtext/`；实际点击日文 CTA 成功打开标题为“日本語の裏側”的工具。
- 正常工具页控制台只有静态服务器缺少 `/api/tools/japanese-subtext/progress` 导致的预期 404 与降级 warning；主站静态预览只有 Functions API 404 / analytics POST 501。未发现额外 JavaScript 异常，本地训练与本地进度不受影响。
- 最终 `r11` 定向 smoke 再验证 375×667 与 1365×900 的 `scrollWidth === clientWidth`、四个主要控件均为 44px 且在视口内；style/app 与 6 个 ESM 子模块共 8 个公开请求全部携带 `20260711-japanese-subtext-r12` 并返回 200。主站 Resources 实际点击仍进入标题为“日本語の裏側”的工具，控制台除静态 API 降级外无新增异常；专用 Chromium 会话和临时服务器均已关闭。
<!-- AUTO:BROWSER_QA:END -->
<!-- RELEASE:BROWSER_QA:PASS -->

## 最终命令顺序

```powershell
npm.cmd run jp-subtext:validate
npm.cmd run jp-subtext:audio:validate -- --check-silence
npm.cmd run jp-subtext:test
npm.cmd run build
git diff --check
git diff --stat
```

`npm.cmd run jp-subtext:release-check` 必须按上述前四项的顺序执行；不得以 `audio:validate:quick`、抽样或单独 ffprobe 替代正式的全量 ffprobe + 静音校验。

## 模型收尾

- Kokoro 只是本次离线预生成工具；公开产物只依赖静态 MP3 与 manifest。
- 最终音频校验完成后，确认无本任务启动的 TTS 进程、无服务注册、无开机自启动，并保持模型关闭。
- 不删除、停止或改动用户原有的其他 TTS / AI 进程与模型。
