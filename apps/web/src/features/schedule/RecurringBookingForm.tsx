import {
  bookingPrice,
  RECURRING_MAX_WEEKS,
  RECURRING_MIN_WEEKS,
  vnDateString,
  type OwnerBookingView,
  type RecurringPhoneBookingResponse,
  type VenueView,
} from '@monsport/shared';
import {
  api,
  ApiError,
  DURATIONS,
  durationLabel,
  formatDay,
  formatTime,
  formatVnd,
  hhmm,
  slotAt as at,
} from '@monsport/client';
import { type FormEvent, useState } from 'react';

interface RecurringBookingFormProps {
  selectedVenue?: VenueView;
  selectedDate: string;
  initialCourtId: string;
  initialStart: number;
  onSuccess: (message: string) => void;
}

export function RecurringBookingForm({
  selectedVenue,
  selectedDate,
  initialCourtId,
  initialStart,
  onSuccess,
}: RecurringBookingFormProps) {
  const [panelCourtId, setPanelCourtId] = useState(initialCourtId);
  const [panelStart, setPanelStart] = useState(initialStart);
  const [panelDuration, setPanelDuration] = useState(60);
  const [panelName, setPanelName] = useState('');
  const [panelPhone, setPanelPhone] = useState('');
  const [panelRecurring, setPanelRecurring] = useState(false);
  const [panelWeeks, setPanelWeeks] = useState(4);
  const [panelError, setPanelError] = useState('');
  const [panelBusy, setPanelBusy] = useState(false);

  async function submitPhoneBooking(e: FormEvent) {
    e.preventDefault();
    if (!selectedVenue || panelBusy) return;
    setPanelError('');
    setPanelBusy(true);

    try {
      const basePayload = {
        courtId: panelCourtId,
        startAt: at(selectedDate, panelStart),
        endAt: at(selectedDate, panelStart + panelDuration),
        ...(panelName.trim() && { customerName: panelName.trim() }),
        ...(panelPhone.trim() && { customerPhone: panelPhone.trim() }),
      };

      if (panelRecurring) {
        const res = await api<RecurringPhoneBookingResponse>('/api/owner/bookings/recurring', {
          method: 'POST',
          json: {
            ...basePayload,
            weeks: panelWeeks,
          },
        });
        const createdCount = res.created.length;
        let msg = `Đã tạo ${createdCount} buổi`;
        if (res.skipped.length > 0) {
          const skippedDates = res.skipped
            .map((s) => {
              const ymd = vnDateString(new Date(s.startAt));
              const [, m, d] = ymd.split('-');
              return `${d}/${m}`;
            })
            .join(', ');
          msg += `. Bỏ qua ${res.skipped.length} buổi trùng giờ: ${skippedDates}`;
        }
        onSuccess(msg);
      } else {
        const booking = await api<OwnerBookingView>('/api/owner/bookings', {
          method: 'POST',
          json: basePayload,
        });
        onSuccess(
          `Đã lưu booking ${formatTime(booking.startAt)}–${formatTime(booking.endAt)} ngày ${formatDay(booking.startAt)}.`,
        );
      }
    } catch (err) {
      setPanelError(err instanceof ApiError ? err.message : 'Không lưu được booking');
    } finally {
      setPanelBusy(false);
    }
  }

  const panelCourt = selectedVenue?.courts.find((c) => c.id === panelCourtId);
  const panelPrice =
    panelCourt && panelCourtId
      ? bookingPrice(
          new Date(at(selectedDate, panelStart)),
          new Date(at(selectedDate, panelStart + panelDuration)),
          panelCourt.priceNormal,
          panelCourt.pricePeak,
        )
      : null;

  return (
    <form onSubmit={submitPhoneBooking} className="stack-form">
      {selectedVenue && (
        <label className="fld">
          <span>Sân</span>
          <select
            value={panelCourtId}
            onChange={(e) => setPanelCourtId(e.target.value)}
            required
          >
            {selectedVenue.courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="fgrid">
        <label className="fld">
          <span>Bắt đầu</span>
          {selectedVenue && (
            <select
              value={panelStart}
              onChange={(e) => setPanelStart(Number(e.target.value))}
            >
              {Array.from(
                { length: Math.floor((selectedVenue.closesAt - selectedVenue.opensAt) / 30) },
                (_, i) => selectedVenue.opensAt + i * 30,
              ).map((m) => (
                <option key={m} value={m}>
                  {hhmm(m)}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="fld">
          <span>Thời lượng</span>
          <select
            value={panelDuration}
            onChange={(e) => setPanelDuration(Number(e.target.value))}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {durationLabel(d)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="fgrid">
        <label className="fld">
          <span>Tên khách (tùy chọn)</span>
          <input
            type="text"
            value={panelName}
            onChange={(e) => setPanelName(e.target.value)}
            placeholder="Tên khách"
          />
        </label>

        <label className="fld">
          <span>Số điện thoại (tùy chọn)</span>
          <input
            type="tel"
            value={panelPhone}
            onChange={(e) => setPanelPhone(e.target.value)}
            placeholder="09..."
          />
        </label>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={panelRecurring}
          onChange={(e) => setPanelRecurring(e.target.checked)}
        />
        <span>Lặp lại hằng tuần</span>
      </label>

      {panelRecurring && (
        <label className="fld">
          <span>Số tuần</span>
          <select
            aria-label="Số tuần"
            value={panelWeeks}
            onChange={(e) => setPanelWeeks(Number(e.target.value))}
          >
            {Array.from(
              { length: RECURRING_MAX_WEEKS - RECURRING_MIN_WEEKS + 1 },
              (_, i) => RECURRING_MIN_WEEKS + i,
            ).map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="total">
        <span className="meta">{panelRecurring ? 'Tạm tính mỗi buổi' : 'Tạm tính'}</span>
        <strong className="money tnum">{panelPrice !== null ? formatVnd(panelPrice) : '—'}</strong>
      </div>

      {panelError && (
        <p className="error" role="alert">
          {panelError}
        </p>
      )}

      <button type="submit" className="btn lime wide" disabled={panelBusy}>
        Lưu booking
      </button>
    </form>
  );
}
