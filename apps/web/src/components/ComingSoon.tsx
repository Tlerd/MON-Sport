import { Plus } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useToast } from './Toast.tsx';

export interface ComingSoonButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  children: ReactNode;
}

/** Button that triggers the global "Sắp ra mắt" toast when clicked. */
export function ComingSoonButton({ children, className = 'btn', type = 'button', ...props }: ComingSoonButtonProps) {
  const { comingSoon } = useToast();
  return (
    <button type={type} className={className} onClick={comingSoon} {...props}>
      {children}
    </button>
  );
}

export interface ComingSoonPageProps {
  title: string;
  description?: string;
  actionLabel?: string;
  /** Full page width like the reference list pages. */
  wide?: boolean;
}

/** Placeholder page using the Ra Sân empty-state card while a feature is pending. */
export function ComingSoonPage({ title, description, actionLabel, wide = false }: ComingSoonPageProps) {
  return (
    <div className={wide ? 'page' : 'page narrow'}>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actionLabel && <ComingSoonButton className="btn lime">
            <Plus size={18} className="ic" aria-hidden="true" />
            {actionLabel}
          </ComingSoonButton>}
      </div>
      <section className="card">
        <div className="empty">
          <div className="empty-ball" aria-hidden="true">
            <svg className="ic" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M5.2 6.2c3.6 2.6 3.6 9 0 11.6M18.8 6.2c-3.6 2.6-3.6 9 0 11.6" />
            </svg>
          </div>
          <h3>Sắp ra mắt</h3>
          <p>Chức năng này đang được hoàn thiện và sẽ sớm mở cho bạn.</p>
        </div>
      </section>
    </div>
  );
}
