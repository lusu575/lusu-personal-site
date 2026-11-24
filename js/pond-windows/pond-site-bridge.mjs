// Pure visual-presentation bridge for lusu575.com (Batch 1: Desktop Home + Knowledge List)
// Zero business-logic rewrites: all routing, API fetching, filtering, sorting, pinning,
// search, pagination, account sessions, and language switching stay 100% in existing main.js & routes/*.mjs.

import { PondCRTEngine } from '../pond-crt/engine.mjs?v=20261124-season-wavefront-r67';
import {
  resolveInitialPondSeason,
  saveManualSeasonOverride,
  startSeasonTimeSchedule
} from '../pond-crt/season-schedule.mjs?v=20261122-pond-live-fix-r1';
import { attachWelcomePilotButtons, getCrtGlassButtonPerfStats } from './crt-glass-button.mjs?v=20261123-pond-glass-r59';
import { PondWindowMorphController } from './crt-window-morph.mjs?v=20261124-window-morph-fix-r68';

function isMobileShell() {
  return document.documentElement.dataset.shell === 'mobile' || window.innerWidth <= 768;
}

function getCurrentSiteLang() {
  const docLang = (document.documentElement.lang || '').toLowerCase();
  if (docLang.startsWith('en')) return 'en';
  if (docLang.startsWith('ja')) return 'ja';
  return 'zh';
}

function isArticleDetailOpen() {
  const detail = document.getElementById('article-detail');
  if (detail && !detail.hidden) return true;
  if (/^\/articles\/[^/]+/i.test(window.location.pathname)) return true;
  if (/^#\/?knowledge\/[^/]+/i.test(window.location.hash)) return true;
  return false;
}

function isWelcomeModalOpen() {
  const modal = document.getElementById('welcome-modal');
  return Boolean(modal && !modal.hidden);
}

function triggerSiteRoute(routeId) {
  const target = document.querySelector(`[data-route="${routeId}"]`);
  if (target) {
    target.click();
    return;
  }
  window.location.hash = routeId === 'home' ? '#home' : `#${routeId}`;
}

const TOOL_SVG_MAP = [
  { match: 'whiteboard', src: '/assets/pond-windows/svg/icon-palette.svg?v=20261122-pond-polish-r14' },
  { match: 'quick-transfer', src: '/assets/pond-windows/svg/icon-transfer.svg?v=20261122-pond-polish-r14' },
  { match: 'japanese-subtext', src: '/assets/pond-windows/svg/icon-torii.svg?v=20261122-pond-polish-r14' }
];
const DOWNLOAD_SVGS = [
  '/assets/pond-windows/svg/icon-box.svg',
  '/assets/pond-windows/svg/icon-vr.svg',
  '/assets/pond-windows/svg/icon-layers.svg'
];

function applyToolsSvgPresentation() {
  const list = document.getElementById('resource-list');
  if (!list) return;
  let dlIdx = 0;
  list.querySelectorAll('.resource-card').forEach((card) => {
    if (card.dataset.pondSvgApplied === '1') return;
    const html = card.innerHTML;
    let svgSrc = '';
    for (const entry of TOOL_SVG_MAP) {
      if (html.includes(entry.match) || card.querySelector(`[href*="${entry.match}"]`)) {
        svgSrc = entry.src;
        card.classList.add('pond-tool-hero');
        break;
      }
    }
    if (!svgSrc && card.querySelector('[data-action="quick-transfer"], [data-quick-transfer]')) {
      svgSrc = '/assets/pond-windows/svg/icon-transfer.svg';
      card.classList.add('pond-tool-hero');
    }
    if (!svgSrc) {
      svgSrc = DOWNLOAD_SVGS[dlIdx % DOWNLOAD_SVGS.length];
      dlIdx += 1;
      card.classList.add('pond-tool-download');
    }
    const existingIcon = card.querySelector('.resource-icon-image, .resource-icon');
    if (existingIcon) {
      if (existingIcon.tagName === 'IMG') {
        existingIcon.loading = 'eager';
        existingIcon.src = svgSrc;
      } else {
        const img = document.createElement('img');
        img.className = 'resource-icon-image';
        img.loading = 'eager';
        img.src = svgSrc;
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        existingIcon.replaceWith(img);
      }
    }
    card.dataset.pondSvgApplied = '1';
  });
}

const GAME_COVER_MAP = [
  { match: 'kittens-game', src: '/assets/pond-windows/covers/cover-cat.webp?v=20261123-pond-polish-r56', kind: 'art' },
  { match: 'a-dark-room', src: '/assets/pond-windows/covers/cover-darkroom.webp?v=20261123-pond-polish-r56', kind: 'art' },
  { match: '2048', src: '/assets/pond-windows/covers/cover-2048.svg?v=20261123-pond-polish-r56', kind: 'svg' },
  { match: 'hextris', src: '/assets/pond-windows/covers/cover-hextris.svg?v=20261123-pond-polish-r56', kind: 'svg' },
  { match: 'life-restart', src: '/assets/pond-windows/covers/cover-restart.webp?v=20261123-pond-polish-r56', kind: 'art' }
];

function applyGamesCoverPresentation() {
  const list = document.getElementById('game-list');
  if (!list) return;
  list.querySelectorAll('.game-card').forEach((card) => {
    if (card.dataset.pondCoverApplied === '1') return;
    const html = card.innerHTML;
    const cover = card.querySelector('img.game-cover');
    if (cover) {
      for (const entry of GAME_COVER_MAP) {
        if (html.includes(entry.match) || (cover.src && cover.src.includes(entry.match))) {
          cover.loading = 'eager';
          cover.decoding = 'sync';
          cover.removeAttribute('loading');
          cover.src = entry.src;
          card.dataset.pondCoverKind = entry.kind;
          break;
        }
      }
    }
    card.dataset.pondCoverApplied = '1';
  });
}

const CHAT_AVATARS = [
  '/assets/pond-windows/svg/avatar-lotus.svg?v=20261122-pond-polish-r30',
  '/assets/pond-windows/svg/avatar-koi.svg?v=20261122-pond-polish-r30',
  '/assets/pond-windows/svg/avatar-moon.svg?v=20261122-pond-polish-r30',
  '/assets/pond-windows/svg/avatar-leaf.svg?v=20261122-pond-polish-r30',
  '/assets/pond-windows/svg/avatar-ripple.svg?v=20261122-pond-polish-r30',
  '/assets/pond-windows/svg/avatar-star.svg?v=20261122-pond-polish-r30'
];
let chatAvatarsPreloaded = false;
function preloadChatAvatars() {
  if (chatAvatarsPreloaded) return;
  chatAvatarsPreloaded = true;
  CHAT_AVATARS.forEach((src) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  });
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function applyChatAvatarPresentation() {
  preloadChatAvatars();
  const list = document.getElementById('chat-message-list');
  if (!list) return;
  list.querySelectorAll('.chat-message, .chat-item, article').forEach((msg) => {
    if (msg.dataset.pondAvatarApplied === '1') return;
    if (msg.classList.contains('content-state')) return;
    const authorNode = msg.querySelector('.chat-author, .chat-nickname, strong');
    const name = (authorNode?.textContent || 'visitor').trim();
    const avatarSrc = CHAT_AVATARS[hashString(name) % CHAT_AVATARS.length];
    const avatar = document.createElement('img');
    avatar.className = 'pond-chat-avatar';
    avatar.loading = 'eager';
    avatar.decoding = 'sync';
    avatar.src = avatarSrc;
    avatar.alt = '';
    avatar.setAttribute('aria-hidden', 'true');
    msg.prepend(avatar);
    msg.dataset.pondAvatarApplied = '1';
  });
}

function bindChatEnterToSend() {
  const input = document.getElementById('chat-message-input');
  if (!input || input.dataset.chatEnterBound === '1') return;
  input.dataset.chatEnterBound = '1';

  let isComposing = false;
  let lastCompositionEndMs = 0;

  input.addEventListener('compositionstart', () => {
    isComposing = true;
  });
  input.addEventListener('compositionend', () => {
    isComposing = false;
    lastCompositionEndMs = performance.now();
  });
  input.addEventListener('blur', () => {
    isComposing = false;
  });

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    // Hard IME guard: never submit or alter Enter while composing Chinese/Japanese/Korean candidates
    const imeActive = Boolean(
      e.isComposing
      || isComposing
      || e.keyCode === 229
      || (lastCompositionEndMs > 0 && performance.now() - lastCompositionEndMs < 80)
    );
    if (imeActive) return;

    // Shift+Enter: NEVER preventDefault; allow native newline and fall back only if host swallowed it
    if (e.shiftKey) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const prevVal = input.value;
      const start = typeof input.selectionStart === 'number' ? input.selectionStart : prevVal.length;
      const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : prevVal.length;
      window.setTimeout(() => {
        if (document.activeElement !== input) return;
        if (input.value !== prevVal) return; // Native browser newline already inserted
        const maxLen = input.maxLength;
        if (maxLen > 0 && (prevVal.length - (end - start) + 1) > maxLen) return;
        input.setRangeText('\n', start, end, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, 0);
      return;
    }

    // Other modified Enters (Ctrl/Meta/Alt+Enter): leave untouched
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    if (e.repeat) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    const form = document.getElementById('chat-form');
    if (!form) return;
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  });
}

function bootPondVisualBridge() {
  if (window.__pondVisualBridge) return;

  bindChatEnterToSend();

  // Root architectural cascade fix:
  // main.js lazily appends /css/routes/*.css and /css/transfer.css to document.head AFTER initial load.
  // Keep pond-windows.css pinned as the last stylesheet in <head> so Midnight Pond always wins cascade order.
  const keepPondStylesheetLast = () => {
    const pondLink = document.head.querySelector('link[rel="stylesheet"][href*="pond-windows.css"]');
    if (!pondLink) return;
    const links = document.head.querySelectorAll('link[rel="stylesheet"]');
    if (links.length > 0 && links[links.length - 1] !== pondLink) {
      document.head.appendChild(pondLink);
    }
  };
  keepPondStylesheetLast();
  new MutationObserver(keepPondStylesheetLast).observe(document.head, { childList: true });

  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'pond-visual-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');

  const canvas = document.createElement('canvas');
  canvas.id = 'pond-desktop-canvas';
  backdrop.appendChild(canvas);
  document.body.prepend(backdrop);

  let engine = null;
  let stopSchedule = null;
  let activeMode = '';
  let lastMobileRoute = '';
  let suppressNextOutsideClickUntil = 0;
  let bypassCloseIntercept = false;
  const windowMorph = new PondWindowMorphController();

  function closeWindowAnimated(mode, finishFn) {
    if (!mode || mode === 'home') {
      if (typeof finishFn === 'function') finishFn();
      return;
    }
    if (windowMorph.isClosingMode(mode)) return;
    windowMorph.startClose(mode, () => {
      bypassCloseIntercept = true;
      try {
        if (typeof finishFn === 'function') finishFn();
      } finally {
        bypassCloseIntercept = false;
      }
    });
  }

  window.__pondMorphDebug = {
    getState: () => windowMorph.getState(),
    getPerfStats: () => windowMorph.getPerfStats()
  };

  function openAccountPopoverFromPond() {
    const trigger = document.querySelector('#account-widget [data-account-toggle], #account-widget .account-button, #account-menu-trigger');
    if (!trigger) return;
    suppressNextOutsideClickUntil = performance.now() + 320;
    window.setTimeout(() => {
      trigger.click();
      const firstInput = document.querySelector('#account-popover:not([hidden]) input:not([type="hidden"])');
      if (firstInput) firstInput.focus({ preventScroll: true });
    }, 0);
  }

  function syncRealTimeWelcomeGreeting() {
    const line = document.querySelector('#welcome-modal .welcome-greeting-line');
    if (!line) return;
    const h = new Date().getHours();
    const lang = getCurrentSiteLang();
    const bucket = h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 14 ? 'noon' : h >= 14 && h < 18 ? 'afternoon' : 'evening';
    const copy = {
      zh: { morning: '早上好', noon: '中午好', afternoon: '下午好', evening: '晚上好' },
      en: { morning: 'Good morning', noon: 'Good midday', afternoon: 'Good afternoon', evening: 'Good evening' },
      ja: { morning: 'おはようございます', noon: 'こんにちは', afternoon: 'こんにちは', evening: 'こんばんは' }
    };
    line.textContent = (copy[lang] || copy.zh)[bucket];
  }

  function openWelcomeFromPond() {
    const trigger = document.querySelector('[data-open-welcome]');
    if (!trigger) return;
    suppressNextOutsideClickUntil = performance.now() + 320;
    window.setTimeout(() => {
      windowMorph.prepareOpenMount('welcome');
      trigger.click();
      window.requestAnimationFrame(syncRealTimeWelcomeGreeting);
    }, 0);
  }

  function checkWelcomeHash() {
    if (window.location.hash.toLowerCase() === '#welcome' && !isWelcomeModalOpen()) {
      openWelcomeFromPond();
    }
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (engine) engine.stop();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (engine && activeMode) {
      engine.resize();
      engine.start();
    }
  });

  function ensureEngine() {
    if (engine) return engine;
    const { season, isPreview } = resolveInitialPondSeason(window.location.search);
    const initialRoute = document.body.dataset.route || 'home';
    const shouldSkipBoot = initialRoute !== 'home' || isMobileShell();
    if (shouldSkipBoot) {
      document.documentElement.dataset.pondBoot = 'done';
      document.documentElement.dataset.pondBootWebgl = 'ready';
    }
    engine = new PondCRTEngine(canvas, {
      season,
      lang: getCurrentSiteLang(),
      skipBoot: shouldSkipBoot,
      demoClock: new URLSearchParams(window.location.search).get('demoClock') === '1',
      preserveDrawingBuffer: new URLSearchParams(window.location.search).get('capture') === '1',
      onBootFirstFrame: () => {
        document.documentElement.dataset.pondBootWebgl = 'ready';
      },
      onBootComplete: () => {
        document.documentElement.dataset.pondBoot = 'done';
        document.documentElement.dataset.pondBootWebgl = 'ready';
      },
      onNavigate: (route, id) => {
        const iconId = id || String(route || '').replace(/^#/, '') || 'home';
        if (iconId !== 'home') {
          if (windowMorph.isOpeningMode(iconId)) return; // Prevent duplicate launch
          if (activeMode === iconId && windowMorph.isClosingMode(iconId)) {
            // Re-clicked same icon mid-close: seamlessly reverse from live visual rect
            suppressNextOutsideClickUntil = performance.now() + 320;
            windowMorph.startOpen(iconId);
            return;
          }
          if (activeMode === iconId) return;
          suppressNextOutsideClickUntil = performance.now() + 320;
          windowMorph.prepareOpenMount(iconId);
        }
        triggerSiteRoute(iconId);
      },
      onAccountClick: () => {
        openAccountPopoverFromPond();
      },
      onWelcomeClick: () => {
        openWelcomeFromPond();
      },
      onLanguageChange: (lang) => {
        const langBtn = document.querySelector(`[data-lang="${lang}"]`);
        if (langBtn) langBtn.click();
      },
      onSeasonChange: (nextSeason, { manual } = {}) => {
        if (manual) saveManualSeasonOverride(nextSeason);
      }
    });
    stopSchedule = startSeasonTimeSchedule({
      isPreview,
      onAutoSeasonChange: (nextSeason) => {
        if (engine) engine.setSeason(nextSeason, 0.86, 0.072, { manual: false });
      }
    });
    const skipActiveBoot = () => {
      if (engine && engine.bootActive) engine.skipBoot();
    };
    window.addEventListener('pointerdown', skipActiveBoot, { passive: true });
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' || ev.key === ' ') skipActiveBoot();
    });
    return engine;
  }

  function syncVisualMode() {
    const route = document.body.dataset.route || 'home';
    const prevMode = activeMode;
    let nextMode = '';
    if (!isMobileShell()) {
      if (isWelcomeModalOpen()) {
        nextMode = 'welcome';
      } else if (route === 'home') {
        nextMode = 'home';
      } else if (route === 'knowledge') {
        nextMode = isArticleDetailOpen() ? 'article' : 'knowledge';
      } else if (route === 'videos') {
        nextMode = 'videos';
      } else if (route === 'resources') {
        nextMode = 'resources';
      } else if (route === 'games') {
        nextMode = 'games';
      } else if (route === 'chatroom') {
        nextMode = 'chatroom';
      } else if (route === 'about') {
        nextMode = 'about';
      }
    }

    if (nextMode) {
      const eng = ensureEngine();
      document.documentElement.dataset.pondMode = nextMode;
      eng.setLanguage(getCurrentSiteLang());
      if (!activeMode) {
        eng.resize();
        eng.start();
      }
      if (nextMode === 'resources') {
        window.requestAnimationFrame(applyToolsSvgPresentation);
      } else if (nextMode === 'games') {
        window.requestAnimationFrame(applyGamesCoverPresentation);
      } else if (nextMode === 'chatroom') {
        window.requestAnimationFrame(applyChatAvatarPresentation);
      } else if (nextMode === 'about') {
        window.requestAnimationFrame(() => {
          document.querySelectorAll('#about img').forEach((img) => {
            img.loading = 'eager';
            img.removeAttribute('loading');
            if (!img.complete || img.naturalWidth === 0) {
              const s = img.getAttribute('src');
              if (s) {
                img.src = s;
              }
            }
          });
        });
      }
      activeMode = nextMode;
      const isInnerKnowledgeSwap = (prevMode === 'knowledge' && nextMode === 'article')
        || (prevMode === 'article' && nextMode === 'knowledge');
      if (prevMode && prevMode !== nextMode) {
        if (nextMode === 'home') {
          windowMorph.syncScrimImmediate(false);
        } else if (!isInnerKnowledgeSwap) {
          windowMorph.startOpen(nextMode);
        }
      } else if (!prevMode) {
        windowMorph.syncScrimImmediate(nextMode !== 'home');
      }
    } else if (activeMode) {
      delete document.documentElement.dataset.pondMode;
      windowMorph.cancel();
      windowMorph.syncScrimImmediate(false);
      if (engine) engine.stop();
      activeMode = '';
    }

    if (isMobileShell()) {
      const prevMobile = lastMobileRoute;
      lastMobileRoute = route;
      if (prevMobile && prevMobile !== route && route !== 'home') {
        windowMorph.startOpen(route);
      }
    } else {
      lastMobileRoute = '';
    }
  }

  const observer = new MutationObserver(() => syncVisualMode());
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-route'] });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'data-shell'] });

  const detailEl = document.getElementById('article-detail');
  if (detailEl) {
    observer.observe(detailEl, { attributes: true, attributeFilter: ['hidden', 'class'] });
  }
  const welcomeEl = document.getElementById('welcome-modal');
  if (welcomeEl) {
    observer.observe(welcomeEl, { attributes: true, attributeFilter: ['hidden'] });
  }
  const resourceListEl = document.getElementById('resource-list');
  if (resourceListEl) {
    new MutationObserver(() => {
      if (activeMode === 'resources') applyToolsSvgPresentation();
    }).observe(resourceListEl, { childList: true });
  }
  const gameListEl = document.getElementById('game-list');
  if (gameListEl) {
    new MutationObserver(() => {
      if (activeMode === 'games') applyGamesCoverPresentation();
    }).observe(gameListEl, { childList: true });
  }
  const chatListEl = document.getElementById('chat-message-list');
  if (chatListEl) {
    new MutationObserver(() => {
      if (activeMode === 'chatroom') applyChatAvatarPresentation();
    }).observe(chatListEl, { childList: true });
  }

  // Prevent the canvas click following pointerdown on the bottom-left ID button from triggering main.js outside-click close
  document.addEventListener('click', (e) => {
    if (performance.now() < suppressNextOutsideClickUntil && (e.target === canvas || e.target === backdrop)) {
      e.stopImmediatePropagation();
    }
  }, true);

  // Step 7: Intercept window close button & welcome close clicks so content fades first and shell contracts back to re-measured icon
  document.addEventListener('click', (e) => {
    if (bypassCloseIntercept) return;
    const closeWelcomeBtn = e.target?.closest?.('#welcome-modal [data-close-welcome]');
    if (closeWelcomeBtn && isWelcomeModalOpen()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeWindowAnimated('welcome', () => closeWelcomeBtn.click());
      return;
    }
    const closeWinBtn = e.target?.closest?.('.xp-window .close-button[data-route="home"]');
    if (closeWinBtn) {
      const modeToClose = isMobileShell() ? (document.body.dataset.route || 'home') : activeMode;
      if (modeToClose && modeToClose !== 'home' && modeToClose !== 'article') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeWindowAnimated(modeToClose, () => triggerSiteRoute('home'));
      }
    }
  }, true);

  // Clicking outside the skinned window returns to parent view via Matched Geometry close
  document.addEventListener('click', (e) => {
    if (e.target !== canvas && e.target !== backdrop) return;
    if (performance.now() < suppressNextOutsideClickUntil) return;
    const acctPop = document.getElementById('account-popover');
    if (acctPop && !acctPop.hidden) return;
    if (activeMode === 'article') {
      const backBtn = document.querySelector('[data-article-back]');
      if (backBtn) backBtn.click();
      else triggerSiteRoute('knowledge');
      return;
    }
    if (activeMode === 'knowledge' || activeMode === 'videos' || activeMode === 'resources' || activeMode === 'games' || activeMode === 'chatroom' || activeMode === 'about') {
      closeWindowAnimated(activeMode, () => triggerSiteRoute('home'));
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (activeMode === 'welcome' && isWelcomeModalOpen()) {
      const closeBtn = document.querySelector('#welcome-modal .close-button[data-close-welcome]');
      if (closeBtn) {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeWindowAnimated('welcome', () => closeBtn.click());
      }
      return;
    }
    if (activeMode === 'article') {
      const backBtn = document.querySelector('[data-article-back]');
      if (backBtn) backBtn.click();
      else triggerSiteRoute('knowledge');
      return;
    }
    if (activeMode === 'videos') {
      const modal = document.getElementById('video-modal');
      if (modal && !modal.hidden) return;
      closeWindowAnimated(activeMode, () => triggerSiteRoute('home'));
      return;
    }
    if (activeMode === 'resources') {
      const qtModal = document.getElementById('quick-transfer-modal');
      if (qtModal && !qtModal.hidden) return;
      closeWindowAnimated(activeMode, () => triggerSiteRoute('home'));
      return;
    }
    if (activeMode === 'games' || activeMode === 'chatroom' || activeMode === 'about') {
      const privForm = document.getElementById('chat-private-room-form');
      if (activeMode === 'chatroom' && privForm && !privForm.hidden) return;
      closeWindowAnimated(activeMode, () => triggerSiteRoute('home'));
      return;
    }
    if (activeMode === 'knowledge') {
      const searchInput = document.getElementById('knowledge-search-input');
      if (document.activeElement === searchInput && searchInput.value) return;
      closeWindowAnimated(activeMode, () => triggerSiteRoute('home'));
    }
  }, true);

  // Sync article reading progress bar & ~1-screen Back-to-Top visibility with Pond's scrollable .article-detail-card
  function syncPondArticleScrollState() {
    if (activeMode !== 'article') return;
    const card = document.querySelector('#article-detail .article-detail-card');
    const detail = document.getElementById('article-detail');
    const scroller = (card && card.scrollHeight > card.clientHeight + 4) ? card : detail;
    if (!scroller) return;
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const pct = maxScroll > 0
      ? Math.min(100, Math.max(0, Math.round((scroller.scrollTop / maxScroll) * 100)))
      : 0;
    const fill = document.getElementById('article-read-progress-fill');
    const value = document.getElementById('article-read-progress-value');
    const bar = document.getElementById('article-read-progress-bar');
    const topBtn = document.querySelector('[data-article-scroll-top]');
    if (fill) fill.style.transform = `scaleX(${pct / 100})`;
    if (value) value.textContent = `${pct}%`;
    if (bar) {
      bar.setAttribute('aria-valuenow', String(pct));
      bar.style.setProperty('--article-progress', String(pct));
    }
    const threshold = Math.min(360, Math.max(220, Math.round(scroller.clientHeight * 0.7)));
    const hideTop = scroller.scrollTop < threshold;
    if (topBtn) {
      topBtn.classList.toggle('is-at-article-top', hideTop);
      topBtn.toggleAttribute('hidden', hideTop);
    }
  }

  const articleCardEl = document.querySelector('#article-detail .article-detail-card');
  if (articleCardEl) {
    articleCardEl.addEventListener('scroll', syncPondArticleScrollState, { passive: true });
  }
  const articleDetailEl = document.getElementById('article-detail');
  if (articleDetailEl) {
    articleDetailEl.addEventListener('scroll', syncPondArticleScrollState, { passive: true });
    new MutationObserver(() => {
      if (activeMode === 'article') window.requestAnimationFrame(syncPondArticleScrollState);
    }).observe(articleDetailEl, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: false });
  }
  document.addEventListener('click', (e) => {
    if (e.target?.closest?.('[data-article-scroll-top]')) {
      const card = document.querySelector('#article-detail .article-detail-card');
      if (card && card.scrollTop > 0) {
        card.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    const tocBtn = e.target?.closest?.('.article-toc-link[data-article-heading-target]');
    if (!tocBtn) return;
    const targetId = tocBtn.dataset.articleHeadingTarget || tocBtn.getAttribute('aria-controls');
    if (!targetId) return;
    const card = document.querySelector('#article-detail .article-detail-card');
    const heading = document.getElementById(targetId);
    if (!card || !heading || !card.contains(heading)) return;
    const targetTop = Math.max(0, card.scrollTop + heading.getBoundingClientRect().top - card.getBoundingClientRect().top - 20);
    card.scrollTo({ top: targetTop, behavior: 'smooth' });
    document.querySelectorAll('#article-detail-toc .article-toc-link').forEach((btn) => {
      const isMatch = btn === tocBtn;
      btn.classList.toggle('is-active', isMatch);
      if (isMatch) btn.setAttribute('aria-current', 'location');
      else btn.removeAttribute('aria-current');
    });
    window.requestAnimationFrame(syncPondArticleScrollState);
  });

  // Sync Games shelf overall Cloud Save status banner + Chatroom explicit sync state label
  function syncGamesCloudBanner() {
    const gamesWin = document.querySelector('#games .xp-window');
    const gameList = document.getElementById('game-list');
    if (!gamesWin || !gameList) return;
    let banner = document.getElementById('pond-games-cloud-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'pond-games-cloud-banner';
      banner.className = 'pond-games-cloud-banner';
      gameList.parentNode.insertBefore(banner, gameList);
    }
    const lang = getCurrentSiteLang();
    const acctBtn = document.querySelector('#account-widget .account-button, #account-menu-trigger');
    const signedIn = Boolean(
      document.body.dataset.accountSignedIn === 'true'
      || document.querySelector('#account-popover [data-account-logout]:not([hidden])')
      || (acctBtn && acctBtn.dataset.signedIn === 'true')
    );
    banner.dataset.signedIn = signedIn ? '1' : '0';
    banner.textContent = signedIn
      ? (lang === 'en' ? '☁ Cloud Saves: Signed in & auto-syncing' : lang === 'ja' ? '☁ クラウドセーブ：ログイン中・自動同期オン' : '☁ 云存档状态：已登录 · 自动同步中')
      : (lang === 'en' ? '☁ Cloud Saves: Local save mode (Sign in via bottom-left ID to enable cloud sync)' : lang === 'ja' ? '☁ クラウドセーブ：ローカル保存中（左下 ID からログインで同期）' : '☁ 云存档状态：当前为本地存档（点击左下角 ID 登录后开启自动云同步）');
  }

  function syncChatExplicitState() {
    const el = document.getElementById('chat-sync-status');
    if (!el) return;
    const state = el.getAttribute('data-connection-state') || 'online';
    const lang = getCurrentSiteLang();
    const prefix = state === 'offline'
      ? (lang === 'en' ? 'Offline · ' : lang === 'ja' ? '切断 · ' : '连接断开 · ')
      : state === 'reconnecting'
        ? (lang === 'en' ? 'Reconnecting · ' : lang === 'ja' ? '再接続中 · ' : '重连中 · ')
        : (lang === 'en' ? 'Synced · ' : lang === 'ja' ? '同期済 · ' : '已同步 · ');
    el.dataset.syncPrefix = prefix;
  }

  const chatSyncEl = document.getElementById('chat-sync-status');
  if (chatSyncEl) {
    new MutationObserver(syncChatExplicitState).observe(chatSyncEl, { attributes: true, attributeFilter: ['data-connection-state'] });
    syncChatExplicitState();
  }

  const welcomeModalObs = document.getElementById('welcome-modal');
  if (welcomeModalObs) {
    attachWelcomePilotButtons();
    new MutationObserver(() => {
      if (!welcomeModalObs.hidden) {
        attachWelcomePilotButtons();
        window.requestAnimationFrame(syncRealTimeWelcomeGreeting);
      }
    }).observe(welcomeModalObs, { attributes: true, attributeFilter: ['hidden'] });
  }

  new MutationObserver(() => {
    syncGamesCloudBanner();
    syncChatExplicitState();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'data-pond-mode'] });
  syncGamesCloudBanner();

  window.addEventListener('hashchange', () => {
    syncVisualMode();
    checkWelcomeHash();
  });
  window.addEventListener('popstate', syncVisualMode);
  window.addEventListener('resize', () => {
    syncVisualMode();
    if (activeMode && engine) engine.resize();
  });

  window.__pondVisualBridge = {
    syncVisualMode,
    openWelcomeFromPond,
    getEngine: () => engine,
    getGlassButtonPerfStats: getCrtGlassButtonPerfStats,
    getWindowMorphState: () => windowMorph.getState(),
    getWindowMorphPerfStats: () => windowMorph.getPerfStats()
  };

  window.requestAnimationFrame(() => {
    syncVisualMode();
    checkWelcomeHash();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootPondVisualBridge, { once: true });
} else {
  bootPondVisualBridge();
}
