import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { BookPage } from './BookPage.tsx';
import { SessionProvider } from './session.tsx';

describe('BookPage (F-017)', () => {
  // 05:30 on 2026-11-21 in Asia/Ho_Chi_Minh: every cell of the day is still ahead, whatever the real clock says.
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
    opensAt: 360, // 06:00
    closesAt: 1380, // 23:00
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

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function setupFetch(options: { authed?: boolean; phone?: string } = {}) {
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

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <SessionProvider>
          <BookPage />
        </SessionProvider>
      </MemoryRouter>,
    );
  }

  it('AC-3: pick 16:30 of Sân 1 in Chiều, set the duration select to value 60 ("1 giờ"), click the Tối window chip: the summary shows "16:30–17:30" and the 17:00 cell of Sân 1 is selected', async () => {
    setupFetch({ authed: true });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Cầu lông A' })).toBeTruthy();

    // Click "Chiều" window chip (12:00 to 17:00)
    const chieuChip = await screen.findByRole('button', { name: /^Chiều/ });
    fireEvent.click(chieuChip);

    // Pick 16:30 of Sân 1
    const cell1630 = await screen.findByLabelText('Sân 1 16:30 trống');
    fireEvent.click(cell1630);

    // Set duration select to value 60 ("1 giờ")
    const durationSelect = screen.getByLabelText('Thời lượng') as HTMLSelectElement;
    fireEvent.change(durationSelect, { target: { value: '60' } });
    expect(durationSelect.value).toBe('60');

    // Click Tối window chip (17:00 to 23:00)
    const toiChip = screen.getByRole('button', { name: /^Tối/ });
    fireEvent.click(toiChip);

    // Summary shows "16:30–17:30"
    expect(screen.getByText('16:30–17:30')).toBeTruthy();

    // 17:00 cell of Sân 1 is selected
    const cell1700 = screen.getByLabelText('Sân 1 17:00 trống');
    expect(cell1700.classList.contains('selected')).toBe(true);
  });

  it('AC-4: venue phone 0912345678, opens 06:00–23:00, notice text in full with no selection', async () => {
    setupFetch({ authed: true, phone: '0912345678' });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Cầu lông A' })).toBeTruthy();
    expect(screen.getByText('App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.')).toBeTruthy();
    // Neither the court nor the time is picked yet.
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

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Cầu lông A' })).toBeTruthy();
    expect(screen.getByText('Cầu lông Phương Nam')).toBeTruthy();

    const searchInput = screen.getByLabelText('Tìm theo tên sân');
    fireEvent.change(searchInput, { target: { value: 'san dong' } });

    const list = screen.getByRole('list', { name: 'Danh sách đơn vị' });
    expect(within(list).getByText('Cầu lông Phương Nam')).toBeTruthy();
    expect(within(list).queryByText('Cầu lông A')).toBeNull();

    // Click the result: opens the venue and never preselects a court
    fireEvent.click(within(list).getByText('Cầu lông Phương Nam'));
    expect(await screen.findByRole('heading', { name: 'Cầu lông Phương Nam' })).toBeTruthy();
    expect(screen.getAllByText('Chưa chọn')).toHaveLength(2); // Sân and Giờ are both "Chưa chọn"
  });

  it('BookPage duration is clamped to largest allowed option when start cell changes', async () => {
    setupFetch({ authed: true });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Cầu lông A' })).toBeTruthy();

    // Pick 06:00
    const cell0600 = await screen.findByLabelText('Sân 1 06:00 trống');
    fireEvent.click(cell0600);

    // Set duration to 180 ("3 giờ")
    const durationSelect = screen.getByLabelText('Thời lượng') as HTMLSelectElement;
    fireEvent.change(durationSelect, { target: { value: '180' } });
    expect(durationSelect.value).toBe('180');

    // Click "Tối" chip
    const toiChip = screen.getByRole('button', { name: /^Tối/ });
    fireEvent.click(toiChip);

    // Pick 22:00 (venue closes at 23:00, only 60 mins fits)
    const cell2200 = await screen.findByLabelText('Sân 1 22:00 trống');
    fireEvent.click(cell2200);

    // Duration is clamped to 60 (the largest allowed option at 22:00)
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
