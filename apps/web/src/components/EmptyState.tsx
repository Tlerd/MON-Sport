import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

export interface EmptyStateProps {
  message: string;
  actionText?: string;
  onAction?: () => void;
  actionHref?: string;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({
  message,
  actionText,
  onAction,
  actionHref,
  icon,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      {icon && <div className="empty-state-icon" aria-hidden="true">{icon}</div>}
      <p className="empty-state-message text-muted">{message}</p>
      {actionText && (
        actionHref ? (
          <NavLink to={actionHref} className="btn btn-primary empty-state-btn">
            {actionText}
          </NavLink>
        ) : (
          <button
            type="button"
            className="btn btn-primary empty-state-btn"
            onClick={onAction}
          >
            {actionText}
          </button>
        )
      )}
    </div>
  );
}
