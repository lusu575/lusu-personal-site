import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const indexHtml = await readFile(new URL("index.html", root), "utf8");
const desktopCss = await readFile(new URL("css/style.css", root), "utf8");
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
  assert.match(bootstrapSource, /document\.documentElement\.dataset\.motion\s*=\s*reducedMotion\s*\?\s*"reduced"\s*:\s*"full"/);
  const dynamic = runBootstrap({ width: 1280 });
  assert.equal(dynamic.type, "image/avif");
  assert.equal(dynamic.href, "/assets/images/wallpaper-dynamic/day/optimized/base-1440.avif");
  assert.equal(dynamic.dataset.wallpaperPreload, "day:desktop:dynamic");
  assert.equal(dynamic.imageSrcset, undefined);
  assert.equal(dynamic.imageSizes, undefined);

  const reduced = runBootstrap({ width: 1600, reduced: true });
  assert.equal(reduced.type, "image/avif");
  assert.equal(reduced.href, "/assets/images/wallpapers/optimized/day-1920.avif");
  assert.equal(reduced.dataset.wallpaperPreload, "day:desktop:static");

  const narrow = runBootstrap({ width: 1280, saveData: true });
  assert.equal(narrow.href, "/assets/images/wallpaper-dynamic/day/optimized/base-960.avif");

  assert.match(
    desktopCss,
    /wallpaper-dynamic\/day\/optimized\/base-1440\.avif[\s\S]*?wallpaper-dynamic\/day\/optimized\/base-1440\.webp/
  );
  assert.match(
    desktopCss,
    /wallpapers\/optimized\/day-1920\.avif[\s\S]*?wallpapers\/optimized\/day-1920\.webp/
  );
  assert.match(
    desktopCss,
    /html\[data-motion="reduced"\]\[data-time-theme="day"\][^{]*\{[^}]*--bootstrap-static-wallpaper:[^}]*wallpapers\/optimized\/day-1440\.avif/
  );
  assert.match(
    desktopCss,
    /html\[data-motion="reduced"\]\s+\.wallpaper-base\s*\{[^}]*background-image:\s*var\(--bootstrap-static-wallpaper\)/
  );
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
