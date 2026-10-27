import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import { VenueListScreen } from './VenueListScreen';

vi.mock('@monsport/client', async () => {
  const actual = await vi.importActual<typeof import('@monsport/client')>('@monsport/client');
  return { ...actual, api: vi.fn() };
});

const courts = (sport: 'BADMINTON' | 'FOOTBALL', priceNormal: number, pricePeak: number) =>
  ['Sân 1', 'Sân 2'].map((name, i) => ({ id: `00000000-0000-4000-8000-00000000000${i}`, name, sport, priceNormal, pricePeak }));
const venue = (id: string, name: string, phone: string, cs: ReturnType<typeof courts>) => ({
  id,
  name,
  address: 'Hà Nội',
  phone,
  opensAt: 360,
  closesAt: 1380,
  courts: cs,
});
const VENUES = [
  venue('v1', 'Cầu lông A', '0912345678', courts('BADMINTON', 80000, 120000)),
  venue('v2', 'Cầu lông B', '0912345679', courts('BADMINTON', 70000, 100000)),
  venue('v3', 'Bóng đá A', '0912345680', courts('FOOTBALL', 300000, 500000)),
];

function open() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<VenueListScreen />} />
        <Route path="/don-vi/:id" element={<p>Đơn vị</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('VenueListScreen', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('AC-4: shows the notice and one 3-line card for each venue', async () => {
    vi.mocked(clientModule.api).mockResolvedValue(VENUES);
    open();
    expect(screen.getByText('App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.')).toBeDefined();
    const card = (await screen.findByText('Cầu lông A')).closest('button')!;
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    const lines = Array.from(card.children).map((el) => el.textContent);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Cầu lông A');
    expect(lines[1]).toBe('Cầu lông · 2 sân');
    expect(card.children[1].querySelector('svg')).not.toBeNull();
    expect(lines[2]).toBe('80k–120k · 06:00–23:00');
    expect(clientModule.api).toHaveBeenCalledWith('/api/venues');
  });

  it('AC-5: a sport chip filters the cards, and Tất cả shows them all again', async () => {
    vi.mocked(clientModule.api).mockResolvedValue(VENUES);
    open();
    await screen.findByText('Cầu lông A');
    expect(screen.getByRole('button', { name: 'Tất cả' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Bóng đá' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Bóng đá A')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Bóng đá' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Tất cả' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('AC-6: on error it shows the message, and Thử lại calls the API again', async () => {
    vi.mocked(clientModule.api).mockRejectedValueOnce(new ApiError(500, 'Có lỗi, hãy thử lại'));
    open();
    expect(await screen.findByText('Không tải được danh sách đơn vị')).toBeDefined();
    expect(clientModule.api).toHaveBeenCalledTimes(1);

    vi.mocked(clientModule.api).mockResolvedValueOnce(VENUES);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(clientModule.api).toHaveBeenCalledTimes(2));
    expect(vi.mocked(clientModule.api).mock.calls[1][0]).toBe('/api/venues');
    expect(await screen.findByText('Cầu lông A')).toBeDefined();
  });

  it('a card opens the venue route', async () => {
    vi.mocked(clientModule.api).mockResolvedValue(VENUES);
    open();
    fireEvent.click((await screen.findByText('Bóng đá A')).closest('button')!);
    expect(await screen.findByText('Đơn vị')).toBeDefined();
  });
});
