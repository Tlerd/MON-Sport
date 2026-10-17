// Shared parts of the verify-flow scripts: options, the browser, sessions, steps, and evidence.
// Each step asserts a state (an API response or the DOM) and saves one screenshot.

import { randomBytes, randomInt } from 'node:crypto';
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
};

export function parseOptions(argv) {
  const opts = { target: 'local', baseUrl: '', headed: false, flows: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--target') opts.target = argv[++i];
    else if (arg === '--base-url') opts.baseUrl = argv[++i];
    else if (arg === '--headed') opts.headed = true;
    else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`);
    else opts.flows.push(arg);
  }
  if (!['local', 'live'].includes(opts.target)) throw new Error('--target is local or live');
  opts.baseUrl ||= opts.target === 'local' ? 'http://localhost:5173' : liveUrl();
  opts.baseUrl = opts.baseUrl.replace(/\/$/, '');
  return opts;
}

/** The live URL has one home: the line "Live at <url>" in PROGRESS.md. */
function liveUrl() {
  const url = readFileSync(join(ROOT, 'PROGRESS.md'), 'utf8').match(/Live at (https:\/\/\S+)/)?.[1];
  if (!url) throw new Error('No "Live at <url>" line in PROGRESS.md. Pass --base-url.');
  return url;
}

/** Accounts and the court for this target. Env vars override; a live run never falls back to the seed password. */
function accounts(target) {
  const env = (name, local) => process.env[name] || (target === 'local' ? local : '');
  return {
    player: { phone: env('VERIFY_PLAYER_PHONE', SEED.player.phone), password: env('VERIFY_PLAYER_PASSWORD', SEED.player.password) },
    owner: { phone: env('VERIFY_OWNER_PHONE', SEED.owner.phone), password: env('VERIFY_OWNER_PASSWORD', SEED.owner.password) },
    venue: process.env.VERIFY_VENUE || 'Cầu lông A',
    court: process.env.VERIFY_COURT || 'Sân 1',
  };
}

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
   * Runs one step on a page, then saves a screenshot, pass or fail.
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
    const file = join(this.dir, `${n}-${flow}-${slug(name)}${status === 'FAIL' ? '-FAIL' : ''}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => undefined);
    this.results.push({ n, flow, name, status, detail, file });
    console.log(`${status} ${flow}: ${name}${detail ? ` (${detail})` : ''}`);
    if (status !== 'PASS') throw Object.assign(new Error(detail), { reported: true, skip: status === 'SKIP' });
    return value;
  }

  /** One signed-in page for each role, shared by the flows of a run. Each sign-in counts toward BR-30. */
  async session(role) {
    if (this.sessions.has(role)) return this.sessions.get(role);
    const context = await this.browser.newContext({ locale: 'vi-VN', timezoneId: ZONE, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    this.watch(page);
    const account = this.accounts[role];
    if (role === 'player' && !account.password) {
      await this.step('setup', 'register a test- player (live)', page, () => register(this, page, account));
    } else {
      if (!account.password) throw new Error(`Set VERIFY_${role.toUpperCase()}_PHONE and VERIFY_${role.toUpperCase()}_PASSWORD for a live run`);
      await this.step('setup', `log in as ${role} ${account.phone}`, page, () => login(this, page, account, role));
    }
    const session = { page, account };
    this.sessions.set(role, session);
    return session;
  }

  watch(page) {
    page.on('response', (r) => {
      if (r.status() >= 500) this.serverErrors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
    });
    page.on('pageerror', (e) => this.serverErrors.push(`script error: ${e.message}`));
  }

  writeReport() {
    const rows = this.results.map((r) => `| ${r.n} | ${r.flow} | ${r.name} | ${r.status} | ${r.detail.replaceAll('|', '/')} | [png](${relative(this.dir, r.file).replaceAll('\\', '/')}) |`);
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
  for (const channel of channels) {
    try {
      return await chromium.launch({ channel, headless: !headed });
    } catch {
      // Try the next browser.
    }
  }
  throw new Error(`No browser found. Install Edge or Chrome, or set VERIFY_BROWSER to an installed channel (tried ${channels.join(', ')}).`);
}

/** The first line of an error, plus the locator that a Playwright timeout waited for. */
const firstLines = (message) => {
  const [head, ...rest] = message.split('\n');
  const waited = rest.find((line) => line.includes('waiting for'))?.trim();
  return waited ? `${head} ${waited}` : head;
};

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
  await page.goto(run.base);
  await page.getByLabel('Số điện thoại').fill(account.phone);
  await page.getByLabel('Mật khẩu').fill(account.password);
  const { status, body } = await clickFor(page, page.getByRole('button', { name: 'Đăng nhập' }), 'POST', '/api/auth/login');
  assert(status !== 429, 'BR-30 blocked the login: wait 15 minutes. See Gotchas in SKILL.md');
  assert(status === 200, `POST /api/auth/login answered ${status}: ${body.message ?? ''}`);
  const want = role === 'owner' ? 'OWNER' : 'USER';
  assert(body.role === want, `the account has role ${body.role}, the flow needs ${want}`);
  await page.getByRole('heading', { name: `Chào ${body.name}` }).waitFor();
  account.name = body.name;
  return `role ${body.role}`;
}

/** A live run signs up a new player named test-… with a random password that lives only in memory. */
async function register(run, page, account) {
  account.name = `test-verify-${run.stamp}`;
  account.phone = `09${String(randomInt(0, 1e8)).padStart(8, '0')}`;
  account.password = randomBytes(18).toString('base64url');
  await page.goto(run.base);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  const form = page.locator('form');
  await form.getByLabel('Tên của bạn').fill(account.name);
  await form.getByLabel('Số điện thoại').fill(account.phone);
  await form.getByLabel('Mật khẩu').fill(account.password);
  await form.getByRole('checkbox').check();
  const { status, body } = await clickFor(page, form.getByRole('button', { name: 'Tạo tài khoản' }), 'POST', '/api/auth/register');
  assert(status === 201, `POST /api/auth/register answered ${status}: ${body.message ?? ''}`);
  await page.getByRole('heading', { name: `Chào ${account.name}` }).waitFor();
  return `${account.name}, phone ${account.phone}`;
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
