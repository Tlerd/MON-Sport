// Screenshots the reference (file://) and the local web (login by UI) page pairs at 1440x900 and 390x844.
import { chromium } from 'playwright-core';
const out = process.argv[2];
const REF = 'file:///D:/websosanh/claude-fable-5.2-web/index.html';
const WEB = 'http://localhost:5173';
const pairs = [
  ['player', 'home', '#/home', '/'], ['player', 'matches', '#/matches', '/phong-cho'], ['player', 'venues', '#/venues', '/san'],
  ['player', 'teams', '#/teams', '/doi'], ['player', 'schedule', '#/schedule', '/lich-cua-toi'], ['player', 'profile', '#/profile', '/ho-so'],
  ['owner', 'o-overview', '#/owner/overview', '/chu-san/tong-quan'], ['owner', 'o-requests', '#/owner/requests', '/chu-san/yeu-cau'],
  ['owner', 'o-calendar', '#/owner/calendar', '/chu-san/lich'],
  ['admin', 'a-overview', '#/admin/overview', '/admin'], ['admin', 'a-venues', '#/admin/venues', '/admin/tai-khoan'],
];
const acct = { player: '0901234567', owner: '0912345678', admin: '0900000000' };
const b = await chromium.launch({ channel: 'msedge', headless: true });
for (const vp of [{ width: 1440, height: 900, tag: 'd' }, { width: 390, height: 844, tag: 'm' }]) {
  for (const role of ['player', 'owner', 'admin']) {
    const ctx = await b.newContext({ viewport: vp });
    const web = await ctx.newPage();
    await web.goto(WEB + '/dang-nhap');
    await web.getByLabel(/số điện thoại/i).first().fill(acct[role]);
    await web.getByLabel(/mật khẩu/i).first().fill('monsport123');
    await web.getByRole('button', { name: /^đăng nhập$/i }).last().click();
    await web.waitForTimeout(1500);
    const ref = await ctx.newPage();
    for (const [r, name, rh, wp] of pairs.filter((p) => p[0] === role)) {
      await ref.goto(REF + rh); await ref.reload(); await ref.waitForTimeout(500);
      await ref.screenshot({ path: `${out}/${vp.tag}-${name}-ref.png`, fullPage: true });
      await web.goto(WEB + wp); await web.waitForTimeout(1200);
      await web.screenshot({ path: `${out}/${vp.tag}-${name}-web.png`, fullPage: true });
    }
    await ctx.close();
  }
}
await b.close();
