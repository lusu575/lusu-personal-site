import {
  PUBLIC_ARTICLE_PAGE_SIZE,
  normalizeKnowledgeSearchText,
  knowledgeSearchTokens,
  visibleArticleTags,
  sortKnowledgeArticles,
  knowledgeCategoryValues
} from '../routes/knowledge.mjs';
import {
  loadKnowledgeArticles,
  getCategoryLabel,
  getTagLabel,
  getAllTagVariants,
  getLocalizedField,
  formatDateISO,
  loadReadingProgressMap
} from './knowledge-data.mjs';
import { HEADER_ICONS } from './window-manager.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';

const UI_COPY = {
  zh: {
    title: '知识库',
    metaTop: '/ Knowledge Base v2.0',
    metaSub: '个人学习笔记 · 实践记录 · 资料收藏',
    searchPlaceholder: '搜索知识库',
    clearSearch: '清空搜索',
    close: '关闭窗口',
    pinned: '置顶',
    progress: (pct) => `阅读进度 ${pct}%`,
    loadMore: '加载更多',
    allLoaded: (n) => `已显示全部 ${n} 篇`,
    loading: '正在加载知识库...',
    empty: '没有找到匹配的文章',
    articlePending: (title) => `已选中「${title}」（文章阅读页将在下一窗口接入）`
  },
  en: {
    title: 'Knowledge',
    metaTop: '/ Knowledge Base v2.0',
    metaSub: 'Study Notes · Engineering Logs · Curated Docs',
    searchPlaceholder: 'Search knowledge base',
    clearSearch: 'Clear search',
    close: 'Close window',
    pinned: 'Pinned',
    progress: (pct) => `Reading ${pct}%`,
    loadMore: 'Load more',
    allLoaded: (n) => `Showing all ${n} articles`,
    loading: 'Loading knowledge base...',
    empty: 'No matching articles found',
    articlePending: (title) => `Selected "${title}" (Article Reader arrives in next window)`
  },
  ja: {
    title: '知識庫',
    metaTop: '/ Knowledge Base v2.0',
    metaSub: '学習ノート · 実践記録 · 資料アーカイブ',
    searchPlaceholder: '知識庫を検索',
    clearSearch: '検索をクリア',
    close: 'ウィンドウを閉じる',
    pinned: '固定',
    progress: (pct) => `読書進捗 ${pct}%`,
    loadMore: 'もっと見る',
    allLoaded: (n) => `全 ${n} 件を表示中`,
    loading: '知識庫を読み込み中...',
    empty: '一致する記事が見つかりませんでした',
    articlePending: (title) => `「${title}」を選択（記事リーダーは次のウィンドウで実装）`
  }
};

function createSearchSvg() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('class', 'kb-search-icon');
  svg.setAttribute('aria-hidden', 'true');
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', '8.5');
  circle.setAttribute('cy', '8.5');
  circle.setAttribute('r', '5.5');
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', 'currentColor');
  circle.setAttribute('stroke-width', '1.6');
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', '12.8');
  line.setAttribute('y1', '12.8');
  line.setAttribute('x2', '17.2');
  line.setAttribute('y2', '17.2');
  line.setAttribute('stroke', 'currentColor');
  line.setAttribute('stroke-width', '1.8');
  line.setAttribute('stroke-linecap', 'round');
  svg.appendChild(circle);
  svg.appendChild(line);
  return svg;
}

function createPinSvg() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('class', 'kb-pin-icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute(
    'd',
    'M12.6 2.8 L17.2 7.4 L15.6 9.0 L13.7 8.4 L10.7 11.4 L11.4 13.8 L10.0 15.2 L7.2 12.4 L3.4 16.6 L7.6 12.8 L4.8 10.0 L6.2 8.6 L8.6 9.3 L11.6 6.3 L11.0 4.4 Z'
  );
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  return svg;
}

function createChevronDownSvg() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 10');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '9');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M2 2.5 L7 7.5 L12 2.5');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.6');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  return svg;
}

// Persistent state across window open/close so category/search/scroll context stays intact
const persistentState = {
  category: 'all',
  searchTerm: '',
  visibleCountByContext: new Map(),
  scrollTopByContext: new Map()
};

function contextKey(category, searchTerm) {
  return `${category}::${normalizeKnowledgeSearchText(searchTerm)}`;
}

function articleMatchesTokens(item, tokens) {
  if (!tokens.length) return true;
  const parts = [
    getLocalizedField(item.title, 'zh'),
    getLocalizedField(item.title, 'en'),
    getLocalizedField(item.title, 'ja'),
    getLocalizedField(item.summary, 'zh'),
    getLocalizedField(item.summary, 'en'),
    getLocalizedField(item.summary, 'ja'),
    item.category,
    getCategoryLabel(item.category, 'zh'),
    getCategoryLabel(item.category, 'en'),
    getCategoryLabel(item.category, 'ja')
  ];
  if (Array.isArray(item.tags)) {
    for (const tag of item.tags) {
      parts.push(...getAllTagVariants(tag));
    }
  }
  const haystack = normalizeKnowledgeSearchText(parts.join(' '));
  return tokens.every((tok) => haystack.includes(tok));
}

export function createKnowledgeWindowView({ container, lang = 'zh', params = {}, close, openWindow }) {
  let currentLang = lang;
  let allArticles = [];
  let loaded = false;
  let mounted = true;
  let requestSerial = 0;
  const onOpenArticle = typeof params?.onOpenArticle === 'function' ? params.onOpenArticle : null;

  const copy = () => UI_COPY[currentLang] || UI_COPY.zh;

  // --- Header ---
  const header = document.createElement('header');
  header.className = 'crt-win-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'crt-win-title-group';
  titleGroup.appendChild(HEADER_ICONS.knowledge());

  const titleEl = document.createElement('h1');
  titleEl.className = 'crt-win-title';
  titleGroup.appendChild(titleEl);

  const divider = document.createElement('div');
  divider.className = 'crt-win-divider';

  const meta = document.createElement('div');
  meta.className = 'crt-win-meta';
  const metaTop = document.createElement('div');
  metaTop.className = 'crt-win-meta-top';
  const metaSub = document.createElement('div');
  metaSub.className = 'crt-win-meta-sub';
  meta.appendChild(metaTop);
  meta.appendChild(metaSub);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'crt-win-close-btn';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', close);

  header.appendChild(titleGroup);
  header.appendChild(divider);
  header.appendChild(meta);
  header.appendChild(closeBtn);
  container.appendChild(header);

  // --- Search bar ---
  const searchWrap = document.createElement('div');
  searchWrap.className = 'kb-search-wrap';
  searchWrap.appendChild(createSearchSvg());

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'kb-search-input';
  searchInput.autocomplete = 'off';
  searchInput.spellcheck = false;
  searchInput.value = persistentState.searchTerm;

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'kb-search-clear';
  clearBtn.textContent = '×';
  clearBtn.addEventListener('click', () => {
    saveCurrentScroll();
    persistentState.searchTerm = '';
    searchInput.value = '';
    updateClearBtn();
    renderAll({ restoreScroll: true });
    searchInput.focus();
  });

  searchWrap.appendChild(searchInput);
  searchWrap.appendChild(clearBtn);
  container.appendChild(searchWrap);

  // --- Category chips ---
  const chipsRow = document.createElement('div');
  chipsRow.className = 'kb-chips';
  chipsRow.setAttribute('role', 'tablist');
  container.appendChild(chipsRow);

  // --- Scrollable article list ---
  const listEl = document.createElement('div');
  listEl.className = 'kb-list';
  container.appendChild(listEl);

  // --- Footer pagination ---
  const footer = document.createElement('div');
  footer.className = 'kb-footer';
  const dotsLeft = document.createElement('span');
  dotsLeft.className = 'kb-footer-dots';
  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.type = 'button';
  loadMoreBtn.className = 'kb-load-more';
  const dotsRight = document.createElement('span');
  dotsRight.className = 'kb-footer-dots';
  footer.appendChild(dotsLeft);
  footer.appendChild(loadMoreBtn);
  footer.appendChild(dotsRight);
  container.appendChild(footer);

  // --- Status line (used until Article Reader window #2 is wired) ---
  const statusBar = document.createElement('div');
  statusBar.className = 'kb-status-bar';
  container.appendChild(statusBar);

  function saveCurrentScroll() {
    const key = contextKey(persistentState.category, persistentState.searchTerm);
    persistentState.scrollTopByContext.set(key, listEl.scrollTop);
  }

  function updateClearBtn() {
    clearBtn.classList.toggle('visible', persistentState.searchTerm.trim().length > 0);
  }

  function syncStaticCopy() {
    const c = copy();
    titleEl.textContent = c.title;
    metaTop.textContent = c.metaTop;
    metaSub.textContent = c.metaSub;
    searchInput.placeholder = c.searchPlaceholder;
    searchInput.setAttribute('aria-label', c.searchPlaceholder);
    clearBtn.setAttribute('aria-label', c.clearSearch);
    closeBtn.setAttribute('aria-label', c.close);
    closeBtn.title = c.close;
  }

  function articlesInCategory(cat) {
    if (cat === 'all') return allArticles;
    return allArticles.filter((item) => String(item?.category || '') === String(cat));
  }

  function getFilteredArticles() {
    const byCategory = articlesInCategory(persistentState.category);
    const tokens = knowledgeSearchTokens(persistentState.searchTerm);
    const matched = tokens.length
      ? byCategory.filter((item) => articleMatchesTokens(item, tokens))
      : byCategory;
    return sortKnowledgeArticles(matched);
  }

  function renderChips() {
    chipsRow.replaceChildren();
    const fixedCategories = ['ai', 'daily-ai-news', 'tool-radar', 'site-guides', 'note', 'site-updates'];
    const ordered = knowledgeCategoryValues(allArticles, {
      fixedCategories,
      firstCategory: 'ai',
      lastCategory: 'site-updates',
      labelFor: (cat) => getCategoryLabel(cat, currentLang)
    });

    const categories = ['all', ...ordered];
    for (const cat of categories) {
      const count = articlesInCategory(cat).length;
      if (cat !== 'all' && count === 0) continue;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kb-chip';
      btn.setAttribute('role', 'tab');
      const isActive = persistentState.category === cat;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');

      const nameSpan = document.createElement('span');
      nameSpan.textContent = getCategoryLabel(cat, currentLang);
      const countSpan = document.createElement('span');
      countSpan.className = 'kb-chip-count';
      countSpan.textContent = `(${count})`;

      btn.appendChild(nameSpan);
      btn.appendChild(countSpan);

      btn.addEventListener('click', () => {
        if (persistentState.category === cat) return;
        saveCurrentScroll();
        persistentState.category = cat;
        statusBar.textContent = '';
        renderAll({ restoreScroll: true });
      });

      chipsRow.appendChild(btn);
    }
  }

  function renderList({ restoreScroll = false } = {}) {
    const c = copy();
    listEl.replaceChildren();

    if (!loaded) {
      const loadingEl = document.createElement('div');
      loadingEl.className = 'kb-empty';
      loadingEl.textContent = c.loading;
      listEl.appendChild(loadingEl);
      footer.style.display = 'none';
      return;
    }

    const filtered = getFilteredArticles();
    const key = contextKey(persistentState.category, persistentState.searchTerm);
    const visibleCount = persistentState.visibleCountByContext.get(key) || PUBLIC_ARTICLE_PAGE_SIZE;

    if (filtered.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'kb-empty';
      emptyEl.textContent = c.empty;
      listEl.appendChild(emptyEl);
      footer.style.display = 'none';
      return;
    }

    const progressMap = loadReadingProgressMap();
    const slice = filtered.slice(0, visibleCount);

    for (const item of slice) {
      const isPinned = item.category !== 'site-updates' && Boolean(item.is_pinned);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'kb-item';
      if (isPinned) row.classList.add('is-pinned');

      const top = document.createElement('div');
      top.className = 'kb-item-top';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'kb-item-title-wrap';
      if (isPinned) {
        const pin = createPinSvg();
        pin.setAttribute('aria-label', c.pinned);
        titleWrap.appendChild(pin);
      }

      const titleText = getLocalizedField(item.title, currentLang);
      const titleSpan = document.createElement('span');
      titleSpan.className = 'kb-item-title';
      titleSpan.textContent = titleText;
      titleWrap.appendChild(titleSpan);

      const dateSpan = document.createElement('span');
      dateSpan.className = 'kb-item-date';
      dateSpan.textContent = formatDateISO(item.published_at || item.created_at);

      top.appendChild(titleWrap);
      top.appendChild(dateSpan);
      row.appendChild(top);

      // Deduplicated trilingual tags
      const catLabel = getCategoryLabel(item.category, currentLang);
      const tags = visibleArticleTags(item, (tag) => getTagLabel(tag, currentLang), catLabel);
      const displayTags = tags.length > 0 ? tags.slice(0, 4) : [catLabel];

      if (displayTags.length > 0) {
        const tagsWrap = document.createElement('div');
        tagsWrap.className = 'kb-item-tags';
        displayTags.forEach((tagText, idx) => {
          const pill = document.createElement('span');
          pill.className = idx === 0 ? 'kb-tag kb-tag-primary' : 'kb-tag';
          pill.textContent = tagText;
          tagsWrap.appendChild(pill);
        });
        row.appendChild(tagsWrap);
      }

      // Inline reading progress bar when progress > 0%
      const pct = Number(progressMap[item.slug] || 0);
      if (pct > 0) {
        const progWrap = document.createElement('div');
        progWrap.className = 'kb-progress-wrap';

        const progHead = document.createElement('div');
        progHead.className = 'kb-progress-head';
        const progLabel = document.createElement('span');
        progLabel.className = 'kb-progress-label';
        progLabel.textContent = c.progress(pct);
        progHead.appendChild(progLabel);

        const track = document.createElement('div');
        track.className = 'kb-progress-track';
        const fill = document.createElement('div');
        fill.className = 'kb-progress-fill';
        fill.style.width = `${Math.max(4, Math.min(100, pct))}%`;
        track.appendChild(fill);

        progWrap.appendChild(progHead);
        progWrap.appendChild(track);
        row.appendChild(progWrap);
      }

      row.addEventListener('click', () => {
        saveCurrentScroll();
        if (onOpenArticle) {
          onOpenArticle(item);
          return;
        }
        // Open Article Reader window if registered (Window #2), else display non-intrusive status
        const opened = openWindow('article', { article: item });
        if (!opened) {
          statusBar.textContent = c.articlePending(titleText);
        }
      });

      listEl.appendChild(row);
    }

    // Pagination footer
    footer.style.display = 'flex';
    loadMoreBtn.replaceChildren();
    const hasMore = filtered.length > visibleCount;
    if (hasMore) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.appendChild(createChevronDownSvg());
      const lbl = document.createElement('span');
      lbl.textContent = c.loadMore;
      loadMoreBtn.appendChild(lbl);
    } else {
      loadMoreBtn.disabled = true;
      const lbl = document.createElement('span');
      lbl.textContent = c.allLoaded(filtered.length);
      loadMoreBtn.appendChild(lbl);
    }

    if (restoreScroll) {
      const savedTop = persistentState.scrollTopByContext.get(key) || 0;
      window.requestAnimationFrame(() => {
        if (mounted) listEl.scrollTop = savedTop;
      });
    }
  }

  function renderAll({ restoreScroll = false } = {}) {
    syncStaticCopy();
    updateClearBtn();
    renderChips();
    renderList({ restoreScroll });
  }

  loadMoreBtn.addEventListener('click', () => {
    const key = contextKey(persistentState.category, persistentState.searchTerm);
    const current = persistentState.visibleCountByContext.get(key) || PUBLIC_ARTICLE_PAGE_SIZE;
    persistentState.visibleCountByContext.set(key, current + PUBLIC_ARTICLE_PAGE_SIZE);
    renderList({ restoreScroll: false });
  });

  searchInput.addEventListener('input', () => {
    saveCurrentScroll();
    persistentState.searchTerm = searchInput.value;
    updateClearBtn();
    renderList({ restoreScroll: true });
  });

  listEl.addEventListener('scroll', saveCurrentScroll, { passive: true });

  // Initial render + async load
  renderAll({ restoreScroll: false });
  const myReq = ++requestSerial;
  loadKnowledgeArticles().then((result) => {
    if (!mounted || myReq !== requestSerial) return;
    allArticles = Array.isArray(result?.items) ? result.items : [];
    loaded = true;
    renderAll({ restoreScroll: true });
  });

  return {
    setLang(nextLang) {
      currentLang = nextLang || 'zh';
      renderAll({ restoreScroll: false });
    },
    unmount() {
      saveCurrentScroll();
      mounted = false;
    }
  };
}
