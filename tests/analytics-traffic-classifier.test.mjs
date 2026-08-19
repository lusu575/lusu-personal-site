import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyAnalyticsClient,
  shouldSkipAnalyticsRequest
} from "../functions/api/analytics-traffic-classifier.mjs";

const automatedClients = [
  ["Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "search-crawler"],
  ["GoogleOther", "Mozilla/5.0 (compatible; GoogleOther)", "search-crawler"],
  ["Applebot", "Mozilla/5.0 (compatible; Applebot/0.1)", "search-crawler"],
  ["OAI Search", "Mozilla/5.0; compatible; OAI-SearchBot/1.4", "ai-crawler"],
  ["Meta", "Mozilla/5.0 (compatible; meta-externalagent/1.1)", "ai-crawler"],
  ["Censys", "Mozilla/5.0 (compatible; CensysInspect/1.1)", "security-scanner"],
  ["Headless", "Mozilla/5.0 HeadlessChrome/146.0 Safari/537.36", "automation-tool"],
  ["Smoke", "lusu-production-smoke/1.0", "synthetic-monitor"]
];

for (const [name, userAgent, category] of automatedClients) {
  test(`${name} is excluded from visitor analytics`, () => {
    assert.deepEqual(classifyAnalyticsClient(userAgent), { automated: true, category });
    assert.equal(shouldSkipAnalyticsRequest(new Request("https://example.test", {
      headers: { "User-Agent": userAgent }
    })), true);
  });
}

test("normal browsers and missing user agents remain eligible for analytics", () => {
  const browser = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1";
  assert.deepEqual(classifyAnalyticsClient(browser), { automated: false, category: "browser" });
  assert.deepEqual(classifyAnalyticsClient(""), { automated: false, category: "unknown" });
});
