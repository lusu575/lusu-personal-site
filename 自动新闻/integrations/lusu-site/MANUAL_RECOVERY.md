# 每日 AI 新闻当天人工补发

这是一条独立于每日定时任务的人工故障恢复流程。它只处理“当天自动任务失败后，站长在当前 Codex 交互任务中明确要求重新生成并公开当天日报”的情况。

## 授权边界

- 只有站长在交互任务中给出的明确补发指令才构成授权。仅看到自动任务失败、点击普通重跑、发现 08:00 已过，或推测站长可能希望补发，都不能自行进入人工模式。
- 每日定时任务只能使用普通 `--run` 投递，永远不得自行添加、预填或建议绕过 `--manual-recovery` 及其两个确认参数。
- 人工参数是防止误投日期、错稿和确认后篡改的操作门禁，不是独立的身份凭证；站长的明确交互指令仍是授权来源。
- 人工补发只在稿件 `reportDate` 对应的北京时间当天 08:00（含）至次日 00:00（不含）开放。跨日后必须停止，不能把昨天稿件冒充今天稿件。

## 不会放宽的门禁

- 新闻窗口仍严格是 `[前一日 07:00, 当日 07:00)`，不能改成“补发前 24 小时”。
- 若原 Horizon 抓取、required query、candidate index 或 coverage manifest 不完整，必须针对同一个固定窗口重新运行 Horizon；不得把失败产物签成成功，也不得用手工浏览代替采集。
- 运行记录仍必须是 schemaVersion 4，并通过候选索引原始 UTF-8 SHA-256、coverage manifest v2、required query／group 签收、全部 must-review 处置、低产量二次审阅、事件阶段去重、三语标题／正文和文章格式检查。
- 投递仍使用正式 `daily-ai-news` 专用通道。Bearer 凭证、通道 enabled、显式 auto-publish、限流、slug 冲突、服务端 payload hash 和幂等保护全部不变。
- 只有接口明确返回 `daily-ai-news + published`，且中文、英文、日文三个公开接口的 slug、分区、语言、标题和正文都与已确认稿件一致，才算成功。
- 生产 POST 在单次执行中只发送一次。接口确认 published 后，公开回读可按正式客户端对网络异常和明确瞬时 HTTP 做每语言最多三次、受当日截止约束的只读 GET；正文不一致、非瞬时状态或有界尝试耗尽时立即停止，不自动再次 POST。再次投递尝试必须重新取得站长明确指令，并复用同一份稿件和幂等键；不能凭猜测换键绕过冲突。

## 执行顺序

1. 确认站长明确要求补发的北京时间日期。
2. 对该日期的固定窗口重新完成或接续 Horizon、覆盖审阅、三语成稿，并执行正式校验：

   ```powershell
   npm.cmd run ai-news:validate -- --run <本期运行记录>
   ```

3. 使用只读参数再次加载并完整验证运行记录，再输出这份 JSON 对象的 canonical SHA-256：

   ```powershell
   npm.cmd run ai-news:deliver:production -- --run <本期运行记录> --print-run-sha256
   ```

4. 把站长确认的 `reportDate` 和上一步得到的 64 位小写 SHA-256 同时交给人工补发入口：

   ```powershell
   npm.cmd run ai-news:deliver:production -- --run <本期运行记录> --manual-recovery --confirm-report-date <YYYY-MM-DD> --confirm-run-sha256 <64位小写SHA-256>
   ```

5. 在投递前不得再修改运行记录。任何字段变化都会让完整稿件指纹失效，必须重新验证、重新计算并在站长授权范围内重新确认。

普通自动任务仍以 08:00 为硬截止；本文件不会赋予自动任务迟到补发权限。
