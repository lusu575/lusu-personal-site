# 离线日语 ASR 清晰度审计

`audit_asr_intelligibility.py` 使用已经存在于本机的 `faster-whisper-base`，对最终音频 manifest 中的 `line`、`token` 和 `option` MP3 做辅助验收。它固定使用 `language=ja`、CPU、int8、`local_files_only=True`，并在加载模型前开启 Hugging Face / Transformers 离线模式；脚本不会联网、下载或安装模型，也不会调用 AivisSpeech。

请等 Aivis 批量生成完全结束并关闭后再运行，避免两个 CPU 推理任务竞争。Python、模型、音频与报告路径均通过本机环境变量传入，不要把本机绝对路径、模型、checkpoint 或审计报告提交到仓库。

## 输入完整性

manifest 的每个条目都会先做严格结构校验，不会因为没有抽中就跳过坏条目：

- `id` 必须与 manifest key 一致且不重复；命令行重复传同一个 `--audio-id` 也会失败；
- 路径必须是规范、相对、仅使用 `/` 的 `.mp3` 路径，禁止盘符、反斜杠、`..`、ADS 和绝对路径；路径按 Windows 大小写不敏感规则去重；
- 所有条目都必须有 64 位小写 `sha256`；`line`、`token`、`option` 还必须有 `readingKana`、`voiceKey` 和实际 `modelVoice`；
- 选中 MP3 必须真实位于 `audio-root` 内，并且实际 SHA-256 必须与 manifest 完全一致。

缺字段、重复项、路径越界、文件缺失、哈希不符、模型/解码/ASR 异常均属于基础设施失败，不属于音频人工复核候选，也绝不会静默成功。

## 离线日语读音比较

工具先做 NFKC、片假名转平假名、标点清理与常见长音折叠。如果当前 Python 已经安装并可离线加载 `pykakasi` 或 `fugashi/UniDic`，工具会优先把 Whisper 的汉字结果转换为读音后再比较；不会为此安装依赖。

如果本机没有可用转换器，含汉字的 Whisper 结果只会成为人工候选。原始汉字与 manifest 假名之间的低字符相似度绝不能触发 `very-low-normalized-similarity` 严格候选，避免把 `東京都千代田区` 这类正确正字法输出误判为错误发音。

专项检查包括：

- 对每个预期 `きょう` / `きょー` 出现位置分别记录 `recognized-kana`、`recognized-orthography`、`possible-dropped-ky` 或 `unconfirmed`；原始 ASR 的 `今日` 正字法在读音转换前单独取证；当题库明确预期 `きょう` 而 pykakasi 把 `今日＋は` 误按问候语转成 `こんにちは` 时，比较层只对对应位置做受控消歧；一句内某一处正确不会遮蔽另一处掉音；
- 检查句尾额外 `i` / `ii` / `い` / `いい`。工具先比较预期与识别结果末尾连续 `i/い` 的数量，只有识别结果确实更多才进入候选；可比较读音与预期完全一致后又多出后缀时才是严格候选，存在轻微前缀差异时仅列为普通人工候选；
- 按 `voiceKey`、实际 `modelVoice`、音频类型和 voice/type 组合统计数量、相似度、人工候选与基础设施失败。

所有 ASR 结论都只是人工抽听线索。ASR 误识别、汉字/假名表记差异和短词错误不能作为自动删除、覆盖或重录音频的依据。

## 路径与写入安全

`--output` 必须是尚不存在的 `.json` 文件，并且必须位于 manifest、音频根目录、模型目录和 checkpoint 目录之外。工具使用同目录临时文件、flush、`fsync` 与不覆盖目标的原子发布写最终 JSON；不会覆盖已有报告或任何输入文件。

`--checkpoint-dir` 同样必须位于音频、模型与 manifest 之外。checkpoint 使用一个带运行指纹的 `state.json` 和每个 `audioId` 一份原子 JSON，写入量是 O(N)，不会在万级库中反复重写一个不断增大的总文件。

运行指纹锁定 manifest SHA-256、模型文件指纹、音频根、抽样 ID/顺序、阈值、CPU/beam 参数及读音转换后端。`--resume` 只复用指纹一致、状态为 `ok` 且当前实际音频 SHA-256 仍一致的条目；损坏或不匹配的 checkpoint 会直接失败，基础设施失败条目会重试。

## 命令

```powershell
$python = $env:JAPANESE_ASR_PYTHON
$model = $env:FASTER_WHISPER_BASE_PATH
$manifest = $env:JAPANESE_AUDIO_MANIFEST
$audioRoot = $env:JAPANESE_AUDIO_ROOT
$reportRoot = $env:JAPANESE_ASR_REPORT_ROOT

# 固定 seed、按 voice/type 分层的可复现抽样
& $python tools\japanese-subtext\scripts\tts\audit_asr_intelligibility.py `
  --manifest $manifest --audio-root $audioRoot --model $model `
  --sample-size 240 --seed v103-final `
  --output (Join-Path $reportRoot 'asr-sample.json')

# 指定一个或多个稳定 audioId
& $python tools\japanese-subtext\scripts\tts\audit_asr_intelligibility.py `
  --manifest $manifest --audio-root $audioRoot --model $model `
  --audio-id L1-001-line-001 --audio-id L1-001-line-001-token-001 `
  --output (Join-Path $reportRoot 'asr-targeted.json')

# 万级全量审计：第一次运行
$checkpoint = Join-Path $reportRoot 'asr-full-checkpoint'
& $python tools\japanese-subtext\scripts\tts\audit_asr_intelligibility.py `
  --manifest $manifest --audio-root $audioRoot --model $model `
  --all --checkpoint-dir $checkpoint `
  --output (Join-Path $reportRoot 'asr-full.json')

# 若上一次在最终报告生成前中断，使用同一参数和 checkpoint 恢复
& $python tools\japanese-subtext\scripts\tts\audit_asr_intelligibility.py `
  --manifest $manifest --audio-root $audioRoot --model $model `
  --all --checkpoint-dir $checkpoint --resume `
  --output (Join-Path $reportRoot 'asr-full.json')
```

## verdict 与退出码

- `audit-passed`：无基础设施失败、无人工候选；
- `manual-review-candidates` / `manual-review-required`：音频需要人工抽听，但审计本身完整；
- `audit-incomplete`：存在输入、完整性、模型、解码或 ASR 基础设施失败。

默认情况下，普通或严格人工候选仍返回 `0`。增加 `--fail-on-strict-candidates` 后，完整审计中的严格候选返回 `2`。任何 `infraFailures > 0` 始终优先返回 `1`，即使同时存在人工候选；参数解析错误沿用 argparse 的退出语义。
