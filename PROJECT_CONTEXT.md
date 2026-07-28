# PROJECT_CONTEXT.md

## 2026-07-28 每日 AI 新闻覆盖审阅规则

- 修复后的 7 月 28 日正式复跑以 27 个英／中／日／韩检索种子覆盖全部 required group，得到 863 条精确窗口候选并选出 8 条；同 slug 三语线上文章已原位修订，原 `created_at`／`published_at` 保持不变，公开 zh／en／ja 接口均与 schema v4 校验稿一致。
- 发现查询必须区分“请求成功但无结果”和“请求／解析失败”。Google News 查询使用两路受控并发，失败最多重试两次，仍失败则 `fetchStatus` 不能为 success，正式运行必须关闭；不得把内部错误后返回的空数组当作没有新闻。候选索引与 SHA-256 必须基于实际写盘的确定性 UTF-8 字节，不能让 Windows 换行转换造成清单与文件指纹不一致。
- 2026-07-28 的短稿复盘确认：严格 24 小时窗口内 Horizon 实际产出 383 条候选，最终只有两条并非抓取总量不足，而是编辑记录只处理了两条入选和少量排除项，没有逐个签收重点实体／主题查询，也没有在低产量时启动第二轮补查；光刻机与部分中文厂商等明确主题还缺少专门检索。
- 正式工作流使用 schema v4。Horizon 运行除完整 `daily_candidates.json` 外还提供紧凑 candidate index 与 coverage manifest；编辑记录必须完成 required query 和 entity group 的覆盖审阅签收。初选少于 5 条时强制执行低产量第二轮审阅和定向补查，但 5 条不是最低配额，复核后仍可少于 5 条或无稿，绝不能用窗口外、重复或低价值消息凑数。
- 发现层不限制来源语言；可靠的中文、英文、日文、韩文及其他语言来源都可以进入候选，并以重点实体的英中日韩常用别名帮助发现。长期重点包括 Anthropic、OpenAI／GPT／Sam Altman／Codex、Kimi／月之暗面、智谱／GLM、千问／Qwen、MiniMax、混元、美团龙猫、字节跳动／豆包／Seed 等模型厂商，以及芯片／光刻／存储、机器人、智能设备、数据中心能源／散热／网络和科技金融。
- 跨日去重按 `eventKey + eventStage` 判断，不再把同一主体的全部后续永久视为重复。同一事件同一阶段继续排除；正式发布、正式开源／开放权重等实质新阶段可以作为 material update 入选，但内部记录必须指出前序故事和实质变化。

## 2026-07-28 每日 AI 新闻阅读格式

- `daily-ai-news` 文章详情不再显示投递摘要；摘要仍保留给知识库列表、分享卡片与搜索元数据使用，边缘直达页的 `noscript` 正文同样不重复显示摘要。
- 三语标题必须采用“栏目名 + 竖线 + 当天要闻标题”，并完整复用各语言正文第一条要闻的三级标题：中文 `每日 AI 新闻｜<今日要闻标题>`、英文 `Daily AI News | <Lead Story headline>`、日文 `毎日AIニュース｜<今日のトップニュース見出し>`。标题不再只写日期，日期由发布时间和固定 slug 表达，传闻不得进入整篇标题。
- 公开正文在内容型标题后直接进入“今日要闻”，不得显示采集窗口、筛选范围或制作说明；这些时间信息只保存在 Horizon 候选与内部运行记录中。
- 每条新闻必须使用唯一的三级标题。每日 AI 新闻的文章目录只列出这些逐条新闻标题，不再把“今日要闻 / 主要新闻 / 传闻”三个栏目名当作目录；普通知识库文章继续沿用原有目录规则。
- 三语测试占位文章 `daily-ai-news-test-placeholder` 已从 Functions seed 与 schema seed 删除，部署后的幂等数据修补会同时删除线上旧记录，并移除 2026-07-27 三语样稿正文中的采集窗口导语。后续工作流校验器会拒绝标题后的公开导语和重复新闻标题。
- 本批公开缓存与 API 表示版本为 `20260728-daily-ai-news-reader-r1`；更新记录为 `seed-update-2026-07-28-daily-ai-news-reader-format`。

## 2026-07-28 每日 AI 新闻生产运行规则

- 每日 AI 新闻已获正式上线授权。只允许 `daily-ai-news` 专用通道在管理员显式启用 auto-publish 配置后自动公开；机器调用方仍不能自行提交分类、状态、置顶或发布时间。未启用该配置时，入口仍只落三语草稿。
- 每天固定按 `Asia/Shanghai` 07:00 启动。候选与成稿窗口严格为此前 24 小时、左闭右开，即 `[前一日 07:00, 当日 07:00)`；所有入选项必须有准确时间并位于该窗口内。抓取、复核、三语生成、验证、投递和受控公开必须在 08:00 前成功完成。
- 08:00 是硬截止，不允许迟到补发。Horizon 不可用、无合格新闻、来源／格式／三语验证失败、令牌或通道校验失败、幂等／slug 冲突未安全处理，或任一阶段超时，均须关闭本期且不公开；只允许在 07:00–08:00 的剩余时间内进行受保护重试。失败不得降级为手工浏览伪造自动采集，也不得留下半公开文章。
- `自动新闻/integrations/lusu-site/runs/2026-07-27-2300.json` 已于 2026-07-28 通过生产链路作为一次性历史测试公开为 `daily-ai-news-2026-07-27`；zh / en / ja 三个公开接口和文章直达页均验收通过。再次投递返回幂等命中，远端仍只有一篇文章与一条投递事件。该样稿今后仍只能显式使用 `--one-shot-history`，正式每日任务不得复用。

## 2026-07-27 每日 AI 新闻本地生成工作流

- Horizon 是每日 AI 新闻不可绕过的数据入口。本站配置和适配层位于 `自动新闻/integrations/lusu-site/`；`npm.cmd run ai-news:horizon:fetch -- --date <日期> --start <开始> --end <结束>` 真实调用 Horizon 原生多来源抓取、网址规范化和跨来源去重，再按 `Asia/Shanghai` 固定成稿时刻之前的精确 24 小时输出 `data/mcp-runs/<run_id>/daily_candidates.json`、紧凑候选索引和 coverage manifest。窗口采用左闭右开边界，入选项必须有准确时间且不能越界。发现不设语言限制，并通过多语别名覆盖重点模型厂商、芯片与光刻／存储、机器人、AI 设备、自动驾驶、数据中心／散热／能源／网络和科技金融。RSS 瞬时失败由 Horizon 自带 RSS 抓取器定向重试；Horizon 不可用时本期停止，禁止静默改成手工浏览冒充自动采集。
- Codex 只从当次 Horizon 候选中做重要性判断、一手来源复核、近 30 天按 `eventKey + eventStage` 去重、无外链完整文章合成、日文补齐和受控投递。同一事件的新阶段只有在记录前序故事和 material difference 后才可再次入选。当前没有安装或配置供 Horizon 原生评分／富化使用的本地模型或云端密钥；后续若启用，只能增强 Horizon 阶段，不能绕过候选来源证明。
- 每日新闻数量不设固定值，只使用 0–10 重要性评分中的 7 分门槛。初选少于 5 条必须完成低产量第二轮审阅和定向补查，但不得把 5 条当成最低配额；没有达到门槛的内容时报告“今日无稿”，不得拿窗口外消息、重复公告或低价值更新凑数。同一合作由多家公司分别公告时仍按一个故事处理。正文固定按“今日要闻 / 主要新闻 / 传闻”排列：要闻恰好一条且已经核实，传闻单独放置并使用条件语气，不在每条下重复“未证实”提示。
- 一手来源 URL、筛选理由和评分只保存在内部运行记录；公开文章是一篇独立完整的 zh / en / ja 三语正文，不包含网址、Markdown 链接、来源／参考资料章节、相关阅读跳转或内部评分。新闻正文以准确陈述事实为主；每条末尾的 AI 解读必须明显短于正文，通常一至两句，只挑最关键的影响、现实门槛、隐含限制或下一步观察点，不复述新闻，也不要求每条都刻意找问题。
- `自动新闻/integrations/lusu-site/ARTICLE_STYLE.md` 是所有后续日报的唯一固定格式与文风标准，未来代理必须先读。正式工作流 schema v4 和校验器会硬性检查三语标题均为固定栏目名前缀加各自第一条要闻标题、标题后直接进入首个栏目、三段栏目顺序、每条使用唯一三级标题、一段事实正文、恰好一条一至两句且短于事实段的 AI 解读、以解读结束，以及不得逐条重复传闻核实状态；语义层继续按该文件禁止纯日期标题、标题党、新闻复述、空泛套话、强行挑错和无依据扩写。schema v3 只保留给已登记的一次性历史样稿兼容，不得作为新的正式日报。
- `npm.cmd run ai-news:validate` 除检查入选故事、重要性、重复键、三段结构、逐条 AI 解读、三语完整性和正文无链接外，还会读取对应 Horizon 候选文件，核对 `runId`、精确 24 小时窗口、candidate index、coverage manifest、required query／entity group 签收、低产量第二轮审阅，以及每条入选来源确实存在于该次抓取结果。`npm.cmd run ai-news:deliver:local` 临时启用本地投递通道并启动一次 Pages 预览，走正式 `POST /api/automation/daily-ai-news` 契约后立即关闭服务、暂停通道并清除临时令牌。
- 最新审阅样稿为 `自动新闻/integrations/lusu-site/runs/2026-07-27-2300.json`，覆盖北京时间 7 月 26 日 23:00 至 7 月 27 日 23:00：Horizon 合并后 411 条、窗口内 350 条，最终保留 12 条并生成 zh / en / ja 三段式完整文章。首次自然日运行 `runs/2026-07-27.json` 仅保留为历史记录；此前本地 D1 中同 slug 的两条消息草稿属于 Horizon 接入前的规则试投，保持 draft 且未发布。正式样稿现已通过生产通道公开，slug 为 `daily-ai-news-2026-07-27`。
- 正式每日运行已获明确授权，按本文件顶部的 07:00–08:00 生产运行规则执行；不因该授权保存模型／搜索／第三方密钥。自动公开仅限显式启用 auto-publish 的专用通道，其他通道和未配置通道继续草稿优先。本机 Codex 已创建并启用本地任务 `ai-7-8`（“每日 AI 新闻：7点生成，8点前发布”），按当前电脑的北京时间每天 07:00 运行；它不是云端托管任务，因此电脑、Codex 与网络需要在 07:00–08:00 保持可用。

## 2026-07-27 每日 AI 新闻分区、受控投递与自动公开入口

- 知识库新增稳定分类标识 `daily-ai-news`，公开显示名固定为中文“每日 AI 新闻”、English “Daily AI News”、日本語“毎日AIニュース”。该分类在筛选栏中固定排在普通分类之前、`site-updates` 之前，即使当前没有已发布文章也保留入口；专用空状态使用三语文案。
- 三语测试占位文章 `daily-ai-news-test-placeholder` 已在完成分类、列表与详情链路验证后删除；全新 D1、fallback 与线上数据都不得重新补回该占位文章。
- 管理后台新增“自动投递”模块，位置在“知识库文章”之后。管理员可启用／暂停每日 AI 新闻入口，生成、轮换或撤销令牌，复制投递地址，并查看最近事件；令牌明文只在生成或轮换成功后显示一次，D1 只保存 SHA-256 摘要和末尾提示。
- 机器投递入口固定为 `POST /api/automation/daily-ai-news`，配置和事件审计使用 `article_delivery_channels`、`article_delivery_events`。调用必须使用有效 Bearer 令牌并提供 zh / en / ja 三语标题、摘要和正文；机器入口始终强制分类为 `daily-ai-news`、非置顶、无封面，并拒绝调用方提交分类、状态、置顶等越权字段。默认创建无发布时间的 draft；仅专用通道的显式 auto-publish 配置开启时才创建 published 并写入公开时间。
- 投递入口具备请求体上限、按来源与通道限流、幂等键和 slug 冲突保护；事件表只记录必要状态、文章引用和规范化内容的 SHA-256 指纹，不记录文章正文或令牌。相同幂等键只有在内容指纹一致且原文章仍存在时才作为成功重放；内容变化或草稿被删除会明确返回冲突并要求新键。未鉴权请求只初始化轻量通道表，不执行文章 seed。管理员接口继续要求 `users.role = admin`，机器入口不复用管理员 cookie。
- 正式生产调度按 07:00 启动并在 08:00 截止；没有配置模型／搜索／发布密钥，且不会因部署自动创建其他计划任务。站长可随时暂停通道或关闭 auto-publish；关闭、撤销令牌、验证失败或超时后均只能保留草稿或失败事件，绝不自动公开。
- 每日 AI 新闻当前公开阅读版本为 `20260728-daily-ai-news-coverage-r1`（公开主脚本、知识库模块和 API 表示版本）；后台主脚本仍为 `20260728-daily-ai-news-production-r1`，后台样式仍为 `20260727-daily-ai-news-inbox-r1`。覆盖复核更新记录使用 `seed-update-2026-07-28-daily-ai-news-coverage-review`，并已同步完整 fallback、Home 最新五条无正文投影、Functions seed 和 schema seed。
- 最终本地验证为 D1 迁移、静态构建和 300 / 300 项全量测试通过；只读查询确认测试文章有三种翻译，通道初始为 `enabled = 0` 且没有令牌。生产启用、令牌生成与 auto-publish 配置必须作为显式受审计操作完成。

## 2026-07-26 全站安全与可靠性加固

- 账号与公开写接口在进入业务逻辑前校验同源、JSON `Content-Type` 和流式请求体上限。登录、注册按网络来源与规范化账号标识使用持久化 D1 限流；重复邮箱、站长保留邮箱和并发注册统一返回 `400 + REGISTRATION_FAILED`，公开界面不再枚举账号是否存在。新密码固定使用 PBKDF2-HMAC-SHA256 600,000 次，旧 25,000 / 100,000 次哈希仍可登录并在成功后条件升级。
- `api_rate_limits` 保存短期限流桶。页面、点击与文章阅读写入同时做速率上限和重复抑制；每日健康检查用 `waitUntil` 分批清理过期 session、365 天前登录记录、180 天前分析记录和 2 天前限流桶，每表单次最多 5,000 行。意外 5xx 只向客户端返回稳定通用错误，不暴露内部异常。
- 旧 D1 迁移必须先补齐聊天、禁言和 Transfer 历史表的缺失列，再执行依赖索引与完整 schema；`scripts/d1-migrate-local.mjs` 和 `scripts/d1-migrate-remote.mjs` 都覆盖真正 legacy fixture。全新 schema 同时创建 `api_rate_limits` 和 Transfer 设置 revision。
- 后台文章、视频、视频分类、社交链接、视频元数据刷新与删除均使用读取时的 `expectedUpdatedAt` 条件写入；陈旧标签页返回 `409 + CONTENT_CONFLICT` 并保留输入。文章翻译与视频分类关系和主记录在同一 D1 batch 内受版本条件保护。Transfer 设置同样使用 revision；清空房间或清理 R2 仅部分成功时返回非 2xx 和可重试失败列表，不能伪报全部完成。
- `/articles/<slug>` 由 `functions/articles/[slug].js` 在边缘读取已发布文章，并为直接访问输出文章专属 title、description、Open Graph、Twitter、canonical、Article JSON-LD 与安全 `noscript` 正文；不存在的文章返回 404 / noindex，D1 暂时失败时保留可运行主壳。
- 游戏目录与日语工具可选 manifest 都有 7 秒超时、Abort、版本缓存和本地回退；网络失败不能阻塞内置游戏、本地题目或已有存档。生产构建必须把日语音频 manifest 改写到同源绝对路径并保留版本 query，转换保持严格一次匹配。首页壁纸预载与实际 CSS 选择同一格式、宽度和版本，减少动态模式在首屏同步判定，避免重复或瞬时动态请求。
- 全局响应头补齐 CSP、Permissions Policy、HSTS、nosniff、referrer policy 与同源 framing；Pages Functions 的 JSON/XML 也显式携带相同安全边界，`/admin/` 额外拒绝任何 framing。锁定 Wrangler `4.111.0` 时 compatibility date 使用其本地 workerd 可启动的 `2026-07-17`，调整日期后必须真实启动 `wrangler pages dev`，不能只通过静态配置校验。根 `wrangler.jsonc` 只能使用 Cloudflare Pages Git 构建支持的字段，不声明会导致 Pages 拒绝部署的 Worker-only `observability` 或非标准 `secrets` 元数据；独立清理 Worker 可在自己的配置中保留 observability。GitHub Actions 固定第三方 action 的不可变 commit，并运行本地 D1、全量测试、模块图、静态构建、可重复生产构建及两套 Headless 发布审计；共享 runner 的首页首屏 TBT 固定采样三次并以中位数对原 350ms 预算判定，其他场景仍采样一次，网络体积、load、CLS、内存、运行时错误等结构性门槛逐样本检查且任一失败都会阻断。每个样本完成计时采集后先回收旧导航文档再读取全局 DOM 计数，避免把前一页面的可回收对象误算为当前页面节点。
- 本批公开缓存版本为 `20260726-security-reliability-r1`，公开更新记录为 `seed-update-2026-07-26-security-reliability-hardening`；后台脚本为 `20260726-admin-concurrency-safety-r1`，Transfer 管理资源为 `20260726-admin-transfer-safety-r1`。正式发布路径仍是 GitHub `main` 触发 Cloudflare Pages，本地修复不等于已推送或部署。
- 2026-07-26 最终本地证据：D1 legacy 迁移通过；297 / 297 测试、20 个公共模块、静态构建、双次一致生产构建（manifest SHA-256 `fbc56fe9f178f2d00fb050f80d872b558985d47b6117f0325b620f64c74797bd`）、192 / 192 发布矩阵和 A Dark Room 同文档旋转审计通过；Pages dev 健康、文章、404 与未登录后台路由冒烟通过。没有执行远端 D1、push 或部署。

## 2026-07-26 匿名聊天室统一图标规格

- 匿名聊天室只保留 `assets/images/icon-chatroom.png` 这一张规范资源，Home 桌面入口、移动 Home 应用网格、窗口标题栏、桌面任务栏／移动 Dock、欢迎快捷入口、Chat 页头和消息头像全部引用它；不要重新引入 `icon-chatroom-clean.png` 或 `icon-chatroom-desktop.png` 的双资源分叉。
- 当前资源为 96×96 RGBA、透明角点和硬像素边缘，主体 71×73，四边留 10–13px 透明安全区。Home 继续使用桌面 82px、移动 54px 映射；18–54px 小槽位继续使用既有 contain 映射，不额外放大，以保持各位置视觉尺寸适度。公开缓存版本为 `20260726-chatroom-icon-redraw-r2`，更新记录为 `seed-update-2026-07-26-chatroom-icon-redraw`。

## 2026-07-26 全界面移动游戏与弹窗点检规则

- `games/game-shell.css` 的外层 document 固定占用一个 `100dvh`，不得同时承担页面纵向滚动；共享壳使用“顶栏 + 剩余游戏区”网格，iframe 获取剩余高度并由游戏内容自己滚动。359×500、390×844、844×390 都要精确确认外层横／纵滚动为 false，返回、登录、下载、导入、云存档与冲突操作不得缩到 44px 以下。
- 上游嵌入游戏不能把固定桌面文档宽度带进手机 iframe。A Dark Room 窄屏按实际面板宽度移动，声音选择窗完整落在视口内并提供 zh／en／ja 文案；运行中 resize／orientationchange 必须重新测量两层滑轨、当前偏移与资源面板归属，compact→desktop 要恢复 700px 和原资源面板。Kittens Game 在 ≤900px 使用营火→资源→日志单列，顶部工具栏自然换为两行且 Steam／Version 不裁切，全部可见关键控件不小于 44px，`clientWidth` 必须等于 `scrollWidth`；>900px 保留原三栏。
- Life Restart 的移动补丁只对 `pointer: coarse` 生效，运行时必须把主操作与所有可见 `btn*` hitArea 扩到至少 44px；竖屏将工具操作从主流程分离，短横屏改为底部横排，`pointer: fine` 的桌面几何必须与上游保持一致。修改或升级上游后，需同时回归粗指针竖屏、粗指针短横屏与细指针桌面。
- 嵌入副本不得运行与本站无关的上游统计、原站账号、本机开发桥接或未使用主题的外部字体请求。Kittens Game 固定关闭 Google Analytics、KGNet 登录／同步和 `localhost:7780`，首屏只加载当前主题、切换时按需加载，并按站点语言设置 iframe 文档 `lang`；同时保留本站 localStorage、JSON 备份和账号云存档链路。以后升级上游时必须重新扫描全部非本站请求。
- 视频正常播放与最大化继续使用完整窗口；只有 `.video-player-fallback` 失败／不支持状态收敛为居中紧凑决策窗。359×500 欢迎窗可扩大到安全区内的可用高度，桌面模态遮罩必须让窗口与壁纸建立清楚层级，不能靠捕获入场动画中的半透明帧判断最终状态。
- 本轮公开记录为 `seed-update-2026-07-26-interface-audit-fixes`，主站缓存版本为 `20260726-interface-audit-fixes-r2`，共享游戏壳为 `20260726-game-mobile-shell-r1`，A Dark Room 内部资源为 `20260726-a-dark-room-mobile-r2`，Kittens Game `buildRevision` 为 `4`、移动 CSS query 为 `20260726-mobile-r3`，Life Restart 内部缓存为 `20260726-life-mobile-touch-r1`；Home 继续只投影最新五条无正文摘要。最终本地结果为 261 / 261 测试、20 个公开模块、可重复生产构建（manifest SHA-256 `dd99d2a75ea725c9efc34cc4e6b0671821dad9a22f0b6ed140f74d54f9f6d5cb`）、190 / 190 发布矩阵、147 / 147 完整公共 UI 审计与 58 / 58 Tools／Quick Transfer 专项。本地 Headless／CDP 结论不等同真实 iOS／Android 浏览器 chrome、软键盘或完整读屏认证。

## 2026-07-26 工具区三语显示名与兼容规则

- 原“资源区”的公开显示名固定为中文“工具区”、English “Tools”、日本語“ツール”；首页桌面入口、窗口标题、任务栏、移动 Dock、Appbar、文档元信息、空状态和 Quick Transfer 返回操作必须保持一致。
- 这次只改显示层。内部 route/hash 继续使用 `resources` / `#resources`，DOM、CSS、模块、API、统计键和审计命名继续使用稳定的 `resource-*` / `resources` 技术标识，不能为了显示改名破坏旧收藏链接、Quick Transfer、筛选状态或统计归组。
- 旧文章标签值“资源区 / Resources / リソース”保留为兼容输入，但渲染时统一显示新名称；既有 changelog 和旧 `site-updates` 正文中的旧称属于发布历史，不做追溯改写。
- 本轮公开记录为 `seed-update-2026-07-26-resources-to-tools`，公开缓存版本为 `20260726-tools-rename-r1`；Home 继续只投影最新五条无正文摘要。当前本地结果为 Tools／Quick Transfer 三语六视口专项 58 / 58、全量测试 242 / 242、20 个公开模块依赖图、可重复生产构建与发布矩阵 190 / 190。

## 2026-07-26 手机文章首屏与统一点检规则

- 按需 route CSS 的固定级联顺序是：主壳基础样式 → route 样式 → `link[data-mobile-shell-style]` 移动样式 → motion 样式。`ensureRouteStylesheet()` 必须把 route 样式插在移动 marker 之前，不能再 append 到文档末尾；移动几何仍由 `css/mobile-ios-shell.css` 最终裁决，并为文章侧栏保留高优先级 `min-height: 0` 防线。
- 手机文章首屏必须用精确 CDP viewport 同时守卫 359×500、390×844、844×390：初始 `#article-detail.scrollTop` 为 0，侧栏计算最小高度不大于 1px，第一段至少可见 20px，正文总可见量至少分别为 44px、200px、44px；不能只断言父容器无 overflow 或卡片已进入 DOM。
- 文章进度的 100% 终点是 `.markdown-body` 正文末尾，不包含为 Dock 保留的安全尾距。顶部状态的回顶按钮必须使用原生 `hidden` 退出键盘与读屏顺序，并在激活后把焦点交给 `tabindex="-1"` 的文章标题。目录列表和按钮使用 API 返回的实际文章语言，目录导航标签仍使用界面语言；含内部按钮的横向容器不得再增加空白容器 Tab 停靠点。
- 视觉收起不等于可访问性收起：移动 Dock 收起时必须同步 `inert`、`aria-hidden="true"` 与视觉隐藏，并在收起前把已有焦点移到 44px 展开按钮。图片若已有同文可见 `figcaption`，图片使用空 `alt` 避免重复朗读。844×390 英文 Resources 卡继续使用内容高度，所有说明、标签与主操作必须在卡片边界内。
- 本轮公开记录为 `seed-update-2026-07-26-mobile-article-first-screen`，公开缓存版本为 `20260726-mobile-reading-qa-r1`；Home 继续只投影最新五条无正文摘要。当前本地结果为文章专项 10 / 10、Resources 58 / 58、完整公共 UI 审计 147 / 147、全量测试 240 / 240 与发布矩阵 190 / 190；这些 Headless / CDP 结果仍不等同真实 iOS / Android 软键盘、safe area、浏览器 chrome 或完整读屏器认证。

## 2026-07-26 公开主站 30 项功能与界面优化规则

- 游戏云存档写入使用乐观并发控制：客户端每次 PUT 都必须携带最近一次 GET／恢复／同步获得的精确 `expectedUpdatedAt`；首次创建显式传 `null`。服务端只允许 `null` 原子插入不存在的记录，或用 `WHERE updated_at = ?` 更新匹配版本；未命中返回 `409 + SAVE_CONFLICT`，旧页面、并发标签页或其他设备不能无条件覆盖新存档。
- 检测到较新的云存档时，`games/game-shell.js` 必须立即停止 30 秒自动同步和隐藏页／退出／导入等全部上传路径，并显示三语 XP 冲突窗口。用户可以先下载本地 JSON 备份，再明确恢复云端、用本地覆盖当前云端版本或暂不处理；取消、Escape 和外点都只暂停，不得暗中上传。覆盖动作仍受服务端版本校验保护；恢复云端前必须重新 GET 并核对仍是弹窗所示版本，变化时不得应用旧快照。
- 云存档版本基线属于当前标签页，只能写入 `sessionStorage`（不可用时退回当前页面内存），不得与游戏本体一起写入跨标签页共享的 `localStorage`。当前标签页没有已知云版本且本地、云端同时存在时必须进入冲突流程，不能借用其他标签页的新版本号自动上传旧本地数据。
- Quick Transfer 的公开安全说明必须区分两条边界：文字在浏览器使用 AES-GCM；图片、视频和文件不使用房间口令加密，只由 HTTPS 传输、私有 R2 与服务端鉴权保护，且不进行病毒／恶意软件扫描。明文口令不发往服务端；配额是滚动 24 小时，不得写成自然日“今日剩余”。
- PC 任务栏连接托盘不再静态宣称 `ONLINE`。`js/features/connection-status.mjs` 以 `/api/health` 的 `2xx + { ok:true, db:true }` 为唯一在线依据，显示 checking / online / degraded / offline 四态；5 秒超时，在线 60 秒复查，异常按 10／20／40／60 秒退避，隐藏页面时中止。浏览器 `online` 事件只触发复查，不能直接宣称恢复；状态可点击重试、三语播报且不循环闪烁，移动 Dock 继续隐藏该非高频托盘。
- 账号状态检查与 Chat 网络恢复也必须保持真实：账号 GET 有界超时并在稳定 popover 内提供原位重试，不重建或清空编辑字段；Chat 只有成功刷新历史后才从 reconnecting 进入 online，失败时显示可聚焦手动重试。密码房进入与返回公开房必须单飞，读取历史失败不得宣布进入成功。
- Knowledge 搜索使用 NFKC／大小写归一后的多词 AND 匹配；搜索、分类与清空要同步重置真实列表滚动和 History 快照。Videos／Resources 重建分类按钮后恢复原筛选焦点；空视频分类优先提供“显示全部”，网站更新只是次操作。
- `html.lang` 在主壳加载前只接受 zh／en／ja query 并尽早写入；文章卡与详情标题、摘要、正文按 API 返回的实际文章语言标注，回退内容不能继续冒充当前界面语言。移动语言按钮显示完整当前语言名，并在 aria-label／title 中同时说明当前与下一语言。
- 手机 Resources 卡完整显示说明，将事实字段、标签和主操作分层，CTA 排在标签前且保持 44px；Games 卡直接展示全部语言支持，简介可读三行，二级许可／来源使用至少 44px 的原生 `details/summary`，后台刷新失败时保留并明确标示上次成功目录。
- `/api/health` 只返回固定 `{ ok, db }` 健康契约，不再公开用户数量。公开缓存版本为 `20260726-mobile-reading-qa-r1`；三语更新记录与 Home 最新五条投影以本批 `2026-07-26` 记录为准。

## 2026-07-21 桌面任务栏选中态规则

- PC 端当前任务按钮继续使用蓝色按下背景与内凹层级，但不再使用黄色底边、黄色外描边或常亮光晕；键盘操作的 `:focus-visible` 焦点环必须保留，不能为了视觉降噪破坏可访问性。移动 Dock 的透明选中底板与样式不受影响。
- 本轮公开记录为 `seed-update-2026-07-21-desktop-taskbar-active`，公开入口与模块缓存版本统一使用 `20260721-desktop-taskbar-active-r1`；Home 仍只投影最新五条无正文摘要。

## 2026-07-20 公共界面、状态与动效精修规则

- Chat 除移动小屏外还必须把 1280×720 当作短桌面硬门槛：窗口标题、两行身份／房间控制、日志、输入区和页脚都要位于可用窗口内，只有日志轨道可弹性收缩。响应式几何继续只写在 `css/mobile-ios-shell.css`，`css/routes/chatroom.css` 只提供无媒体查询的基础网格；字数计数属于输入状态行，不能作为独立列挤压正文。
- 视频卡缩略图是带视频标题可访问名称的原生 `button`，并保持 16:9；不得退回无键盘语义的装饰 `div`，也不得重新添加遮挡封面的蓝色播放圆圈。iframe 的 8 秒超时必须绑定当前 request generation 与 settled 状态，旧 timer / load / error 不能覆盖新的播放器；失败卡内并排提供重试与原视频入口，重试后恢复合理焦点。
- Knowledge、Videos、Resources、Games、Blog 与 About 的 loading / empty / error 使用共同 `.content-state` 视觉语言。加载和空状态使用 polite status，真实错误使用 alert；重新渲染不得让键盘焦点消失。Knowledge 正文保持约 72ch 可读行长，Resources 窄屏元信息至少 12px 并自然换行。
- `data-motion="off"` 是全局即时提交契约，不只是把 token 改成 1ms：必须关闭硬编码 transition / animation、Dock smooth scroll 与选中底板滑动、骨架循环和主题整页快照；reduced 同样不得保留非必要循环。disabled、`aria-disabled` 或 inert 控件不产生按压反馈，最大化／还原的 FLIP 必须使用真实前后几何。
- 本轮公开记录为 `seed-update-2026-07-20-ui-motion-polish`，主 CSS、移动壳、动效脚本、公共入口与路由懒加载资源统一使用 `20260720-ui-motion-polish-r1`。Home 最近更新继续只投影最新五条无正文摘要。

## 2026-07-19 历史视频封面缓存恢复规则

- 生产 D1 中历史 Bilibili 手动封面使用受限 `data:image` 保存，并通过 `/api/videos/:videoId/thumbnail` 同源端点公开；排查“旧封面不显示”时先分别核对公开列表字段、代理端点状态与全新浏览器渲染，不能在确认数据丢失前要求管理员重新上传。
- `/api/videos` 与单视频详情的 ETag 必须覆盖完整公开响应，不能只使用视频行 `updated_at` 等不足以描述代码转换、分类或封面 URL 的局部种子，否则纯代码修复会被已有浏览器的 304 永久遮蔽。
- 上传封面的同源代理 URL 必须以视频 `updated_at`（或等价内容版本）作为 query 版本。这样历史空缓存会在兼容修复后失效，管理员之后替换同一视频封面时也不会继续命中旧图；前端接受的固有尺寸边界必须与服务端 960×540 上限保持一致。

## 2026-07-19 内容窗口、封面、图标与账号规则

- `site-updates` 是普通时间线日志，永远不得置顶。Functions 创建或更新该分类文章时强制 `is_pinned = 0`，schema / seed 会清理历史错误值，Knowledge 前端对缓存中的旧置顶值也必须按非置顶处理；其他知识文章仍可正常置顶。
- Knowledge 标题栏只保留关闭键，不再提供最小化、最大化或还原状态；以后不要恢复无对应窗口逻辑的装饰性控制。视频模态的独立最大化逻辑不受影响。
- 后台本地视频封面会生成最大 960×540 的受限 `data:image`。公开视频接口必须允许这组尺寸并继续保持 320KB、受限 MIME 和受控同源缩略图端点，不能因为前台尺寸上限更小而让已保存的 Bilibili 手动封面消失。
- Resources 的临时互传入口与五款游戏使用 `assets/images/generated-icons/` 下各自的 192×192 RGBA 图标；图标由图像生成流程制作并透明化，不用 CSS / Canvas 几何替代。新图标必须验证 alpha、透明角点、尺寸和文件预算。
- 账号稳定 DOM 仍同时持有登录／注册字段，但 `[hidden]` 必须在作者 CSS 中可靠生效：登录只显示邮箱和一次密码，注册才显示确认密码；登录后隐藏完整表单，只显示登录成功状态与退出账号按钮，不公开显示账号邮箱。

## 2026-07-19 公共服务恢复与发布守卫

- `articleTranslationsStatements(env, articleId, translations, now)` 的每一次 seed 调用都必须显式传入确定的 UTC ISO 时间；D1 不接受 `undefined` bind。`tests/article-seed-bindings.test.mjs` 会构造完整文章 seed batch 并拒绝任何未定义参数，知识库故障排查应先运行该测试和三语 `/api/articles` smoke。
- Cloudflare Pages 会把存在的 `.html` 静态片段重定向到 clean URL。Quick Transfer 仍只接受当前页面同源地址，但固定允许 `/fragments/quick-transfer.html` 与 `/fragments/quick-transfer` 两个精确 pathname；不得用 `startsWith`、后缀或跨源放宽白名单。
- 本地 Wrangler 预览与 Production 一样会在全部 API 前校验两个独立、至少 32 bytes 的 `CHAT_IP_HASH_SALT` / `ANALYTICS_IP_HASH_SALT`。本地值只放已忽略的 `.dev.vars`；交付预览地址前必须先探测 `/api/health`，不得把缺盐导致的全 API 503 当成单个业务故障。

## 2026-07-19 管理后台离开保护与互传文件治理

- `/admin/` 文章、视频、视频分类、聊天、账号和社交链接表单的未保存状态只由真实输入 / change 或明确表单操作维护；程序自动补入的排序、分类选项和详情值不得在离开时被误判为编辑。
- 主后台侧栏通过“互传文件管理”进入独立受保护的 `/admin/transfer.html`。该页分页展示文件、发送账号、保存时间、过期时间、大小和存储状态；管理员可永久删除 R2 对象及对应 D1 记录，删除失败保留重试状态。
- 本轮属于后台私有更新，仅同步根项目历史、后台页面内 `adminUpdates` 与后台专用文档；不写入公开三语 `site-updates`、Home 最近更新或公开 fallback。

## 2026-07-18 资源区透明图集与排版回归

- `assets/transfer/quick-transfer-icons-source.png` 是带洋红色键背景的构建源，不得由页面引用或直接缩放为生产图集。`scripts/build-transfer-icon-atlas.mjs` 负责色键、边缘去色、缩放并生成 168×168 RGBA 的 `quick-transfer-icons.png`；资产测试必须覆盖 alpha、整体透明率、16 个 sprite cell 的透明角点与可见像素比例。同一 Sharp / libvips 运行时双次构建要求 PNG 字节一致，但 Windows 与 Linux 的 PNG 压缩流不作为跨平台契约；跨平台 CI 解码 RGBA 并使用严格像素差阈值验证视觉等价。
- Resources 桌面窗口当前宽度上限为 960px，卡片高度由标题、说明、元信息、标签和 CTA 自然决定；移动端不得恢复固定卡片高度或用裁剪隐藏内容，主操作继续保持至少 44px。当前两项资源本身都可用，不显示重复的“可获取”状态。
- Quick Transfer loader 与实现层分别只能暂存并恢复自己接管前的 `resource-categories` / `resource-list` 精确 hidden 状态。关闭互传必须回到打开前的列表几何，不得无条件显示空分类栏，也不得让列表闪失。
- Windows 上直接传给 Chrome 的窄 `--window-size` 可能被系统最小窗口宽度钳制到约 500 CSS px。资源布局回归使用 `npm.cmd run audit:resources-layout` 的 CDP 精确 viewport，断言 layout/visual viewport 后，以中、英、日三语覆盖 359×500、375×667、390×844、760×900、844×390、1280×720 的列表、登录和返回状态；当前 58 / 58 个受控检查通过，Headless 结论仍不等同真机。
- Windows Headless 的 `Page.captureScreenshot({ fromSurface: false })` 可能得到空白图，单次 `fromSurface: true` 又可能漏掉固定 Dock / 顶栏等合成层。资源专项审计必须先预热捕获、等待双 `requestAnimationFrame`，再保存第二张 `fromSurface: true` 截图，并逐张人工确认固定层存在；几何断言不能替代这一步。

## 2026-07-18 公开主站 100 项优化收口

- 公开主站保留根目录 Git → Cloudflare Pages 自动部署链；`npm.cmd run build:production` 只在本地生成被 Git 忽略的 `dist/`，产物使用内容哈希文件名、可定位 sourcemap、白名单 manifest 与分层 `_headers`，不得把 `dist/` 或手动 Wrangler 发布当成新的正式部署源。
- Home 四时段桌面壁纸、动态主题层和非 Home 窗口背景提供 AVIF / WebP 响应式档位与 PNG fallback；首屏只预加载当前时段和当前壳的主图，动态图层只挂载当前主题所需节点。任何同路径位图重压缩仍需同步公开 query，不能依赖浏览器猜测内容已变化。
- Home、顶栏、任务栏或移动 Dock 在进入业务路由之前已可见的图标，其样式必须由始终加载的主壳 CSS 所有，不得依赖 `css/routes/` 懒加载样式。Chat 的 Home 入口、标题栏、短屏头像和 Dock 必须使用同一真实资产并通过解码检查。
- 公开列表请求统一经有界 ETag / SWR / last-known-good 缓存：304 复用缓存，短暂失败保留最后成功内容并提供可控重试，强制重试必须能绕过新鲜缓存。视频列表只返回受控封面 URL/尺寸，禁止重新内联不受限 base64 大图。
- Quick Transfer 使用 `(created_at,id)` 稳定游标、`sync_generation` 重置语义、单飞刷新、键控 DOM 更新、队列背压与幂等键；旧 D1 升级必须先补 `transfer_rooms.sync_generation`、`transfer_items.idempotency_key` 等列，再执行依赖这些列的索引文件，迁移验证不得用超出 D1 SQLite compound-select 上限的单条探针。
- 移动 App 外框可延伸到半透明 Dock 后方以保留至少 80% 的视觉工作区，但必须用等量内部安全尾距保证真实内容、Chat composer 与最后一个操作仍位于 Dock 上方。359×500、375×667、390×844、844×390 的三语子项包含/相交、44px、横向可发现性、forced-colors、日文字体和 normal/reduced/off/low-performance 四档动效都是发布闸门。
- 页面路由、Home 进入 App 与移动 Dock 切换只动画当前页面/窗口表面，不得使用会捕获固定顶栏、任务栏或 Dock 的整页 `document.startViewTransition()` 快照。动效回归必须在 `prefers-reduced-motion: no-preference` + full 模式下采集起始、60ms、140ms 和稳定帧，并验证 Dock 节点身份、透明度、几何和快速连续切换的最终路由。
- Chat 每次逻辑发送必须使用稳定 `clientRequestId`：同一草稿的失败重试复用 ID，服务端在限流前查询已提交重放，并由 `(visitor_id, room_key, client_request_id)` 唯一索引处理并发竞态。私聊重试即使 AES-GCM 随机 IV 产生不同密文，也必须返回首次存储的消息；旧 D1 必须先补 `client_request_id` 列再建索引。
- `npm.cmd run verify:public-site-release` 是本地统一收口入口；它必须覆盖单元/合约测试、模块图、静态构建守卫、生产产物复现性和隔离 Headless UI 矩阵。Headless 结果不等同真实 iOS / Android、完整读屏器或生产部署验证；没有推送权限时只完成本地验收并明确保留线上步骤。
- Headless 审计的独立顶层场景必须通过唯一审计 query 触发新文档并确认 CDP `loaderId`，不得让上一场景的 route 模块、内存缓存、焦点或 Dock 状态污染冷启动结论；刻意验证 SPA Hash、Back / Forward、视频重试或 Dock 连续动效的步骤继续保留同文档。跨页面 DOM 计数必须限定到场景容器，例如 Knowledge 分页只查询 `#knowledge-list`。移动 App 的窗口背景与 Dock 相交不是内容遮挡，验收应测真实末端内容、composer、反馈和页脚。当前本地结果为 192 / 192 测试、142 / 142 完整 UI 审计、190 / 190 发布矩阵和可复现生产构建通过。

## 2026-07-18 账号、文章、Chat 与隐私可靠性

- 公开账号表单由 `js/features/account.mjs` 一次创建稳定 DOM。初始化、语言/模式切换、弹层开关和请求失败只能同步现有节点，不得通过 `replaceChildren()` 丢失邮箱、密码、确认字段、模式或焦点；登录/注册各自只有一个主提交动作，退出失败必须保留真实登录态。
- 账号 popover 的 return focus 以实际触发源为准；Home 顶栏与 Resources/Transfer 上下文都必须覆盖 Escape、外点、移动 44px 关闭、首错焦点和键盘避让。Transfer 未登录状态只保留一个任务卡与一个主登录 CTA，登录后继续原 Transfer 任务。
- 文章阅读时外层 document 必须严格等于 viewport，`#article-detail` 是唯一纵向滚动所有者；进度状态位于 Knowledge 窗口内，实际轨道保持约 4px、与正文零交叠，并同时提供三语可见含义、百分比和准确 ARIA 值。
- Chat 发送期间只锁重复提交，输入继续可编辑；异步完成只可清空未经再次编辑的提交草稿。359×500 普通房维持约 177px、私聊维持至少约 119px，折叠安全说明必须提供 44px 入口，关闭时不得覆盖日志。
- 公共 Chat API 不得把服务端隐藏 `visitor_id` 作为旧消息 fallback 返回；密码、私聊内容、草稿、Secret 和完整标识不得进入 DOM 泄漏、storage、History、日志或 telemetry。安全 DOM 与外链/iframe/fragment 白名单由测试和构建闸门共同保护。

## 2026-07-18 路由与数据按需加载

- `js/main.js` 只静态加载 shell、账号、路由核心、三语字典和约 8KB 的 `js/data/home-content.mjs`。Knowledge、Videos、Resources、Games、Chat 首次进入时通过 `createRouteModuleRegistry()` 单飞加载并永久复用；Knowledge、Videos、Games、Chat 的绘制 CSS 位于 `css/routes/`，移动几何仍只由 `css/mobile-ios-shell.css` 负责。
- Home 不得请求未进入路由的业务 chunk 或 `/api/articles`、`/api/videos`、`games/catalog.json`、social、Chat、Transfer 数据。Videos、Resources、Blog fallback 分别随对应路由加载；`js/data/content.mjs` 保留完整更新 seed 来源，但不进入 Home 初始模块图。
- Quick Transfer 的 loader、`css/transfer.css`、`js/transfer.js` 与 `fragments/quick-transfer.html` 仅在 Resources 真实 CTA 点击后加载。进入 Resources 本身不得创建 `#transfer-app`、暴露 `window.QuickTransfer`、请求 Transfer API 或轮询；首次成功后资产、DOM 与业务实例永久复用，离开竞态不得初始化。
- seed-backed `site-updates` 除完整 `js/data/content.mjs`、Functions 和 schema 外，还必须同步 `js/data/home-content.mjs` 的最近五条无正文摘要投影，供 Home 顶部日期和欢迎更新使用。

## 2026-07-18 主站 UI / UX 100 项优化执行计划

- 新增 `docs/PUBLIC_SITE_UI_UX_100_OPTIMIZATION_PLAN.md`，把 2026-07-17 主站静态审计、31 张有效截图和精确 CDP 几何测量整理为可供 Codex 分批执行的 100 项工作计划；每项包含优先级、代码范围、依赖和完成判定。
- 计划明确保护当前 XP + Pixel Art + Y2K / Neo-XP 身份、四时段 Home 构图和已通过的默认移动/844×390 横屏布局；内部横向滚动只作为可发现性问题处理，不再误报为页面级横向破版。359×500 Chat 实测普通房约 177px、私聊约 119px；长期 QA 门槛已同步校准为普通房至少 160px、私聊至少 115px 或提供可折叠工具区、844×390 至少 150px，并要求安全说明、输入、反馈和 Dock 同时可达。
- 本轮只新增执行文档和维护记录，没有修改公开主站 UI、业务代码、Functions、D1、公开三语 `site-updates` 或资源 query。
- 首个依赖闭合批次已完成 `OPT-001 + OPT-081`。`scripts/public-ui-audit.mjs` 通过 `npm.cmd run audit:public-ui` 启动隔离的一次性 Headless Chrome 与本地只读静态服务器，固定 day 主题、关闭动效并使用受控文章 / Chat API fixture；精确覆盖 359×500、375×667、390×844、844×390、1280×720、1440×900 Chat，以及 844×390 文章目录 + 正文。审计输出写入被 Git 忽略的 `output/public-ui-audit/`，结束时必须关闭浏览器并删除临时 profile；`scripts/build-check.mjs` 同步守卫命令、视口集合、500px 伪手机拒绝和关键几何断言。本批不改变公开 UI 或生产数据。
- 第二个依赖闭合批次完成 `OPT-011 + OPT-023`。`index.html` 必须在首个阻塞样式前根据受白名单约束的 `?wallpaper=` 或本地时间写入 `html[data-time-theme]`；CSS 的桌面窗口背景、Home 壁纸与移动壁纸都从该根属性选择首个资源，不能恢复 `#wallpaper-root data-time="day"` 或只等待 body 属性。`js/main.js` 首次复用该主题，并在时钟更新时同步 html、body、Home 与壁纸舞台。
- 每个 `.page` 的第一层必须保留一个 `.sr-only` H1，section 用 `aria-labelledby` 指向它；移动端即使隐藏桌面 titlebar，活动路由仍要在辅助技术树中暴露唯一 H1。视觉 titlebar 文本使用普通元素并隐藏重复播报；公共列表卡片标题和安全 Markdown 标题从 H2 开始。页面最前的三语 skip link 通过受控点击聚焦 `#main-content`，不得把 `#main-content` 交给旧路由解析而误回 Home。
- `scripts/public-ui-audit.mjs` 现在除 7 个截图/几何场景外，还模拟上海本地 morning/day/dusk/night 与 day 时段的 night 调试覆盖，记录所有桌面/移动主题资源请求并拒绝跨时段资产；语义矩阵覆盖 8 路由 × zh/en/ja 的 DOM 与 CDP AX Tree，并在 359×500、390×844、844×390 复测代表语言。完整运行共 77 项检查，仍使用隔离临时 profile、受控本地 fixture，不能等同真实设备或完整读屏器认证。
- 本批三语更新记录为 `seed-update-2026-07-18-theme-accessibility-foundation`，公开资源 query 为 `20260718-theme-a11y-foundation-r1`；只更新 seed/fallback 与源码，不连接生产 D1、不推送、不部署。
- 第三个依赖闭合批次完成 `OPT-024 + OPT-026 + OPT-061`。路由提交后的自动焦点必须统一落到目标 `.page` 的稳定 H1，不得选搜索框、输入框或无意义首按钮；首次加载不主动抢焦点，首个 Tab 仍是 skip link。文章详情只有在最终标题内容就绪后才聚焦 `#article-detail-title`，返回列表、浏览器前进/后退与 URL 必须同步，任何延迟 rAF 都要先验证当前路由和文章标识，不能在快速导航后抢回陈旧焦点。
- 顶栏账号层是非模态 popover：容器使用带三语可访问名称的 `role=group`，触发器维护 `aria-expanded/controls`；Escape 和外点关闭后焦点归还触发源。打开后首字段/状态聚焦、移动端 44px 可见关闭按钮以及全部 App 层级回归仍属于后续 `OPT-059`，不得因本批标记 `OPT-026` 完成而跳过。
- 主 CSS 不得再在 `body` 上全局隐藏 caret；文本输入、textarea 和可编辑内容使用零优先级 `caret-color: auto` 恢复平台光标。自动审计必须对 Transfer 密码框与 composer 做真实键盘输入，而不只读取 computed style：覆盖选中文字后键入替换、Backspace 删除及 1280×720 / 390×844 可见 caret。
- `scripts/public-ui-audit.mjs` 当前共 95 项检查：继续覆盖 1280×720 zh/en/ja 全路由、359×500 zh、390×844 en、844×390 ja 语义矩阵和既有 Chat / 文章截图，并新增路由离开控制、文章列表/详情历史往返及 Transfer 真键入。该结果是 Headless Chrome 烟测，不等同真实设备软键盘或完整读屏器认证。
- 本批三语更新记录为 `seed-update-2026-07-18-focus-popover-caret`，`style.css` 与 `main.js` 公开资源 query 为 `20260718-focus-popover-caret-r1`；只更新 seed/fallback 与源码，不连接生产 D1、不推送、不部署。
- 第四个依赖闭合批次完成 `OPT-021`。公开路由的 `history.state.lusuPublicState` 使用版本 1、独立 entry id 和白名单规范化；Knowledge 列表条目只保存 category、searchTerm、内部 scrollTop，文章条目只保存 slug、详情 scrollTop 与 `history/default` 返回模式。URL 是 route/slug 的唯一权威来源，搜索词不进入 URL，账号、Chat 草稿、临时互传口令和内容不得进入 History 状态。
- 从 Knowledge 列表打开文章前，必须先用 `replaceState` 捕获来源列表，再 Push 文章条目；来源文章的站内返回只能 `history.back()`，直链文章返回则以 `replaceState` 进入默认 Knowledge，避免离站和重复历史条目。`syncLanguageUrl()` 必须保留现有 state；`history.scrollRestoration` 保持 `manual`，列表和详情滚动通过 passive listener + 单帧 replace 同步，并在 DOM 稳定后恢复。
- History 恢复必须先按 URL 校验/清洗 state，再恢复分类与搜索、渲染 DOM、恢复内部滚动，最后按 OPT-024 只聚焦一次稳定标题。详情请求同时校验 request id、slug 和语言；相同详情不得重复渲染并清零阅读位置，旧语言响应不得覆盖当前语言。
- `scripts/public-ui-audit.mjs` 当前共 99 项检查；在 1280×720 与 390×844 受控文章列表中验证分类 + Unicode 搜索 + 非零列表滚动、详情滚动、站内返回、浏览器 Back / Forward、直链默认返回、未知版本/损坏 state 清洗、外部根字段保留与焦点去重。公开三语更新为 `seed-update-2026-07-18-knowledge-history-restoration`，`main.js` query 为 `20260718-knowledge-history-r1`；未连接生产 D1、未推送、未部署。
- 第五个依赖闭合批次完成 `OPT-022 + OPT-025`。八个公开 route 的文档元信息必须从单一 `routeMetaConfig` 派生：Home 使用站点标题，其余使用“路由标题 | 站点标题”；每个 route 有三语独立 description，canonical 固定为 `https://lusu575.com/?lang=<lang>#<route>`（Home 无 Hash），不得带 wallpaper、welcome、hover 或审计参数。Hash canonical 是当前 SPA 的运行时一致性约定，不代表搜索引擎或社交抓取器已获得独立路径 SSR/预渲染。
- `applyDocumentMeta()` 是 canonical、description、OG 与 Twitter 的唯一完整 DOM 写入口。route 使用默认分享图、1672×941 和三语图片 alt；文章使用正式 `/articles/<slug>?lang=<lang>`、`og:type=article` 与安全白名单封面，自定义封面尺寸未知时必须移除 width/height。加载、失败、离开详情、同路由提交、语言切换和 History 恢复都要覆盖全部字段，不能保留旧文章信息；元信息 helper 不得写 History。
- 欢迎窗与视频窗属于真正模态：`.skip-link` 与 `.site-shell` 是两个 `data-modal-background` 根，打开后由 `syncModalIsolation()` 原生设为 inert，并记住/恢复此前 inert 状态；异常双模态只让 video 优先、另一层 inert。打开顺序是保存真实触发源、显示、同步隔离、聚焦 Close；关闭顺序是隐藏、重算/解除隔离、再归还焦点。完整关闭动画提交前不得提前解除 inert，reduced/off 模式必须立即提交。
- 视频打开调用必须显式携带实际点击的 `[data-video-id/index]` 按钮，不能只依赖触控设备不可靠的 `document.activeElement`。归还目标失效时依次回退到仍活动的模态与当前路由稳定 H1；两个 dialog 保持 `aria-modal=true`、label 与 `tabindex=-1`，手机关闭控件不小于 44×44px。
- `scripts/public-ui-audit.mjs` 当前共 108 项检查，并输出六张欢迎/视频模态精确视口截图；三语八路由、三语文章、文章离开去残留、inert/AX Tree、Tab 圈定、程序化背景聚焦阻断、Escape、full/reduced 关闭时序、焦点归还和移动关闭几何均由本地 fixture 验证。公开更新为 `seed-update-2026-07-18-route-metadata-modal-focus`，`main.js` query 为 `20260718-route-meta-modal-r1`；未连接生产 D1、未推送、未部署。
- 第六个依赖闭合批次完成 `OPT-002 + OPT-007`。`js/main.js` 的八个公开路由必须通过 `registerRouteLifecycle()` / `transitionRouteLifecycle()` 显式进入和离开；路由临时监听、timer、rAF、Observer 和 Fetch 都登记到当前 scope，离开时先 Abort 再清理。相同 route 的无操作导航不得重入；语言切换可以有意重启唯一活动 scope，但不能更新隐藏 route 或重复绑定。
- Knowledge、Videos、Games、About 的请求只在对应 route 活动时发生；Home 不得恢复全量文章、视频、游戏或社交列表预取。Chat 的 timer 在离开或 `document.hidden` 后必须为零，恢复可见后再立即刷新并调度。Quick Transfer 通过 `routeEnter/routeLeave` 与 Resources 对齐，离开时必须清理事件 AbortController、poll timer、Fetch controller、XHR、上传 transport 和 retry delay，且不得削弱 HttpOnly、AES-GCM、R2、Multipart、配额或 24 小时协议。
- 响应式与移动布局的唯一权威文件是 `css/mobile-ios-shell.css`；`css/style.css` 不再承载媒体查询布局，`css/motion-system.css` 只能定义动效或明确限定到桌面壳的层级。`scripts/build-check.mjs` 会解析三份 CSS，并拒绝关键移动 selector/property 的跨文件重复或越权；不要用 `!important` 或更高特异性绕过该边界。
- `window.__lusuRouteLifecycleAudit()` 与 `QuickTransfer.lifecycleSnapshot()` 仅暴露隐私安全的资源计数供本地 QA 使用。`scripts/public-ui-audit.mjs` 当前共 110 项检查，在 1280×720 与 390×844 注入延迟 Fetch 并连续遍历八 route，要求 inactive listener/observer/timer/frame/request/AbortController 归零、Chat/Transfer 无残留、同 route 不重复绑定。公开更新为 `seed-update-2026-07-18-route-lifecycle-mobile-css`，JS query 为 `20260718-route-lifecycle-r1`，三份主 CSS query 为 `20260718-route-lifecycle-css-r1`；未连接生产 D1、未推送、未部署。
- 第七个依赖闭合批次完成 `OPT-020`。`js/mobile-shell.js` 的 `window.LusuFramePipeline` 是公开主站唯一 viewport 调度器：window resize、VisualViewport resize / scroll 各只绑定一次；同键任务在同帧合并，所有 `measure/read` 完成后才执行任何 `mutate/write`，写阶段新任务只能进入下一帧。新增消费者必须使用 `schedule/request` 或 `subscribeViewport`，不得在 `main.js`、`ui-motion.js`、`transfer.js` 恢复第二套原生 viewport 监听或嵌套布局 rAF。
- Home 壁纸舞台与路由图标几何、Knowledge 文章进度与目录、移动 Dock、动效层以及 Quick Transfer 的聚焦控件都使用该管线；route 级订阅随 scope 退出，Transfer 订阅随事件作用域解绑。视口宽高、键盘偏移与 Dock 几何在一次写阶段提交，`visualViewport.scale !== 1` 时键盘偏移必须为 0，避免把页面缩放误判为软键盘。
- 性能档只允许 `normal` / `low`。Save-Data 或浏览器明确报告不超过 2 个逻辑核心 / 2GiB 内存时进入 `low`；能力未知保持 `normal`。低档关闭大面积 blur / backdrop-filter / filter、循环环境动效、常驻 `will-change` 与全页 View Transition，并使用高对比实色回退；normal 档视觉不变。构建守卫同时检查唯一原生绑定、消费者契约、三份 CSS low 规则与 cache query。
- `scripts/public-ui-audit.mjs` 当前共 117 项检查：事件风暴必须恰好产生一帧、一次读阶段和一次写阶段；390×844 / 844×390 核对 CSS 视口变量与 Dock；原生 2× page scale 不得产生键盘偏移；Save-Data、2 核、未知能力档位及低档大面积绘制效果均受控验证。`performance-low-390x844.png` 已人工复核清楚可读，但 Headless Chrome 不模拟真实 iOS / Android 屏幕软键盘。公开更新为 `seed-update-2026-07-18-frame-pipeline-low-performance`，JS query 为 `20260718-frame-pipeline-low-r1`，三份主 CSS query 为 `20260718-frame-pipeline-low-css-r1`；未连接生产 D1、未推送、未部署。
- 第八个依赖闭合批次完成 `OPT-028`。固定移动壳不解锁 body、site-shell 或 page；非 Home 活动 App 窗口通过含 route ID 的高特异性规则保留休眠式 `overflow-y:auto` 逃生通道，只在真实内容增长时生效。文章阅读态继续由 `.article-detail` 独占滚动，Home 桌面、Appbar 与 Dock 保持固定。
- Knowledge、Videos、Resources、Games、Blog、About、Chat 的内部 owner 及 Transfer room entry / room / login gate 允许合理的纵向滚动链。移动通用聚焦恢复只使用 keyed `mobile-shell:focus-reveal`：measure 阶段查找最近且当前真正可滚动的祖先，mutate 阶段仅写其 `scrollTop`。Home 只接纳已打开的账号层，Transfer 暂保留已有专用恢复并不新增原生 viewport 监听；完整软键盘 / 地址栏 / 安全区 / 旋转状态继续归 `OPT-085`。
- `scripts/public-ui-audit.mjs` 当前共 122 项检查：新增 359×500 Chat 内容增长、390×844→390×500→390×844 受限高度代理、文章 / About 真实 owner、2× page scale 聚焦恢复及 Home 零 document scroll。焦点几何审计必须先用 CDP `Page.bringToFront` 激活页面，否则 `activeElement` 可改变却不产生真实 focus 事件。默认 Chat 与文章截图已人工复核稳定。这些 Headless 受控代理不等同真实 iOS / Android 软键盘认证。公开更新为 `seed-update-2026-07-18-mobile-scroll-recovery`，JS query 为 `20260718-mobile-scroll-recovery-r1`，三份主 CSS 与 Transfer CSS query 为 `20260718-mobile-scroll-recovery-css-r1`；未连接生产 D1、未推送、未部署。
- 第九个依赖闭合批次完成 `OPT-085`。`window.LusuFramePipeline` 是移动端 viewport 事实的唯一来源：snapshot 统一包含 layout / visual 宽高、VisualViewport offset、方向、page scale、键盘状态/偏移与 `stable/browser-ui/keyboard/zoom` 模式，再于同一写阶段派生根 CSS 变量与 `data-mobile-*` 属性。其他模块不得从 `window.innerHeight`、`visualViewport`、方向或焦点几何重建第二套键盘/地址栏推断。
- 第十个依赖闭合批次完成 `OPT-003`，并确认 `OPT-073` 为 `DONE-PREEXISTING`。公开主站入口 `js/main.js` 是 ESM composition root；路由解析与生命周期位于 `js/core/`，三语与 fallback 内容位于 `js/core/i18n.mjs` / `js/data/content.mjs`，Knowledge、Videos、Resources、Games、Chat 分属 `js/routes/`，账号属于 `js/features/`。模块只能通过显式 factory 依赖共享唯一状态，不得导入入口或兄弟 route；`npm.cmd run check:public-modules` 拒绝缺失依赖、循环、越层导入和 route 顶层 DOM/网络/timer 副作用。最终 `main.js` 为 80,593 bytes，11-module graph、89 / 89 测试、构建与 135 / 135 无头 UI 审计通过；Chat 离开或隐藏后 scope timer / request 为零。
- 移动编辑控件的可见恢复只能经 `requestMobileFocusReveal()` / keyed `mobile-shell:focus-reveal`：先测量最近且当前真实可滚动的内部 owner，再仅写该 owner 的 `scrollTop`；不得使用全局 `scrollIntoView`、document scroll 或移动 Home、Appbar、Dock。Quick Transfer 必须委托此公共入口，不得恢复私有 viewport 订阅/焦点恢复。账号提交等异步状态更新必须保留表单并恢复最后编辑字段。
- 键盘打开时 Dock 可通过根 viewport 状态临时隐藏以释放可读高度，但不得改写 `body[data-mobile-dock]`、本地存储或用户的展开/收起偏好；键盘关闭后必须回到原用户状态。旋转、失焦锁存、超高反馈与 page scale 都必须保持有界收敛，不得让 Dock 永久隐藏或把当前输入推出可见区。
- `scripts/public-ui-audit.mjs` 当前共 135 项检查，使用受控 Headless Chrome 代理验证 Chat/密码房、账号 popover、Knowledge、Transfer、浏览器 UI 高度变化、旋转、page scale、Dock 两种偏好与 safe-area 能力检测。审计报告必须保留真实能力标志；没有在真实 iOS / Android 上触发软键盘、地址栏收缩或 safe-area 时，不得宣称已完成真机认证。最新公开更新仍为 `seed-update-2026-07-18-mobile-viewport-keyboard`，主 CSS 与 Transfer CSS query 为 `20260718-mobile-viewport-keyboard-css-r1`；fallback 已迁入 `js/data/content.mjs`，Functions seed 与 schema seed 保持同步；当前公共 ESM query 为 `20260718-public-modules-r1`，未连接生产 D1、未推送、未部署。

## 2026-07-17 手机顶栏、文章进度与临时互传发送修复

- 手机虚拟 OS 不再显示顶部时间与 `LUSU OS` 状态行，`--mobile-status-height` 固定为 `0px`；safe area、栏目 Appbar、首页入口和桌面顶栏继续保留。
- 手机知识库文章阅读态只显示进度条，不再同时显示栏目文字和百分比；返回、复制、回到顶部等真实控件必须继续可聚焦、可点击。
- 页面路由的自动焦点迁移不得选择 `input`、`textarea` 等编辑控件；手机从 Home、欢迎快捷入口或 Dock 进入知识库时只能聚焦可见的非编辑控件或窗口表面，不能未经用户点击就唤起软键盘。用户主动搜索、清空或重置后的显式聚焦继续保留。
- 临时互传的相册选择、通用文件选择、拖放和粘贴必须先进入输入区待发送托盘；只有用户再次提交 composer 后才能创建上传任务。文字 API 失败时不得清空附件，发送期间不得追加或移除同一批附件。
- 手机相册入口使用独立 `accept="image/*"` 的多选 file input，不能强制 `capture`；通用文件入口继续多选。待发送图片使用小尺寸 Object URL 预览并在移除、离房或发送后释放。
- 手机互传房间继续使用单一 `.transfer-room` 滚动路径，但 composer 必须处于正常文档流，不能用 sticky / fixed 层覆盖消息；竖屏房间使用纵向 Flex 流，toolbar、feed、composer 与 tasks 直接子项不可收缩并按真实内容高度依次排列，仅将 `position` 改为 static 不足以避免 Grid 轨道中的视觉溢出。短横屏显式恢复原有双栏 Grid。已发送图片使用占满卡片宽度且预留稳定高度的 `object-fit: contain` 预览框，普通文件使用占满可用宽度并包含类型图标、文件名、大小与 MIME 的文件卡片。所有附件保留下载按钮，每条成功解密文字末尾提供复制按钮和剪贴板回退。
- 本轮不修改 HttpOnly 登录、房间 key、AES-GCM、私有 R2、Multipart、配额、24 小时过期、下载鉴权或 `/api/transfer/*` 服务端协议。三语公开更新记录为 `seed-update-2026-07-17-mobile-transfer-send-fix`，资源 query 为 `20260717-mobile-transfer-send-r3`。
- 站长邮箱不得再写入公开源码；由 Cloudflare Pages Production / Preview 各自的加密 `OWNER_ADMIN_EMAILS` Secret 提供，可用逗号、分号或空白分隔多个地址。Functions 只能从请求 `env` 解析规范化 Set，用它执行 schema 后的管理员角色保持和后台账号不可降级检查；它不是登录或权限绕过。未配置时必须保持可用，不回退任何固定邮箱、不自动提升账号且不触发 503，现有 D1 `users.role`、当前账号不可自降级和最后管理员原子保护继续有效。

## 2026-07-16 临时互传上传、全窗拖放与视口高度修复

- Pages Functions 的文件路由依赖根 `wrangler.jsonc` 中 `TRANSFER_BUCKET` R2 binding；顶层 Production 使用 `lusu-temp-transfer`。`env.preview` 必须同时重述 D1 与显式空 `r2_buckets` 等 Pages 非继承 binding，在独立 Preview 桶尚未创建时让预览文件上传安全关闭，绝不回退到正式桶。Secret 的实际值继续在 Cloudflare 的 Production / Preview 环境分别管理；所需变量名由 `.env.example` 的空声明和运行时校验维护，不写入 Pages 不支持的顶层 `secrets` 元数据。构建必须校验这套映射，避免正式环境文字房间可用但文件路由持续返回 `TRANSFER_R2_NOT_BOUND`，也避免预览部署误用正式数据。
- 文件拖放热区覆盖整个互传窗口，只拦截 `DataTransfer.types` 包含 `Files` 的拖放；文字或链接拖放不得被阻断。全窗提示层不接收指针事件，drop、close、blur 与 dragend 都必须清理拖放状态。
- `r2Ready: false` 时客户端必须禁用文件选择并在排队前返回，不得生成上传进度到 100% 后才失败的任务；服务端稳定错误码继续用于诊断，公开 5xx 文案不暴露内部细节。
- 桌面互传窗口按 `100dvh` 的可用区域伸展，消息流吃满新增空间；移动端仍由 `--mobile-viewport-height`、单一 `.transfer-room` 滚动路径和 `visualViewport` 补偿控制。此处原有 sticky composer 已由 2026-07-17 的不可收缩正常流方案取代。
- 本批公开资源 query 为 `20260716-transfer-upload-window-r2`。

## 2026-07-16 手机文章与临时互传界面修复

- 手机端知识库文章的“回到顶部”控制放在 Appbar 可见区域时，固定 `.xp-topbar` 的非控件触控层必须允许点击穿透；Appbar 内实际的返回、复制、账号等交互控件继续单独接收指针事件。
- Resources 列表中的临时互传与日语学习卡片使用同一网格宽度、卡片高度节奏和内边距；标题、元信息、摘要与 CTA 不得因语言长度或内容量出现错位，窄屏信息应换行而不是隐藏。
- 跨语言动态元信息统一使用可稳定回退的 ASCII 分隔符，避免英文系统字体缺少全角标点字形时出现缺字符号。
- 临时互传的未登录入口、房间、消息流、上传任务、文件预览和输入区必须覆盖 359x500、375x667、390x844、430x932 与 844x390；短屏和软键盘出现时仍能到达登录与输入操作，不能用内部滚动锁住页面底部。
- 本轮只更新主站公开 UI 与交互，不修改房间口令派生、HttpOnly 会话、私有 R2、24 小时过期、普通账号配额、管理员 Multipart 权限、下载鉴权或 `/api/transfer/*` 接口。
- 三语公开更新记录为 `seed-update-2026-07-16-mobile-transfer-ui-polish`；本批公开资源 query 统一为 `20260716-mobile-transfer-ui-r1`。

## 2026-07-16 管理后台互动城市访问地图

- `/admin/` 实时大屏地图展示最近 14 天按国家、地区和城市精确分组、具备有效聚合经纬度的城市级聚合；桌面端支持滚轮缩放、拖拽、点击 / 悬停，触屏支持双指缩放与拖动，键盘可聚焦点位并查看城市 PV/UV。
- 底图使用项目内 Natural Earth 矢量路径并通过真实 SVG `<use>` 绘制，缩放 / 平移只修改根 SVG `viewBox`；不得退回 CSS background + transform 的栅格化放大链路。
- 城市点位使用真实 SVG `<g>` / `<circle>`，可见尺寸按 PV 调整，所有缩放级别的命中区至少 44px；地图详情与同数据列表不显示 IP、网络前缀、visitor id、hash 或其他隐藏标识。
- 本轮仅更新管理后台私有界面与后台文档，不进入公开 `site-updates`；后台资源 query 为 `20260716-admin-svg-vector-map-r1`，地图资源 query 为 `20260716-admin-world-map-svg-r1`，维护细节见 `admin/docs/ADMIN_PROJECT_CONTEXT.md`。

## 2026-07-16 管理后台移动与操作安全底座

- `/admin/` 窄屏导航使用分组抽屉；文章、视频、聊天室和账号使用列表 / 详情双态，主要移动触控目标至少 44px，长表单保存操作持续可见。
- 可编辑表单有未保存状态和站内离开保护，危险操作统一显示对象、影响与可恢复性；文章发布一次汇总中 / 英 / 日三语错误，服务端也要求三语正文完整。
- 账号页默认不自动选中用户，资料与密码重置分离；密码重置可选择撤销既有会话，服务端通过原子条件更新阻止最后一个管理员被降级。
- 本轮仅更新管理后台私有界面、后台接口和后台文档；不进入公开 `site-updates`。后台资源 query 为 `20260716-admin-safety-foundation-r1`，细节见 `admin/docs/ADMIN_PROJECT_CONTEXT.md`。

## 2026-07-16 临时互传

- “临时互传 / Quick Transfer / 一時転送”固定放在 Resources 资源区，未登录用户只能看到说明；创建或加入房间、列表、文字、上传、下载和删除全部由现有 HttpOnly 会话在服务端鉴权。
- 房间口令只在浏览器规范化并派生不可枚举的 room key 与文字 AES-GCM 密钥，服务端不接收明文口令；文件放入私有 `TRANSFER_BUCKET`，D1 只保存房间、元数据、配额、上传会话、分片和告警记录。
- 普通账号受保守免费池、单文件与个人配额限制；管理员只通过 `users.role = admin` 识别，可使用 R2 Multipart、暂停/恢复/取消和 GiB 级上传，不受普通业务频次与免费池暂停限制，但仍受并发稳定性、R2 平台边界和实际账单约束。
- 内容发布完成后保留 24 小时，过期后 API 立即拒绝访问；`workers/transfer-cleanup/` 每小时物理清理，R2 生命周期与未完成 Multipart 自动中止规则作为兜底。独立后台页位于 `/admin/transfer.html`，并由主后台侧栏“互传文件管理”进入。
- 本地开发要求 Node.js 22.13+，本地 API 同名变量只能写入已忽略的 `.dev.vars` 并独立生成；Production 值、`.dev.vars`、`.env` 和真实 Secret 不得进入 Git。

## 2026-07-15 GPTWork 可复现开发基线

- 普通站点开发的可复现运行时固定为 Node.js 22.13+、npm lockfile v3 和 Wrangler `4.111.0`；全新克隆使用 `npm ci`。纯本地环境从 `.env.example` 创建被忽略的 `.dev.vars`，GPTWork 使用平台注入的 process Secrets，不能再创建会遮蔽云端值的空 `.dev.vars`。
- 本地 Pages Functions 使用 `wrangler pages dev`，D1 binding 固定为 `DB`，`preview_database_id` 只用于本地模拟数据库；普通开发、CI 和 GPTWork 不需要 Cloudflare 登录、API Token、生产 D1 权限或本机 TTS 模型。
- API router 必须同时获得独立的 `CHAT_IP_HASH_SALT` 与 `ANALYTICS_IP_HASH_SALT`，两者至少 32 字节且不能相同。IP 标识使用 `HMAC-SHA256(secret, purpose + ":" + ip)` 做聊天 / 分析用途隔离；配置不合格时必须在任何 API 业务 D1 访问前返回通用 503，且日志不得输出 Secret 值或请求 IP。
- 聊天消息和网络来源禁言保存由聊天 Secret 自动派生的非敏感密钥代次。Secret 轮换后旧消息只供审计、不能新建网络来源禁言，旧禁言明确显示失效；服务端必须按消息编号读取当前代次目标，不能信任前端提交的 hash，也不得恢复公开 fallback。
- Pull Request 和 `main` 由 `.github/workflows/verify.yml` 执行 `npm ci`、本地 D1 空库初始化、`npm test`、`npm run build`；当前项目没有独立 lint / typecheck 工具链，不添加伪命令。正式部署仍是 GitHub `main` 触发 Cloudflare Pages。
- GPTWork 迁移清单和仅本地资源边界见 `docs/GPTWORK_MIGRATION_READINESS.md`；`output/`、`.wrangler/`、本机 TTS 配置、模型 / 参考声线和 `node_modules/` 不属于 GitHub 运行源。

## 2026-07-14 日本語の裏側 1.0.3 重答修复

- `/tools/japanese-subtext/` 当前公开应用版本为 `1.0.3`，题库、音频、云存档兼容边界继续使用 `contentVersion: 1.0.2`。`appVersion` 表示界面与交互发布，`contentVersion` 只在题库结构或存档兼容边界变化时增加；UI 热修不得连带伪造 250 关哈希或全量音频迁移。
- 错答后必须始终存在重新答题入口：结果弹窗不能由关闭按钮、Escape 或点击外侧直接丢弃，题面保留兜底重答按钮，查看解析后在解析正文之前显示重答；进入下一关只按本次 `attemptCleared` 判断，不得使用历史累计通关状态。
- 本次未修改正式题库、静态音频、关卡图片、进度 API 或 D1 存档结构；主站 Resources 显示应用版本 1.0.3，并通过三语更新记录明确内容兼容版本仍是 1.0.2。

## 2026-07-11 六项移动 Dock 尺寸与桌面选中态
- 六项移动 Dock 使用 340px 最大宽度、48px 单项触控宽度和更清晰的 34px 图标（Home 为 39px），不再保留八项时期的整栏长度；桌面任务栏选中态在导航请求开始时同步，页面转场结束后再次校准。

## 2026-07-11 日本語の裏側 1.0.2

- `/tools/japanese-subtext/` 是独立日语潜台词训练器，当时公开应用版本为 `1.0.2`；标题随界面语言显示为中文“日语的言外之意”、English “Behind the Japanese”、日本語“日本語の裏側”。模块复用一套数据驱动渲染器，题库是 `contentVersion` 管理的分批 JSON，不为单关创建 HTML，也不把 250 关内联到主站 `js/main.js`。
- 正式题库固定为 5×50 关：LEVEL 1=N3、LEVEL 2=N2、LEVEL 3–5=N1 / N1 高阶。每级前 5–10 关相对短，后续递增；每关都包含完整场景、问题、三语选项、答案、证据行和不作绝对化断言的语用解析。
- 内容展示、选项语言和音频设置彼此独立。正文支持纯听 / 日语 / 双语，选项支持 ja / zh / en；首次模式选择只出现一次，进入关卡不自动播放。播放器只保留一个音频实例，公开控件为播放/暂停、任意 seek 和倍速，句子/词块/选项文本本身可点击播放；离开关卡或页面隐藏时必须停止旧音频，播放高亮不得强制滚动页面。
- 音频只在题库审校并锁定后用本机隔离的 Kokoro-82M v1.0 + kokoro-onnx CPU 适配器预生成。句子、选项和词块必须先保存可审校假名，再进入 G2P；v4 适配器剥离 Misaki 音高半段，完整按官方顺序映射 P2R（原始 `j → y` 必须早于 `ʥ → j`），拒绝未知或超过 510 个的音素，避免句尾额外“いい”、“きょう”退化为“おう”及“や／ゆ／よ”偏成“じゃ／じゅ／じょ”。公开仓库不包含模型权重、本机绝对路径、实际 TTS 配置或参考声线；模型不注册服务、不随系统启动，批处理结束后保持关闭。静态题库通过稳定 ID 与 `audio/manifest.json`、关卡时间轴关联；每关 `sourceContentHash`、cue 顺序、reading/phoneme SHA-256、实际 CPU provider、模型与运行时 provenance、输出参数和发音表语义 SHA-256 都是发布门槛，正式校验还必须覆盖全量音素复算、ffprobe、文件 SHA-256、孤儿文件与静音检测。
- 每关使用一张与 setting、台词、题问、人物关系和关键道具映射的原创黑白四格漫画，保持统一线条、网点、分镜边框与 4:3 画幅；不接受来源不明图片、受版权保护角色或写实人物。图片必须由 `assets/stages/manifest.json` 锁定 SHA-256、960×720 尺寸、生成器版本和审查状态，并压缩、懒加载、适配固定验收视口。imagegen/image2 暂时网络不可用时，只能使用可复现的本地原创分镜生成器作为明确标注的 fallback，不能宣称为 AI 逐张绘制。
- 未登录进度保存在版本化本地存档；登录后通过独立 D1 表 `japanese_subtext_profiles` / `japanese_subtext_stage_progress` / `japanese_subtext_daily_activity` 和 GET/PUT `/api/tools/japanese-subtext/progress` 合并。日活动按用户本地日期与关卡稳定 ID 幂等记录，用于月历打卡、当前连续、最长连续和最近活动。服务端从 HttpOnly 会话取用户 ID，并校验 payload、关卡、解锁链、成绩和奖章；不得复用游戏存档表。跨设备合并必须保留已通关记录的 `firstClearMode`，较新的失败尝试不得生成 `cleared=true` 但首次通关模式为空的非法状态。
- 1.0.2 的桌面工具壳复用游戏区视觉结构：左上角返回个人站、右上角工具名称，中间突出存档同步；关卡区减少整屏最小高度与无效留白，解析页必须提供下一关入口。资源区 CTA 使用“开始”，非输入型标题、按钮和卡片文案默认不可选中。
- 面向用户的解析不得显示 `line-002` 等内部 ID；中文 UI 与日文题目必须分别使用简体中文和日文字体栈。发布门槛是题库与真实音频验证、自动测试、五视口 UI 回归、主站回归和文档/Skill/缓存/三语更新记录全部通过。工具说明见 `tools/japanese-subtext/README.md`，版本与维护规则见 `tools/japanese-subtext/MAINTENANCE.md`；每次公开更新固定增加 `0.0.1`。

## 2026-07-06 暗色前端加密密码房

- 匿名聊天室现在有普通大厅和密码房两种模式：普通大厅继续使用浅色 XP UI 和明文接口；密码房使用暗色 UI，浏览器用用户输入的密码派生房间标识和 AES-GCM 密钥。
- 密码房不提交、不保存明文密码；同一密码会派生同一 `room_key`，不同密码互相隔离。密码房消息以 `encryptedContent` 发送，D1 只保存密文，后端会拒绝密码房明文 `content`。
- `anonymous_chat_messages` 新增 `room_key`、`encrypted` 字段；旧消息默认 `room_key='public'`、`encrypted=0`。读取、发送、昵称占用、增量游标恢复和发送限流都按 `room_key` 隔离。
- 仅密码房执行 24 小时无发言清理：房间最新消息超过 24 小时后删除该房全部密文消息并释放房间；普通大厅消息保留原行为。
- 后台聊天室管理对加密消息只显示“密码房加密消息（后台无法解密）”，内容框锁定；管理员仍可隐藏、删除和按隐藏用户标识 / 网络来源禁言。
- 安全边界：这是网页端前端加密，不承诺绝对安全的完整 E2EE。弱密码可被猜中，房间标识本身也会给离线猜测提供验证目标；同时网页端仍需信任当前加载的站点 JS。
- 本次公开可见更新已补齐三语 `site-updates`、`js/main.js` fallback、Functions seed、schema seed、主站/后台资源 query、根目录 changelog、主站 Skill/README 和后台专用文档。
- 运行时 schema guard 的顺序很重要：旧 D1 表首次加载新聊天字段时，必须先通过 `ensureTableColumns()` 补 `room_key` / `encrypted`，再创建任何依赖 `room_key` 的索引；否则普通大厅会在迁移前读取失败。

## 2026-06-30 账号弹窗层级修复与更新记录补齐

- 主站右上角账号入口的弹窗修复分两层处理：`.xp-topbar` 允许弹窗向下溢出，同时 `.site-shell > header` 的层级高于 `.site-shell > main`，避免首页和各栏目 XP 窗口继续遮挡登录/注册弹窗。
- 本次不修改账号接口、登录/注册/退出提交逻辑、会话 cookie 或游戏云存档逻辑，只修正前端显示层级和缓存版本。
- 该修复属于公开可见更新，已补齐 `site-updates` 三语记录、`js/main.js` fallback、`functions/api/[[route]].js` Functions seed、`cloudflare/schema.sql` schema seed、根目录 changelog、项目上下文和主站 Skill；首页最近更新日期由 `content.updates` 自动读取到 `2026.06.30`。
- 后续维护顶栏账号入口、语言切换或其他顶栏浮层时，必须同时检查裁剪、header/main stacking context、移动端断点和资源 query，不能只看按钮 click handler。

## 2026-06-24 账号流程、入口清理与合并上线

- 主站欢迎窗口最近更新操作区已精简为只保留“查看更多网站更新”入口，公开聚合发现链接、入口按钮和对应公开接口已从主站代码与 Functions 路由中移除。
- 右上角账号弹窗改为由登录/注册按钮显式记录提交模式，回车默认登录，点击注册走注册流程；请求期间会临时锁定登录、注册和退出按钮，退出失败时前端也会回到未登录状态，避免界面卡住。
- `npm run deploy` 不再执行 Wrangler 手动发布，只输出合并到 GitHub `main` 后由 Cloudflare Pages 自动上线的提醒；正式发布链路继续保持 `GitHub main -> Cloudflare Pages Git 自动部署 -> lusu575.com`。
- 本次属于公开可见更新，已同步 `site-updates` 三语文章、`js/main.js` fallback、Functions seed、schema seed、根目录 changelog、主站 Skill 和 `main.js` cache query `20260624-account-cleanup-merge-r1`。

## 2026-06-23 公开体验、隐私与发布收口

- 主站已完成一轮公开体验收尾：按钮点击委托改为具体动作优先、通用路由最后兜底，覆盖账号、语言、筛选、文章、视频、弹窗关闭、重试和栏目跳转等常见入口，降低“按钮点了没反应”的风险。
- 视频弹窗和欢迎弹窗补齐初始焦点与关闭焦点恢复；知识库、视频、资源、游戏、聊天室等区域补充状态播报、筛选数量、重复按钮上下文和键盘焦点提示。
- 资源区和杂谈区不再公开展示没有真实链接或正文的占位卡片；Bilibili / Discord 在没有真实配置时默认隐藏；游戏来源链接只接受 GitHub 仓库地址。
- 前端与服务端访问统计继续收紧隐私边界，点击文本、路径、来源、链接和聚合键在写入前脱敏邮箱样式字符串，游戏壳层和主站本地存储读取失败时会退回当次会话状态。
- 最终公开更新已同步 `site-updates` 三语文章、`js/main.js` fallback、Functions seed、schema seed、首页最近更新日期和 `main.js` query；正式发布提交为 `cb4749d577ef7b9b320c6dfe1f3cf6037d47852d`。
- 发布后已清理本地忽略缓存和预览残留，包括 `.wrangler/`、`.wrangler-config/`、`.codex-remote-attachments/` 与 `.codex-wrangler-preview*.log`；`node_modules/` 作为依赖目录保留。

## 2026-06-22 底部导航与四时段窗口背景

- 主站底部任务栏从页面内 sticky 改为固定贴合浏览器视口下沿，切换知识库、视频区、资源区、游戏区、杂谈区、聊天室和关于我时不再被页面内容高度顶下去。
- 主窗口高度统一通过顶部栏、底部任务栏和窗口间距变量计算，桌面端和移动端都为底部栏预留空间，避免任务栏盖住正常窗口或和窗口控件重叠。
- 460px 以下窄屏手机单独提高 `--chrome-topbar-height` 预留值，覆盖顶部栏换行后的实际高度，避免 iPhone SE / 390px 宽度下窗口底部压进 118px 底部任务栏。
- 非首页窗口页不再使用蓝绿色兜底渐变，改为 `assets/images/window-backdrops/<time>.png` 专用四时段低干扰背景图，并叠加轻量现代遮罩；首页原有动态壁纸舞台、云层和 `?wallpaper=` 预览参数保持不变。
- 本次属于公开可见更新，已同步 `site-updates` 三语文章、`js/main.js` fallback、Functions seed、schema seed、根目录 changelog、主站 Skill 和主站 CSS/JS cache query。

## 2026-06-22 关于我联系方式图标归位

- 关于我窗口删除联系方式里的占位文案，将 X、GitHub、Bilibili、Instagram、Discord 五个入口移动到“联系方式”这一行内展示。
- 五个平台图标改为项目内本地 SVG 品牌图标资源，前端通过 CSS mask 渲染原应用图标形状和品牌色；主站仍只显示小图标按钮，不增加可见平台文字。
- 社交链接读取和后台维护逻辑不变：主站继续通过 `GET /api/social-links` 读取 D1 `site_runtime_state.about_social_links`，按钮保留 `aria-label` 并在新标签打开。
- 本次属于公开可见更新，已同步 `site-updates` 三语文章、`js/main.js` fallback、Functions seed、schema seed、根目录 changelog 和主站 CSS/JS cache query。

## 2026-06-20 关于我社交图标与后台链接管理

- 关于我窗口新增 X、GitHub、Bilibili、Instagram、Discord 五个小图标入口；主站只显示图标按钮，不增加可见文字，按钮保留 `aria-label` 并在新标签打开对应链接。
- 主站新增公开只读接口 `GET /api/social-links`，前端初始化时读取 D1 配置，接口不可用时回退到代码内默认链接。
- 后台新增“社交链接”页面，接口为 `GET /api/admin/social-links` 和 `PUT /api/admin/social-links`，继续通过 `requireAdmin` 限制 `users.role = admin` 才能读取或修改。
- 社交链接保存到 D1 `site_runtime_state` 的 `about_social_links` key；保存时只接受 http(s) URL，省略协议时由服务端补 `https://`。
- 本次属于公开可见更新，已同步 `site-updates` 三语文章、`js/main.js` fallback、Functions seed、schema seed、根目录 changelog、主站 Skill 和后台专用文档。

## 2026-06-19 主站四时段沉浸式桌面栏

- 首页顶部栏和底部任务栏新增 morning / day / dusk / night 四套无竖线的现代玻璃像素 HUD 样式，跟随现有本地时间判断与 `?wallpaper=morning|day|dusk|night` 预览参数切换。
- 顶部栏保留站点图标、站名、账号入口、语言切换和最近更新日期；底部任务栏保留 Start、现有窗口图标、导航入口、本地时间和在线状态，不替换原有图标资源。
- 本次只调整公开主站视觉层和缓存版本，顶部栏去掉旧版竖向栅格、底部栏改为更轻的 dock 式像素轨道，并同步 `site-updates` 三语更新文章、前端 fallback、Functions seed 与 schema seed；未修改 `/admin/`、账号接口、聊天接口、文章接口或游戏存档逻辑。

## 2026-06-16 后台视频封面上传

- 后台视频管理新增本地封面能力：管理员可选择 JPG、PNG、WEBP、AVIF 图片，浏览器端压缩裁切为 16:9 后写入现有 `videos.thumbnail_url` 字段。
- 后台新增从本地视频文件读取第一帧生成封面的控件；保存时如果封面为空且已选择本地视频，会先自动生成封面再提交。
- 该能力只处理视频封面，不上传、不托管本地视频文件；视频播放来源仍限 YouTube / youtu.be / Bilibili / b23.tv 白名单链接。
- 后端封面校验继续放行 YouTube / Bilibili 图片域名，并新增受限 `data:image` 封面白名单和大小上限，拒绝 SVG、HTML、任意 data URL 或过大封面。

## 2026-06-15 后台账号管理与登录态 UV 口径

- 后台新增“账号管理”页面，入口在 `/admin/` 侧边栏，位置位于“后台更新记录”上方。
- 后台账号接口：`GET /api/admin/accounts`、`GET /api/admin/accounts/:userId`、`PUT /api/admin/accounts/:userId`。
- 账号管理只允许 `users.role = admin` 访问，继续复用 `/api/admin/*` 的 `requireAdmin` 服务端权限校验。
- 账号页显示注册邮箱、角色、密码加密状态、最近登录、活跃会话、云存档数量、登录履历和近期站内活跃。
- 密码不明文展示，也不向后台前端返回 `password_hash`；修改密码只能通过“新密码”字段重置。真实账号数据只存在 Cloudflare D1，不写入 GitHub 仓库。
- D1 新增 `user_login_events` 表，记录成功登录/注册后的登录履历；只保存掩码 IP 前缀、IP hash、Cloudflare 地区字段、设备摘要和时间，不保存完整明文 IP。
- 访问统计改为登录账号优先识别：登录用户的页面访问、点击和文章阅读使用由账号 ID 派生的不可逆统计 ID，因此同一登录账号跨设备、多次访问仍只计为 1 个 UV；匿名访客继续使用 HttpOnly `lusu_visitor` cookie。
- 后台实时大屏增加自然语言说明，解释 PV、UV、在线访客和点击数据，减少只看缩写造成的误读。

本文档用于帮助新的 AI / Codex 对话快速理解鲁肃个人站。它只保留项目总说明和核心事实；长期维护规则、强约束和踩坑点已拆分到项目专用 Skill。

## 项目背景与介绍

- 项目名称：鲁肃的个人站
- 英文名称：LuSu's Personal Site
- GitHub 仓库：`lusu575/lusu-personal-site`
- 本地目录：以当前 Git checkout 根目录为准；维护脚本不得依赖某台机器的固定盘符路径。
- 当前主分支：`main`
- 当前正式域名：`https://lusu575.com`
- 当前备用 Pages 域名：`https://lusu-personal-site-9hd.pages.dev`
- 站点定位：个人空间，用于记录 AI、游戏、工具、素材、视频、知识库和杂谈内容。
- 风格目标：桌面端保持 Windows XP + Pixel Art + Y2K 并升级为 Neo-XP / Pixel Glass OS；移动端使用原创、受 iOS 交互启发的虚拟手机 OS，两端共享同一业务状态。

## 技术栈

- 前端：HTML + CSS + JavaScript
- 后端：Cloudflare Pages Functions
- 数据库：Cloudflare D1
- 部署：Cloudflare Pages Git 自动部署
- 依赖管理：npm / package-lock
- Cloudflare CLI：Wrangler

## 正式部署方式

正式部署链路：

```text
GitHub main -> Cloudflare Pages Git 自动部署 -> lusu575.com
```

Cloudflare Pages 项目状态：

- 项目名：`lusu-personal-site`
- Git Provider：已连接 GitHub
- 生产分支：`main`
- 自定义域名：`lusu575.com`、`www.lusu575.com`
- D1 数据库：`lusu_personal_site`
- D1 绑定名：`DB`
- D1 database_id：`55087326-4cf0-4002-8229-f202af774da4`

部署说明：

- 网站代码以 GitHub `main` 为源头。
- 修改 GitHub `main` 后，Cloudflare Pages 自动同步并部署到 `lusu575.com`。
- Vercel 不再是这个站点的正式部署入口。
- Cloudflare Pages 构建设置建议保持静态站配置：框架预设 `None`，构建命令留空，构建输出目录 `/`，根目录 `/`。
- `wrangler pages deploy .` 只用于本地手动应急部署，不是 GitHub 自动部署链路。
- 每次提交 main 后，必须核对 `origin/main` 最新 commit、Cloudflare Pages 最新成功生产部署 commit、线上 `index.html` 中 CSS/JS query 版本三者一致；如果线上页面与本地不一致，优先检查资源 query、Cloudflare/浏览器缓存和最新部署状态。

## 主要功能

- 单页、单业务状态的双呈现壳个人站：桌面端 Neo-XP，移动端原创虚拟手机 OS
- 桌面首页图标入口；移动 Home 的 App grid 与 Dock 复用同一组既有路由
- 首页使用四时段像素壁纸：基础静态底图位于 `assets/images/wallpapers/`，按用户本地时间切换 morning / day / dusk / night。四个时段均已接入动态云层，分别使用 `assets/images/wallpaper-dynamic/<time>/base-clean.png` 作为无云底图，并叠加从对应原始壁纸抠出的独立透明云层；云层沿用 `wallpaper-root` / `wallpaper-stage` 舞台坐标结构，只用 CSS `transform` / `opacity` 做同一主风向下的慢速错相漂移，并支持减少动态、小屏和页面隐藏暂停降级。本地调试可用 `?wallpaper=morning` / `?wallpaper=day` / `?wallpaper=dusk` / `?wallpaper=night` 强制预览指定动态壁纸，预览模式会临时加快云层位移以便肉眼确认动画。树冠、电视雪花、小女孩、星星、水面光效等层仍作为后续动画接口保留。
- 顶部栏和底部任务栏：保留 XP 桌面结构与原有图标，并跟随 morning / day / dusk / night 四时段切换无竖线的现代玻璃像素 HUD 色温与高光
- 知识库、视频区、工具区、游戏区、杂谈区、匿名聊天室、关于我
- 关于我窗口含 X、GitHub、Bilibili、Instagram、Discord 五个可点击小图标入口，链接从 D1 `site_runtime_state.about_social_links` 读取，后台可维护
- 中文 / English / 日本語 三语切换
- 主站右上角账号入口
- 游戏页统一外壳和云存档能力
- 数据库化三语文章系统：文章内容保存在 Cloudflare D1，网站按当前语言读取 zh / en / ja 内容
- Cloudflare Pages Functions 后端接口
- Cloudflare D1 持久化账号、会话、游戏存档、聊天室消息和文章内容
- 独立中文管理后台：`/admin/` 仅允许 `users.role = admin` 的站长账号访问，复用主站账号系统，但后台页面、项目介绍和后台更新记录单独维护，不公开到主站知识库。
- 访问与点击埋点：主站通过独立 `js/telemetry.js` 记录 PV、UV、访问来源、地理位置聚合和点击事件；访客使用 HttpOnly 隐藏 ID 识别，前台不显示该 ID；点击目标文本、页面路径、来源、链接、元素标识和点击聚合键中的邮箱样式文本（含 URL 编码和双重编码形态）会在前端与服务端写入前脱敏。

## 数据库化三语文章系统

文章系统第一阶段只做数据库化内容管理和前台读取，不做自动翻译、翻译按钮或 retranslate 接口。

文章存储：

- 文章代码和展示逻辑仍保存在 GitHub。
- 文章内容保存在 Cloudflare D1。
- 每篇文章用一条 `articles` 保存通用信息。
- 每篇文章用 `article_translations` 保存三语内容：`zh`、`en`、`ja`。
- 后台发布文章时要求一次性提供 zh / en / ja 三种内容。
- 正文使用 Markdown 保存。

前台读取规则：

- 当前网站语言为中文时，请求 `lang=zh` 并显示中文内容。
- 当前网站语言为 English 时，请求 `lang=en` 并显示英文内容。
- 当前网站语言为 日本語 时，请求 `lang=ja` 并显示日文内容。
- 如果当前语言版本不存在，fallback 到中文 `zh`。
- 如果中文也不存在，fallback 到任意已有语言版本。
- 知识库区域已改为从 `/api/articles` 读取文章列表，点击后从 `/api/articles/:slug` 读取详情。
- 文章详情公开地址使用 `/articles/<slug>`，可以通过 `https://lusu575.com/articles/<slug>` 直接分享和访问单篇文章；内部 `article_id` 只用于数据库和后台管理，不在公开链接或公开 API 中外显。旧的 `#knowledge/article/<slug>` hash 入口仅作为兼容入口保留。
- 网站切换语言时，文章列表和当前文章详情会重新请求对应语言版本。
- 文章发布时间在前端按用户所在时区显示到秒，不显示时区名；后端时间字段应保持 ISO/UTC 语义，避免被浏览器误读成本地时间。后台文章编辑器显示管理员本地时间，保存时统一转换为 UTC ISO；后端也会规范化 `published_at`，确保不同地区用户看到同一个绝对时间的本地化结果。
- 从文章详情关闭知识库后，再次打开知识库默认回到知识库首页，不保留上一次打开的文章详情。
- 知识库固定使用 `site-updates` 作为“网站更新记录”分类，分类入口排在最后。
- 每次代码合并、功能上线或可见更新，都要在 `site-updates` 分类发布一篇 zh / en / ja 三语真实文章，包含主标题、简介和正文。
- 这条是合并验收门槛，不是可选文档项；如果无法通过后台直接发布，也必须在同一次代码变更里补齐 seed 与 fallback，确认知识库、欢迎弹窗“最近更新”和右上角最新日期都能读到这次更新。
- 首页欢迎弹窗右侧“最近更新”自动读取 `site-updates` 分类文章；“查看更多更新”跳转到知识库并筛选该分类。
- 通过 seed 维护 `site-updates` 时，必须同时更新 `functions/api/[[route]].js` 的 `articleSeedStatements`、`cloudflare/schema.sql` 和 `js/data/content.mjs` 的本地 fallback `content.updates`，避免线上 D1、手动 migration 和 D1 不可用兜底显示不一致。
- 2026-06-11 已清理三篇文章系统测试内容：`xp-site-notes`、`local-ai-workflow`、`fallback-check`；当前保留真实 `site-updates` 更新文章。
- 文章详情前端使用 slug + 请求语言缓存和请求状态保护，避免语言切换或重渲染时重复拉取同一详情并卡在“读取中”。
- 文章正文渲染器支持基础 Markdown、有序/无序列表、blockquote、`text` 代码块蓝色说明框，以及白名单路径 `assets/images/articles/` 下的文章图片；仍必须用 DOM/textContent 构建，不能直接插入未处理 HTML。

公开接口：

- `GET /api/articles?lang=zh`
- `GET /api/articles?lang=en`
- `GET /api/articles?lang=ja`
- `GET /api/articles/:slug?lang=zh`
- `GET /api/articles/:slug?lang=en`
- `GET /api/articles/:slug?lang=ja`
- `GET /api/social-links`

后台接口：

- `GET /api/admin/articles`
- `POST /api/admin/articles`
- `PUT /api/admin/articles/:articleId`
- `DELETE /api/admin/articles/:articleId`

权限：

- `users` 表新增 `role` 字段：`user` / `admin`。
- Pages Functions 的 schema guard 会为旧 `users` 表自动补 `role` 列。
- 只有 `role = admin` 的登录用户可以访问后台文章接口。
- 普通登录用户只能继续使用游戏云存档等原有能力，不能管理文章。
- `/admin/` 后台文章编辑页会一次性保存 zh / en / ja 三种内容，但编辑界面只显示当前选择的语言面板。

Markdown 安全：

- 文章详情第一阶段只支持基础 Markdown。
- 前端详情正文使用 DOM 节点和 `textContent` 构造，不直接把未处理 Markdown/HTML 插入页面。
- 聊天室仍保持纯文本渲染规则不变。

## 管理后台、访问监控与埋点

后台入口：

- 页面：`/admin/`
- 静态文件：`admin/index.html`、`admin/admin.css`、`admin/admin.js`
- 访问拦截：`functions/admin/_middleware.js`
- 权限：复用主站 `lusu_session` HttpOnly cookie 和 `users.role = admin`，非 admin 只能看到后台登录/拒绝页，不能读取后台静态资源或后台 API 数据。
- 后台只使用中文文案；后台项目介绍和后台更新记录保存在后台页面内，其中后台更新记录是独立标签页，不写入主站知识库 `site-updates`，也不对外公开。

后台能力：

- 实时监控大屏：显示今日 PV、UV、周期 PV/UV、今日点击、在线访客、今日聊天数。
- 访问来源：按 Cloudflare `request.cf` 和请求头记录国家、region/省份、城市、colo、时区、经纬度；IP 只保存 hash 和掩码前缀，不保存完整明文 IP。
- 地图界面：后台使用本地 Natural Earth SVG 世界轮廓，根据 Cloudflare 城市级聚合经纬度绘制 SVG 圆点；点位详情只展示城市 / 地区、PV/UV 和最近访问时间，不展示 IP、掩码网络前缀或隐藏访客标识。
- 点击埋点：记录站内按钮、链接、桌面入口、筛选、文章和视频等点击目标，保存路径、route、目标文本、元素标识和屏幕尺寸；目标文本、路径、来源、链接、元素标识和点击聚合键写入前会对邮箱样式文本（含 URL 编码和双重编码形态）脱敏，不记录输入框内容。
- 知识库文章：后台可新建、编辑、发布、删除文章；保存和发布时要求 zh / en / ja 三语标题与正文齐全。
- 视频管理：后台可维护 YouTube / Bilibili / b23.tv 视频和视频分类；服务端解析链接、生成规范化播放器地址，并在后台预览、保存或刷新时抓取标题、简介、作者、发布时间和封面。
- 聊天室管理：后台可查看隐藏访客 ID、client id、IP hash/IP 前缀、来源地；可编辑、隐藏/恢复、删除消息，并按隐藏访客 ID 或 IP hash 禁言。
- 互传文件管理：后台可分页查看当前保存的文件、发送账号、大小、保存 / 过期时间和状态，搜索具体占用项，并永久删除私有 R2 对象及对应 D1 记录。
- 社交链接管理：后台可修改关于我窗口中 X、GitHub、Bilibili、Instagram、Discord 五个图标按钮的跳转地址；配置保存到 `site_runtime_state.about_social_links`，主站只读展示图标入口。
- 后台更新记录：后台私有更新说明独立于“后台说明”，每次后台更新后同步维护页面内记录和 `admin/docs/ADMIN_CHANGELOG.md`。

公开埋点接口：

- `POST /api/analytics/identify`
- `POST /api/analytics/page-view`
- `POST /api/analytics/click`

文章访问埋点：
- `GET /api/articles/:slug` 在成功返回已发布文章详情时，会额外写入 `article_view_events`，按隐藏 `lusu_visitor` 统计单篇文章 PV/UV、语言和来源地理信息；后台热门文章、文章列表和文章详情统计均以该表为准。

后台接口：

- `GET /api/admin/me`
- `GET /api/admin/analytics/overview`
- `GET /api/admin/articles`
- `GET /api/admin/articles/:articleId`
- `POST /api/admin/articles`
- `PUT /api/admin/articles/:articleId`
- `DELETE /api/admin/articles/:articleId`
- `GET /api/admin/chat/messages`
- `PUT /api/admin/chat/messages/:messageId`
- `DELETE /api/admin/chat/messages/:messageId`
- `GET /api/admin/chat/bans`
- `POST /api/admin/chat/bans`
- `DELETE /api/admin/chat/bans/:banId`
- `GET /api/admin/social-links`
- `PUT /api/admin/social-links`

访客 ID 规则：

- `lusu_visitor` 是后台识别用 HttpOnly cookie，前台页面不显示、不通过公开接口返回。
- 聊天室前端仍保留本地 client id 只用于“我的消息”显示；后台禁言和审计使用隐藏 `lusu_visitor` 对应的服务器 visitor_id。
- 即使用户修改聊天室昵称，后台仍可通过隐藏 visitor_id 识别同一访客。

## 账号与云存档

账号系统只服务于游戏自动云存档，不影响普通网站浏览。

前端入口：

- 主站右上角：`#account-widget`
- 登录 UI：`js/main.js`
- 游戏页：显示云存档状态，支持同步和退出

后端位置：

```text
functions/api/[[route]].js
```

相关接口：

- `/api/health`
- `/api/auth/me`
- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/logout`
- `/api/saves/:gameId`
- `/api/articles`
- `/api/articles/:slug`

存档同步逻辑：

- 游戏本体仍然使用浏览器 `localStorage`。
- `games/game-shell.js` 收集 `games/catalog.json` 中声明的 storage keys。
- 登录后进入游戏页，会读取云端存档。
- 如果云端存档比本地已知存档更新，会暂停全部上传并显示可下载本地备份的三语冲突处理窗口。
- 本地有存档时只会携带精确 `expectedUpdatedAt` 上传到 D1；服务端原子条件写入，版本不匹配返回 `SAVE_CONFLICT`。
- 自动同步间隔：30 秒。
- 切出页面时会尝试 flush 游戏自己的保存函数并同步；存在冲突或尚未核对云端版本时不上传。

安全和限制：

- 密码使用 PBKDF2-SHA256 哈希。
- 会话使用 HttpOnly cookie：`lusu_session`。
- 单个游戏存档最大约 1MB。
- 如果后续要支持大量用户或更复杂账号能力，应迁移到更完整的 Auth 方案。

## 匿名聊天室

当前聊天室是 XP 像素风匿名聊天室 MVP：

- 未登录访客可直接发言。
- 首次进入会按近期/已有聊天室昵称分配不重复随机昵称，随机昵称和 visitor_id 保存在 `localStorage`。
- 支持修改昵称，历史消息保留原昵称。
- 前端首次进入加载最近消息，后续保持 `after/message_id` 增量拉取。
- 有新消息时继续 5 秒刷新；无新消息时逐步降到 15 秒和 30 秒；窗口不在前台时降低轮询频率；用户发送消息后立即刷新一次。
- 聊天内容必须纯文本渲染。
- 聊天消息时间在前端按用户所在时区显示；当天消息显示本地时间和时区，旧消息显示本地日期、时间和时区。

前端入口：

- 桌面图标：`data-route="chatroom"`
- 页面：`#chatroom`
- 逻辑：`js/main.js`
- 样式：`css/style.css`

后端接口：

- `GET /api/chat/messages?limit=100`
- `GET /api/chat/messages?after=<message_id>&limit=100`
- `GET /api/chat/nickname`
- `POST /api/chat/messages`

D1 表：`anonymous_chat_messages`

保存字段：

- `message_id`
- `visitor_id`
- `nickname`
- `content`
- `created_at`
- `hidden`
- `ip_hash`

公开聊天室仍不做私聊、图片发送、表情包、WebSocket、在线状态或多聊天室房间；管理能力已放到独立 `/admin/` 后台。

## 游戏区

当前游戏区只保留能在本站直接打开、不跳转外站的本地游戏入口：

- `kittens-game`
- `a-dark-room`
- `2048`
- `hextris`
- `life-restart`

2026-06-11 已删除 `vue-xiuxiangame`、`cultivation-world-simulator`、`XianTu`、`react-xiuxian-game`、`Daoyou`、`freeciv-web`、`OpenTTD` 等外部入口展示；这些项目需要构建链路、后端服务、外部服务器或原生客户端，不适合作为本站静态游戏直接部署。

2026-06-12 已将 `VickScarlet/lifeRestart` 以本地静态游戏形式接入 `games/life-restart/`：
- 上游项目需要先构建，临时源码内使用 `npm.cmd install`、`npm.cmd run xlsx2json`、`npm.cmd run build`；上游推荐 pnpm，但本机无 pnpm 时 npm 可执行同名脚本。
- 构建产物目录为上游 `template/public`，本站仅提交该目录复制后的 `games/life-restart/source/` 以及 `source/LICENSE.txt`。
- 上游 Vite 配置 `base: './'`，可在 Cloudflare Pages 子目录 `/games/life-restart/source/` 下通过相对路径加载资源。
- 语言支持：中文 `zh-cn`、English `en-us`；暂无日本語资源，站点日语界面进入时默认启动 English。
- 上游游戏启动函数读取 query 参数 `language`，不是本站通用的 `lang`；`games/catalog.json` 必须保留 `languageQueryParam: "language"`，否则切换 English 会回落到中文。
- 本地存档键已记录到 `games/catalog.json`：`theme`、`times`、`extendTalent`、`ATLT`、`AEVT`、`ACHV`、`uniqueWaTaShi`。

游戏列表：

- 主站不再使用独立游戏大厅页。
- `js/main.js` 读取 `games/catalog.json` 生成游戏列表。
- 内置游戏使用本站 `games/<game-id>/` 和 `game-shell`；需要后端、构建或外部服务的开源项目先作为外部入口展示。
- 多语言支持较完整的游戏优先排在列表顶部；每张卡片必须显示中文 / English / 日本語支持状态。

游戏页统一使用：

- `games/game-shell.js`
- `games/game-shell.css`

游戏页能力：

- 返回个人站游戏区
- 协议与上游仓库展示
- 本地存档导出
- JSON 存档导入
- 登录后自动云端存档

游戏语言：

- 网站支持中文 / English / 日本語 三语切换。
- 后续新增游戏时，游戏标签或信息里必须标明中文、English、日本語是否支持。
- 网站切换语言时优先展示对应语言。
- 如果游戏不支持当前语言，默认启动英语版本。

## D1 数据表

- `users`
- `sessions`
- `user_login_events`
- `game_saves`
- `anonymous_chat_messages`
- `chat_bans`
- `articles`
- `article_translations`
- `videos`
- `video_categories`
- `video_category_relations`
- `site_runtime_state`（视频分类 seed 标记、关于我社交链接等轻量运行时配置）
- `site_visitors`
- `analytics_page_views`
- `analytics_click_events`
- `article_view_events`

## 主要文件结构

```text
/
├── index.html
├── CHANGELOG.md
├── PROJECT_CONTEXT.md
├── design-qa-mobile-os.md
├── README.md
├── package.json
├── package-lock.json
├── wrangler.jsonc
├── _headers
├── _redirects
├── assets/
├── admin/
│   ├── index.html
│   ├── admin.css
│   ├── admin.js
│   └── docs/
│       ├── ADMIN_PROJECT_CONTEXT.md
│       ├── ADMIN_SKILL.md
│       └── ADMIN_CHANGELOG.md
├── cloudflare/
│   ├── README.md
│   └── schema.sql
├── css/
│   ├── style.css
│   ├── mobile-ios-shell.css
│   └── motion-system.css
├── functions/
│   ├── admin/
│   │   └── _middleware.js
│   └── api/
│       └── [[route]].js
├── games/
│   ├── catalog.json
│   ├── game-shell.css
│   ├── game-shell.js
│   ├── 2048/
│   ├── hextris/
│   ├── kittens-game/
│   ├── a-dark-room/
│   └── life-restart/
│       （新增游戏必须优先本地静态部署，不要只做外部跳转入口）
├── js/
│   ├── main.js
│   ├── mobile-shell.js
│   ├── ui-motion.js
│   └── telemetry.js
└── skills/
    └── lusu-personal-site-skill/
        ├── SKILL.md
        └── README.md
```

## 本地开发方式

安装依赖：

```powershell
npm.cmd install
```

本地初始化 D1：

```powershell
npm.cmd run d1:migrate:local
```

远端执行 D1 schema：

```powershell
npm.cmd run d1:migrate:remote
```

如果需要把当前账号设为管理员，先正常注册/登录账号，再在 D1 中将对应邮箱的用户角色更新为 `admin`：

```powershell
$env:XDG_CONFIG_HOME=(Join-Path (Get-Location) '.wrangler-config')
npx.cmd wrangler d1 execute lusu_personal_site --remote --command "update users set role = 'admin' where email = '你的邮箱'"
```

本地启动 Cloudflare Pages：

```powershell
npm.cmd run dev
```

本地访问：

```text
http://127.0.0.1:8788/index.html
```

健康检查：

```text
/api/health
```

PowerShell 注意：

- PowerShell 可能禁止 `npm.ps1` / `npx.ps1`，优先用 `npm.cmd`、`npx.cmd`。
- 本机 Wrangler 登录临时配置目录可能是 `.wrangler-config/`。
- `.wrangler/`、`.wrangler-config/`、`node_modules/`、`.codex-remote-attachments/` 都是本地生成内容，不得提交。

## 项目专用 Skill 索引

长期维护规则、强约束、踩坑点和每次改动必须检查的事项已拆分到：

```text
skills/lusu-personal-site-skill/SKILL.md
skills/lusu-personal-site-skill/README.md
```

管理后台有单独的专用文档和 Skill。凡是修改 `/admin/` 页面、后台样式、后台脚本、后台权限、后台 API、后台统计、后台视频管理、后台聊天室治理或后台专用文档，必须额外先读取：

```text
admin/docs/ADMIN_PROJECT_CONTEXT.md
admin/docs/ADMIN_SKILL.md
admin/docs/ADMIN_CHANGELOG.md
```

这些后台文档只服务管理后台，不等同于主站 `PROJECT_CONTEXT.md`、根目录 `CHANGELOG.md` 或主站项目 Skill；后台私有更新仍不得写入主站知识库 `site-updates`。

该 Skill 覆盖以下内容：

- 每次修改后必须更新 `CHANGELOG.md`
- 项目信息变化时必须更新 `PROJECT_CONTEXT.md`
- 新增长期注意事项、维护规则、踩坑点时必须同步补充到 Skill
- XP / Pixel Art / Y2K 视觉风格约束
- 中文 / English / 日本語 可见文案维护规则
- 前端和手机端适配检查
- 首页四时段静态像素壁纸和动画接口维护规则
- 聊天室纯文本安全渲染规则
- 只美化不动功能时的改动边界
- Cloudflare Pages Git 自动部署注意事项
- 游戏区新增游戏和游戏语言支持规则
- 双域名缓存、Wrangler、D1 和本地验证踩坑点

## 后续可扩展方向

- 真正文章详情页
- 资源上传与下载管理
- 评论系统
- 搜索功能
- Markdown 内容系统
- Cloudflare R2 文件存储
- 更完善的账号资料页

这些扩展都应优先保持现有 XP / Y2K / 像素桌面风格，不要把网站改成普通现代模板。

## 2026-06-15 视频系统更新

- 视频区已从本地占位卡片改为 D1 驱动的可管理视频系统。
- D1 新增 `videos`、`video_categories`、`video_category_relations`；“全部”分类不入库，由前端自动生成。
- 公开视频接口：
  - `GET /api/videos?lang=zh|en|ja`
  - `GET /api/videos/:videoId?lang=zh|en|ja`
- 后台视频接口：
  - `GET /api/admin/videos`
  - `POST /api/admin/videos`
  - `PUT /api/admin/videos/:videoId`
  - `DELETE /api/admin/videos/:videoId`
  - `POST /api/admin/videos/preview-url`
  - `POST /api/admin/videos/:videoId/refresh-metadata`
- 后台视频分类接口：
  - `GET /api/admin/video-categories`
  - `POST /api/admin/video-categories`
  - `PUT /api/admin/video-categories/:categoryId`
  - `DELETE /api/admin/video-categories/:categoryId`
- 后台“视频管理”和“视频分类管理”模块仍只允许 `users.role = admin` 访问。
- 后端只接受 YouTube / youtu.be / Bilibili / b23.tv 白名单链接，由服务端解析并生成规范化 `embed_url`；前端和后台预览不得直接 iframe 用户输入的任意 URL。
- 视频元数据只在后台预览、首次保存、URL 变化保存或刷新时抓取，并缓存到 D1；已有视频 URL 未变化的普通保存不重新抓取外部元数据，公开视频访问不重新抓取。后台应尽量自动补齐标题、简介、作者、发布时间和封面，Bilibili 抓取遇到 API 风控或 HTTP 412 时使用详情接口、移动页、`__INITIAL_STATE__`、`__NEXT_DATA__`、meta、结构化数据和页面状态备用解析。
- 视频排序规则：置顶视频走独立队列，只要 `pinned = 1` 就一定排在未置顶视频前面；多个置顶视频按 `pinned_sort_order` 从大到小显示，未置顶视频按 `sort_order` 从大到小显示。后台新建视频默认取当前最大普通排序 +10、当前最大置顶排序 +10，方便新视频保持在前面。
- 视频分类排序也使用数值越大越靠前的语义，后台新建分类默认 +10；默认分类 seed 只在全新视频分类表首次创建时初始化，已有表会通过 `site_runtime_state.video_categories_default_seeded` 标记为已处理，不应覆盖或补回后台维护过的 slug、中文名、英文名、日文名、排序、启用状态和已删除分类。
- 公开视频接口必须返回服务端保存的 `original_url`，用于主站“打开原地址”按钮；`embed_url` 只用于站内 iframe 播放，不要把 embed 地址当作原链接展示。
- 主站视频区从 `/api/videos` 读取列表和分类，使用安全 DOM/textContent 渲染，点击后在 XP 风格站内窗口加载 lazy iframe。
- 主站视频卡片必须保持统一尺寸；封面图片要铺满卡片封面区域，缺少封面或封面加载失败时显示同尺寸像素风占位图。
- 主站视频窗口的站内“全屏”语义是 XP 窗口最大化/还原，不要直接对 YouTube / Bilibili iframe 调用浏览器 Fullscreen API；播放器自带全屏由 iframe 内部控件自己处理。
- 跨域 iframe 内部按钮热区无法由父页面精确重写，父页面要用遮罩、透明点击防护区和收窄本站按钮热区来减少默认信息栏和底部空白误触。
- 视频区埋点复用 `js/telemetry.js`，覆盖分类筛选、视频点击、播放器打开和播放失败，不记录后台输入内容。
