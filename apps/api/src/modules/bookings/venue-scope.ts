import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Role } from '@monsport/shared';

export type VenueScope =
  | { ownerId: string; venueId?: undefined }
  | { venueId: string; ownerId?: undefined };

export interface ScopeUser {
  id: string;
  role: Role | string;
  staffVenueId?: string | null;
}

export function venueScope(user: ScopeUser): VenueScope {
  if (user.role === 'OWNER') {
    return { ownerId: user.id };
  }
  if (user.role === 'STAFF') {
    if (!user.staffVenueId) {
      throw new ForbiddenException('Bạn không có quyền làm việc này');
    }
    return { venueId: user.staffVenueId };
  }
  throw new ForbiddenException('Bạn không có quyền làm việc này');
}

export function matchesScope(venue: { id: string; ownerId: string }, scope: VenueScope): boolean {
  return scope.venueId ? venue.id === scope.venueId : venue.ownerId === scope.ownerId;
}

export function assertScope<T extends { venue: { id: string; ownerId: string } }>(court: T, scope: VenueScope): T {
  if (!matchesScope(court.venue, scope)) throw new NotFoundException('Không tìm thấy sân');
  return court;
}
