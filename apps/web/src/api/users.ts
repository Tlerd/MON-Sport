import {
  UpdateProfileRequestSchema,
  UserProfileSchema,
  type UpdateProfileRequest,
  type UserProfile,
} from '@monsport/shared';
import { apiFetch } from './http';

export async function fetchProfile(): Promise<UserProfile> {
  const data = await apiFetch<unknown>('/users/me');
  return UserProfileSchema.parse(data);
}

export async function updateProfile(input: UpdateProfileRequest): Promise<UserProfile> {
  const payload = UpdateProfileRequestSchema.parse(input);
  const data = await apiFetch<unknown>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return UserProfileSchema.parse(data);
}
