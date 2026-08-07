#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later

import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  HEXTRIS_CLIENT_ACTION_ID_PATTERN,
  HextrisSessionStoreError,
  createHextrisSessionStore
} from "./session-store.mjs";

const MAX_REVISION = 1_000_000_000;
const MAX_SEED = 0xffffffff;

export class HextrisCliError extends Error {
  constructor(message, code = "HEXTRIS_CLI_INPUT_INVALID") {
    super(message);
    this.name = "HextrisCliError";
    this.code = code;
  }
}

export async function runHextrisAgentCli(argv, options = {}) {
  if (!Array.isArray(argv)) {
    throw new HextrisCliError(
      "CLI arguments must be an array of strings.",
      "HEXTRIS_CLI_ARGUMENTS_INVALID"
    );
  }
  const args = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (typeof value !== "string") {
      throw new HextrisCliError(
        "CLI arguments must be an array of strings.",
        "HEXTRIS_CLI_ARGUMENTS_INVALID"
      );
    }
    args.push(value);
  }
  const command = args.shift() || "help";
  const store = options.store || createHextrisSessionStore(options.storeOptions || {});

  if (command === "help") {
    assertNoArguments(args, "help");
    return helpPayload();
  }

  if (command === "create") {
    const parsed = parseArguments(args, { "--seed": "value" });
    assertPositionals(parsed, 0, "create");
    const seed = parsed.options.seed === undefined
      ? undefined
      : parseInteger(parsed.options.seed, 0, MAX_SEED, "--seed", "HEXTRIS_SEED_INVALID");
    return store.createSession(seed === undefined ? {} : { seed });
  }

  if (command === "observe" || command === "actions") {
    const parsed = parseArguments(args, {});
    assertPositionals(parsed, 1, command);
    return command === "observe"
      ? store.observeSession(parsed.positionals[0])
      : store.actionsForSession(parsed.positionals[0]);
  }

  if (command === "act") {
    const parsed = parseArguments(args, {
      "--expected-revision": "value",
      "--client-action-id": "value",
      "--lane": "value"
    });
    assertPositionals(parsed, 1, "act");
    assertRequiredOptions(parsed, ["expectedRevision", "clientActionId", "lane"], "act");
    return store.actSession(parsed.positionals[0], {
      expectedRevision: parseRevision(parsed.options.expectedRevision),
      clientActionId: parseClientActionId(parsed.options.clientActionId),
      action: {
        type: "place",
        lane: parseInteger(parsed.options.lane, 0, 5, "--lane", "HEXTRIS_LANE_INVALID")
      }
    });
  }

  if (command === "reset") {
    const parsed = parseArguments(args, {
      "--expected-revision": "value",
      "--client-action-id": "value",
      "--yes": "boolean"
    });
    assertPositionals(parsed, 1, "reset");
    assertRequiredOptions(parsed, ["expectedRevision", "clientActionId", "yes"], "reset");
    if (parsed.options.yes !== true) {
      throw new HextrisCliError(
        "Resetting a Hextris session requires --yes.",
        "HEXTRIS_CONFIRMATION_REQUIRED"
      );
    }
    return store.resetSession(parsed.positionals[0], {
      expectedRevision: parseRevision(parsed.options.expectedRevision),
      clientActionId: parseClientActionId(parsed.options.clientActionId),
      confirm: true
    });
  }

  if (command === "close") {
    const parsed = parseArguments(args, { "--yes": "boolean" });
    assertPositionals(parsed, 1, "close");
    assertRequiredOptions(parsed, ["yes"], "close");
    if (parsed.options.yes !== true) {
      throw new HextrisCliError(
        "Closing a Hextris session requires --yes.",
        "HEXTRIS_CONFIRMATION_REQUIRED"
      );
    }
    return store.closeSession(parsed.positionals[0], { confirm: true });
  }

  throw new HextrisCliError(
    `Unknown Hextris agent command: ${safeCommandName(command)}.`,
    "HEXTRIS_COMMAND_UNKNOWN"
  );
}

export function safeHextrisCliError(error) {
  if (error instanceof HextrisCliError || error instanceof HextrisSessionStoreError) {
    return {
      error: error.message,
      code: error.code,
      ...(Number.isSafeInteger(error.currentRevision) ? { currentRevision: error.currentRevision } : {})
    };
  }
  return {
    error: "The Hextris agent command failed.",
    code: "HEXTRIS_COMMAND_FAILED"
  };
}

function helpPayload() {
  return {
    name: "LuSu Hextris Agent CLI",
    commands: [
      "create [--seed N]",
      "observe SESSION_ID",
      "actions SESSION_ID",
      "act SESSION_ID --expected-revision N --client-action-id ID --lane 0..5",
      "reset SESSION_ID --expected-revision N --client-action-id ID --yes",
      "close SESSION_ID --yes",
      "help"
    ]
  };
}

function parseArguments(args, schema) {
  const positionals = [];
  const options = {};
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    if (token === "--" || token.includes("=")) {
      throw new HextrisCliError(
        `Unsupported option syntax: ${safeOptionName(token)}.`,
        "HEXTRIS_OPTION_INVALID"
      );
    }
    const kind = schema[token];
    if (!kind) {
      throw new HextrisCliError(`Unknown option: ${safeOptionName(token)}.`, "HEXTRIS_OPTION_UNKNOWN");
    }
    if (seen.has(token)) {
      throw new HextrisCliError(`Option was provided more than once: ${token}.`, "HEXTRIS_OPTION_DUPLICATE");
    }
    seen.add(token);
    const key = optionKey(token);
    if (kind === "boolean") {
      options[key] = true;
      continue;
    }
    const value = args[++index];
    if (value === undefined || value.startsWith("--")) {
      throw new HextrisCliError(`Option ${token} requires a value.`, "HEXTRIS_OPTION_VALUE_REQUIRED");
    }
    options[key] = value;
  }
  return { positionals, options };
}

function optionKey(value) {
  return value.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function assertNoArguments(args, command) {
  if (args.length !== 0) {
    throw new HextrisCliError(`${command} does not accept arguments.`, "HEXTRIS_ARGUMENT_COUNT_INVALID");
  }
}

function assertPositionals(parsed, expected, command) {
  if (parsed.positionals.length !== expected) {
    throw new HextrisCliError(
      `${command} requires exactly ${expected} positional argument${expected === 1 ? "" : "s"}.`,
      "HEXTRIS_ARGUMENT_COUNT_INVALID"
    );
  }
}

function assertRequiredOptions(parsed, names, command) {
  const missing = names.filter((name) => parsed.options[name] === undefined);
  if (missing.length) {
    throw new HextrisCliError(
      `${command} is missing required option${missing.length === 1 ? "" : "s"}: ${missing.map(displayOption).join(", ")}.`,
      "HEXTRIS_OPTION_REQUIRED"
    );
  }
}

function displayOption(name) {
  return `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function parseRevision(value) {
  return parseInteger(
    value,
    0,
    MAX_REVISION,
    "--expected-revision",
    "HEXTRIS_REVISION_INVALID"
  );
}

function parseClientActionId(value) {
  const clientActionId = String(value || "");
  if (!HEXTRIS_CLIENT_ACTION_ID_PATTERN.test(clientActionId)) {
    throw new HextrisCliError(
      "--client-action-id is invalid.",
      "HEXTRIS_CLIENT_ACTION_ID_INVALID"
    );
  }
  return clientActionId;
}

function parseInteger(value, minimum, maximum, option, code) {
  const text = String(value ?? "");
  if (!/^(?:0|[1-9]\d*)$/.test(text)) {
    throw new HextrisCliError(`${option} must be an integer.`, code);
  }
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw new HextrisCliError(`${option} is outside its supported range.`, code);
  }
  return number;
}

function safeCommandName(value) {
  const text = String(value || "");
  return /^[A-Za-z0-9_-]{1,64}$/.test(text) ? text : "<invalid>";
}

function safeOptionName(value) {
  const text = String(value || "");
  return /^--[A-Za-z0-9-]{1,64}$/.test(text) ? text : "<invalid>";
}

async function main() {
  try {
    const result = await runHextrisAgentCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify(safeHextrisCliError(error))}\n`);
    process.exitCode = 1;
  }
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (entryPath && import.meta.url === entryPath) await main();
