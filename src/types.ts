import type { PrepareOptions } from '@chenglou/pretext';

export type MiddleTruncatePreference = 'balanced' | 'start' | 'end';
export type MiddleTruncateFontPolicy = 'current' | 'ready';

export type MiddleTruncateOptions = {
  /**
   * Maximum rendered width, in CSS pixels.
   */
  maxWidth: number;

  /**
   * CSS canvas font string, for example `13px ui-monospace` or
   * `500 14px Inter`.
   */
  font: string;

  /**
   * Bias for distributing visible graphemes between the start and end.
   *
   * `0.5` keeps both sides roughly balanced, `0.65` keeps more start text, and
   * `0.35` keeps more end text.
   *
   * @default 0.5
   */
  balance?: number;

  /**
   * Convenience preset for common balance values. Ignored when `balance` is
   * provided.
   *
   * @default "balanced"
   */
  prefer?: MiddleTruncatePreference;

  /**
   * Minimum number of graphemes to keep at the start when possible.
   *
   * @default 1
   */
  minStart?: number;

  /**
   * Minimum number of graphemes to keep at the end when possible.
   *
   * @default 1
   */
  minEnd?: number;

  /**
   * Optional Pretext preparation settings forwarded to `prepareWithSegments`.
   */
  pretext?: PrepareOptions;
};

export type MiddleTruncateMetricsOptions = Pick<
  MiddleTruncateOptions,
  'font' | 'pretext'
>;

export type MiddleTruncateLayoutOptions = Pick<
  MiddleTruncateOptions,
  'maxWidth' | 'balance' | 'prefer' | 'minStart' | 'minEnd'
>;

export type MiddleTruncateResult = {
  /**
   * Visible text before the ellipsis.
   */
  before: string;

  /**
   * Original middle text. Render it inline with zero visual width so browser
   * find and selection still see the full original string.
   */
  omitted: string;

  /**
   * Visible text after the ellipsis.
   */
  after: string;

  /**
   * Original text, equal to `${before}${omitted}${after}`.
   */
  text: string;

  /**
   * Whether the original rendered width is greater than `maxWidth`.
   */
  truncated: boolean;

  /**
   * Rendered width of `before`, in CSS pixels.
   */
  beforeWidth: number;

  /**
   * Rendered width of the fixed ellipsis (`…`), in CSS pixels.
   */
  ellipsisWidth: number;

  /**
   * Rendered width of `after`, in CSS pixels.
   */
  afterWidth: number;

  /**
   * Rendered width occupied by the one-line result, in CSS pixels.
   */
  width: number;

  /**
   * Rendered width of the original input, measured by Pretext.
   */
  originalWidth: number;

  /**
   * Number of graphemes in `before`.
   */
  start: number;

  /**
   * Number of graphemes in `omitted`.
   */
  omittedCount: number;

  /**
   * Number of graphemes in `after`.
   */
  end: number;
};

export type MiddleTruncatorDefaults = Omit<MiddleTruncateOptions, 'maxWidth'>;

export type ElementMiddleTruncateOptions = Omit<
  Partial<MiddleTruncateOptions>,
  'font' | 'maxWidth'
> & {
  font?: string;
  maxWidth?: number;
};

export type MountMiddleTruncateOptions = ElementMiddleTruncateOptions & {
  /**
   * `current` measures with the font the browser is using now and remeasures
   * when web fonts finish loading. `ready` waits for used fonts before the
   * first enhanced render.
   *
   * @default "current"
   */
  fontPolicy?: MiddleTruncateFontPolicy;
  text?: string;
  title?: boolean | string;
};

export type PreparedMiddleTruncator = {
  readonly text: string;
  readonly font: string;
  readonly pretext: PrepareOptions | undefined;
  readonly originalWidth: number;
  readonly ellipsisWidth: number;
  truncate(options: MiddleTruncateLayoutOptions): MiddleTruncateResult;
};
