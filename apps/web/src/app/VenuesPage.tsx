import { Sport, type VenueView } from '@monsport/shared';
import { api } from '@monsport/client';
import { MapPin, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Chip } from '../components/Chip.tsx';
import { CourtArt } from '../components/CourtArt.tsx';
import { SPORT_LABEL } from '../components/MatchCard.tsx';
import { SportIcon } from '../components/SportIcon.tsx';
import { findVenues, normalizeName } from '../features/venues/search.ts';

const NOTICE = 'App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.';

export function VenuesPage() {
  const headingId = useId();
  const [searchParams] = useSearchParams();
  const qParam = searchParams.get('q') ?? '';

  const [venues, setVenues] = useState<VenueView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(qParam);
  const [sportFilter, setSportFilter] = useState<'ALL' | Sport>('ALL');

  useEffect(() => {
    setSearch(qParam);
  }, [qParam]);

  useEffect(() => {
    let active = true;
    api<VenueView[]>('/api/venues')
      .then((list) => {
        if (!active) return;
        setVenues(list);
        setLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setError('Không tải được danh sách đơn vị');
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredVenues = useMemo(() => {
    const wanted = normalizeName(search);
    const matchingCourtIds = wanted
      ? new Set(findVenues(venues, search).map((m) => m.venue.id))
      : null;

    return venues.filter((v) => {
      const matchSport =
        sportFilter === 'ALL' || v.courts.some((c) => c.sport === sportFilter);
      if (!matchSport) return false;
      if (!wanted) return true;
      return (
        Boolean(matchingCourtIds?.has(v.id)) ||
        normalizeName(v.name).includes(wanted) ||
        normalizeName(v.address).includes(wanted)
      );
    });
  }, [venues, search, sportFilter]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Sân</h1>
          <p>Chọn khung giờ rồi gửi yêu cầu. Chủ sân xác nhận, bạn trả tiền tại sân.</p>
        </div>
        <span className="count">{filteredVenues.length} đơn vị</span>
      </div>

      <section className="venues-section" aria-labelledby={headingId}>
        <h2 id={headingId} className="sr">Giờ trống</h2>

        <div className="fbar">
          <div className="chips tight sport-chips" role="group" aria-label="Môn thể thao">
            <Chip selected={sportFilter === 'ALL'} onClick={() => setSportFilter('ALL')}>
              Tất cả môn
            </Chip>
            {Sport.options.map((sp) => (
              <Chip
                key={sp}
                selected={sportFilter === sp}
                icon={<SportIcon sport={sp} size={16} />}
                onClick={() => setSportFilter(sp)}
              >
                {SPORT_LABEL[sp]}
              </Chip>
            ))}
          </div>

          <label className="search inline search-field">
            <Search size={16} className="ic" aria-hidden="true" />
            <span className="sr">Tìm theo tên sân</span>
            <input
              type="text"
              inputMode="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm sân theo tên..."
            />
          </label>
        </div>

        <p className="notice warnbox">{NOTICE}</p>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div role="status" className="live">
          {loaded && filteredVenues.length === 0 && !error && (
            <div className="card empty">
              <span className="empty-ball" aria-hidden="true">
                <MapPin size={24} />
              </span>
              <h3>{normalizeName(search) ? 'Không có sân nào tên như vậy' : 'Chưa có đơn vị nào'}</h3>
              <p>Thử đổi từ khóa tìm kiếm hoặc chọn môn thể thao khác.</p>
            </div>
          )}
        </div>

        {filteredVenues.length > 0 && (
          <ul className="vgrid" aria-label="Danh sách đơn vị">
            {filteredVenues.map((v) => {
              const uniqueSports = Array.from(new Set(v.courts.map((c) => c.sport)));
              const minK =
                v.courts.length > 0
                  ? Math.round(Math.min(...v.courts.map((c) => c.priceNormal)) / 1000)
                  : null;
              return (
                <li key={v.id} className="venue-list-item">
                  <Link to={`/san/${v.id}`} className="card vc venue-card">
                    <div className="vc-art">
                      <CourtArt sport={v.courts[0]?.sport ?? 'BADMINTON'} />
                      <div className="vc-sports">
                        {uniqueSports.map((sp) => (
                          <span key={sp} title={SPORT_LABEL[sp]}>
                            <SportIcon sport={sp} size={15} />
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="vc-b">
                      <h3>{v.name}</h3>
                      <p className="meta">
                        <MapPin size={14} className="ic" aria-hidden="true" />
                        <span>{v.address}</span>
                      </p>
                      <div className="vc-f">
                        <span>{v.courts.length} sân</span>
                        <b>{minK !== null ? `từ ${minK}k/giờ` : '—'}</b>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
