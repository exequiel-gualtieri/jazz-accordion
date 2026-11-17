import { INHERITED } from './item.js';
import { accordionStyles, highlightStyles } from './styles.js';
import { ITEM_TAG, adoptStyles, debounce, h, normalizeText, storage } from './utils.js';

const TOOLBAR_ATTRS = [
  'search',
  'controls',
  'search-label',
  'search-placeholder',
  'expand-label',
  'collapse-label',
  'results-label',
  'no-results-label',
];

const DEFAULT_TEXT = {
  'search-label': 'Search',
  'search-placeholder': 'Search…',
  'expand-label': 'Expand all',
  'collapse-label': 'Collapse all',
  'results-label': '{count} results',
  'no-results-label': 'No results',
};

const HIGHLIGHT_NAME = 'jazz-accordion-match';
let highlightSheetInstalled = false;

/**
 * <jazz-accordion>
 *
 * Groups <jazz-accordion-item> children and coordinates them.
 *
 * @attr multiple           Allow several open panels at once.
 * @attr always-open        Keep at least one panel open.
 * @attr theme              Theme name, e.g. theme="hud" (load its CSS).
 * @attr indicator          chevron | plus | arrow | none
 * @attr indicator-position start | end
 * @attr heading-level      1–6 (default 3)
 * @attr print              expanded | collapsed | as-is (default expanded)
 * @attr no-animation       Disable height animation.
 * @attr search             Render a filter box.
 * @attr controls           Render "Expand all / Collapse all" (multiple mode).
 * @attr deep-link          Open the item targeted by the URL #hash.
 * @attr persist="key"      Remember open items in localStorage.
 * @attr faq-schema         Emit schema.org FAQPage JSON-LD (SEO).
 *
 * @fires jazz-filter - After a search. detail: { query, count }
 */
export class JazzAccordion extends HTMLElement {
  static get observedAttributes() {
    return ['multiple', 'always-open', 'deep-link', 'faq-schema', ...INHERITED, ...TOOLBAR_ATTRS];
  }

  #parts;
  #initialized = false;
  #schemaScript = null;
  #filtered = new WeakSet();
  #query = '';
  #onHashChange = () => this.#openFromHash(true);
  #onBeforePrint = () => this.#prepareForPrint();

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    adoptStyles(root, accordionStyles);

    const search = h('input', { part: 'search', class: 'search', type: 'search', autocomplete: 'off', spellcheck: 'false' });
    const searchWrap = h('div', { class: 'search-wrap', hidden: true }, [search]);
    const expandAll = h('button', { part: 'control-button expand-all', class: 'button', type: 'button' });
    const collapseAll = h('button', { part: 'control-button collapse-all', class: 'button', type: 'button' });
    const controls = h('div', { part: 'controls', class: 'controls', hidden: true }, [expandAll, collapseAll]);
    const toolbar = h('div', { part: 'toolbar', class: 'toolbar', hidden: true }, [searchWrap, controls]);
    const status = h('div', { part: 'search-status', class: 'status', role: 'status', 'aria-live': 'polite' });
    const slot = h('slot');
    const base = h('div', { part: 'base', class: 'base' }, [toolbar, status, slot]);
    root.append(base);

    this.#parts = { base, toolbar, searchWrap, search, controls, expandAll, collapseAll, status, slot };

    const runFilter = debounce(() => this.filter(search.value), 120);
    search.addEventListener('input', runFilter);
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && search.value) {
        search.value = '';
        this.filter('');
      }
    });
    expandAll.addEventListener('click', () => this.expandAll());
    collapseAll.addEventListener('click', () => this.collapseAll());
    slot.addEventListener('slotchange', () => this.refresh());
  }

  connectedCallback() {
    this.#renderToolbar();
    window.addEventListener('hashchange', this.#onHashChange);
    window.addEventListener('beforeprint', this.#onBeforePrint);
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this.#onHashChange);
    window.removeEventListener('beforeprint', this.#onBeforePrint);
    this.#schemaScript?.remove();
    this.#schemaScript = null;
    this.#clearHighlights();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (INHERITED.includes(name)) this.items.forEach((item) => item.sync?.());
    else if (TOOLBAR_ATTRS.includes(name)) this.#renderToolbar();
    else if (name === 'multiple' || name === 'always-open') {
      this.#enforceRules();
      this.items.forEach((item) => item.sync?.());
      this.#renderToolbar();
    } else if (name === 'faq-schema') this.#updateSchema();
    else if (name === 'deep-link' && newValue !== null) this.#openFromHash(false);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Direct <jazz-accordion-item> children (nested accordions excluded). */
  get items() {
    return [...this.children].filter((el) => el.localName === ITEM_TAG);
  }

  get openItems() {
    return this.items.filter((item) => item.open);
  }

  get multiple() {
    return this.hasAttribute('multiple');
  }
  set multiple(value) {
    this.toggleAttribute('multiple', Boolean(value));
  }

  /** Accepts an item element, its index or its id. */
  getItem(target) {
    const items = this.items;
    if (typeof target === 'number') return items[target] ?? null;
    if (typeof target === 'string') return items.find((item) => item.id === target) ?? null;
    return items.includes(target) ? target : null;
  }

  toggle(target, force) {
    return this.getItem(target)?.toggle(force) ?? false;
  }

  expand(target) {
    return this.toggle(target, true);
  }

  collapse(target) {
    return this.toggle(target, false);
  }

  expandAll() {
    if (!this.multiple) return false;
    this.items.filter((i) => !i.hidden && !i.disabled).forEach((i) => i.toggle(true, { source: 'expand-all' }));
    return true;
  }

  collapseAll() {
    this.items.filter((i) => !i.disabled).forEach((i) => i.toggle(false, { source: 'collapse-all' }));
    return true;
  }

  /**
   * Shows only items whose heading or content contains `query`
   * (case- and accent-insensitive) and highlights the matches.
   * @returns {number} number of visible items
   */
  filter(query = '') {
    this.#query = String(query);
    const q = normalizeText(this.#query.trim());
    let count = 0;
    for (const item of this.items) {
      const match = !q || normalizeText(`${item.label} ${item._contentText?.() ?? item.textContent}`).includes(q);
      if (match) {
        if (this.#filtered.has(item)) {
          item.hidden = false;
          this.#filtered.delete(item);
        }
        if (!item.hidden) count += 1;
      } else if (!item.hidden) {
        item.hidden = true;
        this.#filtered.add(item);
      }
    }
    if (this.#parts.search.value !== this.#query) this.#parts.search.value = this.#query;
    this.#parts.status.textContent = q ? (count ? this.#text('results-label').replace('{count}', String(count)) : this.#text('no-results-label')) : '';
    this.#highlight(q);
    this.dispatchEvent(new CustomEvent('jazz-filter', { bubbles: true, composed: true, detail: { query: this.#query, count } }));
    return count;
  }

  /** Re-syncs items, rules, persisted state, deep link and schema. */
  refresh() {
    const items = this.items;
    items.forEach((item) => item.sync?.());
    if (!this.#initialized && items.length) {
      this.#initialized = true;
      this.#restore();
      this.#openFromHash(false);
    }
    this.#enforceRules();
    this.#updateSchema();
    if (this.#query) this.filter(this.#query);
  }

  // ── Internals used by items ─────────────────────────────────────────────

  _useRegion() {
    return !this.multiple || this.items.length <= 6;
  }

  _onItemToggle(item, open, source) {
    if (open && !this.multiple) {
      for (const other of this.openItems) {
        if (other !== item) other._set(false, { source: 'group', animate: true });
      }
    }
    this.#updateLocks();
    if (source !== 'restore') this.#persist();
    if (open && source === 'user' && item.id && this.hasAttribute('deep-link')) {
      try {
        history.replaceState(history.state, '', `#${encodeURIComponent(item.id)}`);
      } catch {
        /* sandboxed iframes may refuse */
      }
    }
  }

  _moveFocus(from, key) {
    const items = this.items.filter((i) => !i.hidden);
    const index = items.indexOf(from);
    if (index === -1 || !items.length) return false;
    const last = items.length - 1;
    const next = {
      ArrowDown: index === last ? 0 : index + 1,
      ArrowUp: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[key];
    items[next]?.focus();
    return true;
  }

  // ── Private ─────────────────────────────────────────────────────────────

  #text(name) {
    return this.getAttribute(name) ?? DEFAULT_TEXT[name];
  }

  #renderToolbar() {
    const { toolbar, searchWrap, search, controls, expandAll, collapseAll } = this.#parts;
    const hasSearch = this.hasAttribute('search');
    const hasControls = this.hasAttribute('controls') && this.multiple;
    searchWrap.hidden = !hasSearch;
    controls.hidden = !hasControls;
    toolbar.hidden = !hasSearch && !hasControls;
    search.placeholder = this.#text('search-placeholder');
    search.setAttribute('aria-label', this.#text('search-label'));
    expandAll.textContent = this.#text('expand-label');
    collapseAll.textContent = this.#text('collapse-label');
    if (!hasSearch && this.#query) this.filter('');
  }

  #enforceRules() {
    const items = this.items;
    if (!this.multiple) {
      const open = items.filter((i) => i.open);
      open.slice(1).forEach((i) => i._set?.(false, { animate: false, source: 'group' }));
    }
    if (this.hasAttribute('always-open') && items.length && !items.some((i) => i.open)) {
      items.find((i) => !i.disabled)?._set?.(true, { animate: false, source: 'always-open' });
    }
    this.#updateLocks();
  }

  #updateLocks() {
    const open = this.openItems;
    const lockLast = this.hasAttribute('always-open') && open.length === 1;
    for (const item of this.items) item._setLocked?.(lockLast && item === open[0]);
  }

  #storageKey() {
    const key = this.getAttribute('persist');
    return key ? `jazz-accordion:${key}` : null;
  }

  #persist() {
    const key = this.#storageKey();
    if (!key) return;
    const items = this.items;
    storage.set(key, items.map((item, i) => (item.open ? i : -1)).filter((i) => i >= 0));
  }

  #restore() {
    const key = this.#storageKey();
    if (!key) return;
    const saved = storage.get(key);
    if (!Array.isArray(saved)) return;
    const wanted = new Set(saved.filter((n) => Number.isInteger(n) && n >= 0));
    this.items.forEach((item, i) => {
      if (!item.disabled) item._set?.(wanted.has(i), { animate: false, source: 'restore' });
    });
  }

  #openFromHash(scroll) {
    if (!this.hasAttribute('deep-link')) return;
    let id;
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    if (!id) return;
    const target = document.getElementById(id);
    if (!target || !this.contains(target)) return;
    // Open every ancestor item, so links into nested accordions work too.
    let node = target;
    while (node) {
      const item = node.closest(ITEM_TAG);
      if (!item) break;
      item._set?.(true, { animate: false, source: 'hash' });
      node = item.parentElement;
    }
    if (scroll) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }

  #prepareForPrint() {
    for (const item of this.items) {
      const mode = item.getAttribute('print') ?? this.getAttribute('print') ?? 'expanded';
      if (mode === 'expanded') item._renderLazy?.();
    }
  }

  #updateSchema() {
    this.#schemaScript?.remove();
    this.#schemaScript = null;
    if (!this.hasAttribute('faq-schema') || !this.isConnected) return;
    const entities = this.items
      .map((item) => ({ name: item.label, text: item._contentText?.() ?? '' }))
      .filter((e) => e.name && e.text)
      .map((e) => ({ '@type': 'Question', name: e.name, acceptedAnswer: { '@type': 'Answer', text: e.text } }));
    if (!entities.length) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.jazzAccordion = '';
    // textContent never parses HTML; escaping "<" is defence in depth.
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: entities }).replace(/</g, '\\u003c');
    document.head.append(script);
    this.#schemaScript = script;
  }

  #ranges = [];

  #clearHighlights() {
    if (!this.#ranges.length || typeof CSS === 'undefined' || !CSS.highlights) return;
    const highlight = CSS.highlights.get(HIGHLIGHT_NAME);
    for (const range of this.#ranges) highlight?.delete(range);
    this.#ranges = [];
  }

  /** Highlights matches with the CSS Custom Highlight API (no DOM mutation). */
  #highlight(q) {
    this.#clearHighlights();
    if (!q || typeof CSS === 'undefined' || !CSS.highlights || typeof Highlight === 'undefined') return;
    installHighlightSheet();
    let highlight = CSS.highlights.get(HIGHLIGHT_NAME);
    if (!highlight) {
      highlight = new Highlight();
      CSS.highlights.set(HIGHLIGHT_NAME, highlight);
    }
    for (const item of this.items) {
      if (item.hidden) continue;
      const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = normalizeText(node.data);
        // normalizeText keeps length for precomposed Latin chars only;
        // skip nodes where the mapping is not 1:1 to stay safe.
        if (text.length !== node.data.length) continue;
        let index = text.indexOf(q);
        while (index !== -1) {
          const range = new Range();
          range.setStart(node, index);
          range.setEnd(node, index + q.length);
          highlight.add(range);
          this.#ranges.push(range);
          index = text.indexOf(q, index + q.length);
        }
      }
    }
  }
}

function installHighlightSheet() {
  if (highlightSheetInstalled) return;
  highlightSheetInstalled = true;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(highlightStyles);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  } catch {
    /* highlight still works with the browser's default style */
  }
}
