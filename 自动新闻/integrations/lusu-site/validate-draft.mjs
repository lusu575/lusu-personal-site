import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_RUN = resolve(import.meta.dirname, "runs", "2026-07-27-2300.json");
const FORMAL_SCHEMA_VERSION = 4;
const HISTORICAL_SCHEMA_VERSION = 3;
const COVERAGE_MANIFEST_SCHEMA_VERSION = 1;
const CANDIDATE_ARTIFACT_SCHEMA_VERSION = 2;
const CANDIDATE_INDEX_SCHEMA_VERSION = 1;
const LOW_VOLUME_TRIGGER = 5;
const PRODUCTION_WINDOW_END_LOCAL_TIME = "07:00";
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
    rumorConditionalPattern: /据(?:报道|悉)|可能|或将|正在商谈|计划|预计|传出|有望|若|拟/,
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
  await validateHorizonProvenance(run);
  return { run, absolutePath };
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
  } else if (windowEnd - windowStart !== 24 * 60 * 60 * 1000) {
    errors.push("新闻采集窗口必须恰好为发布前 24 小时。");
  }
  const isProductionWindow = String(run.windowStart || "").endsWith("+08:00")
    && run.windowEnd === `${reportDate}T${PRODUCTION_WINDOW_END_LOCAL_TIME}:00+08:00`;
  const isAllowedHistoricalWindow = allowHistoricalOneShot
    && run.schemaVersion === HISTORICAL_SCHEMA_VERSION
    && isHistoricalOneShotWindow(run);
  if (!isProductionWindow && !isAllowedHistoricalWindow) {
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
      if (importance < threshold) {
        errors.push(`${label} 低于重要性门槛却被选入。`);
      }
      if (!String(item?.whyWorth || "").trim()) {
        errors.push(`${label} 缺少“为什么值得讲”的内部判断。`);
      }
      validateSelectedCandidate(item, label, errors);
    }
  }

  if (!selected.length) {
    errors.push("本运行没有入选新闻；这种情况应报告“今日无稿”，而不是生成空文章。");
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
  if (parseTimestamp(audit.candidateIndexReviewedAt) === null) {
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
      + `少于 ${LOW_VOLUME_TRIGGER} 条只触发二次审阅，不代表最低刊发数量。`
    );
  }
  if (secondPassRequired) {
    if (secondPass.completed !== true) {
      errors.push(`入选少于 ${LOW_VOLUME_TRIGGER} 条时必须完成 coverageAudit.secondPass。`);
    }
    if (parseTimestamp(secondPass.completedAt) === null) {
      errors.push("二次覆盖审阅缺少有效的 completedAt。");
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

async function validateHorizonProvenance(run) {
  const horizonRoot = resolve(import.meta.dirname, "..", "..");
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
    || candidates.windowEnd !== run.windowEnd) {
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
  if (manifest.schemaVersion !== COVERAGE_MANIFEST_SCHEMA_VERSION) {
    throw new Error("coverage_manifest.json schemaVersion 不正确。");
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
  }
  return requiredIds;
}

function assertArtifactIdentity(artifact, run, label) {
  if (artifact.engine !== "Horizon"
    || artifact.horizonRunId !== run.horizonRun.runId
    || artifact.reportDate !== run.reportDate
    || artifact.timezone !== run.timezone
    || artifact.windowStart !== run.windowStart
    || artifact.windowEnd !== run.windowEnd) {
    throw new Error(`${label} 与运行记录不一致。`);
  }
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
