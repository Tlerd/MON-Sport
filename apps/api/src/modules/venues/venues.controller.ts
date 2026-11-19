import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { type CourtView, errorMessage, Messages, OwnerCourtUpdate, OwnerVenueUpdate, VenueInput, type VenueView } from '@monsport/shared';
import { isHoursViolation } from '../admin/db-errors.js';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { venueScope } from '../bookings/venue-scope.js';
import { PrismaService } from '../database/prisma.service.js';
import { toCourtView, toVenueView } from './venue-view.js';
import { VenuesService } from './venues.service.js';

const VENUE_NOT_FOUND = 'Không tìm thấy đơn vị';
const COURT_NOT_FOUND = 'Không tìm thấy sân';
const WITH_COURTS = { courts: { orderBy: { name: 'asc' } } } as const;

const Id = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(Messages.invalid) });

@Controller('venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  list(): Promise<VenueView[]> {
    return this.venues.search();
  }
}

@Controller('owner/venues')
@UseGuards(SessionGuard)
@Roles('OWNER')
export class OwnerVenuesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles('OWNER', 'STAFF')
  async mine(@Req() req: AuthedRequest): Promise<VenueView[]> {
    const scope = venueScope(req.user);
    const where = scope.venueId ? { id: scope.venueId } : { ownerId: scope.ownerId };
    const venues = await this.prisma.venue.findMany({ where, include: WITH_COURTS, orderBy: { name: 'asc' } });
    return venues.map(toVenueView);
  }

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

@Controller('owner/courts')
@UseGuards(SessionGuard)
@Roles('OWNER')
export class OwnerCourtsController {
  constructor(private readonly prisma: PrismaService) {}

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
