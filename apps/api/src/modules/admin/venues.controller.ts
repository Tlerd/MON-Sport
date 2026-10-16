import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { type AdminVenueView, CourtInput, CourtUpdate, type CourtView, errorMessage, Messages, VenueInput, VenueUpdate } from '@monsport/shared';
import type { Court, User, Venue } from '../../generated/prisma/client.js';
import { isUniqueViolation } from '../auth/accounts.service.js';
import { Roles, SessionGuard } from '../auth/session.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import { toCourtView, toVenueView } from '../venues/venue-view.js';

const BAD_OWNER = 'Chủ sân không hợp lệ';
const COURT_TAKEN = 'Tên sân đã có trong đơn vị này';
const WITH_COURTS = { courts: { orderBy: { name: 'asc' } }, owner: true } as const;

function toAdminView(v: Venue & { courts: Court[]; owner: User }): AdminVenueView {
  const { owner, ...venue } = v;
  return { ...toVenueView(venue), owner: { id: owner.id, name: owner.name, phone: owner.phone } };
}

// Postgres SQLSTATE 23514: a CHECK of migration f003 refused the row. The app checks first, so this means a race.
function isCheckViolation(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && typeof e === 'object' && depth < 5; depth++) {
    const o = e as { code?: unknown; originalCode?: unknown; cause?: unknown };
    if (o.code === '23514' || o.originalCode === '23514') return true;
    e = o.cause;
  }
  return /23514|_check/.test(String((error as Error)?.message ?? ''));
}

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

  /** The body is merged into the stored venue, and the result is checked as a whole (AC-19). */
  @Patch('venues/:id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<AdminVenueView> {
    const patch = VenueUpdate.safeParse(body);
    if (!patch.success) throw new BadRequestException(errorMessage(patch.error));
    const stored = await this.prisma.venue.findUnique({ where: { id } });
    if (!stored) throw new NotFoundException('Không tìm thấy đơn vị');
    const { id: _id, ...fields } = stored;
    const merged = VenueInput.safeParse({ ...fields, ...patch.data });
    if (!merged.success) throw new BadRequestException(errorMessage(merged.error));
    await this.assertOwner(merged.data.ownerId);
    try {
      return toAdminView(await this.prisma.venue.update({ where: { id }, data: merged.data, include: WITH_COURTS }));
    } catch (error) {
      if (isCheckViolation(error)) throw new BadRequestException(Messages.hours);
      throw error;
    }
  }

  @Post('venues/:id/courts')
  async addCourt(@Param('id', ParseUUIDPipe) venueId: string, @Body() body: unknown): Promise<CourtView> {
    const input = CourtInput.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    if (!(await this.prisma.venue.findUnique({ where: { id: venueId } }))) throw new NotFoundException('Không tìm thấy đơn vị');
    return toCourtView(await this.saveCourt(() => this.prisma.court.create({ data: { ...input.data, venueId } })));
  }

  @Patch('courts/:id')
  async updateCourt(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<CourtView> {
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

  /** Venue.ownerId points to an OWNER account (data dictionary). */
  private async assertOwner(ownerId: string): Promise<void> {
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner || owner.role !== 'OWNER' || owner.deletedAt) throw new BadRequestException(BAD_OWNER);
  }
}
