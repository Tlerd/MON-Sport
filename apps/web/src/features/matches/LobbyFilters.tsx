import { SKILL_LEVEL_LABELS, type SkillLevel } from '@monsport/shared';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { Chip } from '../../components/Chip.tsx';
import { SportIcon } from '../../components/SportIcon.tsx';
import { formatDayChip } from '../../lib/dates.ts';

interface LobbyFiltersProps {
  typeTab: 'ALL' | 'SINGLE';
  onTypeTabChange: (tab: 'ALL' | 'SINGLE') => void;
  level: SkillLevel | '';
  onLevelChange: (level: SkillLevel | '') => void;
  date: string;
  onDateChange: (date: string) => void;
  dateOptions: Array<{ ymd: string; label: string }>;
  isOtherDate: boolean;
  sport: string;
  onSportChange: (sport: string) => void;
  matchCount: number | null;
  onComingSoon: () => void;
}

export function LobbyFilters({
  typeTab,
  onTypeTabChange,
  level,
  onLevelChange,
  date,
  onDateChange,
  dateOptions,
  isOtherDate,
  sport,
  onSportChange,
  matchCount,
  onComingSoon,
}: LobbyFiltersProps) {

  return (
    <div className="filter-chips-row">
      <div className="fbar">
        <div className="seg" role="group" aria-label="Loại trận">
          <button
            type="button"
            className={typeTab === 'ALL' ? 'on' : ''}
            onClick={() => onTypeTabChange('ALL')}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={typeTab === 'SINGLE' ? 'on' : ''}
            onClick={() => onTypeTabChange('SINGLE')}
          >
            Trận đơn
          </button>
          <button type="button" onClick={onComingSoon}>
            Trận đội
          </button>
        </div>
        <label className="sel">
          <span className="sr">Trình độ</span>
          <select value={level} onChange={(e) => onLevelChange(e.target.value as SkillLevel | '')}>
            <option value="">Mọi trình độ</option>
            {(Object.entries(SKILL_LEVEL_LABELS) as [SkillLevel, string][]).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="ic" aria-hidden="true" />
        </label>
        <label className="sel">
          <span className="sr">Ngày</span>
          <select value={date} onChange={(e) => onDateChange(e.target.value)}>
            <option value="">Mọi ngày</option>
            {dateOptions.map((opt) => (
              <option key={opt.ymd} value={opt.ymd}>
                {opt.label}
              </option>
            ))}
            {isOtherDate && <option value={date}>{formatDayChip(date)}</option>}
          </select>
          <ChevronDown size={16} className="ic" aria-hidden="true" />
        </label>
        <label className={`btn ghost other-day ${isOtherDate ? 'on' : ''}`}>
          <CalendarDays size={16} className="ic" aria-hidden="true" />
          <span>Ngày khác</span>
          <input
            type="date"
            aria-label="Ngày khác"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
          />
        </label>
        {matchCount !== null && <span className="count">{`${matchCount} trận đang mở`}</span>}
      </div>

      <div role="group" aria-label="Môn thể thao" className="chips sport-chips">
        <Chip selected={sport === ''} onClick={() => onSportChange('')}>
          Tất cả môn
        </Chip>
        <Chip
          selected={sport === 'BADMINTON'}
          icon={<SportIcon sport="BADMINTON" size={16} />}
          onClick={() => onSportChange('BADMINTON')}
        >
          Cầu lông
        </Chip>
        <Chip
          selected={sport === 'FOOTBALL'}
          icon={<SportIcon sport="FOOTBALL" size={16} />}
          onClick={() => onSportChange('FOOTBALL')}
        >
          Bóng đá
        </Chip>
      </div>
    </div>
  );
}
