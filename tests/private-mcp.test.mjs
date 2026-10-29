import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PassThrough } from "node:stream";
import { build } from "esbuild";
import { serveStdio, StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createPendingMcpOAuthGrant, activateMcpOAuthGrant } from "../functions/api/mcp-oauth-ledger.mjs";

class DB {
  constructor() { this.sqlite = new DatabaseSync(":memory:"); }
  prepare(sql) {
    const database = this.sqlite;
    return { bind(...values) { return { async first() { return database.prepare(sql).get(...values) || null; },
      async all() { return { results: database.prepare(sql).all(...values) }; },
      async run() { const r = database.prepare(sql).run(...values); return { success: true, meta: { changes: Number(r.changes) } }; }
    }; }, async run() { database.exec(sql); return { success: true }; }, async all() { return { results: database.prepare(sql).all() }; } };
  }
  async batch(statements) { this.sqlite.exec("begin"); try { const results = []; for (const s of statements) results.push(await s.run()); this.sqlite.exec("commit"); return results; } catch (e) { this.sqlite.exec("rollback"); throw e; } }
}

test("private owner MCP protocol, identity denial and article lifecycle", async (t) => {
  // Bundle TypeScript for Node; the Cloudflare HTTP host is not exercised here.
  const dir = resolve(".wrangler-config/private-mcp-tests");
  await mkdir(dir, { recursive: true });
  const out = resolve(dir, `server-${process.pid}.mjs`);
  await build({ entryPoints: ["workers/site-admin-mcp/src/article-tools.ts"], outfile: out,
    bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "cloudflare-host-only", setup(b) {
      b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "workers", namespace: "test-workers" }));
      b.onLoad({ filter: /.*/, namespace: "test-workers" }, () => ({ contents: "export class DurableObject {}" }));
      b.onResolve({ filter: /^agents\/mcp\/server$/ }, () => ({ path: "host", namespace: "test-host" }));
      b.onLoad({ filter: /.*/, namespace: "test-host" }, () => ({ contents: "export function createMcpHandler(){throw new Error('HTTP host not part of Node protocol test')}" }));
    } }] });
  t.after(async () => { await rm(out, { force: true }); });
  const { createOwnerMcpServer } = await import(pathToFileURL(out));
  const db = new DB();
  t.after(() => db.sqlite.close());
  db.sqlite.exec(await readFile("cloudflare/schema.sql", "utf8"));
  const now = new Date().toISOString();
  db.sqlite.prepare("insert into users(id,email,password_hash,role,created_at,updated_at) values(?,?,'unused','admin',?,?)").run("private-owner", "owner@example.test", now, now);
  db.sqlite.prepare("insert into users(id,email,password_hash,role,created_at,updated_at) values(?,?,'unused','admin',?,?)").run("other-admin", "other@example.test", now, now);
  const env = { CHAT_IP_HASH_SALT: "private-test-chat-only-hmac-key-at-least-32-bytes", DB: db, MCP_OWNER_USER_ID: "private-owner", ANALYTICS_IP_HASH_SALT: "private-tests-only-hmac-salt-at-least-32-bytes" };
  const grantRef = "private_test_grant_0001";
  const scopes = ["content:read", "content:write", "content:delete", "admin:read", "admin:write"];
  await createPendingMcpOAuthGrant({ env, grantRef, userId: "private-owner", clientId: "private-test-client", clientName: "Private test", resource: "https://lusu575.com/mcp", authorizedScopes: scopes });
  await activateMcpOAuthGrant({ env, grantRef });
  const context = { authInfo: { clientId: "private-test-client", scopes, resource: new URL("https://lusu575.com/mcp"), extra: { props: { version: 1, userId: "private-owner", grantRef, resource: "https://lusu575.com/mcp" } } } };
  await assert.rejects(createOwnerMcpServer(env, {}));
  await assert.rejects(createOwnerMcpServer({ ...env, MCP_OWNER_USER_ID: undefined }, context), /not configured/);
  await assert.rejects(createOwnerMcpServer(env, { authInfo: { ...context.authInfo, extra: { props: { ...context.authInfo.extra.props, userId: "other-admin" } } } }), /cannot use/);
  const server = await createOwnerMcpServer(env, context);
  const input = new PassThrough(), output = new PassThrough();
  const pending = new Map(); let buffer = "", nextId = 0;
  output.setEncoding("utf8"); output.on("data", chunk => { buffer += chunk; while (buffer.includes("\n")) { const end = buffer.indexOf("\n"); const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1); pending.get(message.id)?.(message); } });
  const handle = serveStdio(() => server, { transport: new StdioServerTransport(input, output) });
  t.after(async () => { await handle.close(); input.destroy(); output.destroy(); });
  const rpc = (method, params = {}) => new Promise((resolveResult, reject) => { const id = ++nextId; const timer = setTimeout(() => reject(new Error(`RPC timeout: ${method}`)), 5000); pending.set(id, result => { clearTimeout(timer); pending.delete(id); resolveResult(result); }); input.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });
  const initialized = await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "private-test", version: "1" } });
  assert.equal(initialized.result.serverInfo.name, "lusu-site-mcp");
  input.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const listed = await rpc("tools/list");
  assert.ok(listed.result.tools.some(x => x.name === "account_get"));
  assert.equal(listed.result.tools.length, 79);
  assert.equal(new Set(listed.result.tools.map(tool => tool.name)).size, 79);
  for (const tool of listed.result.tools) {
    assert.equal(tool.inputSchema.type, "object", tool.name);
  }
  const call = (name, args) => rpc("tools/call", { name, arguments: args });
  for (const [name, args] of [
    ["traffic_update", {confirm:true,body:{expectedUpdatedAt:"test",arbitrary:true}}],
    ["whiteboard_public_lock", {confirm:true,body:{locked:"yes"}}],
    ["video_category_create", {confirm:true,body:{slug:"incomplete"}}],
    ["transfer_settings_update", {confirm:true,body:{expectedUpdatedAt:"test",retention_hours:999}}],
    ["chat_manage_list", {query:{includeHidden:true}}]
  ]) {
    const invalidContract = await call(name,args);
    assert.ok(invalidContract.error || invalidContract.result?.isError, name);
  }
  const translations = Object.fromEntries(["zh", "en", "ja"].map(lang => [lang, { title: "Test", summary: "", contentMarkdown: "# Test" }]));
  const created = await call("article_publish", { operationId: "private-draft-0001", slug: "private-protocol-test", status: "draft", translations });
  assert.notEqual(created.result?.isError, true, JSON.stringify(created));
  const article = created.result.structuredContent;
  assert.equal(article.status, "draft");
  const invalid = await call("article_update", { articleId: article.articleId, operationId: "private-invalid-01", expectedUpdatedAt: article.updatedAt, status: "invalid" });
  assert.ok(invalid.error || invalid.result?.isError);
  const published = await call("article_update", { articleId: article.articleId, operationId: "private-publish-01", expectedUpdatedAt: article.updatedAt, status: "published" });
  assert.notEqual(published.result?.isError, true, JSON.stringify(published));
  const archived = await call("article_update", { articleId: article.articleId, operationId: "private-archive-01", expectedUpdatedAt: published.result.structuredContent.updatedAt, status: "archived" });
  assert.notEqual(archived.result?.isError, true, JSON.stringify(archived));
  const accounts = await call("accounts_list", {});
  assert.notEqual(accounts.result?.isError, true, JSON.stringify(accounts));
  assert.ok(!JSON.stringify(accounts).includes("password_hash"));
  db.sqlite.prepare("insert into sessions(token_hash,user_id,created_at,expires_at) values(?,?,?,?)")
    .run("test-session-hash", "other-admin", now, "2099-01-01T00:00:00Z");
  const revoked = await call("account_sessions_revoke", { id: "other-admin", confirm: true, body: { confirm: true } });
  assert.equal(revoked.result.structuredContent.revokedBrowserSessions, 1);
  assert.equal(revoked.result.structuredContent.oauthGrantsRevoked, false);
  const replay = await call("account_sessions_revoke", { id: "other-admin", confirm: true, body: { confirm: true } });
  assert.equal(replay.result.structuredContent.revokedBrowserSessions, 0);
  const missing = await call("account_sessions_revoke", { id: "missing-user", confirm: true, body: { confirm: true } });
  assert.equal(missing.result.isError, true);
  const sent = await call("chat_send", { confirm: true, body: { content: "isolated MCP chat test", clientRequestId: "private-chat-test-0001" } });
  assert.notEqual(sent.result?.isError, true, JSON.stringify(sent));
  const repeated = await call("chat_send", { confirm: true, body: { content: "isolated MCP chat test", clientRequestId: "private-chat-test-0001" } });
  assert.equal(repeated.result.structuredContent.idempotentReplay, true);
  const messages = await call("chat_read", {});
  assert.ok(messages.result.structuredContent.messages.some(m => m.content === "isolated MCP chat test"));
  const queued = await call("kittens_command", { browserId: "test-browser-00001", action: "observe" });
  const jobId = queued.result.structuredContent.jobId;
  assert.equal(queued.result.structuredContent.state, "queued");
  const claim = await call("browser_command_claim", { browserId: "test-browser-00001" });
  assert.equal(claim.result.structuredContent.job.jobId, jobId);
  const secondClaim = await call("browser_command_claim", { browserId: "test-browser-00001" });
  assert.equal(secondClaim.result.structuredContent.job, null);
  const completed = await call("browser_command_complete", { browserId: "test-browser-00001", jobId, result: { source: "protocol-test-fixture" } });
  assert.equal(completed.result.structuredContent.accepted, true);
  const retrieved = await call("browser_command_result", { jobId });
  assert.equal(retrieved.result.structuredContent.state, "done");
  if (process.env.LUSU_TEST_REAL_BROWSER === "1") {
    const { openIsolatedKittens } = await import("./helpers/kittens-browser.mjs");
    const { runKittensCompanionOnce } = await import("../lib/capabilities/kittens-companion.mjs");
    const { evaluate } = await openIsolatedKittens(t);
    const callTool = async (name, args) => {
      const response = await call(name, args);
      if (response.error || response.result?.isError) throw new Error(JSON.stringify(response));
      return response.result.structuredContent;
    };
    const submit = async action => {
      const queued = await callTool("kittens_command", { browserId: "real-browser-test-001", ...action });
      await runKittensCompanionOnce({ browserId: "real-browser-test-001", callTool, evaluate });
      const finished = await callTool("browser_command_result", { jobId: queued.jobId });
      assert.equal(finished.state, "done");
      assert.equal(finished.result.source, "live-browser");
      return finished.result;
    };
    const before = await submit({ action: "observe" });
    const after = await submit({ action: "gather", count: 10 });
    const catnip = state => state.resources.find(r => r.id === "catnip")?.value || 0;
    assert.ok(catnip(after) > catnip(before));
    for (let i=0;i<3;i++) await submit({ action: "gather", count: 10 });
    await new Promise(r => setTimeout(r, 1200));
    const built = await submit({ action: "build", id: "field" });
    assert.ok(built.buildings.find(b => b.id === "field")?.count >= 1);
  }
  if (process.env.LUSU_TEST_REAL_BROWSER === "1") {
    const { openIsolatedWhiteboard } = await import("./helpers/whiteboard-browser.mjs");
    const { runKittensCompanionOnce } = await import("../lib/capabilities/kittens-companion.mjs");
    const { default: sharp } = await import("sharp");
    const { evaluate } = await openIsolatedWhiteboard(t);
    const browserId = "real-whiteboard-test-001";
    const callTool = async (name,args) => {
      const response = await call(name,args);
      assert.notEqual(response.result?.isError,true,JSON.stringify(response));
      assert.ok(response.result,JSON.stringify(response));
      return response.result.structuredContent;
    };
    const queued = await callTool("whiteboard_snapshot",{browserId});
    await runKittensCompanionOnce({browserId,callTool,evaluate});
    const finished = await call("browser_command_result",{jobId:queued.jobId});
    assert.equal(finished.result.structuredContent.state,"done");
    const image = finished.result.content.find(c => c.type === "image");
    assert.ok(image,"MCP must return an actual image block");
    const {data,info} = await sharp(Buffer.from(image.data,"base64")).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.ok(info.width>1400);
    let red=0;for(let i=0;i<data.length;i+=4) if(data[i]>230&&data[i+1]<30&&data[i+2]<30) red++;
    assert.ok(red>10000,"Offscreen raster must survive the entire MCP queue/result chain");
  }
  const refused = await call("account_update", { id: "other-admin", body: { role: "user" } });
  assert.ok(refused.error || refused.result?.isError);
});
