import { Sport, type MatchView, type MyBookingView, type VenueView } from '@monsport/shared';
import { api, formatDay, formatTime, priceRangeK } from '@monsport/client';
import { Calendar, ChevronRight, MapPin, Plus, Shield, Trophy, Users } from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { CourtArt } from '../components/CourtArt.tsx';
import { MatchCardContent, SPORT_LABEL } from '../components/MatchCard.tsx';
import { SportIcon } from '../components/SportIcon.tsx';
import { useToast } from '../components/Toast.tsx';
import { initial } from './shells.tsx';
import { useSession } from './session.tsx';

const givenName = (name: string) => name.normalize('NFC').trim().split(/\s+/).at(-1) ?? name;

export function HomePage() {
  const { user } = useSession();
  const { comingSoon } = useToast();
  const navigate = useNavigate();

  const [matches, setMatches] = useState<MatchView[] | null>(null);
  const [matchesError, setMatchesError] = useState('');
  const [venues, setVenues] = useState<VenueView[]>([]);
  const [bookings, setBookings] = useState<MyBookingView[]>([]);
  const [sportFilter, setSportFilter] = useState<'ALL' | Sport>('ALL');
  const [typeTab, setTypeTab] = useState<'ALL' | 'SINGLE'>('ALL');

  useEffect(() => {
    let active = true;
    api<MatchView[]>('/api/matches')
      .then((list) => {
        if (active) setMatches(list);
      })
      .catch(() => {
        if (active) setMatchesError('Không tải được danh sách trận đang mở');
      });
    api<VenueView[]>('/api/venues')
      .then((list) => {
        if (active) setVenues(list);
      })
      .catch(() => {
        if (active) setVenues([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (user?.role !== 'USER') {
      setBookings([]);
      return;
    }
    let active = true;
    api<MyBookingView[]>('/api/bookings/mine')
      .then((list) => {
        if (active) setBookings(list);
      })
      .catch(() => {
        if (active) setBookings([]);
      });
    return () => {
      active = false;
    };
  }, [user?.id, user?.role]);

  const filteredMatches = useMemo(() => {
    if (!matches) return null;
    if (sportFilter === 'ALL') return matches;
    return matches.filter((m) => m.sport === sportFilter);
  }, [matches, sportFilter]);

  const upcomingBookings = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter((b) => (b.status === 'PENDING' || b.status === 'CONFIRMED') && Date.parse(b.endAt) > now)
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
      .slice(0, 2);
  }, [bookings]);

  const createMatchTarget = user ? '/lich-cua-toi' : '/dang-nhap';

  return (
    <div className="cols3">
      <aside className="lcol" aria-label="Điều hướng bên">
        {user ? (
          <Link to="/ho-so" className="card me-card">
            <span className="av" style={{ '--s': '44px', '--c': 'var(--ok)' } as CSSProperties} aria-hidden="true">
              {initial(user.name)}
            </span>
            <span>
              <b>{user.name}</b>
              <small>Xem hồ sơ</small>
            </span>
          </Link>
        ) : (
          <div className="card pad">
            <Link to="/dang-nhap" className="btn lime wide">
              Đăng nhập
            </Link>
          </div>
        )}
        <nav className="lnav" aria-label="Lối tắt">
          {user && (
            <NavLink to="/lich-cua-toi" className={({ isActive }) => (isActive ? 'on active' : '')}>
              <Calendar size={18} className="ic" aria-hidden="true" />
              <span>Lịch của tôi</span>
            </NavLink>
          )}
          <NavLink to="/phong-cho" className={({ isActive }) => (isActive ? 'on active' : '')}>
            <Users size={18} className="ic" aria-hidden="true" />
            <span>Ghép trận</span>
          </NavLink>
          <NavLink to="/san" className={({ isActive }) => (isActive ? 'on active' : '')}>
            <MapPin size={18} className="ic" aria-hidden="true" />
            <span>Tìm sân</span>
          </NavLink>
          <button type="button" className="lnav-btn" onClick={comingSoon}>
            <Shield size={18} className="ic" aria-hidden="true" />
            <span>Đội của tôi</span>
          </button>
          <button type="button" className="lnav-btn" onClick={comingSoon}>
            <Trophy size={18} className="ic" aria-hidden="true" />
            <span>Thành tích</span>
          </button>
        </nav>
      </aside>

      <div className="feed">
        <section className="card composer" aria-label="Bắt đầu ra sân">
          <div className="composer-row">
            <span
              className="av"
              style={{ '--s': '42px', '--c': user ? 'var(--ok)' : 'var(--ink)' } as CSSProperties}
              aria-hidden="true"
            >
              {user ? initial(user.name) : 'M'}
            </span>
            <button
              type="button"
              className="composer-in"
              data-field={user ? 'customer' : undefined}
              onClick={() => navigate(createMatchTarget)}
            >
              {user ? `Hôm nay ra sân môn gì, ${givenName(user.name)}?` : 'Hôm nay ra sân môn gì?'}
            </button>
          </div>
          <div className="composer-acts">
            <button type="button" aria-label="Tạo trận" onClick={() => navigate(createMatchTarget)}>
              <Plus size={18} className="ic" aria-hidden="true" />
              <span>
                <b>Tạo trận</b>
                <small>Mở suất trên booking</small>
              </span>
            </button>
            <button type="button" aria-label="Tạo trận đội" onClick={comingSoon}>
              <Shield size={18} className="ic" aria-hidden="true" />
              <span>
                <b>Tạo trận đội</b>
                <small>Tìm đối giao lưu</small>
              </span>
            </button>
            <Link to="/san" aria-label="Đặt sân">
              <MapPin size={18} className="ic" aria-hidden="true" />
              <span>
                <b>Đặt sân</b>
                <small>Chọn khung giờ trống</small>
              </span>
            </Link>
          </div>
        </section>

        <div className="chips" role="group" aria-label="Môn thể thao">
          <button
            type="button"
            className={sportFilter === 'ALL' ? 'chip on' : 'chip'}
            onClick={() => setSportFilter('ALL')}
          >
            Tất cả môn
          </button>
          {Sport.options.map((sp) => (
            <button
              type="button"
              key={sp}
              className={sportFilter === sp ? 'chip on' : 'chip'}
              onClick={() => setSportFilter(sp)}
            >
              <SportIcon sport={sp} size={15} />
              <span>{SPORT_LABEL[sp]}</span>
            </button>
          ))}
        </div>

        <div className="feed-head">
          <h2>Trận đang mở</h2>
          <div className="seg" role="group" aria-label="Loại trận">
            <button
              type="button"
              className={typeTab === 'ALL' ? 'on' : ''}
              onClick={() => setTypeTab('ALL')}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={typeTab === 'SINGLE' ? 'on' : ''}
              onClick={() => setTypeTab('SINGLE')}
            >
              Trận đơn
            </button>
            <button type="button" onClick={comingSoon}>
              Trận đội
            </button>
          </div>
        </div>

        {matchesError && (
          <p className="error" role="alert">
            {matchesError}
          </p>
        )}

        {filteredMatches && filteredMatches.length === 0 && !matchesError && (
          <div className="card empty">
            <span className="empty-ball" aria-hidden="true">
              <Users size={24} />
            </span>
            <h3>Chưa có trận nào đang mở</h3>
            <p>Đặt một sân rồi mở trận để rủ thêm người chơi cùng giờ.</p>
            <Link to="/san" className="btn lime sm">
              Đặt sân
            </Link>
          </div>
        )}

        {filteredMatches && filteredMatches.length > 0 && (
          <div className="md-list">
            {filteredMatches.map((m) => (
              <Link key={m.id} to={`/phong-cho?tran=${m.id}`} className="card mc">
                <MatchCardContent
                  match={m}
                  footerAction={
                    <span className="more">
                      Xem chi tiết
                      <ChevronRight size={15} className="ic" aria-hidden="true" />
                    </span>
                  }
                />
              </Link>
            ))}
          </div>
        )}
      </div>

      <aside className="rcol" aria-label="Thông tin nhanh">
        <section className="card side-card">
          <h4>Sắp ra sân</h4>
          {user ? (
            <>
              {upcomingBookings.length > 0 ? (
                upcomingBookings.map((b) => (
                  <Link key={b.id} to="/lich-cua-toi" className="next">
                    <div className="next-t">
                      <b>{formatTime(b.startAt)}</b>
                      <small>{formatDay(b.startAt).slice(0, 5)}</small>
                    </div>
                    <div>
                      <b>{b.venueName}</b>
                      <small>
                        <MapPin size={12} className="ic" aria-hidden="true" />
                        <span>{b.courtName}</span>
                      </small>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="dim small">Bạn chưa có lịch sắp tới.</p>
              )}
              <Link to="/lich-cua-toi" className="more">
                Xem toàn bộ lịch
                <ChevronRight size={14} className="ic" aria-hidden="true" />
              </Link>
            </>
          ) : (
            <p className="dim small">Đăng nhập để xem lịch của bạn.</p>
          )}
        </section>

        <section className="card side-card">
          <h4>Đơn vị</h4>
          {venues.slice(0, 3).map((v) => (
            <Link key={v.id} to={`/san/${v.id}`} className="near">
              <div className="near-art">
                <CourtArt sport={v.courts[0]?.sport ?? 'BADMINTON'} />
              </div>
              <div>
                <b>{v.name}</b>
                <small>{`${priceRangeK(v.courts)}/giờ`}</small>
              </div>
            </Link>
          ))}
          <Link to="/san" className="more">
            Tất cả đơn vị
            <ChevronRight size={14} className="ic" aria-hidden="true" />
          </Link>
        </section>

        <section className="card side-card">
          <h4>Bạn chơi quen</h4>
          <p className="dim small">Sắp ra mắt</p>
        </section>
      </aside>
    </div>
  );
}
