import { CALL_OWNER_MESSAGE, type JoinMode, type MatchStatus, type MatchView, type MyBookingView, RATE_WINDOW_DAYS, userCancelDecision } from '@monsport/shared';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError, formatDay, formatSlot, formatTime, formatVnd } from '@monsport/client';
import { EmptyState } from '../../components/EmptyState.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import { CancelAsk, useCancelFlow } from './cancel.tsx';
import { RatingPanel } from './RatingPanel.tsx';
import { STATUS_LABEL } from './status.ts';

const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  OPEN: 'Trận đang mở',
  FULL: 'Trận đã đủ người',
  CANCELLED: 'Trận đã hủy',
  FINISHED: 'Trận đã kết thúc',
};

/**
 * UC-6, UC-7, UC-9 (brief F-009 & F-011): the bookings of the signed-in user, newest first.
 * The user can open a match on a future PENDING/CONFIRMED booking, cancel an open/full match, or cancel a booking without a match.
 */
export function MyBookings({ refresh = 0, onMatchChanged }: { refresh?: number; onMatchChanged?: () => void }) {
  const [rows, setRows] = useState<MyBookingView[] | null>(null);
  const [openingId, setOpeningId] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [pricePerSlot, setPricePerSlot] = useState('50000');
  const [joinMode, setJoinMode] = useState<JoinMode>('INSTANT');
  const [cancelMatchId, setCancelMatchId] = useState('');
  const [ratingMatchId, setRatingMatchId] = useState('');
  const [matchBusy, setMatchBusy] = useState(false);
  const [matchError, setMatchError] = useState('');

  const load = useCallback(() => api<MyBookingView[]>('/api/bookings/mine').then(setRows, () => setRows((list) => list ?? [])), []);
  useEffect(() => {
    void load();
  }, [load, refresh]);

  // A refused cancel means the server sees another state, so the list is read again.
  const { list, failure, ask } = useCancelFlow(async (id) => {
    const done = await api<MyBookingView>(`/api/bookings/${id}/cancel`, { method: 'POST' });
    setRows((all) => all?.map((r) => (r.id === done.id ? done : r)) ?? null);
    onMatchChanged?.();
  }, load);

  function startOpenMatch(bookingId: string) {
    setMatchError('');
    setCancelMatchId('');
    setOpeningId(bookingId);
    setCapacity('4');
    setPricePerSlot('50000');
    setJoinMode('INSTANT');
  }

  function closeOpenMatch() {
    setOpeningId('');
    setJoinMode('INSTANT');
  }

  async function submitMatch(e: FormEvent, bookingId: string) {
    e.preventDefault();
    if (matchBusy) return;
    setMatchError('');
    setMatchBusy(true);
    try {
      const created = await api<MatchView>('/api/matches', {
        method: 'POST',
        // `json` makes the shared client set content-type: application/json. A plain `body` went out as text/plain, and the API answered 400.
        json: {
          bookingId,
          capacity: Number(capacity),
          pricePerSlot: Number(pricePerSlot),
          joinMode,
        },
      });
      setRows((all) =>
        all?.map((r) =>
          r.id === bookingId
            ? {
                ...r,
                match: {
                  id: created.id,
                  status: created.status,
                  capacity: created.capacity,
                  joinedCount: created.joinedCount,
                  pricePerSlot: created.pricePerSlot,
                },
              }
            : r,
        ) ?? null,
      );
      closeOpenMatch();
      onMatchChanged?.();
    } catch (err) {
      setMatchError(err instanceof ApiError ? err.message : 'Không mở được trận');
      await load();
    } finally {
      setMatchBusy(false);
    }
  }

  async function confirmCancelMatch(bookingId: string, matchId: string) {
    if (matchBusy) return;
    setMatchError('');
    setMatchBusy(true);
    try {
      const done = await api<MatchView>(`/api/matches/${matchId}/cancel`, { method: 'POST' });
      setRows((all) =>
        all?.map((r) =>
          r.id === bookingId
            ? {
                ...r,
                status: 'CANCELLED',
                match: r.match ? { ...r.match, status: done.status } : null,
              }
            : r,
        ) ?? null,
      );
      setCancelMatchId('');
      onMatchChanged?.();
    } catch (err) {
      setMatchError(err instanceof ApiError ? err.message : 'Không hủy được trận');
      setCancelMatchId('');
      await load();
    } finally {
      setMatchBusy(false);
    }
  }

  if (!rows) return null;
  const now = new Date();
  const alertText = failure || matchError;
  return (
    <section className="panel">
      <h2>Booking của tôi</h2>
      {alertText && <p className="error" role="alert">{alertText}</p>}
      {rows.length === 0 ? (
        <EmptyState message="Bạn chưa có booking nào. Chọn đơn vị ở trên để đặt sân." />
      ) : (
        <ul className="tickets schedule-list" ref={list}>
          {rows.map((b) => {
            const startAt = new Date(b.startAt);
            const endAt = new Date(b.endAt);
            const decision = userCancelDecision({ status: b.status, startAt }, now);
            const isMuted =
              endAt.getTime() <= now.getTime() ||
              b.status === 'CANCELLED' ||
              b.status === 'EXPIRED' ||
              b.status === 'REJECTED';
            const activeMatch = b.match && (b.match.status === 'OPEN' || b.match.status === 'FULL') ? b.match : null;
            const canOpenMatch = !b.match && (b.status === 'PENDING' || b.status === 'CONFIRMED') && startAt.getTime() > now.getTime();
            const rateWindowMs = RATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
            const canRate =
              Boolean(b.match) &&
              b.status === 'CONFIRMED' &&
              b.match!.status !== 'CANCELLED' &&
              now.getTime() >= startAt.getTime() &&
              now.getTime() <= startAt.getTime() + rateWindowMs;
            const label = `${b.venueName} · ${b.courtName}, ${formatSlot(b.startAt, b.endAt)}`;
            return (
              <li key={b.id} className={`card ticket si-item ${isMuted ? 'is-muted' : ''}`.trim()} data-status={b.status}>
                <div className="si">
                  <div className="stub si-t">
                    <strong>{formatTime(b.startAt)}</strong>
                    <span>đến {formatTime(b.endAt)}</span>
                  </div>
                  <div className="body si-b">
                    <b className="where">{`${b.venueName} · ${b.courtName}`}</b>
                    <div className="si-meta">
                      <span>Ngày {formatDay(b.startAt)}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="money">{formatVnd(b.priceTotal)}</span>
                    </div>
                    {b.match && (
                      <span className="match-summary">
                        {`${MATCH_STATUS_LABEL[b.match.status]} · ${b.match.joinedCount}/${b.match.capacity} suất · ${formatVnd(b.match.pricePerSlot)}/suất`}
                      </span>
                    )}
                    {decision === 'CALL_OWNER' && (
                      <span className="call-owner">
                        <span>{CALL_OWNER_MESSAGE}</span>
                        <a className="phone link" href={`tel:${b.venuePhone}`}>Gọi chủ sân</a>
                      </span>
                    )}
                  </div>
                  <div className="si-r">
                    <StatusBadge
                      className="status"
                      status={b.status}
                      label={STATUS_LABEL[b.status]}
                      {...(decision !== 'ALLOW' && { tabIndex: -1, 'data-focus': b.id })}
                    />
                    {canOpenMatch && openingId !== b.id && (
                      <span className="actions single">
                        <button type="button" className="btn sm lime" aria-label={`Mở trận ${label}`} onClick={() => startOpenMatch(b.id)}>
                          Mở trận
                        </button>
                      </span>
                    )}
                    {activeMatch && decision === 'ALLOW' && (
                      cancelMatchId === activeMatch.id ? (
                        <span className="actions">
                          <button
                            type="button"
                            className="btn sm danger"
                            autoFocus
                            disabled={matchBusy}
                            aria-label={`Xác nhận hủy trận ${label}`}
                            onClick={() => void confirmCancelMatch(b.id, activeMatch.id)}
                          >
                            Xác nhận hủy trận
                          </button>
                          <button type="button" className="btn sm ghost" onClick={() => setCancelMatchId('')}>
                            Giữ trận
                          </button>
                        </span>
                      ) : (
                        <span className="actions single">
                          <button type="button" className="btn sm ghost" aria-label={`Hủy trận ${label}`} onClick={() => setCancelMatchId(activeMatch.id)}>
                            Hủy trận
                          </button>
                        </span>
                      )
                    )}
                    {!activeMatch && decision === 'ALLOW' && <CancelAsk id={b.id} label={label} ask={ask} />}
                    {canRate && (
                      <span className="actions single">
                        <button
                          type="button"
                          className="btn sm ghost"
                          onClick={() => setRatingMatchId((curr) => (curr === b.match!.id ? '' : b.match!.id))}
                        >
                          Chấm điểm người chơi
                        </button>
                      </span>
                    )}
                  </div>
                  {canOpenMatch && openingId === b.id && (
                    <form className="match-form stack" onSubmit={(e) => void submitMatch(e, b.id)}>
                      <div className="fgrid">
                        <label className="fld">
                          <span>Số suất</span>
                          <input type="number" min={2} max={30} required value={capacity} onChange={(e) => setCapacity(e.target.value)} />
                        </label>
                        <label className="fld">
                          <span>Giá mỗi suất (đ)</span>
                          <input type="number" min={0} max={10_000_000} required value={pricePerSlot} onChange={(e) => setPricePerSlot(e.target.value)} />
                        </label>
                      </div>
                      <fieldset className="join-mode-fieldset">
                        <legend>Cách vào trận</legend>
                        <div className="type-pick join-mode-options">
                          <label className={`join-mode-option ${joinMode === 'INSTANT' ? 'on' : ''}`}>
                            <input
                              type="radio"
                              name={`joinMode-${b.id}`}
                              value="INSTANT"
                              checked={joinMode === 'INSTANT'}
                              onChange={() => setJoinMode('INSTANT')}
                            />
                            <span>Vào ngay</span>
                          </label>
                          <label className={`join-mode-option ${joinMode === 'APPROVAL' ? 'on' : ''}`}>
                            <input
                              type="radio"
                              name={`joinMode-${b.id}`}
                              value="APPROVAL"
                              checked={joinMode === 'APPROVAL'}
                              onChange={() => setJoinMode('APPROVAL')}
                            />
                            <span>Host duyệt</span>
                          </label>
                        </div>
                      </fieldset>
                      <span className="actions">
                        <button type="submit" className="btn sm lime" disabled={matchBusy}>Tạo trận</button>
                        <button type="button" className="btn sm ghost" onClick={closeOpenMatch}>Đóng</button>
                      </span>
                    </form>
                  )}
                  {b.match && ratingMatchId === b.match.id && (
                    <RatingPanel matchId={b.match.id} onClose={() => setRatingMatchId('')} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
