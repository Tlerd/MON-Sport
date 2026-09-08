import { BadRequestException, HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter';

function createHost(response: { status: ReturnType<typeof vi.fn> }): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost;
}

function createResponseSpy(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json };
}

describe('HttpExceptionFilter', () => {
  it('tra ve {code, message, details} cho HttpException voi message dang chuoi', () => {
    const filter = new HttpExceptionFilter();
    const response = createResponseSpy();

    filter.catch(new HttpException('Trùng giờ sân', HttpStatus.BAD_REQUEST), createHost(response));

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      code: 'HttpException',
      message: 'Trùng giờ sân',
      details: null,
    });
  });

  it('gop cac truong con vao details khi HttpException tra ve object', () => {
    const filter = new HttpExceptionFilter();
    const response = createResponseSpy();

    filter.catch(
      new BadRequestException({ message: 'Dữ liệu không hợp lệ', field: 'startAt' }),
      createHost(response),
    );

    expect(response.json).toHaveBeenCalledWith({
      code: 'BadRequestException',
      message: 'Dữ liệu không hợp lệ',
      details: { field: 'startAt' },
    });
  });

  it('tra ve 500 va thong bao tieng Viet cho loi khong xac dinh', () => {
    const filter = new HttpExceptionFilter();
    const response = createResponseSpy();

    filter.catch(new Error('boom'), createHost(response));

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      code: 'LOI_HE_THONG',
      message: 'Đã có lỗi xảy ra, vui lòng thử lại sau.',
      details: null,
    });
  });
});
