#!/usr/bin/env node

/*
 * Hextris Agent - standalone deterministic Hextris MCP server.
 * Copyright (C) 2026 LuSu
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { createHextrisSessionStore } from "./session-store.mjs";

const SERVER_NAME = "lusu-hextris-agent";
const SERVER_VERSION = "0.1.0";
const MAX_REVISION = 1_000_000_000;

const sessionIdSchema = z.string().regex(/^hextris_[a-f0-9]{32}$/);
const clientActionIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
const revisionSchema = z.number().int().min(0).max(MAX_REVISION);
const placeActionSchema = z.object({
  type: z.literal("place"),
  lane: z.number().int().min(0).max(5)
}).strict();

export function createHextrisMcpServer(options = {}) {
  const store = options.store || createHextrisSessionStore(options.sessionStoreOptions);
  assertSessionStore(store);

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  registerTool(server, "hextris_session_create", {
    title: "Create an isolated Hextris session",
    description: "Creates a deterministic local Hextris simulation session. It does not attach to or control an open browser game.",
    inputSchema: z.object({
      seed: z.number().int().min(0).max(0xffffffff).optional()
    }).strict(),
    annotations: writeAnnotations({ idempotentHint: false })
  }, ({ seed }) => store.createSession({ ...(seed === undefined ? {} : { seed }) }));

  registerTool(server, "hextris_session_observe", {
    title: "Observe an isolated Hextris session",
    description: "Reads the bounded state, score, phase, revision, and terminal status of one standalone Hextris simulation.",
    inputSchema: z.object({ sessionId: sessionIdSchema }).strict(),
    annotations: readOnlyAnnotations()
  }, ({ sessionId }) => store.observeSession(sessionId));

  registerTool(server, "hextris_session_actions", {
    title: "List legal Hextris actions",
    description: "Lists bounded semantic actions for an isolated Hextris session. It returns no selectors, scripts, URLs, or raw key events.",
    inputSchema: z.object({ sessionId: sessionIdSchema }).strict(),
    annotations: readOnlyAnnotations()
  }, ({ sessionId }) => store.actionsForSession(sessionId));

  registerTool(server, "hextris_session_act", {
    title: "Place one Hextris block",
    description: "Applies one CAS-guarded semantic lane placement. clientActionId makes an exact retry idempotent.",
    inputSchema: z.object({
      sessionId: sessionIdSchema,
      expectedRevision: revisionSchema,
      clientActionId: clientActionIdSchema,
      action: placeActionSchema
    }).strict(),
    annotations: writeAnnotations({ idempotentHint: true })
  }, ({ sessionId, expectedRevision, clientActionId, action }) => store.actSession(sessionId, {
    expectedRevision,
    clientActionId,
    action
  }));

  registerTool(server, "hextris_session_reset", {
    title: "Reset an isolated Hextris session",
    description: "Discards the current standalone run and starts a new deterministic run. confirm=true, CAS, and clientActionId are required.",
    inputSchema: z.object({
      sessionId: sessionIdSchema,
      expectedRevision: revisionSchema,
      clientActionId: clientActionIdSchema,
      confirm: z.literal(true)
    }).strict(),
    annotations: destructiveAnnotations()
  }, ({ sessionId, expectedRevision, clientActionId, confirm }) => store.actSession(sessionId, {
    expectedRevision,
    clientActionId,
    action: { type: "reset", confirm }
  }));

  registerTool(server, "hextris_session_close", {
    title: "Close an isolated Hextris session",
    description: "Permanently removes one standalone local Hextris session. Explicit confirm=true is required.",
    inputSchema: z.object({
      sessionId: sessionIdSchema,
      confirm: z.literal(true)
    }).strict(),
    annotations: destructiveAnnotations()
  }, ({ sessionId, confirm }) => store.closeSession(sessionId, { confirm }));

  return server;
}

export function startHextrisMcpServer(options = {}) {
  const handle = serveStdio(
    () => createHextrisMcpServer(options),
    {
      legacy: "serve",
      transport: options.transport,
      onerror: () => {
        process.stderr.write(`${JSON.stringify({
          error: "Hextris MCP transport error.",
          code: "HEXTRIS_MCP_TRANSPORT_ERROR"
        })}\n`);
      }
    }
  );
  return { close: () => handle.close() };
}

function registerTool(server, name, config, handler) {
  server.registerTool(name, config, async (input) => {
    try {
      const result = await handler(input);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: { result }
      };
    } catch (error) {
      const result = safeToolError(error);
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: { result }
      };
    }
  });
}

function safeToolError(error) {
  const code = typeof error?.code === "string" && /^HEXTRIS_[A-Z0-9_]{1,72}$/.test(error.code)
    ? error.code
    : "HEXTRIS_MCP_OPERATION_FAILED";
  if (code === "HEXTRIS_MCP_OPERATION_FAILED") {
    return {
      error: "The standalone Hextris MCP operation failed.",
      code,
      status: 0
    };
  }
  const message = typeof error?.message === "string"
    ? error.message.replace(/[\u0000-\u001f\u007f]/gu, " ").trim().slice(0, 300)
    : "";
  return {
    error: message || "The standalone Hextris operation was rejected.",
    code,
    status: 0
  };
}

function readOnlyAnnotations() {
  return {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  };
}

function writeAnnotations(overrides = {}) {
  return {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
    ...overrides
  };
}

function destructiveAnnotations() {
  return {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false
  };
}

function assertSessionStore(store) {
  const methods = ["createSession", "observeSession", "actionsForSession", "actSession", "closeSession"];
  if (!store || methods.some((method) => typeof store[method] !== "function")) {
    throw new TypeError("The standalone Hextris session store is invalid.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startHextrisMcpServer();
}
