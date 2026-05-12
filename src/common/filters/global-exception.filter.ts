import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getRequestTargetService } from '../utils/service-routing.util';
import { buildApiError } from '../utils/api-error.util';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Check if response stream has already been started by the proxy, to avoid set header errors
    if (response.headersSent) {
      return;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';
    const { mess, errors } = this.normalizeExceptionResponse(exceptionResponse);

    const reqId = request['id'] || 'no-req-id';
    const service = getRequestTargetService(request);

    this.logger.error(
      `[${reqId}] [${service}] ${request.method} ${request.originalUrl} - Error: ${JSON.stringify(exceptionResponse)}`,
    );

    response.status(status).json(buildApiError(request, status, mess, errors));
  }

  private normalizeExceptionResponse(response: unknown): {
    mess: string;
    errors: string[];
  } {
    if (typeof response === 'string') {
      return { mess: response, errors: [response] };
    }

    if (!response || typeof response !== 'object') {
      return {
        mess: 'Internal server error',
        errors: ['Internal server error'],
      };
    }

    const responseObject = response as {
      mess?: unknown;
      message?: unknown;
      errors?: unknown;
    };
    const messageValue = responseObject.mess ?? responseObject.message;
    const mess = Array.isArray(messageValue)
      ? messageValue.join(', ')
      : typeof messageValue === 'string'
        ? messageValue
        : 'Internal server error';

    if (
      Array.isArray(responseObject.errors) &&
      responseObject.errors.every((error) => typeof error === 'string')
    ) {
      return { mess, errors: responseObject.errors };
    }

    if (Array.isArray(messageValue)) {
      return { mess, errors: messageValue.filter(this.isString) };
    }

    return { mess, errors: [mess] };
  }

  private isString(value: unknown): value is string {
    return typeof value === 'string';
  }
}
