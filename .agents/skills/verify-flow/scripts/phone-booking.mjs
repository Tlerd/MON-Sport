// Flow phone-booking (UC-5, brief F-007): the owner enters the booking of a customer who phoned.
// It shows in confirmed bookings, the slot is taken for players (BR-1), and the owner cancels it.

import { assert, clickFor, randomSlot, requireTestCourt, setDate, showDay, showTime, showVnd, vnInstant } from './lib.mjs';
import { expectedPrice } from './player-request.mjs';

const FLOW = 'phone-booking';

export default async function phoneBooking(run) {
  // The run cancels its own booking at the end. A run that stops earlier leaves it CONFIRMED.
  await requireTestCourt(run, FLOW);
  const { page } = await run.session('owner');
  const { venue: venueName, court: courtName } = run.accounts;
  const customer = `test-verify-${run.stamp}`;

  const venues = await (await page.request.get(`${run.base}/api/owner/venues`)).json();
  const venue = venues.find((v) => v.name === venueName);
  assert(venue, `GET /api/owner/venues has no venue "${venueName}" for this owner. Set VERIFY_VENUE`);
  const court = venue.courts.find((c) => c.name === courtName);
  assert(court, `"${venueName}" has no court "${courtName}". Set VERIFY_COURT`);

  let booking;
  try {
    booking = await run.step(FLOW, 'owner enters a phone booking', page, async () => {
      await page.goto(`${run.base}/chu-san/lich`);
      if (venues.length > 1) {
        const switcher = page.getByLabel('Chọn đơn vị');
        if (await switcher.isVisible().catch(() => false)) {
          await switcher.selectOption(venue.id);
        }
      }

      for (let attempt = 1; attempt <= 5; attempt++) {
        const slot = randomSlot(venue);
        await setDate(page, slot.date);
        await page.getByRole('button', { name: 'Booking khách gọi' }).click();
        const dialog = page.getByRole('dialog', { name: 'Booking khách gọi' });
        await dialog.getByLabel('Sân').selectOption({ label: courtName });
        await dialog.getByLabel('Bắt đầu').selectOption(String(slot.start));
        await dialog.getByLabel('Thời lượng').selectOption(String(slot.duration));
        await dialog.getByLabel('Tên khách (tùy chọn)').fill(customer);
        const shown = (await dialog.locator('.total strong').innerText()).trim();

        const { status, body } = await clickFor(page, dialog.getByRole('button', { name: 'Lưu booking' }), 'POST', '/api/owner/bookings');
        if (status === 409) {
          const closeBtn = dialog.getByRole('button', { name: 'Đóng' });
          if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
          continue; // BR-1: an earlier run holds this slot.
        }
        assert(status === 201, `POST /api/owner/bookings answered ${status}: ${body.message ?? ''}`);
        assert(body.status === 'CONFIRMED' && body.source === 'PHONE', `the booking is ${body.status} ${body.source}, not CONFIRMED PHONE (BR-10)`);
        assert(body.courtId === court.id, `the booking is on court ${body.courtId}, not ${courtName}`);
        const startAt = vnInstant(slot.date, slot.start).getTime();
        assert(new Date(body.startAt).getTime() === startAt, `startAt ${body.startAt} is not the chosen slot in Vietnam time`);
        const price = expectedPrice(court, slot);
        assert(body.priceTotal === price, `the API priced ${showVnd(body.priceTotal)}, BR-4 and BR-5 give ${showVnd(price)}`);
        assert(shown === showVnd(price), `the form showed ${shown}, BR-4 and BR-5 give ${showVnd(price)}`);
        body.slotText = `${showTime(body.startAt)}–${showTime(body.endAt)} ngày ${showDay(body.startAt)}`;
        body.slot = slot;
        return { ...body, toString: () => `booking ${body.id}, ${body.slotText}, ${showVnd(price)}, CONFIRMED PHONE` };
      }
      throw new Error('5 random slots were taken (409). Set VERIFY_COURT to another court');
    });

    await run.step(FLOW, 'it shows in confirmed bookings for the owner', page, async () => {
      await page.reload();
      const list = await (await page.request.get(`${run.base}/api/owner/bookings?status=CONFIRMED`)).json();
      const found = list.find((b) => b.id === booking.id);
      assert(found, `GET /api/owner/bookings?status=CONFIRMED has no booking ${booking.id}`);
      assert(found.customer?.name === customer, `customer name is "${found.customer?.name}", expected "${customer}"`);
      assert(found.source === 'PHONE', `source is ${found.source}, expected PHONE`);
      assert(found.status === 'CONFIRMED', `status is ${found.status}, expected CONFIRMED`);
      assert(found.priceTotal === booking.priceTotal, `price is ${found.priceTotal}, expected ${booking.priceTotal}`);
      return `${customer}, ${booking.slotText}`;
    });

    const player = await run.session('player');
    await run.step(FLOW, 'the slot is taken for players', player.page, async () => {
      const res = await player.page.request.post(`${run.base}/api/bookings`, {
        data: { courtId: booking.courtId, startAt: booking.startAt, endAt: booking.endAt },
      });
      const body = await res.json().catch(() => ({}));
      assert(res.status() === 409, `POST /api/bookings on the phone slot answered ${res.status()}, not 409 (BR-1)`);
      assert(body.message === 'Khung giờ này vừa có người đặt', `the 409 says "${body.message}"`);
      return '409 Khung giờ này vừa có người đặt';
    });
  } finally {
    if (booking?.id) {
      await run.step(FLOW, 'owner cancels the phone booking', page, async () => {
        const res = await page.request.post(`${run.base}/api/owner/bookings/${booking.id}/cancel`);
        const body = await res.json().catch(() => ({}));
        assert(res.status() === 200, `POST /api/owner/bookings/${booking.id}/cancel answered ${res.status()}: ${body.message ?? ''}`);
        assert(body.id === booking.id && body.status === 'CANCELLED', `the booking is ${body.status}, not CANCELLED`);
        return `booking ${booking.id} CANCELLED`;
      });
    }
  }
}
