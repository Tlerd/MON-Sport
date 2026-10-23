import { ArrowLeft } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { useBars } from '../app/bars.tsx';

export interface TopBarProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  onBack?: () => void;
  actions?: ReactNode;
  hidden?: boolean;
}

export function TopBar({ title, onBack, actions, hidden: hiddenProp, style, ...rest }: TopBarProps) {
  const { topHidden: barsTopHidden } = useBars();
  const hidden = hiddenProp !== undefined ? hiddenProp : barsTopHidden;

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '52px',
        backgroundColor: 'var(--color-surface)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: '0 var(--space-md) 0 var(--space-base)',
        transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 200ms cubic-bezier(.2,.8,.2,1)',
        willChange: 'transform',
        ...style,
      }}
      {...rest}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Quay lại"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            backgroundColor: 'var(--color-canvas)',
            color: 'var(--color-ink)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            flex: 'none',
          }}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
      ) : null}

      <div style={{ flex: 1, minWidth: 0 }}>
        {title ? (
          <h1
            style={{
              margin: 0,
              font: 'var(--font-headline-mobile)',
              color: 'var(--color-ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </h1>
        ) : (
          <span
            style={{
              font: 'var(--font-title-mobile)',
              color: 'var(--color-primary)',
              letterSpacing: '-0.02em',
              fontWeight: 700,
            }}
          >
            monsport
          </span>
        )}
      </div>

      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flex: 'none' }}>
          {actions}
        </div>
      )}
    </header>
  );
}
