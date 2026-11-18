import { fallenLeaf, lilyPad, lotusBloom, summerPads } from "./point-sets.mjs";

// Retained, opaque pond plates. Everything starts as numbers; no external
// texture, serialization, readback, or per-frame full-screen CSS gradient.
const TAU = 2 * Math.PI;
const clip = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
function random(seed) {
  return () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
}
function palette(stops) {
  const lut = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const p = i / 255 * (stops.length - 1), a = stops[Math.floor(p)], b = stops[Math.ceil(p)];
    const channel = shift => Math.round(((a >> shift) & 255) * (1 - p % 1) + ((b >> shift) & 255) * (p % 1));
    lut[i] = 0xff000000 | channel(16) | channel(8) << 8 | channel(0) << 16;
  }
  return lut;
}
const water = [
  [0x0c1518,0x23362d,0x3e6548,0x658b54,0xa8bd7a,0xe4d99b],
  [0x07171c,0x12433b,0x157959,0x49a575,0xb4d888,0xfff4bf],
  [0x100e0c,0x292416,0x4b391c,0x765022,0xbb7e38,0xf2c477],
  [0x0b121c,0x23313f,0x324c60,0x46677e,0x779bad,0xbdd2e0]
].map(palette);
const leaf = [
  [0x1c3a30,0x496e46,0x8bab60,0xc5d182], [0x173e32,0x437438,0x88af4f,0xe6df86],
  [0x392c22,0x7e532d,0xaf763c,0xdcaa62], [0x1d3440,0x465f71,0x829aa9,0xbad1df]
].map(palette);
const petals = palette([0x654761,0xb36e89,0xe5a4b1,0xffdbcf]);
const distantPads = [
  [.031,.32,.038,.38],[.098,.25,.029,.32],[.24,.143,.044,.38],[.34,.184,.035,.46],
  [.41,.107,.031,.44],[.49,.198,.033,.55],[.797,.156,.05,.38],[.889,.252,.045,.44],
  [.97,.315,.032,.48],[.97,.445,.052,.55],[.945,.748,.045,.48],[.961,.88,.063,.42],
  [.061,.887,.067,.57],[.025,.672,.055,.49],[.102,.727,.042,.56],[.292,.92,.061,.68],
  [.533,.964,.058,.43],[.754,.794,.050,.58],[.85,.68,.035,.59],[.054,.477,.034,.51]
];

// Keep the expensive caustic geometry across all four plates. The seasonal
// pass gives it its own exposure, depth curve and water palette.
function waterPattern(w,h) {
  const rand=random(1963);
  const step=Math.max(2,Math.round(Math.min(w,h)/255));
  const cells=new Float32Array(Math.ceil(w/step)*Math.ceil(h/step)*7);
  let k=0;
  for (let j=0; j<h; j+=step) {
    const y=j/h-.52, drift=.018+.049*Math.sin(y*11);
    const fade=Math.exp(-1.25*y*y);
    for (let i=0; i<w; i+=step) {
      const x=i/w-.50;
      const swell=Math.sin(11*x+9*y)+.45*Math.sin(25*x-18*y);
      const crest=(.5+.5*Math.cos(185*y+swell*2.9+17*x*x))**7;
      const cloud=.5+.28*Math.sin(23*x+15*y)+.22*Math.cos(37*x-21*y);
      const shaft=fade*Math.exp(-58*(x+drift)**2);
      const patches=(.5+.5*Math.sin(42*x+28*y+2*Math.cos(16*y-x*12)))**2;
      cells[k++]=92+23*cloud+16*shaft;
      cells[k++]=(.5+.5*Math.sin(15*x-9*y));
      cells[k++]=crest;
      cells[k++]=shaft*patches;
      cells[k++]=patches*.29+rand()*.36;
      cells[k++]=Math.floor(rand()*step*.7)+step*Math.floor(rand()*step*.7);
      cells[k++]=rand();
    }
  }
  return {step,cells};
}

const exposureBySeason = [
  [6.1,6.8,.96,15,42], [5.1,6.1,1.04,24,75], [7.1,7,.88,12,64], [7.3,7.1,.82,17,22]
];

function paintWater(pixels,w,h,season,{step,cells}) {
  const [falloffX,falloffY,exposure,bank,reflectedLight]=exposureBySeason[season];
  const lut=water[season];
  const poolX=Float32Array.from({length:Math.ceil(w/step)},(_,i) => Math.exp(-falloffX*(i*step/w-.50)**2));
  let sample=0;
  for (let j=0; j<h; j+=step) {
    const poolY=Math.exp(-falloffY*(j/h-.52)**2), rows=Math.min(step,h-j);
    for (let i=0,col=0; i<w; i+=step,col++) {
      const pool=poolX[col]*poolY, columns=Math.min(step,w-i);
      const bankLight=cells[sample+1]*(1-pool);
      const reflection=cells[sample+2]*(cells[sample+3]+.18*bankLight);
      const floor=bank+pool*cells[sample]*exposure+bankLight*12+reflectedLight*reflection;
      const gleam=reflectedLight*.44*cells[sample+3];
      const light=floor+gleam+(22+102*pool)*(reflection*.99+cells[sample+4]);
      const sx=cells[sample+5]%step, sy=(cells[sample+5]/step)|0;
      const diam=Math.max(1,Math.round(step*(.24+.30*cells[sample+6]+reflection*.33)));
      sample+=7;
      const base=lut[Math.min(255,floor|0)], scan=lut[Math.min(255,(floor*.86)|0)];
      const spec=lut[Math.min(255,light|0)], specScan=lut[Math.min(255,(light*.86)|0)];
      const end=Math.min(columns,sx+diam);
      for (let dy=0; dy<rows; dy++) {
        let offset=(j+dy)*w+i;
        const dark=(j+dy)%3===0, shade=dark?scan:base;
        if (dy<sy || dy>=sy+diam || sx>=end) {
          for (let dx=0; dx<columns; dx++) pixels[offset++]=shade;
        } else {
          const highlight=dark?specScan:spec;
          for (let dx=0; dx<sx; dx++) pixels[offset++]=shade;
          for (let dx=sx; dx<end; dx++) pixels[offset++]=highlight;
          for (let dx=end; dx<columns; dx++) pixels[offset++]=shade;
        }
      }
    }
  }
}

// Generate stationary shore detail once per season. Rough edges, reflections,
// branches and ice shelves are stippled directly into the opaque plate.
function shoreline(pixels,w,h,season) {
  const rand = random(8247), unit = Math.min(w,h), ink = leaf[season];
  const grain = Math.max(1, Math.round(unit/610));

  function mote(x,y,color,size=grain) {
    const ix=Math.round(x), iy=Math.round(y);
    if (ix<0 || iy<0 || ix+size>w || iy+size>h) return;
    for (let v=0; v<size; v++) {
      const offset=(iy+v)*w+ix;
      pixels.fill(color,offset,offset+size);
    }
  }

  function disc(px,py,r,rotation,lamp,shadow) {
    const cx=px*w, cy=py*h, radius=unit*r;
    const count=Math.min(lilyPad.length/2,Math.ceil(radius*radius*.85));
    const cos=Math.cos(rotation), sin=Math.sin(rotation);
    for (let i=0; i<count; i++) {
      const x=lilyPad[2*i], y=lilyPad[2*i+1]/.61, bias=rand();
      const light=shadow ? 29 + 45*bias : lamp*(99+81*bias+32*Math.sin(x*6-y*10)+(i%13<3?36:0));
      mote(cx+radius*(x*cos-y*sin),cy+.61*radius*(x*sin+y*cos),ink[Math.round(clip(light,0,255))]);
    }
  }

  function twig(points, width, tones, light) {
    for (let segment=1; segment<points.length; segment++) {
      const [ax,ay]=points[segment-1], [bx,by]=points[segment];
      const span=Math.hypot((bx-ax)*w,(by-ay)*h), count=Math.ceil(span*1.7);
      for (let i=0; i<count; i++) {
        const t=(i+rand())/count, spread=width*(1-(segment-1+t)/points.length)*unit;
        mote(w*(ax+(bx-ax)*t), h*(ay+(by-ay)*t)+(rand()-.5)*spread,
          tones[Math.round(light*(.50+.50*rand()))], i%4===0 ? 1 : grain);
      }
    }
  }

  function blossom(x,y,r,lamp) {
    const size=r*unit, turn=rand()*TAU;
    for (let i=0; i<Math.ceil(size*11); i++) {
      const a=TAU*rand(), d=Math.sqrt(rand())*(.46+.54*Math.abs(Math.cos(2.5*a)));
      mote(x*w+size*Math.cos(a+turn)*d,y*h+size*Math.sin(a+turn)*d*.85,
        petals[Math.floor(lamp*(87+162*rand()))], i%3 ? grain : 1);
    }
  }

  if (season===0 || season===1) {
    for (const [x,y,r,lamp] of distantPads) disc(x,y,r*(season===0?.68:1),rand()*TAU,lamp,false);
  }
  if (season===1) {
    for (const [x,y,r,angle] of summerPads) disc(x+.013,y+.032,r,angle,0,true);
    for (const [x,y,size] of [[.219,.329,.038],[.735,.628,.042],[.064,.556,.022]]) {
      twig([[x,y+.042],[x-.006,y+.021],[x,y]],.003,ink,166);
      for (let i=0; i<lotusBloom.length; i+=2) {
        const dx=lotusBloom[i]*size*unit, dy=lotusBloom[i+1]*size*unit*.94;
        mote(x*w+dx,y*h+dy,petals[Math.floor(160+95*rand())],grain);
        mote(x*w+dx+(rand()-.5)*11,(y+.09)*h-dy*.4+rand()*12,petals[Math.floor(30+61*rand())],1);
      }
      for (let i=0; i<500; i++) {
        const a=rand()*TAU, r=Math.sqrt(rand()), t=TAU*rand();
        const reach=r*(.61+.38*Math.abs(Math.cos(a*3.5+t*.6)));
        mote(x*w+Math.cos(a)*reach*size*unit,
          y*h+Math.sin(a)*reach*size*unit*.60,petals[Math.floor(96+159*rand())],i%3?grain:1);
      }
    }
  } else if (season===0) {
    const bark=palette([0x2a292a,0x6d5352,0x9e7774,0xd5a59c]);
    twig([[-.018,.03],[.055,.077],[.123,.079],[.197,.122],[.277,.137],[.335,.177],[.405,.208]],.026,bark,228);
    const branches = [
      [[.031,.062],[.071,.021],[.109,-.014]], [[.068,.080],[.087,.139],[.064,.220],[.077,.288]],
      [[.124,.082],[.164,.056],[.198,.015],[.224,-.006]], [[.164,.105],[.161,.154],[.196,.208]],
      [[.209,.125],[.244,.091],[.260,.037]], [[.275,.135],[.300,.104],[.344,.091]],
      [[.311,.16],[.329,.201],[.369,.255]], [[.354,.186],[.389,.177],[.419,.155]]
    ];
    for (const points of branches) {
      twig(points,.010,bark,194);
      for (let n=0; n<5; n++) {
        const [x,y]=points[1+n%2], angle=TAU*rand(), r=.011+.023*rand();
        blossom(x+.016*Math.cos(angle),y+r*Math.sin(angle),r, .66+.34*rand());
      }
    }
    for (const [x,y,r] of [[.074,.79,.074],[.166,.888,.091],[.28,.804,.049],[.897,.647,.068],[.916,.913,.090]]) {
      disc(x,y,r,rand()*TAU,.64,false);
      const tip=[x+.009,y-.058];
      twig([[x,y],[x+.006,y-.039],tip],.003,ink,193);
      twig([tip,[x+.002,y-.069],[x-.012,y-.072]],.004,ink,227);
      twig([tip,[x+.018,y-.069],[x+.032,y-.075]],.004,ink,248);
    }
  } else if (season===2) {
    const bark=palette([0x261e14,0x68421f,0xa36731,0xd99b54]);
    const copper=palette([0x362519,0x885026,0xa65f27,0xcf853f]);
    twig([[-.03,.014],[.068,.077],[.145,.087],[.209,.139],[.322,.198]],.017,bark,202);
    for (const points of [
      [[.063,.074],[.076,.123],[.045,.220]], [[.112,.083],[.182,.034],[.242,.013]],
      [[.162,.102],[.177,.159],[.225,.196]], [[.225,.149],[.282,.105],[.348,.07]]
    ]) {
      twig(points,.008,bark,175);
      for (let branch=0; branch<8; branch++) {
        const t=rand(), [ax,ay]=points[branch%2], [bx,by]=points[1+branch%2];
        const x=(ax+(bx-ax)*t+(rand()-.5)*.055)*w;
        const y=(ay+(by-ay)*t+(rand()-.5)*.08)*h;
        const r=(.009+.017*rand())*unit, a=rand()*TAU, cos=Math.cos(a), sin=Math.sin(a);
        for (let i=0; i<310; i++) {
          const dx=fallenLeaf[2*i], dy=fallenLeaf[2*i+1];
          mote(x+r*(dx*cos-dy*sin),y+r*(dx*sin+dy*cos),copper[Math.floor(88+149*rand())]);
        }
      }
    }
    for (const [x,y,r] of [[.052,.51,.065],[.15,.81,.046],[.89,.73,.067],[.94,.92,.108],[.075,.99,.061]]) {
      disc(x,y,r,TAU*rand(),.38,false);
    }
  } else {
    const ice=palette([0x223745,0x435970,0x657e98,0xb0c9d6]);
    function shelf(points, side) {
      twig(points,.010,ice,239);
      for (let j=1; j<points.length; j++) {
        const [ax,ay]=points[j-1], [bx,by]=points[j];
        const count=Math.ceil(Math.abs(bx-ax)*w*h*.043);
        for (let i=0; i<count; i++) {
          const t=rand(), y=ay+(by-ay)*t, depth=rand()**1.9;
          const x=ax+(bx-ax)*t, taper=Math.min(1,9*(t+j-1),9*(points.length-j-t));
          const reach=(.085+.055*Math.sin(x*21)**2)*taper;
          const jitter=Math.sin(x*131)*.004+Math.cos(x*91)*.003;
          mote(w*x,h*(y+side*reach*depth+jitter),
            ice[Math.floor(44+57*rand()+66*(1-depth))], 1);
        }
        if (j%2===1) {
          twig([[ax,ay],[ax+(bx-ax)*.16,ay+side*.040],[ax+(bx-ax)*.71,ay+side*.074]],.003,ice,165);
        }
      }
    }
    shelf([[0,.41],[.062,.393],[.12,.355],[.068,.309],[.152,.258],[.226,.267],[.278,.227]],-1);
    shelf([[.635,.213],[.719,.226],[.781,.264],[.837,.258],[1,.319]],-1);
    shelf([[0,.811],[.061,.816],[.126,.853],[.203,.867],[.18,.91],[.258,.966],[.281,1]],1);
    shelf([[.456,1],[.506,.95],[.611,.946],[.681,.886],[.769,.864],[.836,.804],[.928,.828],[1,.762]],1);
    shelf([[.864,.603],[.913,.554],[.969,.526],[1,.533]],1);
    for (const points of [
      [[-.03,.32],[.058,.164],[.098,.105],[.193,-.017]], [[.052,.177],[.107,.117],[.222,.116]],
      [[.091,.114],[.064,.063],[.08,-.01]], [[.149,.051],[.211,.03],[.299,.048]],
      [[.013,.93],[.037,.825],[.019,.753]], [[.037,.835],[.078,.781],[.126,.773]],
      [[.961,.966],[.939,.886],[.974,.81]], [[.942,.884],[.904,.822],[.88,.804]]
    ]) twig(points,.005,ice,206);
    for (let i=0; i<405; i++) {
      mote(rand()*w,rand()*h,ice[Math.floor(51+139*rand())], i%8===0 ? grain : 1);
    }
  }
}

export function createWaterBed(makeCanvas) {
  let w=0,h=0,pattern;
  const cache = new Map(), surfaces = new Map();
  function resize(width,height){
    if(width===w&&height===h)return;
    clear(); w=width;h=height;
  }
  function pixels(s){
    if(cache.has(s)) return cache.get(s);
    const ink=new Uint32Array(w*h);
    pattern ??= waterPattern(w,h);
    paintWater(ink,w,h,s,pattern);
    shoreline(ink,w,h,s); cache.set(s,ink);
    return ink;
  }
  // A canvas projection for standalone/offscreen consumers. The live pond
  // uses the packed plates directly and does not allocate four extra surfaces.
  function plate(s){
    if(surfaces.has(s)) return surfaces.get(s);
    const canvas=makeCanvas(); canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:false}), image=ctx.createImageData(w,h);
    new Uint32Array(image.data.buffer).set(pixels(s));
    ctx.putImageData(image,0,0); surfaces.set(s,canvas); return canvas;
  }
  function clear(){
    for(const canvas of surfaces.values()) canvas.width=canvas.height=1;
    surfaces.clear();cache.clear();pattern=null;w=h=0;
  }
  return {resize,pixels,plate,clear};
}
