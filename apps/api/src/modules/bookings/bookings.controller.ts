import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { BookingStatus, type BookingView, CreateBookingRequest, CreatePhoneBookingRequest, Messages, type OwnerBookingView, PHONE_MESSAGE } from '@monsport/shared';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { BookingsService } from './bookings.service.js';

// A malformed id gets the Vietnamese generic text, not the English text of the pipe.
const Id = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(Messages.invalid) });

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

  /** UC-5 (brief F-007): the booking of a customer who phoned. A wrong customer phone gets the phone text. */
  @Post()
  enter(@Req() req: AuthedRequest, @Body() body: unknown): Promise<OwnerBookingView> {
    const input = CreatePhoneBookingRequest.safeParse(body);
    if (!input.success) {
      const phoneIssue = input.error.issues.find((i) => i.path[0] === 'customerPhone');
      throw new BadRequestException(phoneIssue ? PHONE_MESSAGE : 'Dữ liệu đặt sân không hợp lệ');
    }
    return this.bookings.enterPhoneBooking(req.user.id, input.data);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<BookingView> {
    return this.bookings.cancelPhoneBooking(req.user.id, id);
  }
}
