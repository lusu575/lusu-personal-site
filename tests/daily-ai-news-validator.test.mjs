import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  isHistoricalOneShotWindow,
  isRegisteredLegacyCoverageManifest,
  readAndValidateRun,
  validateMergedPriorityEventIdentities,
  validateNonDegeneratePriorityReview,
  validateRun
} from "../自动新闻/integrations/lusu-site/validate-draft.mjs";
import {
  assertProductionSchedule,
  canonicalRunSha256,
  fetchPublicArticleWithRetry,
  isAuthorizedManualRecovery,
  parseProductionArgs,
  publicArticleUrls,
  validateDeliveryResponse,
  validatePublicArticlePayload,
  verifyPublicArticleTranslations,
  validateProductionEndpoint
} from "../自动新闻/integrations/lusu-site/deliver-production.mjs";
import {
  createProxyAwareFetch,
  proxyOptionsFromEnvironment
} from "../自动新闻/integrations/lusu-site/network-fetch.mjs";
import {
  buildProductionChannelSql,
  redactedTokenSummary
} from "../自动新闻/integrations/lusu-site/configure-production-channel.mjs";
import {
  parseDevVars,
  removeDevVar,
  upsertDevVar
} from "../自动新闻/integrations/lusu-site/production-secrets.mjs";

const historicalProvenanceRoot = fileURLToPath(new URL(
  "./fixtures/daily-ai-news/historical-horizon-root/",
  import.meta.url
));

function candidate({
  storyKey,
  section,
  verification,
  aiTake,
  whyUnverified
}) {
  return {
    storyKey,
    publishedDate: "2026-07-27",
    publishedAt: "2026-07-27T06:00:00+08:00",
    importance: 8,
    sourceUrls: [`https://example.test/${storyKey}`],
    selected: true,
    eventKey: storyKey,
    eventStage: "release",
    dedupeDecision: "new",
    section,
    verification,
    aiTake,
    whyWorth: `${storyKey} 对当天 AI 产业或技术进展具有明确读者价值。`,
    ...(whyUnverified ? { whyUnverified } : {})
  };
}

function validCoverageAudit() {
  const signedOffQueryIds = [
    "priority-query-en",
    "priority-query-zh",
    "priority-query-ja",
    "priority-query-ko"
  ];
  const signedOffGroupIds = ["global-frontier", "china-models"];
  return {
    candidateIndexReviewedAt: "2026-07-27T06:30:00+08:00",
    candidateIndexSha256: "a".repeat(64),
    lowVolumeTrigger: 5,
    signedOffQueryIds,
    signedOffGroupIds,
    secondPass: {
      required: true,
      completed: true,
      completedAt: "2026-07-27T06:40:00+08:00",
      signedOffQueryIds: [...signedOffQueryIds],
      signedOffGroupIds: [...signedOffGroupIds]
    }
  };
}

function translationsWithThreeSections() {
  return {
    zh: {
      title: "每日 AI 新闻｜已确认的要闻",
      summary: "今天包含一条要闻、一条主要新闻，另有一条传闻仍待核实；传闻不会作为事实写入结论。",
      content_markdown: [
        "# 每日 AI 新闻｜已确认的要闻",
        "",
        "## 今日要闻",
        "",
        "### 已确认的要闻",
        "",
        "发布方已经公布这项进展，正文交代发生了什么、涉及哪些产品与用户、关键数字、影响范围，以及哪些内容仍只是发布方主张。",
        "",
        "**AI 解读：** 真正值得观察的是它能否转化为可复用能力，而不只是一次发布声量。",
        "",
        "## 主要新闻",
        "",
        "### 已确认的主要新闻",
        "",
        "这条消息同样经过一手材料复核，正文说明事件参与方、现实用途、关键数字、当前限制，以及下一步可以核对的实际结果。",
        "",
        "**AI 解读：** 短期价值在于降低使用门槛，长期价值仍取决于真实场景中的稳定表现。",
        "",
        "## 传闻",
        "",
        "### 尚未确认的市场消息",
        "",
        "目前只有二手说法，缺少公司公告或其他可独立核验的材料，因此仅记录事件、关键金额、可能影响和仍会变化的条件。",
        "",
        "**AI 解读：** 在一手证据出现前，最有价值的判断是保持关注，但不据此推导公司行动。"
      ].join("\n")
    },
    en: {
      title: "Daily AI News | A confirmed lead development",
      summary: "Today includes one lead story, one more confirmed item, and one unverified rumor that is kept separate from factual conclusions.",
      content_markdown: [
        "# Daily AI News | A confirmed lead development",
        "",
        "## Lead Story",
        "",
        "### A confirmed lead development",
        "",
        "The publisher announced the development, and this section explains what happened, why it matters and what remains uncertain.",
        "",
        "**AI take:** The useful test is whether this becomes a repeatable capability rather than a one-day announcement.",
        "",
        "## More News",
        "",
        "### Another confirmed development",
        "",
        "Primary material supports this item, while the article still distinguishes published claims from independent evidence.",
        "",
        "**AI take:** Its near-term value is lower friction, while durable value depends on performance in real use.",
        "",
        "## Rumors",
        "",
        "### An unconfirmed market report",
        "",
        "The deal is reportedly under discussion, and secondary reporting describes the proposed event, amount, parties and open conditions that may still change.",
        "",
        "**AI take:** Until primary evidence appears, the sound conclusion is to watch the claim without inferring company action."
      ].join("\n")
    },
    ja: {
      title: "毎日AIニュース｜確認済みのトップニュース",
      summary: "本日はトップニュース1件、主なニュース1件に加え、事実と分離した未確認の噂1件を扱います。",
      content_markdown: [
        "# 毎日AIニュース｜確認済みのトップニュース",
        "",
        "## 今日のトップニュース",
        "",
        "### 確認済みのトップニュース",
        "",
        "発表元が公表した内容を基に、何が起きたか、なぜ重要か、どこまで未検証かを説明します。",
        "",
        "**AI解説：** 一時的な話題ではなく、再利用できる能力として定着するかが重要です。",
        "",
        "## 主なニュース",
        "",
        "### もう一つの確認済みニュース",
        "",
        "一次資料で確認した出来事、関係者、利用範囲、重要な数字を整理し、発表側の主張にとどまる内容と今後確認すべき結果も分けて説明します。",
        "",
        "**AI解説：** 短期的には利用の壁を下げますが、長期価値は実環境での安定性次第です。",
        "",
        "## 噂",
        "",
        "### 未確認の市場情報",
        "",
        "報道によると計画は協議中で、現時点の情報から出来事、金額、関係者、今後変わり得る条件を整理します。",
        "",
        "**AI解説：** 一次証拠が出るまでは注視にとどめ、企業の行動を断定しないことが重要です。"
      ].join("\n")
    }
  };
}

function validRun() {
  const candidates = [
    candidate({
      storyKey: "confirmed-lead",
      section: "lead",
      verification: "confirmed",
      aiTake: "真正的检验是这项进展能否转化成稳定、可复用的实际能力。"
    }),
    candidate({
      storyKey: "confirmed-main",
      section: "main",
      verification: "confirmed",
      aiTake: "短期看它降低了使用门槛，长期价值仍取决于真实场景表现。"
    }),
    candidate({
      storyKey: "unverified-rumor",
      section: "rumor",
      verification: "unverified",
      aiTake: "在一手证据出现前只能保持关注，不能据此推导公司的真实行动。",
      whyUnverified: "目前只有二手报道，尚未找到公司公告或可独立核验的原始材料。"
    })
  ];
  return {
    schemaVersion: 4,
    reportDate: "2026-07-27",
    timezone: "Asia/Shanghai",
    windowStart: "2026-07-26T07:00:00+08:00",
    windowEnd: "2026-07-27T07:00:00+08:00",
    collectionMethod: "Horizon native fetch and cross-source dedupe",
    horizonRun: {
      runId: "run-20260727T010203Z-abc123",
      candidatesPath: "data/mcp-runs/run-20260727T010203Z-abc123/daily_candidates.json",
      candidateIndexPath: "data/mcp-runs/run-20260727T010203Z-abc123/candidate_index.json",
      coverageManifestPath: "data/mcp-runs/run-20260727T010203Z-abc123/coverage_manifest.json"
    },
    selection: {
      importanceThreshold: 7,
      maxItems: null,
      selectedStoryKeys: candidates.map((item) => item.storyKey)
    },
    coverageAudit: validCoverageAudit(),
    candidates,
    delivery: {
      idempotencyKey: "daily-ai-news:2026-07-27:validator-test",
      slug: "daily-ai-news-2026-07-27",
      source: "Horizon + Codex validator test",
      tags: ["AI"],
      translations: translationsWithThreeSections()
    }
  };
}

function clone(value) {
  return structuredClone(value);
}

function alphabeticToken(index) {
  let value = index + 1;
  let token = "";
  while (value > 0) {
    value -= 1;
    token = String.fromCharCode(97 + (value % 26)) + token;
    value = Math.floor(value / 26);
  }
  return token;
}

async function writeFormalCoverageFixture(t, {
  withPriorityReview = false,
  withReviewSource = withPriorityReview,
  usagePolicySignals = [],
  completeReviewPolicy = false,
  protectedEventReviewPolicy = false,
  extraRejectedCandidates = 0,
  manifestSchemaVersion = 2,
  reportDate = "2026-07-27",
  runId = "run-20260727T010203Z-feed1234"
} = {}) {
  const horizonRoot = fileURLToPath(
    new URL("../自动新闻/", import.meta.url)
  );
  const runsRoot = fileURLToPath(
    new URL("../自动新闻/data/mcp-runs/", import.meta.url)
  );
  await mkdir(runsRoot, { recursive: true });
  const runDirectory = await mkdtemp(join(runsRoot, "validator-schema4-"));
  t.after(() => rm(runDirectory, { recursive: true, force: true }));

  const run = validRun();
  const priorDate = new Date(`${reportDate}T00:00:00Z`);
  priorDate.setUTCDate(priorDate.getUTCDate() - 1);
  const windowStartDate = priorDate.toISOString().slice(0, 10);
  run.reportDate = reportDate;
  run.windowStart = `${windowStartDate}T07:00:00+08:00`;
  run.windowEnd = `${reportDate}T07:00:00+08:00`;
  run.coverageAudit.candidateIndexReviewedAt = `${reportDate}T06:30:00+08:00`;
  run.coverageAudit.secondPass.completedAt = `${reportDate}T06:40:00+08:00`;
  run.delivery.slug = `daily-ai-news-${reportDate}`;
  run.delivery.idempotencyKey = `daily-ai-news:${reportDate}:validator-test`;
  for (const runCandidate of run.candidates) {
    runCandidate.publishedDate = reportDate;
    runCandidate.publishedAt = `${reportDate}T06:00:00+08:00`;
  }
  run.horizonRun.runId = runId;
  const relativeDirectory = relative(horizonRoot, runDirectory).replaceAll("\\", "/");
  run.horizonRun.candidatesPath = `${relativeDirectory}/daily_candidates.json`;
  run.horizonRun.candidateIndexPath = `${relativeDirectory}/candidate_index.json`;
  run.horizonRun.coverageManifestPath = `${relativeDirectory}/coverage_manifest.json`;
  const focusQueryId = run.coverageAudit.signedOffQueryIds[0];

  const items = run.candidates.map((item) => ({
    id: `candidate-${item.storyKey}`,
    title: item.storyKey,
    url: item.sourceUrls[0],
    source_type: "rss",
    author: "fixture",
    published_at: item.publishedAt,
    metadata: {
      category: "fixture",
      discovery_query_ids: [...run.coverageAudit.signedOffQueryIds],
      coverage_groups: ["global-frontier", "china-models"],
      coverage_priority: "priority"
    }
  }));
  if (withPriorityReview) {
    items.push({
      ...structuredClone(items[0]),
      id: "candidate-confirmed-lead-secondary",
      url: "https://example.test/confirmed-lead-secondary"
    });
    run.candidates[0].sourceUrls.push(items.at(-1).url);
    const rumorItem = items.find((item) => item.id === "candidate-unverified-rumor");
    rumorItem.metadata.discovery_query_ids = rumorItem.metadata.discovery_query_ids
      .filter((queryId) => queryId !== focusQueryId);
    if (completeReviewPolicy) {
      rumorItem.source_type = "google_news";
    }
  }
  for (let index = 0; index < extraRejectedCandidates; index += 1) {
    const source = structuredClone(
      items.find((item) => item.id === "candidate-unverified-rumor")
    );
    source.id = `candidate-regression-${index}`;
    source.title = `Regression candidate ${index}`;
    source.url = `https://example.test/regression-${index}`;
    items.push(source);
  }
  const focusedCandidateIds = withPriorityReview
    ? items
      .filter((item) => item.metadata.discovery_query_ids.includes(focusQueryId))
      .map((item) => item.id)
    : [];
  const mustReviewCandidateIds = completeReviewPolicy
    ? items.map((item) => item.id)
    : focusedCandidateIds;

  const identity = {
    engine: "Horizon",
    horizonRunId: run.horizonRun.runId,
    reportDate: run.reportDate,
    timezone: run.timezone,
    windowStart: run.windowStart,
    windowEnd: run.windowEnd,
    windowSemantics: "left-closed-right-open",
    languagePolicy: "any-reliable-language",
    seedLanguages: ["en", "zh-CN", "ja", "ko"]
  };
  const reviewSources = withReviewSource
    ? [{
      id: "official-ai-feed",
      sourceType: "rss",
      sourceName: "Official AI Feed",
      reviewLane: "official-product-feed",
      candidateIds: ["candidate-confirmed-lead-secondary"]
    }]
    : [];
  const reviewLanes = [
    ...(withPriorityReview ? [{
      id: "major-model-product",
      queryIds: [focusQueryId],
      sourceIds: [],
      candidateIds: [...focusedCandidateIds]
    }] : []),
    ...(withReviewSource ? [{
      id: "official-product-feed",
      queryIds: [],
      sourceIds: ["official-ai-feed"],
      candidateIds: ["candidate-confirmed-lead-secondary"]
    }] : [])
  ];
  const candidateIndex = {
    schemaVersion: 1,
    ...identity,
    itemCount: items.length,
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      sourceType: item.source_type,
      sourceName: item.author,
      publishedAt: item.published_at,
      category: item.metadata.category,
      queryIds: item.metadata.discovery_query_ids,
      coverageGroups: item.metadata.coverage_groups,
      priority: item.metadata.coverage_priority,
      ...(manifestSchemaVersion === 2 ? {
        mustReview: mustReviewCandidateIds.includes(item.id),
        mustReviewQueryIds: withPriorityReview
            && item.metadata.discovery_query_ids.includes(focusQueryId)
          ? [focusQueryId]
          : [],
        mustReviewSourceIds: withReviewSource
            && item.id === "candidate-confirmed-lead-secondary"
          ? ["official-ai-feed"]
          : [],
        reviewLanes: [
          ...(withPriorityReview
              && item.metadata.discovery_query_ids.includes(focusQueryId)
            ? ["major-model-product"]
            : []),
          ...(withReviewSource
              && item.id === "candidate-confirmed-lead-secondary"
            ? ["official-product-feed"]
            : []),
          ...(completeReviewPolicy
            ? ["complete-discovery-review"]
            : [])
        ],
        editorialSignals: usagePolicySignals.length
            && item.id === "candidate-confirmed-main"
          ? [...usagePolicySignals]
          : []
      } : {})
    }))
  };
  const candidateIndexText = `${JSON.stringify(candidateIndex, null, 2)}\n`;
  const candidateIndexSha256 = createHash("sha256")
    .update(candidateIndexText)
    .digest("hex");
  run.coverageAudit.candidateIndexSha256 = candidateIndexSha256;
  if (manifestSchemaVersion === 2) {
    for (const item of run.candidates) {
      item.sourceCandidateIds = [`candidate-${item.storyKey}`];
    }
    run.coverageAudit.priorityReview = { decisions: [] };
  }
  if (manifestSchemaVersion === 2 && withPriorityReview) {
    run.candidates[0].sourceCandidateIds = [
      "candidate-confirmed-lead",
      "candidate-confirmed-lead-secondary"
    ];
    run.candidates[1].sourceCandidateIds = ["candidate-confirmed-main"];
    run.coverageAudit.priorityReview.decisions = [
        {
          candidateId: "candidate-confirmed-lead",
          decision: "selected",
          editorialClass: "major-model-product",
          substantiveChange: true,
          score: {
            reach: 2,
            magnitude: 2,
            practicalValue: 2,
            evidence: 2,
            total: 8
          },
          storyKey: "confirmed-lead",
          sourceCandidateIds: [
            "candidate-confirmed-lead",
            "candidate-confirmed-lead-secondary"
          ]
        },
        {
          candidateId: "candidate-confirmed-lead-secondary",
          decision: "merged",
          editorialClass: "major-model-product",
          substantiveChange: true,
          score: {
            reach: 2,
            magnitude: 2,
            practicalValue: 2,
            evidence: 2,
            total: 8
          },
          representativeCandidateId: "candidate-confirmed-lead"
        },
        {
          candidateId: "candidate-confirmed-main",
          decision: "selected",
          editorialClass: "developer-tool",
          substantiveChange: true,
          score: {
            reach: 1,
            magnitude: 2,
            practicalValue: 3,
            evidence: 1,
            total: 7
          },
          storyKey: "confirmed-main",
          sourceCandidateIds: ["candidate-confirmed-main"]
        }
      ];
  }
  if (manifestSchemaVersion === 2 && completeReviewPolicy) {
    run.coverageAudit.priorityReview.decisions.push({
      candidateId: "candidate-unverified-rumor",
      decision: "selected",
      editorialClass: "other",
      substantiveChange: false,
      score: {
        reach: 1,
        magnitude: 2,
        practicalValue: 2,
        evidence: 2,
        total: 7
      },
      storyKey: "unverified-rumor",
      sourceCandidateIds: ["candidate-unverified-rumor"]
    });
    for (let index = 0; index < extraRejectedCandidates; index += 1) {
      const scorePattern = [
        [0, 0, 0, 0],
        [0, 1, 1, 0],
        [1, 0, 1, 1],
        [1, 1, 1, 1],
        [2, 1, 1, 1],
        [1, 2, 1, 1],
        [1, 1, 2, 1],
        [2, 2, 1, 1],
        [1, 2, 2, 1]
      ][index % 9];
      run.coverageAudit.priorityReview.decisions.push({
        candidateId: `candidate-regression-${index}`,
        decision: "rejected",
        editorialClass: index % 2 === 0 ? "other" : "capability-availability",
        substantiveChange: false,
        score: {
          reach: scorePattern[0],
          magnitude: scorePattern[1],
          practicalValue: scorePattern[2],
          evidence: scorePattern[3],
          total: scorePattern.reduce((total, value) => total + value, 0)
        },
        rejectionReason: "insufficient-evidence",
        note: `Regression fixture ${index} lacks primary evidence.`
      });
    }
    const protectedSecondPassClasses = new Set([
      "major-model-product",
      "capability-availability",
      "usage-policy",
      "developer-tool",
      "material-price-quota",
      "strategic-hardware-infrastructure",
      "major-tech-finance",
      "ai-policy-safety"
    ]);
    const reconsideredCandidateIds = new Set(
      candidateIndex.items
        .filter((item) => item.sourceType === "rss"
          || item.editorialSignals.length > 0)
        .map((item) => item.id)
    );
    for (const decision of run.coverageAudit.priorityReview.decisions) {
      if (decision.decision === "rejected"
        && protectedSecondPassClasses.has(decision.editorialClass)
        && [5, 6].includes(decision.score.total)) {
        reconsideredCandidateIds.add(decision.candidateId);
      }
    }
    run.coverageAudit.secondPass.reconsideredCandidateIds = [
      ...reconsideredCandidateIds
    ];
  }
  if (manifestSchemaVersion === 2 && protectedEventReviewPolicy) {
    const protectedEditorialClasses = new Set([
      "major-model-product",
      "capability-availability",
      "usage-policy",
      "developer-tool",
      "material-price-quota",
      "strategic-hardware-infrastructure",
      "major-tech-finance",
      "ai-policy-safety"
    ]);
    const decisions = run.coverageAudit.priorityReview.decisions;
    const decisionsById = new Map(
      decisions.map((decision) => [decision.candidateId, decision])
    );
    const requiredCandidateIds = candidateIndex.items
      .filter((item) => {
        const decision = decisionsById.get(item.id);
        return item.editorialSignals.length > 0
          || item.sourceType === "rss"
          || protectedEditorialClasses.has(decision?.editorialClass)
          || decision?.decision === "selected"
          || decision?.decision === "merged";
      })
      .map((item) => item.id);
    const events = [];
    for (const decision of decisions.filter((entry) => entry.decision === "selected")) {
      if (!requiredCandidateIds.includes(decision.candidateId)) {
        continue;
      }
      const selectedCandidate = run.candidates.find(
        (candidateEntry) => candidateEntry.storyKey === decision.storyKey
      );
      const eventCandidateIds = [
        decision.candidateId,
        ...decisions
          .filter((entry) => entry.decision === "merged"
            && entry.representativeCandidateId === decision.candidateId)
          .map((entry) => entry.candidateId)
      ].filter((candidateId) => requiredCandidateIds.includes(candidateId));
      events.push({
        eventKey: selectedCandidate.eventKey,
        eventStage: selectedCandidate.eventStage,
        representativeCandidateId: decision.candidateId,
        candidateIds: eventCandidateIds,
        disposition: "selected",
        editorialClass: decision.editorialClass,
        substantiveChange: decision.substantiveChange,
        score: structuredClone(decision.score),
        verificationStatus: "verified-in-window",
        firstReliablePublishedAt: selectedCandidate.publishedAt,
        reliableSourceUrls: [...selectedCandidate.sourceUrls],
        evidenceSummary: `Primary fixture evidence confirms ${decision.candidateId} as a distinct in-window event stage.`,
        scoreRationale: {
          reach: `Reach is assessed from the specific audience for ${decision.candidateId}.`,
          magnitude: `Magnitude reflects the concrete stage change in ${decision.candidateId}.`,
          practicalValue: `Practical value follows the documented use of ${decision.candidateId}.`,
          evidence: `Evidence is tied to direct fixture sources for ${decision.candidateId}.`
        }
      });
    }
    for (const decision of decisions.filter((entry) => entry.decision === "rejected")) {
      if (!requiredCandidateIds.includes(decision.candidateId)) {
        continue;
      }
      const numericSuffix = Number(decision.candidateId.match(/(\d+)$/)?.[1] || 0);
      const reviewToken = alphabeticToken(numericSuffix);
      events.push({
        eventKey: `fixture-review-${reviewToken}`,
        eventStage: "release",
        representativeCandidateId: decision.candidateId,
        candidateIds: [decision.candidateId],
        disposition: "rejected",
        editorialClass: decision.editorialClass,
        substantiveChange: decision.substantiveChange,
        score: structuredClone(decision.score),
        rejectionReason: decision.rejectionReason,
        verificationStatus: "insufficient-evidence",
        reliableSourceUrls: [],
        evidenceSummary: `Review ${reviewToken} found no direct source that verifies this event stage or its first reliable publication time.`,
        scoreRationale: {
          reach: `Review ${reviewToken} found no supported audience reach beyond the discovery lead.`,
          magnitude: `Review ${reviewToken} found no supported material stage change.`,
          practicalValue: `Review ${reviewToken} found no verified practical availability for readers.`,
          evidence: `Review ${reviewToken} found no direct reliable publication evidence.`
        }
      });
    }
    run.coverageAudit.protectedEventReview = {
      policy: "evidence-backed-protected-events-v1",
      completedAt: `${reportDate}T06:35:00+08:00`,
      requiredCandidateIds,
      events
    };
  }

  const candidates = {
    schemaVersion: 2,
    ...identity,
    windowCount: items.length,
    fetchStatus: "success",
    lowVolumeTrigger: 5,
    candidateIndexPath: run.horizonRun.candidateIndexPath,
    candidateIndexSha256,
    coverageManifestPath: run.horizonRun.coverageManifestPath,
    items
  };
  const coverageManifest = {
    schemaVersion: manifestSchemaVersion,
    ...identity,
    fetchStatus: "success",
    lowVolumeTrigger: 5,
    candidateIndexPath: run.horizonRun.candidateIndexPath,
    candidateIndexSha256,
    candidateCount: items.length,
    requiredQueryIds: [...run.coverageAudit.signedOffQueryIds],
    requiredGroupIds: [...run.coverageAudit.signedOffGroupIds],
    queries: run.coverageAudit.signedOffQueryIds.map((id, index) => {
      const queryCandidateIds = items
        .filter((item) => item.metadata.discovery_query_ids.includes(id))
        .map((item) => item.id);
      return {
        id,
        coverageGroup: run.coverageAudit.signedOffGroupIds[
          index % run.coverageAudit.signedOffGroupIds.length
        ],
        required: true,
        priority: "priority",
        language: ["en", "zh-CN", "ja", "ko"][index],
        country: ["US", "CN", "JP", "KR"][index],
        status: "success",
        fetched: queryCandidateIds.length,
        windowFetched: queryCandidateIds.length,
        candidateIds: queryCandidateIds,
        ...(manifestSchemaVersion === 2 ? {
          mustReview: withPriorityReview && id === focusQueryId,
          reviewLane: withPriorityReview && id === focusQueryId
            ? "major-model-product"
            : null,
          resultLimitReached: false
        } : {})
      };
    }),
    groups: run.coverageAudit.signedOffGroupIds.map((id, index) => ({
      id,
      required: true,
      priority: "priority",
      queryIds: run.coverageAudit.signedOffQueryIds.filter(
        (_, queryIndex) => (
          queryIndex % run.coverageAudit.signedOffGroupIds.length
        ) === index
      ),
      candidateIds: items.map((item) => item.id)
    })),
    ...(manifestSchemaVersion === 2 ? {
      mustReviewCandidateIds,
      reviewSources,
      reviewLanes: [
        ...reviewLanes,
        ...(completeReviewPolicy ? [{
          id: "complete-discovery-review",
          queryIds: [],
          sourceIds: [],
          candidateIds: items.map((item) => item.id)
        }] : [])
      ],
      ...(completeReviewPolicy ? {
        priorityReviewPolicy: "all-discovered-candidates"
      } : {}),
      ...(protectedEventReviewPolicy ? {
        protectedEventReviewPolicy: "evidence-backed-protected-events-v1"
      } : {})
    } : {})
  };

  const runPath = join(runDirectory, "daily_run.json");
  const candidatesPath = join(runDirectory, "daily_candidates.json");
  const indexPath = join(runDirectory, "candidate_index.json");
  const manifestPath = join(runDirectory, "coverage_manifest.json");
  await Promise.all([
    writeFile(runPath, `${JSON.stringify(run, null, 2)}\n`),
    writeFile(candidatesPath, `${JSON.stringify(candidates, null, 2)}\n`),
    writeFile(indexPath, candidateIndexText),
    writeFile(manifestPath, `${JSON.stringify(coverageManifest, null, 2)}\n`)
  ]);
  return {
    run,
    runPath,
    candidates,
    candidatesPath,
    candidateIndex,
    indexPath,
    coverageManifest,
    manifestPath
  };
}

test("Daily AI News workflow declares the permanent three-section contract", async () => {
  const workflow = JSON.parse(await readFile(
    new URL("../自动新闻/integrations/lusu-site/workflow.json", import.meta.url),
    "utf8"
  ));
  const automationPrompt = await readFile(
    new URL(
      "../自动新闻/integrations/lusu-site/AUTOMATION_PROMPT.md",
      import.meta.url
    ),
    "utf8"
  );

  assert.equal(workflow.schemaVersion, 4);
  assert.equal(workflow.calendar.mode, "fixed-24-hour-window");
  assert.equal(workflow.calendar.windowHours, 24);
  assert.equal(workflow.calendar.windowStartLocalTime, "07:00");
  assert.equal(workflow.calendar.windowEndLocalTime, "07:00");
  assert.equal(workflow.calendar.generationStartLocalTime, "07:00");
  assert.equal(workflow.calendar.publishDeadlineLocalTime, "next-day-00:00");
  assert.equal(workflow.calendar.deadlinePolicy, "same-report-date-fail-closed");
  assert.equal(workflow.calendar.historicalOneShot.requiresExplicitFlag, "--one-shot-history");
  assert.equal(
    workflow.calendar.manualRecovery.authorizationSource,
    "explicit-site-owner-request-in-interactive-codex-task"
  );
  assert.equal(workflow.calendar.manualRecovery.automaticSchedulerAllowed, false);
  assert.equal(workflow.calendar.manualRecovery.allowedFromLocalTime, "07:00");
  assert.equal(workflow.calendar.manualRecovery.expiresAtLocalTime, "next-day-00:00");
  assert.deepEqual(workflow.calendar.manualRecovery.requiresConfirmations, [
    "--confirm-report-date",
    "--confirm-run-sha256"
  ]);
  assert.equal(workflow.calendar.manualRecovery.preserveFormalValidation, true);
  assert.equal(workflow.collection.candidateIndexRequired, true);
  assert.equal(workflow.collection.coverageManifestRequired, true);
  assert.equal(workflow.collection.coverageManifestSchemaVersion, 2);
  assert.equal(
    workflow.collection.requiredQueryResultLimitProbe,
    "request-maxResults-plus-one"
  );
  assert.equal(workflow.collection.languagePolicy, "any-reliable-language");
  assert.deepEqual(workflow.collection.seedLanguages, ["en", "zh-CN", "ja", "ko"]);
  assert.equal(workflow.collection.coverageReview.lowVolumeTrigger, 5);
  assert.equal(
    workflow.collection.coverageReview.lowVolumeAction,
    "mandatory-second-pass-then-fail-closed-below-minimum"
  );
  assert.equal(
    workflow.collection.coverageReview.mustReviewCandidateSource,
    "coverage_manifest.json.mustReviewCandidateIds"
  );
  assert.equal(
    workflow.collection.coverageReview.mustReviewScope,
    "all-discovered-candidates"
  );
  assert.equal(
    workflow.collection.coverageReview.priorityReviewPolicy,
    "all-discovered-candidates"
  );
  assert.equal(
    workflow.collection.coverageReview.priorityCandidateReviewRequired,
    true
  );
  assert.equal(
    workflow.collection.coverageReview.protectedEventReviewPolicy,
    "evidence-backed-protected-events-v1"
  );
  assert.equal(
    workflow.collection.coverageReview.protectedEventReviewEffectiveReportDate,
    "2026-08-07"
  );
  assert.equal(
    workflow.collection.coverageReview
      .protectedEventReviewRequiredRegardlessOfSelectedCount,
    true
  );
  assert.equal(
    workflow.collection.coverageReview.lowVolumeAction,
    "mandatory-second-pass-then-fail-closed-below-minimum"
  );
  assert.equal(workflow.article.styleGuide, "ARTICLE_STYLE.md");
  assert.equal(workflow.article.intro.allowed, false);
  assert.equal(workflow.article.intro.firstContentAfterTitle, "lead-section-heading");
  assert.equal(workflow.article.intro.windowDetailsInternalOnly, true);
  assert.equal(workflow.article.tableOfContents.generatedBySite, true);
  assert.equal(workflow.article.tableOfContents.manualTableOfContents, false);
  assert.equal(workflow.article.tableOfContents.sourceHeadings, "story-headings-only");
  assert.equal(workflow.article.tableOfContents.includeEveryStoryHeading, true);
  assert.equal(workflow.article.tableOfContents.requireUniqueStoryHeadings, true);
  assert.deepEqual(workflow.article.aiTake.sentenceRange, [1, 2]);
  assert.equal(workflow.article.aiTake.mustBeShorterThanStoryBody, true);
  assert.equal(workflow.article.aiTake.maxStoryBodyLengthRatio, 0.8);
  assert.equal(workflow.article.aiTake.forbidNewsRestatement, true);
  assert.equal(workflow.article.aiTake.forbidForcedCriticism, true);
  assert.equal(workflow.article.rumorPresentation.forbidPerItemVerificationLabel, true);
  assert.deepEqual(workflow.selection.sections.order, ["lead", "main", "rumor"]);
  assert.equal(workflow.selection.sections.lead.exactItems, 1);
  assert.equal(workflow.selection.sections.lead.verification, "confirmed");
  assert.equal(workflow.selection.sections.main.maxItems, null);
  assert.equal(workflow.selection.sections.main.verification, "confirmed");
  assert.equal(workflow.selection.sections.rumor.maxItems, null);
  assert.equal(workflow.selection.sections.rumor.verification, "unverified");
  assert.equal(workflow.selection.sections.rumor.requiresWhyUnverified, true);
  assert.equal(workflow.selection.coverageAuditRequired, true);
  assert.ok(
    workflow.selection.selectedItemContract.requiredFields.includes(
      "sourceCandidateIds"
    )
  );
  assert.equal(workflow.selection.lowVolumeTrigger, 5);
  assert.equal(workflow.selection.minimumSelectedStories, 5);
  assert.equal(
    workflow.selection.minimumSelectedStoriesEffectiveReportDate,
    "2026-08-10"
  );
  assert.equal(workflow.selection.minimumRumorStories, 0);
  assert.equal(
    workflow.selection.relaxedRumorPolicyEffectiveReportDate,
    "2026-08-13"
  );
  assert.equal(workflow.selection.confirmedStoryMinimumScore, 6);
  assert.equal(workflow.selection.rumorStoryMinimumScore, 5);
  assert.equal(workflow.selection.importanceThreshold, 6);
  assert.equal(
    workflow.selection.lowerRumorGateEffectiveReportDate,
    "2026-08-24"
  );
  assert.equal(workflow.selection.sections.rumor.minimumItems, 0);
  assert.equal(workflow.selection.sections.rumor.maxItems, null);
  assert.equal(workflow.selection.sections.rumor.minimumIsFloorNotQuota, true);
  assert.equal(workflow.selection.sections.rumor.retainAllThresholdClearingItems, true);
  assert.equal(workflow.selection.sections.rumor.minimumScore, 5);
  assert.equal(
    workflow.selection.coverageAuditContract.secondPassRepeatsAllRequiredSignoffs,
    true
  );
  assert.equal(
    workflow.selection.coverageAuditContract.priorityReviewScope,
    "exactly-every-mustReviewCandidateId-once"
  );
  assert.equal(
    workflow.selection.coverageAuditContract
      .protectedEventReviewIndependentOfLowVolumeSecondPass,
    true
  );
  assert.deepEqual(
    workflow.selection.priorityReviewContract.decisions,
    ["selected", "merged", "rejected"]
  );
  assert.equal(
    workflow.selection.priorityReviewContract.protectedSelectionThreshold,
    6
  );
  assert.deepEqual(
    workflow.collection.editorialReview.finalizeChecks,
    [
      "editorial-signal-to-class-mapping",
      "event-member-class-status-substantive-change-and-score-consistency",
      "reliable-first-publication-window-to-rejection-reason-consistency",
      "confirmed-score-6-and-rumor-score-5-selection-thresholds"
    ]
  );
  assert.equal(
    workflow.selection.priorityReviewContract.protectedSelectedOrMergedRequiresSubstantiveChange,
    true
  );
  assert.deepEqual(
    workflow.selection.priorityReviewContract.candidateEditorialSignals[
      "usage-policy-change"
    ].requiredEditorialClass,
    ["usage-policy", "material-price-quota"]
  );
  assert.deepEqual(
    workflow.selection.priorityReviewContract.score,
    {
      reach: [0, 2],
      magnitude: [0, 3],
      practicalValue: [0, 3],
      evidence: [0, 2],
      total: [0, 10],
      totalMustEqualComponentSum: true
    }
  );
  assert.equal(
    workflow.selection.priorityReviewContract.reviewIntegrity
      .rejectRotatingScorePaletteMaximum,
    8
  );
  assert.equal(
    workflow.selection.protectedEventReviewContract.policy,
    "evidence-backed-protected-events-v1"
  );
  assert.equal(
    workflow.selection.protectedEventReviewContract.effectiveReportDate,
    "2026-08-07"
  );
  assert.equal(
    workflow.selection.protectedEventReviewContract
      .selectedRequiresVerifiedInWindow,
    true
  );
  assert.deepEqual(
    workflow.selection.protectedEventReviewContract.requiredCandidateScope,
    [
      "editorialSignals",
      "rss-source",
      "protected-editorial-class",
      "selected",
      "merged"
    ]
  );
  assert.equal(workflow.selection.eventDedupe.identity, "eventKey-plus-eventStage");
  assert.equal(workflow.selection.eventDedupe.selectedDuplicateAllowed, false);
  assert.equal(workflow.article.requirePerItemAiTake, true);
  assert.equal(workflow.delivery.mode, "production-auto-publish");
  assert.equal(workflow.delivery.expectedResponseStatus, "published");
  assert.deepEqual(workflow.delivery.postPublishVerification.languages, ["zh", "en", "ja"]);
  assert.equal(workflow.delivery.postPublishVerification.mustFinishBeforeDeadline, true);
  assert.equal(workflow.delivery.postPublishVerification.retry.method, "GET-only");
  assert.equal(workflow.delivery.postPublishVerification.retry.maxAttemptsPerLanguage, 3);
  assert.equal(workflow.delivery.postPublishVerification.retry.payloadMismatchRetry, false);
  assert.equal(workflow.delivery.postPublishVerification.retry.productionPostRetry, false);
  assert.equal(workflow.delivery.autoPublish, true);
  assert.equal(workflow.delivery.schedulerEnabled, true);
  assert.equal(workflow.delivery.failurePolicy, "fail-closed");
  assert.equal(workflow.delivery.automaticLatePublishForbidden, false);
  assert.equal(workflow.delivery.sameReportDatePublicationAllowedAfter08, true);
  assert.equal(workflow.delivery.manualRecoveryReference, "MANUAL_RECOVERY.md");
  assert.equal(workflow.compatibility.formalRunSchemaVersion, 4);
  assert.equal(workflow.compatibility.historicalOneShotSchemaVersion, 3);
  assert.match(
    automationPrompt,
    /protectedEventReviewPolicy: evidence-backed-protected-events-v1/
  );
  assert.match(automationPrompt, /禁止按候选 ID 的 hash、数组下标/);
  assert.match(automationPrompt, /豆包中英产品动态/);
});

test("Daily AI News validator accepts the three-section contract", () => {
  assert.equal(validateRun(validRun()).reportDate, "2026-07-27");
});

test("formal schema 4 requires coverage signoff and a low-volume second pass", () => {
  const missingAudit = clone(validRun());
  delete missingAudit.coverageAudit;
  assert.throws(() => validateRun(missingAudit), /必须提供 coverageAudit/);

  const incompleteSecondPass = clone(validRun());
  incompleteSecondPass.coverageAudit.secondPass.completed = false;
  assert.throws(() => validateRun(incompleteSecondPass), /少于 5 条时必须完成/);

  const missingGroupSignoff = clone(validRun());
  missingGroupSignoff.coverageAudit.signedOffGroupIds = [];
  missingGroupSignoff.coverageAudit.secondPass.signedOffGroupIds = [];
  assert.throws(() => validateRun(missingGroupSignoff), /signedOffGroupIds 必须是非空数组/);
});

test("formal schema 4 requires event-stage dedupe decisions", () => {
  const missingEventStage = clone(validRun());
  delete missingEventStage.candidates[0].eventStage;
  assert.throws(() => validateRun(missingEventStage), /缺少有效的 eventStage/);

  const selectedDuplicate = clone(validRun());
  selectedDuplicate.candidates[0].dedupeDecision = "duplicate";
  assert.throws(() => validateRun(selectedDuplicate), /已判定为 duplicate，不得入选/);

  const incompleteMaterialUpdate = clone(validRun());
  incompleteMaterialUpdate.candidates[0].dedupeDecision = "material-update";
  assert.throws(() => validateRun(incompleteMaterialUpdate), /必须填写 priorStoryKey/);

  const materialUpdate = clone(validRun());
  materialUpdate.candidates[0].dedupeDecision = "material-update";
  materialUpdate.candidates[0].priorStoryKey = "previous-release";
  materialUpdate.candidates[0].materialDifference = "权重文件和许可证已经正式发布。";
  assert.doesNotThrow(() => validateRun(materialUpdate));
});

test("schema 3 is rejected for formal runs", () => {
  const oldFormalRun = clone(validRun());
  oldFormalRun.schemaVersion = 3;
  assert.throws(() => validateRun(oldFormalRun), /schemaVersion 4/);
});

test("Daily AI News validator fails closed when fewer than five stories are selected", () => {
  const run = validRun();
  run.reportDate = "2026-08-10";
  run.windowStart = "2026-08-09T07:00:00+08:00";
  run.windowEnd = "2026-08-10T07:00:00+08:00";
  run.delivery.slug = "daily-ai-news-2026-08-10";
  run.candidates = [run.candidates[0]];
  run.selection.selectedStoryKeys = [run.candidates[0].storyKey];
  run.delivery.translations = {
    zh: {
      title: "每日 AI 新闻｜唯一入选要闻",
      summary: "今天只有一条达到门槛的已确认要闻，没有用低价值内容补足数量。",
      content_markdown: "# 每日 AI 新闻｜唯一入选要闻\n\n## 今日要闻\n\n### 唯一入选要闻\n\n这条消息已经完成一手核实，正文说明发生了什么、关键数字、影响范围和当前限制。\n\n**AI 解读：** 核心价值在于实际能力是否持续，而不是当天的讨论热度。\n\n## 主要新闻\n\n今天没有其他达到门槛的已确认新闻。\n\n## 传闻\n\n今天没有值得单列的传闻。"
    },
    en: {
      title: "Daily AI News | The only selected lead",
      summary: "Only one confirmed story cleared the bar today, with no low-value items added to fill space.",
      content_markdown: "# Daily AI News | The only selected lead\n\n## Lead Story\n\n### The only selected lead\n\nPrimary material confirms the event, while the article explains what happened, the key figures, its impact and present limits.\n\n**AI take:** Durable capability matters more than the volume of discussion on release day.\n\n## More News\n\nNo other confirmed item cleared the bar today.\n\n## Rumors\n\nNo rumor was useful enough to include today."
    },
    ja: {
      title: "毎日AIニュース｜唯一のトップニュース",
      summary: "本日は確認済みの1件だけが基準を満たし、件数合わせの低価値情報は追加していません。",
      content_markdown: "# 毎日AIニュース｜唯一のトップニュース\n\n## 今日のトップニュース\n\n### 唯一のトップニュース\n\n一次資料で事実を確認し、何が起きたか、重要な数字、影響と現在の限界を分けて説明します。\n\n**AI解説：** 公開日の話題量より、能力が継続して使えるかどうかが重要です。\n\n## 主なニュース\n\n本日はほかに基準を満たす確認済みニュースがありません。\n\n## 噂\n\n本日は掲載する価値のある噂がありません。"
    }
  };

  assert.throws(
    () => validateRun(run),
    /只有 1 条入选新闻，少于站长规定的最低 5 条.*必须停止投递/
  );
});

test("Daily AI News validator requires exactly one confirmed lead", () => {
  const missingLead = clone(validRun());
  missingLead.candidates[0].section = "main";
  assert.throws(() => validateRun(missingLead), /恰好包含一条.*lead/);

  const unconfirmedLead = clone(validRun());
  unconfirmedLead.candidates[0].verification = "unverified";
  assert.throws(() => validateRun(unconfirmedLead), /位于 lead.*confirmed/);
});

test("Daily AI News validator isolates unverified rumors", () => {
  const confirmedRumor = clone(validRun());
  confirmedRumor.candidates[2].verification = "confirmed";
  assert.throws(() => validateRun(confirmedRumor), /位于 rumor.*unverified/);

  const unexplainedRumor = clone(validRun());
  delete unexplainedRumor.candidates[2].whyUnverified;
  assert.throws(() => validateRun(unexplainedRumor), /必须填写 whyUnverified/);
});

test("Daily AI News validator requires concise AI takes in data and article bodies", () => {
  const missingDataTake = clone(validRun());
  missingDataTake.candidates[1].aiTake = "";
  assert.throws(() => validateRun(missingDataTake), /aiTake 必须是/);

  const missingVisibleTake = clone(validRun());
  missingVisibleTake.delivery.translations.en.content_markdown =
    missingVisibleTake.delivery.translations.en.content_markdown.replace(
      "**AI take:** Its near-term value is lower friction, while durable value depends on performance in real use.",
      "Its near-term value is lower friction, while durable value depends on performance in real use."
    );
  assert.throws(() => validateRun(missingVisibleTake), /en 正文必须为每条入选新闻提供且只提供一条 AI 解读/);
});

test("Daily AI News validator locks section order without repeating rumor disclaimers", () => {
  const wrongOrder = clone(validRun());
  wrongOrder.delivery.translations.ja.content_markdown =
    wrongOrder.delivery.translations.ja.content_markdown
      .replace("## 今日のトップニュース", "## 一時見出し")
      .replace("## 主なニュース", "## 今日のトップニュース")
      .replace("## 一時見出し", "## 主なニュース");
  assert.throws(() => validateRun(wrongOrder), /ja 正文必须只按顺序包含三个二级栏目/);

  assert.doesNotThrow(() => validateRun(validRun()));

  const repeatedStatus = clone(validRun());
  repeatedStatus.delivery.translations.zh.content_markdown =
    repeatedStatus.delivery.translations.zh.content_markdown.replace(
      "目前只有二手说法",
      "**核实状态：未获官方证实。**\n\n目前只有二手说法"
    );
  assert.throws(() => validateRun(repeatedStatus), /不得在单条新闻内重复添加传闻核实状态标签/);

  const repeatedWording = clone(validRun());
  repeatedWording.delivery.translations.zh.content_markdown =
    repeatedWording.delivery.translations.zh.content_markdown.replace(
      "目前只有二手说法",
      "这条消息尚未得到官方确认，目前只有二手说法"
    );
  assert.throws(() => validateRun(repeatedWording), /传闻正文不得重复书写“未证实”类提示/);

  const attributedChineseReport = clone(validRun());
  attributedChineseReport.delivery.translations.zh.content_markdown =
    attributedChineseReport.delivery.translations.zh.content_markdown.replace(
      "目前只有二手说法，缺少公司公告或其他可独立核验的材料，因此仅记录事件、关键金额、可能影响和仍会变化的条件。",
      "据雷峰网报道，厂商在世界机器人大会展示了一套面向工业生产的新系统，现场公布了多项性能数据，但这些数字仍需长期运行和第三方测试独立验证。"
    );
  assert.doesNotThrow(() => validateRun(attributedChineseReport));

  const noConditionalLanguage = clone(validRun());
  noConditionalLanguage.delivery.translations.en.content_markdown =
    noConditionalLanguage.delivery.translations.en.content_markdown.replace(
      "The deal is reportedly under discussion, and secondary reporting describes the proposed event, amount, parties and open conditions that may still change.",
      "The deal is under discussion, and secondary reporting describes the event, amount, parties and open conditions."
    );
  assert.throws(() => validateRun(noConditionalLanguage), /en 的传闻正文必须使用条件语气/);
});

test("Daily AI News validator locks title, direct section start, and concise AI take style", () => {
  const dateOnlyTitle = clone(validRun());
  dateOnlyTitle.delivery.translations.en.title = "Daily AI News | July 27, 2026";
  dateOnlyTitle.delivery.translations.en.content_markdown =
    dateOnlyTitle.delivery.translations.en.content_markdown.replace(
      "# Daily AI News | A confirmed lead development",
      "# Daily AI News | July 27, 2026"
    );
  assert.throws(() => validateRun(dateOnlyTitle), /不得只写日期/);

  const wrongTitle = clone(validRun());
  wrongTitle.delivery.translations.en.title = "A different headline";
  wrongTitle.delivery.translations.en.content_markdown =
    wrongTitle.delivery.translations.en.content_markdown.replace(
      "# Daily AI News | A confirmed lead development",
      "# A different headline"
    );
  assert.throws(() => validateRun(wrongTitle), /en 标题必须是/);

  const visibleIntro = clone(validRun());
  visibleIntro.delivery.translations.ja.content_markdown =
    visibleIntro.delivery.translations.ja.content_markdown.replace(
      "\n\n## 今日のトップニュース",
      "\n\n北京時間の24時間を収集対象としました。\n\n## 今日のトップニュース"
    );
  assert.throws(() => validateRun(visibleIntro), /ja 正文一级标题后必须直接进入首个栏目/);

  const threeSentenceTake = clone(validRun());
  threeSentenceTake.candidates[0].aiTake = "这是第一句具体判断。这是第二句现实影响。这是第三句后续观察。";
  assert.throws(() => validateRun(threeSentenceTake), /aiTake 必须控制在一至两句/);

  const longerThanBody = clone(validRun());
  longerThanBody.delivery.translations.zh.content_markdown =
    longerThanBody.delivery.translations.zh.content_markdown.replace(
      "发布方已经公布这项进展，正文交代发生了什么、涉及哪些产品与用户、关键数字、影响范围，以及哪些内容仍只是发布方主张。",
      "事件已经公布。"
    );
  assert.throws(() => validateRun(longerThanBody), /AI 解读必须明显短于新闻事实段/);
});

test("Daily AI News validator requires one unique heading per selected story", () => {
  const repeatedHeading = clone(validRun());
  repeatedHeading.delivery.translations.zh.content_markdown =
    repeatedHeading.delivery.translations.zh.content_markdown.replace(
      "### 已确认的主要新闻",
      "### 已确认的要闻"
    );
  assert.throws(() => validateRun(repeatedHeading), /每条新闻必须使用不重复的三级标题/);
});

test("the published 27 July run still passes the locked reader format", async () => {
  await assert.doesNotReject(() => readAndValidateRun(
    fileURLToPath(new URL("../自动新闻/integrations/lusu-site/runs/2026-07-27-2300.json", import.meta.url)),
    {
      allowHistoricalOneShot: true,
      historicalProvenanceRoot
    }
  ));
});

test("schema 4 provenance requires complete multilingual coverage artifacts", async (t) => {
  const fixture = await writeFormalCoverageFixture(t);
  await assert.doesNotReject(() => readAndValidateRun(fixture.runPath));
  await assert.rejects(
    () => readAndValidateRun(fixture.runPath, { historicalProvenanceRoot }),
    /只允许用于已登记的 schemaVersion 3 历史 one-shot/
  );

  fixture.coverageManifest.queries[0].status = "failure";
  await writeFile(
    fixture.manifestPath,
    `${JSON.stringify(fixture.coverageManifest, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /required query .*抓取失败/
  );
});

test("coverage manifest v2 is required except for the exact registered 28 July legacy identity", async (t) => {
  const unregisteredV1 = await writeFormalCoverageFixture(t, {
    manifestSchemaVersion: 1
  });
  await assert.rejects(
    () => readAndValidateRun(unregisteredV1.runPath),
    /schemaVersion 1 仅兼容已登记的 run-20260728T014353Z-c4ddc43d/
  );

  const registeredRun = JSON.parse(await readFile(
    fileURLToPath(new URL(
      "../自动新闻/integrations/lusu-site/runs/2026-07-28-coverage-revision.json",
      import.meta.url
    )),
    "utf8"
  ));
  assert.equal(
    isRegisteredLegacyCoverageManifest(registeredRun, { schemaVersion: 1 }),
    true
  );
});

test("the legacy v1 allowlist is bound to the exact registered artifact fingerprint", () => {
  const manifest = { schemaVersion: 1 };
  const exactRun = {
    reportDate: "2026-07-28",
    horizonRun: {
      runId: "run-20260728T014353Z-c4ddc43d",
      candidateIndexPath:
        "data/mcp-runs/run-20260728T014353Z-c4ddc43d/candidate_index.json",
      coverageManifestPath:
        "data/mcp-runs/run-20260728T014353Z-c4ddc43d/coverage_manifest.json"
    },
    coverageAudit: {
      candidateIndexSha256:
        "4753e8e6e8f81f82fda305e33adfd3ab9ea5e9bb9f16c60c621e6764747283cd"
    }
  };
  assert.equal(isRegisteredLegacyCoverageManifest(exactRun, manifest), true);

  const mutations = [
    (run) => {
      run.horizonRun.runId = "run-20260728T014353Z-different";
    },
    (run) => {
      run.reportDate = "2026-07-29";
    },
    (run) => {
      run.horizonRun.candidateIndexPath =
        "data/mcp-runs/run-20260728T014353Z-c4ddc43d/other-index.json";
    },
    (run) => {
      run.horizonRun.coverageManifestPath =
        "data/mcp-runs/run-20260728T014353Z-c4ddc43d/other-manifest.json";
    },
    (run) => {
      run.coverageAudit.candidateIndexSha256 = "0".repeat(64);
    }
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(exactRun);
    mutate(changed);
    assert.equal(isRegisteredLegacyCoverageManifest(changed, manifest), false);
  }
});

test("coverage manifest v2 requires candidates, sources, and review lanes", async (t) => {
  const missingCandidates = await writeFormalCoverageFixture(t);
  delete missingCandidates.coverageManifest.mustReviewCandidateIds;
  await writeFile(
    missingCandidates.manifestPath,
    `${JSON.stringify(missingCandidates.coverageManifest, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(missingCandidates.runPath),
    /schemaVersion 2 必须提供 mustReviewCandidateIds/
  );

  const missingSources = await writeFormalCoverageFixture(t);
  delete missingSources.coverageManifest.reviewSources;
  await writeFile(
    missingSources.manifestPath,
    `${JSON.stringify(missingSources.coverageManifest, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(missingSources.runPath),
    /schemaVersion 2 必须提供 reviewSources/
  );

  const missingLanes = await writeFormalCoverageFixture(t);
  delete missingLanes.coverageManifest.reviewLanes;
  await writeFile(
    missingLanes.manifestPath,
    `${JSON.stringify(missingLanes.coverageManifest, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(missingLanes.runPath),
    /schemaVersion 2 必须提供 reviewLanes/
  );
});

test("required queries fail closed when a successful result set reaches its limit", async (t) => {
  const fixture = await writeFormalCoverageFixture(t);
  fixture.coverageManifest.queries[0].resultLimitReached = true;
  await writeFile(
    fixture.manifestPath,
    `${JSON.stringify(fixture.coverageManifest, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /达到结果上限，覆盖可能被截断/
  );
});

test("must-review query ids and lanes close against manifest candidate membership", async (t) => {
  const queryMismatch = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  queryMismatch.coverageManifest.queries[0].mustReview = false;
  queryMismatch.coverageManifest.queries[0].reviewLane = null;
  queryMismatch.coverageManifest.reviewLanes =
    queryMismatch.coverageManifest.reviewLanes.filter(
      (lane) => lane.id !== "major-model-product"
    );
  await writeFile(
    queryMismatch.manifestPath,
    `${JSON.stringify(queryMismatch.coverageManifest, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(queryMismatch.runPath),
    /mustReviewQueryIds .*manifest query 候选归属不一致/
  );

  const laneMismatch = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  laneMismatch.coverageManifest.queries[0].reviewLane = "different-review-lane";
  laneMismatch.coverageManifest.reviewLanes[0] = {
    id: "different-review-lane",
    queryIds: [laneMismatch.coverageManifest.queries[0].id],
    sourceIds: [],
    candidateIds: []
  };
  await writeFile(
    laneMismatch.manifestPath,
    `${JSON.stringify(laneMismatch.coverageManifest, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(laneMismatch.runPath),
    /reviewLanes .*must-review query／source 归属不一致/
  );
});

test("must-review source ids and lanes close against reviewSources membership", async (t) => {
  const sourceMismatch = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  sourceMismatch.coverageManifest.reviewSources[0].candidateIds = [];
  await writeFile(
    sourceMismatch.manifestPath,
    `${JSON.stringify(sourceMismatch.coverageManifest, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(sourceMismatch.runPath),
    /mustReviewSourceIds .*manifest reviewSources 候选归属不一致/
  );

  const laneMismatch = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  laneMismatch.coverageManifest.reviewSources[0].reviewLane =
    "different-source-review-lane";
  laneMismatch.coverageManifest.reviewLanes[1] = {
    id: "different-source-review-lane",
    queryIds: [],
    sourceIds: [laneMismatch.coverageManifest.reviewSources[0].id],
    candidateIds: []
  };
  await writeFile(
    laneMismatch.manifestPath,
    `${JSON.stringify(laneMismatch.coverageManifest, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(laneMismatch.runPath),
    /reviewLanes .*must-review query／source 归属不一致/
  );
});

test("reviewLanes close query, source, and candidate membership exactly", async (t) => {
  const queryMismatch = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  queryMismatch.coverageManifest.reviewLanes[0].queryIds = [];
  await writeFile(
    queryMismatch.manifestPath,
    `${JSON.stringify(queryMismatch.coverageManifest, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(queryMismatch.runPath),
    /review lane major-model-product\.queryIds 与 query 归属不一致/
  );

  const sourceMismatch = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  sourceMismatch.coverageManifest.reviewLanes[1].sourceIds = [];
  await writeFile(
    sourceMismatch.manifestPath,
    `${JSON.stringify(sourceMismatch.coverageManifest, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(sourceMismatch.runPath),
    /review lane official-product-feed\.sourceIds 与 reviewSources 归属不一致/
  );

  const candidateMismatch = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  candidateMismatch.coverageManifest.reviewLanes[0].candidateIds.pop();
  await writeFile(
    candidateMismatch.manifestPath,
    `${JSON.stringify(candidateMismatch.coverageManifest, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(candidateMismatch.runPath),
    /review lane major-model-product\.candidateIds 与候选索引归属不一致/
  );
});

test("reviewLanes require unique valid lane ids", async (t) => {
  const invalid = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  invalid.coverageManifest.reviewLanes[0].id = "Invalid Lane";
  await writeFile(
    invalid.manifestPath,
    `${JSON.stringify(invalid.coverageManifest, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(invalid.runPath),
    /reviewLanes 编号无效或重复/
  );

  const duplicate = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  duplicate.coverageManifest.reviewLanes.push(
    structuredClone(duplicate.coverageManifest.reviewLanes[0])
  );
  await writeFile(
    duplicate.manifestPath,
    `${JSON.stringify(duplicate.coverageManifest, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(duplicate.runPath),
    /reviewLanes 编号无效或重复/
  );
});

test("manifest v2 selected stories require indexed source ids and exact indexed URLs", async (t) => {
  const missingIds = await writeFormalCoverageFixture(t);
  delete missingIds.run.candidates[0].sourceCandidateIds;
  await writeFile(missingIds.runPath, `${JSON.stringify(missingIds.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(missingIds.runPath),
    /入选新闻 confirmed-lead 缺少 sourceCandidateIds/
  );

  const unknownId = await writeFormalCoverageFixture(t);
  unknownId.run.candidates[0].sourceCandidateIds = ["candidate-not-in-index"];
  await writeFile(unknownId.runPath, `${JSON.stringify(unknownId.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(unknownId.runPath),
    /sourceCandidateIds 必须非空、不重复且全部存在于候选索引/
  );

  const missingIndexedUrl = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  missingIndexedUrl.run.candidates[0].sourceUrls =
    ["https://example.test/confirmed-lead"];
  await writeFile(
    missingIndexedUrl.runPath,
    `${JSON.stringify(missingIndexedUrl.run, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(missingIndexedUrl.runPath),
    /sourceUrls 缺少索引候选 candidate-confirmed-lead-secondary 的 URL/
  );
});

test("priority review accepts exact selected and merged dispositions for focused candidates", async (t) => {
  const fixture = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  await assert.doesNotReject(() => readAndValidateRun(fixture.runPath));
});

test("new manifests require priorityReview even when the must-review set is empty", async (t) => {
  const fixture = await writeFormalCoverageFixture(t);
  delete fixture.run.coverageAudit.priorityReview;
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /缺少重点候选 priorityReview/
  );

  fixture.run.coverageAudit.priorityReview = { decisions: [] };
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.doesNotReject(() => readAndValidateRun(fixture.runPath));
});

test("priorityReview must dispose every focused candidate exactly once", async (t) => {
  const missing = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  missing.run.coverageAudit.priorityReview.decisions.pop();
  await writeFile(missing.runPath, `${JSON.stringify(missing.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(missing.runPath),
    /每个 must-review 重点候选恰好处置一次/
  );

  const duplicate = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  duplicate.run.coverageAudit.priorityReview.decisions.push(
    structuredClone(duplicate.run.coverageAudit.priorityReview.decisions[0])
  );
  await writeFile(duplicate.runPath, `${JSON.stringify(duplicate.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(duplicate.runPath),
    /被重复处置/
  );
});

test("priorityReview must map every selected article candidate to a selected disposition", async (t) => {
  const fixture = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  const selected = fixture.run.coverageAudit.priorityReview.decisions
    .find((decision) => decision.decision === "selected");
  selected.decision = "rejected";
  selected.substantiveChange = false;
  selected.score = {
    reach: 1,
    magnitude: 1,
    practicalValue: 1,
    evidence: 1,
    total: 4
  };
  selected.rejectionReason = "insufficient-evidence";
  selected.note = "负向回归：不能把实际入选稿件对应的来源标成拒绝。";
  delete selected.storyKey;
  delete selected.sourceCandidateIds;
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);

  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /每篇实际入选新闻提供且只提供一个 selected 处置/
  );
});

test("priorityReview locks score math and selected source-candidate mapping", async (t) => {
  const badTotal = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  badTotal.run.coverageAudit.priorityReview.decisions[2].score.total = 8;
  await writeFile(badTotal.runPath, `${JSON.stringify(badTotal.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(badTotal.runPath),
    /score\.total 必须等于四项分数之和/
  );

  const badMapping = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  badMapping.run.candidates[0].sourceCandidateIds = ["candidate-confirmed-lead"];
  await writeFile(badMapping.runPath, `${JSON.stringify(badMapping.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(badMapping.runPath),
    /sourceCandidateIds 必须与入选新闻 confirmed-lead/
  );
});

test("protected priority classes cannot be rejected at seven and require substantive selection", async (t) => {
  const highValueRejected = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  const rejected = highValueRejected.run.coverageAudit.priorityReview.decisions[1];
  rejected.decision = "rejected";
  rejected.substantiveChange = true;
  rejected.rejectionReason = "below-importance-threshold";
  rejected.note = "编辑审阅认为影响不足。";
  delete rejected.representativeCandidateId;
  highValueRejected.run.coverageAudit.priorityReview.decisions[0].sourceCandidateIds =
    ["candidate-confirmed-lead"];
  highValueRejected.run.candidates[0].sourceCandidateIds = ["candidate-confirmed-lead"];
  await writeFile(
    highValueRejected.runPath,
    `${JSON.stringify(highValueRejected.run, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(highValueRejected.runPath),
    /评分达到 7 分后不得拒绝/
  );

  const nonSubstantiveSelected = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  nonSubstantiveSelected.run.coverageAudit.priorityReview.decisions[2]
    .substantiveChange = false;
  await writeFile(
    nonSubstantiveSelected.runPath,
    `${JSON.stringify(nonSubstantiveSelected.run, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(nonSubstantiveSelected.runPath),
    /substantiveChange 必须为 true/
  );
});

test("protected priority candidates may be rejected below seven with an enumerated reason and note", async (t) => {
  const fixture = await writeFormalCoverageFixture(t, {
    withPriorityReview: true
  });
  const rejected = fixture.run.coverageAudit.priorityReview.decisions[1];
  rejected.decision = "rejected";
  rejected.substantiveChange = false;
  rejected.score = {
    reach: 1,
    magnitude: 1,
    practicalValue: 2,
    evidence: 2,
    total: 6
  };
  rejected.rejectionReason = "below-importance-threshold";
  rejected.note = "有可靠消息，但影响范围和实际变化均未达到刊发门槛。";
  delete rejected.representativeCandidateId;
  fixture.run.coverageAudit.priorityReview.decisions[0].sourceCandidateIds =
    ["candidate-confirmed-lead"];
  fixture.run.candidates[0].sourceCandidateIds = ["candidate-confirmed-lead"];
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);

  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /below-importance-threshold 时 substantiveChange 必须为 true/
  );

  rejected.substantiveChange = true;
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);

  await assert.doesNotReject(() => readAndValidateRun(fixture.runPath));

  rejected.rejectionReason = "free-form-reason";
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /rejectionReason 不在允许的拒绝理由/
  );

  rejected.rejectionReason = "below-importance-threshold";
  rejected.note = "";
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /note 必须具体说明拒绝依据/
  );

  rejected.note = "没有发现相对于既有事件阶段的实质变化。";
  rejected.rejectionReason = "no-material-change";
  rejected.substantiveChange = true;
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /no-material-change 时 substantiveChange 必须为 false/
  );

  rejected.substantiveChange = false;
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.doesNotReject(() => readAndValidateRun(fixture.runPath));
});

test("usage-policy signals cannot be downgraded to developer-tool or rejected as unimportant", async (t) => {
  const wrongClass = await writeFormalCoverageFixture(t, {
    withPriorityReview: true,
    usagePolicySignals: ["usage-policy-change"]
  });
  await assert.rejects(
    () => readAndValidateRun(wrongClass.runPath),
    /editorialClass 必须是 usage-policy 或 material-price-quota/
  );

  const lowScore = await writeFormalCoverageFixture(t, {
    withPriorityReview: true,
    usagePolicySignals: ["usage-policy-change"]
  });
  const decision = lowScore.run.coverageAudit.priorityReview.decisions[2];
  decision.decision = "rejected";
  decision.editorialClass = "usage-policy";
  decision.substantiveChange = true;
  decision.score = {
    reach: 1,
    magnitude: 1,
    practicalValue: 1,
    evidence: 1,
    total: 4
  };
  decision.rejectionReason = "below-importance-threshold";
  decision.note = "错误地把明确的五小时限额恢复视为低价值消息。";
  delete decision.storyKey;
  delete decision.sourceCandidateIds;
  await writeFile(lowScore.runPath, `${JSON.stringify(lowScore.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(lowScore.runPath),
    /不得以重要性不足、例行消息或超出范围为由拒绝/
  );
});

test("focused editorial signals cannot be flattened into the other class", async (t) => {
  const cases = [
    ["major-model-product-change", "major-model-product"],
    ["capability-availability-change", "capability-availability"],
    ["developer-tool-change", "developer-tool"],
    ["material-price-quota-change", "material-price-quota"],
    ["strategic-hardware-infrastructure-change", "strategic-hardware-infrastructure"],
    ["major-tech-finance-change", "major-tech-finance"],
    ["ai-policy-safety-change", "ai-policy-safety"]
  ];
  for (const [signal, expectedClass] of cases) {
    const fixture = await writeFormalCoverageFixture(t, {
      withPriorityReview: true,
      usagePolicySignals: [signal]
    });
    const decision = fixture.run.coverageAudit.priorityReview.decisions[2];
    decision.editorialClass = expectedClass;
    await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
    await assert.doesNotReject(() => readAndValidateRun(fixture.runPath));

    decision.editorialClass = "other";
    await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
    await assert.rejects(
      () => readAndValidateRun(fixture.runPath),
      /editorialSignals 要求映射到/
    );
    if (signal === "material-price-quota-change") {
      decision.editorialClass = "usage-policy";
      await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
      await assert.rejects(
        () => readAndValidateRun(fixture.runPath),
        /editorialSignals 要求映射到 material-price-quota/
      );
    }
  }
});

test("compatible product signals allow either matching class while specialized signals win", async (t) => {
  for (const editorialClass of ["major-model-product", "capability-availability"]) {
    const fixture = await writeFormalCoverageFixture(t, {
      withPriorityReview: true,
      usagePolicySignals: [
        "major-model-product-change",
        "capability-availability-change"
      ]
    });
    const decision = fixture.run.coverageAudit.priorityReview.decisions[2];
    decision.editorialClass = editorialClass;
    await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
    await assert.doesNotReject(() => readAndValidateRun(fixture.runPath));
  }

  const specialized = await writeFormalCoverageFixture(t, {
    withPriorityReview: true,
    usagePolicySignals: [
      "major-model-product-change",
      "material-price-quota-change"
    ]
  });
  const specializedDecision = specialized.run.coverageAudit.priorityReview.decisions[2];
  specializedDecision.editorialClass = "major-model-product";
  await writeFile(
    specialized.runPath,
    `${JSON.stringify(specialized.run, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(specialized.runPath),
    /editorialSignals 要求映射到 material-price-quota/
  );
});

test("low-volume second pass is later and includes signals, RSS, and protected borderline scores", async (t) => {
  const fixture = await writeFormalCoverageFixture(t, {
    withPriorityReview: true,
    completeReviewPolicy: true
  });
  await assert.doesNotReject(() => readAndValidateRun(fixture.runPath));

  fixture.run.coverageAudit.secondPass.reconsideredCandidateIds.pop();
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /必须至少覆盖全部 editorialSignals 候选、RSS 候选和 protected 5\/6 分拒稿/
  );

  fixture.run.coverageAudit.secondPass.reconsideredCandidateIds =
    fixture.candidateIndex.items
      .filter((item) => item.sourceType === "rss")
      .map((item) => item.id);
  fixture.run.coverageAudit.secondPass.reconsideredCandidateIds.push(
    "candidate-unverified-rumor"
  );
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.doesNotReject(() => readAndValidateRun(fixture.runPath));

  fixture.run.coverageAudit.secondPass.completedAt =
    fixture.run.coverageAudit.candidateIndexReviewedAt;
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /completedAt 必须严格晚于初审 candidateIndexReviewedAt/
  );
});

test("all-discovered review fails closed on August 3 style classification and score collapse", async (t) => {
  const allOther = await writeFormalCoverageFixture(t, {
    withPriorityReview: true,
    completeReviewPolicy: true,
    extraRejectedCandidates: 60
  });
  for (const decision of allOther.run.coverageAudit.priorityReview.decisions) {
    decision.editorialClass = "other";
  }
  await writeFile(allOther.runPath, `${JSON.stringify(allOther.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(allOther.runPath),
    /候选量充足但全部被统一标为 other/
  );

  const scoreCollapse = await writeFormalCoverageFixture(t, {
    withPriorityReview: true,
    completeReviewPolicy: true,
    extraRejectedCandidates: 60
  });
  await assert.doesNotReject(() => readAndValidateRun(scoreCollapse.runPath));
  for (const decision of scoreCollapse.run.coverageAudit.priorityReview.decisions) {
    if (decision.decision === "rejected") {
      decision.editorialClass = "other";
      decision.score = {
        reach: 1,
        magnitude: 1,
        practicalValue: 1,
        evidence: 1,
        total: 4
      };
    }
  }
  await writeFile(
    scoreCollapse.runPath,
    `${JSON.stringify(scoreCollapse.run, null, 2)}\n`
  );
  await assert.rejects(
    () => readAndValidateRun(scoreCollapse.runPath),
    /至少 90% 的拒稿使用完全相同的编辑类别与四项评分模板/
  );
});

test("Daily AI News validator allows fewer than five evidence-qualified rumors", () => {
  const run = validRun();
  run.reportDate = "2026-08-24";
  run.windowStart = "2026-08-23T07:00:00+08:00";
  run.windowEnd = "2026-08-24T07:00:00+08:00";
  run.delivery.slug = "daily-ai-news-2026-08-24";
  run.delivery.idempotencyKey = "daily-ai-news:2026-08-24:validator-test";
  run.selection.importanceThreshold = 6;
  run.selection.rumorImportanceThreshold = 5;
  run.candidates.find((item) => item.section === "rumor").importance = 5;
  run.coverageAudit.secondPass = {
    required: false,
    completed: false,
    signedOffQueryIds: [],
    signedOffGroupIds: []
  };
  for (const storyKey of ["confirmed-main-two", "confirmed-main-three"]) {
    run.candidates.push(candidate({
      storyKey,
      section: "main",
      verification: "confirmed",
      aiTake: "它补充了另一项达到门槛的确认进展，而不是为了满足传闻数量而添加内容。"
    }));
    run.selection.selectedStoryKeys.push(storyKey);
  }
  const extraSections = {
    zh: [
      "### 第二条确认新闻\n\n这是一条独立、位于窗口内并达到门槛的确认新闻，正文提供足够信息供读者理解实际变化。\n\n**AI 解读：** 它补充了有效信息，不用于填充传闻栏目。",
      "### 第三条确认新闻\n\n另一条独立确认新闻说明了不同事件的参与方、变化范围和读者可采取的下一步行动。\n\n**AI 解读：** 价值来自独立事件本身，而不是栏目数量。"
    ],
    en: [
      "### A second confirmed item\n\nThis independent in-window item clears the publication threshold and gives readers enough detail to understand the practical change.\n\n**AI take:** It adds useful information without padding the rumor section.",
      "### A third confirmed item\n\nAnother independent confirmed item explains a different event, its scope and the next practical action for readers.\n\n**AI take:** Its value comes from the event itself, not a section count."
    ],
    ja: [
      "### 2件目の確認済みニュース\n\n期間内の独立した確認済みニュースとして基準を満たし、実際の変化を理解できる情報を整理します。\n\n**AI解説：** 噂欄を埋めるためではなく、有用な情報を追加します。",
      "### 3件目の確認済みニュース\n\n別の独立した出来事について、関係者、範囲、読者が取れる次の行動を説明します。\n\n**AI解説：** 価値は件数ではなく、出来事そのものにあります。"
    ]
  };
  const rumorHeadings = { zh: "## 传闻", en: "## Rumors", ja: "## 噂" };
  for (const lang of ["zh", "en", "ja"]) {
    run.delivery.translations[lang].content_markdown =
      run.delivery.translations[lang].content_markdown.replace(
        `\n${rumorHeadings[lang]}`,
        `\n${extraSections[lang].join("\n\n")}\n\n${rumorHeadings[lang]}`
      );
  }
  for (const runCandidate of run.candidates) {
    runCandidate.publishedDate = "2026-08-24";
    runCandidate.publishedAt = "2026-08-24T06:00:00+08:00";
  }
  assert.doesNotThrow(() => validateRun(run));
});

test("Daily AI News validator keeps the historical six-point rumor gate", () => {
  const run = validRun();
  run.selection.importanceThreshold = 6;
  run.selection.rumorImportanceThreshold = 5;
  run.candidates.find((item) => item.section === "rumor").importance = 5;
  assert.throws(
    () => validateRun(run),
    /低于重要性门槛却被选入/
  );
});

test("priority review rejects cross-event merges caused by secondary title mentions", () => {
  assert.throws(
    () => validateMergedPriorityEventIdentities([
      {
        candidateId: "candidate-grok",
        decision: "selected",
        eventKey: "grok-4-6",
        eventStage: "release"
      },
      {
        candidateId: "candidate-deepseek-title-also-mentions-grok",
        decision: "merged",
        representativeCandidateId: "candidate-grok",
        eventKey: "deepseek-v4-pro-0813",
        eventStage: "release"
      }
    ]),
    /不得因次要提及而跨事件 merged/
  );
});

test("objective programmatic pre-screen decisions are excluded from semantic template checks", () => {
  const prescreen = Array.from({ length: 60 }, (_, index) => ({
    candidateId: `candidate-${index}`,
    decision: "rejected",
    editorialClass: "other",
    substantiveChange: false,
    score: { reach: 0, magnitude: 0, practicalValue: 0, evidence: 0, total: 0 },
    note: "This candidate was objectively excluded by the auditable low-signal pre-screen.",
    reviewMethod: "programmatic-prescreen",
    preFilterReason: "low-signal-aggregator-discovery"
  }));
  assert.doesNotThrow(() => validateNonDegeneratePriorityReview(prescreen));
});

test("all-discovered review rejects rotating hash score and note palettes", async (t) => {
  const fixture = await writeFormalCoverageFixture(t, {
    withPriorityReview: true,
    completeReviewPolicy: true,
    extraRejectedCandidates: 60
  });
  const scorePatterns = [
    [1, 1, 1, 1],
    [2, 1, 1, 1],
    [1, 2, 1, 1],
    [1, 1, 2, 1]
  ];
  const notePatterns = [
    "No reliable publication time was independently verified.",
    "The candidate lacks a material current event stage.",
    "The candidate is outside the editorial focus after review.",
    "The discovery lead did not provide enough direct evidence."
  ];
  let rejectedIndex = 0;
  for (const decision of fixture.run.coverageAudit.priorityReview.decisions) {
    if (decision.decision !== "rejected") {
      continue;
    }
    const score = scorePatterns[rejectedIndex % scorePatterns.length];
    decision.score = {
      reach: score[0],
      magnitude: score[1],
      practicalValue: score[2],
      evidence: score[3],
      total: score.reduce((total, value) => total + value, 0)
    };
    decision.note = `${notePatterns[rejectedIndex % notePatterns.length]} Candidate ${rejectedIndex}.`;
    rejectedIndex += 1;
  }
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /只轮换少量评分组合与结论模板/
  );
});

test("new manifests require evidence-backed protected event review", async (t) => {
  const fixture = await writeFormalCoverageFixture(t, {
    withPriorityReview: true,
    completeReviewPolicy: true,
    protectedEventReviewPolicy: true,
    extraRejectedCandidates: 60
  });
  await assert.doesNotReject(() => readAndValidateRun(fixture.runPath));

  delete fixture.run.coverageAudit.protectedEventReview;
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /缺少 protectedEventReview/
  );
});

test("protected event review allows merged aliases to retain their own protected class", async (t) => {
  const fixture = await writeFormalCoverageFixture(t, {
    withPriorityReview: true,
    completeReviewPolicy: true,
    protectedEventReviewPolicy: true
  });
  const selectedEvent = fixture.run.coverageAudit.protectedEventReview.events
    .find((event) => event.disposition === "selected"
      && event.candidateIds.length > 1);
  const mergedDecision = fixture.run.coverageAudit.priorityReview.decisions
    .find((decision) => decision.candidateId !== selectedEvent.representativeCandidateId
      && selectedEvent.candidateIds.includes(decision.candidateId));
  mergedDecision.editorialClass = "capability-availability";
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.doesNotReject(() => readAndValidateRun(fixture.runPath));
});

test("protected event review keeps the representative anchored to the event class", async (t) => {
  const fixture = await writeFormalCoverageFixture(t, {
    withPriorityReview: true,
    completeReviewPolicy: true,
    protectedEventReviewPolicy: true
  });
  const selectedEvent = fixture.run.coverageAudit.protectedEventReview.events
    .find((event) => event.disposition === "selected");
  const representativeDecision = fixture.run.coverageAudit.priorityReview.decisions
    .find((decision) => decision.candidateId === selectedEvent.representativeCandidateId);
  representativeDecision.editorialClass = "capability-availability";
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /代表候选分类必须与事件主分类一致/
  );
});

test("protected event policy cannot be removed from effective-date manifests", async (t) => {
  const fixture = await writeFormalCoverageFixture(t, {
    withPriorityReview: true,
    completeReviewPolicy: true,
    reportDate: "2026-08-07",
    runId: "run-20260807T010203Z-policy123"
  });
  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /2026-08-07 起的新运行必须声明 protectedEventReviewPolicy/
  );
});

test("protected event review covers every required candidate exactly once", async (t) => {
  const fixture = await writeFormalCoverageFixture(t, {
    withPriorityReview: true,
    completeReviewPolicy: true,
    protectedEventReviewPolicy: true,
    extraRejectedCandidates: 12
  });
  fixture.run.coverageAudit.protectedEventReview.events.pop();
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /每个候选恰好审阅一次/
  );
});

test("protected event review requires direct reliable timing evidence", async (t) => {
  const fixture = await writeFormalCoverageFixture(t, {
    withPriorityReview: true,
    completeReviewPolicy: true,
    protectedEventReviewPolicy: true
  });
  const selectedEvent = fixture.run.coverageAudit.protectedEventReview.events
    .find((event) => event.disposition === "selected");
  selectedEvent.reliableSourceUrls = ["https://news.google.com/articles/fixture"];
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.rejects(
    () => readAndValidateRun(fixture.runPath),
    /官方／可靠直达来源/
  );
});

test("protected event review accepts evidence-backed outside-window rejections", async (t) => {
  const fixture = await writeFormalCoverageFixture(t, {
    withPriorityReview: true,
    completeReviewPolicy: true,
    protectedEventReviewPolicy: true,
    extraRejectedCandidates: 2
  });
  const outsideEvent = fixture.run.coverageAudit.protectedEventReview.events
    .find((event) => event.disposition === "rejected");
  const outsideDecision = fixture.run.coverageAudit.priorityReview.decisions
    .find((decision) => decision.candidateId === outsideEvent.representativeCandidateId);
  outsideEvent.rejectionReason = "outside-publication-window";
  outsideEvent.verificationStatus = "verified-outside-window";
  outsideEvent.reliableSourceUrls = ["https://example.test/official-outside-window"];
  outsideEvent.firstReliablePublishedAt = "2026-07-25T06:00:00+08:00";
  outsideDecision.rejectionReason = "outside-publication-window";
  await writeFile(fixture.runPath, `${JSON.stringify(fixture.run, null, 2)}\n`);
  await assert.doesNotReject(() => readAndValidateRun(fixture.runPath));
});

test("Daily AI News validator enforces the exact 24-hour publication window", () => {
  const outsideWindow = clone(validRun());
  outsideWindow.candidates[1].publishedAt = "2026-07-26T06:59:59+08:00";
  assert.throws(() => validateRun(outsideWindow), /不在发布前 24 小时窗口内/);

  const wrongWindowLength = clone(validRun());
  wrongWindowLength.windowStart = "2026-07-26T06:00:00+08:00";
  assert.throws(() => validateRun(wrongWindowLength), /必须恰好为发布前 24 小时/);

  const wrongCutoff = clone(validRun());
  wrongCutoff.windowStart = "2026-07-26T06:00:00+08:00";
  wrongCutoff.windowEnd = "2026-07-27T06:00:00+08:00";
  assert.throws(() => validateRun(wrongCutoff), /前一日 07:00 至当日 07:00/);
});

test("Daily AI News validator keeps formal article copy free of links", () => {
  const linked = clone(validRun());
  linked.delivery.translations.zh.content_markdown += "\n\nhttps://example.test/source";
  assert.throws(() => validateRun(linked), /zh 正文含有外链/);

  const relativeLink = clone(validRun());
  relativeLink.delivery.translations.en.content_markdown += "\n\n[Read more](source.html)";
  assert.throws(() => validateRun(relativeLink), /en 正文含有外链/);
});

test("Daily AI News keeps the 27 July 23:00 sample behind an explicit one-shot", () => {
  const historical = validRun();
  historical.schemaVersion = 3;
  historical.windowStart = "2026-07-26T23:00:00+08:00";
  historical.windowEnd = "2026-07-27T23:00:00+08:00";
  for (const [lang, legacyTitle] of Object.entries({
    zh: "每日 AI 新闻｜2026 年 7 月 27 日",
    en: "Daily AI News | July 27, 2026",
    ja: "毎日AIニュース｜2026年7月27日"
  })) {
    const translation = historical.delivery.translations[lang];
    translation.content_markdown = translation.content_markdown.replace(
      `# ${translation.title}`,
      `# ${legacyTitle}`
    );
    translation.title = legacyTitle;
  }

  assert.equal(isHistoricalOneShotWindow(historical), true);
  assert.throws(() => validateRun(historical), /显式 one-shot 参数/);
  assert.doesNotThrow(() => validateRun(historical, {
    allowHistoricalOneShot: true
  }));
});

test("Daily AI News production delivery allows the full Beijing report date after 07:00", () => {
  const run = validRun();
  const openWindow = assertProductionSchedule(run, {
    now: new Date("2026-07-26T23:30:00.000Z")
  });
  assert.equal(openWindow.deadlineAt, Date.parse("2026-07-28T00:00:00+08:00"));

  assert.throws(() => assertProductionSchedule(run, {
    now: new Date("2026-07-26T22:59:59.000Z")
  }), /尚未到北京时间 07:00/);
  assert.doesNotThrow(() => assertProductionSchedule(run, {
    now: new Date("2026-07-27T00:00:00.000Z")
  }));
  assert.throws(() => assertProductionSchedule(run, {
    now: new Date("2026-07-27T15:59:30.000Z")
  }), /不足 45 秒/);

  const historical = clone(run);
  historical.windowStart = "2026-07-26T23:00:00+08:00";
  historical.windowEnd = "2026-07-27T23:00:00+08:00";
  assert.doesNotThrow(() => assertProductionSchedule(historical, {
    now: new Date("2030-01-01T00:00:00.000Z"),
    oneShotHistory: true
  }));
});

test("Daily AI News production delivery requires an explicit run and a published response", () => {
  assert.deepEqual(
    parseProductionArgs(["--run", "runs/today.json"]),
    {
      runPath: "runs/today.json",
      oneShotHistory: false,
      manualRecovery: false,
      confirmReportDate: "",
      confirmRunSha256: "",
      printRunSha256: false
    }
  );
  assert.deepEqual(
    parseProductionArgs([
      "--run",
      "runs/recovery.json",
      "--manual-recovery",
      "--confirm-report-date",
      "2026-07-27",
      "--confirm-run-sha256",
      "a".repeat(64)
    ]),
    {
      runPath: "runs/recovery.json",
      oneShotHistory: false,
      manualRecovery: true,
      confirmReportDate: "2026-07-27",
      confirmRunSha256: "a".repeat(64),
      printRunSha256: false
    }
  );
  assert.deepEqual(
    parseProductionArgs(["--run", "runs/today.json", "--print-run-sha256"]),
    {
      runPath: "runs/today.json",
      oneShotHistory: false,
      manualRecovery: false,
      confirmReportDate: "",
      confirmRunSha256: "",
      printRunSha256: true
    }
  );
  assert.throws(() => parseProductionArgs([]), /必须显式提供 --run/);
  assert.throws(() => parseProductionArgs(["--run", "run.json", "--unexpected"]), /未知参数/);
  assert.throws(
    () => parseProductionArgs([
      "--run",
      "run.json",
      "--one-shot-history",
      "--manual-recovery",
      "--confirm-report-date",
      "2026-07-27",
      "--confirm-run-sha256",
      "a".repeat(64)
    ]),
    /不能同时使用/
  );
  assert.throws(
    () => parseProductionArgs(["--run", "run.json", "--manual-recovery"]),
    /必须同时提供/
  );
  assert.throws(
    () => parseProductionArgs([
      "--run",
      "run.json",
      "--confirm-report-date",
      "2026-07-27"
    ]),
    /只能与 --manual-recovery/
  );
  assert.throws(
    () => parseProductionArgs([
      "--run",
      "run.json",
      "--manual-recovery",
      "--confirm-report-date",
      "2026-02-30",
      "--confirm-run-sha256",
      "a".repeat(64)
    ]),
    /有效的 YYYY-MM-DD/
  );
  assert.throws(
    () => parseProductionArgs([
      "--run",
      "run.json",
      "--manual-recovery",
      "--confirm-report-date",
      "2026-07-27",
      "--confirm-run-sha256",
      "ABC"
    ]),
    /64 位小写/
  );
  assert.throws(
    () => parseProductionArgs([
      "--run",
      "run.json",
      "--print-run-sha256",
      "--manual-recovery",
      "--confirm-report-date",
      "2026-07-27",
      "--confirm-run-sha256",
      "a".repeat(64)
    ]),
    /不能同时使用/
  );
  assert.throws(
    () => parseProductionArgs(["--run", "run.json", "--run", "other.json"]),
    /参数不能重复/
  );
  assert.equal(
    validateProductionEndpoint("https://lusu575.com/api/automation/daily-ai-news"),
    "https://lusu575.com/api/automation/daily-ai-news"
  );
  assert.throws(
    () => validateProductionEndpoint("http://lusu575.com/api/automation/daily-ai-news"),
    /必须是 lusu575\.com/
  );
  assert.throws(
    () => validateProductionEndpoint("https://attacker.example/api/automation/daily-ai-news"),
    /必须是 lusu575\.com/
  );

  const run = validRun();
  assert.equal(validateDeliveryResponse({
    httpStatus: 201,
    responseOk: true,
    payload: {
      ok: true,
      category: "daily-ai-news",
      status: "published",
      slug: run.delivery.slug,
      articleId: "article-1"
    },
    run
  }).status, "published");
  assert.throws(() => validateDeliveryResponse({
    httpStatus: 201,
    responseOk: true,
    payload: {
      ok: true,
      category: "daily-ai-news",
      status: "draft",
      slug: run.delivery.slug,
      articleId: "article-1"
    },
    run
  }), /未确认文章已.*公开/);
});

test("Daily AI News manual recovery requires same-day double confirmation", () => {
  const recovery = validRun();
  const confirmedSha256 = canonicalRunSha256(recovery);
  const confirmation = {
    confirmReportDate: "2026-07-27",
    confirmRunSha256: confirmedSha256
  };
  const authorizedAt = new Date("2026-07-27T08:30:00+08:00");

  assert.match(confirmedSha256, /^[a-f0-9]{64}$/);
  assert.equal(isAuthorizedManualRecovery(recovery, {
    now: authorizedAt,
    ...confirmation
  }), true);
  const schedule = assertProductionSchedule(recovery, {
    now: authorizedAt,
    manualRecovery: true,
    ...confirmation
  });
  assert.equal(schedule.deadlineAt, Date.parse("2026-07-28T00:00:00+08:00"));
  assert.equal(schedule.remainingMs, 15.5 * 60 * 60 * 1000);
  assert.doesNotThrow(() => assertProductionSchedule(recovery, {
    now: new Date("2026-07-27T08:00:00+08:00"),
    manualRecovery: true,
    ...confirmation
  }));

  assert.doesNotThrow(() => assertProductionSchedule(recovery, {
    now: authorizedAt
  }));
  assert.throws(() => assertProductionSchedule(recovery, {
    now: authorizedAt,
    confirmReportDate: confirmation.confirmReportDate,
    confirmRunSha256: confirmation.confirmRunSha256
  }), /只能与 --manual-recovery/);
  assert.doesNotThrow(() => assertProductionSchedule(recovery, {
    now: new Date("2026-07-27T07:59:59+08:00"),
    manualRecovery: true,
    ...confirmation
  }));
  assert.doesNotThrow(() => assertProductionSchedule(recovery, {
    now: new Date("2026-07-27T23:59:15+08:00"),
    manualRecovery: true,
    ...confirmation
  }));
  assert.throws(() => assertProductionSchedule(recovery, {
    now: new Date("2026-07-27T23:59:16+08:00"),
    manualRecovery: true,
    ...confirmation
  }), /不足 45 秒/);
  assert.throws(() => assertProductionSchedule(recovery, {
    now: new Date("2026-07-28T00:00:00+08:00"),
    manualRecovery: true,
    ...confirmation
  }), /当天 07:00 至次日 00:00/);

  assert.equal(isAuthorizedManualRecovery(recovery, {
    now: authorizedAt,
    confirmReportDate: "2026-07-26",
    confirmRunSha256: confirmedSha256
  }), false);
  assert.equal(isAuthorizedManualRecovery(recovery, {
    now: authorizedAt,
    confirmReportDate: "2026-07-28",
    confirmRunSha256: confirmedSha256
  }), false);
  assert.equal(isAuthorizedManualRecovery(recovery, {
    now: authorizedAt,
    confirmReportDate: "2026-07-27",
    confirmRunSha256: "b".repeat(64)
  }), false);

  const tampered = clone(recovery);
  tampered.delivery.translations.zh.summary += "篡改";
  assert.equal(isAuthorizedManualRecovery(tampered, {
    now: authorizedAt,
    ...confirmation
  }), false);

  for (const mutate of [
    (run) => {
      run.schemaVersion = 3;
    },
    (run) => {
      run.timezone = "UTC";
    },
    (run) => {
      run.windowStart = "2026-07-26T07:00:01+08:00";
    },
    (run) => {
      run.windowEnd = "2026-07-27T07:00:01+08:00";
    },
    (run) => {
      run.delivery.slug = "daily-ai-news-other";
    }
  ]) {
    const invalid = clone(recovery);
    mutate(invalid);
    assert.equal(isAuthorizedManualRecovery(invalid, {
      now: authorizedAt,
      confirmReportDate: "2026-07-27",
      confirmRunSha256: canonicalRunSha256(invalid)
    }), false);
  }

  assert.throws(() => assertProductionSchedule(recovery, {
    now: authorizedAt,
    oneShotHistory: true,
    manualRecovery: true,
    ...confirmation
  }), /不能同时启用/);
});

test("Daily AI News production delivery verifies all three public article representations", async () => {
  const run = validRun();
  const urls = publicArticleUrls(
    "https://lusu575.com/api/automation/daily-ai-news",
    run.delivery.slug
  );
  assert.equal(Object.keys(urls).length, 3);
  assert.match(urls.ja, /\?lang=ja$/);

  const requested = [];
  await verifyPublicArticleTranslations({
    endpoint: "https://lusu575.com/api/automation/daily-ai-news",
    run,
    timeoutMs: 1_000,
    fetchImpl: async (url, options) => {
      const lang = new URL(url).searchParams.get("lang");
      requested.push(lang);
      assert.equal(options.headers.Authorization, undefined);
      return new Response(JSON.stringify({
        article: {
          slug: run.delivery.slug,
          category: "daily-ai-news",
          status: "published",
          lang,
          requested_lang: lang,
          title: run.delivery.translations[lang].title,
          content_markdown: run.delivery.translations[lang].content_markdown
        }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });
  assert.deepEqual(requested.sort(), ["en", "ja", "zh"]);

  assert.throws(() => validatePublicArticlePayload({
    payload: {
      article: {
        slug: run.delivery.slug,
        category: "daily-ai-news",
        status: "published",
        lang: "ja",
        requested_lang: "ja",
        title: run.delivery.translations.ja.title,
        content_markdown: "被替换的正文"
      }
    },
    lang: "ja",
    run
  }), /ja 公开文章核验失败/);
});

test("Daily AI News network client uses explicit HTTP proxy environment without exposing it", async () => {
  assert.deepEqual(proxyOptionsFromEnvironment({
    HTTP_PROXY: "http://127.0.0.1:6789",
    HTTPS_PROXY: "http://127.0.0.1:6789",
    ALL_PROXY: "http://127.0.0.1:9",
    NO_PROXY: "127.0.0.1,localhost"
  }), {
    httpProxy: "http://127.0.0.1:6789",
    httpsProxy: "http://127.0.0.1:6789",
    noProxy: "127.0.0.1,localhost"
  });

  const dispatcher = {
    closed: false,
    async close() {
      this.closed = true;
    }
  };
  let receivedDispatcher = null;
  const network = createProxyAwareFetch({
    environment: {},
    dispatcherFactory: () => dispatcher,
    fetchImpl: async (_url, options) => {
      receivedDispatcher = options.dispatcher;
      return new Response("ok");
    }
  });
  const response = await network.fetch("https://example.com/");
  assert.equal(await response.text(), "ok");
  assert.equal(receivedDispatcher, dispatcher);
  await network.close();
  assert.equal(dispatcher.closed, true);
  assert.throws(() => network.fetch("https://example.com/"), /已经关闭/);
});

test("Daily AI News public readback retries only transient GET failures", async () => {
  const run = validRun();
  let attempts = 0;
  const article = {
    slug: run.delivery.slug,
    category: "daily-ai-news",
    status: "published",
    lang: "zh",
    requested_lang: "zh",
    title: run.delivery.translations.zh.title,
    content_markdown: run.delivery.translations.zh.content_markdown
  };

  const result = await fetchPublicArticleWithRetry({
    url: `https://lusu575.com/api/articles/${run.delivery.slug}?lang=zh`,
    lang: "zh",
    run,
    deadlineAt: Date.now() + 1_000,
    retryDelaysMs: [0],
    sleep: async () => {},
    fetchImpl: async (_url, options) => {
      attempts += 1;
      assert.equal(options.method, "GET");
      if (attempts === 1) {
        return new Response("temporary", { status: 503 });
      }
      return new Response(JSON.stringify({ article }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });
  assert.equal(result.slug, run.delivery.slug);
  assert.equal(attempts, 2);

  attempts = 0;
  await assert.rejects(fetchPublicArticleWithRetry({
    url: `https://lusu575.com/api/articles/${run.delivery.slug}?lang=zh`,
    lang: "zh",
    run,
    deadlineAt: Date.now() + 1_000,
    retryDelaysMs: [0, 0],
    sleep: async () => {},
    fetchImpl: async () => {
      attempts += 1;
      throw new TypeError("fetch failed");
    }
  }), /最多 3 次只读 GET.*生产 POST 不得自动重发/);
  assert.equal(attempts, 3);
});

test("Daily AI News production secret helpers preserve unrelated values and never expose the token", () => {
  const token = `lusu_ai_news_${"A".repeat(43)}`;
  const original = "KEEP=value\r\n# comment\r\n";
  const withToken = upsertDevVar(original, "DAILY_AI_NEWS_TOKEN", token);
  assert.equal(parseDevVars(withToken).KEEP, "value");
  assert.equal(parseDevVars(withToken).DAILY_AI_NEWS_TOKEN, token);
  assert.equal(removeDevVar(withToken, "DAILY_AI_NEWS_TOKEN").includes(token), false);

  const summary = redactedTokenSummary(token);
  assert.equal(summary.includes(token), false);
  assert.equal(summary.includes(token.slice(-6)), true);

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const sql = buildProductionChannelSql({
    tokenHash,
    tokenHint: token.slice(-6),
    timestamp: "2026-07-28T00:00:00.000Z"
  });
  assert.match(sql, /enabled = 1/);
  assert.match(sql, /auto_publish = 1/);
  assert.equal(sql.includes(token), false);
});
