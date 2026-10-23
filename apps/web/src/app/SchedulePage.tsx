import {
  bookingPrice,
  confirmDeadline,
  minuteOfDayVN,
  vnDateString,
  addDaysYmd,
  type BookingView,
  type OwnerBookingView,
  type VenueView,
} from '@monsport/shared';
import { Calendar, Check, ChevronDown, Clock, Plus, X } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Chip } from '../components/Chip.tsx';
import { SportIcon } from '../components/icons.tsx';
import { Panel } from '../components/Panel.tsx';
import { SlotGrid, hhmm, type SelectedSlot, type SlotCellInfo, type WindowId } from '../components/SlotGrid.tsx';
import { api, ApiError } from '../lib/api.ts';
import { formatDay, formatTime, formatVnd } from '../lib/format.ts';
import { useSession } from './session.tsx';
import { DURATIONS, slotAt as at } from '../features/bookings/slot.ts';

const initial = (name: string) => name.trim().slice(0, 1).toUpperCase();

function formatDeadlineRemaining(createdAt: string, startAt: string) {
  const dl = confirmDeadline(new Date(createdAt), new Date(startAt));
  const diffMs = dl.getTime() - Date.now();
  if (diffMs <= 0) return 'Hết hạn';
  const diffMins = Math.floor(diffMs / 60000);
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  if (h > 0) return `${h} giờ ${m > 0 ? `${m}` : ''}`.trim();
  return `${m} phút`;
}

export function SchedulePage() {
  const { refreshKey, bumpRefresh } = useSession();

  const [venues, setVenues] = useState<VenueView[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');

  const todayStr = useMemo(() => vnDateString(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [bookings, setBookings] = useState<OwnerBookingView[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedWindowId, setSelectedWindowId] = useState<WindowId | undefined>(undefined);

  // Phone booking panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelCourtId, setPanelCourtId] = useState('');
  const [panelStart, setPanelStart] = useState(360);
  const [panelDuration, setPanelDuration] = useState(60);
  const [panelName, setPanelName] = useState('');
  const [panelPhone, setPanelPhone] = useState('');
  const [panelError, setPanelError] = useState('');
  const [panelBusy, setPanelBusy] = useState(false);

  const [error, setError] = useState('');
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Load venues
  useEffect(() => {
    api<VenueView[]>('/api/owner/venues')
      .then((data) => {
        setVenues(data);
        if (data.length > 0 && !selectedVenueId) {
          setSelectedVenueId(data[0].id);
        }
      })
      .catch(() => setError('Không tải được danh sách đơn vị'));
  }, []);

  // Load owner bookings
  const loadBookings = () => {
    api<OwnerBookingView[]>('/api/owner/bookings')
      .then(setBookings)
      .catch(() => setError('Không tải được danh sách booking'));
  };

  useEffect(() => {
    loadBookings();
  }, [refreshKey]);

  const selectedVenue = venues.find((v) => v.id === selectedVenueId) ?? venues[0];

  // Date chips: Hôm qua, Hôm nay, Ngày mai
  const dateOptions = useMemo(() => {
    return [
      { ymd: addDaysYmd(todayStr, -1), label: 'Hôm qua' },
      { ymd: todayStr, label: 'Hôm nay' },
      { ymd: addDaysYmd(todayStr, 1), label: 'Ngày mai' },
    ];
  }, [todayStr]);

  const isOtherDate = !dateOptions.some((d) => d.ymd === selectedDate);

  // Map bookings to cells for the selected venue and date
  const cells = useMemo(() => {
    if (!selectedVenue) return {};
    const map: Record<string, SlotCellInfo[]> = {};

    for (const court of selectedVenue.courts) {
      const courtCells: SlotCellInfo[] = [];
      const courtBookings = bookings.filter(
        (b) =>
          b.courtId === court.id &&
          vnDateString(new Date(b.startAt)) === selectedDate &&
          (b.status === 'CONFIRMED' || b.status === 'PENDING'),
      );

      for (let m = selectedVenue.opensAt; m < selectedVenue.closesAt; m += 30) {
        const matchingBooking = courtBookings.find((b) => {
          const startM = minuteOfDayVN(new Date(b.startAt));
          const endM = minuteOfDayVN(new Date(b.endAt));
          return m >= startM && m < endM;
        });

        if (matchingBooking) {
          const isPending = matchingBooking.status === 'PENDING';
          const name = matchingBooking.customer?.name ?? (isPending ? 'Khách' : 'Đã xác nhận');
          courtCells.push({
            startMinute: m,
            status: isPending ? 'pending' : 'confirmed',
            label: isPending ? `${name} · chờ` : name,
            bookingId: matchingBooking.id,
            customerName: name,
          });
        } else {
          courtCells.push({
            startMinute: m,
            status: 'free',
          });
        }
      }
      map[court.id] = courtCells;
    }
    return map;
  }, [selectedVenue, selectedDate, bookings]);

  // Pending requests sorted by deadline (earliest deadline first)
  const pendingRequests = useMemo(() => {
    return bookings
      .filter((b) => b.status === 'PENDING')
      .sort((a, b) => {
        const dlA = confirmDeadline(new Date(a.createdAt), new Date(a.startAt)).getTime();
        const dlB = confirmDeadline(new Date(b.createdAt), new Date(b.startAt)).getTime();
        return dlA - dlB;
      });
  }, [bookings]);

  // Selected slots to highlight in SlotGrid
  const selectedSlots = useMemo(() => {
    if (!selectedBookingId) return null;
    const req = bookings.find((b) => b.id === selectedBookingId);
    if (!req) return null;
    const startM = minuteOfDayVN(new Date(req.startAt));
    const endM = minuteOfDayVN(new Date(req.endAt));
    const slots: SelectedSlot[] = [];
    for (let m = startM; m < endM; m += 30) {
      slots.push({ courtId: req.courtId, startMinute: m });
    }
    return slots;
  }, [selectedBookingId, bookings]);

  function handleRequestCardClick(req: OwnerBookingView) {
    setSelectedBookingId(req.id);

    const targetVenue = venues.find((v) => v.courts.some((c) => c.id === req.courtId));
    if (targetVenue && targetVenue.id !== selectedVenueId) {
      setSelectedVenueId(targetVenue.id);
    }

    const reqDate = vnDateString(new Date(req.startAt));
    if (reqDate !== selectedDate) {
      setSelectedDate(reqDate);
    }

    const startM = minuteOfDayVN(new Date(req.startAt));
    const wId: WindowId = startM < 12 * 60 ? 'sang' : startM < 17 * 60 ? 'chieu' : 'toi';
    setSelectedWindowId(wId);
  }

  // Decision on request
  async function decide(id: string, action: 'confirm' | 'reject') {
    setError('');
    try {
      await api<BookingView>(`/api/owner/bookings/${id}/${action}`, { method: 'POST' });
      bumpRefresh();
      loadBookings();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được quyết định');
    }
  }

  // Handle cell click
  function handleCellPick(courtId: string, minute: number, cell?: SlotCellInfo) {
    if (cell && (cell.status === 'pending' || cell.status === 'confirmed')) {
      if (cell.bookingId) {
        setSelectedBookingId(cell.bookingId);
      }
      return;
    }

    // Free cell -> Open Phone Booking Panel
    setPanelCourtId(courtId);
    setPanelStart(minute);
    setPanelDuration(60);
    setPanelName('');
    setPanelPhone('');
    setPanelError('');
    setPanelOpen(true);
  }

  // Handle phone booking submit
  async function submitPhoneBooking(e: FormEvent) {
    e.preventDefault();
    if (!selectedVenue || panelBusy) return;
    setPanelError('');
    setPanelBusy(true);

    try {
      await api<OwnerBookingView>('/api/owner/bookings', {
        method: 'POST',
        json: {
          courtId: panelCourtId,
          startAt: at(selectedDate, panelStart),
          endAt: at(selectedDate, panelStart + panelDuration),
          ...(panelName.trim() && { customerName: panelName.trim() }),
          ...(panelPhone.trim() && { customerPhone: panelPhone.trim() }),
        },
      });
      setPanelOpen(false);
      bumpRefresh();
      loadBookings();
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
    <div className="schedule-page">
      <div className="schedule-layout">
        {/* Main Content Pane */}
        <main className="pane pane-m">
          <div className="schedule-header">
            <h2 className="schedule-title">Lịch sân</h2>

            {/* Venue switcher */}
            {venues.length > 1 && (
              <div className="venue-switch">
                <span className="sport">
                  <SportIcon sport={selectedVenue?.courts[0]?.sport ?? 'BADMINTON'} size={18} />
                </span>
                <select
                  value={selectedVenueId}
                  onChange={(e) => setSelectedVenueId(e.target.value)}
                  className="venue-select"
                  aria-label="Chọn đơn vị"
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date chips */}
            <div className="chips date-chips" aria-label="Chọn ngày xem lịch">
              {dateOptions.map((opt) => (
                <Chip
                  key={opt.ymd}
                  selected={selectedDate === opt.ymd}
                  onClick={() => setSelectedDate(opt.ymd)}
                >
                  {opt.label}
                </Chip>
              ))}
              <label className={`chip ${isOtherDate ? 'on selected' : ''}`}>
                <Calendar size={14} aria-hidden="true" />
                <span>Ngày khác</span>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                />
              </label>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-phone-booking"
              onClick={() => {
                if (selectedVenue && selectedVenue.courts.length > 0) {
                  setPanelCourtId(selectedVenue.courts[0].id);
                  setPanelStart(selectedVenue.opensAt);
                  setPanelDuration(60);
                  setPanelOpen(true);
                }
              }}
            >
              <Plus size={16} aria-hidden="true" /> Booking khách gọi
            </button>
          </div>

          {error && <p className="error" role="alert">{error}</p>}

          {selectedVenue && (
            <>
              <SlotGrid
                courts={selectedVenue.courts}
                date={selectedDate}
                cells={cells}
                mode="manage"
                selected={selectedSlots}
                windowId={selectedWindowId}
                onWindowChange={setSelectedWindowId}
                onPick={handleCellPick}
                opensAt={selectedVenue.opensAt}
                closesAt={selectedVenue.closesAt}
              />

              <div className="legend">
                <span>
                  <i style={{ background: 'var(--color-status-ok-bg)', borderColor: 'var(--color-status-ok)' }} />
                  Đã xác nhận
                </span>
                <span>
                  <i style={{ background: 'var(--color-status-wait-bg)', borderColor: 'var(--color-status-wait)' }} />
                  Chờ xác nhận
                </span>
                <span>
                  <i />
                  Trống, bấm để nhập
                </span>
              </div>
            </>
          )}
        </main>

        {/* Right Pane: Pending Requests */}
        <aside className="pane pane-r">
          <b>Đang chờ bạn</b>
          {pendingRequests.length === 0 ? (
            <p className="meta">Không có yêu cầu nào đang chờ duyệt.</p>
          ) : (
            <div className="pending-list stack">
              {pendingRequests.map((req) => {
                const customerName = req.customer?.name ?? 'Khách';
                const isSelected = req.id === selectedBookingId;
                const deadlineText = formatDeadlineRemaining(req.createdAt, req.startAt);
                const court = venues.flatMap((v) => v.courts).find((c) => c.id === req.courtId);
                const courtDisplayName = court ? court.name : 'Sân';

                return (
                  <div
                    key={req.id}
                    className={`req ${isSelected ? 'on active' : ''}`}
                    onClick={() => handleRequestCardClick(req)}
                  >
                    <div className="req-row-1">
                      <span className="avatar req-avatar">{initial(customerName)}</span>
                      <b className="req-name">{customerName}</b>
                      <span className="badge-wait badge wait">
                        <Clock size={12} aria-hidden="true" />
                        <span>{deadlineText}</span>
                      </span>
                    </div>

                    <div className="req-court-time">
                      {courtDisplayName} · {formatTime(req.startAt)}–{formatTime(req.endAt)}
                    </div>

                    <div className="req-meta">
                      <span className="req-price">{formatVnd(req.priceTotal)}</span> · gửi lúc {formatTime(req.createdAt)}
                    </div>

                    <div className="req-actions">
                      <button
                        type="button"
                        className="button-secondary btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          decide(req.id, 'reject');
                        }}
                      >
                        Từ chối
                      </button>
                      <button
                        type="button"
                        className="button-primary btn-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          decide(req.id, 'confirm');
                        }}
                      >
                        <Check size={14} aria-hidden="true" />
                        <span>Xác nhận</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {/* Phone Booking Modal Panel */}
      <Panel
        open={panelOpen}
        title="Booking khách gọi"
        onClose={() => setPanelOpen(false)}
      >
        <form onSubmit={submitPhoneBooking} className="stack">
          {selectedVenue && (
            <label>
              Sân
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

          <div className="row">
            <label>
              Bắt đầu
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

            <label>
              Thời lượng
              <select
                value={panelDuration}
                onChange={(e) => setPanelDuration(Number(e.target.value))}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {(d / 60).toLocaleString('vi-VN')} giờ
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Tên khách (tùy chọn)
            <input
              type="text"
              value={panelName}
              onChange={(e) => setPanelName(e.target.value)}
              placeholder="Tên khách"
            />
          </label>

          <label>
            Số điện thoại (tùy chọn)
            <input
              type="tel"
              value={panelPhone}
              onChange={(e) => setPanelPhone(e.target.value)}
              placeholder="09..."
            />
          </label>

          <div className="total" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 'var(--space-md)' }}>
            <span className="meta">Tạm tính</span>
            <strong className="money tnum">{panelPrice !== null ? formatVnd(panelPrice) : '—'}</strong>
          </div>

          {panelError && <p className="error" role="alert">{panelError}</p>}

          <button type="submit" className="btn btn-primary" disabled={panelBusy}>
            Lưu booking
          </button>
        </form>
      </Panel>
    </div>
  );
}
