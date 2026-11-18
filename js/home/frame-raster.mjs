// Paint directly into the opaque backing pixels. In a software renderer a
// short JS call to fillRect can leave thousands of antialiased commands for
// the next BeginMainFrame to flush. A frame here has one native upload.
export function packedColour(a, b, f) {
  const c = shift => Math.round(((a >>> shift) & 255)*(1-f) + ((b >>> shift) & 255)*f);
  return (0xff000000 | c(0) << 16 | c(8) << 8 | c(16)) >>> 0;
}

function blend(a, b, t) {
  const rb = (a & 0xff00ff) + ((((b & 0xff00ff) - (a & 0xff00ff)) * t) >> 8);
  const g = (a & 0xff00) + ((((b & 0xff00) - (a & 0xff00)) * t) >> 8);
  return 0xff000000 | (rb & 0xff00ff) | (g & 0xff00);
}

export function createFrameRaster(native, bed) {
  let image, pixels, w, h, sx, sy;
  let target=-1, current, source, destination, swept, previous=0;
  function resize(width, height, worldWidth, worldHeight) {
    sx=width/worldWidth; sy=height/worldHeight;
    if (w===width && h===height) return;
    w=width; h=height; target=-1; source=current=destination=swept=null;
    image=native.createImageData(w,h); pixels=new Uint32Array(image.data.buffer);
    bed.resize(w,h);
  }
  function begin(season, progress) {
    if (target!==season) {
      target=season;
      destination=bed.pixels(season);
      source=current || destination;
      swept=null; previous=0;
    }
    if (progress>=1 || source===destination) {
      current=destination; source=destination; swept=null;
    } else {
      // The band moves diagonally out of the upper-right slider. Each row
      // copies only newly passed pixels and blends only the narrow crest.
      // On interruption the last assembled plate becomes the new source.
      if (!swept) swept=source.slice();
      const edge=.075, front=progress*(1+edge), oldFront=previous*(1+edge);
      for(let y=0; y<h; y++) {
        const offset=y*w, start=w*(1-(front-.36*y/h)/.64), span=w*edge/.64;
        const left=Math.min(w,Math.max(0,Math.ceil(start)));
        const right=Math.min(w,Math.max(0,Math.ceil(start+span)));
        const lastRight=Math.min(w,Math.max(0,Math.ceil(w*(1-(oldFront-.36*y/h)/.64)+span)));
        if (right<lastRight) swept.set(destination.subarray(offset+right,offset+lastRight),offset+right);
        for(let x=left;x<right;x++) {
          const k=offset+x;
          swept[k]=blend(source[k],destination[k],Math.floor((x-start)*256/span));
        }
      }
      current=swept; previous=progress;
    }
    pixels.set(current);
  }
  return {
    resize,begin, fillStyle:0xffffffff,globalAlpha:1,
    fillRect(x,y,width,height) {
      const x0=Math.round(x*sx), y0=Math.round(y*sy);
      const end=Math.min(w,x0+Math.max(1,Math.round(width*sx)));
      const bottom=Math.min(h,y0+Math.max(1,Math.round(height*sy)));
      const start=Math.max(0,x0), color=this.fillStyle, t=Math.round(this.globalAlpha*256);
      for(let row=Math.max(0,y0);row<bottom;row++) {
        const offset=row*w;
        if(t===256) for(let k=offset+start;k<offset+end;k++) pixels[k]=color;
        else for(let k=offset+start;k<offset+end;k++) pixels[k]=blend(pixels[k],color,t);
      }
    },
    end(){native.putImageData(image,0,0);}
  };
}
