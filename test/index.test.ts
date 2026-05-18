import { afterEach, describe, expect, it } from 'vitest';

import {
  createMiddleTruncator,
  ensureMiddleTruncateStyles,
  fontFromElement,
  prepareMiddleTruncator,
  truncateMiddle,
} from '../src/index.js';

class TestCanvasContext {
  font = '';

  measureText(text: string): TextMetrics {
    let width = 0;

    for (const character of Array.from(text)) {
      width += character === '…' || character === '.' ? 4 : 10;
    }

    return { width } as TextMetrics;
  }
}

class TestOffscreenCanvas {
  getContext(): TestCanvasContext {
    return new TestCanvasContext();
  }
}

globalThis.OffscreenCanvas =
  TestOffscreenCanvas as unknown as typeof OffscreenCanvas;

describe('truncateMiddle', () => {
  it('returns one before segment when the text already fits', () => {
    const result = truncateMiddle('short.txt', {
      font: '16px monospace',
      maxWidth: 90,
    });

    expect(result).toMatchObject({
      before: 'short.txt',
      omitted: '',
      after: '',
      text: 'short.txt',
      truncated: false,
    });
  });

  it('splits text into visible ends and a collapsed middle', () => {
    const result = truncateMiddle(
      'portal-website/apps/web/src/components/review-diff-card.test.tsx',
      {
        font: '16px monospace',
        maxWidth: 250,
      },
    );

    expect(result.truncated).toBe(true);
    expect(`${result.before}${result.omitted}${result.after}`).toBe(
      result.text,
    );
    expect(result.before.startsWith('portal')).toBe(true);
    expect(result.omitted.length).toBeGreaterThan(0);
    expect(result.after.endsWith('.tsx')).toBe(true);
    expect(result.width).toBeLessThanOrEqual(250);
  });

  it('can bias toward preserving more end text', () => {
    const balanced = truncateMiddle('abcdefghijABCDEFGHIJ', {
      font: '16px monospace',
      maxWidth: 90,
    });
    const endHeavy = truncateMiddle('abcdefghijABCDEFGHIJ', {
      font: '16px monospace',
      maxWidth: 90,
      prefer: 'end',
    });

    expect(endHeavy.end).toBeGreaterThan(balanced.end);
    expect(endHeavy.afterWidth).toBeGreaterThan(balanced.afterWidth);
  });

  it('does not split emoji grapheme clusters', () => {
    const result = truncateMiddle('start-👨‍👩‍👧‍👦-middle-end', {
      font: '16px monospace',
      maxWidth: 120,
    });

    expect(result.before.endsWith('\u200d')).toBe(false);
    expect(result.omitted.startsWith('\u200d')).toBe(false);
    expect(result.omitted.endsWith('\u200d')).toBe(false);
    expect(result.after.startsWith('\u200d')).toBe(false);
    expect(`${result.before}${result.omitted}${result.after}`).toBe(
      result.text,
    );
  });

  it('accounts for Pretext letter-spacing options', () => {
    const normal = truncateMiddle('abcdefghijklmnopqrst', {
      font: '16px monospace',
      maxWidth: 100,
    });
    const spaced = truncateMiddle('abcdefghijklmnopqrst', {
      font: '16px monospace',
      maxWidth: 100,
      pretext: { letterSpacing: 6 },
    });

    expect(spaced.width).toBeLessThanOrEqual(100);
    expect(spaced.start + spaced.end).toBeLessThan(normal.start + normal.end);
  });

  it('accounts for letter-spacing around the rendered ellipsis', () => {
    const result = truncateMiddle('abcdefghijklmnopqrst', {
      font: '16px monospace',
      maxWidth: 120,
      pretext: { letterSpacing: 6 },
    });

    expect(result.before).not.toBe('');
    expect(result.after).not.toBe('');
    expect(result.width).toBe(
      result.beforeWidth + result.ellipsisWidth + result.afterWidth + 12,
    );
  });

  it('adds visible graphemes monotonically as width increases', () => {
    const results = Array.from({ length: 24 }, (_, index) =>
      truncateMiddle('abcdefghijklmnopqrstuvwxyz0123456789', {
        font: '16px monospace',
        maxWidth: 40 + index * 8,
      }),
    );

    for (let index = 1; index < results.length; index += 1) {
      const previous = results[index - 1];
      const current = results[index];

      if (previous === undefined || current === undefined) {
        throw new Error('Missing monotonic truncation result.');
      }

      expect(current.width).toBeLessThanOrEqual(40 + index * 8);
      expect(current.start + current.end).toBeGreaterThanOrEqual(
        previous.start + previous.end,
      );
      expect(current.start).toBeGreaterThanOrEqual(previous.start);
      expect(current.end).toBeGreaterThanOrEqual(previous.end);
    }
  });

  it('creates reusable truncators with shared defaults', () => {
    const truncate = createMiddleTruncator({
      font: '16px monospace',
      prefer: 'end',
    });

    const result = truncate('src/components/review-diff-card.test.tsx', {
      maxWidth: 160,
    });

    expect(result.truncated).toBe(true);
    expect(result.after.endsWith('.tsx')).toBe(true);
  });

  it('reuses prepared metrics across width-only layouts', () => {
    const prepared = prepareMiddleTruncator('abcdefghijklmnopqrstuvwxyz', {
      font: '16px monospace',
    });
    const narrow = prepared.truncate({ maxWidth: 90 });
    const wide = prepared.truncate({ maxWidth: 150 });

    expect(narrow.truncated).toBe(true);
    expect(wide.truncated).toBe(true);
    expect(wide.start + wide.end).toBeGreaterThan(narrow.start + narrow.end);
    expect(prepared.originalWidth).toBe(wide.originalWidth);
  });

  it('rejects invalid options early', () => {
    expect(() =>
      truncateMiddle('abc', {
        font: '16px monospace',
        maxWidth: Number.NaN,
      }),
    ).toThrow(RangeError);

    expect(() =>
      truncateMiddle('abc', {
        font: ' ',
        maxWidth: 10,
      }),
    ).toThrow(TypeError);
  });

  it('does not require a DOM to skip stylesheet injection', () => {
    expect(() => {
      ensureMiddleTruncateStyles(undefined);
    }).not.toThrow();
  });

  it('keeps boundary whitespace inside the budget', () => {
    /*
     * Pretext's default `white-space: normal` measurement strips the leading
     * and trailing single space from any string it measures. The before/after
     * slices here live mid-line between the rendered ellipsis and the
     * zero-width omitted span, so the browser keeps the boundary space at
     * full width. If the algorithm forwarded the slice to Pretext as-is the
     * reported width would be smaller than what is actually painted and the
     * truncated value would overflow its container.
     */
    for (const text of [
      'Hello there friend, this is a test sentence',
      'aaa  bbb  ccc  ddd  eee  fff  ggg  hhh',
      "America Again: Re-becoming the Greatness We Never Weren't",
    ]) {
      for (const maxWidth of [120, 160, 200, 240, 280]) {
        const result = truncateMiddle(text, {
          font: '16px monospace',
          maxWidth,
        });
        const rendered =
          simulateRenderedWidth(result.before) +
          simulateRenderedWidth('…') +
          simulateRenderedWidth(result.after);

        expect(
          rendered,
          `text=${JSON.stringify(text)} maxWidth=${String(maxWidth)} before=${JSON.stringify(result.before)} after=${JSON.stringify(result.after)}`,
        ).toBeLessThanOrEqual(maxWidth);
      }
    }
  });
});

function simulateRenderedWidth(text: string): number {
  // Model `white-space: nowrap` rendering of a slice placed mid-line:
  // internal whitespace runs collapse to a single space, but any single
  // boundary space is kept because adjacent content from another span
  // prevents it from being treated as line-edge whitespace.
  const collapsed = text.replace(/[ \t\n\r\f]+/g, ' ');
  let width = 0;
  for (const character of Array.from(collapsed)) {
    width += character === '…' || character === '.' ? 4 : 10;
  }
  return width;
}

describe('fontFromElement', () => {
  type ComputedStyleStub = Record<string, string>;
  const baseStyle: ComputedStyleStub = {
    font: '',
    fontStyle: 'normal',
    fontVariant: 'normal',
    fontWeight: '400',
    fontSize: '13px',
    lineHeight: 'normal',
    fontFamily: 'ui-monospace, monospace',
  };

  function stubComputedStyle(overrides: Partial<ComputedStyleStub>): void {
    const merged = { ...baseStyle, ...overrides };
    (globalThis as { getComputedStyle?: unknown }).getComputedStyle = () =>
      merged as unknown as CSSStyleDeclaration;
  }

  afterEach(() => {
    delete (globalThis as { getComputedStyle?: unknown }).getComputedStyle;
  });

  it('returns the computed `font` shorthand when present', () => {
    stubComputedStyle({ font: '13px ui-monospace, monospace' });

    expect(fontFromElement({} as Element)).toBe('13px ui-monospace, monospace');
  });

  it('drops `font-variant: none` so canvas does not reject the shorthand', () => {
    /*
     * `font-variant-ligatures: none` (and other sub-properties) makes
     * `getComputedStyle().fontVariant` resolve to `"none"`. That token is not
     * legal in the CSS2.1 `<font>` shorthand grammar that canvas parses, so a
     * naive forward of `style.fontVariant` causes canvas to reject the entire
     * string and silently fall back to `10px sans-serif`, destroying every
     * subsequent measurement.
     */
    stubComputedStyle({ fontVariant: 'none' });

    expect(fontFromElement({} as Element)).toBe(
      '400 13px ui-monospace, monospace',
    );
  });

  it('keeps `small-caps` font-variant and italic font-style', () => {
    stubComputedStyle({ fontVariant: 'small-caps', fontStyle: 'italic' });

    expect(fontFromElement({} as Element)).toBe(
      'italic small-caps 400 13px ui-monospace, monospace',
    );
  });

  it('normalises angled oblique to the bare keyword', () => {
    stubComputedStyle({ fontStyle: 'oblique 14deg' });

    expect(fontFromElement({} as Element)).toBe(
      'oblique 400 13px ui-monospace, monospace',
    );
  });
});
