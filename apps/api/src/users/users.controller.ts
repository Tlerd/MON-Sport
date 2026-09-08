import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { UserProfile } from '@monsport/shared';
import { JwtAuthGuard, type JwtPayload } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: JwtPayload): Promise<UserProfile> {
    return this.usersService.getProfile(user.sub);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.usersService.updateProfile(user.sub, dto);
  }
}
