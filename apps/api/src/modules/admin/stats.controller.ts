import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { type AdminStatsView, AdminStatsQuerySchema } from '@monsport/shared';
import { Roles, SessionGuard } from '../auth/session.guard.js';
import { StatsService } from './stats.service.js';

// UC-13: only the ADMIN role reads the site-wide numbers (brief F-016, BR-22).
@Controller('admin')
@UseGuards(SessionGuard)
@Roles('ADMIN')
export class AdminStatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('stats')
  getStats(@Query() query: Record<string, string | undefined>): Promise<AdminStatsView> {
    const parsed = AdminStatsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException('Tham số truy vấn không hợp lệ');
    return this.stats.getStats(parsed.data.date);
  }
}
