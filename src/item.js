import { itemStyles } from './styles.js';
import {
  ACCORDION_TAG,
  SUPPORTS_UNTIL_FOUND,
  adoptStyles,
  clampInt,
  h,
  oneOf,
  parseDuration,
  prefersReducedMotion,
  svg,
} from './utils.js';

const INDICATORS = {
  chevron: () => svg(['M6 9l6 6 6-6']),
  arrow: () => svg(['M9 6l6 6-6 6']),
  plus: () => svg([['M12 5v14', 'v'], 'M5 12h14']),
  none: () => null,
};

/** Attributes an item can inherit from its parent <jazz-accordion>. */
export const INHERITED = ['indicator', 'indicator-position', 'heading-level', 'print', 'no-animation', 'theme'];

/**
 * <jazz-accordion-item>
 *
 * One collapsible section. Works on its own or inside <jazz-accordion>,
 * which coordinates single/multiple mode, keyboard navigation and extras.
 *
 * @slot          - Panel content.
 * @slot title    - Rich heading content (overrides the `label` attribute).
 * @slot subtitle - Secondary line under the heading.
 * @slot icon     - Leading icon.
 *
 * @fires jazz-before-toggle - Cancelable. detail: { open, item, source }
 * @fires jazz-toggle        - After state changes. detail: { open, item, source }
 * @fires jazz-after-toggle  - After the animation ends. detail: { open, item }
 */
export class JazzAccordionItem extends HTMLElement {
  static get observedAttributes() {
    return ['open', 'disabled', 'label', 'title', 'subtitle', ...INHERITED];
  }

  #parts;
  #ready = false;
  #anim = null;
  #pendingSource = null;
  #pendingAnimate = null;
  #legacyTitle = null;
  #lazyDone = false;
  #indicatorType = null;
  #locked = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    adoptStyles(root, itemStyles);

    const iconSlot = h('slot', { name: 'icon' });
    const titleSlot = h('slot', { name: 'title' });
    const subtitleSlot = h('slot', { name: 'subtitle' });

    const icon = h('span', { part: 'icon', class: 'icon', hidden: true }, [iconSlot]);
    const title = h('span', { part: 'title', class: 'title' }, [titleSlot]);
    const subtitle = h('span', { part: 'subtitle', class: 'subtitle', hidden: true }, [subtitleSlot]);
    const indicator = h('span', { part: 'indicator', class: 'indicator', 'aria-hidden': 'true' });

    const trigger = h(
      'button',
      { part: 'trigger', class: 'trigger', type: 'button', id: 'trigger', 'aria-expanded': 'false', 'aria-controls': 'panel' },
      [icon, h('span', { class: 'text' }, [title, subtitle]), indicator],
    );
    const heading = h('div', { part: 'heading', class: 'heading', role: 'heading', 'aria-level': '3' }, [trigger]);
    const content = h('div', { part: 'content', class: 'content' }, [h('slot')]);
    const panel = h('div', { part: 'panel', class: 'panel', id: 'panel', role: 'region', 'aria-labelledby': 'trigger', hidden: true }, [content]);
    const base = h('div', { part: 'item', class: 'item' }, [heading, panel]);

    root.append(base);
    this.#parts = { base, heading, trigger, icon, iconSlot, title, titleSlot, subtitle, subtitleSlot, indicator, panel, content };

    trigger.addEventListener('click', () => this.#onActivate());
    trigger.addEventListener('keydown', (e) => this.#onKeydown(e));
    iconSlot.addEventListener('slotchange', () => this.#syncSlots());
    subtitleSlot.addEventListener('slotchange', () => this.#syncSlots());
    titleSlot.addEventListener('slotchange', () => this.#syncSlots());
    // Fired by the browser when Ctrl+F finds text in a hidden="until-found" panel.
    panel.addEventListener('beforematch', () => this.#setState(true, { animate: false, source: 'find' }));
  }

  connectedCallback() {
    this.#captureLegacyTitle();
    this.sync();
    if (!this.#ready) {
      this.#ready = true;
      if (this.open) this.#renderLazy();
      this.#applyStatic(this.open);
    }
  }

  disconnectedCallback() {
    this.#anim?.cancel();
    this.#anim = null;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    switch (name) {
      case 'open':
        if (this.#ready) this.#onOpenChanged(newValue !== null);
        break;
      case 'title':
        this.#captureLegacyTitle();
        break;
      case 'label':
      case 'subtitle':
        this.#syncText();
        break;
      default:
        if (this.#ready) this.sync();
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  get open() {
    return this.hasAttribute('open');
  }
  set open(value) {
    this.toggleAttribute('open', Boolean(value));
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }
  set disabled(value) {
    this.toggleAttribute('disabled', Boolean(value));
  }

  /** Heading text (label attribute, legacy title attribute or slotted title). */
  get label() {
    const attr = this.getAttribute('label') ?? this.#legacyTitle;
    if (attr) return attr.trim();
    return this.#parts.titleSlot
      .assignedNodes({ flatten: true })
      .map((n) => n.textContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  set label(value) {
    this.setAttribute('label', value);
  }

  /** The parent <jazz-accordion>, if any. */
  get accordion() {
    const parent = this.parentElement;
    return parent && parent.localName === ACCORDION_TAG ? parent : null;
  }

  /**
   * Opens/closes the item as if the user did it: fires the cancelable
   * `jazz-before-toggle` event and respects `disabled` / `always-open`.
   * @returns {boolean} whether the state changed
   */
  toggle(force, { animate = true, source = 'api' } = {}) {
    const next = force === undefined ? !this.open : Boolean(force);
    if (next === this.open) return false;
    if (this.disabled && source === 'user') return false;
    if (!next && this.#locked) return false;
    const event = new CustomEvent('jazz-before-toggle', {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: { open: next, item: this, source },
    });
    if (!this.dispatchEvent(event)) return false;
    this.#setState(next, { animate, source });
    return true;
  }

  expand(options) {
    return this.toggle(true, options);
  }

  collapse(options) {
    return this.toggle(false, options);
  }

  focus(options) {
    this.#parts.trigger.focus(options);
  }

  /** Re-reads configuration (own attributes, then the parent accordion's). */
  sync() {
    const acc = this.accordion;
    // Priority: own attribute → accordion attribute → theme CSS variable → default.
    const css = this.isConnected ? getComputedStyle(this) : null;
    const read = (name, fallback) =>
      this.getAttribute(name) ?? acc?.getAttribute(name) ?? (css?.getPropertyValue(`--jz-${name}`).trim() || fallback);
    const { base, heading, panel, indicator } = this.#parts;

    const type = oneOf(read('indicator', 'chevron'), Object.keys(INDICATORS), 'chevron');
    if (type !== this.#indicatorType) {
      this.#indicatorType = type;
      const icon = INDICATORS[type]();
      indicator.replaceChildren(...(icon ? [icon] : []));
      indicator.hidden = !icon;
    }
    base.dataset.indicator = type;
    base.dataset.position = oneOf(read('indicator-position', 'end'), ['start', 'end'], 'end');
    base.dataset.print = oneOf(read('print', 'expanded'), ['expanded', 'collapsed', 'as-is'], 'expanded');
    heading.setAttribute('aria-level', String(clampInt(read('heading-level', '3'), 1, 6, 3)));
    base.toggleAttribute('data-disabled', this.disabled);

    // WAI-ARIA APG: avoid landmark proliferation when many panels can be open.
    const useRegion = acc?._useRegion?.() ?? true;
    if (useRegion) panel.setAttribute('role', 'region');
    else panel.removeAttribute('role');

    this.#syncText();
    this.#syncAria();
    // A disabled, closed panel should not be revealed by find-in-page.
    if (!this.open && !this.#anim) this.#hidePanel();
  }

  // ── Internals used by <jazz-accordion> ──────────────────────────────────

  /** Sets state without firing jazz-before-toggle (group coordination, hash…). */
  _set(open, options) {
    if (Boolean(open) === this.open) return;
    this.#setState(Boolean(open), options);
  }

  /** Marks the item as the one that must stay open (`always-open`). */
  _setLocked(locked) {
    this.#locked = locked;
    this.#syncAria();
  }

  /** Renders lazy <template> content now (used before printing). */
  _renderLazy() {
    this.#renderLazy();
  }

  /** Plain text of the panel content (for search and FAQ schema). */
  _contentText() {
    let text = '';
    for (const node of this.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
      else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.localName === 'template') {
          if (this.hasAttribute('lazy')) text += ` ${node.content.textContent}`;
        } else if (!node.hasAttribute('slot')) text += ` ${node.textContent}`;
      }
    }
    return text.replace(/\s+/g, ' ').trim();
  }

  // ── Private ─────────────────────────────────────────────────────────────

  #onActivate() {
    if (this.disabled) return;
    this.toggle(undefined, { source: 'user' });
  }

  #onKeydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (this.accordion?._moveFocus?.(this, event.key)) event.preventDefault();
  }

  #setState(open, { animate = true, source = 'api' } = {}) {
    this.#pendingSource = source;
    this.#pendingAnimate = animate;
    this.open = open; // → attributeChangedCallback → #onOpenChanged
  }

  #onOpenChanged(open) {
    const source = this.#pendingSource ?? 'attribute';
    const animate = this.#pendingAnimate ?? true;
    this.#pendingSource = this.#pendingAnimate = null;

    if (open) this.#renderLazy();
    this.#syncAria();
    this.#animate(open, animate && this.isConnected);
    this.accordion?._onItemToggle?.(this, open, source);
    this.dispatchEvent(
      new CustomEvent('jazz-toggle', { bubbles: true, composed: true, detail: { open, item: this, source } }),
    );
  }

  #syncAria() {
    const { base, trigger } = this.#parts;
    const open = this.open;
    base.toggleAttribute('data-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    // APG: a panel that cannot be collapsed exposes aria-disabled on its button.
    const blocked = this.disabled || (open && this.#locked);
    if (blocked) trigger.setAttribute('aria-disabled', 'true');
    else trigger.removeAttribute('aria-disabled');
  }

  #syncText() {
    const label = this.getAttribute('label') ?? this.#legacyTitle ?? '';
    this.#parts.titleSlot.textContent = label; // slot fallback content (safe text)
    this.#parts.subtitleSlot.textContent = this.getAttribute('subtitle') ?? '';
    this.#syncSlots();
  }

  #syncSlots() {
    const { icon, iconSlot, subtitle, subtitleSlot } = this.#parts;
    icon.hidden = iconSlot.assignedNodes().length === 0;
    subtitle.hidden = subtitleSlot.assignedNodes().length === 0 && !this.getAttribute('subtitle');
  }

  /**
   * Backwards compatibility with `<item-acc title="…">`-style markup:
   * the `title` attribute becomes the label and is removed so the browser
   * does not show a tooltip over the whole panel.
   */
  #captureLegacyTitle() {
    const title = this.getAttribute('title');
    if (title === null) return;
    this.#legacyTitle = title;
    this.removeAttribute('title');
    this.#syncText();
  }

  #renderLazy() {
    if (this.#lazyDone || !this.hasAttribute('lazy')) return;
    this.#lazyDone = true;
    const template = [...this.children].find((c) => c.localName === 'template' && !c.hasAttribute('slot'));
    if (template) {
      this.append(template.content.cloneNode(true));
      template.remove();
    }
  }

  #hidePanel() {
    const { panel } = this.#parts;
    if (SUPPORTS_UNTIL_FOUND && !this.disabled) panel.setAttribute('hidden', 'until-found');
    else panel.setAttribute('hidden', '');
  }

  #applyStatic(open) {
    if (open) this.#parts.panel.removeAttribute('hidden');
    else this.#hidePanel();
  }

  #config(name, fallback) {
    const value = getComputedStyle(this).getPropertyValue(name).trim();
    return value || fallback;
  }

  #duration() {
    if (this.hasAttribute('no-animation') || this.accordion?.hasAttribute('no-animation')) return 0;
    if (prefersReducedMotion()) return 0;
    return parseDuration(this.#config('--jz-duration', '250ms'));
  }

  #animate(open, animate) {
    const { panel } = this.#parts;
    const running = this.#anim;
    const from = running ? panel.getBoundingClientRect().height : null;
    if (running) {
      this.#anim = null;
      running.cancel();
    }

    const duration = animate ? this.#duration() : 0;
    if (open) panel.removeAttribute('hidden');

    if (!duration || typeof panel.animate !== 'function') {
      panel.style.overflow = '';
      if (!open) this.#hidePanel();
      this.#afterToggle(open);
      return;
    }

    const start = from ?? (open ? 0 : panel.getBoundingClientRect().height);
    const end = open ? panel.scrollHeight : 0;
    panel.style.overflow = 'hidden';
    const anim = panel.animate([{ height: `${start}px` }, { height: `${end}px` }], {
      duration,
      easing: this.#config('--jz-easing', 'cubic-bezier(0.4, 0, 0.2, 1)'),
    });
    this.#anim = anim;
    anim.onfinish = () => {
      if (this.#anim !== anim) return;
      this.#anim = null;
      panel.style.overflow = '';
      if (!this.open) this.#hidePanel();
      this.#afterToggle(this.open);
    };
  }

  #afterToggle(open) {
    this.dispatchEvent(new CustomEvent('jazz-after-toggle', { bubbles: true, composed: true, detail: { open, item: this } }));
  }
}
