import { JazzAccordion } from './accordion.js';
import { JazzAccordionItem } from './item.js';
import { ACCORDION_TAG, ITEM_TAG } from './utils.js';

export const version = '1.0.0';

/** Registers the custom elements (safe to call more than once). */
export function define() {
  if (typeof customElements === 'undefined') return; // SSR / Node
  // Items first, so the accordion finds upgraded children on init.
  if (!customElements.get(ITEM_TAG)) customElements.define(ITEM_TAG, JazzAccordionItem);
  if (!customElements.get(ACCORDION_TAG)) customElements.define(ACCORDION_TAG, JazzAccordion);
}

define();

export { JazzAccordion, JazzAccordionItem };
