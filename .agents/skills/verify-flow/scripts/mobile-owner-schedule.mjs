// Flow mobile-owner-schedule (UC-5, brief F-025, AC-12): at 390x812 and 360x800, the owner opens "Lịch sân"
// (/app/chu-san/lich), selects tomorrow, taps the first enabled cell of the target court, saves a phone booking
// for "test-verify", verifies it in "Booking trong ngày" and GET /api/owner/bookings?status=CONFIRMED, and cancels
// only that booking.

import { assert, clickFor, hhmm, requireTestCourt, vnInstant } from './lib.mjs';

const FLOW = 'mobile-owner-schedule';
const ZONE = 'Asia/Ho_Chi_Minh';
const CUSTOMER = 'test-verify';
const WAIT_MS = 15_000;

/** Tomorrow as `YYYY-MM-DD` in Vietnam (BR-27). */
function tomorrowVN() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(new Date());
  const day = new Date(`${today}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

export default async function mobileOwnerSchedule(run) {
  await requireTestCourt(run, FLOW);
  const { page: ownerPage } = await run.session('owner');
  const ownerCookies = await ownerPage.context().cookies();
  const { venue: venueName, court: courtName } = run.accounts;

  const venuesRes = await ownerPage.request.get(`${run.base}/api/owner/venues`);
  assert(venuesRes.status() === 200, `GET /api/owner/venues answered ${venuesRes.status()}`);
  const venues = await venuesRes.json();
  const venue = venues.find((v) => v.name === venueName);
  assert(venue, `GET /api/owner/venues has no venue "${venueName}" for this owner. Set VERIFY_VENUE`);
  const court = venue.courts.find((c) => c.name === courtName);
  assert(court, `"${venueName}" has no court "${courtName}". Set VERIFY_COURT`);

  const viewports = [
    { width: 390, height: 812 },
    { width: 360, height: 800 },
  ];

  for (const { width, height } of viewports) {
    const size = `${width}x${height}`;
    const ownerContext = await run.browser.newContext({
      locale: 'vi-VN',
      timezoneId: ZONE,
      viewport: { width, height },
    });
    await ownerContext.addCookies(ownerCookies);
    const page = await ownerContext.newPage();
    run.watch(page);

    const date = tomorrowVN();
    let minute;
    let startMs;
    let booking;
    let cancelled = false;

    try {
      await run.step(
        FLOW,
        `owner opens Lịch sân and picks a free cell (${size}): no sideways scroll`,
        page,
        async () => {
          await page.goto(`${run.base}/app/chu-san/lich`);
          const dateNav = page.getByRole('navigation', { name: 'Ngày' });
          await dateNav.waitFor({ state: 'visible', timeout: WAIT_MS });

          if (venues.length > 1) {
            const venueGroup = page.getByRole('group', { name: 'Đơn vị' });
            const venueChip = venueGroup.getByRole('button', { name: venueName, exact: true });
            await venueChip.waitFor({ state: 'visible', timeout: WAIT_MS });
            if ((await venueChip.getAttribute('aria-pressed')) !== 'true') {
              await venueChip.click();
            }
            await venueGroup
              .getByRole('button', { name: venueName, exact: true, pressed: true })
              .waitFor({ state: 'visible', timeout: WAIT_MS });
          }

          const tomorrowChip = dateNav.getByRole('button').nth(1);
          await tomorrowChip.click();
          await dateNav
            .locator('button[aria-pressed="true"]')
            .filter({ hasNotText: 'Hôm nay' })
            .waitFor({ state: 'visible', timeout: WAIT_MS });

          const row = page.locator(`[data-court-id="${court.id}"]`);
          const firstCell = row.locator('button[data-minute]').first();
          await firstCell.waitFor({ state: 'visible', timeout: WAIT_MS });
          minute = Number(await firstCell.getAttribute('data-minute'));
          assert(Number.isFinite(minute), `First enabled cell on ${courtName} has no data-minute (${size})`);
          startMs = vnInstant(date, minute).getTime();

          const { scrollWidth, innerWidth } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }));
          assert(
            scrollWidth <= innerWidth,
            `Sideways scroll on Lịch sân (${size}): scrollWidth (${scrollWidth}) > innerWidth (${innerWidth})`,
          );

          await firstCell.click();
          await page
            .getByRole('dialog', { name: 'Nhập booking khách gọi' })
            .waitFor({ state: 'visible', timeout: WAIT_MS });
          return `${size} ${courtName} ${hhmm(minute)}, scrollWidth ${scrollWidth} <= ${innerWidth}`;
        },
      );

      await run.step(FLOW, `owner saves phone booking in the sheet (${size})`, page, async () => {
        const sheet = page.getByRole('dialog', { name: 'Nhập booking khách gọi' });
        await sheet.waitFor({ state: 'visible', timeout: WAIT_MS });
        await sheet.getByLabel('Tên khách').fill(CUSTOMER);

        const { status, body } = await clickFor(
          page,
          sheet.getByRole('button', { name: 'Lưu booking', exact: true }),
          'POST',
          '/api/owner/bookings',
        );
        if (status === 201 && body?.id) booking = body;
        assert(status === 201, `POST /api/owner/bookings answered ${status}: ${body.message ?? ''}`);

        await page
          .getByRole('status')
          .filter({ hasText: 'Đã lưu booking' })
          .waitFor({ state: 'visible', timeout: WAIT_MS });

        const daySection = page.getByRole('region', { name: 'Booking trong ngày' });
        const dayRow = booking?.id
          ? daySection.locator(`[data-booking-id="${booking.id}"]`)
          : daySection.locator('article', { hasText: CUSTOMER }).first();
        await dayRow.waitFor({ state: 'visible', timeout: WAIT_MS });
        await dayRow.getByText(CUSTOMER, { exact: true }).waitFor({ state: 'visible', timeout: WAIT_MS });

        const res = await ownerContext.request.get(`${run.base}/api/owner/bookings?status=CONFIRMED`);
        assert(res.status() === 200, `GET /api/owner/bookings?status=CONFIRMED answered ${res.status()}`);
        const confirmed = await res.json();
        const found = confirmed.find(
          (b) =>
            b.courtId === court.id &&
            new Date(b.startAt).getTime() === startMs &&
            b.customer?.name === CUSTOMER,
        );
        assert(
          found,
          `GET /api/owner/bookings?status=CONFIRMED has no booking for "${CUSTOMER}" on ${courtName} at ${hhmm(minute)} (${size})`,
        );
        assert(found.source === 'PHONE', `Booking ${found.id} has source ${found.source}, not PHONE (${size})`);
        assert(found.status === 'CONFIRMED', `Booking ${found.id} has status ${found.status}, not CONFIRMED (${size})`);
        booking = found;
        return `${size} ${booking.id} ${courtName} ${hhmm(minute)} -> CONFIRMED PHONE`;
      });

      await run.step(FLOW, `owner cancels the phone booking (${size})`, page, async () => {
        const res = await ownerContext.request.post(`${run.base}/api/owner/bookings/${booking.id}/cancel`);
        const body = await res.json().catch(() => ({}));
        assert(
          res.status() === 200,
          `POST /api/owner/bookings/${booking.id}/cancel answered ${res.status()}: ${body.message ?? ''}`,
        );
        assert(
          body.id === booking.id && body.status === 'CANCELLED',
          `Booking ${booking.id} is ${body.status}, not CANCELLED (${size})`,
        );
        cancelled = true;
        return `${size} ${booking.id} -> CANCELLED`;
      });
    } finally {
      // Clean up only the booking this viewport created, and only when it was not cancelled yet.
      try {
        if (!cancelled) {
          let id = booking?.id;
          if (!id && startMs !== undefined) {
            const res = await ownerContext.request.get(`${run.base}/api/owner/bookings?status=CONFIRMED`);
            const list = res.status() === 200 ? await res.json() : [];
            id = list.find(
              (b) =>
                b.courtId === court.id &&
                new Date(b.startAt).getTime() === startMs &&
                b.customer?.name === CUSTOMER &&
                b.source === 'PHONE',
            )?.id;
          }
          if (id) {
            await ownerContext.request.post(`${run.base}/api/owner/bookings/${id}/cancel`);
          }
        }
      } catch {
        // ignore
      }
      await ownerContext.close();
    }
  }
}
