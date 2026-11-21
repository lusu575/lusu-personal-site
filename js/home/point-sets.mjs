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

// A full belly behind the blunt snout, a narrow caudal peduncle, paired
// translucent fins and a bifurcated veil. Prefixes remain usable at low LOD.
function grain(i) {
  // Separate integer noise for the transverse coordinate: using three
  // linear irrational sequences together left diagonal holes in the body.
  let b = Math.imul(i ^ (i >>> 16), 0x45d9f3b);
  b = Math.imul(b ^ (b >>> 16), 0x45d9f3b);
  return ((b ^ (b >>> 16)) >>> 0) / 4294967296;
}
export const fish = sample(1536, (t, i) => {
  const u = grain(i+361), v = grain(i+2049);
  if (i % 5 === 0) {
    const reach = t * t;
    const lobe = i % 2 ? 1 : -1;
    return [-.67 - reach*(.83 - .13*u), lobe * (.022 + reach*(.08 + .18*u)) + (v-.5)*reach*.19];
  }
  if (i % 11 === 1) {
    return [.47 - .68*t, (i%2 ? 1 : -1)*(.15 + .25*Math.sin(Math.PI*t)*u)];
  }
  const girth = (.085 + .265*Math.sin(t*2.12)) * Math.sin(Math.PI*t)**.48;
  return [-.86 + 1.84*t, (v*2 - 1) * girth * (.79 + .23*u)];
});

export const reeds = sample(80, (t, i) => {
  const blade = (i % 5 - 2) * 0.32;
  return [blade * t * t + 0.08 * Math.sin(3 * t), -t * (1 - 0.38 * Math.abs(blade))];
});

// Oblique disc: missing sector, two cut edges and a few radial veins.
export const lilyPad = sample(3584, (t, i) => {
  let a = .28 + (TAU - .56)*t;
  let r = Math.sqrt(grain(i+2711));
  if (i % 13 === 0) r = .98;
  if (i % 13 === 1) {
    a = i % 2 ? .28 : -.28;
    r = t;
  }
  if (i % 13 === 2) {
    a = .32 + (i % 14) * (TAU-.64)/13 + .06*Math.sin(t*3);
    r = t;
  }
  r *= 1 + .025*Math.cos(7*a) + .018*Math.sin(11*a);
  return [r*Math.cos(a), .61*r*Math.sin(a)];
});

// Foreground summer leaves. The cached water bed uses these same anchors
// for their deeper, offset shadows. Radius is relative to the short side.
export const summerPads = [
  [.202,.854,.155,-.26,.97], [.685,.701,.147,.24,.99], [.847,.575,.112,-.20,.89],
  [.143,.385,.088,.19,.86], [.243,.392,.065,-.15,.83]
];

// Pond blossom: tilted, top-down double corolla with a seed head.
export const lotusBloom = sample(192, (t, i) => {
  const a = TAU * t;
  const r = i % 7 === 0 ? 0.16 : i % 3 === 0
    ? 0.45 + 0.14 * Math.cos(6 * a)
    : 0.71 + 0.24 * Math.cos(8 * a + 0.4);
  return [r * Math.cos(a), 0.74 * r * Math.sin(a) - 0.14 * r];
});

// Surface petals and ice crystals use separate point fields from the slider.
export const petal = sample(192, (t, i) => {
  const a = TAU*t, r = i%4 === 0 ? 1 : Math.sqrt(grain(i+735));
  const notch = .25*Math.max(0, -Math.sin(a))**16;
  return [.64*r*Math.cos(a)*(1-.27*Math.sin(a)), r*(Math.sin(a)+notch)];
});
export const frost = sample(768, (t, i) => {
  const a = (i % 6)*TAU/6;
  const twig = (i >> 2)%3, r = twig ? .46 + .32*t : t;
  const v = twig ? (twig === 1 ? 1 : -1)*.30*t : 0;
  return [Math.cos(a)*r - Math.sin(a)*v, Math.sin(a)*r + Math.cos(a)*v];
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

export const fallenLeaf = sample(768, (t, i) => {
  if (i % 9 === 0) return [0, .36 + .76*t];
  const [x,y] = outline(t, maple);
  const r = i % 5 === 0 ? 1 : i % 7 === 0 ? grain(i+120) : Math.sqrt(grain(i+896));
  return [x*r, .36+(y-.36)*r];
});

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
