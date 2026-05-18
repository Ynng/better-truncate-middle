import { readFile } from 'node:fs/promises';

import { expect, type Locator, test } from '@playwright/test';

type FitReport = {
  contentRight: number;
  visibleRight: number;
  partsContiguous: boolean;
  rootNotScrolled: boolean;
  omittedWidth: number | null;
  fits: boolean;
  fontsLoaded: boolean;
};

const WIDE_FONT_PATH = '/usr/share/fonts/truetype/lato/Lato-Heavy.ttf';

test('keeps fitting after a delayed web font loads', async ({ page }) => {
  const wideFont = await readFile(WIDE_FONT_PATH);
  let releaseFont: (() => void) | undefined;
  const fontRequested = new Promise<void>((resolve) => {
    void page.route('**/delayed-wide-font.ttf', async (route) => {
      resolve();
      await new Promise<void>((release) => {
        releaseFont = release;
      });
      await route.fulfill({
        status: 200,
        contentType: 'font/ttf',
        body: wideFont,
      });
    });
  });

  await page.goto('/font-cache.html', { waitUntil: 'domcontentloaded' });
  await fontRequested;

  const target = page.locator('#font-cache-target');
  await expect(target.locator('.pmt__before')).toHaveAttribute(
    'data-pmt-truncated',
    'true',
  );
  await expect(target).not.toHaveAttribute('aria-label', /./);

  releaseFont?.();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  await expect
    .poll(() => fitReport(target), {
      message: 'visible text should fit after the delayed font is available',
    })
    .toMatchObject({
      fits: true,
      fontsLoaded: true,
      omittedWidth: 0,
      partsContiguous: true,
      rootNotScrolled: true,
    });
});

async function fitReport(locator: Locator): Promise<FitReport> {
  return locator.evaluate((element) => {
    const root = element as HTMLElement;
    const style = getComputedStyle(root);
    const rootRect = root.getBoundingClientRect();
    const before = root.querySelector<HTMLElement>('.pmt__before');
    const omitted = root.querySelector<HTMLElement>('.pmt__omitted');
    const after = root.querySelector<HTMLElement>('.pmt__after');
    const beforeRect = before?.getBoundingClientRect();
    const omittedRect = omitted?.getBoundingClientRect();
    const afterRect = after?.getBoundingClientRect();
    const contentRight = rootRect.right - parseFloat(style.paddingRight || '0');
    const visibleRight = Math.max(
      beforeRect?.right ?? Number.NEGATIVE_INFINITY,
      afterRect?.right ?? Number.NEGATIVE_INFINITY,
    );

    return {
      contentRight,
      visibleRight,
      partsContiguous:
        beforeRect !== undefined &&
        omittedRect !== undefined &&
        afterRect !== undefined &&
        beforeRect.right <= omittedRect.left + 1 &&
        omittedRect.right <= afterRect.left + 1,
      rootNotScrolled: root.scrollWidth <= root.clientWidth + 1,
      omittedWidth: omittedRect?.width ?? null,
      fits: visibleRight <= contentRight + 1,
      fontsLoaded: document.fonts.status === 'loaded',
    };
  });
}
