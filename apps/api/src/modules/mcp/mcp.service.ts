import { McpServer } from '@modelcontextprotocol/server';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import {
  CancelBookingInput,
  CancelBookingOutput,
  GetAvailabilityInput,
  GetAvailabilityOutput,
  JoinMatchInput,
  JoinMatchOutput,
  LeaveMatchInput,
  LeaveMatchOutput,
  ListMatchesInput,
  ListMatchesOutput,
  ListMyBookingsInput,
  ListMyBookingsOutput,
  type McpToolName,
  minuteOfDayVN,
  OpenMatchInput,
  OpenMatchOutput,
  RequestBookingInput,
  RequestBookingOutput,
  SearchVenuesInput,
  SearchVenuesOutput,
  vnDateString,
} from '@monsport/shared';
import { BookingsService } from '../bookings/bookings.service.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { AvailabilityService } from '../venues/availability.service.js';
import { VenuesService } from '../venues/venues.service.js';
import type { McpContext } from './mcp-context.js';
import { RateLimiter } from './rate-limiter.js';

const TOO_MANY = 'Quá nhiều lệnh. Thử lại sau'; // BR-58
const GENERIC = 'Có lỗi xảy ra. Thử lại sau';

const failure = (text: string) => ({ isError: true as const, content: [{ type: 'text' as const, text }] });

// A Zod schema fits this shape. The package of the API does not list Zod, so the type stays structural.
interface Schema<T> {
  parse(value: unknown): T;
}

interface ToolDef<I, O> {
  title: string;
  description: string;
  input: Schema<I>;
  output: Schema<O>;
  write: boolean;
  run: (input: I) => Promise<unknown>;
}

/**
 * Brief F-036 (UC-20): the 9 tools of the USER role. A tool only calls a service, so each rule, each lock, and each
 * error text is the one of the HTTP route. This class opens no transaction and writes no table.
 */
@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  private readonly limiter = new RateLimiter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly venues: VenuesService,
    private readonly availability: AvailabilityService,
    private readonly bookings: BookingsService,
    private readonly matches: MatchesService,
  ) {}

  /** A new server for one context. Another role than USER gets a server with no tool (BR-22). */
  createServer(ctx: McpContext): McpServer {
    const server = new McpServer({ name: 'monsport', version: '1.0.0' }, { capabilities: { tools: {} } });
    if (ctx.role !== 'USER') return server;
    const { userId } = ctx;
    const add = <I, O>(name: McpToolName, def: ToolDef<I, O>) => this.register(server, ctx, name, def);

    add('search_venues', {
      title: 'Tìm đơn vị sân',
      description: 'Tìm đơn vị sân theo môn (sport) và theo tên đơn vị hoặc tên sân (name). Mỗi đơn vị kèm mọi sân, giá và giờ mở cửa. Chỉ đọc',
      input: SearchVenuesInput,
      output: SearchVenuesOutput,
      write: false,
      run: async (input) => ({ venues: await this.venues.search(input) }),
    });
    add('get_availability', {
      title: 'Xem giờ trống của sân',
      description: 'Xem các khung giờ còn trống của một sân trong một ngày (giờ Việt Nam). Chỉ đọc',
      input: GetAvailabilityInput,
      output: GetAvailabilityOutput,
      write: false,
      run: (input) => this.availability.get(input.courtId, input.date),
    });
    add('request_booking', {
      title: 'Gửi yêu cầu đặt sân',
      description: 'Gửi yêu cầu đặt sân. Chủ sân phải xác nhận trước hạn, nếu không yêu cầu hết hạn. Không thu tiền',
      input: RequestBookingInput,
      output: RequestBookingOutput,
      write: true,
      run: async (input) => {
        const booking = await this.bookings.request(userId, input);
        // A read-only select of the public data of the venue, as GET /api/venues shows it.
        const court = await this.prisma.court.findUnique({
          where: { id: booking.courtId },
          select: { name: true, venue: { select: { name: true, phone: true } } },
        });
        if (!court) throw new Error('court missing after booking');
        const deadline = booking.confirmDeadline ? new Date(booking.confirmDeadline) : null;
        const until = deadline ? ` Hạn xác nhận: ${hhmm(deadline)} ${dayMonth(deadline)} (giờ Việt Nam).` : '';
        return {
          booking,
          venueName: court.venue.name,
          courtName: court.name,
          venuePhone: court.venue.phone,
          message: `Yêu cầu đang chờ chủ sân xác nhận.${until} Gọi chủ sân: ${court.venue.phone}`,
        };
      },
    });
    add('list_my_bookings', {
      title: 'Xem booking của tôi',
      description: 'Xem các booking của người dùng hiện tại. Chỉ đọc',
      input: ListMyBookingsInput,
      output: ListMyBookingsOutput,
      write: false,
      run: async () => ({ bookings: await this.bookings.mine(userId) }),
    });
    add('cancel_booking', {
      title: 'Hủy booking',
      description: 'Hủy một booking của người dùng. Booking đã xác nhận chỉ hủy được khi còn từ 6 giờ tới giờ bắt đầu. Không hoàn tác được',
      input: CancelBookingInput,
      output: CancelBookingOutput,
      write: true,
      run: async (input) => ({ booking: await this.bookings.cancelOwn(userId, input.bookingId) }),
    });
    add('list_matches', {
      title: 'Xem phòng chờ ghép trận',
      description: 'Xem các trận đang mở trong phòng chờ, lọc theo môn, ngày hoặc trình độ. Chỉ đọc',
      input: ListMatchesInput,
      output: ListMatchesOutput,
      write: false,
      run: async (input) => ({ matches: await this.matches.list(input) }),
    });
    add('open_match', {
      title: 'Mở trận ghép',
      description: 'Mở một trận ghép trên booking của người dùng. Trận hiện trong phòng chờ cho mọi người. Người dùng là host và giữ một suất',
      input: OpenMatchInput,
      output: OpenMatchOutput,
      write: true,
      run: async (input) => ({ match: await this.matches.create(userId, input) }),
    });
    add('join_match', {
      title: 'Vào trận',
      description: 'Vào một trận ghép đang mở. Người dùng giữ một suất. Trận có chế độ "Host duyệt" chỉ gửi yêu cầu và chờ host duyệt',
      input: JoinMatchInput,
      output: JoinMatchOutput,
      write: true,
      run: async (input) => ({ match: await this.matches.join(userId, input.matchId) }),
    });
    add('leave_match', {
      title: 'Rời trận',
      description: 'Rời một trận đã vào. Suất trả lại cho người khác. Host không rời được, host phải hủy trận',
      input: LeaveMatchInput,
      output: LeaveMatchOutput,
      write: true,
      run: async (input) => ({ match: await this.matches.leave(userId, input.matchId) }),
    });
    return server;
  }

  private register<I, O>(server: McpServer, ctx: McpContext, name: McpToolName, def: ToolDef<I, O>): void {
    const handler = async (args: I) => {
      // BR-58: count the call first. A refused call never reaches a service.
      if (!this.limiter.allow(ctx.userId, def.write, this.clock.now())) return failure(TOO_MANY);
      try {
        // Parsing drops a key that the contract does not name, so a service cannot leak one by accident.
        const out = def.output.parse(await def.run(args));
        return { content: [{ type: 'text' as const, text: JSON.stringify(out) }], structuredContent: out as Record<string, unknown> };
      } catch (error) {
        if (error instanceof HttpException) return failure(error.message);
        this.logger.error(`tool ${name} failed`, error instanceof Error ? error.stack : String(error));
        return failure(GENERIC);
      }
    };
    server.registerTool(
      name,
      {
        title: def.title,
        description: def.description,
        inputSchema: def.input as never,
        outputSchema: def.output as never,
        // Hints are for the client only. The server does not rely on them.
        annotations: { readOnlyHint: !def.write, destructiveHint: def.write, idempotentHint: !def.write, openWorldHint: false },
      },
      handler as never,
    );
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** HH:MM in Asia/Ho_Chi_Minh (BR-27). */
function hhmm(at: Date): string {
  const minute = minuteOfDayVN(at);
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

/** DD/MM in Asia/Ho_Chi_Minh. */
function dayMonth(at: Date): string {
  const [, month, day] = vnDateString(at).split('-');
  return `${day}/${month}`;
}
