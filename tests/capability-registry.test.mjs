import assert from "node:assert/strict";
import test from "node:test";

import {
  CAPABILITY_REGISTRY,
  filterCapabilities,
  getCapability,
  listCapabilities
} from "../lib/capabilities/registry.mjs";

test("capability registry has unique stable ids and complete machine-readable safety metadata", () => {
  assert.ok(CAPABILITY_REGISTRY.length >= 25);
  assert.equal(new Set(CAPABILITY_REGISTRY.map(({ id }) => id)).size, CAPABILITY_REGISTRY.length);
  assert.equal(Object.isFrozen(CAPABILITY_REGISTRY), true);

  for (const capability of CAPABILITY_REGISTRY) {
    assert.match(capability.id, /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
    assert.equal(typeof capability.scope, "string");
    assert.ok(capability.scope.includes(":"));
    assert.ok(capability.transport.length > 0);
    assert.ok(Array.isArray(capability.availableTransports));
    assert.ok(capability.availableTransports.every((transport) => capability.transport.includes(transport)));
    assert.equal(Object.isFrozen(capability), true);
    assert.equal(Object.isFrozen(capability.transport), true);
    assert.equal(Object.isFrozen(capability.availableTransports), true);
    assert.ok(Array.isArray(capability.requiredScopes));
    assert.ok(capability.requiredScopes.includes(capability.scope));
    assert.equal(Object.isFrozen(capability.requiredScopes), true);
    assert.ok(Array.isArray(capability.anyOfScopes));
    assert.equal(Object.isFrozen(capability.anyOfScopes), true);
    assert.equal(typeof capability.readOnly, "boolean");
    assert.equal(typeof capability.destructive, "boolean");
    assert.equal(typeof capability.idempotent, "boolean");
    assert.doesNotThrow(() => JSON.stringify(capability));
  }
});

test("registry list, get, and filter APIs expose only matching capabilities", () => {
  const listed = listCapabilities();
  assert.notEqual(listed, CAPABILITY_REGISTRY);
  assert.deepEqual(listed, CAPABILITY_REGISTRY);

  const articleGet = getCapability("content.articles.get");
  assert.equal(articleGet?.scope, "content:read");
  assert.equal(articleGet?.status, "available");
  assert.equal(getCapability("missing.capability"), null);
  assert.deepEqual(
    filterCapabilities({ domain: "knowledge-management", status: "available" }).map(({ id }) => id),
    [
      "content.articles.manage-list",
      "content.articles.manage-get",
      "content.articles.publish",
      "content.articles.update",
      "content.articles.delete"
    ]
  );
  assert.equal(getCapability("content.articles.publish")?.scope, "content:write");
  assert.equal(getCapability("content.articles.publish")?.idempotent, true);
  assert.equal(getCapability("content.articles.delete")?.scope, "content:delete");
  assert.equal(getCapability("content.articles.delete")?.destructive, true);
  assert.deepEqual(getCapability("content.articles.publish")?.availableTransports, [
    "site-api", "local-mcp", "cli"
  ]);

  const remoteReads = listCapabilities({
    availableTransports: "remote-mcp",
    readOnly: true,
    status: "available"
  });
  assert.ok(remoteReads.some(({ id }) => id === "content.articles.list"));
  assert.ok(remoteReads.some(({ id }) => id === "content.articles.get"));
  assert.ok(remoteReads.every(({ availableTransports }) => availableTransports.includes("remote-mcp")));
  assert.ok(remoteReads.every(({ readOnly, status }) => readOnly && status === "available"));
  assert.equal(remoteReads.some(({ id }) => id === "content.videos.list"), false);

  assert.deepEqual(
    filterCapabilities({ domain: "transfer", destructive: true }).map(({ id }) => id),
    ["transfer.items.delete"]
  );
  assert.deepEqual(
    filterCapabilities({ domain: "whiteboard", status: "available" }).map(({ id }) => id),
    [
      "whiteboard.rooms.join",
      "whiteboard.scene.read",
      "whiteboard.scene.apply",
      "whiteboard.assets.upload",
      "whiteboard.scene.images.apply",
      "whiteboard.assets.download",
      "whiteboard.scene.export"
    ]
  );
  assert.deepEqual(
    filterCapabilities({ domain: "whiteboard", availableTransports: "browser-adapter" }),
    []
  );
  assert.deepEqual(
    filterCapabilities({ domain: "games", availableTransports: "local-mcp" })
      .filter(({ status }) => status === "available")
      .map(({ id }) => id),
    [
      "games.catalog.list",
      "games.catalog.get",
      "games.session.create",
      "games.session.observe",
      "games.session.actions",
      "games.session.act",
      "games.session.reset",
      "games.session.close"
    ]
  );
  assert.ok(filterCapabilities({ risk: ["high", "critical"] }).length > 0);
  assert.throws(() => filterCapabilities({ unknown: true }), /Unsupported capability filter/);

  const assetUpload = getCapability("whiteboard.assets.upload");
  assert.deepEqual(assetUpload.requiredScopes, ["whiteboard:write", "whiteboard:assets"]);
  assert.deepEqual(assetUpload.anyOfScopes, []);
  assert.equal(assetUpload.idempotent, true);
  const assetDownload = getCapability("whiteboard.assets.download");
  assert.deepEqual(assetDownload.requiredScopes, ["whiteboard:assets"]);
  assert.deepEqual(assetDownload.anyOfScopes, ["whiteboard:read", "whiteboard:write"]);
  assert.deepEqual(assetDownload.availableTransports, ["site-api", "local-mcp", "cli"]);
  assert.deepEqual(
    filterCapabilities({ anyOfScopes: "whiteboard:write" }).map(({ id }) => id),
    ["whiteboard.assets.download"]
  );
  assert.ok(
    filterCapabilities({ requiredScopes: "whiteboard:assets" })
      .some(({ id }) => id === "whiteboard.assets.upload")
  );
  assert.deepEqual(
    getCapability("whiteboard.scene.images.apply").requiredScopes,
    ["whiteboard:write", "whiteboard:assets"]
  );
});

test("phase-three public reads declare only transports with implemented adapters", () => {
  const videoGet = getCapability("content.videos.get");
  assert.equal(videoGet?.status, "available");
  assert.deepEqual(videoGet?.availableTransports, ["site-api", "local-mcp", "cli"]);

  const toolsCatalog = getCapability("content.tools.catalog");
  assert.equal(toolsCatalog?.status, "available");
  assert.deepEqual(toolsCatalog?.transport, ["local-mcp", "cli"]);
  assert.deepEqual(toolsCatalog?.availableTransports, ["local-mcp", "cli"]);

  assert.deepEqual(
    filterCapabilities({ domain: "japanese-subtext", status: "available" }).map(({ id }) => id),
    [
      "japanese-subtext.levels.list",
      "japanese-subtext.stages.list",
      "japanese-subtext.stages.get",
      "japanese-subtext.progress.get",
      "japanese-subtext.attempts.submit"
    ]
  );
  assert.deepEqual(
    getCapability("japanese-subtext.progress.get")?.availableTransports,
    ["site-api", "local-mcp", "cli"]
  );
  assert.deepEqual(
    getCapability("japanese-subtext.attempts.submit")?.availableTransports,
    ["site-api", "local-mcp", "cli"]
  );
  assert.deepEqual(
    getCapability("japanese-subtext.progress.update")?.availableTransports,
    ["site-api"]
  );
  assert.deepEqual(
    ["games.catalog.list", "games.catalog.get"].map((id) => getCapability(id)?.availableTransports),
    [
      ["site-api", "local-mcp", "cli"],
      ["site-api", "local-mcp", "cli"]
    ]
  );

  const remotePhaseThree = [
    "content.videos.get",
    "content.tools.catalog",
    "games.catalog.list",
    "games.catalog.get",
    "japanese-subtext.levels.list",
    "japanese-subtext.stages.list",
    "japanese-subtext.stages.get"
  ].filter((id) => getCapability(id)?.availableTransports.includes("remote-mcp"));
  assert.deepEqual(remotePhaseThree, []);
});
