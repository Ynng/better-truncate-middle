import {
  type MiddleTruncatePolyfillOptions,
  middleTruncateSelector,
  setupMiddleTruncatePolyfill,
} from './dom.js';

export {
  type MiddleTruncatePolyfillOptions,
  middleTruncateSelector,
  setupMiddleTruncatePolyfill,
};

declare global {
  interface Window {
    BetterMiddleTruncate?: {
      mount: typeof setupMiddleTruncatePolyfill;
      selector: typeof middleTruncateSelector;
    };
  }
}

if (typeof window !== 'undefined') {
  window.BetterMiddleTruncate = {
    mount: setupMiddleTruncatePolyfill,
    selector: middleTruncateSelector,
  };

  setupMiddleTruncatePolyfill();
}
