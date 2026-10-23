// Flow mobile-shell (brief F-019): mobile shell at /app/ on 390x812 and 360x800.

import { assert } from './lib.mjs';

const FLOW = 'mobile-shell';

export default async function mobileShell(run) {
  const viewports = [
    { width: 390, height: 812 },
    { width: 360, height: 800 },
  ];

  for (const { width, height } of viewports) {
    const size = `${width}x${height}`;
    const context = await run.browser.newContext({
      locale: 'vi-VN',
      timezoneId: 'Asia/Ho_Chi_Minh',
      viewport: { width, height },
    });
    const page = await context.newPage();
    run.watch(page);

    try {
      await run.step(FLOW, `open ${size}: no sideways scroll, tab bar visible`, page, async () => {
        await page.goto(`${run.base}/app/`);
        const nav = page.getByRole('navigation', { name: 'Điều hướng' });
        await nav.waitFor({ state: 'visible' });

        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        assert(scrollWidth <= innerWidth, `Sideways scroll detected: scrollWidth (${scrollWidth}) > innerWidth (${innerWidth})`);

        const transform = await nav.evaluate((el) => el.style.transform);
        assert(
          transform.includes('translateY(0') || transform === '',
          `Tab bar transform expected translateY(0), got ${transform}`,
        );
        return `${size} scrollWidth ${scrollWidth} <= ${innerWidth}`;
      });

      await run.step(FLOW, `scroll down 300px (${size}): tab bar hidden`, page, async () => {
        const nav = page.getByRole('navigation', { name: 'Điều hướng' });
        // If the shell page is too short to scroll, inject a tall spacer element for this check
        await page.evaluate(() => {
          if (!document.getElementById('verify-spacer')) {
            const spacer = document.createElement('div');
            spacer.id = 'verify-spacer';
            spacer.style.height = '3000px';
            document.body.appendChild(spacer);
          }
          window.scrollTo(0, 300);
          window.dispatchEvent(new Event('scroll'));
        });

        await page.waitForTimeout(100);

        const transform = await nav.evaluate((el) => el.style.transform);
        assert(
          transform.includes('calc(100% + 24px)') || transform.includes('100%'),
          `Tab bar should be hidden after scrolling down 300px, got transform: ${transform}`,
        );
        return `hidden transform ${transform}`;
      });

      await run.step(FLOW, `scroll up 50px (${size}): tab bar shows again`, page, async () => {
        const nav = page.getByRole('navigation', { name: 'Điều hướng' });
        // Scroll up by 50px (from 300 to 250)
        await page.evaluate(() => {
          window.scrollTo(0, 250);
          window.dispatchEvent(new Event('scroll'));
        });

        await page.waitForTimeout(100);

        const transform = await nav.evaluate((el) => el.style.transform);
        assert(
          transform.includes('translateY(0') || transform === '',
          `Tab bar should be shown after scrolling up 50px, got transform: ${transform}`,
        );
        return `shown transform ${transform}`;
      });
    } finally {
      await context.close();
    }
  }
}
