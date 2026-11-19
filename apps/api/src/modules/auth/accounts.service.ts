import { ConflictException, Injectable } from '@nestjs/common';
import type { AccountView, Role, SkillLevel } from '@monsport/shared';
import type { Prisma, User } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { Passwords } from './passwords.js';
import { keyedDigest } from './session.js';

export const PHONE_TAKEN = 'Số điện thoại này đã có tài khoản';

export async function clearAccountGoogleAndOtp(
  tx: Prisma.TransactionClient,
  userId: string,
  phone: string,
): Promise<void> {
  await tx.user.update({
    where: { id: userId },
    data: { googleSub: null, email: null, phoneVerifiedAt: null },
  });
  await tx.phoneOtp.deleteMany({
    where: { phoneKey: keyedDigest(phone) },
  });
}

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: Passwords,
  ) {}

  async create(input: {
    name: string;
    phone: string;
    password: string;
    role: Role;
    consentAt?: Date;
    createdAt: Date;
    skillLevel?: SkillLevel | null;
  }): Promise<User> {
    const { password, ...data } = input;
    try {
      return await this.prisma.user.create({ data: { ...data, passwordHash: await this.passwords.hash(password) } });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(PHONE_TAKEN);
      throw error;
    }
  }
}
