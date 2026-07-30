import assert from "node:assert/strict";
import test from "node:test";

import {
  WHITEBOARD_IMAGE_ACCEPT,
  whiteboardImageFilesAreSupported,
} from "../src/assets.js";

test("image inputs advertise exactly the raster formats accepted by the upload path", () => {
  assert.equal(WHITEBOARD_IMAGE_ACCEPT, "image/png,image/jpeg,image/webp");
  assert.equal(whiteboardImageFilesAreSupported([
    { type: "image/png" },
    { type: "image/jpeg" },
    { type: "image/webp" },
  ]), true);
});

test("unsupported and ambiguous image files are rejected before Excalidraw handles them", () => {
  for (const type of [
    "",
    "image/heic",
    "image/heif",
    "image/svg+xml",
    "image/gif",
    "image/avif",
    "image/bmp",
  ]) {
    assert.equal(
      whiteboardImageFilesAreSupported([{ type }]),
      false,
      `${type || "empty MIME"} must be rejected`,
    );
  }
  assert.equal(whiteboardImageFilesAreSupported([]), true);
});
