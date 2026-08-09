import type { McpServer } from "@modelcontextprotocol/server";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { ensureAgentVideoSchema } from "../../../functions/api/agent-video-service.mjs";
import { ensureMcpOAuthLedgerSchema } from "../../../functions/api/mcp-oauth-ledger.mjs";
import { MCP_RESOURCE } from "../src/constants";
import {
  registerVideoOwnerTools,
  type OAuthVideoPrincipal
} from "../src/video-tools";

type ToolDefinition = {
  title?: string;
  description?: string;
  inputSchema: { parse: (input: unknown) => unknown };
  annotations?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

type ToolHandler = (input: any) => Promise<Record<string, any>>;

class ToolRegistry {
  readonly tools = new Map<string, { definition: ToolDefinition; handler: ToolHandler }>();

  registerTool(name: string, definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(name, { definition, handler });
  }

  async call(name: string, input: unknown): Promise<Record<string, any>> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return tool.handler(tool.definition.inputSchema.parse(input));
  }
}

const testEnv = env as unknown as Env & { DB: D1Database };
const USER_ID = "video-owner-1";
const CLIENT_ID = "video-owner-client";
const GRANT_REF = "video-owner-grant-0001";
const NOW = "2026-08-09T00:00:00.000Z";

function principal(scopes: string[]): OAuthVideoPrincipal {
  return {
    authType: "oauth",
    userId: USER_ID,
    clientId: CLIENT_ID,
    grantRef: GRANT_REF,
    resource: MCP_RESOURCE,
    effectiveScopes: [...scopes]
  };
}

function request(): Request {
  return new Request(MCP_RESOURCE, {
    headers: { "CF-Connecting-IP": "203.0.113.77" }
  });
}

function videoEnv(metadataFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): Env {
  return {
    ...testEnv,
    DB: testEnv.DB,
    ANALYTICS_IP_HASH_SALT: "video-tool-test-only-hmac-key-32-bytes",
    ...(metadataFetch ? { VIDEO_METADATA_FETCH: metadataFetch } : {})
  } as unknown as Env;
}

function registeredTools(
  scopes: string[],
  metadataFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): ToolRegistry {
  const registry = new ToolRegistry();
  registerVideoOwnerTools(
    registry as unknown as McpServer,
    videoEnv(metadataFetch),
    principal(scopes),
    request()
  );
  return registry;
}

function structured(result: Record<string, any>): Record<string, any> {
  return result.structuredContent || {};
}

async function activateGrant(scopes: string[]): Promise<void> {
  await testEnv.DB.prepare(`
    insert into mcp_oauth_grants (
      grant_ref, user_id, client_id, client_name, resource,
      authorized_scopes, status, created_at, activated_at, expires_at
    ) values (?, ?, ?, 'Video tool test', ?, ?, 'active', ?, ?, ?)
  `).bind(
    GRANT_REF,
    USER_ID,
    CLIENT_ID,
    MCP_RESOURCE,
    JSON.stringify(scopes),
    NOW,
    NOW,
    "2099-01-01T00:00:00.000Z"
  ).run();
}

beforeEach(async () => {
  await testEnv.DB.batch([
    testEnv.DB.prepare(`create table if not exists users (
      id text primary key,
      email text not null,
      role text not null
    )`),
    testEnv.DB.prepare(`create table if not exists videos (
      video_id text primary key,
      platform text not null,
      original_url text not null,
      external_id text not null,
      embed_url text not null,
      title text not null,
      description text not null default '',
      thumbnail_url text not null default '',
      author_name text not null default '',
      published_at text,
      status text not null default 'draft',
      sort_order integer not null default 0,
      pinned integer not null default 0,
      pinned_sort_order integer not null default 0,
      metadata_error text not null default '',
      created_at text not null,
      updated_at text not null
    )`),
    testEnv.DB.prepare(`create table if not exists video_categories (
      category_id text primary key,
      slug text not null unique,
      name_zh text not null,
      name_en text not null default '',
      name_ja text not null default '',
      sort_order integer not null default 0,
      enabled integer not null default 1,
      created_at text not null,
      updated_at text not null
    )`),
    testEnv.DB.prepare(`create table if not exists video_category_relations (
      video_id text not null references videos(video_id) on delete cascade,
      category_id text not null references video_categories(category_id) on delete cascade,
      sort_order integer not null default 0,
      created_at text not null,
      primary key (video_id, category_id)
    )`),
    testEnv.DB.prepare(`create table if not exists agent_audit_log (
      event_id text primary key,
      actor_user_id text not null default '',
      token_id text not null default '',
      action text not null,
      target_type text not null default '',
      target_id text not null default '',
      scopes text not null default '[]',
      result text not null default '',
      created_at text not null
    )`)
  ]);
  await ensureMcpOAuthLedgerSchema(testEnv);
  await ensureAgentVideoSchema(testEnv);
  await testEnv.DB.batch([
    testEnv.DB.prepare("delete from mcp_oauth_audit_log"),
    testEnv.DB.prepare("delete from mcp_oauth_grants"),
    testEnv.DB.prepare("delete from agent_video_receipts"),
    testEnv.DB.prepare("delete from video_upload_sessions"),
    testEnv.DB.prepare("delete from agent_audit_log"),
    testEnv.DB.prepare("delete from video_category_relations"),
    testEnv.DB.prepare("delete from videos"),
    testEnv.DB.prepare("delete from video_categories"),
    testEnv.DB.prepare("delete from users"),
    testEnv.DB.prepare("insert into users (id, email, role) values (?, ?, 'admin')")
      .bind(USER_ID, "video-owner@example.test"),
    testEnv.DB.prepare(`
      insert into video_categories (
        category_id, slug, name_zh, name_en, name_ja,
        sort_order, enabled, created_at, updated_at
      ) values ('tutorials', 'tutorials', '教程', 'Tutorials', 'チュートリアル', 10, 1, ?, ?)
    `).bind(NOW, NOW)
  ]);
});

describe("owner video MCP tools", () => {
  it("registers only the six strict external-video tools with minimum scopes", async () => {
    const tools = registeredTools(["content:write", "content:delete"]);
    expect([...tools.tools.keys()]).toEqual([
      "video_manage_list",
      "video_manage_get",
      "video_publish",
      "video_update",
      "video_refresh_metadata",
      "video_delete"
    ]);
    expect([...tools.tools.keys()].some((name) => name.includes("upload"))).toBe(false);
    for (const name of [
      "video_manage_list",
      "video_manage_get",
      "video_publish",
      "video_update",
      "video_refresh_metadata"
    ]) {
      expect(tools.tools.get(name)?.definition._meta?.securitySchemes).toEqual([
        { type: "oauth2", scopes: ["content:write"] }
      ]);
    }
    expect(tools.tools.get("video_delete")?.definition._meta?.securitySchemes).toEqual([
      { type: "oauth2", scopes: ["content:delete"] }
    ]);
    expect(tools.tools.get("video_publish")?.definition.description).toContain("YouTube or Bilibili");
    expect(tools.tools.get("video_publish")?.definition.description).toContain("never accepts local paths");

    await expect(tools.call("video_publish", {
      operationId: "video-schema-invalid-0001",
      originalUrl: "https://cdn.example/video.mp4",
      title: "Rejected direct file URL"
    })).rejects.toThrow("Only HTTPS YouTube, Bilibili, or b23.tv");
    await expect(tools.call("video_publish", {
      operationId: "video-schema-invalid-0002",
      originalUrl: "https://youtu.be/dQw4w9WgXcQ",
      title: "Unknown local path field",
      filePath: "C:\\private\\video.mp4"
    })).rejects.toThrow();
    await expect(tools.call("video_delete", {
      videoId: "video-1",
      operationId: "video-schema-invalid-0003",
      expectedUpdatedAt: NOW,
      confirm: false
    })).rejects.toThrow();
  });

  it("publishes, replays, manages, refreshes, and deletes with CAS plus OAuth audits", async () => {
    const scopes = ["content:write", "content:delete"];
    await activateGrant(scopes);
    let metadataFetchCount = 0;
    const tools = registeredTools(scopes, async (input) => {
      metadataFetchCount += 1;
      expect(String(input)).toContain("youtube.com/oembed");
      return Response.json({
        title: "Refreshed provider title",
        author_name: "Provider author",
        thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
      });
    });
    const publishPayload = {
      operationId: "video-publish-oauth-0001",
      originalUrl: "https://youtu.be/dQw4w9WgXcQ",
      title: "External video",
      description: "Published atomically from MCP.",
      categoryIds: ["tutorials"]
    };
    const published = structured(await tools.call("video_publish", publishPayload));
    expect(published).toMatchObject({
      ok: true,
      duplicate: false,
      platform: "youtube",
      externalId: "dQw4w9WgXcQ",
      status: "published"
    });
    const videoId = String(published.videoId || "");
    expect(videoId).not.toBe("");
    await expect(testEnv.DB.prepare(
      "select status from videos where video_id = ?"
    ).bind(videoId).first()).resolves.toMatchObject({ status: "published" });

    const replay = structured(await tools.call("video_publish", publishPayload));
    expect(replay).toMatchObject({ ok: true, duplicate: true, videoId, status: "published" });

    const listed = structured(await tools.call("video_manage_list", {
      status: "published",
      platform: "youtube",
      limit: 10
    }));
    expect(listed).toMatchObject({
      limit: 10,
      videos: [{ videoId, status: "published", categoryIds: ["tutorials"] }]
    });
    const managed = structured(await tools.call("video_manage_get", { videoId }));
    expect(managed).toMatchObject({ video: { videoId, title: "External video" } });

    const updated = structured(await tools.call("video_update", {
      videoId,
      operationId: "video-update-oauth-0001",
      expectedUpdatedAt: managed.video.updatedAt,
      title: "External video updated",
      status: "hidden"
    }));
    expect(updated).toMatchObject({ ok: true, duplicate: false, videoId });

    const refreshed = structured(await tools.call("video_refresh_metadata", {
      videoId,
      operationId: "video-refresh-oauth-0001",
      expectedUpdatedAt: updated.updatedAt
    }));
    expect(refreshed).toMatchObject({
      ok: true,
      duplicate: false,
      videoId,
      metadataUpdated: true,
      metadataError: ""
    });
    expect(metadataFetchCount).toBe(1);
    const afterRefresh = structured(await tools.call("video_manage_get", { videoId }));
    expect(afterRefresh.video).toMatchObject({
      title: "Refreshed provider title",
      authorName: "Provider author",
      status: "hidden"
    });

    const deleted = structured(await tools.call("video_delete", {
      videoId,
      operationId: "video-delete-oauth-0001",
      expectedUpdatedAt: refreshed.updatedAt,
      confirm: true
    }));
    expect(deleted).toMatchObject({
      ok: true,
      duplicate: false,
      deleted: true,
      videoId
    });
    const remaining = await testEnv.DB.prepare(
      "select count(*) as count from videos where video_id = ?"
    ).bind(videoId).first<{ count: number }>();
    expect(Number(remaining?.count || 0)).toBe(0);

    const oauthAudits = (await testEnv.DB.prepare(`
      select capability_id, tool_name, operation_id, requested_scopes, result, error_code
      from mcp_oauth_audit_log
      where tool_name like 'video_%'
    `).all()).results || [];
    expect(oauthAudits.filter((row) => row.tool_name === "video_publish" && row.result === "attempt"))
      .toHaveLength(2);
    expect(oauthAudits.filter((row) => row.tool_name === "video_publish" && row.result === "success"))
      .toHaveLength(2);
    expect(oauthAudits).toContainEqual(expect.objectContaining({
      capability_id: "content.videos.refresh",
      tool_name: "video_refresh_metadata",
      operation_id: "video-refresh-oauth-0001",
      requested_scopes: JSON.stringify(["content:write"]),
      result: "success",
      error_code: ""
    }));
    expect(oauthAudits).toContainEqual(expect.objectContaining({
      capability_id: "content.videos.delete",
      tool_name: "video_delete",
      operation_id: "video-delete-oauth-0001",
      requested_scopes: JSON.stringify(["content:delete"]),
      result: "success",
      error_code: ""
    }));

    const serviceAudit = await testEnv.DB.prepare(`
      select token_id from agent_audit_log
      where action = 'agent-video-created' and target_id = ?
      limit 1
    `).bind(videoId).first<{ token_id: string }>();
    expect(serviceAudit?.token_id).toBe(`oauth:${GRANT_REF}`);
  });

  it("returns an insufficient-scope challenge and records the denied tool error", async () => {
    await activateGrant(["content:write"]);
    const tools = registeredTools(["content:write"]);
    const denied = await tools.call("video_delete", {
      videoId: "video-scope-target",
      operationId: "video-delete-scope-0001",
      expectedUpdatedAt: NOW,
      confirm: true
    });
    expect(denied.isError).toBe(true);
    expect(structured(denied)).toMatchObject({ code: "MCP_OAUTH_SCOPE_REQUIRED" });
    expect(denied._meta?.["mcp/www_authenticate"]?.[0]).toContain(
      'scope="content:delete"'
    );
    const audit = await testEnv.DB.prepare(`
      select tool_name, result, error_code from mcp_oauth_audit_log
      where tool_name = 'video_delete'
      limit 1
    `).first();
    expect(audit).toMatchObject({
      tool_name: "video_delete",
      result: "error",
      error_code: "MCP_OAUTH_SCOPE_REQUIRED"
    });

    const missing = await tools.call("video_manage_get", { videoId: "missing-video" });
    expect(missing.isError).toBe(true);
    expect(structured(missing)).toMatchObject({ code: "VIDEO_NOT_FOUND" });
    const serviceFailureAudits = (await testEnv.DB.prepare(`
      select result, error_code from mcp_oauth_audit_log
      where tool_name = 'video_manage_get'
    `).all()).results || [];
    expect(serviceFailureAudits).toEqual(expect.arrayContaining([
      expect.objectContaining({ result: "attempt", error_code: "" }),
      expect.objectContaining({ result: "error", error_code: "VIDEO_NOT_FOUND" })
    ]));
  });

  it("revokes an active grant when the owner loses the admin role", async () => {
    await activateGrant(["content:write"]);
    await testEnv.DB.prepare("update users set role = 'user' where id = ?")
      .bind(USER_ID)
      .run();
    const denied = await registeredTools(["content:write"]).call("video_manage_list", {
      limit: 10
    });
    expect(denied.isError).toBe(true);
    expect(structured(denied)).toMatchObject({ code: "MCP_OAUTH_ADMIN_REQUIRED" });
    expect(denied._meta?.["mcp/www_authenticate"]?.[0]).toContain('error="invalid_token"');
    const grant = await testEnv.DB.prepare(`
      select status, revoked_reason from mcp_oauth_grants where grant_ref = ?
    `).bind(GRANT_REF).first();
    expect(grant).toMatchObject({ status: "revoked", revoked_reason: "admin-role-lost" });
  });
});
