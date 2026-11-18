import { Calendar, ChevronDown, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { Chip } from '../../components/Chip.tsx';
import { Panel } from '../../components/Panel.tsx';
import { SlotGrid, type SlotCellInfo } from '../../components/SlotGrid.tsx';
import { SportIcon } from '../../components/SportIcon.tsx';
import { BookingRow, formatDeadlineRemaining } from './BookingRow.tsx';
import { RecurringBookingForm } from './RecurringBookingForm.tsx';
import { useOwnerBookings } from './useOwnerBookings.ts';

export { formatDeadlineRemaining };

export interface SchedulePageProps {
  refreshKey?: number;
  onRefresh?: () => void;
}

export function SchedulePage({ refreshKey = 0, onRefresh }: SchedulePageProps = {}) {
  const {
    venues,
    selectedVenue,
    selectedVenueId,
    setSelectedVenueId,
    selectedDate,
    setSelectedDate,
    selectedBookingId,
    setSelectedBookingId,
    selectedWindowId,
    setSelectedWindowId,
    error,
    dateOptions,
    isOtherDate,
    cells,
    pendingRequests,
    selectedSlots,
    loadBookings,
    handleRequestCardClick,
    decide,
  } = useOwnerBookings({ refreshKey, onRefresh });

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelCourtId, setPanelCourtId] = useState('');
  const [panelStart, setPanelStart] = useState(360);
  const [panelSeq, setPanelSeq] = useState(0);
  const [saved, setSaved] = useState('');
  const dateInputRef = useRef<HTMLInputElement>(null);

  function openPhoneBooking(courtId: string, startMinute: number) {
    setSaved('');
    setPanelCourtId(courtId);
    setPanelStart(startMinute);
    setPanelSeq((s) => s + 1);
    setPanelOpen(true);
  }

  function handleCellPick(courtId: string, minute: number, cell?: SlotCellInfo) {
    if (cell && (cell.status === 'pending' || cell.status === 'confirmed')) {
      if (cell.bookingId) {
        setSelectedBookingId(cell.bookingId);
      }
      return;
    }
    openPhoneBooking(courtId, minute);
  }

  return (
    <div className="page schedule-page">
      <div className="page-head">
        <div>
          <h1>Lịch sân</h1>
          <p>Theo dõi lịch từng sân và xử lý yêu cầu đang chờ xác nhận.</p>
        </div>
        <button
          type="button"
          className="btn lime"
          onClick={() => {
            if (selectedVenue && selectedVenue.courts.length > 0) {
              openPhoneBooking(selectedVenue.courts[0].id, selectedVenue.opensAt);
            }
          }}
        >
          <Plus size={16} className="ic" aria-hidden="true" />
          <span>Booking khách gọi</span>
        </button>
      </div>

      {venues.length > 1 && (
        <div className="fbar">
          <div className="sel">
            <SportIcon sport={selectedVenue?.courts[0]?.sport ?? 'BADMINTON'} size={18} />
            <select
              value={selectedVenueId}
              onChange={(e) => setSelectedVenueId(e.target.value)}
              aria-label="Chọn đơn vị"
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="ic" aria-hidden="true" />
          </div>
        </div>
      )}

      {saved && (
        <p role="status" className="live saved">
          {saved}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="split schedule-layout">
        <div className="card book-main">
          <div className="book-top">
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
                  className="sr-only"
                />
              </label>
            </div>

            <div className="legend">
              <span className="lg on">Đã xác nhận</span>
              <span className="lg pending">Chờ xác nhận</span>
              <span className="lg">Trống, bấm để nhập</span>
            </div>
          </div>

          {selectedVenue && (
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
          )}
        </div>

        <aside className="card pad schedule-side" aria-label="Đang chờ bạn">
          <div className="sec-row">
            <h2>Đang chờ bạn</h2>
            {pendingRequests.length > 0 && <span className="count-badge">{pendingRequests.length}</span>}
          </div>
          {pendingRequests.length === 0 ? (
            <p className="meta">Không có yêu cầu nào đang chờ duyệt.</p>
          ) : (
            <div className="pending-list stack">
              {pendingRequests.map((req) => {
                const court = venues.flatMap((v) => v.courts).find((c) => c.id === req.courtId);
                return (
                  <BookingRow
                    key={req.id}
                    req={req}
                    isSelected={req.id === selectedBookingId}
                    courtDisplayName={court ? court.name : 'Sân'}
                    onSelect={handleRequestCardClick}
                    onDecide={(id, action) => void decide(id, action)}
                  />
                );
              })}
            </div>
          )}
        </aside>
      </div>

      <Panel
        open={panelOpen}
        title="Booking khách gọi"
        onClose={() => setPanelOpen(false)}
      >
        <RecurringBookingForm
          key={panelSeq}
          selectedVenue={selectedVenue}
          selectedDate={selectedDate}
          initialCourtId={panelCourtId}
          initialStart={panelStart}
          onSuccess={(msg) => {
            setSaved(msg);
            setPanelOpen(false);
            onRefresh?.();
            loadBookings();
          }}
        />
      </Panel>
    </div>
  );
}
