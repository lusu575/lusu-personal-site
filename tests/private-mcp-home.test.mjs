import test from "node:test";
import assert from "node:assert/strict";
import { openIsolatedKittens } from "./helpers/kittens-browser.mjs";

test("local Home reflects the candidate update and Tools retains governed versions", async t => {
 const { evaluate } = await openIsolatedKittens(t,{root:".",initScript:"localStorage.setItem('lusu-site-language', 'zh')",ready:"document.querySelector('#recent-updates')?.children.length > 0"});
 assert.equal(await evaluate("document.querySelector('#top-updated').getAttribute('datetime')"),"2026-10-29");
 assert.ok(await evaluate("document.querySelector('#recent-updates').textContent.includes('画板')"));
 await evaluate("location.hash='resources'");
 for(let i=0;i<50;i++) { if(await evaluate("document.body.textContent.includes('v1.0.11')")) break;await new Promise(r=>setTimeout(r,100)); }
 assert.ok(await evaluate("document.body.textContent.includes('v1.0.11')"));
 assert.ok(await evaluate("document.body.textContent.includes('v1.0.15')"));
});
