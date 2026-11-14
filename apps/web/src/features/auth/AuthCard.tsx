import type { ReactNode, RefObject } from 'react';

export function AuthCard({
  cardRef,
  children,
}: {
  cardRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    <section className="card pad auth-card panel" ref={cardRef}>
      <div className="auth-logo">
        <span className="logo">
          <i aria-hidden="true" />
          <span>MONSPORT</span>
        </span>
      </div>
      {children}
    </section>
  );
}
