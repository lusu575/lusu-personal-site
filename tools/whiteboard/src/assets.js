import { activeImageFileIds } from "./asset-references.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SAFE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const WHITEBOARD_IMAGE_ACCEPT = [...SAFE_IMAGE_TYPES].join(",");

export function whiteboardImageFilesAreSupported(fileList) {
  const files = Array.from(fileList || []);
  return files.length === 0 || files.every((file) => (
    SAFE_IMAGE_TYPES.has(String(file?.type || "").toLowerCase())
  ));
}

function dataUrlToBlob(dataUrl) {
  if (
    typeof dataUrl !== "string"
    || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(dataUrl)
  ) {
    throw new Error("unsupported-image");
  }
  return fetch(dataUrl).then((response) => response.blob());
}

async function hasSafeRasterSignature(blob) {
  const bytes = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
  const png = bytes.length >= 8
    && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value);
  const jpeg = bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff;
  const webp = bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return png || jpeg || webp;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
    reader.addEventListener("error", () => reject(new Error("file-read-failed")), { once: true });
    reader.readAsDataURL(blob);
  });
}

function normalizeUploadResponse(payload, blob) {
  const source = payload?.asset && typeof payload.asset === "object"
    ? payload.asset
    : payload;
  const assetId = String(source?.assetId || source?.id || "");
  if (!assetId || assetId.length > 160) throw new Error("invalid-asset-response");
  return {
    assetId,
    contentType: SAFE_IMAGE_TYPES.has(String(source?.contentType || ""))
      ? String(source.contentType)
      : blob.type,
    byteLength: Math.max(0, Math.trunc(Number(source?.byteLength) || blob.size)),
    width: Math.max(0, Math.trunc(Number(source?.width) || 0)),
    height: Math.max(0, Math.trunc(Number(source?.height) || 0)),
    version: Math.max(1, Math.trunc(Number(source?.version) || 1)),
  };
}

function assetFetchPath(metadata) {
  const assetId = String(metadata?.assetId || "");
  if (!assetId || assetId.length > 160) throw new Error("invalid-asset-id");
  return `/api/whiteboard/assets/${encodeURIComponent(assetId)}`;
}

export class WhiteboardAssetManager {
  constructor({ scene, getApi, getAccessToken, onError, onUploaded }) {
    this.scene = scene;
    this.getApi = getApi;
    this.getAccessToken = getAccessToken;
    this.onError = onError;
    this.onUploaded = onUploaded;
    this.inflightUploads = new Map();
    this.inflightDownloads = new Map();
    this.knownLocalFiles = new Set();
    this.destroyed = false;
    this.unsubscribe = scene.subscribeAssets((records) => this.loadRemoteAssets(records));
  }

  processFiles(elements, files) {
    if (this.destroyed || !files || typeof files !== "object") return;
    activeImageFileIds(elements).forEach((fileId) => {
      const file = files[fileId];
      if (!file || !FILE_ID_PATTERN.test(fileId)) return;
      this.knownLocalFiles.add(fileId);
      if (
        this.scene.hasAsset(fileId)
        || this.inflightUploads.has(fileId)
        || typeof file?.dataURL !== "string"
      ) {
        return;
      }
      const task = this.uploadLocalFile(fileId, file)
        .catch((error) => this.onError?.(error))
        .finally(() => this.inflightUploads.delete(fileId));
      this.inflightUploads.set(fileId, task);
    });
  }

  async uploadLocalFile(fileId, file) {
    const blob = await dataUrlToBlob(file.dataURL);
    if (!SAFE_IMAGE_TYPES.has(blob.type)) throw new Error("unsupported-image");
    if (blob.size <= 0 || blob.size > MAX_IMAGE_BYTES) throw new Error("image-too-large");
    if (!(await hasSafeRasterSignature(blob))) throw new Error("unsupported-image");
    const token = this.getAccessToken();
    if (!token) throw new Error("missing-room-access");

    const response = await fetch("/api/whiteboard/assets", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": blob.type,
      },
      body: blob,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) throw new Error("image-upload-failed");
    const metadata = normalizeUploadResponse(payload, blob);
    this.scene.setAsset(fileId, metadata);
    this.scene.syncLatestScene();
    this.onUploaded?.();
  }

  loadRemoteAssets(records) {
    if (this.destroyed) return;
    for (const [fileId, metadata] of records) {
      if (
        this.knownLocalFiles.has(fileId)
        || this.inflightDownloads.has(fileId)
        || !FILE_ID_PATTERN.test(fileId)
      ) {
        continue;
      }
      const task = this.downloadRemoteAsset(fileId, metadata)
        .catch((error) => this.onError?.(error))
        .finally(() => this.inflightDownloads.delete(fileId));
      this.inflightDownloads.set(fileId, task);
    }
  }

  async downloadRemoteAsset(fileId, metadata) {
    const token = this.getAccessToken();
    if (!token) throw new Error("missing-room-access");
    const response = await fetch(assetFetchPath(metadata), {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "image/png,image/jpeg,image/webp",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error("image-download-failed");
    const blob = await response.blob();
    if (
      !SAFE_IMAGE_TYPES.has(blob.type)
      || blob.size <= 0
      || blob.size > MAX_IMAGE_BYTES
      || !(await hasSafeRasterSignature(blob))
    ) {
      throw new Error("unsupported-image");
    }
    const api = this.getApi();
    if (!api || this.destroyed) return;
    const dataURL = await blobToDataUrl(blob);
    api.addFiles([{
      id: fileId,
      mimeType: blob.type,
      dataURL,
      created: Date.now(),
      lastRetrieved: Date.now(),
      version: Math.max(1, Math.trunc(Number(metadata.version) || 1)),
    }]);
    this.knownLocalFiles.add(fileId);
    api.refresh?.();
  }

  destroy() {
    this.destroyed = true;
    this.unsubscribe?.();
    this.inflightUploads.clear();
    this.inflightDownloads.clear();
    this.knownLocalFiles.clear();
  }
}
