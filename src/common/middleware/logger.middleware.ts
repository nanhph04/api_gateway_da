import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {
  getRequestTargetService,
  setRequestTargetService,
} from '../utils/service-routing.util';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction) {
    const { method, originalUrl } = request;
    const reqId = request['id'] || 'no-req-id';
    const startTime = Date.now();
    const service = setRequestTargetService(request);

    response.on('finish', () => {
      const { statusCode } = response;
      const responseTime = Date.now() - startTime;
      const message = `[${reqId}] [${getRequestTargetService(request)}] ${method} ${originalUrl} ${statusCode} ${responseTime}ms`;

      if (statusCode >= 500) {
        this.logger.error(message);
        return;
      }

      if (statusCode >= 400) {
        this.logger.warn(message);
        return;
      }

      this.logger.log(message);
    });

    request['targetService'] = service;
    next();
  }
}
