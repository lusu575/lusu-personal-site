import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_RUN = resolve(import.meta.dirname, "runs", "2026-07-27-2300.json");
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
    windowIntroPattern: /24\s*小时|采集范围|北京时间/,
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
    windowIntroPattern: /24[- ]hour|collection window|Beijing time/i,
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
    windowIntroPattern: /24時間|収集期間|北京時間/,
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
  if (run.schemaVersion !== 3) {
    errors.push("运行记录必须使用每日 AI 新闻 schemaVersion 3。");
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
  const selected = [];
  for (const [index, item] of candidates.entries()) {
    const label = `候选 ${index + 1}`;
    const storyKey = String(item?.storyKey || "");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(storyKey)) {
      errors.push(`${label} 的 storyKey 不正确。`);
    } else if (storyKeys.has(storyKey)) {
      errors.push(`${label} 与其他候选重复使用 storyKey。`);
    } else {
      storyKeys.add(storyKey);
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

  validateDelivery(run.delivery, reportDate, sectionCounts, errors);
  if (errors.length) {
    throw new Error(`每日 AI 新闻草稿验证失败：\n- ${errors.join("\n- ")}`);
  }
  return run;
}

async function validateHorizonProvenance(run) {
  const horizonRoot = resolve(import.meta.dirname, "..", "..");
  const candidatesPath = resolve(horizonRoot, String(run.horizonRun.candidatesPath));
  const allowedRoot = resolve(horizonRoot, "data", "mcp-runs");
  if (!candidatesPath.startsWith(`${allowedRoot}\\`) && candidatesPath !== allowedRoot) {
    throw new Error("Horizon 候选文件必须位于 data/mcp-runs 内。");
  }

  let candidates;
  try {
    candidates = JSON.parse(await readFile(candidatesPath, "utf8"));
  } catch (error) {
    throw new Error(`无法读取 Horizon 候选文件：${error.message}`);
  }
  if (candidates.engine !== "Horizon"
    || candidates.horizonRunId !== run.horizonRun.runId
    || candidates.reportDate !== run.reportDate
    || candidates.timezone !== run.timezone
    || candidates.windowStart !== run.windowStart
    || candidates.windowEnd !== run.windowEnd) {
    throw new Error("Horizon 候选文件与运行记录不一致。");
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

function validateDelivery(delivery, reportDate, sectionCounts, errors) {
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
    const requiredTitle = expectedTitle(lang, reportDate);
    if (title && title !== requiredTitle) {
      errors.push(`${lang} 标题必须固定为“${requiredTitle}”。`);
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
  if (!introText || !contract.windowIntroPattern.test(introText)) {
    errors.push(`${lang} 正文开头必须用一小段说明精确 24 小时采集窗口和筛选原则。`);
  }

  const totalExpectedItems = SECTION_ORDER.reduce(
    (total, section) => total + sectionCounts[section],
    0
  );
  const totalStoryHeadings = lines.filter((line) => /^###\s+\S/.test(line)).length;
  if (totalStoryHeadings !== totalExpectedItems) {
    errors.push(`${lang} 正文的三级新闻标题数量必须与入选新闻数量一致。`);
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

function isHttpsUrl(value) {
  try {
    return new URL(String(value)).protocol === "https:";
  } catch {
    return false;
  }
}

function expectedTitle(lang, reportDate) {
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
