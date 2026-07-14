# 日本語の裏側

“日本語の裏側”是一个独立、数据驱动的日语潜台词训练工具。正式题库固定为 5 个难度、每级 50 关：LEVEL 1 为 N3，LEVEL 2 为 N2，LEVEL 3–5 为 N1 / N1 高阶。入口为 `/tools/japanese-subtext/`，主站只负责提供资源卡片，不会把 250 关一次性塞进主站脚本。

当前公开应用版本为 `1.0.3`，题库、音频与云存档兼容版本为 `1.0.2`。下一候选为应用 `1.0.4`、内容 `1.0.3`，尚未合并 main、尚未上线。候选题库已通过显式音频优先过渡构建为内容 1.0.3；音频 manifest 已从内容 1.0.2 `rebound` 到 1.0.3，覆盖 10,088 个 MP3、250 份时间轴，总长 `42,533.531` 秒、总计 `518,739,675` 字节，rebind 期间 MP3 字节改动为 0。长期版本、界面、题库、音频、image2 插图与发布维护规则见 [`MAINTENANCE.md`](./MAINTENANCE.md)，逐版本变更见工具专用 [`CHANGELOG.md`](./CHANGELOG.md)。

当前运行时仍在显式 `transitional-audio-first` 状态下复用 250 张 `assetContentVersion: 1.0.2` legacy illustrations。2026-07-14 的恢复 checkpoint 只有 14／252 份 current-v4 有效、未引用证据资产，仍缺 238 份；默认构建、image2 检查和 release gate 没有放宽。全部图片、release check、五视口三语浏览器回归和部署完成前，这只能称为音频优先候选，不能称为完整发布候选或已发布 1.0.4。复盘与说明见 [`reports/2026-07-14-image2-production-retrospective.md`](./reports/2026-07-14-image2-production-retrospective.md) 和 [`checkpoints/2026-07-14/`](./checkpoints/2026-07-14/)。

公开 1.0.3 已修复错答后的重答死路：题面和解析顶部都有重答入口，结果弹窗不能通过关闭按钮、Escape 或点击外侧把用户留在已提交但无法操作的状态；下一关只按本次答题结果判断。候选 1.0.4 必须保留这套行为。

## 目录结构

- `content/blueprint.json`：250 关蓝图与题材、技能、布局、插图计划。
- `content/level-*/batch-*.json`：版本化正式题库，每批 10 关。
- `content/catalog.json`、`content/level-*/index.json`：构建产物，用于按等级、批次懒加载。
- `audio/manifest.json`：稳定音频入口；由 `contentVersion`、任务内容哈希、实体 SHA-256、时间轴、审校假名、mora/query 哈希和 Engine/AIVMX provenance 锁定具体发布版本。
- `image2/`：`gpt-image-2` 风格规范、250 关逐图 prompt 和桌面/手机应用外背景 prompt；不包含 API key。
- `assets/stages/v*/`：根据每关 setting、人物设计卡、全部台词和题问逐图生成并压缩的黑白四格漫画；版本 manifest 记录 model、quality、内容/prompt/style 哈希、SHA-256、dHash、960×720 尺寸与审查状态。
- `lib/`：内容加载、单实例播放器、本地存档、云端合并和三语界面模块。
- `scripts/`：题库构建/验证、音频生成/验证和真实体积统计工具。
- `MAINTENANCE.md`：工具专用版本规则、界面约束、假名优先录音流程与发布清单。
- `CHANGELOG.md`：工具上线与每个 `+0.0.1` 维护版本的独立追加记录。

## 内容工作流

1. 先在 250 关蓝图中确定唯一题材、核心潜台词、证据线、答案位置和插图计划。
2. 每批 10 关编写正式内容，并完成日语、语用推理和游戏可玩性三方面审校。
3. 运行 `npm.cmd run jp-subtext:validate:draft`，确认草稿结构与分布。
4. 审核通过后运行 `npm.cmd run jp-subtext:build`。构建器会锁定文本、写入内容哈希，并生成懒加载目录。
5. 只有文本锁定后才运行本地 TTS；修改台词后，依赖内容哈希只重建受影响音频。
6. 依次运行题库、音频、单元测试与主站构建验证。

常用命令：

```powershell
npm.cmd run jp-subtext:build
npm.cmd run jp-subtext:validate:content
npm.cmd run jp-subtext:validate
npm.cmd run jp-subtext:stats
npm.cmd run jp-subtext:test
npm.cmd run jp-subtext:test:tts-python
npm.cmd run jp-subtext:audio:validate -- --check-silence
npm.cmd run jp-subtext:audio:validate:quick
npm.cmd run jp-subtext:audio:rebind -- --prepare
npm.cmd run jp-subtext:audio:rebind -- --rebind --content-version 1.0.3
npm.cmd run jp-subtext:audio:rebind -- --check
npm.cmd run jp-subtext:audio:estimate
npm.cmd run jp-subtext:audio:merge -- --target <audio-root> --source <parallel-root>
npm.cmd run jp-subtext:release-check
npm.cmd run build
```

`jp-subtext:release-check` 会同时运行 Node 与 Python TTS 回归。若系统命令中没有可用 Python，只在当前终端临时设置 `$env:JP_SUBTEXT_TTS_PYTHON='F:\path\to\python.exe'`，不要把本机解释器路径写入仓库。

音频内容绑定迁移不需要等待全部 Image2 成图。先在旧内容版本上执行 `--prepare` 固化 manifest、MP3、timeline 和稳定 audio／scene source 投影，再用显式 `--allow-legacy-illustrations` 构建目标内容版本，最后执行 `--rebind --content-version <version>` 与 `--check`。只有 reading、voice、line／token／option、停顿和 cue 等真实发音来源完全稳定时才允许 rebind；任一投影变化都会拒绝离线改绑并要求回到 Aivis 重建。该流程只建立音频优先候选，默认正式构建和 release gate 仍要求完整 Image2 资产。

## 离线语音

内容 1.0.3（随应用 1.0.4 候选）使用隔离安装的 AivisSpeech Engine 1.2.0 与四套许可清晰的 AIVMX 日语模型，固定由 `aivisspeech-1.2.0-aivmx-v3` 管线在 CPU 上预生成 44.1 kHz、mono、约 96 kbps 的静态 MP3。正式任务只接受句子/选项人工审校的纯假名 `readingJa` 和 token `reading`；适配器先取得表面文本的基础查询，再用审校假名生成并替换全部 accent phrase / mora。当表面文本与审校假名的韵律和标点结构一致时，`kanaSource=surface` 可保留自然韵律；否则必须转为 `reviewed-reading-fallback`，因此“今日”等汉字的显示与实际发音输入彼此分离。读音内出现汉字、ASCII、数字、空 mora 或模型/版本/hash 不匹配时会停止生成。所有非场景 artifact 和 manifest 条目还会绑定完整 `ratePolicy`，策略升级会让未调速的旧音频也失效重录。公开仓库只保留适配器、配置模板、模型文件哈希、许可证/声明以及预生成的 MP3；模型权重、本机绝对路径和实际配置不提交。候选的 10,088 个 MP3 已保持原字节完成内容 1.0.3 绑定迁移，但这不替代完整 Image2、release check、浏览器回归和部署门槛，也不表示应用 1.0.4 已发布。

实际配置文件为 `config/tts.local.json`，已加入 `.gitignore`。模板 `config/tts.local.example.json` 提供四套 AIVMX 模型及多种风格，通过语义别名分配温柔、活泼、冷静、神秘、旁白、广播等角色；模型与声线必须保持许可清晰，不使用来源不明或模仿受版权保护动漫角色的声音。

Engine、AIVMX 模型、ACML-1.0 许可和上游链接记录在 `scripts/tts/licenses/NOTICE-japanese-voices.md`；训练设置面板也提供三语“语音来源与许可”入口。更换声线时必须同步更新该 NOTICE、模型 SHA-256 和公开署名。

生成器支持单关、等级、批次和全量模式，以及断点续跑、哈希缓存、失败重试、自适应逐条降速、`audited-loudness-gain-v3` 受限响度校正、首尾静音、场景拼接、逐句/词块/选项音频和时间轴。教学语音按扣除 `≥250 ms` 句内长停顿后的实际发音时长计算，统一限制为不高于 `7.2 mora/s`；普通短词下限为 `1.5 mora/s`，只有 reviewed reading 恰为单 mora 自然迟疑「ん……」时使用 `1.2 mora/s` 的严格专用速率带。目标响度为 `-18 ±1.5 LUFS`，安全正增益最多 `4.5 dB`，最终 true peak 不高于 `-2 dBTP`。若初始 limiter 在 MP3 编码后仍发生峰值 overshoot，v3 会按实测超限量和额外安全余量降低 ceiling，再从无损源重渲染。极短词使用有效语音循环测量，不能因 EBU 窗口返回 `-inf` 而跳过。每个非场景任务的原始合成 WAV 在加静音和响度归一化前先执行边界审计；归一化缓存只能在同哈希 `.boundary.json` sidecar 绑定了 raw / normalized 指纹且两段都通过时复用。scene hash 还绑定最终 normalized WAV SHA-256，缺缓存时必须向 Aivis 重建无损源，禁止从 MP3 二次编码。候选文件完成全部验收后才原子替换正式文件，同一 `audio-root` 由跨进程 OS 锁保护。最终 MP3 与 manifest 必须通过 clarity schema 3；失败项定向重建，不得直接编码复用。查看完整参数：

```powershell
& "<isolated-python>" tools/japanese-subtext/scripts/tts/generate_audio.py --help
```

正式发布还要用同一隔离环境逐项重算最终假名、mora、query、任务/scene 哈希，并 fresh 解码核对清晰度审计结果：

```powershell
& "<isolated-python>" tools/japanese-subtext/scripts/tts/audit_manifest_phonemes.py --config "<tts.local.json>"
```

离线 ASR 只用于生成需人工复听的候选清单，不会自动删除或覆盖音频。它会检查“今日→きょう”、异常 `い/いい` 尾音和按 voice/type 分层的可懂度，并支持原子 checkpoint/resume；完整用法见 [`scripts/tts/ASR-AUDIT.md`](./scripts/tts/ASR-AUDIT.md)。

需要分片录制时，每个进程必须使用独立 `--audio-root`；生成器会拒绝同一根的第二个写入者。完成后先让每个根按最终题库做 reconciliation，确保 generator metadata、`sourceContentHash`、mora/query 哈希、模型 provenance、输出参数、发音表指纹与声线配置一致，再按稳定 ID 合并；目标根最后还要运行一次 `--all` reconciliation 和完整音频/清晰度验证。

TTS 只作为离线 CPU 批处理进程运行，不安装 Windows 服务、不加入计划任务、Run 或 Startup。生成结束后 AivisSpeech Engine 及其子进程必须退出并释放端口、内存和显卡；浏览器运行工具时只读取静态音频，绝不加载模型或调用在线 TTS。

## image2 插图

每关 v4 prompt 都从锁定题库投影 title、setting、确定性设计身份卡、全部日英台词和题问；选项、答案、解析和关键词猜测出的额外道具不会进入 prompt。人物连续性由 `image2/design-identities.json` 独占管理：默认按 `stage:<stage-id>:cast:<cast-id>` 隔离，同名通用 cast id 不会跨关误合并；只有显式 alias 才共享核心外观，并保留各自 variant。设计 seed 由注册表 namespace 与完整 identity 确定性生成，任务和 provenance 同时绑定注册表 schema 与 SHA-256；注册表变化只改变 prompt/promptHash，不改变文本场景 `sourceTextHash`。正式原图只能由 `gpt-image-2` 以 high quality 生成 1536×1152 PNG，经逐图审查后发布为 960×720 WebP。风格为具有完整灰阶、网点、墨色和场景材质的 2×2 黑白四格漫画，不是裸线稿；CSS、SVG、Canvas、程序化图和本地 fallback 均不接受。

远程／网络关卡会额外锁定“每格一幅未分割镜头”：两地参与者只能用完整主格交替呈现，不能在某一主格内再加斜线、内部边框、画中画或子分屏。审核时按视觉分格数判断；即使外层仍是 2×2，只要内部出现额外分格也必须拒绝重生。

默认通过 Codex 内置 `image_gen.imagegen` 逐任务生成；一次工具调用只对应一个关卡或一个背景，禁止用拼贴批量图切割冒充 252 次独立生成。把工具返回的原始 PNG 复制到项目外稳定来源目录（支持 `<generated-root>/<stage>/<toolRunId>.png`，也支持 `<generated-root>/<job>.png`），在 `image2/reviews/<job>.json` 保存六项 Codex 视觉审核结论，再用导入器无裁切、高质量缩放到任务规定原图尺寸并写入项目外 raw root。审核状态必须诚实写为 `codex-approved`，保留每份记录原有的 Codex reviewer 标识，不得声称人类审核。导入 sidecar 固定记录 `evidenceType=codex-builtin-imagegen-v1`、`tool=image_gen.imagegen`、toolRunId、原图/标准化图 SHA-256、尺寸、prompt/style/source hash 和审核记录 canonical SHA-256；它不会伪造 API endpoint 或 request ID：

```powershell
npm.cmd run jp-subtext:image2:import-builtin -- --selector L1-001 --input "F:\AI\japanese-subtext-image2\v103-builtin-source\l1-001.png" --generated-root "F:\AI\japanese-subtext-image2\v103-builtin-source" --output-root "F:\AI\japanese-subtext-image2\v103-raw" --tool-run-id "exec-..." --generated-at "2026-07-12T00:00:00.000Z"
```

导入器默认读取 `image2/reviews/l1-001.json`；背景分别使用 `background-desktop.json`、`background-mobile.json`。审核记录必须绑定同一 job、toolRunId 和原始 PNG SHA-256，并明确通过贴题、构图、无答案泄露、无伪文字、无水印、宽高比六项检查。关卡 4:3 原图采用严格比例门槛；内置工具标准桌面/手机背景允许最多 0.2% 的可证明比例舍入误差，仍只能无裁切缩放到目标尺寸。重生图片必须重新审核，旧审核不能跨 SHA 复用。

仓库同时保留 OpenAI Images `/v1/images/generations` API 生成器作为另一条真实证据通道。它只从进程环境读取 `OPENAI_API_KEY`，固定发送 `gpt-image-2`、`high`、PNG、opaque 和任务指定尺寸；原图同样必须写入项目外目录。API 生成器使用同目录写锁、逐图 provenance sidecar、SHA-256/尺寸复核、候选文件原子替换、429/5xx 有界重试和断点复用；密钥不会写入日志、sidecar 或仓库。先验证任务，再执行全量或定向重生：

```powershell
npm.cmd run jp-subtext:image2:generate -- --dry-run
npm.cmd run jp-subtext:image2:generate -- --output-root "F:\AI\japanese-subtext-image2\v103-raw" --all
npm.cmd run jp-subtext:image2:generate -- --output-root "F:\AI\japanese-subtext-image2\v103-raw" --only L1-001 --replace
```

付费生成必须显式给出 `--all` 或 `--only`，而 `--replace` 不会被隐式扩大到其他任务。生成期间同时持有随进程自动释放的 OS lease（Windows named pipe / Linux abstract socket）与带 owner token 的审计锁；异常退出若留下审计锁，只有确认记录的 PID 已不存在后，才可显式增加 `--recover-stale-lock`，恢复过程也必须先独占 OS lease。无效或来源未知的锁不会被自动删除。

发布脚本会核对恰好 250 张关卡图和两张应用外背景图，逐图读取 `.image2-state` sidecar，并只接受互斥的两种真实证据：OpenAI Images API 的 request schema/endpoint/request ID，或 Codex 内置 imagegen 的 toolRunId/原始产物/标准化/Codex 六项视觉审核链。两条证据不得混写；任意手工放入但无匹配生成证据的同尺寸 PNG 都不能冒充正式 image2 输出。它还会绑定 sidecar SHA-256、原图 SHA-256、model、quality、`sourceTextHash`、来源投影 schema、promptHash、styleBibleHash、尺寸、dHash 与审查状态，并只报告孤儿/疑似近重复，不擅自删除未知文件。`sourceTextHash` 只覆盖日英标题、场景、人物、说话者归属、台词和题问，排除插图、版本/revision、现有 `contentHash`、选项、答案和解析，避免新图更新关卡哈希后又让自身来源失效。只有旧 v2 资料可以显式标记为 `legacy-stage-content`。

252 张原图全部完成逐图 Codex 六项视觉审查后，按以下顺序发布、只读预检内容迁移、正式迁移，再验证仓库内成品；只有真实完成对应 SHA-256 审核的任务才能使用 `codex-approved`：

```powershell
node tools/japanese-subtext/scripts/publish-image2-assets.mjs --png-root "F:\AI\japanese-subtext-image2\v103-raw" --public-root "tools/japanese-subtext" --stage-out-root "tools/japanese-subtext/assets/stages/v1.0.3" --background-out-root "tools/japanese-subtext/assets/backgrounds/v1.0.3" --manifest "tools/japanese-subtext/assets/stages/v1.0.3/manifest.json" --content-version "1.0.3" --schema-version 3 --review-status codex-approved
npm.cmd run jp-subtext:image2:migrate -- --manifest "tools/japanese-subtext/assets/stages/v1.0.3/manifest.json" --content-version "1.0.3" --check
npm.cmd run jp-subtext:image2:migrate -- --manifest "tools/japanese-subtext/assets/stages/v1.0.3/manifest.json" --content-version "1.0.3" --write
npm.cmd run jp-subtext:image2:check
```

截至 2026-07-14，252 个 canonical v4 jobs 已重建并通过契约测试，但这 252 张图片尚未全部生成、审核、导入或发布；不得把 job 完整误写成资产完成。

## 存档与安全边界

- 未登录时使用版本化本地存档；登录后与独立的 `japanese_subtext_profiles`、`japanese_subtext_stage_progress`、`japanese_subtext_daily_activity` D1 表合并。
- 云端失败不会阻止本地答题，空云端也不会清空本地进度。
- 跨设备合并必须保留任一已通关记录的首次通关模式；较新的失败尝试不能把合法通关状态变成服务端拒绝的组合。
- 服务端从 HttpOnly 会话取得用户 ID，并验证关卡 ID、解锁链、成绩、奖章和请求大小。
- 题库字符串全部使用安全 DOM API / `textContent` 渲染；插图路径限定在本工具资产目录，音频路径只从 manifest 解析。
- 播放器始终只维护一个 `Audio` 实例；换关、返回地图、页面隐藏或离开页面时停止旧音频。

## 发布门槛

发布前必须满足：恰好 250 关、所有文本已锁定、题库验证通过、9,838 个非场景任务完成 reading / mora / query / task hash 复算、10,088 件真实音频完成全量 ffprobe / SHA-256 / 响度 / 首尾静音 / clipping / 异常尾音 / 截断 / 孤儿文件验证、250 张 image2 关卡图和两张背景图完成 manifest 与绑定原始 SHA 的 `codex-approved` 六项视觉审查、五个规定视口完成回归、资源区入口可达、主站构建通过、项目文档/Skill/缓存版本和追加式三语 `site-updates` 同步。任何一项失败都不能把演示数据当成正式完成版本。
