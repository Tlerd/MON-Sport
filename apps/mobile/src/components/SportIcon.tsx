import type { SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
}

export const SPORT_LABEL: Record<string, string> = { BADMINTON: 'Cầu lông', FOOTBALL: 'Bóng đá' };

export function IconBadminton({ size = 24, strokeWidth = 1.75, color = 'currentColor', ...props }: IconProps) {
  const ariaHidden = props['aria-label'] ? undefined : (props['aria-hidden'] ?? true);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <path d="M7 3.5 9.6 14.5M17 3.5 14.4 14.5M12 3v11.5M7 3.5c1.5.8 3.2 1.2 5 1.2s3.5-.4 5-1.2" />
      <path d="M9.6 14.5h4.8v1.8a2.4 2.4 0 0 1-4.8 0z" />
      <path d="M8.2 9.2c1.2.4 2.5.6 3.8.6s2.6-.2 3.8-.6" />
    </svg>
  );
}

export function IconFootball({ size = 24, strokeWidth = 1.75, color = 'currentColor', ...props }: IconProps) {
  const ariaHidden = props['aria-label'] ? undefined : (props['aria-hidden'] ?? true);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7.6 3.3 2.4-1.3 3.9h-4L8.7 10z" />
      <path d="M12 7.6V3.2M15.3 10l4.1-1.4M14 13.9l2.5 3.6M10 13.9l-2.5 3.6M8.7 10 4.6 8.6" />
    </svg>
  );
}

export function SportIcon({ sport, ...props }: IconProps & { sport: string }) {
  return sport.toUpperCase() === 'BADMINTON' ? <IconBadminton {...props} /> : <IconFootball {...props} />;
}
