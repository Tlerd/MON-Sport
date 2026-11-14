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
    <div className={`empty ${className}`.trim()}>
      {icon && <div className="empty-ball" aria-hidden="true">{icon}</div>}
      <p>{message}</p>
      {actionText && (
        actionHref ? (
          <NavLink to={actionHref} className="btn lime">
            {actionText}
          </NavLink>
        ) : (
          <button
            type="button"
            className="btn lime"
            onClick={onAction}
          >
            {actionText}
          </button>
        )
      )}
    </div>
  );
}
