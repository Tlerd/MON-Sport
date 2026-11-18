import { createHash } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import {
  MAX_ACTIVE_OAUTH_CONNECTIONS,
  OAUTH_ACCESS_TTL_SECONDS,
  OAUTH_CONNECTION_MAX_DAYS,
  OAUTH_REFRESH_IDLE_DAYS,
} from '@monsport/shared';
import type { Prisma } from '../../generated/prisma/client.js';

export const NOT_FOUND = 'Không tìm thấy yêu cầu';
export const EXPIRED = 'Yêu cầu đã hết hạn. Nối lại từ Claude';
export const DONE = 'Yêu cầu đã được xử lý';
export const FULL = 'Bạn đã có 10 kết nối AI. Thu hồi một kết nối trước';
export const CONNECTION_NOT_FOUND = 'Không tìm thấy kết nối';
export const REQUEST_TTL_MS = 10 * 60_000;
export const CODE_TTL_MS = 60_000;
export const DAY_MS = 86_400_000;
export const MAX_CONNECTIONS = MAX_ACTIVE_OAUTH_CONNECTIONS;
export const CONNECTION_MAX_DAYS = OAUTH_CONNECTION_MAX_DAYS;
export const SCOPES = ['read', 'book', 'offline_access'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
export const MAX_URL = 500;
export const VERIFIER_FORMAT = /^[A-Za-z0-9._~-]{43,128}$/;
export const MAX_TOKEN_LENGTH = 100;
export const LAST_USED_STEP_MS = 60_000;
export const REUSE_GRACE_MS = 60_000;
export const ACCESS_TTL_MS = OAUTH_ACCESS_TTL_SECONDS * 1000;
export const REFRESH_IDLE_MS = OAUTH_REFRESH_IDLE_DAYS * 86_400_000;

export const DATA_READ = [
  'Tên của bạn',
  'Booking của bạn: sân, giờ, giá, trạng thái',
  'Trận bạn mở hoặc đã vào, và phòng chờ ghép trận',
  'AI không thấy số điện thoại, mật khẩu hay email của bạn',
];

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function publicOrigin(): string {
  const origin = (process.env.PUBLIC_ORIGIN ?? '').trim().replace(/\/+$/, '');
  if (!origin) throw new NotFoundException();
  return origin;
}

export function redirectUrl(base: string, params: Record<string, string | null | undefined>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}

export function validWhere(
  userId: string,
  sessionsValidFrom: Date | null,
  now: Date,
): Prisma.OAuthConnectionWhereInput {
  const earliest = new Date(now.getTime() - CONNECTION_MAX_DAYS * DAY_MS);
  return {
    userId,
    revokedAt: null,
    createdAt: sessionsValidFrom ? { gt: earliest, gte: sessionsValidFrom } : { gt: earliest },
    user: { lockedAt: null, deletedAt: null },
    OR: [{ accessExpiresAt: { gt: now } }, { refreshTokenHash: { not: null }, refreshExpiresAt: { gt: now } }],
  };
}
