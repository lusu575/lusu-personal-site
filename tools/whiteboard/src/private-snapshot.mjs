/** Uses Excalidraw's renderer and the currently joined room's loaded files. */
export async function fullWhiteboardSnapshot(api, exportToBlob) {
  if (!api) throw new Error("WHITEBOARD_NOT_READY");
  const elements = api.getSceneElements().filter(element => !element.isDeleted);
  const files = api.getFiles();
  if (elements.length > 5000) throw new Error("WHITEBOARD_SNAPSHOT_TOO_LARGE");
  for (const element of elements) {
    if (element.type === "image" && !files[element.fileId]?.dataURL) {
      throw new Error("WHITEBOARD_IMAGE_NOT_LOADED");
    }
  }
  const blob = await exportToBlob({ elements, files,
    appState: { ...api.getAppState(), exportBackground: true, exportWithDarkMode: false },
    mimeType: "image/png", exportPadding: 24 });
  if (blob.type !== "image/png" || blob.size > 2 * 1024 * 1024) throw new Error("WHITEBOARD_SNAPSHOT_TOO_LARGE");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return { source: "live-whiteboard", elementCount: elements.length,
    imageCount: elements.filter(element => element.type === "image").length,
    image: { mimeType: "image/png", data: btoa(binary) } };
}
