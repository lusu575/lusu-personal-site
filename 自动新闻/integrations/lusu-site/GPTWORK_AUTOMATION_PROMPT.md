# GPTWork 云端定时任务指令

你正在执行鲁肃个人站的“每日 AI 新闻”云端任务。时区固定为
`Asia/Shanghai`，每天 07:00 开始；报告日期是本次运行开始时的北京
日期，新闻窗口严格为 `[前一日 07:00, 当日 07:00)`。普通自动任务必须
在 08:00 前完成，失败后不得自动转入人工恢复。

本文件对 GPTWork 的运行环境和投递方式具有优先级：
`AUTOMATION_PROMPT.md` 的编辑、覆盖、时间和文章规则全部继续适用，但其中
Windows `npm.cmd`、本机路径、`.dev.vars`、`deliver:production` 和旧生产
POST 步骤不适用于云端任务，禁止执行。发生其他冲突时选择失败关闭并报告。

## 每次运行必须执行

1. 从 GitHub `lusu575/lusu-personal-site` 的默认分支重新读取以下文件，
   在当次临时 Linux 工作区使用默认分支的新 checkout，不依赖上一次任务的
   文件或 Git 状态：
   - `AGENTS.md`
   - `自动新闻/integrations/lusu-site/workflow.json`
   - `自动新闻/integrations/lusu-site/ARTICLE_STYLE.md`
   - `自动新闻/integrations/lusu-site/AUTOMATION_PROMPT.md`
   - `自动新闻/integrations/lusu-site/discovery-queries.json`
2. 使用仓库锁文件准备当次依赖：`uv sync --project 自动新闻 --frozen
   --no-install-project`。不得读取或创建 `.dev.vars`，不得连接 Production
   D1。Linux 采集使用 `自动新闻/.venv/bin/python
   自动新闻/integrations/lusu-site/fetch-with-horizon.py` 加当天 `--date`、
   `--start`、`--end` 参数，不执行只适用于 Windows 的根 npm script。
3. 按固定窗口运行当期 Horizon 采集。required query、required group、
   candidate index、coverage manifest 或来源状态任一不完整时，只允许在
   同一窗口内有界重试；仍不完整则失败关闭。
4. 对 candidate index 的每一项做真实编辑判断，逐项留下 `selected`、
   `merged` 或具体 `rejected`。对全部编辑信号、RSS、受保护类别和
   selected／merged 候选按事件与阶段做可靠来源复核。不得按候选 ID、
   hash、数组位置或轮换模板批量生成分类、分数、理由、证据或首发时间。
5. 只使用事件当前阶段在固定窗口内的官方、一手或可靠直达来源支撑事实
   和时间；Google News、Reddit、Hacker News 与 Bing 只用于发现。
6. 生成中文、英文、日文同事实文章，严格遵守固定标题、三段栏目、事实
   段和短 AI 解读规则。公开正文不得出现网址、来源清单、评分或抓取过程。
7. 使用 Linux `node 自动新闻/integrations/lusu-site/validate-draft.mjs
   --run <本期运行记录>` 验证同一次运行记录。任何覆盖、来源、时间、结构、
   三语、重复或模板化审核门禁失败，都不得签稿或发布；不得执行
   `deliver-production.mjs`。

## 零缓存与发布边界

- 候选、证据、草稿和运行记录只存在于本次 GPTWork 临时空间；
  运行结束后不上传 R2，不写 KV、D1 状态表、Durable Objects 或其他缓存。
- Cloudflare 只允许保留最终文章本身：现有 `articles` 一行与
  `article_translations` 三行。
- 三语公开回读必须由受限 Worker 标识真实跨站来源，使站点的 read-source
  gate 不生成 article-view、visitor profile 或 view-count 写入。
- 不在提示词、文件、日志或回复中读取、保存或展示发布 Token、Cookie、
  Access JWT、环境变量值或授权头。
- 不调用公开只读 `workers/site-mcp` 发布，不直接请求旧的生产 POST，也不
  尝试从历史文件恢复密钥。

只有在以下条件全部满足时，才调用一次已连接的 owner-only
`publish_daily_ai_news` 工具：正式校验成功、当前仍在北京时间
07:00–08:00、报告日期是当天、capability registry 已把 `remote-mcp`
列入 `availableTransports`，而且服务端已生产验收能够验证完整临时运行包，
或验证与报告日期和三语最终内容 hash 绑定的可信短时签名回执。客户端自报
`validated: true`、无签名 hash、提示词承诺或仅有文章结构校验都不算门禁。
工具不可用、需要无法完成的交互确认、返回冲突、响应不明确或公开回读不
一致时，立即停止；不得换 slug、换内容、换幂等方式或再次调用来绕过。

当前仓库中的 owner-only Worker 只适用于每次由站长确认的交互试投，尚未
实现上述可信校验回执，`remote-mcp` 也未标为 available；因此定时任务现
阶段必须生成结果后停止，绝不能自动调用发布工具。完成服务端校验门禁、
Access、部署、连接与定时写验收后，才可由新的仓库提交解除此限制。

成功必须同时满足：工具明确返回 `published`、`readbackVerified: true`，
且中文、英文、日文标题与本次冻结稿一致。否则结果只能报告为未发布，并
附上三语最终稿与具体阻塞；不要声称“已迁移完成”或“已自动上传”。

自动任务永远不得读取或执行 `MANUAL_RECOVERY.md`。当天 08:00 后的恢复
只能由站长在交互会话中明确授权，并继续遵守所有正式门禁。
