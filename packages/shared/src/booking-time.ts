// Pure booking rules from docs/requirements/business-rules.md. The server and the web both use them.
// Vietnam has no daylight saving time, so Asia/Ho_Chi_Minh is always UTC+7 (BR-27).

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const SLOT = 30 * MINUTE;
const VN_OFFSET = 7 * HOUR;
const PEAK_START = 17 * 60; // BR-4: 17:00 is peak.
const PEAK_END = 22 * 60; // BR-4: 22:00 is normal again.

/** Minutes since 00:00 in Asia/Ho_Chi_Minh. */
export function minuteOfDayVN(at: Date): number {
  return Math.floor((at.getTime() + VN_OFFSET) / MINUTE) % (24 * 60);
}

/** BR-2: an instant on the 30-minute grid. */
export function isOnGrid(at: Date): boolean {
  return at.getTime() % SLOT === 0;
}

/** BR-3: a booking lasts 1 hour or more. */
export function isLongEnough(startAt: Date, endAt: Date): boolean {
  return endAt.getTime() - startAt.getTime() >= HOUR;
}

/** BR-4, BR-5: the sum of the 30-minute slots, each at half the hourly price of its band. Whole VND (BR-25). */
export function bookingPrice(startAt: Date, endAt: Date, priceNormal: number, pricePeak: number): number {
  let hourlySum = 0;
  for (let t = startAt.getTime(); t < endAt.getTime(); t += SLOT) {
    const minute = minuteOfDayVN(new Date(t));
    hourlySum += minute >= PEAK_START && minute < PEAK_END ? pricePeak : priceNormal;
  }
  return Math.round(hourlySum / 2);
}

/** BR-7: the earlier of request time + 2 hours and start time - 1 hour. */
export function confirmDeadline(requestedAt: Date, startAt: Date): Date {
  return new Date(Math.min(requestedAt.getTime() + 2 * HOUR, startAt.getTime() - HOUR));
}
