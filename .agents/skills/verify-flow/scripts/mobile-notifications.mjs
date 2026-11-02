// Flow mobile-notifications (brief F-023, AC-13): the seed player sends a booking request, and the seed owner
// sees it as "Yêu cầu đặt sân mới" in "Thông báo" at 390x812 and 360x800. The owner taps the card and lands
// on "Yêu cầu" (/app/chu-san/yeu-cau).

import { assert, showTime } from './lib.mjs';

const FLOW = 'mobile-notifications';
const ZONE = 'Asia/Ho_Chi_Minh';
const HOUR = 3_600_000;
const HALF_HOUR = 1_800_000;
const BADGE_WAIT_MS = 25_000; // The shell reloads the count every 15 s.

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

/** The badge text the tab bar shows for a count (`unreadBadge` in packages/client). */
const badgeText = (count) => (count < 1 ? '' : count > 99 ? '99+' : String(count));

async function unreadCountOf(run, api) {
  const res = await api.get(`${run.base}/api/notifications`);
  assert(res.status() === 200, `GET /api/notifications answered ${res.status()}`);
  return res.json();
}

export default async function mobileNotifications(run) {
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
    let before = 0;
    let notificationId;

    const tabBadge = page.locator('nav[aria-label="Điều hướng"] button[aria-label="Thông báo"]');

    try {
      await run.step(FLOW, `owner opens Yêu cầu and reads the badge (${size})`, page, async () => {
        await page.goto(`${run.base}/app/chu-san/yeu-cau`);
        await tabBadge.waitFor({ state: 'visible' });
        before = (await unreadCountOf(run, ownerContext.request)).unreadCount;
        // The first count comes from the shell fetch, so wait until the badge shows the API count.
        await page.waitForFunction(
          ([label, expected]) =>
            document.querySelector(`nav button[aria-label="${label}"]`)?.textContent?.trim() === expected,
          ['Thông báo', badgeText(before)],
          { timeout: BADGE_WAIT_MS },
        );
        return `${size} unread ${before}`;
      });

      await run.step(FLOW, `player sends a booking request (${size})`, page, async () => {
        booking = await createBooking(run, playerContext.request, court, courtName);
        return `${size} ${courtName} ${showTime(booking.startAt)} -> PENDING`;
      });

      await run.step(FLOW, `badge increases without opening Thông báo (${size})`, page, async () => {
        await page.waitForFunction(
          ([label, expected]) =>
            document.querySelector(`nav button[aria-label="${label}"]`)?.textContent?.trim() === expected,
          ['Thông báo', badgeText(before + 1)],
          { timeout: BADGE_WAIT_MS },
        );
        return `${size} badge ${badgeText(before)} -> ${badgeText(before + 1)}`;
      });

      await run.step(FLOW, `open Thông báo (${size}): card, no sideways scroll, targets 44px`, page, async () => {
        const list = await unreadCountOf(run, ownerContext.request);
        const item = list.items.find((i) => i.bookingId === booking.id);
        assert(item, `GET /api/notifications has no item for booking ${booking.id}`);
        notificationId = item.id;

        await tabBadge.click();
        await page.waitForURL(`${run.base}/app/thong-bao`);
        const card = page.locator(`button[data-notification-id="${notificationId}"]`);
        await card.waitFor({ state: 'visible' });
        assert(
          (await card.getByText('Yêu cầu đặt sân mới', { exact: true }).count()) === 1,
          `The card of booking ${booking.id} has no title "Yêu cầu đặt sân mới" (${size})`,
        );

        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        assert(
          scrollWidth <= innerWidth,
          `Sideways scroll on Thông báo (${size}): scrollWidth (${scrollWidth}) > innerWidth (${innerWidth})`,
        );

        const small = await page.evaluate(() =>
          [...document.querySelectorAll('button, a[href], [role="tab"]')]
            .map((el) => ({ el, box: el.getBoundingClientRect(), style: getComputedStyle(el) }))
            .filter(({ box, style }) => box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none')
            .filter(({ box }) => box.height < 43.5)
            .map(({ el, box }) => `${(el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30)} ${Math.round(box.height)}px`),
        );
        assert(small.length === 0, `Targets under 44px high (${size}): ${small.join(', ')}`);
        return `${size} card ${notificationId}, scrollWidth ${scrollWidth} <= ${innerWidth}, all targets >= 44px`;
      });

      await run.step(FLOW, `tap the card (${size}): lands on /app/chu-san/yeu-cau`, page, async () => {
        const card = page.locator(`button[data-notification-id="${notificationId}"]`);
        const [response] = await Promise.all([
          page.waitForResponse(
            (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/notifications/${notificationId}/read`,
          ),
          card.click(),
        ]);
        assert(response.status() === 200, `POST /api/notifications/:id/read answered ${response.status()}`);
        await page.waitForURL(`${run.base}/app/chu-san/yeu-cau`);
        return `${size} read, now at ${new URL(page.url()).pathname}`;
      });
    } finally {
      // Clean up only the booking this run created. A cancel error stays silent: the first failure is the one to report.
      try {
        if (booking) await playerContext.request.post(`${run.base}/api/bookings/${booking.id}/cancel`);
      } catch {
        // ignore
      }
      await playerContext.close();
      await ownerContext.close();
    }
  }
}
