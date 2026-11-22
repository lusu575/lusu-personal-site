// Pure visual-presentation bridge for lusu575.com (Batch 1: Desktop Home + Knowledge List)
// Zero business-logic rewrites: all routing, API fetching, filtering, sorting, pinning,
// search, pagination, account sessions, and language switching stay 100% in existing main.js & routes/*.mjs.

import { PondCRTEngine } from '../pond-crt/engine.mjs?v=20261123-pond-polish-r37';
import {
  resolveInitialPondSeason,
  saveManualSeasonOverride,
  startSeasonTimeSchedule
} from '../pond-crt/season-schedule.mjs?v=20261122-pond-live-fix-r1';

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
  { match: 'kittens-game', src: '/assets/pond-windows/covers/cover-cat.png', kind: 'art' },
  { match: 'a-dark-room', src: '/assets/pond-windows/covers/cover-darkroom.png', kind: 'art' },
  {
    match: '2048',
    src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect x='8' y='8' width='48' height='48' rx='7' fill='rgba(12,34,40,0.75)' stroke='%239cf6e8' stroke-width='2' stroke-dasharray='1 3'/%3E%3Crect x='64' y='8' width='48' height='48' rx='7' fill='rgba(18,44,48,0.75)' stroke='%239ce2f6' stroke-width='2' stroke-dasharray='1 3'/%3E%3Crect x='8' y='64' width='48' height='48' rx='7' fill='rgba(36,30,48,0.75)' stroke='%23f6b888' stroke-width='2' stroke-dasharray='1 3'/%3E%3Crect x='64' y='64' width='48' height='48' rx='7' fill='rgba(48,26,42,0.75)' stroke='%23ff9898' stroke-width='2' stroke-dasharray='1 3'/%3E%3Ctext x='32' y='40' text-anchor='middle' fill='%23eefcf9' font-family='monospace' font-size='22'%3E2%3C/text%3E%3Ctext x='88' y='40' text-anchor='middle' fill='%23eefcf9' font-family='monospace' font-size='22'%3E4%3C/text%3E%3Ctext x='32' y='96' text-anchor='middle' fill='%23ffddb4' font-family='monospace' font-size='22'%3E8%3C/text%3E%3Ctext x='88' y='96' text-anchor='middle' fill='%23ffb8b8' font-family='monospace' font-size='20'%3E16%3C/text%3E%3C/svg%3E",
    kind: 'svg'
  },
  {
    match: 'hextris',
    src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cdefs%3E%3CradialGradient id='g' cx='50%25' cy='50%25' r='55%25'%3E%3Cstop offset='0%25' stop-color='%23184c56'/%3E%3Cstop offset='100%25' stop-color='%23051418'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='120' height='120' rx='10' fill='url(%23g)'/%3E%3Cpolygon points='60,10 103,35 103,85 60,110 17,85 17,35' fill='none' stroke='%235ef4d8' stroke-width='2.2' stroke-dasharray='2 4' opacity='0.75'/%3E%3Cpath d='M60,18 L96,39' stroke='%23ff6ec7' stroke-width='6' stroke-linecap='round'/%3E%3Cpath d='M96,39 L96,81' stroke='%2368d8ff' stroke-width='6' stroke-linecap='round'/%3E%3Cpath d='M96,81 L60,102' stroke='%23ffe66d' stroke-width='6' stroke-linecap='round'/%3E%3Cpath d='M60,102 L24,81' stroke='%235ef4a8' stroke-width='6' stroke-linecap='round'/%3E%3Cpath d='M24,81 L24,39' stroke='%23be8eff' stroke-width='6' stroke-linecap='round'/%3E%3Cpath d='M24,39 L60,18' stroke='%23ff9e5e' stroke-width='6' stroke-linecap='round'/%3E%3Cpolygon points='60,34 82,47 82,73 60,86 38,73 38,47' fill='rgba(12,42,50,0.82)' stroke='%239ef8ec' stroke-width='2.2'/%3E%3Cpolygon points='60,46 72,53 72,67 60,74 48,67 48,53' fill='rgba(110,248,228,0.28)' stroke='%23ffe680' stroke-width='2'/%3E%3C/svg%3E",
    kind: 'svg'
  },
  { match: 'life-restart', src: '/assets/pond-windows/covers/cover-restart.png', kind: 'art' }
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

function bootPondVisualBridge() {
  if (window.__pondVisualBridge) return;

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
  let suppressNextOutsideClickUntil = 0;

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

  function openWelcomeFromPond() {
    const trigger = document.querySelector('[data-open-welcome]');
    if (!trigger) return;
    suppressNextOutsideClickUntil = performance.now() + 320;
    window.setTimeout(() => {
      trigger.click();
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
    engine = new PondCRTEngine(canvas, {
      season,
      lang: getCurrentSiteLang(),
      demoClock: new URLSearchParams(window.location.search).get('demoClock') === '1',
      preserveDrawingBuffer: new URLSearchParams(window.location.search).get('capture') === '1',
      onNavigate: (route, id) => {
        triggerSiteRoute(id || String(route || '').replace(/^#/, '') || 'home');
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
    return engine;
  }

  function syncVisualMode() {
    const route = document.body.dataset.route || 'home';
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
    } else if (activeMode) {
      delete document.documentElement.dataset.pondMode;
      if (engine) engine.stop();
      activeMode = '';
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

  // Clicking outside the skinned window returns to parent view
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
      triggerSiteRoute('home');
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (activeMode === 'article') {
      const backBtn = document.querySelector('[data-article-back]');
      if (backBtn) backBtn.click();
      else triggerSiteRoute('knowledge');
      return;
    }
    if (activeMode === 'videos') {
      const modal = document.getElementById('video-modal');
      if (modal && !modal.hidden) return;
      triggerSiteRoute('home');
      return;
    }
    if (activeMode === 'resources') {
      const qtModal = document.getElementById('quick-transfer-modal');
      if (qtModal && !qtModal.hidden) return;
      triggerSiteRoute('home');
      return;
    }
    if (activeMode === 'games' || activeMode === 'chatroom' || activeMode === 'about') {
      const privForm = document.getElementById('chat-private-room-form');
      if (activeMode === 'chatroom' && privForm && !privForm.hidden) return;
      triggerSiteRoute('home');
      return;
    }
    if (activeMode === 'knowledge') {
      const searchInput = document.getElementById('knowledge-search-input');
      if (document.activeElement === searchInput && searchInput.value) return;
      triggerSiteRoute('home');
    }
  });

  // Make bottom taskbar clock clickable to open Welcome & Recent Updates
  const taskbarClock = document.getElementById('local-time');
  if (taskbarClock) {
    taskbarClock.setAttribute('role', 'button');
    taskbarClock.setAttribute('tabindex', '0');
    taskbarClock.title = '欢迎与最近更新';
    taskbarClock.addEventListener('click', () => openWelcomeFromPond());
    taskbarClock.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openWelcomeFromPond();
      }
    });
  }

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
    getEngine: () => engine
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
