import { BadRequestException, Controller, Get, Optional, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { type Availability, AvailabilityQuery, Messages } from '@monsport/shared';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { AvailabilityService } from './availability.service.js';

const Id = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(Messages.invalid) });

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
