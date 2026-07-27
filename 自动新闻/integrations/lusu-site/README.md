# 鲁肃个人站每日 AI 新闻适配层

这套适配层把 Horizon、Codex 和个人站串成一条正式的每日生产链路：

1. Horizon 是必经数据入口，负责多来源抓取、网址规范化和跨来源去重；不可用时当期停止。
2. Codex 读取真实候选，完成人工编辑标准的一手复核、重要性判断、近 30 天去重和三语完整文章生成。
3. 本地校验全部通过后，生产投递脚本在受控通道中公开文章，并且只把接口明确返回 `published` 当作成功。

`ARTICLE_STYLE.md` 是每一期必须遵守的固定格式与文风标准；`AUTOMATION_PROMPT.md` 是交给每日 Codex 任务的完整执行说明。

## 正式时间规则

- 时区固定为 `Asia/Shanghai`。
- 每天 07:00 开始，采集和文章窗口固定为 `[前一日 07:00, 当日 07:00)`。
- 抓取、复核、生成、校验、投递和公开必须在 08:00 前完成。
- 08:00 是硬截止。任何验证失败、通道异常或超时都会停止本期；不迟到补发、不降级成草稿、不自动跨截止重试。
- 新闻条数不写死；没有 confirmed 候选可以承担要闻时，结果为“今日无稿”。

## 固定编辑规则

- 重要性低于 7 分的不写；同一事件只写一次，近 30 天无实质进展的不重复。
- 正文固定为“今日要闻 / 主要新闻 / 传闻”三段；要闻恰好一条且已经核实，传闻单独放置并使用条件语气。
- 每条新闻是一段事实正文，末尾是一至两句、明显更短的 AI 解读。
- 中文、英文、日文使用同一组事实、栏目和核实状态。
- 对外文章不放网址、链接、来源列表、参考资料、评分或抓取过程；证据只留在内部运行记录。

## 文件说明

- `horizon.config.json`：本站 AI 新闻源配置，不含密钥。
- `fetch-with-horizon.py`：调用 Horizon 原生服务并按精确 24 小时窗口输出候选。
- `workflow.json`：07:00—08:00 的生产时间、筛选、成文和 fail-closed 约定。
- `ARTICLE_STYLE.md`：固定标题、栏目、事实段、AI 解读和传闻标准。
- `AUTOMATION_PROMPT.md`：每日 Codex 任务的完整说明。
- `validate-draft.mjs`：校验窗口、Horizon 来源、去重、重要性、三语结构和正文无外链。
- `deliver-production.mjs`：读取环境或被忽略的根目录 `.dev.vars` 中的令牌；只在安全时窗投递，要求接口确认 `published`，再只读核验 zh / en / ja 三个公开文章接口。
- `configure-production-channel.mjs`：一次性生成并安全保存令牌，再通过 Wrangler 远端开启 `enabled + auto_publish`。它不会显示令牌明文。
- `deliver-local.mjs`：一次性本地草稿试投；强制关闭本地 auto-publish，结束后暂停通道并清除临时令牌。
- `runs/`：每次运行的内部核验记录和三语稿件。

## 上线前的一次性通道准备

网站后端部署完成后，由站长明确确认再单独执行：

```powershell
npm.cmd run ai-news:configure:production -- --confirm-production
```

脚本先把待生效令牌保存到已被 Git 忽略的根目录 `.dev.vars`，远端通道配置成功后才把它提升为正式 `DAILY_AI_NEWS_TOKEN`。屏幕只显示尾号和摘要，不显示令牌。该命令会写远端 D1，因此不得放进每日任务，也不得在普通测试中运行。

## 每日正式任务

示例中的日期每天由任务按北京时间换算：

```powershell
npm.cmd run ai-news:horizon:fetch -- --date 2026-07-29 --start 2026-07-28T07:00:00+08:00 --end 2026-07-29T07:00:00+08:00
npm.cmd run ai-news:validate -- --run 自动新闻/integrations/lusu-site/runs/2026-07-29.json
npm.cmd run ai-news:deliver:production -- --run 自动新闻/integrations/lusu-site/runs/2026-07-29.json
```

生产投递必须显式提供本期运行记录，拒绝使用默认旧稿。它会再次校验日期、07:00 窗口和当前时间；距离 08:00 不足安全余量时不再发起请求。接口确认公开后，它还会在截止前分别读取中文、英文、日文公开文章，核对 slug、分区、语言、标题和正文。投递和公开核验都没有自动重试，避免一次不明确的响应造成重复公开。

## 历史样稿与本地试投

`runs/2026-07-27-2300.json` 是 Horizon 真实抓取的历史链路样稿，窗口为北京时间 2026-07-26 23:00 至 2026-07-27 23:00。它不是正式每日窗口，只能显式 one-shot：

```powershell
npm.cmd run ai-news:validate -- --run 自动新闻/integrations/lusu-site/runs/2026-07-27-2300.json --one-shot-history
npm.cmd run ai-news:deliver:local -- --run 自动新闻/integrations/lusu-site/runs/2026-07-27-2300.json --one-shot-history
```

如确需把该历史样稿走生产链路，也必须显式添加 `--one-shot-history`；默认仍要求接口确认 `published`。正式定时任务永远不得带此参数。

Horizon 环境应在启用每日任务前准备好。项目位于中文路径时不要创建 editable 安装记录；依赖环境放在被忽略的 `自动新闻/.venv`。
