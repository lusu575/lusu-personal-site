import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import sharp from "sharp";
import { resourcesContent } from "../js/data/resources-content.mjs";

const iconPath = new URL("../assets/images/generated-icons/minimax-h3.png", import.meta.url);
const manifestPath = new URL("../assets/images/generated-icons/minimax-h3.source.json", import.meta.url);
const consolePath = new URL("../admin/minimax-h3.html", import.meta.url);
const consoleScriptPath = new URL("../admin/minimax-h3.js", import.meta.url);
const adminIndexPath = new URL("../admin/index.html", import.meta.url);
const resourcesRoutePath = new URL("../js/routes/resources.mjs", import.meta.url);

test("Tools keeps the protected Online ComfyUI MiniMax H3 entry out of the public card list", () => {
  const resource = resourcesContent.resources.find((item) => item.toolId === "minimax-h3");
  assert.ok(resource);
  assert.equal(resource.external, false);
  assert.equal(resource.showInTools, false);
  assert.equal(resource.url, "/admin/minimax-h3.html?from=tools");
  assert.match(resource.iconSrc, /^assets\/images\/generated-icons\/minimax-h3\.png\?v=/);
  assert.match(resource.iconDataUrl, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
  assert.equal(resource.title.zh, "在线 ComfyUI · MiniMax H3");
  assert.equal(resource.title.en, "Online ComfyUI · MiniMax H3");
  assert.equal(resource.title.ja, "オンライン ComfyUI · MiniMax H3");
  assert.match(resource.desc.zh, /Runner/);
  assert.ok(resource.tags.some((tag) => tag.zh === "站长专用"));
});

test("Tools keeps the exact protected MiniMax H3 console path available to the route policy", async () => {
  const source = await readFile(resourcesRoutePath, "utf8");
  assert.match(source, /admin\/minimax-h3\.html/);
  assert.match(source, /function safeInlineResourceIconSrc/);
  assert.match(source, /safeInlineResourceIconSrc\(item\) \|\| safeResourceIconSrc\(item\.iconSrc\)/);
  assert.match(source, /item\.toolId === "minimax-h3" \? "eager" : "lazy"/);
  assert.match(source, /return content\.resources[\s\S]*\.filter\(\(item\) => item\.showInTools !== false\)[\s\S]*\.filter\(\(item\) => safeResourceUrl\(item\) \|\| item\.action === "quick-transfer"\)/);
});

test("MiniMax H3 icon is an image2-generated transparent RGBA raster", async () => {
  const bytes = await readFile(iconPath);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 192);
  assert.equal(metadata.height, 192);
  assert.equal(metadata.channels, 4);
  assert.equal(metadata.hasAlpha, true);

  const raw = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => raw.data[(y * raw.info.width + x) * 4 + 3];
  assert.deepEqual([alphaAt(0, 0), alphaAt(191, 0), alphaAt(0, 191), alphaAt(191, 191)], [0, 0, 0, 0]);
  assert.ok([...raw.data].some((value, index) => index % 4 === 3 && value > 0));

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.generator, "image2");
  assert.equal(manifest.postProcessing.codeDrawnOrComposited, false);
  assert.equal(manifest.publishedOutput.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.ok(manifest.postProcessing.operations.some((operation) => operation.operation === "chroma-key-removal"));
  assert.ok(manifest.postProcessing.operations.some((operation) => operation.operation === "resize" && operation.kernel === "nearest"));
});

test("MiniMax H3 console keeps the protected status-shell boundary", async () => {
  const html = await readFile(consolePath, "utf8");
  assert.match(html, /\/admin\/minimax-h3\.css\?v=/);
  assert.match(html, /\/admin\/minimax-h3\.js\?v=/);
  assert.match(html, /127\.0\.0\.1:8188/);
  assert.match(html, /127\.0\.0\.1:8791/);
  assert.match(html, /受保护的站长控制台/);
  assert.doesNotMatch(html, /<iframe\b/i);
  assert.doesNotMatch(html, /<form[^>]+action=/i);
});

test("MiniMax H3 returns to the entry surface that opened it", async () => {
  const [html, script, adminIndex] = await Promise.all([
    readFile(consolePath, "utf8"),
    readFile(consoleScriptPath, "utf8"),
    readFile(adminIndexPath, "utf8"),
  ]);
  assert.match(html, /data-h3-back/);
  assert.match(adminIndex, /minimax-h3\.html\?from=admin/);
  assert.match(script, /requestedSource === "admin" \|\| requestedSource === "tools"/);
  assert.match(script, /backLink\.href = "\/admin\/"/);
  assert.match(script, /backLink\.href = "\/#resources"/);
});
