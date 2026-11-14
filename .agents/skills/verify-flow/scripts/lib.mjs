// Shared parts of the verify-flow scripts: options, the browser, sessions, steps, and evidence.
// Each step asserts a state (an API response or the DOM) and saves one screenshot.

import { randomInt } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const ZONE = 'Asia/Ho_Chi_Minh'; // BR-27

// The seed accounts of apps/api/prisma/seed.ts. Its default password is a local test value.
const SEED = {
  player: { phone: '0901234567', password: 'monsport123' },
  owner: { phone: '0912345678', password: 'monsport123' },
  admin: { phone: '0900000000', password: 'monsport123' },
};

export function parseOptions(argv) {
  const opts = { target: 'local', baseUrl: '', app: 'web', headed: false, flows: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--target') opts.target = argv[++i];
    else if (arg === '--base-url') opts.baseUrl = argv[++i];
    else if (arg === '--app') opts.app = argv[++i];
    else if (arg === '--headed') opts.headed = true;
    else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`);
    else opts.flows.push(arg);
  }
  if (!['local', 'live'].includes(opts.target)) throw new Error('--target is local or live');
  if (!['web', 'mobile'].includes(opts.app)) throw new Error('--app is web or mobile');
  opts.baseUrl ||= opts.target === 'local' ? (opts.app === 'mobile' ? 'http://localhost:5180' : 'http://localhost:5173') : liveUrl();
  opts.baseUrl = opts.baseUrl.replace(/\/$/, '');
  return opts;
}

/** The live URL has one home: the line "Live at <url>" in PROGRESS.md. */
function liveUrl() {
  const url = readFileSync(join(ROOT, 'PROGRESS.md'), 'utf8').match(/Live at (https:\/\/\S+)/)?.[1];
  if (!url) throw new Error('No "Live at <url>" line in PROGRESS.md. Pass --base-url.');
  return url;
}

/** Accounts and the court for this target. Env vars override; A live run never falls back to the seed accounts. */
function accounts(target) {
  const env = (name, local) => process.env[name] || (target === 'local' ? local : '');
  return {
    player: { phone: env('VERIFY_PLAYER_PHONE', SEED.player.phone), password: env('VERIFY_PLAYER_PASSWORD', SEED.player.password) },
    owner: { phone: env('VERIFY_OWNER_PHONE', SEED.owner.phone), password: env('VERIFY_OWNER_PASSWORD', SEED.owner.password) },
    admin: { phone: env('VERIFY_ADMIN_PHONE', SEED.admin.phone), password: env('VERIFY_ADMIN_PASSWORD', SEED.admin.password) },
    venue: process.env.VERIFY_VENUE || 'Cầu lông A',
    court: process.env.VERIFY_COURT || 'Sân 1',
  };
}

// Live pages show real names and phones, and the evidence goes to a public pull request: mask them.
const MASK_SELECTOR = [
  '.customer',
  '.who',
  '.hero h1',
  '.call',
  '.me-btn',
  '.pop',
  '.pop-head',
  '.me-card',
  '.me-meta',
  '.side-who',
  '.roster',
  '.rp',
  '.queue-user',
  '.queue-row',
  '.note',
  '.req-who',
  '.req-name',
  '.pending-req',
  '.owner-overview .req',
  '.phead',
  '.staff-tbl tbody td',
  '.accounts li',
  '.notif-item-msg',
  '.cell-text',
  '.rating-player-name',
  '[data-field="customer"]',
  '[data-field="phone"]',
  'a[href^="tel:"]',
  '[role="dialog"] p',
  '#phone-booking-name',
  'input[autocomplete="tel"]',
  'input[type="tel"]',
  'input[inputmode="tel"]',
  '[data-testid="user-name"]',
  '[data-testid="metric-grid"]',
  '[aria-label="Biểu đồ doanh thu"]',
].join(', ');

export class SkipFlow extends Error {}

export class Run {
  constructor(opts) {
    this.opts = opts;
    this.base = opts.baseUrl;
    this.accounts = accounts(opts.target);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    this.stamp = stamp;
    this.dir = join(ROOT, 'verify-output', `${stamp}-${opts.target}`);
    this.results = [];
    this.sessions = new Map();
    this.serverErrors = [];
  }

  async start() {
    mkdirSync(this.dir, { recursive: true });
    this.browser = await launch(this.opts.headed);
  }

  async close() {
    await this.browser?.close();
  }

  /**
   * Runs one step on a page, then saves a screenshot, pass or fail. A step with no page saves none.
   * A step fails when `fn` throws, or when the page got a 5xx answer or a script error during the step.
   */
  async step(flow, name, page, fn) {
    const n = String(this.results.length + 1).padStart(2, '0');
    const before = this.serverErrors.length;
    let status = 'PASS';
    let detail = '';
    let value;
    try {
      value = await fn();
      detail = String(value ?? '');
      const fresh = this.serverErrors.slice(before);
      if (fresh.length) throw new Error(`The page got errors: ${fresh.join('; ')}`);
    } catch (error) {
      status = error instanceof SkipFlow ? 'SKIP' : 'FAIL';
      detail = firstLines(error.message);
    }
    // A Playwright timeout quotes its locator, and a locator may hold an account phone. The report names the role instead.
    for (const [role, account] of Object.entries(this.accounts)) {
      if (account.phone) detail = detail.replaceAll(account.phone, `<${role} phone>`);
    }
    const file = page ? join(this.dir, `${n}-${flow}-${slug(name)}${status === 'FAIL' ? '-FAIL' : ''}.png`) : '';
    const mask = page && this.opts.target === 'live' ? [page.locator(MASK_SELECTOR)] : [];
    await page?.screenshot({ path: file, fullPage: true, mask }).catch(() => undefined);
    this.results.push({ n, flow, name, status, detail, file });
    console.log(`${status} ${flow}: ${name}${detail ? ` (${detail})` : ''}`);
    if (status !== 'PASS') throw Object.assign(new Error(detail), { reported: true, skip: status === 'SKIP' });
    return value;
  }

  /**
   * One signed-in page for each role, shared by the flows of a run. Each sign-in counts toward BR-30,
   * so a failed sign-in is kept too: the next flow gets the same failure without a new attempt.
   */
  session(role) {
    if (!this.sessions.has(role)) this.sessions.set(role, this.signIn(role));
    return this.sessions.get(role);
  }

  async signIn(role) {
    const account = this.accounts[role];
    const env = `VERIFY_${role.toUpperCase()}`;
    if (!account.phone || !account.password) throw new Error(`Set ${env}_PHONE and ${env}_PASSWORD for a live run`);
    const context = await this.browser.newContext({ locale: 'vi-VN', timezoneId: ZONE, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    this.watch(page);
    try {
      await this.step('setup', `log in as ${role}`, page, () => login(this, page, account, role));
    } catch (error) {
      await context.close();
      throw error;
    }
    return { page, account };
  }

  watch(page) {
    page.on('response', (r) => {
      if (r.status() >= 500) this.serverErrors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
    });
    page.on('pageerror', (e) => this.serverErrors.push(`script error: ${e.message}`));
  }

  writeReport() {
    const shot = (r) => (r.file ? `[png](${relative(this.dir, r.file).replaceAll('\\', '/')})` : '—');
    const rows = this.results.map((r) => `| ${r.n} | ${r.flow} | ${r.name} | ${r.status} | ${r.detail.replaceAll('|', '/')} | ${shot(r)} |`);
    const counts = ['PASS', 'FAIL', 'SKIP'].map((s) => `${this.results.filter((r) => r.status === s).length} ${s}`).join(', ');
    const text = [
      `# verify-flow ${this.stamp}`,
      '',
      `Target: ${this.opts.target} (${this.base}). Commit: ${this.commit ?? 'unknown'}. Result: ${counts}.`,
      '',
      '| # | Flow | Step | Result | Detail | Screenshot |',
      '|---|---|---|---|---|---|',
      ...rows,
      '',
    ].join('\n');
    writeFileSync(join(this.dir, 'report.md'), text);
    return join(this.dir, 'report.md');
  }
}

/** Edge ships with Windows, and Chrome with most CI images. No browser download is needed. */
async function launch(headed) {
  const channels = process.env.VERIFY_BROWSER ? [process.env.VERIFY_BROWSER] : ['msedge', 'chrome'];
  const errors = [];
  for (const channel of channels) {
    try {
      return await chromium.launch({ channel, headless: !headed });
    } catch (error) {
      errors.push(`${channel}: ${error.message.split('\n')[0]}`);
    }
  }
  throw new Error(`No browser started. Install Edge or Chrome, or set VERIFY_BROWSER to an installed channel. ${errors.join(' / ')}`);
}

/** The first line of an error, plus the locator that a Playwright timeout waited for. */
const firstLines = (message) => {
  const [head, ...rest] = message.split('\n');
  const waited = rest.find((line) => line.includes('waiting for'))?.trim();
  return waited ? `${head} ${waited}` : head;
};

/** A flow that leaves a CONFIRMED booking runs on live only on a test court that the shell names. */
export async function requireTestCourt(run, flow) {
  if (run.opts.target !== 'live' || (process.env.VERIFY_VENUE && process.env.VERIFY_COURT)) return;
  await run.step(flow, 'pick a test court (live)', null, () => {
    throw new SkipFlow(`${flow} on live needs a test court: set VERIFY_VENUE and VERIFY_COURT`);
  });
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Clicks and waits for the API answer that the click causes. */
export async function clickFor(page, locator, method, pathPart) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === method && new URL(r.url()).pathname.includes(pathPart)),
    locator.click(),
  ]);
  const body = await response.json().catch(() => ({}));
  return { status: response.status(), body };
}

async function login(run, page, account, role) {
  if (run.opts.app === 'mobile') {
    await page.goto(`${run.base}/app/toi`);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    const dialog = page.getByRole('dialog', { name: 'Đăng nhập' });
    await dialog.getByLabel('Số điện thoại').fill(account.phone);
    await dialog.getByLabel('Mật khẩu').fill(account.password);
    const { status, body } = await clickFor(page, dialog.getByRole('button', { name: 'Đăng nhập' }), 'POST', '/api/auth/login');
    assert(status !== 429, 'BR-30 blocked the login: wait 15 minutes. See .agents/skills/verify-flow/references/gotchas.md');
    assert(status === 200, `POST /api/auth/login answered ${status}: ${body.message ?? ''}`);
    const want = role === 'admin' ? 'ADMIN' : role === 'owner' ? 'OWNER' : 'USER';
    assert(body.role === want, `the account has role ${body.role}, the flow needs ${want}`);
    await page.getByText(body.name).waitFor();
    account.name = body.name;
    return `role ${body.role}`;
  }
  await page.goto(run.base);
  // The login form sits at /dang-nhap behind the "Đăng nhập" link of the top bar.
  const phone = page.getByLabel('Số điện thoại');
  if (!(await phone.isVisible({ timeout: 3_000 }).catch(() => false))) {
    await page.getByRole('link', { name: 'Đăng nhập' }).first().click();
  }
  await phone.fill(account.phone);
  await page.getByLabel('Mật khẩu').fill(account.password);
  const { status, body } = await clickFor(page, page.getByRole('button', { name: 'Đăng nhập' }), 'POST', '/api/auth/login');
  assert(status !== 429, 'BR-30 blocked the login: wait 15 minutes. See .agents/skills/verify-flow/references/gotchas.md');
  assert(status === 200, `POST /api/auth/login answered ${status}: ${body.message ?? ''}`);
  const want = role === 'admin' ? 'ADMIN' : role === 'owner' ? 'OWNER' : 'USER';
  assert(body.role === want, `the account has role ${body.role}, the flow needs ${want}`);
  await page.locator('.top .me-btn .name', { hasText: body.name }).waitFor();
  account.name = body.name;
  return `role ${body.role}`;
}

/** Measures document horizontal overflow and non-scroll-container descendant overflow at the given viewport width. */
export async function checkNoHorizontalOverflow(page, width, label) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(350);
  const result = await page.evaluate(() => {
    const innerWidth = window.innerWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const isScrollContainer = (el) => {
      const ox = window.getComputedStyle(el).overflowX;
      return ox === 'auto' || ox === 'scroll';
    };
    const isHiddenOrClosedDrawer = (el) => {
      if (el.classList.contains('sr') || el.classList.contains('sr-only')) return true;
      if ((el.classList.contains('lcol') || el.classList.contains('side')) && !el.classList.contains('open')) {
        return el.getBoundingClientRect().right <= 0;
      }
      const st = window.getComputedStyle(el);
      return st.display === 'none' || st.visibility === 'hidden';
    };
    const skip = (el) => {
      for (let cur = el; cur && cur !== document.body; cur = cur.parentElement) {
        if (isHiddenOrClosedDrawer(cur)) return true;
        if (cur !== el && isScrollContainer(cur)) return true;
      }
      return false;
    };
    let maxRight = 0;
    let culprit = '';
    for (const el of document.body.querySelectorAll('*')) {
      if (skip(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const r = Math.round(rect.right);
      if (r >= maxRight) {
        maxRight = r;
        const cls = (el.getAttribute('class') ?? '').trim();
        const field = (el.getAttribute('data-field') ?? '').trim();
        culprit = `${el.tagName.toLowerCase()}${cls ? '.' + cls.replace(/\s+/g, '.') : ''}${field ? `[data-field="${field}"]` : ''}`;
      }
    }
    return { innerWidth, scrollWidth, maxRight, culprit };
  });
  assert(
    result.scrollWidth <= result.innerWidth,
    `${label} at ${width}px: scrollWidth (${result.scrollWidth}) > innerWidth (${result.innerWidth})${result.culprit ? ` (widest: ${result.culprit} at ${result.maxRight}px)` : ''}`,
  );
  assert(
    result.maxRight <= result.innerWidth,
    `${label} at ${width}px: element ${result.culprit} reaches ${result.maxRight}px > ${result.innerWidth}px`,
  );
  return result;
}

/** Selects a date by updating the date input inside .date-chips and triggering React change events. */
export async function setDate(page, ymd) {
  const input = page.locator('.date-chips input[type="date"]');
  await input.waitFor({ state: 'attached' });
  await input.evaluate((el, val) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, val);
    else el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, ymd);
}

/** Switches the SlotGrid window (Sáng / Chiều / Tối) to contain the given minute. */
export async function selectWindow(page, minute) {
  const windowPrefix = minute < 12 * 60 ? /^Sáng/ : minute < 17 * 60 ? /^Chiều/ : /^Tối/;
  const chip = page.locator('.slot-windows').getByRole('button', { name: windowPrefix });
  if (await chip.isVisible().catch(() => false)) {
    await chip.click();
  }
}

// Date and time as the app shows them (apps/web/src/lib/format.ts).
const timeFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hour12: false });
const dayFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: ZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
export const showTime = (iso) => timeFmt.format(new Date(iso));
export const showDay = (iso) => dayFmt.format(new Date(iso));
export const showVnd = (amount) => `${amount.toLocaleString('vi-VN')}đ`;
export const hhmm = (minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

/** The instant of a local date and minute in Vietnam, as the booking form builds it. */
export const vnInstant = (date, minute) => new Date(`${date}T${hhmm(minute)}:00+07:00`);

/**
 * A random 1-hour slot 30 to 365 days ahead, inside the opening hours. Far dates keep BR-9 out of the way.
 * `used` holds the start instants (ms) of the player's bookings, so each start finds one ticket in a list.
 */
export function randomSlot(venue, used = new Set()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(new Date());
  const day = new Date(`${today}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + randomInt(30, 366));
  const starts = (venue.closesAt - 60 - venue.opensAt) / 30 + 1;
  const slot = { date: day.toISOString().slice(0, 10), start: venue.opensAt + 30 * randomInt(0, starts), duration: 60 };
  return used.has(vnInstant(slot.date, slot.start).getTime()) ? randomSlot(venue, used) : slot;
}

const slug = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
