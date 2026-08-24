# 鲁肃个人站每日 AI 新闻适配层

这套适配层把 Horizon、Codex 和个人站串成一条正式的每日生产链路：

1. Horizon 是必经数据入口，负责多来源抓取、网址规范化和跨来源去重；不可用时当期停止。
2. Horizon 对可靠来源不设语言限制，并以英文、简体中文、日文、韩文作为常用检索种子，通过多语言主题查询、重点人物／产品／厂商独立查询、豆包中英产品查询、Seed 通用模型与 SeedRealtime／语音专项查询、Seedance 等视频／图像模型专项查询、官方 RSS、中文与海外 AI 媒体 RSS，以及 Reddit、Hacker News 等社区早期发现源形成真实候选，同时输出紧凑标题索引和 coverage manifest v2。
3. Codex 对精确窗口内 candidate index 的每个候选完成一次 `selected`、`merged` 或具体 `rejected` 处置；同时把全部编辑信号、RSS、受保护类别和 selected／merged 候选按事件聚类，完成带可靠直达来源、首次可靠发布时间、事实边界及四项评分理由的证据复核，再做近 30 天事件阶段去重和三语完整文章生成。这项证据复核不受已选条数影响；少于 5 条时还要再做第二轮覆盖审阅，但仍不降低门槛或凑数。
4. 本地校验全部通过后，生产投递脚本在受控通道中公开文章，并且只把接口明确返回 `published` 当作成功。

`ARTICLE_STYLE.md` 是每一期必须遵守的固定格式与文风标准；`AUTOMATION_PROMPT.md` 是交给每日 Codex 任务的完整执行说明。

## 正式时间规则

- 时区固定为 `Asia/Shanghai`。
- 每天 07:00 开始，采集和文章窗口固定为 `[前一日 07:00, 当日 07:00)`。
- 时间资格以事件当前阶段第一次由可靠来源公开的可核对时间为准；聚合器的收录／刷新时间和社区发帖时间不能代替它。
- 抓取、复核、生成、校验、投递和公开允许在同一报告日 07:00 至次日 00:00 完成；08:00 不再是硬截止。
- 任何验证失败、通道异常或内容门禁失败仍会停止本期；不会降级成草稿，也不会跨报告日自动重试。
- 当天自动任务失败后，只有站长在交互任务中明确要求补发时，才可按 `MANUAL_RECOVERY.md` 在当天 07:00 至次日 00:00 使用双确认人工入口；它不是自动任务的无授权重试分支。
- 新闻条数不写死也不设上限；没有 confirmed 候选可以承担要闻时，结果为“今日无稿”。从 2026-08-10 起整期至少 5 条；从 report date 2026-08-17 起传闻栏目不设最低数量，但所有达到相应门槛的独立内容都必须保留。
- 第一轮少于 5 条会触发强制二次覆盖审阅；复查后整期仍不足最低数量时必须 fail closed，不能少发或用低价值内容凑数。传闻少于 5 条本身不再构成失败。

## 固定编辑规则

- 从 2026-08-24 起，已确认新闻继续使用 6 分门槛，传闻使用 5 分门槛；同一事件阶段只写一次，近 30 天无实质进展的不重复。预告、正式发布、权重上线、许可证、技术报告等阶段只有出现实质新事实时才可作为 material update 再写。
- 重大模型或产品发布、能力／可用范围变化、用量规则变化、实用开发者工具更新、可信且显著的价格或额度变化，以及重大芯片／存储／机器人／智能设备／自动驾驶／数据中心基础设施、科技金融和 AI 监管／安全事件，达到对应门槛后必须入选或并入同一事件。已确认新闻仍须可靠直达证据；5 分传闻还须满足“一条可归属的一手公开预告”“一条具名可靠直达报道”或“两条相互独立的可靠直达报道”之一，并在正文使用条件语气。临时促销、纯娱乐和小型维护通常不收录。
- Horizon 会在对应聚焦通道中为上述八类变化标注受保护的 `editorialSignals`。信号不代表必须刊发，但必须进入匹配类别深审，不能统一归成 `other + 4 分`。专用信号按用量规则、价格／额度、重大科技金融、监管／安全、芯片／基础设施的顺序优先；模型、能力和开发工具多信号候选可使用任一实际匹配的受保护类别。`below-importance-threshold` 表示确有实质变化但未达门槛，`no-material-change` 则表示没有实质变化，两者不得混用。
- 每一条写入 candidate index 的候选都必须留下入选、合并或具体拒绝结论；`priority` 只决定审阅先后，不能缩小完整处置范围。这条规则不因来源可选、查询发生截断或本期已经选出 5 条以上而取消。视频、图像和语音模型的重大版本、上线／延期、开放范围、API 与权重变化使用独立多语言聚焦查询，不能只依赖综合模型厂商搜索。
- coverage manifest 新增 `protectedEventReviewPolicy: evidence-backed-protected-events-v1`。每期必须在 `coverageAudit.protectedEventReview` 中恰好覆盖全部编辑信号、RSS、受保护类别和 selected／merged 候选；按 `eventKey + eventStage` 聚类，逐事件保留官方／可靠直达 HTTPS 来源、当前阶段首次可靠发布时间、证据摘要和四项具体评分理由。入选事件必须在窗口内完成可靠核验；找不到证据时如实使用 `insufficient-evidence` 且不得伪填时间。
- 禁止按候选 ID、hash、数组下标或固定轮换模板生成分类、分数、拒绝理由或证据记录。大量拒稿只轮换不超过 8 组评分和不超过 32 种结论模板也会 fail closed；结构字段齐全不能替代逐事件判断。
- TechCrunch AI、VentureBeat AI、Ars Technica AI、雷峰网和 36氪属于可选补充。Reddit 与 Hacker News 只用于早期发现；其标题、评论和发帖时间不能单独支撑正式事实或时间资格，候选必须回到官方、可靠媒体或其他一手来源核验。站长已授权把 Tibo `@thsottiaux` 的 X 帖子纳入选题；链路不再使用会返回同名医疗噪声的 Bing RSS，而是用 required 的 `codex-operations-en` 聚焦查询同时检索 Tibo 姓名、账号及 Codex／ChatGPT Work 运营变化。公开索引返回的 X、媒体和社区候选都进入完整处置范围；这不是完整登录时间线或 X API。
- 正文固定为“今日要闻 / 主要新闻 / 传闻”三段；要闻恰好一条且已经核实，传闻单独放置并使用条件语气。
- 每条新闻是一段事实正文，末尾是一至两句、明显更短的 AI 解读。
- 中文、英文、日文使用同一组事实、栏目和核实状态。
- 对外文章不放网址、链接、来源列表、参考资料、评分或抓取过程；证据只留在内部运行记录。

## 文件说明

- `horizon.config.json`：本站 AI 新闻源配置，不含密钥。TechCrunch AI、VentureBeat AI、Ars Technica AI、雷峰网和 36氪属于可选补充；单源失败不阻断。Reddit、Hacker News 等社区源只用于早期发现，不抓取评论串；它们返回的候选仍须处置，正式新闻和时间资格必须回到规范原帖、可靠媒体或其他一手来源核验。Tibo 由 `discovery-queries.json` 中的 required 聚焦查询覆盖。
  - `discovery-queries.json`：使用 `any-reliable-language` 语言政策，至少提供英文、简体中文、日文、韩文检索种子；宽泛查询只作补充，重点人物、产品运营变化、Thinking Machines／LG AI Research 等开放模型实验室、韩国模型厂商、各家中国模型厂商和主要视频／图像／语音产品使用拆分后的独立 required 查询。韩国开放模型固定拆为 EXAONE 开放、EXAONE 发布、LG 其他、NAVER／HyperCLOVA、Upstage／Solar 五条互补韩文查询，避免跨厂商大查询触发 99+1 截断；字节跳动固定拆为豆包中英产品、Seed 通用模型、SeedRealtime／Seed-ASR／Seed-TTS／全双工语音以及 Seedance／Seedream／Dreamina 创意模型查询。文件不含密钥。
- `fetch-with-horizon.py`：调用 Horizon 原生服务，以受控并发执行发现查询；只传 `--date` 时也固定使用该报告日前一日 07:00 至当日 07:00 的上海时间半开窗口。失败查询最多重试两次，仍失败则与真实空结果分开记录。Google News 查询最多保留 99 条并请求第 100 条作为探针，实际返回第 100 条时判定截断并关闭 required 覆盖；只有 99 条不误报。它还通过共享代理客户端读取 `public-x-profiles.json` 中指定账号的公开主页，将尚未被搜索引擎收录的官方帖纳入候选；解析器兼容当前 `itemID + schema.org meta` 与旧版 `data-tweet-id` 标记，发现未知结构时失败关闭而不是误报空结果。这只是公开索引补充，不声称是登录时间线或 X API。精确窗口内全部候选都会加入 `complete-discovery-review` 必审通道；`priority` 仅控制顺序。候选索引直接写入确定性 UTF-8 字节并据此计算 SHA-256。
- `candidate_index.json`：本次 Horizon 运行生成的紧凑候选索引，只含审阅所需的标题、时间、来源和覆盖归属，不含大段正文。
- `coverage_manifest.json`：schemaVersion 2 的机器可校验清单，记录本次 required query、required group、语言、命中数、结果上限状态、指定 review source 和 review lane。新运行声明 `priorityReviewPolicy: all-discovered-candidates` 与 `protectedEventReviewPolicy: evidence-backed-protected-events-v1`，包含 `complete-discovery-review` 通道，并让兼容字段 `mustReviewCandidateIds` 覆盖 candidate index 的全部候选编号。
- `semantic-editorial-review.py`：对同一 candidate index 做可断点续跑的内容语义审阅；候选 ID 只用于回填关联，不参与分类、评分或拒稿。它会校验索引实际字节 SHA-256，先覆盖全部候选，再按明确 reach／magnitude／practical value／evidence 锚点对编辑信号、RSS 和实际受保护类别进行事件聚类与证据复核。默认使用 32 条候选／8 个事件的紧凑批次与四路受控并发；llama.cpp 使用四个 16K slot 及量化 KV cache，避免完整 30 天去重账本叠加事件输出预算后超过单 slot 上下文而被端点以 HTTP 400 拒绝。30 天历史和本轮已选去重账本保留全部事件身份，但摘要各自截为 120 字，避免后半程账本增长再次挤占输出上下文。同一批内只放一个相同 `eventKey`，让同主题不同阶段即使由模型返回语义 ref 也能无歧义关联，禁止按响应顺序猜测；事件批次连续三次无法给出完整合法结构时，会确定性对半拆分后重新审阅，单事件仍失败则照常 fail closed，不接受残缺输出。每一波使用不可变去重帐本快照，避免线程竞态。正式定时任务不再传 `--automatic-deadline`，不会因 07:50 或 08:00 到时而中止。中断时保留 `semantic_editorial_review.checkpoint.json`，`--restart-event-reviews` 可保留全候选判断并仅重做事件层，全部完成后写 `semantic_editorial_review.json`。默认可连接指定 OpenAI-compatible 语义审阅端点，或在本机配置已审批的 llama.cpp 模型；端点和模型不可用时失败关闭，HTTP 错误会保留有界响应详情供诊断。
- `assemble-semantic-run.mjs`：只接受完整语义审阅台账与已核实的三语编辑事实包，反查全候选处置、事件身份、直达证据、已确认 6 分／传闻 5 分门槛和整期最低数量后生成 schema-v4 `daily_run.json`；传闻不设最低数量。不接受按标题正则或固定评分临时编造的审稿结果。人工终审纠正必须写入事实包的 `eventOverrides`：拒稿带四项低于对应门槛的具体语义理由，同事件同阶段别名则精确 `merged` 到目标事件并合并全部候选来源。
- `workflow.json`：schemaVersion 4 的同报告日 07:00 至次日 00:00 生产时间、完整覆盖审阅、事件阶段去重、成文、fail-closed 与当天人工恢复边界。
- `ARTICLE_STYLE.md`：固定标题、栏目、事实段、AI 解读和传闻标准。
- `AUTOMATION_PROMPT.md`：每日 Codex 任务的完整说明。
- `MANUAL_RECOVERY.md`：仅供站长在交互任务中明确授权的同日报告人工补发说明；自动任务不得使用。
- `validate-draft.mjs`：校验窗口、Horizon 来源、全候选处置、受保护事件证据复核、重要性、三语结构和正文无外链；还会拒绝整批候选被归为 `other`、大量拒稿复制或轮换少量评分／结论模板、聚合页冒充可靠证据、拒稿理由与 `substantiveChange` 矛盾，或低条数二审没有列出必需复查对象的运行。
- `network-fetch.mjs`：正式 Node 外联的统一代理感知客户端；从环境读取 `HTTP_PROXY`／`HTTPS_PROXY`／`NO_PROXY`，兼容 Clash Fake-IP 与无代理直连，且不记录代理值、凭证或投递 Token。
- `deliver-production.mjs`：读取环境或被忽略的根目录 `.dev.vars` 中的令牌；普通模式允许在同一报告日 07:00 至次日 00:00 投递，人工模式还需当天日期与 canonical 稿件 SHA-256 双确认；两者都要求接口确认 `published`，再只读核验 zh / en / ja 三个公开文章接口。单次执行只发送一次 POST；公开 GET 对网络错误和指定瞬时 HTTP 最多尝试三次，正文不匹配、非瞬时状态或预算耗尽立即停止，绝不重发 POST。
- `configure-production-channel.mjs`：一次性生成并安全保存令牌，再通过 Wrangler 远端开启 `enabled + auto_publish`。它不会显示令牌明文。
- `deliver-local.mjs`：一次性本地草稿试投；强制关闭本地 auto-publish，结束后暂停通道并清除临时令牌。
- `runs/`：每次运行的内部核验记录和三语稿件。

schemaVersion 4 的运行记录必须从同一次 `coverage_manifest.json` 原样复制全部 required 编号，并使用生成的 candidate index 摘要：

```json
{
  "horizonRun": {
    "candidatesPath": "data/mcp-runs/<run-id>/daily_candidates.json",
    "candidateIndexPath": "data/mcp-runs/<run-id>/candidate_index.json",
    "coverageManifestPath": "data/mcp-runs/<run-id>/coverage_manifest.json"
  },
  "coverageAudit": {
    "candidateIndexReviewedAt": "<带时区时间>",
    "candidateIndexSha256": "<coverage_manifest.json 中的摘要>",
    "lowVolumeTrigger": 5,
    "signedOffQueryIds": ["<全部 requiredQueryIds>"],
    "signedOffGroupIds": ["<全部 requiredGroupIds>"],
    "priorityReview": {
      "decisions": [
        {
          "candidateId": "<mustReviewCandidateId>",
          "decision": "selected",
          "editorialClass": "major-model-product",
          "substantiveChange": true,
          "score": {
            "reach": 2,
            "magnitude": 2,
            "practicalValue": 2,
            "evidence": 1,
            "total": 7
          },
          "storyKey": "<入选 storyKey>",
          "sourceCandidateIds": ["<支持该故事的 candidate id>"]
        }
      ]
    },
    "protectedEventReview": {
      "policy": "evidence-backed-protected-events-v1",
      "completedAt": "<严格晚于 candidateIndexReviewedAt 的带时区时间>",
      "requiredCandidateIds": ["<全部编辑信号、RSS、受保护类别、selected／merged 候选>"],
      "events": [
        {
          "eventKey": "<规范化事件编号>",
          "eventStage": "release",
          "representativeCandidateId": "<代表候选编号>",
          "candidateIds": ["<同一事件阶段的候选编号>"],
          "disposition": "selected",
          "editorialClass": "major-model-product",
          "substantiveChange": true,
          "score": {
            "reach": 2,
            "magnitude": 2,
            "practicalValue": 2,
            "evidence": 1,
            "total": 7
          },
          "verificationStatus": "verified-in-window",
          "firstReliablePublishedAt": "<事件当前阶段首次可靠发布时间>",
          "reliableSourceUrls": ["<HTTPS 官方或可靠媒体直达页>"],
          "evidenceSummary": "<本事件核验到的事实、阶段与仍有限的边界>",
          "scoreRationale": {
            "reach": "<本事件影响范围的具体理由>",
            "magnitude": "<本事件变化幅度的具体理由>",
            "practicalValue": "<本事件读者价值的具体理由>",
            "evidence": "<本事件证据强度的具体理由>"
          }
        }
      ]
    },
    "secondPass": {
      "required": true,
      "completed": true,
      "completedAt": "<带时区时间>",
      "reconsideredCandidateIds": ["<全部带编辑信号、RSS 或受保护 5/6 分拒稿的候选>"],
      "signedOffQueryIds": ["<再次签收全部 requiredQueryIds>"],
      "signedOffGroupIds": ["<再次签收全部 requiredGroupIds>"]
    }
  }
}
```

新运行的 `priorityReview.decisions` 必须与 manifest 的 `mustReviewCandidateIds` 一一对应，也就是覆盖 candidate index 的每个候选；`priorityReview` 只是保留的 schema 字段名，不代表只审 priority。同一事件的重复来源用 `merged + representativeCandidateId`，不收录时用允许的 `rejectionReason + note`。从 2026-08-13 起，任一受保护编辑类别的实质变化达到 6 分后不能拒绝。候选索引的 `editorialSignals` 会用独立标记覆盖上述八类变化，并把明确的额度／时间窗口变化锁定为 `usage-policy` 或 `material-price-quota`，避免再次用统一 4 分模板淘汰；普通 token、推理内存、模型路由或性能优化不会被误标。未声明 `priorityReviewPolicy: all-discovered-candidates` 的旧 schema-v2 manifest 只作历史兼容，仍按其显式 `mustReviewCandidateIds` 范围校验；新的正式运行必须声明该政策并覆盖全部候选。

2026-08-07 起的新 manifest 必须声明 `protectedEventReviewPolicy: evidence-backed-protected-events-v1`，删除该字段也会直接失败。`protectedEventReview` 是与低条数二审独立的永久门禁：即使已选出 5 条以上，也必须按事件完整覆盖 requiredCandidateIds。`verified-in-window` 与 `verified-outside-window` 必须使用直达 HTTPS 可靠来源和真实首发时间；Google News、Reddit、Hacker News、Bing 只可发现，不能充当证据。无可靠时间时只能用 `insufficient-evidence` 且不填写 `firstReliablePublishedAt`。脚本不得用候选 ID、hash、下标或固定轮换模板代替事件判断。

当首轮入选不少于 5 条时，`secondPass.required` 和 `secondPass.completed` 都写 `false`；少于 5 条时必须按示例再次签收，二审时间必须晚于初审，且 `reconsideredCandidateIds` 必须至少覆盖所有带编辑信号的候选、RSS 候选和受保护类别的 5/6 分拒稿，同时允许加入任意其他索引候选。这里的 5 同时是二审触发线和最终最低数量，但不是目标数或上限。

## 一次性生产通道准备

当前正式站已于 2026-07-28 完成远端 D1 迁移，并启用 `daily-ai-news` 专用通道与 auto-publish；这不是每日命令，不应重复放进定时任务。以后只有轮换凭证或重建环境时，才在站长明确确认后执行：

```powershell
npm.cmd run ai-news:configure:production -- --confirm-production
```

脚本先把待生效令牌保存到已被 Git 忽略的根目录 `.dev.vars`，远端通道配置成功后才把它提升为正式 `DAILY_AI_NEWS_TOKEN`。屏幕只显示尾号和摘要，不显示令牌。该命令会写远端 D1，因此不得放进每日任务，也不得在普通测试中运行。

## 每日正式任务

本机 Codex 已启用任务“每日 AI 新闻：7点生成，当天发布”（ID `ai-7-8`），按电脑当前的北京时间每天 07:00 启动。它是本地任务，不是云端常驻服务；电脑、Codex 和网络必须在任务执行期间保持可用。任务可以在同一报告日 08:00 后继续完成，但不得跨到次日，也不得携带人工恢复参数。

示例中的日期每天由任务按北京时间换算。正式运行记录使用 schemaVersion 4，并引用同一次 Horizon 运行的 `daily_candidates.json`、`candidate_index.json` 与 `coverage_manifest.json`：

```powershell
npm.cmd run ai-news:horizon:fetch -- --date 2026-07-29 --start 2026-07-28T07:00:00+08:00 --end 2026-07-29T07:00:00+08:00
npm.cmd run ai-news:validate -- --run 自动新闻/integrations/lusu-site/runs/2026-07-29.json
npm.cmd run ai-news:deliver:production -- --run 自动新闻/integrations/lusu-site/runs/2026-07-29.json
```

生产投递必须显式提供本期运行记录，拒绝使用默认旧稿。三语标题必须分别采用固定栏目名前缀加各自第一条要闻标题，不能只写日期；日期继续由发布时间和 slug 表达。校验器会要求 coverage manifest 使用 schemaVersion 2，核对 required query 与 required group 是否全部签收、required 查询是否由多取一条探针确认真实截断、candidate index 全部候选是否逐条完成 `priorityReview` 兼容字段中的处置，以及受保护事件证据复核是否完整；入选少于 5 条时，还会额外要求 `coverageAudit.secondPass` 完成。它会再次校验事件当前阶段的首次可靠发布时间、07:00 窗口和当前报告日；只在距离次日 00:00 不足安全余量时停止发起请求。生产 POST 始终只发送一次；接口确认公开后，它会在同一报告日截止前分别读取中文、英文、日文公开文章，核对 slug、分区、语言、标题和正文，并只对网络错误或明确瞬时 HTTP 状态做每语言最多三次的幂等 GET 重试。

## 当天人工故障补发

如果自动任务失败，不能仅凭失败状态自行补发。只有站长在当前 Codex 交互任务中明确要求重新生成并公开当天日报后，才读取并严格执行 `MANUAL_RECOVERY.md`。

人工流程继续使用同一天的固定 `[前一日 07:00, 当日 07:00)` 新闻窗口，并先完成正式 schemaVersion 4 校验。随后先用只读模式输出已经验证的完整稿件指纹：

```powershell
npm.cmd run ai-news:deliver:production -- --run <本期运行记录> --print-run-sha256
```

再同时确认日期和该 64 位小写指纹：

```powershell
npm.cmd run ai-news:deliver:production -- --run <本期运行记录> --manual-recovery --confirm-report-date <YYYY-MM-DD> --confirm-run-sha256 <64位小写SHA-256>
```

人工入口仅在该 `reportDate` 对应的北京时间当天 07:00（含）至次日 00:00（不含）开放，并在午夜前保留同样的请求和公开回读安全余量。它仍先完整执行 `readAndValidateRun`，不会绕过 Horizon 成功态、candidate index、coverage manifest v2、全部候选处置、三语、专用通道、auto-publish、幂等、slug 冲突或公开回读。指纹确认后不得再改稿；状态不明时不得自动再次 POST。

## 历史样稿与本地试投

`runs/2026-07-27-2300.json` 是 schemaVersion 3 的 Horizon 真实抓取历史链路样稿，窗口为北京时间 2026-07-26 23:00 至 2026-07-27 23:00。schemaVersion 3 只为这份历史 one-shot 保留兼容；新的正式每日运行必须使用 schemaVersion 4。历史稿只能显式 one-shot：

```powershell
npm.cmd run ai-news:validate -- --run 自动新闻/integrations/lusu-site/runs/2026-07-27-2300.json --one-shot-history
npm.cmd run ai-news:deliver:local -- --run 自动新闻/integrations/lusu-site/runs/2026-07-27-2300.json --one-shot-history
```

如确需把该历史样稿走生产链路，也必须显式添加 `--one-shot-history`；默认仍要求接口确认 `published`。正式定时任务永远不得带此参数。

Horizon 环境应在启用每日任务前准备好。项目位于中文路径时不要创建 editable 安装记录；依赖环境放在被忽略的 `自动新闻/.venv`。
