import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const indexHtml = await readFile(new URL("index.html", root), "utf8");
const mobileCss = await readFile(new URL("css/mobile-ios-shell.css", root), "utf8");
const bootstrapMatch = indexHtml.match(/<script>\s*(\(\(\) => \{[\s\S]*?dataset\.pondMode\s*=\s*initialPondMode[\s\S]*?\}\)\(\);)\s*<\/script>/);

assert.ok(bootstrapMatch, "the early Pond mode bootstrap must remain inline in index.html");
const bootstrapSource = bootstrapMatch[1];

function runBootstrap({ width = 1280, mobile = false, reduced = false, hash = "", theme = "day" } = {}) {
  const appended = [];
  const dataset = {};
  const context = {
    Date,
    Math,
    Number,
    URLSearchParams,
    navigator: { connection: { saveData: false } },
    localStorage: { getItem() { return null; }, removeItem() {} },
    window: {
      innerWidth: width,
      location: { search: `?wallpaper=${theme}`, pathname: "/", hash },
      matchMedia(query) {
        if (query.includes("prefers-reduced-motion")) return { matches: reduced };
        return { matches: mobile };
      }
    },
    document: {
      documentElement: { dataset, lang: "" },
      head: { appendChild(node) { appended.push(node); } },
      createElement(tag) { return { tagName: tag.toUpperCase(), dataset: {} }; }
    }
  };
  vm.runInNewContext(bootstrapSource, context);
  return { dataset, appended };
}

test("desktop and mobile bootstrap unconditionally activate Pond mode with zero legacy wallpaper preload", () => {
  assert.match(bootstrapSource, /document\.documentElement\.dataset\.motion\s*=\s*reducedMotion\s*\?\s*"reduced"\s*:\s*"full"/);
  assert.match(bootstrapSource, /document\.documentElement\.dataset\.pondMode\s*=\s*initialPondMode/);

  const home = runBootstrap({ width: 1280, mobile: false, reduced: false });
  assert.equal(home.dataset.motion, "full");
  assert.equal(home.dataset.pondMode, "home");
  assert.equal(home.appended.length, 0, "desktop pond mode must not inject deprecated AVIF wallpaper preloads");

  const reduced = runBootstrap({ width: 1600, mobile: false, reduced: true, hash: "#knowledge" });
  assert.equal(reduced.dataset.motion, "reduced");
  assert.equal(reduced.dataset.pondMode, "knowledge");
  assert.equal(reduced.appended.length, 0);
});

test("mobile bootstrap activates Pond mode immediately and retires legacy mobile-wallpapers WebP", () => {
  const mobileHome = runBootstrap({ width: 390, mobile: true, reduced: false });
  assert.equal(mobileHome.dataset.pondMode, "home");
  assert.equal(mobileHome.appended.length, 0, "mobile pond mode must not inject deprecated WebP wallpaper preloads");
  assert.doesNotMatch(
    mobileCss,
    /assets\/images\/mobile-wallpapers\//
  );
});
