// Flow mobile-lobby (brief F-022, AC-13, AC-14, AC-17): the seed player opens a match from "Lịch của tôi"
// at 390x812 and 360x800, inspects it in "Phòng chờ", and cancels the match it created.

import { randomBytes, randomInt } from 'node:crypto';
import { assert, clickFor, showTime, SkipFlow } from './lib.mjs';

const FLOW = 'mobile-lobby';
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

/**
 * The second player of the AC-12 steps, made once for each run. Local: registers a `test-` player with a random phone.
 * Live: signs in with VERIFY_PLAYER2_PHONE and VERIFY_PLAYER2_PASSWORD. Returns the cookies and the name, or throws SkipFlow.
 */
async function secondPlayer(run, hostPhone) {
  const context = await run.browser.newContext({ locale: 'vi-VN', timezoneId: ZONE });
  try {
    if (run.opts.target === 'local') {
      const name = `test-${run.stamp}`;
      const letters = Array.from(randomBytes(16), (b) => String.fromCharCode(97 + (b % 26))).join('');
      for (let attempt = 1; attempt <= 5; attempt++) {
        const phone = `09${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
        if (phone === hostPhone || phone === run.accounts.owner.phone) continue;
        // Mask the test phone in Run.step if any Playwright timeout quotes it.
        run.accounts.requester = { phone };
        const res = await context.request.post(`${run.base}/api/auth/register`, {
          data: { name, phone, password: `Verify!${letters}`, consent: true },
        });
        if (res.status() === 429) throw new SkipFlow('BR-30 blocked POST /api/auth/register: wait 15 minutes');
        if (res.status() === 409) continue;
        const body = await res.json().catch(() => ({}));
        assert(res.status() === 201 || res.status() === 200, `POST /api/auth/register answered ${res.status()}: ${body.message ?? ''}`);
        return { cookies: await context.cookies(), name };
      }
      throw new Error('5 random phones were already taken (409)');
    }
    const phone = process.env.VERIFY_PLAYER2_PHONE;
    const password = process.env.VERIFY_PLAYER2_PASSWORD;
    if (!phone || !password) {
      throw new SkipFlow('AC-12 on live needs a second player: set VERIFY_PLAYER2_PHONE and VERIFY_PLAYER2_PASSWORD');
    }
    assert(phone !== hostPhone, 'VERIFY_PLAYER2_PHONE must differ from VERIFY_PLAYER_PHONE');
    run.accounts.requester = { phone };
    const res = await context.request.post(`${run.base}/api/auth/login`, { data: { phone, password } });
    if (res.status() === 429) throw new SkipFlow('BR-30 blocked POST /api/auth/login: wait 15 minutes');
    const body = await res.json().catch(() => ({}));
    assert(res.status() === 200, `POST /api/auth/login answered ${res.status()}: ${body.message ?? ''}`);
    assert(body.role === 'USER', `the second player has role ${body.role}, the flow needs USER`);
    return { cookies: await context.cookies(), name: body.name };
  } finally {
    await context.close();
  }
}

/** Runs one step of the AC-12 part. A SKIP ends that part only: the rest of the flow goes on. */
async function approvalStep(run, name, page, fn) {
  try {
    return await run.step(FLOW, name, page, fn);
  } catch (error) {
    if (error.skip) return undefined;
    throw error;
  }
}

export default async function mobileLobby(run) {
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

    let booking;
    let matchId;
    let matchCancelled = false;

    try {
      await run.step(FLOW, `create a booking for tomorrow (${size})`, page, async () => {
        booking = await createBooking(run, context.request, court, courtName);
        return `${size} ${courtName} ${showTime(booking.startAt)} -> PENDING`;
      });

      const bookingCard = page.locator(`article[data-booking-id="${booking.id}"]`);

      await run.step(FLOW, `open a match from Lịch của tôi (${size})`, page, async () => {
        await page.goto(`${run.base}/app/lich-cua-toi`);
        await bookingCard.first().waitFor({ state: 'visible' });
        await bookingCard.getByRole('button', { name: 'Mở trận', exact: true }).click();

        const openSheet = page.getByRole('dialog', { name: 'Mở trận' });
        await openSheet.waitFor({ state: 'visible' });
        await openSheet.getByLabel('Số suất').fill('8');
        await openSheet.getByLabel('Giá mỗi suất').fill('30000');
        // AC-12: the match joins by host approval.
        await openSheet.locator('label', { hasText: 'Host duyệt' }).click();

        const [response] = await Promise.all([
          page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/matches'),
          openSheet.getByRole('button', { name: 'Mở trận', exact: true }).click(),
        ]);
        const body = await response.json().catch(() => ({}));
        assert(response.status() === 201, `POST /api/matches answered ${response.status()}: ${body.message ?? ''}`);
        assert(body.id, 'POST /api/matches returned no match id');
        assert(body.joinMode === 'APPROVAL', `the new match has joinMode ${body.joinMode}, not APPROVAL`);
        matchId = body.id;

        await openSheet.waitFor({ state: 'hidden' });
        await bookingCard.filter({ hasText: 'Trận mở: 1/8 suất' }).first().waitFor({ state: 'visible' });
        return `${size} match ${matchId} -> Trận mở: 1/8 suất`;
      });

      const matchCards = page.locator(`article[data-match-id="${matchId}"]`);

      await run.step(FLOW, `open Phòng chờ (${size}): no sideways scroll, targets 44px`, page, async () => {
        await page.goto(`${run.base}/app/phong-cho`);
        await matchCards.first().waitFor({ state: 'visible' });

        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        assert(
          scrollWidth <= innerWidth,
          `Sideways scroll on Phòng chờ (${size}): scrollWidth (${scrollWidth}) > innerWidth (${innerWidth})`,
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

      // F-039 AC-4 to AC-7, AC-9: the level filter sends level, each card shown carries that level, and a second tap clears it.
      await run.step(FLOW, `filter Phòng chờ by Khá (${size}): level=ADVANCED, every card "Trình độ: Khá"`, page, async () => {
        const all = page.getByRole('button', { name: 'Mọi trình độ', exact: true });
        const khá = page.getByRole('button', { name: 'Khá', exact: true });
        assert((await all.getAttribute('aria-pressed')) === 'true', '"Mọi trình độ" is not selected by default');
        const filtered = page.waitForResponse((r) => r.url().includes('/api/matches?') && r.url().includes('level=ADVANCED'));
        await khá.click();
        const rows = await (await filtered).json();
        assert(Array.isArray(rows) && rows.every((m) => m.hostSkillLevel === 'ADVANCED'), 'GET /api/matches?level=ADVANCED returned a match of another level');
        const cards = page.locator('article[data-match-id]');
        await page.waitForFunction((n) => document.querySelectorAll('article[data-match-id]').length === n, rows.length);
        const texts = await cards.allTextContents();
        assert(texts.every((t) => t.includes('Trình độ: Khá')), `A card without "Trình độ: Khá" (${size})`);
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        assert(scrollWidth <= width, `Sideways scroll with the level filter (${size}): ${scrollWidth} > ${width}`);
        const cleared = page.waitForResponse((r) => r.url().includes('/api/matches') && !r.url().includes('level=') && !r.url().includes('/joined'));
        await khá.click();
        await cleared;
        assert((await all.getAttribute('aria-pressed')) === 'true', 'A second tap on "Khá" did not go back to "Mọi trình độ"');
        await matchCards.first().waitFor({ state: 'visible' });
        return `${size} ${rows.length} card(s) at Khá, cleared back to Mọi trình độ`;
      });

      // AC-12: a second player requests, the host approves in the sheet, the player sees the seat.
      // Without a second player (live, no VERIFY_PLAYER2_*) the part is skipped and the flow goes on.
      let p2;
      await approvalStep(run, `second player is ready (${size})`, null, async () => {
        run.player2 ??= secondPlayer(run, run.accounts.player.phone);
        p2 = await run.player2;
        return run.opts.target === 'local' ? 'registered a test- player' : 'signed in';
      });
      if (p2) {
        const p2Context = await run.browser.newContext({
          locale: 'vi-VN',
          timezoneId: ZONE,
          viewport: { width, height },
        });
        try {
          await p2Context.addCookies(p2.cookies);
          const p2Page = await p2Context.newPage();
          run.watch(p2Page);
          const p2Card = p2Page.locator(`article[data-match-id="${matchId}"]`);
          const shown = (text) => (run.opts.target === 'local' ? text : 'the second player');

          await run.step(FLOW, `second player taps Xin vào (${size})`, p2Page, async () => {
            await p2Page.goto(`${run.base}/app/phong-cho`);
            await p2Card.first().waitFor({ state: 'visible' });
            const { status, body } = await clickFor(p2Page, p2Card.getByRole('button', { name: 'Xin vào', exact: true }), 'POST', '/join');
            assert(status === 200, `POST /join answered ${status}: ${body.message ?? ''}`);
            assert(body.myRequest === 'PENDING', `myRequest is ${body.myRequest}, not PENDING`);
            assert(body.joinedCount === 1, `joinedCount is ${body.joinedCount}, expected 1 (BR-50)`);
            await p2Card.getByText('Đã gửi yêu cầu. Chờ host duyệt').waitFor({ state: 'visible' });
            return `${size} myRequest PENDING, joinedCount 1`;
          });

          await run.step(FLOW, `host sees Hàng chờ (1) in Chi tiết (${size}): no sideways scroll, targets 44px`, page, async () => {
            await page.goto(`${run.base}/app/phong-cho`);
            await matchCards.first().waitFor({ state: 'visible' });
            await matchCards.getByRole('button', { name: /^Chi tiết/ }).click();
            const sheet = page.getByRole('dialog', { name: 'Chi tiết trận' });
            await sheet.getByText('Hàng chờ (1)').waitFor({ state: 'visible' });
            // Find the row by structure: on live a Playwright error must not quote the real name (the class is masked).
            const queueUser = sheet.locator('.queue-list .queue-user');
            try {
              await queueUser.first().waitFor({ state: 'visible' });
            } catch {
              throw new Error('Hàng chờ shows no requester row (.queue-user)');
            }
            if (run.opts.target === 'local') {
              const names = await queueUser.allTextContents();
              assert(names.includes(p2.name), `Hàng chờ lists ${names.join(', ')}, not ${p2.name}`);
            }
            await sheet.getByRole('button', { name: 'Duyệt', exact: true }).waitFor({ state: 'visible' });
            await sheet.getByRole('button', { name: 'Từ chối', exact: true }).waitFor({ state: 'visible' });

            const { scrollWidth, innerWidth } = await page.evaluate(() => ({
              scrollWidth: document.documentElement.scrollWidth,
              innerWidth: window.innerWidth,
            }));
            assert(scrollWidth <= innerWidth, `Sideways scroll in the queue (${size}): scrollWidth (${scrollWidth}) > innerWidth (${innerWidth})`);
            for (const label of ['Duyệt', 'Từ chối']) {
              const box = await sheet.getByRole('button', { name: label, exact: true }).boundingBox();
              assert(box && box.height >= 44, `"${label}" is ${box?.height ?? 0}px high (${size}), expected >= 44px`);
              assert(box.x >= 0 && box.x + box.width <= innerWidth, `"${label}" is outside the window (${size}): x ${Math.round(box.x)}, right edge ${Math.round(box.x + box.width)}`);
            }
            const small = await sheet.evaluate((root) =>
              [...root.querySelectorAll('button, a[href]')]
                .filter((el) => el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().height < 43.5)
                .map((el) => `${(el.textContent || el.tagName).trim().slice(0, 30)} ${Math.round(el.getBoundingClientRect().height)}px`),
            );
            assert(small.length === 0, `Targets under 44px high in the sheet (${size}): ${small.join(', ')}`);
            return `${size} Hàng chờ (1): ${shown(p2.name)}, scrollWidth ${scrollWidth} <= ${innerWidth}, buttons >= 44px`;
          });

          await run.step(FLOW, `host taps Duyệt (${size}): Hàng chờ (0), joinedCount 2`, page, async () => {
            const sheet = page.getByRole('dialog', { name: 'Chi tiết trận' });
            const { status, body } = await clickFor(page, sheet.getByRole('button', { name: 'Duyệt', exact: true }), 'POST', '/approve');
            assert(status === 200, `POST /approve answered ${status}: ${body.message ?? ''}`);
            assert(body.joinedCount === 2, `joinedCount is ${body.joinedCount}, expected 2`);
            await sheet.getByText('Hàng chờ (0)').waitFor({ state: 'visible' });
            await sheet.getByText(/2\/8 suất/).waitFor({ state: 'visible' });
            return `${size} Hàng chờ (0), 2/8 suất`;
          });

          await run.step(FLOW, `second player sees the seat (${size})`, p2Page, async () => {
            await p2Page.goto(`${run.base}/app/phong-cho`);
            await p2Card.first().waitFor({ state: 'visible' });
            await p2Card.getByText('Bạn đã vào').waitFor({ state: 'visible' });
            await p2Card.getByRole('button', { name: 'Rời trận', exact: true }).waitFor({ state: 'visible' });
            return `${size} "Bạn đã vào" and "Rời trận"`;
          });
        } finally {
          await p2Context.close().catch(() => {});
        }
        // The cancel step needs the card, not the open sheet.
        await page.goto(`${run.base}/app/phong-cho`);
        await matchCards.first().waitFor({ state: 'visible' });
      }

      await run.step(FLOW, `open Chi tiết and cancel the match (${size}): card leaves the feed`, page, async () => {
        await matchCards.getByRole('button', { name: /^Chi tiết/ }).click();

        const detailSheet = page.getByRole('dialog', { name: 'Chi tiết trận' });
        await detailSheet.waitFor({ state: 'visible' });
        const cancelInDetail = detailSheet.getByRole('button', { name: 'Hủy trận', exact: true });
        await cancelInDetail.waitFor({ state: 'visible' });
        assert(
          (await detailSheet.getByRole('button', { name: 'Rời trận', exact: true }).count()) === 0,
          `Host detail sheet showed "Rời trận" (${size})`,
        );

        await cancelInDetail.click();

        const cancelSheet = page.getByRole('dialog', { name: 'Hủy trận này?' });
        await cancelSheet.waitFor({ state: 'visible' });
        const [response] = await Promise.all([
          page.waitForResponse(
            (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/matches/${matchId}/cancel`,
          ),
          cancelSheet.getByRole('button', { name: 'Hủy trận', exact: true }).click(),
        ]);
        assert(response.status() === 200, `POST /api/matches/:id/cancel answered ${response.status()}`);
        matchCancelled = true;

        await cancelSheet.waitFor({ state: 'hidden' });
        await matchCards.first().waitFor({ state: 'detached' });
        assert((await matchCards.count()) === 0, `Match card ${matchId} is still in the feed (${size})`);
        return `${size} match ${matchId} cancelled and removed from feed`;
      });
    } finally {
      // A failed step must not leave a public match or a held slot on live. Clean up only what this run created.
      // Cancelling the match also cancels its booking (BR-17). Errors here stay silent: the first failure is the one to report.
      try {
        if (matchId && !matchCancelled) {
          await context.request.post(`${run.base}/api/matches/${matchId}/cancel`);
        } else if (booking && !matchId) {
          await context.request.post(`${run.base}/api/bookings/${booking.id}/cancel`);
        }
      } catch {
        // ignore
      }
      await context.close();
    }
  }
}
