import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as Y from "yjs";
import { runCli } from "../cli/lusu.mjs";
import { writeStoredCredential } from "../lib/capabilities/local-state.mjs";

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

test("CLI capability discovery distinguishes target transports from callable adapters", async () => {
  const result = await runCli([
    "capabilities", "--domain", "japanese-subtext", "--transport", "cli"
  ], {
    stdout: captureStream().stream,
    stderr: captureStream().stream,
    env: { LUSU_CONFIG_DIR: path.join(os.tmpdir(), `missing-${crypto.randomUUID()}`) }
  });
  const rawUpdate = result.capabilities.find(({ id }) => id === "japanese-subtext.progress.update");
  assert.equal(rawUpdate.status, "existing-api");
  assert.equal(rawUpdate.transport.includes("cli"), true);
  assert.equal(rawUpdate.availableTransports.includes("cli"), false);
  assert.equal(rawUpdate.availableTransports.includes("local-mcp"), false);
  assert.deepEqual(rawUpdate.availableTransports, ["site-api"]);
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

test("CLI reads one published video by a validated stable id", async () => {
  const stdout = captureStream();
  let requested;
  const result = await runCli(["--base-url", "https://example.test", "videos", "get", "video-123"], {
    fetch: async (url) => {
      requested = url;
      return response({ video: { video_id: "video-123", title: "Demo" } });
    },
    stdout: stdout.stream,
    stderr: captureStream().stream,
    env: { LUSU_CONFIG_DIR: path.join(os.tmpdir(), `missing-${crypto.randomUUID()}`) }
  });
  assert.equal(requested.pathname, "/api/videos/video-123");
  assert.equal(result.video.video_id, "video-123");
  assert.deepEqual(JSON.parse(stdout.text()), result);
});

test("CLI wires phase-three public read commands to their governed adapters", async () => {
  const calls = [];
  const client = {
    async getVideo(videoId) {
      calls.push(["video-get", videoId]);
      return { video: { video_id: videoId } };
    },
    async listGames(options) {
      calls.push(["games-list", options]);
      return { games: [{ id: "2048" }], lang: options.lang };
    },
    async getGame(gameId, options) {
      calls.push(["game-get", gameId, options]);
      return { game: { id: gameId }, lang: options.lang };
    },
    async listJapaneseSubtextLevels(options) {
      calls.push(["japanese-levels", options]);
      return { levels: [{ level: 1 }], lang: options.lang };
    },
    async listJapaneseSubtextStages(options) {
      calls.push(["japanese-stages", options]);
      return { stages: [{ stageId: "L3-001" }], lang: options.lang };
    },
    async getJapaneseSubtextStage(stageId, options) {
      calls.push(["japanese-stage-get", stageId, options]);
      return { stage: { stageId }, lang: options.lang };
    }
  };
  const publicCatalog = {
    listPublicTools(options) {
      calls.push(["tools-list", options]);
      return { tools: [{ toolId: "whiteboard" }], lang: options.lang };
    },
    getPublicTool(toolId, options) {
      calls.push(["tool-get", toolId, options]);
      return { id: toolId, lang: options.lang };
    }
  };
  const env = { LUSU_CONFIG_DIR: path.join(os.tmpdir(), `missing-${crypto.randomUUID()}`) };
  const invoke = async (args) => {
    const stdout = captureStream();
    const result = await runCli(args, {
      client,
      publicCatalog,
      fetch: async () => { throw new Error("injected public reads must not use this fetch"); },
      stdout: stdout.stream,
      stderr: captureStream().stream,
      env
    });
    assert.deepEqual(JSON.parse(stdout.text()), result);
    return result;
  };

  assert.equal((await invoke(["videos", "get", "video_ID:1"])).video.video_id, "video_ID:1");
  assert.equal((await invoke(["tools", "list", "--lang", "JA"])).lang, "ja");
  assert.equal((await invoke(["tools", "get", "quick-transfer", "--lang", "zh"])).id, "quick-transfer");
  assert.equal((await invoke(["games", "list", "--lang", "en", "--agent-only"])).games[0].id, "2048");
  assert.equal((await invoke(["games", "get", "2048", "--lang", "ja"])).game.id, "2048");
  assert.equal((await invoke(["japanese-subtext", "levels", "--lang", "en"])).levels[0].level, 1);
  assert.equal((await invoke([
    "japanese-subtext", "stages", "--level", "3", "--query", "ＡＩ", "--limit", "7", "--lang", "zh"
  ])).stages[0].stageId, "L3-001");
  assert.equal((await invoke(["japanese-subtext", "get", "L5-050", "--lang", "ja"])).stage.stageId, "L5-050");

  assert.deepEqual(calls, [
    ["video-get", "video_ID:1"],
    ["tools-list", { lang: "ja" }],
    ["tool-get", "quick-transfer", { lang: "zh" }],
    ["games-list", { lang: "en", agentOnly: true }],
    ["game-get", "2048", { lang: "ja" }],
    ["japanese-levels", { lang: "en" }],
    ["japanese-stages", { level: 3, query: "AI", limit: 7, lang: "zh" }],
    ["japanese-stage-get", "L5-050", { lang: "ja" }]
  ]);
});

test("CLI rejects malformed phase-three public read arguments before adapter calls", async () => {
  const dependencies = {
    client: {},
    publicCatalog: {},
    fetch: async () => { throw new Error("invalid input must not make a request"); },
    stdout: captureStream().stream,
    stderr: captureStream().stream,
    env: { LUSU_CONFIG_DIR: path.join(os.tmpdir(), `missing-${crypto.randomUUID()}`) }
  };
  const rejectsWith = (args, code) => assert.rejects(
    runCli(args, { ...dependencies, stdout: captureStream().stream }),
    (error) => error.code === code
  );

  await rejectsWith(["videos", "get", "../private"], "VIDEO_ID_INVALID");
  await rejectsWith(["tools", "get", "Quick Transfer"], "TOOL_ID_INVALID");
  await rejectsWith(["games", "list", "--agent-only=true"], "OPTION_VALUE_UNEXPECTED");
  await rejectsWith(["games", "get", "2048", "--lang", "fr"], "LANGUAGE_INVALID");
  await rejectsWith(["japanese-subtext", "stages"], "JAPANESE_SUBTEXT_LEVEL_REQUIRED");
  await rejectsWith(["japanese-subtext", "stages", "--level", "0"], "JAPANESE_SUBTEXT_LEVEL_INVALID");
  await rejectsWith(
    ["japanese-subtext", "stages", "--level", "1", "--limit", "51"],
    "OPTION_INTEGER_INVALID"
  );
  await rejectsWith(["japanese-subtext", "get", "L1-051"], "JAPANESE_SUBTEXT_STAGE_ID_INVALID");
});

test("CLI exposes authenticated Japanese progress and semantic attempt commands without raw updates", async () => {
  const calls = [];
  const attemptInput = {
    stageId: "L1-001",
    stageRevision: 3,
    contentHash: "a".repeat(64),
    answers: [{ questionId: "q1", optionIds: ["a"] }],
    expectedRevision: 4,
    operationId: "cli_attempt_0001"
  };
  const client = {
    async getJapaneseSubtextProgress(options) {
      calls.push(["progress", options]);
      return { revision: 4, stages: [{ stageId: options.stageId }] };
    },
    async submitJapaneseSubtextAttempt(input) {
      calls.push(["attempt", input]);
      return { status: "applied", revision: 5, score: 100 };
    }
  };
  const env = {
    LUSU_ACCESS_TOKEN: "japanese-progress-token",
    LUSU_CONFIG_DIR: path.join(os.tmpdir(), `missing-${crypto.randomUUID()}`)
  };
  const progress = await runCli([
    "japanese-subtext", "progress", "--stage-id", "L1-001", "--days", "30"
  ], {
    client,
    fetch: async () => { throw new Error("injected client must handle Japanese progress"); },
    stdout: captureStream().stream,
    stderr: captureStream().stream,
    env
  });
  assert.equal(progress.revision, 4);
  const attemptOutput = captureStream();
  const attempt = await runCli([
    "japanese-subtext", "attempt", "--input", "-"
  ], {
    client,
    fetch: async () => { throw new Error("injected client must handle Japanese attempts"); },
    readStdin: async () => JSON.stringify(attemptInput),
    stdout: attemptOutput.stream,
    stderr: captureStream().stream,
    env
  });
  assert.equal(attempt.status, "applied");
  assert.equal(attemptOutput.text().includes(env.LUSU_ACCESS_TOKEN), false);
  assert.deepEqual(calls, [
    ["progress", { stageId: "L1-001", days: 30 }],
    ["attempt", attemptInput]
  ]);

  await assert.rejects(
    runCli(["japanese-subtext", "update", "--input", "-"], {
      client,
      fetch: async () => { throw new Error("raw progress update must not make a request"); },
      readStdin: async () => "{}",
      stdout: captureStream().stream,
      stderr: captureStream().stream,
      env
    }),
    (error) => error.code === "JAPANESE_SUBTEXT_COMMAND_UNKNOWN"
  );
  await assert.rejects(
    runCli(["japanese-subtext", "attempt", "--input", "-"], {
      client,
      fetch: async () => { throw new Error("invalid attempt must not make a request"); },
      readStdin: async () => JSON.stringify({ ...attemptInput, rawProgress: {} }),
      stdout: captureStream().stream,
      stderr: captureStream().stream,
      env
    }),
    (error) => error.code === "JAPANESE_SUBTEXT_ATTEMPT_INVALID"
  );
  assert.equal(calls.length, 2);
});

test("CLI Japanese progress commands require an access token", async () => {
  await assert.rejects(
    runCli(["japanese-subtext", "progress"], {
      client: { async getJapaneseSubtextProgress() { throw new Error("must not be called"); } },
      fetch: async () => { throw new Error("must not make a request"); },
      stdout: captureStream().stream,
      stderr: captureStream().stream,
      env: { LUSU_CONFIG_DIR: path.join(os.tmpdir(), `missing-${crypto.randomUUID()}`) }
    }),
    (error) => error.code === "AUTH_REQUIRED"
  );
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

test("CLI device login retries an initial network failure with bounded backoff", async (t) => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-cli-auth-retry-"));
  t.after(() => fs.rm(configDir, { recursive: true, force: true }));
  const stdout = captureStream();
  const stderr = captureStream();
  const sleeps = [];
  let pollCount = 0;
  const fetch = async (url) => {
    if (url.pathname.endsWith("/device/start")) {
      return response({
        deviceCode: "device-retry-secret",
        userCode: "RETRY-001",
        verificationUriComplete: "https://example.test/activate?code=RETRY-001",
        expiresIn: 60,
        interval: 1
      });
    }
    if (url.pathname.endsWith("/device/token")) {
      pollCount += 1;
      if (pollCount === 1) throw new Error("private network detail must not be printed");
      return response({
        accessToken: "retry-stored-agent-token",
        tokenType: "Bearer",
        scopes: ["japanese-subtext:progress:read"],
        user: { id: "user-retry", role: "user" }
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  const result = await runCli([
    "--base-url", "https://example.test", "auth", "login", "--no-browser"
  ], {
    fetch,
    stdout: stdout.stream,
    stderr: stderr.stream,
    env: { LUSU_CONFIG_DIR: configDir },
    sleep: async (milliseconds) => { sleeps.push(milliseconds); },
    now: () => 0
  });
  assert.equal(result.authenticated, true);
  assert.equal(pollCount, 2);
  assert.deepEqual(sleeps, [1000, 2000]);
  const visibleOutput = `${stdout.text()}\n${stderr.text()}`;
  assert.equal(visibleOutput.includes("private network detail"), false);
  assert.equal(visibleOutput.includes("retry-stored-agent-token"), false);
  const stored = JSON.parse(await fs.readFile(path.join(configDir, "credentials.json"), "utf8"));
  assert.equal(stored.accessToken, "retry-stored-agent-token");
});

test("CLI anchors device expiry before a delayed browser opener", async (t) => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-cli-auth-opener-deadline-"));
  t.after(() => fs.rm(configDir, { recursive: true, force: true }));
  let currentTime = 0;
  let pollCount = 0;
  let sleepCount = 0;
  const fetch = async (url) => {
    if (url.pathname.endsWith("/device/start")) {
      return response({
        deviceCode: "device-opener-secret",
        userCode: "OPEN-0001",
        verificationUriComplete: "https://example.test/activate?code=OPEN-0001",
        expiresIn: 1,
        interval: 1
      });
    }
    pollCount += 1;
    return response({ accessToken: "must-not-be-issued" });
  };
  await assert.rejects(
    runCli(["--base-url", "https://example.test", "auth", "login"], {
      fetch,
      stdout: captureStream().stream,
      stderr: captureStream().stream,
      env: { LUSU_CONFIG_DIR: configDir },
      now: () => currentTime,
      sleep: async () => { sleepCount += 1; },
      openBrowser: async () => { currentTime = 1500; }
    }),
    (error) => error.code === "AUTHORIZATION_EXPIRED"
  );
  assert.equal(pollCount, 0);
  assert.equal(sleepCount, 0);
  await assert.rejects(fs.readFile(path.join(configDir, "credentials.json")), { code: "ENOENT" });
});

test("CLI aborts a hanging device poll at the remaining device lifetime", async (t) => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-cli-auth-poll-timeout-"));
  t.after(() => fs.rm(configDir, { recursive: true, force: true }));
  let pollCount = 0;
  let observedAbort = false;
  const fetch = async (url, options) => {
    if (url.pathname.endsWith("/device/start")) {
      return response({
        deviceCode: "device-timeout-secret",
        userCode: "TIME-0001",
        verificationUriComplete: "https://example.test/activate?code=TIME-0001",
        expiresIn: 0.03,
        interval: 1
      });
    }
    pollCount += 1;
    return new Promise((resolve, reject) => {
      const abort = () => {
        observedAbort = true;
        reject(options.signal.reason || new DOMException("Aborted", "AbortError"));
      };
      if (options.signal.aborted) abort();
      else options.signal.addEventListener("abort", abort, { once: true });
    });
  };
  const startedAt = Date.now();
  await assert.rejects(
    runCli(["--base-url", "https://example.test", "auth", "login", "--no-browser"], {
      fetch,
      stdout: captureStream().stream,
      stderr: captureStream().stream,
      env: { LUSU_CONFIG_DIR: configDir },
      sleep: async () => {}
    }),
    (error) => error.code === "AUTHORIZATION_EXPIRED"
  );
  assert.equal(pollCount, 1);
  assert.equal(observedAbort, true);
  assert.ok(Date.now() - startedAt < 1000);
  await assert.rejects(fs.readFile(path.join(configDir, "credentials.json")), { code: "ENOENT" });
});

test("CLI rejects a device token returned after the anchored deadline", async (t) => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-cli-auth-late-token-"));
  t.after(() => fs.rm(configDir, { recursive: true, force: true }));
  const stdout = captureStream();
  const stderr = captureStream();
  let currentTime = 0;
  let pollCount = 0;
  const fetch = async (url) => {
    if (url.pathname.endsWith("/device/start")) {
      return response({
        deviceCode: "device-late-secret",
        userCode: "LATE-0001",
        verificationUriComplete: "https://example.test/activate?code=LATE-0001",
        expiresIn: 60,
        interval: 1
      });
    }
    pollCount += 1;
    currentTime = 60_001;
    return response({
      accessToken: "late-agent-token-must-not-be-stored",
      tokenType: "Bearer",
      scopes: ["content:read"]
    });
  };
  await assert.rejects(
    runCli(["--base-url", "https://example.test", "auth", "login", "--no-browser"], {
      fetch,
      stdout: stdout.stream,
      stderr: stderr.stream,
      env: { LUSU_CONFIG_DIR: configDir },
      now: () => currentTime,
      sleep: async () => {}
    }),
    (error) => error.code === "AUTHORIZATION_EXPIRED"
  );
  assert.equal(pollCount, 1);
  assert.equal(`${stdout.text()}${stderr.text()}`.includes("late-agent-token-must-not-be-stored"), false);
  await assert.rejects(fs.readFile(path.join(configDir, "credentials.json")), { code: "ENOENT" });
});

test("CLI binds stored credentials to their normalized HTTP origin", async (t) => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-cli-origin-"));
  t.after(() => fs.rm(configDir, { recursive: true, force: true }));
  const credentialToken = "prod-credential-token";
  const explicitToken = "preview-explicit-token";
  const baseEnv = { LUSU_CONFIG_DIR: configDir };
  await writeStoredCredential({
    accessToken: credentialToken,
    baseUrl: "https://prod.example/account"
  }, { env: baseEnv });

  const requests = [];
  const fetch = async (url, options) => {
    requests.push({
      origin: url.origin,
      authorization: options.headers.get("Authorization") || ""
    });
    return response({ articles: [], lang: "zh" });
  };
  const invoke = (baseUrl, env = baseEnv) => runCli([
    "--base-url", baseUrl, "content", "list"
  ], {
    fetch,
    stdout: captureStream().stream,
    stderr: captureStream().stream,
    env
  });

  await invoke("https://preview.example/path");
  await invoke("https://PROD.example/another-path");
  await invoke("https://preview.example", { ...baseEnv, LUSU_ACCESS_TOKEN: explicitToken });

  assert.deepEqual(requests, [
    { origin: "https://preview.example", authorization: "" },
    { origin: "https://prod.example", authorization: `Bearer ${credentialToken}` },
    { origin: "https://preview.example", authorization: `Bearer ${explicitToken}` }
  ]);
});

test("CLI auth status and logout preserve credentials owned by another origin", async (t) => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-cli-origin-logout-"));
  t.after(() => fs.rm(configDir, { recursive: true, force: true }));
  const env = { LUSU_CONFIG_DIR: configDir };
  const credentialsFile = path.join(configDir, "credentials.json");
  const credentialToken = "prod-credential-token";
  await writeStoredCredential({
    accessToken: credentialToken,
    baseUrl: "https://prod.example"
  }, { env });
  let requestCount = 0;
  const noRequest = async () => {
    requestCount += 1;
    throw new Error("a mismatched stored credential must not make an authenticated request");
  };

  const status = await runCli([
    "--base-url", "https://preview.example", "auth", "status"
  ], {
    fetch: noRequest,
    stdout: captureStream().stream,
    stderr: captureStream().stream,
    env
  });
  assert.deepEqual(status, { authenticated: false, user: null, scopes: [] });

  const logout = await runCli([
    "--base-url", "https://preview.example", "auth", "logout"
  ], {
    fetch: noRequest,
    stdout: captureStream().stream,
    stderr: captureStream().stream,
    env
  });
  assert.deepEqual(logout, {
    authenticated: false,
    revoked: false,
    localCredentialsRemoved: false
  });
  assert.equal(requestCount, 0);
  let stored = JSON.parse(await fs.readFile(credentialsFile, "utf8"));
  assert.equal(stored.accessToken, credentialToken);
  assert.equal(JSON.stringify({ status, logout }).includes(credentialToken), false);

  const explicitCalls = [];
  const explicitLogout = await runCli([
    "--base-url", "https://preview.example", "auth", "logout"
  ], {
    fetch: async (url, options) => {
      explicitCalls.push({
        origin: url.origin,
        authorization: options.headers.get("Authorization") || ""
      });
      return response({ ok: true });
    },
    stdout: captureStream().stream,
    stderr: captureStream().stream,
    env: { ...env, LUSU_ACCESS_TOKEN: "preview-explicit-token" }
  });
  assert.deepEqual(explicitCalls, [{
    origin: "https://preview.example",
    authorization: "Bearer preview-explicit-token"
  }]);
  assert.deepEqual(explicitLogout, {
    authenticated: false,
    revoked: true,
    localCredentialsRemoved: false
  });
  stored = JSON.parse(await fs.readFile(credentialsFile, "utf8"));
  assert.equal(stored.accessToken, credentialToken);
  assert.equal(JSON.stringify(explicitLogout).includes("preview-explicit-token"), false);
});

test("CLI auth logout revokes and removes a credential only on its matching origin", async (t) => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-cli-origin-match-"));
  t.after(() => fs.rm(configDir, { recursive: true, force: true }));
  const env = { LUSU_CONFIG_DIR: configDir };
  const credentialToken = "matching-origin-token";
  await writeStoredCredential({
    accessToken: credentialToken,
    baseUrl: "https://prod.example/path"
  }, { env });
  const calls = [];
  const result = await runCli([
    "--base-url", "https://prod.example", "auth", "logout"
  ], {
    fetch: async (url, options) => {
      calls.push({
        origin: url.origin,
        method: options.method,
        authorization: options.headers.get("Authorization") || ""
      });
      return response({ ok: true });
    },
    stdout: captureStream().stream,
    stderr: captureStream().stream,
    env
  });
  assert.deepEqual(calls, [{
    origin: "https://prod.example",
    method: "DELETE",
    authorization: `Bearer ${credentialToken}`
  }]);
  assert.deepEqual(result, {
    authenticated: false,
    revoked: true,
    localCredentialsRemoved: true
  });
  await assert.rejects(fs.readFile(path.join(configDir, "credentials.json")), { code: "ENOENT" });
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
  const assetId = "0123456789abcdef0123456789abcdef";
  const imageBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );
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
    if (url.pathname.endsWith("/agent/assets") && options.method === "POST") {
      assert.deepEqual(Buffer.from(options.body), imageBytes);
      assert.equal(options.headers.get("X-Whiteboard-Operation-Id"), "cli_asset_0001");
      return response({
        ok: true,
        replayed: false,
        asset: {
          assetId,
          contentType: "image/png",
          byteLength: imageBytes.byteLength,
          width: 1,
          height: 1
        }
      }, 201);
    }
    if (url.pathname.endsWith(`/agent/assets/${assetId}`)) {
      return new Response(imageBytes, {
        status: 200,
        headers: { "Content-Type": "image/png", "Content-Length": String(imageBytes.byteLength) }
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

  const imageFile = path.join(directory, "source.png");
  await fs.writeFile(imageFile, imageBytes);
  const uploadOutput = captureStream();
  const uploaded = await runCli([
    "--base-url", "https://example.test", "whiteboard", "asset", "put",
    joined.boardHandle, imageFile, "--operation-id", "cli_asset_0001"
  ], {
    fetch,
    stdout: uploadOutput.stream,
    stderr: captureStream().stream,
    env
  });
  assert.equal(uploaded.asset.assetId, assetId);
  assert.equal(uploadOutput.text().includes(directory), false);
  assert.equal(uploadOutput.text().includes(accessToken), false);

  const imageDestination = path.join(directory, "downloaded.png");
  const downloadOutput = captureStream();
  const downloaded = await runCli([
    "--base-url", "https://example.test", "whiteboard", "asset", "get",
    joined.boardHandle, assetId, imageDestination
  ], {
    fetch,
    stdout: downloadOutput.stream,
    stderr: captureStream().stream,
    env
  });
  assert.equal(downloaded.destination, "downloaded.png");
  assert.deepEqual(await fs.readFile(imageDestination), imageBytes);
  assert.equal(downloadOutput.text().includes(directory), false);
  await assert.rejects(
    runCli([
      "--base-url", "https://example.test", "whiteboard", "asset", "get",
      joined.boardHandle, assetId, path.join(directory, "CON.png")
    ], { fetch, stdout: captureStream().stream, stderr: captureStream().stream, env }),
    (error) => error.code === "FILE_REF_UNSAFE_PATH"
  );
  await assert.rejects(
    runCli([
      "--base-url", "https://example.test", "whiteboard", "asset", "get",
      joined.boardHandle, assetId, imageDestination
    ], { fetch, stdout: captureStream().stream, stderr: captureStream().stream, env }),
    (error) => error.code === "FILE_ALREADY_EXISTS"
  );

  const imageDrawFile = path.join(directory, "image-draw.json");
  await fs.writeFile(imageDrawFile, JSON.stringify({
    operationId: "cli_image_draw_0001",
    elements: [{ type: "image", assetId, x: 200, y: 40, width: 80, height: 80 }]
  }));
  const imageDrawn = await runCli([
    "--base-url", "https://example.test", "whiteboard", "draw", joined.boardHandle,
    "--input", imageDrawFile
  ], { fetch, stdout: captureStream().stream, stderr: captureStream().stream, env });
  assert.equal(imageDrawn.scene.assetCount, 1);
  assert.equal(imageDrawn.scene.elements.at(-1).assetId, assetId);
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
