# better-truncate-middle

A polyfill for [`text-overflow-middle: ellipsis`](https://www.w3.org/wiki/Text-overflow_middle_cropping),
the CSS proposal the browser never shipped. Pixel-accurate, microsecond-fast,
zero-config, and the full string stays in the DOM for copy, find, and
accessibility.

Use it for paths, URLs, IDs, branch names, migration filenames, or any compact
label where both ends carry meaning:

```txt
20260509071530_add_index_to_payment_reconciliation_events_on_organization_id_external_payment_provider_and_external_payment_id
20260509071530_add...ternal_payment_id
```

Only the rendering is truncated. The element still holds the full inline text,
so selection, copy, find-in-page, screen readers, and search crawlers all see
the original string, exactly as you wrote it.

## Install

```sh
npm install better-truncate-middle
```

## React

```tsx
import { MiddleTruncate } from 'better-truncate-middle/react';

export function BranchLabel() {
  return (
    <div className="flex min-w-0 items-center gap-2 font-serif text-lg">
      <span>branch</span>
      <MiddleTruncate className="min-w-0 flex-1" prefer="end">
        feature/really-long-flexible-middle-label-final-check
      </MiddleTruncate>
      <span>ready</span>
    </div>
  );
}
```

If you server-render, also import `better-truncate-middle/styles.css` once in
your app root.

## HTML

Add `data-middle-truncate` to any element and call
`setupMiddleTruncatePolyfill()` once. It enhances every match and watches
for new ones.

```html
<link rel="stylesheet" href="/better-truncate-middle/styles.css" />

<span data-middle-truncate style="max-width: 320px">
  20260509071530_add_index_to_payment_reconciliation_events_on_organization_id_external_payment_provider_and_external_payment_id
</span>
```

```ts
import 'better-truncate-middle/styles.css';
import { setupMiddleTruncatePolyfill } from 'better-truncate-middle';

setupMiddleTruncatePolyfill();
```

For a single element you manage yourself:

```ts
import { mountMiddleTruncate } from 'better-truncate-middle';

const cleanup = mountMiddleTruncate(
  document.querySelector('[data-path]'),
  { prefer: 'end' },
);
```

## Render-blocking polyfill (correct first paint)

To get the measured middle split on the very first frame, mount the pre-built
bundle as a render-blocking script in `<head>`:

```html
<head>
  <link rel="stylesheet" href="/better-truncate-middle/styles.css" />
  <script
    src="/better-truncate-middle/polyfill.global.js"
    blocking="render"
    fetchpriority="high"
  ></script>
</head>
```

`blocking="render"` makes the browser wait until the script has run before
painting. `polyfill.global.js` is small, has no dependencies, and works the
same way against SSR React markup before hydration. Serve it from your origin
or `https://unpkg.com/better-truncate-middle/dist/polyfill.global.js`.

## Options

```ts
type MiddleTruncateOptions = {
  maxWidth: number;
  font: string;
  balance?: number;
  prefer?: 'balanced' | 'start' | 'end';
  minStart?: number;
  minEnd?: number;
  pretext?: import('@chenglou/pretext').PrepareOptions;
};

type MountMiddleTruncateOptions = Partial<MiddleTruncateOptions> & {
  fontPolicy?: 'current' | 'ready';
  text?: string;
  title?: boolean | string;
};
```

- `balance`: a number from `0` to `1`. Closer to `1` keeps more of the start,
  closer to `0` keeps more of the end. Defaults to `0.5`.
- `prefer`: preset for `balance`. `"start"` is `0.65`, `"balanced"` is `0.5`,
  `"end"` is `0.35`.
- `minStart` / `minEnd`: minimum graphemes to keep visible on each side.
- `fontPolicy`: `"current"` (default) measures with the current font and
  recomputes when web fonts swap in. Use `"ready"` to delay the first
  measurement until `document.fonts.ready` instead.

## Low-level API

When you already know the font and width, or want to render the parts
yourself, call `truncateMiddle` directly:

```ts
import { truncateMiddle } from 'better-truncate-middle';

const result = truncateMiddle(
  '20260509071530_add_index_to_payment_reconciliation_events_on_organization_id_external_payment_provider_and_external_payment_id',
  {
    maxWidth: 320,
    font: '13px ui-monospace, SFMono-Regular, Menlo, monospace',
    prefer: 'end',
  },
);
// { before, omitted, after, truncated }
```

## Development

```sh
npm install
npm run check       # biome + tsc + vitest
npm run build       # tsup, writes dist/
npm run web         # vite SSR dev server on http://localhost:6008
```

The Playwright suite (`npm run e2e`) covers the demo, font loading, the React
wrapper, stress fixtures, resize behavior, inherited fonts, CJK text, browser
find, and selection.

## License

MIT
