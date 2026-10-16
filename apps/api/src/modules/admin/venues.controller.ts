import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { type AdminVenueView, CourtInput, CourtUpdate, type CourtView, errorMessage, Messages, VenueInput, VenueUpdate } from '@monsport/shared';
import type { Court, Venue } from '../../generated/prisma/client.js';
import { isUniqueViolation } from '../auth/accounts.service.js';
import { Roles, SessionGuard } from '../auth/session.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import { toCourtView, toVenueView } from '../venues/venue-view.js';
import { isHoursViolation } from './db-errors.js';

const BAD_OWNER = 'Chủ sân không hợp lệ';
const COURT_TAKEN = 'Tên sân đã có trong đơn vị này';
// The owner is read with 3 fields only, so a later change cannot return the password hash by mistake.
const WITH_COURTS = { courts: { orderBy: { name: 'asc' } }, owner: { select: { id: true, name: true, phone: true } } } as const;

type OwnerView = AdminVenueView['owner'];

function toAdminView({ owner, ...venue }: Venue & { courts: Court[]; owner: OwnerView }): AdminVenueView {
  return { ...toVenueView(venue), owner: { id: owner.id, name: owner.name, phone: owner.phone } };
}

// A malformed id gets the Vietnamese generic text, not the English text of the pipe.
const Id = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(Messages.invalid) });

// UC-10: the admin creates and edits venues and courts (brief F-003). Only the ADMIN role reaches these routes.
@Controller('admin')
@UseGuards(SessionGuard)
@Roles('ADMIN')
export class AdminVenuesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('venues')
  async list(): Promise<AdminVenueView[]> {
    const venues = await this.prisma.venue.findMany({ include: WITH_COURTS, orderBy: { name: 'asc' } });
    return venues.map(toAdminView);
  }

  @Post('venues')
  async create(@Body() body: unknown): Promise<AdminVenueView> {
    const input = VenueInput.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    await this.assertOwner(input.data.ownerId);
    return toAdminView(await this.prisma.venue.create({ data: input.data, include: WITH_COURTS }));
  }

  /**
   * The body is merged into the stored venue, and the result is checked as a whole (AC-19). The row stays locked
   * from the read to the write, and only the fields of the body are written. So two parallel updates of different
   * fields both stay, and a parallel update cannot write back an old owner (BR-20, BR-23).
   */
  @Patch('venues/:id')
  async update(@Param('id', Id) id: string, @Body() body: unknown): Promise<AdminVenueView> {
    const patch = VenueUpdate.safeParse(body);
    if (!patch.success) throw new BadRequestException(errorMessage(patch.error));
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Venue" WHERE id = ${id}::uuid FOR UPDATE`;
        const stored = await tx.venue.findUnique({ where: { id } });
        if (!stored) throw new NotFoundException('Không tìm thấy đơn vị');
        const { id: _id, ...fields } = stored;
        const merged = VenueInput.safeParse({ ...fields, ...patch.data });
        if (!merged.success) throw new BadRequestException(errorMessage(merged.error));
        if (patch.data.ownerId && patch.data.ownerId !== stored.ownerId) await this.assertOwner(patch.data.ownerId, tx);
        return toAdminView(await tx.venue.update({ where: { id }, data: patch.data, include: WITH_COURTS }));
      });
    } catch (error) {
      if (isHoursViolation(error)) throw new BadRequestException(Messages.hours);
      throw error;
    }
  }

  @Post('venues/:id/courts')
  async addCourt(@Param('id', Id) venueId: string, @Body() body: unknown): Promise<CourtView> {
    const input = CourtInput.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    if (!(await this.prisma.venue.findUnique({ where: { id: venueId } }))) throw new NotFoundException('Không tìm thấy đơn vị');
    return toCourtView(await this.saveCourt(() => this.prisma.court.create({ data: { ...input.data, venueId } })));
  }

  @Patch('courts/:id')
  async updateCourt(@Param('id', Id) id: string, @Body() body: unknown): Promise<CourtView> {
    const input = CourtUpdate.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    if (!(await this.prisma.court.findUnique({ where: { id } }))) throw new NotFoundException('Không tìm thấy sân');
    return toCourtView(await this.saveCourt(() => this.prisma.court.update({ where: { id }, data: input.data })));
  }

  /** The unique index on (venueId, name) decides a race between two courts with one name. */
  private async saveCourt(write: () => Promise<Court>): Promise<Court> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(COURT_TAKEN);
      throw error;
    }
  }

  /** Venue.ownerId points to an active OWNER account (data dictionary). A locked owner cannot take a venue. */
  private async assertOwner(ownerId: string, db: Pick<PrismaService, 'user'> = this.prisma): Promise<void> {
    const owner = await db.user.findUnique({ where: { id: ownerId } });
    if (!owner || owner.role !== 'OWNER' || owner.deletedAt || owner.lockedAt) throw new BadRequestException(BAD_OWNER);
  }
}
