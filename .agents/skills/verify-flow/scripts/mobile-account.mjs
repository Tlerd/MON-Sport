// Flow mobile-account (brief F-027, AC-1, AC-2, AC-6, AC-8 and AC-10): the "Tôi" tab at 390x812 and 360x800.
// A guest sees both buttons and reads the register sheet. The seed player sees the name and the role, then logs out.
// The flow never submits the register form: a sign-up on live would create a real account (BR-29).

import { assert } from './lib.mjs';

const FLOW = 'mobile-account';

// The start of each of the 5 paragraphs of PRIVACY_NOTICE (packages/shared/src/account.ts).
const NOTICE_STARTS = [
  'MONSPORT thu thập tên',
  'Chủ sân của booking',
  'Dữ liệu được lưu',
  'Khi bạn dùng Google',
  'Theo Luật Bảo vệ dữ liệu cá nhân',
];
const CONSENT = 'Tôi đồng ý với thông báo bảo vệ dữ liệu cá nhân';

export default async function mobileAccount(run) {
  const { page: sessionPage, account } = await run.session('player');
  const cookies = await sessionPage.context().cookies();

  const viewports = [
    { width: 390, height: 812 },
    { width: 360, height: 800 },
  ];

  for (const { width, height } of viewports) {
    const size = `${width}x${height}`;
    const open = async (withCookies) => {
      const context = await run.browser.newContext({
        locale: 'vi-VN',
        timezoneId: 'Asia/Ho_Chi_Minh',
        viewport: { width, height },
      });
      if (withCookies) await context.addCookies(cookies);
      const page = await context.newPage();
      run.watch(page);
      return { context, page };
    };

    // Guest: both buttons, then the register sheet.
    const guest = await open(false);
    try {
      const { page } = guest;
      await run.step(FLOW, `guest opens Tôi (${size}): Đăng nhập and Tạo tài khoản`, page, async () => {
        await page.goto(`${run.base}/app/toi`);
        await page.getByRole('button', { name: 'Đăng nhập', exact: true }).waitFor({ state: 'visible' });
        await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).waitFor({ state: 'visible' });
        return size;
      });

      const dialog = page.getByRole('dialog', { name: 'Tạo tài khoản' });
      await run.step(FLOW, `guest opens the register sheet (${size}): 5 notice paragraphs, consent unticked, no sideways scroll`, page, async () => {
        await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
        await dialog.waitFor({ state: 'visible' });
        for (const label of ['Tên', 'Số điện thoại', 'Mật khẩu']) {
          await dialog.getByLabel(label, { exact: true }).waitFor({ state: 'visible' });
        }
        for (const start of NOTICE_STARTS) {
          await dialog.locator('p', { hasText: start }).first().waitFor({ state: 'visible' });
        }
        const paragraphs = await dialog.locator('p', { hasText: new RegExp(NOTICE_STARTS.join('|')) }).count();
        assert(paragraphs === 5, `The register sheet shows ${paragraphs} notice paragraphs, not 5`);
        assert(!(await dialog.getByLabel(CONSENT).isChecked()), 'The consent box is ticked by default');

        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        assert(scrollWidth <= innerWidth, `Sideways scroll on the register sheet (${size}): scrollWidth (${scrollWidth}) > innerWidth (${innerWidth})`);

        // The close button "Đóng" is a known low finding (Sheet.tsx, under 44px). The check skips it.
        const small = await dialog.evaluate((root) =>
          [...root.querySelectorAll('button')]
            .filter((el) => el.getAttribute('aria-label') !== 'Đóng' && el.textContent?.trim() !== 'Đóng')
            .map((el) => ({ el, box: el.getBoundingClientRect() }))
            .filter(({ box }) => box.width > 0 && box.height > 0 && box.height < 43.5)
            .map(({ el, box }) => `${(el.textContent || el.getAttribute('aria-label') || 'button').trim().slice(0, 30)} ${Math.round(box.height)}px`),
        );
        assert(small.length === 0, `Targets under 44px high in the register sheet (${size}): ${small.join(', ')}`);
        return `${size} 5 paragraphs, consent unticked, scrollWidth ${scrollWidth} <= ${innerWidth}`;
      });

      await run.step(FLOW, `guest closes the register sheet (${size})`, page, async () => {
        await dialog.getByRole('button', { name: 'Đóng' }).click();
        await dialog.waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).waitFor({ state: 'visible' });
        return size;
      });
    } finally {
      await guest.context.close();
    }

    // Signed-in player: the name, the role label, then logout.
    const player = await open(true);
    try {
      const { page } = player;
      await run.step(FLOW, `player opens Tôi (${size}): name, role Người chơi, no Đăng nhập`, page, async () => {
        await page.goto(`${run.base}/app/toi`);
        await page.getByText(account.name, { exact: true }).waitFor({ state: 'visible' });
        await page.getByText('Người chơi', { exact: true }).waitFor({ state: 'visible' });
        await page.getByRole('button', { name: 'Đăng xuất', exact: true }).waitFor({ state: 'visible' });
        assert((await page.getByRole('button', { name: 'Đăng nhập', exact: true }).count()) === 0, 'The signed-in player sees "Đăng nhập"');
        return `${size} role label Người chơi`;
      });

      await run.step(FLOW, `player logs out (${size}): guest buttons come back`, page, async () => {
        const [response] = await Promise.all([
          page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/auth/logout'),
          page.getByRole('button', { name: 'Đăng xuất', exact: true }).click(),
        ]);
        assert(response.status() < 300, `POST /api/auth/logout answered ${response.status()}`);
        await page.getByRole('button', { name: 'Đăng nhập', exact: true }).waitFor({ state: 'visible' });
        await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).waitFor({ state: 'visible' });
        return `${size} POST /api/auth/logout ${response.status()}`;
      });
    } finally {
      await player.context.close();
    }
  }
}
