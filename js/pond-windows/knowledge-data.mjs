// Real production Knowledge Base data loader:
// 1) Primary source: live Cloudflare Pages API GET /api/articles?limit=100 (& /api/articles/:slug)
// 2) Offline / static fallback: real repository content.updates from js/data/content.mjs
// Zero fake/sample articles or hardcoded mock reading progress.

import { content } from '../data/content.mjs';
import { articleCategoryLabels, tagLabels } from '../data/article-labels.mjs';

const PROGRESS_STORAGE_KEY = 'pond_kb_reading_progress_v1';

function getRealFallbackUpdates() {
  const list = Array.isArray(content?.updates) ? content.updates : [];
  return list
    .filter((item) => item && item.slug && item.category)
    .map((item) => ({
      ...item,
      is_pinned: Number(item.is_pinned || 0)
    }));
}

export function getCategoryLabel(category, lang = 'zh') {
  if (category === 'all') {
    return lang === 'en' ? 'All' : lang === 'ja' ? 'すべて' : '全部';
  }
  const entry = articleCategoryLabels[category];
  if (entry) return entry[lang] || entry.zh || category;
  return String(category || '');
}

export function getTagLabel(tag, lang = 'zh') {
  const entry = tagLabels[tag];
  if (entry) return entry[lang] || entry.zh || String(tag);
  return String(tag || '');
}

export function getAllTagVariants(tag) {
  const entry = tagLabels[tag];
  if (!entry) return [String(tag || '')];
  return [String(tag || ''), entry.zh, entry.en, entry.ja].filter(Boolean);
}

export function getLocalizedField(field, lang = 'zh') {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field[lang] || field.zh || field.en || field.ja || '';
}

export function formatDateISO(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function loadReadingProgressMap() {
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // Ignore storage access errors
  }
  return {};
}

export function saveReadingProgress(slug, percent) {
  if (!slug) return;
  const clamped = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const map = loadReadingProgressMap();
  map[slug] = clamped;
  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage write errors
  }
}

let cachedResult = null;
let cachedPromise = null;

export function loadKnowledgeArticles({ force = false } = {}) {
  if (!force && cachedResult) return Promise.resolve(cachedResult);
  if (!force && cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch('/api/articles?limit=100', {
        headers: { Accept: 'application/json' },
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.articles)
            ? data.articles
            : Array.isArray(data)
              ? data
              : [];
        if (items.length > 0) {
          cachedResult = { items, source: 'api' };
          return cachedResult;
        }
      }
    } catch {
      // Static preview or offline fallback
    }
    cachedResult = { items: getRealFallbackUpdates(), source: 'fallback' };
    return cachedResult;
  })();
  return cachedPromise;
}

export async function loadKnowledgeArticleDetail(slug) {
  if (!slug) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`/api/articles/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.article || data.slug)) {
        return data.article || data;
      }
    }
  } catch {
    // Fallback to local content.updates body
  }
  const updates = getRealFallbackUpdates();
  return updates.find((item) => item.slug === slug) || null;
}
