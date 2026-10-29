import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { privateBrowserJob } from "../../../functions/api/private-browser-jobs.mjs";
const browserId = z.string().regex(/^[A-Za-z0-9_-]{16,100}$/);
export function registerBrowserTools(server: McpServer, env: Env, principal: any, execute: (value: any) => Promise<any>) {
  const definitions = [
    { name: "whiteboard_snapshot", operation: "submit", schema: z.object({ browserId }).strict() },
    { name: "kittens_command", operation: "submit", schema: z.object({ browserId,
      action: z.enum(["observe", "gather", "build", "research", "assign"]), id: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,79}$/).optional(), count: z.number().int().min(1).max(10).optional() }).strict() },
    { name: "browser_command_claim", operation: "claim", schema: z.object({ browserId }).strict() },
    { name: "browser_command_complete", operation: "complete", schema: z.object({ browserId, jobId: z.string().uuid(), result: z.record(z.string(), z.unknown()), failed: z.boolean().optional() }).strict() },
    { name: "browser_command_result", operation: "result", schema: z.object({ jobId: z.string().uuid() }).strict() }
  ];
  for (const item of definitions) {
    const scope = item.operation === "result" ? "admin:read" : "admin:write";
    server.registerTool(item.name, { title: item.name, description: item.operation === "submit"
      ? "Queue a command for the owner's explicitly connected real browser (Kittens or full whiteboard image). Count is supported only for gather/assign; build/research/observe execute once. Queued is NOT executed. Read browser_command_result before proceeding; never retry an execution-unknown mutation."
      : "Private browser companion command lifecycle. Claim and complete are for the local companion; results report actual execution state.",
      inputSchema: item.schema, annotations: { readOnlyHint: item.operation === "result", destructiveHint: item.operation !== "result", idempotentHint: item.operation === "result", openWorldHint: false },
      _meta: { securitySchemes: [{ type: "oauth2", scopes: [scope] }] }
    }, async (input: any) => execute({ requiredScope: scope, capabilityId: `browser.${item.operation}`, toolName: item.name, action: item.name,
      invoke: async () => ({ status: 200, payload: await privateBrowserJob({ env, principal, operation: item.operation, input: item.name === "whiteboard_snapshot" ? { ...input, action: "whiteboard_snapshot" } : input }) }) }));
  }
}
