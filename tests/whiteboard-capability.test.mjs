import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import * as Y from "yjs";
import {
  createWhiteboardIncrementalUpdate,
  decodeWhiteboardScene,
  renderWhiteboardExport,
  summarizeWhiteboardScene
} from "../lib/capabilities/whiteboard-scene.mjs";
import { SiteClient } from "../lib/capabilities/site-client.mjs";
import {
  loadWhiteboardRecord,
  storeWhiteboardHandle
} from "../lib/capabilities/local-state.mjs";

const ACCESS_TOKEN = `wbt1.${"a".repeat(80)}`;

test("whiteboard scene adapter creates deterministic high-level elements and detects replay", () => {
  const empty = Y.encodeStateAsUpdate(new Y.Doc());
  const request = {
    operationId: "draw_diagram_0001",
    elements: [
      { type: "rectangle", x: 20, y: 30, width: 180, height: 90, backgroundColor: "#dbeafe" },
      { type: "text", x: 45, y: 55, text: "Agent-safe scene" },
      { type: "arrow", points: [[200, 75], [320, 75]], strokeColor: "#2563eb" }
    ]
  };
  const created = createWhiteboardIncrementalUpdate(empty, request);
  assert.equal(created.replayed, false);
  assert.ok(created.updateBytes.byteLength > 0);
  assert.equal(created.addedElements.length, 3);

  const document = new Y.Doc();
  Y.applyUpdate(document, empty);
  Y.applyUpdate(document, created.updateBytes);
  const committed = Y.encodeStateAsUpdate(document);
  const scene = decodeWhiteboardScene(committed);
  assert.equal(summarizeWhiteboardScene(scene).elementCount, 3);

  const replay = createWhiteboardIncrementalUpdate(committed, request);
  assert.equal(replay.replayed, true);
  assert.equal(replay.updateBytes, null);
  assert.throws(
    () => createWhiteboardIncrementalUpdate(committed, {
      ...request,
      elements: [{ type: "text", x: 0, y: 0, text: "changed" }]
    }),
    { code: "WHITEBOARD_OPERATION_CONFLICT" }
  );
  assert.throws(
    () => createWhiteboardIncrementalUpdate(committed, {
      ...request,
      elements: request.elements.slice(0, 2)
    }),
    { code: "WHITEBOARD_OPERATION_CONFLICT" }
  );

  const otherNamespace = createWhiteboardIncrementalUpdate(committed, request, {
    operationNamespace: "board_other_agent_0001"
  });
  assert.equal(otherNamespace.replayed, false);
  assert.notDeepEqual(
    otherNamespace.addedElements.map(({ id }) => id),
    created.addedElements.map(({ id }) => id)
  );
});

test("whiteboard exporter produces importable JSON, escaped SVG, and PNG bytes", async () => {
  const created = createWhiteboardIncrementalUpdate(new Uint8Array(), {
    operationId: "export_scene_0001",
    elements: [
      { type: "ellipse", x: -10, y: 5, width: 120, height: 80, backgroundColor: "#fef3c7" },
      { type: "text", x: 5, y: 20, text: "<safe & visible>" }
    ]
  });
  const scene = created.scene;
  const json = await renderWhiteboardExport(scene, "json");
  const parsed = JSON.parse(json.bytes.toString("utf8"));
  assert.equal(parsed.type, "excalidraw");
  assert.equal(parsed.elements.length, 2);

  const svg = await renderWhiteboardExport(scene, "svg");
  assert.match(svg.bytes.toString("utf8"), /&lt;safe &amp; visible&gt;/);
  assert.doesNotMatch(svg.bytes.toString("utf8"), /<safe & visible>/);

  const png = await renderWhiteboardExport(scene, "png");
  assert.deepEqual([...png.bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("whiteboard SiteClient keeps agent and room tokens in separate headers", async () => {
  const calls = [];
  const client = new SiteClient({
    baseUrl: "https://example.test",
    accessToken: "agent-token",
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith("/rooms/join")) {
        return new Response(JSON.stringify({
          room: { type: "private" },
          accessToken: ACCESS_TOKEN,
          accessExpiresAt: "2030-01-01T00:00:00.000Z"
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (options.method === "POST") {
        return new Response(JSON.stringify({ ok: true, replayed: false, documentVersion: 2 }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(Y.encodeStateAsUpdate(new Y.Doc()), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.yjs",
          "X-Whiteboard-Document-Version": "1",
          "X-Whiteboard-Locked": "0"
        }
      });
    }
  });

  await client.joinWhiteboardRoom({ type: "private", password: "secret room" });
  const scene = await client.getWhiteboardScene(ACCESS_TOKEN);
  assert.equal(scene.documentVersion, 1);
  await client.applyWhiteboardUpdate(ACCESS_TOKEN, new Uint8Array([1, 2, 3]), {
    operationId: "client_draw_0001"
  });

  assert.equal(calls[0].options.headers.get("Authorization"), "Bearer agent-token");
  assert.equal(JSON.parse(calls[0].options.body).password, "secret room");
  assert.equal(calls[1].options.headers.get("Authorization"), "Bearer agent-token");
  assert.equal(calls[1].options.headers.get("X-Whiteboard-Access-Token"), ACCESS_TOKEN);
  assert.equal(calls[2].options.headers.get("X-Whiteboard-Operation-Id"), "client_draw_0001");
  assert.equal(calls[2].options.headers.get("Content-Type"), "application/vnd.yjs-update");
});

test("whiteboard handles persist opaque room credentials without plaintext passwords", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-whiteboard-state-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const stateOptions = { env: { LUSU_CONFIG_DIR: directory } };
  const boardHandle = await storeWhiteboardHandle({
    room: { type: "private" },
    accessToken: ACCESS_TOKEN,
    accessExpiresAt: "2030-01-01T00:00:00Z"
  }, { ...stateOptions, secretRef: "env:LUSU_WHITEBOARD_SECRET" });
  const record = await loadWhiteboardRecord(boardHandle, stateOptions);
  assert.equal(record.roomType, "private");
  assert.equal(record.secretRef, "env:LUSU_WHITEBOARD_SECRET");
  const stored = await fs.readFile(path.join(directory, "whiteboards.json"), "utf8");
  assert.equal(stored.includes("secret room"), false);
  assert.equal(stored.includes(ACCESS_TOKEN), true);
});

test("whiteboard handle storage preserves 32 concurrent mutations across processes", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-whiteboard-concurrent-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const moduleUrl = new URL("../lib/capabilities/local-state.mjs", import.meta.url).href;
  const childScript = `
    const { storeWhiteboardHandle } = await import(process.argv[1]);
    const directory = process.argv[2];
    const worker = Number(process.argv[3]);
    const accessToken = \`wbt1.\${"a".repeat(80)}\`;
    await Promise.all(Array.from({ length: 8 }, (_, index) =>
      storeWhiteboardHandle({ room: { type: "public" }, accessToken }, {
        env: { LUSU_CONFIG_DIR: directory },
        boardHandle: \`board_worker_\${worker}_\${index}_parallel\`
      })
    ));
  `;

  await Promise.all(Array.from({ length: 4 }, (_, worker) => runNodeChild([
    "--input-type=module",
    "-e",
    childScript,
    moduleUrl,
    directory,
    String(worker)
  ])));

  const stateFile = path.join(directory, "whiteboards.json");
  const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
  assert.equal(Object.keys(state.boards).length, 32);
  for (let worker = 0; worker < 4; worker += 1) {
    for (let index = 0; index < 8; index += 1) {
      assert.ok(state.boards[`board_worker_${worker}_${index}_parallel`]);
    }
  }
  assert.equal(await fs.stat(`${stateFile}.lock`).catch(() => null), null);
  if (process.platform !== "win32") {
    assert.equal((await fs.stat(stateFile)).mode & 0o077, 0);
  }
});

test("whiteboard state promotion preserves the previous JSON when rename is interrupted", { concurrency: false }, async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-whiteboard-atomic-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const stateOptions = { env: { LUSU_CONFIG_DIR: directory } };
  const stateFile = path.join(directory, "whiteboards.json");
  await storeWhiteboardHandle({ room: { type: "public" }, accessToken: ACCESS_TOKEN }, {
    ...stateOptions,
    boardHandle: "board_atomic_baseline_0001"
  });
  const baseline = await fs.readFile(stateFile, "utf8");
  const originalRename = fs.rename;
  fs.rename = async (source, destination) => {
    if (path.resolve(destination) === path.resolve(stateFile)) {
      const error = new Error("simulated interrupted promotion");
      error.code = "EIO";
      throw error;
    }
    return originalRename(source, destination);
  };
  try {
    await assert.rejects(
      storeWhiteboardHandle({ room: { type: "public" }, accessToken: ACCESS_TOKEN }, {
        ...stateOptions,
        boardHandle: "board_atomic_interrupted_0002"
      }),
      { code: "LOCAL_STATE_WRITE_FAILED" }
    );
  } finally {
    fs.rename = originalRename;
  }

  assert.equal(await fs.readFile(stateFile, "utf8"), baseline);
  const leftovers = (await fs.readdir(directory)).filter((name) => (
    name.startsWith(".whiteboards.json.") && name.endsWith(".tmp")
  ));
  assert.deepEqual(leftovers, []);
  assert.equal(await fs.stat(`${stateFile}.lock`).catch(() => null), null);
});

test("whiteboard lock release never removes a replacement owner", { concurrency: false }, async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-whiteboard-owner-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const stateFile = path.join(directory, "whiteboards.json");
  const lockFile = `${stateFile}.lock`;
  const replacementToken = "f".repeat(32);
  const originalRename = fs.rename;
  let announceRename;
  let resumeRename;
  const renameStarted = new Promise((resolve) => { announceRename = resolve; });
  const renameResume = new Promise((resolve) => { resumeRename = resolve; });
  fs.rename = async (source, destination) => {
    if (path.resolve(destination) === path.resolve(stateFile)) {
      announceRename();
      await renameResume;
    }
    return originalRename(source, destination);
  };

  let storing;
  try {
    storing = storeWhiteboardHandle({ room: { type: "public" }, accessToken: ACCESS_TOKEN }, {
      env: { LUSU_CONFIG_DIR: directory },
      boardHandle: "board_owner_replacement_0001"
    });
    await renameStarted;
    await fs.writeFile(lockFile, `${JSON.stringify({
      version: 1,
      ownerToken: replacementToken,
      processToken: "e".repeat(32),
      pid: process.pid,
      createdAt: Date.now()
    })}\n`, { mode: 0o600 });
    resumeRename();
    await storing;
  } finally {
    resumeRename?.();
    fs.rename = originalRename;
    await storing?.catch(() => {});
  }

  const replacement = JSON.parse(await fs.readFile(lockFile, "utf8"));
  assert.equal(replacement.ownerToken, replacementToken);
  await fs.unlink(lockFile);
});

test("whiteboard storage reclaims an inactive orphan left by this long-lived process", { concurrency: false }, async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-whiteboard-orphan-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const stateFile = path.join(directory, "whiteboards.json");
  const lockFile = `${stateFile}.lock`;
  const stateOptions = {
    env: { LUSU_CONFIG_DIR: directory },
    localStateLockStaleMs: 25,
    localStateLockTimeoutMs: 1_000,
    localStateLockRetryMs: 5
  };
  const originalUnlink = fs.unlink;
  let failRelease = true;
  fs.unlink = async (target, ...args) => {
    if (failRelease && path.resolve(target) === path.resolve(lockFile)) {
      failRelease = false;
      const error = new Error("simulated transient release failure");
      error.code = "EPERM";
      throw error;
    }
    return originalUnlink(target, ...args);
  };
  try {
    await storeWhiteboardHandle({ room: { type: "public" }, accessToken: ACCESS_TOKEN }, {
      ...stateOptions,
      boardHandle: "board_orphan_first_0001"
    });
  } finally {
    fs.unlink = originalUnlink;
  }

  assert.ok(await fs.stat(lockFile));
  const oldTime = new Date(Date.now() - 5_000);
  await fs.utimes(lockFile, oldTime, oldTime);
  await storeWhiteboardHandle({ room: { type: "public" }, accessToken: ACCESS_TOKEN }, {
    ...stateOptions,
    boardHandle: "board_orphan_second_0002"
  });

  const stored = JSON.parse(await fs.readFile(stateFile, "utf8"));
  assert.ok(stored.boards.board_orphan_first_0001);
  assert.ok(stored.boards.board_orphan_second_0002);
  assert.equal(await fs.stat(lockFile).catch(() => null), null);
});

test("whiteboard handle storage recovers a stale lock whose process is gone", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-whiteboard-stale-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const stateFile = path.join(directory, "whiteboards.json");
  const lockFile = `${stateFile}.lock`;
  await fs.writeFile(lockFile, `${JSON.stringify({
    version: 1,
    ownerToken: "d".repeat(32),
    processToken: "c".repeat(32),
    pid: 2_147_483_647,
    createdAt: Date.now() - 5_000
  })}\n`, { mode: 0o600 });
  const oldTime = new Date(Date.now() - 5_000);
  await fs.utimes(lockFile, oldTime, oldTime);

  const boardHandle = await storeWhiteboardHandle({
    room: { type: "public" },
    accessToken: ACCESS_TOKEN
  }, {
    env: { LUSU_CONFIG_DIR: directory },
    boardHandle: "board_stale_recovery_0001",
    localStateLockStaleMs: 25,
    localStateLockTimeoutMs: 1_000,
    localStateLockRetryMs: 5
  });
  assert.equal(boardHandle, "board_stale_recovery_0001");
  assert.equal(await fs.stat(lockFile).catch(() => null), null);
  assert.equal((await loadWhiteboardRecord(boardHandle, {
    env: { LUSU_CONFIG_DIR: directory }
  })).accessToken, ACCESS_TOKEN);
});

function runNodeChild(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`child exited with ${code}: ${stderr || stdout}`));
    });
  });
}
