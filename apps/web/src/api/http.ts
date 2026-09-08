import { ApiErrorSchema, type ApiError } from '@monsport/shared';

const API_BASE = '/api';

// Loi tu API, giu nguyen {code, message, details} de UI hien thang message
// tieng Viet ma khong phai doan lai hinh dang (xem HttpExceptionFilter o api).
export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly apiError: ApiError,
  ) {
    super(apiError.message);
  }
}

const UNKNOWN_ERROR: ApiError = {
  code: 'LOI_KHONG_XAC_DINH',
  message: 'Đã có lỗi xảy ra, vui lòng thử lại.',
  details: null,
};

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Dung Headers API de gop dung, khong spread truc tiep (init?.headers co the
  // la mang cap [key, value] hoac Headers, spread se ra ket qua sai).
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const parsed = ApiErrorSchema.safeParse(body);
    throw new ApiRequestError(response.status, parsed.success ? parsed.data : UNKNOWN_ERROR);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
