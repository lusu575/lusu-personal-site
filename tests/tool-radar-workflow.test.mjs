import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  assertNoPublishedToolDuplicates,
  assertProductionRunMode,
  assertProductionSchedule,
  normalizeToolRadarCanonicalUrl,
  productionDeliveryPayload,
  publicAssetUrl,
  registeredToolRadarImages,
  validateDeliveryResponse,
  validateProductionEndpoint,
  validatePublicArticlePayload,
  verifyPublishedToolAssets
} from "../自动新闻/integrations/lusu-site/tool-radar/deliver-production.mjs";
import {
  buildToolRadarProductionChannelSql,
  parseProductionChannelArgs,
  redactedToolRadarTokenSummary
} from "../自动新闻/integrations/lusu-site/tool-radar/configure-production-channel.mjs";
import {
  normalizeCatalogResponse,
  serializeCatalogSnapshot,
  validateCatalogEndpoint
} from "../自动新闻/integrations/lusu-site/tool-radar/fetch-catalog.mjs";
import {
  deriveToolKey,
  sha256Bytes,
  validateRunObject
} from "../自动新闻/integrations/lusu-site/tool-radar/validate-run.mjs";

const LANE_IDS = [
  "design-motion-reference",
  "coding-agent-workflows",
  "image-video-audio",
  "research-data-knowledge",
  "automation-productivity",
  "local-self-hosted",
  "deployment-infrastructure",
  "china-access-language"
];

test("工具雷达 schema、日历、发现、证据、三语文章和空目录快照通过", async () => {
  const fixture = await createFixture();
  const result = await validateRunObject(fixture.run, { siteRoot: fixture.siteRoot });
  assert.equal(result.editionId, "tool-radar-2026-07-28");
  assert.equal(result.selectedToolCount, 3);
  assert.equal(result.catalogKnownToolCount, 0);
});

test("工具雷达三语摘要与通用后台统一限制为最多 500 字符", async () => {
  const fixture = await createFixture();
  fixture.run.delivery.translations.zh.summary = "摘".repeat(501);
  await assert.rejects(
    validateRunObject(fixture.run, { siteRoot: fixture.siteRoot }),
    /summary 必须为 20–500 字符/
  );
});

test("公开标题必须带与工具数完全一致的独立阿拉伯数字", async () => {
  const missingCountFixture = await createFixture();
  setTheme(
    missingCountFixture.run,
    "zh",
    "AI 总做不出想要的效果？这些设计、代码与本地 AI 工具可以帮忙"
  );
  await assert.rejects(
    validateRunObject(missingCountFixture.run, { siteRoot: missingCountFixture.siteRoot }),
    /与本期工具数完全一致的阿拉伯数字 3/
  );

  const wrongCountFixture = await createFixture();
  setTheme(
    wrongCountFixture.run,
    "zh",
    "AI 总做不出想要的效果？17 个设计、代码与本地 AI 工具"
  );
  await assert.rejects(
    validateRunObject(wrongCountFixture.run, { siteRoot: wrongCountFixture.siteRoot }),
    /与本期工具数完全一致的阿拉伯数字 3/
  );
});

test("公开标题必须明确读者痛点，不能只罗列范围", async () => {
  const fixture = await createFixture();
  setTheme(fixture.run, "en", "3 tools for design, code, and local AI");
  await assert.rejects(
    validateRunObject(fixture.run, { siteRoot: fixture.siteRoot }),
    /明确写出读者正在遇到的痛点/
  );
});

test("公开标题必须点明至少两个具体任务范围或收益", async () => {
  const fixture = await createFixture();
  setTheme(fixture.run, "ja", "AI が思いどおりに作れない？3つの便利なツール");
  await assert.rejects(
    validateRunObject(fixture.run, { siteRoot: fixture.siteRoot }),
    /至少两个具体任务范围或收益/
  );
});

test("工具雷达至少需要三个工具，不以单工具周刊凑数", async () => {
  const fixture = await createFixture();
  fixture.run.tools = fixture.run.tools.slice(0, 2);
  await assert.rejects(
    validateRunObject(fixture.run, { siteRoot: fixture.siteRoot }),
    /3–10 个工具/
  );
});

test("同一期重复 toolKey 会被拒绝", async () => {
  const fixture = await createFixture();
  fixture.run.tools[1].toolKey = fixture.run.tools[0].toolKey;
  fixture.run.tools[1].canonicalUrl = fixture.run.tools[0].canonicalUrl;
  fixture.run.tools[1].productSlug = fixture.run.tools[0].productSlug;
  await assert.rejects(
    validateRunObject(fixture.run, { siteRoot: fixture.siteRoot }),
    /本期重复 toolKey/
  );
});

test("目录快照中已经发布的工具永久拒绝再次入选", async () => {
  const fixture = await createFixture({
    catalogTools: [{
      toolKey: "alpha.example/alpha",
      name: "Alpha",
      canonicalUrl: "https://alpha.example/"
    }]
  });
  await assert.rejects(
    validateRunObject(fixture.run, { siteRoot: fixture.siteRoot }),
    /永久去重禁止再次入选/
  );
});

test("toolKey 必须由规范化官方域名与产品 slug 稳定派生", async () => {
  assert.equal(
    deriveToolKey("https://www.example.com/", "motion-library"),
    "example.com/motion-library"
  );
  const fixture = await createFixture();
  fixture.run.tools[0].toolKey = "elsewhere.example/alpha";
  await assert.rejects(
    validateRunObject(fixture.run, { siteRoot: fixture.siteRoot }),
    /必须由规范化官网 host/
  );
});

test("核心事实缺少官方证据时失败关闭", async () => {
  const fixture = await createFixture();
  fixture.run.tools[0].evidence.sources[0].kind = "reputable-review";
  await assert.rejects(
    validateRunObject(fixture.run, { siteRoot: fixture.siteRoot }),
    /至少需要一个官方来源/
  );
});

test("正文远程图片热链会被拒绝", async () => {
  const fixture = await createFixture();
  fixture.run.delivery.translations.zh.content_markdown = fixture.run.delivery
    .translations.zh.content_markdown.replace(
      /^(### Alpha[^\n]*\n)/m,
      "$1\n![远程图片](https://cdn.example/alpha.png)\n"
    );
  await assert.rejects(
    validateRunObject(fixture.run, { siteRoot: fixture.siteRoot }),
    /未登记图片却引用了图片/
  );
});

test("每个工具可按登记顺序引用一到两张不同的站内图片", async () => {
  const oneImageFixture = await createFixture();
  await addToolImages(oneImageFixture, { count: 1, useSingleObject: true });
  assert.equal(
    (await validateRunObject(oneImageFixture.run, { siteRoot: oneImageFixture.siteRoot }))
      .selectedToolCount,
    3
  );

  const twoImageFixture = await createFixture();
  await addToolImages(twoImageFixture);
  assert.equal(
    (await validateRunObject(twoImageFixture.run, { siteRoot: twoImageFixture.siteRoot }))
      .selectedToolCount,
    3
  );

  const tooManyFixture = await createFixture();
  await addToolImages(tooManyFixture);
  tooManyFixture.run.tools[0].image.push({
    ...tooManyFixture.run.tools[0].image[1],
    assetPath: "assets/images/articles/tool-radar/2026-07-28/alpha-third.png"
  });
  await assert.rejects(
    validateRunObject(tooManyFixture.run, { siteRoot: tooManyFixture.siteRoot }),
    /每个工具最多登记 2 张图片/
  );

  const duplicatePathFixture = await createFixture();
  await addToolImages(duplicatePathFixture);
  duplicatePathFixture.run.tools[0].image[1] = {
    ...duplicatePathFixture.run.tools[0].image[0],
    alt: duplicatePathFixture.run.tools[0].image[1].alt
  };
  await assert.rejects(
    validateRunObject(duplicatePathFixture.run, { siteRoot: duplicatePathFixture.siteRoot }),
    /不能重复 assetPath/
  );

  const duplicateBytesFixture = await createFixture();
  await addToolImages(duplicateBytesFixture, { duplicateBytes: true });
  await assert.rejects(
    validateRunObject(duplicateBytesFixture.run, { siteRoot: duplicateBytesFixture.siteRoot }),
    /不能是完全相同的文件/
  );
});

test("采用图片只接受官方真实界面、官方案例或真实成果，并完整记录来源与权利边界", async () => {
  const editorialFixture = await createFixture();
  await addToolImages(editorialFixture, { count: 1, useSingleObject: true });
  Object.assign(editorialFixture.run.tools[0].image, {
    sourcePageUrl: "https://alpha.example/product/editor",
    sourceAssetUrl: null,
    captureTarget: "#product-editor showing the complete input and result panels",
    rightsBasis: "official-public-editorial-capture",
    rightsUrl: "https://alpha.example/product/editor",
    rightsNote: "Public-page screenshot used only for limited editorial identification; copyright and trademarks remain with their rights holders and no endorsement is implied.",
    visualSourceType: "official-interface"
  });
  assert.equal(
    (await validateRunObject(editorialFixture.run, { siteRoot: editorialFixture.siteRoot }))
      .selectedToolCount,
    3
  );

  const repositoryFixture = await createFixture();
  await addToolImages(repositoryFixture, { count: 1, useSingleObject: true });
  repositoryFixture.run.tools[0].evidence.sources.push({
    id: "official-repository",
    url: "https://github.com/example/alpha",
    kind: "official-repository",
    accessedAt: "2026-07-28T22:10:00+08:00",
    supports: ["purpose", "capabilities"]
  });
  Object.assign(repositoryFixture.run.tools[0].image, {
    sourcePageUrl: "https://github.com/example/alpha/blob/main/docs/interface.png",
    sourceAssetUrl: "https://raw.githubusercontent.com/example/alpha/main/docs/interface.png",
    captureTarget: null,
    rightsBasis: "official-repository-license",
    rightsUrl: "https://github.com/example/alpha/blob/main/LICENSE",
    rightsNote: "The asset is published in the official repository and reused under that repository's MIT license.",
    visualSourceType: "official-output"
  });
  assert.equal(
    (await validateRunObject(repositoryFixture.run, { siteRoot: repositoryFixture.siteRoot }))
      .selectedToolCount,
    3
  );
});

test("图片来源必须是已登记官方页面，页面截图缺少 captureTarget 时失败关闭", async () => {
  const nonOfficialFixture = await createFixture();
  await addToolImages(nonOfficialFixture, { count: 1, useSingleObject: true });
  nonOfficialFixture.run.tools[0].image.sourcePageUrl =
    "https://image-aggregator.example/alpha-screenshot";
  await assert.rejects(
    validateRunObject(nonOfficialFixture.run, { siteRoot: nonOfficialFixture.siteRoot }),
    /必须来自该工具已登记的官方公开网页、官方文档或官方仓库/
  );

  const missingPageFixture = await createFixture();
  await addToolImages(missingPageFixture, { count: 1, useSingleObject: true });
  missingPageFixture.run.tools[0].image.sourcePageUrl = null;
  await assert.rejects(
    validateRunObject(missingPageFixture.run, { siteRoot: missingPageFixture.siteRoot }),
    /sourcePageUrl 必须是非空 HTTPS URL/
  );

  const missingTargetFixture = await createFixture();
  await addToolImages(missingTargetFixture, { count: 1, useSingleObject: true });
  Object.assign(missingTargetFixture.run.tools[0].image, {
    sourceAssetUrl: null,
    captureTarget: null,
    rightsBasis: "official-public-editorial-capture",
    rightsUrl: "https://alpha.example/showcase/example-1",
    rightsNote: "Public-page screenshot used only for limited editorial identification; copyright and trademarks remain with their rights holders."
  });
  await assert.rejects(
    validateRunObject(missingTargetFixture.run, { siteRoot: missingTargetFixture.siteRoot }),
    /页面截图必须记录非空 captureTarget/
  );
});

test("图片契约拒绝生成图、自绘说明图、概念模板和非真实 visualSourceType", async () => {
  const generatedBasisFixture = await createFixture();
  await addToolImages(generatedBasisFixture, { count: 1, useSingleObject: true });
  generatedBasisFixture.run.tools[0].image.rightsBasis = "original-generated";
  await assert.rejects(
    validateRunObject(generatedBasisFixture.run, { siteRoot: generatedBasisFixture.siteRoot }),
    /rightsBasis 不合法/
  );

  const selfDrawnFixture = await createFixture();
  await addToolImages(selfDrawnFixture, { count: 1, useSingleObject: true });
  selfDrawnFixture.run.tools[0].image.captureBrief.visualClaim =
    "This self-drawn explanatory visual summarizes Alpha without showing the real product.";
  await assert.rejects(
    validateRunObject(selfDrawnFixture.run, { siteRoot: selfDrawnFixture.siteRoot }),
    /禁止 original-generated、自绘说明图、概念图或统一说明模板/
  );

  const conceptFixture = await createFixture();
  await addToolImages(conceptFixture, { count: 1, useSingleObject: true });
  conceptFixture.run.tools[0].image.assetPath =
    "assets/images/articles/tool-radar/2026-07-28/alpha-concept-diagram.png";
  await assert.rejects(
    validateRunObject(conceptFixture.run, { siteRoot: conceptFixture.siteRoot }),
    /禁止 original-generated、自绘说明图、概念图或统一说明模板/
  );

  const invalidTypeFixture = await createFixture();
  await addToolImages(invalidTypeFixture, { count: 1, useSingleObject: true });
  invalidTypeFixture.run.tools[0].image.visualSourceType = "original-explainer";
  await assert.rejects(
    validateRunObject(invalidTypeFixture.run, { siteRoot: invalidTypeFixture.siteRoot }),
    /visualSourceType 只允许真实的官方界面、官方案例或官方成果/
  );
});

test("图片 rightsUrl 必须是 HTTPS，rightsNote 必须说明许可或编辑性引用边界", async () => {
  const rightsUrlFixture = await createFixture();
  await addToolImages(rightsUrlFixture, { count: 1, useSingleObject: true });
  rightsUrlFixture.run.tools[0].image.rightsUrl = "";
  await assert.rejects(
    validateRunObject(rightsUrlFixture.run, { siteRoot: rightsUrlFixture.siteRoot }),
    /rightsUrl 必须是非空 HTTPS URL/
  );

  const vagueEditorialFixture = await createFixture();
  await addToolImages(vagueEditorialFixture, { count: 1, useSingleObject: true });
  Object.assign(vagueEditorialFixture.run.tools[0].image, {
    sourceAssetUrl: null,
    captureTarget: "#complete-product-interface",
    rightsBasis: "official-public-editorial-capture",
    rightsUrl: "https://alpha.example/showcase/example-1",
    rightsNote: "This is a screenshot from the public page."
  });
  await assert.rejects(
    validateRunObject(vagueEditorialFixture.run, { siteRoot: vagueEditorialFixture.siteRoot }),
    /必须说明公开页面截图的编辑性用途及版权、商标或背书边界/
  );
});

test("图片必须先登记完整 capture brief、三语 caption，并把 caption 放在图片正下方", async () => {
  const emptyBriefFixture = await createFixture();
  await addToolImages(emptyBriefFixture, { count: 1, useSingleObject: true });
  emptyBriefFixture.run.tools[0].image.captureBrief.readerQuestion = " ";
  await assert.rejects(
    validateRunObject(emptyBriefFixture.run, { siteRoot: emptyBriefFixture.siteRoot }),
    /captureBrief\.readerQuestion 不能为空/
  );

  const emptyCaptionFixture = await createFixture();
  await addToolImages(emptyCaptionFixture, { count: 1, useSingleObject: true });
  emptyCaptionFixture.run.tools[0].image.caption.zh = "";
  await assert.rejects(
    validateRunObject(emptyCaptionFixture.run, { siteRoot: emptyCaptionFixture.siteRoot }),
    /caption\.zh 长度不合法/
  );

  const missingMustShowFixture = await createFixture();
  await addToolImages(missingMustShowFixture, { count: 1, useSingleObject: true });
  missingMustShowFixture.run.tools[0].image.captureBrief.mustShow = [
    "Alpha product identity"
  ];
  await assert.rejects(
    validateRunObject(missingMustShowFixture.run, { siteRoot: missingMustShowFixture.siteRoot }),
    /mustShow 必须包含 2–5 个关键画面元素/
  );

  const tooManyMustShowFixture = await createFixture();
  await addToolImages(tooManyMustShowFixture, { count: 1, useSingleObject: true });
  tooManyMustShowFixture.run.tools[0].image.captureBrief.mustShow = [
    "Alpha product identity",
    "complete task input area",
    "task action control",
    "processing status",
    "generated result area",
    "unrelated sixth element"
  ];
  await assert.rejects(
    validateRunObject(tooManyMustShowFixture.run, { siteRoot: tooManyMustShowFixture.siteRoot }),
    /mustShow 必须包含 2–5 个关键画面元素/
  );

  const bodyCaptionFixture = await createFixture();
  await addToolImages(bodyCaptionFixture, { count: 1, useSingleObject: true });
  const expectedCaption = bodyCaptionFixture.run.tools[0].image.caption.en;
  bodyCaptionFixture.run.delivery.translations.en.content_markdown =
    bodyCaptionFixture.run.delivery.translations.en.content_markdown.replace(
      `*${expectedCaption}*`,
      "*A different caption that was not reviewed with this image.*"
    );
  await assert.rejects(
    validateRunObject(bodyCaptionFixture.run, { siteRoot: bodyCaptionFixture.siteRoot }),
    /图片后的下一非空行必须是登记的单行斜体 caption/
  );

  const interveningLineFixture = await createFixture();
  await addToolImages(interveningLineFixture, { count: 1, useSingleObject: true });
  const interveningImage = interveningLineFixture.run.tools[0].image;
  interveningLineFixture.run.delivery.translations.zh.content_markdown =
    interveningLineFixture.run.delivery.translations.zh.content_markdown.replace(
      `![${interveningImage.alt.zh}](${interveningImage.assetPath})\n`
        + `*${interveningImage.caption.zh}*`,
      `![${interveningImage.alt.zh}](${interveningImage.assetPath})\n`
        + "这行内容插在图片与 caption 之间。\n"
        + `*${interveningImage.caption.zh}*`
    );
  await assert.rejects(
    validateRunObject(interveningLineFixture.run, { siteRoot: interveningLineFixture.siteRoot }),
    /图片后的下一非空行必须是登记的单行斜体 caption/
  );
});

test("caption 邻接校验兼容 CRLF 和空白行，并保持双图登记顺序", async () => {
  const fixture = await createFixture();
  await addToolImages(fixture);
  const [firstImage] = fixture.run.tools[0].image;
  fixture.run.delivery.translations.en.content_markdown =
    fixture.run.delivery.translations.en.content_markdown.replace(
      `![${firstImage.alt.en}](${firstImage.assetPath})\n*${firstImage.caption.en}*`,
      `![${firstImage.alt.en}](${firstImage.assetPath})\r\n\r\n*${firstImage.caption.en}*`
    );
  assert.equal(
    (await validateRunObject(fixture.run, { siteRoot: fixture.siteRoot })).selectedToolCount,
    3
  );

  const swappedCaptionFixture = await createFixture();
  await addToolImages(swappedCaptionFixture);
  const [first, second] = swappedCaptionFixture.run.tools[0].image;
  swappedCaptionFixture.run.delivery.translations.ja.content_markdown =
    swappedCaptionFixture.run.delivery.translations.ja.content_markdown
      .replace(`*${first.caption.ja}*`, "*__FIRST_IMAGE_CAPTION__*")
      .replace(`*${second.caption.ja}*`, `*${first.caption.ja}*`)
      .replace("*__FIRST_IMAGE_CAPTION__*", `*${second.caption.ja}*`);
  await assert.rejects(
    validateRunObject(swappedCaptionFixture.run, { siteRoot: swappedCaptionFixture.siteRoot }),
    /第 1 张图片后的下一非空行必须是登记的单行斜体 caption/
  );
});

test("单图必须独立成义，双图必须同组有先后且承担不同信息角色", async () => {
  const singleFixture = await createFixture();
  await addToolImages(singleFixture, { count: 1, useSingleObject: true });
  singleFixture.run.tools[0].image.framing = "sequence-start";
  singleFixture.run.tools[0].image.sequence = {
    groupKey: "alpha-incomplete-sequence",
    position: 1,
    total: 2
  };
  await assert.rejects(
    validateRunObject(singleFixture.run, { siteRoot: singleFixture.siteRoot }),
    /单图必须使用 framing=standalone/
  );

  const groupFixture = await createFixture();
  await addToolImages(groupFixture);
  groupFixture.run.tools[0].image[1].sequence.groupKey = "another-visual-story";
  await assert.rejects(
    validateRunObject(groupFixture.run, { siteRoot: groupFixture.siteRoot }),
    /双图必须使用同一个 sequence\.groupKey/
  );

  const orderFixture = await createFixture();
  await addToolImages(orderFixture);
  orderFixture.run.tools[0].image[1].sequence.position = 1;
  await assert.rejects(
    validateRunObject(orderFixture.run, { siteRoot: orderFixture.siteRoot }),
    /sequence\.position=1、2/
  );

  const roleFixture = await createFixture();
  await addToolImages(roleFixture);
  roleFixture.run.tools[0].image[1].captureBrief.informationRole =
    roleFixture.run.tools[0].image[0].captureBrief.informationRole;
  await assert.rejects(
    validateRunObject(roleFixture.run, { siteRoot: roleFixture.siteRoot }),
    /必须承担不同的 captureBrief\.informationRole/
  );
});

test("实际采用的每张图都必须有本期内完成且全部通过的视觉 QA", async () => {
  const failedQaFixture = await createFixture();
  await addToolImages(failedQaFixture, { count: 1, useSingleObject: true });
  failedQaFixture.run.tools[0].image.visualQa.criticalContentUncropped = false;
  await assert.rejects(
    validateRunObject(failedQaFixture.run, { siteRoot: failedQaFixture.siteRoot }),
    /criticalContentUncropped 必须明确为 true/
  );

  const staleQaFixture = await createFixture();
  await addToolImages(staleQaFixture, { count: 1, useSingleObject: true });
  staleQaFixture.run.tools[0].image.visualQa.reviewedAt = "2026-07-28T21:59:59+08:00";
  await assert.rejects(
    validateRunObject(staleQaFixture.run, { siteRoot: staleQaFixture.siteRoot }),
    /visualQa\.reviewedAt 不能早于本期周二 22:00/
  );
});

test("工具标题需要保留运行顺序并带有简短利益点", async () => {
  const pureNameFixture = await createFixture();
  pureNameFixture.run.delivery.translations.zh.content_markdown = pureNameFixture.run.delivery
    .translations.zh.content_markdown.replace(/^### Alpha[^\n]*$/m, "### Alpha");
  await assert.rejects(
    validateRunObject(pureNameFixture.run, { siteRoot: pureNameFixture.siteRoot }),
    /补充简短利益点/
  );

  const wrongOrderFixture = await createFixture();
  wrongOrderFixture.run.delivery.translations.en.content_markdown = wrongOrderFixture.run.delivery
    .translations.en.content_markdown
    .replace(/^### Alpha[^\n]*$/m, "### __FIRST_TOOL__ | temporary")
    .replace(/^### Beta[^\n]*$/m, "### Alpha | a useful second perspective")
    .replace(/^### __FIRST_TOOL__[^\n]*$/m, "### Beta | a useful first perspective");
  await assert.rejects(
    validateRunObject(wrongOrderFixture.run, { siteRoot: wrongOrderFixture.siteRoot }),
    /顺序与运行记录一致/
  );
});

test("二级栏目使用利益点式标题且不能重复", async () => {
  const fixture = await createFixture();
  const content = fixture.run.delivery.translations.zh.content_markdown;
  assert.match(content, /^# [^\n]+\n\n## /);
  const h2Titles = [...content.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
  assert.equal(h2Titles.length, 2);
  assert.notDeepEqual(h2Titles, ["本期工具", "本期怎么选"]);

  fixture.run.delivery.translations.zh.content_markdown = content.replace(
    `## ${h2Titles[1]}`,
    `## ${h2Titles[0]}`
  );
  await assert.rejects(
    validateRunObject(fixture.run, { siteRoot: fixture.siteRoot }),
    /二级栏目标题不能重复/
  );

  const legacyFixture = await createFixture();
  const legacyContent = legacyFixture.run.delivery.translations.en.content_markdown;
  const legacyH2Titles = [...legacyContent.matchAll(/^## (.+)$/gm)]
    .map((match) => match[1]);
  legacyFixture.run.delivery.translations.en.content_markdown = legacyContent
    .replace(`## ${legacyH2Titles[0]}`, "## This Week's Tools")
    .replace(`## ${legacyH2Titles[1]}`, "## How to Choose");
  await assert.rejects(
    validateRunObject(legacyFixture.run, { siteRoot: legacyFixture.siteRoot }),
    /不得套用旧固定栏目文案/
  );
});

test("每个工具需要恰好三段分工明确的自然叙事和一行实用信息", async () => {
  const missingFactFixture = await createFixture();
  missingFactFixture.run.delivery.translations.zh.content_markdown = missingFactFixture.run.delivery
    .translations.zh.content_markdown.replace("AI 接入：", "AI 能力：");
  await assert.rejects(
    validateRunObject(missingFactFixture.run, { siteRoot: missingFactFixture.siteRoot }),
    /缺少“AI 接入”/
  );

  const twoParagraphFixture = await createFixture();
  twoParagraphFixture.run.delivery.translations.zh.content_markdown = twoParagraphFixture.run
    .delivery.translations.zh.content_markdown.replace(
      "\n\n它更适合正在学习专业表达的个人，或想在正式采用前做小规模验证的团队。不过部分界面仍是英文，长期使用前也值得先看清权限和付费上限。",
      ""
    );
  await assert.rejects(
    validateRunObject(twoParagraphFixture.run, { siteRoot: twoParagraphFixture.siteRoot }),
    /恰好需要三段自然叙事/
  );

  const fourParagraphFixture = await createFixture();
  fourParagraphFixture.run.delivery.translations.zh.content_markdown = fourParagraphFixture.run
    .delivery.translations.zh.content_markdown.replace(
      "**上手信息：**",
      "再补一段没有独立职责的说明，只会让读者在进入实用信息前重复阅读已经说过的内容，因此不该被保留。\n\n**上手信息：**"
    );
  await assert.rejects(
    validateRunObject(fourParagraphFixture.run, { siteRoot: fourParagraphFixture.siteRoot }),
    /恰好需要三段自然叙事/
  );

  const oneIntroFixture = await createFixture();
  oneIntroFixture.run.delivery.translations.zh.content_markdown = oneIntroFixture.run.delivery
    .translations.zh.content_markdown.replace(
      /(^## [^\n]+\n\n)([\s\S]+?)(\n\n### )/m,
      (_match, heading, intro, firstTool) =>
        `${heading}${intro.replace(/\n\s*\n/gu, " ")}${firstTool}`
    );
  await assert.rejects(
    validateRunObject(oneIntroFixture.run, { siteRoot: oneIntroFixture.siteRoot }),
    /恰好包含两段自然短文/
  );
});

test("暖叙事文章拒绝退回大量粗体字段验收清单", async () => {
  const fixture = await createFixture();
  fixture.run.delivery.translations.ja.content_markdown = fixture.run.delivery
    .translations.ja.content_markdown.replace(
      "**利用メモ：**",
      [
        "- **公式サイト：** 確認済み",
        "- **できること：** 確認済み",
        "- **料金：** 確認済み",
        "- **ログイン：** 確認済み",
        "- **中国語対応：** 確認済み",
        "- **ローカル導入：** 確認済み",
        "- **AI 支援：** 確認済み",
        "- **使い方：** 確認済み",
        "- **活用例：** 確認済み",
        "- **向いている場面：** 確認済み",
        "",
        "**利用メモ：**"
      ].join("\n")
    );
  await assert.rejects(
    validateRunObject(fixture.run, { siteRoot: fixture.siteRoot }),
    /不得退回大量.*验收清单/
  );
});

test("发现 lane 必须完整签收且失败不能伪装为空结果", async () => {
  const fixture = await createFixture();
  fixture.run.discoveryAudit.signedOffLaneIds.pop();
  await assert.rejects(
    validateRunObject(fixture.run, { siteRoot: fixture.siteRoot }),
    /全部 required lane/
  );
});

test("生产端点与目录端点固定在 lusu575.com 专用 HTTPS 路径", () => {
  assert.equal(
    validateProductionEndpoint("https://lusu575.com/api/automation/tool-radar"),
    "https://lusu575.com/api/automation/tool-radar"
  );
  assert.equal(
    validateCatalogEndpoint("https://lusu575.com/api/automation/tool-radar/catalog"),
    "https://lusu575.com/api/automation/tool-radar/catalog"
  );
  assert.throws(
    () => validateProductionEndpoint("https://example.com/api/automation/tool-radar"),
    /必须是 lusu575.com/
  );
  assert.throws(
    () => validateCatalogEndpoint(
      "https://lusu575.com/api/automation/tool-radar/catalog?token=leak"
    ),
    /无凭证、无查询参数/
  );
});

test("生产时段从本期周二 22:00 开始，到下一期开始前结束", async () => {
  const fixture = await createFixture();
  assert.doesNotThrow(() => assertProductionSchedule(fixture.run, {
    now: new Date("2026-07-28T22:05:00+08:00")
  }));
  assert.throws(() => assertProductionSchedule(fixture.run, {
    now: new Date("2026-07-28T21:59:59+08:00")
  }), /拒绝提前/);
  assert.throws(() => assertProductionSchedule(fixture.run, {
    now: new Date("2026-08-04T22:00:00+08:00")
  }), /过期运行记录/);
});

test("生产前会基于最新目录再次拦截重复工具", async () => {
  const fixture = await createFixture();
  assert.doesNotThrow(() => assertNoPublishedToolDuplicates(fixture.run, {
    toolKeys: [],
    tools: []
  }));
  assert.throws(() => assertNoPublishedToolDuplicates(fixture.run, {
    toolKeys: ["beta.example/beta"]
  }), /永久去重触发/);
  assert.throws(() => assertNoPublishedToolDuplicates(fixture.run, {
    toolKeys: ["historical.example/old-beta-key"],
    tools: [{
      toolKey: "historical.example/old-beta-key",
      canonicalUrl: "https://www.beta.example//",
      name: "Beta Before Rename"
    }]
  }), /canonicalUrl.*永久去重触发/);
  assert.equal(
    normalizeToolRadarCanonicalUrl("https://WWW.BETA.EXAMPLE//"),
    "https://beta.example/"
  );
});

test("生产投递前要求所有登记图片已按同一字节上线", async () => {
  const fixture = await createFixture();
  assert.equal(await verifyPublishedToolAssets({
    endpoint: "https://lusu575.com/api/automation/tool-radar",
    run: fixture.run,
    fetchImpl: async () => {
      throw new Error("无图运行不应请求静态资源");
    }
  }), 0);

  await addToolImages(fixture, { count: 1, useSingleObject: true });
  const [image] = registeredToolRadarImages(fixture.run);
  const imageBytes = await readFile(resolve(fixture.siteRoot, ...image.assetPath.split("/")));
  const requestedUrls = [];
  assert.equal(await verifyPublishedToolAssets({
    endpoint: "https://lusu575.com/api/automation/tool-radar",
    run: fixture.run,
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      return new Response(imageBytes, {
        status: 200,
        headers: { "content-type": "image/png" }
      });
    }
  }), 1);
  assert.deepEqual(requestedUrls, [
    `https://lusu575.com/${image.assetPath}`
  ]);
  assert.equal(
    publicAssetUrl("https://lusu575.com/api/automation/tool-radar", image.assetPath),
    `https://lusu575.com/${image.assetPath}`
  );

  await assert.rejects(
    verifyPublishedToolAssets({
      endpoint: "https://lusu575.com/api/automation/tool-radar",
      run: fixture.run,
      fetchImpl: async () => new Response(Buffer.from("different"), {
        status: 200,
        headers: { "content-type": "image/png" }
      })
    }),
    /线上图片字节与运行记录不一致/
  );
});

test("线上图片瞬时失败会有界重试，持续失败仍然关闭投递", async () => {
  const fixture = await createFixture();
  await addToolImages(fixture, { count: 1, useSingleObject: true });
  const [image] = registeredToolRadarImages(fixture.run);
  const imageBytes = await readFile(resolve(fixture.siteRoot, ...image.assetPath.split("/")));
  const retryWaits = [];
  let transientCalls = 0;
  assert.equal(await verifyPublishedToolAssets({
    endpoint: "https://lusu575.com/api/automation/tool-radar",
    run: fixture.run,
    retryDelaysMs: [1, 2],
    sleepImpl: async (milliseconds) => retryWaits.push(milliseconds),
    fetchImpl: async () => {
      transientCalls += 1;
      if (transientCalls === 1) {
        throw new TypeError("fetch failed");
      }
      return new Response(imageBytes, {
        status: 200,
        headers: { "content-type": "image/png" }
      });
    }
  }), 1);
  assert.equal(transientCalls, 2);
  assert.deepEqual(retryWaits, [1]);

  let persistentCalls = 0;
  await assert.rejects(
    verifyPublishedToolAssets({
      endpoint: "https://lusu575.com/api/automation/tool-radar",
      run: fixture.run,
      retryDelaysMs: [0, 0],
      sleepImpl: async () => {},
      fetchImpl: async () => {
        persistentCalls += 1;
        throw new TypeError("fetch failed");
      }
    }),
    /连续 3 次读取失败/
  );
  assert.equal(persistentCalls, 3);
});

test("多张线上图片按登记顺序逐张预检，不再同时发起全部请求", async () => {
  const fixture = await createFixture();
  await addToolImages(fixture, { count: 2 });
  const images = registeredToolRadarImages(fixture.run);
  const bytesByUrl = new Map(await Promise.all(images.map(async (image) => [
    `https://lusu575.com/${image.assetPath}`,
    await readFile(resolve(fixture.siteRoot, ...image.assetPath.split("/")))
  ])));
  const requestedUrls = [];
  let activeRequests = 0;
  let maximumActiveRequests = 0;
  assert.equal(await verifyPublishedToolAssets({
    endpoint: "https://lusu575.com/api/automation/tool-radar",
    run: fixture.run,
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      await new Promise((resolveTurn) => queueMicrotask(resolveTurn));
      const bytes = bytesByUrl.get(url);
      activeRequests -= 1;
      return new Response(bytes, {
        status: 200,
        headers: { "content-type": "image/png" }
      });
    }
  }), 2);
  assert.equal(maximumActiveRequests, 1);
  assert.deepEqual(requestedUrls, images.map(
    (image) => `https://lusu575.com/${image.assetPath}`
  ));
});

test("线上图片预检严格拒绝持续 HTTP 错误和错误 MIME", async () => {
  const fixture = await createFixture();
  await addToolImages(fixture, { count: 1, useSingleObject: true });
  const [image] = registeredToolRadarImages(fixture.run);
  const imageBytes = await readFile(resolve(fixture.siteRoot, ...image.assetPath.split("/")));

  let unavailableCalls = 0;
  await assert.rejects(
    verifyPublishedToolAssets({
      endpoint: "https://lusu575.com/api/automation/tool-radar",
      run: fixture.run,
      retryDelaysMs: [0, 0],
      sleepImpl: async () => {},
      fetchImpl: async () => {
        unavailableCalls += 1;
        return new Response("unavailable", { status: 503 });
      }
    }),
    /返回 503/
  );
  assert.equal(unavailableCalls, 3);

  let mimeCalls = 0;
  await assert.rejects(
    verifyPublishedToolAssets({
      endpoint: "https://lusu575.com/api/automation/tool-radar",
      run: fixture.run,
      retryDelaysMs: [0, 0],
      sleepImpl: async () => {},
      fetchImpl: async () => {
        mimeCalls += 1;
        return new Response(imageBytes, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        });
      }
    }),
    /MIME 不合法/
  );
  assert.equal(mimeCalls, 1);
});

test("工具雷达生产通道配置只开启独立通道且令牌摘要不泄露明文", () => {
  const token = "lusu_tool_radar_abcdefghijklmnopqrstuvwxyzABCDEFG";
  const summary = redactedToolRadarTokenSummary(token);
  assert.equal(summary.includes(token), false);
  assert.match(summary, /尾号/);
  const deliveryOnlySql = buildToolRadarProductionChannelSql({
    tokenHash: createHash("sha256").update(token).digest("hex"),
    tokenHint: token.slice(-6),
    timestamp: "2026-07-29T00:00:00.000Z"
  });
  assert.match(deliveryOnlySql, /'tool-radar', 'tool-radar', 1, 0/);
  assert.match(deliveryOnlySql, /auto_publish = 0/);
  assert.doesNotMatch(deliveryOnlySql, /daily-ai-news/);

  const autoPublishSql = buildToolRadarProductionChannelSql({
    tokenHash: createHash("sha256").update(token).digest("hex"),
    tokenHint: token.slice(-6),
    timestamp: "2026-07-29T00:00:00.000Z",
    autoPublish: true
  });
  assert.match(autoPublishSql, /'tool-radar', 'tool-radar', 1, 1/);
  assert.match(autoPublishSql, /auto_publish = 1/);

  assert.deepEqual(
    parseProductionChannelArgs(["--confirm-production", "--enable-delivery"]),
    { autoPublish: false }
  );
  assert.deepEqual(
    parseProductionChannelArgs([
      "--confirm-production",
      "--enable-delivery",
      "--enable-auto-publish"
    ]),
    { autoPublish: true }
  );
  assert.throws(
    () => parseProductionChannelArgs(["--confirm-production"]),
    /--enable-delivery/
  );
});

test("目录响应被规范化为确定性排序快照", () => {
  const snapshot = normalizeCatalogResponse({
    ok: true,
    category: "tool-radar",
    tools: [
      { toolKey: "z.example/z", name: "Z" },
      { toolKey: "a.example/a", name: "A" }
    ]
  }, {
    fetchedAt: "2026-07-28T22:01:00+08:00"
  });
  assert.deepEqual(snapshot.toolKeys, ["a.example/a", "z.example/z"]);
  assert.equal(serializeCatalogSnapshot(snapshot).endsWith("\n"), true);
  assert.throws(() => normalizeCatalogResponse({
    ok: true,
    category: "tool-radar",
    truncated: true,
    tools: []
  }), /目录响应被截断/);
});

test("trial 试稿可校验但永远不能进入生产投递", async () => {
  const fixture = await createFixture({ trial: true });
  const result = await validateRunObject(fixture.run, { siteRoot: fixture.siteRoot });
  assert.equal(result.selectedToolCount, 3);
  assert.throws(() => assertProductionRunMode(fixture.run), /trial 试稿永远不可投递/);
  assert.deepEqual(
    Object.keys(productionDeliveryPayload(fixture.run.delivery)).includes("mode"),
    false
  );
  assert.deepEqual(
    Object.keys(productionDeliveryPayload(fixture.run.delivery)).includes("status"),
    false
  );
});

test("draft 与 published 都是合法投递结果，只有 published 需要公开回读", async () => {
  const fixture = await createFixture();
  for (const status of ["draft", "published"]) {
    assert.equal(validateDeliveryResponse({
      httpStatus: 200,
      responseOk: true,
      payload: {
        ok: true,
        category: "tool-radar",
        status,
        slug: fixture.run.delivery.slug,
        articleId: "article-1"
      },
      run: fixture.run
    }).status, status);
  }
  assert.throws(() => validateDeliveryResponse({
    httpStatus: 200,
    responseOk: true,
    payload: {
      ok: true,
      category: "tool-radar",
      status: "scheduled",
      slug: fixture.run.delivery.slug,
      articleId: "article-1"
    },
    run: fixture.run
  }), /草稿或公开/);
});

test("三语公开回读要求 tool-radar 分类和完全一致的正文", async () => {
  const fixture = await createFixture();
  const expected = fixture.run.delivery.translations.zh;
  const article = {
    slug: fixture.run.delivery.slug,
    category: "tool-radar",
    status: "published",
    lang: "zh",
    requested_lang: "zh",
    title: expected.title,
    content_markdown: expected.content_markdown
  };
  assert.equal(validatePublicArticlePayload({
    payload: { article },
    lang: "zh",
    run: fixture.run
  }), article);
  assert.throws(() => validatePublicArticlePayload({
    payload: { article: { ...article, category: "daily-ai-news" } },
    lang: "zh",
    run: fixture.run
  }), /公开文章核验失败/);
});

test("run.schema.json 是独立 schema v1，并声明 3–10 工具与每工具最多两图", async () => {
  const schemaPath = resolve(
    "自动新闻/integrations/lusu-site/tool-radar/run.schema.json"
  );
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.equal(schema.properties.tools.minItems, 3);
  assert.equal(schema.properties.tools.maxItems, 10);
  assert.equal(schema.properties.delivery.properties.tools.minItems, 3);
  const imageArray = schema.$defs.tool.properties.image.oneOf
    .find((branch) => branch.type === "array");
  assert.equal(imageArray.minItems, 1);
  assert.equal(imageArray.maxItems, 2);
  assert.deepEqual(
    schema.$defs.toolImageCaptureBrief.required,
    ["readerQuestion", "visualClaim", "informationRole", "mustShow"]
  );
  assert.equal(schema.$defs.toolImageCaptureBrief.properties.mustShow.minItems, 2);
  assert.equal(schema.$defs.toolImageCaptureBrief.properties.mustShow.maxItems, 5);
  assert.equal(schema.$defs.toolImageVisualQa.properties.threeSecondTestPassed.const, true);
  assert.equal(schema.$defs.toolImageVisualQa.properties.criticalContentUncropped.const, true);
  assert.deepEqual(
    schema.$defs.toolImage.properties.framing.enum,
    ["standalone", "sequence-start", "sequence-end"]
  );
  assert.deepEqual(schema.$defs.toolImage.required, [
    "assetPath",
    "sourcePageUrl",
    "sourceAssetUrl",
    "captureTarget",
    "rightsBasis",
    "rightsUrl",
    "rightsNote",
    "visualSourceType",
    "sha256",
    "alt",
    "caption",
    "captureBrief",
    "framing",
    "sequence",
    "visualQa"
  ]);
  assert.deepEqual(schema.$defs.toolImage.properties.rightsBasis.enum, [
    "official-permitted-download",
    "official-repository-license",
    "official-public-editorial-capture"
  ]);
  assert.deepEqual(schema.$defs.toolImage.properties.visualSourceType.enum, [
    "official-interface",
    "official-case-study",
    "official-output"
  ]);
  assert.equal(schema.$defs.toolImage.properties.sourcePageUrl.pattern, "^https://[^\\s]+$");
  assert.equal(schema.$defs.toolImage.properties.rightsUrl.pattern, "^https://[^\\s]+$");

  const workflow = JSON.parse(await readFile(resolve(
    "自动新闻/integrations/lusu-site/tool-radar/workflow.json"
  ), "utf8"));
  assert.equal(workflow.images.minimumPerTool, 0);
  assert.equal(workflow.images.maximumPerTool, 2);
  assert.equal(workflow.images.captureBriefRequiredBeforeCapture, true);
  assert.deepEqual(workflow.images.captureBriefMustShowItems, {
    minimum: 2,
    maximum: 5
  });
  assert.equal(workflow.images.visualQaRequiredForEachIncludedImage, true);
  assert.equal(workflow.images.singleImageFraming, "standalone");
  assert.deepEqual(
    workflow.images.twoImageSequence.requiredFramingOrder,
    ["sequence-start", "sequence-end"]
  );
  assert.equal(workflow.images.twoImageSequence.differentInformationRolesRequired, true);
  assert.deepEqual(workflow.images.allowedVisualSourceTypes, [
    "official-interface",
    "official-case-study",
    "official-output"
  ]);
  assert.deepEqual(workflow.images.allowedRightsBasis, [
    "official-permitted-download",
    "official-repository-license",
    "official-public-editorial-capture"
  ]);
  assert.equal(workflow.images.sourcePageUrlRequired, true);
  assert.equal(workflow.images.captureTargetRequiredWhenSourceAssetUrlNull, true);
  assert.equal(workflow.images.rightsEvidenceRequired, true);
  assert.match(workflow.images.selectionRule, /interface.*workflow.*output\/result/i);
  assert.match(workflow.images.realSourceOnlyRule, /Never create, draw, generate, or template/i);
  assert.match(workflow.images.realSourceOnlyRule, /image to null/i);
  assert.doesNotMatch(workflow.images.visualQaPassPolicy, /generate an original/i);
  assert.match(workflow.images.semanticCompletenessRule, /mustShow.*must not be clipped/i);
  assert.match(workflow.images.genericHomepageHeroPolicy, /homepage hero.*only when/i);
});

async function createFixture({ catalogTools = [], trial = false } = {}) {
  const siteRoot = await mkdtemp(join(tmpdir(), "tool-radar-test-"));
  const snapshotPath = "自动新闻/data/mcp-runs/tool-radar-2026-07-28/catalog.json";
  const absoluteSnapshotPath = resolve(siteRoot, ...snapshotPath.split("/"));
  await mkdir(resolve(absoluteSnapshotPath, ".."), { recursive: true });
  const snapshot = {
    schemaVersion: 1,
    mode: trial ? "trial-local" : "authenticated-production",
    fetchedAt: "2026-07-28T22:01:00+08:00",
    endpoint: trial
      ? "local:tool-radar-trial-catalog"
      : "https://lusu575.com/api/automation/tool-radar/catalog",
    category: "tool-radar",
    tools: [...catalogTools].sort((left, right) => left.toolKey.localeCompare(right.toolKey)),
    toolKeys: catalogTools.map((tool) => tool.toolKey).sort()
  };
  const snapshotBytes = Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await writeFile(absoluteSnapshotPath, snapshotBytes);

  const tools = [
    makeTool("alpha", "Alpha", "coding"),
    makeTool("beta", "Beta", "design-inspiration"),
    makeTool("gamma", "Gamma", "local-ai")
  ];
  const theme = {
    zh: "AI 总做不出想要的效果？3 个设计、代码与本地 AI 工具",
    en: "AI not giving you the result you want? 3 tools for design, code, and local AI",
    ja: "AI が思いどおりに作れない？デザイン・コード・ローカル AI の 3 ツール"
  };
  const translations = Object.fromEntries(["zh", "en", "ja"].map((lang) => [
    lang,
    makeTranslation(lang, theme[lang], tools)
  ]));
  const run = {
    schemaVersion: 1,
    edition: {
      id: "tool-radar-2026-07-28",
      timezone: "Asia/Shanghai",
      scheduledAt: "2026-07-28T22:00:00+08:00",
      discoveryStart: "2026-07-21T22:00:00+08:00",
      discoveryEnd: "2026-07-28T22:00:00+08:00"
    },
    discoveryAudit: {
      catalogVersion: 1,
      completedAt: "2026-07-28T22:30:00+08:00",
      candidateCount: 12,
      signedOffLaneIds: [...LANE_IDS],
      lanes: LANE_IDS.map((laneId) => ({
        laneId,
        status: "complete",
        searches: [{
          query: `${laneId} useful AI tools`,
          executedAt: "2026-07-28T22:05:00+08:00",
          status: "success",
          resultCount: 5
        }],
        notes: `Reviewed ${laneId} candidates and official sources.`
      }))
    },
    catalogAudit: {
      mode: snapshot.mode,
      snapshotPath,
      fetchedAt: snapshot.fetchedAt,
      sha256: sha256Bytes(snapshotBytes),
      knownToolCount: snapshot.tools.length
    },
    theme,
    tools,
    delivery: {
      mode: trial ? "trial" : "production",
      status: trial ? "not-delivered" : "pending",
      idempotencyKey: "tool-radar:2026-07-28:v1",
      slug: "tool-radar-2026-07-28",
      source: "Codex weekly web research with official-source verification",
      tags: ["工具雷达", "AI工具", "效率"],
      tools: tools.map((tool) => ({
        toolKey: tool.toolKey,
        canonicalUrl: tool.canonicalUrl,
        name: tool.name
      })),
      translations
    }
  };
  return { siteRoot, run };
}

function setTheme(run, lang, theme) {
  const translation = run.delivery.translations[lang];
  const previousTheme = run.theme[lang];
  const prefix = translation.title.slice(0, translation.title.length - previousTheme.length);
  const previousTitle = translation.title;
  const nextTitle = `${prefix}${theme}`;
  run.theme[lang] = theme;
  translation.title = nextTitle;
  translation.content_markdown = translation.content_markdown.replace(
    `# ${previousTitle}`,
    `# ${nextTitle}`
  );
}

async function addToolImages(fixture, {
  count = 2,
  duplicateBytes = false,
  useSingleObject = false
} = {}) {
  const imageDirectory = resolve(
    fixture.siteRoot,
    "assets",
    "images",
    "articles",
    "tool-radar",
    "2026-07-28"
  );
  await mkdir(imageDirectory, { recursive: true });
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const imageBytes = [
    Buffer.from([...pngSignature, 0x01]),
    Buffer.from([...pngSignature, duplicateBytes ? 0x01 : 0x02])
  ];
  const paths = [
    "assets/images/articles/tool-radar/2026-07-28/alpha-interface.png",
    "assets/images/articles/tool-radar/2026-07-28/alpha-result.png"
  ];
  const alt = [
    {
      zh: "Alpha 的任务输入界面",
      en: "Alpha task input interface",
      ja: "Alpha のタスク入力画面"
    },
    {
      zh: "Alpha 生成后的结果界面",
      en: "Alpha generated result view",
      ja: "Alpha の生成結果画面"
    }
  ];
  const captions = [
    {
      zh: "先在 Alpha 里写清任务输入，后续结果才有可核对的起点。",
      en: "Start by defining the task in Alpha so the result has a clear reference point.",
      ja: "まず Alpha でタスクを明確にし、結果を確認できる出発点を作ります。"
    },
    {
      zh: "再看 Alpha 的生成结果，输入与输出组成一条完整的使用链路。",
      en: "Then inspect Alpha's generated result to complete the input-to-output story.",
      ja: "次に Alpha の生成結果を確認し、入力から出力までの流れを完結させます。"
    }
  ];
  for (const [index, assetPath] of paths.entries()) {
    await writeFile(resolve(fixture.siteRoot, ...assetPath.split("/")), imageBytes[index]);
  }
  const images = paths.map((assetPath, index) => ({
    assetPath,
    sourcePageUrl: `https://alpha.example/showcase/example-${index + 1}`,
    sourceAssetUrl: `https://alpha.example/media/example-${index + 1}.png`,
    captureTarget: null,
    rightsBasis: "official-permitted-download",
    rightsUrl: "https://alpha.example/media-usage",
    rightsNote: "The official media page explicitly permits downloading and reusing this asset under its stated terms.",
    visualSourceType: index === 0 ? "official-interface" : "official-output",
    sha256: sha256Bytes(imageBytes[index]),
    alt: alt[index],
    caption: captions[index],
    captureBrief: {
      readerQuestion: index === 0
        ? "Where does a reader enter the task that Alpha will execute?"
        : "What concrete result does Alpha return after receiving the task?",
      visualClaim: index === 0
        ? "Alpha provides a visible task input area before generation begins."
        : "Alpha presents a visible generated result after processing the input.",
      informationRole: index === 0 ? "input" : "result",
      mustShow: index === 0
        ? ["Alpha product identity", "complete task input area"]
        : ["Alpha product identity", "complete generated result"]
    },
    framing: "standalone",
    sequence: null,
    visualQa: {
      threeSecondTestPassed: true,
      productAndContextIdentifiable: true,
      criticalContentUncropped: true,
      privacyClean: true,
      articleWidthReadable: true,
      reviewedAt: "2026-07-28T22:20:00+08:00"
    }
  }));
  const selectedImages = images.slice(0, count);
  if (selectedImages.length === 2) {
    selectedImages[0].framing = "sequence-start";
    selectedImages[0].sequence = {
      groupKey: "alpha-input-to-result",
      position: 1,
      total: 2
    };
    selectedImages[1].framing = "sequence-end";
    selectedImages[1].sequence = {
      groupKey: "alpha-input-to-result",
      position: 2,
      total: 2
    };
  }
  fixture.run.tools[0].image = useSingleObject ? selectedImages[0] : selectedImages;
  for (const lang of ["zh", "en", "ja"]) {
    const imageMarkdown = selectedImages
      .map((image) =>
        `![${image.alt[lang]}](${image.assetPath})\n*${image.caption[lang]}*`)
      .join("\n\n");
    fixture.run.delivery.translations[lang].content_markdown = fixture.run.delivery
      .translations[lang].content_markdown.replace(
        /^(### Alpha[^\n]*\n)/m,
        `$1\n${imageMarkdown}\n`
      );
  }
}

function makeTool(slug, name, category) {
  const canonicalUrl = `https://${slug}.example/`;
  const evidenceId = "official-product";
  const checkedAt = "2026-07-28T22:10:00+08:00";
  return {
    toolKey: `${slug}.example/${slug}`,
    canonicalUrl,
    productSlug: slug,
    name,
    displayNames: {
      zh: name,
      en: name,
      ja: name
    },
    category,
    evidence: {
      checkedAt,
      sources: [{
        id: evidenceId,
        url: canonicalUrl,
        kind: "official-product",
        accessedAt: checkedAt,
        supports: [
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
        ]
      }]
    },
    profile: {
      purpose: {
        text: `${name} helps people complete a clearly defined AI-assisted task.`,
        evidenceIds: [evidenceId]
      },
      capabilities: {
        items: ["Turns a concrete input into a reusable workflow."],
        evidenceIds: [evidenceId]
      },
      pricing: {
        status: "freemium",
        freeTier: "limited",
        details: "A limited free tier is available; paid limits are documented on the official site.",
        checkedAt,
        evidenceIds: [evidenceId]
      },
      login: {
        status: "optional",
        details: "Basic browsing works without an account; saving work needs sign-in.",
        checkedAt,
        evidenceIds: [evidenceId]
      },
      chineseSupport: {
        status: "partial",
        details: "Chinese input works, while parts of the interface remain English.",
        checkedAt,
        evidenceIds: [evidenceId]
      },
      localDeployment: {
        status: "not-supported",
        details: "The official product is currently hosted only.",
        checkedAt,
        evidenceIds: [evidenceId]
      },
      aiDeployment: {
        status: "guided",
        details: "The product provides a guided setup rather than a fully automatic deployment.",
        checkedAt,
        evidenceIds: [evidenceId]
      },
      usageSteps: {
        items: [
          "Open the official product and choose a starter workflow.",
          "Add a small real task, review the result and save the reusable setup."
        ],
        evidenceIds: [evidenceId]
      },
      caseStudies: {
        items: [{
          title: `${name} starter workflow`,
          description: "A documented starter flow demonstrates the core capability on a small task.",
          kind: "documented"
        }],
        evidenceIds: [evidenceId]
      },
      scenarios: {
        items: [
          "People learning the vocabulary of a specialist task.",
          "Small teams testing an AI workflow before larger adoption."
        ],
        evidenceIds: [evidenceId]
      }
    },
    image: null
  };
}

function makeTranslation(lang, theme, tools) {
  const configs = {
    zh: {
      prefix: "工具雷达｜",
      first: "AI 往往不是不会做，而是你还没把需求说清楚",
      last: "你现在卡在哪，就先从哪里开始",
      intro: "这一期选择三个用途不同、上手门槛较低的工具，重点核对普通人最关心的价格、登录、中文和部署条件。",
      introSecond: "我更想把它们当成三个可以随手试一下的入口：先看真实任务能不能变轻，再决定要不要长期留下，而不是一次收藏一整排链接。",
      headingSuffix: "先拿一个真实小任务试水",
      paragraphs: (tool, link) => [
        `${tool.name} 最吸引人的地方，不是替你把所有事情包办，而是把复杂步骤整理成普通人也能看懂、能复核的流程。碰到自己不熟悉的专业任务时，这种“先说清楚再执行”的帮助往往比多一个花哨按钮更实用。`,
        `如果是我，我会先从一个十分钟能做完的小任务开始，再去[官网看看具体入口](${link})。结果符合预期就保存成可重复使用的流程，不合适也能及时停下，不必先交出整个项目。`,
        "它更适合正在学习专业表达的个人，或想在正式采用前做小规模验证的团队。不过部分界面仍是英文，长期使用前也值得先看清权限和付费上限。"
      ],
      practicalDetails: "**上手信息：** 收费：提供有限免费层，更多额度付费；登录：基础浏览免登录，保存需登录；中文支持：支持中文输入，部分界面为英文；本地部署：官方版不支持；AI 接入：引导式配置，并非完全自动的一键部署。",
      closing: "需要快速体验时优先选择无需登录的基础能力；涉及隐私或长期团队使用时，再比较本地部署、权限和付费上限。"
    },
    en: {
      prefix: "Tool Radar | ",
      first: "AI often needs a clearer brief, not another vague command",
      last: "Start with the friction you have today",
      intro: "This edition covers three approachable tools with different jobs, focusing on pricing, sign-in, Chinese support and deployment constraints.",
      introSecond: "Think of them as three low-pressure starting points: try one on a real task, notice whether the work gets lighter, and only then decide if it deserves a permanent place in your setup.",
      headingSuffix: "start with one real, low-risk task",
      paragraphs: (tool, link) => [
        `${tool.name} is interesting because it does not pretend to take over the whole job. It turns a concrete input into a workflow that an ordinary reader can understand, review and reuse, which is often more useful than adding another flashy AI button.`,
        `I would begin with a task that takes about ten minutes, then [check the official product](${link}) for the exact entry point. If the result holds up, the flow can be saved for later; if it does not, very little time or context has been handed over.`,
        "It is a sensible fit for people learning specialist vocabulary and for small teams testing a workflow before wider adoption. Parts of the interface are still English, so permissions and paid limits deserve a quick look before long-term use."
      ],
      practicalDetails: "**Practical details:** Pricing: limited free tier, with more capacity paid; Sign-in: browsing works without an account, saving requires one; Chinese support: Chinese input works, parts of the interface remain English; Local deployment: not supported by the official product; AI setup: guided setup, not a fully automatic one-click deployment.",
      closing: "For a quick trial, start with the capability that works without sign-in. For private or long-term team work, compare local deployment, permissions and paid limits first."
    },
    ja: {
      prefix: "ツールレーダー｜",
      first: "AIに足りないのは能力より、伝わる依頼かもしれない",
      last: "今つまずいている場所から一つ選ぶ",
      intro: "今号では用途の異なる使いやすい3つのツールを選び、料金、ログイン、中国語対応、導入条件を中心に確認した。",
      introSecond: "三つを一度に集める必要はない。まず実際の小さな作業で一つ試し、負担が軽くなると分かってから、自分の環境に残すかを決めればよい。",
      headingSuffix: "まず小さな実作業で確かめる",
      paragraphs: (tool, link) => [
        `${tool.name} の良さは、仕事を丸ごと奪うように見せないことだ。具体的な入力を、普通の人にも理解でき、確認して再利用できる流れに整える。派手な機能を一つ増やすより、慣れない専門作業ではこちらの方が助かる。`,
        `私なら、まず10分ほどで終わる小さな作業を選び、[公式サイトで入口を確認する](${link})。結果が良ければ流れを保存し、合わなければ早めに止められるので、最初から大切な案件をすべて渡さずに済む。`,
        "専門用語を学んでいる個人や、本格導入前に小さく試したいチームに向く。一方で画面の一部は英語のため、長く使う前に権限と有料枠の上限も見ておきたい。"
      ],
      practicalDetails: "**利用メモ：** 料金：制限付き無料枠があり、追加容量は有料；ログイン：基本閲覧は不要、保存時は必要；中国語対応：中国語入力に対応、画面の一部は英語；ローカル導入：公式版は非対応；AI 導入：案内付き設定で、完全自動のワンクリックではない。",
      closing: "まず試す場合はログイン不要の機能を優先する。機密情報や長期運用では、ローカル導入、権限、有料上限を先に比較したい。"
    }
  };
  const config = configs[lang];
  const blocks = tools.map((tool) => {
    const paragraphs = config.paragraphs(tool, tool.canonicalUrl).join("\n\n");
    return `### ${tool.displayNames[lang]}｜${config.headingSuffix}\n\n${paragraphs}\n\n${config.practicalDetails}`;
  }).join("\n\n");
  const title = `${config.prefix}${theme}`;
  const content = `# ${title}\n\n## ${config.first}\n\n${config.intro}\n\n${config.introSecond}\n\n${blocks}\n\n## ${config.last}\n\n${config.closing}`;
  return {
    title,
    summary: `${config.intro} 本期所有事实都回到官方来源核对，并明确保留未知项。`,
    content_markdown: content
  };
}
