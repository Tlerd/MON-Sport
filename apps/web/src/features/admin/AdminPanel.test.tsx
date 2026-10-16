import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminPanel } from './AdminPanel.tsx';

const NOW = '2026-10-17T03:00:00.000Z';
const AN = { id: '0199a1b2-0000-7000-8000-00000000000a', name: 'An', phone: '0901234567', role: 'USER', lockedAt: null as string | null, createdAt: NOW };

/** A small in-memory API: enough of the admin routes of brief F-003 for the screen. */
function fakeApi() {
  const owners: object[] = [];
  const venues: { id: string; courts: object[] }[] = [];
  let an = { ...AN };
  let n = 0;
  const id = () => `0199a1b2-0000-7000-8000-${String(++n).padStart(12, '0')}`;
  return vi.fn((url: string, init: RequestInit = {}) => {
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const reply = (status: number, json: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(json) });
    if (url === '/api/admin/owners' && init.method === 'POST') {
      const owner = { id: id(), name: body.name, phone: body.phone, role: 'OWNER', lockedAt: null, createdAt: NOW };
      owners.push(owner);
      return reply(201, owner);
    }
    if (url === '/api/admin/owners') return reply(200, [...owners]);
    if (url === '/api/admin/venues' && init.method === 'POST') {
      const owner = owners.find((o) => (o as { id: string }).id === body.ownerId);
      const venue = { ...body, id: id(), courts: [], owner };
      venues.push(venue);
      return reply(201, venue);
    }
    if (url === '/api/admin/venues') return reply(200, [...venues]);
    const courts = url.match(/^\/api\/admin\/venues\/(.+)\/courts$/);
    if (courts) return reply(201, { id: id(), ...body });
    if (url === '/api/admin/users/search') return reply(200, body.phone === AN.phone ? [an] : []);
    const lock = url.match(/^\/api\/admin\/users\/.+\/(lock|unlock)$/);
    if (lock) {
      an = { ...an, lockedAt: lock[1] === 'lock' ? NOW : null };
      return reply(200, an);
    }
    return reply(404, { message: 'Không tìm thấy' });
  });
}

const type = (scope: HTMLElement, label: string, value: string) => fireEvent.change(within(scope).getByLabelText(label), { target: { value } });

describe('AdminPanel', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-26: the admin creates owner Giang, venue "Cầu lông C" for Giang, then "Sân 1", and the list shows them', async () => {
    const fetch = fakeApi();
    vi.stubGlobal('fetch', fetch);
    render(<AdminPanel />);
    const owners = (await screen.findByRole('heading', { name: 'Chủ sân' })).closest('section')!;

    fireEvent.click(within(owners).getByText('Tạo chủ sân', { selector: 'summary' }));
    type(owners, 'Tên chủ sân', 'Giang');
    type(owners, 'Số điện thoại chủ sân', '0912345681');
    type(owners, 'Mật khẩu ban đầu', 'matkhau123');
    fireEvent.click(within(owners).getByRole('button', { name: 'Tạo chủ sân' }));
    expect(await within(owners).findByText('0912345681')).toBeTruthy();

    const venues = screen.getByRole('heading', { name: 'Đơn vị' }).closest('section')!;
    type(venues, 'Tên đơn vị', 'Cầu lông C');
    fireEvent.change(within(venues).getByLabelText('Chủ sân của đơn vị'), { target: { value: within(venues).getByRole('option', { name: 'Giang (0912345681)' }).getAttribute('value') } });
    type(venues, 'Địa chỉ', '12 Lê Lợi');
    type(venues, 'Số điện thoại cho nút Gọi chủ sân', '0912345681');
    fireEvent.click(within(venues).getByRole('button', { name: 'Tạo đơn vị' }));
    const venue = await within(venues).findByRole('article', { name: 'Cầu lông C' });
    expect(within(venue).getByText('06:00–23:00')).toBeTruthy();
    expect(JSON.parse(fetch.mock.calls.find(([u, i]) => u === '/api/admin/venues' && i?.method === 'POST')![1]!.body as string)).toMatchObject({ opensAt: 360, closesAt: 1380 });

    const add = within(venue).getByRole('group', { name: 'Thêm sân vào Cầu lông C' });
    type(add, 'Tên sân', 'Sân 1');
    type(add, 'Giờ thường (đ)', '80000');
    type(add, 'Cao điểm (đ)', '120000');
    fireEvent.click(within(add).getByRole('button', { name: 'Thêm sân' }));
    expect(await within(venue).findByText('Sân 1', { selector: '.court-name' })).toBeTruthy();
    expect(within(venue).getByText('120.000đ')).toBeTruthy();
  });

  it('AC-27: the admin finds 0901234567 and locks An, and the row shows "Đã khóa" and "Mở khóa"', async () => {
    vi.stubGlobal('fetch', fakeApi());
    render(<AdminPanel />);
    const lock = (await screen.findByRole('heading', { name: 'Khóa tài khoản' })).closest('section')!;
    type(lock, 'Số điện thoại cần tìm', '0901234567');
    fireEvent.click(within(lock).getByRole('button', { name: 'Tìm' }));
    const row = await within(lock).findByRole('listitem', { name: 'An' });
    fireEvent.click(within(row).getByRole('button', { name: 'Khóa' }));

    expect(await within(lock).findByText('Đã khóa')).toBeTruthy();
    expect(within(lock).getByRole('button', { name: 'Mở khóa' })).toBeTruthy();
  });

  it('says so when no account has the phone number', async () => {
    vi.stubGlobal('fetch', fakeApi());
    render(<AdminPanel />);
    const lock = (await screen.findByRole('heading', { name: 'Khóa tài khoản' })).closest('section')!;
    type(lock, 'Số điện thoại cần tìm', '0909999999');
    fireEvent.click(within(lock).getByRole('button', { name: 'Tìm' }));
    expect(await within(lock).findByText('Không có tài khoản nào dùng số này.')).toBeTruthy();
  });
});
