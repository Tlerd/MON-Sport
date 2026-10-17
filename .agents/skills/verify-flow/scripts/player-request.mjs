// Flow player-request (UC-3, brief F-002): a player sends a booking request on the booking form.

import { assert, clickFor, hhmm, randomSlot, showDay, showTime, showVnd, vnInstant } from './lib.mjs';

const FLOW = 'player-request';

export default async function playerRequest(run) {
  await requestBooking(run, FLOW);
}

/**
 * Sends one request through the form and checks the answer, the ticket, and "Booking của tôi".
 * A taken slot (409, BR-1) gets a new random slot. Returns the booking as the API answered it.
 */
export async function requestBooking(run, flow, label = 'send a booking request') {
  const { page } = await run.session('player');
  const { venue: venueName, court: courtName } = run.accounts;
  const venues = await (await page.request.get(`${run.base}/api/venues`)).json();
  const venue = venues.find((v) => v.name === venueName);
  assert(venue, `GET /api/venues has no venue "${venueName}". Set VERIFY_VENUE`);
  const court = venue.courts.find((c) => c.name === courtName);
  assert(court, `"${venueName}" has no court "${courtName}". Set VERIFY_COURT`);

  return run.step(flow, label, page, async () => {
    await page.goto(run.base);
    const form = page.locator('section.panel', { has: page.getByRole('heading', { name: 'Đặt sân' }) });
    // A select's accessible name ends with its chosen option, so the labels match by prefix.
    await form.locator('option', { hasText: venueName }).waitFor({ state: 'attached' });
    await form.getByLabel(/^Đơn vị/).selectOption({ label: venueName });
    await form.getByLabel(/^Sân/).selectOption({ label: courtName });

    const mine = await (await page.request.get(`${run.base}/api/bookings/mine`)).json();
    const used = new Set(mine.map((b) => new Date(b.startAt).getTime()));
    for (let attempt = 1; attempt <= 5; attempt++) {
      const slot = randomSlot(venue, used);
      used.add(vnInstant(slot.date, slot.start).getTime());
      await form.getByLabel(/^Ngày/).fill(slot.date);
      await form.getByLabel(/^Bắt đầu/).selectOption(String(slot.start));
      await form.getByLabel(/^Thời lượng/).selectOption(String(slot.duration));
      const estimate = (await form.locator('.total strong').innerText()).trim();

      const { status, body } = await clickFor(page, form.getByRole('button', { name: 'Gửi yêu cầu' }), 'POST', '/api/bookings');
      if (status === 409) continue; // BR-1: an earlier run holds this slot.
      assert(status === 201, `POST /api/bookings answered ${status}: ${body.message ?? ''}`);
      assert(body.status === 'PENDING', `the new booking is ${body.status}, not PENDING`);
      const startAt = vnInstant(slot.date, slot.start).getTime();
      assert(new Date(body.startAt).getTime() === startAt, `startAt ${body.startAt} is not ${slot.date} ${hhmm(slot.start)} in Vietnam`);
      assert(new Date(body.endAt).getTime() === startAt + slot.duration * 60_000, `endAt ${body.endAt} is not 1 hour after startAt`);
      const price = expectedPrice(court, slot);
      assert(body.priceTotal === price, `the API priced ${showVnd(body.priceTotal)}, BR-4 and BR-5 give ${showVnd(price)}`);
      assert(estimate === showVnd(price), `the form showed ${estimate}, BR-4 and BR-5 give ${showVnd(price)}`);

      const ticket = form.locator('.ticket.result[data-status="PENDING"]');
      await ticket.getByText('Chờ xác nhận').waitFor();
      const slotText = `${showTime(body.startAt)}–${showTime(body.endAt)} ngày ${showDay(body.startAt)}`;
      assert((await ticket.innerText()).includes(slotText), `the ticket does not show ${slotText}`);

      const row = await rowIn(page, 'Booking của tôi', body);
      await row.getByText('Chờ xác nhận').waitFor();
      body.slotText = slotText;
      return { ...body, toString: () => `booking ${body.id}, ${slotText}, ${showVnd(body.priceTotal)}, PENDING` };
    }
    throw new Error('5 random slots were taken (409). The court is full of old test bookings: set VERIFY_COURT');
  });
}

/** BR-5: each 30-minute piece costs half the hourly price of its band. BR-4: the peak band is 17:00–22:00. */
function expectedPrice(court, slot) {
  let total = 0;
  for (let m = slot.start; m < slot.start + slot.duration; m += 30) total += (m >= 17 * 60 && m < 22 * 60 ? court.pricePeak : court.priceNormal) / 2;
  return total;
}

/** The one ticket of a booking in the list under a heading, found by its day and start time (see `randomSlot`). */
export async function rowIn(page, heading, booking, extra) {
  const list = page.locator('section.panel', { has: page.getByRole('heading', { name: heading }) });
  let rows = list.locator('li.ticket').filter({ hasText: `Ngày ${showDay(booking.startAt)}` }).filter({ has: page.locator('.stub strong', { hasText: showTime(booking.startAt) }) });
  if (extra) rows = rows.filter({ hasText: extra });
  await rows.first().waitFor();
  const count = await rows.count();
  assert(count === 1, `"${heading}" has ${count} tickets for ${booking.slotText ?? booking.startAt}, the check needs 1`);
  return rows;
}
