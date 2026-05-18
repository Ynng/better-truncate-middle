import { useEffect, useRef, useState } from 'react';
import { MiddleTruncate } from '../src/react.js';
import { highlight } from './highlight.js';

const DEFAULT_TEXT =
  "America Again: Re-becoming the Greatness We Never Weren't by Stephen Colbert (978-0446583978)";
const DEFAULT_BALANCE = 0.5;
const NEWLINE = /[\r\n]+/g;

type FontKey = 'inter' | 'manrope' | 'serif' | 'geistMono' | 'jetbrains';

type FontOption = {
  key: FontKey;
  label: string;
  cssFamily: string;
};

const fontOptions: readonly FontOption[] = [
  {
    key: 'inter',
    label: 'Inter',
    cssFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
  {
    key: 'manrope',
    label: 'Manrope',
    cssFamily: '"Manrope", ui-sans-serif, system-ui, sans-serif',
  },
  {
    key: 'serif',
    label: 'Source Serif',
    cssFamily: '"Source Serif 4", ui-serif, Georgia, serif',
  },
  {
    key: 'geistMono',
    label: 'Geist Mono',
    cssFamily: '"Geist Mono", ui-monospace, monospace',
  },
  {
    key: 'jetbrains',
    label: 'JetBrains Mono',
    cssFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
];

type CodeLang = 'react' | 'html';

export function Demo() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [balance, setBalance] = useState(DEFAULT_BALANCE);
  const [fontKey, setFontKey] = useState<FontKey>('inter');
  const [codeLang, setCodeLang] = useState<CodeLang>('react');

  const font = resolveFont(fontKey);

  return (
    <div className="demo">
      <div className="demo-column">
        <PreviewPanel text={text} balance={balance} font={font} />

        <ControlsPanel
          text={text}
          onTextChange={setText}
          balance={balance}
          onBalanceChange={setBalance}
          fontKey={fontKey}
          onFontChange={setFontKey}
        />
      </div>

      <CodeFrame
        lang={codeLang}
        onLangChange={setCodeLang}
        code={
          codeLang === 'react'
            ? buildReactSnippet({ balance })
            : buildHtmlSnippet({ balance })
        }
      />
    </div>
  );
}

/* ==========================================================================
   Rendered output frame
   ========================================================================== */

function PreviewPanel({
  text,
  balance,
  font,
}: {
  text: string;
  balance: number;
  font: FontOption;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = parentRef.current;
    if (parent === null) return undefined;
    const track = parent.parentElement;
    if (track === null) return undefined;

    const clampToTrack = (): void => {
      const max = track.clientWidth;
      if (max > 0 && parent.offsetWidth > max) {
        parent.style.width = `${String(max)}px`;
      }
    };

    const observer = new ResizeObserver(clampToTrack);
    observer.observe(parent);
    observer.observe(track);
    clampToTrack();
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section className="storybook-panel storybook-preview" aria-label="Preview">
      <header className="storybook-panel-head">
        <span className="storybook-panel-eyebrow">Preview</span>
        <span className="storybook-panel-hints">
          <span className="storybook-panel-hint">
            <svg
              viewBox="0 0 16 16"
              width={11}
              height={11}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="4" />
              <path d="M10 10l4 4" />
            </svg>
            select, copy, or find any part of the text
          </span>
          <span className="storybook-panel-hint">
            <svg
              viewBox="0 0 16 16"
              width={11}
              height={11}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 6v8H6" />
              <path d="M10 10l4 4" />
            </svg>
            drag the grip to resize
          </span>
        </span>
      </header>
      <div className="storybook-canvas">
        <div className="demo-resize-track">
          <div
            ref={parentRef}
            className="demo-parent"
            style={{ fontFamily: font.cssFamily }}
          >
            <MiddleTruncate balance={balance} className="demo-target">
              {text}
            </MiddleTruncate>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   Controls (compact, no surrounding card)
   ========================================================================== */

function ControlsPanel({
  text,
  onTextChange,
  balance,
  onBalanceChange,
  fontKey,
  onFontChange,
}: {
  text: string;
  onTextChange: (next: string) => void;
  balance: number;
  onBalanceChange: (next: number) => void;
  fontKey: FontKey;
  onFontChange: (next: FontKey) => void;
}) {
  return (
    <section
      className="storybook-panel storybook-controls"
      aria-label="Controls"
    >
      <header className="storybook-panel-head">
        <span className="storybook-panel-eyebrow">Controls</span>
      </header>
      <div className="storybook-controls-body">
        <TextEditor text={text} onTextChange={onTextChange} />
        <div className="demo-controls-row">
          <Slider
            label="Balance"
            displayValue={formatBalance(balance)}
            value={balance}
            min={0}
            max={1}
            step={0.01}
            onChange={onBalanceChange}
          />
          <FontPicker value={fontKey} onChange={onFontChange} />
        </div>
      </div>
    </section>
  );
}

function TextEditor({
  text,
  onTextChange,
}: {
  text: string;
  onTextChange: (next: string) => void;
}) {
  return (
    <div className="ctrl ctrl-text">
      <div className="ctrl-head">
        <span className="ctrl-label">Text</span>
        <button
          type="button"
          className="ctrl-reset"
          onClick={() => {
            onTextChange(DEFAULT_TEXT);
          }}
        >
          Reset
        </button>
      </div>
      <textarea
        className="text-input"
        value={text}
        rows={3}
        spellCheck={false}
        onChange={(event) => {
          onTextChange(event.target.value.replace(NEWLINE, ' '));
        }}
        aria-label="Text to truncate"
      />
    </div>
  );
}

/* ==========================================================================
   Code frame (single block, language tabs)
   ========================================================================== */

function CodeFrame({
  lang,
  onLangChange,
  code,
}: {
  lang: CodeLang;
  onLangChange: (next: CodeLang) => void;
  code: string;
}) {
  const [html, setHtml] = useState<string>('');
  const shikiLang = lang === 'react' ? 'tsx' : 'html';

  useEffect(() => {
    let cancelled = false;
    void highlight(code, shikiLang).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [code, shikiLang]);

  return (
    <section className="code-frame" aria-label="Live code snippet">
      <header className="code-frame-head">
        <div
          className="code-frame-tabs"
          role="tablist"
          aria-label="Snippet language"
        >
          <button
            type="button"
            role="tab"
            aria-selected={lang === 'react'}
            onClick={() => {
              onLangChange('react');
            }}
          >
            React
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={lang === 'html'}
            onClick={() => {
              onLangChange('html');
            }}
          >
            HTML
          </button>
        </div>
        <span className="code-frame-sub">
          {lang === 'react' ? 'component' : 'inline script'}
        </span>
      </header>
      <div
        className="highlighted-code"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output is trusted.
        dangerouslySetInnerHTML={{
          __html: html || `<pre><code>${escapeHtml(code)}</code></pre>`,
        }}
      />
    </section>
  );
}

function buildReactSnippet({ balance }: { balance: number }): string {
  const balanceProp =
    balance === DEFAULT_BALANCE ? '' : ` balance={${formatNumber(balance)}}`;
  return `import 'better-truncate-middle/styles.css';
import { MiddleTruncate } from 'better-truncate-middle/react';

export function PathCell({ path }: { path: string }) {
  return <MiddleTruncate${balanceProp}>{path}</MiddleTruncate>;
}`;
}

function buildHtmlSnippet({ balance }: { balance: number }): string {
  const options =
    balance === DEFAULT_BALANCE
      ? ''
      : `, { balance: ${formatNumber(balance)} }`;
  return `<link rel="stylesheet" href="better-truncate-middle/styles.css" />

<span id="path">/very/long/path/to/your/file.txt</span>

<script type="module">
  import { mountMiddleTruncate } from 'better-truncate-middle';

  mountMiddleTruncate(document.getElementById('path')${options});
</script>`;
}

/* ==========================================================================
   Form controls
   ========================================================================== */

function Slider({
  label,
  displayValue,
  value,
  min,
  max,
  step,
  disabled = false,
  onChange,
}: {
  label: string;
  displayValue: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <div className={['ctrl', disabled ? 'ctrl-disabled' : ''].join(' ').trim()}>
      <div className="ctrl-head">
        <span className="ctrl-label">{label}</span>
        <span className="ctrl-value">{displayValue}</span>
      </div>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
        aria-label={label}
      />
    </div>
  );
}

function FontPicker({
  value,
  onChange,
}: {
  value: FontKey;
  onChange: (next: FontKey) => void;
}) {
  return (
    <div className="ctrl ctrl-font">
      <div className="ctrl-head">
        <span className="ctrl-label">Font</span>
        <span className="ctrl-value">inherited from parent</span>
      </div>
      <select
        className="font-select"
        value={value}
        aria-label="Font family"
        onChange={(event) => {
          onChange(event.target.value as FontKey);
        }}
      >
        {fontOptions.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ==========================================================================
   Helpers
   ========================================================================== */

function resolveFont(key: FontKey): FontOption {
  for (const option of fontOptions) {
    if (option.key === key) return option;
  }
  return (
    fontOptions[0] ?? {
      key: 'inter',
      label: 'Inter',
      cssFamily: 'sans-serif',
    }
  );
}

function formatBalance(balance: number): string {
  if (Math.abs(balance - 0.5) < 0.01) return 'centered';
  if (balance > 0.5) return `${String(Math.round(balance * 100))}% start`;
  return `${String(Math.round((1 - balance) * 100))}% end`;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return `${String(value)}.0`;
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '.0');
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
