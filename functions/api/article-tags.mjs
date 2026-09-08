const TAG_ALIASES = new Map([
  ["每日ai新闻", "daily-ai-news"], ["每日 ai 新闻", "daily-ai-news"],
  ["daily ai news", "daily-ai-news"], ["デイリーaiニュース", "daily-ai-news"],
  ["デイリー ai ニュース", "daily-ai-news"], ["毎日のaiニュース", "daily-ai-news"], ["毎日aiニュース", "daily-ai-news"],
  ["工具雷达", "tool-radar"], ["tool radar", "tool-radar"], ["ツールレーダー", "tool-radar"]
]);

export function articleTagIdentity(value) {
  const key = String(value || "").normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
  return TAG_ALIASES.get(key) || key;
}

export function normalizeArticleTags(value, { maxItems = 12, maxLength = 40 } = {}) {
  if (!Array.isArray(value)) return [];
  const tags = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const tag = Array.from(item.normalize("NFKC").trim().replace(/\s+/gu, " "))
      .slice(0, maxLength).join("");
    const identity = articleTagIdentity(tag);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    tags.push(tag);
    if (tags.length >= maxItems) break;
  }
  return tags;
}

// Preserve every distinct historical tag. Only duplicate/empty labels are removed;
// malformed legacy JSON is left untouched for an editor to inspect.
export async function normalizeHistoricalArticleTags(env) {
  let cursor = "";
  let changed = 0;
  while (true) {
    const { results = [] } = await env.DB.prepare(`
      select article_id, tags from articles
      where article_id > ? order by article_id limit 500
    `).bind(cursor).all();
    if (!results.length) break;
    const statements = [];
    for (const row of results) {
      let tags;
      try { tags = JSON.parse(row.tags); } catch { continue; }
      if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) continue;
      const seen = new Set();
      const normalized = tags.filter((tag) => {
        const identity = articleTagIdentity(tag);
        if (!identity || seen.has(identity)) return false;
        seen.add(identity);
        // Compare normalized identities, but preserve the editor's first spelling.
        return true;
      });
      const value = JSON.stringify(normalized);
      if (value === JSON.stringify(tags)) continue;
      statements.push(env.DB.prepare("update articles set tags = ? where article_id = ? and tags = ?")
        .bind(value, row.article_id, row.tags));
    }
    // Small atomic batches stay within D1 request limits and preserve concurrent edits.
    for (let index = 0; index < statements.length; index += 50) {
      const results = await env.DB.batch(statements.slice(index, index + 50));
      changed += results.reduce((count, result) => count + Number(result?.meta?.changes || 0), 0);
    }
    cursor = results.at(-1).article_id;
  }
  return changed;
}
