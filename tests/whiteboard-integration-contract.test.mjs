import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("online whiteboard is a Tools-only lazy route with an image2 PNG entry asset", async () => {
  const [catalog, route, main, html] = await Promise.all([
    read("js/data/resources-content.mjs"),
    read("js/routes/resources.mjs"),
    read("js/main.js"),
    read("tools/whiteboard/index.html")
  ]);
  assert.match(catalog, /assets\/images\/generated-icons\/whiteboard\.png/);
  assert.match(catalog, /tools\/whiteboard\//);
  assert.match(route, /tools\/whiteboard\//);
  assert.match(route, /tools:whiteboard:open/);
  assert.doesNotMatch(main, /@excalidraw|from ["']yjs["']/);
  assert.match(html, /鲁肃个人站工具区/);
  assert.doesNotMatch(html, /资源区/);
});

test("passwords are ephemeral while collaboration uses incremental Yjs frames", async () => {
  const [main, api, collaboration, scene] = await Promise.all([
    read("tools/whiteboard/src/main.jsx"),
    read("tools/whiteboard/src/api.js"),
    read("tools/whiteboard/src/collaboration.js"),
    read("tools/whiteboard/src/y-scene.js")
  ]);
  assert.match(main, /RECENT_ROOM_KEY/);
  assert.match(main, /aiEnabled=\{false\}/);
  assert.doesNotMatch(main, /localStorage\.(?:setItem|getItem)\([^\\n]*(?:password|密码)/i);
  assert.match(api, /\{ type: roomType, password: normalizeRoomPassword\(password\) \}/);
  assert.match(api, /dataRoute: "tools"/);
  assert.match(api, /route: "tools"/);
  assert.doesNotMatch(api, /dataRoute: "resources"|route: "resources"/);
  assert.match(api, /BroadcastChannel\(IDENTITY_SYNC_CHANNEL\)/);
  assert.match(api, /getAnonymousIdentity\(\)[\s\S]*callback\(identity\)/);
  assert.doesNotMatch(api, /localStorage\.setItem\([^\\n]*(?:displayName|anonymousId|color|credential)/);
  assert.match(collaboration, /WS_YJS_UPDATE = 0/);
  assert.match(collaboration, /Y\.encodeStateVector/);
  assert.match(collaboration, /LIVENESS_PING_MS = 60_000/);
  assert.match(collaboration, /BACKGROUND_PARK_MS = 60_000/);
  assert.match(collaboration, /CURSOR_INTERVAL_MS = 100/);
  assert.match(collaboration, /this\.socket\.send\("ping"\)/);
  assert.match(collaboration, /parkForBackground/);
  assert.match(collaboration, /CURSOR_LABEL_FADE_MS = 2_500/);
  assert.match(collaboration, /window\.addEventListener\("focus", this\.handleFocus\)/);
  assert.match(collaboration, /window\.addEventListener\("blur", this\.handleBlur\)/);
  assert.match(collaboration, /document\.hasFocus\(\)/);
  assert.match(scene, /new Y\.Map\(\)/);
  assert.doesNotMatch(api, /canvas|sceneElements|elements:/);
});

test("whiteboard custom UI does not embed code-drawn image material", async () => {
  const css = await read("tools/whiteboard/whiteboard.css");
  assert.doesNotMatch(css, /data:image|clip-path|polygon\(|linear-gradient|radial-gradient/i);
  assert.doesNotMatch(css, /url\(/i);
});

test("whiteboard exposes v1.0.2 and gives every room the same editable pencil sketch style", async () => {
  const main = await read("tools/whiteboard/src/main.jsx");
  assert.match(main, /const WHITEBOARD_VERSION = "1\.0\.2"/);
  assert.match(main, /const ALL_ROOM_SKETCH_APP_STATE = Object\.freeze/);
  assert.match(main, /function createAllRoomSketchInitialData\(\)/);
  assert.match(main, /initialData=\{sketchInitialData\}/);
  assert.match(main, /viewBackgroundColor: "#f7f1e5"/);
  assert.match(main, /currentItemStrokeColor: "#4a4640"/);
  assert.match(main, /currentItemBackgroundColor: "transparent"/);
  assert.match(main, /currentItemFillStyle: "hachure"/);
  assert.match(main, /currentItemRoughness: 2/);
  assert.match(main, /currentItemOpacity: 92/);
});

test("transient reconnects stay delayed and compact instead of opening a large canvas banner", async () => {
  const [main, css] = await Promise.all([
    read("tools/whiteboard/src/main.jsx"),
    read("tools/whiteboard/whiteboard.css"),
  ]);
  assert.match(main, /CONNECTION_NOTICE_DELAY_MS = 3_000/);
  assert.match(main, /className=\{`connection-corner is-\$\{connectionStatus\}`\}/);
  assert.doesNotMatch(main, /className="connection-banner"/);
  assert.match(css, /\.connection-corner\s*\{/);
  assert.doesNotMatch(css, /\.connection-banner/);
});

test("mobile whiteboard controls stay reachable and reject unsupported image inputs early", async () => {
  const [css, main, assets] = await Promise.all([
    read("tools/whiteboard/whiteboard.css"),
    read("tools/whiteboard/src/main.jsx"),
    read("tools/whiteboard/src/assets.js"),
  ]);
  assert.match(
    css,
    /\.board-header-primary \.header-link\s*\{[^}]*min-height:\s*44px/s,
  );
  assert.match(
    css,
    /\.board-header\s*\{[^}]*safe-area-inset-right[^}]*safe-area-inset-left/s,
  );
  assert.match(
    css,
    /\.board-header-actions\s*\{[^}]*flex-wrap:\s*wrap[^}]*overflow:\s*visible/s,
  );
  assert.match(
    css,
    /\.members-panel\s*\{[^}]*bottom:\s*max\(10px,\s*env\(safe-area-inset-bottom\)\)[^}]*max-height:\s*none/s,
  );
  assert.match(main, /input\.accept = WHITEBOARD_IMAGE_ACCEPT/);
  assert.match(main, /onChangeCapture=\{rejectUnsupportedImageInput\}/);
  assert.match(main, /onDropCapture=\{rejectUnsupportedImageInput\}/);
  assert.match(main, /onPasteCapture=\{rejectUnsupportedImageInput\}/);
  assert.match(
    assets,
    /SAFE_IMAGE_TYPES = new Set\(\["image\/png", "image\/jpeg", "image\/webp"\]\)/,
  );
  assert.match(assets, /whiteboardImageFilesAreSupported/);
});

test("whiteboard entry image has locked image2 provenance and resize-only output", async () => {
  const assetUrl = new URL("../assets/images/generated-icons/whiteboard.png", import.meta.url);
  const [assetBytes, manifestText] = await Promise.all([
    readFile(assetUrl),
    read("assets/images/generated-icons/whiteboard.source.json")
  ]);
  const manifest = JSON.parse(manifestText);
  const metadata = await sharp(assetBytes).metadata();
  const sha256 = createHash("sha256").update(assetBytes).digest("hex");

  assert.equal(manifest.asset, "assets/images/generated-icons/whiteboard.png");
  assert.equal(manifest.generator, "image2");
  assert.deepEqual(manifest.generatedOutput, { width: 256, height: 256, format: "png" });
  assert.deepEqual(
    {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      channels: metadata.channels,
      hasAlpha: metadata.hasAlpha,
      sha256
    },
    manifest.publishedOutput
  );
  assert.equal(manifest.postProcessing.mechanicalResizeOnly, true);
  assert.equal(manifest.postProcessing.codeDrawnOrComposited, false);
  assert.deepEqual(manifest.postProcessing.operations, [{
    operation: "resize",
    from: { width: 256, height: 256 },
    to: { width: 192, height: 192 },
    kernel: "nearest"
  }]);
});

test("admin governance discovers live connection targets without exposing them publicly", async () => {
  const [worker, admin] = await Promise.all([
    read("workers/whiteboard/src/index.ts"),
    read("admin/admin.js")
  ]);
  assert.match(worker, /connections: this\.adminConnectionDetails\(\)/);
  assert.match(worker, /connectionId: attachment\.connectionId/);
  assert.match(worker, /anonymousId: attachment\.anonymousId/);
  assert.match(worker, /ipHash: attachment\.ipHash/);
  assert.match(admin, /function createWhiteboardConnectionList/);
  assert.match(admin, /submitWhiteboardConnectionAction\("?/);
  assert.match(admin, /maskWhiteboardTarget\(connection\.connectionId\)/);
});
