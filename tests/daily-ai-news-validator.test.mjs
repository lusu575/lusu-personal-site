import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  isHistoricalOneShotWindow,
  readAndValidateRun,
  validateRun
} from "../自动新闻/integrations/lusu-site/validate-draft.mjs";
import {
  assertProductionSchedule,
  parseProductionArgs,
  publicArticleUrls,
  validateDeliveryResponse,
  validatePublicArticlePayload,
  verifyPublicArticleTranslations,
  validateProductionEndpoint
} from "../自动新闻/integrations/lusu-site/deliver-production.mjs";
import {
  buildProductionChannelSql,
  redactedTokenSummary
} from "../自动新闻/integrations/lusu-site/configure-production-channel.mjs";
import {
  parseDevVars,
  removeDevVar,
  upsertDevVar
} from "../自动新闻/integrations/lusu-site/production-secrets.mjs";

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
    section,
    verification,
    aiTake,
    whyWorth: `${storyKey} 对当天 AI 产业或技术进展具有明确读者价值。`,
    ...(whyUnverified ? { whyUnverified } : {})
  };
}

function translationsWithThreeSections() {
  return {
    zh: {
      title: "每日 AI 新闻｜2026 年 7 月 27 日",
      summary: "今天包含一条要闻、一条主要新闻，另有一条传闻仍待核实；传闻不会作为事实写入结论。",
      content_markdown: [
        "# 每日 AI 新闻｜2026 年 7 月 27 日",
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
      title: "Daily AI News | July 27, 2026",
      summary: "Today includes one lead story, one more confirmed item, and one unverified rumor that is kept separate from factual conclusions.",
      content_markdown: [
        "# Daily AI News | July 27, 2026",
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
      title: "毎日AIニュース｜2026年7月27日",
      summary: "本日はトップニュース1件、主なニュース1件に加え、事実と分離した未確認の噂1件を扱います。",
      content_markdown: [
        "# 毎日AIニュース｜2026年7月27日",
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
    schemaVersion: 3,
    reportDate: "2026-07-27",
    timezone: "Asia/Shanghai",
    windowStart: "2026-07-26T07:00:00+08:00",
    windowEnd: "2026-07-27T07:00:00+08:00",
    collectionMethod: "Horizon native fetch and cross-source dedupe",
    horizonRun: {
      runId: "run-20260727T010203Z-abc123",
      candidatesPath: "data/mcp-runs/run-20260727T010203Z-abc123/daily_candidates.json"
    },
    selection: {
      importanceThreshold: 7,
      maxItems: null,
      selectedStoryKeys: candidates.map((item) => item.storyKey)
    },
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

test("Daily AI News workflow declares the permanent three-section contract", async () => {
  const workflow = JSON.parse(await readFile(
    new URL("../自动新闻/integrations/lusu-site/workflow.json", import.meta.url),
    "utf8"
  ));

  assert.equal(workflow.schemaVersion, 3);
  assert.equal(workflow.calendar.mode, "fixed-24-hour-window");
  assert.equal(workflow.calendar.windowHours, 24);
  assert.equal(workflow.calendar.windowStartLocalTime, "07:00");
  assert.equal(workflow.calendar.windowEndLocalTime, "07:00");
  assert.equal(workflow.calendar.generationStartLocalTime, "07:00");
  assert.equal(workflow.calendar.publishDeadlineLocalTime, "08:00");
  assert.equal(workflow.calendar.deadlinePolicy, "fail-closed");
  assert.equal(workflow.calendar.historicalOneShot.requiresExplicitFlag, "--one-shot-history");
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
  assert.equal(workflow.article.requirePerItemAiTake, true);
  assert.equal(workflow.delivery.mode, "production-auto-publish");
  assert.equal(workflow.delivery.expectedResponseStatus, "published");
  assert.deepEqual(workflow.delivery.postPublishVerification.languages, ["zh", "en", "ja"]);
  assert.equal(workflow.delivery.postPublishVerification.mustFinishBeforeDeadline, true);
  assert.equal(workflow.delivery.postPublishVerification.retry, false);
  assert.equal(workflow.delivery.autoPublish, true);
  assert.equal(workflow.delivery.schedulerEnabled, true);
  assert.equal(workflow.delivery.failurePolicy, "fail-closed");
});

test("Daily AI News validator accepts the three-section contract", () => {
  assert.equal(validateRun(validRun()).reportDate, "2026-07-27");
});

test("Daily AI News section counts stay flexible outside the single lead", () => {
  const run = validRun();
  run.candidates = [run.candidates[0]];
  run.selection.selectedStoryKeys = [run.candidates[0].storyKey];
  run.delivery.translations = {
    zh: {
      title: "每日 AI 新闻｜2026 年 7 月 27 日",
      summary: "今天只有一条达到门槛的已确认要闻，没有用低价值内容补足数量。",
      content_markdown: "# 每日 AI 新闻｜2026 年 7 月 27 日\n\n## 今日要闻\n\n### 唯一入选要闻\n\n这条消息已经完成一手核实，正文说明发生了什么、关键数字、影响范围和当前限制。\n\n**AI 解读：** 核心价值在于实际能力是否持续，而不是当天的讨论热度。\n\n## 主要新闻\n\n今天没有其他达到门槛的已确认新闻。\n\n## 传闻\n\n今天没有值得单列的传闻。"
    },
    en: {
      title: "Daily AI News | July 27, 2026",
      summary: "Only one confirmed story cleared the bar today, with no low-value items added to fill space.",
      content_markdown: "# Daily AI News | July 27, 2026\n\n## Lead Story\n\n### The only selected lead\n\nPrimary material confirms the event, while the article explains what happened, the key figures, its impact and present limits.\n\n**AI take:** Durable capability matters more than the volume of discussion on release day.\n\n## More News\n\nNo other confirmed item cleared the bar today.\n\n## Rumors\n\nNo rumor was useful enough to include today."
    },
    ja: {
      title: "毎日AIニュース｜2026年7月27日",
      summary: "本日は確認済みの1件だけが基準を満たし、件数合わせの低価値情報は追加していません。",
      content_markdown: "# 毎日AIニュース｜2026年7月27日\n\n## 今日のトップニュース\n\n### 唯一のトップニュース\n\n一次資料で事実を確認し、何が起きたか、重要な数字、影響と現在の限界を分けて説明します。\n\n**AI解説：** 公開日の話題量より、能力が継続して使えるかどうかが重要です。\n\n## 主なニュース\n\n本日はほかに基準を満たす確認済みニュースがありません。\n\n## 噂\n\n本日は掲載する価値のある噂がありません。"
    }
  };

  assert.doesNotThrow(() => validateRun(run));
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

  const noConditionalLanguage = clone(validRun());
  noConditionalLanguage.delivery.translations.en.content_markdown =
    noConditionalLanguage.delivery.translations.en.content_markdown.replace(
      "The deal is reportedly under discussion, and secondary reporting describes the proposed event, amount, parties and open conditions that may still change.",
      "The deal is under discussion, and secondary reporting describes the event, amount, parties and open conditions."
    );
  assert.throws(() => validateRun(noConditionalLanguage), /en 的传闻正文必须使用条件语气/);
});

test("Daily AI News validator locks title, direct section start, and concise AI take style", () => {
  const wrongTitle = clone(validRun());
  wrongTitle.delivery.translations.en.title = "A different headline";
  wrongTitle.delivery.translations.en.content_markdown =
    wrongTitle.delivery.translations.en.content_markdown.replace(
      "# Daily AI News | July 27, 2026",
      "# A different headline"
    );
  assert.throws(() => validateRun(wrongTitle), /en 标题必须固定为/);

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
    { allowHistoricalOneShot: true }
  ));
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
  historical.windowStart = "2026-07-26T23:00:00+08:00";
  historical.windowEnd = "2026-07-27T23:00:00+08:00";

  assert.equal(isHistoricalOneShotWindow(historical), true);
  assert.throws(() => validateRun(historical), /显式 one-shot 参数/);
  assert.doesNotThrow(() => validateRun(historical, {
    allowHistoricalOneShot: true
  }));
});

test("Daily AI News production delivery enforces Beijing 07:00-08:00 and current date", () => {
  const run = validRun();
  const openWindow = assertProductionSchedule(run, {
    now: new Date("2026-07-26T23:30:00.000Z")
  });
  assert.equal(openWindow.deadlineAt, Date.parse("2026-07-27T08:00:00+08:00"));

  assert.throws(() => assertProductionSchedule(run, {
    now: new Date("2026-07-26T22:59:59.000Z")
  }), /尚未到北京时间 07:00/);
  assert.throws(() => assertProductionSchedule(run, {
    now: new Date("2026-07-27T00:00:00.000Z")
  }), /08:00 硬截止/);
  assert.throws(() => assertProductionSchedule(run, {
    now: new Date("2026-07-26T23:59:30.000Z")
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
    { runPath: "runs/today.json", oneShotHistory: false }
  );
  assert.throws(() => parseProductionArgs([]), /必须显式提供 --run/);
  assert.throws(() => parseProductionArgs(["--run", "run.json", "--unexpected"]), /未知参数/);
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
