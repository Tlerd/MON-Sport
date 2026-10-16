import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { VenueView } from '@monsport/shared';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import { toVenueView } from './venue-view.js';

@Controller('venues')
export class VenuesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<VenueView[]> {
    const venues = await this.prisma.venue.findMany({ include: { courts: { orderBy: { name: 'asc' } } }, orderBy: { name: 'asc' } });
    return venues.map(toVenueView);
  }
}

// BR-23 and brief F-003 (AC-16): an owner sees only the venues whose ownerId is the caller.
@Controller('owner/venues')
@UseGuards(SessionGuard)
@Roles('OWNER')
export class OwnerVenuesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async mine(@Req() req: AuthedRequest): Promise<VenueView[]> {
    const venues = await this.prisma.venue.findMany({ where: { ownerId: req.user.id }, include: { courts: { orderBy: { name: 'asc' } } }, orderBy: { name: 'asc' } });
    return venues.map(toVenueView);
  }
}
