import { createHash } from "node:crypto";
import { generateNKeysBetween } from "fractional-indexing";
import * as Y from "yjs";

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const MAX_ELEMENTS_PER_OPERATION = 50;
const MAX_SCENE_ELEMENTS = 5_000;
const MAX_TEXT_CHARS = 2_000;
const MAX_POINTS = 50;
const MAX_COORDINATE = 100_000;
const MAX_DIMENSION = 10_000;
const MAX_EXPORT_DIMENSION = 4_096;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 8_192;
const MAX_IMAGE_PIXELS = 32_000_000;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/;
const ELEMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const ASSET_ID_PATTERN = /^[a-f0-9]{32}$/;
const APPENDABLE_TYPES = new Set(["rectangle", "ellipse", "diamond", "text", "line", "arrow", "image"]);
const VECTOR_EXPORT_TYPES = new Set(["rectangle", "ellipse", "diamond", "text", "line", "arrow"]);
const FILL_STYLES = new Set(["solid", "hachure", "cross-hatch"]);
const STROKE_STYLES = new Set(["solid", "dashed", "dotted"]);
const ARROWHEADS = new Set(["arrow", "bar", "dot", "triangle", null]);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_CRC_TABLE = createRasterCrc32Table();
const SUPPORTED_JPEG_FRAMES = new Set([0xc0, 0xc1, 0xc2]);
const MAX_RASTER_CONTAINER_PARTS = 8_192;

export class WhiteboardSceneError extends Error {
  constructor(message, code = "WHITEBOARD_SCENE_ERROR", options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "WhiteboardSceneError";
    this.code = code;
  }
}

export function parseWhiteboardRasterAsset(value, expectedContentType = "") {
  const bytes = normalizeAssetBytes(value);
  const parsed = parsePngAsset(bytes) || parseJpegAsset(bytes) || parseWebpAsset(bytes);
  const expected = String(expectedContentType || "").trim().toLowerCase();
  if (!parsed || (expected && parsed.contentType !== expected)) {
    throw new WhiteboardSceneError(
      "The file is not a supported, structurally valid PNG, JPEG, or WebP image.",
      "WHITEBOARD_ASSET_INVALID"
    );
  }
  return { ...parsed, byteLength: bytes.byteLength, version: 1 };
}

export function decodeWhiteboardScene(update) {
  const bytes = normalizeUpdate(update);
  const document = new Y.Doc();
  try {
    if (bytes.byteLength) Y.applyUpdate(document, bytes);
    return readDocumentScene(document, bytes.byteLength);
  } catch (error) {
    throw new WhiteboardSceneError(
      "The whiteboard document is not a valid Yjs scene.",
      "WHITEBOARD_DOCUMENT_INVALID",
      { cause: error }
    );
  } finally {
    document.destroy();
  }
}

export function createWhiteboardIncrementalUpdate(currentUpdate, request, options = {}) {
  const bytes = normalizeUpdate(currentUpdate);
  const operationId = normalizeOperationId(request?.operationId);
  const operationNamespace = normalizeOperationNamespace(options.operationNamespace);
  const operationKey = `${operationNamespace}\u0000${operationId}`;
  const verifiedAssets = normalizeVerifiedAssets(options.assetMetadata);
  const requested = normalizeRequestedElements(request?.elements, verifiedAssets);
  const document = new Y.Doc();
  try {
    if (bytes.byteLength) Y.applyUpdate(document, bytes);
  } catch (error) {
    document.destroy();
    throw new WhiteboardSceneError(
      "The current whiteboard document is invalid.",
      "WHITEBOARD_DOCUMENT_INVALID",
      { cause: error }
    );
  }

  try {
    const elementsMap = document.getMap("elements");
    const assetsMap = document.getMap("assets");
    const ids = requested.map((_element, index) => deterministicElementId(operationKey, index));
    const existing = ids.map((id) => elementFromMap(id, elementsMap.get(id)));
    if (existing.every(Boolean)) {
      const operationHasAdditionalElements = Array.from(
        { length: MAX_ELEMENTS_PER_OPERATION - requested.length },
        (_unused, offset) => deterministicElementId(operationKey, requested.length + offset)
      ).some((id) => elementsMap.has(id));
      if (operationHasAdditionalElements) {
        throw new WhiteboardSceneError(
          "The operation id is already associated with a different element batch.",
          "WHITEBOARD_OPERATION_CONFLICT"
        );
      }
      existing.forEach((element, index) => {
        if (!sameJson(semanticProjection(element, assetsMap), requested[index])) {
          throw new WhiteboardSceneError(
            "The operation id is already associated with different whiteboard content.",
            "WHITEBOARD_OPERATION_CONFLICT"
          );
        }
      });
      return {
        operationId,
        replayed: true,
        updateBytes: null,
        addedElements: existing.map((element) => publicElement(element, assetsMap)),
        scene: readDocumentScene(document, bytes.byteLength)
      };
    }
    if (existing.some(Boolean)) {
      throw new WhiteboardSceneError(
        "The whiteboard contains only part of this operation; choose a new operation id.",
        "WHITEBOARD_OPERATION_PARTIAL"
      );
    }

    const lastIndex = findLastFractionalIndex(elementsMap);
    let indices;
    try {
      indices = generateNKeysBetween(lastIndex, null, requested.length);
    } catch {
      indices = generateNKeysBetween(null, null, requested.length);
    }
    document.clientID = deterministicClientId(operationKey, document);
    const stateVector = Y.encodeStateVector(document);
    const created = [];
    const basePosition = elementsMap.size;
    document.transact(() => {
      requested.forEach((element, index) => {
        const fileId = element.type === "image"
          ? ensureAssetReference(assetsMap, element.assetId, verifiedAssets.get(element.assetId))
          : undefined;
        const value = buildExcalidrawElement(element, {
          id: ids[index],
          index: indices[index],
          operationKey,
          position: index,
          fileId
        });
        const target = new Y.Map();
        for (const [key, field] of Object.entries(value)) {
          if (key !== "id" && field !== undefined) target.set(key, cloneJson(field));
        }
        target.set("__position", basePosition + index);
        elementsMap.set(value.id, target);
        created.push(value);
      });
    }, "lusu-agent-whiteboard");
    const updateBytes = Y.encodeStateAsUpdate(document, stateVector);
    if (!updateBytes.byteLength || updateBytes.byteLength > 256 * 1024) {
      throw new WhiteboardSceneError(
        "The generated whiteboard update is empty or too large.",
        "WHITEBOARD_UPDATE_SIZE_INVALID"
      );
    }
    return {
      operationId,
      replayed: false,
      updateBytes,
      addedElements: created.map((element) => publicElement(element, assetsMap)),
      scene: readDocumentScene(document, Y.encodeStateAsUpdate(document).byteLength)
    };
  } finally {
    document.destroy();
  }
}

export function summarizeWhiteboardScene(scene) {
  const elements = Array.isArray(scene?.elements) ? scene.elements : [];
  const active = elements.filter((element) => !element.isDeleted);
  return {
    documentBytes: safeInteger(scene?.documentBytes),
    elementCount: active.length,
    deletedElementCount: elements.length - active.length,
    assetCount: Array.isArray(scene?.assets) ? scene.assets.length : 0,
    elements: active.map((element) => publicElement(element, scene?.assets)),
    assets: (scene?.assets || []).map((asset) => ({
      fileId: String(asset.fileId || ""),
      assetId: String(asset.assetId || ""),
      contentType: String(asset.contentType || ""),
      width: safeInteger(asset.width),
      height: safeInteger(asset.height),
      byteLength: safeInteger(asset.byteLength)
    }))
  };
}

export async function renderWhiteboardExport(scene, format) {
  const normalizedFormat = String(format || "json").trim().toLowerCase();
  if (!new Set(["json", "svg", "png"]).has(normalizedFormat)) {
    throw new WhiteboardSceneError(
      "Whiteboard export format must be json, svg, or png.",
      "WHITEBOARD_EXPORT_FORMAT_INVALID"
    );
  }
  const elements = (scene?.elements || []).filter((element) => !element.isDeleted);
  const unsupported = elements.filter((element) => !VECTOR_EXPORT_TYPES.has(element.type));
  const warnings = [];
  if ((scene?.assets || []).length || elements.some((element) => element.type === "image")) {
    warnings.push("Image assets are referenced but are not embedded by the agent exporter.");
  }
  if (unsupported.length) {
    warnings.push(`${unsupported.length} unsupported element(s) were omitted from the visual export.`);
  }
  if (normalizedFormat === "json") {
    const payload = {
      type: "excalidraw",
      version: 2,
      source: "https://lusu575.com/tools/whiteboard",
      elements: elements.map((element) => cloneJson(element)),
      appState: { gridSize: null, viewBackgroundColor: "#ffffff" },
      files: {}
    };
    return {
      bytes: Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8"),
      mediaType: "application/json",
      warnings
    };
  }
  const visualElements = elements.filter((element) => VECTOR_EXPORT_TYPES.has(element.type));
  const svg = renderSvg(visualElements);
  if (normalizedFormat === "svg") {
    return { bytes: Buffer.from(svg, "utf8"), mediaType: "image/svg+xml", warnings };
  }
  let sharp;
  try {
    ({ default: sharp } = await import("sharp"));
  } catch (error) {
    throw new WhiteboardSceneError(
      "PNG export requires the local sharp dependency.",
      "WHITEBOARD_PNG_RUNTIME_UNAVAILABLE",
      { cause: error }
    );
  }
  const bytes = await sharp(Buffer.from(svg, "utf8"), {
    density: 144,
    limitInputPixels: MAX_EXPORT_DIMENSION * MAX_EXPORT_DIMENSION
  }).png().toBuffer();
  return { bytes, mediaType: "image/png", warnings };
}

function readDocumentScene(document, documentBytes) {
  const elements = [];
  document.getMap("elements").forEach((value, id) => {
    const element = elementFromMap(String(id), value);
    if (element) elements.push(element);
  });
  elements.sort(elementOrder);
  const assets = [];
  document.getMap("assets").forEach((value, fileId) => {
    if (!ELEMENT_ID_PATTERN.test(String(fileId)) || !isPlainObject(value)) return;
    assets.push({ fileId: String(fileId), ...cloneJson(value) });
  });
  return {
    documentBytes: safeInteger(documentBytes),
    elements: elements.slice(0, MAX_SCENE_ELEMENTS),
    assets: assets.slice(0, 100)
  };
}

function normalizeRequestedElements(value, verifiedAssets) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ELEMENTS_PER_OPERATION) {
    throw new WhiteboardSceneError(
      `A draw operation requires 1-${MAX_ELEMENTS_PER_OPERATION} elements.`,
      "WHITEBOARD_ELEMENTS_INVALID"
    );
  }
  return value.map((element) => normalizeRequestedElement(element, verifiedAssets));
}

function normalizeRequestedElement(value, verifiedAssets) {
  if (!isPlainObject(value)) {
    throw new WhiteboardSceneError("Each whiteboard element must be an object.", "WHITEBOARD_ELEMENT_INVALID");
  }
  const type = String(value.type || "").trim().toLowerCase();
  if (!APPENDABLE_TYPES.has(type)) {
    throw new WhiteboardSceneError(`Unsupported whiteboard element type: ${type || "<missing>"}.`, "WHITEBOARD_ELEMENT_TYPE_UNSUPPORTED");
  }
  if (type === "image") {
    assertOnlyElementFields(value, ["type", "assetId", "x", "y", "width", "height", "opacity"]);
    const assetId = normalizeAssetId(value.assetId);
    const metadata = verifiedAssets.get(assetId);
    if (!metadata) {
      throw new WhiteboardSceneError(
        "An image asset must be verified through the current whiteboard handle before drawing.",
        "WHITEBOARD_ASSET_NOT_VERIFIED"
      );
    }
    if (value.x === undefined || value.y === undefined) {
      throw new WhiteboardSceneError("Image elements require x and y coordinates.", "WHITEBOARD_IMAGE_POSITION_REQUIRED");
    }
    return {
      type,
      assetId,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: boundedInteger(value.opacity, 1, 100, 100),
      x: boundedNumber(value.x, -MAX_COORDINATE, MAX_COORDINATE, 0),
      y: boundedNumber(value.y, -MAX_COORDINATE, MAX_COORDINATE, 0),
      width: boundedNumber(value.width, 1, MAX_DIMENSION, Math.min(metadata.width, MAX_DIMENSION)),
      height: boundedNumber(value.height, 1, MAX_DIMENSION, Math.min(metadata.height, MAX_DIMENSION))
    };
  }
  const styleFields = [
    "strokeColor", "backgroundColor", "fillStyle", "strokeWidth",
    "strokeStyle", "roughness", "opacity"
  ];
  if (type === "line" || type === "arrow") {
    assertOnlyElementFields(value, ["type", "points", "startArrowhead", "endArrowhead", ...styleFields]);
  } else if (type === "text") {
    assertOnlyElementFields(value, ["type", "x", "y", "text", "fontSize", "width", "height", ...styleFields]);
  } else {
    assertOnlyElementFields(value, ["type", "x", "y", "width", "height", ...styleFields]);
  }
  const common = {
    type,
    strokeColor: normalizeColor(value.strokeColor, "#1e1e1e"),
    backgroundColor: normalizeColor(value.backgroundColor, "transparent", true),
    fillStyle: normalizeEnum(value.fillStyle, FILL_STYLES, "solid"),
    strokeWidth: boundedNumber(value.strokeWidth, 1, 8, 2),
    strokeStyle: normalizeEnum(value.strokeStyle, STROKE_STYLES, "solid"),
    roughness: boundedInteger(value.roughness, 0, 2, 0),
    opacity: boundedInteger(value.opacity, 1, 100, 100)
  };
  if (type === "line" || type === "arrow") {
    const points = normalizePoints(value.points);
    const x = points[0][0];
    const y = points[0][1];
    const relativePoints = points.map(([pointX, pointY]) => [pointX - x, pointY - y]);
    if (relativePoints.some(([pointX, pointY]) => (
      Math.abs(pointX) > MAX_COORDINATE || Math.abs(pointY) > MAX_COORDINATE
    ))) {
      throw new WhiteboardSceneError(
        "Line and arrow points may span at most 100000 units from their first point.",
        "WHITEBOARD_POINTS_SPAN_INVALID"
      );
    }
    return {
      ...common,
      x,
      y,
      points: relativePoints,
      width: Math.max(1, ...relativePoints.map(([pointX]) => Math.abs(pointX))),
      height: Math.max(1, ...relativePoints.map(([, pointY]) => Math.abs(pointY))),
      startArrowhead: type === "arrow" ? normalizeArrowhead(value.startArrowhead, null) : null,
      endArrowhead: type === "arrow" ? normalizeArrowhead(value.endArrowhead, "arrow") : null
    };
  }
  const x = boundedNumber(value.x, -MAX_COORDINATE, MAX_COORDINATE, 0);
  const y = boundedNumber(value.y, -MAX_COORDINATE, MAX_COORDINATE, 0);
  if (type === "text") {
    const text = String(value.text ?? "").normalize("NFC").trim();
    if (!text || text.length > MAX_TEXT_CHARS) {
      throw new WhiteboardSceneError(`Text elements require 1-${MAX_TEXT_CHARS} characters.`, "WHITEBOARD_TEXT_INVALID");
    }
    const fontSize = boundedNumber(value.fontSize, 8, 96, 20);
    const lines = text.split(/\r?\n/u);
    const estimatedWidth = Math.max(...lines.map((line) => Array.from(line).length), 1) * fontSize * 0.62;
    return {
      ...common,
      x,
      y,
      text,
      fontSize,
      width: boundedNumber(value.width, 1, MAX_DIMENSION, Math.max(20, estimatedWidth)),
      height: boundedNumber(value.height, 1, MAX_DIMENSION, Math.max(fontSize * 1.25, lines.length * fontSize * 1.25))
    };
  }
  return {
    ...common,
    x,
    y,
    width: boundedNumber(value.width, 1, MAX_DIMENSION, 160),
    height: boundedNumber(value.height, 1, MAX_DIMENSION, 100)
  };
}

function normalizeVerifiedAssets(value) {
  const output = new Map();
  const entries = value instanceof Map
    ? [...value.entries()]
    : Array.isArray(value)
      ? value.map((metadata) => [metadata?.assetId, metadata])
      : isPlainObject(value)
        ? Object.entries(value)
        : [];
  for (const [key, candidate] of entries) {
    const assetId = normalizeAssetId(candidate?.assetId || key);
    const contentType = String(candidate?.contentType || "").trim().toLowerCase();
    if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(contentType)) {
      throw new WhiteboardSceneError("Verified image metadata has an invalid media type.", "WHITEBOARD_ASSET_METADATA_INVALID");
    }
    const metadata = {
      assetId,
      contentType,
      byteLength: boundedAssetInteger(candidate?.byteLength, 1, MAX_IMAGE_BYTES),
      width: boundedAssetInteger(candidate?.width, 1, MAX_IMAGE_DIMENSION),
      height: boundedAssetInteger(candidate?.height, 1, MAX_IMAGE_DIMENSION),
      version: 1
    };
    if (metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
      throw new WhiteboardSceneError("Verified image dimensions exceed the pixel limit.", "WHITEBOARD_ASSET_METADATA_INVALID");
    }
    output.set(assetId, metadata);
  }
  return output;
}

function ensureAssetReference(assetsMap, assetId, metadata) {
  let matchingFileId = "";
  assetsMap.forEach((value, fileId) => {
    if (matchingFileId || !ELEMENT_ID_PATTERN.test(String(fileId))) return;
    const existing = assetRecord(value);
    if (existing?.assetId !== assetId) return;
    if (!sameJson(existing, metadata)) {
      throw new WhiteboardSceneError(
        "The whiteboard already contains conflicting metadata for this image.",
        "WHITEBOARD_ASSET_METADATA_CONFLICT"
      );
    }
    matchingFileId = String(fileId);
  });
  if (matchingFileId) return matchingFileId;
  const fileId = `agent_file_${digestHex(assetId).slice(0, 24)}`;
  const existing = assetsMap.get(fileId);
  if (existing !== undefined && !sameJson(assetRecord(existing), metadata)) {
    throw new WhiteboardSceneError(
      "The generated image file id conflicts with existing whiteboard data.",
      "WHITEBOARD_ASSET_FILE_ID_CONFLICT"
    );
  }
  if (existing === undefined) assetsMap.set(fileId, cloneJson(metadata));
  return fileId;
}

function assetMetadataForFileId(assets, fileId) {
  const normalizedFileId = String(fileId || "");
  if (!normalizedFileId) return null;
  if (assets instanceof Y.Map || assets instanceof Map) return assetRecord(assets.get(normalizedFileId));
  if (Array.isArray(assets)) {
    const match = assets.find((asset) => String(asset?.fileId || "") === normalizedFileId);
    return assetRecord(match);
  }
  return null;
}

function assetRecord(value) {
  if (value instanceof Y.Map) {
    const output = {};
    value.forEach((field, key) => { output[key] = cloneJson(field); });
    return output;
  }
  return isPlainObject(value) ? cloneJson(value) : null;
}

function assertOnlyElementFields(value, allowed) {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unsupported) {
    throw new WhiteboardSceneError(
      `Unsupported whiteboard element field: ${unsupported}.`,
      "WHITEBOARD_ELEMENT_FIELD_UNSUPPORTED"
    );
  }
}

function normalizeAssetId(value) {
  const assetId = String(value || "").trim();
  if (!ASSET_ID_PATTERN.test(assetId)) {
    throw new WhiteboardSceneError("A valid whiteboard asset id is required.", "WHITEBOARD_ASSET_ID_INVALID");
  }
  return assetId;
}

function boundedAssetInteger(value, min, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new WhiteboardSceneError("Verified image metadata is outside its safety bounds.", "WHITEBOARD_ASSET_METADATA_INVALID");
  }
  return number;
}

function buildExcalidrawElement(element, context) {
  const base = {
    id: context.id,
    type: element.type,
    x: element.x,
    y: element.y,
    strokeColor: element.strokeColor,
    backgroundColor: element.backgroundColor,
    fillStyle: element.fillStyle,
    strokeWidth: element.strokeWidth,
    strokeStyle: element.strokeStyle,
    roundness: null,
    roughness: element.roughness,
    opacity: element.opacity,
    width: element.width,
    height: element.height,
    angle: 0,
    seed: deterministicPositiveInteger(`${context.operationKey}:seed:${context.position}`),
    version: 1,
    versionNonce: deterministicPositiveInteger(`${context.operationKey}:nonce:${context.position}`),
    index: context.index,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: deterministicTimestamp(context.operationKey, context.position),
    link: null,
    locked: false
  };
  if (element.type === "image") {
    return {
      ...base,
      fileId: context.fileId,
      status: "saved",
      scale: [1, 1],
      crop: null
    };
  }
  if (element.type === "text") {
    return {
      ...base,
      fontSize: element.fontSize,
      fontFamily: 2,
      text: element.text,
      textAlign: "left",
      verticalAlign: "top",
      containerId: null,
      originalText: element.text,
      autoResize: true,
      lineHeight: 1.25
    };
  }
  if (element.type === "line" || element.type === "arrow") {
    return {
      ...base,
      points: element.points,
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: element.startArrowhead,
      endArrowhead: element.endArrowhead,
      ...(element.type === "arrow" ? { elbowed: false } : {})
    };
  }
  return base;
}

function publicElement(element, assets) {
  const output = {
    id: String(element.id || ""),
    type: String(element.type || ""),
    x: finiteNumber(element.x),
    y: finiteNumber(element.y),
    width: finiteNumber(element.width),
    height: finiteNumber(element.height),
    isDeleted: element.isDeleted === true,
    strokeColor: String(element.strokeColor || ""),
    backgroundColor: String(element.backgroundColor || ""),
    strokeWidth: finiteNumber(element.strokeWidth),
    opacity: finiteNumber(element.opacity)
  };
  if (typeof element.text === "string") output.text = element.text.slice(0, MAX_TEXT_CHARS);
  if (Array.isArray(element.points)) output.points = cloneJson(element.points.slice(0, MAX_POINTS));
  if (element.startArrowhead !== undefined) output.startArrowhead = element.startArrowhead;
  if (element.endArrowhead !== undefined) output.endArrowhead = element.endArrowhead;
  if (output.type === "image") {
    const metadata = assetMetadataForFileId(assets, element.fileId);
    if (metadata?.assetId) output.assetId = metadata.assetId;
  }
  return output;
}

function semanticProjection(element, assets) {
  const common = {
    type: String(element.type || ""),
    strokeColor: String(element.strokeColor || ""),
    backgroundColor: String(element.backgroundColor || ""),
    fillStyle: String(element.fillStyle || ""),
    strokeWidth: finiteNumber(element.strokeWidth),
    strokeStyle: String(element.strokeStyle || ""),
    roughness: finiteNumber(element.roughness),
    opacity: finiteNumber(element.opacity),
    x: finiteNumber(element.x),
    y: finiteNumber(element.y),
    width: finiteNumber(element.width),
    height: finiteNumber(element.height)
  };
  if (common.type === "text") return { ...common, text: String(element.text || ""), fontSize: finiteNumber(element.fontSize) };
  if (common.type === "line" || common.type === "arrow") {
    return {
      ...common,
      points: cloneJson(element.points || []),
      startArrowhead: element.startArrowhead ?? null,
      endArrowhead: element.endArrowhead ?? null
    };
  }
  if (common.type === "image") {
    return {
      ...common,
      assetId: String(assetMetadataForFileId(assets, element.fileId)?.assetId || "")
    };
  }
  return common;
}

function elementFromMap(id, value) {
  if (!ELEMENT_ID_PATTERN.test(id) || !(value instanceof Y.Map)) return null;
  const element = { id };
  try {
    value.forEach((field, key) => {
      if (key !== "id" && key !== "__position") element[key] = cloneJson(field);
    });
  } catch {
    return null;
  }
  return element;
}

function elementOrder(left, right) {
  const leftIndex = typeof left.index === "string" ? left.index : "";
  const rightIndex = typeof right.index === "string" ? right.index : "";
  if (leftIndex && rightIndex && leftIndex !== rightIndex) return leftIndex < rightIndex ? -1 : 1;
  if (leftIndex !== rightIndex) return leftIndex ? -1 : 1;
  return String(left.id).localeCompare(String(right.id));
}

function findLastFractionalIndex(elementsMap) {
  let last = null;
  elementsMap.forEach((value) => {
    if (!(value instanceof Y.Map)) return;
    const index = value.get("index");
    if (typeof index === "string" && (!last || index > last)) last = index;
  });
  return last;
}

function deterministicClientId(operationId, document) {
  const existing = Y.decodeStateVector(Y.encodeStateVector(document));
  let value = deterministicPositiveInteger(`${operationId}:client`);
  while (existing.has(value)) value = value === 0xffffffff ? 1 : value + 1;
  return value;
}

function deterministicElementId(operationId, position) {
  return `agent_${digestHex(`${operationId}:element:${position}`).slice(0, 24)}`;
}

function deterministicPositiveInteger(value) {
  return 1 + ((Number.parseInt(digestHex(value).slice(0, 8), 16) >>> 0) % 2_147_483_646);
}

function deterministicTimestamp(operationId, position) {
  const offset = Number.parseInt(digestHex(`${operationId}:updated:${position}`).slice(0, 10), 16);
  return 1_700_000_000_000 + (offset % 315_360_000_000);
}

function digestHex(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function normalizeOperationId(value) {
  const operationId = String(value || "").trim();
  if (!OPERATION_ID_PATTERN.test(operationId)) {
    throw new WhiteboardSceneError(
      "operationId must contain 8-80 safe ASCII characters.",
      "WHITEBOARD_OPERATION_ID_INVALID"
    );
  }
  return operationId;
}

function normalizeOperationNamespace(value) {
  const namespace = String(value || "whiteboard-local-default").trim();
  if (!/^[A-Za-z0-9_-]{8,160}$/.test(namespace)) {
    throw new WhiteboardSceneError(
      "The internal whiteboard operation namespace is invalid.",
      "WHITEBOARD_OPERATION_NAMESPACE_INVALID"
    );
  }
  return namespace;
}

function normalizeUpdate(value) {
  let bytes;
  if (value instanceof Uint8Array) bytes = value;
  else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
  else if (ArrayBuffer.isView(value)) bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  else if (value === undefined || value === null) bytes = new Uint8Array();
  else throw new WhiteboardSceneError("Whiteboard document bytes are required.", "WHITEBOARD_DOCUMENT_BYTES_REQUIRED");
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
    throw new WhiteboardSceneError("The whiteboard document exceeds the local safety limit.", "WHITEBOARD_DOCUMENT_TOO_LARGE");
  }
  return bytes;
}

function normalizeAssetBytes(value) {
  let bytes;
  if (value instanceof Uint8Array) bytes = value;
  else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
  else if (ArrayBuffer.isView(value)) bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  else throw new WhiteboardSceneError("Whiteboard image bytes are required.", "WHITEBOARD_ASSET_BYTES_REQUIRED");
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new WhiteboardSceneError("A whiteboard image must contain 1-5242880 bytes.", "WHITEBOARD_ASSET_SIZE_INVALID");
  }
  return bytes;
}

function parsePngAsset(bytes) {
  if (bytes.length < 58 || !PNG_SIGNATURE.every((value, index) => bytes[index] === value)) return null;
  let offset = 8;
  let header = null;
  let sawPalette = false;
  let sawImageData = false;
  let imageDataEnded = false;
  let imageDataLength = 0;
  let chunkCount = 0;
  const zlibHeader = [];
  while (offset < bytes.length) {
    chunkCount += 1;
    if (chunkCount > MAX_RASTER_CONTAINER_PARTS || offset + 12 > bytes.length) return null;
    const dataLength = readUint32Be(bytes, offset);
    if (dataLength > bytes.length - offset - 12) return null;
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + dataLength;
    const chunkEnd = dataEnd + 4;
    const typeBytes = bytes.subarray(typeStart, dataStart);
    if (typeBytes.length !== 4
      || !Array.from(typeBytes).every((value) => (value >= 0x41 && value <= 0x5a) || (value >= 0x61 && value <= 0x7a))
      || typeBytes[2] < 0x41 || typeBytes[2] > 0x5a
      || rasterCrc32(bytes, typeStart, dataEnd) !== readUint32Be(bytes, dataEnd)) return null;
    const type = asciiAt(bytes, typeStart, dataStart);
    if (!header) {
      if (offset !== 8 || type !== "IHDR" || dataLength !== 13) return null;
      header = validPngAssetHeader(bytes, dataStart);
      if (!header) return null;
    } else if (type === "IHDR") return null;
    else if (type === "PLTE") {
      if (sawPalette || sawImageData || header.colorType === 0 || header.colorType === 4
        || dataLength === 0 || dataLength % 3 !== 0 || dataLength > 768
        || (header.colorType === 3 && dataLength / 3 > 2 ** header.bitDepth)) return null;
      sawPalette = true;
    } else if (type === "IDAT") {
      if (imageDataEnded || (header.colorType === 3 && !sawPalette)) return null;
      sawImageData = true;
      imageDataLength += dataLength;
      for (let index = dataStart; index < dataEnd && zlibHeader.length < 2; index += 1) zlibHeader.push(bytes[index]);
    } else if (type === "IEND") {
      if (dataLength !== 0 || !sawImageData || imageDataLength < 8 || zlibHeader.length !== 2
        || (zlibHeader[0] & 0x0f) !== 8 || (zlibHeader[0] >>> 4) > 7
        || (((zlibHeader[0] << 8) | zlibHeader[1]) % 31) !== 0
        || (zlibHeader[1] & 0x20) !== 0 || chunkEnd !== bytes.length) return null;
      return { contentType: "image/png", width: header.width, height: header.height };
    } else {
      if (sawImageData) imageDataEnded = true;
      if (typeBytes[0] >= 0x41 && typeBytes[0] <= 0x5a) return null;
    }
    offset = chunkEnd;
  }
  return null;
}

function validPngAssetHeader(bytes, dataStart) {
  const width = readUint32Be(bytes, dataStart);
  const height = readUint32Be(bytes, dataStart + 4);
  const bitDepth = bytes[dataStart + 8];
  const colorType = bytes[dataStart + 9];
  const allowedDepths = new Map([
    [0, new Set([1, 2, 4, 8, 16])],
    [2, new Set([8, 16])],
    [3, new Set([1, 2, 4, 8])],
    [4, new Set([8, 16])],
    [6, new Set([8, 16])]
  ]);
  if (!safeImageDimensions(width, height) || !allowedDepths.get(colorType)?.has(bitDepth)
    || bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0
    || (bytes[dataStart + 12] !== 0 && bytes[dataStart + 12] !== 1)) return null;
  return { width, height, colorType, bitDepth };
}

function createRasterCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
}

function rasterCrc32(bytes, start, end) {
  let value = 0xffffffff;
  for (let index = start; index < end; index += 1) value = PNG_CRC_TABLE[(value ^ bytes[index]) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function parseJpegAsset(bytes) {
  if (bytes.length < 32 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  let width = 0;
  let height = 0;
  let frameMarker = 0;
  let frameComponents = new Set();
  let sawQuantizationTable = false;
  let sawHuffmanTable = false;
  let sawScan = false;
  let sawEntropyData = false;
  let segmentCount = 0;
  while (offset < bytes.length) {
    segmentCount += 1;
    if (segmentCount > MAX_RASTER_CONTAINER_PARTS || bytes[offset] !== 0xff) return null;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0x00 || marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) return null;
    if (marker === 0xd9) {
      return sawScan && sawEntropyData && width > 0 && offset === bytes.length
        ? { contentType: "image/jpeg", width, height }
        : null;
    }
    if (offset + 2 > bytes.length) return null;
    const segmentLength = readUint16Be(bytes, offset);
    if (segmentLength < 2 || segmentLength > bytes.length - offset) return null;
    const dataStart = offset + 2;
    const segmentEnd = offset + segmentLength;
    if (SUPPORTED_JPEG_FRAMES.has(marker)) {
      if (width !== 0 || segmentLength < 11) return null;
      const precision = bytes[dataStart];
      const parsedHeight = readUint16Be(bytes, dataStart + 1);
      const parsedWidth = readUint16Be(bytes, dataStart + 3);
      const componentCount = bytes[dataStart + 5];
      if ((precision !== 8 && precision !== 12) || componentCount < 1 || componentCount > 4
        || segmentLength !== 8 + componentCount * 3 || !safeImageDimensions(parsedWidth, parsedHeight)) return null;
      const componentIds = new Set();
      for (let index = 0; index < componentCount; index += 1) {
        const componentOffset = dataStart + 6 + index * 3;
        const id = bytes[componentOffset];
        const sampling = bytes[componentOffset + 1];
        if (componentIds.has(id) || (sampling >>> 4) < 1 || (sampling >>> 4) > 4
          || (sampling & 0x0f) < 1 || (sampling & 0x0f) > 4 || bytes[componentOffset + 2] > 3) return null;
        componentIds.add(id);
      }
      width = parsedWidth;
      height = parsedHeight;
      frameMarker = marker;
      frameComponents = componentIds;
    } else if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4) return null;
    else if (marker === 0xdb) {
      if (!validJpegAssetQuantizationTables(bytes, dataStart, segmentEnd)) return null;
      sawQuantizationTable = true;
    } else if (marker === 0xc4) {
      if (!validJpegAssetHuffmanTables(bytes, dataStart, segmentEnd)) return null;
      sawHuffmanTable = true;
    } else if (marker === 0xdd) {
      if (segmentLength !== 4) return null;
    } else if (marker === 0xda) {
      if (!width || !sawQuantizationTable || !sawHuffmanTable) return null;
      const componentCount = bytes[dataStart];
      if (componentCount < 1 || componentCount > frameComponents.size || segmentLength !== 6 + componentCount * 2) return null;
      const scanComponents = new Set();
      for (let index = 0; index < componentCount; index += 1) {
        const componentOffset = dataStart + 1 + index * 2;
        const id = bytes[componentOffset];
        const tables = bytes[componentOffset + 1];
        if (!frameComponents.has(id) || scanComponents.has(id) || (tables >>> 4) > 3 || (tables & 0x0f) > 3) return null;
        scanComponents.add(id);
      }
      const spectralStart = bytes[dataStart + 1 + componentCount * 2];
      const spectralEnd = bytes[dataStart + 2 + componentCount * 2];
      const approximation = bytes[dataStart + 3 + componentCount * 2];
      if (spectralStart > spectralEnd || spectralEnd > 63
        || (frameMarker !== 0xc2 && (spectralStart !== 0 || spectralEnd !== 63 || approximation !== 0))
        || (frameMarker === 0xc2 && ((spectralStart === 0 && spectralEnd !== 0)
          || (approximation >>> 4) > 13 || (approximation & 0x0f) > 13))) return null;
      sawScan = true;
      offset = segmentEnd;
      let scanHasEntropyData = false;
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) {
          scanHasEntropyData = true;
          sawEntropyData = true;
          offset += 1;
          continue;
        }
        const markerStart = offset;
        while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
        if (offset >= bytes.length) return null;
        const scanMarker = bytes[offset];
        if (scanMarker === 0x00) {
          scanHasEntropyData = true;
          sawEntropyData = true;
          offset += 1;
          continue;
        }
        if (scanMarker >= 0xd0 && scanMarker <= 0xd7) {
          offset += 1;
          continue;
        }
        offset = markerStart;
        break;
      }
      if (!scanHasEntropyData) return null;
      continue;
    } else if (!((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe)) return null;
    offset = segmentEnd;
  }
  return null;
}

function validJpegAssetQuantizationTables(bytes, start, end) {
  let offset = start;
  while (offset < end) {
    const tableInfo = bytes[offset];
    const precision = tableInfo >>> 4;
    if (precision > 1 || (tableInfo & 0x0f) > 3) return false;
    offset += 1 + 64 * (precision + 1);
    if (offset > end) return false;
  }
  return offset === end && start < end;
}

function validJpegAssetHuffmanTables(bytes, start, end) {
  let offset = start;
  while (offset < end) {
    if (offset + 17 > end) return false;
    const tableInfo = bytes[offset];
    if ((tableInfo >>> 4) > 1 || (tableInfo & 0x0f) > 3) return false;
    let symbolCount = 0;
    for (let index = 1; index <= 16; index += 1) symbolCount += bytes[offset + index];
    if (symbolCount === 0 || symbolCount > 256) return false;
    offset += 17 + symbolCount;
    if (offset > end) return false;
  }
  return offset === end && start < end;
}

function parseWebpAsset(bytes) {
  if (bytes.length < 26 || asciiAt(bytes, 0, 4) !== "RIFF" || asciiAt(bytes, 8, 12) !== "WEBP"
    || readUint32Le(bytes, 4) + 8 !== bytes.length) return null;
  const first = webpAssetChunkBounds(bytes, 12, bytes.length);
  if (!first || !["VP8X", "VP8 ", "VP8L"].includes(first.type)) return null;
  if (first.type === "VP8 " || first.type === "VP8L") {
    const payload = first.type === "VP8 "
      ? parseVp8AssetPayload(bytes, first.dataStart, first.size)
      : parseVp8lAssetPayload(bytes, first.dataStart, first.size);
    return payload && first.paddedEnd === bytes.length
      ? { contentType: "image/webp", width: payload.width, height: payload.height }
      : null;
  }
  if (first.size !== 10) return null;
  const flags = bytes[first.dataStart];
  if ((flags & 0xc1) !== 0 || bytes[first.dataStart + 1] !== 0
    || bytes[first.dataStart + 2] !== 0 || bytes[first.dataStart + 3] !== 0) return null;
  const width = readUint24Le(bytes, first.dataStart + 4) + 1;
  const height = readUint24Le(bytes, first.dataStart + 7) + 1;
  if (!safeImageDimensions(width, height)) return null;
  let offset = first.paddedEnd;
  let sawIcc = false;
  let sawAlpha = false;
  let sawAnimationHeader = false;
  let sawAnimationFrame = false;
  let sawImage = false;
  let sawExif = false;
  let sawXmp = false;
  let imageHasAlpha = false;
  let chunkCount = 0;
  while (offset < bytes.length) {
    chunkCount += 1;
    if (chunkCount > MAX_RASTER_CONTAINER_PARTS) return null;
    const chunk = webpAssetChunkBounds(bytes, offset, bytes.length);
    if (!chunk) return null;
    if (chunk.type === "ICCP") {
      if (sawIcc || sawImage || sawAnimationHeader || chunk.size === 0) return null;
      sawIcc = true;
    } else if (chunk.type === "ALPH") {
      if (sawAlpha || sawImage || sawAnimationHeader || chunk.size < 2 || (bytes[chunk.dataStart] & 0xc3) !== 0) return null;
      sawAlpha = true;
    } else if (chunk.type === "VP8 " || chunk.type === "VP8L") {
      if (sawImage || sawAnimationHeader || (chunk.type === "VP8L" && sawAlpha)) return null;
      const payload = chunk.type === "VP8 "
        ? parseVp8AssetPayload(bytes, chunk.dataStart, chunk.size)
        : parseVp8lAssetPayload(bytes, chunk.dataStart, chunk.size);
      if (!payload || payload.width !== width || payload.height !== height) return null;
      sawImage = true;
      imageHasAlpha = payload.hasAlpha || sawAlpha;
    } else if (chunk.type === "ANIM") {
      if (sawAnimationHeader || sawImage || sawAlpha || chunk.size !== 6) return null;
      sawAnimationHeader = true;
    } else if (chunk.type === "ANMF") {
      if (!sawAnimationHeader || sawImage || chunk.size <= 16) return null;
      const frameX = readUint24Le(bytes, chunk.dataStart) * 2;
      const frameY = readUint24Le(bytes, chunk.dataStart + 3) * 2;
      const frameWidth = readUint24Le(bytes, chunk.dataStart + 6) + 1;
      const frameHeight = readUint24Le(bytes, chunk.dataStart + 9) + 1;
      if ((bytes[chunk.dataStart + 15] & 0xfc) !== 0 || !safeImageDimensions(frameWidth, frameHeight)
        || frameX + frameWidth > width || frameY + frameHeight > height) return null;
      const frame = parseWebpAssetFrame(bytes, chunk.dataStart + 16, chunk.dataEnd);
      if (!frame || frame.width !== frameWidth || frame.height !== frameHeight) return null;
      sawAnimationFrame = true;
      imageHasAlpha ||= frame.hasAlpha;
    } else if (chunk.type === "EXIF") {
      if (sawExif || (!sawImage && !sawAnimationFrame) || chunk.size === 0) return null;
      sawExif = true;
    } else if (chunk.type === "XMP ") {
      if (sawXmp || (!sawImage && !sawAnimationFrame) || chunk.size === 0) return null;
      sawXmp = true;
    } else return null;
    offset = chunk.paddedEnd;
  }
  const animated = (flags & 0x02) !== 0;
  if (sawIcc !== ((flags & 0x20) !== 0) || imageHasAlpha !== ((flags & 0x10) !== 0)
    || sawExif !== ((flags & 0x08) !== 0) || sawXmp !== ((flags & 0x04) !== 0)
    || animated !== sawAnimationHeader
    || (animated ? !sawAnimationFrame || sawImage : !sawImage || sawAnimationFrame)) return null;
  return { contentType: "image/webp", width, height };
}

function parseVp8AssetPayload(bytes, start, size) {
  const frameTag = size >= 3 ? bytes[start] | (bytes[start + 1] << 8) | (bytes[start + 2] << 16) : 0;
  const firstPartitionLength = frameTag >>> 5;
  if (size < 11 || (bytes[start] & 1) !== 0 || firstPartitionLength === 0
    || 10 + firstPartitionLength > size || bytes[start + 3] !== 0x9d
    || bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) return null;
  const width = readUint16Le(bytes, start + 6) & 0x3fff;
  const height = readUint16Le(bytes, start + 8) & 0x3fff;
  return safeImageDimensions(width, height) ? { width, height, hasAlpha: false } : null;
}

function parseVp8lAssetPayload(bytes, start, size) {
  if (size < 6 || bytes[start] !== 0x2f) return null;
  const bits = readUint32Le(bytes, start + 1);
  if ((bits >>> 29) !== 0) return null;
  const width = (bits & 0x3fff) + 1;
  const height = ((bits >>> 14) & 0x3fff) + 1;
  return safeImageDimensions(width, height)
    ? { width, height, hasAlpha: (bits & 0x10000000) !== 0 }
    : null;
}

function webpAssetChunkBounds(bytes, offset, limit) {
  if (offset + 8 > limit) return null;
  const size = readUint32Le(bytes, offset + 4);
  const dataStart = offset + 8;
  if (size > limit - dataStart) return null;
  const dataEnd = dataStart + size;
  const paddedEnd = dataEnd + (size & 1);
  if (paddedEnd > limit || ((size & 1) !== 0 && bytes[dataEnd] !== 0)) return null;
  return { type: asciiAt(bytes, offset, offset + 4), dataStart, dataEnd, paddedEnd, size };
}

function parseWebpAssetFrame(bytes, start, end) {
  let offset = start;
  let sawAlpha = false;
  let payload = null;
  let chunkCount = 0;
  while (offset < end) {
    chunkCount += 1;
    if (chunkCount > MAX_RASTER_CONTAINER_PARTS) return null;
    const chunk = webpAssetChunkBounds(bytes, offset, end);
    if (!chunk) return null;
    if (chunk.type === "ALPH") {
      if (sawAlpha || payload || chunk.size < 2 || (bytes[chunk.dataStart] & 0xc3) !== 0) return null;
      sawAlpha = true;
    } else if (chunk.type === "VP8 ") {
      if (payload) return null;
      payload = parseVp8AssetPayload(bytes, chunk.dataStart, chunk.size);
      if (!payload) return null;
    } else if (chunk.type === "VP8L") {
      if (payload || sawAlpha) return null;
      payload = parseVp8lAssetPayload(bytes, chunk.dataStart, chunk.size);
      if (!payload) return null;
    } else return null;
    offset = chunk.paddedEnd;
  }
  return payload ? { ...payload, hasAlpha: payload.hasAlpha || sawAlpha } : null;
}

function safeImageDimensions(width, height) {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0
    && width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION
    && width * height <= MAX_IMAGE_PIXELS;
}

function asciiAt(bytes, start, end) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function readUint16Be(bytes, offset) { return (bytes[offset] << 8) | bytes[offset + 1]; }
function readUint16Le(bytes, offset) { return bytes[offset] | (bytes[offset + 1] << 8); }
function readUint24Le(bytes, offset) { return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16); }
function readUint32Be(bytes, offset) {
  return bytes[offset] * 0x1000000 + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]);
}
function readUint32Le(bytes, offset) {
  return bytes[offset] + bytes[offset + 1] * 0x100 + bytes[offset + 2] * 0x10000 + bytes[offset + 3] * 0x1000000;
}

function normalizePoints(value) {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_POINTS) {
    throw new WhiteboardSceneError(`Line and arrow elements require 2-${MAX_POINTS} points.`, "WHITEBOARD_POINTS_INVALID");
  }
  return value.map((point) => {
    const x = Array.isArray(point) ? point[0] : point?.x;
    const y = Array.isArray(point) ? point[1] : point?.y;
    if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) {
      throw new WhiteboardSceneError("Every whiteboard point requires finite x and y coordinates.", "WHITEBOARD_POINT_INVALID");
    }
    return [
      boundedNumber(x, -MAX_COORDINATE, MAX_COORDINATE, 0),
      boundedNumber(y, -MAX_COORDINATE, MAX_COORDINATE, 0)
    ];
  });
}

function normalizeArrowhead(value, fallback) {
  if (value === undefined) return fallback;
  const normalized = value === null ? null : String(value).trim().toLowerCase();
  if (!ARROWHEADS.has(normalized)) {
    throw new WhiteboardSceneError("Unsupported arrowhead style.", "WHITEBOARD_ARROWHEAD_INVALID");
  }
  return normalized;
}

function normalizeColor(value, fallback, allowTransparent = false) {
  const color = String(value ?? fallback).trim().toLowerCase();
  if (allowTransparent && color === "transparent") return color;
  if (!/^#[0-9a-f]{6}$/u.test(color)) {
    throw new WhiteboardSceneError("Colors must use six-digit hexadecimal notation.", "WHITEBOARD_COLOR_INVALID");
  }
  return color;
}

function normalizeEnum(value, allowed, fallback) {
  const normalized = String(value ?? fallback).trim().toLowerCase();
  if (!allowed.has(normalized)) {
    throw new WhiteboardSceneError("A whiteboard style value is unsupported.", "WHITEBOARD_STYLE_INVALID");
  }
  return normalized;
}

function boundedNumber(value, min, max, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new WhiteboardSceneError(`A whiteboard number must be between ${min} and ${max}.`, "WHITEBOARD_NUMBER_INVALID");
  }
  return Math.round(number * 1_000) / 1_000;
}

function boundedInteger(value, min, max, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new WhiteboardSceneError(`A whiteboard integer must be between ${min} and ${max}.`, "WHITEBOARD_NUMBER_INVALID");
  }
  return number;
}

function renderSvg(elements) {
  const bounds = sceneBounds(elements);
  const width = Math.min(MAX_EXPORT_DIMENSION, Math.max(1, Math.ceil(bounds.width)));
  const height = Math.min(MAX_EXPORT_DIMENSION, Math.max(1, Math.ceil(bounds.height)));
  const body = elements.map((element) => renderSvgElement(element, bounds)).join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" role="img" aria-label="Whiteboard export">`,
    `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="#ffffff"/>`,
    body,
    "</svg>",
    ""
  ].join("\n");
}

function sceneBounds(elements) {
  if (!elements.length) return { x: 0, y: 0, width: 640, height: 360 };
  const boxes = elements.map(elementBounds);
  const minX = Math.min(...boxes.map((box) => box.x)) - 24;
  const minY = Math.min(...boxes.map((box) => box.y)) - 24;
  const maxX = Math.max(...boxes.map((box) => box.x + box.width)) + 24;
  const maxY = Math.max(...boxes.map((box) => box.y + box.height)) + 24;
  return { x: minX, y: minY, width: Math.max(48, maxX - minX), height: Math.max(48, maxY - minY) };
}

function elementBounds(element) {
  if (element.type === "line" || element.type === "arrow") {
    const points = Array.isArray(element.points) ? element.points : [[0, 0]];
    const xs = points.map((point) => finiteNumber(element.x) + finiteNumber(point[0]));
    const ys = points.map((point) => finiteNumber(element.y) + finiteNumber(point[1]));
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return { x: minX, y: minY, width: Math.max(1, Math.max(...xs) - minX), height: Math.max(1, Math.max(...ys) - minY) };
  }
  return {
    x: finiteNumber(element.x),
    y: finiteNumber(element.y),
    width: Math.max(1, finiteNumber(element.width)),
    height: Math.max(1, finiteNumber(element.height))
  };
}

function renderSvgElement(element) {
  const stroke = xmlAttribute(element.strokeColor || "#1e1e1e");
  const fill = xmlAttribute(element.backgroundColor === "transparent" ? "none" : element.backgroundColor || "none");
  const strokeWidth = Math.max(1, finiteNumber(element.strokeWidth));
  const opacity = Math.max(0.01, Math.min(1, finiteNumber(element.opacity || 100) / 100));
  const dash = element.strokeStyle === "dashed" ? ' stroke-dasharray="10 8"' : element.strokeStyle === "dotted" ? ' stroke-dasharray="2 7" stroke-linecap="round"' : "";
  const style = `stroke="${stroke}" fill="${fill}" stroke-width="${strokeWidth}" opacity="${opacity}"${dash}`;
  const x = finiteNumber(element.x);
  const y = finiteNumber(element.y);
  const width = Math.max(1, finiteNumber(element.width));
  const height = Math.max(1, finiteNumber(element.height));
  if (element.type === "rectangle") return `<rect x="${x}" y="${y}" width="${width}" height="${height}" ${style}/>`;
  if (element.type === "ellipse") return `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" ${style}/>`;
  if (element.type === "diamond") {
    return `<polygon points="${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}" ${style}/>`;
  }
  if (element.type === "text") {
    const fontSize = Math.max(8, finiteNumber(element.fontSize || 20));
    const lines = String(element.text || "").split(/\r?\n/u);
    const spans = lines.map((line, index) => `<tspan x="${x}" dy="${index ? fontSize * 1.25 : 0}">${xmlText(line)}</tspan>`).join("");
    return `<text x="${x}" y="${y + fontSize}" fill="${stroke}" stroke="none" opacity="${opacity}" font-family="Arial, sans-serif" font-size="${fontSize}">${spans}</text>`;
  }
  const points = (element.points || []).map((point) => `${x + finiteNumber(point[0])},${y + finiteNumber(point[1])}`).join(" ");
  if (element.type === "line") return `<polyline points="${points}" ${style} fill="none"/>`;
  const markerId = `arrow_${xmlAttribute(element.id || "item")}`;
  return `<defs><marker id="${markerId}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="${stroke}"/></marker></defs><polyline points="${points}" ${style} fill="none"${element.endArrowhead ? ` marker-end="url(#${markerId})"` : ""}/>`;
}

function xmlText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function xmlAttribute(value) {
  return xmlText(value).replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function safeInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sameJson(left, right) {
  return stableJson(left) === stableJson(right);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
