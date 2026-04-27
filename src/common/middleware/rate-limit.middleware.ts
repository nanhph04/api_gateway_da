import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
  getRequestTargetService,
  SERVICE_ROUTE_RULES,
} from '../utils/service-routing.util';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private limiters: Map<string, ReturnType<typeof rateLimit>> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initLimiters();
  }

  private initLimiters() {
    const rateLimitConfigs = {
      identityService: 'userService',
      mediaService: 'mediaService',
      financeService: 'financeService',
      walletService: 'walletService',
      paymentService: 'paymentService',
      processingService: 'processingService',
    } as const;

    for (const rule of SERVICE_ROUTE_RULES) {
      const configKey = rateLimitConfigs[rule.serviceKey];
      const config = this.configService.get<{
        windowMs: number;
        max: number;
      }>(`rateLimit.${configKey}`);

      if (config) {
        this.limiters.set(
          rule.pattern.source,
          rateLimit({
            windowMs: config.windowMs,
            max: config.max,
            keyGenerator: (req: Request) => {
              const user = req['user'] as { sub?: string } | undefined;
              if (user?.sub) {
                return user.sub;
              }
              return ipKeyGenerator(req.ip || 'unknown');
            },
            handler: (req: Request, res: Response) => {
              const requestId = req['id'] || 'no-req-id';
              const service = getRequestTargetService(req);
              this.logger.warn(
                `[${requestId}] [${service}] rate limit exceeded for ${req.method} ${req.originalUrl}`,
              );
              res.status(429).json({
                success: false,
                error:
                  'Too many requests from this IP, please try again later.',
              });
            },
            message: {
              success: false,
              error: 'Too many requests from this IP, please try again later.',
            },
          }),
        );
      }
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    const path = req.path;

    for (const [pattern, limiter] of this.limiters.entries()) {
      if (new RegExp(pattern).test(path)) {
        return limiter(req, res, next);
      }
    }

    next();
  }
}
