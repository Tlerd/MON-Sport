import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

interface ErrorBody {
  code: string;
  message: string;
  details: unknown;
}

interface MinimalResponse {
  status: (code: number) => { json: (body: ErrorBody) => void };
}

// Lọc lỗi toàn cục: mọi lỗi trả về đúng một dạng {code, message, details},
// message là tiếng Việt nên hiện thẳng cho người dùng được (xem CLAUDE.md mục "Lỗi").
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<MinimalResponse>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json(this.toErrorBody(exception));
  }

  private toErrorBody(exception: unknown): ErrorBody {
    if (!(exception instanceof HttpException)) {
      return {
        code: 'LOI_HE_THONG',
        message: 'Đã có lỗi xảy ra, vui lòng thử lại sau.',
        details: null,
      };
    }

    const payload = exception.getResponse();
    if (typeof payload === 'string') {
      return { code: exception.name, message: payload, details: null };
    }

    const { message, ...details } = payload as Record<string, unknown>;
    return {
      code: exception.name,
      message: typeof message === 'string' ? message : exception.message,
      details,
    };
  }
}
