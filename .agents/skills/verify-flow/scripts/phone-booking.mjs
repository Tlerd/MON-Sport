// Flow phone-booking (UC-5, brief F-007): the owner enters the booking of a customer who phoned.
// It shows in "Booking đã xác nhận", the slot is taken for players (BR-1), and the owner cancels it.

import { assert, clickFor, randomSlot, requireTestCourt, showDay, showTime, showVnd, vnInstant } from './lib.mjs';
import { expectedPrice } from './player-request.mjs';

const FLOW = 'phone-booking';

export default async function phoneBooking(run) {
  // The run cancels its own booking at the end. A run that stops earlier leaves it CONFIRMED.
  await requireTestCourt(run, FLOW);
  const { page } = await run.session('owner');
  const { venue: venueName, court: courtName } = run.accounts;
  const customer = `test-verify-${run.stamp}`;

  const booking = await run.step(FLOW, 'owner enters a phone booking', page, async () => {
    const venues = await (await page.request.get(`${run.base}/api/owner/venues`)).json();
    const venue = venues.find((v) => v.name === venueName);
    assert(venue, `GET /api/owner/venues has no venue "${venueName}" for this owner. Set VERIFY_VENUE`);
    const court = venue.courts.find((c) => c.name === courtName);
    assert(court, `"${venueName}" has no court "${courtName}". Set VERIFY_COURT`);

    await page.goto(run.base);
    const form = page.locator('section.panel', { has: page.getByRole('heading', { name: 'Nhập booking khách gọi điện' }) });
    const label = `${venueName} · ${courtName}`;
    await form.locator('option', { hasText: label }).first().waitFor({ state: 'attached' });
    await form.getByLabel(/^Sân/).selectOption({ label });

    for (let attempt = 1; attempt <= 5; attempt++) {
      const slot = randomSlot(venue);
      await form.getByLabel(/^Ngày/).fill(slot.date);
      await form.getByLabel(/^Bắt đầu/).selectOption(String(slot.start));
      await form.getByLabel(/^Thời lượng/).selectOption(String(slot.duration));
      await form.getByLabel(/^Tên khách/).fill(customer);
      const shown = (await form.locator('.total strong').innerText()).trim();

      const { status, body } = await clickFor(page, form.getByRole('button', { name: 'Lưu booking' }), 'POST', '/api/owner/bookings');
      if (status === 409) continue; // BR-1: an earlier run holds this slot.
      assert(status === 201, `POST /api/owner/bookings answered ${status}: ${body.message ?? ''}`);
      assert(body.status === 'CONFIRMED' && body.source === 'PHONE', `the booking is ${body.status} ${body.source}, not CONFIRMED PHONE (BR-10)`);
      assert(body.courtId === court.id, `the booking is on court ${body.courtId}, not ${courtName}`);
      const startAt = vnInstant(slot.date, slot.start).getTime();
      assert(new Date(body.startAt).getTime() === startAt, `startAt ${body.startAt} is not the chosen slot in Vietnam time`);
      const price = expectedPrice(court, slot);
      assert(body.priceTotal === price, `the API priced ${showVnd(body.priceTotal)}, BR-4 and BR-5 give ${showVnd(price)}`);
      assert(shown === showVnd(price), `the form showed ${shown}, BR-4 and BR-5 give ${showVnd(price)}`);
      body.slotText = `${showTime(body.startAt)}–${showTime(body.endAt)} ngày ${showDay(body.startAt)}`;
      await form.getByText(`Đã lưu booking ${body.slotText}.`).waitFor();
      return { ...body, toString: () => `booking ${body.id}, ${body.slotText}, ${showVnd(price)}, CONFIRMED PHONE` };
    }
    throw new Error('5 random slots were taken (409). Set VERIFY_COURT to another court');
  });

  await run.step(FLOW, 'it shows in "Booking đã xác nhận" after a reload', page, async () => {
    await page.reload();
    const list = page.locator('section.panel', { has: page.getByRole('heading', { name: 'Booking đã xác nhận' }) });
    const rows = list.locator('li.ticket', { hasText: customer });
    await rows.first().waitFor();
    assert((await rows.count()) === 1, `"Booking đã xác nhận" has ${await rows.count()} tickets for ${customer}, the check needs 1`);
    const text = await rows.innerText();
    for (const part of [`Ngày ${showDay(booking.startAt)}`, showTime(booking.startAt), 'Qua điện thoại', showVnd(booking.priceTotal)])
      assert(text.includes(part), `the ticket does not show "${part}"`);
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

  await run.step(FLOW, 'owner cancels the phone booking', page, async () => {
    const list = page.locator('section.panel', { has: page.getByRole('heading', { name: 'Booking đã xác nhận' }) });
    const row = list.locator('li.ticket', { hasText: customer });
    await row.getByRole('button', { name: `Hủy booking ${booking.slotText}`, exact: true }).click();
    const { status, body } = await clickFor(page, row.getByRole('button', { name: `Xác nhận hủy booking ${booking.slotText}`, exact: true }), 'POST', `/${booking.id}/cancel`);
    assert(status === 200, `POST /api/owner/bookings/${booking.id}/cancel answered ${status}: ${body.message ?? ''}`);
    assert(body.id === booking.id && body.status === 'CANCELLED', `the booking is ${body.status}, not CANCELLED`);
    await row.getByText('Đã hủy').waitFor();
    return `booking ${booking.id} CANCELLED`;
  });
}
