import type { HTMLAttributes, ReactNode } from 'react';
import { useBars } from '../app/bars.tsx';

export interface ActionBarProps extends HTMLAttributes<HTMLElement> {
  title: string;
  price?: ReactNode;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  hidden?: boolean;
  visible?: boolean;
  /** A link next to the primary button, for example "Gọi chủ sân". */
  secondary?: { label: string; href: string };
}

export function ActionBar({
  title,
  price,
  actionLabel,
  onAction,
  disabled = false,
  hidden: hiddenProp,
  visible = true,
  secondary,
  className,
  style,
  ...rest
}: ActionBarProps) {
  const { tabHidden: barsTabHidden } = useBars();
  const tabHidden = hiddenProp !== undefined ? hiddenProp : barsTabHidden;
  if (!visible) return null;

  const classNames = [tabHidden ? 'at-bottom' : '', className].filter(Boolean).join(' ');

  return (
    <aside
      aria-label="Thanh hành động"
      className={classNames || undefined}
      style={{
        position: 'fixed',
        left: 'var(--space-md)',
        right: 'var(--space-md)',
        bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
        zIndex: 40,
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-float)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
        padding: '10px 10px 10px var(--space-base)',
        transform: tabHidden ? 'translateY(72px)' : 'translateY(0)',
        transition: 'transform 200ms cubic-bezier(.2,.8,.2,1)',
        willChange: 'transform',
        ...style,
      }}
      {...rest}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <b
          style={{
            display: 'block',
            font: 'var(--font-body-strong)',
            color: 'var(--color-ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </b>
        {price && (
          <span
            style={{
              display: 'block',
              font: 'var(--font-numeric)',
              color: 'var(--color-ink-muted)',
              fontSize: '13px',
            }}
          >
            {price}
          </span>
        )}
      </div>

      {secondary && (
        <a
          href={secondary.href}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '44px',
            padding: '0 var(--space-md)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-line)',
            color: 'var(--color-primary)',
            font: 'var(--font-body-strong)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {secondary.label}
        </a>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={onAction}
        style={{
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-on-primary)',
          font: 'var(--font-body-strong)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px var(--space-base)',
          height: '44px',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {actionLabel}
      </button>
    </aside>
  );
}
