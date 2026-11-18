import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MatchView, MyBookingView, SessionUser, VenueView } from '@monsport/shared';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast.tsx';
import { HomePage } from './HomePage.tsx';

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{`${pathname}${search}`}</div>;
}

describe('HomePage (F-033)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const matchA: MatchView = {
    id: '0199a1b2-0000-7000-8000-000000000201',
    bookingId: '0199a1b2-0000-7000-8000-000000000301',
    hostId: '0199a1b2-0000-7000-8000-000000000101',
    hostName: 'An',
    sport: 'BADMINTON',
    capacity: 4,
    joinedCount: 1,
    pricePerSlot: 50_000,
    status: 'OPEN',
    bookingStatus: 'CONFIRMED',
    startAt: '2026-11-20T11:00:00.000Z',
    endAt: '2026-11-20T12:00:00.000Z',
    courtName: 'Sân 1',
    venueName: 'Cầu lông A',
    venueAddress: '12 Đường 3/2',
    createdAt: '2026-11-19T08:00:00.000Z',
    joinMode: 'INSTANT',
    hostSkillLevel: 'INTERMEDIATE',
  };

  const matchB: MatchView = {
    id: '0199a1b2-0000-7000-8000-000000000202',
    bookingId: '0199a1b2-0000-7000-8000-000000000302',
    hostId: '0199a1b2-0000-7000-8000-000000000102',
    hostName: 'Chi',
    sport: 'FOOTBALL',
    capacity: 10,
    joinedCount: 4,
    pricePerSlot: 60_000,
    status: 'OPEN',
    bookingStatus: 'PENDING',
    startAt: '2026-11-20T12:00:00.000Z',
    endAt: '2026-11-20T13:30:00.000Z',
    courtName: 'Sân 7A',
    venueName: 'Bóng đá B',
    venueAddress: '45 Nguyễn Huệ',
    createdAt: '2026-11-19T09:00:00.000Z',
    joinMode: 'APPROVAL',
    hostSkillLevel: null,
  };

  const venues: VenueView[] = [
    {
      id: 'v1',
      name: 'Cầu lông A',
      address: '12 Đường 3/2',
      phone: '0912345678',
      opensAt: 360,
      closesAt: 1380,
      courts: [{ id: 'c1', name: 'Sân 1', sport: 'BADMINTON', priceNormal: 50_000, pricePeak: 70_000 }],
    },
    {
      id: 'v2',
      name: 'Bóng đá B',
      address: '45 Nguyễn Huệ',
      phone: '0912345679',
      opensAt: 360,
      closesAt: 1380,
      courts: [{ id: 'c2', name: 'Sân 7A', sport: 'FOOTBALL', priceNormal: 200_000, pricePeak: 300_000 }],
    },
    {
      id: 'v3',
      name: 'Sân C',
      address: '89 Lê Lợi',
      phone: '0912345680',
      opensAt: 360,
      closesAt: 1380,
      courts: [{ id: 'c3', name: 'Sân 2', sport: 'BADMINTON', priceNormal: 60_000, pricePeak: 80_000 }],
    },
    {
      id: 'v4',
      name: 'Sân D ẩn khỏi top 3',
      address: '99 Hai Bà Trưng',
      phone: '0912345681',
      opensAt: 360,
      closesAt: 1380,
      courts: [{ id: 'c4', name: 'Sân 3', sport: 'FOOTBALL', priceNormal: 180_000, pricePeak: 250_000 }],
    },
  ];

  const user: SessionUser = {
    id: '0199a1b2-0000-7000-8000-000000000099',
    name: 'Nguyễn Thị Lan',
    role: 'USER',
  };

  const myBookings: MyBookingView[] = [
    {
      id: 'b1',
      courtId: 'c1',
      startAt: '2099-11-21T11:00:00.000Z',
      endAt: '2099-11-21T12:00:00.000Z',
      status: 'CONFIRMED',
      source: 'APP',
      priceTotal: 50_000,
      confirmDeadline: null,
      confirmedAt: '2026-11-19T10:00:00.000Z',
      cancelledAt: null,
      createdAt: '2026-11-19T09:00:00.000Z',
      courtName: 'Sân 1',
      venueName: 'Cầu lông A',
      venuePhone: '0912345678',
      sport: 'BADMINTON',
      match: null,
    },
    {
      id: 'b2',
      courtId: 'c2',
      startAt: '2099-11-22T12:00:00.000Z',
      endAt: '2099-11-22T13:00:00.000Z',
      status: 'PENDING',
      source: 'APP',
      priceTotal: 200_000,
      confirmDeadline: null,
      confirmedAt: null,
      cancelledAt: null,
      createdAt: '2026-11-19T09:30:00.000Z',
      courtName: 'Sân 7A',
      venueName: 'Bóng đá B',
      venuePhone: '0912345679',
      sport: 'FOOTBALL',
      match: null,
    },
    {
      id: 'b3',
      courtId: 'c3',
      startAt: '2099-11-23T12:00:00.000Z',
      endAt: '2099-11-23T13:00:00.000Z',
      status: 'CONFIRMED',
      source: 'APP',
      priceTotal: 60_000,
      confirmDeadline: null,
      confirmedAt: '2026-11-19T10:00:00.000Z',
      cancelledAt: null,
      createdAt: '2026-11-19T09:30:00.000Z',
      courtName: 'Sân 2',
      venueName: 'Sân C chỉ hiện ở lịch',
      venuePhone: '0912345680',
      sport: 'BADMINTON',
      match: null,
    },
  ];

  let currentUser: SessionUser | null = null;

  function setupFetch(options: { authed?: boolean; matches?: MatchView[]; bookings?: MyBookingView[] } = {}) {
    currentUser = options.authed ? user : null;
    const matchList = options.matches ?? [matchA, matchB];
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/auth/me') {
        if (options.authed) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(user) });
        }
        return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ message: 'Bạn cần đăng nhập' }) });
      }
      if (url === '/api/matches') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(matchList) });
      }
      if (url === '/api/venues') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(venues) });
      }
      if (url === '/api/bookings/mine') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(options.bookings ?? myBookings) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function renderHome() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<><HomePage user={currentUser} /><LocationProbe /></>} />
            <Route path="/dang-nhap" element={<LocationProbe />} />
            <Route path="/lich-cua-toi" element={<LocationProbe />} />
            <Route path="/phong-cho" element={<LocationProbe />} />
            <Route path="/san" element={<LocationProbe />} />
            <Route path="/san/:id" element={<LocationProbe />} />
            <Route path="/ho-so" element={<LocationProbe />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>,
    );
  }

  it('AC-4: guest opens / and sees 2 match cards linking to /phong-cho?tran=<id> and no slot grid', async () => {
    setupFetch({ authed: false, matches: [matchA, matchB] });
    const { container } = renderHome();

    const linkA = await screen.findByRole('link', { name: /Cầu lông A · Sân 1/ });
    const linkB = screen.getByRole('link', { name: /Bóng đá B · Sân 7A/ });

    expect(linkA.getAttribute('href')).toBe(`/phong-cho?tran=${matchA.id}`);
    expect(linkB.getAttribute('href')).toBe(`/phong-cho?tran=${matchB.id}`);
    expect(container.querySelectorAll('.mc')).toHaveLength(2);
    expect(container.querySelector('.slot-grid')).toBeNull();
    expect(container.querySelector('.slot-windows')).toBeNull();
    expect(screen.getByText('Đăng nhập để xem lịch của bạn.')).toBeTruthy();
    expect(screen.queryByText(/0912345678/)).toBeNull();
  });

  it('AC-4: a match with a long venue, court, and host name renders every meta part', async () => {
    const longVenueName = 'Trung tâm Thể dục Thể thao Liên hiệp Quận Tân Bình Thành phố';
    const longCourtName = 'Sân thi đấu tiêu chuẩn quốc tế số 01';
    const longHostName = 'Nguyễn Trần Hoàng Minh Quân Anh Dũng Lộc';
    expect(longVenueName).toHaveLength(60);
    expect(longHostName).toHaveLength(40);

    const longMatch: MatchView = {
      ...matchA,
      venueName: longVenueName,
      courtName: longCourtName,
      hostName: longHostName,
    };
    setupFetch({ authed: false, matches: [longMatch] });
    renderHome();

    expect(await screen.findByText(`${longVenueName} · ${longCourtName}`)).toBeTruthy();
    expect(screen.getByText('Cầu lông · Ngày 20/11/2026')).toBeTruthy();
    expect(screen.getByText('18:00–19:00')).toBeTruthy();
    expect(screen.getByText(`Host: ${longHostName}`)).toBeTruthy();
  });

  it('AC-6: a signed-in user sees the user card, the composer, the match list, "Sắp ra sân", and "Đơn vị"', async () => {
    setupFetch({ authed: true, matches: [matchA, matchB] });
    const { container } = renderHome();

    await screen.findByText('Hôm nay ra sân môn gì, Lan?');
    const card = container.querySelector('.lcol .me-card') as HTMLElement;
    expect(card.querySelector('.av')?.textContent).toBe('L');
    expect(card.textContent).toContain('Nguyễn Thị Lan');
    expect(container.querySelector('.composer')).toBeTruthy();
    expect(container.querySelectorAll('.feed .mc')).toHaveLength(2);
    expect(container.querySelector('.mc .btn.lime')?.textContent).toBe('Xem chi tiết');
    expect(container.querySelector('.mc .stack')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Sắp ra sân' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Đơn vị' })).toBeTruthy();
    await vi.waitFor(() => expect(container.querySelectorAll('.rcol .near')).toHaveLength(3));
    await vi.waitFor(() => expect(container.querySelectorAll('.rcol .next')).toHaveLength(2));
  });

  it('AC-5: clicking "Tạo trận" sends guest to /dang-nhap and signed-in user to /lich-cua-toi', async () => {
    setupFetch({ authed: false });
    const firstRender = renderHome();

    await screen.findByText('Hôm nay ra sân môn gì?');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo trận' }));
    expect(screen.getByTestId('location').textContent).toBe('/dang-nhap');
    firstRender.unmount();

    setupFetch({ authed: true });
    renderHome();
    await screen.findByText('Hôm nay ra sân môn gì, Lan?');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo trận' }));
    expect(screen.getByTestId('location').textContent).toBe('/lich-cua-toi');
  });

  it('filters matches by sport chip on client, handles comingSoon actions, and renders upcoming bookings and top 3 venues', async () => {
    setupFetch({ authed: true, matches: [matchA, matchB] });
    const { container } = renderHome();

    await screen.findByText('Cầu lông A · Sân 1');
    expect(screen.getByText('Bóng đá B · Sân 7A')).toBeTruthy();

    expect(screen.queryByText('Sân C chỉ hiện ở lịch')).toBeNull();
    expect(screen.queryByText('Sân D ẩn khỏi top 3')).toBeNull();
    expect(screen.getByText('Sân C')).toBeTruthy();
    expect(screen.getByText('Sắp ra mắt')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cầu lông' }));
    expect(container.querySelectorAll('.mc')).toHaveLength(1);
    expect(screen.getByText('Cầu lông A · Sân 1')).toBeTruthy();
    expect(screen.queryByText('Bóng đá B · Sân 7A')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Trận đội' }));
    expect(screen.getByRole('status').textContent).toContain('Sắp ra mắt');
    expect(screen.getByRole('button', { name: 'Tất cả' }).className).toContain('on');
    expect(screen.getByRole('button', { name: 'Trận đội' }).className).not.toContain('on');

    fireEvent.click(screen.getByRole('button', { name: 'Tất cả môn' }));
    expect(container.querySelectorAll('.mc')).toHaveLength(2);
  });

  it('shows empty state when no open matches match the filter', async () => {
    setupFetch({ authed: false, matches: [] });
    renderHome();

    expect(await screen.findByText('Chưa có trận nào đang mở')).toBeTruthy();
    const bookLinks = screen.getAllByRole('link', { name: 'Đặt sân' });
    expect(bookLinks.some((el) => el.getAttribute('href') === '/san')).toBe(true);
  });
});
