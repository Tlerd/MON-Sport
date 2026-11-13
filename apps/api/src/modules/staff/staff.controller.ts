import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateStaffRequest, errorMessage, Messages, type StaffView } from '@monsport/shared';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { StaffService } from './staff.service.js';

const Id = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(Messages.invalid) });

@Controller('owner')
@UseGuards(SessionGuard)
@Roles('OWNER')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post('venues/:venueId/staff')
  @HttpCode(201)
  async createStaff(
    @Param('venueId', Id) venueId: string,
    @Body() body: unknown,
    @Req() req: AuthedRequest,
  ): Promise<StaffView> {
    const input = CreateStaffRequest.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    return this.staffService.createStaff(venueId, req.user.id, input.data);
  }

  @Get('venues/:venueId/staff')
  async listStaff(
    @Param('venueId', Id) venueId: string,
    @Req() req: AuthedRequest,
  ): Promise<StaffView[]> {
    return this.staffService.listStaff(venueId, req.user.id);
  }

  @Post('staff/:id/lock')
  @HttpCode(200)
  async lockStaff(
    @Param('id', Id) id: string,
    @Req() req: AuthedRequest,
  ): Promise<StaffView> {
    return this.staffService.lockStaff(id, req.user.id);
  }
}
