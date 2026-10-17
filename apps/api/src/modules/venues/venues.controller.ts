import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { type CourtView, errorMessage, Messages, OwnerCourtUpdate, OwnerVenueUpdate, VenueInput, type VenueView } from '@monsport/shared';
import { isHoursViolation } from '../admin/db-errors.js';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import { toCourtView, toVenueView } from './venue-view.js';

const VENUE_NOT_FOUND = 'Không tìm thấy đơn vị';
const COURT_NOT_FOUND = 'Không tìm thấy sân';
const WITH_COURTS = { courts: { orderBy: { name: 'asc' } } } as const;

// A malformed id gets the Vietnamese generic text, not the English text of the pipe.
const Id = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(Messages.invalid) });

@Controller('venues')
export class VenuesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<VenueView[]> {
    const venues = await this.prisma.venue.findMany({ include: WITH_COURTS, orderBy: { name: 'asc' } });
    return venues.map(toVenueView);
  }
}

// BR-23 and brief F-003 (AC-16): an owner sees only the venues whose ownerId is the caller.
// Brief F-005 (UC-11): an owner edits the opening hours of those venues. A venue of another owner answers 404,
// so the route does not tell which venues exist.
@Controller('owner/venues')
@UseGuards(SessionGuard)
@Roles('OWNER')
export class OwnerVenuesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async mine(@Req() req: AuthedRequest): Promise<VenueView[]> {
    const venues = await this.prisma.venue.findMany({ where: { ownerId: req.user.id }, include: WITH_COURTS, orderBy: { name: 'asc' } });
    return venues.map(toVenueView);
  }

  /**
   * The venue row stays locked from the ownership check to the write, so the admin cannot move the venue to another
   * owner in between. The body is merged into the stored hours and checked as a whole (11.0.E1). The catch maps the
   * CHECK of the database to the hours text, as the last guard.
   */
  @Patch(':id')
  async update(@Req() req: AuthedRequest, @Param('id', Id) id: string, @Body() body: unknown): Promise<VenueView> {
    const patch = OwnerVenueUpdate.safeParse(body);
    if (!patch.success) throw new BadRequestException(errorMessage(patch.error));
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Venue" WHERE id = ${id}::uuid FOR UPDATE`;
        const stored = await tx.venue.findUnique({ where: { id } });
        if (!stored || stored.ownerId !== req.user.id) throw new NotFoundException(VENUE_NOT_FOUND);
        const { id: _id, ...fields } = stored;
        const merged = VenueInput.safeParse({ ...fields, ...patch.data });
        if (!merged.success) throw new BadRequestException(errorMessage(merged.error));
        return toVenueView(await tx.venue.update({ where: { id }, data: patch.data, include: WITH_COURTS }));
      });
    } catch (error) {
      if (isHoursViolation(error)) throw new BadRequestException(Messages.hours);
      throw error;
    }
  }
}

// Brief F-005 (UC-11): an owner edits the prices of the courts of their venues. A new booking takes the new price,
// and an old booking keeps its stored total (BR-6).
@Controller('owner/courts')
@UseGuards(SessionGuard)
@Roles('OWNER')
export class OwnerCourtsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * FOR SHARE on the venue holds off an admin move of the venue (FOR UPDATE) until the price is written. The UPDATE
   * locks the court row, so it queues with a booking request, which reads the price under the same lock.
   */
  @Patch(':id')
  async update(@Req() req: AuthedRequest, @Param('id', Id) id: string, @Body() body: unknown): Promise<CourtView> {
    const patch = OwnerCourtUpdate.safeParse(body);
    if (!patch.success) throw new BadRequestException(errorMessage(patch.error));
    return this.prisma.$transaction(async (tx) => {
      const court = await tx.court.findUnique({ where: { id }, select: { venueId: true } });
      if (!court) throw new NotFoundException(COURT_NOT_FOUND);
      await tx.$queryRaw`SELECT id FROM "Venue" WHERE id = ${court.venueId}::uuid FOR SHARE`;
      const venue = await tx.venue.findUnique({ where: { id: court.venueId }, select: { ownerId: true } });
      if (venue?.ownerId !== req.user.id) throw new NotFoundException(COURT_NOT_FOUND);
      return toCourtView(await tx.court.update({ where: { id }, data: patch.data }));
    });
  }
}
