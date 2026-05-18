import { expect, type Locator, test } from '@playwright/test';

type FixtureReport = {
  label: string;
  fixture: string | null;
  text: string | null;
  display: string;
  truncated: string | null;
  omittedWidth: number | null;
  width: number;
  parentWidth: number | null;
  partsContiguous: boolean;
  rootNotScrolled: boolean;
  fitsOwnBox: boolean;
  fitsParentBox: boolean;
};

test('every fixture fits its container across fonts, scripts, and layouts', async ({
  page,
}) => {
  await page.goto('/stress.html');
  await expect(
    page.getByRole('heading', {
      name: 'Layouts that break character-count truncation.',
    }),
  ).toBeVisible();
  await expect(page.locator('[data-truncate]')).toHaveCount(9);
  await expect(page.locator('[data-truncate] .pmt__before')).toHaveCount(9);
  await expect(page.locator('[data-width-control]')).toHaveCount(9);

  const reports = await page
    .locator('[data-truncate]')
    .evaluateAll((elements): FixtureReport[] =>
      elements.map((element) => {
        const root = element as HTMLElement;
        const article = root.closest('article');
        const heading = article?.querySelector('h2');
        const label = heading?.textContent.trim() ?? 'unknown';
        const style = getComputedStyle(root);
        const rootRect = root.getBoundingClientRect();
        const parentRect = root.parentElement?.getBoundingClientRect();
        const before = root.querySelector('.pmt__before');
        const omitted = root.querySelector('.pmt__omitted');
        const after = root.querySelector('.pmt__after');
        const beforeRect = before?.getBoundingClientRect();
        const omittedRect = omitted?.getBoundingClientRect();
        const afterRect = after?.getBoundingClientRect();
        const contentLeft =
          rootRect.left + parseFloat(style.paddingLeft || '0');
        const contentRight =
          rootRect.right - parseFloat(style.paddingRight || '0');

        return {
          label,
          fixture:
            article instanceof HTMLElement
              ? (article.dataset.fixture ?? null)
              : null,
          text: root.textContent,
          display: style.display,
          truncated:
            before instanceof HTMLElement
              ? (before.dataset.pmtTruncated ?? null)
              : null,
          omittedWidth: omittedRect?.width ?? null,
          width: rootRect.width,
          parentWidth: parentRect?.width ?? null,
          partsContiguous:
            beforeRect !== undefined &&
            omittedRect !== undefined &&
            afterRect !== undefined &&
            beforeRect.right <= omittedRect.left + 1 &&
            omittedRect.right <= afterRect.left + 1,
          rootNotScrolled: root.scrollWidth <= root.clientWidth + 1,
          fitsOwnBox:
            beforeRect !== undefined &&
            afterRect !== undefined &&
            beforeRect.left >= contentLeft - 1 &&
            afterRect.right <= contentRight + 1,
          fitsParentBox:
            parentRect === undefined ||
            (rootRect.left >= parentRect.left - 1 &&
              rootRect.right <= parentRect.right + 1),
        };
      }),
    );

  for (const report of reports) {
    expect(['inline-block', 'block'], report.label).toContain(report.display);
    expect(report.truncated, report.label).toBe('true');
    expect(report.omittedWidth, report.label).toBe(0);
    expect(report.partsContiguous, report.label).toBe(true);
    expect(report.rootNotScrolled, report.label).toBe(true);
    expect(report.fitsOwnBox, report.label).toBe(true);
    expect(report.fitsParentBox, report.label).toBe(true);
  }
});

test('stress fixtures are clipped before JavaScript enhancement', async ({
  browser,
}) => {
  const page = await browser.newPage({ javaScriptEnabled: false });

  await page.goto('/stress.html');
  const fixedValue = page.locator('[data-fixture="fixed"] [data-truncate]');
  await expect(fixedValue).toHaveClass(/pmt/);

  const report = await fixedValue.evaluate((element) => {
    const root = element as HTMLElement;
    const parent = root.parentElement;
    const rootRect = root.getBoundingClientRect();
    const parentRect = parent?.getBoundingClientRect();

    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      rootRight: rootRect.right,
      parentRight: parentRect?.right ?? 0,
    };
  });

  expect(report.scrollWidth).toBeGreaterThan(report.clientWidth);
  expect(report.rootRight).toBeLessThanOrEqual(report.parentRight + 1);

  await page.close();
});

test('flex fixture remeasures when the parent width changes', async ({
  page,
}) => {
  await page.goto('/stress.html');

  const control = page.getByLabel('Flex preview width');
  const value = page.locator('#resize-fixture [data-truncate]');

  await expect(value.locator('.pmt__before')).toHaveAttribute(
    'data-pmt-truncated',
    'true',
  );

  const wideVisibleCount = await visibleCharacterCount(value);
  await expectElementFits(value);

  await control.fill('310');

  await expect
    .poll(() => visibleCharacterCount(value))
    .toBeLessThan(wideVisibleCount);
  await expectElementFits(value);
});

test('animated parent width keeps the result fitting while text changes', async ({
  page,
}) => {
  await page.goto('/stress.html');

  const value = page.locator('[data-fixture="animated"] [data-truncate]');
  const visibleCounts = new Set<number>();

  for (let sample = 0; sample < 6; sample += 1) {
    await page.waitForTimeout(250);
    await expectElementFits(value);
    visibleCounts.add(await visibleCharacterCount(value));
  }

  expect(visibleCounts.size).toBeGreaterThan(1);
});

async function visibleCharacterCount(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const before =
      element.querySelector<HTMLElement>('.pmt__before')?.dataset
        .pmtVisibleText ?? '';
    const after =
      element.querySelector<HTMLElement>('.pmt__after')?.dataset
        .pmtVisibleText ?? '';

    return Array.from(`${before}${after}`).length;
  });
}

async function expectElementFits(locator: Locator): Promise<void> {
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
      fits:
        beforeRect !== undefined &&
        afterRect !== undefined &&
        beforeRect.left >= contentLeft - 1 &&
        afterRect.right <= contentRight + 1,
      contiguous:
        beforeRect !== undefined &&
        omittedRect !== undefined &&
        afterRect !== undefined &&
        beforeRect.right <= omittedRect.left + 1 &&
        omittedRect.right <= afterRect.left + 1,
      omittedWidth: omittedRect?.width ?? null,
      rootNotScrolled: root.scrollWidth <= root.clientWidth + 1,
    };
  });

  expect(report).toMatchObject({
    contiguous: true,
    fits: true,
    omittedWidth: 0,
    rootNotScrolled: true,
  });
}
