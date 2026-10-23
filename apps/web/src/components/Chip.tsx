import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function Chip({
  selected = false,
  icon,
  children,
  className = '',
  ...props
}: ChipProps) {
  const classes = ['chip', selected ? 'on selected' : '', className].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={classes}
      aria-pressed={selected}
      {...props}
    >
      {icon && <span className="chip-icon" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
