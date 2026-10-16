import { ConflictException, Injectable } from '@nestjs/common';
import type { AccountView, Role } from '@monsport/shared';
import { hash } from '@node-rs/argon2';
import type { User } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';

export const PHONE_TAKEN = 'Số điện thoại này đã có tài khoản'; // BR-24

// Prisma P2002 or Postgres SQLSTATE 23505: a unique index refused a second row, for example a second account on one phone.
// The driver adapter can wrap the database error, so the code is searched on the error and its causes.
export function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && typeof e === 'object' && depth < 5; depth++) {
    const o = e as { code?: unknown; originalCode?: unknown; cause?: unknown };
    if (['P2002', '23505'].includes(String(o.code)) || o.originalCode === '23505') return true;
    e = o.cause;
  }
  return false;
}

export function toAccountView(u: User): AccountView {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    role: u.role,
    lockedAt: u.lockedAt ? u.lockedAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates an account with an argon2 hash of the password. The unique index on the phone decides a race
   * between two sign-ups (brief F-003, AC-4), so there is no read before the insert.
   */
  async create(input: { name: string; phone: string; password: string; role: Role; consentAt?: Date; createdAt: Date }): Promise<User> {
    const { password, ...data } = input;
    try {
      return await this.prisma.user.create({ data: { ...data, passwordHash: await hash(password) } });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(PHONE_TAKEN);
      throw error;
    }
  }
}
