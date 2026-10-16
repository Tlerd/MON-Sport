import type { CourtView } from '@monsport/shared';
import { formatVnd } from '../lib/format.ts';

const SPORT = { BADMINTON: 'Cầu lông', FOOTBALL: 'Bóng đá' } as const;

/** The courts of a venue, each with its normal and peak price per hour. Peak glows amber, as on the slot bar (BR-4). */
export function CourtPrices({ courts }: { courts: CourtView[] }) {
  if (courts.length === 0) return <p className="empty">Chưa có sân.</p>;
  return (
    <ul className="courts">
      {courts.map((c) => (
        <li key={c.id}>
          <span className="court-name">{c.name}</span>
          <span className="sport">{SPORT[c.sport]}</span>
          <span className="price"><small>Giờ thường</small><b>{formatVnd(c.priceNormal)}</b></span>
          <span className="price peak"><small>Cao điểm</small><b>{formatVnd(c.pricePeak)}</b></span>
        </li>
      ))}
    </ul>
  );
}
