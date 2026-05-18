export {
  clearMiddleTruncateCache,
  createMiddleTruncator,
  prepareMiddleTruncator,
  truncateMiddle,
} from './core.js';
export type { MiddleTruncatePolyfillOptions } from './dom.js';
export {
  fontFromElement,
  middleTruncateSelector,
  mountMiddleTruncate,
  setupMiddleTruncatePolyfill,
} from './dom.js';
export {
  ensureMiddleTruncateStyles,
  middleTruncateClassNames,
} from './structural-styles.js';
export type {
  MiddleTruncateFontPolicy,
  MiddleTruncateOptions,
  MiddleTruncatePreference,
  MiddleTruncateResult,
  MiddleTruncatorDefaults,
  MountMiddleTruncateOptions,
  PreparedMiddleTruncator,
} from './types.js';
