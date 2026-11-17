# Jazz Accordion

**An accessible accordion Web Component that prints, can be found with Ctrl+F, and supports themes.**
No dependencies, ~8 kB gzip, works with React, Vue, Angular, Svelte or plain HTML.

```html
<script src="https://cdn.jsdelivr.net/npm/jazz-accordion@1/dist/jazz-accordion.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/jazz-accordion@1/dist/themes/hud.css" />

<jazz-accordion theme="hud">
  <jazz-accordion-item label="What is it?">A drop-in accordion that just works.</jazz-accordion-item>
  <jazz-accordion-item label="Does it print?">Yes. Closed panels are printed by default.</jazz-accordion-item>
</jazz-accordion>
```

## Why another accordion?

Most accordions online have the same problems. This one fixes them:

| Problem                                        | Jazz Accordion                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| Closed panels vanish when you **print**        | Printed expanded by default (`print="expanded \| collapsed \| as-is"`)        |
| **Ctrl+F** can't find text in closed panels    | Uses `hidden="until-found"`: the browser finds the text and opens the panel  |
| Broken **keyboard / screen reader** support    | Full WAI-ARIA accordion pattern, ↑ ↓ Home End, correct heading levels        |
| Janky height animation                         | Interruptible animation, respects `prefers-reduced-motion`                   |
| Can't **link** to a specific question          | `deep-link`: `/faq#shipping` opens the item (also inside nested accordions)  |
| Long FAQs are hard to scan                     | Built-in `search`: accent-insensitive filtering with highlighted matches     |
| FAQ pages don't show up as rich results        | `faq-schema` generates schema.org `FAQPage` JSON-LD                           |
| Hard to theme                                  | 60+ CSS variables, `::part()` hooks and 9 ready-made themes                  |
| `innerHTML` everywhere, breaks under strict CSP | No `innerHTML`, constructable stylesheets: Trusted Types and CSP friendly    |

## Install

### CDN (classic script)

```html
<script src="https://cdn.jsdelivr.net/npm/jazz-accordion@1/dist/jazz-accordion.min.js"></script>
```

### CDN (ES module)

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/jazz-accordion@1/dist/jazz-accordion.esm.min.js"></script>
```

### npm

```bash
npm install jazz-accordion
```

```js
import 'jazz-accordion';
import 'jazz-accordion/themes/hud.css';
```

## Themes

Load a theme's CSS and set the `theme` attribute:

`dark` · `hud` · `glass` · `minimal` · `terminal` · `corporate` · `brutalist` · `neon` · `paper`

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/jazz-accordion@1/dist/themes/corporate.css" />
<jazz-accordion theme="corporate">…</jazz-accordion>
```

`themes/all.css` bundles all of them (2.2 kB gzip).

### Pro themes (coming soon)

Five premium themes inspired by sci-fi film and game interfaces: **holo**, **amber**, **tactical**, **cockpit** and **haze**.
[See them on the website](https://exequiel-gualtieri.github.io/jazz-accordion/#pro). Star or watch this repo to hear about the launch.

### Make your own

A theme is just variables:

```css
jazz-accordion[theme='brand'] {
  --jz-accent: #e11d48;
  --jz-radius: 1rem;
  --jz-header-bg-open: #e11d48;
  --jz-header-color-open: white;
  --jz-indicator: plus; /* chevron | plus | arrow | none */
}
/* Structural tweaks through ::part() */
jazz-accordion[theme='brand'] > jazz-accordion-item::part(title) {
  font-variant: small-caps;
}
```

## `<jazz-accordion>` attributes

| Attribute            | Values                                   | Description                                                   |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| `multiple`           | boolean                                  | Allow several open panels                                     |
| `always-open`        | boolean                                  | Keep at least one panel open                                  |
| `theme`              | string                                   | Theme name (load its CSS)                                     |
| `indicator`          | `chevron` `plus` `arrow` `none`          | Expand/collapse icon                                          |
| `indicator-position` | `start` `end`                            | Icon side                                                     |
| `heading-level`      | `1`–`6` (default `3`)                    | `aria-level` of the headers                                   |
| `print`              | `expanded` (default) `collapsed` `as-is` | What gets printed                                             |
| `no-animation`       | boolean                                  | Disable the height animation                                  |
| `search`             | boolean                                  | Show a filter box                                             |
| `controls`           | boolean                                  | Show "Expand all / Collapse all" (with `multiple`)            |
| `deep-link`          | boolean                                  | Open the item matching `location.hash`; update it on click    |
| `persist`            | storage key                              | Remember open items in `localStorage`                         |
| `faq-schema`         | boolean                                  | Emit schema.org `FAQPage` JSON-LD                             |
| `search-label`, `search-placeholder`, `expand-label`, `collapse-label`, `results-label` (`{count}`), `no-results-label` | text | i18n |

## `<jazz-accordion-item>` attributes

| Attribute  | Description                                                                 |
| ---------- | --------------------------------------------------------------------------- |
| `label`    | Header text (or use `<span slot="title">` for rich content)                 |
| `subtitle` | Secondary line (or `slot="subtitle"`)                                       |
| `open`     | Open state (reflected)                                                      |
| `disabled` | Cannot be toggled by the user                                               |
| `lazy`     | Render the inner `<template>` on first open (or before printing)           |
| `id`       | Target for `deep-link` and `getItem('id')`                                  |
| `indicator`, `indicator-position`, `heading-level`, `print`, `no-animation`, `theme` | Override the accordion's value |

Slots: default (content), `title`, `subtitle`, `icon`.
`title="…"` is still accepted for backwards compatibility. It becomes the label and is removed, so the browser does not show a tooltip.

## JavaScript API

```js
const acc = document.querySelector('jazz-accordion');
acc.expand(0);            // by index
acc.toggle('shipping');   // by id
acc.collapse(item);       // by element
acc.expandAll();          // multiple mode only
acc.collapseAll();
acc.filter('refund');     // returns visible count
acc.items; acc.openItems;
acc.refresh();            // after changing content dynamically

const item = acc.items[0];
item.open = true;
item.toggle(); item.expand({ animate: false }); item.collapse();
```

### Events

| Event                | Cancelable | `detail`                     |
| -------------------- | ---------- | ---------------------------- |
| `jazz-before-toggle` | ✔          | `{ open, item, source }`     |
| `jazz-toggle`        |            | `{ open, item, source }`     |
| `jazz-after-toggle`  |            | `{ open, item }` (after animation) |
| `jazz-filter`        |            | `{ query, count }`           |

`source` is one of `user`, `api`, `attribute`, `group`, `find`, `hash`, `restore`, `always-open`, `expand-all`, `collapse-all`.

## CSS parts

Item: `item`, `heading`, `trigger`, `icon`, `title`, `subtitle`, `indicator`, `panel`, `content`.
Accordion: `base`, `toolbar`, `search`, `search-status`, `controls`, `control-button`, `expand-all`, `collapse-all`.

## Main CSS variables

`--jz-accent` `--jz-color` `--jz-font-family` `--jz-gap` `--jz-radius` `--jz-border` `--jz-border-open`
`--jz-item-bg` `--jz-shadow` `--jz-shadow-open` `--jz-header-bg` `--jz-header-bg-hover` `--jz-header-bg-open`
`--jz-header-color` `--jz-header-color-open` `--jz-header-padding` `--jz-header-font-size` `--jz-header-font-weight`
`--jz-header-font-family` `--jz-header-letter-spacing` `--jz-header-text-transform` `--jz-content-bg`
`--jz-content-color` `--jz-content-padding` `--jz-content-font-size` `--jz-content-line-height` `--jz-divider`
`--jz-indicator` `--jz-indicator-color` `--jz-indicator-size` `--jz-indicator-stroke` `--jz-focus-ring`
`--jz-focus-offset` `--jz-duration` `--jz-easing` `--jz-disabled-opacity` `--jz-highlight-bg` `--jz-highlight-color`
Print: `--jz-print-color` `--jz-print-bg` `--jz-print-border` `--jz-print-radius`
… see the [documentation site](./index.html) for the full list.

## Frameworks

```jsx
// React
import 'jazz-accordion';

function Faq() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const onToggle = (e) => console.log(e.detail);
    el.addEventListener('jazz-toggle', onToggle);
    return () => el.removeEventListener('jazz-toggle', onToggle);
  }, []);
  return (
    <jazz-accordion ref={ref} multiple theme="dark">
      <jazz-accordion-item label="Hi">Content</jazz-accordion-item>
    </jazz-accordion>
  );
}
```

```ts
// Angular: add CUSTOM_ELEMENTS_SCHEMA to the component/module
import 'jazz-accordion';
```

```js
// Vue (vite.config): compilerOptions.isCustomElement = (tag) => tag.startsWith('jazz-')
```

## Browser support

All evergreen browsers (Chrome/Edge 100+, Firefox 100+, Safari 15.4+).
Find-in-page for closed panels and search highlighting are progressive enhancements: they work where the browser supports them (`hidden="until-found"`, CSS Custom Highlight API), and the component keeps working without them.

## Development

```bash
npm install
npm run dev     # http://localhost:4791 (docs site)
npm test        # build + Playwright suite against the minified bundle
npm run build   # dist/
```

## License

MIT © Exequiel Gualtieri
