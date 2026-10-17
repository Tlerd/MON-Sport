import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { type AccountView, CreateOwnerRequest, errorMessage, Messages, UserSearchRequest } from '@monsport/shared';
import { AccountsService, toAccountView } from '../auth/accounts.service.js';
import { Roles, SessionGuard } from '../auth/session.guard.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

// A malformed id gets the Vietnamese generic text, not the English text of the pipe.
const Id = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(Messages.invalid) });

// UC-10: only the ADMIN role reaches these routes (brief F-003).
@Controller('admin')
@UseGuards(SessionGuard)
@Roles('ADMIN')
export class AdminAccountsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly accounts: AccountsService,
  ) {}

  @Post('owners')
  async createOwner(@Body() body: unknown): Promise<AccountView> {
    const input = CreateOwnerRequest.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    return toAccountView(await this.accounts.create({ ...input.data, role: 'OWNER', createdAt: this.clock.now() }));
  }

  @Get('owners')
  async owners(): Promise<AccountView[]> {
    const owners = await this.prisma.user.findMany({ where: { role: 'OWNER', deletedAt: null }, orderBy: { name: 'asc' } });
    return owners.map(toAccountView);
  }

  /**
   * BR-20: the admin finds one account by its exact phone number, and does not browse the users.
   * The number goes in the body, so it stays out of the Cloud Run request log.
   */
  @Post('users/search')
  @HttpCode(200)
  async find(@Body() body: unknown): Promise<AccountView[]> {
    const parsed = UserSearchRequest.safeParse(body);
    if (!parsed.success) throw new BadRequestException(errorMessage(parsed.error));
    const user = await this.prisma.user.findUnique({ where: { phone: parsed.data.phone } });
    return user && !user.deletedAt ? [toAccountView(user)] : [];
  }

  /** UC-10, flow 10.1 and BR-28. The session guard reads lockedAt on each request, so the lock acts at once. */
  @Post('users/:id/lock')
  @HttpCode(200)
  async lock(@Param('id', Id) id: string): Promise<AccountView> {
    // One conditional write: a parallel unlock cannot slip between a read and the write, and the first lock time stays.
    await this.prisma.user.updateMany({ where: { id, lockedAt: null, deletedAt: null, role: { not: 'ADMIN' } }, data: { lockedAt: this.clock.now() } });
    const user = await this.account(id);
    if (user.role === 'ADMIN') throw new BadRequestException('Không khóa được tài khoản admin');
    return toAccountView(user);
  }

  /**
   * Brief F-006, BR-32: an unlock also revokes every session issued before it, so a stolen cookie does not come back.
   * Only a locked account changes, so a second click on "Mở khóa" does not sign the user out.
   */
  @Post('users/:id/unlock')
  @HttpCode(200)
  async unlock(@Param('id', Id) id: string): Promise<AccountView> {
    await this.prisma.user.updateMany({
      where: { id, deletedAt: null, lockedAt: { not: null } },
      data: { lockedAt: null, sessionsValidFrom: this.clock.now() },
    });
    return toAccountView(await this.account(id));
  }

  private async account(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) throw new NotFoundException('Không tìm thấy tài khoản');
    return user;
  }
}
