import type { PrepareOptions } from '@chenglou/pretext';

import {
  prepareMiddleTruncator,
  pretextOptionsEqual,
  truncateMiddle,
} from './core.js';
import {
  observeCascadePath,
  observeResizePath,
  runAfterDocumentFontsLoad,
} from './lifecycle.js';
import {
  ensureMiddleTruncateStyles,
  middleTruncateClassNames,
} from './structural-styles.js';
import type {
  ElementMiddleTruncateOptions,
  MiddleTruncateOptions,
  MiddleTruncateResult,
  MountMiddleTruncateOptions,
  PreparedMiddleTruncator,
} from './types.js';

/**
 * Build a canvas-compatible CSS font string from an element's computed style.
 *
 * Canvas font parsing follows the CSS2.1 `<font>` shorthand grammar, which is
 * narrower than what `getComputedStyle` will hand back. Notably, font-variant
 * only accepts `normal | small-caps`, but modern UAs return `"none"` for
 * `style.fontVariant` whenever `font-variant-ligatures: none` (or similar
 * sub-property) is set in the cascade. Forwarding that token verbatim makes
 * canvas silently reject the entire string and fall back to `10px sans-serif`,
 * which produces measurements that are catastrophically narrower than the
 * real rendered text.
 */
export function fontFromElement(element: Element): string {
  const style = getComputedStyle(element);

  if (style.font.trim() !== '') {
    return style.font;
  }

  const lineHeight =
    style.lineHeight === 'normal' ? '' : `/${style.lineHeight}`;

  return [
    canvasFontStyle(style.fontStyle),
    canvasFontVariant(style.fontVariant),
    style.fontWeight,
    `${style.fontSize}${lineHeight}`,
    style.fontFamily,
  ]
    .filter((part) => part.trim() !== '')
    .join(' ');
}

function canvasFontStyle(value: string): string {
  if (value === 'italic') {
    return 'italic';
  }
  if (value.startsWith('oblique')) {
    return 'oblique';
  }
  return '';
}

function canvasFontVariant(value: string): string {
  return value === 'small-caps' ? 'small-caps' : '';
}

/**
 * Build Pretext preparation settings from computed CSS that is not encoded in
 * the canvas font string.
 */
export function pretextOptionsFromElement(
  element: Element,
): PrepareOptions | undefined {
  const letterSpacing = parseCssPixelValue(
    getComputedStyle(element).letterSpacing,
  );

  if (letterSpacing === undefined || letterSpacing === 0) {
    return undefined;
  }

  return { letterSpacing };
}

/**
 * Read the element's current content-box width.
 */
export function contentWidthFromElement(element: HTMLElement): number {
  const style = getComputedStyle(element);
  const padding =
    parseFloat(style.paddingLeft || '0') +
    parseFloat(style.paddingRight || '0');

  return Math.max(0, element.clientWidth - padding);
}

/**
 * Read the width the element should measure against.
 *
 * Most layouts can use the element content box directly. Auto-width
 * inline-blocks are different: after truncation they can shrink to the
 * shortened text, so measuring them feeds the previous truncation result back
 * into the next one. In that shrink-wrapped case, use the containing block
 * width instead, matching the element's `max-width: 100%` constraint.
 */
export function availableContentWidthFromElement(element: HTMLElement): number {
  const ownWidth = contentWidthFromElement(element);
  const parent = element.parentElement;

  if (parent === null) {
    return ownWidth;
  }

  const parentStyle = getComputedStyle(parent);

  if (isFlexOrGridContainer(parentStyle)) {
    return ownWidth;
  }

  const parentContentWidth = contentWidthFromElement(parent);
  const style = getComputedStyle(element);
  const maxWidth = cssSizeToPixels(style.maxWidth, parentContentWidth);

  if (maxWidth !== undefined) {
    return contentWidthFromCssWidth(
      element,
      Math.min(maxWidth, parentContentWidth),
    );
  }

  if (style.display === 'inline-block') {
    return contentWidthFromCssWidth(element, parentContentWidth);
  }

  return ownWidth;
}

/**
 * Truncate using an element's computed font and current content width.
 */
export function truncateMiddleElement(
  element: HTMLElement,
  options: ElementMiddleTruncateOptions = {},
): MiddleTruncateResult {
  const text = element.textContent;

  return truncateMiddle(text, truncateOptionsFromElement(element, options));
}

/**
 * Render truncation parts into an element. This is the plain JavaScript helper
 * for users who do not want to manage the three-span DOM contract themselves.
 */
export function renderMiddleTruncateElement(
  element: HTMLElement,
  text: string,
  options: ElementMiddleTruncateOptions = {},
): MiddleTruncateResult {
  ensureMiddleTruncateStyles(element.ownerDocument);
  element.classList.add(middleTruncateClassNames.root);

  const result = truncateMiddle(
    text,
    truncateOptionsFromElement(element, options),
  );

  renderMiddleTruncateParts(element, result);

  return result;
}

function renderMiddleTruncateParts(
  element: HTMLElement,
  result: MiddleTruncateResult,
): void {
  ensureMiddleTruncateStyles(element.ownerDocument);
  element.classList.add(middleTruncateClassNames.root);
  element.dataset.pmtEnhanced = 'true';
  element.dataset.pmtTruncated = String(result.truncated);

  const parts = ensureMiddleTruncateStructure(element);

  parts.before.dataset.pmtTruncated = String(result.truncated);
  parts.before.dataset.pmtVisibleText = result.before;
  parts.after.dataset.pmtVisibleText = result.after;
  setTextContent(parts.before, result.before);
  setTextContent(parts.omitted, result.omitted);
  setTextContent(parts.after, result.after);
}

type MiddleTruncateStructure = {
  after: HTMLSpanElement;
  before: HTMLSpanElement;
  omitted: HTMLSpanElement;
};

function ensureMiddleTruncateStructure(
  element: HTMLElement,
): MiddleTruncateStructure {
  let before = element.querySelector<HTMLSpanElement>(
    `:scope > .${middleTruncateClassNames.before}`,
  );
  let omitted = element.querySelector<HTMLSpanElement>(
    `:scope > .${middleTruncateClassNames.omitted}`,
  );
  let after = element.querySelector<HTMLSpanElement>(
    `:scope > .${middleTruncateClassNames.after}`,
  );

  if (before === null || omitted === null || after === null) {
    before = createPart(element, middleTruncateClassNames.before, '');
    omitted = createPart(element, middleTruncateClassNames.omitted, '');
    after = createPart(element, middleTruncateClassNames.after, '');

    element.replaceChildren(before, omitted, after);
  }
  return {
    after,
    before,
    omitted,
  };
}

function setTextContent(element: HTMLElement, text: string): void {
  if (element.textContent !== text) {
    element.textContent = text;
  }
}

type PreparedElementTruncatorState = {
  text: string;
  font: string;
  pretext: PrepareOptions | undefined;
  truncator: PreparedMiddleTruncator;
};

function preparedForElementOptions(
  current: PreparedElementTruncatorState | null,
  text: string,
  options: MiddleTruncateOptions,
): {
  state: PreparedElementTruncatorState;
  truncator: PreparedMiddleTruncator;
} {
  if (
    current !== null &&
    current.text === text &&
    current.font === options.font &&
    pretextOptionsEqual(current.pretext, options.pretext)
  ) {
    return {
      state: current,
      truncator: current.truncator,
    };
  }

  const truncator = prepareMiddleTruncator(text, options);
  const state = {
    text,
    font: options.font,
    pretext: options.pretext,
    truncator,
  };

  return { state, truncator };
}

/**
 * Keep an element rendered and remeasured as it resizes. Returns a cleanup
 * function.
 */
export function mountMiddleTruncate(
  element: HTMLElement,
  options: MountMiddleTruncateOptions = {},
): () => void {
  const title = options.title ?? true;
  let preparedState: PreparedElementTruncatorState | null = null;
  let lastResult: MiddleTruncateResult | null = null;
  let animationFrame = 0;
  const update = () => {
    animationFrame = 0;
    const text = currentMiddleTruncateText(element, options);
    const truncateOptions = truncateOptionsFromElement(element, options);
    const prepared = preparedForElementOptions(
      preparedState,
      text,
      truncateOptions,
    );
    preparedState = prepared.state;
    const result = prepared.truncator.truncate(truncateOptions);

    if (!resultsEqual(lastResult, result)) {
      renderMiddleTruncateParts(element, result);
      lastResult = result;
    }

    if (title === true) {
      element.title = text;
    } else if (typeof title === 'string') {
      element.title = title;
    }
  };
  const scheduleUpdate = () => {
    if (animationFrame !== 0) {
      return;
    }

    animationFrame = requestAnimationFrame(update);
  };
  const updateNow = () => {
    if (animationFrame !== 0) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
    update();
  };
  const updateWithFreshMetrics = () => {
    preparedState = null;
    update();
  };
  const resizeObserver =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          scheduleUpdate();
        });

  if (resolveFontPolicy(element, options) === 'ready') {
    const fonts = (element.ownerDocument as { fonts?: FontFaceSet }).fonts;

    if (fonts === undefined) {
      update();
    } else {
      void fonts.ready.then(updateWithFreshMetrics);
    }
  } else {
    update();
  }

  observeResizePath(resizeObserver, element);
  const cleanupCascade = observeCascadePath(element, updateNow);
  const cleanupFonts = runAfterDocumentFontsLoad(
    element.ownerDocument,
    updateWithFreshMetrics,
  );

  return () => {
    if (animationFrame !== 0) {
      cancelAnimationFrame(animationFrame);
    }

    cleanupFonts();
    cleanupCascade();
    resizeObserver?.disconnect();
  };
}

export const middleTruncateSelector = '[data-middle-truncate]';

export type MiddleTruncatePolyfillOptions = MountMiddleTruncateOptions & {
  observe?: boolean;
  root?: ParentNode;
  selector?: string;
};

/**
 * Upgrade every matching element under `root` and keep watching for new ones.
 *
 * This is the browser-primitive entry point: authors can write plain HTML with
 * `data-middle-truncate`, and frameworks can emit the same markup without
 * owning the measurement loop.
 */
export function setupMiddleTruncatePolyfill(
  options: MiddleTruncatePolyfillOptions = {},
): () => void {
  const root = options.root ?? defaultDocument();

  if (root === undefined) {
    return () => undefined;
  }

  const selector = options.selector ?? middleTruncateSelector;
  const observe = options.observe ?? true;
  const mountOptions = polyfillMountOptions(options);
  const mounted = new Map<HTMLElement, () => void>();

  function mount(element: HTMLElement): void {
    if (mounted.has(element)) {
      return;
    }

    mounted.set(element, mountMiddleTruncate(element, mountOptions));
  }

  function unmount(element: HTMLElement): void {
    const cleanup = mounted.get(element);

    if (cleanup === undefined) {
      return;
    }

    cleanup();
    mounted.delete(element);
  }

  function scan(node: ParentNode): void {
    if (node instanceof HTMLElement && node.matches(selector)) {
      mount(node);
    }

    for (const element of node.querySelectorAll<HTMLElement>(selector)) {
      mount(element);
    }
  }

  function cleanupRemoved(node: Node): void {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (node.matches(selector)) {
      unmount(node);
    }

    for (const element of node.querySelectorAll<HTMLElement>(selector)) {
      unmount(element);
    }
  }

  scan(root);

  const observer =
    observe && typeof MutationObserver !== 'undefined'
      ? new MutationObserver((records) => {
          for (const record of records) {
            for (const node of record.removedNodes) {
              cleanupRemoved(node);
            }
            for (const node of record.addedNodes) {
              if (node instanceof HTMLElement || node instanceof Document) {
                scan(node);
              }
            }
          }
        })
      : null;

  observer?.observe(observedRoot(root), {
    childList: true,
    subtree: true,
  });

  return () => {
    observer?.disconnect();

    for (const cleanup of mounted.values()) {
      cleanup();
    }

    mounted.clear();
  };
}

function polyfillMountOptions(
  options: MiddleTruncatePolyfillOptions,
): MountMiddleTruncateOptions {
  const { observe, root, selector, ...mountOptions } = options;
  void observe;
  void root;
  void selector;

  return mountOptions;
}

function observedRoot(root: ParentNode): Node {
  return root instanceof Document ? root.documentElement : root;
}

function currentMiddleTruncateText(
  element: HTMLElement,
  options: MountMiddleTruncateOptions,
): string {
  if (options.text !== undefined) {
    return options.text;
  }

  return element.textContent;
}

function resultsEqual(
  current: MiddleTruncateResult | null,
  next: MiddleTruncateResult,
): boolean {
  return (
    current !== null &&
    current.before === next.before &&
    current.omitted === next.omitted &&
    current.after === next.after &&
    current.truncated === next.truncated
  );
}

function truncateOptionsFromElement(
  element: HTMLElement,
  options: ElementMiddleTruncateOptions,
): MiddleTruncateOptions {
  const attributeOptions = elementOptionsFromAttributes(element);
  const mergedOptions = {
    ...attributeOptions,
    ...definedElementOptions(options),
  };
  const truncateOptions: MiddleTruncateOptions = {
    ...mergedOptions,
    font: mergedOptions.font ?? fontFromElement(element),
    maxWidth:
      mergedOptions.maxWidth ?? availableContentWidthFromElement(element),
  };
  const pretext = mergePretextOptions(
    pretextOptionsFromElement(element),
    mergedOptions.pretext,
  );

  if (pretext !== undefined) {
    truncateOptions.pretext = pretext;
  }

  return truncateOptions;
}

function elementOptionsFromAttributes(
  element: HTMLElement,
): ElementMiddleTruncateOptions {
  const options: ElementMiddleTruncateOptions = {};
  const balance = parseFiniteNumber(element.dataset.pmtBalance);
  const minStart = parseInteger(element.dataset.pmtMinStart);
  const minEnd = parseInteger(element.dataset.pmtMinEnd);
  const prefer = element.dataset.pmtPrefer;

  if (balance !== undefined) {
    options.balance = balance;
  }
  if (minStart !== undefined) {
    options.minStart = minStart;
  }
  if (minEnd !== undefined) {
    options.minEnd = minEnd;
  }
  if (prefer === 'balanced' || prefer === 'start' || prefer === 'end') {
    options.prefer = prefer;
  }

  return options;
}

function definedElementOptions(
  options: ElementMiddleTruncateOptions,
): ElementMiddleTruncateOptions {
  const defined: ElementMiddleTruncateOptions = {};

  for (const [key, value] of Object.entries(options) as [
    keyof ElementMiddleTruncateOptions,
    unknown,
  ][]) {
    if (value !== undefined) {
      Object.assign(defined, { [key]: value });
    }
  }

  return defined;
}

function resolveFontPolicy(
  element: HTMLElement,
  options: MountMiddleTruncateOptions,
): NonNullable<MountMiddleTruncateOptions['fontPolicy']> {
  if (options.fontPolicy !== undefined) {
    return options.fontPolicy;
  }

  return element.dataset.pmtFontPolicy === 'ready' ? 'ready' : 'current';
}

function mergePretextOptions(
  base: PrepareOptions | undefined,
  override: PrepareOptions | undefined,
): PrepareOptions | undefined {
  if (base === undefined && override === undefined) {
    return undefined;
  }

  return {
    ...base,
    ...override,
  };
}

function parseCssPixelValue(value: string): number | undefined {
  if (value === 'normal') {
    return undefined;
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseFiniteNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseInteger(value: string | undefined): number | undefined {
  const parsed = parseFiniteNumber(value);

  return parsed === undefined ? undefined : Math.trunc(parsed);
}

function defaultDocument(): Document | undefined {
  return (globalThis as { document?: Document }).document;
}

function isFlexOrGridContainer(style: CSSStyleDeclaration): boolean {
  return (
    style.display === 'flex' ||
    style.display === 'inline-flex' ||
    style.display === 'grid' ||
    style.display === 'inline-grid'
  );
}

function cssSizeToPixels(
  value: string,
  percentageReference: number,
): number | undefined {
  if (value === 'none' || value === 'auto' || value.trim() === '') {
    return undefined;
  }

  if (value.endsWith('%')) {
    const percentage = Number.parseFloat(value);

    return Number.isFinite(percentage)
      ? (percentage / 100) * percentageReference
      : undefined;
  }

  return parseCssPixelValue(value);
}

function contentWidthFromCssWidth(
  element: HTMLElement,
  cssWidth: number,
): number {
  const style = getComputedStyle(element);
  const padding =
    parseFloat(style.paddingLeft || '0') +
    parseFloat(style.paddingRight || '0');

  if (style.boxSizing !== 'border-box') {
    return Math.max(0, cssWidth);
  }

  const border =
    parseFloat(style.borderLeftWidth || '0') +
    parseFloat(style.borderRightWidth || '0');

  return Math.max(0, cssWidth - padding - border);
}

function createPart(
  element: HTMLElement,
  className: string,
  text: string,
  attributes: Record<string, string> = {},
): HTMLSpanElement {
  const part = element.ownerDocument.createElement('span');
  part.className = className;
  part.textContent = text;

  for (const [name, value] of Object.entries(attributes)) {
    part.setAttribute(name, value);
  }

  return part;
}
