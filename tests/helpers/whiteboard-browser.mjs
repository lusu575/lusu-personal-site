import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { build } from "esbuild";
import { openIsolatedKittens } from "./kittens-browser.mjs";

export async function openIsolatedWhiteboard(t) {
 const root = resolve(".wrangler-config", "whiteboard-visual-" + process.pid);
 await mkdir(root, { recursive: true });
 t.after(async () => { if (!root.startsWith(resolve(".wrangler-config") + sep)) throw new Error("Unsafe fixture path"); await rm(root, { recursive: true, force: true }); });
 await build({ stdin: { contents: `
 import { exportToBlob, convertToExcalidrawElements } from '@excalidraw/excalidraw';
 import { fullWhiteboardSnapshot } from './tools/whiteboard/src/private-snapshot.mjs';
 globalThis.lusuPrivateWhiteboardSnapshot = async () => {
   const canvas = document.createElement('canvas'); canvas.width=20; canvas.height=20;
   const ctx=canvas.getContext('2d'); ctx.fillStyle='#ff0000'; ctx.fillRect(0,0,20,20);
   const files = { fixture: { id:'fixture', dataURL:canvas.toDataURL('image/png'), mimeType:'image/png', created:1 } };
   const elements = convertToExcalidrawElements([
     { type:'rectangle', x:0,y:0,width:100,height:80, backgroundColor:'#0000ff',fillStyle:'solid' },
     { type:'text', x:0,y:110,text:'Full board',fontFamily:2 },
     { type:'image', x:1200,y:0,width:200,height:100,fileId:'fixture',status:'saved',scale:[1,1] }
   ]);
   return fullWhiteboardSnapshot({ getSceneElements:()=>elements, getFiles:()=>files, getAppState:()=>({ viewBackgroundColor:'#ffffff' }) }, exportToBlob);
 };
 `, resolveDir: process.cwd(), loader: "js" }, outfile: resolve(root,"fixture.js"), bundle:true, format:"iife", platform:"browser",
 define: { "process.env.NODE_ENV": '"production"' }, loader: { ".woff2":"dataurl", ".woff":"dataurl", ".ttf":"dataurl", ".png":"dataurl", ".svg":"dataurl" } });
 await writeFile(resolve(root,"index.html"), '<!doctype html><meta charset="utf-8"><script src="fixture.js"></script>');
 const { evaluate } = await openIsolatedKittens(t,{ root, ready:"typeof globalThis.lusuPrivateWhiteboardSnapshot === 'function'" });
 return { evaluate };
}
