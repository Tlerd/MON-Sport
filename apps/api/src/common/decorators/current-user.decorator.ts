import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../guards/jwt-auth.guard';

// Dung sau JwtAuthGuard: lay payload JWT (sub, role) da duoc guard gan vao request.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new Error('CurrentUser() dùng ngoài route có JwtAuthGuard.');
    }
    return request.user;
  },
);
