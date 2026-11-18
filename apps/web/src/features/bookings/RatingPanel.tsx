import { errorMessage, api } from '@monsport/client';
import type { PlayerRatingView } from '@monsport/shared';
import { useEffect, useState } from 'react';
import { useAction } from '../../hooks/useAction.ts';

interface RatingPanelProps {
  matchId: string;
  onClose?: () => void;
}

function PlayerRatingRow({ matchId, player }: { matchId: string; player: PlayerRatingView }) {
  const [stars, setStars] = useState<number | null>(player.stars);
  const [noShow, setNoShow] = useState<boolean>(player.noShow ?? false);
  const { run, busy: saving, error, setError } = useAction();
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (saving) return;
    setSaved(false);
    await run(async () => {
      const payload = {
        stars: noShow ? null : stars,
        noShow,
      };
      await api<PlayerRatingView>(`/api/matches/${matchId}/ratings/${player.userId}`, {
        method: 'PUT',
        json: payload,
      });
      setSaved(true);
    }, 'Không lưu được điểm');
  }

  return (
    <li className="rating-player-row">
      <span className="rating-player-name" data-field="customer">{player.name}</span>
      <select
        aria-label={`Số sao cho ${player.name}`}
        value={stars ?? ''}
        disabled={noShow || saving}
        onChange={(e) => {
          setStars(e.target.value ? Number(e.target.value) : null);
          setSaved(false);
          setError('');
        }}
      >
        <option value="">Chọn sao</option>
        <option value="1">1 sao</option>
        <option value="2">2 sao</option>
        <option value="3">3 sao</option>
        <option value="4">4 sao</option>
        <option value="5">5 sao</option>
      </select>
      <label className="rating-noshow-check">
        <input
          type="checkbox"
          checked={noShow}
          disabled={saving}
          onChange={(e) => {
            const checked = e.target.checked;
            setNoShow(checked);
            if (checked) {
              setStars(null);
            }
            setSaved(false);
            setError('');
          }}
        />
        <span>Vắng mặt</span>
      </label>
      <button
        type="button"
        className="btn sm lime"
        aria-label={`Lưu điểm cho ${player.name}`}
        disabled={saving}
        onClick={() => void handleSave()}
      >
        Lưu
      </button>
      {saved && <span className="tag ok rating-saved-badge" role="status">Đã lưu</span>}
      {error && <span className="error rating-row-error" role="alert">{error}</span>}
    </li>
  );
}

export function RatingPanel({ matchId, onClose }: RatingPanelProps) {
  const [players, setPlayers] = useState<PlayerRatingView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<PlayerRatingView[]>(`/api/matches/${matchId}/ratings`)
      .then((data) => {
        if (active) {
          setPlayers(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(errorMessage(err, 'Không tải được danh sách người chơi'));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [matchId]);

  return (
    <div className="rating-panel stack">
      <div className="rating-header">
        <strong>Chấm điểm người chơi</strong>
        {onClose && (
          <button type="button" className="btn sm ghost" onClick={onClose}>
            Đóng
          </button>
        )}
      </div>
      {loading && <p className="hint">Đang tải danh sách người chơi...</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!loading && !error && players.length === 0 && (
        <p className="hint">Không có người chơi nào để chấm điểm</p>
      )}
      {!loading && !error && players.length > 0 && (
        <ul className="rating-player-list">
          {players.map((p) => (
            <PlayerRatingRow key={p.userId} matchId={matchId} player={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
