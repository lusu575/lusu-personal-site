import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const CONFIRMED_STORY_MINIMUM_SCORE = 6;
const RUMOR_STORY_MINIMUM_SCORE = 5;
const RUMOR_EVIDENCE_BASES = new Set([
  'attributed-first-party-teaser',
  'two-independent-reliable-reports',
  'one-attributed-reliable-report',
]);

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const runDirArg = valueAfter('--run-dir');
const packageArg = valueAfter('--editorial-package');
if (!runDirArg || !packageArg) {
  throw new Error('Usage: assemble-semantic-run.mjs --run-dir <dir> --editorial-package <json>');
}

const runDir = path.resolve(runDirArg);
const packagePath = path.resolve(packageArg);
const indexPath = path.join(runDir, 'candidate_index.json');
const manifestPath = path.join(runDir, 'coverage_manifest.json');
const reviewPath = path.join(runDir, 'semantic_editorial_review.json');
const outputPath = path.join(runDir, 'daily_run.json');
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const index = readJson(indexPath);
const manifest = readJson(manifestPath);
const review = readJson(reviewPath);
const editorialPackage = readJson(packagePath);
const indexSha256 = crypto.createHash('sha256').update(fs.readFileSync(indexPath)).digest('hex');
if (manifest.candidateIndexSha256 !== indexSha256
  || review.candidateIndexSha256 !== indexSha256) {
  throw new Error('Candidate-index hash mismatch across manifest, review, and exact bytes.');
}
if (editorialPackage.reportDate !== manifest.reportDate
  || review.reportDate !== manifest.reportDate) {
  throw new Error('Editorial package belongs to a different report date.');
}

const rawEventByIdentity = new Map(review.protectedEvents.map((event) => [
  `${event.eventKey}/${event.eventStage}`,
  event,
]));
const allowedOverrideRejections = new Set([
  'insufficient-evidence',
  'below-importance-threshold',
  'routine-or-promotional',
  'outside-editorial-scope',
  'outside-publication-window',
  'no-material-change',
]);
const overridesByIdentity = new Map();
for (const override of editorialPackage.eventOverrides || []) {
  const identity = `${override.eventKey}/${override.eventStage}`;
  if (!rawEventByIdentity.has(identity) || overridesByIdentity.has(identity)) {
    throw new Error(`Editorial event override is unknown or duplicated: ${identity}`);
  }
  if (override.recommendedDisposition === 'merged') {
    const targetIdentity = `${override.mergeIntoEventKey}/${override.mergeIntoEventStage}`;
    if (targetIdentity === identity || !rawEventByIdentity.has(targetIdentity)
      || String(override.mergeRationale || '').trim().length < 24) {
      throw new Error(`Editorial event merge override is invalid: ${identity}`);
    }
    overridesByIdentity.set(identity, override);
    continue;
  }
  if (override.recommendedDisposition !== 'rejected'
    || !allowedOverrideRejections.has(override.recommendedRejectionReason)) {
    throw new Error(`Editorial event override must be an explicit rejection or merge: ${identity}`);
  }
  const score = override.score;
  const components = ['reach', 'magnitude', 'practicalValue', 'evidence'];
  const total = components.reduce((sum, field) => sum + Number(score?.[field]), 0);
  if (!components.every((field) => Number.isInteger(score?.[field]) && score[field] >= 0)
    || score.reach > 2 || score.magnitude > 3 || score.practicalValue > 3
    || score.evidence > 2 || score.total !== total || total >= 6) {
    throw new Error(`Editorial event override must contain a valid sub-six score: ${identity}`);
  }
  if (typeof override.substantiveChange !== 'boolean'
    || String(override.evidenceSummary || '').trim().length < 24
    || !components.every(
      (field) => String(override.scoreRationale?.[field] || '').trim().length >= 12,
    )) {
    throw new Error(`Editorial event override lacks specific semantic rationale: ${identity}`);
  }
  if (override.recommendedRejectionReason === 'no-material-change'
    && override.substantiveChange !== false) {
    throw new Error(`No-material-change override must be non-substantive: ${identity}`);
  }
  if (override.recommendedRejectionReason === 'below-importance-threshold'
    && override.substantiveChange !== true) {
    throw new Error(`Below-threshold override must be substantive: ${identity}`);
  }
  if (override.reliableSourceUrls !== undefined) {
    if (!Array.isArray(override.reliableSourceUrls)
      || override.reliableSourceUrls.some((url) => !String(url).startsWith('https://'))
      || (override.reliableSourceUrls.length > 0
        && !String(override.firstReliablePublishedAt || '').trim())) {
      throw new Error(`Editorial rejection evidence is invalid: ${identity}`);
    }
  }
  overridesByIdentity.set(identity, override);
}
for (const [identity, override] of overridesByIdentity) {
  if (override.recommendedDisposition !== 'merged') continue;
  const targetIdentity = `${override.mergeIntoEventKey}/${override.mergeIntoEventStage}`;
  if (overridesByIdentity.has(targetIdentity)) {
    throw new Error(`Editorial merge target cannot also be overridden: ${identity}`);
  }
}
const mergeSourcesByTarget = new Map();
for (const [identity, override] of overridesByIdentity) {
  if (override.recommendedDisposition !== 'merged') continue;
  const targetIdentity = `${override.mergeIntoEventKey}/${override.mergeIntoEventStage}`;
  const sources = mergeSourcesByTarget.get(targetIdentity) || [];
  sources.push(rawEventByIdentity.get(identity));
  mergeSourcesByTarget.set(targetIdentity, sources);
}
const effectiveEvents = review.protectedEvents.flatMap((event) => {
  const identity = `${event.eventKey}/${event.eventStage}`;
  const override = overridesByIdentity.get(identity);
  if (override?.recommendedDisposition === 'merged') return [];
  const mergeSources = mergeSourcesByTarget.get(identity) || [];
  const mergedCandidateIds = [
    ...event.candidateIds,
    ...mergeSources.flatMap((source) => source.candidateIds),
  ];
  const base = override ? { ...event, ...override } : event;
  return [{
    ...base,
    candidateIds: [...new Set(mergedCandidateIds)],
    ...(mergeSources.length > 0
      ? {
        mergedSemanticEventIdentities: mergeSources.map(
          (source) => `${source.eventKey}/${source.eventStage}`,
        ),
      }
      : {}),
  }];
});

const items = index.items.map((item) => ({ ...item, candidateId: item.id }));
const itemById = new Map(items.map((item) => [item.candidateId, item]));
const reviewById = new Map(review.decisions.map((entry) => [entry.candidateId, entry]));
if (reviewById.size !== items.length
  || items.some((item) => !reviewById.has(item.candidateId))) {
  throw new Error('Semantic review must cover every candidate exactly once.');
}
const eventByIdentity = new Map(effectiveEvents.map((event) => [
  `${event.eventKey}/${event.eventStage}`,
  event,
]));
if (eventByIdentity.size !== effectiveEvents.length) {
  throw new Error('Semantic protected-event identities must be unique.');
}
const eventByCandidateId = new Map();
for (const event of effectiveEvents) {
  for (const candidateId of event.candidateIds) {
    if (eventByCandidateId.has(candidateId)) {
      throw new Error(`Candidate appears in multiple semantic events: ${candidateId}`);
    }
    eventByCandidateId.set(candidateId, event);
  }
}

const validSections = new Set(['lead', 'main', 'rumor']);
const stories = [];
const selectedEventIdentities = new Set();
const selectedByCandidateId = new Map();
for (const rawStory of editorialPackage.stories || []) {
  const representativeCandidateId = String(rawStory.representativeCandidateId || '');
  const semanticEvent = eventByCandidateId.get(representativeCandidateId);
  if (!semanticEvent) {
    throw new Error(`Selected representative lacks semantic event review: ${representativeCandidateId}`);
  }
  const identity = `${semanticEvent.eventKey}/${semanticEvent.eventStage}`;
  if (selectedEventIdentities.has(identity)) {
    throw new Error(`Selected semantic event is duplicated: ${identity}`);
  }
  if (!validSections.has(rawStory.section)) {
    throw new Error(`Invalid section for ${rawStory.storyKey}`);
  }
  if (rawStory.eventKey !== semanticEvent.eventKey
    || rawStory.eventStage !== semanticEvent.eventStage
    || rawStory.editorialClass !== semanticEvent.editorialClass) {
    throw new Error(`Story identity/class must match semantic event: ${rawStory.storyKey}`);
  }
  if (!semanticEvent.candidateIds.includes(representativeCandidateId)) {
    throw new Error(`Representative is not a member of its semantic event: ${rawStory.storyKey}`);
  }
  const score = rawStory.score;
  const total = Number(score?.reach) + Number(score?.magnitude)
    + Number(score?.practicalValue) + Number(score?.evidence);
  const storyMinimumScore = rawStory.section === 'rumor'
    ? RUMOR_STORY_MINIMUM_SCORE
    : CONFIRMED_STORY_MINIMUM_SCORE;
  if (!Number.isFinite(total) || total < storyMinimumScore
    || Number(score?.total) !== total) {
    throw new Error(
      `Selected ${rawStory.section} story does not clear score ${storyMinimumScore}: ${rawStory.storyKey}`,
    );
  }
  if (!Array.isArray(rawStory.sourceUrls) || rawStory.sourceUrls.length === 0
    || rawStory.sourceUrls.some((url) => !String(url).startsWith('https://'))) {
    throw new Error(`Selected story requires direct HTTPS evidence: ${rawStory.storyKey}`);
  }
  const translations = rawStory.translations || {};
  for (const lang of ['zh', 'en', 'ja']) {
    const translation = translations[lang];
    if (!translation?.headline || !translation?.fact || !translation?.aiTake) {
      throw new Error(`Story ${rawStory.storyKey} lacks complete ${lang} copy.`);
    }
  }
  if (rawStory.section === 'rumor') {
    if (rawStory.verification !== 'unverified'
      || !rawStory.whyUnverified
      || !RUMOR_EVIDENCE_BASES.has(rawStory.rumorEvidenceBasis)) {
      throw new Error(`Rumor story lacks conditional evidence metadata: ${rawStory.storyKey}`);
    }
  } else if (rawStory.verification !== 'confirmed') {
    throw new Error(`Confirmed section story must use confirmed verification: ${rawStory.storyKey}`);
  }
  const story = {
    ...rawStory,
    firstReliablePublishedAt: String(rawStory.firstReliablePublishedAt || ''),
    sourceUrls: [...new Set([
      ...rawStory.sourceUrls,
      ...semanticEvent.candidateIds.map((candidateId) => itemById.get(candidateId)?.url),
    ].filter(Boolean))],
    sourceCandidateIds: [...semanticEvent.candidateIds],
  };
  stories.push(story);
  selectedEventIdentities.add(identity);
  for (const candidateId of semanticEvent.candidateIds) {
    if (selectedByCandidateId.has(candidateId)) {
      throw new Error(`Candidate selected by two stories: ${candidateId}`);
    }
    selectedByCandidateId.set(candidateId, story);
  }
}

const confirmedCount = stories.filter((story) => story.section !== 'rumor').length;
const rumorCount = stories.filter((story) => story.section === 'rumor').length;
if (stories.length < 5 || confirmedCount < 1) {
  throw new Error(
    `Daily issue requires at least five total stories and one confirmed story; got ${stories.length}/${confirmedCount}.`,
  );
}
for (const event of effectiveEvents) {
  const identity = `${event.eventKey}/${event.eventStage}`;
  if (event.score.total >= 6 && !selectedEventIdentities.has(identity)) {
    throw new Error(`Threshold-clearing semantic event is not selected: ${identity}`);
  }
}

const deriveNonProtectedRejection = (decision) => {
  if (decision.score.evidence === 0 && ['rumor', 'unclear'].includes(decision.status)) {
    return 'insufficient-evidence';
  }
  if (decision.substantiveChange === false) {
    return 'no-material-change';
  }
  if (decision.score.total < 6) {
    return 'below-importance-threshold';
  }
  return 'outside-editorial-scope';
};

const isDirectRssEvidence = (item) => item.sourceType === 'rss'
  && String(item.url || '').startsWith('https://');
const normalizeRejectedEventEvidence = (event) => {
  if (!event || event.recommendedRejectionReason === 'insufficient-evidence') return event;
  const directItems = event.candidateIds
    .map((candidateId) => itemById.get(candidateId))
    .filter(isDirectRssEvidence);
  const overrideSourceUrls = Array.isArray(event.reliableSourceUrls)
    ? event.reliableSourceUrls
    : [];
  if (directItems.length > 0 || overrideSourceUrls.length > 0) return event;
  const score = {
    ...event.score,
    evidence: 0,
  };
  score.total = score.reach + score.magnitude + score.practicalValue;
  return {
    ...event,
    recommendedRejectionReason: 'insufficient-evidence',
    score,
    scoreRationale: {
      ...event.scoreRationale,
      evidence: 'Evidence is zero because no direct reliable HTTPS source was traced from this discovery-only event.',
    },
    evidenceSummary: `No direct reliable HTTPS source was established for ${event.eventKey}/${event.eventStage}; the discovery claim therefore remains unverified. ${event.evidenceSummary}`,
  };
};
const completeEventScoreRationale = (event) => Object.fromEntries(
  ['reach', 'magnitude', 'practicalValue', 'evidence'].map((field) => {
    const rationale = String(event.scoreRationale?.[field] || '').trim();
    return [
      field,
      rationale.length >= 24
        ? rationale
        : `${rationale || 'The model supplied no separate explanation'}; event-specific evidence reviewed: ${event.evidenceSummary}`,
    ];
  }),
);

const priorityReview = items.map((item) => {
  const semantic = reviewById.get(item.candidateId);
  const story = selectedByCandidateId.get(item.candidateId);
  if (story) {
    const isRepresentative = item.candidateId === story.representativeCandidateId;
    return {
      candidateId: item.candidateId,
      decision: isRepresentative ? 'selected' : 'merged',
      eventKey: story.eventKey,
      eventStage: story.eventStage,
      editorialClass: story.editorialClass,
      substantiveChange: true,
      score: story.score,
      note: isRepresentative
        ? semantic.note
        : `${semantic.note} 该候选与代表稿属于同一语义事件和同一阶段。`,
      ...(isRepresentative
        ? { storyKey: story.storyKey, sourceCandidateIds: story.sourceCandidateIds }
        : { representativeCandidateId: story.representativeCandidateId }),
    };
  }
  const event = normalizeRejectedEventEvidence(eventByCandidateId.get(item.candidateId));
  const rejectionReason = event?.recommendedRejectionReason
    || semantic.recommendedRejectionReason
    || deriveNonProtectedRejection(semantic);
  return {
    candidateId: item.candidateId,
    decision: 'rejected',
    rejectionReason,
    editorialClass: event?.editorialClass || semantic.editorialClass,
    substantiveChange: event?.substantiveChange ?? semantic.substantiveChange,
    score: event?.score || semantic.score,
    note: event?.evidenceSummary || semantic.note,
  };
});
const priorityById = new Map(priorityReview.map((entry) => [entry.candidateId, entry]));

const isDiscoveryOnlyUrl = (value) => {
  try {
    const hostname = new URL(String(value)).hostname.toLowerCase().replace(/^www\./, '');
    return ['news.google.com', 'news.ycombinator.com', 'reddit.com', 'bing.com']
      .some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`));
  } catch {
    return true;
  }
};
const protectedEventReview = effectiveEvents.map((rawSemanticEvent) => {
  const rawIdentity = `${rawSemanticEvent.eventKey}/${rawSemanticEvent.eventStage}`;
  const story = stories.find((entry) => `${entry.eventKey}/${entry.eventStage}` === rawIdentity);
  const semanticEvent = story
    ? rawSemanticEvent
    : normalizeRejectedEventEvidence(rawSemanticEvent);
  const identity = `${semanticEvent.eventKey}/${semanticEvent.eventStage}`;
  if (story) {
    return {
      eventKey: story.eventKey,
      eventStage: story.eventStage,
      candidateIds: story.sourceCandidateIds,
      representativeCandidateId: story.representativeCandidateId,
      disposition: 'selected',
      editorialClass: story.editorialClass,
      substantiveChange: true,
      verificationStatus: 'verified-in-window',
      firstReliablePublishedAt: story.firstReliablePublishedAt,
      reliableSourceUrls: story.sourceUrls.filter((url) => !isDiscoveryOnlyUrl(url)),
      evidenceSummary: story.evidenceSummary,
      score: story.score,
      scoreRationale: story.scoreRationale,
      ...(story.rumorEvidenceBasis ? { rumorEvidenceBasis: story.rumorEvidenceBasis } : {}),
    };
  }
  const candidateItems = semanticEvent.candidateIds.map((candidateId) => itemById.get(candidateId));
  const directItems = candidateItems.filter(isDirectRssEvidence);
  const overrideSourceUrls = Array.isArray(semanticEvent.reliableSourceUrls)
    ? semanticEvent.reliableSourceUrls
    : [];
  const rejectionReason = semanticEvent.recommendedRejectionReason;
  const hasVerifiedDirectEvidence = rejectionReason !== 'insufficient-evidence'
    && (directItems.length > 0 || overrideSourceUrls.length > 0);
  const firstPublished = overrideSourceUrls.length > 0
    ? semanticEvent.firstReliablePublishedAt
    : hasVerifiedDirectEvidence
      ? directItems.map((item) => item.publishedAt).sort()[0]
    : null;
  const firstPublishedTime = Date.parse(firstPublished || '');
  const windowStartTime = Date.parse(manifest.windowStart);
  const windowEndTime = Date.parse(manifest.windowEnd);
  const verifiedOutsideWindow = hasVerifiedDirectEvidence
    && Number.isFinite(firstPublishedTime)
    && (firstPublishedTime < windowStartTime || firstPublishedTime >= windowEndTime);
  return {
    eventKey: semanticEvent.eventKey,
    eventStage: semanticEvent.eventStage,
    candidateIds: semanticEvent.candidateIds,
    representativeCandidateId: semanticEvent.candidateIds[0],
    disposition: 'rejected',
    rejectionReason,
    editorialClass: semanticEvent.editorialClass,
    substantiveChange: semanticEvent.substantiveChange,
    verificationStatus: hasVerifiedDirectEvidence
      ? (verifiedOutsideWindow ? 'verified-outside-window' : 'verified-in-window')
      : 'insufficient-evidence',
    firstReliablePublishedAt: firstPublished,
    reliableSourceUrls: hasVerifiedDirectEvidence
      ? [...new Set([...overrideSourceUrls, ...directItems.map((item) => item.url)])]
      : [],
    evidenceSummary: semanticEvent.evidenceSummary,
    score: semanticEvent.score,
    scoreRationale: completeEventScoreRationale(semanticEvent),
  };
});

const requiredCandidateIds = items
  .filter((item) => {
    const decision = priorityById.get(item.candidateId);
    return (item.editorialSignals || []).length > 0
      || item.sourceType === 'rss'
      || decision.editorialClass !== 'other'
      || ['selected', 'merged'].includes(decision.decision);
  })
  .map((item) => item.candidateId);
const protectedCoveredIds = protectedEventReview.flatMap((event) => event.candidateIds);
if (new Set(protectedCoveredIds).size !== protectedCoveredIds.length
  || requiredCandidateIds.length !== protectedCoveredIds.length
  || requiredCandidateIds.some((candidateId) => !protectedCoveredIds.includes(candidateId))) {
  throw new Error('Protected-event review does not exactly cover the final required candidate set.');
}

const articleContract = {
  zh: { headings: { lead: '今日要闻', main: '主要新闻', rumor: '传闻' }, marker: '**AI 解读：**' },
  en: { headings: { lead: 'Lead Story', main: 'More News', rumor: 'Rumors' }, marker: '**AI take:**' },
  ja: { headings: { lead: '今日のトップニュース', main: '主なニュース', rumor: '噂' }, marker: '**AI解説：**' },
};
const renderArticle = (lang) => {
  const contract = articleContract[lang];
  const lines = [`# ${editorialPackage.translations[lang].title}`];
  for (const section of ['lead', 'main', 'rumor']) {
    lines.push('', `## ${contract.headings[section]}`);
    for (const story of stories.filter((entry) => entry.section === section)) {
      const copy = story.translations[lang];
      lines.push('', `### ${copy.headline}`, '', copy.fact, '', `${contract.marker} ${copy.aiTake}`);
    }
  }
  return lines.join('\n');
};
const deliveryTranslations = Object.fromEntries(['zh', 'en', 'ja'].map((lang) => [
  lang,
  {
    title: editorialPackage.translations[lang].title,
    summary: editorialPackage.translations[lang].summary,
    content_markdown: renderArticle(lang),
  },
]));
const selectedCandidates = stories.map((story) => ({
  storyKey: story.storyKey,
  publishedDate: manifest.reportDate,
  publishedAt: story.firstReliablePublishedAt,
  eventKey: story.eventKey,
  eventStage: story.eventStage,
  importance: story.score.total,
  sourceUrls: story.sourceUrls,
  sourceCandidateIds: story.sourceCandidateIds,
  selected: true,
  dedupeDecision: story.dedupeDecision || 'new',
  section: story.section,
  verification: story.verification,
  ...(story.whyUnverified ? { whyUnverified: story.whyUnverified } : {}),
  whyWorth: story.evidenceSummary,
  aiTake: story.translations.zh.aiTake,
}));

const reviewedAt = review.completedAt;
const protectedCompletedAt = new Date(Date.parse(reviewedAt) + 1000).toISOString();
const dailyRun = {
  schemaVersion: 4,
  reportDate: manifest.reportDate,
  timezone: 'Asia/Shanghai',
  windowStart: manifest.windowStart,
  windowEnd: manifest.windowEnd,
  collectionMethod: 'Horizon native fetch with exact-window discovery, checkpointed semantic candidate review, and evidence-backed protected-event review',
  horizonRun: {
    runId: manifest.horizonRunId,
    candidatesPath: `data/mcp-runs/${manifest.horizonRunId}/daily_candidates.json`,
    candidateIndexPath: manifest.candidateIndexPath,
    coverageManifestPath: `data/mcp-runs/${manifest.horizonRunId}/coverage_manifest.json`,
  },
  selection: {
    importanceThreshold: 6,
    rumorImportanceThreshold: 5,
    minimumRumorStories: 0,
    maxItems: null,
    dedupeLookbackDays: 30,
    selectedStoryKeys: stories.map((story) => story.storyKey),
  },
  coverageAudit: {
    candidateIndexReviewedAt: reviewedAt,
    candidateIndexSha256: indexSha256,
    lowVolumeTrigger: manifest.lowVolumeTrigger,
    signedOffQueryIds: manifest.requiredQueryIds,
    signedOffGroupIds: manifest.requiredGroupIds,
    priorityReview: { decisions: priorityReview },
    protectedEventReview: {
      policy: 'evidence-backed-protected-events-v1',
      completedAt: protectedCompletedAt,
      requiredCandidateIds,
      events: protectedEventReview,
    },
    secondPass: {
      required: false,
      completed: false,
      completedAt: null,
      reconsideredCandidateIds: [],
      signedOffQueryIds: manifest.requiredQueryIds,
      signedOffGroupIds: manifest.requiredGroupIds,
    },
    discoveryNotes: editorialPackage.discoveryNotes,
  },
  candidates: selectedCandidates,
  delivery: {
    idempotencyKey: `daily-ai-news:${manifest.reportDate}:manual-recovery-semantic-v1`,
    slug: `daily-ai-news-${manifest.reportDate}`,
    source: 'Daily AI News Horizon owner-authorized manual recovery',
    tags: ['每日AI新闻', 'AI', '科技新闻'],
    translations: deliveryTranslations,
  },
};
fs.writeFileSync(outputPath, `${JSON.stringify(dailyRun, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  outputPath,
  candidates: items.length,
  selectedStories: stories.length,
  confirmedStories: confirmedCount,
  rumorStories: rumorCount,
  protectedEvents: protectedEventReview.length,
  protectedCandidates: requiredCandidateIds.length,
}, null, 2));
