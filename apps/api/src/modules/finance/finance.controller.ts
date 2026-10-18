import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  type FinancialDashboardView,
  FinancialQuerySchema,
  Messages,
} from '@monsport/shared';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { FinanceService } from './finance.service.js';

const Id = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(Messages.invalid) });

@Controller('owner/venues')
@UseGuards(SessionGuard)
@Roles('OWNER')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get(':id/financials')
  getFinancials(
    @Req() req: AuthedRequest,
    @Param('id', Id) venueId: string,
    @Query() query: Record<string, string | undefined>,
  ): Promise<FinancialDashboardView> {
    const parsed = FinancialQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException('Tham số truy vấn tài chính không hợp lệ');
    return this.finance.getDashboard(req.user.id, venueId, parsed.data);
  }
}
