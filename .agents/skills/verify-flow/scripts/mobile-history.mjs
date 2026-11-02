// Flow mobile-history (brief F-021, AC-13 and AC-14): the seed player opens "Lịch của tôi" at 390x812 and 360x800,
// then cancels a booking that the flow created.

import { assert, showTime } from './lib.mjs';

const FLOW = 'mobile-history';
const ZONE = 'Asia/Ho_Chi_Minh';
const HOUR = 3_600_000;
const HALF_HOUR = 1_800_000;

/** Tomorrow as `YYYY-MM-DD` in Vietnam (BR-27). */
function tomorrowVN() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(new Date());
  const day = new Date(`${today}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

/**
 * Sends POST /api/bookings for a free 1-hour slot tomorrow. A taken slot (409) gets the next slot, up to 5 times.
 * Returns the new PENDING booking as the API answered it.
 */
async function createBooking(run, api, court, courtName) {
  const date = tomorrowVN();
  const res = await api.get(`${run.base}/api/courts/${court.id}/availability?date=${date}`);
  assert(res.status() === 200, `GET /api/courts/:id/availability answered ${res.status()}`);
  const { free } = await res.json();

  const starts = [];
  for (const range of free) {
    const end = new Date(range.endAt).getTime();
    for (let at = new Date(range.startAt).getTime(); at + HOUR <= end; at += HALF_HOUR) starts.push(at);
  }
  assert(starts.length > 0, `No free 1-hour slot tomorrow on ${courtName}`);

  let conflicts = 0;
  for (const at of starts.slice(0, 5)) {
    const post = await api.post(`${run.base}/api/bookings`, {
      data: { courtId: court.id, startAt: new Date(at).toISOString(), endAt: new Date(at + HOUR).toISOString() },
    });
    if (post.status() === 409) {
      conflicts++;
      continue;
    }
    const body = await post.json().catch(() => ({}));
    assert(post.status() === 201, `POST /api/bookings answered ${post.status()}: ${body.message ?? ''}`);
    assert(body.status === 'PENDING', `the new booking is ${body.status}, not PENDING`);
    return body;
  }
  throw new Error(`${conflicts} slots on ${courtName} returned 409`);
}

export default async function mobileHistory(run) {
  const { page: sessionPage } = await run.session('player');
  const cookies = await sessionPage.context().cookies();
  const { venue: venueName, court: courtName } = run.accounts;

  const venues = await (await sessionPage.request.get(`${run.base}/api/venues`)).json();
  const venue = venues.find((v) => v.name === venueName);
  assert(venue, `GET /api/venues has no venue "${venueName}". Set VERIFY_VENUE`);
  const court = venue.courts.find((c) => c.name === courtName);
  assert(court, `"${venueName}" has no court "${courtName}". Set VERIFY_COURT`);

  const viewports = [
    { width: 390, height: 812 },
    { width: 360, height: 800 },
  ];

  for (const { width, height } of viewports) {
    const size = `${width}x${height}`;
    const context = await run.browser.newContext({
      locale: 'vi-VN',
      timezoneId: ZONE,
      viewport: { width, height },
    });
    await context.addCookies(cookies);
    const page = await context.newPage();
    run.watch(page);

    try {
      let booking;
      await run.step(FLOW, `create a booking for tomorrow (${size})`, page, async () => {
        booking = await createBooking(run, context.request, court, courtName);
        return `${size} ${courtName} ${showTime(booking.startAt)} -> PENDING`;
      });

      const range = `${showTime(booking.startAt)}–${showTime(booking.endAt)}`;
      const cards = page.locator('article').filter({ hasText: courtName }).filter({ hasText: range });
      const tab = (name) => page.getByRole('button', { name, exact: true });

      await run.step(FLOW, `open Lịch của tôi (${size}): no sideways scroll, targets 44px`, page, async () => {
        await page.goto(`${run.base}/app/lich-cua-toi`);
        await tab('Sắp tới').waitFor({ state: 'visible' });
        await cards.first().waitFor({ state: 'visible' });

        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        assert(
          scrollWidth <= innerWidth,
          `Sideways scroll on Lịch của tôi (${size}): scrollWidth (${scrollWidth}) > innerWidth (${innerWidth})`,
        );

        const small = await page.evaluate(() =>
          [...document.querySelectorAll('button, a[href], [role="tab"]')]
            .map((el) => ({ el, box: el.getBoundingClientRect(), style: getComputedStyle(el) }))
            .filter(({ box, style }) => box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none')
            .filter(({ box }) => box.height < 43.5)
            .map(({ el, box }) => `${(el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30)} ${Math.round(box.height)}px`),
        );
        assert(small.length === 0, `Targets under 44px high (${size}): ${small.join(', ')}`);
        return `${size} scrollWidth ${scrollWidth} <= ${innerWidth}, all targets >= 44px`;
      });

      await run.step(FLOW, `cancel the booking (${size}): card moves to Lịch sử as Đã hủy`, page, async () => {
        const before = await cards.count();
        await cards.filter({ has: page.getByRole('button', { name: 'Hủy', exact: true }) }).first()
          .getByRole('button', { name: 'Hủy', exact: true })
          .click();

        const sheet = page.getByRole('dialog', { name: 'Hủy booking này?' });
        await sheet.waitFor({ state: 'visible' });
        const [response] = await Promise.all([
          page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/bookings/${booking.id}/cancel`),
          sheet.getByRole('button', { name: 'Hủy booking', exact: true }).click(),
        ]);
        assert(response.status() === 200 || response.status() === 201, `POST /api/bookings/:id/cancel answered ${response.status()}`);

        await sheet.waitFor({ state: 'hidden' });
        let stillUpcoming = await cards.count();
        for (let i = 0; i < 25 && stillUpcoming >= before; i++) {
          await page.waitForTimeout(200);
          stillUpcoming = await cards.count();
        }
        assert(stillUpcoming < before, `The card is still under Sắp tới (${size}): ${stillUpcoming} of ${before} cards left`);

        await tab('Lịch sử').click();
        const cancelled = cards.filter({ hasText: 'Đã hủy' });
        await cancelled.first().waitFor({ state: 'visible' });
        return `${size} ${range}: ${before} -> ${stillUpcoming} under Sắp tới, ${await cancelled.count()} Đã hủy under Lịch sử`;
      });
    } finally {
      await context.close();
    }
  }
}
