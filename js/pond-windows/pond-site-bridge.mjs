// Pure visual-presentation bridge for lusu575.com (Batch 1: Desktop Home + Knowledge List)
// Zero business-logic rewrites: all routing, API fetching, filtering, sorting, pinning,
// search, pagination, account sessions, and language switching stay 100% in existing main.js & routes/*.mjs.

import { PondCRTEngine } from '../pond-crt/engine.mjs';
import {
  resolveInitialPondSeason,
  saveManualSeasonOverride,
  startSeasonTimeSchedule
} from '../pond-crt/season-schedule.mjs';

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

function bootPondVisualBridge() {
  if (window.__pondVisualBridge) return;

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
        const trigger = document.getElementById('account-menu-trigger');
        if (trigger) trigger.click();
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
    if (!isMobileShell() && !isWelcomeModalOpen()) {
      if (route === 'home') {
        nextMode = 'home';
      } else if (route === 'knowledge' && !isArticleDetailOpen()) {
        nextMode = 'knowledge';
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

  // Clicking outside the skinned Knowledge window returns to Home desktop
  document.addEventListener('click', (e) => {
    if (activeMode !== 'knowledge') return;
    if (e.target === canvas || e.target === backdrop) {
      triggerSiteRoute('home');
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeMode === 'knowledge') {
      const searchInput = document.getElementById('knowledge-search-input');
      if (document.activeElement === searchInput && searchInput.value) return;
      triggerSiteRoute('home');
    }
  });

  window.addEventListener('hashchange', syncVisualMode);
  window.addEventListener('popstate', syncVisualMode);
  window.addEventListener('resize', () => {
    syncVisualMode();
    if (activeMode && engine) engine.resize();
  });

  window.__pondVisualBridge = {
    syncVisualMode,
    getEngine: () => engine
  };

  window.requestAnimationFrame(syncVisualMode);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootPondVisualBridge, { once: true });
} else {
  bootPondVisualBridge();
}
