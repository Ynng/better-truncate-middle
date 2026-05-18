import { expect, type Locator, test } from '@playwright/test';

declare global {
  interface Window {
    find: (query: string) => boolean;
  }
}

test('example page is simple, docs-like, and includes usage snippets', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.locator('.hero-statement')).toContainText(
    'Middle ellipsis without losing the text.',
  );
  await expect(page.getByLabel('Live demo')).toBeVisible();
  await expect(page.getByText('drag the grip')).toBeVisible();
  await expect(page.locator('.demo-resize-handle')).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator('.demo-parent')
        .evaluate((element) => getComputedStyle(element).resize),
    )
    .toBe('horizontal');
  await expect(
    page.getByText('npm install better-truncate-middle'),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { exact: true, name: 'examples' }),
  ).toHaveAttribute('href', './stress.html');
  await expect(
    page.getByRole('heading', {
      name: 'Pretext-powered. Zero configuration.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'edge-case examples' }),
  ).toHaveAttribute('href', './stress.html');
  await expect(page.getByText('Live proof')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit text' })).toHaveCount(0);
  await expect(
    page.getByRole('textbox', { name: 'Text to truncate' }),
  ).toBeVisible();

  await expect(page.getByRole('tab', { name: 'React' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('.highlighted-code')).toContainText(
    "import { MiddleTruncate } from 'better-truncate-middle/react';",
  );

  await page.getByRole('tab', { name: 'HTML' }).click();
  await expect(page.locator('.highlighted-code')).toContainText(
    "import { mountMiddleTruncate } from 'better-truncate-middle';",
  );
  await expect(page.locator('.code-frame-sub')).toContainText('inline script');
});

test('examples and interactive output do not overflow their containers', async ({
  page,
}) => {
  await page.goto('/');

  const output = page.locator('.demo-target');
  await expect(output).toHaveCount(1);
  await expect(output.locator('.pmt__before')).toHaveAttribute(
    'data-pmt-truncated',
    'true',
  );

  await expectVisualIntegrity(output);

  await page.locator('.demo-parent').evaluate((element) => {
    (element as HTMLElement).style.width = '240px';
  });

  const editor = page.getByRole('textbox', { name: 'Text to truncate' });
  await editor.fill(
    'alpha-searchable-start middle-searchable-token omega-searchable-ending',
  );

  const before = output.locator('.pmt__before');
  const omitted = output.locator('.pmt__omitted');
  const after = output.locator('.pmt__after');

  await expect(before).toHaveAttribute('data-pmt-visible-text', /alpha/);
  await expect(omitted).toContainText('middle-searchable-token');
  await expect(after).toHaveAttribute('data-pmt-visible-text', /ending/);

  await expectVisualIntegrity(output);

  const omittedBox = await omitted.boundingBox();
  expect(omittedBox).not.toBeNull();

  if (omittedBox !== null) {
    expect(omittedBox.width).toBe(0);
  }
});

test('browser find and select all use the full original text', async ({
  page,
  browserName,
}) => {
  await page.goto('/');

  const fullText =
    'alpha-visible-start unique-browser-find-token omega-visible-ending';
  await page.locator('.demo-parent').evaluate((element) => {
    (element as HTMLElement).style.width = '220px';
  });
  const editor = page.getByRole('textbox', { name: 'Text to truncate' });
  await editor.fill(fullText);

  const output = page.locator('.demo-target');
  const before = output.locator('.pmt__before');
  const omitted = output.locator('.pmt__omitted');
  const after = output.locator('.pmt__after');

  await expect(output).toHaveText(fullText);
  expect(await output.getAttribute('aria-label')).toBeNull();
  await expect(before).not.toHaveText(fullText);
  await expect(omitted).not.toHaveText(fullText);
  await expect(after).not.toHaveText(fullText);

  const findAcrossBoundary = await page.evaluate(() => {
    window.getSelection()?.removeAllRanges();
    return window.find('start unique-browser-find-token omega');
  });
  const findOmittedOnly = await page.evaluate(() => {
    window.getSelection()?.removeAllRanges();
    return window.find('unique-browser-find-token');
  });

  expect(findAcrossBoundary).toBe(true);
  expect(findOmittedOnly).toBe(true);

  await page.keyboard.press(browserName === 'webkit' ? 'Meta+A' : 'Control+A');
  const selectedText = await page.evaluate(() =>
    window.getSelection()?.toString(),
  );

  expect(selectedText).toContain(fullText);
  expect(selectedText).not.toContain('…');

  const box = await output.boundingBox();
  expect(box).not.toBeNull();

  if (box !== null) {
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
  }

  const draggedText = await page.evaluate(() =>
    window.getSelection()?.toString(),
  );
  expect(draggedText).toContain(fullText);
  expect(draggedText).not.toContain('…');
});

test('SSR markup keeps full text and clips safely without JavaScript', async ({
  browser,
}) => {
  const page = await browser.newPage({ javaScriptEnabled: false });
  const fullText =
    "America Again: Re-becoming the Greatness We Never Weren't by Stephen Colbert (978-0446583978)";

  await page.goto('/');

  const output = page.locator('.demo-target');
  await expect(output).toHaveText(fullText);
  await expect(output.locator('.pmt__before')).toHaveText(fullText);
  await expect(output.locator('.pmt__omitted')).toHaveText('');
  await expect(output.locator('.pmt__after')).toHaveText('');
  await expect(output).not.toHaveAttribute('data-pmt-enhanced', 'true');

  const report = await output.evaluate((element) => {
    const root = element as HTMLElement;
    const rootRect = root.getBoundingClientRect();
    const parentRect = root.parentElement?.getBoundingClientRect();
    const before = root.querySelector<HTMLElement>('.pmt__before');

    return {
      rootClientWidth: root.clientWidth,
      rootScrollWidth: root.scrollWidth,
      beforeText: before?.textContent ?? '',
      rootFitsParent:
        parentRect === undefined ||
        (rootRect.left >= parentRect.left - 1 &&
          rootRect.right <= parentRect.right + 1),
    };
  });

  expect(report.beforeText).toBe(fullText);
  expect(report.rootScrollWidth).toBeGreaterThan(report.rootClientWidth);
  expect(report.rootFitsParent).toBe(true);

  await page.close();
});

async function expectVisualIntegrity(locator: Locator): Promise<void> {
  const report = await locator.evaluate((element) => {
    const root = element as HTMLElement;
    const style = getComputedStyle(root);
    const rootRect = root.getBoundingClientRect();
    const before = root.querySelector<HTMLElement>('.pmt__before');
    const omitted = root.querySelector<HTMLElement>('.pmt__omitted');
    const after = root.querySelector<HTMLElement>('.pmt__after');
    const beforeRect = before?.getBoundingClientRect();
    const omittedRect = omitted?.getBoundingClientRect();
    const afterRect = after?.getBoundingClientRect();
    const contentLeft = rootRect.left + parseFloat(style.paddingLeft || '0');
    const contentRight = rootRect.right - parseFloat(style.paddingRight || '0');

    return {
      contiguous:
        beforeRect !== undefined &&
        omittedRect !== undefined &&
        afterRect !== undefined &&
        beforeRect.right <= omittedRect.left + 1 &&
        omittedRect.right <= afterRect.left + 1,
      ellipsisVisible:
        before !== null &&
        before.dataset.pmtTruncated === 'true' &&
        !['none', 'normal', '""', "''"].includes(
          getComputedStyle(before, '::after').content,
        ),
      fits:
        beforeRect !== undefined &&
        afterRect !== undefined &&
        beforeRect.left >= contentLeft - 1 &&
        afterRect.right <= contentRight + 1,
      noVisualLayer:
        root.querySelector('.pmt__visual, .pmt__text, .pmt__ellipsis') === null,
      omittedWidth: omittedRect?.width ?? null,
      rootNotScrolled: root.scrollWidth <= root.clientWidth + 1,
    };
  });

  expect(report).toMatchObject({
    contiguous: true,
    ellipsisVisible: true,
    fits: true,
    noVisualLayer: true,
    omittedWidth: 0,
    rootNotScrolled: true,
  });
}
