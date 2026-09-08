import type { Sport, SkillLevel } from '@monsport/shared';
import { sportLabel, skillLevelLabel } from '../i18n/vi';

const LEVELS: SkillLevel[] = ['NEW', 'AVERAGE', 'GOOD', 'STRONG'];

interface SkillLevelSelectProps {
  sport: Sport;
  value: SkillLevel;
  onChange: (level: SkillLevel) => void;
}

export function SkillLevelSelect({ sport, value, onChange }: SkillLevelSelectProps) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span>{sportLabel[sport]}</span>
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value as SkillLevel);
        }}
        className="rounded border border-slate-300 px-2 py-1"
      >
        {LEVELS.map((level) => (
          <option key={level} value={level}>
            {skillLevelLabel[level]}
          </option>
        ))}
      </select>
    </label>
  );
}
