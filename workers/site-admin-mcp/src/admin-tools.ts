import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { invokePrivateAdminOperation } from "../../../functions/api/[[route]].js";
import { adminContracts } from "./admin-contracts";

const READ = ["chat_read", "whiteboards_overview", "whiteboards_list", "whiteboard_status", "transfer_overview", "transfer_rooms", "transfer_items", "transfer_uploads", "transfer_settings_get", "h3_runners", "h3_jobs", "h3_job_get", "accounts_list", "account_get", "analytics_get", "traffic_get", "social_links_get",
  "videos_manage_list", "video_categories_list", "chat_manage_list", "chat_bans_list", "automation_get"];
const WRITE = ["chat_send", "account_sessions_revoke", "whiteboard_public_clear", "whiteboard_public_lock", "whiteboard_room_delete", "whiteboard_kick", "whiteboard_ban", "transfer_settings_update", "transfer_item_delete", "transfer_room_clear", "transfer_room_delete", "transfer_cleanup", "transfer_normal_upload_switch", "transfer_global_upload_switch", "transfer_upload_abort", "h3_job_create", "h3_job_cancel", "account_update", "traffic_update", "social_links_update",
  "video_category_create", "video_category_update", "video_category_delete", "chat_message_update",
  "chat_message_delete", "chat_room_delete", "chat_ban_create", "chat_ban_delete", "automation_update"];

const ACCOUNT_SCHEMAS = {
  chat_read: z.object({ query: z.object({ limit: z.number().int().min(1).max(100).optional(), after: z.string().max(180).optional() }).strict().optional() }).strict(),
  chat_send: z.object({ confirm: z.literal(true), body: z.object({
    content: z.string().trim().min(1).max(1000), clientRequestId: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/)
  }).strict() }).strict(),
  account_get: z.object({ id: z.string().min(1).max(180) }).strict(),
  account_update: z.object({ id: z.string().min(1).max(180), confirm: z.literal(true),
    body: z.object({ email: z.string().email().optional(), role: z.enum(["admin", "user"]).optional(),
      newPassword: z.string().min(8).max(256).optional(), revokeSessions: z.boolean().optional()
    }).strict().refine(value => value.email !== undefined || value.role !== undefined || value.newPassword !== undefined,
      "Supply an email, role or password change.") }).strict(),
  account_sessions_revoke: z.object({ id: z.string().min(1).max(180), confirm: z.literal(true),
    body: z.object({ confirm: z.literal(true) }).strict() }).strict()
} as const;

export function registerPrivateAdminTools(server: McpServer, env: Env, principal: any,
  execute: (execution: any) => Promise<any>, accessToken?: string) {
  for (const operation of [...READ, ...WRITE]) {
    if (!(operation in ACCOUNT_SCHEMAS) && !adminContracts[operation]) throw new Error(`Missing admin contract: ${operation}`);
    const readOnly = READ.includes(operation);
    const requiredScope = readOnly ? "admin:read" : "admin:write";
    server.registerTool(operation, {
      title: operation.replaceAll("_", " "),
      description: `Private owner administration: ${operation}. Uses the existing admin validation and response. ${readOnly ? "Read only." : "Changes real site data; inspect the target and payload before calling."}`,
      inputSchema: ACCOUNT_SCHEMAS[operation as keyof typeof ACCOUNT_SCHEMAS] || adminContracts[operation],
      annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: readOnly, openWorldHint: false },
      _meta: { securitySchemes: [{ type: "oauth2", scopes: [requiredScope] }] }
    }, async (input: { id?: string; query?: Record<string, string | number | boolean>; body?: Record<string, unknown>; confirm?: true }) => execute({ requiredScope, capabilityId: `admin.${operation}`,
      toolName: operation, action: `mcp-${operation}`, targetType: "admin", targetId: input.id,
      invoke: async () => ({ status: 200, payload: env.PRIVATE_ADMIN_BACKEND === "pages"
        ? await invokePagesAdmin(operation, input, accessToken)
        : await invokePrivateAdminOperation({ env, principal, operation, input }) })
    }));
  }
}

async function invokePagesAdmin(operation: string, input: unknown, token?: string) {
 if (!token) throw new Error("Authenticated request token required");
 const response = await fetch("https://lusu575.com/api/private-mcp", { method:"POST", redirect:"error", headers:{"Authorization": "Bearer " + token, "Content-Type":"application/json"}, body:JSON.stringify({operation,input}) });
 if (!response.ok) throw new Error("Private backend rejected operation");
 return await response.json();
}
