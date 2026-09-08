// Gom mọi chuỗi hiện ra màn hình ở đây — không rải chuỗi tiếng Việt trong JSX
// (xem CLAUDE.md). Thêm dần theo từng mốc, chưa dùng thì chưa khai.
import type { Role, Sport, SkillLevel } from '@monsport/shared';

export const roleLabel: Record<Role, string> = {
  PLAYER: 'Người chơi',
  ORGANIZER: 'Ban tổ chức',
  ADMIN: 'Quản trị',
};

export const sportLabel: Record<Sport, string> = {
  FOOTBALL: 'Bóng đá',
  BADMINTON: 'Cầu lông',
  VOLLEYBALL: 'Bóng chuyền',
  PICKLEBALL: 'Pickleball',
};

export const skillLevelLabel: Record<SkillLevel, string> = {
  NEW: 'Mới',
  AVERAGE: 'Trung bình',
  GOOD: 'Khá',
  STRONG: 'Tốt',
};

export const vi = {
  appTitle: 'MONSPORT',
  appTagline: 'Nền tảng thể thao cấp xã/huyện',
  common: {
    loading: 'Đang tải...',
    error: 'Đã có lỗi xảy ra, vui lòng thử lại.',
  },
  nav: {
    profile: 'Hồ sơ',
    login: 'Đăng nhập',
    logout: 'Đăng xuất',
    loggedInAs: (name: string) => `Đang đăng nhập: ${name}`,
  },
  login: {
    title: 'Chọn tài khoản để đăng nhập',
    error: 'Đăng nhập không thành công, vui lòng thử lại.',
  },
  profile: {
    title: 'Hồ sơ người chơi',
    name: 'Tên',
    phone: 'Số điện thoại',
    avatarUrl: 'Link ảnh đại diện',
    skills: 'Trình độ tự khai theo từng môn',
    save: 'Lưu',
    saved: 'Đã lưu.',
    saveError: 'Lưu không thành công, vui lòng thử lại.',
    pleaseLogin: 'Bạn cần đăng nhập để xem hồ sơ.',
  },
} as const;
