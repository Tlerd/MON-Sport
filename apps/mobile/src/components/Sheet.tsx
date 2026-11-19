import { useEffect, useRef, type ReactNode } from 'react';
import { useBars } from '../app/bars.tsx';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  closeDisabled?: boolean;
  title: string;
  children: ReactNode;
  primaryAction?: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    type?: 'button' | 'submit';
  };
}

const SHEET_MAX_HEIGHT =
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('max-height', '90dvh') ? '90dvh' : '90vh';

export function Sheet({ open, onClose, closeDisabled = false, title, children, primaryAction }: SheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const closeDisabledRef = useRef(closeDisabled);
  closeDisabledRef.current = closeDisabled;
  const { lock } = useBars();

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    const release = lock();
    releaseRef.current = release;
    return () => {
      release();
      releaseRef.current = null;
    };
  }, [open, lock]);

  const handleClose = () => {
    if (closeDisabledRef.current) return;
    if (releaseRef.current) {
      releaseRef.current();
      releaseRef.current = null;
    }
    onClose();
    openerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const timer = setTimeout(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        'button, input, select, textarea',
      );
      focusable?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current !== null) {
      const diff = e.changedTouches[0].clientY - touchStartY.current;
      if (diff > 60) {
        handleClose();
      }
      touchStartY.current = null;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <div
        data-testid="sheet-backdrop"
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'var(--dim-sheet)',
          backdropFilter: 'blur(2px)',
        }}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'relative',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          padding: 'var(--space-base)',
          paddingBottom: 'calc(var(--space-base) + env(safe-area-inset-bottom, 0px))',
          boxShadow: 'var(--shadow-float)',
          maxHeight: SHEET_MAX_HEIGHT,
          overflowY: 'auto',
          zIndex: 101,
          animation: 'sheetSlideUp 200ms cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: '36px',
            height: '4px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-line)',
            margin: '0 auto var(--space-md)',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-base)',
          }}
        >
          <h2 id="sheet-title" style={{ margin: 0, font: 'var(--font-headline-mobile)', color: 'var(--color-ink)' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--color-ink-muted)',
              font: 'var(--font-body)',
              cursor: 'pointer',
              padding: 'var(--space-xs)',
              minHeight: '44px',
              minWidth: '44px',
            }}
          >
            Đóng
          </button>
        </div>

        <div style={{ marginBottom: primaryAction ? 'var(--space-lg)' : 0 }}>{children}</div>

        {primaryAction && (
          <button
            type={primaryAction.type || 'button'}
            disabled={primaryAction.disabled}
            onClick={primaryAction.onClick}
            style={{
              width: '100%',
              height: '44px',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              font: 'var(--font-body-strong)',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: primaryAction.disabled ? 'not-allowed' : 'pointer',
              opacity: primaryAction.disabled ? 0.6 : 1,
            }}
          >
            {primaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}
