// Flow mobile-book (brief F-020): a player books a court slot on the mobile app at 390x812 and 360x800.

import { assert, clickFor, hhmm } from './lib.mjs';

const FLOW = 'mobile-book';

export default async function mobileBook(run) {
  const { page: sessionPage } = await run.session('player');
  const cookies = await sessionPage.context().cookies();
  const { venue: venueName, court: courtName } = run.accounts;

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
    await context.addCookies(cookies);
    const page = await context.newPage();
    run.watch(page);

    try {
      await run.step(FLOW, `open ${size}: venue list, no sideways scroll`, page, async () => {
        await page.goto(`${run.base}/app/`);
        const card = page.getByRole('button').filter({ hasText: venueName }).first();
        await card.waitFor({ state: 'visible' });

        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        assert(
          scrollWidth <= innerWidth,
          `Sideways scroll on venue list (${size}): scrollWidth (${scrollWidth}) > innerWidth (${innerWidth})`,
        );

        await card.click();
        await page.getByRole('heading', { level: 1, name: venueName }).waitFor();
        return `${size} scrollWidth ${scrollWidth} <= ${innerWidth}`;
      });

      await run.step(FLOW, `book tomorrow (${size}): no sideways scroll, request sent`, page, async () => {
        const dateNav = page.getByRole('navigation', { name: 'Ngày' });
        const tomorrowChip = dateNav.getByRole('button').nth(1);
        await tomorrowChip.click();

        const row = page.getByRole('group', { name: `Giờ trống ${courtName}` });
        await row.locator('button.slot-cell').first().waitFor({ state: 'visible' });

        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        assert(
          scrollWidth <= innerWidth,
          `Sideways scroll on venue screen (${size}): scrollWidth (${scrollWidth}) > innerWidth (${innerWidth})`,
        );

        const tried = new Set();
        let conflicts = 0;
        for (let attempt = 1; attempt <= 5; attempt++) {
          const minutes = await row
            .locator('button.slot-cell')
            .evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-minute'))));
          const minute = minutes.find((m) => !tried.has(m));
          assert(minute !== undefined, `No free slot-cell left on ${courtName} (${size})`);
          tried.add(minute);

          await row.locator(`button.slot-cell[data-minute="${minute}"]`).click();

          const bar = page.getByRole('complementary', { name: 'Thanh hành động' });
          await bar.getByRole('button', { name: 'Gửi yêu cầu' }).click();

          const sheet = page.getByRole('dialog', { name: 'Gửi yêu cầu' });
          await sheet.waitFor({ state: 'visible' });

          const { status, body } = await clickFor(
            page,
            sheet.getByRole('button', { name: 'Gửi yêu cầu' }),
            'POST',
            '/api/bookings',
          );
          if (status === 409) {
            conflicts++;
            await sheet.getByRole('button', { name: 'Đóng' }).click();
            continue;
          }
          assert(status === 201, `POST /api/bookings answered ${status}: ${body.message ?? ''}`);
          assert(body.status === 'PENDING', `the new booking is ${body.status}, not PENDING`);
          await sheet.getByText('Đã gửi yêu cầu').waitFor();
          await sheet.getByText('Chờ xác nhận').waitFor();
          return `${size} ${courtName} ${hhmm(minute)} -> PENDING`;
        }
        throw new Error(`${conflicts} slots on ${courtName} returned 409`);
      });
    } finally {
      await context.close();
    }
  }
}
