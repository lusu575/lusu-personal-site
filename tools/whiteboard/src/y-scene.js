import * as Y from "yjs";
import {
  CaptureUpdateAction,
  reconcileElements,
} from "@excalidraw/excalidraw";
import {
  activeImageFileIds,
  pruneUnusedAssetReferences,
} from "./asset-references.js";
import {
  LOCAL_ASSET_ORIGIN,
  LOCAL_SCENE_ORIGIN,
  REMOTE_ORIGIN,
} from "./origins.js";

export {
  LOCAL_ASSET_ORIGIN,
  LOCAL_SCENE_ORIGIN,
  REMOTE_ORIGIN,
} from "./origins.js";

const ELEMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_SCENE_ELEMENTS = 5_000;
const MAX_ELEMENT_JSON_BYTES = 192 * 1024;

function jsonClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function sameJson(left, right) {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function normalizeElement(element) {
  if (
    !element
    || typeof element !== "object"
    || !ELEMENT_ID_PATTERN.test(String(element.id || ""))
  ) {
    return null;
  }
  let normalized;
  try {
    normalized = jsonClone(element);
    if (new Blob([JSON.stringify(normalized)]).size > MAX_ELEMENT_JSON_BYTES) {
      return null;
    }
  } catch {
    return null;
  }
  normalized.id = String(normalized.id);
  normalized.isDeleted = normalized.isDeleted === true;
  normalized.version = Math.max(1, Math.trunc(Number(normalized.version) || 1));
  normalized.versionNonce = Math.trunc(Number(normalized.versionNonce) || 0);
  if (typeof normalized.index !== "string") {
    delete normalized.index;
  }
  return normalized;
}

function elementFromMap(id, elementMap) {
  if (!(elementMap instanceof Y.Map)) return null;
  const element = { id };
  elementMap.forEach((value, key) => {
    if (key !== "id" && key !== "__position") {
      element[key] = jsonClone(value);
    }
  });
  return normalizeElement(element);
}

function elementOrder(left, right) {
  const leftIndex = typeof left.index === "string" ? left.index : "";
  const rightIndex = typeof right.index === "string" ? right.index : "";
  if (leftIndex && rightIndex && leftIndex !== rightIndex) {
    return leftIndex < rightIndex ? -1 : 1;
  }
  if (leftIndex !== rightIndex) {
    return leftIndex ? -1 : 1;
  }
  return left.id.localeCompare(right.id);
}

function sceneSignature(elements) {
  return elements.map((element) => [
    element.id,
    element.version,
    element.versionNonce,
    element.isDeleted ? 1 : 0,
    element.index || "",
  ].join(":")).join("|");
}

export class YSceneController {
  constructor() {
    this.api = null;
    this.destroyed = false;
    this.renderFrame = 0;
    this.latestElements = [];
    this.latestFiles = {};
    this.lastRemoteSignature = "";
    this.assetListeners = new Set();

    this.handleElementsChanged = (_events, transaction) => {
      if (transaction.origin !== LOCAL_SCENE_ORIGIN) {
        this.scheduleRender();
      }
    };
    this.handleAssetsChanged = () => {
      const assets = this.getAssetRecords();
      for (const listener of this.assetListeners) listener(assets);
      this.scheduleRender();
    };
    this.createDocument();
  }

  createDocument() {
    this.doc = new Y.Doc();
    this.elements = this.doc.getMap("elements");
    this.assets = this.doc.getMap("assets");
    this.elements.observeDeep(this.handleElementsChanged);
    this.assets.observe(this.handleAssetsChanged);
  }

  releaseDocument() {
    this.elements?.unobserveDeep(this.handleElementsChanged);
    this.assets?.unobserve(this.handleAssetsChanged);
    this.doc?.destroy();
  }

  bindApi(api) {
    this.api = api;
    this.scheduleRender();
  }

  getDocument() {
    return this.doc;
  }

  getElements() {
    const result = [];
    this.elements.forEach((value, id) => {
      const element = elementFromMap(String(id), value);
      if (element) result.push(element);
    });
    return result.slice(0, MAX_SCENE_ELEMENTS).sort(elementOrder);
  }

  getAssetRecords() {
    const result = new Map();
    this.assets.forEach((value, fileId) => {
      if (
        ELEMENT_ID_PATTERN.test(String(fileId))
        && value
        && typeof value === "object"
        && typeof value.assetId === "string"
      ) {
        result.set(String(fileId), jsonClone(value));
      }
    });
    return result;
  }

  hasAsset(fileId) {
    return this.assets.has(String(fileId || ""));
  }

  setAsset(fileId, metadata) {
    const safeFileId = String(fileId || "");
    if (!ELEMENT_ID_PATTERN.test(safeFileId)) return;
    const safeMetadata = {
      assetId: String(metadata.assetId || "").slice(0, 160),
      contentType: String(metadata.contentType || "").slice(0, 80),
      byteLength: Math.max(0, Math.trunc(Number(metadata.byteLength) || 0)),
      width: Math.max(0, Math.trunc(Number(metadata.width) || 0)),
      height: Math.max(0, Math.trunc(Number(metadata.height) || 0)),
      version: Math.max(1, Math.trunc(Number(metadata.version) || 1)),
    };
    if (!safeMetadata.assetId) return;
    this.doc.transact(() => {
      this.assets.set(safeFileId, safeMetadata);
    }, LOCAL_ASSET_ORIGIN);
  }

  subscribeAssets(listener) {
    this.assetListeners.add(listener);
    listener(this.getAssetRecords());
    return () => this.assetListeners.delete(listener);
  }

  handleSceneChange(elements, _appState, files) {
    if (this.destroyed) return;
    this.latestElements = Array.isArray(elements) ? elements : [];
    this.latestFiles = files && typeof files === "object" ? files : {};
    const signature = sceneSignature(this.latestElements);
    if (signature === this.lastRemoteSignature) {
      this.lastRemoteSignature = "";
      return;
    }
    this.syncLatestScene();
  }

  syncLatestScene() {
    if (this.destroyed || !Array.isArray(this.latestElements)) return;
    const assets = this.getAssetRecords();
    const boundedElements = this.latestElements.slice(0, MAX_SCENE_ELEMENTS);
    const eligible = boundedElements
      .filter((element) => {
        if (!element?.fileId) return true;
        if (element.isDeleted) return true;
        return assets.has(String(element.fileId));
      });

    this.doc.transact(() => {
      eligible.forEach((rawElement, position) => {
        const element = normalizeElement(rawElement);
        if (!element) return;
        let target = this.elements.get(element.id);
        if (!(target instanceof Y.Map)) {
          target = new Y.Map();
          this.elements.set(element.id, target);
        }
        const desiredKeys = new Set(Object.keys(element).filter((key) => key !== "id"));
        target.forEach((_value, key) => {
          if (key !== "__position" && !desiredKeys.has(key)) target.delete(key);
        });
        for (const [key, value] of Object.entries(element)) {
          if (key === "id" || value === undefined) continue;
          if (!sameJson(target.get(key), value)) target.set(key, jsonClone(value));
        }
        if (target.get("__position") !== position) target.set("__position", position);
      });
      pruneUnusedAssetReferences(
        this.assets,
        activeImageFileIds(this.getElements()),
      );
    }, LOCAL_SCENE_ORIGIN);
  }

  applyRemoteUpdate(update) {
    Y.applyUpdate(this.doc, update, REMOTE_ORIGIN);
  }

  resetFromServer() {
    this.releaseDocument();
    this.createDocument();
    this.latestElements = [];
    this.latestFiles = {};
    this.lastRemoteSignature = "";
    for (const listener of this.assetListeners) listener(new Map());
    this.api?.updateScene({
      elements: [],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    this.api?.history?.clear?.();
    return this.doc;
  }

  scheduleRender() {
    if (this.destroyed || this.renderFrame) return;
    this.renderFrame = window.requestAnimationFrame(() => {
      this.renderFrame = 0;
      this.renderRemoteScene();
    });
  }

  renderRemoteScene() {
    if (!this.api || this.destroyed) return;
    const remoteElements = this.getElements();
    const localElements = this.api.getSceneElementsIncludingDeleted();
    let reconciled;
    try {
      reconciled = reconcileElements(localElements, remoteElements, this.api.getAppState());
    } catch {
      reconciled = remoteElements;
    }
    this.lastRemoteSignature = sceneSignature(reconciled);
    this.api.updateScene({
      elements: reconciled,
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }

  destroy() {
    this.destroyed = true;
    if (this.renderFrame) window.cancelAnimationFrame(this.renderFrame);
    this.assetListeners.clear();
    this.releaseDocument();
    this.api = null;
  }
}
