import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function Chip({ selected = false, icon, children, style, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-xs)',
        flex: '0 0 auto',
        minHeight: '44px',
        minWidth: '44px',
        padding: '0 var(--space-md)',
        borderRadius: 'var(--radius-full)',
        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-line)'}`,
        backgroundColor: selected ? 'var(--color-primary)' : 'var(--color-surface)',
        color: selected ? 'var(--color-on-primary)' : 'var(--color-ink)',
        font: 'var(--font-label)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {icon && (
        <span aria-hidden="true" style={{ display: 'inline-flex' }}>
          {icon}
        </span>
      )}
      <span>{children}</span>
    </button>
  );
}
