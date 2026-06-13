import type { Request } from 'express';

export interface ApiErrorBody {
  success: false;
  code: number;
  mess: string;
  data: null;
  errors: string[];
  requestId: string;
  timestamp: string;
  path: string;
}

interface RequestWithId extends Request {
  id?: string;
}

export function redactSensitiveUrl(value: string): string {
  try {
    const url = new URL(value, 'http://localhost');

    if (url.searchParams.has('token')) {
      url.searchParams.set('token', '[redacted]');
    }

    return `${url.pathname}${url.search}${url.hash}`.replace(
      /token=%5Bredacted%5D/gi,
      'token=[redacted]',
    );
  } catch {
    return value.replace(/([?&]token=)[^&#]*/gi, '$1[redacted]');
  }
}

export function buildApiError(
  request: RequestWithId,
  code: number,
  mess: string,
  errors: string[] = [mess],
): ApiErrorBody {
  return {
    success: false,
    code,
    mess,
    data: null,
    errors,
    requestId: request.id || 'no-req-id',
    timestamp: new Date().toISOString(),
    path: redactSensitiveUrl(request.originalUrl || request.url),
  };
}
