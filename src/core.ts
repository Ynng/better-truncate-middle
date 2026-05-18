import {
  clearCache as clearPretextCache,
  measureNaturalWidth,
  type PrepareOptions,
  prepareWithSegments,
} from '@chenglou/pretext';

import type {
  MiddleTruncateLayoutOptions,
  MiddleTruncateMetricsOptions,
  MiddleTruncateOptions,
  MiddleTruncateResult,
  MiddleTruncatorDefaults,
  PreparedMiddleTruncator,
} from './types.js';

const DEFAULT_BALANCE = 0.5;
const ELLIPSIS = '…';

type PreparedMiddleTruncatorState = {
  text: string;
  graphemes: string[];
  font: string;
  pretext: PrepareOptions | undefined;
  originalWidth: number;
  ellipsisWidth: number;
  beforeWidthCache: Map<number, number>;
  afterWidthCache: Map<number, number>;
};

/**
 * Pretext docs: "Do not rerun prepare() for the same text and configs; that'd
 * defeat its precomputation." A bounded LRU keyed by (font, pretext config,
 * text) lets callers like resize/balance/font-change loops reuse prior natural
 * widths instead of re-segmenting and re-walking the same string. Pretext's
 * own per-segment cache is global by font, so cache misses here still benefit
 * from warm canvas measurements.
 */
const WIDTH_CACHE_LIMIT = 4096;
const widthCache = new Map<string, number>();

export function pretextCacheKey(pretext: PrepareOptions | undefined): string {
  if (pretext === undefined) {
    return '';
  }

  return [
    pretext.whiteSpace ?? '',
    pretext.wordBreak ?? '',
    pretext.letterSpacing ?? 0,
  ].join('|');
}

function widthCacheKey(font: string, pretextKey: string, text: string): string {
  return `${font}${pretextKey}${text}`;
}

function measureWidth(
  text: string,
  font: string,
  pretext: PrepareOptions | undefined,
): number {
  const key = widthCacheKey(font, pretextCacheKey(pretext), text);
  const cached = widthCache.get(key);

  if (cached !== undefined) {
    // Refresh recency for LRU.
    widthCache.delete(key);
    widthCache.set(key, cached);

    return cached;
  }

  const prepared =
    pretext === undefined
      ? prepareWithSegments(text, font)
      : prepareWithSegments(text, font, pretext);
  const width = measureNaturalWidth(prepared);

  if (widthCache.size >= WIDTH_CACHE_LIMIT) {
    const oldestKey = widthCache.keys().next().value;

    if (oldestKey !== undefined) {
      widthCache.delete(oldestKey);
    }
  }

  widthCache.set(key, width);

  return width;
}

/**
 * Measure a slice that will be rendered mid-line between the rendered
 * ellipsis and the zero-width omitted span. Pretext's default
 * `white-space: normal` handling strips the leading and trailing single
 * spaces from the input, but the browser keeps them at full width because
 * they are no longer at the start or end of the inline formatting context.
 * Without preserving them here the algorithm undercounts the rendered width
 * and the result overflows. Internal whitespace runs are still collapsed to
 * a single space ourselves to match the browser's behaviour under
 * `white-space: nowrap`.
 */
function measureSliceWidth(
  text: string,
  font: string,
  pretext: PrepareOptions | undefined,
): number {
  if (text === '') {
    return 0;
  }

  return measureWidth(collapseInternalWhitespaceRuns(text), font, {
    ...pretext,
    whiteSpace: 'pre-wrap',
  });
}

function collapseInternalWhitespaceRuns(text: string): string {
  if (!/[\t\n\r\f]| {2,}/.test(text)) {
    return text;
  }

  return text.replace(/[ \t\n\r\f]+/g, ' ');
}

/**
 * Clear the cached natural widths used for truncation.
 *
 * Most apps will never need this. Useful in tests and in the rare case where
 * a font face is dynamically replaced without a different family name.
 */
export function clearMiddleTruncateCache(): void {
  widthCache.clear();
  clearPretextCache();
}

/**
 * Prepare text for repeated middle-truncation layouts under one font and
 * Pretext option set.
 *
 * Call this when text metrics may have changed. Subsequent width-only updates
 * can call `truncate()` on the returned object without re-preparing the full
 * input text.
 */
export function prepareMiddleTruncator(
  input: string,
  options: MiddleTruncateMetricsOptions,
): PreparedMiddleTruncator {
  assertValidMetricsOptions(options);

  const graphemes = splitGraphemes(input);
  const originalWidth = measureWidth(input, options.font, options.pretext);
  const ellipsisWidth = measureWidth(ELLIPSIS, options.font, options.pretext);
  const state: PreparedMiddleTruncatorState = {
    text: input,
    graphemes,
    font: options.font,
    pretext: options.pretext,
    originalWidth,
    ellipsisWidth,
    beforeWidthCache: new Map([
      [0, 0],
      [graphemes.length, originalWidth],
    ]),
    afterWidthCache: new Map([
      [0, 0],
      [graphemes.length, originalWidth],
    ]),
  };

  return {
    text: state.text,
    font: state.font,
    pretext: state.pretext,
    originalWidth: state.originalWidth,
    ellipsisWidth: state.ellipsisWidth,
    truncate: (layoutOptions) => truncatePreparedMiddle(state, layoutOptions),
  };
}

/**
 * Split a string into visible start text, collapsed middle text, and visible
 * end text.
 *
 * This function is for one-line text. Render `omitted` inline with zero visual
 * width and draw the fixed ellipsis with CSS, so the original text stays
 * contiguous in the DOM for browser find and selection.
 */
export function truncateMiddle(
  input: string,
  options: MiddleTruncateOptions,
): MiddleTruncateResult {
  assertValidOptions(options);

  return prepareMiddleTruncator(input, options).truncate(options);
}

function truncatePreparedMiddle(
  prepared: PreparedMiddleTruncatorState,
  options: MiddleTruncateLayoutOptions,
): MiddleTruncateResult {
  assertValidLayoutOptions(options);

  const balance = resolveBalance(options);
  const minStart = Math.max(0, Math.trunc(options.minStart ?? 1));
  const minEnd = Math.max(0, Math.trunc(options.minEnd ?? 1));
  const { graphemes, originalWidth, ellipsisWidth, text } = prepared;

  if (originalWidth <= options.maxWidth) {
    return {
      before: text,
      omitted: '',
      after: '',
      text,
      truncated: false,
      beforeWidth: originalWidth,
      ellipsisWidth: 0,
      afterWidth: 0,
      width: originalWidth,
      originalWidth,
      start: graphemes.length,
      omittedCount: 0,
      end: 0,
    };
  }

  if (ellipsisWidth > options.maxWidth) {
    return {
      before: '',
      omitted: text,
      after: '',
      text,
      truncated: true,
      beforeWidth: 0,
      ellipsisWidth,
      afterWidth: 0,
      width: 0,
      originalWidth,
      start: 0,
      omittedCount: graphemes.length,
      end: 0,
    };
  }

  const best = findBestFit({
    graphemes,
    maxWidth: options.maxWidth,
    minStart,
    minEnd,
    balance,
    ellipsisWidth,
    pretext: prepared.pretext,
    widthForStart: (start) => widthForStart(prepared, start),
    widthForEnd: (end) => widthForEnd(prepared, end),
  });
  const before = graphemes.slice(0, best.start).join('');
  const omitted = graphemes
    .slice(best.start, graphemes.length - best.end)
    .join('');
  const after = best.end === 0 ? '' : graphemes.slice(-best.end).join('');

  return {
    before,
    omitted,
    after,
    text,
    truncated: true,
    beforeWidth: best.beforeWidth,
    ellipsisWidth,
    afterWidth: best.afterWidth,
    width: best.width,
    originalWidth,
    start: best.start,
    omittedCount: graphemes.length - best.start - best.end,
    end: best.end,
  };
}

function widthForStart(
  prepared: PreparedMiddleTruncatorState,
  start: number,
): number {
  const cached = prepared.beforeWidthCache.get(start);

  if (cached !== undefined) {
    return cached;
  }

  const width = measureSliceWidth(
    prepared.graphemes.slice(0, start).join(''),
    prepared.font,
    prepared.pretext,
  );
  prepared.beforeWidthCache.set(start, width);

  return width;
}

function widthForEnd(
  prepared: PreparedMiddleTruncatorState,
  end: number,
): number {
  const cached = prepared.afterWidthCache.get(end);

  if (cached !== undefined) {
    return cached;
  }

  const width = measureSliceWidth(
    end === 0 ? '' : prepared.graphemes.slice(-end).join(''),
    prepared.font,
    prepared.pretext,
  );
  prepared.afterWidthCache.set(end, width);

  return width;
}

/**
 * Create a reusable middle truncator for one font and option set.
 *
 * This keeps Pretext's own internal measurement cache warm and avoids repeating
 * call-site defaults when truncating many strings in the same UI surface.
 */
export function createMiddleTruncator(defaults: MiddleTruncatorDefaults) {
  return (
    input: string,
    options: Pick<MiddleTruncateOptions, 'maxWidth'> &
      Partial<MiddleTruncatorDefaults>,
  ): MiddleTruncateResult =>
    truncateMiddle(input, {
      ...defaults,
      ...options,
    });
}

export function pretextOptionsEqual(
  left: PrepareOptions | undefined,
  right: PrepareOptions | undefined,
): boolean {
  return pretextCacheKey(left) === pretextCacheKey(right);
}

type BestFitInput = {
  graphemes: string[];
  maxWidth: number;
  minStart: number;
  minEnd: number;
  balance: number;
  ellipsisWidth: number;
  pretext: PrepareOptions | undefined;
  widthForStart: (start: number) => number;
  widthForEnd: (end: number) => number;
};

type Candidate = {
  start: number;
  end: number;
  beforeWidth: number;
  afterWidth: number;
  width: number;
};

function findBestFit(input: BestFitInput): Candidate {
  const maxKept = Math.max(0, input.graphemes.length - 1);
  let low = 0;
  let high = maxKept;
  let best = makeCandidateForKeptCount(input, 0);

  while (low <= high) {
    const kept = low + Math.floor((high - low) / 2);
    const candidate = makeCandidateForKeptCount(input, kept);

    if (candidate.width <= input.maxWidth) {
      best = candidate;
      low = kept + 1;
    } else {
      high = kept - 1;
    }
  }

  return best;
}

function makeCandidateForKeptCount(
  input: BestFitInput,
  kept: number,
): Candidate {
  const start = startForKeptCount(
    kept,
    input.minStart,
    input.minEnd,
    input.balance,
  );
  const end = kept - start;

  return makeCandidate(input, start, end);
}

function startForKeptCount(
  kept: number,
  minStart: number,
  minEnd: number,
  balance: number,
): number {
  const preferredStart = Math.round(kept * balance);

  if (kept >= minStart + minEnd) {
    return clamp(preferredStart, minStart, kept - minEnd);
  }

  return clamp(preferredStart, 0, kept);
}

function makeCandidate(
  input: BestFitInput,
  start: number,
  end: number,
): Candidate {
  const beforeWidth = input.widthForStart(start);
  const afterWidth = input.widthForEnd(end);
  const width =
    beforeWidth +
    input.ellipsisWidth +
    afterWidth +
    ellipsisJoinSpacing(input.pretext, start > 0, end > 0);

  return {
    start,
    end,
    beforeWidth,
    afterWidth,
    width,
  };
}

function ellipsisJoinSpacing(
  pretext: PrepareOptions | undefined,
  hasBefore: boolean,
  hasAfter: boolean,
): number {
  const letterSpacing = pretext?.letterSpacing ?? 0;

  if (letterSpacing <= 0) {
    return 0;
  }

  const joins = (hasBefore ? 1 : 0) + (hasAfter ? 1 : 0);

  return joins * letterSpacing;
}

function resolveBalance(options: MiddleTruncateLayoutOptions): number {
  if (options.balance !== undefined) {
    return clamp(options.balance, 0, 1);
  }

  switch (options.prefer) {
    case 'start':
      return 0.65;
    case 'end':
      return 0.35;
    case 'balanced':
    case undefined:
      return DEFAULT_BALANCE;
    default:
      return DEFAULT_BALANCE;
  }
}

function assertValidOptions(options: MiddleTruncateOptions): void {
  assertValidMetricsOptions(options);
  assertValidLayoutOptions(options);
}

function assertValidMetricsOptions(
  options: MiddleTruncateMetricsOptions,
): void {
  if (options.font.trim() === '') {
    throw new TypeError('font must be a non-empty CSS font string.');
  }
}

function assertValidLayoutOptions(options: MiddleTruncateLayoutOptions): void {
  if (!Number.isFinite(options.maxWidth) || options.maxWidth < 0) {
    throw new RangeError(
      'maxWidth must be a finite number greater than or equal to 0.',
    );
  }
}

function splitGraphemes(text: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: 'grapheme',
    });

    return Array.from(segmenter.segment(text), (part) => part.segment);
  }

  return Array.from(text);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
