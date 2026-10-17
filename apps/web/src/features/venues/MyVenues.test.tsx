import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyVenues } from './MyVenues.tsx';

const court = (id: string, name: string) => ({ id, name, sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 });
const CAU_LONG_A = {
  id: '0199a1b2-0000-7000-8000-000000000001', name: 'Cầu lông A', address: '12 Lê Lợi', phone: '0912345678', opensAt: 360, closesAt: 1380,
  courts: [court('0199a1b2-0000-7000-8000-000000000002', 'Sân 1'), court('0199a1b2-0000-7000-8000-000000000003', 'Sân 2')],
};

describe('MyVenues', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-28: Bình sees "Cầu lông A" with its courts and prices, and no other venue', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([CAU_LONG_A]) });
    vi.stubGlobal('fetch', fetch);
    render(<MyVenues />);

    const venue = await screen.findByRole('article', { name: 'Cầu lông A' });
    expect(fetch).toHaveBeenCalledWith('/api/owner/venues', expect.anything());
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(within(venue).getByText('06:00–23:00')).toBeTruthy();
    for (const name of ['Sân 1', 'Sân 2']) {
      const row = within(venue).getByText(name).closest('li')!;
      expect(within(row as HTMLElement).getByText('80.000đ')).toBeTruthy();
      expect(within(row as HTMLElement).getByText('120.000đ')).toBeTruthy();
    }
    expect(screen.queryByText('Chưa có sân.')).toBeNull();
  });

  it('shows each court with its own prices', async () => {
    const venue = { ...CAU_LONG_A, courts: [CAU_LONG_A.courts[0], { ...CAU_LONG_A.courts[1], priceNormal: 70_000, pricePeak: 100_000 }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([venue]) }));
    render(<MyVenues />);
    const row = (await screen.findByText('Sân 2')).closest('li') as HTMLElement;
    expect(within(row).getByText('70.000đ')).toBeTruthy();
    expect(within(row).getByText('100.000đ')).toBeTruthy();
  });

  describe('brief F-005: Bình edits the opening hours and the prices', () => {
    const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

    it('AC-13: Bình saves 07:00-22:00, and the card shows the new hours', async () => {
      const saved = { ...CAU_LONG_A, opensAt: 420, closesAt: 1320 };
      const fetch = vi.fn().mockResolvedValueOnce(ok([CAU_LONG_A])).mockResolvedValueOnce(ok(saved));
      vi.stubGlobal('fetch', fetch);
      render(<MyVenues />);
      const venue = await screen.findByRole('article', { name: 'Cầu lông A' });

      fireEvent.click(within(venue).getByRole('button', { name: 'Sửa giờ mở cửa' }));
      fireEvent.change(within(venue).getByLabelText('Mở cửa'), { target: { value: '420' } });
      fireEvent.change(within(venue).getByLabelText('Đóng cửa'), { target: { value: '1320' } });
      fireEvent.click(within(venue).getByRole('button', { name: 'Lưu' }));

      expect(await within(venue).findByText('07:00–22:00')).toBeTruthy();
      const [path, init] = fetch.mock.calls[1];
      expect(path).toBe(`/api/owner/venues/${CAU_LONG_A.id}`);
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body)).toEqual({ opensAt: 420, closesAt: 1320 });
      expect(within(venue).queryByRole('button', { name: 'Lưu' })).toBeNull();
    });

    it('AC-13: the card shows the hours of the response, not of the draft', async () => {
      const stored = { ...CAU_LONG_A, opensAt: 420, closesAt: 1350 };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok([CAU_LONG_A])).mockResolvedValueOnce(ok(stored)));
      render(<MyVenues />);
      const venue = await screen.findByRole('article', { name: 'Cầu lông A' });

      fireEvent.click(within(venue).getByRole('button', { name: 'Sửa giờ mở cửa' }));
      fireEvent.change(within(venue).getByLabelText('Mở cửa'), { target: { value: '420' } });
      fireEvent.change(within(venue).getByLabelText('Đóng cửa'), { target: { value: '1320' } });
      fireEvent.click(within(venue).getByRole('button', { name: 'Lưu' }));

      expect(await within(venue).findByText('07:00–22:30')).toBeTruthy();
    });

    it('AC-14: Bình saves a peak price of 150.000đ for "Sân 1", and its row shows it', async () => {
      const saved = { ...CAU_LONG_A.courts[0], pricePeak: 150_000 };
      const fetch = vi.fn().mockResolvedValueOnce(ok([CAU_LONG_A])).mockResolvedValueOnce(ok(saved));
      vi.stubGlobal('fetch', fetch);
      render(<MyVenues />);
      const venue = await screen.findByRole('article', { name: 'Cầu lông A' });

      fireEvent.click(within(venue).getByRole('button', { name: 'Sửa giá Sân 1' }));
      fireEvent.change(within(venue).getByLabelText('Giá cao điểm (đ)'), { target: { value: '150000' } });
      fireEvent.click(within(venue).getByRole('button', { name: 'Lưu' }));

      const row = (await within(venue).findByText('150.000đ')).closest('li') as HTMLElement;
      expect(within(row).getByText('Sân 1')).toBeTruthy();
      const [path, init] = fetch.mock.calls[1];
      expect(path).toBe(`/api/owner/courts/${CAU_LONG_A.courts[0].id}`);
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body)).toEqual({ priceNormal: 80_000, pricePeak: 150_000 });
    });

    it('AC-15: the form shows the error of the API, and the card keeps 06:00-23:00', async () => {
      const refused = { ok: false, status: 400, json: () => Promise.resolve({ message: 'Giờ đóng cửa phải sau giờ mở cửa' }) };
      const fetch = vi.fn().mockResolvedValueOnce(ok([CAU_LONG_A])).mockResolvedValueOnce(refused);
      vi.stubGlobal('fetch', fetch);
      render(<MyVenues />);
      const venue = await screen.findByRole('article', { name: 'Cầu lông A' });

      fireEvent.click(within(venue).getByRole('button', { name: 'Sửa giờ mở cửa' }));
      fireEvent.change(within(venue).getByLabelText('Mở cửa'), { target: { value: '1320' } });
      fireEvent.change(within(venue).getByLabelText('Đóng cửa'), { target: { value: '1260' } });
      fireEvent.click(within(venue).getByRole('button', { name: 'Lưu' }));

      expect((await within(venue).findByRole('alert')).textContent).toBe('Giờ đóng cửa phải sau giờ mở cửa');
      expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ opensAt: 1320, closesAt: 1260 });
      expect(within(venue).getByText('06:00–23:00')).toBeTruthy();
      expect(within(venue).queryByText('22:00–21:00')).toBeNull();
      expect(within(venue).getByRole('button', { name: 'Lưu' })).toBeTruthy();
    });

    it('moves focus into a form when it opens, and back to its button when it closes', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok([CAU_LONG_A])));
      render(<MyVenues />);
      const venue = await screen.findByRole('article', { name: 'Cầu lông A' });

      fireEvent.click(within(venue).getByRole('button', { name: 'Sửa giá Sân 2' }));
      expect(document.activeElement).toBe(within(venue).getByLabelText('Giá giờ thường (đ)'));
      fireEvent.click(within(venue).getByRole('button', { name: 'Hủy' }));
      expect(document.activeElement).toBe(within(venue).getByRole('button', { name: 'Sửa giá Sân 2' }));
    });

    it('closes the form on "Hủy" without a request', async () => {
      const fetch = vi.fn().mockResolvedValueOnce(ok([CAU_LONG_A]));
      vi.stubGlobal('fetch', fetch);
      render(<MyVenues />);
      const venue = await screen.findByRole('article', { name: 'Cầu lông A' });

      fireEvent.click(within(venue).getByRole('button', { name: 'Sửa giá Sân 2' }));
      fireEvent.click(within(venue).getByRole('button', { name: 'Hủy' }));

      expect(within(venue).queryByLabelText('Giá cao điểm (đ)')).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  it('says so when the owner has no venue yet', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) }));
    render(<MyVenues />);
    expect(await screen.findByText('Bạn chưa có đơn vị nào. Admin gắn đơn vị cho tài khoản của bạn.')).toBeTruthy();
  });
});
