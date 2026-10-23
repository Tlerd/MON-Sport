import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface PanelProps {
  open?: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Panel({
  open = true,
  title,
  onClose,
  children,
  className = '',
}: PanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    // Initial focus on panel or first focusable element
    const initialTimer = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    }, 10);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(initialTimer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="panel-overlay" onClick={onClose}>
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Chi tiết'}
        className={`panel-drawer card-web ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          {title && <h2 className="panel-title">{title}</h2>}
          <button
            type="button"
            className="icon-button panel-close"
            aria-label="Đóng"
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="panel-content">{children}</div>
      </aside>
    </div>
  );
}
