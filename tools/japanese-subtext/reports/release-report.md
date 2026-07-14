# 日本語の裏側 1.0.3 发布验收报告

> 状态：**当前待验收**。旧版 1.0.2 的通过记录不属于本次发布证据；只有下列 1.0.3 契约绑定的门槛全部改为 `PASS` 后，才可发布。

<!-- RELEASE:CONTRACT:{"assetVersion":"20260712-japanese-subtext-v103-r6","audioClaritySchemaVersion":3,"audioPipeline":"aivisspeech-1.2.0-aivmx-v3","audioSampleRate":44100,"backgroundImageCount":2,"contentVersion":"1.0.3","imageModel":"gpt-image-2","imageQuality":"high","stageImageCount":250} -->

验收对象为 `/tools/japanese-subtext/` 的 1.0.3 发布候选，固定使用缓存键 `20260712-japanese-subtext-v103-r6`。语音必须来自 `aivisspeech-1.2.0-aivmx-v3` 的 44.1 kHz 离线 AI 管线；250 张关卡图与桌面、手机两张背景必须来自 `gpt-image-2`、`high`，并由 Codex 完成六项显式视觉检查。该证据状态为 `codex-approved`，不代表人类审核。

## 发布门槛

| 门槛 | 当前待填证据 | 状态 |
| --- | --- | --- |
| 锁定题库 | 1.0.3、5 级 × 50 关、250/250 内容验证 | 待验收 |
| 关卡插图 | 250 张 `gpt-image-2 high` 逐关独立 960×720 WebP，文件哈希与 manifest 一致 | 待资产落地 |
| 工具背景 | 2048×1152 桌面图与 1024×1536 手机图，使用 1.0.3 版本化路径 | 待资产落地 |
| 全量音频 | 10,088 件 AivisSpeech 44.1 kHz mono 约 96 kbps MP3，全量发音、清晰度、ffprobe、静音、哈希与时间轴验证 | 待资产落地 |
| 自动测试 | Node、Python TTS 与主站构建的最终通过计数 | 待验收 |
| 浏览器回归 | zh/en/ja、359×500、375×667、390×844、844×390、1365×900 与主站入口 | 待验收 |

## Image2 最终数据

<!-- AUTO:IMAGE2_VALIDATION:START -->
`PENDING：等待 250 张关卡图、桌面背景与手机背景发布，并完成绑定 toolRunId、原始 SHA-256 和六项检查的 Codex 视觉审核。`
<!-- AUTO:IMAGE2_VALIDATION:END -->
<!-- RELEASE:IMAGE2_VALIDATION:PENDING contract=31c63a8f6e1502a0da171427565878c279dc5ac89d9e17ad9168d58ceb2a449a -->

## 音频最终数据

统计只允许来自 1.0.3 最终发布用 `audio/manifest.json`，不得沿用 1.0.2 数值、生成速度或局部样本推算。

- 实际音频件数：

  <!-- AUTO:AUDIO_ITEM_COUNT:START -->
  `PENDING：等待 1.0.3 音频 manifest。`
  <!-- AUTO:AUDIO_ITEM_COUNT:END -->

- 实际覆盖关卡：

  <!-- AUTO:AUDIO_STAGE_COUNT:START -->
  `PENDING：等待 1.0.3 音频 manifest。`
  <!-- AUTO:AUDIO_STAGE_COUNT:END -->

- 累计时长：

  <!-- AUTO:AUDIO_DURATION:START -->
  `PENDING：等待全量生成结果。`
  <!-- AUTO:AUDIO_DURATION:END -->

- 文件总大小：

  <!-- AUTO:AUDIO_BYTES:START -->
  `PENDING：等待全量生成结果。`
  <!-- AUTO:AUDIO_BYTES:END -->

- 全量验证：

  <!-- AUTO:AUDIO_VALIDATION:START -->
  `PENDING：必须以 aivisspeech-1.2.0-aivmx-v3、44.1 kHz、clarity schema 3 的最终 10,088 件资产完成全量验证。`
  <!-- AUTO:AUDIO_VALIDATION:END -->
  <!-- RELEASE:AUDIO_VALIDATION:PENDING contract=31c63a8f6e1502a0da171427565878c279dc5ac89d9e17ad9168d58ceb2a449a -->

## 浏览器回归

<!-- AUTO:BROWSER_QA:START -->
`PENDING：真实 Image2 图片、版本化背景、最终音频和 r6 缓存键落地后，重新执行全部 zh / en / ja 与五个规定视口回归。`
<!-- AUTO:BROWSER_QA:END -->
<!-- RELEASE:BROWSER_QA:PENDING contract=31c63a8f6e1502a0da171427565878c279dc5ac89d9e17ad9168d58ceb2a449a -->

## 最终发布命令

```powershell
npm.cmd run jp-subtext:validate
npm.cmd run jp-subtext:audio:validate -- --check-silence
npm.cmd run jp-subtext:audio:audit:live
npm.cmd run jp-subtext:image2:check
npm.cmd run jp-subtext:test:tts-python
npm.cmd run jp-subtext:test
npm.cmd run build
git diff --check
git diff --stat
```

运行 `jp-subtext:audio:audit:live` 前只需显式配置 `JP_SUBTEXT_TTS_CONFIG`，必要时再配置 `JP_SUBTEXT_PYTHON`；`jp-subtext:test:tts-python` 若无法自动发现解释器，只为当前命令设置 `JP_SUBTEXT_TTS_PYTHON`。最终门槛固定审计仓库将要发布的 `tools/japanese-subtext/audio/manifest.json` 与同目录音频，不接受外部音频根替代。该步骤会调用本机 Aivis 配置，对全部 reading / mora / query / task hash 重新计算，并重新哈希、探测和解码全部任务与场景音频；普通 `npm run build` 不会启动或依赖本地模型。

`jp-subtext:image2:check` 会以 publisher 的 published-only check 重新绑定当前 prompt、style bible 与已发布 WebP，复算每张图的 SHA-256、dHash 和尺寸，不依赖原始 PNG。最终把门槛改为 `PASS` 时，每个隐藏 PASS 标记还必须带独立 evidence SHA-256；该值同时绑定最终 audio manifest、Image2 manifest、final-stats，以及对应 AUTO 证据区。只替换 `PENDING` 文案、保留可见待验收状态或事后修改证据区都不能通过构建。

完整音频验证必须包含审查假名与 mora/query/task hash 复算、全量 ffprobe、清晰度与静音检查；快速验证、局部试听或单关 benchmark 不能代替正式门槛。最终验收后还需关闭 AivisSpeech Engine 及子进程，并确认没有服务、计划任务或开机自启。
