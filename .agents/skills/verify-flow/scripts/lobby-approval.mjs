// Flow lobby-approval (UC-7, UC-8, UC-15, brief F-028): the host opens a "Host duyệt" match on a booking,
// a second player requests to join in "Phòng chờ", the host checks the queue at 390, 1024, and 1440 and approves,
// the second player sees "Rời trận", and the host cancels the match.

import { randomBytes, randomInt } from 'node:crypto';
import { assert, clickFor, requireTestCourt, showDay, showTime, SkipFlow } from './lib.mjs';
import { requestBooking, rowIn } from './player-request.mjs';

const FLOW = 'lobby-approval';

export default async function lobbyApproval(run) {
  // Cancelling the match at the end cancels its booking too (BR-17). A run that stops earlier cleans up in `finally`.
  await requireTestCourt(run, FLOW);
  if (run.opts.target === 'live' && (!process.env.VERIFY_PLAYER2_PHONE || !process.env.VERIFY_PLAYER2_PASSWORD)) {
    await run.step(FLOW, 'sign in a second player', null, () => {
      throw new SkipFlow(`${FLOW} on live needs a second player: set VERIFY_PLAYER2_PHONE and VERIFY_PLAYER2_PASSWORD`);
    });
  }
  const booking = await requestBooking(run, FLOW, 'host sends a request');
  const host = await run.session('player');
  const { venue: venueName, court: courtName } = run.accounts;
  let requesterName = `test-${run.stamp}`;
  const shownName = () => (run.opts.target === 'local' ? requesterName : 'the second player');

  let matchId;
  let matchCancelled = false;
  let secondContext;

  try {
    await run.step(FLOW, 'host opens a Host duyệt match', host.page, async () => {
      if (!host.page.url().includes('/lich-cua-toi')) {
        await host.page.goto(`${run.base}/lich-cua-toi`);
      }
      const row = await rowIn(host.page, 'Booking của tôi', booking);
      await row.getByRole('button', { name: /^Mở trận/ }).click();
      const group = row.locator('fieldset', { hasText: 'Cách vào trận' });
      await group.waitFor();
      assert(await group.getByRole('radio', { name: 'Vào ngay' }).isChecked(), '"Vào ngay" is not selected by default (AC-17)');
      await group.getByRole('radio', { name: 'Host duyệt' }).check();
      assert(await group.getByRole('radio', { name: 'Host duyệt' }).isChecked(), '"Host duyệt" was not selected');

      const { status, body } = await clickFor(host.page, row.getByRole('button', { name: 'Tạo trận' }), 'POST', '/api/matches');
      assert(status === 201, `POST /api/matches answered ${status}: ${body.message ?? ''}`);
      assert(body.joinMode === 'APPROVAL', `the new match has joinMode ${body.joinMode}, not APPROVAL`);
      assert(body.id, 'POST /api/matches returned no match id');
      matchId = body.id;
      await row.getByText(/^Trận đang mở/).waitFor();
      return `match ${matchId}, APPROVAL`;
    });

    secondContext = await run.browser.newContext({
      locale: 'vi-VN',
      timezoneId: 'Asia/Ho_Chi_Minh',
      viewport: { width: 1280, height: 900 },
    });
    const secondPage = await secondContext.newPage();
    run.watch(secondPage);

    await run.step(
      FLOW,
      run.opts.target === 'local' ? 'register a second player' : 'sign in a second player',
      secondPage,
      async () => {
        if (run.opts.target === 'local') {
          const letters = Array.from(randomBytes(16), (b) => String.fromCharCode(97 + (b % 26))).join('');
          const password = `Verify!${letters}`;
          for (let attempt = 1; attempt <= 5; attempt++) {
            const phone = `09${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
            if (phone === host.account.phone || phone === run.accounts.owner.phone) continue;
            // Mask the test phone in Run.step if any Playwright timeout quotes a tel: link.
            run.accounts.requester = { phone };
            const res = await secondContext.request.post(`${run.base}/api/auth/register`, {
              data: { name: requesterName, phone, password, consent: true },
            });
            const status = res.status();
            if (status === 429) {
              throw new SkipFlow('BR-30 blocked POST /api/auth/register: wait 15 minutes. See .agents/skills/verify-flow/references/gotchas.md');
            }
            if (status === 409) continue;
            const body = await res.json().catch(() => ({}));
            assert(status === 201 || status === 200, `POST /api/auth/register answered ${status}: ${body.message ?? ''}`);
            assert(body.name === requesterName, `registered name is "${body.name}", expected "${requesterName}"`);
            return requesterName;
          }
          throw new Error('5 random phones were already taken (409)');
        }

        const phone = process.env.VERIFY_PLAYER2_PHONE;
        const password = process.env.VERIFY_PLAYER2_PASSWORD;
        if (!phone || !password) {
          throw new SkipFlow(`${FLOW} on live needs a second player: set VERIFY_PLAYER2_PHONE and VERIFY_PLAYER2_PASSWORD`);
        }
        assert(phone !== host.account.phone, 'VERIFY_PLAYER2_PHONE must differ from VERIFY_PLAYER_PHONE');
        // Mask the requester phone in Run.step if any Playwright timeout quotes a tel: link.
        run.accounts.requester = { phone };
        const res = await secondContext.request.post(`${run.base}/api/auth/login`, {
          data: { phone, password },
        });
        const status = res.status();
        if (status === 429) {
          throw new SkipFlow('BR-30 blocked POST /api/auth/login: wait 15 minutes. See .agents/skills/verify-flow/references/gotchas.md');
        }
        const body = await res.json().catch(() => ({}));
        assert(status === 200, `POST /api/auth/login answered ${status}: ${body.message ?? ''}`);
        assert(body.role === 'USER', `the second player has role ${body.role}, the flow needs USER`);
        assert(body.name, 'POST /api/auth/login returned no name');
        return `role ${body.role}`;
      },
    );

    await run.step(FLOW, 'second player sees Host duyệt in Phòng chờ', secondPage, async () => {
      const list = await (await secondPage.request.get(`${run.base}/api/matches`)).json();
      const inApi = list.find((m) => m.id === matchId);
      assert(inApi, `GET /api/matches has no match ${matchId}`);
      assert(inApi.joinMode === 'APPROVAL', `GET /api/matches has joinMode ${inApi.joinMode}, not APPROVAL`);

      await secondPage.goto(`${run.base}/phong-cho`);
      const ticket = await matchTicket(secondPage, booking, venueName, courtName);
      await ticket.getByText('Host duyệt', { exact: true }).waitFor({ state: 'visible' });
      return `match ${matchId} shows "Host duyệt"`;
    });

    await run.step(FLOW, 'second player clicks Xin vào and sees Chờ host duyệt', secondPage, async () => {
      const ticket = await matchTicket(secondPage, booking, venueName, courtName);
      await ticket.getByRole('button', { name: 'Xem chi tiết' }).click();

      const detail = secondPage.locator('.match-detail');
      const joinBtn = detail.getByRole('button', { name: 'Xin vào' });
      await joinBtn.waitFor({ state: 'visible' });
      assert((await detail.getByRole('button', { name: 'Vào trận' }).count()) === 0, 'APPROVAL match showed "Vào trận"');

      const { status, body } = await clickFor(secondPage, joinBtn, 'POST', '/join');
      assert(status === 200, `POST /join answered ${status}: ${body.message ?? ''}`);
      assert(body.id === matchId, `joined match ${body.id}, not ${matchId}`);
      assert(body.myRequest === 'PENDING', `myRequest is ${body.myRequest}, not PENDING`);
      assert(body.joinedCount === 1, `joinedCount changed to ${body.joinedCount}, expected 1 (BR-50)`);

      await detail.getByText('Đã gửi yêu cầu. Chờ host duyệt').waitFor({ state: 'visible' });
      await detail.getByRole('button', { name: 'Hủy yêu cầu' }).waitFor({ state: 'visible' });
      return 'myRequest PENDING, joinedCount 1';
    });

    await run.step(FLOW, 'host opens Phòng chờ and sees Hàng chờ (1)', host.page, async () => {
      await host.page.goto(`${run.base}/phong-cho`);
      const ticket = await matchTicket(host.page, booking, venueName, courtName);
      await ticket.getByRole('button', { name: 'Xem chi tiết' }).click();

      const queue = host.page.locator('.match-detail .queue-section');
      await queue.getByText('Hàng chờ (1)').waitFor({ state: 'visible', timeout: 2000 });
      if (run.opts.target === 'local') {
        await queue.getByText(requesterName).waitFor({ state: 'visible', timeout: 2000 });
      } else {
        await queue.locator('.queue-row').first().waitFor({ state: 'visible', timeout: 2000 });
      }
      await queue.getByRole('button', { name: 'Duyệt' }).waitFor({ state: 'visible', timeout: 2000 });
      await queue.getByRole('button', { name: 'Từ chối' }).waitFor({ state: 'visible', timeout: 2000 });
      return `Hàng chờ (1): ${shownName()}`;
    });

    for (const width of [390, 768, 1024, 1440]) {
      await run.step(FLOW, `host queue at ${width}px: no sideways scroll, buttons >= 44px`, host.page, async () => {
        await host.page.setViewportSize({ width, height: 900 });
        const { scrollWidth, innerWidth } = await host.page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        assert(
          scrollWidth <= innerWidth,
          `Sideways scroll at ${width}px: scrollWidth (${scrollWidth}) > innerWidth (${innerWidth})`,
        );

        const queue = host.page.locator('.match-detail .queue-section');
        for (const label of ['Duyệt', 'Từ chối']) {
          const box = await queue.getByRole('button', { name: label }).boundingBox();
          assert(box && box.height >= 44, `"${label}" button height at ${width}px is ${box?.height ?? 0}px, expected >= 44px`);
          // body has overflow-x: hidden, so scrollWidth stays small even when content is clipped. The buttons must sit inside the window.
          assert(box.x >= 0 && box.x + box.width <= innerWidth, `"${label}" button at ${width}px is outside the window: x ${Math.round(box.x)}, right edge ${Math.round(box.x + box.width)}, window ${innerWidth}`);
        }
        const { pageWidth, maxRight } = await host.page.evaluate(() => {
          const page = document.querySelector('.lobby-page');
          if (!page) return { pageWidth: 0, maxRight: 0 };
          const isScrollContainer = (el) => {
            const ox = window.getComputedStyle(el).overflowX;
            return ox === 'auto' || ox === 'scroll';
          };
          const insideScrollContainer = (el) => {
            for (let cur = el.parentElement; cur && cur !== page; cur = cur.parentElement) {
              if (isScrollContainer(cur)) return true;
            }
            return false;
          };
          let right = Math.round(page.getBoundingClientRect().right);
          for (const el of page.querySelectorAll('*')) {
            if (insideScrollContainer(el)) continue;
            right = Math.max(right, Math.round(el.getBoundingClientRect().right));
          }
          return {
            pageWidth: Math.round(page.getBoundingClientRect().width),
            maxRight: right,
          };
        });
        assert(pageWidth <= innerWidth, `The lobby page is ${pageWidth}px wide in a ${innerWidth}px window`);
        assert(maxRight <= innerWidth, `Lobby content reaches right edge ${maxRight}px in a ${innerWidth}px window`);
        return `${width}px: scrollWidth ${scrollWidth} <= ${innerWidth}, lobby page ${pageWidth}px, maxRight ${maxRight}px, buttons inside the window and >= 44px`;
      });
    }
    await host.page.setViewportSize({ width: 1280, height: 900 });

    await run.step(FLOW, 'host approves the request', host.page, async () => {
      const detail = host.page.locator('.match-detail');
      const queue = detail.locator('.queue-section');
      const { status, body } = await clickFor(host.page, queue.getByRole('button', { name: 'Duyệt' }), 'POST', '/approve');
      assert(status === 200, `POST /approve answered ${status}: ${body.message ?? ''}`);
      assert(body.id === matchId, `approved match ${body.id}, not ${matchId}`);
      assert(body.joinedCount === 2, `joinedCount is ${body.joinedCount}, expected 2`);

      if (run.opts.target === 'local') {
        await detail.locator('.players-section').getByText(requesterName).waitFor({ state: 'visible' });
      } else {
        await detail.locator('.players-section li').nth(1).waitFor({ state: 'visible' });
      }
      await queue.getByText('Hàng chờ (0)').waitFor({ state: 'visible' });
      await queue.getByText('Chưa có yêu cầu').waitFor({ state: 'visible' });
      return `${shownName()} in Người tham gia, joinedCount 2, Hàng chờ (0)`;
    });

    await run.step(FLOW, 'second player reloads detail and sees Rời trận', secondPage, async () => {
      await secondPage.goto(`${run.base}/phong-cho`);
      const ticket = await matchTicket(secondPage, booking, venueName, courtName);
      const { status, body } = await clickFor(
        secondPage,
        ticket.getByRole('button', { name: 'Xem chi tiết' }),
        'GET',
        `/api/matches/${matchId}`,
      );
      assert(status === 200, `GET /api/matches/${matchId} answered ${status}`);
      assert(body.viewerRole === 'PLAYER', `viewerRole is ${body.viewerRole}, expected PLAYER`);
      await secondPage.locator('.match-detail').getByRole('button', { name: 'Rời trận' }).waitFor({ state: 'visible' });
      return 'viewerRole PLAYER, Rời trận visible';
    });

    await run.step(FLOW, 'host cancels the match (cleanup)', host.page, async () => {
      const res = await host.page.request.post(`${run.base}/api/matches/${matchId}/cancel`);
      const body = await res.json().catch(() => ({}));
      assert(res.status() === 200, `POST /api/matches/${matchId}/cancel answered ${res.status()}: ${body.message ?? ''}`);
      assert(body.status === 'CANCELLED', `the match is ${body.status}, not CANCELLED`);
      matchCancelled = true;
      return `match ${matchId} CANCELLED`;
    });
  } finally {
    await host.page.setViewportSize({ width: 1280, height: 900 }).catch(() => {});
    if (matchId && !matchCancelled) {
      await host.page.request.post(`${run.base}/api/matches/${matchId}/cancel`).catch(() => {});
    } else if (booking?.id && !matchId) {
      await host.page.request.post(`${run.base}/api/bookings/${booking.id}/cancel`).catch(() => {});
    }
    await secondContext?.close().catch(() => {});
  }
}

/** The one ticket of a match in "Phòng chờ", found by its venue, court, day, and time range (see `randomSlot`). */
async function matchTicket(page, booking, venueName, courtName) {
  const timeRange = `${showTime(booking.startAt)}–${showTime(booking.endAt)}`;
  const rows = page
    .locator('li.match-ticket')
    .filter({ hasText: `${venueName} · ${courtName}` })
    .filter({ hasText: `Ngày ${showDay(booking.startAt)}` })
    .filter({ hasText: timeRange });
  await rows.first().waitFor({ state: 'visible' });
  const count = await rows.count();
  assert(count === 1, `"Phòng chờ" has ${count} tickets for ${booking.slotText ?? booking.startAt}, the check needs 1`);
  return rows.first();
}
