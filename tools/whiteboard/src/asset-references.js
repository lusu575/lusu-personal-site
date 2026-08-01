const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const ELEMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function activeImageFileIds(elements) {
  const active = new Set();
  if (!Array.isArray(elements)) return active;
  for (const element of elements) {
    if (
      element?.type !== "image"
      || element.isDeleted === true
      || !ELEMENT_ID_PATTERN.test(String(element.id || ""))
      || !FILE_ID_PATTERN.test(String(element.fileId || ""))
    ) {
      continue;
    }
    active.add(String(element.fileId));
  }
  return active;
}

export function pruneUnusedAssetReferences(assets, activeFileIds) {
  if (!assets || typeof assets.forEach !== "function" || typeof assets.delete !== "function") {
    return [];
  }
  const active = activeFileIds instanceof Set ? activeFileIds : new Set();
  const removed = [];
  assets.forEach((_metadata, fileId) => {
    const normalized = String(fileId || "");
    if (!active.has(normalized)) removed.push(normalized);
  });
  removed.forEach((fileId) => assets.delete(fileId));
  return removed;
}
