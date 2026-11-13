import type { Sport } from '@monsport/shared';
import type { SVGProps } from 'react';

export type KnownSportId =
  | 'football'
  | 'badminton'
  | 'pickleball'
  | 'tennis'
  | 'basketball'
  | 'volleyball'
  | 'tabletennis';

export function normalizeSportId(sport: Sport | string): KnownSportId | 'unknown' {
  const key = sport.trim().toLowerCase();
  switch (key) {
    case 'football':
      return 'football';
    case 'badminton':
      return 'badminton';
    case 'pickleball':
      return 'pickleball';
    case 'tennis':
      return 'tennis';
    case 'basketball':
      return 'basketball';
    case 'volleyball':
      return 'volleyball';
    case 'tabletennis':
      return 'tabletennis';
    default:
      return 'unknown';
  }
}

export interface SportIconProps extends SVGProps<SVGSVGElement> {
  sport: Sport | string;
  size?: number;
}

/** React SVG sport icon ported from the Ra Sân mock, with a generic ball fallback. */
export function SportIcon({ sport, size = 20, className = '', ...props }: SportIconProps) {
  const id = normalizeSportId(sport);
  const ariaHidden = props['aria-label'] ? undefined : (props['aria-hidden'] ?? true);

  return (
    <svg
      className={className ? `ic ${className}` : 'ic'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      {id === 'football' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m12 8 3.6 2.6-1.4 4.2H9.8l-1.4-4.2zM12 3.2V8M20.4 9.8l-4.8.8M17.3 19.2l-3.1-4.4M6.7 19.2l3.1-4.4M3.6 9.8l4.8.8" />
        </>
      )}
      {id === 'badminton' && (
        <>
          <path d="M9.5 16 6 5l3 1.2L12 4l3 2.2L18 5l-3.5 11zM12 4v12M9 6.2 10.7 16M15 6.2 13.3 16" />
          <path d="M9.5 16v1.5a2.5 2.5 0 0 0 5 0V16" />
        </>
      )}
      {id === 'pickleball' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <g fill="currentColor" stroke="none">
            <circle cx="8.5" cy="9" r="1.1" />
            <circle cx="12.5" cy="7.5" r="1.1" />
            <circle cx="16" cy="10.5" r="1.1" />
            <circle cx="8" cy="13.5" r="1.1" />
            <circle cx="12" cy="12" r="1.1" />
            <circle cx="15.5" cy="15" r="1.1" />
            <circle cx="11" cy="16.5" r="1.1" />
          </g>
        </>
      )}
      {id === 'basketball' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3v18M5.6 5.6c3 2.8 3 10 0 12.8M18.4 5.6c-3 2.8-3 10 0 12.8" />
        </>
      )}
      {id === 'volleyball' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 12c0-4 2-7 5-8M12 12c3.5 2 7 1.6 8.8-.6M12 12c-3.5 2-5 5.5-4.2 8.2M12 3c-2 2.5-2.6 5-2 7.6M20.5 15c-3 1-5.6.4-7.6-1.4M4 16.5c1-3 3-4.6 5.6-5.2" />
        </>
      )}
      {id === 'tabletennis' && (
        <>
          <circle cx="10" cy="9.5" r="6" />
          <path d="m14 14 5.5 5.5" />
          <circle cx="18.5" cy="6" r="1.5" />
        </>
      )}
      {(id === 'tennis' || id === 'unknown') && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M5.2 6.2c3.6 2.6 3.6 9 0 11.6M18.8 6.2c-3.6 2.6-3.6 9 0 11.6" />
        </>
      )}
    </svg>
  );
}
