const STYLE_ID = 'better-truncate-middle-styles';

export const middleTruncateClassNames = {
  root: 'pmt',
  before: 'pmt__before',
  omitted: 'pmt__omitted',
  after: 'pmt__after',
} as const;

export const middleTruncateStyles = `:where(.pmt) {
  display: inline-block;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  position: relative;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

:where(.pmt__before),
:where(.pmt__omitted),
:where(.pmt__after) {
  display: inline;
}

:where(.pmt__before[data-pmt-truncated="true"])::after {
  content: "…";
}

:where(.pmt__omitted) {
  color: transparent;
  font-size: 0;
  letter-spacing: 0;
  word-spacing: 0;
}
`;

/**
 * Install the small structural stylesheet used by the DOM and React helpers.
 *
 * Framework users can skip this when importing `better-truncate-middle/styles.css`.
 */
export function ensureMiddleTruncateStyles(
  documentLike: Document | undefined = defaultDocument(),
): void {
  if (documentLike === undefined) {
    return;
  }

  if (documentLike.getElementById(STYLE_ID) !== null) {
    return;
  }

  const style = documentLike.createElement('style');
  style.id = STYLE_ID;
  style.textContent = middleTruncateStyles;
  documentLike.head.appendChild(style);
}

function defaultDocument(): Document | undefined {
  return (globalThis as { document?: Document }).document;
}
