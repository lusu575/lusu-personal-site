import assert from 'node:assert/strict';
import test from 'node:test';
import { createPond, quality } from '../js/home/pond.mjs';
import { createFrameRaster, packedColour } from '../js/home/frame-raster.mjs';
import { createWaterBed } from '../js/home/water-bed.mjs';
import { fish, lilyPad, fallenLeaf, frost, seasons } from '../js/home/point-sets.mjs';

// Compare actual canvas writes in a quiet summer frame, not estimates from the table.
test('every tier reduces particle work, caps backing pixels and retains tap feedback', t => {
  globalThis.window = {devicePixelRatio: 3};
  t.after(() => { delete globalThis.window; });
  let points = 0;
  const ctx = {setTransform() {}, clearRect() {}, fillRect(...args) {
    assert.ok(args.every(Number.isFinite)); points++;
  }};
  let previous = Infinity;
  for (const [tier, budget] of quality.entries()) {
    const canvas = {getContext: () => ctx};
    const pond = createPond(canvas);
    pond.resize(1800, 1100, tier, false);
    assert.ok(canvas.width * canvas.height <= budget[9]);
    assert.ok(pond.dpr <= budget[8]);
    points = 0;
    const summer = pond.draw(0);
    assert.equal(points, summer + Number(tier < 2), 'one refresh line outside particle count');
    assert.ok(summer < previous && summer > 100);
    previous = summer;
    const idle = createPond({getContext: () => ctx});
    idle.resize(1800, 1100, tier, false);
    pond.ripple(.3,.4);
    assert.ok(pond.draw(.12) > idle.draw(.12), 'tap adds rings on top of the same ambient phase');
    for (let i=0; i<80; i++) {
      pond.draw(.016);
      idle.draw(.016);
    }
    assert.equal(pond.draw(0), idle.draw(0), 'interactive rings decay back to the ambient surface');
    pond.setSeason(3);
    assert.ok(pond.draw(0) < summer, 'winter retains a single submerged fish');
  }
});

test('the four procedural plates share a bounded cache and release their backing stores', () => {
  let writes = 0;
  const makeCanvas = () => {
    const canvas = {getContext(type, options) {
      assert.equal(type, '2d');
      assert.equal(options.alpha, false);
      return {
        createImageData: (w,h) => ({data: new Uint8ClampedArray(w*h*4)}),
        putImageData(image) { writes++; canvas.pixels = image.data; }
      };
    }};
    return canvas;
  };
  const bed = createWaterBed(makeCanvas);
  bed.resize(240, 160);
  const plates = [0,1,2,3].map(s => bed.plate(s));
  bed.resize(240, 160);
  for (const [s, plate] of plates.entries()) {
    assert.equal(bed.plate(s), plate);
    assert.equal(plate.pixels.length, 240*160*4);
    assert.ok(plate.pixels.every((x,i) => i%4 !== 3 || x === 255));
    if (s > 0) assert.notDeepEqual(plate.pixels, plates[s-1].pixels);
  }
  assert.equal(writes, 4, 'unchanged size and season never repaint a plate');
  bed.resize(256, 160);
  assert.ok(plates.every(c => c.width === 1 && c.height === 1));
  const next = bed.plate(1);
  assert.equal(next.width, 256);
  bed.clear();
  assert.equal(next.width, 1);
});

test('the live raster uploads once, leaves cached ink immutable, and resumes a diagonal seasonal sweep', () => {
  let uploaded, writes=0;
  const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    putImageData(img){uploaded=new Uint32Array(img.data.buffer).slice(); writes++;}};
  const base=Array.from({length:4},(_,i)=>new Uint32Array(64*32).fill(packedColour(i*0x405030,i*0x405030,0)));
  const raster=createFrameRaster(ctx,{resize(){},pixels:s=>base[s]});
  raster.resize(64,32,64,32);
  raster.begin(1,1); raster.fillStyle=packedColour(0xffffff,0xffffff,0);
  raster.fillRect(5,6,2,2); raster.end();
  assert.equal(writes,1); assert.equal(uploaded[6*64+5],0xffffffff);
  assert.notEqual(base[1][6*64+5],0xffffffff);
  raster.begin(3,.5); raster.end();
  assert.equal(uploaded[63],base[3][63]); assert.equal(uploaded[31*64],base[1][0]);
  const middle=uploaded; raster.begin(0,0); raster.end(); assert.deepEqual(uploaded,middle);
  raster.begin(0,.7); raster.end(); raster.begin(0,1); raster.end();
  assert.deepEqual(uploaded,base[0]); assert.equal(writes,5);
});

test('season marks morph point-for-point and flora stays separate from slider glyphs', () => {
  assert.equal(seasons.length, 4);
  assert.equal(new Set(seasons.map(s => String(s.mark))).size, 4);
  for (const q of quality) {
    assert.ok(fish.length >= q[2]*2);
    for (const {mark} of seasons) assert.ok(mark.length >= q[5]*2 && mark.every(Number.isFinite));
    for (const points of [lilyPad, fallenLeaf, frost]) assert.ok(points.length >= q[5]*6 && points.every(Number.isFinite));
  }
});
