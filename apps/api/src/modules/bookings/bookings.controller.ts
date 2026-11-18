import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  BookingStatus,
  type BookingView,
  CreateBookingRequest,
  CreatePhoneBookingRequest,
  Messages,
  type MyBookingView,
  type OwnerBookingView,
  type PaidAtVenueResponse,
  PHONE_MESSAGE,
  RecurringPhoneBookingRequest,
  type RecurringPhoneBookingResponse,
  UpdatePaidAtVenueSchema,
} from '@monsport/shared';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { BookingsService } from './bookings.service.js';
import { OwnerBookingsService } from './owner-bookings.service.js';
import { venueScope } from './venue-scope.js';

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

  @Post(':id/cancel')
  @Roles('USER')
  @HttpCode(200)
  cancel(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<MyBookingView> {
    return this.bookings.cancelOwn(req.user.id, id);
  }
}

@Controller('owner/bookings')
@UseGuards(SessionGuard)
@Roles('OWNER')
export class OwnerBookingsController {
  constructor(private readonly bookings: OwnerBookingsService) {}

  @Get()
  @Roles('OWNER', 'STAFF')
  list(@Req() req: AuthedRequest, @Query('status') status?: string): Promise<OwnerBookingView[]> {
    const parsed = BookingStatus.safeParse(status ?? 'PENDING');
    if (!parsed.success) throw new BadRequestException('Trạng thái không hợp lệ');
    return this.bookings.forOwner(venueScope(req.user), parsed.data);
  }

  @Post('recurring')
  @Roles('OWNER', 'STAFF')
  @HttpCode(201)
  enterRecurring(@Req() req: AuthedRequest, @Body() body: unknown): Promise<RecurringPhoneBookingResponse> {
    const input = RecurringPhoneBookingRequest.safeParse(body);
    if (!input.success) {
      const phoneIssue = input.error.issues.find((i) => i.path[0] === 'customerPhone');
      throw new BadRequestException(phoneIssue ? PHONE_MESSAGE : 'Dữ liệu đặt sân không hợp lệ');
    }
    return this.bookings.enterRecurringPhoneBooking(venueScope(req.user), req.user.id, input.data);
  }

  @Post(':id/confirm')
  @Roles('OWNER', 'STAFF')
  @HttpCode(200)
  confirm(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string): Promise<BookingView> {
    return this.bookings.decide(venueScope(req.user), id, 'CONFIRMED');
  }

  @Post(':id/reject')
  @Roles('OWNER', 'STAFF')
  @HttpCode(200)
  reject(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string): Promise<BookingView> {
    return this.bookings.decide(venueScope(req.user), id, 'REJECTED');
  }

  @Post()
  @Roles('OWNER', 'STAFF')
  enter(@Req() req: AuthedRequest, @Body() body: unknown): Promise<OwnerBookingView> {
    const input = CreatePhoneBookingRequest.safeParse(body);
    if (!input.success) {
      const phoneIssue = input.error.issues.find((i) => i.path[0] === 'customerPhone');
      throw new BadRequestException(phoneIssue ? PHONE_MESSAGE : 'Dữ liệu đặt sân không hợp lệ');
    }
    return this.bookings.enterPhoneBooking(venueScope(req.user), req.user.id, input.data);
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
