import { Injectable } from '@nestjs/common';
import type { SearchVenuesInput, VenueView } from '@monsport/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { toVenueView } from './venue-view.js';

const WITH_COURTS = { courts: { orderBy: { name: 'asc' } } } as const;

/** The public read of venues (UC-2). It needs no login, so each row goes through `toVenueView`: no ownerId. */
@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * With no filter it returns every venue. `sport` keeps the venues that have a court of that sport. `name` keeps the
   * venues whose name, or whose court name, contains the text (no case). Each venue keeps all its courts.
   */
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
