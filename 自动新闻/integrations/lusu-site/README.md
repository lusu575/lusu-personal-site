# 鲁肃个人站每日 AI 新闻适配层

这套适配层把 Horizon、Codex 和个人站串成一条正式的每日生产链路：

1. Horizon 是必经数据入口，负责多来源抓取、网址规范化和跨来源去重；不可用时当期停止。
2. Horizon 对可靠来源不设语言限制，并以英文、简体中文、日文、韩文作为常用检索种子，通过多语言主题查询、重点人物／产品／厂商独立查询、Seedance 等视频／图像／语音模型专项查询、官方 RSS、中文与海外 AI 媒体 RSS，以及 Reddit、Hacker News 等社区早期发现源形成真实候选，同时输出紧凑标题索引和 coverage manifest v2。
3. Codex 对精确窗口内 candidate index 的每个候选完成一次 `selected`、`merged` 或具体 `rejected` 处置，再做可靠来源复核、重要性判断、近 30 天事件阶段去重和三语完整文章生成。少于 5 条时必须做第二轮覆盖审阅，但仍不降低门槛或凑数。
4. 本地校验全部通过后，生产投递脚本在受控通道中公开文章，并且只把接口明确返回 `published` 当作成功。

`ARTICLE_STYLE.md` 是每一期必须遵守的固定格式与文风标准；`AUTOMATION_PROMPT.md` 是交给每日 Codex 任务的完整执行说明。

## 正式时间规则

- 时区固定为 `Asia/Shanghai`。
- 每天 07:00 开始，采集和文章窗口固定为 `[前一日 07:00, 当日 07:00)`。
- 时间资格以事件当前阶段第一次由可靠来源公开的可核对时间为准；聚合器的收录／刷新时间和社区发帖时间不能代替它。
- 抓取、复核、生成、校验、投递和公开必须在 08:00 前完成。
- 对自动任务，08:00 是硬截止。任何验证失败、通道异常或超时都会停止本期；不迟到补发、不降级成草稿、不自动跨截止重试。
- 当天自动任务失败后，只有站长在交互任务中明确要求补发时，才可按 `MANUAL_RECOVERY.md` 在当天 08:00 至次日 00:00 使用双确认人工入口；它不是自动任务的降级或重试分支。
- 新闻条数不写死；没有 confirmed 候选可以承担要闻时，结果为“今日无稿”。
- 第一轮少于 5 条不是最低刊发数量，而是强制二次覆盖审阅触发器；复查后仍只有少量高价值消息时可以少发。

## 固定编辑规则

- 重要性低于 7 分的不写；同一事件阶段只写一次，近 30 天无实质进展的不重复。预告、正式发布、权重上线、许可证、技术报告等阶段只有出现实质新事实时才可作为 material update 再写。
- 重大模型或产品发布、能力／可用范围变化、用量规则变化、实用开发者工具更新，以及可信且显著的价格或额度变化，都按读者实际可用性使用同一 7 分门槛；达到门槛后必须入选或并入同一事件，不能仅以“产品型”或“受众较窄”为由排除。临时促销、纯娱乐和小型维护通常不收录。
- 每一条写入 candidate index 的候选都必须留下入选、合并或具体拒绝结论；`priority` 只决定审阅先后，不能缩小完整处置范围。这条规则不因来源可选、查询发生截断或本期已经选出 5 条以上而取消。视频、图像和语音模型的重大版本、上线／延期、开放范围、API 与权重变化使用独立多语言聚焦查询，不能只依赖综合模型厂商搜索。
- TechCrunch AI、VentureBeat AI、Ars Technica AI、雷峰网和 36氪属于可选补充。Reddit 与 Hacker News 只用于早期发现；其标题、评论和发帖时间不能单独支撑正式事实或时间资格，候选必须回到官方、可靠媒体或其他一手来源核验。站长已授权把 Tibo `@thsottiaux` 的 X 帖子纳入选题；链路不再使用会返回同名医疗噪声的 Bing RSS，而是用 required 的 `codex-operations-en` 聚焦查询同时检索 Tibo 姓名、账号及 Codex／ChatGPT Work 运营变化。公开索引返回的 X、媒体和社区候选都进入完整处置范围；这不是完整登录时间线或 X API。
- 正文固定为“今日要闻 / 主要新闻 / 传闻”三段；要闻恰好一条且已经核实，传闻单独放置并使用条件语气。
- 每条新闻是一段事实正文，末尾是一至两句、明显更短的 AI 解读。
- 中文、英文、日文使用同一组事实、栏目和核实状态。
- 对外文章不放网址、链接、来源列表、参考资料、评分或抓取过程；证据只留在内部运行记录。

## 文件说明

- `horizon.config.json`：本站 AI 新闻源配置，不含密钥。TechCrunch AI、VentureBeat AI、Ars Technica AI、雷峰网和 36氪属于可选补充；单源失败不阻断。Reddit、Hacker News 等社区源只用于早期发现，不抓取评论串；它们返回的候选仍须处置，正式新闻和时间资格必须回到规范原帖、可靠媒体或其他一手来源核验。Tibo 由 `discovery-queries.json` 中的 required 聚焦查询覆盖。
  - `discovery-queries.json`：使用 `any-reliable-language` 语言政策，至少提供英文、简体中文、日文、韩文检索种子；宽泛查询只作补充，重点人物、产品运营变化、Thinking Machines／LG AI Research 等开放模型实验室、韩国模型厂商、各家中国模型厂商和主要视频／图像／语音产品使用拆分后的独立 required 查询。韩国开放模型固定拆为 EXAONE 开放、EXAONE 发布、LG 其他、NAVER／HyperCLOVA、Upstage／Solar 五条互补韩文查询，避免跨厂商大查询触发 99+1 截断；Seedance 等多模态产品必须覆盖发布、延期、API、权重和可用范围等不同事件阶段。文件不含密钥。
- `fetch-with-horizon.py`：调用 Horizon 原生服务，以受控并发执行发现查询；失败查询最多重试两次，仍失败则与真实空结果分开记录。Google News 查询最多保留 99 条并请求第 100 条作为探针，实际返回第 100 条时判定截断并关闭 required 覆盖；只有 99 条不误报。精确窗口内全部候选都会加入 `complete-discovery-review` 必审通道；`priority` 仅控制顺序。候选索引直接写入确定性 UTF-8 字节并据此计算 SHA-256。
- `candidate_index.json`：本次 Horizon 运行生成的紧凑候选索引，只含审阅所需的标题、时间、来源和覆盖归属，不含大段正文。
- `coverage_manifest.json`：schemaVersion 2 的机器可校验清单，记录本次 required query、required group、语言、命中数、结果上限状态、指定 review source 和 review lane。新运行声明 `priorityReviewPolicy: all-discovered-candidates`，包含 `complete-discovery-review` 通道，并让兼容字段 `mustReviewCandidateIds` 覆盖 candidate index 的全部候选编号。
- `workflow.json`：schemaVersion 4 的 07:00—08:00 自动生产时间、完整覆盖审阅、事件阶段去重、成文、fail-closed 与当天人工恢复边界。
- `ARTICLE_STYLE.md`：固定标题、栏目、事实段、AI 解读和传闻标准。
- `AUTOMATION_PROMPT.md`：每日 Codex 任务的完整说明。
- `MANUAL_RECOVERY.md`：仅供站长在交互任务中明确授权的当天 08:00 后人工补发说明；自动任务不得使用。
- `validate-draft.mjs`：校验窗口、Horizon 来源、重点候选处置、重要性、三语结构和正文无外链；时间与事件阶段去重规则保持原契约。
- `deliver-production.mjs`：读取环境或被忽略的根目录 `.dev.vars` 中的令牌；普通模式只在 07:00—08:00 投递，人工模式还需当天日期与 canonical 稿件 SHA-256 双确认；两者都要求接口确认 `published`，再只读核验 zh / en / ja 三个公开文章接口。
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
    "secondPass": {
      "required": true,
      "completed": true,
      "completedAt": "<带时区时间>",
      "signedOffQueryIds": ["<再次签收全部 requiredQueryIds>"],
      "signedOffGroupIds": ["<再次签收全部 requiredGroupIds>"]
    }
  }
}
```

新运行的 `priorityReview.decisions` 必须与 manifest 的 `mustReviewCandidateIds` 一一对应，也就是覆盖 candidate index 的每个候选；`priorityReview` 只是保留的 schema 字段名，不代表只审 priority。同一事件的重复来源用 `merged + representativeCandidateId`，不收录时用允许的 `rejectionReason + note`。重大模型／产品、能力／可用性、用量规则、开发工具或显著价格额度变化达到 7 分后不能拒绝。候选索引的 `editorialSignals` 会把明确的额度／时间窗口变化锁定为 `usage-policy` 或 `material-price-quota`，避免再次用统一 4 分模板淘汰；普通 token、推理内存、模型路由或性能优化不会被误标。未声明 `priorityReviewPolicy: all-discovered-candidates` 的旧 schema-v2 manifest 只作历史兼容，仍按其显式 `mustReviewCandidateIds` 范围校验；新的正式运行必须声明该政策并覆盖全部候选。

当入选不少于 5 条时，`secondPass.required` 和 `secondPass.completed` 都写 `false`；少于 5 条时必须按示例再次签收。这里的 5 只控制复查，不控制最终刊发数量。

## 一次性生产通道准备

当前正式站已于 2026-07-28 完成远端 D1 迁移，并启用 `daily-ai-news` 专用通道与 auto-publish；这不是每日命令，不应重复放进定时任务。以后只有轮换凭证或重建环境时，才在站长明确确认后执行：

```powershell
npm.cmd run ai-news:configure:production -- --confirm-production
```

脚本先把待生效令牌保存到已被 Git 忽略的根目录 `.dev.vars`，远端通道配置成功后才把它提升为正式 `DAILY_AI_NEWS_TOKEN`。屏幕只显示尾号和摘要，不显示令牌。该命令会写远端 D1，因此不得放进每日任务，也不得在普通测试中运行。

## 每日正式任务

本机 Codex 已启用任务“每日 AI 新闻：7点生成，8点前发布”（ID `ai-7-8`），按电脑当前的北京时间每天 07:00 启动。它是本地任务，不是云端常驻服务；电脑、Codex 和网络必须在 07:00–08:00 保持可用，休眠、关机或断网会让当期按失败关闭规则停止。自动任务自身不在 08:00 后补发，也不得携带人工恢复参数。

示例中的日期每天由任务按北京时间换算。正式运行记录使用 schemaVersion 4，并引用同一次 Horizon 运行的 `daily_candidates.json`、`candidate_index.json` 与 `coverage_manifest.json`：

```powershell
npm.cmd run ai-news:horizon:fetch -- --date 2026-07-29 --start 2026-07-28T07:00:00+08:00 --end 2026-07-29T07:00:00+08:00
npm.cmd run ai-news:validate -- --run 自动新闻/integrations/lusu-site/runs/2026-07-29.json
npm.cmd run ai-news:deliver:production -- --run 自动新闻/integrations/lusu-site/runs/2026-07-29.json
```

生产投递必须显式提供本期运行记录，拒绝使用默认旧稿。三语标题必须分别采用固定栏目名前缀加各自第一条要闻标题，不能只写日期；日期继续由发布时间和 slug 表达。校验器会要求 coverage manifest 使用 schemaVersion 2，核对 required query 与 required group 是否全部签收、required 查询是否由多取一条探针确认真实截断，以及 candidate index 全部候选是否逐条完成 `priorityReview` 兼容字段中的处置；入选少于 5 条时，还会要求 `coverageAudit.secondPass` 完成。它会再次校验事件当前阶段的首次可靠发布时间、07:00 窗口和当前时间；距离 08:00 不足安全余量时不再发起请求。接口确认公开后，它还会在截止前分别读取中文、英文、日文公开文章，核对 slug、分区、语言、标题和正文。投递和公开核验都没有自动重试，避免一次不明确的响应造成重复公开。

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

人工入口仅在该 `reportDate` 对应的北京时间当天 08:00（含）至次日 00:00（不含）开放，并在午夜前保留同样的请求和公开回读安全余量。它仍先完整执行 `readAndValidateRun`，不会绕过 Horizon 成功态、candidate index、coverage manifest v2、全部候选处置、三语、专用通道、auto-publish、幂等、slug 冲突或公开回读。指纹确认后不得再改稿；状态不明时不得自动再次 POST。

## 历史样稿与本地试投

`runs/2026-07-27-2300.json` 是 schemaVersion 3 的 Horizon 真实抓取历史链路样稿，窗口为北京时间 2026-07-26 23:00 至 2026-07-27 23:00。schemaVersion 3 只为这份历史 one-shot 保留兼容；新的正式每日运行必须使用 schemaVersion 4。历史稿只能显式 one-shot：

```powershell
npm.cmd run ai-news:validate -- --run 自动新闻/integrations/lusu-site/runs/2026-07-27-2300.json --one-shot-history
npm.cmd run ai-news:deliver:local -- --run 自动新闻/integrations/lusu-site/runs/2026-07-27-2300.json --one-shot-history
```

如确需把该历史样稿走生产链路，也必须显式添加 `--one-shot-history`；默认仍要求接口确认 `published`。正式定时任务永远不得带此参数。

Horizon 环境应在启用每日任务前准备好。项目位于中文路径时不要创建 editable 安装记录；依赖环境放在被忽略的 `自动新闻/.venv`。
