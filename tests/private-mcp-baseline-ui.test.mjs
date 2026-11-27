import test, { before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildProduction } from "../scripts/build-production.mjs";
let productionBuild;
import { openIsolatedKittens } from "./helpers/kittens-browser.mjs";

const whiteboardVersion = readFileSync(new URL("../docs/whiteboard/VERSION", import.meta.url), "utf8").trim();

before(async () => {
 await (productionBuild ??= buildProduction());
});

for (const lang of ["zh", "en", "ja"]) test(`integrated whiteboard lobby ${lang} keeps help and narrow layouts usable`, async t => {
 await (productionBuild ??= buildProduction());
 const {evaluate,send}=await openIsolatedKittens(t,{root:"dist",path:`tools/whiteboard/index.html?lang=${lang}`,ready:"document.readyState === 'complete' && !!document.querySelector('.room-help-toggle')"});
 for(const [width,height] of [[359,500],[375,667],[390,844],[844,390]]) {
  await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});
  await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  const box=await evaluate(`(()=>{const b=document.querySelector('.room-help-toggle'),r=b.getBoundingClientRect();return {width:r.width,height:r.height,scrollWidth:document.documentElement.scrollWidth,innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,version:document.body.textContent.includes(${JSON.stringify(whiteboardVersion)})};})()`);
  assert.ok(box.version, `${lang} ${width}x${height} missing version ${whiteboardVersion}`);
  assert.ok(box.width>=44&&box.height>=44, `${lang} ${width}x${height} help toggle too small: ${JSON.stringify(box)}`);
  assert.equal(box.overflow,false,`${lang} ${width}x${height} overflow: ${JSON.stringify(box)}`);
 }
 await evaluate("document.querySelector('.room-help-toggle').focus()");
 await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
 assert.equal(await evaluate("document.querySelector('.room-help-toggle').getAttribute('aria-expanded')"),"false");
});
