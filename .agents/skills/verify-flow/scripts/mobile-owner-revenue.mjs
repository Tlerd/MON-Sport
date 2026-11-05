// Flow mobile-owner-revenue (UC-12, brief F-026, AC-14): at 390x812 and 360x800, the owner opens "Doanh thu"
// (/app/chu-san/doanh-thu), picks "Tháng", sees the six metric cards and the "Chưa thu tiền" section, and the page
// has no sideways scroll. The flow is read-only: it sends no PATCH or POST and creates no booking.

import { assert } from './lib.mjs';

const FLOW = 'mobile-owner-revenue';
const WAIT_MS = 15_000;
const CARDS = ['Doanh thu', 'Giờ đã đặt', 'Lấp đầy', 'Hủy', 'Từ chối', 'Khách quay lại'];

export default async function mobileOwnerRevenue(run) {
  const { page: ownerPage } = await run.session('owner');
  const ownerCookies = await ownerPage.context().cookies();
  const venueName = run.accounts.venue;

  const viewports = [
    { width: 390, height: 812 },
    { width: 360, height: 800 },
  ];

  for (const { width, height } of viewports) {
    const size = `${width}x${height}`;
    const ownerContext = await run.browser.newContext({
      locale: 'vi-VN',
      timezoneId: 'Asia/Ho_Chi_Minh',
      viewport: { width, height },
    });
    await ownerContext.addCookies(ownerCookies);
    const page = await ownerContext.newPage();
    run.watch(page);

    const writeRequests = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET' && /\/api\//.test(req.url())) {
        writeRequests.push(`${req.method()} ${req.url()}`);
      }
    });

    try {
      await run.step(FLOW, `owner opens Doanh thu (${size})`, page, async () => {
        await page.goto(`${run.base}/app/chu-san/doanh-thu`);
        await page.getByRole('group', { name: 'Kỳ' }).waitFor({ state: 'visible', timeout: WAIT_MS });

        const venueGroup = page.getByRole('group', { name: 'Đơn vị' });
        if ((await venueGroup.count()) > 0) {
          const chip = venueGroup.getByRole('button', { name: venueName, exact: true });
          if ((await chip.count()) > 0) {
            if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click();
            await venueGroup
              .getByRole('button', { name: venueName, exact: true, pressed: true })
              .waitFor({ state: 'visible', timeout: WAIT_MS });
          }
        }
        return `${size} Doanh thu opened`;
      });

      await run.step(FLOW, `owner picks Tháng: financials and six metric cards (${size})`, page, async () => {
        const month = page.getByRole('group', { name: 'Kỳ' }).getByRole('button', { name: 'Tháng', exact: true });
        const responsePromise = page.waitForResponse(
          (res) =>
            res.request().method() === 'GET' &&
            /\/api\/owner\/venues\/[^/]+\/financials\?.*period=month/.test(res.url()),
          { timeout: WAIT_MS },
        );
        await month.click();
        const res = await responsePromise;
        assert(res.status() === 200, `GET /api/owner/venues/:id/financials?period=month answered ${res.status()} (${size})`);
        await page
          .getByRole('group', { name: 'Kỳ' })
          .getByRole('button', { name: 'Tháng', exact: true, pressed: true })
          .waitFor({ state: 'visible', timeout: WAIT_MS });

        for (const name of CARDS) {
          await page.getByRole('article', { name, exact: true }).waitFor({ state: 'visible', timeout: WAIT_MS });
        }

        const chart = page.getByRole('region', { name: 'Biểu đồ doanh thu' });
        await chart.waitFor({ state: 'visible', timeout: WAIT_MS });

        const heading = page.getByRole('heading', { name: /^Tháng \d{2}\/\d{4}$/ });
        await heading.waitFor({ state: 'visible', timeout: WAIT_MS });
        const text = (await heading.first().textContent())?.trim() ?? '';
        assert(/^Tháng \d{2}\/\d{4}$/.test(text), `Period heading is "${text}", not "Tháng MM/YYYY" (${size})`);
        return `${size} ${text}, ${CARDS.length} cards, chart`;
      });

      await run.step(FLOW, `owner sees Chưa thu tiền loaded and sends no write request (${size})`, page, async () => {
        const section = page.getByRole('region', { name: 'Chưa thu tiền' });
        await section.waitFor({ state: 'visible', timeout: WAIT_MS });
        // The section renders before its bookings load: wait for the list or the empty message, and fail on the error text.
        await section
          .locator('li, :text("Không có booking cần thu tiền"), :text("Không tải được")')
          .first()
          .waitFor({ state: 'visible', timeout: WAIT_MS });
        assert(
          (await section.getByText('Không tải được').count()) === 0,
          `Chưa thu tiền shows "Không tải được": GET /api/owner/bookings?status=CONFIRMED failed (${size})`,
        );
        assert(
          writeRequests.length === 0,
          `The read-only flow sent ${writeRequests.length} write request(s): ${writeRequests.join(', ')} (${size})`,
        );
        return `${size} Chưa thu tiền loaded, no write request`;
      });

      await run.step(FLOW, `Doanh thu has no sideways scroll (${size})`, page, async () => {
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        assert(
          scrollWidth <= innerWidth,
          `Sideways scroll on Doanh thu (${size}): scrollWidth (${scrollWidth}) > innerWidth (${innerWidth})`,
        );
        return `${size} scrollWidth ${scrollWidth} <= ${innerWidth}`;
      });
    } finally {
      await ownerContext.close();
    }
  }
}
