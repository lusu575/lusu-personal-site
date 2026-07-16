# “日本語の裏側”1.0.4 / 内容 1.0.3 半成品归档

归档日期：2026-07-16

归档分支：`codex/japanese-subtext-wip-20260716`

本分支用于完整保存当前候选，方便以后继续开发和重新生成图片。它不是发布分支，不得直接合并到 `main`、不得部署到 Cloudflare Pages，也不得把应用 `1.0.4` 或内容 `1.0.3` 标记为已发布。当前线上版本仍是应用 `1.0.3` / 内容 `1.0.2`。

## 已保存内容

- 应用 `1.0.4` / 内容 `1.0.3` 的候选代码、250 关题库、canonical Image2 v4 jobs、prompt、设计身份注册表、生成／导入／迁移／发布脚本及测试。
- 已完成内容改绑的 10,088 个 Aivis MP3 与 250 份时间轴；总时长 `42,533.531` 秒，总计 `518,739,675` 字节。改绑没有修改 MP3 字节。
- 当前候选运行时仍引用的 250 张内容 `1.0.2` legacy illustrations；它们只用于音频优先过渡状态，不代表 Image2 1.0.3 已完成。
- `checkpoints/2026-07-14/image2/` 中 14 张未被运行时引用的 current-v4 WebP 快照。
- `image2/reviews/` 中 62 份 `codex-approved` 审核记录：50 个 L1 关卡、10 个 L2 关卡和 2 张背景；其中 48 份（46 个关卡和 2 张背景）由归档提交 `fc6bb12f` 从清理前工作区救回。这 48 份没有匹配的 current-v4 raw sidecar，不能计入正式发布材料。

审核记录只证明对应旧原始 PNG 在当时通过了六项 Codex 视觉检查，并绑定其 `toolRunId` 和原图 SHA-256；它们不是人工审核，也不能替代原始 PNG、导入 sidecar 或完整发布资产。

## 明确未完成

- 250 张关卡图与桌面／手机两张背景共 252 份 current-v4 资产，只保留了 14 份 checkpoint，仍缺 238 份完整证据资产。
- 项目外的原始 PNG 与 `.image2-state` sidecar 不在 Git 中；仅凭现有 review JSON 不能恢复或发布完整图片包。
- 现有 checkpoint WebP 和 review JSON 仅作为来源、提示词与失败经验的参考，不作为下一轮正式图片包自动导入、复用或发布。
- 正式 Image2 publish/migrate、完整 release check、五视口三语浏览器回归、与最新 `main` 的重新集成及线上部署均未完成。

## 归档时校验快照

- `npm.cmd run jp-subtext:audio:validate:quick` 通过：10,088 个音频 artifact、250 关均有效。
- 62／62 份 review 可解析，状态均为 `codex-approved`，六项检查均为 true，`toolRunId` 与原始图片 SHA-256 均无重复。
- `npm.cmd run jp-subtext:test` 为 131／146 通过、15 个未通过：6 个用例因清理后未恢复本地 `sharp` 依赖而无法加载，另 9 个 canonical prompt 契约用例暴露 Windows 检出中的 CRLF／LF 差异。恢复依赖并统一行尾后必须重新执行全套测试。
- `npm.cmd run jp-subtext:validate:content` 因本地未安装 `sharp` 无法启动；`npm.cmd run build` 按设计拒绝了 legacy illustration manifest、缺失的正式 Image2 资产以及仍为 `PENDING` 的 Image2／浏览器门禁。当前候选没有通过发布门禁。

## 下次继续时

1. 默认按当前锁定题库与 canonical jobs 重新生成完整的 252 张原始图片，不把旧 checkpoint 当作正式发布输入。
2. 每张新图都重新记录新的 `toolRunId`、原始 PNG SHA-256、导入 sidecar 和六项视觉审核；旧 review 不得沿用到不同 SHA 的新图。
3. 完成全部图片后再执行 Image2 import/publish/migrate、`jp-subtext:release-check` 和五视口三语浏览器回归。
4. 发布前从最新 `main` 重新集成并解决版本、更新记录与缓存键差异；只有全部门禁通过后才允许合并和部署。

## Git 恢复点

- 候选基础：`origin/codex/japanese-subtext-v103`，提交 `f582babf`。
- 补存 48 份审核证据：提交 `fc6bb12f`。
- 本文件所在分支是面向后续继续开发的 WIP 归档入口；仓库根目录 `.local-backups/` 与本机配置不属于该归档，也不得提交。
