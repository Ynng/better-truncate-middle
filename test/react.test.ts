import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MiddleTruncate } from '../src/react.js';

describe('MiddleTruncate server rendering', () => {
  it('renders static markup without browser APIs', () => {
    const text =
      'portal-website/apps/web/src/components/review-diff-card.test.tsx';

    const html = renderToStaticMarkup(
      createElement(
        MiddleTruncate,
        {
          className: 'flex-1 font-serif text-lg',
          prefer: 'end',
        },
        text,
      ),
    );

    expect(html).toContain('data-middle-truncate=""');
    expect(html).toContain('class="pmt flex-1 font-serif text-lg"');
    expect(html).not.toContain('aria-label=');
    expect(html).toContain(`title="${text}"`);
    expect(html).toContain('class="pmt__before"');
    expect(html).toContain('data-pmt-truncated="false"');
    expect(html).toContain(`data-pmt-visible-text="${text}"`);
    expect(html).toContain(`<span class="pmt__omitted"></span>`);
    expect(html).toContain(`<span class="pmt__after"`);
    expect(html).not.toContain('pmt__visual');
    expect(html).not.toContain('pmt__text');
    expect(html).not.toContain('pmt__ellipsis');
    expect(html).toContain(text);
  });

  it('renders the full text statically when using the text prop', () => {
    const text = 'ghu_4f2a8d93c17e406db86ad179a02f7c67494ee2fc_session_token';

    const html = renderToStaticMarkup(
      createElement(MiddleTruncate, {
        text,
        title: false,
        style: { maxWidth: 240 },
      }),
    );

    expect(html).toContain('display:inline-block');
    expect(html).toContain('max-width:240px');
    expect(html).toContain('overflow:hidden');
    expect(html).toContain(`<span class="pmt__before"`);
    expect(html).toContain(`>${text}</span>`);
    expect(html).toContain(`<span class="pmt__omitted"></span>`);
    expect(html).toContain(`<span class="pmt__after"`);
    expect(html).not.toContain('pmt__visual');
    expect(html).not.toContain('pmt__text');
    expect(html).not.toContain('pmt__ellipsis');
    expect(html).not.toContain('aria-label=');
    expect(html).not.toContain('title=');
  });
});
