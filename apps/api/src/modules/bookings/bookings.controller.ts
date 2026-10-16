import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { BookingStatus, type BookingView, CreateBookingRequest, type OwnerBookingView } from '@monsport/shared';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { BookingsService } from './bookings.service.js';

@Controller('bookings')
@UseGuards(SessionGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @Roles('USER')
  create(@Req() req: AuthedRequest, @Body() body: unknown): Promise<BookingView> {
    const input = CreateBookingRequest.safeParse(body);
    if (!input.success) throw new BadRequestException('Dữ liệu đặt sân không hợp lệ');
    return this.bookings.request(req.user.id, input.data);
  }

  @Get('mine')
  mine(@Req() req: AuthedRequest): Promise<BookingView[]> {
    return this.bookings.mine(req.user.id);
  }
}

// BR-22: only the OWNER role reaches these routes, so an admin cannot confirm or reject.
@Controller('owner/bookings')
@UseGuards(SessionGuard)
@Roles('OWNER')
export class OwnerBookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query('status') status?: string): Promise<OwnerBookingView[]> {
    const parsed = BookingStatus.safeParse(status ?? 'PENDING');
    if (!parsed.success) throw new BadRequestException('Trạng thái không hợp lệ');
    return this.bookings.forOwner(req.user.id, parsed.data);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  confirm(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string): Promise<BookingView> {
    return this.bookings.decide(req.user.id, id, 'CONFIRMED');
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string): Promise<BookingView> {
    return this.bookings.decide(req.user.id, id, 'REJECTED');
  }
}
