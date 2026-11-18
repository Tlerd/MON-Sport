import type { VenueView } from '@monsport/shared';
import { api } from '@monsport/client';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookPage } from './BookPage.tsx';

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
}

function VenuesRouteStub() {
  const [venues, setVenues] = useState<VenueView[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    void api<VenueView[]>('/api/venues').then(setVenues);
  }, []);

  const wanted = normalize(search);
  const filtered = venues.filter((v) => {
    if (!wanted) return true;
    return (
      normalize(v.name).includes(wanted) ||
      normalize(v.address).includes(wanted) ||
      v.courts.some((c) => normalize(c.name).includes(wanted))
    );
  });

  return (
    <div>
      <label>
        <span>Tìm theo tên sân</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <ul aria-label="Danh sách đơn vị">
        {filtered.map((v) => (
          <li key={v.id}>
            <Link to={`/san/${v.id}`}>{v.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

describe('BookPage (F-017)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T22:30:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const venue = {
    id: '0199a1b2-0000-7000-8000-000000000001',
    name: 'Cầu lông A',
    address: '123 Đường 3/2',
    phone: '0912345678',
    opensAt: 360,
    closesAt: 1380,
    courts: [
      {
        id: 'court-1',
        venueId: '0199a1b2-0000-7000-8000-000000000001',
        name: 'Sân 1',
        sport: 'BADMINTON' as const,
        priceNormal: 50_000,
        pricePeak: 70_000,
      },
    ],
  };

  const user = {
    id: '0199a1b2-0000-7000-8000-000000000002',
    name: 'An',
    role: 'USER' as const,
  };

  let currentUser: typeof user | null = user;

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function setupFetch(options: { authed?: boolean; phone?: string } = {}) {
    currentUser = options.authed ? user : null;
    const v = options.phone ? { ...venue, phone: options.phone } : venue;
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/auth/me') {
        if (options.authed) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(user) });
        }
        return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ message: 'Bạn cần đăng nhập' }) });
      }
      if (url === '/api/venues') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([v]) });
      }
      if (url.startsWith('/api/courts/court-1/availability')) {
        const u = new URL(url, 'http://localhost');
        const qDate = u.searchParams.get('date') ?? '2026-11-21';
        const startAt = new Date(`${qDate}T06:00:00+07:00`).toISOString();
        const endAt = new Date(`${qDate}T23:00:00+07:00`).toISOString();
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ courtId: 'court-1', free: [{ startAt, endAt }] }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function renderPage(initialPath = `/san/${venue.id}`) {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/san" element={<VenuesRouteStub />} />
          <Route path="/san/:id" element={<BookPage user={currentUser} />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('AC-3: pick 16:30 of Sân 1 in Chiều, set the duration select to value 60 ("1 giờ"), click the Tối window chip: the summary shows "16:30–17:30" and the 17:00 cell of Sân 1 is selected', async () => {
    setupFetch({ authed: true });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Cầu lông A' })).toBeTruthy();

    const chieuChip = await screen.findByRole('button', { name: /^Chiều/ });
    fireEvent.click(chieuChip);

    const cell1630 = await screen.findByLabelText('Sân 1 16:30 trống');
    fireEvent.click(cell1630);

    const durationSelect = screen.getByLabelText('Thời lượng') as HTMLSelectElement;
    fireEvent.change(durationSelect, { target: { value: '60' } });
    expect(durationSelect.value).toBe('60');

    const toiChip = screen.getByRole('button', { name: /^Tối/ });
    fireEvent.click(toiChip);

    expect(screen.getByText('16:30–17:30')).toBeTruthy();

    const cell1700 = screen.getByLabelText('Sân 1 17:00 trống');
    expect(cell1700.classList.contains('selected')).toBe(true);
  });

  it('AC-4: venue phone 0912345678, opens 06:00–23:00, notice text in full with no selection', async () => {
    setupFetch({ authed: true, phone: '0912345678' });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Cầu lông A' })).toBeTruthy();
    expect(screen.getByText('App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.')).toBeTruthy();
    expect(screen.getAllByText('Chưa chọn')).toHaveLength(2);
  });

  it('AC-5: after picking a free cell a link with href "tel:0912345678" and text "Gọi chủ sân"', async () => {
    setupFetch({ authed: true, phone: '0912345678' });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Cầu lông A' })).toBeTruthy();

    const submitBtn = screen.getByRole('button', { name: 'Gửi yêu cầu' });
    const summarySection = submitBtn.closest('section')!;
    expect(within(summarySection).queryByRole('link', { name: 'Gọi chủ sân' })).toBeNull();

    const chieuChip = await screen.findByRole('button', { name: /^Chiều/ });
    fireEvent.click(chieuChip);
    const cell1630 = await screen.findByLabelText('Sân 1 16:30 trống');
    fireEvent.click(cell1630);

    const callLink = await within(summarySection).findByRole('link', { name: 'Gọi chủ sân' });
    expect(callLink.getAttribute('href')).toBe('tel:0912345678');
  });

  it('a venue whose court is "Sân Đông", typing "san dong" shows that venue and does not preselect a court', async () => {
    const venueDong = {
      id: '0199a1b2-0000-7000-8000-000000000099',
      name: 'Cầu lông Phương Nam',
      address: '456 Lê Lợi',
      phone: '0988888888',
      opensAt: 360,
      closesAt: 1380,
      courts: [
        {
          id: 'court-dong',
          venueId: '0199a1b2-0000-7000-8000-000000000099',
          name: 'Sân Đông',
          sport: 'BADMINTON' as const,
          priceNormal: 60_000,
          pricePeak: 80_000,
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/venues') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([venue, venueDong]) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    renderPage('/san');

    expect(await screen.findByText('Cầu lông A')).toBeTruthy();
    expect(screen.getByText('Cầu lông Phương Nam')).toBeTruthy();

    const searchInput = screen.getByLabelText('Tìm theo tên sân');
    fireEvent.change(searchInput, { target: { value: 'san dong' } });

    const list = screen.getByRole('list', { name: 'Danh sách đơn vị' });
    expect(within(list).getByText('Cầu lông Phương Nam')).toBeTruthy();
    expect(within(list).queryByText('Cầu lông A')).toBeNull();

    fireEvent.click(within(list).getByRole('link', { name: /Cầu lông Phương Nam/ }));
    expect(await screen.findByRole('heading', { name: 'Cầu lông Phương Nam' })).toBeTruthy();
    expect(screen.getAllByText('Chưa chọn')).toHaveLength(2);
  });

  it('BookPage duration is clamped to largest allowed option when start cell changes', async () => {
    setupFetch({ authed: true });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Cầu lông A' })).toBeTruthy();

    const cell0600 = await screen.findByLabelText('Sân 1 06:00 trống');
    fireEvent.click(cell0600);

    const durationSelect = screen.getByLabelText('Thời lượng') as HTMLSelectElement;
    fireEvent.change(durationSelect, { target: { value: '180' } });
    expect(durationSelect.value).toBe('180');

    const toiChip = screen.getByRole('button', { name: /^Tối/ });
    fireEvent.click(toiChip);

    const cell2200 = await screen.findByLabelText('Sân 1 22:00 trống');
    fireEvent.click(cell2200);

    expect((screen.getByLabelText('Thời lượng') as HTMLSelectElement).value).toBe('60');
    expect(screen.getByText('22:00–23:00')).toBeTruthy();
  });

  it('the 22:30 cell of Sân 1 is disabled', async () => {
    setupFetch({ authed: true });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Cầu lông A' })).toBeTruthy();

    const toiChip = await screen.findByRole('button', { name: /^Tối/ });
    fireEvent.click(toiChip);

    const cell2230 = (await screen.findByLabelText(/Sân 1 22:30/)) as HTMLButtonElement;
    expect(cell2230.disabled).toBe(true);
  });
});
