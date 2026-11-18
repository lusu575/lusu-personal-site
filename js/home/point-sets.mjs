const TAU = 2 * Math.PI;

// Interleaved xy pairs. The golden-ratio sequence makes a shorter prefix
// a lower-density version of the whole shape, not a cropped shape.
function sample(count, fn) {
  const points = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const t = (i * 0.61803398875) % 1;
    const [x, y] = fn(t, i);
    points[2 * i] = x;
    points[2 * i + 1] = y;
  }
  return points;
}

export function bend(x, phase) {
  const tail = Math.max(0, (1 - x) * 0.5);
  return tail * tail * 0.34 * Math.sin(phase + x * 2.8);
}

export const fish = sample(96, (t, i) => {
  const a = TAU * t;
  if (i % 5 === 0) {
    const side = i % 2 ? 1 : -1;
    return [-0.62 - 0.52 * t, side * (0.04 + 0.34 * t)];
  }
  if (i % 9 === 0) return [0.64 + 0.05 * Math.cos(a), -0.1 + 0.05 * Math.sin(a)];
  return [0.14 + 0.82 * Math.cos(a), Math.sin(a) * (0.23 + 0.07 * Math.cos(a))];
});

export const reeds = sample(80, (t, i) => {
  const blade = (i % 5 - 2) * 0.32;
  return [blade * t * t + 0.08 * Math.sin(3 * t), -t * (1 - 0.38 * Math.abs(blade))];
});

function flower(t, petals) {
  const a = TAU * t;
  const r = 0.62 + 0.28 * Math.cos(petals * a);
  return [r * Math.cos(a), r * Math.sin(a)];
}

// Same point count and ordering across seasons: lerp corresponding points.
// Palette roles: suspended sediment, vegetation, fish, surface accent.
export const seasons = [
  {
    colors: [0x788f90, 0x76aa92, 0xbaccc3, 0xe4b7c3],
    mark: sample(64, t => flower(t, 5))
  },
  {
    colors: [0x779aab, 0x578f84, 0xb2d9cf, 0x9ed6ad],
    mark: sample(64, t => {
      const a = 0.22 + (TAU - 0.44) * t;
      return [Math.cos(a), 0.65 * Math.sin(a)];
    })
  },
  {
    colors: [0x998b77, 0x9a8865, 0xdbc09a, 0xe4a569],
    mark: sample(64, t => [2 * t - 1, 0.52 * Math.sin(Math.PI * t) * (t < 0.5 ? 1 : -1)])
  },
  {
    colors: [0x899dad, 0x768b95, 0xc1cfdf, 0xd5eaf6],
    mark: sample(64, (t, i) => {
      const a = (i % 6) * TAU / 6;
      return [t * Math.cos(a), t * Math.sin(a)];
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
