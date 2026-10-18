import type { MatchView, Sport } from '@monsport/shared';
import { useEffect, useId, useState } from 'react';
import { api } from '../../lib/api.ts';
import { formatDay, formatTime, formatVnd } from '../../lib/format.ts';

const SPORT_LABEL: Record<Sport, string> = {
  BADMINTON: 'Cầu lông',
  FOOTBALL: 'Bóng đá',
};

const BOOKING_BADGE: Record<MatchView['bookingStatus'], string> = {
  PENDING: 'Chưa xác nhận',
  CONFIRMED: 'Đã xác nhận',
  REJECTED: 'Bị từ chối',
  EXPIRED: 'Hết hạn',
  CANCELLED: 'Đã hủy',
};

/**
 * Brief F-011 (UC-8 steps 1-2): public lobby of OPEN matches starting in the future.
 * Guests and USER accounts can filter by sport and play date (Asia/Ho_Chi_Minh).
 */
export function Lobby({ refresh = 0 }: { refresh?: number }) {
  const heading = useId();
  const [sport, setSport] = useState('');
  const [date, setDate] = useState('');
  const [matches, setMatches] = useState<MatchView[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setError('');
    const params = new URLSearchParams();
    if (sport) params.set('sport', sport);
    if (date) params.set('date', date);
    const qs = params.toString();
    const url = qs ? `/api/matches?${qs}` : '/api/matches';
    api<MatchView[]>(url).then(
      (rows) => {
        if (current) setMatches(rows);
      },
      () => {
        if (!current) return;
        setMatches([]);
        setError('Không tải được danh sách phòng chờ');
      },
    );
    return () => {
      current = false;
    };
  }, [sport, date, refresh]);

  return (
    <section className="panel" aria-labelledby={heading}>
      <h2 id={heading}>Phòng chờ</h2>
      <div className="row two">
        <label>
          Môn thể thao
          <select value={sport} onChange={(e) => setSport(e.target.value)}>
            <option value="">Tất cả môn</option>
            <option value="BADMINTON">Cầu lông</option>
            <option value="FOOTBALL">Bóng đá</option>
          </select>
        </label>
        <label>
          Ngày chơi
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div role="status" className="live">
        {matches?.length === 0 && !error && <p className="empty">Chưa có trận nào đang mở</p>}
      </div>
      {matches && matches.length > 0 && (
        <ul className="tickets lobby-list">
          {matches.map((m) => (
            <li key={m.id} className="ticket" data-status={m.bookingStatus}>
              <span className="stub">
                <strong>{formatTime(m.startAt)}</strong>
                <span>đến {formatTime(m.endAt)}</span>
              </span>
              <span className="body">
                <span className="where">{`${m.venueName} · ${m.courtName}`}</span>
                <span>{`${SPORT_LABEL[m.sport]} · Ngày ${formatDay(m.startAt)}`}</span>
                <span>{`${m.joinedCount}/${m.capacity} suất · ${formatVnd(m.pricePerSlot)}/suất`}</span>
                <span>Host: {m.hostName}</span>
                <span className="status">{BOOKING_BADGE[m.bookingStatus]}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
