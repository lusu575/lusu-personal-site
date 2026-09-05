import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProxyAwareFetch } from "./network-fetch.mjs";

const decodeHtml = (value) => String(value)
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(parseInt(codePoint, 16)))
  .replaceAll("&#x27;", "'")
  .replaceAll("&apos;", "'")
  .replaceAll("&quot;", '"')
  .replaceAll("&amp;", "&")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">");

const metaContent = (block, itemProp) => block.match(
  new RegExp(`<meta content="([^"]*)" itemProp="${itemProp}"\\/>`)
)?.[1];

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const decodeRelayString = (value) => {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    throw new Error("Public X relay payload contains an invalid post string.");
  }
};

const extractRelayProfilePosts = (html, handle) => {
  const ownStatusIds = new Set(
    [...String(html).matchAll(new RegExp(
      `(?:href|data-href)="/?${escapeRegex(handle)}/status/(\\d+)"`,
      "gi"
    ))].map((match) => match[1])
  );
  const records = [];
  const relayPattern = /__typename:"Tweet",rest_id:"(\d+)"[\s\S]{0,24000}?__typename:"TBirdData"[\s\S]{0,4000}?full_text:"((?:\\.|[^"\\])*)"[\s\S]{0,2000}?created_at_ms:(\d+)/g;
  for (const match of String(html).matchAll(relayPattern)) {
    const [, id, encodedText, createdAtMs] = match;
    if (!ownStatusIds.has(id)) continue;
    const timestamp = Number(createdAtMs);
    if (!Number.isSafeInteger(timestamp)) continue;
    records.push({
      id,
      publishedAt: new Date(timestamp).toISOString(),
      url: `https://x.com/${handle}/status/${id}`,
      text: decodeRelayString(encodedText)
    });
  }
  return records;
};

export function extractPublicProfilePosts(html, {
  handle,
  profile,
  windowStart,
  windowEnd,
  fetchedAt = new Date().toISOString()
}) {
  const startMs = Date.parse(windowStart);
  const endMs = Date.parse(windowEnd);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    throw new Error("Public X extraction requires a valid half-open time window.");
  }
  const articleStarts = [...String(html).matchAll(
    /<article class="flex flex-col gap-1"[^>]*>/g
  )];
  if (articleStarts.length === 0 && String(html).includes("SocialMediaPosting")) {
    throw new Error("Public X profile contains posts but its article markup is unsupported.");
  }
  const items = [];
  const seenTweetIds = new Set();
  let parsedCount = 0;
  const addParsedPost = ({ id, publishedAt, url, text }) => {
    if (seenTweetIds.has(id)) return;
    seenTweetIds.add(id);
    parsedCount += 1;
    const timestamp = Date.parse(publishedAt);
    if (!Number.isFinite(timestamp) || timestamp < startMs || timestamp >= endMs) {
      return;
    }
    const content = decodeHtml(text);
    items.push({
      id: `twitter:public-profile:${id}`,
      source_type: "twitter",
      title: `@${handle}: ${content.replace(/\s+/g, " ").slice(0, 120)}`,
      url,
      content,
      author: `@${handle}`,
      published_at: new Date(timestamp).toISOString(),
      fetched_at: fetchedAt,
      metadata: {
        tweet_id: id,
        source_name: `@${handle} public profile`,
        public_index_only: true,
        category: "ai-primary-public-post",
        discovery_query_id: profile.queryId,
        coverage_group: profile.coverageGroup,
        coverage_priority: "priority",
        review_lane: profile.reviewLane,
        must_review_source_id: profile.sourceId
      },
      ai_tags: []
    });
  };
  for (let index = 0; index < articleStarts.length; index += 1) {
    const tag = articleStarts[index][0];
    const block = String(html).slice(
      articleStarts[index].index,
      articleStarts[index + 1]?.index ?? String(html).length
    );
    const id = tag.match(/data-tweet-id="(\d+)"/)?.[1]
      || tag.match(/itemID="https:\/\/x\.com\/i\/status\/(\d+)"/)?.[1]
      || metaContent(block, "identifier");
    const publishedAt = metaContent(block, "datePublished");
    const url = metaContent(block, "url");
    const text = metaContent(block, "text");
    const urlHandle = String(url || "").match(
      /^https:\/\/x\.com\/([^/]+)\/status\/(\d+)$/i
    );
    if (!id || !urlHandle || urlHandle[2] !== id
      || urlHandle[1].toLowerCase() !== handle.toLowerCase()
      || !publishedAt || text === undefined) {
      continue;
    }
    addParsedPost({ id, publishedAt, url, text });
  }
  for (const post of extractRelayProfilePosts(html, handle)) {
    addParsedPost(post);
  }
  if (articleStarts.length > 0 && parsedCount === 0) {
    throw new Error("Public X profile contains posts but its article markup is unsupported.");
  }
  return {
    items,
    parsedCount,
    articleCount: articleStarts.length
  };
}

const valueAfter = (args, flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};

export async function runPublicProfileFetch(args = process.argv.slice(2)) {
  const configPath = valueAfter(args, "--config");
  const windowStart = valueAfter(args, "--start");
  const windowEnd = valueAfter(args, "--end");
  if (!configPath || !windowStart || !windowEnd) {
    throw new Error("Usage: fetch-public-x.mjs --config <json> --start <iso> --end <iso>");
  }
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (config.schemaVersion !== 1 || !Array.isArray(config.profiles)) {
    throw new Error("Public X profile config must use schemaVersion 1.");
  }
  const client = createProxyAwareFetch();
  const items = [];
  const report = [];
  try {
  for (const profile of config.profiles) {
    const handle = String(profile.handle || "").replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
      report.push({ handle, status: "failure", fetched: 0, windowFetched: 0, errorType: "InvalidHandle" });
      continue;
    }
    try {
      const response = await client.fetch(`https://x.com/${handle}`, {
        headers: { "user-agent": "Mozilla/5.0" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const extracted = extractPublicProfilePosts(html, {
        handle,
        profile,
        windowStart,
        windowEnd
      });
      items.push(...extracted.items);
      report.push({
        handle,
        status: extracted.articleCount > 0 ? "success" : "empty",
        fetched: extracted.parsedCount,
        windowFetched: extracted.items.length
      });
    } catch (error) {
      report.push({ handle, status: "failure", fetched: 0, windowFetched: 0, errorType: error?.name || "Error" });
    }
  }
  } finally {
    await client.close();
  }
  return { items, report };
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  process.stdout.write(JSON.stringify(await runPublicProfileFetch()));
}
