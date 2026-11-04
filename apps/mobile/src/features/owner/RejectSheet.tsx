import { formatSlot } from '@monsport/client';
import type { OwnerBookingView } from '@monsport/shared';
import { Sheet } from '../../components/Sheet.tsx';

export interface RejectSheetProps {
  request: OwnerBookingView | null;
  onClose: () => void;
  onReject: (request: OwnerBookingView) => void;
}

export function RejectSheet({ request, onClose, onReject }: RejectSheetProps) {
  return (
    <Sheet
      open={request !== null}
      onClose={onClose}
      title="Từ chối yêu cầu này?"
      primaryAction={{ label: 'Từ chối', onClick: () => request && onReject(request) }}
    >
      {request && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', minWidth: 0 }}>
          <p style={{ margin: 0, font: 'var(--font-body)', overflowWrap: 'anywhere', minWidth: 0 }}>
            {request.customer.name}
            <br />
            {formatSlot(request.startAt, request.endAt)}
          </p>
          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: '44px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-line)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-primary)',
              font: 'var(--font-body-strong)',
              cursor: 'pointer',
            }}
          >
            Thôi
          </button>
        </div>
      )}
    </Sheet>
  );
}
