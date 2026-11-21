// Shared CRT Window Shell Manager for all 9 pond-gl-prototype windows
// Reuses the unified phosphor-dot aesthetic, Escape/outside-click close, and trilingual sync

const SVG_NS = 'http://www.w3.org/2000/svg';

function createBookDotIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 48 40');
  svg.setAttribute('class', 'crt-win-icon');
  svg.setAttribute('aria-hidden', 'true');

  // Open book dotted outline matching home desktop "knowledge" icon
  const paths = [
    'M6 8 C12 6, 19 6, 24 10 L24 33 C19 29, 12 29, 6 31 Z',
    'M42 8 C36 6, 29 6, 24 10 L24 33 C29 29, 36 29, 42 31 Z'
  ];
  for (const d of paths) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', '#e4faf5');
    p.setAttribute('stroke-width', '2.1');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    p.setAttribute('stroke-dasharray', '0.5 3.6');
    svg.appendChild(p);
  }
  return svg;
}

export const HEADER_ICONS = {
  knowledge: createBookDotIcon
};

export class CRTWindowManager {
  constructor({ onOpenChange = null } = {}) {
    this.onOpenChange = onOpenChange;
    this.activeId = null;
    this.activeView = null;
    this.lang = 'zh';
    this.views = new Map();

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'crt-win-backdrop';
    this.backdrop.setAttribute('role', 'dialog');
    this.backdrop.setAttribute('aria-modal', 'true');

    this.scrim = document.createElement('div');
    this.scrim.className = 'crt-win-scrim';
    this.scrim.addEventListener('click', () => this.close());

    this.frame = document.createElement('div');
    this.frame.className = 'crt-win-frame';

    this.inner = document.createElement('div');
    this.inner.className = 'crt-win-inner';

    this.frame.appendChild(this.inner);
    this.backdrop.appendChild(this.scrim);
    this.backdrop.appendChild(this.frame);
    document.body.appendChild(this.backdrop);

    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this.activeId) {
        e.preventDefault();
        this.close();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  register(id, viewFactory) {
    this.views.set(id, viewFactory);
  }

  setLang(lang) {
    this.lang = lang || 'zh';
    if (this.activeView && typeof this.activeView.setLang === 'function') {
      this.activeView.setLang(this.lang);
    }
  }

  open(id, params = {}) {
    const factory = this.views.get(id);
    if (!factory) return false;

    if (this.activeView && typeof this.activeView.unmount === 'function') {
      this.activeView.unmount();
    }
    this.inner.replaceChildren();
    this.frame.dataset.windowId = id;

    this.activeId = id;
    this.activeView = factory({
      container: this.inner,
      lang: this.lang,
      params,
      close: () => this.close(),
      openWindow: (nextId, nextParams) => this.open(nextId, nextParams)
    });

    this.backdrop.classList.add('open');
    if (typeof this.onOpenChange === 'function') {
      this.onOpenChange(id);
    }
    return true;
  }

  close() {
    if (!this.activeId) return;
    if (this.activeView && typeof this.activeView.unmount === 'function') {
      this.activeView.unmount();
    }
    this.activeId = null;
    this.activeView = null;
    this.inner.replaceChildren();
    this.backdrop.classList.remove('open');
    if (typeof this.onOpenChange === 'function') {
      this.onOpenChange(null);
    }
  }

  isOpen() {
    return Boolean(this.activeId);
  }
}
