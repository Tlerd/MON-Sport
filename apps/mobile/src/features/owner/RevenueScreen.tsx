import { type FinancialPeriod, vnDateString } from '@monsport/shared';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '../../app/session.tsx';
import { Chip } from '../../components/Chip.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { LoginSheet } from '../auth/LoginSheet.tsx';
import { RevenueChart } from './RevenueChart.tsx';
import { RevenueMetrics } from './RevenueMetrics.tsx';
import { UnpaidList } from './UnpaidList.tsx';
import { useOwnerRevenue } from './useOwnerRevenue.ts';

const PERIODS: ReadonlyArray<{ id: FinancialPeriod; label: string }> = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
];

const navBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
  minWidth: '44px',
  padding: '0 var(--space-md)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-line)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-ink)',
  font: 'var(--font-label)',
  cursor: 'pointer',
  flex: '0 0 auto',
};

export interface RevenueScreenProps {
  now?: Date;
}

export function RevenueScreen({ now }: RevenueScreenProps) {
  const { user } = useSession();
  return <RevenueScreenBody key={user?.id ?? 'guest'} now={now} />;
}

function RevenueScreenBody({ now: nowProp }: RevenueScreenProps) {
  const navigate = useNavigate();
  const { user } = useSession();
  const now = nowProp ?? new Date();
  const today = vnDateString(now);

  const {
    active,
    venues,
    venuesFailed,
    setVenuesFailed,
    venue,
    period,
    date,
    currentData,
    financialsFailed,
    bookingsFailed,
    busyIds,
    unpaidAlert,
    setUnpaidAlert,
    rowErrors,
    loginOpen,
    setLoginOpen,
    sessionLoginOpen,
    setSessionLoginOpen,
    heading,
    nextDisabled,
    unpaidItems,
    loadVenues,
    loadBookings,
    loadFinancials,
    handleSessionLoggedIn,
    pickVenue,
    pickPeriod,
    shiftDate,
    markPaid,
  } = useOwnerRevenue({ user, today, navigate });

  if (user === undefined) {
    return <EmptyState message="Đang tải" />;
  }

  if (user === null) {
    return (
      <div style={{ minWidth: 0 }}>
        <EmptyState
          message="Đăng nhập để xem doanh thu"
          actionLabel="Đăng nhập"
          onAction={() => setLoginOpen(true)}
        />
        <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    );
  }

  if (user.role === 'ADMIN' || !active) {
    return null;
  }

  if (!venues) {
    return (
      <div style={{ minWidth: 0 }}>
        {venuesFailed ? (
          <EmptyState
            message="Không tải được"
            actionLabel="Thử lại"
            onAction={() => {
              setVenuesFailed(false);
              loadVenues();
            }}
          />
        ) : (
          <EmptyState message="Đang tải" />
        )}
        <LoginSheet
          open={sessionLoginOpen}
          onClose={() => setSessionLoginOpen(false)}
          onLoggedIn={handleSessionLoggedIn}
          notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
        />
      </div>
    );
  }

  if (venues.length === 0 || !venue) {
    return (
      <div style={{ minWidth: 0 }}>
        <EmptyState message="Bạn chưa có đơn vị nào" />
        <LoginSheet
          open={sessionLoginOpen}
          onClose={() => setSessionLoginOpen(false)}
          onLoggedIn={handleSessionLoggedIn}
          notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
        />
      </div>
    );
  }

  return (
    <div style={{ minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
      {venues.length >= 2 && (
        <div
          role="group"
          aria-label="Đơn vị"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-sm)',
            padding: 'var(--space-sm) var(--space-base)',
            minWidth: 0,
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          {venues.map((v) => (
            <Chip
              key={v.id}
              selected={v.id === venue.id}
              onClick={() => pickVenue(v.id)}
              style={{
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
                minWidth: '44px',
                maxWidth: '100%',
                textAlign: 'left',
              }}
            >
              {v.name}
            </Chip>
          ))}
        </div>
      )}

      <div
        role="group"
        aria-label="Kỳ"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          padding: 'var(--space-sm) var(--space-base)',
          minWidth: 0,
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        {PERIODS.map((p) => (
          <Chip key={p.id} selected={p.id === period} onClick={() => pickPeriod(p.id)}>
            {p.label}
          </Chip>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-sm)',
          padding: 'var(--space-sm) var(--space-base)',
          minWidth: 0,
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        <button type="button" onClick={() => shiftDate(-1)} style={navBtnStyle}>
          Kỳ trước
        </button>
        <h2
          style={{
            margin: 0,
            font: 'var(--font-headline-mobile)',
            color: 'var(--color-ink)',
            minWidth: 0,
            overflowWrap: 'anywhere',
            textAlign: 'center',
            flex: '1 1 0',
          }}
        >
          {heading}
        </h2>
        <button
          type="button"
          disabled={nextDisabled}
          onClick={() => shiftDate(1)}
          style={{
            ...navBtnStyle,
            color: nextDisabled ? 'var(--color-ink-muted)' : 'var(--color-ink)',
            cursor: nextDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          Kỳ sau
        </button>
      </div>

      {financialsFailed ? (
        <EmptyState
          message="Không tải được"
          actionLabel="Thử lại"
          onAction={() => loadFinancials(venue.id, period, date)}
        />
      ) : !currentData ? (
        <EmptyState message="Đang tải" />
      ) : (
        <>
          <RevenueMetrics data={currentData} />
          <RevenueChart points={currentData.chartData} />
        </>
      )}

      <UnpaidList
        items={unpaidItems}
        courts={venue.courts}
        failed={bookingsFailed}
        onRetry={() => {
          setUnpaidAlert(null);
          loadBookings();
        }}
        busyIds={busyIds}
        alertMessage={unpaidAlert}
        rowErrors={rowErrors}
        onMarkPaid={markPaid}
      />

      <LoginSheet
        open={sessionLoginOpen}
        onClose={() => setSessionLoginOpen(false)}
        onLoggedIn={handleSessionLoggedIn}
        notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
      />
    </div>
  );
}
