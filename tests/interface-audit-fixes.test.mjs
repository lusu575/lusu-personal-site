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

test("the chat and whiteboard UI update leads the exact five-item projection without losing release history", async () => {
  const chatWhiteboardUiUpdateId = "seed-update-2026-08-20-chat-whiteboard-ui-fixes";
  const minimaxH3UpdateId = "seed-update-2026-08-12-minimax-h3-console";
  const updateId = "seed-update-2026-08-12-wallpaper-game-display-fix";
  const firstVersionUpdateId = "seed-update-2026-08-11-h3-first-version-video-sr-48fps";
  const priorBfcacheUpdateId = "seed-update-2026-08-11-ambient-wallpaper-bfcache-fix";
  const videoLinkAutofillUpdateId = "seed-update-2026-08-11-video-link-autofill";
  const priorH3UpdateId = "seed-update-2026-08-10-h3-ambient-wallpapers-4k";
  const priorSlimDawnUpdateId = "seed-update-2026-08-10-wallpaper-switch-slim-dawn";
  const priorCeramicUpdateId = "seed-update-2026-08-10-wallpaper-switch-ceramic-roll";
  const priorCalmUpdateId = "seed-update-2026-08-10-wallpaper-switch-calm-redesign";
  const priorSceneUpdateId = "seed-update-2026-08-09-wallpaper-switch-scene-redesign";
  const gameVideoMcpUpdateId = "seed-update-2026-08-09-game-video-mcp-candidate";
  const wallpaperTimeUpdateId = "seed-update-2026-08-09-wallpaper-time-switch";
  const motionPolishUpdateId = "seed-update-2026-08-09-motion-polish";
  const remoteMcpOauthUpdateId = "seed-update-2026-08-07-remote-mcp-oauth";
  const lifeRestartAgentUpdateId = "seed-update-2026-08-07-life-restart-agent";
  const hextrisAgentUpdateId = "seed-update-2026-08-07-hextris-agent";
  const whiteboardAgentImagesUpdateId = "seed-update-2026-08-06-whiteboard-agent-images";
  const agentAuthFormOriginUpdateId = "seed-update-2026-08-06-agent-auth-form-origin";
  const japaneseProgressUpdateId = "seed-update-2026-08-06-japanese-agent-progress";
  const agentReadBreadthUpdateId = "seed-update-2026-08-06-agent-read-breadth";
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

 assert.deepEqual(content.updates.slice(0, 24).map((update) => update.article_id), [
    chatWhiteboardUiUpdateId,
    "seed-update-2026-08-19-daily-ai-news-rss",
    "seed-update-2026-08-13-hide-minimax-h3-tools",
   minimaxH3UpdateId,
    updateId,
    firstVersionUpdateId,
    priorBfcacheUpdateId,
    videoLinkAutofillUpdateId,
    priorH3UpdateId,
    priorSlimDawnUpdateId,
    priorCeramicUpdateId,
    priorCalmUpdateId,
    priorSceneUpdateId,
    gameVideoMcpUpdateId,
    wallpaperTimeUpdateId,
    motionPolishUpdateId,
    remoteMcpOauthUpdateId,
    lifeRestartAgentUpdateId,
    hextrisAgentUpdateId,
    whiteboardAgentImagesUpdateId,
    agentAuthFormOriginUpdateId,
    japaneseProgressUpdateId,
    agentReadBreadthUpdateId,
    whiteboard2048UpdateId,
 ]);
  assert.equal(content.updates[0].slug, "2026-08-20-chat-whiteboard-ui-fixes");
  assert.equal(content.updates[0].published_at, "2026-08-20T08:00:00.000Z");
  assert.equal(homeContent.updates[0].article_id, chatWhiteboardUiUpdateId);
  assert.ok(content.updates.some((update) => update.article_id === trafficUpdateId));
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
    for (const seededUpdateId of [minimaxH3UpdateId, updateId, firstVersionUpdateId, priorBfcacheUpdateId, videoLinkAutofillUpdateId, priorH3UpdateId, priorSlimDawnUpdateId, priorCeramicUpdateId, priorCalmUpdateId, priorSceneUpdateId, gameVideoMcpUpdateId, wallpaperTimeUpdateId, motionPolishUpdateId, remoteMcpOauthUpdateId]) {
      assert.ok(source.includes(seededUpdateId), `${path} should include ${seededUpdateId}`);
    }
    for (const title of Object.values(content.updates[0].title)) {
      assert.ok(source.includes(title), `${path} should include ${title}`);
    }
  }
});

test("BFCache-safe ambient wallpapers, retained motion modules, wallpaper switch assets, and Quick Transfer keep independent cache versions", () => {
  const publicVersion = "20260809-motion-polish-r2";
  const switchRouteMotionVersion = "20260810-wallpaper-switch-route-motion-r1";
  const videoLinkAutofillVersion = "20260811-video-link-autofill-r1";
  const ambientAssetVersion = "20260810-h3-ambient-wallpapers-4k-r1";
  const displayFixReleaseVersion = "20260812-wallpaper-game-display-r1";
  const publicSiteReleaseVersion = "20260820-chat-whiteboard-ui-r2";
  const wallpaperAssetVersion = "20260810-wallpaper-time-switch-r6";
  const transferVersion = "20260809-transfer-motion-r2";
  const index = read("index.html");
  const main = read("js/main.js");
  const changelog = read("CHANGELOG.md");
  const transferLoader = read("js/features/quick-transfer-loader.mjs");
  const resources = read("js/routes/resources.mjs");

  for (const asset of [
    "/js/mobile-shell.js",
    "/js/ui-motion.js"
  ]) {
    assert.ok(index.includes(`${asset}?v=${publicVersion}`), `${asset} should use ${publicVersion}`);
  }
  for (const asset of ["/css/style.css", "/css/mobile-ios-shell.css"]) {
    assert.ok(index.includes(`${asset}?v=${publicSiteReleaseVersion}`), `${asset} should use ${publicSiteReleaseVersion}`);
  }
  assert.ok(index.includes(`/css/motion-system.css?v=${publicSiteReleaseVersion}`));
  assert.ok(index.includes(`/js/main.js?v=${publicSiteReleaseVersion}`));
  assert.ok(main.includes(`wallpaper-ambient.mjs?v=${displayFixReleaseVersion}`));
  assert.ok(changelog.includes(switchRouteMotionVersion), "the wallpaper route-motion release token must remain in project history");
  assert.ok(changelog.includes(videoLinkAutofillVersion), "the video-link release token must remain in project history");
  const switchContentAssets = [
    ...["morning", "day", "dusk", "night"].map((theme) => `scene-${theme}.png`),
    "frame.png",
    ...["morning", "day", "dusk", "night"].map((theme) => `node-${theme}.png`),
    ...["morning", "day", "dusk", "night"].map((theme) => `marker-${theme}.png`),
    ...["morning", "day", "dusk", "night"].map((theme) => `accent-${theme}.png`),
    "roller.png"
  ];
  const switchRuntimeAssets = [
    "scene-atlas.png",
    "marker-atlas.png",
    "node-atlas.png",
    "accent-atlas.png",
    "frame.png"
  ];
  for (const asset of switchRuntimeAssets) {
    assert.ok(index.includes(`/assets/images/wallpaper-switch/${asset}?v=${wallpaperAssetVersion}`));
  }
  assert.equal(switchContentAssets.length, 18);
  assert.equal(switchRuntimeAssets.length, 5);
  const switchRuntimePaths = [...index.matchAll(/(?:src|data-src)="(\/assets\/images\/wallpaper-switch\/[^?"]+\.png)\?v=20260810-wallpaper-time-switch-r6"/g)]
    .map((match) => match[1]);
  assert.deepEqual(
    [...new Set(switchRuntimePaths)].sort(),
    switchRuntimeAssets.map((asset) => `/assets/images/wallpaper-switch/${asset}`).sort()
  );
  for (const asset of switchContentAssets) {
    if (asset === "frame.png") continue;
    assert.ok(!index.includes(`/assets/images/wallpaper-switch/${asset}?`), `${asset} should remain a manifest content source, not a runtime request`);
  }
  assert.match(index, /class="wallpaper-time-roller-atlas" data-atlas-cell="roller" data-src="\/assets\/images\/wallpaper-switch\/node-atlas\.png\?v=20260810-wallpaper-time-switch-r6" width="192" height="960"/);
  assert.doesNotMatch(index, /wallpaper-switch\/(?:time-track|time-selector|fx-(?:morning|day|dusk|night)|node-inactive|atmosphere-(?:morning|day|dusk|night)-(?:ambient|far|mid|accent|atlas))\.png/);
  assert.ok(main.includes(`const routeStyleVersion = "${publicSiteReleaseVersion}"`));
  assert.ok(main.includes(`./core/i18n.mjs?v=${publicSiteReleaseVersion}`));
  assert.ok(main.includes(`./core/wallpaper-time.mjs?v=${publicVersion}`));
  assert.ok(main.includes(`./data/home-content.mjs?v=${publicSiteReleaseVersion}`));
  assert.ok(main.includes(`./core/wallpaper-ambient.mjs?v=${displayFixReleaseVersion}`));
  assert.ok(main.includes(`./features/account.mjs?v=${publicVersion}`));
  assert.ok(main.includes(`./routes/knowledge.mjs?v=${publicVersion}`));
  assert.ok(main.includes(`./routes/chatroom.mjs?v=${publicVersion}`));
  const resourcesVersion = "20260820-chat-whiteboard-ui-r2";
  assert.ok(main.includes(`./routes/resources.mjs?v=${resourcesVersion}`));
  assert.ok(main.includes(`./data/resources-content.mjs?v=${resourcesVersion}`));
  for (const token of [
    '"AI 能力": { zh: "AI 能力", en: "AI capabilities", ja: "AI 機能" }',
    '"CLI": { zh: "CLI", en: "CLI", ja: "CLI" }',
    '"MCP": { zh: "MCP", en: "MCP", ja: "MCP" }',
    '"开源许可": { zh: "开源许可", en: "Open-source license", ja: "オープンソースライセンス" }',
    '"人生重开模拟器": { zh: "人生重开模拟器", en: "Life Restart", ja: "Life Restart" }'
  ]) {
    assert.ok(main.includes(token), `js/main.js should localize the Agent release tag: ${token}`);
  }
  assert.ok(transferLoader.includes(`const TRANSFER_VERSION = "${transferVersion}"`));
  assert.ok(resources.includes(`../features/quick-transfer-loader.mjs?v=${transferVersion}`));
  assert.doesNotMatch([index, main, transferLoader, resources].join("\n"), /20260726-tools-rename-r1/);
});
