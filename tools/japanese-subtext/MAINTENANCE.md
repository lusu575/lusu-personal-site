# 日本語の裏側维护手册

当前待发布维护版本：`1.0.3`（阶段状态：2026-07-14）；尚未完成公开发布。

日常使用、生成与验证命令见 [`README.md`](./README.md)；上线与每个维护版本的独立追加记录见工具专用 [`CHANGELOG.md`](./CHANGELOG.md)。

当前阶段已完成 canonical Image2 v4 jobs 全量重建及来源、设计身份、生成／导入、迁移与发布管线契约测试，完成 L5-001～L5-050 内容审计并补齐 L5-011～L5-020 关键读音／证据回归。尚待完成 250 张关卡图与桌面／手机两张背景图的逐图生成、Codex 六项审核、导入和发布，Aivis 最终增量生成／scene 重拼／全量媒体验收，release check、五视口三语浏览器回归及部署。完成这些门槛前不得把 `1.0.3` 写成已发布。

## 版本规则

- 每次修改“日本語の裏側”的公开界面、交互、题库、音频、存档兼容或维护流程，版本号固定增加 `0.0.1`。
- 例如：`1.0.1 -> 1.0.2 -> 1.0.3`。不要跳过版本，也不要把网站整体版本代替工具版本。
- 版本必须同步到工具 manifest、内容批次与目录、前端常量、音频 manifest、云进度 API、主站 Resources 卡片、构建守卫和更新记录。
- 已发布关卡 ID 永久稳定；修改某关可见内容时单独增加该关 `revision`，版本号和关卡 revision 不能互相替代。

## 界面维护

- 标题按界面语言显示：中文“日语的言外之意”、English “Behind the Japanese”、日本語“日本語の裏側”。
- 中文界面使用简体中文字体栈；日语题目节点必须标记 `lang="ja"` 并使用日文字体栈，避免同一行汉字字形大小不一致。
- 首次模式选择只在当前浏览器第一次使用时出现。听力模式隐藏台词并要求完整听完场景；日语和双语模式直接显示对应正文。进入关卡不得自动播放。
- 播放器公开控件只保留播放/暂停、进度 seek 和倍速；句子与词块本身可点击播放，不再增加单独播放按钮。
- 答题后使用结果弹窗显示得分和本次奖牌。选项可保留颜色与无障碍标签，但不得插入会撑高选项的“正确答案”可见文字。
- 播放或高亮句子不得调用 `scrollIntoView()` 强制移动页面。
- 主站 Resources 链接必须传递当前 `zh/en/ja`；桌面与手机横屏使用横版外背景，只有 `≤900px` 竖屏使用手机竖版背景。

## 题库维护

- 面向用户的题干、选项和解析不得显示 `line-002`、`line 002` 等内部编号；使用“第 2 句台词 / 2番目の台詞 / the second line”等自然说法。
- `evidenceLineIds`、音频 ID 和时间轴 line ID 仍保留稳定内部编号，不得因显示文案调整而重排。
- 可运行 `node tools/japanese-subtext/scripts/normalize-visible-line-references.mjs` 幂等清理旧式可见引用；脚本只在实际修改关卡时增加该关 revision。

## 离线语音维护

- 正式语音只接受 `aivisspeech-1.2.0-aivmx-v3` 管线使用 AivisSpeech Engine 1.2.0 和已校验 AIVMX 模型在 CPU 上离线生成，输出固定为 44.1 kHz、mono、约 96 kbps MP3；不得用旧管线成品混入当前版本。
- 正式语音任务只接受每句人工审校的纯假名 `readingJa`、日语选项 `readingJa` 和词块 `reading`；画面继续显示原有汉字表记。读音中出现汉字、ASCII 或数字时生成器必须失败关闭，禁止交给模型猜读音。
- AivisSpeech 适配器可用表面文本建立基础 `/audio_query`，但必须再用审校假名调用 `/accent_phrases` 并替换查询中的全部 accent phrase / mora。仅当表面文本与审校假名的韵律及标点结构一致时允许 `kanaSource=surface`；不一致时必须使用 `reviewed-reading-fallback`。manifest 同时保存 reading、mora 序列和最终 query 哈希；“今日”统一锁定为 `きょう`，不得用易误识别的 `きょー`。
- 常见多音字或模型易错读音写入 `config/pronunciations.json`；它是注音/审校输入，不是发布时替代已锁定 `readingJa` / `reading` 的补丁层。凡覆盖词实际出现在可朗读表面文本中，回归测试必须确认最终 reviewed reading 已经包含它；最长匹配不得把规则当作其他汉字复合词的词尾，例如“後から”不能误命中“午後から”。先修读音输入，再定向重录，禁止只靠反复随机生成碰运气，也禁止复用旧版 TTS 成品。
- 任务哈希必须包含最终假名、mora、最终查询参数（含 `kanaSource` 与逐条 `speedScale` 调整）、完整 `ratePolicy`（policy、6.5 目标、6.6 校准上限、7.2 硬上限和最多 6 轮）、声线、AivisSpeech Engine/AIVMX 模型指纹和输出参数；`ratePolicy` 同时写入每个非场景 manifest item 与生成器元数据并由两套发布门禁精确核对。策略变化时未调整的旧成品也必须失效。只重建哈希变化的句子、词块和选项；scene hash 绑定每条 line 的最终 normalized WAV SHA-256，任一 line 重建或元数据变化都必须重拼场景。
- 每个非场景任务在原始合成后、静音填充和响度归一化前必须审计 raw 边界；归一化缓存只能在同哈希 `.boundary.json` sidecar 的 artifact / normalized SHA-256、raw / normalized 边界和版本全部匹配且通过时复用。缺少无损缓存时只能重新请求 Aivis，禁止从 MP3 回填。所有正式输出必须先写候选文件，完整验收后原子替换；同一 `audio-root` 必须持有跨进程 OS 写锁。
- 正式发布只接受 clarity schema 3；所有教学任务必须按扣除 `≥250 ms` 句内长停顿后的实际发音时长计算且不高于 `7.2 mora/s`，响度为 `-18 ±1.5 LUFS`，安全正增益最多 `4.5 dB`，最终 true peak 不高于 `-2 dBTP`。发布前逐项运行假名/mora/query/task/scene 复算、ffprobe、SHA-256、时间轴、孤儿文件、响度、首尾静音、clipping、尾部能量、分离尾音和截断验证，再用离线 ASR 生成“今日”、异常 `i/ii/い/いい` 尾音及低相似度人工复听清单；失败项定向重录后必须全量复验。
- 当前响度处理身份固定为 `audited-loudness-gain-v3`：每轮都从无损源重渲染，最多使用 3 轮残差校正；limiter 初始输出守卫为 `-2.2 dB`，若 MP3 编码后仍发生 true-peak overshoot，则按实测超限量再加 `0.2 dB` 安全余量降低 ceiling（最低 `-12 dB`）后重渲染，最终仍以解码 MP3 的 `≤ -2 dBTP` 实测为准。速率调整策略固定为 `post-synthesis-active-mora-rate-v3`：硬上限仍为 `7.2 mora/s`，调整目标为 `6.5 mora/s`，校准样本必须 `≤6.6 mora/s`，允许最多 6 轮逐步校准而不得靠放宽门槛放行，使随机重合成后仍有清晰度余量；旧速率 policy 不得恢复复用。修改 limiter、轮数或增益算法时必须同步升级 profile，修改速率调整语义时必须升级 rate policy，禁止让旧成品按同一身份复用。
- 普通 `≤5` mora 短词的清晰度下限保持 `1.5 mora/s`；仅当 reviewed reading 恰为单 mora 填充迟疑「ん」加日语标点时，允许 `hesitation` 速率带使用 `1.2 mora/s` 下限。生成、fresh 媒体审计、Node validator 与主构建都必须从 `readingKana` 重算该分类，禁止仅修改 manifest 字段绕过。
- 全量批处理按关卡隔离失败：进入每关前必须用同卷硬链接（不支持时复制）快照该关公开目录；某关在有界 query、校准或 clarity 重试后仍失败时，生成器原子恢复 MP3、scene、timeline 与该关 manifest 变更，记录 `stage-failed`，继续处理后续关卡，并在末尾写出可直接传给 `--retry-list` 的 `*-failures.json` 后以非零状态退出。媒体与 manifest 都持久化成功后才删除快照；若媒体回滚自身失败则立即终止，禁止继续写出不一致 checkpoint。只要 failure report 非空，整批就不得发布；先修复并重试失败关，再执行全量验证。
- 正式 `jp-subtext:release-check` 同时执行 Node 契约测试与 Python TTS unittest；本机没有可用的 `python3` / `python` / `py -3` 时，只为该命令设置 `JP_SUBTEXT_TTS_PYTHON` 指向隔离 Python，禁止把本机绝对路径提交到仓库。
- AivisSpeech Engine 固定为 CPU 离线批处理，不注册 Windows 服务、不加入计划任务、Run 或 Startup。批处理结束后必须关闭 Engine 及子进程，确认端口释放且 GPU/内存占用归零；后续没有用户明确指令时不得自动加载。

## 插图维护

- 每个关卡使用一张与该关场景、人物关系和核心线索一致的高完成度黑白四格漫画；四格顺序应能辅助理解情境，但不得直接泄露正确答案。黑白四格不等于裸线稿，必须具有足够的灰阶、网点、墨色、材质和场景信息。
- 正式关卡图只允许 OpenAI `gpt-image-2`（image2）逐关生成。禁止 CSS、Canvas、SVG、程序化几何、本地分镜生成器或其他模型作为 fallback；图像服务不可用时应停止发布，不能用占位图绕过。
- `prepare-image2-prompts.mjs` 必须把每关 title、setting、确定性设计身份卡、全部日英台词和题问投影到独立 v4 prompt；不得加入选项、答案、解析或关键词猜测出的道具。`image2/design-identities.json` 是人物连续性的唯一注册表：默认身份固定为 `stage:<stage-id>:cast:<cast-id>`，相同通用 cast id 不得自动跨关共享；只有注册表显式列出的同一人物或同外观变体才能共享核心设计，同时必须保留各自 variant。每个设计 seed 由注册表 namespace 与完整 design identity 确定性计算，prompt job 与 provenance 必须绑定注册表 schema、SHA-256 和 namespace。每个任务的 `sourceTextHash` 必须由版本化 canonical 投影计算，覆盖日英标题/场景、cast id 与日英姓名、说话者归属与全部日英台词、日英题问，排除 `illustration`、`contentVersion`、`revision`、现有 `contentHash`、读音/音频、选项、答案和解析；设计身份注册表改变 prompt / promptHash，但不得改变 `sourceTextHash`。原始输出固定为 1536×1152 high PNG，审核后发布为 960×720 WebP。
- 远程、聊天、电话、广播、日志或网络场景必须在 prompt 中追加未分割镜头规则：四个主格各自只能是一幅完整矩形镜头，远端地点以整格交替，禁止斜线分屏、内部边框、画中画或额外子格。视觉审核发现任一主格再次被切分时必须拒绝并重生，不能把“外框仍为四格”当作通过。
- 当同一关多次发生可复现的通信拓扑错误、伪文字或泄题动作时，只能在 prepare-image2-prompts.mjs 的稳定关卡 addendum 中重述题面已有的物理关系与禁止动作，再重算该关 promptHash；不得临时追加未入库提示词，也不得引入选项、答案、解析或新剧情。addendum 不进入 sourceTextHash，但必须进入最终 prompt 与 promptHash。
- 内置生成调用必须在同一执行单元内用 Node UTF-8 直接读取 canonical job、验证 `sha256(job.prompt) === job.promptHash`，并把同一个字符串对象传给 `image_gen.imagegen`；禁止经 PowerShell 5.1 `Get-Content` / `ConvertFrom-Json`、人工复制或其他编码往返传递日文 prompt。只在导入阶段按 selector 读取当前 job 不能证明实际生成输入正确。
- “生成、审核、稳定源复制、review 写入、raw 导入”必须按可恢复事务处理并持久化 attempt 结果；任何一步中断都不得让 stable source 覆盖最后一个与 review/raw 一致的 checkpoint。单关连续失败达到有界上限后应记录原因并退回队列尾部，不能长期占用生成车道。
- 正式原图允许两条且仅两条真实 image2 证据通道。默认通道是 Codex 内置 `image_gen.imagegen`：每次调用只生成一个任务，把原始 PNG 保存在项目外稳定 generated-root，并通过 `import-builtin-image2-asset.mjs` 无裁切缩放到规定尺寸。Codex 视觉审核必须持久化在 `image2/reviews/<job>.json`，诚实使用 `status=codex-approved` 并保留每份记录原有的 Codex reviewer 标识，逐项绑定 job、toolRunId、原始 PNG SHA-256、审核时间及贴题、构图、无答案泄露、无伪文字、无水印、宽高比六项检查；不得将 Codex 审核声称为人类审核。导入 sidecar 固定使用 `codex-builtin-imagegen-v1`，不得伪造 endpoint/requestId。来源布局支持 `<generated-root>/<stage>/<toolRunId>.png` 或稳定 `<generated-root>/<job>.png`。
- API 通道由 `generate-image2-assets.mjs` 调用 OpenAI Images `/v1/images/generations`，只允许 `gpt-image-2`、high、PNG、opaque，并要求项目外真实路径。它必须同时使用随进程释放的 OS lease 与带 owner token 的审计锁，并提供逐图 provenance sidecar、单次同文件系统原子替换、完整像素解码、精确尺寸/SHA-256 验收、429/5xx 有界重试和覆盖响应体读取的超时；API key 只从进程环境读取，禁止写入参数、日志、sidecar 或仓库。付费任务必须显式选择 `--all` 或 `--only`，过期或无法证明来源的文件只能通过显式 `--replace` 重生；陈旧锁只能在确认 PID 已退出后用 `--recover-stale-lock` 处理，而且恢复必须先独占 OS lease，未知锁不得自动删除。
- `publish-image2-assets.mjs` 必须核对恰好 250 个输入及两个背景、精确尺寸、model/quality/sourceTextHash/sourceTextHashSchemaVersion/promptHash/styleBibleHash、设计身份注册表 schema/SHA/namespace、输出 SHA-256、dHash、审查状态、缺失和孤儿文件。每张原始 PNG 还必须拥有同名 `.image2-state` sidecar，逐项匹配图片 SHA/尺寸、任务/风格/来源哈希与 v4 设计身份卡，并只接受互斥的 API request 证据或内置 imagegen toolRun/原始产物/标准化/`codex-approved` 六项视觉审核证据；两种字段混写必须拒绝。sidecar 出现 Authorization、API key 或任意裸 `sk-*` 凭据形态必须拒绝。发布 manifest 必须绑定 sidecar SHA，禁止只用 prompt job 元数据给任意 PNG 贴 image2 来源。新 v4 任务不得使用会被插图结果反向改写的 `sourceContentHash`；只有历史 v2 包可以显式标记为 `legacy-stage-content` 后兼容。发布全程必须与原图生成器/导入器共用 raw-root OS lease；先在项目内隐藏 staging 中生成并全量验证 WebP 与 manifest，再以整目录 rename、manifest 最后提交和持久 journal 切换正式资源。提交或回滚中断时保留唯一备份，下次运行必须在读取 raw 输入前恢复；死进程遗留的有效 raw-root 审计锁只能显式使用 `--recover-stale-lock`。脚本只报告孤儿和疑似近重复，不得在没有明确人工确认时自动删除未知文件。
- 全库保持统一的原创人物设计、线条粗细、灰阶、网点密度、2×2 分镜边框和 4:3 画幅。不使用来源不明图片、写实人物、现有动漫角色或角色仿画。
- 图片必须保存为项目内压缩资源，按关卡稳定 ID 引用，并使用响应式尺寸与懒加载；不得挤占移动端首屏或让题目控件因图片加载发生明显位移。

## 发布检查

1. 更新本文件的当前版本与版本记录。
2. 运行题库构建、内容验证、音频 dry-run 和受影响音频重录。
3. 为本次版本追加独立的三语 `site-updates` 文章；不得编辑上线或旧版本记录。同步工具与主站缓存 query、`CHANGELOG.md`、`PROJECT_CONTEXT.md`、项目 Skill 和 README。
4. 运行 image2 发布/检查、`jp-subtext:test`、完整音频与清晰度验证和主站 `build`。
5. 复测 359×500、375×667、390×844、844×390、1365×900，以及 zh / en / ja 三种界面语言。

## 版本记录

### 1.0.3 — 待发布（阶段状态：2026-07-14）

- 待发布语音管线改用 AivisSpeech Engine 1.2.0 与四套许可清晰的 AIVMX 日语模型在 CPU 上生成；汉字显示与纯假名发音输入分离，accent phrase / mora、最终 query 和模型 provenance 均进入 manifest 与任务哈希。最终增量生成、受影响 scene 重拼及全量媒体验收尚未完成。
- 增加首尾静音、响度、clipping、异常尾音、截断和清晰度审计，并以失败清单驱动定向重录；旧版 Kokoro 音频不进入 1.0.3。
- canonical Image2 v4 jobs 已按最新题库重建并通过契约测试；250 张关卡图与桌面／手机两张应用外背景图仍须由 `gpt-image-2` 逐张生成、完成 Codex 六项审核并发布，禁止程序化图和 fallback。
- 完成 L5-001～L5-050 内容审计和 L5-011～L5-020 关键回归；设计身份只允许注册表显式 alias 共享，L5-043 `cough` 保持独立。
- 重整桌面和手机关卡布局、声音失败回退、首次模式弹窗、答题与下一关流程；图片、场景、问题和操作必须在规定五视口保持可达，最终浏览器复测仍属于发布前门槛。
- 网站公开更新日志改为上线和每个维护版本分别追加一篇三语文章，旧记录保持不可变。
- release check、五视口三语浏览器回归和 GitHub main／Cloudflare Pages 部署尚未完成；这些门槛全部通过后才能把本条转为公开版本记录。

### 1.0.2 — 2026-07-11

- 语音管线升级为 `kokoro-ja-mp3-v4`：先锁定汉字的假名读音，再分离 Misaki 音高标记，按官方顺序补齐完整 P2R（必须先做原始 `j → y`，再做 `ʥ → j`）并拒绝未知音素，针对句尾异常“いい”、“今日”漏读辅音和“や／ゆ／よ”滑音偏移执行全库重录。
- 发布前还要运行 `audit_manifest_phonemes.py` 逐项复算 reading、phoneme 与 task hash；仅有 ffprobe、非静音和 MP3 SHA-256 不足以证明日语读音正确。
- 最终发布库为 10,088 件 / 250 关；9,838 项音素审计与 10,088 件 ffprobe、静音、SHA-256、时间轴、引用和孤儿检查均为全量通过。
- PC 端改为游戏壳式顶栏与居中存档同步区，压缩无效留白；解析页补充进入下一关操作，资源卡入口改为“开始”。
- 学习记录改为按本地日期聚合的月历打卡，显示连续天数、最长连续与最近活动，并通过独立 D1 日活动表同步。
- 每关配图方向改为与题目场景对应的统一黑白四格漫画，并继续遵守响应式、懒加载和原创角色约束。

### 1.0.1 — 2026-07-11

- 三语标题、主站挑战入口与精简标签。
- 简化关卡播放器，移除自动播放、前后句、重播、单句按钮和静音控件。
- 增加仅首次出现的三模式选择与奖牌结果弹窗。
- 修复中文字体回退、技术 line ID 外显和播放强制滚动。
- 语音管线改为假名优先，并针对“今日”等读音建立明确覆盖。
