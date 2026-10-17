// Flow owner-decide (UC-4, brief F-002): the owner confirms one request and rejects another; the player sees both states.

import { assert, clickFor } from './lib.mjs';
import { requestBooking, rowIn } from './player-request.mjs';

const FLOW = 'owner-decide';

export default async function ownerDecide(run) {
  const confirmMe = await requestBooking(run, FLOW, 'player sends request A (to confirm)');
  const rejectMe = await requestBooking(run, FLOW, 'player sends request B (to reject)');
  const owner = await run.session('owner');
  const player = await run.session('player');

  await decide(run, owner.page, player.account, confirmMe, 'Xác nhận', 'confirm', 'CONFIRMED', 'Đã xác nhận');
  await decide(run, owner.page, player.account, rejectMe, 'Từ chối', 'reject', 'REJECTED', 'Bị từ chối');

  await run.step(FLOW, 'player sees CONFIRMED and REJECTED', player.page, async () => {
    const mine = await (await player.page.request.get(`${run.base}/api/bookings/mine`)).json();
    for (const [booking, status] of [[confirmMe, 'CONFIRMED'], [rejectMe, 'REJECTED']]) {
      const found = mine.find((b) => b.id === booking.id);
      assert(found?.status === status, `GET /api/bookings/mine has ${booking.id} as ${found?.status}, not ${status}`);
    }
    await player.page.reload();
    await (await rowIn(player.page, 'Booking của tôi', confirmMe)).getByText('Đã xác nhận').waitFor();
    await (await rowIn(player.page, 'Booking của tôi', rejectMe)).getByText('Bị từ chối').waitFor();
    return 'API and "Booking của tôi" agree';
  });
}

/** Clicks the button on the owner's ticket of `booking`. The answer must name that booking id, so the right row was clicked. */
async function decide(run, page, player, booking, button, action, status, label) {
  await run.step(FLOW, `owner ${action}s ${booking.slotText}`, page, async () => {
    await page.reload();
    const row = await rowIn(page, 'Yêu cầu đặt sân', booking, player.phone);
    const answer = await clickFor(page, row.getByRole('button', { name: button }), 'POST', `/${action}`);
    assert(answer.status === 200, `POST ${action} answered ${answer.status}: ${answer.body.message ?? ''}`);
    assert(answer.body.id === booking.id, `the owner clicked booking ${answer.body.id}, not ${booking.id}`);
    assert(answer.body.status === status, `the booking is ${answer.body.status}, not ${status}`);
    await row.getByText(label).waitFor();
    return `booking ${booking.id} ${status}`;
  });
}
