export const ALREADY_HAS_MATCH = 'Booking này đã có trận';
export const NOT_OPENABLE = 'Chỉ mở được trận trên booking đang chờ xác nhận hoặc đã xác nhận';
export const BOOKING_NOT_FOUND = 'Không tìm thấy booking';
export const MATCH_NOT_FOUND = 'Không tìm thấy trận';
export const NOT_CANCELLABLE = 'Trận này không hủy được nữa';
export const NOT_HOST = 'Bạn không có quyền làm việc này';
export const REQUEST_NOT_FOUND = 'Không tìm thấy yêu cầu';
export const BUSY = 'Yêu cầu đang được xử lý, hãy thử lại';
export const DAY_MS = 24 * 60 * 60_000;

export function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && typeof e === 'object' && depth < 5; depth++) {
    const o = e as {
      code?: unknown;
      originalCode?: unknown;
      meta?: { code?: unknown; driverAdapterError?: { cause?: { originalCode?: unknown } } };
      cause?: unknown;
    };
    if ([o.code, o.originalCode, o.meta?.code, o.meta?.driverAdapterError?.cause?.originalCode].some((c) => c === '23505' || c === 'P2002')) {
      return true;
    }
    e = o.cause;
  }
  return /23505|P2002|Match_bookingId_key/.test(String((error as Error)?.message ?? ''));
}
