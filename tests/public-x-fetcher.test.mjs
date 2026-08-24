import assert from "node:assert/strict";
import test from "node:test";

import {
  extractPublicProfilePosts
} from "../自动新闻/integrations/lusu-site/fetch-public-x.mjs";

const profile = {
  queryId: "codex-operations-en",
  coverageGroup: "developer-ai",
  reviewLane: "developer-product-operations",
  sourceId: "public-x-thsottiaux"
};

test("public X parser accepts current itemID article markup and ignores nested quote articles", () => {
  const html = [
    '<article class="flex flex-col gap-1" itemID="https://x.com/i/status/2091407991736332689" itemScope="" itemType="https://schema.org/SocialMediaPosting">',
    '<meta content="2091407991736332689" itemProp="identifier"/>',
    '<meta content="2026-08-23T06:11:36.000Z" itemProp="datePublished"/>',
    '<meta content="https://x.com/thsottiaux/status/2091407991736332689" itemProp="url"/>',
    '<meta content="Usage fixes &amp; a reset are coming &#x2014; more details soon." itemProp="text"/>',
    '<article><meta content="2090000000000000000" itemProp="identifier"/></article>',
    '</article>',
    '<article class="flex flex-col gap-1" itemID="https://x.com/i/status/2091688655828246890" itemScope="" itemType="https://schema.org/SocialMediaPosting">',
    '<meta content="2091688655828246890" itemProp="identifier"/>',
    '<meta content="2026-08-24T00:46:51.000Z" itemProp="datePublished"/>',
    '<meta content="https://x.com/thsottiaux/status/2091688655828246890" itemProp="url"/>',
    '<meta content="Reset propagated after the report window." itemProp="text"/>',
    '</article>'
  ].join("");

  const result = extractPublicProfilePosts(html, {
    handle: "thsottiaux",
    profile,
    windowStart: "2026-08-22T23:00:00.000Z",
    windowEnd: "2026-08-23T23:00:00.000Z",
    fetchedAt: "2026-08-24T01:00:00.000Z"
  });

  assert.equal(result.articleCount, 2);
  assert.equal(result.parsedCount, 2);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, "twitter:public-profile:2091407991736332689");
  assert.equal(
    result.items[0].content,
    "Usage fixes & a reset are coming — more details soon."
  );
  assert.deepEqual(result.items[0].metadata.must_review_source_id, "public-x-thsottiaux");
});

test("public X parser remains compatible with legacy data-tweet-id markup", () => {
  const html = [
    '<article class="flex flex-col gap-1" data-tweet-id="2091407991736332689">',
    '<meta content="2026-08-23T06:11:36.000Z" itemProp="datePublished"/>',
    '<meta content="https://x.com/thsottiaux/status/2091407991736332689" itemProp="url"/>',
    '<meta content="Legacy markup remains readable." itemProp="text"/>',
    '</article>'
  ].join("");

  const result = extractPublicProfilePosts(html, {
    handle: "thsottiaux",
    profile,
    windowStart: "2026-08-22T23:00:00.000Z",
    windowEnd: "2026-08-23T23:00:00.000Z"
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].content, "Legacy markup remains readable.");
});

test("public X parser fails closed when posts use unknown article markup", () => {
  assert.throws(
    () => extractPublicProfilePosts(
      '<article itemType="https://schema.org/SocialMediaPosting"></article>',
      {
        handle: "thsottiaux",
        profile,
        windowStart: "2026-08-22T23:00:00.000Z",
        windowEnd: "2026-08-23T23:00:00.000Z"
      }
    ),
    /article markup is unsupported/
  );
});
