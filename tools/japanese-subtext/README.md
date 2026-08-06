# 日本語の裏側

“日本語の裏側”是一个独立、数据驱动的日语潜台词训练工具。正式题库固定为 5 个难度、每级 50 关：LEVEL 1 为 N3，LEVEL 2 为 N2，LEVEL 3–5 为 N1 / N1 高阶。入口为 `/tools/japanese-subtext/`，主站只负责提供资源卡片，不会把 250 关一次性塞进主站脚本。

当前应用版本为 `1.0.3`，题库、音频与云存档兼容版本为 `1.0.2`。长期版本、界面、题库、音频与发布维护规则见 [`MAINTENANCE.md`](./MAINTENANCE.md)；每次公开应用更新增加 `appVersion`，只有题库结构或兼容边界变化时才增加 `contentVersion`。

错答后的重答入口同时存在于题面和解析顶部；结果弹窗不能通过关闭按钮、Escape 或点击外侧把用户留在已提交但无法操作的状态。下一关入口只按本次答题结果判断，不复用历史通关状态。

## 目录结构

- `content/blueprint.json`：250 关蓝图与题材、技能、布局、插图计划。
- `content/level-*/batch-*.json`：版本化正式题库，每批 10 关。
- `content/catalog.json`、`content/level-*/index.json`：构建产物，用于按等级、批次懒加载。
- `audio/manifest.json`：音频 ID、文件与时间轴的唯一公开关联入口。
- `assets/`：按每关 setting、人物、台词、题问和关键道具生成并压缩的黑白四格漫画；`assets/stages/manifest.json` 记录 250 张图的 SHA-256、960×720 尺寸、生成器与审查状态。本次因 imagegen 网络不可用使用可复现的本地原创 fallback，不将其描述为 AI 逐张绘制。
- `lib/`：内容加载、单实例播放器、本地存档、云端合并和三语界面模块。
- `scripts/`：题库构建/验证、音频生成/验证和真实体积统计工具。
- `MAINTENANCE.md`：工具专用版本规则、界面约束、假名优先录音流程与发布清单。

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
npm.cmd run jp-subtext:audio:validate -- --check-silence
npm.cmd run jp-subtext:audio:validate:quick
npm.cmd run jp-subtext:audio:estimate
npm.cmd run jp-subtext:audio:merge -- --target <audio-root> --source <parallel-root>
npm.cmd run jp-subtext:release-check
npm.cmd run build
```

## 离线语音

本次录制使用隔离安装的 Kokoro-82M v1.0 + `kokoro-onnx` CPU 适配器。正式任务会先使用句子/选项的可审校 `readingJa` 和 token `reading`，其余文本先由 PyOpenJTalk 转为明确假名，再交给 G2P 和模型；画面继续显示原汉字表记。v4 适配器会剥离 Misaki 音高半段、按官方顺序完整规范化 P2R（原始 `j → y` 必须早于 `ʥ → j`），并在遇到未知音素时停止生成，避免句尾额外发音、静默丢失辅音或“や／ゆ／よ”滑音误读。公开仓库只保留适配器、配置模板、模型文件哈希、许可证/声明以及预生成的 MP3；模型权重、本机绝对路径、实际配置和参考声线不提交。

实际配置文件为 `config/tts.local.json`，已加入 `.gitignore`。模板 `config/tts.local.example.json` 提供 4 个官方日语女声和 1 个官方日语男声，并通过语义别名分配温柔、活泼、冷静、神秘、旁白、广播等场景风格。所有声音仍保持清晰可辨，不使用来源不明或模仿受版权保护动漫角色的声线。

日语声线来源、Apache-2.0 / CC BY 3.0 要求与上游链接记录在 `scripts/tts/licenses/NOTICE-japanese-voices.md`；训练设置面板也提供三语“语音来源与许可”入口。更换声线时必须同步更新该 NOTICE 和公开署名。

生成器支持单关、等级、批次和全量模式，以及断点续跑、失败重试、哈希缓存、缺失清单、响度统一、首尾静音、场景拼接、逐句/词块/选项音频和时间轴。查看完整参数：

```powershell
& "<isolated-python>" tools/japanese-subtext/scripts/tts/generate_audio.py --help
```

正式发布还要用同一隔离环境逐项重算最终假名、音素与任务哈希；这个审计不加载 ONNX 权重，但必须读取已校验的 Kokoro 词表：

```powershell
& "<isolated-python>" tools/japanese-subtext/scripts/tts/audit_manifest_phonemes.py --config "<tts.local.json>"
```

需要在多核 CPU 上并行录制时，每个进程必须使用独立 `--audio-root`。完成后先让每个根用最终题库、发音表和自身 level 做 reconciliation，确保 generator metadata、`sourceContentHash` 与 canonical 发音指纹一致，再用 `jp-subtext:audio:merge` 按稳定 ID 合并；禁止多个生成器同时写同一份 manifest。合并器会拒绝内容哈希、模型元数据、输出参数、发音表指纹或声线配置不一致的产物，目标根最后还要运行一次 `--all` reconciliation 和完整音频验证。

TTS 只作为离线批处理进程运行，不安装 Windows 服务、不加入开机启动。生成结束后进程必须退出；浏览器运行工具时只读取静态音频，绝不加载模型或调用在线 TTS。

## 存档与安全边界

- 未登录时使用版本化本地存档；登录后与独立的 `japanese_subtext_profiles`、`japanese_subtext_stage_progress`、`japanese_subtext_daily_activity` D1 表合并。
- 本地 CLI／stdio MCP 可通过设备码令牌读取账号的有界进度投影，并提交由服务端判分的语义答题；`japanese-subtext:progress:read` 与 `japanese-subtext:progress:write` 均为独立、非默认 scope，Agent Bearer 始终按普通用户访问自己的记录。
- Agent 答题只接受锁定关卡 ID、revision、contentHash、逐题选项、进度 expectedRevision 与 operationId。分数、通关、奖牌、尝试次数、解锁和时间戳均由服务端生成；辅助答题固定按双语模式记录且奖牌最高为铜牌。活动按站点 `Asia/Shanghai` 日界线归日；同一 operationId 在 180 天收据窗口内只能重放完全相同的载荷，客户端不得复用过期 ID。
- 云端失败不会阻止本地答题，空云端也不会清空本地进度。
- 跨设备合并必须保留任一已通关记录的首次通关模式；较新的失败尝试不能把合法通关状态变成服务端拒绝的组合。
- 服务端从 HttpOnly 会话取得用户 ID，并验证关卡 ID、解锁链、成绩、奖章和请求大小。
- 题库字符串全部使用安全 DOM API / `textContent` 渲染；插图路径限定在本工具资产目录，音频路径只从 manifest 解析。
- 播放器始终只维护一个 `Audio` 实例；换关、返回地图、页面隐藏或离开页面时停止旧音频。

## 发布门槛

发布前必须满足：恰好 250 关、所有文本已锁定、题库验证通过、9,838 个非场景任务完成 reading / phoneme / task hash 复算、10,088 件真实音频完成全量 ffprobe / SHA-256 / 静音 / 孤儿文件验证、五个规定视口完成回归、工具区入口（内部 `resources` route）可达、主站构建通过、项目文档/Skill/缓存版本/三语 `site-updates` 同步。任何一项失败都不能把演示数据当成正式完成版本。
