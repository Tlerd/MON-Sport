import {
  api,
  ApiError,
  dayChipLabel,
  dayHeading,
  durationsAt,
  formatVnd,
  hhmm,
  slotAt,
} from '@monsport/client';
import {
  bookingPrice,
  confirmDeadline,
  minuteOfDayVN,
  vnDateString,
  type BookingView,
  type CourtView,
  type FreeRange,
} from '@monsport/shared';
import { useEffect, useState } from 'react';
import { Chip } from '../../components/Chip.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';

const durationLabel = (minutes: number) => `${String(minutes / 60).replace('.', ',')} giờ`;

function deadlineHint(now: Date, startAt: Date): string {
  const dl = confirmDeadline(now, startAt);
  const dayWord = vnDateString(dl) === vnDateString(now) ? 'hôm nay' : dayChipLabel(vnDateString(dl));
  return `Chủ sân xác nhận trước ${hhmm(minuteOfDayVN(dl))} ${dayWord}. Bạn trả tiền tại sân.`;
}

export interface BookingSheetProps {
  open: boolean;
  court: CourtView;
  date: string;
  start: number;
  duration: number;
  free: FreeRange[];
  now?: Date;
  onDuration: (duration: number) => void;
  onClose: () => void;
  onBooked?: (booking: BookingView) => void;
  onConflict?: () => void;
}

export function BookingSheet({
  open,
  court,
  date,
  start,
  duration,
  free,
  now: nowProp,
  onDuration,
  onClose,
  onBooked,
  onConflict,
}: BookingSheetProps) {
  const now = nowProp ?? new Date();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState<BookingView | null>(null);

  useEffect(() => {
    setBooking(null);
    setError('');
    setBusy(false);
  }, [open, court.id, date, start]);

  const startIso = slotAt(date, start);
  const endIso = slotAt(date, start + duration);
  const startAt = new Date(startIso);
  const endAt = new Date(endIso);
  const price = booking ? booking.priceTotal : bookingPrice(startAt, endAt, court.priceNormal, court.pricePeak);
  const durations = durationsAt(date, start, free, now);

  const handleSubmit = async () => {
    setError('');
    setBusy(true);
    try {
      const created = await api<BookingView>('/api/bookings', {
        method: 'POST',
        json: {
          courtId: court.id,
          startAt: startIso,
          endAt: endIso,
        },
      });
      setBooking(created);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Khung giờ này vừa có người đặt');
        onConflict?.();
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Không gửi được yêu cầu');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    const sent = booking;
    setBooking(null);
    setError('');
    onClose();
    if (sent) onBooked?.(sent);
  };

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title="Gửi yêu cầu"
      primaryAction={
        booking
          ? undefined
          : {
              label: 'Gửi yêu cầu',
              onClick: handleSubmit,
              disabled: busy,
            }
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {booking && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-sm)',
              padding: 'var(--space-md)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-canvas)',
            }}
          >
            <b style={{ font: 'var(--font-body-strong)', color: 'var(--color-ink)' }}>Đã gửi yêu cầu</b>
            <StatusBadge status={booking.status} />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <b style={{ font: 'var(--font-body-strong)', color: 'var(--color-ink)' }}>{court.name}</b>
          <span style={{ font: 'var(--font-body)', color: 'var(--color-ink-muted)' }}>{dayHeading(date)}</span>
          <span className="tnum" style={{ font: 'var(--font-numeric)', color: 'var(--color-ink)' }}>
            {`${hhmm(start)}–${hhmm(start + duration)}`}
          </span>
        </div>

        {!booking && durations.length > 0 && (
          <div
            role="group"
            aria-label="Thời lượng"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}
          >
            {durations.map((d) => (
              <Chip
                key={d}
                selected={d === duration}
                onClick={() => {
                  setError('');
                  onDuration(d);
                }}
              >
                {durationLabel(d)}
              </Chip>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 'var(--space-sm)',
            borderTop: '1px solid var(--color-line)',
          }}
        >
          <span style={{ font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>Tạm tính</span>
          <strong className="tnum" style={{ font: 'var(--font-numeric)', color: 'var(--color-ink)' }}>
            {formatVnd(price)}
          </strong>
        </div>

        <p style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>
          {deadlineHint(now, startAt)}
        </p>

        {error && (
          <p role="alert" style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}>
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
