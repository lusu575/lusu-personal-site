// Private browser workbench. No content is sent to the server by this module.
import { safeArticleLinkHref, articleImageDimensions } from "../js/routes/knowledge.mjs";

export const DRAFT_LIMIT_BYTES = 2 * 1024 * 1024;
const SNAPSHOT_LIMIT_BYTES = 320 * 1024;
const MAX_DOCUMENTS = 12;
const MAX_HISTORY = 5;
const FIELD_NAMES = ["slug", "category", "tags", "cover_image", "status", "published_at", "is_pinned",
  ...["zh", "en", "ja"].flatMap((lang) => [`title_${lang}`, `summary_${lang}`, `content_${lang}`])];
const clone = (value) => JSON.parse(JSON.stringify(value));
const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length;

export function articleSnapshot(form) {
  return Object.fromEntries(FIELD_NAMES.map((name) => [name, name === "is_pinned"
    ? Boolean(form.elements[name]?.checked) : String(form.elements[name]?.value || "")]));
}

export function applyArticleSnapshot(form, snapshot) {
  for (const name of FIELD_NAMES) {
    if (!form.elements[name]) continue;
    if (name === "is_pinned") form.elements[name].checked = Boolean(snapshot[name]);
    else form.elements[name].value = String(snapshot[name] || "");
  }
}

export async function createDraftStore(storage, accountId, options = {}) {
  if (!accountId) throw new Error("登录后才能使用本机暂存。");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(accountId)));
  const scope = [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, "0")).join("");
  const key = `lusu-admin-article-workbench-v1:${scope}`;
  const limit = options.limitBytes || DRAFT_LIMIT_BYTES;
  const read = () => {
    try {
      const raw = storage.getItem(key);
      if (!raw) return { version: 1, documents: [] };
      const parsed = JSON.parse(raw);
      if (parsed.version !== 1 || !Array.isArray(parsed.documents) || bytes(parsed) > limit) throw new Error();
      return parsed;
    } catch { throw new Error("本机暂存不可读或已损坏；当前编辑内容仍在页面中。"); }
  };
  const persist = (data, keepId) => {
    data.documents.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    data.documents = data.documents.slice(0, MAX_DOCUMENTS);
    while (bytes(data) > limit) {
      const old = [...data.documents].reverse().find((item) => item.id !== keepId);
      if (old) data.documents.splice(data.documents.indexOf(old), 1);
      else {
        const current = data.documents.find((item) => item.id === keepId);
        if (current?.history.length) current.history.pop();
        else throw new Error("暂存空间不足；请复制内容或清理本机历史。");
      }
    }
    try { storage.setItem(key, JSON.stringify(data)); }
    catch { throw new Error("浏览器未能保存本机暂存；请勿依赖自动恢复，请复制当前内容。"); }
  };
  return Object.freeze({
    get(id) { return clone(read().documents.find((item) => item.id === String(id || "new")) || null); },
    save(id, snapshot, { history = false, revision = null, now = new Date().toISOString() } = {}) {
      const safeSnapshot = Object.fromEntries(FIELD_NAMES.map((name) => [name, name === "is_pinned" ? Boolean(snapshot[name]) : String(snapshot[name] || "")]));
      if (bytes(safeSnapshot) > SNAPSHOT_LIMIT_BYTES) throw new Error("文章超过本机单份 320 KiB 暂存上限；请先复制备份。");
      const data = read();
      const docId = String(id || "new");
      let entry = data.documents.find((item) => item.id === docId);
      if (!entry) { entry = { id: docId, history: [] }; data.documents.push(entry); }
      const snapshotEntry = { snapshot: safeSnapshot, savedAt: now, revision };
      if (history) {
        if (JSON.stringify(entry.history[0]?.snapshot) !== JSON.stringify(safeSnapshot)) entry.history.unshift(snapshotEntry);
        entry.history = entry.history.slice(0, MAX_HISTORY);
      } else entry.draft = snapshotEntry;
      entry.updatedAt = now;
      persist(data, docId);
      return clone(entry);
    },
    clearDraft(id) {
      const data = read();
      const item = data.documents.find((entry) => entry.id === String(id || "new"));
      if (item) delete item.draft;
      persist(data, String(id || "new"));
    },
    clearAll() { storage.removeItem(key); }
  });
}

export function articleVersionDiff(before = {}, after = {}) {
  const labels = { slug: "路径标识", category: "分类", tags: "标签", cover_image: "封面", status: "状态", published_at: "发布时间", is_pinned: "置顶" };
  const output = [];
  for (const name of FIELD_NAMES) {
    if (String(before[name] ?? "") === String(after[name] ?? "")) continue;
    const label = labels[name] || name.replace(/^(title|summary|content)_(zh|en|ja)$/, (_, field, lang) => `${({ zh: "中文", en: "英文", ja: "日文" })[lang]}${({ title: "标题", summary: "简介", content: "正文" })[field]}`);
    const oldLines = String(before[name] ?? "").split("\n");
    const newLines = String(after[name] ?? "").split("\n");
    let start = 0;
    while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start += 1;
    let end = 0;
    while (end < oldLines.length - start && end < newLines.length - start && oldLines.at(-1 - end) === newLines.at(-1 - end)) end += 1;
    output.push(`【${label}】\n${oldLines.slice(start, end ? -end : undefined).map((line) => `− ${line}`).join("\n")}\n${newLines.slice(start, end ? -end : undefined).map((line) => `+ ${line}`).join("\n")}`);
  }
  const text = output.join("\n\n") || "所选本机版本与当前编辑内容相同。";
  return text.length > 24000 ? `${text.slice(0, 24000)}\n（差异较长，仅预览前 24,000 字；恢复保留完整内容。）` : text;
}

export function contentListQuery({ q = "", category = "", status = "", updatedAfter = "", metadata = "", offset = 0 } = {}) {
  const query = new URLSearchParams({ limit: "50", offset: String(Math.max(0, Number(offset) || 0)) });
  for (const [key, value] of Object.entries({ q, category, status, updatedAfter, metadata })) if (value) query.set(key, String(value));
  return query.toString();
}

// The same DOM-only Markdown subset as the public knowledge reader. Images are
// restricted to reviewed project-local article assets; arbitrary HTML is text.
export function renderArticleMarkdown(target, markdown) {
  const document = target.ownerDocument;
  const inline = (parent, text) => {
    for (const part of String(text).split(/(`[^`\r\n]+`|\*\*[^*\r\n]+\*\*|(?<!!)\[[^\]\r\n]+\]\([^\s)\r\n]+\))/g).filter(Boolean)) {
      const code = part.startsWith("`") && part.endsWith("`");
      const strong = part.startsWith("**") && part.endsWith("**");
      const link = part.match(/^\[([^\]\r\n]+)\]\(([^\s)\r\n]+)\)$/);
      const href = link && safeArticleLinkHref(link[2]);
      if (code || strong || href) {
        const node = document.createElement(code ? "code" : strong ? "strong" : "a");
        node.textContent = code ? part.slice(1, -1) : strong ? part.slice(2, -2) : link[1];
        if (href) { node.href = href; node.target = "_blank"; node.rel = "noreferrer noopener"; }
        parent.append(node);
      } else parent.append(document.createTextNode(part));
    }
  };
  target.replaceChildren();
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (/^```/.test(line.trim())) {
      const fence = line.trim().slice(3).trim().toLowerCase();
      const content = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) content.push(lines[index++]);
      index += 1;
      const box = document.createElement(fence === "text" ? "div" : "pre");
      if (fence === "text") { box.className = "article-callout"; for (const text of content) { const p = document.createElement("p"); inline(p, text); box.append(p); } }
      else { const code = document.createElement("code"); code.textContent = content.join("\n"); box.append(code); }
      target.append(box);
      continue;
    }
    const image = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (image) {
      const src = image[2];
      let captionIndex = index + 1;
      while (captionIndex < lines.length && !lines[captionIndex].trim()) captionIndex += 1;
      const explicitCaption = lines[captionIndex]?.trim().match(/^\*([^*\r\n]+)\*$/)?.[1] || "";
      if (!/(^|\/)\.\.(\/|$)/.test(src) && /^assets\/images\/articles\/[a-z0-9._/-]+\.(png|jpe?g|webp|gif)(\?[a-z0-9=&._-]+)?$/i.test(src)) {
        const figure = document.createElement("figure"); const img = document.createElement("img");
        figure.className = "article-figure";
        img.src = `/${src}`; img.alt = explicitCaption ? image[1] : ""; img.loading = "lazy"; img.decoding = "async";
        const dimensions = articleImageDimensions(src); if (dimensions) { img.width = dimensions.width; img.height = dimensions.height; }
        figure.append(img); if (explicitCaption || image[1]) { const caption = document.createElement("figcaption"); if (explicitCaption) inline(caption, explicitCaption); else caption.textContent = image[1]; figure.append(caption); }
        target.append(figure);
      }
      index = explicitCaption ? captionIndex + 1 : index + 1; continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading || /^>\s+/.test(line)) { const node = document.createElement(heading ? `h${heading[1].length + 1}` : "blockquote"); inline(node, heading ? heading[2] : line.replace(/^>\s+/, "")); target.append(node); index += 1; continue; }
    const ordered = /^\d+\.\s+/.test(line); const unordered = /^[-*]\s+/.test(line);
    if (ordered || unordered) { const list = document.createElement(ordered ? "ol" : "ul"); const expression = ordered ? /^\d+\.\s+/ : /^[-*]\s+/; while (index < lines.length && expression.test(lines[index])) { const item = document.createElement("li"); inline(item, lines[index++].replace(expression, "")); list.append(item); } target.append(list); continue; }
    const content = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,3}\s+|\d+\.\s+|[-*]\s+|>\s+|\s*```|\s*!\[[^\]]*\]\([^)]+\)$)/.test(lines[index])) content.push(lines[index++]);
    const p = document.createElement("p"); inline(p, content.join(" ")); target.append(p);
  }
}
