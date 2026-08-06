#!/usr/bin/env node

import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createProxyAwareFetch } from "../自动新闻/integrations/lusu-site/network-fetch.mjs";
import { SiteClient, SiteClientError } from "../lib/capabilities/site-client.mjs";
import {
  PublicCatalogError,
  getPublicTool,
  listPublicTools
} from "../lib/capabilities/public-catalog-adapter.mjs";
import { JapaneseSubtextCapabilityError } from "../lib/capabilities/japanese-subtext-adapter.mjs";
import {
  GameSessionStoreError,
  createGameSessionStore
} from "../lib/capabilities/game-session-store.mjs";
import { GameProtocolError } from "../lib/capabilities/game-protocol.mjs";
import { deriveTransferRoomSecret } from "../lib/capabilities/transfer-crypto.mjs";
import {
  drawWhiteboardHandle,
  exportWhiteboardHandle,
  joinWhiteboardHandle,
  readWhiteboardHandle
} from "../lib/capabilities/whiteboard-adapter.mjs";
import { WhiteboardSceneError } from "../lib/capabilities/whiteboard-scene.mjs";
import {
  LocalStateError,
  deleteStoredCredential,
  loadRoomKey,
  loadRoomSecret,
  openNoClobberSink,
  readStoredCredential,
  resolveConfigDirectory,
  resolveSecretRef,
  resolveSiteAuthContext,
  storeRoomHandle,
  writeStoredCredential
} from "../lib/capabilities/local-state.mjs";

const DEFAULT_BASE_URL = "https://lusu575.com";
const MAX_STDIN_BYTES = 1024 * 1024;
const TRANSIENT_DEVICE_POLL_STATUSES = new Set([408, 425, 500, 502, 503, 504]);

export async function runCli(argv = process.argv.slice(2), dependencies = {}) {
  if (dependencies.fetch) return runCliWithDependencies(argv, dependencies);
  const network = createProxyAwareFetch({ environment: dependencies.env || process.env });
  try {
    return await runCliWithDependencies(argv, { ...dependencies, fetch: network.fetch });
  } finally {
    await network.close();
  }
}

async function runCliWithDependencies(argv, dependencies) {
  const env = dependencies.env || process.env;
  const stdout = dependencies.stdout || process.stdout;
  const stderr = dependencies.stderr || process.stderr;
  const stdin = dependencies.stdin || process.stdin;
  const global = extractGlobalOptions(argv);
  rejectPlaintextPasswordOption(global.args);

  const command = global.args[0] || "help";
  const subcommand = global.args[1] || "";
  const commandArgs = global.args.slice(2);
  const stateOptions = {
    env,
    homeDir: dependencies.homeDir,
    crypto: dependencies.crypto
  };
  const credential = await readStoredCredential(stateOptions);
  const siteAuth = resolveSiteAuthContext({
    baseUrl: global.baseUrl,
    env,
    credential,
    defaultBaseUrl: DEFAULT_BASE_URL,
    resolveAccessToken: false
  });
  const baseUrl = siteAuth.baseUrl;
  let stdinValue;
  const readStdin = async () => {
    if (stdinValue === undefined) {
      stdinValue = dependencies.readStdin
        ? await dependencies.readStdin()
        : await readStreamText(stdin, MAX_STDIN_BYTES);
    }
    return stdinValue;
  };

  if (command === "help" || command === "--help" || command === "-h") {
    writeText(stdout, helpText());
    return { ok: true };
  }

  if (command === "auth") {
    const result = await runAuthCommand(subcommand, commandArgs, {
      ...dependencies,
      env,
      stdout,
      stderr,
      baseUrl,
      stateOptions,
      credential,
      global,
      readStdin
    });
    if (result !== undefined) writeJson(stdout, result);
    return result;
  }

  if (global.tokenStdin && ["transfer", "whiteboard"].includes(command) && commandArgs.includes("--password-stdin")) {
    throw new CliInputError("--token-stdin and --password-stdin cannot share the same input stream.", "STDIN_SECRET_CONFLICT");
  }
  const explicitAccessToken = global.tokenStdin ? firstNonEmptyLine(await readStdin()) : undefined;
  const accessToken = resolveSiteAuthContext({
    baseUrl,
    env,
    credential,
    defaultBaseUrl: DEFAULT_BASE_URL,
    explicitAccessToken,
    explicitAccessTokenProvided: global.tokenStdin
  }).accessToken;
  const client = dependencies.client || new SiteClient({
    fetch: dependencies.fetch,
    baseUrl,
    accessToken
  });

  let result;
  if (command === "capabilities") {
    const parsed = parseOptions(global.args.slice(1), {
      "--domain": "value",
      "--scope": "value",
      "--transport": "value",
      "--status": "value",
      "--risk": "value"
    });
    assertNoPositionals(parsed);
    result = {
      capabilities: client.capabilities(compactObject({
        domain: parsed.options.domain,
        scope: parsed.options.scope,
        transport: parsed.options.transport,
        status: parsed.options.status,
        risk: parsed.options.risk
      }))
    };
  } else if (command === "content") {
    result = await runContentCommand(client, subcommand, commandArgs);
  } else if (command === "videos") {
    result = await runVideosCommand(client, subcommand, commandArgs);
  } else if (command === "tools") {
    result = await runToolsCommand(
      subcommand,
      commandArgs,
      dependencies.publicCatalog || { listPublicTools, getPublicTool }
    );
  } else if (command === "games") {
    result = await runGamesCatalogCommand(client, subcommand, commandArgs);
  } else if (command === "japanese-subtext") {
    result = await runJapaneseSubtextCommand(client, subcommand, commandArgs, {
      accessToken,
      readStdin,
      tokenStdin: global.tokenStdin
    });
  } else if (command === "game") {
    if (global.tokenStdin) {
      throw new CliInputError("--token-stdin is not used by isolated local game sessions.", "TOKEN_INPUT_UNUSED");
    }
    const gameStore = dependencies.gameStore || createGameSessionStore(stateOptions);
    result = await runGameCommand(gameStore, subcommand, commandArgs, {
      ...dependencies,
      readStdin,
      tokenStdin: global.tokenStdin
    });
  } else if (command === "transfer") {
    if (!accessToken) throw new CliInputError("Sign in first with `lusu auth login`.", "AUTH_REQUIRED");
    result = await runTransferCommand(client, subcommand, commandArgs, {
      ...dependencies,
      env,
      stdin,
      stderr,
      readStdin,
      stateOptions
    });
  } else if (command === "whiteboard") {
    if (!accessToken) throw new CliInputError("Sign in first with `lusu auth login`.", "AUTH_REQUIRED");
    result = await runWhiteboardCommand(client, subcommand, commandArgs, {
      ...dependencies,
      env,
      stdin,
      stderr,
      readStdin,
      tokenStdin: global.tokenStdin,
      stateOptions: { ...stateOptions, secretResolver: dependencies.resolveSecretRef || resolveSecretRef }
    });
  } else {
    throw new CliInputError(`Unknown command: ${command}`, "COMMAND_UNKNOWN");
  }
  writeJson(stdout, result);
  return result;
}

async function runContentCommand(client, command, args) {
  if (command === "list") {
    const parsed = parseOptions(args, {
      "--lang": "value",
      "--category": "value",
      "--limit": "value"
    });
    assertNoPositionals(parsed);
    return client.listArticles({
      lang: parsed.options.lang,
      category: parsed.options.category,
      limit: parsed.options.limit
    });
  }
  if (command === "search") {
    const parsed = parseOptions(args, {
      "--lang": "value",
      "--category": "value",
      "--limit": "value"
    });
    const query = parsed.positionals.join(" ").trim();
    if (!query) throw new CliInputError("content search requires a query.", "CONTENT_QUERY_REQUIRED");
    return client.searchArticles({
      query,
      lang: parsed.options.lang,
      category: parsed.options.category,
      limit: parsed.options.limit
    });
  }
  if (command === "get") {
    const parsed = parseOptions(args, { "--lang": "value" });
    if (parsed.positionals.length !== 1) throw new CliInputError("content get requires one article slug.", "ARTICLE_SLUG_REQUIRED");
    return client.getArticle(parsed.positionals[0], { lang: parsed.options.lang });
  }
  if (command === "daily") {
    const parsed = parseOptions(args, { "--lang": "value", "--date": "value" });
    assertNoPositionals(parsed);
    return client.getDailyNews({ lang: parsed.options.lang, date: parsed.options.date });
  }
  throw new CliInputError(`Unknown content command: ${command || "<missing>"}`, "CONTENT_COMMAND_UNKNOWN");
}

async function runVideosCommand(client, command, args) {
  if (command === "get") {
    const parsed = parseOptions(args, {});
    if (parsed.positionals.length !== 1) {
      throw new CliInputError("videos get requires one video id.", "VIDEO_ID_REQUIRED");
    }
    return client.getVideo(validateVideoId(parsed.positionals[0]));
  }
  if (command === "list") {
    const parsed = parseOptions(args, {
      "--lang": "value",
      "--query": "value",
      "--categories": "value",
      "--limit": "value"
    });
    assertNoPositionals(parsed);
    return client.listVideos({
      lang: parsed.options.lang,
      query: parsed.options.query,
      categories: parsed.options.categories,
      limit: parsed.options.limit
    });
  }
  throw new CliInputError(`Unknown videos command: ${command || "<missing>"}`, "VIDEOS_COMMAND_UNKNOWN");
}

async function runToolsCommand(command, args, catalog) {
  if (command === "list") {
    const parsed = parseOptions(args, { "--lang": "value" });
    assertNoPositionals(parsed);
    return catalog.listPublicTools({ lang: validateOptionalLanguage(parsed.options.lang) });
  }
  if (command === "get") {
    const parsed = parseOptions(args, { "--lang": "value" });
    if (parsed.positionals.length !== 1) {
      throw new CliInputError("tools get requires one tool id.", "TOOL_ID_REQUIRED");
    }
    return catalog.getPublicTool(validateCatalogId(parsed.positionals[0], "tool"), {
      lang: validateOptionalLanguage(parsed.options.lang)
    });
  }
  throw new CliInputError(`Unknown tools command: ${command || "<missing>"}`, "TOOLS_COMMAND_UNKNOWN");
}

async function runGamesCatalogCommand(client, command, args) {
  if (command === "list") {
    const parsed = parseOptions(args, {
      "--lang": "value",
      "--agent-only": "boolean"
    });
    assertNoPositionals(parsed);
    return client.listGames({
      lang: validateOptionalLanguage(parsed.options.lang),
      agentOnly: Boolean(parsed.options.agentOnly)
    });
  }
  if (command === "get") {
    const parsed = parseOptions(args, { "--lang": "value" });
    if (parsed.positionals.length !== 1) {
      throw new CliInputError("games get requires one game id.", "GAME_ID_REQUIRED");
    }
    return client.getGame(validateCatalogId(parsed.positionals[0], "game"), {
      lang: validateOptionalLanguage(parsed.options.lang)
    });
  }
  throw new CliInputError(`Unknown games command: ${command || "<missing>"}`, "GAMES_COMMAND_UNKNOWN");
}

async function runJapaneseSubtextCommand(client, command, args, context = {}) {
  if (command === "levels") {
    const parsed = parseOptions(args, { "--lang": "value" });
    assertNoPositionals(parsed);
    return client.listJapaneseSubtextLevels({
      lang: validateOptionalLanguage(parsed.options.lang)
    });
  }
  if (command === "stages") {
    const parsed = parseOptions(args, {
      "--level": "value",
      "--query": "value",
      "--limit": "value",
      "--lang": "value"
    });
    assertNoPositionals(parsed);
    return client.listJapaneseSubtextStages({
      level: validateJapaneseLevel(parsed.options.level),
      query: normalizeOptionalQuery(parsed.options.query),
      limit: validateOptionalInteger(parsed.options.limit, 1, 50, "--limit"),
      lang: validateOptionalLanguage(parsed.options.lang)
    });
  }
  if (command === "get") {
    const parsed = parseOptions(args, { "--lang": "value" });
    if (parsed.positionals.length !== 1) {
      throw new CliInputError("japanese-subtext get requires one stage id.", "JAPANESE_SUBTEXT_STAGE_ID_REQUIRED");
    }
    return client.getJapaneseSubtextStage(validateJapaneseStageId(parsed.positionals[0]), {
      lang: validateOptionalLanguage(parsed.options.lang)
    });
  }
  if (command === "progress") {
    requireJapaneseSubtextAuth(context.accessToken);
    const parsed = parseOptions(args, {
      "--stage-id": "value",
      "--days": "value"
    });
    assertNoPositionals(parsed);
    return client.getJapaneseSubtextProgress(compactObject({
      stageId: parsed.options.stageId === undefined
        ? undefined
        : validateJapaneseStageId(parsed.options.stageId),
      days: validateOptionalInteger(parsed.options.days, 1, 90, "--days")
    }));
  }
  if (command === "attempt") {
    requireJapaneseSubtextAuth(context.accessToken);
    const parsed = parseOptions(args, { "--input": "value" });
    assertNoPositionals(parsed);
    if (!parsed.options.input) {
      throw new CliInputError(
        "japanese-subtext attempt requires --input FILE or --input -.",
        "JAPANESE_SUBTEXT_ATTEMPT_INPUT_REQUIRED"
      );
    }
    let text;
    if (parsed.options.input === "-") {
      if (context.tokenStdin) {
        throw new CliInputError(
          "--token-stdin cannot share standard input with a Japanese Subtext attempt.",
          "STDIN_INPUT_CONFLICT"
        );
      }
      text = await context.readStdin();
    } else {
      text = await readBoundedFile(parsed.options.input, MAX_STDIN_BYTES, {
        notFoundMessage: "The Japanese Subtext attempt input file does not exist.",
        notFoundCode: "JAPANESE_SUBTEXT_ATTEMPT_FILE_NOT_FOUND",
        invalidMessage: "The Japanese Subtext attempt input must be a regular file no larger than 1 MiB.",
        invalidCode: "JAPANESE_SUBTEXT_ATTEMPT_FILE_INVALID"
      });
    }
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new CliInputError(
        "The Japanese Subtext attempt input must be valid JSON.",
        "JAPANESE_SUBTEXT_ATTEMPT_JSON_INVALID"
      );
    }
    return client.submitJapaneseSubtextAttempt(normalizeJapaneseSubtextAttempt(payload));
  }
  throw new CliInputError(
    `Unknown japanese-subtext command: ${command || "<missing>"}`,
    "JAPANESE_SUBTEXT_COMMAND_UNKNOWN"
  );
}

async function runAuthCommand(command, args, context) {
  const {
    env,
    stderr,
    baseUrl,
    stateOptions,
    credential,
    global,
    readStdin
  } = context;
  if (global.tokenStdin && command === "login") {
    throw new CliInputError("auth login does not accept --token-stdin.", "AUTH_LOGIN_TOKEN_STDIN_UNSUPPORTED");
  }
  if (command === "login") {
    const parsed = parseOptions(args, { "--scopes": "value", "--no-browser": "boolean" });
    assertNoPositionals(parsed);
    const client = new SiteClient({ fetch: context.fetch, baseUrl });
    const scopes = splitCommaList(parsed.options.scopes);
    const started = await client.startDeviceAuthorization(scopes.length ? { scopes } : {});
    validateDeviceStart(started);
    const now = context.now || Date.now;
    const expiresAt = now() + Number(started.expiresIn) * 1000;
    writeText(stderr, `Open ${started.verificationUriComplete}\nCode: ${started.userCode}\nWaiting for authorization…`);
    if (!parsed.options.noBrowser && env.LUSU_NO_BROWSER !== "1") {
      const opener = context.openBrowser || openBrowser;
      await opener(started.verificationUriComplete).catch(() => {});
    }
    const sleep = context.sleep || delay;
    let pollIntervalMs = clampNumber(Number(started.interval) * 1000, 1000, 30_000, 5000);
    let nextDelayMs = pollIntervalMs;
    let token;
    while (now() < expiresAt) {
      await sleep(Math.min(nextDelayMs, Math.max(0, expiresAt - now())));
      if (now() >= expiresAt) break;
      const pollDeadline = createPollDeadline(expiresAt - now());
      try {
        const polledToken = await client.pollDeviceAuthorization(started.deviceCode, {
          signal: pollDeadline.signal
        });
        if (now() >= expiresAt) break;
        token = polledToken;
        break;
      } catch (error) {
        if (error instanceof SiteClientError && error.code === "AUTHORIZATION_PENDING") {
          nextDelayMs = pollIntervalMs;
          continue;
        }
        if (error instanceof SiteClientError && error.code === "SLOW_DOWN") {
          pollIntervalMs = Math.min(30_000, pollIntervalMs + 5000);
          nextDelayMs = pollIntervalMs;
          continue;
        }
        if (isTransientDevicePollError(error)) {
          nextDelayMs = Math.min(30_000, Math.max(pollIntervalMs, nextDelayMs * 2));
          continue;
        }
        throw error;
      } finally {
        pollDeadline.cancel();
      }
    }
    if (!token?.accessToken || now() >= expiresAt) {
      throw new CliInputError("Device authorization expired before approval.", "AUTHORIZATION_EXPIRED");
    }
    await writeStoredCredential({ ...token, baseUrl }, stateOptions);
    return {
      authenticated: true,
      tokenType: "Bearer",
      expiresAt: token.expiresAt || "",
      scopes: token.scopes || [],
      user: token.user || null,
      credentialStore: resolveConfigDirectory(stateOptions)
    };
  }
  if (command === "status") {
    const parsed = parseOptions(args, {});
    assertNoPositionals(parsed);
    const explicitAccessToken = global.tokenStdin ? firstNonEmptyLine(await readStdin()) : undefined;
    const auth = resolveSiteAuthContext({
      baseUrl,
      env,
      credential,
      defaultBaseUrl: DEFAULT_BASE_URL,
      explicitAccessToken,
      explicitAccessTokenProvided: global.tokenStdin
    });
    if (!auth.accessToken) return { authenticated: false, user: null, scopes: [] };
    const client = new SiteClient({ fetch: context.fetch, baseUrl, accessToken: auth.accessToken });
    const identity = await client.getAgentIdentity();
    return { authenticated: true, user: identity.user || null, scopes: identity.scopes || [] };
  }
  if (command === "logout") {
    const parsed = parseOptions(args, {});
    assertNoPositionals(parsed);
    const explicitAccessToken = global.tokenStdin ? firstNonEmptyLine(await readStdin()) : undefined;
    const auth = resolveSiteAuthContext({
      baseUrl,
      env,
      credential,
      defaultBaseUrl: DEFAULT_BASE_URL,
      explicitAccessToken,
      explicitAccessTokenProvided: global.tokenStdin
    });
    let revoked = false;
    if (auth.accessToken) {
      const client = new SiteClient({ fetch: context.fetch, baseUrl, accessToken: auth.accessToken });
      try {
        await client.revokeAgentToken();
        revoked = true;
      } catch (error) {
        if (!(error instanceof SiteClientError && [404, 405].includes(error.status))) throw error;
      }
    }
    const removed = auth.credentialMatchesOrigin
      ? await deleteStoredCredential(stateOptions)
      : false;
    return { authenticated: false, revoked, localCredentialsRemoved: removed };
  }
  throw new CliInputError(`Unknown auth command: ${command || "<missing>"}`, "AUTH_COMMAND_UNKNOWN");
}

async function runTransferCommand(client, command, args, context) {
  if (command === "join") {
    const parsed = parseOptions(args, { "--password-stdin": "boolean" });
    assertNoPositionals(parsed);
    let passphrase;
    if (parsed.options.passwordStdin || !context.stdin.isTTY) {
      passphrase = firstNonEmptyLine(await context.readStdin());
    } else {
      passphrase = await readHiddenLine("Room passphrase: ", context);
    }
    const secret = await deriveTransferRoomSecret(passphrase, context.stateOptions);
    const joined = await client.joinTransferRoom(secret);
    const roomHandle = await storeRoomHandle(secret, context.stateOptions);
    return { roomHandle, room: joined.room };
  }
  if (command === "ls") {
    const parsed = parseOptions(args, {
      "--cursor": "value",
      "--limit": "value",
      "--password-stdin": "boolean"
    });
    if (parsed.positionals.length !== 1) throw new CliInputError("transfer ls requires one room handle.", "TRANSFER_ROOM_HANDLE_REQUIRED");
    const roomAccess = parsed.options.passwordStdin
      ? await loadCliRoomSecret(parsed.positionals[0], parsed, context)
      : await loadRoomKey(parsed.positionals[0], context.stateOptions);
    const payload = await client.listTransferItems(roomAccess, {
      cursor: parsed.options.cursor,
      limit: parsed.options.limit
    });
    return sanitizeTransferListing(payload);
  }
  if (command === "send") {
    const parsed = parseOptions(args, { "--text-stdin": "boolean", "--password-stdin": "boolean" });
    if (parsed.positionals.length < 1) throw new CliInputError("transfer send requires a room handle.", "TRANSFER_ROOM_HANDLE_REQUIRED");
    if (parsed.options.textStdin && parsed.positionals.length > 1) {
      throw new CliInputError("Provide transfer text either as arguments or through --text-stdin.", "TRANSFER_TEXT_AMBIGUOUS");
    }
    if (parsed.options.textStdin && (parsed.options.passwordStdin || !context.stdin.isTTY)) {
      throw new CliInputError(
        "--text-stdin cannot share standard input with the room passphrase; pass text as an argument or use an interactive hidden passphrase prompt.",
        "STDIN_SECRET_CONFLICT"
      );
    }
    const secret = await loadCliRoomSecret(parsed.positionals[0], parsed, context);
    const text = parsed.options.textStdin
      ? await context.readStdin()
      : parsed.positionals.slice(1).join(" ");
    const payload = await client.sendTransferText(secret, text);
    return { item: sanitizeTransferItem(payload.item) };
  }
  if (command === "put") {
    const parsed = parseOptions(args, { "--mime": "value" });
    if (parsed.positionals.length !== 2) {
      throw new CliInputError("transfer put requires a room handle and file path.", "TRANSFER_PUT_ARGUMENTS_REQUIRED");
    }
    const roomKey = await loadRoomKey(parsed.positionals[0], context.stateOptions);
    const filePath = await fs.realpath(path.resolve(parsed.positionals[1]));
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size <= 0) throw new CliInputError("The upload must be a non-empty regular file.", "TRANSFER_UPLOAD_FILE_INVALID");
    const payload = await client.uploadTransferFile(roomKey, {
      filename: path.basename(filePath),
      mimeType: parsed.options.mime || inferMimeType(filePath),
      sizeBytes: stat.size,
      body: createReadStream(filePath)
    });
    return { item: sanitizeTransferItem(payload.item) };
  }
  if (command === "get") {
    const parsed = parseOptions(args, {});
    if (parsed.positionals.length !== 3) {
      throw new CliInputError("transfer get requires a room handle, item id, and destination path.", "TRANSFER_GET_ARGUMENTS_REQUIRED");
    }
    const roomKey = await loadRoomKey(parsed.positionals[0], context.stateOptions);
    const destination = path.resolve(parsed.positionals[2]);
    const parent = await fs.stat(path.dirname(destination)).catch(() => null);
    if (!parent?.isDirectory()) throw new CliInputError("The destination directory does not exist.", "TRANSFER_DESTINATION_INVALID");
    const opened = await openNoClobberSink(destination);
    try {
      const download = await client.downloadTransferFile(roomKey, parsed.positionals[1], opened.sink);
      return { destination, ...download };
    } catch (error) {
      await opened.cleanup();
      throw error;
    }
  }
  if (command === "rm") {
    const parsed = parseOptions(args, { "--yes": "boolean" });
    if (parsed.positionals.length !== 2) {
      throw new CliInputError("transfer rm requires a room handle and item id.", "TRANSFER_RM_ARGUMENTS_REQUIRED");
    }
    if (!parsed.options.yes) {
      throw new CliInputError("transfer rm is destructive; repeat with --yes.", "CONFIRMATION_REQUIRED");
    }
    const roomKey = await loadRoomKey(parsed.positionals[0], context.stateOptions);
    return client.deleteTransferItem(roomKey, parsed.positionals[1]);
  }
  throw new CliInputError(`Unknown transfer command: ${command || "<missing>"}`, "TRANSFER_COMMAND_UNKNOWN");
}

async function runWhiteboardCommand(client, command, args, context) {
  if (command === "join") {
    const parsed = parseOptions(args, {
      "--public": "boolean",
      "--password-stdin": "boolean",
      "--secret-ref": "value"
    });
    assertNoPositionals(parsed);
    const privateModes = [parsed.options.passwordStdin, Boolean(parsed.options.secretRef)].filter(Boolean).length;
    if (parsed.options.public && privateModes) {
      throw new CliInputError("Choose either --public or one private-room secret input.", "WHITEBOARD_JOIN_MODE_CONFLICT");
    }
    if (privateModes > 1) {
      throw new CliInputError("Choose either --password-stdin or --secret-ref.", "WHITEBOARD_SECRET_INPUT_CONFLICT");
    }
    if (parsed.options.public) {
      return joinWhiteboardHandle(client, { type: "public" }, context.stateOptions);
    }
    let password;
    if (parsed.options.secretRef) {
      password = await context.stateOptions.secretResolver(parsed.options.secretRef, context.stateOptions);
    } else if (parsed.options.passwordStdin || !context.stdin.isTTY) {
      password = firstNonEmptyLine(await context.readStdin());
    } else {
      password = await readHiddenLine("Whiteboard password: ", context);
    }
    return joinWhiteboardHandle(client, {
      type: "private",
      password,
      secretRef: parsed.options.secretRef
    }, context.stateOptions);
  }
  if (command === "scene") {
    const parsed = parseOptions(args, {});
    if (parsed.positionals.length !== 1) {
      throw new CliInputError("whiteboard scene requires one board handle.", "WHITEBOARD_HANDLE_REQUIRED");
    }
    return readWhiteboardHandle(client, parsed.positionals[0], context.stateOptions);
  }
  if (command === "draw") {
    const parsed = parseOptions(args, {
      "--input": "value",
      "--operation-id": "value"
    });
    if (parsed.positionals.length !== 1) {
      throw new CliInputError("whiteboard draw requires one board handle.", "WHITEBOARD_HANDLE_REQUIRED");
    }
    if (!parsed.options.input && context.tokenStdin) {
      throw new CliInputError("--token-stdin cannot share standard input with a draw document; use --input FILE.", "STDIN_INPUT_CONFLICT");
    }
    const text = parsed.options.input
      ? await readBoundedFile(parsed.options.input, MAX_STDIN_BYTES)
      : await context.readStdin();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new CliInputError("The whiteboard draw input must be valid JSON.", "WHITEBOARD_DRAW_JSON_INVALID");
    }
    const elements = Array.isArray(payload) ? payload : payload?.elements;
    const operationId = parsed.options.operationId || (Array.isArray(payload) ? "" : payload?.operationId);
    if (!operationId) {
      throw new CliInputError("whiteboard draw requires --operation-id or an operationId in the JSON document.", "WHITEBOARD_OPERATION_ID_REQUIRED");
    }
    return drawWhiteboardHandle(client, parsed.positionals[0], { operationId, elements }, context.stateOptions);
  }
  if (command === "export") {
    const parsed = parseOptions(args, { "--format": "value" });
    if (parsed.positionals.length !== 2) {
      throw new CliInputError("whiteboard export requires a board handle and destination path.", "WHITEBOARD_EXPORT_ARGUMENTS_REQUIRED");
    }
    const destination = path.resolve(parsed.positionals[1]);
    const format = String(parsed.options.format || path.extname(destination).slice(1) || "json").toLowerCase();
    const parent = await fs.stat(path.dirname(destination)).catch(() => null);
    if (!parent?.isDirectory()) {
      throw new CliInputError("The export destination directory does not exist.", "WHITEBOARD_DESTINATION_INVALID");
    }
    const exported = await exportWhiteboardHandle(client, parsed.positionals[0], format, context.stateOptions);
    const opened = await openNoClobberSink(destination);
    try {
      await opened.sink.write(exported.bytes);
      await opened.close();
    } catch (error) {
      await opened.cleanup();
      throw error;
    }
    return {
      destination,
      format,
      mediaType: exported.mediaType,
      bytesWritten: exported.bytes.byteLength,
      warnings: exported.warnings,
      documentVersion: exported.documentVersion,
      elementCount: exported.elementCount
    };
  }
  throw new CliInputError(`Unknown whiteboard command: ${command || "<missing>"}`, "WHITEBOARD_COMMAND_UNKNOWN");
}

async function runGameCommand(store, command, args, context) {
  if (command === "create") {
    const parsed = parseOptions(args, {});
    if (parsed.positionals.length !== 1) {
      throw new CliInputError("game create requires one game id.", "GAME_ID_REQUIRED");
    }
    return store.createSession(parsed.positionals[0]);
  }
  if (command === "observe" || command === "actions") {
    const parsed = parseOptions(args, {});
    if (parsed.positionals.length !== 1) {
      throw new CliInputError(`game ${command} requires one session id.`, "GAME_SESSION_ID_REQUIRED");
    }
    return command === "observe"
      ? store.observeSession(parsed.positionals[0])
      : store.actionsForSession(parsed.positionals[0]);
  }
  if (command === "act") {
    const parsed = parseOptions(args, {
      "--input": "value",
      "--expected-revision": "value",
      "--client-action-id": "value",
      "--direction": "value",
      "--reset": "boolean",
      "--yes": "boolean"
    });
    if (parsed.positionals.length !== 1) {
      throw new CliInputError("game act requires one session id.", "GAME_SESSION_ID_REQUIRED");
    }
    const directOptions = [
      parsed.options.expectedRevision,
      parsed.options.clientActionId,
      parsed.options.direction,
      parsed.options.reset,
      parsed.options.yes
    ].some((value) => value !== undefined);
    if (parsed.options.input && directOptions) {
      throw new CliInputError("Use either --input or direct game action options.", "GAME_ACTION_INPUT_CONFLICT");
    }
    let request;
    if (parsed.options.input) {
      let text;
      if (parsed.options.input === "-") {
        if (context.tokenStdin) {
          throw new CliInputError("--token-stdin cannot share standard input with a game action.", "STDIN_INPUT_CONFLICT");
        }
        text = await context.readStdin();
      } else {
        text = await readBoundedFile(parsed.options.input, MAX_STDIN_BYTES);
      }
      try {
        request = JSON.parse(text);
      } catch {
        throw new CliInputError("The game action input must be valid JSON.", "GAME_ACTION_JSON_INVALID");
      }
    } else {
      if (parsed.options.expectedRevision === undefined || !parsed.options.clientActionId) {
        throw new CliInputError("Direct game actions require --expected-revision and --client-action-id.", "GAME_ACTION_METADATA_REQUIRED");
      }
      if (parsed.options.reset && parsed.options.direction) {
        throw new CliInputError("Choose either --direction or --reset.", "GAME_ACTION_CONFLICT");
      }
      if (!parsed.options.reset && !parsed.options.direction) {
        throw new CliInputError("Direct game actions require either --direction or --reset.", "GAME_ACTION_REQUIRED");
      }
      if (parsed.options.reset && !parsed.options.yes) {
        throw new CliInputError("Reset is destructive; repeat with --reset --yes.", "CONFIRMATION_REQUIRED");
      }
      const action = parsed.options.reset
        ? { type: "reset", confirm: true }
        : { type: "move", direction: parsed.options.direction };
      request = {
        expectedRevision: Number(parsed.options.expectedRevision),
        clientActionId: parsed.options.clientActionId,
        action
      };
    }
    return store.actSession(parsed.positionals[0], request);
  }
  if (command === "close") {
    const parsed = parseOptions(args, { "--yes": "boolean" });
    if (parsed.positionals.length !== 1) {
      throw new CliInputError("game close requires one session id.", "GAME_SESSION_ID_REQUIRED");
    }
    if (!parsed.options.yes) {
      throw new CliInputError("Closing a game session is destructive; repeat with --yes.", "CONFIRMATION_REQUIRED");
    }
    return store.closeSession(parsed.positionals[0], { confirm: true });
  }
  throw new CliInputError(`Unknown game command: ${command || "<missing>"}`, "GAME_COMMAND_UNKNOWN");
}

export class CliInputError extends Error {
  constructor(message, code = "CLI_INPUT_ERROR") {
    super(message);
    this.name = "CliInputError";
    this.code = code;
  }
}

function extractGlobalOptions(args) {
  const output = [];
  let baseUrl = "";
  let tokenStdin = false;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--base-url") {
      baseUrl = requireOptionValue(args[++index], "--base-url");
    } else if (value.startsWith("--base-url=")) {
      baseUrl = requireOptionValue(value.slice(11), "--base-url");
    } else if (value === "--token-stdin") {
      tokenStdin = true;
    } else {
      output.push(value);
    }
  }
  return { args: output, baseUrl, tokenStdin };
}

function parseOptions(args, schema) {
  const options = {};
  const positionals = [];
  let positionalOnly = false;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (positionalOnly || !value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    if (value === "--") {
      positionalOnly = true;
      continue;
    }
    const equals = value.indexOf("=");
    const name = equals > 0 ? value.slice(0, equals) : value;
    const kind = schema[name];
    if (!kind) throw new CliInputError(`Unknown option: ${name}`, "OPTION_UNKNOWN");
    const key = optionKey(name);
    if (kind === "boolean") {
      if (equals > 0) throw new CliInputError(`${name} does not accept a value.`, "OPTION_VALUE_UNEXPECTED");
      options[key] = true;
    } else {
      const optionValue = equals > 0 ? value.slice(equals + 1) : args[++index];
      options[key] = requireOptionValue(optionValue, name);
    }
  }
  return { options, positionals };
}

function optionKey(name) {
  return name.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function requireOptionValue(value, name) {
  if (value === undefined || value === "" || String(value).startsWith("--")) {
    throw new CliInputError(`${name} requires a value.`, "OPTION_VALUE_REQUIRED");
  }
  return String(value);
}

function validateOptionalLanguage(value) {
  if (value === undefined) return undefined;
  const language = String(value).trim().toLowerCase();
  if (!["zh", "en", "ja"].includes(language)) {
    throw new CliInputError("--lang must be zh, en, or ja.", "LANGUAGE_INVALID");
  }
  return language;
}

function validateVideoId(value) {
  const videoId = String(value || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$/.test(videoId)) {
    throw new CliInputError("A valid video id is required.", "VIDEO_ID_INVALID");
  }
  return videoId;
}

function validateCatalogId(value, kind) {
  const id = String(value || "").trim();
  const code = kind === "tool" ? "TOOL_ID_INVALID" : "GAME_ID_INVALID";
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) {
    throw new CliInputError(`A valid ${kind} id is required.`, code);
  }
  return id;
}

function validateJapaneseLevel(value) {
  if (value === undefined) {
    throw new CliInputError("japanese-subtext stages requires --level 1-5.", "JAPANESE_SUBTEXT_LEVEL_REQUIRED");
  }
  if (!/^[1-5]$/.test(String(value))) {
    throw new CliInputError("--level must be an integer from 1 to 5.", "JAPANESE_SUBTEXT_LEVEL_INVALID");
  }
  return Number(value);
}

function validateJapaneseStageId(value) {
  const stageId = String(value || "").trim();
  const match = /^L([1-5])-(\d{3})$/.exec(stageId);
  const position = Number(match?.[2] || 0);
  if (!match || position < 1 || position > 50) {
    throw new CliInputError(
      "A stage id from L1-001 through L5-050 is required.",
      "JAPANESE_SUBTEXT_STAGE_ID_INVALID"
    );
  }
  return stageId;
}

function requireJapaneseSubtextAuth(accessToken) {
  if (!accessToken) {
    throw new CliInputError("Sign in first with `lusu auth login`.", "AUTH_REQUIRED");
  }
}

function normalizeJapaneseSubtextAttempt(value) {
  assertExactCliObjectKeys(value, [
    "stageId",
    "stageRevision",
    "contentHash",
    "answers",
    "expectedRevision",
    "operationId"
  ], "JAPANESE_SUBTEXT_ATTEMPT_INVALID");
  if (!Number.isSafeInteger(value.stageRevision) || value.stageRevision < 1 || value.stageRevision > 1_000_000) {
    throw new CliInputError(
      "stageRevision must be an integer from 1 to 1000000.",
      "JAPANESE_SUBTEXT_STAGE_REVISION_INVALID"
    );
  }
  const contentHash = String(value.contentHash || "").trim();
  if (!/^[a-f0-9]{64}$/.test(contentHash)) {
    throw new CliInputError(
      "contentHash must be a lowercase SHA-256 digest.",
      "JAPANESE_SUBTEXT_CONTENT_HASH_INVALID"
    );
  }
  if (!Array.isArray(value.answers) || value.answers.length < 1 || value.answers.length > 5) {
    throw new CliInputError("answers must contain 1-5 question answers.", "JAPANESE_SUBTEXT_ANSWERS_INVALID");
  }
  const questionIds = new Set();
  const answers = value.answers.map((answer) => {
    assertExactCliObjectKeys(answer, ["questionId", "optionIds"], "JAPANESE_SUBTEXT_ANSWER_INVALID");
    const questionId = String(answer.questionId || "").trim();
    if (!/^q[1-5]$/.test(questionId) || questionIds.has(questionId)) {
      throw new CliInputError(
        "questionId values must be unique q1-q5 ids.",
        "JAPANESE_SUBTEXT_QUESTION_ID_INVALID"
      );
    }
    questionIds.add(questionId);
    if (!Array.isArray(answer.optionIds) || answer.optionIds.length < 1 || answer.optionIds.length > 6) {
      throw new CliInputError("Each answer must contain 1-6 optionIds.", "JAPANESE_SUBTEXT_OPTION_IDS_INVALID");
    }
    const optionIds = answer.optionIds.map((optionId) => String(optionId || "").trim());
    if (optionIds.some((optionId) => !/^[a-f]$/.test(optionId)) || new Set(optionIds).size !== optionIds.length) {
      throw new CliInputError("optionIds must be unique a-f ids.", "JAPANESE_SUBTEXT_OPTION_IDS_INVALID");
    }
    return { questionId, optionIds };
  });
  if (!Number.isSafeInteger(value.expectedRevision)
    || value.expectedRevision < 1
    || value.expectedRevision > 1_000_000) {
    throw new CliInputError(
      "expectedRevision must be an integer from 1 to 1000000.",
      "JAPANESE_SUBTEXT_EXPECTED_REVISION_INVALID"
    );
  }
  const operationId = String(value.operationId || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/.test(operationId)) {
    throw new CliInputError(
      "operationId must contain 8-80 safe ASCII characters.",
      "JAPANESE_SUBTEXT_OPERATION_ID_INVALID"
    );
  }
  return {
    stageId: validateJapaneseStageId(value.stageId),
    stageRevision: value.stageRevision,
    contentHash,
    answers,
    expectedRevision: value.expectedRevision,
    operationId
  };
}

function assertExactCliObjectKeys(value, keys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CliInputError("The Japanese Subtext attempt payload is invalid.", code);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new CliInputError("The Japanese Subtext attempt payload contains missing or unknown fields.", code);
  }
}

function validateOptionalInteger(value, min, max, optionName) {
  if (value === undefined) return undefined;
  const text = String(value);
  if (!/^[1-9]\d*$/.test(text)) {
    throw new CliInputError(`${optionName} must be an integer from ${min} to ${max}.`, "OPTION_INTEGER_INVALID");
  }
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new CliInputError(`${optionName} must be an integer from ${min} to ${max}.`, "OPTION_INTEGER_INVALID");
  }
  return number;
}

function normalizeOptionalQuery(value) {
  if (value === undefined) return undefined;
  const query = String(value).normalize("NFKC").trim();
  if (!query || query.length > 200) {
    throw new CliInputError("--query must contain 1-200 characters.", "QUERY_INVALID");
  }
  return query;
}

function rejectPlaintextPasswordOption(args) {
  const forbidden = args.find((value) => value === "--password" || value.startsWith("--password="));
  if (forbidden) {
    throw new CliInputError(
      "Plaintext passwords are never accepted as command arguments; use --password-stdin or the hidden prompt.",
      "PASSWORD_ARGUMENT_FORBIDDEN"
    );
  }
}

function assertNoPositionals(parsed) {
  if (parsed.positionals.length) throw new CliInputError(`Unexpected argument: ${parsed.positionals[0]}`, "ARGUMENT_UNEXPECTED");
}

async function readStreamText(stream, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.byteLength;
    if (total > maxBytes) throw new CliInputError("Standard input is too large.", "STDIN_TOO_LARGE");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readBoundedFile(filePath, maxBytes, messages = {}) {
  const resolved = await fs.realpath(path.resolve(filePath)).catch((error) => {
    throw new CliInputError(
      messages.notFoundMessage || "The whiteboard draw input file does not exist.",
      messages.notFoundCode || "WHITEBOARD_DRAW_FILE_NOT_FOUND",
      { cause: error }
    );
  });
  const stat = await fs.stat(resolved);
  if (!stat.isFile() || stat.size > maxBytes) {
    throw new CliInputError(
      messages.invalidMessage || "The whiteboard draw input must be a regular file no larger than 1 MiB.",
      messages.invalidCode || "WHITEBOARD_DRAW_FILE_INVALID"
    );
  }
  return fs.readFile(resolved, "utf8");
}

async function readHiddenLine(prompt, context) {
  const stdin = context.stdin || process.stdin;
  const stderr = context.stderr || process.stderr;
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    return firstNonEmptyLine(await context.readStdin());
  }
  writeText(stderr, prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  let value = "";
  try {
    for await (const chunk of stdin) {
      for (const character of chunk) {
        if (character === "\r" || character === "\n") {
          writeText(stderr, "");
          return value;
        }
        if (character === "\u0003") throw new CliInputError("Input cancelled.", "INPUT_CANCELLED");
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else if (character >= " ") {
          value += character;
        }
      }
    }
    return value;
  } finally {
    stdin.setRawMode(false);
    stdin.pause();
  }
}

async function loadCliRoomSecret(roomHandle, parsed, context) {
  const passphrase = parsed.options.passwordStdin
    ? firstNonEmptyLine(await context.readStdin())
    : await readHiddenLine("Room passphrase: ", context);
  return loadRoomSecret(roomHandle, { ...context.stateOptions, passphrase });
}

function firstNonEmptyLine(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
}

function sanitizeTransferListing(payload) {
  return {
    room: payload.room,
    items: (payload.items || []).map(sanitizeTransferItem),
    nextCursor: payload.nextCursor || "",
    hasMore: Boolean(payload.hasMore),
    resetRequired: Boolean(payload.resetRequired),
    syncMode: payload.syncMode || ""
  };
}

function sanitizeTransferItem(item) {
  if (!item) return null;
  return compactObject({
    id: item.id,
    type: item.type,
    text: item.text,
    decryptionError: item.decryptionError,
    filename: item.filename,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    uploader: item.uploader,
    canDelete: item.canDelete,
    createdAt: item.createdAt,
    completedAt: item.completedAt,
    expiresAt: item.expiresAt
  });
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}

function splitCommaList(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function validateDeviceStart(value) {
  if (!value?.deviceCode || !value?.userCode || !value?.verificationUriComplete
    || !Number.isFinite(Number(value.expiresIn)) || Number(value.expiresIn) <= 0) {
    throw new CliInputError("The device authorization response is invalid.", "AUTH_DEVICE_RESPONSE_INVALID");
  }
}

function isTransientDevicePollError(error) {
  return error instanceof SiteClientError
    && (["SITE_NETWORK_ERROR", "SITE_REQUEST_ABORTED"].includes(error.code)
      || TRANSIENT_DEVICE_POLL_STATUSES.has(error.status));
}

function createPollDeadline(remainingMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, Math.ceil(remainingMs)));
  return {
    signal: controller.signal,
    cancel() { clearTimeout(timeout); }
  };
}

function clampNumber(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function openBrowser(url) {
  const target = String(url);
  const command = process.platform === "win32" ? "rundll32.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", target] : [target];
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

function inferMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    ".txt": "text/plain", ".md": "text/markdown", ".json": "application/json",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
    ".gif": "image/gif", ".svg": "image/svg+xml", ".pdf": "application/pdf",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".mp4": "video/mp4", ".webm": "video/webm",
    ".zip": "application/zip"
  })[extension] || "application/octet-stream";
}

function writeJson(stream, value) {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

function writeText(stream, value) {
  stream.write(`${value}\n`);
}

function helpText() {
  return [
    "LuSu personal-site CLI",
    "",
    "  lusu capabilities [--domain NAME] [--transport cli]",
    "  lusu content list [--lang zh|en|ja] [--category ID]",
    "  lusu content search QUERY [--lang zh|en|ja] [--category ID]",
    "  lusu content get SLUG [--lang zh|en|ja]",
    "  lusu content daily [--date YYYY-MM-DD] [--lang zh|en|ja]",
    "  lusu videos list [--query TEXT] [--lang zh|en|ja]",
    "  lusu videos get VIDEO_ID",
    "  lusu tools list [--lang zh|en|ja]",
    "  lusu tools get TOOL_ID [--lang zh|en|ja]",
    "  lusu games list [--lang zh|en|ja] [--agent-only]",
    "  lusu games get GAME_ID [--lang zh|en|ja]",
    "  lusu japanese-subtext levels [--lang zh|en|ja]",
    "  lusu japanese-subtext stages --level 1|2|3|4|5 [--query TEXT] [--limit 1..50] [--lang zh|en|ja]",
    "  lusu japanese-subtext get L1-001 [--lang zh|en|ja]",
    "  lusu japanese-subtext progress [--stage-id L1-001] [--days 1..90]",
    "  lusu japanese-subtext attempt --input ATTEMPT.json|-",
    "  lusu auth login [--scopes scope,scope] [--no-browser]",
    "  lusu auth status | logout",
    "  lusu transfer join [--password-stdin]",
    "  lusu transfer ls ROOM_HANDLE [--cursor CURSOR] [--password-stdin]",
    "  lusu transfer send ROOM_HANDLE TEXT [--password-stdin]",
    "  lusu transfer put ROOM_HANDLE FILE [--mime TYPE]",
    "  lusu transfer get ROOM_HANDLE ITEM_ID DESTINATION",
    "  lusu transfer rm ROOM_HANDLE ITEM_ID --yes",
    "  lusu whiteboard join --public | --password-stdin | --secret-ref env:NAME",
    "  lusu whiteboard scene BOARD_HANDLE",
    "  lusu whiteboard draw BOARD_HANDLE --input DRAW.json --operation-id ID",
    "  lusu whiteboard export BOARD_HANDLE DESTINATION [--format json|svg|png]",
    "  lusu game create 2048",
    "  lusu game observe SESSION_ID | actions SESSION_ID",
    "  lusu game act SESSION_ID --expected-revision N --client-action-id ID --direction up|down|left|right",
    "  lusu game act SESSION_ID --expected-revision N --client-action-id ID --reset --yes",
    "  lusu game act SESSION_ID --input ACTION.json",
    "  lusu game close SESSION_ID --yes",
    "",
    "Global: --base-url URL, --token-stdin. LUSU_ACCESS_TOKEN is also supported.",
    "Room passwords are never accepted through --password."
  ].join("\n");
}

function serializeCliError(error) {
  if (error instanceof SiteClientError) return error.toJSON();
  if (error instanceof PublicCatalogError || error instanceof JapaneseSubtextCapabilityError) {
    return { error: error.message, code: error.code, status: error.status };
  }
  if (
    error instanceof LocalStateError
    || error instanceof CliInputError
    || error instanceof WhiteboardSceneError
    || error instanceof GameProtocolError
    || error instanceof GameSessionStoreError
  ) {
    return { error: error.message, code: error.code, status: 0 };
  }
  return { error: "The CLI stopped because of an unexpected local error.", code: "CLI_INTERNAL_ERROR", status: 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    writeJson(process.stderr, serializeCliError(error));
    process.exitCode = 1;
  });
}
