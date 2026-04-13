import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction) {
    const { method, originalUrl } = request;
    const reqId = request['id'] || 'no-req-id';
    const startTime = Date.now();

    response.on('finish', () => {
      const { statusCode } = response;
      const responseTime = Date.now() - startTime;
      this.logger.log(
        `[${reqId}] ${method} ${originalUrl} ${statusCode} - ${responseTime}ms`,
      );
    });

    next();
  }
}
