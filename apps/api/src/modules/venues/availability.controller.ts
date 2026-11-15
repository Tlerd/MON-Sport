import { BadRequestException, Controller, Get, Optional, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { type Availability, AvailabilityQuery, Messages } from '@monsport/shared';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { AvailabilityService } from './availability.service.js';

// A malformed id gets the Vietnamese generic text, not the English text of the pipe.
const Id = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(Messages.invalid) });

/**
 * Brief F-008 (UC-2): the free hours of one court on one day. The route needs no login, as GET /api/venues.
 * The read lives in `AvailabilityService`, which the MCP tool `get_availability` calls too (brief F-036). Nest injects
 * that service. A test that builds the controller by hand passes the two readers and gets a service of its own.
 */
@Controller('courts')
export class AvailabilityController {
  private readonly service: AvailabilityService;

  constructor(prisma: PrismaService, clock: Clock, @Optional() service?: AvailabilityService) {
    this.service = service ?? new AvailabilityService(prisma, clock);
  }

  @Get(':id/availability')
  availability(@Param('id', Id) id: string, @Query() query: unknown): Promise<Availability> {
    const parsed = AvailabilityQuery.safeParse(query);
    if (!parsed.success) throw new BadRequestException(Messages.invalid);
    return this.service.get(id, parsed.data.date);
  }
}
