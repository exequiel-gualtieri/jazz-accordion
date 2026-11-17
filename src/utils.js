// Shared helpers. No innerHTML anywhere in the library: every node is built
// with createElement/textContent, so it is Trusted Types and CSP friendly.

export const ACCORDION_TAG = 'jazz-accordion';
export const ITEM_TAG = 'jazz-accordion-item';

const hasDOM = typeof window !== 'undefined' && typeof HTMLElement !== 'undefined';

/** `hidden="until-found"` lets Ctrl+F find text inside collapsed panels. */
export const SUPPORTS_UNTIL_FOUND = hasDOM && 'onbeforematch' in HTMLElement.prototype;

/** Creates an element with attributes and children. */
export function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Creates a decorative inline SVG from a list of path definitions. */
export function svg(paths, viewBox = '0 0 24 24') {
  const root = document.createElementNS(SVG_NS, 'svg');
  root.setAttribute('viewBox', viewBox);
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('focusable', 'false');
  for (const def of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    const [d, cls] = Array.isArray(def) ? def : [def];
    path.setAttribute('d', d);
    if (cls) path.setAttribute('class', cls);
    root.append(path);
  }
  return root;
}

const sheetCache = new Map();

/**
 * Applies CSS to a shadow root. Constructable stylesheets are shared between
 * every instance (one parse, zero <style> tags) and are not blocked by a
 * strict `style-src` CSP. Falls back to a <style> element on old engines.
 */
export function adoptStyles(root, cssText) {
  try {
    let sheet = sheetCache.get(cssText);
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(cssText);
      sheetCache.set(cssText, sheet);
    }
    root.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement('style');
    style.textContent = cssText;
    root.prepend(style);
  }
}

/** Parses "250ms" / ".3s" / "0" into milliseconds. */
export function parseDuration(value, fallback = 250) {
  const match = /^\s*(-?[\d.]+)\s*(ms|s)?\s*$/i.exec(String(value ?? ''));
  if (!match) return fallback;
  const n = parseFloat(match[1]);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return match[2]?.toLowerCase() === 's' ? n * 1000 : n;
}

export function prefersReducedMotion() {
  return hasDOM && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Lower-cases and strips accents so "Médico" matches "medico". */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** localStorage wrapper that never throws (private mode, blocked storage…). */
export const storage = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: silently ignore */
    }
  },
};

export function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
