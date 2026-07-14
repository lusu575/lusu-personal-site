# Image2 生产复盘（2026-07-14）

## 结论

这次低产出的主要原因不是服务完全不可用，而是 canonical 变动、返工率、非原子落盘和调度空转叠加。暂停时共观察到 45 个本轮 PNG 候选，只有 13 个关卡拥有当前 v4 prompt、Codex review、tool run、源图 SHA、raw SHA 和 sidecar 完整一致的证据链，沉淀率为 28.9%。

恢复时重新审计了中断事务中的 L1-003：原始工具产物、归一化 PNG、Codex review、sidecar 与当前 prompt/style/source hash 全部一致，且 WebP 可确定性复现，因此将 checkpoint 恢复到 14 张。历史暂停统计仍为 45/13；当前发布目标仍是 250 张关卡图加两张背景，严格剩余缺口为 238 张。

本报告和 `checkpoints/2026-07-14/` 只用于保存阶段成果。它们不是 1.0.3 发布证据，不能被运行时引用，也不能绕过 250 关图、两张背景、最终音频、release check 和浏览器回归门槛。

## 直接失败原因

1. 多张候选因答案泄漏、伪文字、额外道具、人物共处或远程拓扑错误被正确拒收。L1-009、L1-011 等难关连续重试，占住了完整生成车道。
2. L1-003 曾通过 PowerShell 5.1 `Get-Content` / `ConvertFrom-Json` 读取日文，产生 mojibake；视觉结果即使可接受也不再是 canonical prompt 产物，必须撤回。
3. IMAGE2 请求出现网络错误和无产物挂起；中断后还有一次源图已复制、review/raw 尚未更新的半完成状态。
4. 生成、视觉审核、复制、改 review 和导入串行执行。合格图生成后，视觉审核中位约 68 秒，审核到导入中位约 73 秒，实际吞吐明显低于工具调用数。
5. 任务编排在 23:24:41～00:41:58 约 77 分钟没有新产物；单图代理完成后等待重新派单、上下文压缩和恢复都造成并发槽空闲。

## 流程性根因

- 在全库 canonical prompt、身份注册表和高风险关卡 addendum 完全冻结前开始大规模生成，后续 v4 重建让早期 review/raw 过期。
- 内置生成调用与 `promptHash` 没有形成可验证的单次原子事务；导入器只按 selector 读取当前 job，无法证明实际传给工具的字符串就是该 job.prompt。
- `generate -> review -> copy -> import` 没有统一事务和恢复日志，中断会留下 stable source、review、raw 三者不同步。
- 难关没有有界重试和退避队列，连续失败会长期占用同一车道；拒绝原因也没有持久化成结构化日志供后续 addendum 汇总。
- 252 张四格同时要求无文字、无答案泄漏、严格 2×2、严格通信拓扑和角色身份一致，首轮命中率本来就低，却没有先用代表性关卡校准后再冻结批量合同。

## 恢复前必须完成

1. 先冻结题库、身份注册表、style bible、全库 prompt 和已知高风险 addendum；冻结后再开始正式生成。
2. 生成调用只能从 Node `fs.readFileSync(..., "utf8")` 取得 job.prompt，并在同一执行单元中验证 `sha256(prompt) === promptHash` 后直接传入工具，禁止人工复制和 PowerShell JSON 往返。
3. 为每次候选写结构化 attempt 日志；一个关卡连续失败达到上限后退回队列尾部，不阻塞其他关卡。
4. 将源图复制、review 写入和 import 组织成可恢复事务；任何一步失败时不得覆盖最后一个完整 checkpoint。
5. 先用本地的 13 张 checkpoint 与少量高风险关卡验证新编排，再恢复大批量生产。

## 已保存成果

- 暂停时保存的 13 张、恢复审计后共 14 张有效关卡图的 960×720 WebP checkpoint 和绑定哈希 manifest。
- 250 关题库、reviewed readings、Image2 v4 jobs、设计身份注册表、Aivis / Image2 管线和回归测试。
- 10,088 件、250 关、约 548.25 MiB 的 Aivis 迁移前候选；远端 `f9bed65e` 已逐项复核 MP3、时间轴、manifest、大小与 SHA-256，缺失、孤儿和不一致均为 0。其 manifest 仍为 `contentVersion: 1.0.2`，最终图片迁移后必须执行跨版本 `--all` reconciliation 和全量验证。
