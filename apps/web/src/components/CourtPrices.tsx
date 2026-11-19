import type { CourtView } from '@monsport/shared';
import { formatVnd } from '@monsport/client';
import { SportIcon } from './SportIcon.tsx';

const SPORT = { BADMINTON: 'Cầu lông', FOOTBALL: 'Bóng đá' } as const;

export function CourtPrices({ courts }: { courts: CourtView[] }) {
  if (courts.length === 0) return <p className="empty">Chưa có sân.</p>;
  return (
    <div className="table-scroll">
      <table className="tbl courts-tbl">
        <thead>
          <tr>
            <th scope="col">Sân</th>
            <th scope="col">Môn</th>
            <th scope="col" className="r">Giờ thường</th>
            <th scope="col" className="r">Cao điểm</th>
          </tr>
        </thead>
        <tbody>
          {courts.map((c) => (
            <tr key={c.id}>
              <td data-label="Sân">
                <b className="court-name">{c.name}</b>
              </td>
              <td data-label="Môn">
                <span className="inl">
                  <SportIcon sport={c.sport} size={15} />
                  <span>{SPORT[c.sport]}</span>
                </span>
              </td>
              <td data-label="Giờ thường" className="r money tnum">
                {formatVnd(c.priceNormal)}
              </td>
              <td data-label="Cao điểm" className="r money tnum peak">
                {formatVnd(c.pricePeak)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
