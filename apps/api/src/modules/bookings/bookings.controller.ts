import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { BookingStatus, type BookingView, CreateBookingRequest, CreatePhoneBookingRequest, Messages, type MyBookingView, type OwnerBookingView, type PaidAtVenueResponse, PHONE_MESSAGE, UpdatePaidAtVenueSchema } from '@monsport/shared';
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
  @Roles('USER')
  mine(@Req() req: AuthedRequest): Promise<MyBookingView[]> {
    return this.bookings.mine(req.user.id);
  }

  /** UC-6 (brief F-009): a user cancels their own booking. BR-22: an owner and the admin get 403. */
  @Post(':id/cancel')
  @Roles('USER')
  @HttpCode(200)
  cancel(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<MyBookingView> {
    return this.bookings.cancelOwn(req.user.id, id);
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
    return this.bookings.cancelAsOwner(req.user.id, id);
  }

  @Patch(':id/paid')
  @HttpCode(200)
  markPaid(
    @Req() req: AuthedRequest,
    @Param('id', Id) id: string,
    @Body() body: unknown,
  ): Promise<PaidAtVenueResponse> {
    const parsed = UpdatePaidAtVenueSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Dữ liệu thu tiền không hợp lệ');
    return this.bookings.markPaidAtVenue(req.user.id, id, parsed.data.paidAtVenue);
  }
}
