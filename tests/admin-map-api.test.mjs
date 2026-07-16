import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { onRequest } from "../functions/api/[[route]].js";

const RUNTIME_SECRETS = Object.freeze({
  CHAT_IP_HASH_SALT: "test-chat-ip-hash-secret-0000000000000001",
  ANALYTICS_IP_HASH_SALT: "test-analytics-ip-hash-secret-00000001"
});

function normalizedSql(sql) {
  return String(sql || "").replace(/\s+/g, " ").trim();
}

function isCityAggregationQuery(sql) {
  const normalized = normalizedSql(sql);
  return normalized.startsWith("select country, region, city, count(*) as pv")
    && normalized.includes("group by country, region, city")
    && !normalized.includes("group by country, region, city, ip_prefix");
}

function createAnalyticsD1() {
  const calls = [];
  const cityFixture = {
    country: "SG",
    region: "Singapore",
    city: "Singapore",
    pv: "7",
    uv: "3",
    last_seen_at: "2026-07-16T10:30:00.000Z",
    latitude: "1.3521",
    longitude: "103.8198",
    ip_prefix: "203.0.113.0/24",
    ip_hash: "must-not-leave-the-api",
    visitor_id: "must-not-leave-the-api"
  };

  function statement(sql) {
    return {
      sql,
      params: [],
      bind(...params) {
        this.params = params;
        return this;
      },
      async run() {
        calls.push({ method: "run", sql, params: [...this.params] });
        return { success: true, meta: { changes: 1 } };
      },
      async first() {
        calls.push({ method: "first", sql, params: [...this.params] });
        const normalized = normalizedSql(sql);
        if (/from sessions join users/i.test(normalized)) {
          return {
            token_hash: "admin-map-api-session-hash",
            id: "admin-map-api-user",
            email: "admin@example.test",
            role: "admin"
          };
        }
        if (/^select count\(\*\) as count/i.test(normalized)) {
          return { count: 0 };
        }
        return null;
      },
      async all() {
        calls.push({ method: "all", sql, params: [...this.params] });
        if (isCityAggregationQuery(sql)) {
          return { results: [cityFixture] };
        }
        return { results: [] };
      }
    };
  }

  return {
    calls,
    prepare(sql) {
      assert.equal(typeof sql, "string", "D1 prepare requires a SQL string");
      return statement(sql);
    },
    async batch() {
      return [];
    }
  };
}

test("admin analytics returns privacy-safe city aggregates for the interactive map", async () => {
  const db = createAnalyticsD1();
  const response = await onRequest({
    request: new Request("https://example.test/api/admin/analytics/overview?days=14", {
      headers: { Cookie: "lusu_session=admin-map-api-session" }
    }),
    env: { DB: db, ...RUNTIME_SECRETS },
    waitUntil() {}
  });

  assert.equal(response.status, 200, await response.clone().text());
  const payload = await response.json();
  assert.deepEqual(payload.cities, [{
    country: "SG",
    region: "Singapore",
    city: "Singapore",
    pv: 7,
    uv: 3,
    last_seen_at: "2026-07-16T10:30:00.000Z",
    latitude: 1.3521,
    longitude: 103.8198
  }]);

  for (const city of payload.cities) {
    for (const forbidden of ["ip_prefix", "ip_hash", "visitor_id"]) {
      assert.equal(Object.hasOwn(city, forbidden), false, `city aggregates must not expose ${forbidden}`);
    }
  }

  const cityCalls = db.calls.filter((call) => call.method === "all" && isCityAggregationQuery(call.sql));
  assert.equal(cityCalls.length, 1, "overview should execute one dedicated city aggregation query");
  const citySql = normalizedSql(cityCalls[0].sql);
  assert.match(citySql, /count\(\*\) as pv/i);
  assert.match(citySql, /count\(distinct visitor_id\) as uv/i);
  assert.match(citySql, /max\(created_at\) as last_seen_at/i);
  assert.match(citySql, /avg\(latitude\) as latitude, avg\(longitude\) as longitude/i);
  assert.match(citySql, /latitude is not null and longitude is not null/i);
  assert.match(citySql, /latitude between -90 and 90 and longitude between -180 and 180/i);
  assert.match(citySql, /coalesce\(trim\(country\), ''\) <> '' or coalesce\(trim\(region\), ''\) <> '' or coalesce\(trim\(city\), ''\) <> ''/i);
  assert.match(citySql, /group by country, region, city order by pv desc, uv desc/i);
  assert.match(citySql, /limit 200$/i);
  assert.doesNotMatch(citySql, /ip_prefix|ip_hash/i);
  assert.equal(cityCalls[0].params.length, 1, "city aggregation should use the overview time window");
  assert.match(String(cityCalls[0].params[0]), /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);

  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec(`
      create table analytics_page_views (
        country text,
        region text,
        city text,
        visitor_id text not null,
        created_at text not null,
        latitude real,
        longitude real
      );
    `);
    const insert = sqlite.prepare(`
      insert into analytics_page_views (
        country, region, city, visitor_id, created_at, latitude, longitude
      ) values (?, ?, ?, ?, ?, ?, ?)
    `);
    const since = String(cityCalls[0].params[0]);
    const inside = new Date(new Date(since).getTime() + 60 * 60 * 1000).toISOString();
    const outside = new Date(new Date(since).getTime() - 1).toISOString();
    for (const row of [
      ["SG", "Singapore", "Singapore", "visitor-a", inside, 1.3521, 103.8198],
      ["SG", "Singapore", "Singapore", "visitor-a", inside, 1.3521, 103.8198],
      ["SG", "Singapore", "Singapore", "visitor-b", inside, 1.3521, 103.8198],
      ["JP", "Tokyo", "Tokyo", "visitor-c", inside, 35.6895, 139.6917],
      ["SG", "Singapore", "Singapore", "visitor-old", outside, 1.3521, 103.8198],
      ["SG", "Singapore", "Singapore", "visitor-null", inside, null, 103.8198],
      ["SG", "Singapore", "Singapore", "visitor-bounds", inside, 91, 103.8198],
      ["SG", "Singapore", "Singapore", "visitor-zero", inside, 0, 0],
      ["", "", "", "visitor-no-place", inside, 1.3, 103.8]
    ]) {
      insert.run(...row);
    }
    const actual = sqlite.prepare(cityCalls[0].sql).all(since);
    assert.equal(actual.length, 2, "only valid, named, in-window cities should be aggregated");
    assert.deepEqual(
      actual.map((row) => ({ city: row.city, pv: row.pv, uv: row.uv })),
      [
        { city: "Singapore", pv: 3, uv: 2 },
        { city: "Tokyo", pv: 1, uv: 1 }
      ]
    );
  } finally {
    sqlite.close();
  }
});

test("admin analytics normalizes malformed and out-of-range map windows", async () => {
  for (const [value, expected] of [["abc", 14], ["4.9", 4], ["0", 1], ["91", 90]]) {
    const response = await onRequest({
      request: new Request(`https://example.test/api/admin/analytics/overview?days=${value}`, {
        headers: { Cookie: "lusu_session=admin-map-api-session" }
      }),
      env: { DB: createAnalyticsD1(), ...RUNTIME_SECRETS },
      waitUntil() {}
    });
    assert.equal(response.status, 200, `days=${value} should remain a valid request`);
    assert.equal((await response.json()).windowDays, expected);
  }
});
