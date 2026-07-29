# 工具雷达周更集成

本目录定义个人站“工具雷达”知识库分类的独立周更编辑与投递契约。它不复用 `daily-ai-news` 的时间窗口、候选 schema、令牌或机器通道。

## 运行节奏

- 时区：`Asia/Shanghai`
- 正式任务：每周二 22:00 自动启动；站长已明确授权专用通道与自动公开，任一闸门关闭时仍按失败关闭或草稿规则处理
- 近期动态回看窗口：上一周二 22:00 至本周二 22:00，左闭右开
- 工具不要求本周刚发布；有价值的常青工具也可收录
- 目标 6–10 个，质量不足不凑数；少于 3 个不成稿

自动任务在本周二 22:00 启动后执行搜索与事实核对；上述七天窗口用于回看近期发布、更新和社区信号，不把常青工具或实际核对时间错误限制在任务启动之前。

## 内部事实与公开文风

运行记录的 `profile`／`evidence` 继续完整保存用途、能力、价格、登录、中文、本地部署、AI 接入、使用步骤、案例与场景，作为校验和三语一致性的事实底稿。公开文章不把它们渲染成十字段验收表，而采用真人分享式写法：

- H1 使用本地化栏目名前缀，并同时写清读者痛点、与入选数量一致的阿拉伯数字，以及至少两个具体任务范围或收益；不能只写抽象主题、隐喻、口号或日期。
- 写作前先确定一句话叙事主线，按读者完成任务的自然顺序排列工具。整篇从开场问题出发，沿两到四个连续阶段推进，最后回到开场给出起步建议；不按热度或资料收集顺序堆成彼此无关的产品卡片。
- H1 后直接使用按本期主题自然命名的利益点式 H2，并在其下用恰好两段有依据的真实任务场景导语开场；不虚构站长亲测、使用时长或本人效果。
- 每个工具用一个以运行记录 `displayName` 开头的利益点式 H3，例如 `### 工具名称｜一句利益点`，正文固定为三个没有机械字段小标题的自然短段落：先讲它是什么、能做什么；再讲它替读者省掉什么、怎么开始；最后讲有依据的案例或明确标注的示例、适合谁与必要局限。
- 相邻工具把过渡自然写进上一节结尾或下一节开头，形成“先找参考，再做成作品，再补代码上下文，最后落到本地运行”一类可顺口念出的逻辑；不使用重复报幕句。
- 全部工具 H3 都归在开场 H2 下；最后一个 H2 用会话式语气给出按任务选择的建议。两个 H2 都随本期主题自然命名，不套用固定栏目文案。
- 局限顺手写在相关段落，不另设醒目的“缺点”框。
- 价格、登录、中文、本地与 AI 接入集中为一行：中文 `**上手信息：** 收费：…；登录：…；中文支持：…；本地部署：…；AI 接入：…`；English `**Practical details:** Pricing: …; Sign-in: …; Chinese support: …; Local deployment: …; AI setup: …`；日本語 `**利用メモ：** 料金：…；ログイン：…；中国語対応：…；ローカル導入：…；AI 導入：…`。
- 不堆 emoji，不用夸张、营销或点击诱饵标题。三语保持同一工具、顺序、事实、编辑判断与限制。
- 图片在契约上允许因版权或质量原因省略，但编辑目标是每个工具一张、最多两张；一旦使用，必须来自网上可复核的官方真实界面、官方案例或真实成果，并进入下方的视觉任务卡、成组关系、三秒测试、三语图注与失败关闭流程。本站自绘、AI 生成或统一模板图不能作为降级方案。

## 永久去重

每个工具使用 `<normalized-official-host>/<product-slug>` 形式的稳定 `toolKey`。自动任务必须在研究前获取带 Bearer 鉴权的 `/api/automation/tool-radar/catalog` 快照，校验器核对该快照，生产投递器在 POST 前再次读取最新目录。服务端对 `tool_key` 与规范官网 URL 建精确唯一约束。

同一产品更新功能仍是同一工具；疑似换名字、换域名或被收购时，自动唯一键不足以证明它是新工具，必须检索旧名称、旧官网和别名并人工核对历史目录，未排除重复前停止投递。同类不同产品允许在不同期继续介绍。

## 每周视觉工作流

图片不是首期试稿的一次性装饰，而是每周工作流中的独立证据环节。完整契约见 `VISUAL_METHOD.md`，固定顺序是：

1. 完成事实核验并确定本期叙事主线、工具顺序和每节核心结论。
2. 只为确实需要视觉解释的结论写视觉任务卡，先说明读者问题、视觉结论、必须出现的元素，以及单图或双图关系。
3. 先在网上发现素材，再回到官网、官方功能页、官方文档、官方仓库或官方媒体核实；按“明确许可／授权的官方真实素材 → 标明来源与权利边界的官方公开页面有限编辑性截图 → 无图”获取，禁止自绘图、生成图、搜索缩略图和第三方转载图。
4. 围绕完整语义区块裁切，确保关键标题、输入／动作、输出／结果不被遮挡或截断，并写表达同一结论的三语 alt 与图注。
5. 脱离正文执行三秒测试，再检查版权、隐私、清晰度、稳定性和项目本地路径。
6. 不合格就重截、继续寻找同一工具的官方实图或省略。图片可选，但一旦进入运行记录或正文，任何视觉闸门失败都必须停止校验和投递。
7. 有图的正式期先把本期资产随 `main` 通过 GitHub → Cloudflare Pages 正常路径部署；三语正文使用 `<assetPath>?v=<sha256 前 12 位>`，生产投递器会按登记顺序逐张读取同一精确缓存键，网络错误及 408／425／429／指定 5xx 最多进行三次有界重试，再严格核对 HTTP 200、与扩展名一致的 MIME 和完整 SHA-256。持续失败、图片未上线、类型错误或字节不一致都不会创建文章。

官网公开可访问不等于获得一般转载授权。采用有限编辑性截图时必须使用最少画面、显著注明来源，并在运行记录写明权利边界，不能把它描述为“官方授权素材”。

## 文件

- `workflow.json`：日历、数量、身份、证据、图片和投递总契约
- `discovery-catalog.json`：每周必须覆盖的八条发现方向
- `ARTICLE_STYLE.md`：三语文章固定格式
- `VISUAL_METHOD.md`：每周复用的视觉任务、取景、权利与失败关闭方法
- `AUTOMATION_PROMPT.md`：Codex 定时任务执行说明
- `run.schema.json`：运行记录 JSON Schema
- `fetch-catalog.mjs`：安全获取并保存已发布工具目录快照
- `configure-production-channel.mjs`：一次性生成并安全保存专用令牌，通过远端 D1 显式开启工具雷达投递与自动公开
- `capture-official-web.mjs`：使用无痕 Headless Chrome 从公开官方页面按 selector／文字锚点取得可复核界面图；滚动到目标后有界等待可视懒加载媒体，再截图并在退出时关闭浏览器
- `prepare-official-image.mjs`：只做裁切、缩放、压缩和 SHA-256 记录，不生成或绘制视觉内容
- `prepare-published-visual-revision.mjs`：对首期已发布文章的七个旧图片块做受限、可审计替换，保证标题、摘要和图片块之外的正文不变
- `evidence/2026-07-28-real-visual-revision.json`：首期七张真实官方图片的来源、权利判断、哈希、三语 alt 与图注
- `prepare-first-edition-2026-07-28.mjs` 与 `visuals/first-edition-2026-07-28.mjs`：已退役的历史自绘方案，不得再运行或作为周更模板
- `validate-run.mjs`：运行记录、证据、文章、图片和快照校验器
- `deliver-production.mjs`：目录复核、线上图片哈希预检、生产投递和三语公开回读

## 命令

```powershell
node "自动新闻/integrations/lusu-site/tool-radar/configure-production-channel.mjs" --confirm-production --enable-delivery --enable-auto-publish
node "自动新闻/integrations/lusu-site/tool-radar/fetch-catalog.mjs" --out "自动新闻/data/mcp-runs/tool-radar-YYYY-MM-DD/catalog.json"
node "自动新闻/integrations/lusu-site/tool-radar/validate-run.mjs" --run "<运行记录.json>"
node "自动新闻/integrations/lusu-site/tool-radar/deliver-production.mjs" --run "<运行记录.json>"
```

生产通道配置命令只在站长明确授权开启时运行一次；`--enable-delivery` 与 `--enable-auto-publish` 是两个独立的显式开关，不传后者时自动公开保持关闭。命令会写远端 D1，并把明文令牌只保存到 Git 忽略的根 `.dev.vars`。正式周更任务不得反复轮换令牌。

首次研究试稿尚未配置生产通道时，使用明确的本地空目录：

```powershell
node "自动新闻/integrations/lusu-site/tool-radar/fetch-catalog.mjs" --trial-empty --out "自动新闻/data/mcp-runs/tool-radar-trial-YYYY-MM-DD/catalog.json"
node "自动新闻/integrations/lusu-site/tool-radar/validate-run.mjs" --run "<试稿运行记录.json>"
```

试稿运行记录必须使用：

```json
{
  "catalogAudit": {
    "mode": "trial-local"
  },
  "delivery": {
    "mode": "trial",
    "status": "not-delivered"
  }
}
```

该模式只证明研究、证据和三语文章通过校验。生产投递器会硬拒绝它；不能原地把试稿改成 production。正式运行必须重新获取带 Bearer 的生产目录快照，使用 `catalogAudit.mode = "authenticated-production"`、`delivery.mode = "production"`、`delivery.status = "pending"` 和新的幂等键。

令牌只从进程环境或被 Git 忽略的根 `.dev.vars` 读取，变量名为 `TOOL_RADAR_TOKEN`。目录快照放在已被 Horizon 子项目忽略的 `自动新闻/data/mcp-runs/`，不得提交令牌、抓取缓存或临时素材。有图的期次还必须先完成正常站点部署；投递器会顺序预检正文使用的内容哈希版本 URL，对瞬时网络／HTTP 故障做有界重试，并在 POST 前把 HTTP 状态、MIME 与运行记录 SHA-256 全部对齐，避免公开文章引用 404、HTML 错误页或旧缓存图片。

后端分类、机器入口、D1 唯一目录、后台控制和根 `package.json` scripts 由主站接线；在这些接线完成前，本目录的生产投递器会安全失败，不能当成已经上线。投递通道启用但 auto-publish 关闭时，成功结果是三语草稿；只有服务端明确返回 `published` 时才进行三语公开回读。
