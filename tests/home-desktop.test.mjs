import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, readdir} from 'node:fs/promises';
import { openIsolatedKittens } from './helpers/kittens-browser.mjs';

const routes = ['knowledge', 'videos', 'resources', 'games', 'chatroom', 'about'];

test('pond art ships as code, with no bitmap, external SVG or video references', async () => {
  const root = new URL('../', import.meta.url);
  const html = await readFile(new URL('index.html', root), 'utf8');
  const home = html.match(/<section\b[^>]*id="home"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(home, /<(?:img|image|video|picture)\b/i);
  assert.equal((home.match(/<svg class="pond-glyph"/g) || []).length, 6);
  const dir = new URL('js/home/', root);
  for (const file of [new URL('css/home-crt.css', root), ...(await readdir(dir)).map(name => new URL(name, dir))]) {
    assert.match(file.pathname, /\.(?:css|mjs)$/);
    assert.doesNotMatch(await readFile(file, 'utf8'), /data:image\/|\.(?:jpe?g|png|webp|avif|gif|svg|mp4|webm)\b/i);
  }
});

test('the six real pond buttons open from and close to their own rectangles', async t => {
  const { evaluate, send } = await openIsolatedKittens(t, {
    root: '.', path: '?lang=zh',
    // This scenario exercises full desktop motion, also on two-vCPU CI hosts.
    initScript: `Object.defineProperty(navigator,'hardwareConcurrency',{value:8});
      Object.defineProperty(navigator,'deviceMemory',{value:8});`,
    ready: '!!window.__pondDebug && !document.querySelector(".pond-boot-layer")'
  });
  await evaluate(`window.pairs=[]; const animate=Element.prototype.animate;
      Element.prototype.animate=function(frames,options){
        if(this.matches('.xp-window') && [320,260].includes(options?.duration)) {
          const rect=this.getBoundingClientRect();
          const frame=options.duration===320?frames[0]:frames.at(-1);
          const m=new DOMMatrix(frame.transform);
          pairs.push([rect.x+m.e,rect.y+m.f,rect.width*m.a,rect.height*m.d]);
        }
        return animate.call(this,frames,options);
      };`);
  const click = async (selector) => {
    const {x, y} = await evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    }
  };
  const wait = expression => evaluate(`new Promise((ok,fail)=>{const start=performance.now(); function probe(){if(${expression}) ok(true); else if(performance.now()-start>3500) fail(Error('unsettled route')); else requestAnimationFrame(probe);} probe();})`);
  await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false});
  await wait('innerWidth === 1280');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#home .desktop-icon:has(svg.pond-glyph)')].map(b=>b.dataset.route)`), routes);
  const images = await evaluate(`performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>/\\.(png|avif|webp|jpg|jpeg|gif|svg|mp4)$/i.test(p))`);
  assert.deepEqual(images, [], 'cold pond has no picture or movie requests');
  const geometry = await evaluate(`[...document.querySelectorAll('#home .desktop-icon')].map(b=>b.getBoundingClientRect().y)`);
  assert.equal(new Set(geometry).size, 6);
  for (const route of routes) {
    const icon = `#home .desktop-icon[data-route="${route}"]`;
    const expected = await evaluate(`(()=>{const r=document.querySelector('${icon}').getBoundingClientRect();pairs.length=0;return [r.x,r.y,r.width,r.height];})()`);
    await click(icon);
    assert.equal(await evaluate('document.querySelector(".page.active").id'), route);
    const matchesIcon = rect => rect?.every((n,i) => Math.abs(n-expected[i]) < 1);
    assert.ok(matchesIcon(await evaluate('pairs[0]')), `${route} opens from its icon`);
    await wait('!document.documentElement.dataset.uiTransition');
    await click(`#${route} .close-button`);
    assert.ok(matchesIcon(await evaluate('pairs[1]')), `${route} closes to the same icon after lazy layout`);
    await wait(`document.activeElement.matches('${icon}')`);
  }
  assert.equal(await evaluate(`!!document.querySelector('.pond-boot-layer,.pond-launch-echo')`), false);
  for (const [width,height] of [[359,500],[375,667],[390,844],[844,390]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await evaluate('new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)))');
    assert.equal(await evaluate(`(() => {const rs=[...document.querySelectorAll('#home .desktop-icon')].map(b=>b.getBoundingClientRect());return rs.every((r,i)=>r.width>=44 && r.height>=44 && r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight && !rs.slice(i+1).some(s=>s.left<r.right && s.right>r.left && s.top<r.bottom && s.bottom>r.top));})()`), true, `${width}x${height}`);
  }
});
