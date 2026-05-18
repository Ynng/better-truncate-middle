import { mountMiddleTruncate } from '../src/index.js';
import { bootstrapWebPage } from './main.js';

bootstrapWebPage();

type MountedFixture = {
  cleanup: () => void;
  element: HTMLElement;
  text: string;
};

type CodeTemplate = {
  element: HTMLElement;
  template: string;
};

const codeTemplates: CodeTemplate[] = Array.from(
  document.querySelectorAll<HTMLElement>('.fixture-copy pre'),
  (block) => ({
    element: block,
    template: block.textContent,
  }),
);
const mountedFixtures: MountedFixture[] = [];
const balanceControl = requiredInput('#balance-control');
const balanceOutput = requiredOutput('#balance-output');

for (const control of document.querySelectorAll<HTMLInputElement>(
  '[data-width-control]',
)) {
  syncPreviewWidth(control);
  control.addEventListener('input', () => {
    syncPreviewWidth(control);
  });
}

for (const element of document.querySelectorAll<HTMLElement>(
  '[data-truncate]',
)) {
  const text = normalizeFixtureText(element.textContent);
  element.textContent = text;
  mountedFixtures.push({
    cleanup: mountFixture(element, text),
    element,
    text,
  });
}

syncBalance();
balanceControl.addEventListener('input', () => {
  syncBalance();
});

window.addEventListener('pagehide', () => {
  for (const fixture of mountedFixtures) {
    fixture.cleanup();
  }
});

function mountFixture(element: HTMLElement, text: string): () => void {
  return mountMiddleTruncate(element, {
    text,
    balance: currentBalance(),
  });
}

function syncBalance(): void {
  const balance = currentBalance();
  const label = balance.toFixed(2);

  balanceOutput.value = label;
  balanceOutput.textContent = label;

  for (const fixture of mountedFixtures) {
    fixture.cleanup();
    fixture.cleanup = mountFixture(fixture.element, fixture.text);
  }

  renderCodeSamples(balance);
}

function syncPreviewWidth(control: HTMLInputElement): void {
  const fixture = control.closest<HTMLElement>('[data-fixture]');
  const target = fixture?.querySelector<HTMLElement>('[data-resize-target]');
  const output = fixture?.querySelector<HTMLOutputElement>(
    '[data-width-output]',
  );

  if (target === undefined || target === null) {
    return;
  }

  const width = `${control.value}px`;

  if (target.hasAttribute('data-animated-resize')) {
    target.style.setProperty('--animated-width', width);
    target.dataset.sizeLabel = `260px to ${width} ${
      target.dataset.labelPrefix ?? 'preview'
    }`;
  } else {
    target.style.width = width;
    target.dataset.sizeLabel = `${width} ${
      target.dataset.labelPrefix ?? 'preview'
    }`;
  }

  if (output !== undefined && output !== null) {
    output.value = width;
    output.textContent = width;
  }
}

function renderCodeSamples(balance: number): void {
  const formattedBalance = balance.toFixed(2);

  for (const codeTemplate of codeTemplates) {
    const { template } = codeTemplate;
    const code = template.replaceAll('__BALANCE__', formattedBalance);
    const wrapper = document.createElement('div');
    wrapper.className = 'highlighted-code';
    const pre = document.createElement('pre');
    const codeElement = document.createElement('code');
    codeElement.textContent = code;
    pre.append(codeElement);
    wrapper.append(pre);
    codeTemplate.element.replaceWith(wrapper);
    codeTemplate.element = wrapper;
  }
}

function currentBalance(): number {
  return Number(balanceControl.value);
}

function requiredInput(selector: string): HTMLInputElement {
  const element = document.querySelector(selector);

  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Missing required input: ${selector}`);
  }

  return element;
}

function requiredOutput(selector: string): HTMLOutputElement {
  const element = document.querySelector(selector);

  if (!(element instanceof HTMLOutputElement)) {
    throw new Error(`Missing required output: ${selector}`);
  }

  return element;
}

function normalizeFixtureText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}
