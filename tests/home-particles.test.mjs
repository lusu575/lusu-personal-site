import assert from 'node:assert/strict';
import test from 'node:test';
import { createPond, quality } from '../js/home/pond.mjs';
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
    pond.ripple(.3,.4);
    assert.ok(pond.draw(.12) > summer);
    for (let i=0; i<80; i++) pond.draw(.016);
    assert.equal(pond.draw(0), summer, 'tap decays without a permanent wave slot');
    pond.setSeason(3);
    assert.ok(pond.draw(0) < summer, 'winter retains a single submerged fish');
  }
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
