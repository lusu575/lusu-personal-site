import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ROOT = resolve(import.meta.dirname, "..", "..", "..", "..");
const DISCOVERY_CATALOG_PATH = resolve(import.meta.dirname, "discovery-catalog.json");
const DISCOVERY_CATALOG = JSON.parse(await readFile(DISCOVERY_CATALOG_PATH, "utf8"));
const LANGUAGES = ["zh", "en", "ja"];
const TOOL_CLAIM_KEYS = [
  "purpose",
  "capabilities",
  "pricing",
  "login",
  "chineseSupport",
  "localDeployment",
  "aiDeployment",
  "usageSteps",
  "caseStudies",
  "scenarios"
];
const OFFICIAL_REQUIRED_CLAIMS = new Set([
  "purpose",
  "capabilities",
  "pricing",
  "login",
  "chineseSupport",
  "localDeployment",
  "aiDeployment",
  "usageSteps"
]);
const SOURCE_KINDS = new Set([
  "official-product",
  "official-docs",
  "official-pricing",
  "official-terms",
  "official-repository",
  "official-release",
  "creator-demo",
  "reputable-review"
]);
const TOOL_CATEGORIES = new Set([
  "design-inspiration",
  "video-audio",
  "coding",
  "research",
  "productivity",
  "deployment",
  "local-ai",
  "data",
  "automation",
  "content",
  "infrastructure",
  "network-access",
  "education",
  "other"
]);
const STATUS_VALUES = {
  pricing: new Set(["free", "freemium", "paid", "open-source", "enterprise", "unknown"]),
  login: new Set(["required", "optional", "not-required", "varies", "unknown"]),
  chineseSupport: new Set(["native", "partial", "community", "none", "unknown"]),
  localDeployment: new Set(["supported", "partial", "not-supported", "unknown"]),
  aiDeployment: new Set(["one-click", "guided", "manual", "not-applicable", "unknown"])
};
const IMAGE_INFORMATION_ROLES = new Set([
  "interface",
  "input",
  "workflow",
  "output",
  "result",
  "installation",
  "before",
  "after",
  "limitation"
]);
const IMAGE_FRAMINGS = new Set([
  "standalone",
  "sequence-start",
  "sequence-end"
]);
const ARTICLE_RULES = {
  zh: {
    titlePrefix: "工具雷达｜",
    painSignals: [
      /不懂|不知道|不会|不能|做不出|说不清|看不懂|找不到|总是|总|卡住|费时|麻烦|重复|困难|难以|想.+却/u
    ],
    scopeSignals: [
      /设计/u,
      /动效|动画/u,
      /视频|剪辑/u,
      /代码|编程|开发/u,
      /本地\s*AI|本地运行|自托管/u,
      /研究|调研|检索|搜索/u,
      /自动化/u,
      /图像|图片/u,
      /音频|声音/u,
      /数据/u,
      /写作|内容创作/u,
      /省时|提效|效率/u
    ],
    legacySectionHeadings: ["本期工具", "本期怎么选"],
    practicalDetailsLabel: "上手信息",
    practicalDetailFields: [
      "收费",
      "登录",
      "中文支持",
      "本地部署",
      "AI 接入"
    ]
  },
  en: {
    titlePrefix: "Tool Radar | ",
    painSignals: [
      /\b(?:not|cannot|can't|don['’]t|doesn['’]t|won['’]t|hard|difficult|stuck|struggl\w*|missing|wast\w*|slow|confus\w*|unclear|problem|friction)\b/iu
    ],
    scopeSignals: [
      /\bdesign\b/iu,
      /\bmotion|animation\b/iu,
      /\bvideo|editing\b/iu,
      /\bcode|coding|development\b/iu,
      /\blocal\s+AI|self-host\w*\b/iu,
      /\bresearch|search\b/iu,
      /\bautomation\b/iu,
      /\bimage|visual\b/iu,
      /\baudio|sound\b/iu,
      /\bdata\b/iu,
      /\bwriting|content creation\b/iu,
      /\bsave time|productivity|efficiency\b/iu
    ],
    legacySectionHeadings: ["This Week's Tools", "How to Choose"],
    practicalDetailsLabel: "Practical details",
    practicalDetailFields: [
      "Pricing",
      "Sign-in",
      "Chinese support",
      "Local deployment",
      "AI setup"
    ]
  },
  ja: {
    titlePrefix: "ツールレーダー｜",
    painSignals: [
      /できない|分からない|わからない|困る|難しい|詰まる|手間|遅い|うまく|思いどおり|迷う|足りない|不足/u
    ],
    scopeSignals: [
      /デザイン/u,
      /動き|アニメーション|モーション/u,
      /動画|映像|編集/u,
      /コード|開発|プログラミング/u,
      /ローカル\s*AI|セルフホスト/u,
      /調査|検索/u,
      /自動化/u,
      /画像|ビジュアル/u,
      /音声|サウンド/u,
      /データ/u,
      /執筆|文章|コンテンツ制作/u,
      /時短|効率/u
    ],
    legacySectionHeadings: ["今週のツール", "選び方"],
    practicalDetailsLabel: "利用メモ",
    practicalDetailFields: [
      "料金",
      "ログイン",
      "中国語対応",
      "ローカル導入",
      "AI 導入"
    ]
  }
};

export function parseValidateArgs(argv = process.argv.slice(2)) {
  const runIndex = argv.indexOf("--run");
  const runPath = runIndex >= 0 ? String(argv[runIndex + 1] || "").trim() : "";
  if (!runPath || runPath.startsWith("--")) {
    throw new Error("工具雷达校验必须显式提供 --run <运行记录路径>。");
  }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--run") {
      index += 1;
      continue;
    }
    throw new Error(`未知参数：${argv[index]}`);
  }
  return { runPath };
}

export async function readAndValidateRun(runPath, options = {}) {
  const absoluteRunPath = resolve(options.cwd || process.cwd(), runPath);
  let run;
  try {
    run = JSON.parse(await readFile(absoluteRunPath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`运行记录不是有效 JSON：${absoluteRunPath}`);
    }
    throw error;
  }
  const result = await validateRunObject(run, {
    ...options,
    runPath: absoluteRunPath
  });
  return { ...result, run, runPath: absoluteRunPath };
}

export async function validateRunObject(run, {
  siteRoot = SITE_ROOT,
  runPath = ""
} = {}) {
  assertObject(run, "运行记录");
  assertExactKeys(run, [
    "schemaVersion",
    "edition",
    "discoveryAudit",
    "catalogAudit",
    "theme",
    "tools",
    "delivery"
  ], "运行记录");
  expect(run.schemaVersion === 1, "工具雷达正式运行记录必须使用 schemaVersion 1。");

  const edition = validateEdition(run.edition);
  validateLocalizedText(run.theme, "theme", { min: 2, max: 160 });
  validateDiscoveryAudit(run.discoveryAudit, edition);
  const catalogSnapshot = await validateCatalogAudit(
    run.catalogAudit,
    edition,
    siteRoot,
    run.delivery?.mode
  );

  expect(Array.isArray(run.tools), "tools 必须是数组。");
  expect(
    run.tools.length >= 3 && run.tools.length <= 10,
    "工具雷达每期必须收录 3–10 个工具；目标是 6–10 个，质量不足时不得凑数。"
  );
  expect(
    Number(run.discoveryAudit.candidateCount) >= run.tools.length,
    "candidateCount 不能少于最终入选工具数。"
  );

  const knownToolKeys = new Set(catalogSnapshot.toolKeys);
  const selectedToolKeys = new Set();
  const displayNamesByLanguage = Object.fromEntries(LANGUAGES.map((lang) => [lang, new Set()]));
  for (const [index, tool] of run.tools.entries()) {
    await validateTool(tool, {
      index,
      edition,
      siteRoot,
      selectedToolKeys,
      knownToolKeys,
      displayNamesByLanguage
    });
  }

  validateDelivery(run.delivery, run, edition);
  for (const lang of LANGUAGES) {
    validateArticleTranslation(run.delivery.translations[lang], {
      lang,
      run,
      siteRoot
    });
  }

  return {
    editionId: edition.id,
    selectedToolCount: run.tools.length,
    catalogKnownToolCount: catalogSnapshot.toolKeys.length,
    runPath
  };
}

export function validateCatalogSnapshotPayload(payload) {
  assertObject(payload, "工具目录快照");
  assertExactKeys(payload, [
    "schemaVersion",
    "mode",
    "fetchedAt",
    "endpoint",
    "category",
    "tools",
    "toolKeys"
  ], "工具目录快照");
  expect(payload.schemaVersion === 1, "工具目录快照 schemaVersion 必须为 1。");
  parseIso(payload.fetchedAt, "catalog.fetchedAt");
  expect(["authenticated-production", "trial-local"].includes(payload.mode),
    "工具目录快照 mode 不合法。");
  if (payload.mode === "authenticated-production") {
    expect(
      payload.endpoint === "https://lusu575.com/api/automation/tool-radar/catalog",
      "生产工具目录快照 endpoint 不正确。"
    );
  } else {
    expect(payload.endpoint === "local:tool-radar-trial-catalog",
      "试稿工具目录快照必须使用明确的本地 endpoint 标识。");
  }
  expect(payload.category === "tool-radar", "工具目录快照 category 必须为 tool-radar。");
  expect(Array.isArray(payload.tools), "工具目录快照 tools 必须是数组。");
  expect(Array.isArray(payload.toolKeys), "工具目录快照 toolKeys 必须是数组。");

  const toolKeys = [];
  const seen = new Set();
  for (const [index, tool] of payload.tools.entries()) {
    assertObject(tool, `catalog.tools[${index}]`);
    expect(typeof tool.toolKey === "string", `catalog.tools[${index}].toolKey 缺失。`);
    validateToolKey(tool.toolKey, `catalog.tools[${index}].toolKey`);
    expect(!seen.has(tool.toolKey), `工具目录快照包含重复 toolKey：${tool.toolKey}`);
    seen.add(tool.toolKey);
    toolKeys.push(tool.toolKey);
    if (tool.canonicalUrl !== undefined && tool.canonicalUrl !== null) {
      validateHttpsUrl(tool.canonicalUrl, `catalog.tools[${index}].canonicalUrl`, {
        canonical: true
      });
    }
  }
  const sorted = [...toolKeys].sort();
  expect(
    JSON.stringify(payload.toolKeys) === JSON.stringify(sorted),
    "工具目录快照 toolKeys 必须是 tools 中 toolKey 的排序后精确投影。"
  );
  return { toolKeys: sorted };
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function deriveToolKey(canonicalUrl, productSlug) {
  const url = validateHttpsUrl(canonicalUrl, "canonicalUrl", { canonical: true });
  const slug = String(productSlug || "").trim();
  expect(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),
    "productSlug 只允许小写字母、数字和单个连字符分段。"
  );
  return `${normalizeOfficialHost(url.hostname)}/${slug}`;
}

function validateEdition(edition) {
  assertObject(edition, "edition");
  assertExactKeys(edition, [
    "id",
    "timezone",
    "scheduledAt",
    "discoveryStart",
    "discoveryEnd"
  ], "edition");
  expect(edition.timezone === "Asia/Shanghai", "edition.timezone 必须为 Asia/Shanghai。");
  expect(
    /^\d{4}-\d{2}-\d{2}T22:00:00\+08:00$/.test(edition.scheduledAt),
    "scheduledAt 必须是北京时间周二 22:00:00，并显式使用 +08:00。"
  );
  const scheduledAt = parseIso(edition.scheduledAt, "edition.scheduledAt");
  const scheduledParts = shanghaiParts(scheduledAt);
  expect(
    scheduledParts.weekday === "Tue" && scheduledParts.hour === "22",
    "scheduledAt 必须落在 Asia/Shanghai 的周二 22:00。"
  );
  const expectedId = `tool-radar-${scheduledParts.date}`;
  expect(edition.id === expectedId, `edition.id 必须为 ${expectedId}。`);
  const discoveryStart = parseIso(edition.discoveryStart, "edition.discoveryStart");
  const discoveryEnd = parseIso(edition.discoveryEnd, "edition.discoveryEnd");
  expect(
    discoveryEnd.getTime() === scheduledAt.getTime(),
    "discoveryEnd 必须等于本期 scheduledAt。"
  );
  expect(
    discoveryEnd.getTime() - discoveryStart.getTime() === 7 * 24 * 60 * 60 * 1000,
    "工具雷达发现窗口必须精确为 7 天。"
  );
  return {
    ...edition,
    scheduledDate: scheduledParts.date,
    scheduledAtDate: scheduledAt,
    discoveryStartDate: discoveryStart,
    discoveryEndDate: discoveryEnd,
    nextScheduledAtDate: new Date(scheduledAt.getTime() + 7 * 24 * 60 * 60 * 1000)
  };
}

function validateDiscoveryAudit(audit, edition) {
  assertObject(audit, "discoveryAudit");
  assertExactKeys(audit, [
    "catalogVersion",
    "completedAt",
    "candidateCount",
    "signedOffLaneIds",
    "lanes"
  ], "discoveryAudit");
  expect(audit.catalogVersion === 1, "discoveryAudit.catalogVersion 必须为 1。");
  const completedAt = parseExecutionTime(audit.completedAt, "discoveryAudit.completedAt", edition);
  expect(Number.isInteger(audit.candidateCount) && audit.candidateCount >= 3,
    "discoveryAudit.candidateCount 必须是至少 3 的整数。");
  const requiredLaneIds = DISCOVERY_CATALOG.requiredLaneIds;
  expectUniqueStringArray(audit.signedOffLaneIds, "discoveryAudit.signedOffLaneIds");
  expectSameSet(
    audit.signedOffLaneIds,
    requiredLaneIds,
    "signedOffLaneIds 必须精确签收 discovery-catalog.json 的全部 required lane。"
  );
  expect(Array.isArray(audit.lanes), "discoveryAudit.lanes 必须是数组。");
  expect(audit.lanes.length === requiredLaneIds.length,
    "discoveryAudit.lanes 必须为每个 required lane 恰好提供一条记录。");
  const seen = new Set();
  for (const [index, lane] of audit.lanes.entries()) {
    assertObject(lane, `discoveryAudit.lanes[${index}]`);
    assertExactKeys(lane, ["laneId", "status", "searches", "notes"],
      `discoveryAudit.lanes[${index}]`);
    expect(requiredLaneIds.includes(lane.laneId), `未知 discovery lane：${lane.laneId}`);
    expect(!seen.has(lane.laneId), `discovery lane 重复：${lane.laneId}`);
    seen.add(lane.laneId);
    expect(lane.status === "complete", `${lane.laneId} 未完整签收。`);
    expect(typeof lane.notes === "string" && lane.notes.trim().length >= 4,
      `${lane.laneId}.notes 过短。`);
    expect(Array.isArray(lane.searches) && lane.searches.length >= 1,
      `${lane.laneId} 至少需要一条真实搜索记录。`);
    for (const [searchIndex, search] of lane.searches.entries()) {
      assertObject(search, `${lane.laneId}.searches[${searchIndex}]`);
      assertExactKeys(search, ["query", "executedAt", "status", "resultCount"],
        `${lane.laneId}.searches[${searchIndex}]`);
      expect(typeof search.query === "string" && search.query.trim().length >= 3,
        `${lane.laneId} 查询文本过短。`);
      parseExecutionTime(search.executedAt, `${lane.laneId}.executedAt`, edition);
      expect(["success", "empty"].includes(search.status),
        `${lane.laneId} 查询失败不能伪装为 success/empty。`);
      expect(Number.isInteger(search.resultCount) && search.resultCount >= 0,
        `${lane.laneId}.resultCount 必须是非负整数。`);
      expect(search.status !== "empty" || search.resultCount === 0,
        `${lane.laneId} empty 查询的 resultCount 必须为 0。`);
    }
  }
  expect(completedAt.getTime() >= edition.scheduledAtDate.getTime(),
    "discoveryAudit.completedAt 不能早于本期开始。");
}

async function validateCatalogAudit(audit, edition, siteRoot, deliveryMode) {
  assertObject(audit, "catalogAudit");
  assertExactKeys(audit, ["mode", "snapshotPath", "fetchedAt", "sha256", "knownToolCount"],
    "catalogAudit");
  expect(["authenticated-production", "trial-local"].includes(audit.mode),
    "catalogAudit.mode 不合法。");
  const expectedCatalogMode = deliveryMode === "trial"
    ? "trial-local"
    : "authenticated-production";
  expect(audit.mode === expectedCatalogMode,
    `delivery.mode=${deliveryMode} 必须使用 catalogAudit.mode=${expectedCatalogMode}。`);
  const fetchedAt = parseExecutionTime(audit.fetchedAt, "catalogAudit.fetchedAt", edition);
  expect(/^[a-f0-9]{64}$/.test(String(audit.sha256 || "")),
    "catalogAudit.sha256 必须是小写 SHA-256。");
  expect(Number.isInteger(audit.knownToolCount) && audit.knownToolCount >= 0,
    "catalogAudit.knownToolCount 必须是非负整数。");
  const snapshotPath = String(audit.snapshotPath || "").replaceAll("\\", "/");
  expect(/^自动新闻\/data\/mcp-runs\/[^/].*\/catalog\.json$/.test(snapshotPath),
    "catalogAudit.snapshotPath 必须位于 自动新闻/data/mcp-runs/<run>/catalog.json。");
  expect(!/(^|\/)\.\.(\/|$)/.test(snapshotPath), "catalogAudit.snapshotPath 禁止路径穿越。");
  const root = resolve(siteRoot);
  const artifactRoot = resolve(root, "自动新闻", "data", "mcp-runs");
  const absolutePath = resolve(root, ...snapshotPath.split("/"));
  expect(
    absolutePath.startsWith(`${artifactRoot}${sep}`),
    "catalogAudit.snapshotPath 解析后逃出允许的数据目录。"
  );
  const bytes = await readFile(absolutePath);
  expect(sha256Bytes(bytes) === audit.sha256, "catalogAudit.sha256 与精确快照字节不一致。");
  let payload;
  try {
    payload = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("工具目录快照不是有效 UTF-8 JSON。");
  }
  const result = validateCatalogSnapshotPayload(payload);
  expect(payload.mode === audit.mode,
    "catalogAudit.mode 必须与目录快照完全一致。");
  expect(payload.fetchedAt === audit.fetchedAt,
    "catalogAudit.fetchedAt 必须与目录快照完全一致。");
  expect(payload.tools.length === audit.knownToolCount,
    "catalogAudit.knownToolCount 与目录快照不一致。");
  expect(fetchedAt.getTime() >= edition.scheduledAtDate.getTime(),
    "目录快照必须在本期周二 22:00 启动后获取。");
  return result;
}

async function validateTool(tool, context) {
  const label = `tools[${context.index}]`;
  assertObject(tool, label);
  assertExactKeys(tool, [
    "toolKey",
    "canonicalUrl",
    "productSlug",
    "name",
    "displayNames",
    "category",
    "evidence",
    "profile",
    "image"
  ], label);
  validateToolKey(tool.toolKey, `${label}.toolKey`);
  const canonicalUrl = validateHttpsUrl(tool.canonicalUrl, `${label}.canonicalUrl`, {
    canonical: true
  });
  const expectedKey = deriveToolKey(canonicalUrl.toString(), tool.productSlug);
  expect(tool.toolKey === expectedKey,
    `${label}.toolKey 必须由规范化官网 host 与 productSlug 派生为 ${expectedKey}。`);
  expect(!context.selectedToolKeys.has(tool.toolKey), `本期重复 toolKey：${tool.toolKey}`);
  expect(!context.knownToolKeys.has(tool.toolKey),
    `工具 ${tool.toolKey} 已在服务端目录快照中出现，永久去重禁止再次入选。`);
  context.selectedToolKeys.add(tool.toolKey);
  expect(typeof tool.name === "string" && tool.name.trim().length >= 1
    && tool.name.length <= 120, `${label}.name 不合法。`);
  validateLocalizedText(tool.displayNames, `${label}.displayNames`, { min: 1, max: 120 });
  for (const lang of LANGUAGES) {
    const name = tool.displayNames[lang].trim();
    expect(!context.displayNamesByLanguage[lang].has(name),
      `${lang} 工具标题重复：${name}`);
    context.displayNamesByLanguage[lang].add(name);
  }
  expect(TOOL_CATEGORIES.has(tool.category), `${label}.category 不在允许范围。`);

  const sources = validateEvidence(tool.evidence, {
    label,
    edition: context.edition,
    canonicalUrl
  });
  validateProfile(tool.profile, {
    label,
    sources,
    evidenceCheckedAt: tool.evidence.checkedAt
  });
  await validateToolImages(tool.image, {
    label,
    siteRoot: context.siteRoot,
    scheduledDate: context.edition.scheduledDate,
    edition: context.edition
  });
}

function validateEvidence(evidence, { label, edition, canonicalUrl }) {
  assertObject(evidence, `${label}.evidence`);
  assertExactKeys(evidence, ["checkedAt", "sources"], `${label}.evidence`);
  parseExecutionTime(evidence.checkedAt, `${label}.evidence.checkedAt`, edition);
  expect(Array.isArray(evidence.sources) && evidence.sources.length >= 1
    && evidence.sources.length <= 20, `${label}.evidence.sources 必须包含 1–20 条来源。`);
  const sources = new Map();
  let officialCount = 0;
  let canonicalFound = false;
  for (const [index, source] of evidence.sources.entries()) {
    const sourceLabel = `${label}.evidence.sources[${index}]`;
    assertObject(source, sourceLabel);
    assertExactKeys(source, ["id", "url", "kind", "accessedAt", "supports"], sourceLabel);
    expect(/^[a-z0-9][a-z0-9._-]{0,79}$/.test(String(source.id || "")),
      `${sourceLabel}.id 不合法。`);
    expect(!sources.has(source.id), `${label} 的证据 id 重复：${source.id}`);
    const url = validateHttpsUrl(source.url, `${sourceLabel}.url`);
    expect(SOURCE_KINDS.has(source.kind), `${sourceLabel}.kind 不合法。`);
    parseExecutionTime(source.accessedAt, `${sourceLabel}.accessedAt`, edition);
    expectUniqueStringArray(source.supports, `${sourceLabel}.supports`);
    expect(source.supports.every((claim) => TOOL_CLAIM_KEYS.includes(claim)),
      `${sourceLabel}.supports 含未知事实字段。`);
    if (source.kind.startsWith("official-")) {
      officialCount += 1;
    }
    if (normalizeComparableUrl(url) === normalizeComparableUrl(canonicalUrl)
      && source.kind === "official-product") {
      canonicalFound = true;
    }
    sources.set(source.id, source);
  }
  expect(officialCount >= 1, `${label} 至少需要一个官方来源。`);
  expect(canonicalFound, `${label} 必须把 canonicalUrl 作为 official-product 证据。`);
  return sources;
}

function validateProfile(profile, { label, sources, evidenceCheckedAt }) {
  assertObject(profile, `${label}.profile`);
  assertExactKeys(profile, TOOL_CLAIM_KEYS, `${label}.profile`);
  validateTextClaim(profile.purpose, "purpose", label, sources, { min: 12 });
  validateListClaim(profile.capabilities, "capabilities", label, sources, {
    minItems: 1,
    maxItems: 8
  });

  for (const key of ["pricing", "login", "chineseSupport", "localDeployment", "aiDeployment"]) {
    validateStatusClaim(profile[key], key, label, sources, evidenceCheckedAt);
  }
  expect(["yes", "limited", "no", "unknown"].includes(profile.pricing.freeTier),
    `${label}.profile.pricing.freeTier 不合法。`);
  validateListClaim(profile.usageSteps, "usageSteps", label, sources, {
    minItems: 2,
    maxItems: 7
  });
  validateCaseStudies(profile.caseStudies, label, sources);
  validateListClaim(profile.scenarios, "scenarios", label, sources, {
    minItems: 2,
    maxItems: 8
  });
}

function validateTextClaim(claim, key, label, sources, { min = 4 } = {}) {
  assertObject(claim, `${label}.profile.${key}`);
  assertExactKeys(claim, ["text", "evidenceIds"], `${label}.profile.${key}`);
  expect(typeof claim.text === "string" && claim.text.trim().length >= min,
    `${label}.profile.${key}.text 过短。`);
  validateEvidenceReferences(claim.evidenceIds, key, label, sources);
}

function validateListClaim(claim, key, label, sources, { minItems, maxItems }) {
  assertObject(claim, `${label}.profile.${key}`);
  assertExactKeys(claim, ["items", "evidenceIds"], `${label}.profile.${key}`);
  expect(Array.isArray(claim.items)
    && claim.items.length >= minItems
    && claim.items.length <= maxItems,
  `${label}.profile.${key}.items 数量不合法。`);
  for (const [index, item] of claim.items.entries()) {
    expect(typeof item === "string" && item.trim().length >= 3,
      `${label}.profile.${key}.items[${index}] 过短。`);
  }
  validateEvidenceReferences(claim.evidenceIds, key, label, sources);
}

function validateStatusClaim(claim, key, label, sources, evidenceCheckedAt) {
  assertObject(claim, `${label}.profile.${key}`);
  const keys = key === "pricing"
    ? ["status", "freeTier", "details", "checkedAt", "evidenceIds"]
    : ["status", "details", "checkedAt", "evidenceIds"];
  assertExactKeys(claim, keys, `${label}.profile.${key}`);
  expect(STATUS_VALUES[key].has(claim.status),
    `${label}.profile.${key}.status 不合法。`);
  expect(typeof claim.details === "string" && claim.details.trim().length >= 3,
    `${label}.profile.${key}.details 过短。`);
  parseIso(claim.checkedAt, `${label}.profile.${key}.checkedAt`);
  expect(claim.checkedAt === evidenceCheckedAt,
    `${label}.profile.${key}.checkedAt 必须与本次工具证据核对时间一致。`);
  validateEvidenceReferences(claim.evidenceIds, key, label, sources);
}

function validateCaseStudies(claim, label, sources) {
  assertObject(claim, `${label}.profile.caseStudies`);
  assertExactKeys(claim, ["items", "evidenceIds"], `${label}.profile.caseStudies`);
  expect(Array.isArray(claim.items) && claim.items.length >= 1 && claim.items.length <= 4,
    `${label}.profile.caseStudies.items 必须包含 1–4 项。`);
  for (const [index, item] of claim.items.entries()) {
    assertObject(item, `${label}.profile.caseStudies.items[${index}]`);
    assertExactKeys(item, ["title", "description", "kind"],
      `${label}.profile.caseStudies.items[${index}]`);
    expect(typeof item.title === "string" && item.title.trim().length >= 3,
      `${label}.profile.caseStudies.items[${index}].title 过短。`);
    expect(typeof item.description === "string" && item.description.trim().length >= 8,
      `${label}.profile.caseStudies.items[${index}].description 过短。`);
    expect(["documented", "demonstrated", "illustrative"].includes(item.kind),
      `${label}.profile.caseStudies.items[${index}].kind 不合法。`);
  }
  validateEvidenceReferences(claim.evidenceIds, "caseStudies", label, sources);
}

function validateEvidenceReferences(evidenceIds, key, label, sources) {
  expectUniqueStringArray(evidenceIds, `${label}.profile.${key}.evidenceIds`);
  expect(evidenceIds.length >= 1, `${label}.profile.${key} 至少引用一条证据。`);
  let officialReferenced = false;
  for (const evidenceId of evidenceIds) {
    const source = sources.get(evidenceId);
    expect(Boolean(source), `${label}.profile.${key} 引用了不存在的证据 ${evidenceId}。`);
    expect(source.supports.includes(key),
      `证据 ${evidenceId} 未声明支持 ${key}。`);
    if (source.kind.startsWith("official-")) {
      officialReferenced = true;
    }
  }
  if (OFFICIAL_REQUIRED_CLAIMS.has(key)) {
    expect(officialReferenced, `${label}.profile.${key} 必须引用官方证据。`);
  }
}

async function validateToolImages(value, { label, siteRoot, scheduledDate, edition }) {
  const images = normalizeToolImages(value);
  expect(images.length <= 2, `${label}.image 每个工具最多登记 2 张图片。`);
  if (Array.isArray(value)) {
    expect(images.length >= 1, `${label}.image 数组必须包含 1–2 张图片；无图时使用 null。`);
  }
  const assetPaths = new Set();
  const hashes = new Set();
  for (const [index, image] of images.entries()) {
    const imageLabel = Array.isArray(value) ? `${label}.image[${index}]` : `${label}.image`;
    await validateImageRecord(image, {
      label: imageLabel,
      siteRoot,
      scheduledDate,
      edition
    });
    const assetPath = String(image.assetPath || "").replaceAll("\\", "/");
    expect(!assetPaths.has(assetPath),
      `${label}.image 同一工具的两张图片不能重复 assetPath。`);
    expect(!hashes.has(image.sha256),
      `${label}.image 同一工具的两张图片不能是完全相同的文件。`);
    assetPaths.add(assetPath);
    hashes.add(image.sha256);
  }
  if (images.length === 1) {
    expect(images[0].framing === "standalone",
      `${label}.image 单图必须使用 framing=standalone。`);
    expect(images[0].sequence === null,
      `${label}.image 单图的 sequence 必须为 null。`);
  }
  if (images.length === 2) {
    const [first, second] = images;
    expect(first.framing === "sequence-start" && second.framing === "sequence-end",
      `${label}.image 双图必须按 sequence-start、sequence-end 的顺序登记。`);
    expect(Boolean(first.sequence) && Boolean(second.sequence),
      `${label}.image 双图必须登记 sequence。`);
    expect(first.sequence.groupKey === second.sequence.groupKey,
      `${label}.image 双图必须使用同一个 sequence.groupKey。`);
    expect(first.sequence.position === 1 && second.sequence.position === 2,
      `${label}.image 双图必须按 sequence.position=1、2 的顺序登记。`);
    expect(first.sequence.total === 2 && second.sequence.total === 2,
      `${label}.image 双图的 sequence.total 必须为 2。`);
    expect(
      first.captureBrief.informationRole !== second.captureBrief.informationRole,
      `${label}.image 双图必须承担不同的 captureBrief.informationRole。`
    );
    for (const lang of LANGUAGES) {
      expect(first.caption[lang] !== second.caption[lang],
        `${label}.image 双图的 ${lang} caption 不能重复。`);
    }
  }
}

function normalizeToolImages(value) {
  if (value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

async function validateImageRecord(image, { label, siteRoot, scheduledDate, edition }) {
  assertObject(image, label);
  assertExactKeys(image, [
    "assetPath",
    "sourceUrl",
    "rightsBasis",
    "sha256",
    "alt",
    "caption",
    "captureBrief",
    "framing",
    "sequence",
    "visualQa"
  ], label);
  const assetPath = String(image.assetPath || "").replaceAll("\\", "/");
  expect(
    new RegExp(`^assets/images/articles/tool-radar/${scheduledDate}/[a-z0-9._/-]+\\.(png|jpe?g|webp)$`, "i")
      .test(assetPath),
    `${label}.assetPath 必须位于本期 tool-radar 文章资产目录。`
  );
  expect(!/(^|\/)\.\.(\/|$)/.test(assetPath), `${label}.assetPath 禁止路径穿越。`);
  expect([
    "official-press-kit",
    "official-permitted-download",
    "original-capture-with-permission",
    "original-generated"
  ].includes(image.rightsBasis), `${label}.rightsBasis 不合法。`);
  if (image.rightsBasis === "original-generated") {
    expect(image.sourceUrl === null, `${label} 原创生成图的 sourceUrl 必须为 null。`);
  } else {
    validateHttpsUrl(image.sourceUrl, `${label}.sourceUrl`);
  }
  expect(/^[a-f0-9]{64}$/.test(String(image.sha256 || "")),
    `${label}.sha256 不合法。`);
  validateLocalizedText(image.alt, `${label}.alt`, { min: 4, max: 300 });
  validateLocalizedText(image.caption, `${label}.caption`, { min: 10, max: 300 });
  for (const lang of LANGUAGES) {
    expect(
      image.caption[lang].trim() === image.caption[lang]
        && !/[\r\n*]/u.test(image.caption[lang]),
      `${label}.caption.${lang} 必须是可直接放在图片下方的单行纯文本。`
    );
  }
  validateImageCaptureBrief(image.captureBrief, `${label}.captureBrief`);
  expect(IMAGE_FRAMINGS.has(image.framing), `${label}.framing 不合法。`);
  if (image.framing === "standalone") {
    expect(image.sequence === null, `${label} standalone 图片的 sequence 必须为 null。`);
  } else {
    validateImageSequence(image.sequence, `${label}.sequence`);
  }
  validateImageVisualQa(image.visualQa, `${label}.visualQa`, edition);
  const root = resolve(siteRoot);
  const assetRoot = resolve(root, "assets", "images", "articles", "tool-radar");
  const absolutePath = resolve(root, ...assetPath.split("/"));
  expect(absolutePath.startsWith(`${assetRoot}${sep}`),
    `${label}.assetPath 解析后逃出允许目录。`);
  const fileStat = await stat(absolutePath);
  expect(fileStat.isFile(), `${label}.assetPath 不是文件。`);
  expect(fileStat.size > 0 && fileStat.size <= 5 * 1024 * 1024,
    `${label} 文件必须大于 0 且不超过 5 MiB。`);
  const bytes = await readFile(absolutePath);
  validateImageSignature(bytes, extname(assetPath).toLowerCase(), label);
  expect(sha256Bytes(bytes) === image.sha256,
    `${label}.sha256 与精确文件字节不一致。`);
}

function validateImageCaptureBrief(brief, label) {
  assertObject(brief, label);
  assertExactKeys(brief, [
    "readerQuestion",
    "visualClaim",
    "informationRole",
    "mustShow"
  ], label);
  for (const [key, min, max] of [
    ["readerQuestion", 12, 400],
    ["visualClaim", 12, 500]
  ]) {
    expect(
      typeof brief[key] === "string"
        && brief[key].trim() === brief[key]
        && brief[key].length >= min
        && brief[key].length <= max,
      `${label}.${key} 不能为空、不能带首尾空白，且长度必须为 ${min}–${max}。`
    );
  }
  expect(IMAGE_INFORMATION_ROLES.has(brief.informationRole),
    `${label}.informationRole 不合法。`);
  expect(Array.isArray(brief.mustShow)
    && brief.mustShow.length >= 2
    && brief.mustShow.length <= 5,
  `${label}.mustShow 必须包含 2–5 个关键画面元素。`);
  const normalizedMustShow = [];
  for (const [index, item] of brief.mustShow.entries()) {
    expect(
      typeof item === "string"
        && item.trim() === item
        && item.length >= 3
        && item.length <= 160,
      `${label}.mustShow[${index}] 不能为空、不能带首尾空白，且长度必须为 3–160。`
    );
    normalizedMustShow.push(item.toLocaleLowerCase());
  }
  expect(new Set(normalizedMustShow).size === normalizedMustShow.length,
    `${label}.mustShow 含重复关键元素。`);
}

function validateImageSequence(sequence, label) {
  assertObject(sequence, label);
  assertExactKeys(sequence, ["groupKey", "position", "total"], label);
  expect(
    /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(String(sequence.groupKey || ""))
      && sequence.groupKey.length <= 100,
    `${label}.groupKey 不合法。`
  );
  expect([1, 2].includes(sequence.position), `${label}.position 只允许 1 或 2。`);
  expect(sequence.total === 2, `${label}.total 必须为 2。`);
}

function validateImageVisualQa(visualQa, label, edition) {
  assertObject(visualQa, label);
  const checks = [
    "threeSecondTestPassed",
    "productAndContextIdentifiable",
    "criticalContentUncropped",
    "privacyClean",
    "articleWidthReadable"
  ];
  assertExactKeys(visualQa, [...checks, "reviewedAt"], label);
  for (const check of checks) {
    expect(visualQa[check] === true, `${label}.${check} 必须明确为 true。`);
  }
  parseExecutionTime(visualQa.reviewedAt, `${label}.reviewedAt`, edition);
}

function validateImageSignature(bytes, extension, label) {
  const isPng = bytes.length >= 8
    && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = bytes.length >= 3
    && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = bytes.length >= 12
    && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  const valid = extension === ".png"
    ? isPng
    : [".jpg", ".jpeg"].includes(extension)
      ? isJpeg
      : extension === ".webp" && isWebp;
  expect(valid, `${label} 文件签名与扩展名不一致。`);
}

function validateDelivery(delivery, run, edition) {
  assertObject(delivery, "delivery");
  assertExactKeys(delivery, [
    "mode",
    "status",
    "idempotencyKey",
    "slug",
    "source",
    "tags",
    "tools",
    "translations"
  ], "delivery");
  expect(["production", "trial"].includes(delivery.mode),
    "delivery.mode 只允许 production 或 trial。");
  if (delivery.mode === "trial") {
    expect(delivery.status === "not-delivered",
      "trial 运行必须使用 delivery.status=not-delivered。");
  } else {
    expect(delivery.status === "pending",
      "production 运行在投递前必须使用 delivery.status=pending。");
  }
  expect(
    new RegExp(`^tool-radar:${edition.scheduledDate}:[a-z0-9][a-z0-9._-]{0,80}$`)
      .test(String(delivery.idempotencyKey || "")),
    "delivery.idempotencyKey 必须包含本期日期和显式版本。"
  );
  expect(delivery.slug === edition.id, `delivery.slug 必须为 ${edition.id}。`);
  expect(typeof delivery.source === "string" && delivery.source.trim().length >= 4
    && delivery.source.length <= 160, "delivery.source 不合法。");
  expectUniqueStringArray(delivery.tags, "delivery.tags");
  expect(delivery.tags.length >= 1 && delivery.tags.length <= 16,
    "delivery.tags 必须包含 1–16 项。");
  expect(delivery.tags.includes("工具雷达"), "delivery.tags 必须包含“工具雷达”。");
  expect(Array.isArray(delivery.tools) && delivery.tools.length === run.tools.length,
    "delivery.tools 必须与顶层 tools 一一对应。");
  for (const [index, identity] of delivery.tools.entries()) {
    assertObject(identity, `delivery.tools[${index}]`);
    assertExactKeys(identity, ["toolKey", "canonicalUrl", "name"],
      `delivery.tools[${index}]`);
    const tool = run.tools[index];
    expect(identity.toolKey === tool.toolKey
      && identity.canonicalUrl === tool.canonicalUrl
      && identity.name === tool.name,
    `delivery.tools[${index}] 与顶层工具身份不一致。`);
  }
  assertObject(delivery.translations, "delivery.translations");
  assertExactKeys(delivery.translations, LANGUAGES, "delivery.translations");
  for (const lang of LANGUAGES) {
    const translation = delivery.translations[lang];
    assertObject(translation, `delivery.translations.${lang}`);
    assertExactKeys(translation, ["title", "summary", "content_markdown"],
      `delivery.translations.${lang}`);
    const expectedTitle = `${ARTICLE_RULES[lang].titlePrefix}${run.theme[lang]}`;
    expect(translation.title === expectedTitle,
      `${lang} 标题必须精确为“栏目名 + 本期主题”：${expectedTitle}`);
    validatePublicTitleContract(translation.title, {
      lang,
      toolCount: run.tools.length
    });
    expect(typeof translation.summary === "string"
      && translation.summary.trim().length >= 20
      && translation.summary.length <= 500,
    `${lang} summary 必须为 20–500 字符。`);
  }
}

function validateArticleTranslation(translation, { lang, run }) {
  const rules = ARTICLE_RULES[lang];
  const content = String(translation.content_markdown || "").replace(/\r\n?/g, "\n").trim();
  expect(content.length >= 400 && content.length <= 250_000,
    `${lang} content_markdown 长度不合法。`);
  expect(!/<\/?(?:script|style|iframe|object|embed|svg|form|input|button|video|audio)\b/i.test(content),
    `${lang} 正文禁止原始危险 HTML。`);
  const lines = content.split("\n");
  const nonEmptyLines = lines.filter((line) => line.trim());
  expect(nonEmptyLines[0] === `# ${translation.title}`,
    `${lang} 正文第一行必须是与 title 完全一致的一级标题。`);
  expect(lines.filter((line) => /^# /.test(line)).length === 1,
    `${lang} 正文只能有一个一级标题。`);

  const h2 = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^## /.test(line) && !/^### /.test(line));
  expect(h2.length === 2, `${lang} 正文必须恰好包含两个二级栏目。`);
  const h2Titles = h2.map(({ line }) => line.slice(3).trim());
  for (const [index, title] of h2Titles.entries()) {
    expect([...title].length >= 2 && [...title].length <= 120,
      `${lang} 第 ${index + 1} 个二级栏目标题必须为 2–120 个字符。`);
    expect(!rules.legacySectionHeadings.includes(title),
      `${lang} 二级栏目不得套用旧固定栏目文案“${title}”。`);
  }
  expect(new Set(h2Titles).size === h2Titles.length,
    `${lang} 两个二级栏目标题不能重复。`);

  const allH3 = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^### /.test(line));
  const h3 = allH3.filter(({ index }) =>
    index > h2[0].index && index < h2[1].index);
  const expectedNames = run.tools.map((tool) => tool.displayNames[lang]);
  expect(allH3.length === expectedNames.length,
    `${lang} 所有工具三级标题都必须位于两个二级栏目之间。`);
  expect(h3.length === expectedNames.length,
    `${lang} 每个工具必须恰好有一个三级标题。`);
  for (const [index, heading] of h3.entries()) {
    validateToolHeading(heading.line.slice(4).trim(), expectedNames[index], {
      lang,
      index
    });
  }
  const intro = lines.slice(h2[0].index + 1, h3[0].index).join("\n").trim();
  const introParagraphs = intro
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => isNarrativeParagraph(paragraph));
  expect([...intro].length >= 60 && introParagraphs.length === 2,
    `${lang} 开场导语必须位于首个二级栏目之后，并恰好包含两段自然短文。`);
  const closing = lines.slice(h2[1].index + 1).join("\n").trim();
  expect(closing.length >= 30, `${lang} 本期选择建议过短。`);

  const allowedCanonicalUrls = new Set(
    run.tools.map((tool) => normalizeComparableUrl(validateHttpsUrl(tool.canonicalUrl, "canonicalUrl")))
  );
  const linkMatches = [...content.matchAll(/(?<!!)\[[^\]]+\]\((https:\/\/[^)\s]+)\)/g)];
  expect(linkMatches.length === run.tools.length,
    `${lang} 每个工具必须恰好包含一个规范化官网链接。`);
  for (const match of linkMatches) {
    const url = validateHttpsUrl(match[1], `${lang} 正文链接`);
    expect(allowedCanonicalUrls.has(normalizeComparableUrl(url)),
      `${lang} 正文只允许链接本期工具的 canonicalUrl。`);
  }
  const strippedLinks = content.replace(/!?\[[^\]]*\]\([^)]+\)/g, "");
  expect(!/https?:\/\//i.test(strippedLinks),
    `${lang} 正文禁止裸网址或未登记的外链。`);

  const allImagePaths = [];
  for (const [index, heading] of h3.entries()) {
    const blockEnd = index + 1 < h3.length ? h3[index + 1].index : h2[1].index;
    const block = lines.slice(heading.index + 1, blockEnd).join("\n").trim();
    expect(block.length >= 160, `${lang} 的 ${expectedNames[index]} 介绍过短。`);
    const expectedImages = normalizeToolImages(run.tools[index].image);
    const blockLines = block.split("\n");
    const practicalDetailsLines = blockLines.filter((line) =>
      isPracticalDetailsLine(line, rules.practicalDetailsLabel));
    expect(practicalDetailsLines.length === 1,
      `${lang} 的 ${expectedNames[index]} 必须恰好包含一行“${rules.practicalDetailsLabel}”。`);
    const practicalDetailsLine = practicalDetailsLines[0];
    for (const label of rules.practicalDetailFields) {
      expect(
        practicalDetailsLine.includes(`${label}：`)
          || practicalDetailsLine.includes(`${label}:`),
        `${lang} 的 ${expectedNames[index]} “${rules.practicalDetailsLabel}”缺少“${label}”。`
      );
    }
    const checklistLines = blockLines.filter((line) =>
      /^\s*[-*+]\s+\*\*[^*\r\n]{1,80}[：:]\*\*/u.test(line));
    expect(checklistLines.length <= 3,
      `${lang} 的 ${expectedNames[index]} 不得退回大量“- **字段：**”验收清单。`);
    const narrativeParagraphs = block
      .split(/\n\s*\n/u)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => isNarrativeParagraph(
        paragraph,
        rules.practicalDetailsLabel,
        expectedImages.map((image) => image.caption[lang])
      ));
    expect(narrativeParagraphs.length === 3,
      `${lang} 的 ${expectedNames[index]} 恰好需要三段自然叙事：第一段说明“是什么/能做什么”，第二段说明“省什么/怎么开始”，第三段说明“案例/适用/限制”。`);
    const canonical = normalizeComparableUrl(
      validateHttpsUrl(run.tools[index].canonicalUrl, "canonicalUrl")
    );
    const blockLinks = [...block.matchAll(/(?<!!)\[[^\]]+\]\((https:\/\/[^)\s]+)\)/g)];
    expect(blockLinks.length === 1
      && normalizeComparableUrl(validateHttpsUrl(blockLinks[0][1], `${lang} 官网链接`)) === canonical,
    `${lang} 的 ${expectedNames[index]} 官网链接必须精确对应 canonicalUrl。`);

    const images = [...block.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)];
    if (expectedImages.length === 0) {
      expect(images.length === 0, `${lang} 的 ${expectedNames[index]} 未登记图片却引用了图片。`);
    } else {
      expect(images.length === expectedImages.length,
        `${lang} 的 ${expectedNames[index]} 必须按登记数量引用 1–2 张图片。`);
      for (const [imageIndex, expectedImage] of expectedImages.entries()) {
        expect(images[imageIndex][2] === expectedImage.assetPath,
          `${lang} 的 ${expectedNames[index]} 第 ${imageIndex + 1} 张图片路径或顺序与登记不一致。`);
        expect(images[imageIndex][1] === expectedImage.alt[lang],
          `${lang} 的 ${expectedNames[index]} 第 ${imageIndex + 1} 张图片 alt 与登记不一致。`);
        const afterImage = block.slice(images[imageIndex].index + images[imageIndex][0].length);
        const captionMatch = afterImage.match(
          /^(?:\r?\n[ \t]*)+\*([^*\r\n]+)\*(?=\r?\n|$)/u
        );
        expect(
          captionMatch?.[1] === expectedImage.caption[lang],
          `${lang} 的 ${expectedNames[index]} 第 ${imageIndex + 1} 张图片后的下一非空行必须是登记的单行斜体 caption。`
        );
        allImagePaths.push(images[imageIndex][2]);
      }
    }
  }
  const globalImages = [...content.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)];
  expect(globalImages.length === allImagePaths.length,
    `${lang} 正文含工具区之外的图片或图片数量不一致。`);
  for (const image of globalImages) {
    expect(/^assets\/images\/articles\/tool-radar\/[a-z0-9._/-]+\.(png|jpe?g|webp)$/i
      .test(image[2]), `${lang} 正文图片必须是站内 tool-radar 文章资产，禁止热链。`);
  }
}

function validatePublicTitleContract(title, { lang, toolCount }) {
  const rules = ARTICLE_RULES[lang];
  const exactCountPattern = new RegExp(`(?:^|[^0-9])${toolCount}(?:[^0-9]|$)`, "u");
  expect(exactCountPattern.test(title),
    `${lang} 标题必须包含与本期工具数完全一致的阿拉伯数字 ${toolCount}，不能把它藏在其他数字中。`);
  expect(rules.painSignals.some((pattern) => pattern.test(title)),
    `${lang} 标题必须明确写出读者正在遇到的痛点，不能只写抽象主题。`);
  const matchedScopeCount = rules.scopeSignals
    .filter((pattern) => pattern.test(title))
    .length;
  expect(matchedScopeCount >= 2,
    `${lang} 标题必须点明至少两个具体任务范围或收益（如设计、动效、视频、代码、本地 AI），不能只写“工具”。`);
}

function validateToolHeading(heading, expectedName, { lang, index }) {
  expect(heading.startsWith(expectedName),
    `${lang} 第 ${index + 1} 个工具标题必须以“${expectedName}”开头，且顺序与运行记录一致。`);
  const remainder = heading.slice(expectedName.length).trimStart();
  const separatorMatch = remainder.match(/^(?:[|｜:：]|[-–—])\s*(.+)$/u);
  expect(Boolean(separatorMatch),
    `${lang} 的 ${expectedName} 标题必须在工具名后补充简短利益点。`);
  const subtitle = separatorMatch?.[1]?.trim() || "";
  expect([...subtitle].length >= 2 && [...subtitle].length <= 100,
    `${lang} 的 ${expectedName} 标题利益点必须为 2–100 个字符。`);
}

function isPracticalDetailsLine(line, label) {
  const trimmed = String(line || "").trim();
  return trimmed.startsWith(`**${label}：**`)
    || trimmed.startsWith(`**${label}:**`);
}

function isNarrativeParagraph(
  paragraph,
  practicalDetailsLabel = "",
  registeredImageCaptions = []
) {
  if (!paragraph || (practicalDetailsLabel
    && (paragraph.includes(`**${practicalDetailsLabel}：**`)
      || paragraph.includes(`**${practicalDetailsLabel}:**`)))) {
    return false;
  }
  if (registeredImageCaptions.some((caption) => paragraph === `*${caption}*`)) {
    return false;
  }
  const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0 || lines.some((line) =>
    /^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```|~~~|\|)/u.test(line)
    || /^!\[[^\]]*\]\([^)]+\)$/u.test(line))) {
    return false;
  }
  const plainText = paragraph
    .replace(/!?\[([^\]]*)\]\([^)]+\)/gu, "$1")
    .replace(/[*_`~]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  return [...plainText].length >= 30;
}

function parseExecutionTime(value, label, edition) {
  const date = parseIso(value, label);
  expect(date.getTime() >= edition.scheduledAtDate.getTime(),
    `${label} 不能早于本期周二 22:00。`);
  expect(date.getTime() < edition.nextScheduledAtDate.getTime(),
    `${label} 必须在下一期开始前完成。`);
  return date;
}

function parseIso(value, label) {
  expect(typeof value === "string" && value.trim() === value, `${label} 必须是 ISO 时间字符串。`);
  const date = new Date(value);
  expect(Number.isFinite(date.getTime()), `${label} 不是有效时间。`);
  return date;
}

function shanghaiParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: values.hour,
    weekday: values.weekday
  };
}

function normalizeOfficialHost(hostname) {
  return String(hostname || "").toLowerCase().replace(/^www\./, "");
}

function validateToolKey(value, label) {
  expect(
    /^[a-z0-9.-]+\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ""))
      && String(value).length <= 180,
    `${label} 必须使用 <normalized-official-host>/<product-slug>。`
  );
}

function validateHttpsUrl(value, label, { canonical = false } = {}) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new Error(`${label} 不是有效 URL。`);
  }
  expect(url.protocol === "https:", `${label} 必须使用 HTTPS。`);
  expect(!url.username && !url.password, `${label} 禁止包含凭证。`);
  expect(!url.hash, `${label} 禁止包含 hash。`);
  if (canonical) {
    expect(!url.search, `${label} 规范地址禁止查询参数。`);
  }
  return url;
}

function normalizeComparableUrl(value) {
  const url = value instanceof URL ? new URL(value.toString()) : new URL(String(value));
  url.hostname = normalizeOfficialHost(url.hostname);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

function validateLocalizedText(value, label, { min, max }) {
  assertObject(value, label);
  assertExactKeys(value, LANGUAGES, label);
  for (const lang of LANGUAGES) {
    expect(typeof value[lang] === "string"
      && value[lang].trim().length >= min
      && value[lang].length <= max,
    `${label}.${lang} 长度不合法。`);
  }
}

function assertObject(value, label) {
  expect(Boolean(value) && typeof value === "object" && !Array.isArray(value),
    `${label} 必须是对象。`);
}

function assertExactKeys(value, expectedKeys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  expect(JSON.stringify(actual) === JSON.stringify(expected),
    `${label} 字段不符合契约；期望 ${expected.join(", ")}。`);
}

function expectUniqueStringArray(value, label) {
  expect(Array.isArray(value), `${label} 必须是数组。`);
  expect(value.every((item) => typeof item === "string" && item.trim()),
    `${label} 只能包含非空字符串。`);
  expect(new Set(value).size === value.length, `${label} 含重复项。`);
}

function expectSameSet(actual, expected, message) {
  expect(
    actual.length === expected.length
      && [...actual].sort().every((value, index) => value === [...expected].sort()[index]),
    message
  );
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const args = parseValidateArgs();
  const result = await readAndValidateRun(args.runPath);
  console.log(
    `tool-radar-validation: ok (${result.editionId}, tools=${result.selectedToolCount})`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
