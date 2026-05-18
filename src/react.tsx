import {
  type CSSProperties,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
} from 'react';

import { mountMiddleTruncate } from './dom.js';
import {
  ensureMiddleTruncateStyles,
  middleTruncateClassNames,
} from './structural-styles.js';
import type {
  MiddleTruncateOptions,
  MountMiddleTruncateOptions,
} from './types.js';

type SpanProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'title'>;

export type MiddleTruncateProps = SpanProps & {
  /** Text to render. When omitted, string children are used. */
  text?: string;
  /** String children are accepted for ergonomic JSX usage. */
  children?: ReactNode;
  /** Optional CSS font shorthand applied to the rendered element. */
  font?: string;
  /** Optional max width. Usually you can use normal CSS instead. */
  maxWidth?: number;
  /** Bias for distributing visible graphemes between start and end. */
  balance?: MiddleTruncateOptions['balance'];
  /** Convenience preset for common balance values. */
  prefer?: MiddleTruncateOptions['prefer'];
  minStart?: MiddleTruncateOptions['minStart'];
  minEnd?: MiddleTruncateOptions['minEnd'];
  pretext?: MiddleTruncateOptions['pretext'];
  fontPolicy?: 'current' | 'ready';
  /** Tooltip text. Defaults to the full string. Pass `false` to omit it. */
  title?: string | false;
};

const useIsomorphicInsertionEffect =
  typeof window === 'undefined' ? noServerEffect : useInsertionEffect;
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? noServerEffect : useLayoutEffect;

function noServerEffect(): void {}

export const MiddleTruncate = forwardRef<HTMLSpanElement, MiddleTruncateProps>(
  function MiddleTruncate(
    {
      text,
      children,
      font,
      maxWidth,
      balance,
      prefer = 'balanced',
      minStart,
      minEnd,
      pretext,
      fontPolicy = 'current',
      title,
      className,
      style,
      ...spanProps
    },
    forwardedRef,
  ) {
    const rootRef = useRef<HTMLSpanElement>(null);
    const value = text ?? textFromChildren(children);

    useImperativeHandle(forwardedRef, () => {
      if (rootRef.current === null) {
        throw new Error('MiddleTruncate ref is not mounted.');
      }
      return rootRef.current;
    });

    useIsomorphicInsertionEffect(() => {
      ensureMiddleTruncateStyles(rootRef.current?.ownerDocument);
    }, []);

    useIsomorphicLayoutEffect(() => {
      const element = rootRef.current;
      if (element === null) return undefined;

      return mountMiddleTruncate(
        element,
        definedMountOptions({
          balance,
          font,
          fontPolicy,
          maxWidth,
          minEnd,
          minStart,
          prefer,
          pretext,
          text: value,
          title: title === false ? false : (title ?? true),
        }),
      );
    }, [
      balance,
      font,
      fontPolicy,
      maxWidth,
      minEnd,
      minStart,
      prefer,
      pretext,
      title,
      value,
    ]);

    const rootStyle: CSSProperties = {
      display: 'inline-block',
      maxWidth: '100%',
      minWidth: 0,
      overflow: 'hidden',
      verticalAlign: 'bottom',
      whiteSpace: 'nowrap',
      ...(font === undefined ? null : { font }),
      ...style,
      ...(maxWidth === undefined ? null : { maxWidth }),
    };
    const titleValue = title === false ? undefined : (title ?? value);

    return (
      <span
        {...spanProps}
        ref={rootRef}
        data-middle-truncate=""
        data-pmt-balance={balance}
        data-pmt-font-policy={fontPolicy === 'ready' ? 'ready' : undefined}
        data-pmt-min-end={minEnd}
        data-pmt-min-start={minStart}
        data-pmt-prefer={prefer === 'balanced' ? undefined : prefer}
        className={[middleTruncateClassNames.root, className]
          .filter(Boolean)
          .join(' ')}
        style={rootStyle}
        suppressHydrationWarning
        title={titleValue}
      >
        <span
          className={middleTruncateClassNames.before}
          data-pmt-truncated="false"
          data-pmt-visible-text={value}
          suppressHydrationWarning
        >
          {value}
        </span>
        <span
          className={middleTruncateClassNames.omitted}
          suppressHydrationWarning
        />
        <span
          className={middleTruncateClassNames.after}
          data-pmt-visible-text=""
          suppressHydrationWarning
        />
      </span>
    );
  },
);

function definedMountOptions(options: {
  balance: MountMiddleTruncateOptions['balance'] | undefined;
  font: MountMiddleTruncateOptions['font'] | undefined;
  fontPolicy: NonNullable<MountMiddleTruncateOptions['fontPolicy']>;
  maxWidth: MountMiddleTruncateOptions['maxWidth'] | undefined;
  minEnd: MountMiddleTruncateOptions['minEnd'] | undefined;
  minStart: MountMiddleTruncateOptions['minStart'] | undefined;
  prefer: MountMiddleTruncateOptions['prefer'] | undefined;
  pretext: MountMiddleTruncateOptions['pretext'] | undefined;
  text: string;
  title: MountMiddleTruncateOptions['title'] | undefined;
}): MountMiddleTruncateOptions {
  const defined: MountMiddleTruncateOptions = {
    fontPolicy: options.fontPolicy,
    text: options.text,
  };

  if (options.balance !== undefined) defined.balance = options.balance;
  if (options.font !== undefined) defined.font = options.font;
  if (options.maxWidth !== undefined) defined.maxWidth = options.maxWidth;
  if (options.minEnd !== undefined) defined.minEnd = options.minEnd;
  if (options.minStart !== undefined) defined.minStart = options.minStart;
  if (options.prefer !== undefined) defined.prefer = options.prefer;
  if (options.pretext !== undefined) defined.pretext = options.pretext;
  if (options.title !== undefined) defined.title = options.title;

  return defined;
}

function textFromChildren(children: ReactNode): string {
  if (
    typeof children === 'string' ||
    typeof children === 'number' ||
    typeof children === 'bigint'
  ) {
    return String(children);
  }
  if (
    children === null ||
    children === undefined ||
    typeof children === 'boolean'
  ) {
    return '';
  }
  if (Array.isArray(children)) {
    return children.map(textFromChildren).join('');
  }
  if (isIterable(children)) {
    return Array.from(children, textFromChildren).join('');
  }
  return '';
}

function isIterable(value: unknown): value is Iterable<ReactNode> {
  return (
    typeof value === 'object' && value !== null && Symbol.iterator in value
  );
}
