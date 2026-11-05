import {
  api,
  ApiError,
  formatDay,
  formatVnd,
  hhmm,
  ownerDurationsAt,
  slotAt,
} from '@monsport/client';
import {
  bookingPrice,
  type CreatePhoneBookingRequest,
  type FreeRange,
  type OwnerBookingView,
} from '@monsport/shared';
import { useEffect, useRef, useState } from 'react';
import { Chip } from '../../components/Chip.tsx';
import { Sheet } from '../../components/Sheet.tsx';

const TAKEN_409 = 'Khung giờ này vừa có người đặt';
const durationLabel = (minutes: number) => `${String(minutes / 60).replace('.', ',')} giờ`;

export interface PhoneBookingCourt {
  id: string;
  name: string;
  priceNormal: number;
  pricePeak: number;
}

export interface PhoneBookingSheetProps {
  open?: boolean;
  court: PhoneBookingCourt;
  date: string;
  start: number;
  free: FreeRange[];
  now?: Date;
  onSaved: (booking: OwnerBookingView) => void;
  onClose: (conflictMessage?: string) => void;
  onSessionExpired: () => void;
  onCourtGone: (message: string) => void;
  onConflict?: (message: string) => void;
}

export function PhoneBookingSheet({
  open = true,
  court,
  date,
  start,
  free,
  now: nowProp,
  onSaved,
  onClose,
  onSessionExpired,
  onCourtGone,
  onConflict,
}: PhoneBookingSheetProps) {
  const now = nowProp ?? new Date();
  const [duration, setDuration] = useState(60);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setDuration(60);
    setCustomerName('');
    setCustomerPhone('');
    setError('');
    setBusy(false);
    busyRef.current = false;
  }, [court.id, date, start]);

  const durations = ownerDurationsAt(date, start, free, now);
  const activeDuration = durations.includes(duration) ? duration : (durations[0] ?? 60);
  const valid = durations.includes(activeDuration);

  const startIso = slotAt(date, start);
  const endIso = slotAt(date, start + activeDuration);
  const startDate = new Date(startIso);
  const endDate = new Date(endIso);
  const price = bookingPrice(startDate, endDate, court.priceNormal, court.pricePeak);

  const handleSubmit = async () => {
    if (busyRef.current || !valid) return;
    busyRef.current = true;
    setBusy(true);
    setError('');

    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();
    const body: CreatePhoneBookingRequest = {
      courtId: court.id,
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      ...(trimmedName ? { customerName: trimmedName } : {}),
      ...(trimmedPhone ? { customerPhone: trimmedPhone } : {}),
    };

    try {
      const created = await api<OwnerBookingView>('/api/owner/bookings', {
        method: 'POST',
        json: body,
      });
      if (!mountedRef.current) return;
      onSaved(created);
    } catch (err) {
      if (!mountedRef.current) return;
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
      } else if (err instanceof ApiError && err.status === 409 && err.message === TAKEN_409) {
        onConflict?.(err.message);
        onClose(err.message);
      } else if (err instanceof ApiError && err.status === 404) {
        onCourtGone(err.message);
        onClose();
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Không lưu được booking. Thử lại.');
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => onClose()}
      title="Nhập booking khách gọi"
      primaryAction={{
        label: 'Lưu booking',
        onClick: handleSubmit,
        disabled: busy || !valid,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', minWidth: 0 }}>
          <b
            style={{
              font: 'var(--font-body-strong)',
              color: 'var(--color-ink)',
              minWidth: 0,
              overflowWrap: 'anywhere',
            }}
          >
            {court.name}
          </b>
          <span
            className="tnum"
            style={{
              font: 'var(--font-body)',
              color: 'var(--color-ink-muted)',
              minWidth: 0,
              overflowWrap: 'anywhere',
            }}
          >
            {`${hhmm(start)} ngày ${formatDay(startIso)}`}
          </span>
        </div>

        {durations.length > 0 && (
          <div
            role="group"
            aria-label="Thời lượng"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', minWidth: 0 }}
          >
            {durations.map((d) => (
              <Chip
                key={d}
                selected={d === activeDuration}
                onClick={() => {
                  setError('');
                  setDuration(d);
                }}
              >
                {durationLabel(d)}
              </Chip>
            ))}
          </div>
        )}

        <div style={{ minWidth: 0 }}>
          <label
            htmlFor="phone-booking-name"
            style={{
              display: 'block',
              font: 'var(--font-label)',
              color: 'var(--color-ink)',
              marginBottom: 'var(--space-xs)',
            }}
          >
            Tên khách
          </label>
          <input
            id="phone-booking-name"
            type="text"
            maxLength={100}
            autoComplete="off"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            style={{
              width: '100%',
              height: '44px',
              minHeight: '44px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-line)',
              padding: '0 var(--space-md)',
              font: 'var(--font-body)',
              color: 'var(--color-ink)',
              backgroundColor: 'var(--color-surface)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ minWidth: 0 }}>
          <label
            htmlFor="phone-booking-phone"
            style={{
              display: 'block',
              font: 'var(--font-label)',
              color: 'var(--color-ink)',
              marginBottom: 'var(--space-xs)',
            }}
          >
            Số điện thoại
          </label>
          <input
            id="phone-booking-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            style={{
              width: '100%',
              height: '44px',
              minHeight: '44px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-line)',
              padding: '0 var(--space-md)',
              font: 'var(--font-body)',
              color: 'var(--color-ink)',
              backgroundColor: 'var(--color-surface)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 'var(--space-sm)',
            borderTop: '1px solid var(--color-line)',
            minWidth: 0,
          }}
        >
          <span style={{ font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>Giá</span>
          <strong className="tnum" style={{ font: 'var(--font-numeric)', color: 'var(--color-ink)' }}>
            {formatVnd(price)}
          </strong>
        </div>

        {error && (
          <p
            role="alert"
            style={{
              margin: 0,
              font: 'var(--font-meta)',
              color: 'var(--color-status-no)',
              minWidth: 0,
              overflowWrap: 'anywhere',
            }}
          >
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
