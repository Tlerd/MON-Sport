import type { OwnerBookingView } from '@monsport/shared';

/** A phone booking may have no name and no phone (brief F-007). Without a phone there is no tel: link. */
export function Customer({ customer }: { customer: OwnerBookingView['customer'] }) {
  return (
    <span className="customer">
      {customer.name || 'Khách gọi điện'}
      {customer.phone && <a className="phone" href={`tel:${customer.phone}`}>{customer.phone}</a>}
    </span>
  );
}
