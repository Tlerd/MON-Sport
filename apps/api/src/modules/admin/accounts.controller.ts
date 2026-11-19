import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { type AccountView, CreateOwnerRequest, errorMessage, Messages, UserSearchRequest } from '@monsport/shared';
import { AccountsService, toAccountView } from '../auth/accounts.service.js';
import { Roles, SessionGuard } from '../auth/session.guard.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

const Id = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(Messages.invalid) });

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

  @Post('users/search')
  @HttpCode(200)
  async find(@Body() body: unknown): Promise<AccountView[]> {
    const parsed = UserSearchRequest.safeParse(body);
    if (!parsed.success) throw new BadRequestException(errorMessage(parsed.error));
    const user = await this.prisma.user.findUnique({ where: { phone: parsed.data.phone } });
    return user && !user.deletedAt ? [toAccountView(user)] : [];
  }

  @Post('users/:id/lock')
  @HttpCode(200)
  async lock(@Param('id', Id) id: string): Promise<AccountView> {
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({ where: { id, lockedAt: null, deletedAt: null, role: { not: 'ADMIN' } }, data: { lockedAt: now } });
      const target = await tx.user.findUnique({ where: { id } });
      if (target?.role === 'OWNER') {
        const venues = await tx.venue.findMany({ where: { ownerId: id }, select: { id: true } });
        const venueIds = venues.map((v) => v.id);
        if (venueIds.length > 0) {
          await tx.user.updateMany({
            where: { staffVenueId: { in: venueIds }, role: 'STAFF', deletedAt: null, lockedAt: null },
            data: { lockedAt: now, sessionsValidFrom: now },
          });
          await tx.user.updateMany({
            where: { staffVenueId: { in: venueIds }, role: 'STAFF', deletedAt: null, lockedAt: { not: null } },
            data: { sessionsValidFrom: now },
          });
        }
      }
    });
    const user = await this.account(id);
    if (user.role === 'ADMIN') throw new BadRequestException('Không khóa được tài khoản admin');
    return toAccountView(user);
  }

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
