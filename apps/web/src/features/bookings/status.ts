import type { BookingStatus } from '@monsport/shared';

// Labels from docs/requirements/glossary.md and the booking states in models.md.
export const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  REJECTED: 'Bị từ chối',
  EXPIRED: 'Hết hạn',
  CANCELLED: 'Đã hủy',
};
