const TAU = Math.PI * 2;

function sample(count, fn) {
  const points = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const t = (i * 0.61803398875) % 1;
    const [x, y] = fn(t, i);
    points[i * 2] = x;
    points[i * 2 + 1] = y;
  }
  return points;
}

export function bend(x, phase) {
  const tail = Math.max(0, (1 - x) * 0.5);
  return tail * tail * 0.34 * Math.sin(phase + x * 2.8);
}

export const fish = sample(384, (t, i) => {
  const a = TAU * t;
  if (i % 5 === 0) return [-0.62 - 0.52 * t, (i % 2 ? 1 : -1) * (0.04 + 0.34 * t)];
  if (i % 9 === 0) return [0.18 - 0.36 * t, (i % 2 ? 1 : -1) * (.21 + .23 * t)];
  const r = Math.sqrt(((i + .5) * .41421356) % 1);
  return [0.11 + .87 * r * Math.cos(a), r * Math.sin(a) * (.25 + .09 * Math.cos(a))];
});

export const reeds = sample(80, (t, i) => {
  const blade = (i % 5 - 2) * 0.32;
  return [blade * t * t + 0.08 * Math.sin(3 * t), -t * (1 - 0.38 * Math.abs(blade))];
});

// Oblique disc: missing sector, two cut edges and a few radial veins.
export const lilyPad = sample(192, (t, i) => {
  let a = 0.4 + (TAU - 0.8) * t;
  let r = 1 - 0.04 * Math.cos(5 * a);
  if (i % 5 === 1) {
    a = i % 2 ? 0.4 : -0.4;
    r = t;
  } else if (i % 4 === 2) {
    a = 0.65 + (i % 7) * 0.81;
    r = 0.15 + 0.72 * t;
  }
  if (i % 3 === 0) r *= Math.sqrt(((i + .5) * .41421356) % 1);
  return [r * Math.cos(a), 0.59 * r * Math.sin(a)];
});

// Pond blossom: tilted, top-down double corolla with a seed head.
export const lotusBloom = sample(192, (t, i) => {
  const a = TAU * t;
  const r = i % 7 === 0 ? 0.16 : i % 3 === 0
    ? 0.45 + 0.14 * Math.cos(6 * a)
    : 0.71 + 0.24 * Math.cos(8 * a + 0.4);
  return [r * Math.cos(a), 0.74 * r * Math.sin(a) - 0.14 * r];
});

// Fallen leaves and ice crystals on the water are separate point fields
// (never reuse the slider's identification marks in the scenery).
export const fallenLeaf = sample(192, (t, i) => {
  const a = TAU * t;
  const r = (.28 + .63 * (1 - Math.abs(Math.sin(3.5 * a)))) * Math.sqrt(((i + 1) * .4142) % 1);
  return [r * Math.sin(a), .76 * r * Math.cos(a)];
});
export const frost = sample(192, (t, i) => {
  const twig = i % 3;
  return [t * 1.4 - .7, -.32 * t + (twig ? (i % 2 ? 1 : -1) * (t % .25) : 0)];
});

const maple = [
  [0, -1], [.16, -.49], [.36, -.66], [.3, -.19], [.75, -.47],
  [.69, -.19], [1, -.18], [.64, .11], [.78, .22], [.23, .42],
  [.32, .55], [.05, .52], [0, .98], [-.05, .52], [-.32, .55],
  [-.23, .42], [-.78, .22], [-.64, .11], [-1, -.18], [-.69, -.19],
  [-.75, -.47], [-.3, -.19], [-.36, -.66], [-.16, -.49]
];

function outline(t, vertices) {
  const p = t * vertices.length;
  const k = Math.floor(p);
  const a = vertices[k];
  const b = vertices[(k + 1) % vertices.length];
  return [a[0] + (b[0] - a[0]) * (p - k), a[1] + (b[1] - a[1]) * (p - k)];
}

// Only the slider samples .mark. All four arrays use the same index domain.
export const seasons = [
  {
    colors: [0xbc989f, 0x76aa92, 0xbaccc3, 0xe9c1ce],
    mark: sample(64, t => {
      const a = TAU * t;
      const lobe = (1 + Math.cos(5 * a)) / 2;
      const r = 0.39 + 0.65 * lobe - 0.19 * lobe ** 12;
      return [r * Math.cos(a), r * Math.sin(a)];
    })
  },
  {
    colors: [0x9dbfc5, 0x77b596, 0xc0e3d9, 0xe9c6cc],
    // Side-view lotus: five pointed petals opening from a common base.
    mark: sample(64, (t, i) => {
      const s = (i % 5 - 2) / 2;
      const u = (1 - Math.cos(TAU * t)) / 2;
      return [0.97 * s * u + 0.21 * Math.sin(TAU * t),
        0.53 - (1.48 - 0.62 * Math.abs(s)) * u];
    })
  },
  {
    colors: [0xc39a74, 0x9a8865, 0xdbc09a, 0xe4a569],
    mark: sample(64, t => outline(t, maple))
  },
  {
    colors: [0xb4cddc, 0x768b95, 0xc1cfdf, 0xd5eaf6],
    mark: sample(64, (t, i) => {
      const a = (i % 6) * TAU / 6;
      const twig = Math.floor(i / 6) % 3;
      const u = twig ? 0.52 + 0.24 * t : t;
      const v = twig ? (twig === 1 ? 1 : -1) * 0.27 * t : 0;
      return [u * Math.cos(a) - v * Math.sin(a), u * Math.sin(a) + v * Math.cos(a)];
    })
  }
];

export function mixColor(a, b, f) {
  const channel = shift => {
    const x = (a >> shift) & 255;
    return Math.round(x + (((b >> shift) & 255) - x) * f);
  };
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}
