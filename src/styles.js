// Shadow DOM styles. Every visual value is a CSS custom property with a
// sensible fallback, so themes only need to set variables (custom properties
// inherit through the shadow boundary). Structural tweaks use ::part().
//
// The neutral defaults are built with currentColor + color-mix(), so the
// component looks right on both light and dark pages without a theme.

const line = 'color-mix(in srgb, currentColor 18%, transparent)';
const tint = (pct) => `color-mix(in srgb, currentColor ${pct}%, transparent)`;

export const itemStyles = /* css */ `
:host {
  display: block;
  margin-block-end: var(--jz-gap, 0.5rem);
}
:host(:last-of-type) { margin-block-end: 0; }
:host([hidden]) { display: none !important; }

.item {
  position: relative;
  background: var(--jz-item-bg, transparent);
  border: var(--jz-border, 1px solid ${line});
  border-radius: var(--jz-radius, 0.5rem);
  box-shadow: var(--jz-shadow, none);
  overflow: clip;
  transition: border-color var(--jz-duration-fast, 150ms), box-shadow var(--jz-duration-fast, 150ms);
}
.item[data-open] {
  border: var(--jz-border-open, var(--jz-border, 1px solid ${line}));
  box-shadow: var(--jz-shadow-open, var(--jz-shadow, none));
}

.heading { margin: 0; }

.trigger {
  display: flex;
  align-items: center;
  gap: var(--jz-header-gap, 0.75rem);
  inline-size: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: var(--jz-header-padding, 1rem 1.25rem);
  border: 0;
  border-radius: 0;
  background: var(--jz-header-bg, transparent);
  color: var(--jz-header-color, inherit);
  font: inherit;
  font-family: var(--jz-header-font-family, inherit);
  font-size: var(--jz-header-font-size, 1rem);
  font-weight: var(--jz-header-font-weight, 600);
  letter-spacing: var(--jz-header-letter-spacing, normal);
  text-transform: var(--jz-header-text-transform, none);
  line-height: 1.35;
  text-align: start;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--jz-duration-fast, 150ms), color var(--jz-duration-fast, 150ms);
}
.trigger:hover { background: var(--jz-header-bg-hover, ${tint(6)}); }
.item[data-open] .trigger {
  background: var(--jz-header-bg-open, var(--jz-header-bg, transparent));
  color: var(--jz-header-color-open, var(--jz-header-color, inherit));
}
.trigger:focus-visible {
  outline: var(--jz-focus-ring, 2px solid var(--jz-accent, #2563eb));
  outline-offset: var(--jz-focus-offset, -2px);
}
.trigger[aria-disabled='true'] { cursor: default; }
.item[data-disabled] .trigger {
  cursor: not-allowed;
  opacity: var(--jz-disabled-opacity, 0.5);
}
.item[data-disabled] .trigger:hover { background: var(--jz-header-bg, transparent); }

.icon { display: inline-flex; flex: none; color: var(--jz-icon-color, inherit); }
.icon[hidden], .subtitle[hidden] { display: none; }
.icon ::slotted(*) { inline-size: var(--jz-icon-size, 1.25em); block-size: var(--jz-icon-size, 1.25em); }

.text { display: flex; flex: 1; flex-direction: column; gap: 0.15em; min-inline-size: 0; }
.subtitle {
  font-size: var(--jz-subtitle-font-size, 0.875em);
  font-weight: var(--jz-subtitle-font-weight, 400);
  color: var(--jz-subtitle-color, inherit);
  opacity: var(--jz-subtitle-opacity, 0.72);
  text-transform: none;
  letter-spacing: normal;
}

.indicator {
  display: inline-flex;
  flex: none;
  inline-size: var(--jz-indicator-size, 1.25em);
  block-size: var(--jz-indicator-size, 1.25em);
  color: var(--jz-indicator-color, currentColor);
  transition: transform var(--jz-duration, 250ms) var(--jz-easing, cubic-bezier(0.4, 0, 0.2, 1));
}
.item[data-position='start'] .indicator { order: -1; }
.indicator[hidden] { display: none; }
.indicator svg {
  inline-size: 100%;
  block-size: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: var(--jz-indicator-stroke, 2);
  stroke-linecap: round;
  stroke-linejoin: round;
  overflow: visible;
}
.indicator .v { transform-origin: center; transform-box: fill-box; transition: transform var(--jz-duration, 250ms) var(--jz-easing, ease); }
.item[data-open][data-indicator='chevron'] .indicator { transform: rotate(180deg); }
.item[data-open][data-indicator='arrow'] .indicator { transform: rotate(90deg); }
:host(:dir(rtl)) .item[data-indicator='arrow'] .indicator svg { transform: scaleX(-1); }
.item[data-open][data-indicator='plus'] .indicator .v { transform: rotate(90deg); }

.panel { box-sizing: border-box; }
.panel[hidden]:not([hidden='until-found']) { display: none; }
.content {
  padding: var(--jz-content-padding, 0 1.25rem 1.25rem);
  background: var(--jz-content-bg, transparent);
  color: var(--jz-content-color, inherit);
  font-size: var(--jz-content-font-size, inherit);
  line-height: var(--jz-content-line-height, 1.6);
  border-block-start: var(--jz-divider, none);
}
.item[data-divider] .content { padding-block-start: var(--jz-content-padding-top, 1rem); }

@media (forced-colors: active) {
  .item { border: 1px solid CanvasText; }
  .trigger:focus-visible { outline: 2px solid Highlight; }
  .indicator { color: ButtonText; }
}

/* ── Print ─────────────────────────────────────────────────────────────
   Collapsed content is printed by default (print="expanded"). Colors are
   reset to ink-friendly values; override them with ::part() inside an
   @media print block if you want your theme on paper.                    */
@media print {
  .item {
    background: transparent;
    border: 1px solid #999;
    border-radius: 0;
    box-shadow: none;
    overflow: visible;
  }
  .trigger, .content { background: transparent; color: #000; }
  .trigger { padding-block: 0.5rem; break-after: avoid; }
  .item[data-print='expanded'] .indicator { display: none; }
  .item[data-print='expanded'] .panel {
    display: block !important;
    content-visibility: visible !important;
    block-size: auto !important;
    height: auto !important;
    overflow: visible !important;
  }
  .item[data-print='collapsed'] .panel { display: none !important; }
  .item[data-print='expanded'] .content { padding-block-start: 0.25rem; }
}
`;

export const accordionStyles = /* css */ `
:host {
  display: block;
  color: var(--jz-color, inherit);
  font-family: var(--jz-font-family, inherit);
  background: var(--jz-bg, transparent);
}
:host([hidden]) { display: none !important; }

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--jz-toolbar-gap, 0.5rem);
  margin-block-end: var(--jz-gap, 0.5rem);
}
.toolbar[hidden], .search-wrap[hidden], .controls[hidden] { display: none; }

.search-wrap { position: relative; flex: 1 1 14rem; min-inline-size: 0; display: flex; }
.search {
  flex: 1;
  min-inline-size: 0;
  box-sizing: border-box;
  font: inherit;
  padding: var(--jz-search-padding, 0.6rem 0.85rem);
  border: var(--jz-search-border, 1px solid ${tint(25)});
  border-radius: var(--jz-radius, 0.5rem);
  background: var(--jz-search-bg, transparent);
  color: var(--jz-search-color, inherit);
}
.search::placeholder { color: inherit; opacity: 0.6; }
.search:focus-visible, .button:focus-visible {
  outline: var(--jz-focus-ring, 2px solid var(--jz-accent, #2563eb));
  outline-offset: 1px;
}

.controls { display: flex; gap: var(--jz-toolbar-gap, 0.5rem); }
.button {
  font: inherit;
  font-size: 0.875em;
  padding: var(--jz-button-padding, 0.5rem 0.85rem);
  border: var(--jz-button-border, 1px solid ${tint(25)});
  border-radius: var(--jz-radius, 0.5rem);
  background: var(--jz-button-bg, transparent);
  color: var(--jz-button-color, inherit);
  cursor: pointer;
}
.button:hover { background: var(--jz-button-bg-hover, ${tint(8)}); }

.status { font-size: 0.875em; opacity: 0.75; }
.status:not(:empty) { margin-block-end: var(--jz-gap, 0.5rem); }

@media print {
  .toolbar, .status { display: none !important; }
}
`;

/** Document-level rule for search highlights (CSS Custom Highlight API). */
export const highlightStyles = /* css */ `
::highlight(jazz-accordion-match) {
  background-color: var(--jz-highlight-bg, #fde047);
  color: var(--jz-highlight-color, #111);
}
`;
