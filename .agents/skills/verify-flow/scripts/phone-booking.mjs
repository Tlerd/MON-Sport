// Flow phone-booking (UC-5, brief F-007): a stub until F-007 step 2 ships the owner form.
// When the form is on the page, write the steps of flows/phone-booking.md here.

import { SkipFlow } from './lib.mjs';

const FLOW = 'phone-booking';

export default async function phoneBooking(run) {
  const { page } = await run.session('owner');
  await run.step(FLOW, 'owner form "Nhập booking khách gọi điện"', page, async () => {
    await page.goto(run.base);
    await page.getByRole('heading', { name: 'Yêu cầu đặt sân' }).waitFor();
    const form = await page.getByRole('heading', { name: 'Nhập booking khách gọi điện' }).count();
    if (form === 0) throw new SkipFlow('no form yet: F-007 step 2 is not on this build');
    throw new Error('the form is on the page, but this flow has no steps yet: write them from flows/phone-booking.md');
  });
}
