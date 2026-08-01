import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  anonymousNameCombinationCount,
  handleAnonymousIdentityApi
} from "../functions/api/anonymous-identity.mjs";

class D1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new D1Statement(this.database, this.sql, values);
  }

  async first() {
    return this.database.prepare(this.sql).get(...this.values) || null;
  }

  async all() {
    return { results: this.database.prepare(this.sql).all(...this.values) };
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes || 0) } };
  }
}

class D1Database {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("pragma foreign_keys = on");
    this.sqlite.exec(readFileSync(new URL("../cloudflare/schema.sql", import.meta.url), "utf8"));
  }

  prepare(sql) {
    return new D1Statement(this.sqlite, sql);
  }

  async batch(statements) {
    const results = [];
    this.sqlite.exec("begin immediate");
    try {
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec("commit");
      return results;
    } catch (error) {
      this.sqlite.exec("rollback");
      throw error;
    }
  }

  close() {
    this.sqlite.close();
  }
}

function request(path = "", options = {}) {
  return new Request(`https://example.test/api/anonymous-identity${path}`, options);
}

function cookiePair(response) {
  return String(response.headers.get("Set-Cookie") || "").split(";")[0];
}

test("anonymous identity has more than ten thousand safe combinations", () => {
  assert.ok(anonymousNameCombinationCount() >= 10_000);
});

test("anonymous credential is HttpOnly and keeps one server-side identity", async () => {
  const DB = new D1Database();
  try {
    const first = await handleAnonymousIdentityApi(
      { request: request(), env: { DB } },
      ["anonymous-identity"]
    );
    assert.equal(first.status, 200);
    const firstPayload = await first.json();
    assert.match(first.headers.get("Set-Cookie"), /lusu_anonymous=/);
    assert.match(first.headers.get("Set-Cookie"), /HttpOnly/);
    assert.match(first.headers.get("Set-Cookie"), /Secure/);
    assert.equal("anonymousId" in firstPayload.identity, false);
    assert.match(firstPayload.identity.color, /^#[0-9a-f]{6}$/i);

    const second = await handleAnonymousIdentityApi(
      { request: request("", { headers: { Cookie: cookiePair(first) } }), env: { DB } },
      ["anonymous-identity"]
    );
    const secondPayload = await second.json();
    assert.deepEqual(secondPayload.identity, firstPayload.identity);
    assert.equal(
      DB.sqlite.prepare("select count(*) as count from anonymous_identities").get().count,
      1
    );
  } finally {
    DB.close();
  }
});

test("legacy visitor cookie migrates once and arbitrary credentials cannot select it", async () => {
  const DB = new D1Database();
  try {
    const legacyCookie = "lusu_visitor=vis_existingbrowser00001";
    const first = await handleAnonymousIdentityApi(
      { request: request("", { headers: { Cookie: legacyCookie } }), env: { DB } },
      ["anonymous-identity"]
    );
    const firstPayload = await first.json();
    const forged = await handleAnonymousIdentityApi(
      { request: request("", { headers: { Cookie: "lusu_anonymous=forged-token-value-that-is-not-valid" } }), env: { DB } },
      ["anonymous-identity"]
    );
    const forgedPayload = await forged.json();
    assert.notEqual(forgedPayload.identity.createdAt, "");
    assert.equal(
      DB.sqlite.prepare("select count(*) as count from anonymous_identities").get().count,
      2
    );

    const migratedAgain = await handleAnonymousIdentityApi(
      { request: request("", { headers: { Cookie: legacyCookie } }), env: { DB } },
      ["anonymous-identity"]
    );
    assert.equal((await migratedAgain.json()).identity.displayName, firstPayload.identity.displayName);
  } finally {
    DB.close();
  }
});

test("server enforces the random-name cooldown", async () => {
  const DB = new D1Database();
  try {
    const bootstrap = await handleAnonymousIdentityApi(
      { request: request(), env: { DB } },
      ["anonymous-identity"]
    );
    const Cookie = cookiePair(bootstrap);
    const firstRotate = await handleAnonymousIdentityApi(
      {
        request: request("/name/rotate", {
          method: "POST",
          headers: { Cookie, "Content-Type": "application/json" },
          body: "{}"
        }),
        env: { DB }
      },
      ["anonymous-identity", "name", "rotate"]
    );
    assert.equal(firstRotate.status, 200);

    await assert.rejects(
      handleAnonymousIdentityApi(
        {
          request: request("/name/rotate", {
            method: "POST",
            headers: { Cookie, "Content-Type": "application/json" },
            body: "{}"
          }),
          env: { DB }
        },
        ["anonymous-identity", "name", "rotate"]
      ),
      (error) => error.code === "NAME_COOLDOWN" && error.status === 429
    );
  } finally {
    DB.close();
  }
});
