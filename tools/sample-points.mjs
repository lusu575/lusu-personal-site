#!/usr/bin/env node
    // Zero-dependency PNG / raw-RGBA point-cloud sampler for the pond prototype.
    // Runs directly on Node.js >= 18 using only built-in `node:fs`, `node:path`, and `node:zlib`.
    
    import fs from "node:fs";
    import path from "node:path";
    import zlib from "node:zlib";
    
    const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    
    function paethPredictor(a, b, c) {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      if (pa <= pb && pa <= pc) return a;
      return pb <= pc ? b : c;
    }
    
    export function decodePNG(buffer) {
      if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
        throw new Error("Invalid PNG signature");
      }
    
      let width = 0;
      let height = 0;
      let bitDepth = 0;
      let colorType = 0;
      let palette = null;
      let trns = null;
      const idatChunks = [];
    
      let offset = 8;
      while (offset + 8 <= buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString("ascii", offset + 4, offset + 8);
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        if (dataEnd + 4 > buffer.length) throw new Error(`Truncated PNG chunk: ${type}`);
        const chunk = buffer.subarray(dataStart, dataEnd);
    
        if (type === "IHDR") {
          width = chunk.readUInt32BE(0);
          height = chunk.readUInt32BE(4);
          bitDepth = chunk[8];
          colorType = chunk[9];
          if (chunk[10] !== 0 || chunk[11] !== 0) {
            throw new Error("Unsupported PNG compression or filter method");
          }
          if (chunk[12] !== 0) {
            throw new Error("Interlaced (Adam7) PNG is not supported; re-save as non-interlaced PNG");
          }
          if (![8, 16].includes(bitDepth)) {
            throw new Error(`Unsupported PNG bit depth ${bitDepth}; expected 8 or 16`);
          }
        } else if (type === "PLTE") {
          palette = chunk;
        } else if (type === "tRNS") {
          trns = chunk;
        } else if (type === "IDAT") {
          idatChunks.push(chunk);
        } else if (type === "IEND") {
          break;
        }
        offset = dataEnd + 4;
      }
    
      if (!width || !height || idatChunks.length === 0) {
        throw new Error("Incomplete PNG: missing IHDR or IDAT");
      }
    
      const channelsByType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
      const channels = channelsByType[colorType];
      if (!channels) throw new Error(`Unsupported PNG colorType: ${colorType}`);
      if (colorType === 3 && (!palette || bitDepth !== 8)) {
        throw new Error("Indexed PNG requires an 8-bit PLTE chunk");
      }
    
      const bytesPerSample = bitDepth / 8;
      const bpp = channels * bytesPerSample;
      const stride = width * bpp;
      const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
      if (inflated.length < height * (1 + stride)) {
        throw new Error("Inflated PNG data shorter than expected scanlines");
      }
    
      const recon = new Uint8Array(height * stride);
      for (let y = 0; y < height; y += 1) {
        const filterType = inflated[y * (1 + stride)];
        const srcRow = y * (1 + stride) + 1;
        const dstRow = y * stride;
        const prevRow = (y - 1) * stride;
    
        for (let x = 0; x < stride; x += 1) {
          const raw = inflated[srcRow + x];
          const left = x >= bpp ? recon[dstRow + x - bpp] : 0;
          const up = y > 0 ? recon[prevRow + x] : 0;
          const upLeft = y > 0 && x >= bpp ? recon[prevRow + x - bpp] : 0;
    
          let val = raw;
          if (filterType === 1) val = (raw + left) & 0xff;
          else if (filterType === 2) val = (raw + up) & 0xff;
          else if (filterType === 3) val = (raw + ((left + up) >> 1)) & 0xff;
          else if (filterType === 4) val = (raw + paethPredictor(left, up, upLeft)) & 0xff;
          else if (filterType !== 0) throw new Error(`Unknown PNG scanline filter: ${filterType}`);
          recon[dstRow + x] = val;
        }
      }
    
      const rgba = new Uint8Array(width * height * 4);
      const readSample8 = (byteOffset) => (
        bitDepth === 8
          ? recon[byteOffset]
          : Math.round(((recon[byteOffset] << 8) | recon[byteOffset + 1]) / 257)
      );
    
      for (let i = 0; i < width * height; i += 1) {
        const src = i * bpp;
        const dst = i * 4;
        if (colorType === 6) {
          rgba[dst] = readSample8(src);
          rgba[dst + 1] = readSample8(src + bytesPerSample);
          rgba[dst + 2] = readSample8(src + 2 * bytesPerSample);
          rgba[dst + 3] = readSample8(src + 3 * bytesPerSample);
        } else if (colorType === 2) {
          const r = readSample8(src);
          const g = readSample8(src + bytesPerSample);
          const b = readSample8(src + 2 * bytesPerSample);
          let a = 255;
          if (trns && trns.length >= 6 && r === trns[1] && g === trns[3] && b === trns[5]) a = 0;
          rgba[dst] = r;
          rgba[dst + 1] = g;
          rgba[dst + 2] = b;
          rgba[dst + 3] = a;
        } else if (colorType === 3) {
          const idx = recon[src];
          rgba[dst] = palette[idx * 3];
          rgba[dst + 1] = palette[idx * 3 + 1];
          rgba[dst + 2] = palette[idx * 3 + 2];
          rgba[dst + 3] = trns && idx < trns.length ? trns[idx] : 255;
        } else if (colorType === 4) {
          const gray = readSample8(src);
          rgba[dst] = gray;
          rgba[dst + 1] = gray;
          rgba[dst + 2] = gray;
          rgba[dst + 3] = readSample8(src + bytesPerSample);
        } else if (colorType === 0) {
          const gray = readSample8(src);
          rgba[dst] = gray;
          rgba[dst + 1] = gray;
          rgba[dst + 2] = gray;
          rgba[dst + 3] = trns && trns.length >= 2 && gray === trns[1] ? 0 : 255;
        }
      }
    
      return { width, height, rgba };
    }
    
    function loadImage(inputPath, rawWidth, rawHeight) {
      const buf = fs.readFileSync(inputPath);
      if (inputPath.toLowerCase().endsWith(".rgba")) {
        if (!rawWidth || !rawHeight || buf.length !== rawWidth * rawHeight * 4) {
          throw new Error(`.rgba input requires matching --raw-size W,H (expected ${rawWidth * rawHeight * 4} bytes, got ${buf.length})`);
        }
        return { width: rawWidth, height: rawHeight, rgba: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) };
      }
      return decodePNG(buf);
    }
    
    function parseColor(spec) {
      if (!spec) return null;
      if (Array.isArray(spec)) return spec.map((v) => (v > 1 ? v / 255 : v));
      const clean = String(spec).trim();
      if (clean.startsWith("#")) {
        const hex = clean.slice(1);
        if (hex.length === 6) {
          return [
            parseInt(hex.slice(0, 2), 16) / 255,
            parseInt(hex.slice(2, 4), 16) / 255,
            parseInt(hex.slice(4, 6), 16) / 255
          ];
        }
      }
      const parts = clean.split(",").map(Number);
      if (parts.length !== 3 || parts.some(Number.isNaN)) {
        throw new Error(`Invalid color "${spec}"; expected R,G,B (0..255 or 0..1) or #RRGGBB`);
      }
      return parts.some((v) => v > 1) ? parts.map((v) => v / 255) : parts;
    }
    
    function parsePair(spec, label) {
      if (!spec) return null;
      if (Array.isArray(spec)) return spec.map(Number);
      const parts = String(spec).split(",").map(Number);
      if (parts.length !== 2 || parts.some(Number.isNaN)) {
        throw new Error(`Invalid ${label} "${spec}"; expected x,y`);
      }
      return parts;
    }
    
    function parsePolyline(spec, cropX, cropY, cropW, cropH) {
      const rawPts = Array.isArray(spec)
        ? spec.map((p) => parsePair(p, "spine point"))
        : String(spec).split(/[;:]/).map((s) => parsePair(s, "spine point"));
      if (rawPts.length < 2) throw new Error("Spine requires at least 2 points (head and tail)");
      const isNorm = rawPts.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1);
      const pts = isNorm
        ? rawPts.map(([x, y]) => [cropX + x * cropW, cropY + y * cropH])
        : rawPts;
      const cumLen = [0];
      for (let i = 1; i < pts.length; i += 1) {
        const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        cumLen.push(cumLen[i - 1] + seg);
      }
      const totalLen = cumLen[cumLen.length - 1];
      if (totalLen < 1e-3) throw new Error("Degenerate fish spine: zero total length");
      return { pts, cumLen, totalLen };
    }
    
    function projectToSpine(px, py, spine) {
      const { pts, cumLen, totalLen } = spine;
      let bestDist2 = Infinity;
      let bestAlong = 0;
      let bestAcross = 0;
    
      for (let i = 0; i < pts.length - 1; i += 1) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        const vx = bx - ax;
        const vy = by - ay;
        const segLen2 = vx * vx + vy * vy;
        if (segLen2 < 1e-9) continue;
        const segLen = Math.sqrt(segLen2);
        const rawT = ((px - ax) * vx + (py - ay) * vy) / segLen2;
        const clampedT = i === 0 && pts.length === 2
          ? rawT
          : Math.max(i === 0 ? -0.15 : 0, Math.min(i === pts.length - 2 ? 1.15 : 1, rawT));
        const cx = ax + clampedT * vx;
        const cy = ay + clampedT * vy;
        const dist2 = (px - cx) ** 2 + (py - cy) ** 2;
        if (dist2 < bestDist2) {
          bestDist2 = dist2;
          bestAlong = (cumLen[i] + clampedT * segLen) / totalLen;
          const ux = vx / segLen;
          const uy = vy / segLen;
          // Preserve exact left/right handedness when mapping Y-down PNG to Y-up WebGL spine.
          bestAcross = (uy * (px - ax) - ux * (py - ay)) / totalLen;
        }
      }
      return [bestAlong, bestAcross];
    }
    
    function parseCrop(spec, imgWidth, imgHeight) {
      if (!spec) return [0, 0, imgWidth, imgHeight];
      const parts = Array.isArray(spec) ? spec.map(Number) : String(spec).split(",").map(Number);
      if (parts.length !== 4 || parts.some(Number.isNaN)) {
        throw new Error(`Invalid crop "${spec}"; expected x,y,w,h`);
      }
      const x = Math.max(0, Math.round(parts[0]));
      const y = Math.max(0, Math.round(parts[1]));
      const w = Math.min(imgWidth - x, Math.round(parts[2]));
      const h = Math.min(imgHeight - y, Math.round(parts[3]));
      if (w <= 0 || h <= 0) throw new Error(`Empty crop region: ${x},${y},${w},${h}`);
      return [x, y, w, h];
    }
    
    function clamp(v, lo, hi) {
      return Math.min(hi, Math.max(lo, v));
    }
    
    function smoothstep(e0, e1, x) {
      if (e1 <= e0) return x >= e1 ? 1 : 0;
      const t = clamp((x - e0) / (e1 - e0), 0, 1);
      return t * t * (3 - 2 * t);
    }
    
    function hash2D(ix, iy, seed = 1) {
      let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) >>> 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    
    function sampleBilinear(rgba, imgW, imgH, x, y) {
      const cx = clamp(x, 0, imgW - 1);
      const cy = clamp(y, 0, imgH - 1);
      const x0 = Math.floor(cx);
      const y0 = Math.floor(cy);
      const x1 = Math.min(imgW - 1, x0 + 1);
      const y1 = Math.min(imgH - 1, y0 + 1);
      const fx = cx - x0;
      const fy = cy - y0;
    
      const out = [0, 0, 0, 0];
      const i00 = (y0 * imgW + x0) * 4;
      const i10 = (y0 * imgW + x1) * 4;
      const i01 = (y1 * imgW + x0) * 4;
      const i11 = (y1 * imgW + x1) * 4;
      for (let c = 0; c < 4; c += 1) {
        const top = rgba[i00 + c] * (1 - fx) + rgba[i10 + c] * fx;
        const bot = rgba[i01 + c] * (1 - fx) + rgba[i11 + c] * fx;
        out[c] = (top * (1 - fy) + bot * fy) / 255;
      }
      return out;
    }
    
    export function sampleAsset(image, options = {}) {
      const kind = options.kind ?? "static";
      const [cropX, cropY, cropW, cropH] = parseCrop(options.crop, image.width, image.height);
      const step = Math.max(1, Number(options.step ?? 5));
      const stagger = Number(options.stagger ?? 0.5);
      const jitter = clamp(Number(options.jitter ?? 0.08), 0, 0.45);
      const minAlpha = Number(options.minAlpha ?? 0.08);
      const minLuma = Number(options.minLuma ?? 0.04);
      const maxLuma = Number(options.maxLuma ?? 1.01);
      const keyColor = parseColor(options.keyColor);
      const keyTol = Number(options.keyTol ?? 0.16);
      const keyFeather = Number(options.keyFeather ?? 0.10);
      const [sizeMin, sizeMax] = parsePair(options.pointSize ?? [3.8, 4.8], "pointSize");
      const maxPoints = Number(options.maxPoints ?? (kind === "fish" ? 2500 : 12000));
      const projected = Boolean(options.projected ?? true);
      const seed = Number(options.seed ?? 575);
    
      let spine = null;
      if (kind === "fish") {
        if (options.spine) {
          spine = parsePolyline(options.spine, cropX, cropY, cropW, cropH);
        } else if (options.head && options.tail) {
          spine = parsePolyline([options.head, options.tail], cropX, cropY, cropW, cropH);
        } else {
          throw new Error("Fish sampling (--kind fish) requires --head x,y --tail x,y (or --spine x0,y0:x1,y1:...)");
        }
      }
    
      const alongRange = options.alongRange ?? [-0.04, 1.06];
      const maxAcross = Number(options.maxAcross ?? 0.28);
    
      const collectWithStep = (gridStep) => {
        const stepX = gridStep;
        const stepY = gridStep * 0.94;
        const cols = Math.max(1, Math.floor(cropW / stepX));
        const rows = Math.max(1, Math.floor(cropH / stepY));
        const marginX = 0.5 * (cropW - (cols - 1) * stepX);
        const marginY = 0.5 * (cropH - (rows - 1) * stepY);
        const records = [];
    
        for (let r = 0; r < rows; r += 1) {
          const rowOffset = (r & 1) ? stagger * stepX : 0;
          for (let c = 0; c < cols; c += 1) {
            const jx = (hash2D(c, r, seed) - 0.5) * 2 * jitter * stepX;
            const jy = (hash2D(c, r, seed + 97) - 0.5) * 2 * jitter * stepY;
            const localX = marginX + c * stepX + rowOffset + jx;
            const localY = marginY + r * stepY + jy;
            if (localX < 0 || localX >= cropW || localY < 0 || localY >= cropH) continue;
    
            const imgX = cropX + localX;
            const imgY = cropY + localY;
            let [cr, cg, cb, ca] = sampleBilinear(image.rgba, image.width, image.height, imgX, imgY);
            if (ca < minAlpha) continue;
    
            const luma = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
            if (luma < minLuma || luma > maxLuma) continue;
    
            if (keyColor) {
              const dist = Math.hypot(cr - keyColor[0], cg - keyColor[1], cb - keyColor[2]);
              if (dist <= keyTol) continue;
              const keyMask = smoothstep(keyTol, keyTol + Math.max(0.001, keyFeather), dist);
              ca *= keyMask;
              if (ca < minAlpha) continue;
              if (keyMask < 0.98) {
                const inv = 1 / Math.max(0.25, keyMask);
                cr = clamp((cr - keyColor[0] * (1 - keyMask)) * inv, 0, 1);
                cg = clamp((cg - keyColor[1] * (1 - keyMask)) * inv, 0, 1);
                cb = clamp((cb - keyColor[2] * (1 - keyMask)) * inv, 0, 1);
              }
            }
    
            const nx = localX / cropW;
            const ny = localY / cropH;
            const size = sizeMin + (sizeMax - sizeMin) * clamp(0.25 + 0.75 * luma, 0, 1);
    
            if (kind === "fish") {
              const [along, across] = projectToSpine(imgX, imgY, spine);
              if (along < alongRange[0] || along > alongRange[1] || Math.abs(across) > maxAcross) continue;
              records.push([nx, ny, along, across, cr, cg, cb, ca, size]);
            } else {
              records.push([nx, ny, cr, cg, cb, ca, size]);
            }
          }
        }
        return records;
      };
    
      let curStep = step;
      let records = collectWithStep(curStep);
      let guard = 0;
      while (records.length > maxPoints && guard < 12) {
        const ratio = Math.sqrt(records.length / Math.max(1, maxPoints));
        curStep *= Math.max(1.06, ratio);
        records = collectWithStep(curStep);
        guard += 1;
      }
      if (records.length > maxPoints) {
        const thinned = [];
        const stridePick = records.length / maxPoints;
        for (let i = 0; i < maxPoints; i += 1) {
          thinned.push(records[Math.min(records.length - 1, Math.floor(i * stridePick))]);
        }
        records = thinned;
      }
    
      const stride = kind === "fish" ? 9 : 7;
      const flat = [];
      const round4 = (n) => Math.round(n * 10000) / 10000;
      for (const rec of records) {
        for (const v of rec) flat.push(round4(v));
      }
    
      return {
        kind,
        width: cropW,
        height: cropH,
        aspect: Math.round((cropW / cropH) * 10000) / 10000,
        projected,
        stride,
        count: records.length,
        points: flat
      };
    }
    
    function formatDatasetObject(data, indent = "  ") {
      const numsPerLine = data.stride * 2;
      const lines = [];
      for (let i = 0; i < data.points.length; i += numsPerLine) {
        lines.push(`${indent}  ${data.points.slice(i, i + numsPerLine).join(", ")}`);
      }
      const fieldsComment = data.kind === "fish"
        ? "// [x, y, along, across, r, g, b, alpha, size]"
        : "// [x, y, r, g, b, alpha, size]";
      return `{\n` +
        `${indent}kind: ${JSON.stringify(data.kind)}, width: ${data.width}, height: ${data.height}, ` +
        `aspect: ${data.aspect}, projected: ${data.projected}, stride: ${data.stride}, count: ${data.count},\n` +
        `${indent}${fieldsComment}\n` +
        `${indent}points: new Float32Array([\n${lines.join(",\n")}\n${indent}])\n` +
        `${indent.slice(2)}}`;
    }
    
    function parseCLIArgs(argv) {
      const args = {};
      for (let i = 2; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith("--")) continue;
        const key = token.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("--")) {
          args[key] = true;
        } else {
          args[key] = next;
          i += 1;
        }
      }
      return args;
    }
    
    function runManifest(manifestPath, outOverride) {
      const baseDir = path.dirname(path.resolve(manifestPath));
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const imageCache = new Map();
      const getImg = (relPath, rawSize) => {
        const full = path.resolve(baseDir, relPath);
        if (!imageCache.has(full)) {
          const [rw, rh] = rawSize ? parsePair(rawSize, "rawSize") : [0, 0];
          imageCache.set(full, loadImage(full, rw, rh));
        }
        return imageCache.get(full);
      };
    
      const sections = [
        "// Generated by tools/sample-points.mjs — pure static point-cloud data (zero runtime image loading).",
        `export const FISH_POINT_BUDGET = ${Number(manifest.fishPointBudget ?? 2500)};`,
        `export const PLANT_POINT_BUDGET = ${Number(manifest.plantPointBudget ?? 12000)};`,
        ""
      ];
    
      for (const groupName of ["KOI_SAMPLES", "LEAF_SAMPLES", "FLOWER_SAMPLES", "BUD_SAMPLES"]) {
        const entries = manifest[groupName];
        if (!entries) continue;
        const props = [];
        for (const [key, cfg] of Object.entries(entries)) {
          const img = getImg(cfg.input, cfg.rawSize);
          const sampled = sampleAsset(img, cfg);
          props.push(`  ${key}: ${formatDatasetObject(sampled, "    ")}`);
          process.stderr.write(`[sample-points] ${groupName}.${key}: ${sampled.count} points (stride ${sampled.stride})\n`);
        }
        sections.push(`export const ${groupName} = {\n${props.join(",\n")}\n};\n`);
      }
    
      const code = sections.join("\n");
      const outFile = outOverride ?? (manifest.out ? path.resolve(baseDir, manifest.out) : null);
      if (outFile) {
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, code, "utf8");
        process.stderr.write(`[sample-points] Wrote ${outFile}\n`);
      } else {
        process.stdout.write(code);
      }
    }
    
    function printHelp() {
      process.stderr.write(
    `Usage:
      1) Single sprite / crop sampling:
         node tools/sample-points.mjs --input <file.png|file.rgba> [options]
    
         Options:
           --kind static|fish         Asset type (default: static)
           --name <IDENT>             Exported const name (default: SAMPLED_ASSET)
           --crop x,y,w,h             Optional pixel sub-rect inside input image
           --step <px>                Grid spacing in source pixels (default: 5)
           --stagger <0..1>           Alternate-row horizontal offset (default: 0.5)
           --jitter <0..0.45>         Deterministic sub-cell jitter (default: 0.08)
           --min-alpha <0..1>         Minimum alpha threshold (default: 0.08)
           --min-luma <0..1>          Minimum luma Y' threshold (default: 0.04)
           --max-luma <0..1>          Maximum luma Y' threshold (default: 1.01)
           --key-color R,G,B|#RRGGBB  Optional background chroma-key color to strip
           --key-tol <0..1>           RGB Euclidean distance tolerance for key color (default: 0.16)
           --key-feather <0..1>       Soft edge ramp above key-tol (default: 0.10)
           --point-size min,max       Output point size range in px (default: 3.8,4.8)
           --max-points <N>           Point budget cap (default: 2500 fish / 12000 static)
           --head x,y --tail x,y      Head & tail endpoints for --kind fish (px, or 0..1 inside crop)
           --spine x0,y0:x1,y1:...    Optional polyline spine for curved fish crops
           --max-across <float>       Max lateral fish half-span in body lengths (default: 0.28)
           --projected 0|1            1 if sprite is already oblique-projected, 0 if top-down disc (default: 1)
           --raw-size W,H             Required only when input is raw 8-bit .rgba
           --out <file.mjs>           Write JS module to file (prints to stdout if omitted)
    
      2) Batch manifest mode (builds complete prototypes/pond/sampled-data.mjs):
         node tools/sample-points.mjs --manifest <manifest.json> [--out prototypes/pond/sampled-data.mjs]
    `
      );
    }
    
    const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
    if (isMain) {
      const args = parseCLIArgs(process.argv);
      if (args.help || (!args.input && !args.manifest)) {
        printHelp();
        process.exit(args.help ? 0 : 1);
      }
    
      if (args.manifest) {
        runManifest(args.manifest, args.out);
      } else {
        const [rw, rh] = args["raw-size"] ? parsePair(args["raw-size"], "rawSize") : [0, 0];
        const img = loadImage(args.input, rw, rh);
        const exportName = args.name ?? "SAMPLED_ASSET";
        const sampled = sampleAsset(img, {
          kind: args.kind ?? "static",
          crop: args.crop,
          step: args.step,
          stagger: args.stagger,
          jitter: args.jitter,
          minAlpha: args["min-alpha"],
          minLuma: args["min-luma"],
          maxLuma: args["max-luma"],
          keyColor: args["key-color"],
          keyTol: args["key-tol"],
          keyFeather: args["key-feather"],
          pointSize: args["point-size"],
          maxPoints: args["max-points"],
          head: args.head,
          tail: args.tail,
          spine: args.spine,
          maxAcross: args["max-across"],
          projected: args.projected !== undefined ? args.projected !== "0" && args.projected !== "false" : true
        });
        const code = `// Generated by tools/sample-points.mjs from ${path.basename(args.input)}\n` +
          `export const ${exportName} = ${formatDatasetObject(sampled, "  ")};\n`;
        if (args.out) {
          fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
          fs.writeFileSync(args.out, code, "utf8");
          process.stderr.write(`[sample-points] Wrote ${sampled.count} points to ${args.out}\n`);
        } else {
          process.stdout.write(code);
        }
      }
    }