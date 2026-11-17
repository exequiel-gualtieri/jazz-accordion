// Type definitions for jazz-accordion

export type JazzIndicator = 'chevron' | 'plus' | 'arrow' | 'none';
export type JazzPrintMode = 'expanded' | 'collapsed' | 'as-is';
export type JazzToggleSource =
  | 'user'
  | 'api'
  | 'attribute'
  | 'group'
  | 'find'
  | 'hash'
  | 'restore'
  | 'always-open'
  | 'expand-all'
  | 'collapse-all';

export interface JazzToggleOptions {
  /** Animate the height change (default true). */
  animate?: boolean;
  /** Reported in event details (default "api"). */
  source?: JazzToggleSource;
}

export interface JazzToggleDetail {
  open: boolean;
  item: JazzAccordionItem;
  source: JazzToggleSource;
}

export interface JazzFilterDetail {
  query: string;
  count: number;
}

export declare class JazzAccordionItem extends HTMLElement {
  open: boolean;
  disabled: boolean;
  label: string;
  readonly accordion: JazzAccordion | null;
  /** Returns whether the state changed. */
  toggle(force?: boolean, options?: JazzToggleOptions): boolean;
  expand(options?: JazzToggleOptions): boolean;
  collapse(options?: JazzToggleOptions): boolean;
  focus(options?: FocusOptions): void;
  /** Re-reads configuration from attributes and theme variables. */
  sync(): void;
}

export type JazzItemTarget = JazzAccordionItem | number | string;

export declare class JazzAccordion extends HTMLElement {
  multiple: boolean;
  readonly items: JazzAccordionItem[];
  readonly openItems: JazzAccordionItem[];
  getItem(target: JazzItemTarget): JazzAccordionItem | null;
  toggle(target: JazzItemTarget, force?: boolean): boolean;
  expand(target: JazzItemTarget): boolean;
  collapse(target: JazzItemTarget): boolean;
  /** Only works in `multiple` mode; returns false otherwise. */
  expandAll(): boolean;
  collapseAll(): boolean;
  /** Filters items by text; returns the number of visible items. */
  filter(query?: string): number;
  /** Re-syncs items, rules, deep link and FAQ schema after content changes. */
  refresh(): void;
}

export declare const version: string;
export declare function define(): void;

declare global {
  interface HTMLElementTagNameMap {
    'jazz-accordion': JazzAccordion;
    'jazz-accordion-item': JazzAccordionItem;
  }
  interface HTMLElementEventMap {
    'jazz-before-toggle': CustomEvent<JazzToggleDetail>;
    'jazz-toggle': CustomEvent<JazzToggleDetail>;
    'jazz-after-toggle': CustomEvent<{ open: boolean; item: JazzAccordionItem }>;
    'jazz-filter': CustomEvent<JazzFilterDetail>;
  }
}
