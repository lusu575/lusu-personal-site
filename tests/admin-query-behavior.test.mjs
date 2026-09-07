import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { adminDateRange, readAdminAnalyticsOverview } from "../functions/api/admin-query-service.mjs";
import { readAdminWorkbench } from "../functions/api/admin-workbench-service.mjs";

const VERSION = "2026-01-01T00:00:00.000Z";
const SESSION = "admin-query-test-session";
class Statement {
  constructor(db, sql, values = []) { Object.assign(this, { db, sql, values }); }
  bind(...values) { return new Statement(this.db, this.sql, values); }
  async first() { return this.db.sqlite.prepare(this.sql).get(...this.values) || null; }
  async all() {
    if (this.db.failDetailReads && /from user_login_events\s+where user_id/.test(this.sql)) throw new Error("simulated detail read failure");
    return { results: this.db.sqlite.prepare(this.sql).all(...this.values) };
  }
  async run() { const result = this.db.sqlite.prepare(this.sql).run(...this.values); return { meta: { changes: Number(result.changes) }, success: true }; }
}
class D1 {
  constructor() { this.sqlite = new DatabaseSync(":memory:"); this.sqlite.exec("pragma foreign_keys = on"); this.beforeBatch = null; }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) {
    if (this.beforeBatch) { const callback = this.beforeBatch; this.beforeBatch = null; callback(); }
    this.sqlite.exec("begin immediate");
    try { const result = []; for (const statement of statements) result.push(await statement.run()); this.sqlite.exec("commit"); return result; }
    catch (error) { this.sqlite.exec("rollback"); throw error; }
  }
}
async function digest(value) { return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).toString("hex"); }
async function request(onRequest, db, path, { method = "GET", body, authenticated = true } = {}) {
  const headers = new Headers({ Origin: "https://example.test" });
  if (authenticated) headers.set("Cookie", `lusu_session=${SESSION}`);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const response = await onRequest({ request: new Request(`https://example.test/api/${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env: { DB: db, CHAT_IP_HASH_SALT: "admin-query-chat-secret-00000000001", ANALYTICS_IP_HASH_SALT: "admin-query-analytics-secret-000001" } });
  return { status: response.status, body: await response.json() };
}

// One real SQLite environment keeps the route's existing isolate-scoped schema guards valid.
test("admin query and mutation behavior against SQLite", async (t) => {
  const { onRequest } = await import(`../functions/api/[[route]].js?query-behavior=${Date.now()}`);
  const db = new D1();
  try {
    assert.equal((await request(onRequest, db, "health")).status, 200);
    db.sqlite.prepare("insert into users (id,email,password_hash,role,created_at,updated_at) values ('operator','operator@example.test','','admin',?,?)").run(VERSION, VERSION);
    db.sqlite.prepare("insert into sessions (token_hash,user_id,created_at,expires_at) values (?,'operator',?,'2099-01-01T00:00:00.000Z')").run(await digest(SESSION), VERSION);
    for (const path of ["admin/articles", "admin/videos", "admin/chat/messages", "admin/accounts"]) {
      const result = await request(onRequest, db, path); assert.equal(result.status, 200, JSON.stringify(result));
    }
    db.sqlite.prepare("insert into users (id,email,password_hash,role,created_at,updated_at) values ('target','target@example.test','original-hash','user',?,?)").run(VERSION, VERSION);

    await t.test("account CAS rejects missing and stale versions before changing password or revoking sessions", async () => {
      db.sqlite.prepare("insert into sessions (token_hash,user_id,created_at,expires_at) values ('target-session','target',?,'2099-01-01T00:00:00.000Z')").run(VERSION);
      const missing = await request(onRequest, db, "admin/accounts/target", { method: "PUT", body: { role: "user" } });
      assert.equal(missing.status, 428); assert.equal(missing.body.code, "CONTENT_VERSION_REQUIRED");
      const save = await request(onRequest, db, "admin/accounts/target", { method: "PUT", body: { email: "edited@example.test", expectedUpdatedAt: VERSION } });
      assert.equal(save.status, 200, JSON.stringify(save));
      assert.notEqual(save.body.account.updated_at, VERSION);
      const conflict = await request(onRequest, db, "admin/accounts/target", { method: "PUT", body: { email: "stale@example.test", password: "ValidPassword123!", expectedUpdatedAt: VERSION } });
      assert.equal(conflict.status, 409); assert.equal(conflict.body.code, "CONTENT_CONFLICT");
      assert.equal(db.sqlite.prepare("select password_hash from users where id = 'target'").get().password_hash, "original-hash");
      assert.equal(db.sqlite.prepare("select count(*) as n from sessions where user_id = 'target'").get().n, 1);
      const passwordSave = await request(onRequest, db, "admin/accounts/target", { method: "PUT", body: { password: "ValidPassword123!", revokeSessions: false, expectedUpdatedAt: save.body.account.updated_at } });
      assert.equal(passwordSave.status, 200, JSON.stringify(passwordSave));
      assert.equal(db.sqlite.prepare("select count(*) as n from sessions where user_id = 'target'").get().n, 1);
      const revoke = await request(onRequest, db, "admin/accounts/target", { method: "PUT", body: { password: "AnotherPassword123!", expectedUpdatedAt: passwordSave.body.account.updated_at } });
      assert.equal(revoke.status, 200, JSON.stringify(revoke));
      assert.equal(db.sqlite.prepare("select count(*) as n from sessions where user_id = 'target'").get().n, 0);
    });

    await t.test("account commit remains successful when optional detail reads fail", async () => {
      const old = db.sqlite.prepare("select updated_at from users where id = 'target'").get().updated_at;
      db.failDetailReads = true;
      const result = await request(onRequest, db, "admin/accounts/target", { method: "PUT", body: { password: "ReadbackFailurePassword123!", expectedUpdatedAt: old } });
      db.failDetailReads = false;
      assert.equal(result.status, 200, JSON.stringify(result));
      assert.equal(result.body.readbackWarning.code, "ACCOUNT_DETAIL_REFRESH_FAILED");
      assert.equal(result.body.passwordChanged, true);
      assert.equal(result.body.sessionsRevoked, true);
      assert.ok(Date.parse(result.body.account.updated_at) > Date.parse(old));
      assert.equal(result.body.account.updated_at, db.sqlite.prepare("select updated_at from users where id = 'target'").get().updated_at);
      assert.equal(Object.hasOwn(result.body, "loginHistory"), false);
      assert.equal(Object.hasOwn(result.body, "sessions"), false);
      assert.equal(Object.hasOwn(result.body.account, "password_hash"), false);
    });

    await t.test("account CAS remains atomic when a competing save wins before the write batch", async () => {
      const old = db.sqlite.prepare("select updated_at from users where id = 'target'").get().updated_at;
      const competing = new Date(Date.parse(old) + 10000).toISOString();
      db.sqlite.prepare("insert into sessions (token_hash,user_id,created_at,expires_at) values ('target-race-session','target',?,'2099-01-01T00:00:00.000Z')").run(VERSION);
      db.beforeBatch = () => db.sqlite.prepare("update users set email = 'winner@example.test', updated_at = ? where id = 'target'").run(competing);
      const result = await request(onRequest, db, "admin/accounts/target", { method: "PUT", body: { password: "CompetingPassword123!", email: "loser@example.test", expectedUpdatedAt: old } });
      assert.equal(result.status, 409, JSON.stringify(result)); assert.equal(result.body.updatedAt, competing);
      assert.equal(db.sqlite.prepare("select email from users where id = 'target'").get().email, "winner@example.test");
      assert.equal(db.sqlite.prepare("select count(*) as n from sessions where user_id = 'target'").get().n, 1);
    });

    await t.test("last-admin guard remains in the same atomic condition as revision check", async () => {
      db.sqlite.prepare("update users set role = 'admin' where id = 'target'").run();
      const old = db.sqlite.prepare("select updated_at from users where id = 'target'").get().updated_at;
      db.beforeBatch = () => db.sqlite.prepare("update users set role = 'user' where id = 'operator'").run();
      const result = await request(onRequest, db, "admin/accounts/target", { method: "PUT", body: { role: "user", expectedUpdatedAt: old } });
      assert.equal(result.status, 409, JSON.stringify(result)); assert.match(result.body.error, /最后一个管理员/);
      assert.equal(db.sqlite.prepare("select role from users where id = 'target'").get().role, "admin");
      db.sqlite.prepare("update users set role = 'admin' where id = 'operator'").run();
    });

    await t.test("chat CAS preserves encrypted content and rejects stale writes and deletes", async () => {
      const insert = db.sqlite.prepare("insert into anonymous_chat_messages (message_id,visitor_id,nickname,content,created_at,ip_hash,encrypted) values (?, 'visitor', '匿名访客', ?, ?, 'hash', ?)");
      insert.run("message-one", "first", VERSION, 0); insert.run("message-secret", "private-ciphertext", VERSION, 1);
      db.sqlite.prepare("update anonymous_chat_messages set room_key = 'private-test-room' where message_id = 'message-secret'").run();
      const privateRoom = await request(onRequest, db, "admin/chat/messages?room=private&includeHidden=1");
      const publicRoom = await request(onRequest, db, "admin/chat/messages?room=public&includeHidden=1");
      assert.deepEqual(privateRoom.body.messages.map((row) => row.message_id), ["message-secret"]);
      assert.deepEqual(publicRoom.body.messages.map((row) => row.message_id), ["message-one"]);
      const list = await request(onRequest, db, "admin/chat/messages?includeHidden=1");
      assert.equal(list.body.messages.find((row) => row.message_id === "message-one").updated_at, VERSION);
      assert.equal(list.body.messages.find((row) => row.message_id === "message-secret").content, "");
      const missing = await request(onRequest, db, "admin/chat/messages/message-one", { method: "PUT", body: { content: "next" } });
      assert.equal(missing.status, 428);
      const save = await request(onRequest, db, "admin/chat/messages/message-one", { method: "PUT", body: { content: "next", expectedUpdatedAt: VERSION } });
      assert.equal(save.status, 200); assert.ok(save.body.updatedAt);
      for (const method of ["PUT", "DELETE"]) {
        const conflict = await request(onRequest, db, "admin/chat/messages/message-one", { method, body: { content: "stale", expectedUpdatedAt: VERSION } });
        assert.equal(conflict.status, 409); assert.equal(conflict.body.code, "CONTENT_CONFLICT");
      }
      const invalid = await request(onRequest, db, "admin/chat/messages/message-secret", { method: "PUT", body: { content: "cannot edit", expectedUpdatedAt: VERSION } });
      assert.equal(invalid.status, 400);
      const hidden = await request(onRequest, db, "admin/chat/messages/message-secret", { method: "PUT", body: { hidden: true, expectedUpdatedAt: VERSION } });
      assert.equal(hidden.status, 200);
      assert.equal(db.sqlite.prepare("select content from anonymous_chat_messages where message_id = 'message-secret'").get().content, "private-ciphertext");
    });

    await t.test("server searches the complete account, chat, ban, article and video collections", async () => {
      for (let i = 0; i < 7; i++) {
        db.sqlite.prepare("insert into users (id,email,password_hash,role,created_at,updated_at) values (?,?,'','user',?,?)").run(`paged-user-${i}`, `search-${i}@example.test`, VERSION, VERSION);
        db.sqlite.prepare("insert into anonymous_chat_messages (message_id,visitor_id,nickname,content,created_at,ip_hash) values (?,'visitor','检索昵称',?,?, 'hash')").run(`paged-chat-${i}`, `message needle ${i}`, VERSION);
        db.sqlite.prepare("insert into chat_bans (ban_id,ban_type,reason,active,created_by,created_at) values (?,'visitor',?,1,'operator',?)").run(`paged-ban-${i}`, `moderation needle ${i}`, VERSION);
        db.sqlite.prepare("insert into articles (article_id,slug,category,status,created_at,updated_at) values (?,?,'note','draft',?,?)").run(`paged-article-${i}`, `needle-article-${i}`, VERSION, VERSION);
        db.sqlite.prepare("insert into videos (video_id,platform,original_url,external_id,embed_url,title,created_at,updated_at) values (?,'youtube','https://youtube.com/watch?v=abcdefghijk','abcdefghijk','https://www.youtube.com/embed/abcdefghijk',?,?,?)").run(`paged-video-${i}`, `video needle ${i}`, VERSION, VERSION);
      }
      for (const [path, array, q] of [["accounts", "accounts", "search-"], ["chat/messages", "messages", "needle"], ["chat/bans", "bans", "needle"], ["articles", "articles", "needle"], ["videos", "videos", "needle"]]) {
        const first = await request(onRequest, db, `admin/${path}?q=${q}&limit=3&offset=0`);
        const next = await request(onRequest, db, `admin/${path}?q=${q}&limit=3&offset=3`);
        const last = await request(onRequest, db, `admin/${path}?q=${q}&pageSize=3&page=3`);
        for (const result of [first, next, last]) { assert.equal(result.status, 200, JSON.stringify(result)); assert.equal(result.body.total, 7, path); }
        assert.equal(first.body[array].length, 3); assert.equal(next.body[array].length, 3); assert.equal(last.body[array].length, 1);
        assert.equal(first.body.pagination.hasMore, true); assert.equal(last.body.pagination.hasMore, false);
        assert.equal(new Set([...first.body[array], ...next.body[array], ...last.body[array]].map((row) => row.id || row.message_id || row.ban_id || row.article_id || row.video_id)).size, 7);
      }
      const escaped = await request(onRequest, db, "admin/videos?q=%25&limit=3");
      assert.equal(escaped.body.total, 0, "SQL wildcard characters are literal search terms");
    });

    await t.test("filtered ban status follows server effectiveness and video defaults use the entire library", async () => {
      db.sqlite.prepare("update chat_bans set expires_at = '2000-01-01T00:00:00.000Z' where ban_id = 'paged-ban-0'").run();
      db.sqlite.prepare("update chat_bans set active = 0 where ban_id = 'paged-ban-1'").run();
      db.sqlite.prepare("update chat_bans set ban_type = 'ip_hash', ip_hash_key_id = 'legacy' where ban_id = 'paged-ban-2'").run();
      for (const [status, expected] of [["effective", 4], ["expired", 1], ["inactive", 1], ["stale", 1]]) {
        const result = await request(onRequest, db, `admin/chat/bans?q=needle&status=${status}`);
        assert.equal(result.status, 200, JSON.stringify(result)); assert.equal(result.body.total, expected);
        if (status === "effective") assert.ok(result.body.bans.every((ban) => ban.effective === 1));
      }
      db.sqlite.prepare("update videos set sort_order = 9999, pinned = 1, pinned_sort_order = 19999 where video_id = 'paged-video-0'").run();
      const result = await request(onRequest, db, "admin/videos?q=video%20needle%206&limit=1");
      assert.equal(result.body.total, 1);
      assert.deepEqual(result.body.sortDefaults, { sortOrder: 10009, pinnedSortOrder: 20009 });
      db.sqlite.prepare("update videos set status = 'hidden' where video_id = 'paged-video-6'").run();
      const hiddenVideos = await request(onRequest, db, "admin/videos?status=hidden&limit=50");
      assert.equal(hiddenVideos.body.total, 1);
      assert.equal(hiddenVideos.body.videos[0].video_id, "paged-video-6");
      const huge = await request(onRequest, db, "admin/videos?page=1e300&limit=50");
      assert.equal(huge.status, 200, JSON.stringify(huge));
      assert.equal(huge.body.videos.length, 0);
    });

    await t.test("article category/tag and chat location search use complete server-side fields", async () => {
      db.sqlite.prepare("update articles set category = 'review-category', tags = '[\"tag%literal\"]' where article_id = 'paged-article-0'").run();
      for (const q of ["review-category", "tag%literal"]) {
        const result = await request(onRequest, db, `admin/articles?q=${encodeURIComponent(q)}&limit=1`);
        assert.equal(result.status, 200, JSON.stringify(result));
        assert.equal(result.body.total, 1);
        assert.equal(result.body.articles[0].article_id, "paged-article-0");
      }
      db.sqlite.prepare("insert into site_visitors (visitor_id,first_seen_at,last_seen_at,country,region,city) values ('geo-visitor',?,?,'GeoCountry','GeoRegion','深圳测试')").run(VERSION, VERSION);
      db.sqlite.prepare("insert into anonymous_chat_messages (message_id,visitor_id,nickname,content,created_at,ip_hash) values ('geo-message','geo-visitor','访客名字','普通消息',?,'hash')").run(VERSION);
      for (const q of ["GeoCountry", "GeoRegion", "深圳测试"]) {
        const result = await request(onRequest, db, `admin/chat/messages?q=${encodeURIComponent(q)}&limit=1`);
        assert.equal(result.status, 200, JSON.stringify(result));
        assert.equal(result.body.total, 1);
        assert.equal(result.body.messages[0].message_id, "geo-message");
      }
      const encrypted = await request(onRequest, db, "admin/chat/messages?q=private-ciphertext&includeHidden=1");
      assert.equal(encrypted.body.total, 0, "encrypted content is never a searchable admin field");
    });

    await t.test("Shanghai windows, true per-metric series and full counts are not truncated to ranking length", async () => {
      for (const table of ["analytics_page_views", "analytics_click_events", "article_view_events", "anonymous_chat_messages"]) db.sqlite.exec(`delete from ${table}`);
      const now = new Date("2026-09-08T01:30:00.000Z");
      const insert = db.sqlite.prepare("insert into analytics_page_views (event_id,visitor_id,path,route,country,region,city,latitude,longitude,created_at) values (?,?,?,'knowledge','CN','广东',?,22,114,?)");
      insert.run("outside", "outside", "/outside", "深圳", "2026-09-06T15:59:59.999Z");
      insert.run("prior-day", "same-visitor", "/prior", "深圳", "2026-09-07T15:59:59.999Z");
      for (let i = 0; i < 45; i++) insert.run(`pv-${i}`, "same-visitor", `/page-${i}`, `city-${i}`, "2026-09-07T16:00:00.000Z");
      insert.run("future", "future", "/future", "未来", "2026-09-08T02:00:00.000Z");
      db.sqlite.prepare("insert into analytics_click_events (event_id,visitor_id,path,created_at) values ('click-1','same-visitor','/','2026-09-07T17:00:00.000Z')").run();
      db.sqlite.prepare("insert into anonymous_chat_messages (message_id,visitor_id,nickname,content,created_at,ip_hash) values ('today-chat','visitor','名字','正文','2026-09-08T00:00:00.000Z','hash')").run();
      const overview = await readAdminAnalyticsOverview(db, 2, now);
      assert.equal(overview.range.todayStart, "2026-09-07T16:00:00.000Z");
      assert.equal(overview.range.start, "2026-09-06T16:00:00.000Z");
      assert.equal(overview.timeZone, "Asia/Shanghai");
      assert.equal(overview.cards.todayPv, 45); assert.equal(overview.cards.totalPv, 46);
      assert.equal(overview.cards.totalUv, 1, "period UV is distinct across dates");
      assert.equal(overview.coverage.pageCount, 46); assert.equal(overview.topPages.length, 30);
      assert.equal(overview.coverage.cityCount, 46);
      assert.deepEqual(overview.daily.map(({ pv, uv, clicks, messages }) => ({ pv, uv, clicks, messages })), [{ pv: 1, uv: 1, clicks: 0, messages: 0 }, { pv: 45, uv: 1, clicks: 1, messages: 1 }]);
      assert.equal(overview.hourly[0].pv, 45); assert.equal(overview.hourly[1].clicks, 1); assert.equal(overview.hourly[8].messages, 1);
      assert.equal(overview.trends.onlineVisitors, null);
      assert.equal(overview.recentViews.some((row) => row.path === "/outside" || row.path === "/future"), false);
      for (const days of [1, 7, 14, 30]) assert.equal(adminDateRange(days, now).days, days);
    });

    await t.test("new content POST returns the committed revision without relying on detail or filtered-list readback", async () => {
      const translations = Object.fromEntries(["zh", "en", "ja"].map((lang) => [lang, { title: `New ${lang}`, content_markdown: `New body ${lang}` }]));
      const article = await request(onRequest, db, "admin/articles", { method: "POST", body: { slug: "new-cas-article", category: "note", status: "draft", published_at: null, translations } });
      assert.equal(article.status, 201, JSON.stringify(article));
      assert.equal(article.body.updatedAt, db.sqlite.prepare("select updated_at from articles where article_id = ?").get(article.body.articleId).updated_at);
      const articleUpdate = await request(onRequest, db, `admin/articles/${article.body.articleId}`, { method: "PUT", body: { expectedUpdatedAt: article.body.updatedAt, status: "draft", translations } });
      assert.equal(articleUpdate.status, 200, JSON.stringify(articleUpdate));
      const originalFetch = globalThis.fetch;
      let video;
      try {
        globalThis.fetch = async () => new Response(JSON.stringify({ title: "Fixture video", thumbnail_url: "https://i.ytimg.com/vi/abcDEF12345/hqdefault.jpg", author_name: "Test author" }), { headers: { "Content-Type": "application/json" } });
        video = await request(onRequest, db, "admin/videos", { method: "POST", body: { original_url: "https://www.youtube.com/watch?v=abcDEF12345", title: "New CAS video", status: "draft", category_ids: [] } });
      } finally { globalThis.fetch = originalFetch; }
      assert.equal(video.status, 201, JSON.stringify(video));
      assert.equal(video.body.updatedAt, db.sqlite.prepare("select updated_at from videos where video_id = ?").get(video.body.videoId).updated_at);
      const filtered = await request(onRequest, db, "admin/videos?status=published&limit=50");
      assert.equal(filtered.body.videos.some((row) => row.video_id === video.body.videoId), false);
      const videoUpdate = await request(onRequest, db, `admin/videos/${video.body.videoId}`, { method: "PUT", body: { expectedUpdatedAt: video.body.updatedAt, title: "Follow-up edit", status: "draft", category_ids: [] } });
      assert.equal(videoUpdate.status, 200, JSON.stringify(videoUpdate));
    });

    await t.test("same-source video metadata acknowledgement clears an old error only behind current CAS", async () => {
      db.sqlite.prepare("update videos set metadata_error = 'Prior HTTP 412', external_id = 'ackDEF12345', original_url = 'https://www.youtube.com/watch?v=ackDEF12345', embed_url = 'https://www.youtube.com/embed/ackDEF12345' where video_id = 'paged-video-1'").run();
      const current = db.sqlite.prepare("select updated_at from videos where video_id = 'paged-video-1'").get().updated_at;
      const normalSave = await request(onRequest, db, "admin/videos/paged-video-1", { method: "PUT", body: { expectedUpdatedAt: current, title: "Manual video edit", status: "draft", category_ids: [] } });
      assert.equal(normalSave.status, 200, JSON.stringify(normalSave));
      assert.equal(db.sqlite.prepare("select metadata_error from videos where video_id = 'paged-video-1'").get().metadata_error, "Prior HTTP 412");
      const stale = await request(onRequest, db, "admin/videos/paged-video-1", { method: "PUT", body: { expectedUpdatedAt: current, metadata_error: "", status: "draft", category_ids: [] } });
      assert.equal(stale.status, 409);
      assert.equal(db.sqlite.prepare("select metadata_error from videos where video_id = 'paged-video-1'").get().metadata_error, "Prior HTTP 412");
      const recovered = await request(onRequest, db, "admin/videos/paged-video-1", { method: "PUT", body: { expectedUpdatedAt: normalSave.body.updatedAt, metadata_error: "", status: "draft", category_ids: [] } });
      assert.equal(recovered.status, 200, JSON.stringify(recovered));
      assert.equal(db.sqlite.prepare("select metadata_error from videos where video_id = 'paged-video-1'").get().metadata_error, "");
    });

    await t.test("article metrics enforce retention rather than calling retained counts lifetime totals", async () => {
      const old = new Date(Date.now() - 181 * 86400000).toISOString();
      const recent = new Date(Date.now() - 3600000).toISOString();
      const insert = db.sqlite.prepare("insert into article_view_events (event_id,article_id,slug,visitor_id,created_at) values (?,'paged-article-0','needle-article-0','reader',?)");
      insert.run("article-old", old); insert.run("article-recent", recent);
      const list = await request(onRequest, db, "admin/articles?q=needle-article-0&limit=10");
      const detail = await request(onRequest, db, "admin/articles/paged-article-0");
      assert.equal(list.body.articles[0].article_pv, 1); assert.equal(detail.body.article.article_pv, 1);
      assert.equal(detail.body.metrics.retentionDays, 180); assert.equal(list.body.metrics.scope, "retained-events");
    });

    await t.test("new workbench and analytics remain admin-only and avoid invented operational state", async () => {
      const before = db.sqlite.prepare("select count(*) as count from sqlite_master where type = 'table'").get().count;
      const snapshot = await readAdminWorkbench(db, "operator");
      assert.equal(snapshot.countsAvailability.draftArticleCount, "available");
      assert.equal(snapshot.countsAvailability.whiteboardCleanupFailedCount, "unavailable");
      assert.equal(snapshot.whiteboardCleanupFailedCount, null);
      assert.equal(db.sqlite.prepare("select count(*) as count from sqlite_master where type = 'table'").get().count, before);
      for (const path of ["admin/workbench-summary", "admin/analytics/overview?days=7", "admin/accounts", "admin/chat/messages"]) {
        const denied = await request(onRequest, db, path, { authenticated: false });
        assert.equal(denied.status, 401, path);
      }
      const overview = await request(onRequest, db, "admin/analytics/overview?days=7");
      assert.equal(overview.status, 200, JSON.stringify(overview));
      assert.equal(overview.body.collection.historicalSampling, "unknown");
      assert.equal(overview.body.collection.current.budgetTimeZone, "UTC");
    });
  } finally { db.sqlite.close(); }
});

test("workbench projects real events, per-channel delivery dates and owner-scoped H3 metadata", async () => {
  const db = new D1();
  try {
    db.sqlite.exec(`
      create table article_delivery_channels (channel_key text, enabled integer, auto_publish integer, last_used_at text, updated_at text);
      create table article_delivery_events (event_id text, channel_key text, status text, created_at text, payload_hash text);
      create table minimax_h3_jobs (job_id text, owner_user_id text, state text, prompt text);
      create table minimax_h3_job_events (event_id text, job_id text, event_type text, to_state text, code text, created_at text, summary text);
      create table whiteboard_rooms (status text);
      create table whiteboard_admin_audit (audit_id text, action text, created_at text, details text);
      create table transfer_items (upload_status text);
      create table transfer_audit_log (id text, action text, created_at text, room_id text);
      create table transfer_cleanup_runs (id text, started_at text, finished_at text, status text, failed_operations integer);
      create table transfer_alerts (id text, alert_type text, status text, created_at text, sent_at text, details text);
    `);
    db.sqlite.prepare("insert into article_delivery_channels values ('daily-ai-news',1,1,null,?),('tool-radar',0,0,null,?)").run(VERSION, VERSION);
    const insert = db.sqlite.prepare("insert into article_delivery_events values (?, ?, 'published', ?, 'private-delivery-hash')");
    insert.run("older-tool", "tool-radar", VERSION);
    for (let index = 0; index < 25; index++) insert.run(`daily-${index}`, "daily-ai-news", `2026-09-01T00:00:${String(index).padStart(2, "0")}.000Z`);
    db.sqlite.prepare("insert into minimax_h3_jobs values ('own-job','operator','failed','private-prompt'),('other-job','other-owner','failed','other-prompt')").run();
    db.sqlite.prepare("insert into minimax_h3_job_events values ('own-event','own-job','job.failed','failed','H3_RUNNER_FAILURE',?,'private-summary'),('other-event','other-job','job.failed','failed','H3_RUNNER_FAILURE',?,'other-summary')").run(VERSION, VERSION);
    db.sqlite.prepare("insert into whiteboard_rooms values ('deleting'),('active')").run();
    db.sqlite.prepare("insert into whiteboard_admin_audit values ('wb-event','clear',?,'private-room-metadata')").run(VERSION);
    db.sqlite.prepare("insert into transfer_items values ('deleting'),('ready')").run();
    db.sqlite.prepare("insert into transfer_audit_log values ('transfer-event','delete',?,'private-room-id')").run(VERSION);
    db.sqlite.prepare("insert into transfer_cleanup_runs values ('cleanup',?,?,'partial',2)").run(VERSION, VERSION);
    db.sqlite.prepare("insert into transfer_alerts values ('alert','email','failed',?,'','private-email-destination')").run(VERSION);
    const snapshot = await readAdminWorkbench(db, "operator");
    assert.equal(snapshot.whiteboardCleanupFailedCount, 1);
    assert.equal(snapshot.transferPendingDeletionCount, 1);
    assert.equal(snapshot.h3FailedJobCount, 1);
    assert.equal(snapshot.tasks.automation.find((channel) => channel.channelKey === "tool-radar").lastDeliveryAt, VERSION, "last delivery is not limited to the latest 20 events from all channels");
    assert.ok(snapshot.tasks.automation.every((channel) => channel.executionState === "unknown"));
    assert.equal(snapshot.tasks.transferCleanup[0].failedOperations, 2);
    assert.equal(snapshot.tasks.transferAlerts[0].status, "failed");
    const h3 = snapshot.recentOperations.filter((event) => event.source === "h3");
    assert.deepEqual(h3.map((event) => event.id), ["own-event"]);
    assert.doesNotMatch(JSON.stringify(snapshot), /private-|other-event|other-prompt|other-summary/);
  } finally { db.sqlite.close(); }
});
