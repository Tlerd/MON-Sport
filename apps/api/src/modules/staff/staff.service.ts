import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type CreateStaffRequest, STAFF_PHONE_TAKEN, type StaffView } from '@monsport/shared';
import type { User } from '../../generated/prisma/client.js';
import { isUniqueViolation } from '../auth/accounts.service.js';
import { Passwords } from '../auth/passwords.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

export function toStaffView(u: User): StaffView {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    venueId: u.staffVenueId!,
    lockedAt: u.lockedAt ? u.lockedAt.toISOString() : null,
  };
}

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly passwords: Passwords,
  ) {}

  async createStaff(venueId: string, ownerId: string, data: CreateStaffRequest): Promise<StaffView> {
    const passwordHash = await this.passwords.hash(data.password);
    const now = this.clock.now();
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const venueRows = await tx.$queryRaw<{ ownerId: string }[]>`
          SELECT "ownerId" FROM "Venue" WHERE "id" = ${venueId}::uuid FOR SHARE
        `;
        if (venueRows.length === 0) {
          throw new NotFoundException('Không tìm thấy đơn vị');
        }
        if (venueRows[0].ownerId !== ownerId) {
          throw new NotFoundException('Không tìm thấy đơn vị');
        }
        const userRows = await tx.$queryRaw<unknown[]>`
          SELECT 1 FROM "User" WHERE "id" = ${ownerId}::uuid AND "lockedAt" IS NULL AND "deletedAt" IS NULL FOR SHARE
        `;
        if (userRows.length === 0) {
          throw new NotFoundException('Không tìm thấy đơn vị');
        }
        return tx.user.create({
          data: {
            name: data.name,
            phone: data.phone,
            passwordHash,
            role: 'STAFF',
            staffVenueId: venueId,
            consentAt: now,
            createdAt: now,
          },
        });
      });
      return toStaffView(user);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(STAFF_PHONE_TAKEN);
      throw error;
    }
  }

  async listStaff(venueId: string, ownerId: string): Promise<StaffView[]> {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue || venue.ownerId !== ownerId) {
      throw new NotFoundException('Không tìm thấy đơn vị');
    }
    const staff = await this.prisma.user.findMany({
      where: { staffVenueId: venueId, role: 'STAFF', deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return staff.map(toStaffView);
  }

  async lockStaff(staffId: string, ownerId: string): Promise<StaffView> {
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      include: { staffVenue: true },
    });
    if (!staff || staff.role !== 'STAFF' || staff.deletedAt !== null) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }
    if (!staff.staffVenue || staff.staffVenue.ownerId !== ownerId) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }
    const now = this.clock.now();
    const updated = await this.prisma.user.update({
      where: { id: staffId },
      data: {
        lockedAt: staff.lockedAt ?? now,
        sessionsValidFrom: now,
      },
    });
    return toStaffView(updated);
  }
}
