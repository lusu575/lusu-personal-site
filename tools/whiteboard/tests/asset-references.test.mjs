import assert from "node:assert/strict";
import test from "node:test";
import * as Y from "yjs";
import {
  activeImageFileIds,
  pruneUnusedAssetReferences,
} from "../src/asset-references.js";
import { WhiteboardAssetManager } from "../src/assets.js";

const image = (id, fileId, isDeleted = false) => ({
  id,
  type: "image",
  fileId,
  isDeleted,
});

test("asset references remain until the last live image element is deleted", () => {
  const document = new Y.Doc();
  const assets = document.getMap("assets");
  assets.set("file_shared", { assetId: "asset_shared" });
  assets.set("file_deleted", { assetId: "asset_deleted" });
  assets.set("file_not_image", { assetId: "asset_not_image" });

  const firstScene = [
    image("image_a", "file_shared"),
    image("image_b", "file_shared"),
    image("image_deleted", "file_deleted", true),
    {
      id: "rectangle_with_file",
      type: "rectangle",
      fileId: "file_not_image",
      isDeleted: false,
    },
  ];
  assert.deepEqual([...activeImageFileIds(firstScene)], ["file_shared"]);
  assert.deepEqual(
    pruneUnusedAssetReferences(assets, activeImageFileIds(firstScene)).sort(),
    ["file_deleted", "file_not_image"],
  );
  assert.equal(assets.has("file_shared"), true);

  const oneReferenceLeft = [
    image("image_a", "file_shared", true),
    image("image_b", "file_shared"),
  ];
  assert.deepEqual(
    pruneUnusedAssetReferences(assets, activeImageFileIds(oneReferenceLeft)),
    [],
  );
  assert.equal(assets.has("file_shared"), true);

  const noReferencesLeft = [
    image("image_a", "file_shared", true),
    image("image_b", "file_shared", true),
  ];
  assert.deepEqual(
    pruneUnusedAssetReferences(assets, activeImageFileIds(noReferencesLeft)),
    ["file_shared"],
  );
  assert.equal(assets.has("file_shared"), false);
  document.destroy();
});

test("the upload manager ignores unreferenced files retained by Excalidraw", async () => {
  const uploads = [];
  const scene = {
    hasAsset: () => false,
    subscribeAssets(listener) {
      listener(new Map());
      return () => {};
    },
  };
  const manager = new WhiteboardAssetManager({
    scene,
    getApi: () => null,
    getAccessToken: () => "test-access",
  });
  manager.uploadLocalFile = async (fileId) => {
    uploads.push(fileId);
  };

  const files = {
    file_active: { dataURL: "data:image/png;base64,active" },
    file_shared: { dataURL: "data:image/png;base64,shared" },
    file_deleted: { dataURL: "data:image/png;base64,deleted" },
    file_cached_only: { dataURL: "data:image/png;base64,cached" },
  };
  manager.processFiles([
    image("active", "file_active"),
    image("shared_a", "file_shared"),
    image("shared_b", "file_shared"),
    image("deleted", "file_deleted", true),
  ], files);
  await Promise.all([...manager.inflightUploads.values()]);

  assert.deepEqual(uploads.sort(), ["file_active", "file_shared"]);
  assert.equal(manager.knownLocalFiles.has("file_deleted"), false);
  assert.equal(manager.knownLocalFiles.has("file_cached_only"), false);

  manager.processFiles([
    image("active", "file_active", true),
    image("shared_a", "file_shared", true),
    image("shared_b", "file_shared", true),
  ], files);
  await Promise.all([...manager.inflightUploads.values()]);
  assert.deepEqual(uploads.sort(), ["file_active", "file_shared"]);
  manager.destroy();
});
