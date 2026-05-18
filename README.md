# better-truncate-middle

One-line middle truncation by rendered width, without breaking browser find,
selection, copy, accessibility, or indexing.

Use it for paths, URLs, IDs, branch names, database migration filenames, and
other compact labels where both ends matter:

```txt
20260509071530_add_index_to_payment_reconciliation_events_on_organization_id_external_payment_provider_and_external_payment_id
20260509071530_add...ternal_payment_id
```

The important part: the full original string stays in the DOM as one inline text
stream. After measurement, the rendered structure is real beginning text, the
original omitted middle at zero visual width, and real ending text; the ellipsis
is CSS on that same inline flow. Browser search can match across the truncation
boundary, assistive technology can read the full text, and selection/copy uses
the original string instead of a separate visual imitation.

## Install

```sh
npm install better-truncate-middle
```

Import the structural CSS once:

```ts
import 'better-truncate-middle/styles.css';
```

Without JavaScript, that CSS gives the element a safe native one-line clipping
fallback. With JavaScript, the DOM polyfill upgrades it to measured Pretext
middle truncation.

## HTML Polyfill

The core API is native markup:

```html
<span data-middle-truncate data-pmt-prefer="end" style="max-width: 320px">
  20260509071530_add_index_to_payment_reconciliation_events_on_organization_id_external_payment_provider_and_external_payment_id
</span>
```

Progressive enhancement: call `setupMiddleTruncatePolyfill` from your app
entry. It scans for `[data-middle-truncate]` elements, enhances each one, and
returns a cleanup function.

```ts
import { setupMiddleTruncatePolyfill } from 'better-truncate-middle';

const cleanup = setupMiddleTruncatePolyfill();
```

Until the polyfill runs, the structural CSS clips the text with a native
one-line `text-overflow: ellipsis` so the page never shows broken layout. When
the script lands, every `[data-middle-truncate]` element switches to its
measured middle-truncated form.

## First-paint mode

By default, the polyfill runs after the rest of your app loads, so the first
paint shows the end-clipped fallback and then upgrades to the middle-truncated
form. If you want the middle-truncated layout on the very first frame, mount
the polyfill as a render-blocking script in `<head>`.

### Drop-in `<script>` tag

The fastest path is the pre-built single-file browser bundle:

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

- `blocking="render"` tells the browser to wait until the script has executed
  before painting. The polyfill scans the parsed DOM for
  `[data-middle-truncate]` elements and writes their measured splits in-place
  before the first frame.
- `fetchpriority="high"` raises the script's network priority so it doesn't
  sit behind low-priority assets.
- You can serve `polyfill.global.js` from your own origin (recommended) or
  from a CDN such as `https://unpkg.com/better-truncate-middle/dist/polyfill.global.js`.

`polyfill.global.js` is sized to be small enough to live in the critical path;
it has no transitive dependencies.

### ESM via your bundler

If your app bundler owns the document pipeline, import the side-effect entry
near the top of your client entry instead of using a `<script>` tag:

```ts
import 'better-truncate-middle/polyfill';
```

The same auto-mount runs at import time. Make sure this import is reachable
from the entry that runs before your first render (for example, the file
referenced by `<script type="module" src="…">` in `index.html`).

### SSR and hydration

The React component renders deterministic SSR markup that contains the full
original string. Without JavaScript, the structural CSS clips with a native
ellipsis. When JavaScript runs, the measured split replaces the fallback
without a visible flash, because both forms share the same outer width and the
same text node. Hydration is safe; the component sets
`suppressHydrationWarning` on the affected subtree.

If you want React's first paint to already show the measured split (for
example, in a server-rendered application where you ship the polyfill in the
critical path), mount `polyfill.global.js` in the head as above. The polyfill
runs against React's SSR output before hydration, so React picks up the
already-enhanced DOM.

Use first-paint mode when correct middle truncation matters more than a few
hundred bytes on the critical path. The default API does not force a
render-blocking resource on users.

## React

The React component is a wrapper around the same native contract. It renders
`data-middle-truncate` markup and delegates measurement to the DOM helper.

```tsx
import { MiddleTruncate } from 'better-truncate-middle/react';

export function FileLabel() {
  return (
    <MiddleTruncate style={{ maxWidth: 320 }} prefer="end">
      20260509071530_add_index_to_payment_reconciliation_events_on_organization_id_external_payment_provider_and_external_payment_id
    </MiddleTruncate>
  );
}
```

Font styles can live on the component or be inherited from a parent. Width,
`min-width`, `max-width`, flex/grid sizing, font loading, and resize behavior are
observed from the real element.

```tsx
<div className="flex min-w-0 items-center gap-2 font-serif text-lg">
  <span>branch</span>
  <MiddleTruncate className="min-w-0 flex-1" prefer="end">
    feature/really-long-flexible-middle-label-final-check
  </MiddleTruncate>
  <span>ready</span>
</div>
```

For React apps that need the first visible paint to already be enhanced, include
the polyfill script in the document head before hydration. The component remains
hydration-safe because the source text structure is deterministic.

## Plain JavaScript

Use `mountMiddleTruncate` for one element you manage yourself:

```ts
import { mountMiddleTruncate } from 'better-truncate-middle';

const element = document.querySelector<HTMLElement>('[data-path]')!;
const cleanup = mountMiddleTruncate(element, {
  prefer: 'end',
});
```

```html
<span data-path style="max-width: 320px">
  20260509071530_add_index_to_payment_reconciliation_events_on_organization_id_external_payment_provider_and_external_payment_id
</span>
```

## Font Policy

The default font policy is `"current"`:

1. Measure with the font the browser is using now.
2. Render the real Pretext middle truncation.
3. Recompute when used web fonts finish loading.

That matches the platform: if the active font changes, layout changes and the
polyfill updates. `fontPolicy: "ready"` is available when you would rather wait
for `document.fonts.ready` before the first enhanced render.

## Low-Level API

Use `truncateMiddle` directly when you already know the font and width, or when
you want to render the parts yourself.

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
```

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

- `balance`: arbitrary value from `0` to `1`; closer to `1` keeps more start
  text, closer to `0` keeps more end text.
- `prefer`: preset for `balance`: `"start"` is `0.65`, `"balanced"` is `0.5`,
  and `"end"` is `0.35`.
- `minStart` and `minEnd`: minimum graphemes to keep visible on each side when
  possible.
- `fontPolicy`: `"current"` by default; use `"ready"` only when font-swap
  recomputation is less acceptable than delaying enhancement.

## Scope

This library intentionally targets one-line text. It is for compact labels where
searchability and copy fidelity matter as much as fitting the text.

Compared with `text-overflow: ellipsis`, this library:

- truncates in the middle instead of the end;
- keeps the full original string in the DOM for find, selection, copy,
  accessibility, and indexing;
- uses Pretext measurement against the actual computed font and element width;
- lets applications choose progressive loading or a critical first-paint
  polyfill path.

## Development

```sh
npm install
npm run check
npm run build
npm pack --dry-run
```

Run the demo site (Vite dev server with SSR):

```sh
npm run web
```

The Playwright suite exercises the demo, font loading, native React wrapper,
stress fixtures, resize behavior, inherited fonts, CJK text, browser find,
and selection.
