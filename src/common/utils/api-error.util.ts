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
    path: request.originalUrl || request.url,
  };
}
