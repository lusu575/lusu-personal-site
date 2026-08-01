import assert from "node:assert/strict";
import test from "node:test";

import { fetchOfficialD1Analytics } from "../functions/api/traffic-control.mjs";

const analyticsEnv = {
  CLOUDFLARE_ANALYTICS_API_TOKEN: "private-read-only-token",
  CLOUDFLARE_ANALYTICS_ACCOUNT_ID: "account-id",
  CLOUDFLARE_ANALYTICS_D1_DATABASE_ID: "database-id"
};

test("official D1 analytics requests rowsWritten without exposing credentials", async () => {
  const today = new Date().toISOString().slice(0, 10);
  let requestRecord = null;
  const result = await fetchOfficialD1Analytics(analyticsEnv, async (url, options) => {
    requestRecord = { url, options };
    return Response.json({
      data: {
        viewer: {
          accounts: [{
            d1AnalyticsAdaptiveGroups: [{
              dimensions: { date: today, databaseId: "database-id" },
              sum: { readQueries: 12, writeQueries: 4, rowsRead: 345, rowsWritten: 67 }
            }]
          }]
        }
      }
    });
  });

  assert.equal(requestRecord.url, "https://api.cloudflare.com/client/v4/graphql");
  assert.equal(requestRecord.options.headers.Authorization, "Bearer private-read-only-token");
  const body = JSON.parse(requestRecord.options.body);
  assert.match(body.query, /d1AnalyticsAdaptiveGroups/);
  assert.match(body.query, /rowsWritten/);
  assert.deepEqual(body.variables.databaseId, "database-id");
  assert.equal(result.status, "connected");
  assert.equal(result.today.rowsWritten, 67);
  assert.equal(JSON.stringify(result).includes("private-read-only-token"), false);
});

test("a connected official query does not fabricate zero rows for a missing current-day group", async () => {
  const result = await fetchOfficialD1Analytics(analyticsEnv, async () => Response.json({
    data: {
      viewer: {
        accounts: [{ d1AnalyticsAdaptiveGroups: [] }]
      }
    }
  }));

  assert.equal(result.status, "connected");
  assert.equal(result.today, null);
  assert.deepEqual(result.daily, []);
});

test("official analytics failures stay generic and never reflect the token", async () => {
  const result = await fetchOfficialD1Analytics(analyticsEnv, async () => Response.json({
    errors: [{ message: "token private-read-only-token rejected by an internal service" }]
  }, { status: 403 }));

  assert.equal(result.status, "error");
  assert.equal(JSON.stringify(result).includes("private-read-only-token"), false);
});
