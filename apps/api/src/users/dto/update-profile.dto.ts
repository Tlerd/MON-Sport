import { UpdateProfileRequestSchema, type UpdateProfileRequest } from '@monsport/shared';

export class UpdateProfileDto {
  static readonly schema = UpdateProfileRequestSchema;
}
export interface UpdateProfileDto extends UpdateProfileRequest {}
