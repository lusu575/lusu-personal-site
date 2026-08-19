import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildDailyAiNewsRss,
  escapeRssXml,
  normalizeDailyAiNewsFeedLanguage
} from "../functions/api/daily-ai-news-feed.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("Daily AI News RSS emits localized, escaped RSS 2.0 items", () => {
  const xml = buildDailyAiNewsRss({
    lang: "en",
    articles: [{
      slug: "daily-ai-news-2026-08-19",
      status: "published",
      title: 'Model <A> & "B"',
      summary: "It's ready & safe <today>",
      published_at: "2026-08-19T01:00:00.000Z"
    }]
  });

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0" xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.match(xml, /<language>en<\/language>/);
  assert.match(xml, /Model &lt;A&gt; &amp; &quot;B&quot;/);
  assert.match(xml, /It&apos;s ready &amp; safe &lt;today&gt;/);
  assert.match(xml, /\/articles\/daily-ai-news-2026-08-19\?lang=en/);
  assert.match(xml, /<pubDate>Wed, 19 Aug 2026 01:00:00 GMT<\/pubDate>/);
  assert.doesNotMatch(xml, /<content:encoded>|content_markdown|view_count/);
});

test("Daily AI News RSS language and XML helpers fail closed to safe values", () => {
  assert.equal(normalizeDailyAiNewsFeedLanguage("ja"), "ja");
  assert.equal(normalizeDailyAiNewsFeedLanguage("fr"), "zh");
  assert.equal(escapeRssXml("<&>\"'"), "&lt;&amp;&gt;&quot;&apos;");
});

test("public route and About UI keep the feed narrow and low-profile", () => {
  const api = read("functions/api/[[route]].js");
  const index = read("index.html");
  const main = read("js/main.js");
  const css = read("css/style.css");

  assert.match(api, /parts\[0\] === "feeds"[\s\S]{0,120}parts\[1\] === "daily-ai-news\.xml"/);
  assert.match(api, /category: "daily-ai-news",\s*limit: 50/);
  assert.match(api, /contentType: "application\/rss\+xml; charset=utf-8"/);
  assert.match(index, /rel="alternate" type="application\/rss\+xml"/);
  assert.match(index, /class="about-rss-row"/);
  assert.ok(index.indexOf('class="about-rss-row"') > index.indexOf('class="about-copy"'));
  assert.ok(index.indexOf('class="about-rss-row"') > index.indexOf('id="about-social-links"'));
  assert.match(main, /function syncDailyAiNewsFeedLinks/);
  assert.match(css, /\.about-rss-row\s*\{/);
  assert.doesNotMatch(index, /data-social-link="rss"/);
});
