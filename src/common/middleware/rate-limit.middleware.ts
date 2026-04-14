import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private limiters: Map<string, ReturnType<typeof rateLimit>> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initLimiters();
  }

  private initLimiters() {
    const rateLimitConfigs = {
      '^/api/auth': 'userService',
      '^/api/users': 'userService',
      '^/api/media': 'mediaService',
      '^/api/wallet': 'walletService',
      '^/api/payment': 'paymentService',
      '^/api/process': 'processingService',
    };

    for (const [pattern, configKey] of Object.entries(rateLimitConfigs)) {
      const config = this.configService.get<{
        windowMs: number;
        max: number;
      }>(`rateLimit.${configKey}`);

      if (config) {
        this.limiters.set(
          pattern,
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
