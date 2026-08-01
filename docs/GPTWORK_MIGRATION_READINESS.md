# GPTWork 云端开发迁移就绪报告

审查日期：2026-07-15

审查基线：`origin/main` 提交 `c8c20870c5c7ece11701b03470c9d53b0c8a4844`

准备分支：`codex/gptwork-migration-prep`

本报告评估“从 GitHub 克隆后在 GPTWork 继续开发”的可复现性。审查和验证没有访问生产 D1、上传本地文件、写入真实 Secret、执行远程数据库迁移或手工部署 Cloudflare Pages。

## 一、迁移结论

- 是否适合迁移：适合，但应先审查并合并本准备分支，并在 GPTWork / Cloudflare 配好环境绑定。
- 本地是否与 `origin/main` 一致：原工作区不一致；迁移准备分支直接基于审查时的 `origin/main` 创建，未合入原工作区的旧训练器产物。
- 风险等级：中。代码、锁文件、本地 D1 初始化、测试、构建和启动说明已可复现；主要剩余风险是 Cloudflare Preview / Production 的人工绑定，以及约 400 MiB checkout、约 1.45 GiB Git pack 在 GPTWork 的真实克隆时间和配额尚未实测。

## 二、Git 差异

2026-07-15 已成功执行 `git fetch origin`，没有执行 `git pull`、merge、rebase、reset 或 checkout 清理。

| 检查项 | 原工作区结果 | 处理结果 |
| --- | --- | --- |
| 当前分支 | `feature/japanese-subtext-trainer` | 保持不动；迁移改动位于 `codex/gptwork-migration-prep` |
| 当前提交 | `1bf58b60d824f58c4b1a1b1406d74e324974bddb` | 准备分支基于 `origin/main` 的 `c8c20870…` |
| 工作区是否干净 | 否 | 原样保留 |
| 未暂存修改 | 25 个 tracked 文件 | 未复制到准备分支 |
| 已暂存未提交 | 0 | 无需处理 |
| 未跟踪文件 | 10,455 个，主要为旧版日语训练器生成物和本机输出 | 不提交；更新版本已在远端或属于可再生成本地产物 |
| 本地已提交但未推送 | 相对 `origin/main` 为 0 | 无需迁移独有提交 |
| 本地缺少远程提交 | 8 个 | 准备分支直接基于 `origin/main`，不在脏工作区 pull |
| 文件内容是否完全一致 | 否 | 迁移以当前 GitHub `main` 为业务基线 |

重要差异是原工作区保留旧训练器修改、生成音频 / 图片 / 报告与本机状态，而 `origin/main` 已包含更新后的训练器业务版本。逐项审查未发现只存在于原工作区、必须合并的唯一业务源代码。

## 三、仅存在于本地的内容

| 文件或资源 | 用途 | 迁移处理建议 |
| --- | --- | --- |
| `output/` | 本地生成的报告、文档和临时交付物 | 不进入公开仓库；有保留价值时另做私密备份 |
| `.wrangler/`、`.wrangler-config/` | Wrangler 本地 D1、缓存和预览状态 | 不迁移；GPTWork 用 `cloudflare/schema.sql` 重建本地 D1 |
| `tools/japanese-subtext/config/tts.local.json` | 本机 TTS 路径和私密生成配置 | 不提交；只在获授权的语音生成环境单独配置 |
| 本机模型、参考声线、音频生成缓存 | 离线生成日语训练器语音 | 不属于普通站点运行条件；按许可和安全要求单独保管 |
| `node_modules/` | 可再生成依赖 | 不迁移；克隆后执行 `npm ci` |
| `design-qa.md` 引用的 `output/playwright/` 历史截图 | 过去 UI 验收证据 | 文件被 Git 忽略、GPTWork 不保证可获得；不影响运行，需保留时另做私密归档 |

仓库文档中的本机固定盘符示例已改为当前 checkout 相对写法；测试中仍保留一个故意用于“本机路径泄露检测”的假 `F:\private\model.onnx` fixture，它不会被业务代码使用。未发现当前仓库业务代码依赖未跟踪源代码、本机绝对路径、本地图片 / 字体、用户上传目录或本地数据库副本才能启动。普通 GPTWork 开发无需本机 Python、Kokoro、ffmpeg、模型、参考声线或生产数据库。

## 四、敏感信息风险

- `.env` 未被 Git 跟踪；当前 tracked files 中没有 `.env`、`.dev.vars`、私钥文件或识别到的常见真实凭据形态。
- `.gitignore` 已覆盖 `.env` / `.env.*`、`.dev.vars` / `.dev.vars.*`、私钥扩展名、`output/`、Wrangler 状态和依赖目录，并单独允许空值模板 `.env.example`。
- `.env.example` 只包含变量名称和说明，不包含可用值。
- API 的聊天 / 分析 IP 标识使用用途隔离 HMAC-SHA256。两个 Secret 缺少、短于 32 UTF-8 字节或完全相同时，API router 会在任何 API 业务 D1 访问前返回通用 503；日志只记录变量名称，不记录值、请求 IP 或 hash。
- 聊天消息和网络来源禁言保存非敏感密钥代次。Secret 轮换后，旧消息只能审计、不能新建网络来源禁言，旧禁言明确标记失效；服务端按消息编号读取当前目标，不信任前端提交的 hash。
- 现有分析 / 聊天数据仍保存掩码后的 `ip_prefix`（IPv4 `/24` 或 IPv6 `/64`）和 Cloudflare 地理字段。它不是完整明文 IP，但也不等于完全匿名，后续仍应单独评估后台可见范围和保留周期。
- Git 历史扫描在提交 `9297922c0a75…` 的已删除测试文件中发现 4 个 OpenAI key 形态的测试字面量：`tools/japanese-subtext/tests/image2-generation-runner.test.mjs` 第 202 行变量 `apiKey`、第 207 行 `key`、第 214 行 `secret`，以及 `tools/japanese-subtext/tests/image2-pipeline.test.mjs` 第 496 行 `debugToken`。前三处为同一脱敏测试 fixture，第四处为另一调试测试值；文件已删除，未见业务使用证据，评为低风险历史误报。若仓库所有者确认是真实值，仍应在对应平台立即轮换。本报告不展示任何完整值。

需要在 GPTWork / Cloudflare 单独配置的 Secrets 名称：

- `CHAT_IP_HASH_SALT`
- `ANALYTICS_IP_HASH_SALT`

普通 GPTWork 开发不需要 `CLOUDFLARE_API_TOKEN`、GitHub 写权限或生产 D1 凭据。

## 五、GPTWork 云端运行条件

已具备：

- 根 `README.md`、`AGENTS.md`、`PROJECT_CONTEXT.md`、项目专用 Skill 和本报告。
- `package-lock.json` lockfile v3；Wrangler 固定为 `4.118.0`，兼容 Node 22，并已替换 npm 审计发现的旧版高风险传递依赖；直接图像依赖固定为 `sharp 0.35.3`。
- `.nvmrc` 锁定 Node 22 主版本，`package.json#engines` 要求 Node.js 22.13+。
- `.env.example` 列出全部普通运行时 Secret 名称。
- 明确的安装、测试、构建、本地 D1 初始化和开发命令。
- `wrangler.jsonc` 中的 Pages、D1 `DB` binding、本地 preview database 和 required secrets 声明。
- Pull Request / `main` 的最小 GitHub Actions 验证，执行 `npm ci`、本地 D1 空库初始化、`npm test` 和 `npm run build`，不接触生产环境。

GPTWork 启动方式：先把两个名称配置为平台 Secrets / process environment，再执行以下命令；不要复制空 `.env.example` 为 `.dev.vars`，否则可能遮蔽平台注入值。

```bash
npm ci
npm run d1:migrate:local
npm test
npm run build
npm run dev
```

纯本地开发才复制 `.env.example` 为被忽略的 `.dev.vars` 并填入两个不同的随机值。Cloudflare Preview 和 Production 仍需分别确认 D1 binding `DB`，并分别配置两个不同、随机、至少 32 字节的 Secret。

外部服务依赖：普通安装、测试、构建、`/api/health` 和站点启动只依赖仓库、Node/npm、本地 D1 与上述 Secrets。后台视频链接预览、首次保存或刷新元数据会访问 YouTube / Bilibili，网络受限时该管理功能可能降级或失败；离线语音再生成才需要 Python、Kokoro、ffmpeg、模型和参考声线。

仓库规模风险：当前 HEAD 有 11,502 个 tracked files，checkout 约 399.9 MiB，Git pack 约 1.45 GiB，没有单文件超过 50 MiB。本次隔离 worktree 与父仓库共享 Git object database，因此只证明了依赖安装与运行流程，没有证明 GPTWork 的真实网络 clone 耗时、存储配额和超时限制；首次迁移必须在 GPTWork 实测。

## 六、验证结果

| 项目 | 结果 |
| --- | --- |
| lint | 未配置；未添加伪命令 |
| typecheck | 未配置；项目当前为原生 JavaScript，没有独立类型检查工具链 |
| test | 已通过：59 项测试，0 失败；覆盖运行时 Secret、聊天 / 分析 HMAC 行为、哈希代次禁言、源码凭据形态，以及 D1 空库、旧表补列和幂等回归 |
| build | 已通过：`build-check: ok` |
| 本地 D1 | 基础 Wrangler 路径已执行 196 条 schema 命令；旧库缺列的 `ALTER TABLE` 分支已用带历史消息和禁言记录的内存 SQLite 回归覆盖，验证 `legacy` 默认值、数据保留、复合索引与重复执行；完整 Wrangler 兼容脚本由 Node 22 CI 在 fresh local D1 上端到端确认 |
| 依赖安装 | 已通过：隔离 worktree 无本地 `node_modules` 后执行 `npm ci` 成功；这不等同于真实网络 clone 验证 |
| HTTP smoke | 已通过：首页 200；`/api/health` 200，`ok=true`、`db=true`；本地服务随后已关闭 |
| npm audit | 发布前使用仓库锁定依赖执行完整审计与 `--omit=dev` 审计，必须为 0 个已知漏洞；Wrangler 当前为 4.118.0，sharp 当前为 0.35.3 |
| 本机验证运行时 | Node `26.1.0`；目标最低版本 Node 22.13+ 由 `.nvmrc` 的 Node 22 CI 验证，本报告不声称已在本机 Node 22 执行 |

test / build 会出现 Node 的 `MODULE_TYPELESS_PACKAGE_JSON` 性能提示，但不影响结果。当前不直接增加 `"type": "module"`，避免改变仓库内第三方或 CommonJS 脚本的加载语义；如需处理，应作为独立兼容性改造。

## 七、迁移前待办事项

### 必须处理

1. 审查并通过 Pull Request 合并本准备分支，不直接修改或覆盖 `main`。
2. 在 GPTWork 配置 `CHAT_IP_HASH_SALT`、`ANALYTICS_IP_HASH_SALT` 为两个不同的 Secrets；不要创建 `.dev.vars`。
3. 在 Cloudflare Preview 和 Production 分别确认 `DB`、`CHAT_IP_HASH_SALT`、`ANALYTICS_IP_HASH_SALT`。
4. 在 GPTWork 实际 clone 一次并确认约 1.45 GiB Git pack、约 400 MiB checkout 未超过平台配额或超时。
5. 合并前确认 CI 的 test / build 均通过。

### 建议处理

1. 首次部署后在后台确认旧网络来源禁言显示为“密钥已轮换”；需要继续限制时，等待该来源产生当前代次消息后重新建立。用户标识禁言不受影响。
2. 从 GPTWork 初始化本地 D1，启动后访问 `/api/health` 做 smoke test，且不给普通开发任务生产 D1、Cloudflare 部署或 Secret 读取权限。
3. 为本地 `output/`、TTS 配置和有价值的本地 D1 测试数据建立私密备份，但不要上传到公开 GitHub。
4. 启用平台级 secret scanning；若仓库所有者确认历史测试字面量为真实凭据，立即轮换。

### 可选优化

1. 未来引入 ESLint 后再配置真实 `npm run lint`。
2. 未来迁移 TypeScript 或 JSDoc 类型检查后再配置真实 `npm run typecheck`。
3. 为 Pages 本地服务器补充自动启动、HTTP smoke 和可靠关闭的 CI 作业。
4. 单独评估 Git LFS、发行包或对象存储能否降低仓库历史体积；不要在未验证部署兼容性时直接迁移现有静态资源。

## 八、建议执行的 Git 命令

以下命令仅供人工在干净目录确认后执行。使用安全分支和 Pull Request，不使用 force push，不直接覆盖 `main`：

```powershell
git fetch origin
git switch -c codex/gptwork-migration-prep origin/main
git add -- <明确审查过的迁移文件>
git commit -m "chore: prepare project for GPTWork migration"
git push -u origin codex/gptwork-migration-prep
gh pr create --draft --base main --head codex/gptwork-migration-prep --title "chore: prepare project for GPTWork migration"
```

如果远端 `main` 在审查期间前进，应在安全分支上按团队策略更新并通过 Pull Request 解决冲突；不要在保存着未提交内容的原工作区执行 reset / checkout 清理。
