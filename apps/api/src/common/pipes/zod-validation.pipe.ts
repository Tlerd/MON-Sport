import {
  BadRequestException,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import type { ZodType } from 'zod';

interface ZodDtoClass {
  schema: ZodType;
}

// DTO la mot class rong mang static `schema` (xem apps/api/src/auth/dto/login.dto.ts).
// Tham so khong gan class DTO (vd. @Param('id') id: string) se khong co `.schema`,
// pipe cho qua nguyen trang — quen gan kieu DTO cho @Body() se AM THAM bo qua
// validate, xem giai thich o docs/kien-truc.md.
function hasZodSchema(metatype: unknown): metatype is ZodDtoClass {
  if (typeof metatype !== 'function') {
    return false;
  }
  const candidate = (metatype as unknown as Record<string, unknown>).schema;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'safeParse' in candidate &&
    typeof (candidate as Record<string, unknown>).safeParse === 'function'
  );
}

// ZodValidationPipe toan cuc (docs/PROMPT.md muc 6). Dang ky qua APP_PIPE trong
// AppModule — KHONG chi goi app.useGlobalPipes() o main.ts, vi test e2e dung
// Test.createTestingModule khong chay qua main.ts.
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const { metatype } = metadata;
    if (!hasZodSchema(metatype)) {
      return value;
    }

    const result = metatype.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Dữ liệu không hợp lệ.',
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
