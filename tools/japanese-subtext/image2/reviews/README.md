# Image2 Codex 视觉审核记录

这里保存 Codex 对内置 `image_gen.imagegen` 原图执行的逐任务视觉审核证据；它不是人类审核。每个任务一份 JSON：关卡使用小写 ID（例如 `l1-001.json`），背景使用 `background-desktop.json` 或 `background-mobile.json`。

审核文件必须使用诚实状态 `codex-approved`，保留每份记录原有的 Codex reviewer 标识，绑定任务 ID、内置工具运行 ID、原始 PNG SHA-256 和审核时间，并把以下六项全部明确标为 `true`：贴合 prompt、构图符合题面、不泄露答案、无可读伪文字、无水印、宽高比可接受。`jp-subtext:image2:import-builtin` 默认从本目录读取对应文件，将其 canonical SHA-256 写入项目外原图目录的 sidecar；发布器会再次核对。`human-approved` 不得用于 Codex 审核。

审核记录只证明对应 SHA-256 的那一张原图。重新生成后必须新增或更新审核记录，禁止沿用旧图的审核结论。
