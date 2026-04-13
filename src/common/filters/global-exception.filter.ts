import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
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

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const reqId = request['id'] || 'no-req-id';

    this.logger.error(
      `[${reqId}] ${request.method} ${request.originalUrl} - Error: ${JSON.stringify(message)}`,
    );

    response.status(status).json({
      success: false,
      requestId: reqId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      error:
        typeof message === 'string'
          ? message
          : (message as any).message || message,
    });
  }
}
