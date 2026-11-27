import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const indexHtml = await readFile(new URL("index.html", root), "utf8");
const mobileCss = await readFile(new URL("css/mobile-ios-shell.css", root), "utf8");
const bootstrapMatch = indexHtml.match(/<script>\s*(\(\(\) => \{[\s\S]*?dataset\.wallpaperPreload[\s\S]*?\}\)\(\);)\s*<\/script>/);

assert.ok(bootstrapMatch, "the early wallpaper preload bootstrap must remain inline in index.html");
const bootstrapSource = bootstrapMatch[1];

function runBootstrap({ width, mobile = false, reduced = false, saveData = false, theme = "day" }) {
  const appended = [];
  const documentElement = { dataset: {}, lang: "" };
  const context = {
    Date,
    URLSearchParams,
    document: {
      documentElement,
      createElement: () => ({ dataset: {} }),
      head: { appendChild: (node) => appended.push(node) }
    },
    navigator: { connection: { saveData } },
    window: {
      innerWidth: width,
      location: { search: `?wallpaper=${theme}` },
      matchMedia: (query) => ({
        matches: query.includes("prefers-reduced-motion") ? reduced : mobile
      })
    }
  };
  vm.runInNewContext(bootstrapSource, context);
  assert.equal(appended.length, 1);
  return appended[0];
}

test("desktop wallpaper preload selects the exact CSS AVIF family and width", () => {
  // Desktop intentionally migrated to the WebGL Pond desktop (data-pond-mode) and no longer
  // preloads legacy desktop AVIF wallpapers; mobile still preloads its versioned WebP wallpaper.
  assert.match(bootstrapSource, /document\.documentElement\.dataset\.motion\s*=\s*reducedMotion\s*\?\s*"reduced"\s*:\s*"full"/);
  assert.match(bootstrapSource, /document\.documentElement\.dataset\.pondMode\s*=\s*initialPondMode/);

  const runDesktopBootstrap = ({ width = 1280, reduced = false, hash = "" } = {}) => {
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
        location: { search: "?time-theme=day", pathname: "/", hash },
        matchMedia(query) {
          if (query.includes("prefers-reduced-motion")) return { matches: reduced };
          return { matches: false };
        }
      },
      document: {
        documentElement: { dataset },
        head: { appendChild(node) { appended.push(node); } },
        createElement(tag) { return { tagName: tag.toUpperCase(), dataset: {} }; }
      }
    };
    vm.runInNewContext(bootstrapSource, context);
    return { dataset, appended };
  };

  const home = runDesktopBootstrap({ width: 1280, reduced: false });
  assert.equal(home.dataset.motion, "full");
  assert.equal(home.dataset.pondMode, "home");
  assert.equal(home.appended.length, 0, "desktop pond mode must not inject deprecated AVIF wallpaper preloads");

  const reduced = runDesktopBootstrap({ width: 1600, reduced: true, hash: "#knowledge" });
  assert.equal(reduced.dataset.motion, "reduced");
  assert.equal(reduced.dataset.pondMode, "knowledge");
  assert.equal(reduced.appended.length, 0);
});

test("mobile wallpaper preload exactly matches the versioned CSS resource", () => {
  const preload = runBootstrap({ width: 390, mobile: true });
  const expected = "/assets/images/mobile-wallpapers/day.webp?v=20260711-calm-motion-r13";
  assert.equal(preload.type, "image/webp");
  assert.equal(preload.href, expected);
  assert.equal(preload.dataset.wallpaperPreload, "day:mobile");
  assert.equal(preload.imageSrcset, undefined);
  assert.equal(preload.imageSizes, undefined);
  assert.match(
    mobileCss,
    /--mobile-wallpaper:\s*url\("\.\.\/assets\/images\/mobile-wallpapers\/day\.webp\?v=20260711-calm-motion-r13"\)/
  );
});
