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
