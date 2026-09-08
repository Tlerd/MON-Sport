import { LoginRequestSchema, type LoginRequest } from '@monsport/shared';

// Class rong + interface cung ten (declaration merging) — ZodValidationPipe doc
// static schema o duoi, cac field thuc te den tu LoginRequest (z.infer o shared),
// khong khai lai kieu du lieu lan thu hai.
export class LoginDto {
  static readonly schema = LoginRequestSchema;
}
export interface LoginDto extends LoginRequest {}
