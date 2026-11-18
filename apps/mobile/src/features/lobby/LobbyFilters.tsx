import type { Sport } from '@monsport/shared';
import { Chip } from '../../components/Chip.tsx';
import { ContextBar } from '../../components/ContextBar.tsx';
import { IconBadminton, IconFootball, SPORT_LABEL } from '../../components/SportIcon.tsx';

export interface LobbyFiltersProps {
  sport: Sport | undefined;
  date: string | undefined;
  chips: { ymd: string; label: string }[];
  onSportChange: (sport: Sport | undefined) => void;
  onDateChange: (date: string | undefined) => void;
}

export function LobbyFilters({ sport, date, chips, onSportChange, onDateChange }: LobbyFiltersProps) {
  return (
    <ContextBar aria-label="Bộ lọc phòng chờ">
      <Chip selected={sport === undefined} onClick={() => onSportChange(undefined)}>
        Tất cả
      </Chip>
      <Chip
        selected={sport === 'BADMINTON'}
        icon={<IconBadminton size={18} />}
        onClick={() => onSportChange(sport === 'BADMINTON' ? undefined : 'BADMINTON')}
      >
        {SPORT_LABEL.BADMINTON}
      </Chip>
      <Chip
        selected={sport === 'FOOTBALL'}
        icon={<IconFootball size={18} />}
        onClick={() => onSportChange(sport === 'FOOTBALL' ? undefined : 'FOOTBALL')}
      >
        {SPORT_LABEL.FOOTBALL}
      </Chip>
      <Chip selected={date === undefined} onClick={() => onDateChange(undefined)}>
        Tất cả ngày
      </Chip>
      {chips.map((chip) => (
        <Chip
          key={chip.ymd}
          selected={date === chip.ymd}
          onClick={() => onDateChange(date === chip.ymd ? undefined : chip.ymd)}
        >
          {chip.label}
        </Chip>
      ))}
    </ContextBar>
  );
}
