import test from "node:test";
import assert from "node:assert/strict";
import { openIsolatedKittens } from "./helpers/kittens-browser.mjs";

for (const lang of ["zh", "en", "ja"]) test(`integrated whiteboard lobby ${lang} keeps help and narrow layouts usable`, async t => {
 const {evaluate,send}=await openIsolatedKittens(t,{root:"dist",path:`tools/whiteboard/index.html?lang=${lang}`,ready:"!!document.querySelector('.room-help-toggle')"});
 for(const [width,height] of [[359,500],[375,667],[390,844],[844,390]]) {
  await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});
  await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  const box=await evaluate(`(()=>{const b=document.querySelector('.room-help-toggle'),r=b.getBoundingClientRect();return {width:r.width,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth+1,version:document.body.textContent.includes('1.0.11')};})()`);
  assert.ok(box.version);assert.ok(box.width>=44&&box.height>=44);assert.equal(box.overflow,false,`${lang} ${width}x${height}`);
 }
 await evaluate("document.querySelector('.room-help-toggle').focus()");
 await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
 assert.equal(await evaluate("document.querySelector('.room-help-toggle').getAttribute('aria-expanded')"),"false");
});
