import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("public modal fixes preserve readable depth and compact failed-video geometry", () => {
  const style = read("css/style.css");
  const mobile = read("css/mobile-ios-shell.css");

  assert.match(style, /\.modal-backdrop\s*\{[^}]*background:\s*rgba\(0,\s*24,\s*74,\s*0\.46\)/s);
  assert.match(style, /html:lang\(zh\) #resource-list \.resource-main > p,[\s\S]*?html:lang\(zh\) \.about-copy\s*\{[^}]*word-break:\s*keep-all;/s);
  assert.match(style, /html:not\(\[data-ui-shell="mobile"\]\):lang\(zh\) \.about-copy\s*\{[^}]*word-break:\s*keep-all;[^}]*overflow-wrap:\s*normal;/s);
  assert.match(style, /@supports \(word-break:\s*auto-phrase\)[\s\S]*?html:lang\(zh\) #resource-list[\s\S]*?html:lang\(ja\) #resource-list[\s\S]*?word-break:\s*auto-phrase;/s);
  assert.match(style, /\.profile-info dd\s*\{[^}]*overflow-wrap:\s*break-word;[^}]*text-wrap:\s*pretty;/s);
  assert.match(style, /\.about-copy\s*\{[^}]*word-break:\s*normal;[^}]*text-wrap:\s*pretty;/s);

  assert.match(mobile, /#video-modal:has\(\.video-player-fallback\)\s*\{[^}]*align-items:\s*center;/s);
  assert.match(
    mobile,
    /\.modal-window:has\(\.video-player-fallback\)\s*\{[^}]*height:\s*auto;[^}]*max-height:\s*calc\(/s
  );
  assert.match(
    mobile,
    /\.video-frame:has\(\.video-player-fallback\)\s*\{[^}]*min-height:\s*clamp\(230px,\s*48dvh,\s*360px\)/s
  );
  assert.match(
    mobile,
    /\.video-frame:has\(\.video-player-fallback\) > \.video-player-fallback\s*\{[^}]*min-height:\s*clamp\(230px,\s*48dvh,\s*360px\)/s
  );
  assert.match(
    mobile,
    /@media \(orientation:\s*portrait\) and \(max-height:\s*560px\)\s*\{[\s\S]*?\.welcome-window\s*\{[\s\S]*?var\(--mobile-viewport-height,\s*100dvh\)/s
  );
});

test("the Phase 3 read breadth release leads the five-item trilingual projection while older updates remain archived", async () => {
  const updateId = "seed-update-2026-08-06-agent-read-breadth";
  const whiteboard2048UpdateId = "seed-update-2026-08-06-whiteboard-2048-agent";
  const firstPhaseUpdateId = "seed-update-2026-08-06-agent-capabilities";
  const websiteGuideUpdateId = "seed-update-2026-08-06-site-guides-password-rooms";
  const trafficUpdateId = "seed-update-2026-08-02-traffic-discovery-monitoring";
  const calmWhiteboardUpdateId = "seed-update-2026-08-01-whiteboard-calm-efficient-sync";
  const reliableWhiteboardUpdateId = "seed-update-2026-08-01-whiteboard-reliable-sketch";
  const serviceReliabilityUpdateId = "seed-update-2026-08-01-service-reliability";
  const whiteboardUpdateId = "seed-update-2026-07-30-multiplayer-whiteboard";
  const knowledgeUpdateId = "seed-update-2026-07-29-knowledge-markdown-links";
  const [{ content }, { homeContent }] = await Promise.all([
    import("../js/data/content.mjs"),
    import("../js/data/home-content.mjs")
  ]);

  assert.equal(content.updates[0].article_id, updateId);
  assert.equal(homeContent.updates[0].article_id, updateId);
  assert.equal(content.updates[1].article_id, whiteboard2048UpdateId);
  assert.equal(homeContent.updates[1].article_id, whiteboard2048UpdateId);
  assert.equal(content.updates[2].article_id, firstPhaseUpdateId);
  assert.equal(homeContent.updates[2].article_id, firstPhaseUpdateId);
  assert.equal(content.updates[3].article_id, websiteGuideUpdateId);
  assert.equal(homeContent.updates[3].article_id, websiteGuideUpdateId);
  assert.equal(content.updates[4].article_id, trafficUpdateId);
  assert.equal(homeContent.updates[4].article_id, trafficUpdateId);
  assert.ok(content.updates.some((update) => update.article_id === calmWhiteboardUpdateId));
  assert.ok(content.updates.some((update) => update.article_id === reliableWhiteboardUpdateId));
  assert.ok(content.updates.some((update) => update.article_id === serviceReliabilityUpdateId));
  assert.ok(content.updates.some((update) => update.article_id === whiteboardUpdateId));
  assert.ok(content.updates.some((update) => update.article_id === knowledgeUpdateId));
  assert.equal(homeContent.updates.length, 5);
  for (const lang of ["zh", "en", "ja"]) {
    assert.ok(content.updates[0].title[lang]);
    assert.ok(content.updates[0].summary[lang]);
    assert.ok(content.updates[0].content_markdown[lang]);
    assert.equal(homeContent.updates[0].title[lang], content.updates[0].title[lang]);
    assert.equal(homeContent.updates[0].summary[lang], content.updates[0].summary[lang]);
  }

  for (const path of ["functions/api/[[route]].js", "cloudflare/schema.sql"]) {
    const source = read(path);
    assert.ok(source.includes(updateId), `${path} should include the newest update seed`);
    for (const title of Object.values(content.updates[0].title)) {
      assert.ok(source.includes(title), `${path} should include ${title}`);
    }
  }
});

test("Knowledge Markdown links use a fresh cache version without invalidating unrelated public assets", () => {
  const stableVersion = "20260726-security-reliability-r1";
  const knowledgeReaderVersion = "20260728-knowledge-archive-r1";
  const agentCapabilitiesVersion = "20260806-agent-capabilities-quick-transfer-r1";
  const agentReadBreadthVersion = "20260806-agent-read-breadth-r1";
  const transferVersion = agentReadBreadthVersion;
  const index = read("index.html");
  const main = read("js/main.js");
  const transferLoader = read("js/features/quick-transfer-loader.mjs");
  const resources = read("js/routes/resources.mjs");

  for (const asset of [
    "/js/mobile-shell.js",
    "/css/style.css",
    "/css/motion-system.css",
    "/js/ui-motion.js"
  ]) {
    assert.ok(index.includes(`${asset}?v=${stableVersion}`), `${asset} should use ${stableVersion}`);
  }
  assert.ok(index.includes(`/css/mobile-ios-shell.css?v=${knowledgeReaderVersion}`));
  assert.ok(index.includes(`/js/main.js?v=${agentReadBreadthVersion}`));
  assert.ok(main.includes(`const routeStyleVersion = "${knowledgeReaderVersion}"`));
  assert.ok(main.includes(`./core/i18n.mjs?v=${agentCapabilitiesVersion}`));
  assert.ok(main.includes(`./data/home-content.mjs?v=${agentReadBreadthVersion}`));
  assert.ok(main.includes(`./routes/knowledge.mjs?v=${agentCapabilitiesVersion}`));
  assert.ok(main.includes(`./data/resources-content.mjs?v=${agentReadBreadthVersion}`));
  assert.ok(transferLoader.includes(`const TRANSFER_VERSION = "${transferVersion}"`));
  assert.ok(resources.includes(`../features/quick-transfer-loader.mjs?v=${transferVersion}`));
  assert.doesNotMatch([index, main, transferLoader, resources].join("\n"), /20260726-tools-rename-r1/);
});
