const installCommands = {
  npm: 'npm install better-truncate-middle',
  pnpm: 'pnpm add better-truncate-middle',
  bun: 'bun add better-truncate-middle',
  yarn: 'yarn add better-truncate-middle',
} as const;

type Pkg = keyof typeof installCommands;

const COPIED_RESET_MS = 1400;
const THEME_KEY = 'btm-theme';

export function bootstrapWebPage(): void {
  bootstrapInstall();
  bootstrapThemeToggle();
}

/* -------------------------------------------------------------------------- */

function bootstrapInstall(): void {
  const root = document.querySelector<HTMLElement>('[data-install]');
  if (root === null) return;

  const cmdElement = root.querySelector<HTMLElement>('[data-cmd]');
  const copyButton = root.querySelector<HTMLButtonElement>('[data-copy]');
  const statusContainer = root.querySelector<HTMLElement>('[data-status]');
  const tabButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-pkg]'),
  );

  if (
    cmdElement === null ||
    copyButton === null ||
    statusContainer === null ||
    tabButtons.length === 0
  ) {
    return;
  }

  // Local const aliases let us drop non-null assertions inside nested closures.
  const cmd = cmdElement;
  const installRoot = root;
  let activePkg: Pkg = 'npm';
  let copiedTimer: number | null = null;

  function setActivePkg(pkg: Pkg): void {
    activePkg = pkg;
    cmd.textContent = installCommands[pkg];
    for (const button of tabButtons) {
      button.setAttribute('aria-selected', String(button.dataset.pkg === pkg));
    }
  }

  for (const button of tabButtons) {
    button.addEventListener('click', () => {
      setActivePkg(button.dataset.pkg as Pkg);
    });
  }

  copyButton.addEventListener('click', () => {
    void copy();
  });

  async function copy(): Promise<void> {
    const command = installCommands[activePkg];
    try {
      await navigator.clipboard.writeText(command);
      flash();
    } catch {
      const range = document.createRange();
      range.selectNodeContents(cmd);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }

  function flash(): void {
    installRoot.dataset.state = 'copied';
    if (copiedTimer !== null) {
      window.clearTimeout(copiedTimer);
    }
    copiedTimer = window.setTimeout(() => {
      delete installRoot.dataset.state;
      copiedTimer = null;
    }, COPIED_RESET_MS);
  }

  setActivePkg('npm');
}

/* -------------------------------------------------------------------------- */

function bootstrapThemeToggle(): void {
  const button = document.querySelector<HTMLButtonElement>(
    '[data-theme-toggle]',
  );
  if (button === null) return;

  button.addEventListener('click', () => {
    const html = document.documentElement;
    const current = readActiveTheme(html);
    const next = current === 'dark' ? 'light' : 'dark';
    html.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore storage errors (private mode etc.)
    }
  });
}

function readActiveTheme(html: HTMLElement): 'light' | 'dark' {
  const explicit = html.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}
