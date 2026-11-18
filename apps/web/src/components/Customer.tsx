import type { OwnerBookingView } from '@monsport/shared';

export function Customer({ customer }: { customer: OwnerBookingView['customer'] }) {
  return (
    <span className="customer">
      {customer.name || 'Khách gọi điện'}
      {customer.phone && <a className="phone" href={`tel:${customer.phone}`}>{customer.phone}</a>}
    </span>
  );
}
