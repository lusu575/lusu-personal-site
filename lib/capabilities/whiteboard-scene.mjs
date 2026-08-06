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
const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/;
const ELEMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const SUPPORTED_TYPES = new Set(["rectangle", "ellipse", "diamond", "text", "line", "arrow"]);
const FILL_STYLES = new Set(["solid", "hachure", "cross-hatch"]);
const STROKE_STYLES = new Set(["solid", "dashed", "dotted"]);
const ARROWHEADS = new Set(["arrow", "bar", "dot", "triangle", null]);

export class WhiteboardSceneError extends Error {
  constructor(message, code = "WHITEBOARD_SCENE_ERROR", options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "WhiteboardSceneError";
    this.code = code;
  }
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
  const requested = normalizeRequestedElements(request?.elements);
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
        if (!sameJson(semanticProjection(element), requested[index])) {
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
        addedElements: existing.map(publicElement),
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
        const value = buildExcalidrawElement(element, {
          id: ids[index],
          index: indices[index],
          operationKey,
          position: index
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
      addedElements: created.map(publicElement),
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
    elements: active.map(publicElement),
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
  const unsupported = elements.filter((element) => !SUPPORTED_TYPES.has(element.type));
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
  const visualElements = elements.filter((element) => SUPPORTED_TYPES.has(element.type));
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

function normalizeRequestedElements(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ELEMENTS_PER_OPERATION) {
    throw new WhiteboardSceneError(
      `A draw operation requires 1-${MAX_ELEMENTS_PER_OPERATION} elements.`,
      "WHITEBOARD_ELEMENTS_INVALID"
    );
  }
  return value.map(normalizeRequestedElement);
}

function normalizeRequestedElement(value) {
  if (!isPlainObject(value)) {
    throw new WhiteboardSceneError("Each whiteboard element must be an object.", "WHITEBOARD_ELEMENT_INVALID");
  }
  const type = String(value.type || "").trim().toLowerCase();
  if (!SUPPORTED_TYPES.has(type)) {
    throw new WhiteboardSceneError(`Unsupported whiteboard element type: ${type || "<missing>"}.`, "WHITEBOARD_ELEMENT_TYPE_UNSUPPORTED");
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

function publicElement(element) {
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
  return output;
}

function semanticProjection(element) {
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
