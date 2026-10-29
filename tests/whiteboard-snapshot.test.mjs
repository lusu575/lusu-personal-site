import test from "node:test";
import assert from "node:assert/strict";
import { fullWhiteboardSnapshot } from "../tools/whiteboard/src/private-snapshot.mjs";
test("snapshot passes all visible elements and loaded images to the real renderer contract", async () => {
 const elements = [{ id: "text", type: "text", text: "test" }, { id: "img", type: "image", fileId: "asset" }, { id: "deleted", isDeleted: true }];
 const files = { asset: { dataURL: "data:image/png;base64,aGVsbG8=" } };
 const api = { getSceneElements: () => elements, getFiles: () => files, getAppState: () => ({}) };
 const rendered = await fullWhiteboardSnapshot(api, async options => {
   assert.equal(options.elements.length, 2); assert.equal(options.files, files);
   assert.equal(options.exportPadding, 24);
   return new Blob([new Uint8Array([137,80,78,71])], { type: "image/png" });
 });
 assert.equal(rendered.imageCount, 1); assert.equal(rendered.elementCount, 2);
 assert.equal(rendered.image.mimeType, "image/png");
 await assert.rejects(fullWhiteboardSnapshot({ ...api, getFiles: () => ({}) }, () => { throw new Error("must not render missing image"); }), /IMAGE_NOT_LOADED/);
});
