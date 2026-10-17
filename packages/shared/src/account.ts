import { z } from 'zod';
import { Phone, PHONE_MESSAGE, Role, Sport, VenueView } from './booking.ts';
import { isWeakPassword } from './common-passwords.ts';

// Brief F-003: sign-up (UC-1, flow 1.0) and the admin screens (UC-10). Names follow docs/requirements/data-dictionary.md.

/** The Vietnamese error texts of brief F-003. The API answers one of these, or `invalid`. */
export const Messages = {
  consent: 'Bạn cần đồng ý với thông báo bảo vệ dữ liệu cá nhân',
  passwordLength: 'Mật khẩu có ít nhất 8 ký tự',
  passwordMax: 'Mật khẩu dài tối đa 128 ký tự',
  name: 'Tên có từ 1 tới 100 ký tự',
  phone: PHONE_MESSAGE,
  hours: 'Giờ đóng cửa phải sau giờ mở cửa',
  grid: 'Giờ phải theo bước 30 phút',
  range: 'Giờ phải trong khoảng 00:00–24:00',
  price: 'Giá phải lớn hơn 0',
  priceMax: 'Giá tối đa 10.000.000đ một giờ',
  invalid: 'Dữ liệu không hợp lệ',
  // Brief F-006.
  weakPassword: 'Mật khẩu này quá dễ đoán. Hãy chọn mật khẩu khác',
  tooManyAttempts: 'Bạn đã thử quá nhiều lần. Hãy thử lại sau ít phút',
} as const;

const known = new Set<string>(Object.values(Messages));

/** The first error text of a failed parse, or the generic text when Zod gave an English one. */
export function errorMessage(error: z.ZodError): string {
  const message = error.issues[0]?.message ?? '';
  return known.has(message) ? message : Messages.invalid;
}

/**
 * Shown on the sign-up screen. Open item 4 of the intake (Luật 91/2025) is still open, so the text is a safe default
 * that the user and a legal adviser replace. One paragraph per line.
 */
export const PRIVACY_NOTICE = [
  'MONSPORT thu thập tên, số điện thoại và lịch sử đặt sân của bạn để bạn đặt sân và ghép trận.',
  'Chủ sân của booking và host của trận bạn vào thấy số điện thoại của bạn. Admin của MONSPORT thấy số điện thoại để quản lý tài khoản. MONSPORT không bán dữ liệu của bạn.',
  'Dữ liệu được lưu trên máy chủ Google Cloud tại Singapore trong thời gian bạn dùng tài khoản. Khi bạn xóa tài khoản, booking cũ còn lại nhưng không còn tên và số điện thoại của bạn.',
  'Theo Luật Bảo vệ dữ liệu cá nhân (Luật 91/2025), bạn có quyền xem, sửa, xóa dữ liệu và rút lại sự đồng ý. Hãy liên hệ admin của MONSPORT để làm việc này.',
].join('\n');

const Name = z.string({ error: Messages.name }).trim().min(1, Messages.name).max(100, Messages.name);
const Password = z.string().min(8, Messages.passwordLength).max(128, Messages.passwordMax);
const Instant = z.iso.datetime({ offset: true });

// A new password must not be easy to guess (brief F-006, BR-31). A login does not check this, so old passwords still work.
const notWeak = (data: { phone: unknown; password: unknown }, ctx: z.RefinementCtx) => {
  if (typeof data.password === 'string' && isWeakPassword(data.password, typeof data.phone === 'string' ? data.phone : ''))
    ctx.addIssue({ code: 'custom', path: ['password'], message: Messages.weakPassword });
};

export const RegisterRequest = z
  .object({
    name: Name,
    phone: Phone,
    password: Password,
    consent: z.literal(true, { error: Messages.consent }),
  })
  .superRefine(notWeak);
export type RegisterRequest = z.infer<typeof RegisterRequest>;

export const CreateOwnerRequest = z.object({ name: Name, phone: Phone, password: Password }).superRefine(notWeak);
export type CreateOwnerRequest = z.infer<typeof CreateOwnerRequest>;

/** The admin finds one account by its exact phone number. The number goes in the body, so it stays out of request logs. */
export const UserSearchRequest = z.object({ phone: Phone });
export type UserSearchRequest = z.infer<typeof UserSearchRequest>;

export const AccountView = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: Phone,
  role: Role,
  lockedAt: Instant.nullable(),
  createdAt: Instant,
});
export type AccountView = z.infer<typeof AccountView>;

// Minutes since 00:00 on the 30-minute grid. A venue does not open past midnight.
const Minutes = (min: number, max: number) => z.int().min(min, Messages.range).max(max, Messages.range).multipleOf(30, Messages.grid);

const VenueFields = z.object({
  ownerId: z.uuid(),
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(200),
  phone: Phone,
  opensAt: Minutes(0, 1410),
  closesAt: Minutes(30, 1440),
});

export const VenueInput = VenueFields.refine((v) => v.closesAt > v.opensAt, { message: Messages.hours, path: ['closesAt'] });
export type VenueInput = z.infer<typeof VenueInput>;

/** A PATCH body. The server merges it into the stored venue, then checks the result with `VenueInput`. */
export const VenueUpdate = VenueFields.partial();
export type VenueUpdate = z.infer<typeof VenueUpdate>;

/** Whole VND per hour (BR-25). The cap keeps a booking total inside the int4 column `Booking.priceTotal`. */
export const PRICE_MAX = 10_000_000;
const Price = z.int().positive(Messages.price).max(PRICE_MAX, Messages.priceMax);

export const CourtInput = z.object({
  name: z.string().trim().min(1).max(50),
  sport: Sport,
  priceNormal: Price,
  pricePeak: Price,
});
export type CourtInput = z.infer<typeof CourtInput>;

/** A PATCH body. The sport stays fixed, because a match later takes the sport of its court, so a body with `sport` gets 400. */
export const CourtUpdate = CourtInput.omit({ sport: true }).partial().strict();
export type CourtUpdate = z.infer<typeof CourtUpdate>;

export const AdminVenueView = VenueView.extend({
  owner: z.object({ id: z.uuid(), name: z.string(), phone: Phone }),
});
export type AdminVenueView = z.infer<typeof AdminVenueView>;
