import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homeContent } from "../js/data/home-content.mjs";
import { openIsolatedKittens } from "./helpers/kittens-browser.mjs";

const latestUpdate = homeContent.updates[0];
const whiteboardVersion = readFileSync(new URL("../docs/whiteboard/VERSION", import.meta.url), "utf8").trim();
const transferVersion = readFileSync(new URL("../docs/transfer/VERSION", import.meta.url), "utf8").trim();

test("local Home reflects the candidate update and Tools retains governed versions", async t => {
 const { evaluate } = await openIsolatedKittens(t,{root:".",path:"?lang=zh",initScript:"localStorage.setItem('lusu-site-language', 'zh')",ready:`!!document.querySelector('#recent-updates [data-article-slug="${latestUpdate.slug}"]')`});
 assert.ok(await evaluate(`document.querySelector('#recent-updates').textContent.includes(${JSON.stringify(latestUpdate.title.zh)})`));
 await evaluate("location.hash='resources'");
 for(let i=0;i<50;i++) { if(await evaluate(`document.body.textContent.includes('v${whiteboardVersion}')`)) break;await new Promise(r=>setTimeout(r,100)); }
 assert.ok(await evaluate(`document.body.textContent.includes('v${whiteboardVersion}')`));
 assert.ok(await evaluate(`document.body.textContent.includes('v${transferVersion}')`));
});
