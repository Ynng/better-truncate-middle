import { clearMiddleTruncateCache } from './core.js';

export function runAfterDocumentFontsLoad(
  documentLike: Document,
  callback: () => void,
): () => void {
  const fonts = (
    documentLike as unknown as {
      fonts?: {
        ready?: Promise<void>;
        addEventListener?: (type: 'loadingdone', listener: () => void) => void;
        removeEventListener?: (
          type: 'loadingdone',
          listener: () => void,
        ) => void;
      };
    }
  ).fonts;

  if (fonts === undefined) {
    return () => undefined;
  }

  let active = true;
  const updateWithFreshCache = () => {
    if (!active) {
      return;
    }

    clearMiddleTruncateCache();
    callback();
  };

  void fonts.ready?.then(updateWithFreshCache);
  fonts.addEventListener?.('loadingdone', updateWithFreshCache);

  return () => {
    active = false;
    fonts.removeEventListener?.('loadingdone', updateWithFreshCache);
  };
}

export function observeResizePath(
  resizeObserver: ResizeObserver | null,
  element: HTMLElement,
): void {
  resizeObserver?.observe(element);

  if (element.parentElement !== null) {
    resizeObserver?.observe(element.parentElement);
  }
}

export function observeCascadePath(
  element: HTMLElement,
  callback: () => void,
): () => void {
  const documentLike = element.ownerDocument;
  const windowLike = documentLike.defaultView;
  const mutationObserver =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
          callback();
        });

  mutationObserver?.observe(element, {
    attributes: true,
    attributeFilter: [
      'style',
      'class',
      'data-pmt-balance',
      'data-pmt-font-policy',
      'data-pmt-min-end',
      'data-pmt-min-start',
      'data-pmt-prefer',
    ],
    characterData: true,
    childList: true,
    subtree: true,
  });

  let current = element.parentElement;

  while (current !== null) {
    mutationObserver?.observe(current, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    current = current.parentElement;
  }

  mutationObserver?.observe(documentLike.head, {
    attributes: true,
    attributeFilter: ['style', 'class', 'href', 'media', 'disabled'],
    childList: true,
    characterData: true,
    subtree: true,
  });
  windowLike?.addEventListener('resize', callback);

  return () => {
    mutationObserver?.disconnect();
    windowLike?.removeEventListener('resize', callback);
  };
}
