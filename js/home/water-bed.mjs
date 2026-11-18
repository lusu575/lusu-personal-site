// Stationary interference on the pond floor. Paint only on resize/quality
// changes; the translucent marks pick up the seasonal water colour below.
export function paintBed(canvas, width, height, tier) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const scale = Math.min(1, 1100 / width, 780 / height);
  const w = canvas.width = Math.max(1, Math.round(width * scale));
  const h = canvas.height = Math.max(1, Math.round(height * scale));
  const steps = [185, 149, 115, 85][tier];
  const rows = Math.min(steps, Math.round(steps * h / w));
  const unit = w / steps;
  let seed = 21;
  const noise = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  ctx.fillStyle = '#d6ead4';
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < steps; i++) {
      const x = (i + noise()) / steps, y = (j + noise() * .42) / rows;
      const u = x - .5, v = y - .5;
      const pool = Math.max(.07, 1 - 2.8 * (u * u + v * v));
      const swell = Math.sin(x * 23 + y * 15 + 1.6 * Math.sin(y * 19)) * .026;
      const crest = Math.max(0, Math.sin(107 * (y + swell) + Math.sin(x * 37))) ** 5;
      ctx.globalAlpha = pool * (.035 + noise() * .09 + .38 * crest);
      ctx.fillRect((x - .04 * u * v * v) * w, (y + swell * .22 - .04 * v * u * u) * h,
        Math.max(1, unit * (.23 + .91 * crest)), .65 + noise() * .7);
    }
  }
  // Interrupted, nested reflections around the light well and distant pads.
  // These are still, submerged marks. Live wave crests pass over them.
  for (const [cx, cy, span, light] of [[.48,.56,.24,1],[.18,.42,.12,.55],[.79,.69,.15,.7],[.92,.16,.08,.3]]) {
    for (let band = 1; band < 8; band++) {
      const n = Math.ceil(steps * (.48 + band * .17));
      for (let i = 0; i < n; i++) {
        const a = (i + noise() * .42) * 2 * Math.PI / n;
        const crest = Math.max(0, Math.cos(a * 3 + band * .75));
        if (noise() > .32 + crest * .62) continue;
        const r = span * (.15 + band * .12) * (1 + .04 * Math.sin(a * 5 + band));
        ctx.globalAlpha = (.08 + crest * .30) * light;
        ctx.fillRect(w * (cx + Math.cos(a) * r), h * cy + w * r * Math.sin(a) * .24,
          1 + 1.5 * crest, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}
