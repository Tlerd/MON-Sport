// Flow web-responsive (brief F-033): checks all 17 web routes for horizontal overflow at 390, 768, 1024, and 1440px.

import { checkNoHorizontalOverflow, SkipFlow } from './lib.mjs';

const FLOW = 'web-responsive';
const WIDTHS = [390, 768, 1024, 1440];

async function checkRoute(run, page, path) {
  try {
    await run.step(FLOW, `${path} at 390/768/1024/1440px`, page, async () => {
      await page.goto(`${run.base}${path}`);
      await page.locator('main').first().waitFor({ state: 'visible' });
      await page.waitForLoadState('networkidle').catch(() => undefined);

      const summary = [];
      const failures = [];
      let firstFailedWidth = null;
      for (const width of WIDTHS) {
        try {
          const res = await checkNoHorizontalOverflow(page, width, path);
          summary.push(`${width}:${res.scrollWidth}<=` + res.innerWidth);
        } catch (error) {
          if (firstFailedWidth === null) firstFailedWidth = width;
          failures.push(error instanceof Error ? error.message : String(error));
        }
      }
      if (failures.length) {
        if (firstFailedWidth !== null) {
          await page.setViewportSize({ width: firstFailedWidth, height: 900 }).catch(() => {});
          await page.waitForTimeout(350).catch(() => {});
        }
        throw new Error(failures.join(' | '));
      }
      return summary.join(', ');
    });
  } catch (error) {
    if (!error?.reported) throw error;
  }
}

export default async function webResponsive(run) {
  const player = await run.session('player');
  const venues = await (await player.page.request.get(`${run.base}/api/venues`)).json();
  const targetVenue = venues.find((v) => v.name === run.accounts.venue) ?? venues[0];

  const guestContext = await run.browser.newContext({
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    viewport: { width: 1280, height: 900 },
  });
  const guestPage = await guestContext.newPage();
  run.watch(guestPage);

  try {
    await checkRoute(run, guestPage, '/dang-nhap');
  } finally {
    await guestContext.close().catch(() => {});
  }

  const playerRoutes = [
    '/',
    '/phong-cho',
    '/san',
    ...(targetVenue ? [`/san/${targetVenue.id}`] : []),
    '/doi',
    '/lich-cua-toi',
    '/ho-so',
  ];
  try {
    for (const route of playerRoutes) {
      await checkRoute(run, player.page, route);
    }
  } finally {
    await player.page.setViewportSize({ width: 1280, height: 900 }).catch(() => {});
  }

  const owner = await run.session('owner');
  const ownerRoutes = [
    '/chu-san/tong-quan',
    '/chu-san/yeu-cau',
    '/chu-san/lich',
    '/chu-san/doanh-thu',
    '/chu-san/don-vi',
  ];
  try {
    for (const route of ownerRoutes) {
      await checkRoute(run, owner.page, route);
    }
  } finally {
    await owner.page.setViewportSize({ width: 1280, height: 900 }).catch(() => {});
  }

  if (run.opts.target === 'live' && (!process.env.VERIFY_ADMIN_PHONE || !process.env.VERIFY_ADMIN_PASSWORD)) {
    await run.step(FLOW, 'admin routes overflow check', null, () => {
      throw new SkipFlow('admin overflow check on live needs VERIFY_ADMIN_PHONE and VERIFY_ADMIN_PASSWORD');
    });
    return;
  }

  const admin = await run.session('admin');
  const adminRoutes = ['/admin', '/admin/tai-khoan', '/admin/bao-cao', '/admin/mon'];
  try {
    for (const route of adminRoutes) {
      await checkRoute(run, admin.page, route);
    }
  } finally {
    await admin.page.setViewportSize({ width: 1280, height: 900 }).catch(() => {});
  }
}
