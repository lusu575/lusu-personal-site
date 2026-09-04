import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_RUN = resolve(import.meta.dirname, "runs", "2026-07-27-2300.json");
const FORMAL_SCHEMA_VERSION = 4;
const HISTORICAL_SCHEMA_VERSION = 3;
const COVERAGE_MANIFEST_SCHEMA_VERSION = 2;
const LEGACY_COVERAGE_MANIFEST_SCHEMA_VERSION = 1;
const LEGACY_COVERAGE_MANIFEST = Object.freeze({
  runId: "run-20260728T014353Z-c4ddc43d",
  reportDate: "2026-07-28",
  candidateIndexPath:
    "data/mcp-runs/run-20260728T014353Z-c4ddc43d/candidate_index.json",
  coverageManifestPath:
    "data/mcp-runs/run-20260728T014353Z-c4ddc43d/coverage_manifest.json",
  candidateIndexSha256:
    "4753e8e6e8f81f82fda305e33adfd3ab9ea5e9bb9f16c60c621e6764747283cd"
});
const CANDIDATE_ARTIFACT_SCHEMA_VERSION = 2;
const CANDIDATE_INDEX_SCHEMA_VERSION = 1;
const MINIMUM_SELECTED_STORIES = 5;
const MINIMUM_SELECTED_STORIES_EFFECTIVE_DATE = "2026-08-10";
const MINIMUM_RUMOR_STORIES = 0;
const RELAXED_RUMOR_POLICY_EFFECTIVE_DATE = "2026-08-13";
const LOWER_RUMOR_GATE_EFFECTIVE_DATE = "2026-08-24";
const CONFIRMED_STORY_MINIMUM_SCORE = 6;
const LEGACY_RUMOR_STORY_MINIMUM_SCORE = 6;
const RUMOR_STORY_MINIMUM_SCORE = 5;
const LOW_VOLUME_TRIGGER = MINIMUM_SELECTED_STORIES;
const PRODUCTION_WINDOW_END_LOCAL_TIME = "07:00";
const CONTINUOUS_WINDOW_POLICY = "previous-collection-start-to-current-execution-start-v2";
const CONTINUOUS_WINDOW_EFFECTIVE_DATE = "2026-09-04";
const MAX_CONTINUOUS_WINDOW_MS = 48 * 60 * 60 * 1000;
const HISTORICAL_ONE_SHOT_WINDOW = Object.freeze({
  reportDate: "2026-07-27",
  windowStart: "2026-07-26T23:00:00+08:00",
  windowEnd: "2026-07-27T23:00:00+08:00"
});
const LANGUAGES = ["zh", "en", "ja"];
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDEMPOTENCY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,119}$/;
const URL_PATTERN = /(?:https?:\/\/|www\.|mailto:|\[[^\]]+]\(\s*(?!#)[^)]+\)|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|org|net|io|ai|cn|co|dev|app|tech|news|jp)(?:\/[^\s]*)?)/i;
const REFERENCE_HEADING_PATTERN = /^#{1,6}\s*(?:参考|来源|相关阅读|参考资料|sources?|references?|further reading|出典|参考文献|関連リンク)\s*$/im;
const SECTION_ORDER = ["lead", "main", "rumor"];
const VERIFICATION_VALUES = new Set(["confirmed", "unverified"]);
const DEDUPE_DECISIONS = new Set(["new", "material-update", "duplicate"]);
const PRIORITY_REVIEW_DECISIONS = new Set(["selected", "merged", "rejected"]);
const PRIORITY_EDITORIAL_CLASSES = new Set([
  "major-model-product",
  "capability-availability",
  "usage-policy",
  "developer-tool",
  "material-price-quota",
  "strategic-hardware-infrastructure",
  "major-tech-finance",
  "ai-policy-safety",
  "other"
]);
const PROTECTED_PRIORITY_EDITORIAL_CLASSES = new Set([
  "major-model-product",
  "capability-availability",
  "usage-policy",
  "developer-tool",
  "material-price-quota",
  "strategic-hardware-infrastructure",
  "major-tech-finance",
  "ai-policy-safety"
]);
const USAGE_POLICY_EDITORIAL_CLASSES = new Set([
  "usage-policy",
  "material-price-quota"
]);
const USAGE_POLICY_CHANGE_SIGNAL = "usage-policy-change";
const MAJOR_MODEL_CHANGE_SIGNAL = "major-model-product-change";
const CAPABILITY_AVAILABILITY_CHANGE_SIGNAL = "capability-availability-change";
const DEVELOPER_TOOL_CHANGE_SIGNAL = "developer-tool-change";
const MATERIAL_PRICE_QUOTA_CHANGE_SIGNAL = "material-price-quota-change";
const STRATEGIC_TECH_CHANGE_SIGNAL = "strategic-hardware-infrastructure-change";
const MAJOR_TECH_FINANCE_CHANGE_SIGNAL = "major-tech-finance-change";
const AI_POLICY_SAFETY_CHANGE_SIGNAL = "ai-policy-safety-change";
const PRIORITY_REVIEW_POLICY = "all-discovered-candidates";
const PRIORITY_DISCOVERY_REVIEW_LANE = "complete-discovery-review";
const PROTECTED_EVENT_REVIEW_POLICY = "evidence-backed-protected-events-v1";
const PROTECTED_EVENT_REVIEW_EFFECTIVE_DATE = "2026-08-07";
const PROTECTED_EVENT_VERIFICATION_STATUSES = new Set([
  "verified-in-window",
  "verified-outside-window",
  "insufficient-evidence"
]);
const PROTECTED_EVENT_DISPOSITIONS = new Set(["selected", "rejected"]);
const RUMOR_EVIDENCE_BASES = new Set([
  "attributed-first-party-teaser",
  "two-independent-reliable-reports",
  "one-attributed-reliable-report"
]);
const DEGENERATE_REVIEW_MIN_CANDIDATES = 50;
const DEGENERATE_SCORE_TEMPLATE_RATIO = 0.9;
const DEGENERATE_SCORE_PALETTE_MAX = 8;

function rumorMinimumScore(reportDate) {
  return reportDate >= LOWER_RUMOR_GATE_EFFECTIVE_DATE
    ? RUMOR_STORY_MINIMUM_SCORE
    : LEGACY_RUMOR_STORY_MINIMUM_SCORE;
}
const DEGENERATE_NARRATIVE_PALETTE_MAX = 32;
const PROTECTED_EVENT_MIN_SUMMARY_LENGTH = 24;
const PROTECTED_EVENT_MIN_RATIONALE_LENGTH = 12;
const PRIORITY_REJECTION_REASONS = new Set([
  "insufficient-evidence",
  "below-importance-threshold",
  "routine-or-promotional",
  "outside-editorial-scope",
  "outside-publication-window",
  "no-material-change"
]);
const DISCOVERY_ONLY_EVIDENCE_HOSTS = new Set([
  "news.google.com",
  "news.ycombinator.com",
  "reddit.com",
  "bing.com"
]);
const INTERNAL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const AI_TAKE_MIN_LENGTH = 12;
const AI_TAKE_MAX_LENGTH = 240;
const ARTICLE_STRUCTURE = {
  zh: {
    sectionHeadings: {
      lead: "今日要闻",
      main: "主要新闻",
      rumor: "传闻"
    },
    aiTakeMarker: "**AI 解读：**",
    forbiddenRumorLabelPattern: /^\*\*(?:核实状态|确认状态)[：:]/,
    forbiddenRepeatedRumorWordingPattern: /未获?官方证实|尚未(?:得到|获得)?(?:官方)?确认|待核实/,
    rumorConditionalPattern: /据(?:报道|悉|[^，。；\n]{1,24}报道)|可能|或将|正在商谈|计划|预计|传出|有望|若|拟/,
    genericAiTakePattern: /^(?:这(?:条|项)(?:新闻|消息)?(?:很|非常)?)?(?:值得关注|影响很大|意义重大|未来可期)[。！!]?$/i
  },
  en: {
    sectionHeadings: {
      lead: "Lead Story",
      main: "More News",
      rumor: "Rumors"
    },
    aiTakeMarker: "**AI take:**",
    forbiddenRumorLabelPattern: /^\*\*(?:verification status|confirmation status)[：:]/i,
    forbiddenRepeatedRumorWordingPattern: /\bunconfirmed\b|\bunverified\b|not (?:officially )?confirmed/i,
    rumorConditionalPattern: /\breportedly\b|\bmay\b|\bmight\b|\bcould\b|in talks|\bplans?\b|\baims?\b|\bif\b/i,
    genericAiTakePattern: /^(?:this (?:news|development|story) (?:is )?)?(?:worth watching|very important|highly significant)[.!]?$/i
  },
  ja: {
    sectionHeadings: {
      lead: "今日のトップニュース",
      main: "主なニュース",
      rumor: "噂"
    },
    aiTakeMarker: "**AI解説：**",
    forbiddenRumorLabelPattern: /^\*\*(?:確認状況|検証状況)[：:]/,
    forbiddenRepeatedRumorWordingPattern: /未確認|公式確認なし|確認されていない/,
    rumorConditionalPattern: /報じられ|報道によると|可能性|かもしれ|計画|協議|予定|見込み|実現すれば/,
    genericAiTakePattern: /^(?:この(?:ニュース|動き)は)?(?:注目に値します|影響が大きいです|非常に重要です)[。！!]?$/i
  }
};

export async function readAndValidateRun(path = DEFAULT_RUN, options = {}) {
  const absolutePath = resolve(path);
  const run = JSON.parse(await readFile(absolutePath, "utf8"));
  validateRun(run, options);
  await validateHorizonProvenance(
    run,
    resolveValidationHorizonRoot(run, options)
  );
  return { run, absolutePath };
}

function resolveValidationHorizonRoot(
  run,
  { allowHistoricalOneShot = false, historicalProvenanceRoot } = {}
) {
  const defaultRoot = resolve(import.meta.dirname, "..", "..");
  if (historicalProvenanceRoot === undefined) {
    return defaultRoot;
  }
  if (
    allowHistoricalOneShot !== true
    || run.schemaVersion !== HISTORICAL_SCHEMA_VERSION
    || !isHistoricalOneShotWindow(run)
  ) {
    throw new Error(
      "historicalProvenanceRoot 只允许用于已登记的 schemaVersion 3 历史 one-shot。"
    );
  }
  return resolve(String(historicalProvenanceRoot));
}

export function validateRun(run, { allowHistoricalOneShot = false } = {}) {
  const errors = [];
  if (!run || typeof run !== "object" || Array.isArray(run)) {
    throw new Error("运行记录必须是 JSON 对象。");
  }
  const isAllowedHistoricalSchema = run.schemaVersion === HISTORICAL_SCHEMA_VERSION
    && allowHistoricalOneShot
    && isHistoricalOneShotWindow(run);
  const isFormalSchema = run.schemaVersion === FORMAL_SCHEMA_VERSION;
  if (!isFormalSchema && !isAllowedHistoricalSchema) {
    errors.push(
      `正式运行记录必须使用每日 AI 新闻 schemaVersion ${FORMAL_SCHEMA_VERSION}；`
      + `schemaVersion ${HISTORICAL_SCHEMA_VERSION} 只兼容显式历史 one-shot。`
    );
  }

  const reportDate = String(run.reportDate || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    errors.push("reportDate 必须是 YYYY-MM-DD。");
  }
  if (run.timezone !== "Asia/Shanghai") {
    errors.push("timezone 必须是 Asia/Shanghai。");
  }
  const windowStart = parseTimestamp(run.windowStart);
  const windowEnd = parseTimestamp(run.windowEnd);
  if (windowStart === null || windowEnd === null) {
    errors.push("windowStart 和 windowEnd 必须是带时区的有效时间。");
  }
  const usesContinuousWindow = reportDate >= CONTINUOUS_WINDOW_EFFECTIVE_DATE;
  const isLegacyProductionWindow = run.windowStart === `${shiftIsoDate(reportDate, -1)}T07:00:00+08:00`
    && run.windowEnd === `${reportDate}T${PRODUCTION_WINDOW_END_LOCAL_TIME}:00+08:00`;
  const isContinuousWindow = windowStart !== null
    && windowEnd !== null
    && windowEnd > windowStart
    && windowEnd - windowStart < MAX_CONTINUOUS_WINDOW_MS
    && String(run.windowStart || "").endsWith("+08:00")
    && String(run.windowEnd || "").endsWith("+08:00")
    && shanghaiDateFromTimestamp(windowStart) === shiftIsoDate(reportDate, -1)
    && shanghaiDateFromTimestamp(windowEnd) === reportDate
    && run.windowPolicy === CONTINUOUS_WINDOW_POLICY
    && run.previousCollectionStartedAt === run.windowStart
    && run.collectionStartedAt === run.windowEnd
    && /^run-\d{8}T\d{6}Z-[a-z0-9]+$/.test(String(run.previousCollectionRunId || ""))
    && /^run-\d{8}T\d{6}Z-[a-z0-9]+$/.test(String(run.collectionAnchorRunId || ""));
  const isAllowedHistoricalWindow = allowHistoricalOneShot
    && run.schemaVersion === HISTORICAL_SCHEMA_VERSION
    && isHistoricalOneShotWindow(run);
  if (usesContinuousWindow && !isContinuousWindow) {
    errors.push(
      "正式每日工作流必须使用前一日保存的采集启动时刻至本轮实际启动时刻的连续半开窗口，"
      + "并携带可核对的采集锚点。"
    );
  } else if (!usesContinuousWindow && !isLegacyProductionWindow && !isAllowedHistoricalWindow) {
    errors.push(
      "正式每日工作流必须使用北京时间前一日 07:00 至当日 07:00 的固定 24 小时窗口；"
      + "历史 2026-07-27 23:00 样稿只允许通过显式 one-shot 参数验证。"
    );
  }
  if (!String(run.collectionMethod || "").startsWith("Horizon native fetch")) {
    errors.push("collectionMethod 必须声明 Horizon 原生抓取。");
  }
  if (!/^run-\d{8}T\d{6}Z-[a-z0-9]+$/.test(String(run.horizonRun?.runId || ""))) {
    errors.push("缺少有效的 Horizon runId。");
  }
  if (usesContinuousWindow && run.collectionAnchorRunId !== run.horizonRun?.runId) {
    errors.push("本轮采集锚点 run id 必须与 Horizon runId 一致。");
  }
  if (!String(run.horizonRun?.candidatesPath || "").startsWith("data/mcp-runs/")) {
    errors.push("缺少 Horizon daily_candidates.json 路径。");
  }
  if (isFormalSchema
    && !String(run.horizonRun?.candidateIndexPath || "").startsWith("data/mcp-runs/")) {
    errors.push("正式运行缺少 Horizon candidate_index.json 路径。");
  }
  if (isFormalSchema
    && !String(run.horizonRun?.coverageManifestPath || "").startsWith("data/mcp-runs/")) {
    errors.push("正式运行缺少 Horizon coverage_manifest.json 路径。");
  }

  const threshold = Number(run.selection?.importanceThreshold);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 10) {
    errors.push("重要性门槛必须是 0 至 10 的数字。");
  }
  if (reportDate >= RELAXED_RUMOR_POLICY_EFFECTIVE_DATE
    && threshold !== CONFIRMED_STORY_MINIMUM_SCORE) {
    errors.push(
      `已确认新闻重要性门槛必须是 ${CONFIRMED_STORY_MINIMUM_SCORE}。`
    );
  }
  const rumorThreshold = reportDate >= RELAXED_RUMOR_POLICY_EFFECTIVE_DATE
    ? Number(run.selection?.rumorImportanceThreshold)
    : threshold;
  const expectedRumorThreshold = rumorMinimumScore(reportDate);
  if (reportDate >= RELAXED_RUMOR_POLICY_EFFECTIVE_DATE
    && rumorThreshold !== expectedRumorThreshold) {
    errors.push(
      `传闻重要性门槛必须是 ${expectedRumorThreshold}，`
      + `已确认新闻仍使用 ${CONFIRMED_STORY_MINIMUM_SCORE} 分门槛。`
    );
  }
  if (run.selection?.maxItems !== null) {
    errors.push("maxItems 必须为 null，新闻数量不能写死。");
  }

  const candidates = Array.isArray(run.candidates) ? run.candidates : [];
  if (!candidates.length) {
    errors.push("至少需要一条候选记录。");
  }

  const storyKeys = new Set();
  const selectedEventStages = new Set();
  const selected = [];
  for (const [index, item] of candidates.entries()) {
    const label = `候选 ${index + 1}`;
    const storyKey = String(item?.storyKey || "");
    if (!INTERNAL_ID_PATTERN.test(storyKey)) {
      errors.push(`${label} 的 storyKey 不正确。`);
    } else if (storyKeys.has(storyKey)) {
      errors.push(`${label} 与其他候选重复使用 storyKey。`);
    } else {
      storyKeys.add(storyKey);
    }
    if (isFormalSchema) {
      validateEventDedupe(item, label, errors);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(item?.publishedDate || ""))) {
      errors.push(`${label} 缺少可核对的发布日期。`);
    }
    const importance = Number(item?.importance);
    if (!Number.isFinite(importance) || importance < 0 || importance > 10) {
      errors.push(`${label} 的重要性评分必须在 0 至 10 之间。`);
    }
    const sourceUrls = Array.isArray(item?.sourceUrls) ? item.sourceUrls : [];
    if (!sourceUrls.length || sourceUrls.some((url) => !isHttpsUrl(url))) {
      errors.push(`${label} 必须在内部记录至少一个 HTTPS 核验来源。`);
    }
    if (item?.selected === true) {
      selected.push(item);
      if (isFormalSchema) {
        const eventStageKey = `${item.eventKey}:${item.eventStage}`;
        if (selectedEventStages.has(eventStageKey)) {
          errors.push(`${label} 与其他入选候选重复使用 eventKey + eventStage。`);
        }
        selectedEventStages.add(eventStageKey);
      }
      const publishedAt = parseTimestamp(item?.publishedAt);
      if (publishedAt === null) {
        errors.push(`${label} 缺少带时区的准确发布时间 publishedAt。`);
      } else if (windowStart !== null && windowEnd !== null
        && (publishedAt < windowStart || publishedAt >= windowEnd)) {
        errors.push(`${label} 不在发布前 24 小时窗口内。`);
      }
      const selectedThreshold = reportDate >= RELAXED_RUMOR_POLICY_EFFECTIVE_DATE
        && item?.section === "rumor"
        ? expectedRumorThreshold
        : threshold;
      if (importance < selectedThreshold) {
        errors.push(`${label} 低于重要性门槛却被选入。`);
      }
      if (!String(item?.whyWorth || "").trim()) {
        errors.push(`${label} 缺少“为什么值得讲”的内部判断。`);
      }
      validateSelectedCandidate(item, label, errors);
    }
  }

  if (reportDate >= MINIMUM_SELECTED_STORIES_EFFECTIVE_DATE
    && selected.length < MINIMUM_SELECTED_STORIES) {
    errors.push(
      `本运行只有 ${selected.length} 条入选新闻，少于站长规定的最低 ${MINIMUM_SELECTED_STORIES} 条；`
      + "必须停止投递并排查发现、核验或编辑链路，不能生成或发布低于最低数量的文章。"
    );
  }
  const sectionCounts = countSelectedSections(selected);
  if (sectionCounts.lead !== 1) {
    errors.push("入选新闻必须恰好包含一条 section 为 lead 的今日要闻。");
  }
  const declaredKeys = Array.isArray(run.selection?.selectedStoryKeys)
    ? run.selection.selectedStoryKeys.map(String)
    : [];
  const actualKeys = selected.map((item) => item.storyKey);
  if (!sameStringSet(declaredKeys, actualKeys)) {
    errors.push("selectedStoryKeys 与实际入选候选不一致。");
  }
  if (isFormalSchema) {
    validateCoverageAudit(run.coverageAudit, selected.length, errors);
  }

  validateDelivery(run.delivery, reportDate, sectionCounts, errors, {
    allowLegacyDateTitle: isAllowedHistoricalSchema
  });
  if (errors.length) {
    throw new Error(`每日 AI 新闻草稿验证失败：\n- ${errors.join("\n- ")}`);
  }
  return run;
}

function validateEventDedupe(item, label, errors) {
  const eventKey = String(item?.eventKey || "");
  const eventStage = String(item?.eventStage || "");
  const dedupeDecision = String(item?.dedupeDecision || "");
  if (!INTERNAL_ID_PATTERN.test(eventKey)) {
    errors.push(`${label} 缺少有效的 eventKey。`);
  }
  if (!INTERNAL_ID_PATTERN.test(eventStage)) {
    errors.push(`${label} 缺少有效的 eventStage。`);
  }
  if (!DEDUPE_DECISIONS.has(dedupeDecision)) {
    errors.push(`${label} 的 dedupeDecision 必须是 new、material-update 或 duplicate。`);
  }
  if (item?.selected === true && dedupeDecision === "duplicate") {
    errors.push(`${label} 已判定为 duplicate，不得入选。`);
  }
  if (dedupeDecision === "material-update") {
    if (!INTERNAL_ID_PATTERN.test(String(item?.priorStoryKey || ""))) {
      errors.push(`${label} 的 material-update 必须填写 priorStoryKey。`);
    }
    if (!String(item?.materialDifference || "").trim()) {
      errors.push(`${label} 的 material-update 必须说明 materialDifference。`);
    }
  }
}

function validateCoverageAudit(audit, selectedCount, errors) {
  if (!audit || typeof audit !== "object" || Array.isArray(audit)) {
    errors.push("schemaVersion 4 正式运行必须提供 coverageAudit。");
    return;
  }
  const candidateIndexReviewedAt = parseTimestamp(audit.candidateIndexReviewedAt);
  if (candidateIndexReviewedAt === null) {
    errors.push("coverageAudit 缺少有效的 candidateIndexReviewedAt。");
  }
  if (!SHA256_PATTERN.test(String(audit.candidateIndexSha256 || ""))) {
    errors.push("coverageAudit 缺少 candidate_index.json 的 SHA-256。");
  }
  if (audit.lowVolumeTrigger !== LOW_VOLUME_TRIGGER) {
    errors.push(`coverageAudit.lowVolumeTrigger 必须为 ${LOW_VOLUME_TRIGGER}。`);
  }
  validateSignoffIds(
    audit.signedOffQueryIds,
    "coverageAudit.signedOffQueryIds",
    errors
  );
  validateSignoffIds(
    audit.signedOffGroupIds,
    "coverageAudit.signedOffGroupIds",
    errors
  );

  const secondPassRequired = selectedCount < LOW_VOLUME_TRIGGER;
  const secondPass = audit.secondPass;
  if (!secondPass || typeof secondPass !== "object" || Array.isArray(secondPass)) {
    errors.push("coverageAudit 缺少 secondPass 记录。");
    return;
  }
  if (secondPass.required !== secondPassRequired) {
    errors.push(
      `coverageAudit.secondPass.required 必须为 ${secondPassRequired}；`
      + `少于 ${LOW_VOLUME_TRIGGER} 条必须完成二次审阅，并在仍不足最低数量时停止投递。`
    );
  }
  if (secondPassRequired) {
    if (secondPass.completed !== true) {
      errors.push(`入选少于 ${LOW_VOLUME_TRIGGER} 条时必须完成 coverageAudit.secondPass。`);
    }
    const secondPassCompletedAt = parseTimestamp(secondPass.completedAt);
    if (secondPassCompletedAt === null) {
      errors.push("二次覆盖审阅缺少有效的 completedAt。");
    } else if (candidateIndexReviewedAt !== null
      && secondPassCompletedAt <= candidateIndexReviewedAt) {
      errors.push("二次覆盖审阅 completedAt 必须严格晚于初审 candidateIndexReviewedAt。");
    }
    validateSignoffIds(
      secondPass.signedOffQueryIds,
      "coverageAudit.secondPass.signedOffQueryIds",
      errors
    );
    validateSignoffIds(
      secondPass.signedOffGroupIds,
      "coverageAudit.secondPass.signedOffGroupIds",
      errors
    );
    if (!sameStringSet(
      stringArray(secondPass.signedOffQueryIds),
      stringArray(audit.signedOffQueryIds)
    )) {
      errors.push("二次覆盖审阅必须重新签收全部 required query。");
    }
    if (!sameStringSet(
      stringArray(secondPass.signedOffGroupIds),
      stringArray(audit.signedOffGroupIds)
    )) {
      errors.push("二次覆盖审阅必须重新签收全部 required coverage group。");
    }
  } else if (secondPass.completed !== false) {
    errors.push(`入选不少于 ${LOW_VOLUME_TRIGGER} 条时 secondPass.completed 应为 false。`);
  }
}

function validateSignoffIds(values, label, errors) {
  const ids = stringArray(values);
  if (!ids.length) {
    errors.push(`${label} 必须是非空数组。`);
    return;
  }
  if (ids.some((value) => !INTERNAL_ID_PATTERN.test(value))) {
    errors.push(`${label} 含有无效编号。`);
  }
  if (new Set(ids).size !== ids.length) {
    errors.push(`${label} 不得重复。`);
  }
}

async function validateHorizonProvenance(run, horizonRoot) {
  const allowedRoot = resolve(horizonRoot, "data", "mcp-runs");
  const candidatesPath = resolveHorizonArtifactPath(
    horizonRoot,
    allowedRoot,
    run.horizonRun.candidatesPath,
    "Horizon 候选文件"
  );
  const { payload: candidates } = await readJsonArtifact(
    candidatesPath,
    "Horizon 候选文件"
  );
  if (candidates.engine !== "Horizon"
    || candidates.horizonRunId !== run.horizonRun.runId
    || candidates.reportDate !== run.reportDate
    || candidates.timezone !== run.timezone
    || candidates.windowStart !== run.windowStart
    || candidates.windowEnd !== run.windowEnd
    || !collectionWindowIdentityMatches(candidates, run)) {
    throw new Error("Horizon 候选文件与运行记录不一致。");
  }

  if (run.schemaVersion === FORMAL_SCHEMA_VERSION) {
    await validateCoverageProvenance({
      run,
      candidates,
      horizonRoot,
      allowedRoot
    });
  }

  const horizonUrls = new Set(
    (Array.isArray(candidates.items) ? candidates.items : [])
      .map((item) => String(item?.url || ""))
      .filter(Boolean)
  );
  for (const item of run.candidates.filter((candidate) => candidate.selected === true)) {
    const matched = item.sourceUrls.some((url) => horizonUrls.has(String(url)));
    if (!matched) {
      throw new Error(`入选新闻 ${item.storyKey} 没有对应的 Horizon 候选。`);
    }
  }
}

async function validateCoverageProvenance({
  run,
  candidates,
  horizonRoot,
  allowedRoot
}) {
  if (candidates.schemaVersion !== CANDIDATE_ARTIFACT_SCHEMA_VERSION) {
    throw new Error(
      `正式 Horizon 候选文件必须使用 schemaVersion ${CANDIDATE_ARTIFACT_SCHEMA_VERSION}。`
    );
  }
  if (candidates.fetchStatus !== "success") {
    throw new Error("Horizon 抓取未完整成功，正式运行必须 fail closed。");
  }
  if (candidates.candidateIndexPath !== run.horizonRun.candidateIndexPath
    || candidates.coverageManifestPath !== run.horizonRun.coverageManifestPath) {
    throw new Error("Horizon 候选文件中的覆盖工件路径与运行记录不一致。");
  }

  const candidateIndexPath = resolveHorizonArtifactPath(
    horizonRoot,
    allowedRoot,
    run.horizonRun.candidateIndexPath,
    "Horizon candidate_index.json"
  );
  const coverageManifestPath = resolveHorizonArtifactPath(
    horizonRoot,
    allowedRoot,
    run.horizonRun.coverageManifestPath,
    "Horizon coverage_manifest.json"
  );
  const { payload: candidateIndex, text: candidateIndexText } = await readJsonArtifact(
    candidateIndexPath,
    "Horizon candidate_index.json"
  );
  const { payload: manifest } = await readJsonArtifact(
    coverageManifestPath,
    "Horizon coverage_manifest.json"
  );

  assertArtifactIdentity(candidateIndex, run, "candidate_index.json");
  assertArtifactIdentity(manifest, run, "coverage_manifest.json");
  for (const [artifact, label] of [
    [candidates, "daily_candidates.json"],
    [candidateIndex, "candidate_index.json"],
    [manifest, "coverage_manifest.json"]
  ]) {
    validateLanguagePolicyArtifact(artifact, label);
  }
  if (candidateIndex.schemaVersion !== CANDIDATE_INDEX_SCHEMA_VERSION) {
    throw new Error("candidate_index.json schemaVersion 不正确。");
  }
  const isRegisteredLegacyManifest = isRegisteredLegacyCoverageManifest(
    run,
    manifest
  );
  if (manifest.schemaVersion !== COVERAGE_MANIFEST_SCHEMA_VERSION
    && !isRegisteredLegacyManifest) {
    throw new Error(
      `coverage_manifest.json 必须使用 schemaVersion ${COVERAGE_MANIFEST_SCHEMA_VERSION}；`
      + `schemaVersion ${LEGACY_COVERAGE_MANIFEST_SCHEMA_VERSION} 仅兼容已登记的 `
      + `${LEGACY_COVERAGE_MANIFEST.runId} 历史产物。`
    );
  }
  if (manifest.fetchStatus !== "success") {
    throw new Error("coverage_manifest.json 未确认完整抓取。");
  }
  if (manifest.lowVolumeTrigger !== LOW_VOLUME_TRIGGER
    || candidates.lowVolumeTrigger !== LOW_VOLUME_TRIGGER
    || run.coverageAudit.lowVolumeTrigger !== LOW_VOLUME_TRIGGER) {
    throw new Error(`低产出二次审阅触发值必须统一为 ${LOW_VOLUME_TRIGGER}。`);
  }

  const candidateIndexSha256 = createHash("sha256")
    .update(candidateIndexText, "utf8")
    .digest("hex");
  if (candidateIndexSha256 !== candidates.candidateIndexSha256
    || candidateIndexSha256 !== manifest.candidateIndexSha256
    || candidateIndexSha256 !== run.coverageAudit.candidateIndexSha256) {
    throw new Error("candidate_index.json SHA-256 与候选、覆盖清单或签收记录不一致。");
  }
  if (manifest.candidateIndexPath !== run.horizonRun.candidateIndexPath) {
    throw new Error("coverage_manifest.json 引用的 candidate index 路径不一致。");
  }

  const candidateItems = Array.isArray(candidates.items) ? candidates.items : [];
  const indexItems = Array.isArray(candidateIndex.items) ? candidateIndex.items : [];
  const candidateIds = candidateItems.map((item) => String(item?.id || ""));
  const indexIds = indexItems.map((item) => String(item?.id || ""));
  if (!sameStringSet(candidateIds, indexIds)
    || candidateIndex.itemCount !== candidateItems.length
    || manifest.candidateCount !== candidateItems.length
    || candidates.windowCount !== candidateItems.length) {
    throw new Error("候选索引、覆盖清单与 daily_candidates.json 的候选集合不一致。");
  }
  validateManifestCandidateMembership(manifest, indexItems);
  if (!isRegisteredLegacyManifest) {
    validateV2ReviewProvenance(manifest, indexItems);
    validatePriorityReviewProvenance({
      run,
      manifest,
      indexItems
    });
    validateSelectedSourceCandidateProvenance(run, indexItems);
  }

  const requiredQueryIds = validatedManifestSignoffs(
    manifest.requiredQueryIds,
    manifest.queries,
    "query"
  );
  const requiredGroupIds = validatedManifestSignoffs(
    manifest.requiredGroupIds,
    manifest.groups,
    "coverage group"
  );
  const requiredQueryLanguages = new Set(
    manifest.queries
      .filter((entry) => requiredQueryIds.includes(String(entry?.id || "")))
      .map((entry) => String(entry?.language || ""))
  );
  for (const language of ["en", "zh-CN", "ja", "ko"]) {
    if (!requiredQueryLanguages.has(language)) {
      throw new Error(`required query 未覆盖种子语言 ${language}。`);
    }
  }
  if (!sameStringSet(
    requiredQueryIds,
    stringArray(run.coverageAudit.signedOffQueryIds)
  )) {
    throw new Error("coverageAudit 未签收 coverage_manifest 中全部 required query。");
  }
  if (!sameStringSet(
    requiredGroupIds,
    stringArray(run.coverageAudit.signedOffGroupIds)
  )) {
    throw new Error("coverageAudit 未签收 coverage_manifest 中全部 required coverage group。");
  }

  if (run.selection.selectedStoryKeys.length < LOW_VOLUME_TRIGGER) {
    if (!sameStringSet(
      requiredQueryIds,
      stringArray(run.coverageAudit.secondPass?.signedOffQueryIds)
    ) || !sameStringSet(
      requiredGroupIds,
      stringArray(run.coverageAudit.secondPass?.signedOffGroupIds)
    )) {
      throw new Error("少于 5 条时的 second pass 未重新签收全部 required 覆盖项。");
    }
  }
}

function validateManifestCandidateMembership(manifest, indexItems) {
  const indexIds = new Set(indexItems.map((item) => String(item?.id || "")));
  for (const [entriesKey, membershipKey] of [
    ["queries", "queryIds"],
    ["groups", "coverageGroups"]
  ]) {
    const entries = Array.isArray(manifest[entriesKey]) ? manifest[entriesKey] : [];
    const entryIds = entries.map((entry) => String(entry?.id || ""));
    if (entryIds.some((id) => !INTERNAL_ID_PATTERN.test(id))
      || new Set(entryIds).size !== entryIds.length) {
      throw new Error(`coverage_manifest.json ${entriesKey} 编号无效或重复。`);
    }
    for (const entry of entries) {
      const id = String(entry.id);
      const declaredIds = stringArray(entry.candidateIds);
      if (declaredIds.some((candidateId) => !indexIds.has(candidateId))
        || new Set(declaredIds).size !== declaredIds.length) {
        throw new Error(`coverage_manifest.json ${entriesKey}.${id} 候选编号无效或重复。`);
      }
      const expectedIds = indexItems
        .filter((item) => stringArray(item?.[membershipKey]).includes(id))
        .map((item) => String(item.id));
      if (!sameStringSet(declaredIds, expectedIds)) {
        throw new Error(`coverage_manifest.json ${entriesKey}.${id} 候选集合与索引不一致。`);
      }
    }
  }
}

function validateV2ReviewProvenance(manifest, indexItems) {
  if (!Object.hasOwn(manifest, "mustReviewCandidateIds")
    || !Array.isArray(manifest.mustReviewCandidateIds)) {
    throw new Error(
      "coverage_manifest.json schemaVersion 2 必须提供 mustReviewCandidateIds 数组。"
    );
  }
  if (!Object.hasOwn(manifest, "reviewSources")
    || !Array.isArray(manifest.reviewSources)) {
    throw new Error(
      "coverage_manifest.json schemaVersion 2 必须提供 reviewSources 数组。"
    );
  }
  if (!Object.hasOwn(manifest, "reviewLanes")
    || !Array.isArray(manifest.reviewLanes)) {
    throw new Error(
      "coverage_manifest.json schemaVersion 2 必须提供 reviewLanes 数组。"
    );
  }
  if (manifest.priorityReviewPolicy !== undefined
    && manifest.priorityReviewPolicy !== PRIORITY_REVIEW_POLICY) {
    throw new Error(
      `coverage_manifest.json priorityReviewPolicy 必须为 ${PRIORITY_REVIEW_POLICY}。`
    );
  }
  if (manifest.protectedEventReviewPolicy !== undefined
    && manifest.protectedEventReviewPolicy !== PROTECTED_EVENT_REVIEW_POLICY) {
    throw new Error(
      "coverage_manifest.json protectedEventReviewPolicy 必须为 "
      + `${PROTECTED_EVENT_REVIEW_POLICY}。`
    );
  }
  if (String(manifest.reportDate || "") >= PROTECTED_EVENT_REVIEW_EFFECTIVE_DATE
    && manifest.protectedEventReviewPolicy !== PROTECTED_EVENT_REVIEW_POLICY) {
    throw new Error(
      `${PROTECTED_EVENT_REVIEW_EFFECTIVE_DATE} 起的新运行必须声明 `
      + `protectedEventReviewPolicy: ${PROTECTED_EVENT_REVIEW_POLICY}。`
    );
  }
  const reviewsAllDiscoveredCandidates = (
    manifest.priorityReviewPolicy === PRIORITY_REVIEW_POLICY
  );

  const indexIds = new Set(indexItems.map((item) => String(item?.id || "")));
  const queryEntries = Array.isArray(manifest.queries) ? manifest.queries : [];
  const queryById = new Map(
    queryEntries.map((entry) => [String(entry?.id || ""), entry])
  );
  for (const entry of queryEntries) {
    const queryId = String(entry?.id || "");
    if (typeof entry?.mustReview !== "boolean") {
      throw new Error(`coverage_manifest.json query ${queryId} 缺少 mustReview 布尔值。`);
    }
    if (typeof entry?.resultLimitReached !== "boolean") {
      throw new Error(
        `coverage_manifest.json query ${queryId} 缺少 resultLimitReached 布尔值。`
      );
    }
    const reviewLane = entry?.reviewLane;
    if (entry.mustReview === true) {
      if (entry.required !== true || !INTERNAL_ID_PATTERN.test(String(reviewLane || ""))) {
        throw new Error(
          `coverage_manifest.json must-review query ${queryId} 必须为 required 并提供有效 reviewLane。`
        );
      }
    } else if (reviewLane !== null && reviewLane !== undefined) {
      throw new Error(
        `coverage_manifest.json 非 must-review query ${queryId} 不得声明 reviewLane。`
      );
    }
  }

  const reviewSourceById = new Map();
  for (const entry of manifest.reviewSources) {
    const sourceId = String(entry?.id || "");
    if (!INTERNAL_ID_PATTERN.test(sourceId) || reviewSourceById.has(sourceId)) {
      throw new Error("coverage_manifest.json reviewSources 编号无效或重复。");
    }
    if (!String(entry?.sourceType || "").trim()
      || !String(entry?.sourceName || "").trim()
      || !INTERNAL_ID_PATTERN.test(String(entry?.reviewLane || ""))) {
      throw new Error(
        `coverage_manifest.json review source ${sourceId} 缺少来源类型、名称或有效 reviewLane。`
      );
    }
    if (!Array.isArray(entry?.candidateIds)) {
      throw new Error(
        `coverage_manifest.json review source ${sourceId}.candidateIds 必须是数组。`
      );
    }
    const candidateIds = entry.candidateIds.map(String);
    if (candidateIds.some((candidateId) => !indexIds.has(candidateId))
      || new Set(candidateIds).size !== candidateIds.length) {
      throw new Error(
        `coverage_manifest.json review source ${sourceId} 候选编号无效或重复。`
      );
    }
    reviewSourceById.set(sourceId, entry);
  }

  const reviewLaneById = new Map();
  for (const entry of manifest.reviewLanes) {
    const laneId = String(entry?.id || "");
    if (!INTERNAL_ID_PATTERN.test(laneId) || reviewLaneById.has(laneId)) {
      throw new Error("coverage_manifest.json reviewLanes 编号无效或重复。");
    }
    for (const field of ["queryIds", "sourceIds", "candidateIds"]) {
      if (!Array.isArray(entry?.[field])) {
        throw new Error(
          `coverage_manifest.json review lane ${laneId}.${field} 必须是数组。`
        );
      }
    }
    reviewLaneById.set(laneId, entry);
  }
  const expectedReviewLaneIds = new Set([
    ...queryEntries
      .filter((entry) => entry?.mustReview === true)
      .map((entry) => String(entry.reviewLane)),
    ...manifest.reviewSources.map((entry) => String(entry.reviewLane)),
    ...(reviewsAllDiscoveredCandidates
      ? [PRIORITY_DISCOVERY_REVIEW_LANE]
      : [])
  ]);
  if (!sameStringSet(
    [...reviewLaneById.keys()],
    [...expectedReviewLaneIds]
  )) {
    throw new Error(
      "coverage_manifest.json reviewLanes 必须完整覆盖 must-review query 与 review source。"
    );
  }
  for (const [laneId, entry] of reviewLaneById) {
    const expectedQueryIds = queryEntries
      .filter((query) => (
        query?.mustReview === true
        && String(query.reviewLane) === laneId
      ))
      .map((query) => String(query.id));
    const expectedSourceIds = [...reviewSourceById]
      .filter(([, source]) => String(source.reviewLane) === laneId)
      .map(([sourceId]) => sourceId);
    const expectedCandidateIds = indexItems
      .filter((item) => stringArray(item?.reviewLanes).includes(laneId))
      .map((item) => String(item?.id || ""));
    if (!sameStringSet(stringArray(entry.queryIds), expectedQueryIds)) {
      throw new Error(
        `coverage_manifest.json review lane ${laneId}.queryIds 与 query 归属不一致。`
      );
    }
    if (!sameStringSet(stringArray(entry.sourceIds), expectedSourceIds)) {
      throw new Error(
        `coverage_manifest.json review lane ${laneId}.sourceIds 与 reviewSources 归属不一致。`
      );
    }
    if (!sameStringSet(stringArray(entry.candidateIds), expectedCandidateIds)) {
      throw new Error(
        `coverage_manifest.json review lane ${laneId}.candidateIds 与候选索引归属不一致。`
      );
    }
  }

  const expectedMustReviewCandidateIds = [];
  for (const item of indexItems) {
    const candidateId = String(item?.id || "");
    for (const field of [
      "mustReviewQueryIds",
      "reviewLanes",
      "mustReviewSourceIds"
    ]) {
      if (!Array.isArray(item?.[field])) {
        throw new Error(`candidate_index.json 候选 ${candidateId} 缺少 ${field} 数组。`);
      }
      const values = item[field].map(String);
      if (new Set(values).size !== values.length) {
        throw new Error(`candidate_index.json 候选 ${candidateId} 的 ${field} 不得重复。`);
      }
    }
    if (Object.hasOwn(item, "editorialSignals")) {
      if (!Array.isArray(item.editorialSignals)
        || item.editorialSignals.some(
          (signal) => !INTERNAL_ID_PATTERN.test(String(signal))
        )
        || new Set(item.editorialSignals.map(String)).size
          !== item.editorialSignals.length) {
        throw new Error(
          `candidate_index.json 候选 ${candidateId} 的 editorialSignals 必须是有效且不重复的编号数组。`
        );
      }
    }
    if (typeof item?.mustReview !== "boolean") {
      throw new Error(`candidate_index.json 候选 ${candidateId} 缺少 mustReview 布尔值。`);
    }

    const itemQueryIds = stringArray(item.queryIds);
    if (itemQueryIds.some((queryId) => !queryById.has(queryId))) {
      throw new Error(`candidate_index.json 候选 ${candidateId} 引用了未知 query。`);
    }
    const expectedQueryIds = itemQueryIds.filter(
      (queryId) => queryById.get(queryId)?.mustReview === true
    );
    const declaredQueryIds = stringArray(item.mustReviewQueryIds);
    if (!sameStringSet(declaredQueryIds, expectedQueryIds)) {
      throw new Error(
        `candidate_index.json 候选 ${candidateId} 的 mustReviewQueryIds `
        + "与 manifest query 候选归属不一致。"
      );
    }

    const expectedSourceIds = [...reviewSourceById]
      .filter(([, source]) => stringArray(source.candidateIds).includes(candidateId))
      .map(([sourceId]) => sourceId);
    const declaredSourceIds = stringArray(item.mustReviewSourceIds);
    if (declaredSourceIds.some((sourceId) => !reviewSourceById.has(sourceId))
      || !sameStringSet(declaredSourceIds, expectedSourceIds)) {
      throw new Error(
        `candidate_index.json 候选 ${candidateId} 的 mustReviewSourceIds `
        + "与 manifest reviewSources 候选归属不一致。"
      );
    }

    const expectedReviewLanes = [
      ...expectedQueryIds.map((queryId) => String(queryById.get(queryId).reviewLane)),
      ...expectedSourceIds.map(
        (sourceId) => String(reviewSourceById.get(sourceId).reviewLane)
      ),
      ...(reviewsAllDiscoveredCandidates
        ? [PRIORITY_DISCOVERY_REVIEW_LANE]
        : [])
    ];
    const uniqueExpectedReviewLanes = [...new Set(expectedReviewLanes)];
    if (!sameStringSet(stringArray(item.reviewLanes), uniqueExpectedReviewLanes)) {
      throw new Error(
        `candidate_index.json 候选 ${candidateId} 的 reviewLanes `
        + "与 must-review query／source 归属不一致（含 priority 策略）。"
      );
    }

    const expectedMustReview = (
      expectedQueryIds.length > 0
      || expectedSourceIds.length > 0
      || reviewsAllDiscoveredCandidates
    );
    if (item.mustReview !== expectedMustReview) {
      throw new Error(
        `candidate_index.json 候选 ${candidateId} 的 mustReview 与重点归属不一致。`
      );
    }
    if (expectedMustReview) {
      expectedMustReviewCandidateIds.push(candidateId);
    }
  }

  const declaredMustReviewCandidateIds = manifest.mustReviewCandidateIds.map(String);
  if (new Set(declaredMustReviewCandidateIds).size
      !== declaredMustReviewCandidateIds.length
    || !sameStringSet(
      declaredMustReviewCandidateIds,
      expectedMustReviewCandidateIds
    )) {
    throw new Error(
      "coverage_manifest.json mustReviewCandidateIds 与 query／source／priority 重点候选归属不一致。"
    );
  }
}

function validateSelectedSourceCandidateProvenance(run, indexItems) {
  const indexById = new Map(
    indexItems.map((item) => [String(item?.id || ""), item])
  );
  for (const item of (Array.isArray(run.candidates) ? run.candidates : [])) {
    if (item?.selected !== true) {
      continue;
    }
    const storyKey = String(item?.storyKey || "");
    if (!Array.isArray(item?.sourceCandidateIds)) {
      throw new Error(`入选新闻 ${storyKey} 缺少 sourceCandidateIds 数组。`);
    }
    const sourceCandidateIds = item.sourceCandidateIds.map(String);
    if (!sourceCandidateIds.length
      || new Set(sourceCandidateIds).size !== sourceCandidateIds.length
      || sourceCandidateIds.some((candidateId) => !indexById.has(candidateId))) {
      throw new Error(
        `入选新闻 ${storyKey} 的 sourceCandidateIds 必须非空、不重复且全部存在于候选索引。`
      );
    }
    const sourceUrls = new Set(stringArray(item.sourceUrls));
    for (const candidateId of sourceCandidateIds) {
      const indexUrl = String(indexById.get(candidateId)?.url || "");
      if (!indexUrl || !sourceUrls.has(indexUrl)) {
        throw new Error(
          `入选新闻 ${storyKey} 的 sourceUrls 缺少索引候选 ${candidateId} 的 URL。`
        );
      }
    }
  }
}

function validatePriorityReviewProvenance({ run, manifest, indexItems }) {
  if (!Object.hasOwn(manifest, "mustReviewCandidateIds")) {
    return;
  }

  if (!Array.isArray(manifest.mustReviewCandidateIds)) {
    throw new Error("coverage_manifest.json mustReviewCandidateIds 必须是数组。");
  }
  const mustReviewCandidateIds = manifest.mustReviewCandidateIds.map(String);
  if (new Set(mustReviewCandidateIds).size !== mustReviewCandidateIds.length) {
    throw new Error("coverage_manifest.json mustReviewCandidateIds 不得重复。");
  }

  const indexById = new Map(
    indexItems.map((item) => [String(item?.id || ""), item])
  );
  if (mustReviewCandidateIds.some((candidateId) => !indexById.has(candidateId))) {
    throw new Error("coverage_manifest.json mustReviewCandidateIds 含有索引中不存在的候选。");
  }

  const expectedMustReviewCandidateIds = indexItems
    .filter((item) => (
      stringArray(item?.mustReviewQueryIds).length > 0
      || stringArray(item?.mustReviewSourceIds).length > 0
      || manifest.priorityReviewPolicy === PRIORITY_REVIEW_POLICY
    ))
    .map((item) => String(item?.id || ""));
  if (!sameStringSet(mustReviewCandidateIds, expectedMustReviewCandidateIds)) {
    throw new Error(
      "coverage_manifest.json mustReviewCandidateIds 与 candidate_index.json 的重点候选标记不一致。"
    );
  }

  const queryIds = new Set(
    (Array.isArray(manifest.queries) ? manifest.queries : [])
      .map((entry) => String(entry?.id || ""))
  );
  for (const candidateId of mustReviewCandidateIds) {
    const item = indexById.get(candidateId);
    const mustReviewQueryIds = stringArray(item?.mustReviewQueryIds);
    const reviewLanes = stringArray(item?.reviewLanes);
    if (mustReviewQueryIds.some((queryId) => !queryIds.has(queryId))
      || new Set(mustReviewQueryIds).size !== mustReviewQueryIds.length) {
      throw new Error(
        `candidate_index.json 重点候选 ${candidateId} 的 mustReviewQueryIds 无效或重复。`
      );
    }
    if (!reviewLanes.length
      || reviewLanes.some((lane) => !INTERNAL_ID_PATTERN.test(lane))
      || new Set(reviewLanes).size !== reviewLanes.length) {
      throw new Error(
        `candidate_index.json 重点候选 ${candidateId} 的 reviewLanes 必须是非空且不重复的有效编号。`
      );
    }
  }

  const priorityReview = run.coverageAudit?.priorityReview;
  if (!priorityReview || typeof priorityReview !== "object" || Array.isArray(priorityReview)) {
    throw new Error("coverageAudit 缺少重点候选 priorityReview。");
  }
  if (!Array.isArray(priorityReview.decisions)) {
    throw new Error("coverageAudit.priorityReview.decisions 必须是数组。");
  }

  const selectedRunCandidates = new Map(
    (Array.isArray(run.candidates) ? run.candidates : [])
      .filter((item) => item?.selected === true)
      .map((item) => [String(item?.storyKey || ""), item])
  );
  const decisionsByCandidateId = new Map();
  const selectedStoryKeys = new Set();
  const allIndexIds = new Set(indexById.keys());
  const requiresEventIdentity = String(run.reportDate || "")
    >= RELAXED_RUMOR_POLICY_EFFECTIVE_DATE;

  for (const [index, entry] of priorityReview.decisions.entries()) {
    const label = `coverageAudit.priorityReview.decisions[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${label} 必须是对象。`);
    }
    const candidateId = String(entry.candidateId || "");
    if (!mustReviewCandidateIds.includes(candidateId)) {
      throw new Error(`${label}.candidateId 不是 mustReviewCandidateIds 中的重点候选。`);
    }
    if (decisionsByCandidateId.has(candidateId)) {
      throw new Error(`重点候选 ${candidateId} 在 priorityReview 中被重复处置。`);
    }

    const decision = String(entry.decision || "");
    const editorialClass = String(entry.editorialClass || "");
    const score = entry.score;
    if (!PRIORITY_REVIEW_DECISIONS.has(decision)) {
      throw new Error(`${label}.decision 必须是 selected、merged 或 rejected。`);
    }
    if (!PRIORITY_EDITORIAL_CLASSES.has(editorialClass)) {
      throw new Error(`${label}.editorialClass 不在允许的重点新闻类型中。`);
    }
    if (typeof entry.substantiveChange !== "boolean") {
      throw new Error(`${label}.substantiveChange 必须是布尔值。`);
    }
    const scoreTotal = validatePriorityReviewScore(score, label);
    const candidateEditorialSignals = stringArray(
      indexById.get(candidateId)?.editorialSignals
    );
    const reviewMethod = String(entry.reviewMethod || "codex-editorial");
    if (reviewMethod === "programmatic-prescreen") {
      const allowedPreFilterReasons = new Set([
        "outside-publication-window",
        "missing-usable-content",
        "low-signal-community-discovery",
        "low-signal-aggregator-discovery",
        "no-protected-change-signal"
      ]);
      const indexedCandidate = indexById.get(candidateId);
      if (decision !== "rejected"
        || editorialClass !== "other"
        || entry.substantiveChange !== false
        || scoreTotal !== 0
        || candidateEditorialSignals.length > 0
        || indexedCandidate?.sourceType === "rss"
        || !allowedPreFilterReasons.has(String(entry.preFilterReason || ""))) {
        throw new Error(
          `${label} 的 programmatic-prescreen 只能客观排除无信号、非 RSS、零分的 other 候选。`
        );
      }
    } else if (reviewMethod !== "codex-editorial") {
      throw new Error(`${label}.reviewMethod 必须是 codex-editorial 或 programmatic-prescreen。`);
    }
    const usagePolicyChange = candidateEditorialSignals.includes(
      USAGE_POLICY_CHANGE_SIGNAL
    );
    if (usagePolicyChange
      && !USAGE_POLICY_EDITORIAL_CLASSES.has(editorialClass)) {
      throw new Error(
        `${label} 已被候选索引标记为用量／限额规则变化，editorialClass 必须是 usage-policy 或 material-price-quota。`
      );
    }
    const signalEditorialClasses = editorialClassesForSignals(
      candidateEditorialSignals
    );
    if (signalEditorialClasses
      && !signalEditorialClasses.has(editorialClass)) {
      throw new Error(
        `${label} 的 editorialSignals 要求映射到 ${[...signalEditorialClasses].join(" 或 ")}，`
        + `不得统一归为 ${editorialClass || "空类型"}。`
      );
    }
    const protectedEditorialClass = PROTECTED_PRIORITY_EDITORIAL_CLASSES.has(
      editorialClass
    );
    if (protectedEditorialClass
      && decision !== "rejected"
      && entry.substantiveChange !== true) {
      throw new Error(
        `${label} 属于重点模型／产品类并已入选或合并，substantiveChange 必须为 true。`
      );
    }

    if (decision === "selected") {
      const storyKey = String(entry.storyKey || "");
      const sourceCandidateIds = stringArray(entry.sourceCandidateIds);
      const selectedRunCandidate = selectedRunCandidates.get(storyKey);
      if (!selectedRunCandidate) {
        throw new Error(`${label}.storyKey 必须映射到实际入选新闻。`);
      }
      if (selectedStoryKeys.has(storyKey)) {
        throw new Error(`priorityReview 中的入选 storyKey ${storyKey} 被重复映射。`);
      }
      if (!sourceCandidateIds.length
        || sourceCandidateIds.some((sourceId) => !allIndexIds.has(sourceId))
        || new Set(sourceCandidateIds).size !== sourceCandidateIds.length) {
        throw new Error(`${label}.sourceCandidateIds 必须是非空且不重复的候选索引编号。`);
      }
      if (!sourceCandidateIds.includes(candidateId)) {
        throw new Error(`${label}.sourceCandidateIds 必须包含自身 candidateId。`);
      }
      if (!sameStringSet(
        sourceCandidateIds,
        stringArray(selectedRunCandidate.sourceCandidateIds)
      )) {
        throw new Error(
          `${label}.sourceCandidateIds 必须与入选新闻 ${storyKey} 的 sourceCandidateIds 一致。`
        );
      }
      if (requiresEventIdentity) {
        const eventKey = String(entry.eventKey || "");
        const eventStage = String(entry.eventStage || "");
        if (eventKey !== String(selectedRunCandidate.eventKey || "")
          || eventStage !== String(selectedRunCandidate.eventStage || "")) {
          throw new Error(
            `${label}.eventKey/eventStage 必须与实际入选新闻一致，不能按标题中的次要提及跨事件合并。`
          );
        }
        const minimumScore = selectedRunCandidate.section === "rumor"
          ? rumorMinimumScore(String(run.reportDate || ""))
          : CONFIRMED_STORY_MINIMUM_SCORE;
        if (scoreTotal < minimumScore) {
          throw new Error(
            `${label} 的 ${selectedRunCandidate.section} 入选评分为 ${scoreTotal}，`
            + `低于该栏目的最低 ${minimumScore} 分。`
          );
        }
      }
      selectedStoryKeys.add(storyKey);
    } else if (decision === "merged") {
      const representativeCandidateId = String(entry.representativeCandidateId || "");
      if (representativeCandidateId === candidateId
        || !mustReviewCandidateIds.includes(representativeCandidateId)) {
        throw new Error(
          `${label}.representativeCandidateId 必须指向另一条 must-review 重点候选。`
        );
      }
    } else {
      const rejectionReason = String(entry.rejectionReason || "");
      const note = String(entry.note || "").trim();
      if (!PRIORITY_REJECTION_REASONS.has(rejectionReason)) {
        throw new Error(`${label}.rejectionReason 不在允许的拒绝理由中。`);
      }
      if (!note) {
        throw new Error(`${label}.note 必须具体说明拒绝依据。`);
      }
      if (rejectionReason === "below-importance-threshold"
        && entry.substantiveChange !== true) {
        throw new Error(
          `${label} 使用 below-importance-threshold 时 substantiveChange 必须为 true；`
          + "它表示确有实质变化，但重要性评分未过门槛。"
        );
      }
      if (rejectionReason === "no-material-change"
        && entry.substantiveChange !== false) {
        throw new Error(
          `${label} 使用 no-material-change 时 substantiveChange 必须为 false。`
        );
      }
      if (usagePolicyChange
        && [
          "below-importance-threshold",
          "routine-or-promotional",
          "outside-editorial-scope"
        ].includes(rejectionReason)) {
        throw new Error(
          `${label} 是明确的用量／限额规则变化，不得以重要性不足、例行消息或超出范围为由拒绝；应核验一手来源，重复事件则 merged。`
        );
      }
      const protectedMinimumScore = String(run.reportDate || "")
        >= RELAXED_RUMOR_POLICY_EFFECTIVE_DATE
        ? CONFIRMED_STORY_MINIMUM_SCORE
        : 7;
      if (protectedEditorialClass && scoreTotal >= protectedMinimumScore
        && rejectionReason !== "outside-publication-window") {
        throw new Error(
          `重点候选 ${candidateId} 属于受保护的重要变化类别，`
          + `评分达到 ${protectedMinimumScore} 分后不得拒绝。`
        );
      }
    }

    decisionsByCandidateId.set(candidateId, entry);
  }

  if (manifest.priorityReviewPolicy === PRIORITY_REVIEW_POLICY) {
    validateNonDegeneratePriorityReview(priorityReview.decisions);
  }

  if (!sameStringSet(
    mustReviewCandidateIds,
    [...decisionsByCandidateId.keys()]
  )) {
    throw new Error("coverageAudit.priorityReview 必须对每个 must-review 重点候选恰好处置一次。");
  }

  if (manifest.protectedEventReviewPolicy === PROTECTED_EVENT_REVIEW_POLICY) {
    validateProtectedEventReview({
      run,
      manifest,
      indexItems,
      indexById,
      decisionsByCandidateId,
      selectedRunCandidates
    });
  }

  if (manifest.priorityReviewPolicy === PRIORITY_REVIEW_POLICY
    && run.selection.selectedStoryKeys.length < LOW_VOLUME_TRIGGER) {
    validateSecondPassReconsideredCandidates({
      run,
      indexItems,
      decisionsByCandidateId
    });
  }
  const mustReviewCandidateIdSet = new Set(mustReviewCandidateIds);
  const selectedStoriesRequiringPriorityDisposition = [
    ...selectedRunCandidates.entries()
  ]
    .filter(([, candidate]) => (
      stringArray(candidate?.sourceCandidateIds)
        .some((candidateId) => mustReviewCandidateIdSet.has(candidateId))
    ))
    .map(([storyKey]) => storyKey);
  if (!sameStringSet(
    selectedStoriesRequiringPriorityDisposition,
    [...selectedStoryKeys]
  )) {
    throw new Error(
      "coverageAudit.priorityReview 必须为每篇实际入选新闻提供且只提供一个 selected 处置。"
    );
  }

  for (const [candidateId, entry] of decisionsByCandidateId) {
    if (entry.decision === "selected") {
      for (const sourceCandidateId of stringArray(entry.sourceCandidateIds)) {
        if (sourceCandidateId === candidateId
          || !decisionsByCandidateId.has(sourceCandidateId)) {
          continue;
        }
        const sourceDecision = decisionsByCandidateId.get(sourceCandidateId);
        if (sourceDecision?.decision !== "merged"
          || String(sourceDecision.representativeCandidateId) !== candidateId) {
          throw new Error(
            `入选重点候选 ${candidateId} 的 sourceCandidateIds 含有未正确并入的重点候选 `
            + `${sourceCandidateId}。`
          );
        }
      }
      continue;
    }
    if (entry.decision !== "merged") {
      const referencedBySelected = [...decisionsByCandidateId.values()]
        .filter((decision) => decision?.decision === "selected")
        .some((decision) => stringArray(decision.sourceCandidateIds).includes(candidateId));
      if (referencedBySelected) {
        throw new Error(`已拒绝的重点候选 ${candidateId} 不得出现在入选新闻的 sourceCandidateIds 中。`);
      }
      continue;
    }
    const representativeCandidateId = String(entry.representativeCandidateId);
    const representative = decisionsByCandidateId.get(representativeCandidateId);
    if (representative?.decision !== "selected") {
      throw new Error(
        `重点候选 ${candidateId} 的代表候选 ${representativeCandidateId} 最终必须是 selected。`
      );
    }
    if (!stringArray(representative.sourceCandidateIds).includes(candidateId)) {
      throw new Error(
        `代表候选 ${representativeCandidateId} 的 sourceCandidateIds 必须包含并入候选 ${candidateId}。`
      );
    }
  }
  if (requiresEventIdentity) {
    validateMergedPriorityEventIdentities([...decisionsByCandidateId.values()]);
  }
}

export function validateMergedPriorityEventIdentities(decisions) {
  const byCandidateId = new Map(
    decisions.map((entry) => [String(entry?.candidateId || ""), entry])
  );
  for (const entry of decisions) {
    if (entry?.decision !== "merged") {
      continue;
    }
    const candidateId = String(entry.candidateId || "");
    const representativeCandidateId = String(entry.representativeCandidateId || "");
    const representative = byCandidateId.get(representativeCandidateId);
    if (String(entry.eventKey || "") !== String(representative?.eventKey || "")
      || String(entry.eventStage || "") !== String(representative?.eventStage || "")) {
      throw new Error(
        `重点候选 ${candidateId} 与代表候选 ${representativeCandidateId} 的 eventKey/eventStage 不一致；`
        + "同一标题提到多个模型或产品时，不得因次要提及而跨事件 merged。"
      );
    }
  }
}

function editorialClassesForSignals(signals) {
  const values = new Set(signals);
  if (values.has(USAGE_POLICY_CHANGE_SIGNAL)) {
    return new Set(USAGE_POLICY_EDITORIAL_CLASSES);
  }
  if (values.has(MATERIAL_PRICE_QUOTA_CHANGE_SIGNAL)) {
    return new Set(["material-price-quota"]);
  }
  if (values.has(MAJOR_TECH_FINANCE_CHANGE_SIGNAL)) {
    return new Set(["major-tech-finance"]);
  }
  if (values.has(AI_POLICY_SAFETY_CHANGE_SIGNAL)) {
    return new Set(["ai-policy-safety"]);
  }
  if (values.has(STRATEGIC_TECH_CHANGE_SIGNAL)) {
    return new Set(["strategic-hardware-infrastructure"]);
  }
  const compatibleProductClasses = new Set();
  if (values.has(DEVELOPER_TOOL_CHANGE_SIGNAL)) {
    compatibleProductClasses.add("developer-tool");
  }
  if (values.has(MAJOR_MODEL_CHANGE_SIGNAL)) {
    compatibleProductClasses.add("major-model-product");
  }
  if (values.has(CAPABILITY_AVAILABILITY_CHANGE_SIGNAL)) {
    compatibleProductClasses.add("capability-availability");
  }
  return compatibleProductClasses.size ? compatibleProductClasses : null;
}

export function validateNonDegeneratePriorityReview(decisions) {
  const editorialDecisions = decisions.filter(
    (entry) => String(entry?.reviewMethod || "codex-editorial") !== "programmatic-prescreen"
  );
  if (editorialDecisions.length < DEGENERATE_REVIEW_MIN_CANDIDATES) {
    return;
  }
  if (editorialDecisions.every((entry) => String(entry?.editorialClass) === "other")) {
    throw new Error(
      "priorityReview 审稿退化：候选量充足但全部被统一标为 other，必须重新分类审阅。"
    );
  }

  const rejected = editorialDecisions.filter((entry) => entry?.decision === "rejected");
  if (rejected.length < DEGENERATE_REVIEW_MIN_CANDIDATES) {
    return;
  }
  const scoreTemplates = new Map();
  const scoreOnlyTemplates = new Set();
  const narrativePrefixes = new Set();
  for (const entry of rejected) {
    const score = entry.score;
    const key = [
      entry.editorialClass,
      score?.reach,
      score?.magnitude,
      score?.practicalValue,
      score?.evidence,
      score?.total
    ].join("/");
    scoreTemplates.set(key, (scoreTemplates.get(key) || 0) + 1);
    scoreOnlyTemplates.add(priorityScoreSignature(score));
    const firstSentence = String(entry.note || "").split(/[。.!?！？]/, 1)[0];
    narrativePrefixes.add(normalizeReviewNarrative(firstSentence));
  }
  const largestTemplateCount = Math.max(...scoreTemplates.values());
  if (largestTemplateCount / rejected.length >= DEGENERATE_SCORE_TEMPLATE_RATIO) {
    throw new Error(
      "priorityReview 审稿退化：至少 90% 的拒稿使用完全相同的编辑类别与四项评分模板，必须逐条重审。"
    );
  }
  if (scoreOnlyTemplates.size <= DEGENERATE_SCORE_PALETTE_MAX
    && narrativePrefixes.size <= DEGENERATE_NARRATIVE_PALETTE_MAX) {
    throw new Error(
      "priorityReview 审稿退化：大量拒稿只轮换少量评分组合与结论模板，"
      + "不能按候选编号或标题替换批量生成审阅。"
    );
  }
}

function validateProtectedEventReview({
  run,
  manifest,
  indexItems,
  indexById,
  decisionsByCandidateId,
  selectedRunCandidates
}) {
  const review = run.coverageAudit?.protectedEventReview;
  if (!review || typeof review !== "object" || Array.isArray(review)) {
    throw new Error(
      "coverageAudit 缺少 protectedEventReview；新运行必须完成受保护事件的证据复核。"
    );
  }
  if (review.policy !== PROTECTED_EVENT_REVIEW_POLICY) {
    throw new Error(
      "coverageAudit.protectedEventReview.policy 必须为 "
      + `${PROTECTED_EVENT_REVIEW_POLICY}。`
    );
  }
  const completedAt = parseTimestamp(review.completedAt);
  const candidateIndexReviewedAt = parseTimestamp(
    run.coverageAudit?.candidateIndexReviewedAt
  );
  if (completedAt === null) {
    throw new Error("coverageAudit.protectedEventReview 缺少有效的 completedAt。");
  }
  if (candidateIndexReviewedAt !== null && completedAt <= candidateIndexReviewedAt) {
    throw new Error(
      "protectedEventReview.completedAt 必须严格晚于 candidateIndexReviewedAt。"
    );
  }

  const expectedCandidateIds = indexItems
    .filter((item) => {
      const candidateId = String(item?.id || "");
      const decision = decisionsByCandidateId.get(candidateId);
      return stringArray(item?.editorialSignals).length > 0
        || String(item?.sourceType || "").toLowerCase() === "rss"
        || PROTECTED_PRIORITY_EDITORIAL_CLASSES.has(
          String(decision?.editorialClass || "")
        )
        || decision?.decision === "selected"
        || decision?.decision === "merged";
    })
    .map((item) => String(item?.id || ""));
  const declaredCandidateIds = stringArray(review.requiredCandidateIds);
  if (new Set(declaredCandidateIds).size !== declaredCandidateIds.length
    || declaredCandidateIds.some((candidateId) => !indexById.has(candidateId))) {
    throw new Error(
      "protectedEventReview.requiredCandidateIds 含有重复或不在候选索引中的编号。"
    );
  }
  if (!sameStringSet(expectedCandidateIds, declaredCandidateIds)) {
    throw new Error(
      "protectedEventReview.requiredCandidateIds 必须准确覆盖全部 editorialSignals、RSS、"
      + "受保护类别及 selected／merged 候选。"
    );
  }

  if (!Array.isArray(review.events)) {
    throw new Error("coverageAudit.protectedEventReview.events 必须是数组。");
  }
  const reviewedCandidateIds = new Set();
  const eventIdentities = new Set();
  const runWindowStart = parseTimestamp(run.windowStart);
  const runWindowEnd = parseTimestamp(run.windowEnd);

  for (const [index, event] of review.events.entries()) {
    const label = `coverageAudit.protectedEventReview.events[${index}]`;
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      throw new Error(`${label} 必须是对象。`);
    }
    const eventKey = String(event.eventKey || "");
    const eventStage = String(event.eventStage || "");
    if (!INTERNAL_ID_PATTERN.test(eventKey)
      || !INTERNAL_ID_PATTERN.test(eventStage)) {
      throw new Error(`${label} 缺少有效的 eventKey 或 eventStage。`);
    }
    const eventIdentity = `${eventKey}/${eventStage}`;
    if (eventIdentities.has(eventIdentity)) {
      throw new Error(`protectedEventReview 重复登记事件 ${eventIdentity}。`);
    }
    eventIdentities.add(eventIdentity);

    const candidateIds = stringArray(event.candidateIds);
    if (!candidateIds.length
      || new Set(candidateIds).size !== candidateIds.length
      || candidateIds.some((candidateId) => !declaredCandidateIds.includes(candidateId))) {
      throw new Error(
        `${label}.candidateIds 必须是 requiredCandidateIds 的非空、不重复子集。`
      );
    }
    for (const candidateId of candidateIds) {
      if (reviewedCandidateIds.has(candidateId)) {
        throw new Error(`protectedEventReview 重复审阅候选 ${candidateId}。`);
      }
      reviewedCandidateIds.add(candidateId);
    }

    const representativeCandidateId = String(
      event.representativeCandidateId || ""
    );
    if (!candidateIds.includes(representativeCandidateId)) {
      throw new Error(`${label}.representativeCandidateId 必须属于本事件 candidateIds。`);
    }
    const disposition = String(event.disposition || "");
    if (!PROTECTED_EVENT_DISPOSITIONS.has(disposition)) {
      throw new Error(`${label}.disposition 必须是 selected 或 rejected。`);
    }
    const editorialClass = String(event.editorialClass || "");
    if (!PRIORITY_EDITORIAL_CLASSES.has(editorialClass)) {
      throw new Error(`${label}.editorialClass 不在允许的重点新闻类型中。`);
    }
    if (typeof event.substantiveChange !== "boolean") {
      throw new Error(`${label}.substantiveChange 必须是布尔值。`);
    }
    validatePriorityReviewScore(event.score, label);
    const eventScoreSignature = priorityScoreSignature(event.score);
    const representativeDecision = decisionsByCandidateId.get(
      representativeCandidateId
    );
    if (String(representativeDecision?.editorialClass || "") !== editorialClass) {
      throw new Error(`${label} 的代表候选分类必须与事件主分类一致。`);
    }

    for (const candidateId of candidateIds) {
      const decision = decisionsByCandidateId.get(candidateId);
      if (!decision) {
        throw new Error(`${label} 的候选 ${candidateId} 缺少 priorityReview 处置。`);
      }
      // One semantic event can legitimately carry multiple protected signals
      // (for example, a device rollout and its capability availability). Each
      // candidate's class is already checked against its own indexed signals;
      // the representative anchors the event's primary class here.
      if (decision.substantiveChange !== event.substantiveChange
        || priorityScoreSignature(decision.score) !== eventScoreSignature) {
        throw new Error(
          `${label} 的候选 ${candidateId} 实质变化或评分与事件复核不一致。`
        );
      }
    }

    const rejectionReason = String(event.rejectionReason || "");
    let selectedCandidate = null;
    if (disposition === "selected") {
      if (representativeDecision?.decision !== "selected") {
        throw new Error(`${label} 的代表候选必须在 priorityReview 中标为 selected。`);
      }
      for (const candidateId of candidateIds) {
        if (candidateId === representativeCandidateId) {
          continue;
        }
        const decision = decisionsByCandidateId.get(candidateId);
        if (decision?.decision !== "merged"
          || String(decision.representativeCandidateId || "")
            !== representativeCandidateId) {
          throw new Error(
            `${label} 的非代表候选 ${candidateId} 必须 merged 到代表候选。`
          );
        }
      }
      selectedCandidate = selectedRunCandidates.get(
        String(representativeDecision.storyKey || "")
      );
      if (String(selectedCandidate?.eventKey || "") !== eventKey
        || String(selectedCandidate?.eventStage || "") !== eventStage) {
        throw new Error(
          `${label} 的 eventKey/eventStage 必须与实际入选新闻一致。`
        );
      }
    } else {
      if (!PRIORITY_REJECTION_REASONS.has(rejectionReason)) {
        throw new Error(`${label}.rejectionReason 不在允许的拒绝理由中。`);
      }
      if (rejectionReason === "outside-publication-window"
        && manifest.protectedEventReviewPolicy !== PROTECTED_EVENT_REVIEW_POLICY) {
        throw new Error(
          `${label} 只有完成证据事件复核后才能使用 outside-publication-window。`
        );
      }
      for (const candidateId of candidateIds) {
        const decision = decisionsByCandidateId.get(candidateId);
        if (decision?.decision !== "rejected"
          || String(decision.rejectionReason || "") !== rejectionReason) {
          throw new Error(
            `${label} 的候选 ${candidateId} 必须使用与事件一致的 rejected 处置。`
          );
        }
      }
    }

    const verificationStatus = String(event.verificationStatus || "");
    if (!PROTECTED_EVENT_VERIFICATION_STATUSES.has(verificationStatus)) {
      throw new Error(`${label}.verificationStatus 不在允许值中。`);
    }
    const reliableSourceUrls = stringArray(event.reliableSourceUrls);
    if (new Set(reliableSourceUrls).size !== reliableSourceUrls.length
      || reliableSourceUrls.some((url) => !isDirectReliableEvidenceUrl(url))) {
      throw new Error(
        `${label}.reliableSourceUrls 只能包含不重复的 HTTPS 官方／可靠直达来源，`
        + "不得使用 Google News、Reddit、Hacker News 或 Bing 聚合页。"
      );
    }
    if (String(run.reportDate || "") >= RELAXED_RUMOR_POLICY_EFFECTIVE_DATE
      && selectedCandidate?.section === "rumor") {
      const rumorEvidenceBasis = String(event.rumorEvidenceBasis || "");
      const oneReportAllowed = String(run.reportDate || "")
        >= LOWER_RUMOR_GATE_EFFECTIVE_DATE;
      if (!RUMOR_EVIDENCE_BASES.has(rumorEvidenceBasis)
        || (rumorEvidenceBasis === "one-attributed-reliable-report"
          && !oneReportAllowed)) {
        throw new Error(
          `${label}.rumorEvidenceBasis 必须说明传闻来自当事人公开预告，`
          + (oneReportAllowed
            ? "一篇有明确归属的可靠直接报道，或至少两家独立可靠媒体的直接报道。"
            : "或至少两家独立可靠媒体的直接报道。")
        );
      }
      if (rumorEvidenceBasis === "two-independent-reliable-reports") {
        const reliableHosts = new Set(reliableSourceUrls.map(evidenceHostname));
        reliableHosts.delete("");
        if (reliableHosts.size < 2) {
          throw new Error(
            `${label} 使用双媒体传闻门禁时，必须提供至少两个独立可靠来源域名。`
          );
        }
      }
    }
    const firstReliablePublishedAt = parseTimestamp(
      event.firstReliablePublishedAt
    );
    if (verificationStatus === "verified-in-window") {
      if (!reliableSourceUrls.length || firstReliablePublishedAt === null
        || runWindowStart === null || runWindowEnd === null
        || firstReliablePublishedAt < runWindowStart
        || firstReliablePublishedAt >= runWindowEnd) {
        throw new Error(
          `${label} 标为 verified-in-window 时必须提供窗口内首次可靠发布时间和直达来源。`
        );
      }
    } else if (verificationStatus === "verified-outside-window") {
      if (disposition !== "rejected"
        || rejectionReason !== "outside-publication-window"
        || !reliableSourceUrls.length
        || firstReliablePublishedAt === null
        || (runWindowStart !== null && runWindowEnd !== null
          && firstReliablePublishedAt >= runWindowStart
          && firstReliablePublishedAt < runWindowEnd)) {
        throw new Error(
          `${label} 标为 verified-outside-window 时必须有窗口外可靠首发时间，`
          + "并以 outside-publication-window 拒绝。"
        );
      }
    } else {
      if (disposition !== "rejected"
        || rejectionReason !== "insufficient-evidence"
        || firstReliablePublishedAt !== null) {
        throw new Error(
          `${label} 标为 insufficient-evidence 时必须拒绝、使用同名理由且不伪填首发时间。`
        );
      }
    }
    if (disposition === "selected" && verificationStatus !== "verified-in-window") {
      throw new Error(`${label} 的 selected 事件必须通过窗口内可靠来源核验。`);
    }

    const evidenceSummary = String(event.evidenceSummary || "").trim();
    if (visibleLength(evidenceSummary) < PROTECTED_EVENT_MIN_SUMMARY_LENGTH) {
      throw new Error(`${label}.evidenceSummary 必须具体记录本事件的核验事实与边界。`);
    }
    validateProtectedEventScoreRationale(event.scoreRationale, label);
  }

  if (!sameStringSet(declaredCandidateIds, [...reviewedCandidateIds])) {
    throw new Error(
      "protectedEventReview.events 必须把 requiredCandidateIds 中每个候选恰好审阅一次。"
    );
  }
  validateNonDegenerateProtectedEventReview(review.events);
}

function validateProtectedEventScoreRationale(scoreRationale, label) {
  if (!scoreRationale || typeof scoreRationale !== "object"
    || Array.isArray(scoreRationale)) {
    throw new Error(`${label}.scoreRationale 必须逐项解释四项评分。`);
  }
  for (const field of ["reach", "magnitude", "practicalValue", "evidence"]) {
    if (visibleLength(scoreRationale[field]) < PROTECTED_EVENT_MIN_RATIONALE_LENGTH) {
      throw new Error(`${label}.scoreRationale.${field} 必须是本事件的具体理由。`);
    }
  }
}

function validateNonDegenerateProtectedEventReview(events) {
  if (events.length < 20) {
    return;
  }
  const summaryCounts = new Map();
  const rationaleCounts = new Map();
  for (const event of events) {
    const summary = normalizeReviewNarrative(event?.evidenceSummary);
    summaryCounts.set(summary, (summaryCounts.get(summary) || 0) + 1);
    const rationale = ["reach", "magnitude", "practicalValue", "evidence"]
      .map((field) => normalizeReviewNarrative(event?.scoreRationale?.[field]))
      .join("/");
    rationaleCounts.set(rationale, (rationaleCounts.get(rationale) || 0) + 1);
  }
  const largestSummaryCount = Math.max(...summaryCounts.values());
  const largestRationaleCount = Math.max(...rationaleCounts.values());
  if (largestSummaryCount / events.length >= 0.5
    || largestRationaleCount / events.length >= 0.5) {
    throw new Error(
      "protectedEventReview 审稿退化：至少一半事件复用了相同证据摘要或四项评分理由。"
    );
  }
}

function priorityScoreSignature(score) {
  return [
    score?.reach,
    score?.magnitude,
    score?.practicalValue,
    score?.evidence,
    score?.total
  ].join("/");
}

function validateSecondPassReconsideredCandidates({
  run,
  indexItems,
  decisionsByCandidateId
}) {
  const reconsidered = run.coverageAudit?.secondPass?.reconsideredCandidateIds;
  if (!Array.isArray(reconsidered)) {
    throw new Error(
      "少于 5 条时 secondPass.reconsideredCandidateIds 必须是数组。"
    );
  }
  const reconsideredIds = reconsidered.map(String);
  const indexIds = new Set(indexItems.map((item) => String(item?.id || "")));
  if (new Set(reconsideredIds).size !== reconsideredIds.length
    || reconsideredIds.some((candidateId) => !indexIds.has(candidateId))) {
    throw new Error(
      "secondPass.reconsideredCandidateIds 含有重复或不在候选索引中的编号。"
    );
  }

  const expected = new Set();
  for (const item of indexItems) {
    const candidateId = String(item?.id || "");
    if (stringArray(item?.editorialSignals).length > 0
      || String(item?.sourceType || "").toLowerCase() === "rss") {
      expected.add(candidateId);
    }
  }
  for (const [candidateId, decision] of decisionsByCandidateId) {
    const total = Number(decision?.score?.total);
    if (decision?.decision === "rejected"
      && PROTECTED_PRIORITY_EDITORIAL_CLASSES.has(
      String(decision?.editorialClass || "")
    ) && (total === 5 || total === 6)) {
      expected.add(candidateId);
    }
  }
  if ([...expected].some((candidateId) => !reconsideredIds.includes(candidateId))) {
    throw new Error(
      "secondPass.reconsideredCandidateIds 必须至少覆盖全部 editorialSignals 候选、RSS 候选和 protected 5/6 分拒稿。"
    );
  }
}

function validatePriorityReviewScore(score, label) {
  if (!score || typeof score !== "object" || Array.isArray(score)) {
    throw new Error(`${label}.score 必须是包含四项分数和 total 的对象。`);
  }
  const fields = [
    ["reach", 2],
    ["magnitude", 3],
    ["practicalValue", 3],
    ["evidence", 2]
  ];
  let expectedTotal = 0;
  for (const [field, maximum] of fields) {
    const value = Number(score[field]);
    if (!Number.isFinite(value) || value < 0 || value > maximum) {
      throw new Error(`${label}.score.${field} 必须是 0 至 ${maximum} 的数字。`);
    }
    expectedTotal += value;
  }
  const total = Number(score.total);
  if (!Number.isFinite(total) || total < 0 || total > 10) {
    throw new Error(`${label}.score.total 必须是 0 至 10 的数字。`);
  }
  if (Math.abs(total - expectedTotal) > Number.EPSILON * 10) {
    throw new Error(`${label}.score.total 必须等于四项分数之和。`);
  }
  return total;
}

function validateLanguagePolicyArtifact(artifact, label) {
  if (artifact.languagePolicy !== "any-reliable-language") {
    throw new Error(`${label} 必须声明 any-reliable-language。`);
  }
  const seedLanguages = stringArray(artifact.seedLanguages);
  if (!["en", "zh-CN", "ja", "ko"].every((value) => seedLanguages.includes(value))) {
    throw new Error(`${label} 的 seedLanguages 必须至少包含 en、zh-CN、ja、ko。`);
  }
}

function validatedManifestSignoffs(requiredValues, entries, kind) {
  const requiredIds = stringArray(requiredValues);
  const entryList = Array.isArray(entries) ? entries : [];
  if (!requiredIds.length || new Set(requiredIds).size !== requiredIds.length) {
    throw new Error(`coverage_manifest.json required ${kind} 清单为空或重复。`);
  }
  const byId = new Map(
    entryList.map((entry) => [String(entry?.id || ""), entry])
  );
  for (const id of requiredIds) {
    const entry = byId.get(id);
    if (!entry || entry.required !== true) {
      throw new Error(`coverage_manifest.json 缺少 required ${kind}: ${id}。`);
    }
    if (kind === "query" && !["success", "empty"].includes(entry.status)) {
      throw new Error(`required query ${id} 抓取失败，正式运行必须停止。`);
    }
    if (kind === "query" && entry.resultLimitReached === true) {
      throw new Error(
        `required query ${id} 已达到结果上限，覆盖可能被截断，正式运行必须停止。`
      );
    }
  }
  return requiredIds;
}

function assertArtifactIdentity(artifact, run, label) {
  if (artifact.engine !== "Horizon"
    || artifact.horizonRunId !== run.horizonRun.runId
    || artifact.reportDate !== run.reportDate
    || artifact.timezone !== run.timezone
    || artifact.windowStart !== run.windowStart
    || artifact.windowEnd !== run.windowEnd
    || !collectionWindowIdentityMatches(artifact, run)) {
    throw new Error(`${label} 与运行记录不一致。`);
  }
}

function collectionWindowIdentityMatches(artifact, run) {
  if (run.reportDate < CONTINUOUS_WINDOW_EFFECTIVE_DATE) {
    return true;
  }
  return artifact.windowPolicy === run.windowPolicy
    && artifact.previousCollectionStartedAt === run.previousCollectionStartedAt
    && artifact.collectionStartedAt === run.collectionStartedAt
    && artifact.previousCollectionRunId === run.previousCollectionRunId
    && artifact.collectionAnchorRunId === run.collectionAnchorRunId;
}

function shanghaiDateFromTimestamp(timestamp) {
  return new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function resolveHorizonArtifactPath(horizonRoot, allowedRoot, value, label) {
  const path = resolve(horizonRoot, String(value || ""));
  const relativePath = relative(allowedRoot, path);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(`${label}必须位于 data/mcp-runs 内。`);
  }
  return path;
}

async function readJsonArtifact(path, label) {
  try {
    const text = await readFile(path, "utf8");
    return { payload: JSON.parse(text), text };
  } catch (error) {
    throw new Error(`无法读取${label}：${error.message}`);
  }
}

function validateSelectedCandidate(item, label, errors) {
  const section = String(item?.section || "");
  const verification = String(item?.verification || "");
  const aiTake = String(item?.aiTake || "").trim();

  if (!SECTION_ORDER.includes(section)) {
    errors.push(`${label} 的 section 必须是 lead、main 或 rumor。`);
  }
  if (!VERIFICATION_VALUES.has(verification)) {
    errors.push(`${label} 的 verification 必须是 confirmed 或 unverified。`);
  }
  if (aiTake.length < AI_TAKE_MIN_LENGTH || aiTake.length > AI_TAKE_MAX_LENGTH) {
    errors.push(`${label} 的 aiTake 必须是 ${AI_TAKE_MIN_LENGTH} 至 ${AI_TAKE_MAX_LENGTH} 字的精简判断。`);
  }
  const sentenceCount = countSentences(aiTake);
  if (sentenceCount < 1 || sentenceCount > 2) {
    errors.push(`${label} 的 aiTake 必须控制在一至两句。`);
  }
  if (URL_PATTERN.test(aiTake) || REFERENCE_HEADING_PATTERN.test(aiTake)) {
    errors.push(`${label} 的 aiTake 不得包含外链或来源／参考资料提示。`);
  }

  if ((section === "lead" || section === "main") && verification !== "confirmed") {
    errors.push(`${label} 位于 ${section}，verification 必须是 confirmed。`);
  }
  if (section === "rumor") {
    if (verification !== "unverified") {
      errors.push(`${label} 位于 rumor，verification 必须是 unverified。`);
    }
    if (!String(item?.whyUnverified || "").trim()) {
      errors.push(`${label} 位于 rumor，必须填写 whyUnverified。`);
    }
  }
}

function countSelectedSections(selected) {
  const counts = { lead: 0, main: 0, rumor: 0 };
  for (const item of selected) {
    if (SECTION_ORDER.includes(item?.section)) {
      counts[item.section] += 1;
    }
  }
  return counts;
}

function validateDelivery(
  delivery,
  reportDate,
  sectionCounts,
  errors,
  { allowLegacyDateTitle = false } = {}
) {
  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) {
    errors.push("缺少 delivery 草稿。");
    return;
  }
  if (delivery.slug !== `daily-ai-news-${reportDate}` || !SLUG_PATTERN.test(String(delivery.slug || ""))) {
    errors.push("slug 必须使用 daily-ai-news-YYYY-MM-DD。");
  }
  if (!IDEMPOTENCY_PATTERN.test(String(delivery.idempotencyKey || ""))) {
    errors.push("唯一投递标记格式不正确。");
  }
  if (!String(delivery.source || "").trim() || String(delivery.source).length > 80) {
    errors.push("source 必须是 1 至 80 字的内部来源标签。");
  }
  if (!Array.isArray(delivery.tags)) {
    errors.push("tags 必须是数组。");
  }

  for (const lang of LANGUAGES) {
    const item = delivery.translations?.[lang];
    if (!item || typeof item !== "object") {
      errors.push(`缺少 ${lang} 版本。`);
      continue;
    }
    const title = String(item.title || "").trim();
    const summary = String(item.summary || "").trim();
    const body = String(item.content_markdown || "").trim();
    if (!title || title.length > 180) {
      errors.push(`${lang} 标题为空或超过 180 字。`);
    }
    const leadHeading = firstLeadStoryHeading(body, lang);
    const requiredTitle = leadHeading
      ? `${expectedTitlePrefix(lang)}${leadHeading}`
      : "";
    const legacyTitle = expectedLegacyTitle(lang, reportDate);
    const titleMatches = allowLegacyDateTitle
      ? title === legacyTitle
      : Boolean(requiredTitle) && title === requiredTitle;
    if (title && !titleMatches) {
      errors.push(
        allowLegacyDateTitle
          ? `${lang} 历史标题必须固定为“${legacyTitle}”。`
          : `${lang} 标题必须是“${expectedTitlePrefix(lang)}”加正文第一条要闻标题，且不得只写日期。`
      );
    }
    if (!summary || summary.length > 500) {
      errors.push(`${lang} 摘要为空或超过 500 字。`);
    }
    if (body.length < 120 || body.length > 200000) {
      errors.push(`${lang} 正文长度不适合完整文章。`);
    }
    if (body && !body.startsWith(`# ${title}`)) {
      errors.push(`${lang} 正文必须以与标题一致的一级标题开始。`);
    }
    for (const [field, value] of [["标题", title], ["摘要", summary], ["正文", body]]) {
      if (URL_PATTERN.test(value)) {
        errors.push(`${lang} ${field}含有外链或 Markdown 链接。`);
      }
      if (REFERENCE_HEADING_PATTERN.test(value)) {
        errors.push(`${lang} ${field}含有参考资料或来源章节。`);
      }
    }
    if (body) {
      validateArticleStructure({
        body,
        summary,
        lang,
        sectionCounts,
        errors
      });
    }
  }
}

function validateArticleStructure({ body, lang, sectionCounts, errors }) {
  const contract = ARTICLE_STRUCTURE[lang];
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const h2Headings = lines
    .map((line, index) => {
      const match = line.match(/^##\s+(.+?)\s*$/);
      return match ? { index, text: match[1] } : null;
    })
    .filter(Boolean);
  const expectedHeadings = SECTION_ORDER.map((section) => contract.sectionHeadings[section]);
  const actualHeadings = h2Headings.map((heading) => heading.text);

  if (actualHeadings.length !== expectedHeadings.length
    || actualHeadings.some((heading, index) => heading !== expectedHeadings[index])) {
    errors.push(`${lang} 正文必须只按顺序包含三个二级栏目：${expectedHeadings.join(" / ")}。`);
    return;
  }

  const firstH2Index = h2Headings[0].index;
  const introText = lines
    .slice(1, firstH2Index)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  if (introText) {
    errors.push(`${lang} 正文一级标题后必须直接进入首个栏目，不得显示摘要、采集窗口或筛选导语。`);
  }

  const totalExpectedItems = SECTION_ORDER.reduce(
    (total, section) => total + sectionCounts[section],
    0
  );
  const storyHeadings = lines
    .map((line) => line.match(/^###\s+(.+?)\s*$/)?.[1]?.trim() || "")
    .filter(Boolean);
  if (storyHeadings.length !== totalExpectedItems) {
    errors.push(`${lang} 正文的三级新闻标题数量必须与入选新闻数量一致。`);
  }
  const normalizedStoryHeadings = storyHeadings.map((heading) => (
    heading.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim()
  ));
  if (new Set(normalizedStoryHeadings).size !== normalizedStoryHeadings.length) {
    errors.push(`${lang} 每条新闻必须使用不重复的三级标题，供文章目录逐条列出。`);
  }

  const totalAiTakeMarkers = lines.filter(
    (line) => line.trim().startsWith(contract.aiTakeMarker)
  ).length;
  if (totalAiTakeMarkers !== totalExpectedItems) {
    errors.push(`${lang} 正文必须为每条入选新闻提供且只提供一条 AI 解读。`);
  }

  for (const [sectionIndex, section] of SECTION_ORDER.entries()) {
    const start = h2Headings[sectionIndex].index + 1;
    const end = sectionIndex + 1 < h2Headings.length
      ? h2Headings[sectionIndex + 1].index
      : lines.length;
    const sectionLines = lines.slice(start, end);
    validateArticleSectionItems({
      sectionLines,
      section,
      expectedCount: sectionCounts[section],
      contract,
      lang,
      errors
    });
  }
}

function validateArticleSectionItems({
  sectionLines,
  section,
  expectedCount,
  contract,
  lang,
  errors
}) {
  const storyStarts = sectionLines
    .map((line, index) => (/^###\s+\S/.test(line) ? index : -1))
    .filter((index) => index >= 0);
  if (storyStarts.length !== expectedCount) {
    errors.push(
      `${lang} 的“${contract.sectionHeadings[section]}”应包含 ${expectedCount} 条新闻，实际为 ${storyStarts.length} 条。`
    );
  }

  for (const [itemIndex, start] of storyStarts.entries()) {
    const end = itemIndex + 1 < storyStarts.length
      ? storyStarts[itemIndex + 1]
      : sectionLines.length;
    const itemLines = sectionLines.slice(start + 1, end);
    const aiTakeLines = itemLines.filter(
      (line) => line.trim().startsWith(contract.aiTakeMarker)
    );
    if (aiTakeLines.length !== 1) {
      errors.push(
        `${lang} 的“${contract.sectionHeadings[section]}”第 ${itemIndex + 1} 条必须恰好包含一条 AI 解读。`
      );
    } else {
      const aiTake = aiTakeLines[0].trim().slice(contract.aiTakeMarker.length).trim();
      if (aiTake.length < AI_TAKE_MIN_LENGTH || aiTake.length > AI_TAKE_MAX_LENGTH) {
        errors.push(
          `${lang} 的“${contract.sectionHeadings[section]}”第 ${itemIndex + 1} 条 AI 解读必须是 ${AI_TAKE_MIN_LENGTH} 至 ${AI_TAKE_MAX_LENGTH} 字的精简判断。`
        );
      }
      const sentenceCount = countSentences(aiTake);
      if (sentenceCount < 1 || sentenceCount > 2) {
        errors.push(
          `${lang} 的“${contract.sectionHeadings[section]}”第 ${itemIndex + 1} 条 AI 解读必须控制在一至两句。`
        );
      }
      if (contract.genericAiTakePattern.test(aiTake)) {
        errors.push(
          `${lang} 的“${contract.sectionHeadings[section]}”第 ${itemIndex + 1} 条 AI 解读不能只写空泛套话。`
        );
      }

      const aiTakeLineIndex = itemLines.findIndex(
        (line) => line.trim().startsWith(contract.aiTakeMarker)
      );
      const trailingLines = itemLines
        .slice(aiTakeLineIndex + 1)
        .map((line) => line.trim())
        .filter(Boolean);
      if (trailingLines.length) {
        errors.push(
          `${lang} 的“${contract.sectionHeadings[section]}”第 ${itemIndex + 1} 条必须以 AI 解读结束。`
        );
      }

      const bodyBeforeTake = itemLines.slice(0, aiTakeLineIndex).join("\n").trim();
      const bodyParagraphs = bodyBeforeTake
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (bodyParagraphs.length !== 1) {
        errors.push(
          `${lang} 的“${contract.sectionHeadings[section]}”第 ${itemIndex + 1} 条必须使用一段新闻事实正文。`
        );
      } else if (visibleLength(aiTake) >= visibleLength(bodyParagraphs[0]) * 0.8) {
        errors.push(
          `${lang} 的“${contract.sectionHeadings[section]}”第 ${itemIndex + 1} 条 AI 解读必须明显短于新闻事实段。`
        );
      }

      if (section === "rumor" && bodyParagraphs.length === 1) {
        if (contract.forbiddenRepeatedRumorWordingPattern.test(bodyParagraphs[0])) {
          errors.push(`${lang} 的传闻正文不得重复书写“未证实”类提示。`);
        }
        if (!contract.rumorConditionalPattern.test(bodyParagraphs[0])) {
          errors.push(`${lang} 的传闻正文必须使用条件语气。`);
        }
      }
    }

    if (itemLines.some((line) => contract.forbiddenRumorLabelPattern.test(line.trim()))) {
      errors.push(`${lang} 正文不得在单条新闻内重复添加传闻核实状态标签。`);
    }
  }
}

function sameStringSet(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  return new Set(left).size === left.length
    && left.every((value) => right.includes(value));
}

function stringArray(value) {
  return Array.isArray(value) ? value.map(String) : [];
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value)).protocol === "https:";
  } catch {
    return false;
  }
}

function isDirectReliableEvidenceUrl(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:") {
      return false;
    }
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return ![...DISCOVERY_ONLY_EVIDENCE_HOSTS].some((blockedHost) => (
      hostname === blockedHost || hostname.endsWith(`.${blockedHost}`)
    ));
  } catch {
    return false;
  }
}

function evidenceHostname(value) {
  try {
    return new URL(String(value)).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeReviewNarrative(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\d+(?:[.,]\d+)?/g, "<number>")
    .replace(/\s+/g, " ")
    .trim();
}

function expectedTitlePrefix(lang) {
  if (lang === "zh") {
    return "每日 AI 新闻｜";
  }
  if (lang === "ja") {
    return "毎日AIニュース｜";
  }
  return "Daily AI News | ";
}

function firstLeadStoryHeading(body, lang) {
  const leadHeading = ARTICLE_STRUCTURE[lang]?.sectionHeadings?.lead;
  if (!leadHeading) {
    return "";
  }
  const lines = String(body || "").replace(/\r\n/g, "\n").split("\n");
  const leadIndex = lines.findIndex((line) => line.trim() === `## ${leadHeading}`);
  if (leadIndex < 0) {
    return "";
  }
  for (let index = leadIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith("## ")) {
      break;
    }
    const match = line.match(/^###\s+(.+?)\s*$/);
    if (match) {
      return match[1].trim();
    }
  }
  return "";
}

function expectedLegacyTitle(lang, reportDate) {
  const [year, month, day] = reportDate.split("-").map(Number);
  if (lang === "zh") {
    return `每日 AI 新闻｜${year} 年 ${month} 月 ${day} 日`;
  }
  if (lang === "ja") {
    return `毎日AIニュース｜${year}年${month}月${day}日`;
  }
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `Daily AI News | ${months[month - 1]} ${day}, ${year}`;
}

function countSentences(value) {
  const text = String(value || "").trim();
  if (!text) {
    return 0;
  }
  const endings = text.match(/[。！？!?]+|\.(?=\s|$)/g);
  return endings?.length || 1;
}

function visibleLength(value) {
  return String(value || "")
    .replace(/[*_`#>[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .length;
}

function parseTimestamp(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) {
    return null;
  }
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function shiftIsoDate(value, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) {
    return "";
  }
  return new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]) + days
  )).toISOString().slice(0, 10);
}

function requestedPath() {
  const index = process.argv.indexOf("--run");
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : DEFAULT_RUN;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { run, absolutePath } = await readAndValidateRun(requestedPath(), {
    allowHistoricalOneShot: process.argv.includes("--one-shot-history")
  });
  console.log(`daily-ai-news-validate: ok (${run.reportDate}, ${run.selection.selectedStoryKeys.length} items)`);
  console.log(absolutePath);
}

export function isHistoricalOneShotWindow(run) {
  return run?.reportDate === HISTORICAL_ONE_SHOT_WINDOW.reportDate
    && run?.windowStart === HISTORICAL_ONE_SHOT_WINDOW.windowStart
    && run?.windowEnd === HISTORICAL_ONE_SHOT_WINDOW.windowEnd;
}

export function isRegisteredLegacyCoverageManifest(run, manifest) {
  return manifest?.schemaVersion === LEGACY_COVERAGE_MANIFEST_SCHEMA_VERSION
    && run?.horizonRun?.runId === LEGACY_COVERAGE_MANIFEST.runId
    && run?.reportDate === LEGACY_COVERAGE_MANIFEST.reportDate
    && run?.horizonRun?.candidateIndexPath
      === LEGACY_COVERAGE_MANIFEST.candidateIndexPath
    && run?.horizonRun?.coverageManifestPath
      === LEGACY_COVERAGE_MANIFEST.coverageManifestPath
    && run?.coverageAudit?.candidateIndexSha256
      === LEGACY_COVERAGE_MANIFEST.candidateIndexSha256;
}
