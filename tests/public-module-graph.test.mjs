import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validatePublicModuleGraph } from "../scripts/check-public-module-graph.mjs";

async function fixture(t, route) {
  const root = await mkdtemp(join(tmpdir(), "lusu-module-graph-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const folder of ["js/core", "js/data", "js/routes"]) await mkdir(join(root, folder), { recursive: true });
  await writeFile(join(root, "js/main.js"), 'import "./core/i18n.mjs";\nimport "./data/home-content.mjs";');
  await writeFile(join(root, "js/core/i18n.mjs"), "export const labels = {};");
  await writeFile(join(root, "js/data/home-content.mjs"), "export const homeContent = {};");
  await writeFile(join(root, "js/routes/resources.mjs"), route);
  return root;
}

test("module graph understands deferred factories with nested default parameters and brace strings", async (t) => {
  const root = await fixture(t, `
    const text = "emoji 🐈";
    export function createResourcesRoute({ loader = () => import("../data/home-content.mjs"), label = "}" } = {}) {
      const target = document.querySelector("#resources");
      setTimeout(() => fetch("/api/articles"), 10);
      return { target, loader, label, text };
    }
  `);
  assert.deepEqual(validatePublicModuleGraph({ root }).failures, []);
});

test("module graph still rejects actual top-level DOM, network and timer work around factories", async (t) => {
  const root = await fixture(t, `
    document.querySelector("#resources");
    export function createResourcesRoute({ loader = () => import("../data/home-content.mjs") }) {
      return loader;
    }
    fetch("/api/articles");
    setTimeout(() => {}, 100);
  `);
  const failures = validatePublicModuleGraph({ root }).failures;
  assert.ok(failures.some((failure) => failure.includes("top-level DOM query")));
  assert.ok(failures.some((failure) => failure.includes("top-level network request")));
  assert.ok(failures.some((failure) => failure.includes("top-level timer")));
});
