import { Injectable } from '@nestjs/common';
import type { SearchVenuesInput, VenueView } from '@monsport/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { toVenueView } from './venue-view.js';

const WITH_COURTS = { courts: { orderBy: { name: 'asc' } } } as const;

@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchVenuesInput = {}): Promise<VenueView[]> {
    const and: Prisma.VenueWhereInput[] = [];
    if (query.sport) and.push({ courts: { some: { sport: query.sport } } });
    if (query.name) {
      const contains = { contains: query.name, mode: 'insensitive' } as const;
      and.push({ OR: [{ name: contains }, { courts: { some: { name: contains } } }] });
    }
    const venues = await this.prisma.venue.findMany({ where: { AND: and }, include: WITH_COURTS, orderBy: { name: 'asc' } });
    return venues.map(toVenueView);
  }
}
