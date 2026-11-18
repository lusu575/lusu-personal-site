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
  [0x030a0d,0x102b28,0x385947,0x688964,0xb5c58c,0xe2cdaa],
  [0x030b0f,0x0c302f,0x1b7154,0x419e76,0xa6cf86,0xf9efb6],
  [0x090a0c,0x302b21,0x625335,0x978053,0xc7a169,0xf0cf98],
  [0x040b12,0x192932,0x354a58,0x577285,0x8ca9b7,0xcadce0]
].map(palette);
const leaf = [
  [0x193b34,0x447150,0x83a867,0xbacc7c], [0x173e32,0x437438,0x88af4f,0xe6df86],
  [0x392c22,0x7e532d,0xaf763c,0xdcaa62], [0x1d3440,0x465f71,0x829aa9,0xbad1df]
].map(palette);
const petals = palette([0x654761,0xb36e89,0xe5a4b1,0xffdbcf]);
const pads = [ // x, y, equatorial radius in short-side units, ambient light
  [.075,.34,.034,.58],[.155,.405,.060,.94],[.218,.383,.041,.92],[.26,.421,.027,.76],
  [.178,.633,.074,.88],[.244,.842,.099,.77],[.305,.898,.035,.59],
  [.647,.684,.094,1],[.744,.642,.045,.85],[.837,.578,.074,.87],
  [.895,.343,.033,.64],[.935,.218,.039,.5],[.386,.205,.030,.76],
  [.225,.126,.052,.38],[.025,.788,.047,.43],[.958,.902,.056,.42]
];

// Build the caustic energy field once at sample-cell rather than pixel rate.
// Each cell has a deep-water floor and an isolated phosphor point, never a
// horizontal stroke. Three localized glancing-light streaks cross the pool.
function waterField(w, h) {
  const field = new Uint8Array(w * h), rand = random(1963);
  const step = Math.max(2, Math.round(Math.min(w,h) / 325));
  for (let j = 0; j < h; j += step) {
    const v = j / h - .52;
    for (let i = 0; i < w; i += step) {
      const u = i / w - .50;
      const x = u * (1 + .045*v*v), y = v * (1 + .045*u*u);
      const pool = Math.exp(-8.2*x*x - 7.2*y*y);
      const swell = Math.sin(22*x + 9*y + 1.8*Math.sin(10*y)) + .4*Math.sin(45*x-18*y);
      const crest = (.5 + .5*Math.cos(163*y + swell*2.5)) ** 4;
      const shaft = Math.exp(-42*(x + .07 + .043*Math.sin(y*12))**2);
      const cloud = .5 + .5*Math.sin(28*x+17*y+2*Math.cos(16*y-x*12));
      const glint = Math.exp(-235*(x + .105 + .040*Math.cos(y*18))**2) * (.30 + .70*cloud);
      const floor = 5 + pool*(91 + cloud*24 + shaft*(12 + crest*21) + glint*29);
      const light = floor + (17+114*pool)*(crest*(.26+cloud*.56) + shaft*.31 + glint*.58 + rand()*.47);
      const sx = Math.floor(rand()*step*.7), sy = Math.floor(rand()*step*.7);
      const diam = Math.max(1, Math.round(step*(.27+.35*rand())));
      for (let dy=0; dy<step && j+dy<h; dy++) {
        const scan = (j+dy)%3===0 ? .86 : 1;
        let k = (j+dy)*w+i;
        for (let dx=0; dx<step && i+dx<w; dx++) {
          field[k++] = Math.min(255, scan*(dx>=sx && dx<sx+diam && dy>=sy && dy<sy+diam ? light : floor));
        }
      }
    }
  }
  return field;
}

// Distant mirror rings, waxy discs with notches and radial veins, nodding
// lotus buds and their reflections. Shade comes from point colour/density;
// nothing fills a leaf or flower silhouette with a polygon.
function shoreline(pixels,w,h,s) {
  const rand=random(8247), unit=Math.min(w,h), ink=leaf[s], grain=Math.max(1,Math.round(unit/620));
  function mote(x,y,color,size=grain) {
    const ix=Math.round(x), iy=Math.round(y);
    if (ix<0||iy<0||ix+size>w||iy+size>h) return;
    for(let v=0;v<size;v++) for(let u=0;u<size;u++) pixels[(iy+v)*w+ix+u]=color;
  }
  for(const [cx,cy,r,light] of [[.45,.54,.20,.93],[.68,.45,.14,.78],[.14,.36,.095,.53],[.5,.87,.12,.49],[.9,.19,.11,.32]]) {
    for(let k=0;k<5;k++) {
      const n=Math.round(w*r*1.85), rad=w*r*(.38+.15*k);
      for(let i=0;i<n;i++) {
        const a=(i+rand()*.42)*TAU/n, crest=.5+.5*Math.sin(a*3.0+k*.32);
        if(rand()>.23+.63*crest) continue;
        const d=rad*(1+.023*Math.sin(4*a+k*.4));
        mote(w*cx+d*Math.cos(a),h*cy+d*Math.sin(a)*.28,water[s][Math.round(light*(110+90*crest+rand()*36))]);
      }
    }
  }
  for(const [px,py,r,lamp] of pads) {
    const cx=w*px,cy=h*py, rad=unit*r*(s===1?1:s===0?.65:s===2?.76:1.2), tilt=.48+.16*rand(), cut=rand()*TAU;
    if(s===3){
      // Thin ice forms irregular edge shelves rather than frozen lily discs.
      if(px>.22 && px<.81) continue;
      for(let k=0;k<3;k++) for(let i=0;i<180;i++){
        const t=rand(), bend=t<.45?t*.23:.10-(t-.45)*.29;
        const dx=(t-.5)*2, dy=bend+.17*k+Math.sin(t*7+k)*.08;
        mote(cx+rad*dx,cy+rad*dy+rand()*grain*2,ink[Math.floor(48+120*t*rand())],1);
      }
      continue;
    }
    const n=Math.round(Math.PI*rad*rad*tilt/(grain*grain)*.87);
    for(let i=0;i<n;i++) {
      const a=TAU*rand(), d=Math.sqrt(rand());
      const vein=Math.abs(Math.sin(a*5));
      let shape=1+.036*Math.cos(5*a+.5)+.021*Math.cos(8*a);
      if(s===2) shape=.38+.62*Math.abs(Math.cos(3.5*a))**3;
      if(s!==2 && Math.cos(a-cut)>.987 && d>.13) continue;
      const x=rad*d*shape*Math.cos(a), y=rad*d*shape*Math.sin(a)*tilt;
      const shine=.34+.26*(1-d)+.18*Math.cos(a+1.4)+.20*rand()+ (vein<.085||d>.958?.32:0);
      mote(cx+x,cy+y,ink[Math.round(clip(shine*lamp)*255)]);
    }
    if(s<2){
      // Sunlit cuticle, radial ribs and the two cut edges: individually
      // spaced flecks rather than a continuous outline or filled silhouette.
      for(let rib=0;rib<12;rib++) for(let i=0;i<rad*.68;i++){
        const t=(i+rand()*.45)/(rad*.68),a=cut+.17+rib*(TAU-.34)/11+.045*Math.sin(t*3);
        mote(cx+rad*t*Math.cos(a),cy+rad*t*Math.sin(a)*tilt,ink[Math.round(lamp*(141+90*rand()))],grain);
      }
    }
  }
  if(s===1){
    for(const [px,py,scale] of [[.20,.369,.023],[.731,.623,.028]]){
      const r=unit*scale,x=px*w,y=py*h;
      for(let i=0;i<1200;i++){
        const t=rand(),a=TAU*rand(),d=Math.sqrt(rand())*Math.sin(Math.PI*t)**.72;
        const dx=r*.73*d*Math.cos(a),dy=-r*2*t;
        mote(x+dx,y+dy,petals[Math.round(75+155*t+22*rand())]);
        if(i%3===0)mote(x+dx+(rand()-.5)*r*.65,y+2.15*r-dy*.73,petals[Math.floor(rand()*78)],1);
        if(i%8===0)mote(x+.05*r*Math.sin(t*3),y+2*r*t,ink[114],1);
      }
    }
  }
  if(s!==1){
    // Clusters attached to tapering, stippled shoreline branches.
    for(let side=0;side<2;side++) for(let branch=0;branch<7;branch++){
      const ox=side?w:0,oy=side?h:0,dir=side?-1:1,len=(.12+.17*rand())*w,sag=(.018+.14*rand())*h;
      const at=t=>oy+dir*(sag*(1-t)+.076*h*Math.sin(t*4+branch*.18));
      for(let i=0;i<390;i++){
        const t=rand(); mote(ox+dir*t*len,at(t)+rand()*2,ink[Math.floor(30+rand()*114)],grain);
      }
      for(let k=0;k<19;k++){
        const t=rand(),x=ox+dir*t*len,y=at(t),sx=(rand()-.58)*unit*.042,sy=(rand()-.46)*unit*.054;
        for(let i=0;i<42;i++){const d=rand();mote(x+sx*d,y+sy*d*d,ink[Math.floor(62+rand()*102)],1);}
        for(let i=0;i<110;i++){
          const a=TAU*rand(), rr=unit*(s===3?.010:.012)*Math.sqrt(rand())*(.46+.54*Math.abs(Math.cos(2.5*a)));
          mote(x+sx+rr*Math.cos(a),y+sy+rr*Math.sin(a)*.82,(s===0?petals:ink)[Math.floor(83+rand()*161)],grain);
        }
      }
    }
  }
}

export function createWaterBed(makeCanvas) {
  let w=0,h=0,field;
  const cache = new Map();
  function resize(width,height){
    if(width===w&&height===h)return;
    clear(); w=width;h=height;field=waterField(w,h);
  }
  function plate(s){
    if(cache.has(s))return cache.get(s);
    const canvas=makeCanvas(); canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:false});
    const image=ctx.createImageData(w,h), pixels=new Uint32Array(image.data.buffer), lut=water[s];
    for(let i=0;i<pixels.length;i++)pixels[i]=lut[field[i]];
    shoreline(pixels,w,h,s);ctx.putImageData(image,0,0);cache.set(s,canvas);
    return canvas;
  }
  function clear(){
    for(const canvas of cache.values()) canvas.width=canvas.height=1;
    cache.clear();field=null;w=h=0;
  }
  return {resize,plate,clear};
}
