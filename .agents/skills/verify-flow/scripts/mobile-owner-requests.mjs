// Flow mobile-owner-requests (brief F-024, AC-11): the seed player sends a booking request, and the seed owner
// opens "Yêu cầu" (/app/chu-san/yeu-cau) at 390x812 and 360x800, finds the card by data-booking-id, and rejects it
// through the sheet "Từ chối yêu cầu này?". The flow rejects only the booking that it created.

import { assert, showTime } from './lib.mjs';

const FLOW = 'mobile-owner-requests';
const ZONE = 'Asia/Ho_Chi_Minh';
const HOUR = 3_600_000;
const HALF_HOUR = 1_800_000;
const WAIT_MS = 15_000;

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
    for (let at = new Date(range.startAt).getTime(); at + HOUR <= end; at += HALF_HOUR) {
      // The confirm deadline is min(now+2h, startAt-1h): keep it in the future so the card shows "Còn ...".
      if (at - HOUR > Date.now() + 5 * 60_000) starts.push(at);
    }
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
    return body;
  }
  throw new Error(`${conflicts} slots on ${courtName} returned 409`);
}

export default async function mobileOwnerRequests(run) {
  const { page: playerPage } = await run.session('player');
  const { page: ownerPage } = await run.session('owner');
  const playerCookies = await playerPage.context().cookies();
  const ownerCookies = await ownerPage.context().cookies();
  const { venue: venueName, court: courtName } = run.accounts;

  const venues = await (await playerPage.request.get(`${run.base}/api/venues`)).json();
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
    const options = { locale: 'vi-VN', timezoneId: ZONE, viewport: { width, height } };
    const playerContext = await run.browser.newContext(options);
    await playerContext.addCookies(playerCookies);
    const ownerContext = await run.browser.newContext(options);
    await ownerContext.addCookies(ownerCookies);
    const page = await ownerContext.newPage();
    run.watch(page);

    let booking;

    try {
      await run.step(FLOW, `player sends a booking request (${size})`, page, async () => {
        booking = await createBooking(run, playerContext.request, court, courtName);
        return `${size} ${courtName} ${showTime(booking.startAt)} -> PENDING`;
      });
      assert(booking.status === 'PENDING', `the new booking is ${booking.status}, not PENDING`);

      const card = () => page.locator(`[data-booking-id="${booking.id}"]`);

      await run.step(FLOW, `owner opens Yêu cầu (${size}): card, no sideways scroll, buttons 44px`, page, async () => {
        await page.goto(`${run.base}/app/chu-san/yeu-cau`);
        try {
          await card().waitFor({ state: 'visible', timeout: WAIT_MS });
        } catch {
          // The first list may predate the request: reload once.
          await page.reload();
          await card().waitFor({ state: 'visible', timeout: WAIT_MS });
        }

        // The court name comes from GET /api/owner/venues, which may answer after the list: the card shows "Sân" until then.
        await page
          .waitForFunction(
            ([id, name]) =>
              document.querySelector(`[data-booking-id="${id}"] [data-field="court"]`)?.textContent?.trim() === name,
            [booking.id, courtName],
            { timeout: WAIT_MS },
          )
          .catch(() => {});
        const shownCourt = ((await card().locator('[data-field="court"]').textContent()) ?? '').trim();
        assert(
          shownCourt === courtName,
          `The card of booking ${booking.id} shows court "${shownCourt}", not "${courtName}" (${size})`,
        );
        assert(
          (await card().getByText(/Còn/).count()) > 0,
          `The card of booking ${booking.id} shows no "Còn" deadline text (${size})`,
        );

        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        assert(
          scrollWidth <= innerWidth,
          `Sideways scroll on Yêu cầu (${size}): scrollWidth (${scrollWidth}) > innerWidth (${innerWidth})`,
        );

        const heights = await card().locator('button').evaluateAll((els) =>
          els.map((el) => ({ text: (el.textContent || '').trim(), height: el.getBoundingClientRect().height })),
        );
        assert(heights.length > 0, `The card of booking ${booking.id} has no buttons (${size})`);
        const small = heights.filter((b) => b.height < 43.5).map((b) => `${b.text} ${Math.round(b.height)}px`);
        assert(small.length === 0, `Card buttons under 44px high (${size}): ${small.join(', ')}`);
        return `${size} card ${booking.id}, scrollWidth ${scrollWidth} <= ${innerWidth}, buttons >= 44px`;
      });

      await run.step(FLOW, `owner rejects through the sheet (${size})`, page, async () => {
        await card().getByRole('button', { name: 'Từ chối', exact: true }).click();
        const sheet = page.getByRole('dialog');
        await sheet.getByText('Từ chối yêu cầu này?', { exact: true }).waitFor({ state: 'visible' });
        await sheet.getByRole('button', { name: 'Từ chối', exact: true }).click();

        await card().waitFor({ state: 'detached', timeout: WAIT_MS });
        await page.getByText('Đã từ chối yêu cầu', { exact: true }).waitFor({ state: 'visible', timeout: WAIT_MS });

        const res = await ownerContext.request.get(`${run.base}/api/owner/bookings?status=REJECTED`);
        assert(res.status() === 200, `GET /api/owner/bookings answered ${res.status()}`);
        const rejected = await res.json();
        const found = rejected.find((b) => b.id === booking.id);
        assert(found, `GET /api/owner/bookings?status=REJECTED has no booking ${booking.id} (${size})`);
        assert(found.status === 'REJECTED', `Booking ${booking.id} is ${found.status}, not REJECTED (${size})`);
        return `${size} ${booking.id} -> REJECTED`;
      });
    } finally {
      // Clean up only the booking this run created, and only when it is still PENDING.
      // A cancel error stays silent: the first failure is the one to report.
      try {
        if (booking) {
          const res = await ownerContext.request.get(`${run.base}/api/owner/bookings?status=PENDING`);
          const pending = res.status() === 200 ? await res.json() : [];
          if (pending.some((b) => b.id === booking.id)) {
            await playerContext.request.post(`${run.base}/api/bookings/${booking.id}/cancel`);
          }
        }
      } catch {
        // ignore
      }
      await playerContext.close();
      await ownerContext.close();
    }
  }
}
