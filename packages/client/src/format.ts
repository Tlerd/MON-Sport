const time = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });
const day = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatVnd = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;
export const durationLabel = (minutes: number): string => `${(minutes / 60).toLocaleString('vi-VN')} giờ`;
export const formatTime = (iso: string) => time.format(new Date(iso));
export const formatDay = (iso: string) => day.format(new Date(iso));
export const formatSlot = (startAt: string, endAt: string) => `${formatTime(startAt)}–${formatTime(endAt)} ngày ${formatDay(startAt)}`;

export const HALF_HOURS = Array.from({ length: 49 }, (_, i) => i * 30);

export const hhmm = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
