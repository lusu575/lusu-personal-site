import fs from 'node:fs';
import path from 'node:path';

const runDir = path.resolve('自动新闻/data/mcp-runs/run-20260824T022703Z-ed396080');
const review = JSON.parse(fs.readFileSync(path.join(runDir, 'semantic_editorial_review.json'), 'utf8'));

const score = (reach, magnitude, practicalValue, evidence) => ({
  reach,
  magnitude,
  practicalValue,
  evidence,
  total: reach + magnitude + practicalValue + evidence,
});

const reject = ({
  eventKey,
  eventStage,
  reason,
  substantiveChange,
  points,
  summary,
  rationale,
  reliableSourceUrls,
  firstReliablePublishedAt,
}) => ({
  eventKey,
  eventStage,
  recommendedDisposition: 'rejected',
  recommendedRejectionReason: reason,
  substantiveChange,
  score: score(...points),
  evidenceSummary: summary,
  scoreRationale: {
    reach: rationale[0],
    magnitude: rationale[1],
    practicalValue: rationale[2],
    evidence: rationale[3],
  },
  ...(reliableSourceUrls ? { reliableSourceUrls, firstReliablePublishedAt } : {}),
});

const merge = (eventKey, eventStage, mergeIntoEventKey, mergeIntoEventStage, mergeRationale) => ({
  eventKey,
  eventStage,
  recommendedDisposition: 'merged',
  mergeIntoEventKey,
  mergeIntoEventStage,
  mergeRationale,
});

const rejectionRows = [
  {
    eventKey: 'gpt-5-6-sol-release', eventStage: 'model-release', reason: 'outside-publication-window', substantiveChange: false,
    points: [1, 1, 1, 2], summary: 'The Google News record republishes OpenAI\'s GPT-5.6 Sol preview page; the model stage was already announced and covered before this issue window.',
    rationale: ['The prior Sol preview reached Codex and API developers.', 'No new model version or release stage occurred in this window.', 'Readers received no new access or migration action from this record.', 'OpenAI\'s dated first-party preview fixes the earlier stage.'],
    reliableSourceUrls: ['https://openai.com/index/previewing-ultrafast/'], firstReliablePublishedAt: '2026-08-13T22:00:00Z',
  },
  {
    eventKey: 'openai-gpt-5-6-sol-pricing', eventStage: 'pricing-change', reason: 'outside-publication-window', substantiveChange: true,
    points: [1, 2, 1, 1], summary: 'OpenAI added the temporary GPT-5.6 Sol price reduction on August 21, before the current 07:00-to-07:00 window; later coverage repeats that same promotion.',
    rationale: ['The promotion affects GPT-5.6 Sol API and credit users.', 'A greater-than-twenty-percent temporary reduction is commercially material.', 'The terms matter to budgets but were already available before this window.', 'OpenAI\'s first-party release page dates the update to August 21.'],
    reliableSourceUrls: ['https://openai.com/index/gpt-5-6/'], firstReliablePublishedAt: '2026-08-21T00:00:00Z',
  },
  {
    eventKey: 'openai-gpt-api-pricing', eventStage: 'pricing-change', reason: 'outside-publication-window', substantiveChange: false,
    points: [1, 1, 1, 2], summary: 'This alias describes the same August 21 GPT-5.6 Sol promotion and supplies no distinct API price, product, or effective-date change in the current window.',
    rationale: ['The underlying price affects OpenAI API developers.', 'The alias does not represent a second commercial change.', 'No additional price action is required beyond the earlier promotion.', 'OpenAI\'s release page confirms the already established terms.'],
    reliableSourceUrls: ['https://openai.com/index/gpt-5-6/'], firstReliablePublishedAt: '2026-08-21T00:00:00Z',
  },
  {
    eventKey: 'openai-pricing-reduction', eventStage: 'pricing-change', reason: 'outside-publication-window', substantiveChange: false,
    points: [1, 1, 1, 2], summary: 'The headline conflates July Terra and Luna cuts with the August 21 Sol promotion; it does not establish a new eighty-percent OpenAI pricing event in this window.',
    rationale: ['OpenAI model prices have broad developer reach.', 'No new eighty-percent reduction occurred in the review window.', 'The derivative comparison creates no new billing decision.', 'OpenAI\'s July and August first-party updates establish the actual stages.'],
    reliableSourceUrls: ['https://openai.com/index/advancing-the-price-performance-frontier-with-gpt-5-6/', 'https://openai.com/index/gpt-5-6/'], firstReliablePublishedAt: '2026-07-30T00:00:00Z',
  },
  {
    eventKey: 'openai-gpt-5-6-sol', eventStage: 'pricing-change', reason: 'outside-publication-window', substantiveChange: false,
    points: [1, 1, 1, 2], summary: 'This semantic identity is another duplicate of the August 21 temporary Sol promotion and contains no separate current-window price stage.',
    rationale: ['The promotion is relevant to Sol users.', 'The duplicate identity adds no additional magnitude.', 'There is no separate action beyond the earlier promotion.', 'OpenAI\'s direct update resolves the event identity and date.'],
    reliableSourceUrls: ['https://openai.com/index/gpt-5-6/'], firstReliablePublishedAt: '2026-08-21T00:00:00Z',
  },
  {
    eventKey: 'openai-gpt-5-6-pricing', eventStage: 'material-price-quota', reason: 'outside-publication-window', substantiveChange: false,
    points: [1, 1, 1, 2], summary: 'The Korean reports repeat OpenAI\'s August 21 Sol promotion; they do not change included-plan usage, five-hour or weekly limits, or legacy credit rates.',
    rationale: ['The terms matter to Codex and API customers.', 'No current-window quota or second price change was verified.', 'Users can rely on the already published promotion terms.', 'OpenAI\'s rate card distinguishes promotional pricing from unchanged quotas.'],
    reliableSourceUrls: ['https://help.openai.com/en/articles/20001415-chatgpt-rate-card-enterprise-token-based-pricing'], firstReliablePublishedAt: '2026-08-21T00:00:00Z',
  },
  {
    eventKey: 'tesla-cybercab', eventStage: 'developer-preview', reason: 'outside-publication-window', substantiveChange: true,
    points: [1, 2, 1, 1], summary: 'Tesla\'s September 3 Cybercab-event post was timestamped 2026-08-22T03:47:15Z, well before this issue opened at 2026-08-22T23:00:00Z.',
    rationale: ['Cybercab affects autonomous-driving users and investors.', 'A dated public launch event is a material availability signal.', 'The invitation date is useful but not new to this issue.', 'Tesla\'s first-party X post supplies an exact pre-window timestamp.'],
    reliableSourceUrls: ['https://x.com/Tesla/status/2091009278610206932'], firstReliablePublishedAt: '2026-08-22T03:47:15Z',
  },
  {
    eventKey: 'ai-model-price-cuts', eventStage: 'pricing-change', reason: 'no-material-change', substantiveChange: false,
    points: [1, 1, 1, 1], summary: 'The CGTN market overview aggregates previously announced price changes by several vendors and identifies no single new price or quota stage inside the window.',
    rationale: ['The overview addresses the wider AI market.', 'It reports competition rather than a new discrete vendor action.', 'Readers receive context but no new rate to apply.', 'One secondary overview is insufficient evidence of a new event.'],
  },
  {
    eventKey: 'nvidia-poolside-acquisition', eventStage: 'acquisition-talks-model-product-release', reason: 'outside-publication-window', substantiveChange: true,
    points: [2, 2, 0, 1], summary: 'The Poolside investor-letter report first appeared on August 20 and describes a license-plus-investment arrangement, not a new August 23 acquisition or model release.',
    rationale: ['NVIDIA and Poolside have broad developer and infrastructure reach.', 'A multibillion-dollar license and investment is material.', 'No new access or completed model release occurred in this window.', 'The dated Newcomer report fixes the pre-window disclosure.'],
    reliableSourceUrls: ['https://www.newcomer.co/p/sources-poolside-strikes-6-billion'], firstReliablePublishedAt: '2026-08-20T00:00:00Z',
  },
  {
    eventKey: 'nvidia-server-price-hike', eventStage: 'pricing-change-hardware-infrastructure-change', reason: 'outside-publication-window', substantiveChange: false,
    points: [1, 1, 1, 2], summary: 'The same NVIDIA AI-server price increase led the 2026-08-23 issue; current Korean reports add no percentage, product cohort, or effective-date change.',
    rationale: ['The original event reached major AI infrastructure buyers.', 'No second hardware or price stage is present.', 'Procurement teams already received the actionable change.', 'The earlier Bloomberg-derived report establishes the identical event.'],
    reliableSourceUrls: ['https://fortune.com/2026/08/22/nvidia-customers-ai-related-price-hikes-15-percent-vera-rubin-grace-blackwell-chips/'], firstReliablePublishedAt: '2026-08-22T20:27:00Z',
  },
  {
    eventKey: 'nvidia-gpu-pricing', eventStage: 'pricing-change-finance-transaction', reason: 'outside-publication-window', substantiveChange: false,
    points: [1, 1, 1, 2], summary: 'This identity is a misclassified alias of the already published NVIDIA server-price report and contains no finance transaction.',
    rationale: ['The price report concerns large GPU-system buyers.', 'No financing event or new price stage exists here.', 'The alias gives readers no additional procurement action.', 'The prior direct report resolves the event as pricing, not finance.'],
    reliableSourceUrls: ['https://fortune.com/2026/08/22/nvidia-customers-ai-related-price-hikes-15-percent-vera-rubin-grace-blackwell-chips/'], firstReliablePublishedAt: '2026-08-22T20:27:00Z',
  },
  {
    eventKey: 'nvidia-gpu-pricing', eventStage: 'pricing-change-pricing-quota-change', reason: 'outside-publication-window', substantiveChange: false,
    points: [1, 1, 1, 2], summary: 'This duplicate semantic stage repeats the NVIDIA server-price event published in the previous issue and introduces no quota or revised rate.',
    rationale: ['The original pricing event affects infrastructure buyers.', 'No distinct quota or revised rate was found.', 'Readers already have the relevant procurement signal.', 'The earlier report confirms the same event and stage.'],
    reliableSourceUrls: ['https://fortune.com/2026/08/22/nvidia-customers-ai-related-price-hikes-15-percent-vera-rubin-grace-blackwell-chips/'], firstReliablePublishedAt: '2026-08-22T20:27:00Z',
  },
  {
    eventKey: 'nvidia-server-pricing', eventStage: 'pricing-change', reason: 'outside-publication-window', substantiveChange: false,
    points: [1, 1, 1, 2], summary: 'The alternate event name covers the same greater-than-fifteen-percent NVIDIA server increase already published on August 23.',
    rationale: ['The underlying report has global infrastructure reach.', 'No new price decision exists under this alias.', 'Repeating it does not change purchasing plans.', 'The Bloomberg-derived source fixes the prior identical stage.'],
    reliableSourceUrls: ['https://fortune.com/2026/08/22/nvidia-customers-ai-related-price-hikes-15-percent-vera-rubin-grace-blackwell-chips/'], firstReliablePublishedAt: '2026-08-22T20:27:00Z',
  },
  {
    eventKey: 'chatgpt-for-teens', eventStage: 'capability-availability', reason: 'outside-publication-window', substantiveChange: false,
    points: [1, 1, 1, 2], summary: 'ChatGPT for Teens launched on August 18 and was covered in the 2026-08-19 issue; current explainers add no rollout, control, or policy change.',
    rationale: ['The product reaches teen users and families.', 'The launch was material only at its earlier stage.', 'No new control or access action appears today.', 'TechCrunch directly dates the original launch.'],
    reliableSourceUrls: ['https://techcrunch.com/2026/08/18/openai-launches-a-safer-chatgpt-for-teens-years-after-teens-started-using-it/'], firstReliablePublishedAt: '2026-08-18T00:00:00Z',
  },
  {
    eventKey: 'anthropic-ipo', eventStage: 'ipo-talks-finance-transaction', reason: 'no-material-change', substantiveChange: false,
    points: [1, 1, 1, 1], summary: 'The current articles recap previously reported Anthropic IPO valuation speculation and identify no filing, mandate, timetable, or transaction change in the window.',
    rationale: ['A future Anthropic IPO could reach global markets.', 'Unchanged valuation speculation is not a new transaction stage.', 'Readers have no new filing or timetable to act on.', 'The discovery set lacks a new direct corporate or regulatory document.'],
  },
  {
    eventKey: 'amd-tsmc-taiwan-investment', eventStage: 'strategic-hardware-infrastructure', reason: 'outside-publication-window', substantiveChange: true,
    points: [1, 2, 1, 1], summary: 'AMD announced its more-than-$10-billion Taiwan ecosystem investment on May 21; the August 23 article is later analysis of the same plan.',
    rationale: ['AMD infrastructure plans affect the semiconductor ecosystem.', 'The investment is large and strategically material.', 'The current recap supplies no new commitment or capacity date.', 'AMD\'s newsroom gives the original May 21 publication date.'],
    reliableSourceUrls: ['https://ir.amd.com/news-events/press-releases/detail/1286/amd-announces-more-than-10-billion-in-taiwan-ecosystem-investments-to-accelerate-ai-infrastructure'], firstReliablePublishedAt: '2026-05-21T00:00:00Z',
  },
  {
    eventKey: 'nvidia-open-weight-model', eventStage: 'model-release', reason: 'no-material-change', substantiveChange: false,
    points: [1, 1, 1, 1], summary: 'The reports describe NVIDIA\'s intent to use the earlier Poolside arrangement for future Nemotron work; no weights, API, license, or new model became available in this window.',
    rationale: ['Future Nemotron work could reach open-model developers.', 'A stated development intention is not a model release.', 'There is no model artifact for readers to use today.', 'No first-party release page or weights repository was found.'],
  },
  {
    eventKey: 'openai-pricing-update', eventStage: 'pricing-change', reason: 'outside-publication-window', substantiveChange: false,
    points: [1, 1, 1, 2], summary: 'This is another translated recap of the August 21 Sol promotion and supplies no separate current-window price change.',
    rationale: ['The promotion affects Sol customers.', 'The recap does not create a second commercial stage.', 'No additional budgeting action follows from it.', 'OpenAI\'s direct page confirms the prior terms.'],
    reliableSourceUrls: ['https://openai.com/index/gpt-5-6/'], firstReliablePublishedAt: '2026-08-21T00:00:00Z',
  },
  {
    eventKey: 'openai-security-measures', eventStage: 'ai-policy-safety-change', reason: 'outside-publication-window', substantiveChange: false,
    points: [1, 1, 1, 2], summary: 'The AOL report retells OpenAI\'s earlier Hugging Face incident and security response; it establishes no new pause, safeguard, or policy stage in the window.',
    rationale: ['Frontier-lab security decisions affect developers and platforms.', 'No newly enacted security measure is documented here.', 'The recap provides no new mitigation step for readers.', 'OpenAI\'s earlier direct disclosure records the underlying stage.'],
    reliableSourceUrls: ['https://openai.com/index/pacing-model-development-cyber-capabilities/'], firstReliablePublishedAt: '2026-08-18T00:00:00Z',
  },
  {
    eventKey: 'slack-code', eventStage: 'capability-availability', reason: 'outside-publication-window', substantiveChange: true,
    points: [1, 2, 1, 1], summary: 'Slack announced and launched Slack Code on August 20, before the current window; the August 23 Japanese reports are delayed coverage.',
    rationale: ['Slack Code reaches software teams using supported agents.', 'Shared code channels are a meaningful workflow release.', 'The feature is useful but was already live before this issue.', 'Slack\'s first-party post dates the launch to August 20.'],
    reliableSourceUrls: ['https://slack.com/blog/news/slack-code-channels-for-agents'], firstReliablePublishedAt: '2026-08-20T00:00:00Z',
  },
  {
    eventKey: 'spacex-grok-bot', eventStage: 'model-release', reason: 'no-material-change', substantiveChange: false,
    points: [1, 1, 1, 1], summary: 'Grok Bot\'s always-on agent launch was already covered on August 13 and August 18; the Mashable item is a later recap without a new rollout.',
    rationale: ['The bot is relevant to Grok users.', 'No new version or function is reported.', 'The recap changes neither access nor operation.', 'No new first-party release signal accompanies the article.'],
  },
  {
    eventKey: 'ai-factory-energy-control', eventStage: 'research-publication', reason: 'outside-publication-window', substantiveChange: true,
    points: [1, 2, 1, 1], summary: 'The 36Kr Japan item translates DeepCtrls\' Series B financing first reported on July 9; the Japanese publication date does not create a new funding stage.',
    rationale: ['DeepCtrls serves energy-intensive industrial and AI infrastructure.', 'A nine-figure-RMB round is material to the company.', 'No new financing or product availability occurred today.', 'The original 36Kr report fixes the event at July 9.'],
    reliableSourceUrls: ['https://www.36kr.com/p/3887726503688968'], firstReliablePublishedAt: '2026-07-09T09:20:00+08:00',
  },
  {
    eventKey: 'humanoid-robotics-capabilities', eventStage: 'capability-availability', reason: 'insufficient-evidence', substantiveChange: false,
    points: [1, 1, 1, 0], summary: 'The cluster combines sports results from several robots and outlets under one generic identity; it does not establish a single new product or availability stage.',
    rationale: ['The robot games interest a specialized robotics audience.', 'Aggregated competition results are not one product release.', 'Readers cannot map the cluster to one usable capability.', 'No single direct event identity and source set was established.'],
  },
  {
    eventKey: 'ltx-2-5-release', eventStage: 'model-release', reason: 'no-material-change', substantiveChange: false,
    points: [1, 1, 1, 1], summary: 'The in-window LTX post showcases three uses of LTX-2.5 but does not release a new model, weights, API, license, or availability stage.',
    rationale: ['The showcase reaches AI-video creators.', 'Examples do not constitute another model release.', 'They inspire workflows but change no access terms.', 'The official post supports use cases, not a new release stage.'],
    reliableSourceUrls: ['https://x.com/ltx_io/status/2091549965843898865'], firstReliablePublishedAt: '2026-08-23T23:35:45+08:00',
  },
  {
    eventKey: 'wanxing-tech-filmora-ai-canvas', eventStage: 'capability-availability', reason: 'outside-publication-window', substantiveChange: false,
    points: [1, 1, 1, 2], summary: 'Wondershare\'s own site dates the global Filmora.TV launch to August 17; the in-window LeiFeng item repeats that launch without a new availability stage.',
    rationale: ['Filmora.TV targets professional video and advertising teams.', 'The original product launch was meaningful but is not new today.', 'The recap supplies no new tier, region, or feature access.', 'Wondershare\'s first-party company page records the August 17 launch.'],
    reliableSourceUrls: ['https://www.wondershare.cn/'], firstReliablePublishedAt: '2026-08-17T00:00:00+08:00',
  },
  {
    eventKey: 'deepseek-api-pricing', eventStage: 'pricing-change-pricing-quota-change', reason: 'outside-publication-window', substantiveChange: false,
    points: [1, 1, 1, 2], summary: 'The weekend off-peak billing change was already published in the 2026-08-23 issue; current articles introduce no later rate, model, or schedule.',
    rationale: ['The schedule affects DeepSeek API developers.', 'No second pricing stage exists today.', 'Yesterday\'s guidance remains the actionable information.', 'DeepSeek\'s pricing documentation confirms unchanged terms.'],
    reliableSourceUrls: ['https://api-docs.deepseek.com/quick_start/pricing-details-usd'], firstReliablePublishedAt: '2026-08-22T12:52:44+08:00',
  },
  {
    eventKey: 'data-center-grid-performance', eventStage: 'strategic-hardware-infrastructure', reason: 'insufficient-evidence', substantiveChange: false,
    points: [1, 1, 1, 0], summary: 'The MarketScale headline is climate-and-grid commentary and does not identify a new data-center project, grid decision, capacity award, or research publication.',
    rationale: ['Grid constraints have broad infrastructure relevance.', 'A commentary thesis is not a discrete infrastructure change.', 'No specific project decision follows for readers.', 'No direct project document or dated research record was traced.'],
  },
  {
    eventKey: 'anthropic-hardware-strategy', eventStage: 'strategic-hardware-infrastructure', reason: 'outside-publication-window', substantiveChange: true,
    points: [1, 2, 1, 1], summary: 'Bloomberg first reported Anthropic\'s hire of former Google TPU leader Amir Salek on August 21, before the issue window; later Korean coverage repeats it.',
    rationale: ['Anthropic\'s compute strategy affects the AI hardware market.', 'A founding TPU leader joining an in-house chip effort is material.', 'No additional hardware milestone occurred in this window.', 'The timestamped Bloomberg syndication fixes the earlier disclosure.'],
    reliableSourceUrls: ['https://finance.yahoo.com/technology/ai/articles/anthropic-taps-google-chip-veteran-195955567.html'], firstReliablePublishedAt: '2026-08-21T19:59:55-04:00',
  },
  {
    eventKey: 'anthropic-hardware-push', eventStage: 'strategic-hardware-infrastructure', reason: 'outside-publication-window', substantiveChange: false,
    points: [1, 1, 1, 2], summary: 'This alternate identity covers the same pre-window Amir Salek hire and contains no separate chip program milestone.',
    rationale: ['The underlying hire has sector reach.', 'The alias adds no second strategic change.', 'There is no new product or procurement action.', 'The Bloomberg syndication confirms the identical earlier event.'],
    reliableSourceUrls: ['https://finance.yahoo.com/technology/ai/articles/anthropic-taps-google-chip-veteran-195955567.html'], firstReliablePublishedAt: '2026-08-21T19:59:55-04:00',
  },
  {
    eventKey: 'anthropic-claude-security', eventStage: 'research-publication', reason: 'no-material-change', substantiveChange: false,
    points: [1, 1, 1, 1], summary: 'The current security-test articles recap previously disclosed agent experiments and do not identify a new paper, incident, or mitigation stage.',
    rationale: ['The experiments interest AI-safety and security teams.', 'A recap is not a new research publication.', 'No new mitigation or release guidance is supplied.', 'A current direct primary research record was not established.'],
  },
  {
    eventKey: 'anthropic-claude-pricing', eventStage: 'pricing-change', reason: 'insufficient-evidence', substantiveChange: true,
    points: [1, 1, 2, 0], summary: 'A single low-transparency Machine Brief headline predicts an August 31 Claude price hike, but no Anthropic rate card or reliable independent report confirms it.',
    rationale: ['A Claude price change would affect developers.', 'The claimed future increase lacks verified scope.', 'Confirmed pricing would be immediately actionable.', 'No official price page or reliable corroboration was found.'],
  },
  {
    eventKey: 'anthropic-ai-security', eventStage: 'ai-policy-safety', reason: 'no-material-change', substantiveChange: false,
    points: [1, 1, 1, 1], summary: 'This alias retells previously reported Claude security experiments and adds no new policy, safety classification, or mitigation decision.',
    rationale: ['Claude safety findings matter to agent builders.', 'No new policy stage is present.', 'The recap supplies no new operational instruction.', 'No direct current-stage Anthropic record was established.'],
  },
  {
    eventKey: 'ai-subscription-bundles', eventStage: 'pricing-change', reason: 'outside-editorial-scope', substantiveChange: true,
    points: [0, 1, 1, 1], summary: 'The candidates are affiliate promotions for a third-party lifetime bundle, not official ChatGPT, Gemini, or Claude subscription-price changes.',
    rationale: ['The promotion reaches buyers of one reseller product.', 'It does not alter vendor model pricing.', 'The deal may interest bargain shoppers but not platform operations.', 'Commercial deal pages support only the reseller offer.'],
  },
  {
    eventKey: 'nvidia-openai-pricing', eventStage: 'pricing-change', reason: 'no-material-change', substantiveChange: false,
    points: [1, 1, 1, 1], summary: 'The commentary combines NVIDIA system prices with an earlier OpenAI financing guarantee and establishes no single new pricing event.',
    rationale: ['Both companies have broad market reach.', 'Conflated commentary is not a discrete price change.', 'No new rate or contract term is actionable.', 'No direct current-stage agreement or price sheet was traced.'],
  },
  {
    eventKey: 'z-ai-glm-5-3-release', eventStage: 'model-release', reason: 'no-material-change', substantiveChange: false,
    points: [1, 1, 1, 1], summary: 'GLM-5.3 was released and covered before this issue, including August 15 and August 18; the Yicai item is delayed recirculation of the same model stage.',
    rationale: ['GLM-5.3 matters to open-model developers.', 'No new version, weights, or license appears today.', 'The recap does not change deployment options.', 'The current item corroborates only the already published release.'],
  },
];

const eventOverrides = [
  ...rejectionRows.map(reject),
  merge('hugging-face-sale', 'acquisition-talks', 'hugging-face-acquisition', 'acquisition-talks', 'Both identities describe the same reported Hugging Face sale exploration and valuation, so the secondary alias is merged into the Bloomberg-led event.'),
  merge('huggingface-acquisition', 'acquisition-talks', 'hugging-face-acquisition', 'acquisition-talks', 'The unhyphenated identity is a duplicate cluster for the same Hugging Face sale exploration, not an independent transaction.'),
  merge('alibaba-ai-investment', 'major-tech-finance-change', 'alibaba-ai-investment', 'major-tech-finance', 'The alternate stage reports the same HK$80 billion placement and identical AI-use-of-proceeds event as the selected Alibaba finance story.'),
];

const stories = [
  {
    storyKey: 'alibaba-hk80b-ai-share-placement',
    representativeCandidateId: 'google_news:article:257d39e2d3e7ed33',
    eventKey: 'alibaba-ai-investment', eventStage: 'major-tech-finance', editorialClass: 'major-tech-finance',
    section: 'lead', verification: 'confirmed', firstReliablePublishedAt: '2026-08-23T07:18:00+08:00',
    sourceUrls: ['https://www.alibabagroup.com/zh-HK/document-2028246284372017152', 'https://www.asiaone.com/china/alibaba-plans-13-billion-hong-kong-share-placement-fund-ai-spending'],
    score: score(2, 3, 2, 2),
    evidenceSummary: 'Alibaba announced a proposed HK$80 billion placement and said all net proceeds would go to full-stack AI capabilities, including AI infrastructure; Reuters coverage was published inside the window.',
    scoreRationale: { reach: 'Alibaba is a global cloud, commerce, and AI provider.', magnitude: 'HK$80 billion is a major equity financing tied directly to AI expansion.', practicalValue: 'The placement signals added AI infrastructure capacity and shareholder dilution.', evidence: 'Alibaba\'s announcement and a timestamped Reuters syndication confirm scope and timing.' },
    translations: {
      zh: { headline: '阿里巴巴拟配售800亿港元新股，净收益将全部投入AI', fact: '阿里巴巴宣布，拟在市场等条件允许的情况下，向美国以外的非美国人士配售新发行普通股，配售总代价为800亿港元。公司表示，计划将净收益100%投入全栈AI能力，包括扩展和强化AI基础设施。', aiTake: '这笔融资把新股融资与AI基础设施扩张直接绑定。接下来要看配售能否完成，以及新资本如何转化为可用算力。' },
      en: { headline: 'Alibaba proposes an HK$80 billion share placement to fund its full-stack AI push', fact: 'Alibaba proposes to place newly issued ordinary shares with non-U.S. persons outside the United States for HK$80 billion, subject to market and other conditions. It intends to direct 100% of net proceeds to full-stack AI capabilities, including AI infrastructure.', aiTake: 'The deal ties fresh equity directly to AI-infrastructure expansion. The next tests are whether it closes and how quickly capital becomes usable compute.' },
      ja: { headline: 'Alibaba、800億香港ドルの新株配置を計画しAIに全額投資へ', fact: 'Alibabaは、市場その他の条件を前提に、米国外の非米国人投資家へ新発行普通株を配置し、総額800億香港ドルを調達する計画を発表した。純調達額の100％をAI基盤を含むフルスタックAI能力へ投じる。', aiTake: '新株調達をAI基盤拡張に直結させた大型計画だ。配置完了と、資金が利用可能な計算能力へ転換される速度が焦点となる。' },
    },
  },
  {
    storyKey: 'd-matrix-raptor-3d-dram-hot-chips',
    representativeCandidateId: 'google_news:article:0f4e02ba94a8972f',
    eventKey: 'd-matrix-raptor-3d-dram', eventStage: 'research-publication', editorialClass: 'strategic-hardware-infrastructure',
    section: 'main', verification: 'confirmed', firstReliablePublishedAt: '2026-08-24T06:14:59+08:00',
    sourceUrls: ['https://www.servethehome.com/d-matrix-raptor-3d-dram-accelerator-for-generative-inference-at-hot-chips-2026/'],
    score: score(1, 2, 2, 1),
    evidenceSummary: 'ServeTheHome reported from Hot Chips 2026 on d-Matrix Raptor, which bonds a TSMC N4 logic die to 3D DRAM and targets extremely high memory bandwidth for generative inference.',
    scoreRationale: { reach: 'The architecture mainly reaches AI-infrastructure engineers.', magnitude: '3D-stacked DRAM beneath compute is a meaningful accelerator design change.', practicalValue: 'The design directly targets inference bandwidth and power bottlenecks.', evidence: 'A detailed direct conference report supports the architecture while vendor performance claims await broader testing.' },
    translations: {
      zh: { headline: 'd-Matrix 在 Hot Chips 展示 Raptor 3D-DRAM 推理加速架构', fact: 'ServeTheHome 在 Hot Chips 2026 现场报道，d-Matrix 的 Raptor 将台积电 N4 逻辑裸片与3D DRAM堆叠，省去传统PHY路径，面向生成式AI推理的高带宽与低功耗需求。', aiTake: '如果量产数据接近现场宣称，3D DRAM可能成为HBM之外的新路径；真正关键仍是实机功耗、良率和软件可用性。' },
      en: { headline: 'd-Matrix shows its Raptor 3D-DRAM inference architecture at Hot Chips', fact: 'ServeTheHome reported from Hot Chips 2026 that d-Matrix Raptor stacks 3D DRAM on a TSMC N4 logic die, removing a conventional PHY path to target high-bandwidth, lower-power generative inference.', aiTake: 'If production results approach the conference claims, 3D DRAM could complement HBM; measured power, yield, and software maturity remain decisive.' },
      ja: { headline: 'd-Matrix、Hot ChipsでRaptor 3D-DRAM推論アーキテクチャを披露', fact: 'ServeTheHomeのHot Chips 2026現地報道によると、RaptorはTSMC N4ロジックダイに3D DRAMを積層し、従来のPHY経路を省いて生成AI推論の高帯域・低消費電力を狙う。', aiTake: '量産値が発表に近ければHBMを補う選択肢になり得るが、実測電力、歩留まり、ソフトウェア成熟度が決め手だ。' },
    },
  },
  {
    storyKey: 'hugging-face-reported-sale-exploration',
    representativeCandidateId: 'google_news:article:4cba6e58d0d61870',
    eventKey: 'hugging-face-acquisition', eventStage: 'acquisition-talks', editorialClass: 'major-tech-finance',
    section: 'rumor', verification: 'unverified', whyUnverified: 'Bloomberg reported Business Insider\'s account of early sale exploration, but Hugging Face had not announced a process, buyer, or completed transaction in the window.', rumorEvidenceBasis: 'one-attributed-reliable-report',
    firstReliablePublishedAt: '2026-08-24T04:12:45+08:00',
    sourceUrls: ['https://www.bloomberg.com/news/articles/2026-08-23/hugging-face-gauging-interest-for-potential-sale-business-insider-says'],
    score: score(2, 3, 2, 1),
    evidenceSummary: 'Bloomberg reported that Hugging Face was exploring a potential sale at a valuation of at least $13 billion and working with a bank to gauge interest, with no deal reached.',
    scoreRationale: { reach: 'Hugging Face is central infrastructure for the open-model ecosystem.', magnitude: 'A $13-billion-plus sale could materially change platform ownership.', practicalValue: 'Developers would need to watch neutrality, hosting, and access terms.', evidence: 'One attributable reliable report supports early talks, while company confirmation remains absent.' },
    translations: {
      zh: { headline: '据报道 Hugging Face 探索出售，估值或达130亿美元以上', fact: '据彭博援引 Business Insider 的报道，Hugging Face 正与一家银行合作试探潜在买家兴趣，可能估值130亿美元以上；目前没有达成交易，公司也未在窗口内确认出售。', aiTake: '如果所有权发生变化，开发者最该关注模型托管中立性、访问条款和数据边界是否改变。' },
      en: { headline: 'Hugging Face reportedly explores a sale at a $13 billion-plus valuation', fact: 'Bloomberg, citing Business Insider, reportedly said that Hugging Face is working with a bank to gauge buyer interest at a potential valuation of $13 billion or more. No deal was reached or confirmed by the company in the window.', aiTake: 'If ownership changes, developers should first watch platform neutrality, access terms, and data boundaries.' },
      ja: { headline: 'Hugging Face、130億ドル超での売却を検討か', fact: '報道によると、BloombergはBusiness Insiderを引用し、Hugging Faceが銀行と潜在買い手の関心を探り、130億ドル以上の評価額を想定している。期間内に取引成立や会社確認はない。', aiTake: '所有者が変わる場合、開発者はモデル保管の中立性、利用条件、データ境界の変化をまず確認すべきだ。' },
    },
  },
  {
    storyKey: 'tibo-codex-rate-limit-investigation',
    representativeCandidateId: 'twitter:public-profile:2091407991736332689',
    eventKey: 'codex-rate-limits', eventStage: 'usage-policy-change', editorialClass: 'usage-policy',
    section: 'rumor', verification: 'unverified', whyUnverified: 'Tibo identified concrete causes and said fixes were in progress, but the in-window post did not say the reset or full remediation had completed.', rumorEvidenceBasis: 'attributed-first-party-teaser',
    firstReliablePublishedAt: '2026-08-23T14:11:36+08:00', sourceUrls: ['https://x.com/thsottiaux/status/2091407991736332689'],
    score: score(1, 1, 2, 1),
    evidenceSummary: 'Tibo reported Codex rate-limit inefficiencies tied to images in long compacted sessions, high-p95 Computer History usage, and a conversation-title feature consuming more usage than intended.',
    scoreRationale: { reach: 'The issue affects active Codex users.', magnitude: 'The post identifies several quota-drain causes but not a finished reset.', practicalValue: 'Users can avoid image-heavy long sessions while fixes propagate.', evidence: 'The responsible product lead disclosed the investigation directly, but completion was outside the window.' },
    translations: {
      zh: { headline: 'Tibo 披露 Codex 额度异常的三类原因，修复仍在推进', fact: 'Codex 负责人 Tibo 表示，团队发现长会话多次压缩时的图片处理低效、Computer History 的高分位用量，以及会话标题功能额外消耗额度等问题；窗口内尚未宣布重置完成，在修复完成前额度消耗可能仍受影响。', aiTake: '在修复完全落地前，图片很多的超长会话仍值得拆分。今天08:46发布的“重置已传播”实锤晚于本期截止线，将进入下一期。' },
      en: { headline: 'Tibo identifies three causes of Codex quota drain as fixes continue', fact: 'Codex lead Tibo said the team found image inefficiencies in long, repeatedly compacted sessions, high-p95 Computer History usage, and extra quota drain from conversation-title generation. The in-window post did not confirm a completed reset, so quota consumption may remain affected until remediation completes.', aiTake: 'Until remediation fully lands, splitting image-heavy long sessions remains prudent. The later reset-confirmation post falls after this issue\'s cutoff and belongs in the next issue.' },
      ja: { headline: 'Tibo、Codexの上限消費を招く3要因を説明　修正は継続中', fact: 'Codex責任者Tiboは、複数回圧縮された長いセッションでの画像処理、Computer Historyの高パーセンタイル利用量、会話タイトル生成による追加消費を確認したと説明した。期間内にリセット完了の発表はなく、修正完了までは上限消費に影響が残る可能性がある。', aiTake: '修正完了までは画像の多い長時間セッションを分割するのが無難だ。08時46分のリセット反映確認は締切後のため次号で扱う。' },
    },
  },
  {
    storyKey: 'naviai-one-brain-multi-robot-showcase',
    representativeCandidateId: 'rss:www.leiphone.com_feed:86e5ee527d729091',
    eventKey: 'zhejiang-humanoid-naviai', eventStage: 'capability-availability', editorialClass: 'capability-availability',
    section: 'rumor', verification: 'unverified', whyUnverified: 'LeiFeng attributed the performance figures and deployment claims to the company\'s WRC showcase, but no independent field validation was available.', rumorEvidenceBasis: 'one-attributed-reliable-report',
    firstReliablePublishedAt: '2026-08-23T17:37:00+08:00', sourceUrls: ['https://www.leiphone.com/category/industrynews/5PmgwJZ7NFR6jvie.html'],
    score: score(1, 1, 2, 1),
    evidenceSummary: 'LeiFeng reported Zhejiang Humanoid\'s NAVIAI one-brain-multi-robot system coordinating three wheel-arm robots across industrial, retail, and kitchen demonstrations at WRC 2026.',
    scoreRationale: { reach: 'The system targets industrial and service-robot deployments.', magnitude: 'One controller coordinating multiple robots is a meaningful showcase.', practicalValue: 'The reported workflows map to real manufacturing and retail tasks.', evidence: 'One attributable trade-press report supports the demo, while performance claims lack independent validation.' },
    translations: {
      zh: { headline: '浙江人形展示 NAVIAI“一脑多机”，覆盖工业、零售与厨房场景', fact: '据雷峰网报道，浙江人形在2026世界机器人大会展示NAVIAI方案，由同一智能中枢协调3台轮臂机器人完成工业流程，并演示零售和厨房任务；0.03毫米精度、40秒出单和98%识别率均为厂商展示数据。', aiTake: '多机协同比单次炫技更接近实际部署，但这些指标仍需长期现场运行和第三方测试验证。' },
      en: { headline: 'Zhejiang Humanoid shows NAVIAI coordinating multiple robots across three settings', fact: 'LeiFeng reportedly said that NAVIAI coordinated three wheel-arm robots through an industrial workflow and demonstrated retail and kitchen tasks at WRC 2026. The 0.03 mm, 40-second, and 98% figures are vendor showcase claims.', aiTake: 'Multi-robot coordination is closer to deployment than a single demo, but the figures still need long-run field and third-party validation.' },
      ja: { headline: '浙江人形、NAVIAIで複数ロボットを産業・小売・厨房に展開', fact: '雷峰網の報道によると、NAVIAIはWRC 2026で3台の車輪・アーム型ロボットを一つの知能中枢から協調させ、産業工程、小売、厨房作業を実演した。0.03ミリ、40秒、98％という数値は企業側の展示値だ。', aiTake: '複数台協調は実運用に近いが、数値は長期現場運用と第三者試験での確認が必要だ。' },
    },
  },
  {
    storyKey: 'zhishen-working-robot-platform-showcase',
    representativeCandidateId: 'rss:www.leiphone.com_feed:16b40e9503f890fa',
    eventKey: 'zhishen-tech-robotics', eventStage: 'capability-availability', editorialClass: 'capability-availability',
    section: 'rumor', verification: 'unverified', whyUnverified: 'LeiFeng reported company demonstrations and shipment claims, but the claimed scale and task reliability were not independently audited.', rumorEvidenceBasis: 'one-attributed-reliable-report',
    firstReliablePublishedAt: '2026-08-23T10:00:00+08:00', sourceUrls: ['https://www.leiphone.com/category/robot/O75vTRkVrLMfVEON.html'],
    score: score(1, 1, 2, 1),
    evidenceSummary: 'LeiFeng reported Zhishen Technology\'s WRC debut of NE01, L2, the open-source MATRIX 2.0 platform, and its ZSD embodied drive model, alongside company deployment claims.',
    scoreRationale: { reach: 'The platform serves embodied-AI developers and industrial users.', magnitude: 'A combined robot, open platform, and drive-model debut is substantive.', practicalValue: 'Open tooling and task-oriented robots can shorten deployment work.', evidence: 'One attributable trade-press report supports the showcase, while shipment and reliability claims remain unaudited.' },
    translations: {
      zh: { headline: '智身科技首秀 NE01、L2 与开源 MATRIX 2.0 具身平台', fact: '据雷峰网报道，智身科技在2026世界机器人大会展示NE01、L2、开源MATRIX 2.0平台及ZSD具身驱动模型，并称产品已累计交付约1.5万台；交付规模与任务可靠性尚无独立审计。', aiTake: '开源平台与硬件、驱动模型一起发布有利于生态落地，但“真正干活”最终仍要由持续运行数据证明。' },
      en: { headline: 'Zhishen debuts NE01, L2, and the open-source MATRIX 2.0 embodied-AI platform', fact: 'LeiFeng reportedly said Zhishen showcased NE01, L2, the open-source MATRIX 2.0 platform, and its ZSD embodied drive model at WRC 2026. The company\'s roughly 15,000-unit delivery claim has not been independently audited.', aiTake: 'Releasing hardware, an open platform, and a drive model together can help adoption, but sustained operating data must prove the “working robot” claim.' },
      ja: { headline: '智身科技、NE01・L2とオープンソースMATRIX 2.0を初披露', fact: '雷峰網の報道によると、智身科技はWRC 2026でNE01、L2、オープンソースMATRIX 2.0、ZSD具身駆動モデルを展示した。累計約1万5000台という出荷主張は独立監査されていない。', aiTake: 'ハード、オープンプラットフォーム、駆動モデルの同時展開は普及に有利だが、「働くロボット」は継続運用データで証明する必要がある。' },
    },
  },
];

const expectedThresholdIdentities = new Set(review.protectedEvents
  .filter((event) => event.score.total >= 6)
  .map((event) => `${event.eventKey}/${event.eventStage}`));
const handledThresholdIdentities = new Set([
  ...eventOverrides.map((event) => `${event.eventKey}/${event.eventStage}`),
  ...stories.map((story) => `${story.eventKey}/${story.eventStage}`),
]);
const missing = [...expectedThresholdIdentities].filter((identity) => !handledThresholdIdentities.has(identity));
if (missing.length > 0) throw new Error(`Missing threshold dispositions: ${missing.join(', ')}`);

const payload = {
  reportDate: '2026-08-24',
  translations: {
    zh: { title: '每日 AI 新闻｜阿里巴巴拟配售800亿港元新股，净收益将全部投入AI', summary: '阿里巴巴筹划AI融资，d-Matrix展示3D-DRAM推理架构；传闻区追踪Hugging Face出售、Codex额度修复与两套具身智能方案。' },
    en: { title: 'Daily AI News | Alibaba proposes an HK$80 billion share placement to fund its full-stack AI push', summary: 'Alibaba plans major AI financing, d-Matrix shows a 3D-DRAM inference architecture, and the rumor section tracks Hugging Face, Codex quota fixes, and two embodied-AI systems.' },
    ja: { title: '毎日AIニュース｜Alibaba、800億香港ドルの新株配置を計画しAIに全額投資へ', summary: 'AlibabaのAI資金計画、d-Matrixの3D-DRAM推論設計に加え、Hugging Face売却観測、Codex上限修正、具身AI 2件を追います。' },
  },
  discoveryNotes: [
    'The immutable 2026-08-23 07:00 to 2026-08-24 07:00 Asia/Shanghai window contains 1,309 candidates and 660 protected semantic events.',
    'The public-X parser was repaired for current schema.org profile markup and recovered two in-window Tibo posts; the rate-limit update now receives the required usage-policy signal.',
    'Effective for report date 2026-08-24, evidence-qualified rumors may clear at score 5, including one attributable reliable report; confirmed stories still require 6, the issue still requires five independent stories, and the lead remains confirmed.',
    'Tibo\'s 2026-08-24 08:46 Asia/Shanghai reset-confirmation post is outside this issue window and is explicitly reserved for the next issue; the in-window 14:11 investigation update is published conditionally.',
    'Delayed reports about Filmora.TV, DeepCtrls, CodeSolar, Slack Code, GPT-5.6 pricing, and other old stages were rejected instead of being used as filler.',
  ],
  manualReviewCorrections: [
    'Promoted codex-rate-limits/usage-policy-change from semantic score 5 into the rumor section under the new score-5 evidence gate.',
    'Promoted the two independent WRC robotics events to score 5 with conditional language and one-attributed-reliable-report evidence; all vendor metrics remain clearly attributed and unverified.',
    'Merged Hugging Face and Alibaba duplicate semantic identities into one representative story per event stage.',
  ],
  eventOverrides,
  stories,
};

const output = path.join(runDir, 'editorial-package-2026-08-24-recovery.json');
fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output, stories: stories.length, overrides: eventOverrides.length }));
