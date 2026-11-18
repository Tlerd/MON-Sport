import { dayChipLabel, hhmm, slotAt } from '@monsport/client';
import { addDaysYmd, bookingPrice, vnDateString } from '@monsport/shared';
import { Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import type { ShellContextType } from '../../app/App.tsx';
import { useSession } from '../../app/session.tsx';
import { ActionBar } from '../../components/ActionBar.tsx';
import { Chip } from '../../components/Chip.tsx';
import { ContextBar } from '../../components/ContextBar.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { LoginSheet } from '../auth/LoginSheet.tsx';
import { BookingSheet } from '../bookings/BookingSheet.tsx';
import { VenueCourts } from './VenueCourts.tsx';
import { useVenueAvailability } from './useVenueAvailability.ts';

const NOTICE = 'App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.';
const DAY_COUNT = 7;

const formatK = (price: number) => `${Math.round(price / 1000)}k`;

export interface VenueScreenProps {
  now?: Date;
}

export function VenueScreen({ now: nowProp }: VenueScreenProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setTitle, setOnBack, setTopBarActions } = useOutletContext<ShellContextType>();
  const { user, setUser } = useSession();
  const now = nowProp ?? new Date();
  const today = vnDateString(now);

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginNotice, setLoginNotice] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);

  const {
    venues,
    failed,
    venue,
    date,
    setDate,
    selected,
    setSelected,
    loadVenues,
    loadCourt,
    reloadAllCourts,
    stateOf,
    startableOf,
    allEmpty,
    selectedCourt,
    selectedFree,
    clampedDuration,
  } = useVenueAvailability({ id, today, now });

  useEffect(() => {
    if (!venue) return;
    setTitle(venue.name);
    setOnBack(() => () => navigate('/'));
    setTopBarActions(
      <a
        aria-label="Gọi chủ sân"
        href={`tel:${venue.phone}`}
        style={{
          width: '44px',
          height: '44px',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 'var(--radius-full)',
          color: 'var(--color-primary)',
        }}
      >
        <Phone size={20} aria-hidden="true" />
      </a>,
    );
    return () => {
      setTitle(undefined);
      setOnBack(undefined);
      setTopBarActions(undefined);
    };
  }, [venue, navigate, setTitle, setOnBack, setTopBarActions]);

  useEffect(() => {
    if (user?.role === 'OWNER' && bookingOpen) {
      setBookingOpen(false);
      navigate('/chu-san/yeu-cau');
    }
  }, [user?.role, bookingOpen, navigate]);

  if (failed) {
    return <EmptyState message="Không tải được danh sách đơn vị" actionLabel="Thử lại" onAction={loadVenues} />;
  }
  if (!venues) {
    return (
      <p style={{ margin: 0, padding: 'var(--space-xl) var(--space-base)', textAlign: 'center', font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>
        Đang tải…
      </p>
    );
  }
  if (!venue) {
    return <EmptyState message="Không tìm thấy đơn vị" actionLabel="Về danh sách" onAction={() => navigate('/')} />;
  }

  const days = Array.from({ length: DAY_COUNT }, (_, i) => (i === 0 ? today : addDaysYmd(today, i)));

  const pickDate = (ymd: string) => {
    setDate(ymd);
    setSelected(undefined);
    setBookingOpen(false);
  };

  return (
    <div style={{ minWidth: 0 }}>
      <ContextBar aria-label="Ngày">
        {days.map((ymd, i) => (
          <Chip key={ymd} selected={ymd === date} onClick={() => pickDate(ymd)}>
            {i === 0 ? 'Hôm nay' : dayChipLabel(ymd)}
          </Chip>
        ))}
      </ContextBar>

      <div style={{ paddingTop: '61px', paddingBottom: selected ? '88px' : 0, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            padding: 'var(--space-md) var(--space-base)',
            font: 'var(--font-meta)',
            color: 'var(--color-ink-muted)',
          }}
        >
          {NOTICE}
        </p>

        <VenueCourts
          venue={venue}
          date={date}
          now={now}
          selected={selected}
          allEmpty={allEmpty}
          stateOf={stateOf}
          startableOf={startableOf}
          onRetryCourt={(courtId) => loadCourt(courtId, date)}
          onSelectSlot={setSelected}
        />
      </div>

      {selected && selectedCourt && (
        <ActionBar
          hidden
          title={`${selectedCourt.name} · ${hhmm(selected.start)}–${hhmm(selected.start + clampedDuration)}`}
          price={formatK(
            bookingPrice(
              new Date(slotAt(date, selected.start)),
              new Date(slotAt(date, selected.start + clampedDuration)),
              selectedCourt.priceNormal,
              selectedCourt.pricePeak,
            ),
          )}
          actionLabel="Gửi yêu cầu"
          onAction={() => {
            if (user?.role === 'OWNER') {
              navigate('/chu-san/yeu-cau');
              return;
            }
            if (!user) setLoginOpen(true);
            else setBookingOpen(true);
          }}
          secondary={{ label: 'Gọi chủ sân', href: `tel:${venue.phone}` }}
        />
      )}

      <LoginSheet
        open={loginOpen}
        notice={loginNotice}
        onClose={() => {
          setLoginNotice('');
          setLoginOpen(false);
        }}
        onLoggedIn={() => {
          setLoginNotice('');
          setBookingOpen(true);
        }}
      />

      {selected && selectedCourt && (
        <BookingSheet
          open={bookingOpen && user?.role === 'USER'}
          court={selectedCourt}
          date={date}
          start={selected.start}
          duration={clampedDuration}
          free={selectedFree}
          now={now}
          onDuration={(duration) => setSelected((s) => (s ? { ...s, duration } : s))}
          onClose={() => setBookingOpen(false)}
          onBooked={() => {
            setSelected(undefined);
            reloadAllCourts();
          }}
          onConflict={reloadAllCourts}
          onUnauthorized={() => {
            setBookingOpen(false);
            setUser(null);
            setLoginNotice('Phiên đăng nhập đã hết. Hãy đăng nhập lại.');
            setLoginOpen(true);
          }}
        />
      )}
    </div>
  );
}
