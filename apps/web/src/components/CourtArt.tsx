import type { Sport } from '@monsport/shared';
import type { SVGProps } from 'react';
import { type KnownSportId, normalizeSportId } from './SportIcon.tsx';

type CourtPattern = 'pitch' | 'net' | 'hoop';

interface CourtPalette {
  color: string;
  deep: string;
  court: CourtPattern;
}

const SPORT_COURTS: Record<KnownSportId, CourtPalette> = {
  football: { color: '#2F7D4F', deep: '#1E5936', court: 'pitch' },
  badminton: { color: '#1C7C74', deep: '#125750', court: 'net' },
  pickleball: { color: '#2E66C2', deep: '#1E4A92', court: 'net' },
  tennis: { color: '#C4613A', deep: '#964425', court: 'net' },
  basketball: { color: '#B5722B', deep: '#86511A', court: 'hoop' },
  volleyball: { color: '#B8913A', deep: '#8A6B27', court: 'net' },
  tabletennis: { color: '#35507F', deep: '#24395D', court: 'net' },
};

const NEUTRAL_COURT: CourtPalette = {
  color: 'var(--ink2)',
  deep: 'var(--ink)',
  court: 'net',
};

export interface CourtArtProps extends SVGProps<SVGSVGElement> {
  sport: Sport | string;
}

export function CourtArt({ sport, className = '', ...props }: CourtArtProps) {
  const id = normalizeSportId(sport);
  const spec = id === 'unknown' ? NEUTRAL_COURT : SPORT_COURTS[id];

  return (
    <svg
      className={className ? `court ${className}` : 'court'}
      viewBox="0 0 160 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      {...props}
    >
      <rect width="160" height="100" fill={spec.color} />
      <path d="M0 0h32v100H0zM64 0h32v100H64zM128 0h32v100h-32z" fill={spec.deep} opacity={0.28} />
      <g>
        {spec.court === 'pitch' && (
          <>
            <rect x="10" y="10" width="140" height="80" rx="2" />
            <path d="M80 10v80" />
            <circle cx="80" cy="50" r="13" />
            <rect x="10" y="30" width="20" height="40" />
            <rect x="130" y="30" width="20" height="40" />
            <rect x="10" y="41" width="8" height="18" />
            <rect x="142" y="41" width="8" height="18" />
          </>
        )}
        {spec.court === 'net' && (
          <>
            <rect x="10" y="10" width="140" height="80" rx="1" />
            <path d="M10 22h140M10 78h140M46 22v56M114 22v56M46 50h68" />
            <path className="net" d="M80 5v90" />
          </>
        )}
        {spec.court === 'hoop' && (
          <>
            <rect x="10" y="10" width="140" height="80" rx="2" />
            <path d="M80 10v80" />
            <circle cx="80" cy="50" r="11" />
            <path d="M10 36h24v28H10M150 36h-24v28h24M34 40a10 10 0 0 1 0 20M126 40a10 10 0 0 0 0 20M10 18h10a32 32 0 0 1 0 64H10M150 18h-10a32 32 0 0 0 0 64h10" />
          </>
        )}
      </g>
    </svg>
  );
}
