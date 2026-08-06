import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as Y from "yjs";
import { runCli } from "../cli/lusu.mjs";

function captureStream() {
  let value = "";
  return {
    stream: { write(chunk) { value += String(chunk); return true; } },
    text() { return value; }
  };
}

function response(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

test("CLI capabilities is machine-readable and reuses the governed registry", async () => {
  const stdout = captureStream();
  const stderr = captureStream();
  const result = await runCli(["capabilities", "--transport", "cli"], {
    stdout: stdout.stream,
    stderr: stderr.stream,
    env: { LUSU_CONFIG_DIR: path.join(os.tmpdir(), `missing-${crypto.randomUUID()}`) }
  });
  assert.ok(result.capabilities.length > 0);
  assert.ok(result.capabilities.every((item) => item.transport.includes("cli")));
  assert.deepEqual(JSON.parse(stdout.text()), result);
  assert.equal(stderr.text(), "");
});

test("CLI rejects plaintext password arguments before making a request", async () => {
  await assert.rejects(
    runCli(["transfer", "join", "--password", "do-not-accept"], {
      stdout: captureStream().stream,
      stderr: captureStream().stream,
      env: {}
    }),
    (error) => error.code === "PASSWORD_ARGUMENT_FORBIDDEN"
  );
});

test("CLI exposes the governed article-list capability", async () => {
  const stdout = captureStream();
  let requested;
  const result = await runCli(["--base-url", "https://example.test", "content", "list", "--lang", "ja", "--limit", "5"], {
    fetch: async (url) => {
      requested = url;
      return response({ articles: [{ slug: "one", title: "一" }], lang: "ja" });
    },
    stdout: stdout.stream,
    stderr: captureStream().stream,
    env: { LUSU_CONFIG_DIR: path.join(os.tmpdir(), `missing-${crypto.randomUUID()}`) }
  });
  assert.equal(requested.pathname, "/api/articles");
  assert.equal(requested.searchParams.get("lang"), "ja");
  assert.equal(requested.searchParams.get("limit"), "5");
  assert.equal(result.articles[0].slug, "one");
});

test("CLI device login stores a private credential without printing the token", async (t) => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-cli-auth-"));
  t.after(() => fs.rm(configDir, { recursive: true, force: true }));
  const stdout = captureStream();
  const stderr = captureStream();
  const opened = [];
  const fetch = async (url) => {
    if (url.pathname.endsWith("/device/start")) {
      return response({
        deviceCode: "device-secret",
        userCode: "ABCD-EFGH",
        verificationUriComplete: "https://example.test/activate?code=ABCD-EFGH",
        expiresIn: 60,
        interval: 1
      });
    }
    if (url.pathname.endsWith("/device/token")) {
      return response({
        accessToken: "stored-agent-token",
        tokenType: "Bearer",
        expiresAt: "2030-01-01T00:00:00.000Z",
        scopes: ["content:read"],
        user: { id: "user-1", role: "user" }
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  const result = await runCli(["--base-url", "https://example.test", "auth", "login"], {
    fetch,
    stdout: stdout.stream,
    stderr: stderr.stream,
    env: { LUSU_CONFIG_DIR: configDir },
    sleep: async () => {},
    now: () => 0,
    openBrowser: async (url) => opened.push(url)
  });
  assert.equal(result.authenticated, true);
  assert.equal(stdout.text().includes("stored-agent-token"), false);
  assert.equal(stderr.text().includes("stored-agent-token"), false);
  assert.deepEqual(opened, ["https://example.test/activate?code=ABCD-EFGH"]);
  const stored = JSON.parse(await fs.readFile(path.join(configDir, "credentials.json"), "utf8"));
  assert.equal(stored.accessToken, "stored-agent-token");
});

test("CLI transfer join outputs only a room handle and stores no passphrase", async (t) => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-cli-room-"));
  t.after(() => fs.rm(configDir, { recursive: true, force: true }));
  const stdout = captureStream();
  const calls = [];
  const result = await runCli(["--base-url", "https://example.test", "transfer", "join", "--password-stdin"], {
    fetch: async (url, options) => {
      calls.push({ url, options });
      return response({ room: { id: "room-record", status: "open" } });
    },
    stdout: stdout.stream,
    stderr: captureStream().stream,
    stdin: { isTTY: false },
    readStdin: async () => "very-private-passphrase\n",
    env: { LUSU_CONFIG_DIR: configDir, LUSU_ACCESS_TOKEN: "agent-token" }
  });
  assert.match(result.roomHandle, /^room_/);
  const output = stdout.text();
  const posted = JSON.parse(calls[0].options.body);
  assert.equal(output.includes("very-private-passphrase"), false);
  assert.equal(output.includes(posted.roomKey), false);
  const roomsText = await fs.readFile(path.join(configDir, "rooms.json"), "utf8");
  assert.equal(roomsText.includes("very-private-passphrase"), false);
  assert.equal(roomsText.includes(posted.roomKey), true);
  assert.equal(roomsText.includes("textKey"), false);
});

test("CLI re-derives the text key for each send instead of loading key bytes from disk", async (t) => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-cli-send-"));
  t.after(() => fs.rm(configDir, { recursive: true, force: true }));
  const env = { LUSU_CONFIG_DIR: configDir, LUSU_ACCESS_TOKEN: "agent-token" };
  const joined = await runCli(["--base-url", "https://example.test", "transfer", "join", "--password-stdin"], {
    fetch: async () => response({ room: { id: "room-record", status: "open" } }),
    stdout: captureStream().stream,
    stderr: captureStream().stream,
    stdin: { isTTY: false },
    readStdin: async () => "private-passphrase\n",
    env
  });
  let sentBody;
  await runCli([
    "--base-url", "https://example.test", "transfer", "send", joined.roomHandle,
    "hello", "--password-stdin"
  ], {
    fetch: async (_url, options) => {
      sentBody = JSON.parse(options.body);
      return response({ item: { id: "item-1234567890123456", type: "text" } }, 201);
    },
    stdout: captureStream().stream,
    stderr: captureStream().stream,
    stdin: { isTTY: false },
    readStdin: async () => "private-passphrase\n",
    env
  });
  assert.notEqual(sentBody.encryptedContent, "hello");
  const state = JSON.parse(await fs.readFile(path.join(configDir, "rooms.json"), "utf8"));
  assert.equal(state.rooms[joined.roomHandle].textKey, undefined);
  assert.equal(state.rooms[joined.roomHandle].secretRef, undefined);
});

test("CLI joins, draws, reads, and exports a private whiteboard through opaque handles", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-cli-whiteboard-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const accessToken = `wbt1.${"c".repeat(80)}`;
  const document = new Y.Doc();
  let documentVersion = 0;
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ path: url.pathname, options });
    if (url.pathname.endsWith("/rooms/join")) {
      return response({
        room: { type: "private" },
        accessToken,
        accessExpiresAt: "2030-01-01T00:00:00.000Z"
      });
    }
    if (url.pathname.endsWith("/agent/scene") && options.method === "POST") {
      Y.applyUpdate(document, new Uint8Array(options.body));
      documentVersion += 1;
      return response({ ok: true, replayed: false, documentVersion });
    }
    if (url.pathname.endsWith("/agent/scene")) {
      return new Response(Y.encodeStateAsUpdate(document), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.yjs",
          "X-Whiteboard-Document-Version": String(documentVersion),
          "X-Whiteboard-Locked": "0"
        }
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  const env = {
    LUSU_CONFIG_DIR: path.join(directory, ".state"),
    LUSU_ACCESS_TOKEN: "agent-token",
    LUSU_WHITEBOARD_SECRET: "whiteboard-private-password"
  };
  const joinedOutput = captureStream();
  const joined = await runCli([
    "--base-url", "https://example.test", "whiteboard", "join",
    "--secret-ref", "env:LUSU_WHITEBOARD_SECRET"
  ], {
    fetch,
    stdout: joinedOutput.stream,
    stderr: captureStream().stream,
    env
  });
  assert.match(joined.boardHandle, /^board_/);
  assert.equal(joinedOutput.text().includes(env.LUSU_WHITEBOARD_SECRET), false);
  assert.equal(joinedOutput.text().includes(accessToken), false);
  assert.equal(JSON.parse(calls[0].options.body).password, env.LUSU_WHITEBOARD_SECRET);

  const inputFile = path.join(directory, "draw.json");
  await fs.writeFile(inputFile, JSON.stringify({
    operationId: "cli_draw_0001",
    elements: [
      { type: "diamond", x: 10, y: 10, width: 100, height: 80 },
      { type: "text", x: 30, y: 35, text: "CLI" }
    ]
  }));
  const drawn = await runCli([
    "--base-url", "https://example.test", "whiteboard", "draw", joined.boardHandle,
    "--input", inputFile
  ], {
    fetch,
    stdout: captureStream().stream,
    stderr: captureStream().stream,
    env
  });
  assert.equal(drawn.scene.elementCount, 2);

  const scene = await runCli([
    "--base-url", "https://example.test", "whiteboard", "scene", joined.boardHandle
  ], {
    fetch,
    stdout: captureStream().stream,
    stderr: captureStream().stream,
    env
  });
  assert.equal(scene.elementCount, 2);

  const destination = path.join(directory, "scene.json");
  const exported = await runCli([
    "--base-url", "https://example.test", "whiteboard", "export", joined.boardHandle,
    destination, "--format", "json"
  ], {
    fetch,
    stdout: captureStream().stream,
    stderr: captureStream().stream,
    env
  });
  assert.equal(exported.elementCount, 2);
  assert.equal(JSON.parse(await fs.readFile(destination, "utf8")).type, "excalidraw");
});

test("CLI runs an isolated 2048 session without network access", async (t) => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-cli-game-"));
  t.after(() => fs.rm(configDir, { recursive: true, force: true }));
  const dependencies = {
    fetch: async () => { throw new Error("game commands must remain local"); },
    stdout: captureStream().stream,
    stderr: captureStream().stream,
    env: { LUSU_CONFIG_DIR: configDir }
  };
  const created = await runCli(["game", "create", "2048"], dependencies);
  const sessionId = created.observation.sessionId;
  await assert.rejects(
    runCli([
      "game", "act", sessionId,
      "--expected-revision", "0",
      "--client-action-id", "cli_missing_action_0001"
    ], { ...dependencies, stdout: captureStream().stream }),
    (error) => error.code === "GAME_ACTION_REQUIRED"
  );
  const actions = await runCli(["game", "actions", sessionId], {
    ...dependencies,
    stdout: captureStream().stream
  });
  const direction = actions.actions.find((entry) => entry.action.type === "move").action.direction;
  const acted = await runCli([
    "game", "act", sessionId,
    "--expected-revision", "0",
    "--client-action-id", "cli_move_0001",
    "--direction", direction
  ], { ...dependencies, stdout: captureStream().stream });
  assert.equal(acted.status, "applied");
  assert.equal(acted.revision, 1);
  const observed = await runCli(["game", "observe", sessionId], {
    ...dependencies,
    stdout: captureStream().stream
  });
  assert.equal(observed.revision, 1);
  await assert.rejects(
    runCli(["game", "close", sessionId], { ...dependencies, stdout: captureStream().stream }),
    (error) => error.code === "CONFIRMATION_REQUIRED"
  );
  const closed = await runCli(["game", "close", sessionId, "--yes"], {
    ...dependencies,
    stdout: captureStream().stream
  });
  assert.equal(closed.closed, true);
});
