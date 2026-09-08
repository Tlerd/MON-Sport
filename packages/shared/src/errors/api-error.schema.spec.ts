import { describe, expect, it } from 'vitest';
import { ApiErrorSchema } from './api-error.schema';

describe('ApiErrorSchema', () => {
  it('chap nhan hinh dang loi tu HttpExceptionFilter', () => {
    const result = ApiErrorSchema.safeParse({
      code: 'BadRequestException',
      message: 'Trùng giờ sân',
      details: { field: 'startAt' },
    });
    expect(result.success).toBe(true);
  });

  it('chap nhan details la null', () => {
    expect(
      ApiErrorSchema.safeParse({ code: 'LOI_HE_THONG', message: 'Loi', details: null }).success,
    ).toBe(true);
  });

  it('tu choi thieu message', () => {
    expect(ApiErrorSchema.safeParse({ code: 'X', details: null }).success).toBe(false);
  });
});
