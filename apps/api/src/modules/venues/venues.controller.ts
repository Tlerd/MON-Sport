import { Controller, Get } from '@nestjs/common';
import type { VenueView } from '@monsport/shared';
import { PrismaService } from '../database/prisma.service.js';

@Controller('venues')
export class VenuesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<VenueView[]> {
    const venues = await this.prisma.venue.findMany({ include: { courts: { orderBy: { name: 'asc' } } }, orderBy: { name: 'asc' } });
    return venues.map(({ ownerId: _ownerId, courts, ...venue }) => ({
      ...venue,
      courts: courts.map(({ venueId: _venueId, ...court }) => court),
    }));
  }
}
