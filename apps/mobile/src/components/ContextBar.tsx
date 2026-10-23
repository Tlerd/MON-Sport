import type { HTMLAttributes, ReactNode } from 'react';
import { useBars } from '../app/bars.tsx';

export interface ContextBarProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  hidden?: boolean;
}

export function ContextBar({ children, hidden: hiddenProp, className, style, ...rest }: ContextBarProps) {
  const { topHidden: barsTopHidden } = useBars();
  const topHidden = hiddenProp !== undefined ? hiddenProp : barsTopHidden;

  const classNames = [topHidden ? 'at-top' : '', className].filter(Boolean).join(' ');

  return (
    <nav
      className={classNames || undefined}
      style={{
        position: 'fixed',
        top: '52px',
        left: 0,
        right: 0,
        zIndex: 15,
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-line)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: 'var(--space-sm) var(--space-md)',
        paddingTop: topHidden
          ? 'calc(var(--space-sm) + env(safe-area-inset-top, 0px))'
          : 'var(--space-sm)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        transform: topHidden ? 'translateY(-52px)' : 'translateY(0)',
        transition: 'transform 200ms cubic-bezier(.2,.8,.2,1)',
        willChange: 'transform',
        ...style,
      }}
      {...rest}
    >
      {children}
    </nav>
  );
}
