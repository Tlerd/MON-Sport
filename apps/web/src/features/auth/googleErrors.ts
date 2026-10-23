export const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Bạn đã hủy đăng nhập bằng Google.',
  state: 'Phiên đăng nhập Google đã hết hạn hoặc không hợp lệ. Hãy thử lại.',
  token: 'Không xác thực được thông tin từ Google. Hãy thử lại.',
  taken: 'Tài khoản Google này đã được liên kết với một tài khoản khác.',
  session: 'Phiên đăng nhập đã thay đổi khi liên kết. Hãy thử lại.',
  locked: 'Tài khoản đã bị khóa',
  config: 'Đăng nhập bằng Google chưa được cấu hình.',
  unknown: 'Đã có lỗi xảy ra khi đăng nhập bằng Google. Hãy thử lại.',
};

export function resolveGoogleError(code: string | null | undefined): string | null {
  if (!code) return null;
  return GOOGLE_ERROR_MESSAGES[code] ?? GOOGLE_ERROR_MESSAGES.unknown;
}

export const GOOGLE_SESSION_EXPIRED = 'Phiên đăng nhập Google đã hết hạn. Hãy thử lại.';

// Messages of the API when the short Google cookie (pending sign-up or verify) is missing.
const MISSING_GOOGLE_COOKIE_MESSAGES = new Set([
  'Thiếu thông tin đăng ký Google',
  'Thiếu thông tin xác minh Google',
]);

export function isGoogleSessionMissing(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const { status, message } = err as { status?: unknown; message?: unknown };
  return status === 400 && typeof message === 'string' && MISSING_GOOGLE_COOKIE_MESSAGES.has(message);
}
