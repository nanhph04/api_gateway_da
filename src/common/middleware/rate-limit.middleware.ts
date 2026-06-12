import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
  getRequestTargetService,
  ROUTE_MANIFEST,
} from '../utils/service-routing.util';
import { buildApiError } from '../utils/api-error.util';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private static readonly LIMITER_KEY_SEPARATOR = '\u0000';

  private readonly logger = new Logger(RateLimitMiddleware.name);
  private limiters: Map<string, ReturnType<typeof rateLimit>> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initLimiters();
  }

  private initLimiters() {
    const rateLimitConfigs = {
      identityService: 'userService',
      identitySessionProfile: 'identitySessionProfile',
      mediaService: 'mediaService',
      mediaPlayback: 'mediaPlayback',
      mediaProgress: 'mediaProgress',
      mediaStreamManifest: 'mediaStreamManifest',
      mediaStreamSegment: 'mediaStreamSegment',
      financeService: 'financeService',
      walletService: 'walletService',
      paymentService: 'paymentService',
      processingService: 'processingService',
    } as const;

    for (const rule of ROUTE_MANIFEST) {
      const configKey =
        rateLimitConfigs[rule.rateLimitBucket as keyof typeof rateLimitConfigs];
      const config = this.configService.get<{
        windowMs: number;
        max: number;
      }>(`rateLimit.${configKey}`);

      if (config) {
        this.limiters.set(
          `${rule.method}${RateLimitMiddleware.LIMITER_KEY_SEPARATOR}${rule.publicPathPattern.source}`,
          rateLimit({
            windowMs: config.windowMs,
            max: config.max,
            keyGenerator: (req: Request) => {
              const user = req['user'] as { sub?: string } | undefined;
              if (user?.sub) {
                return user.sub;
              }
              const cookieHeader = req.headers.cookie;
              if (
                rule.authPolicy === 'cookieAuth' &&
                typeof cookieHeader === 'string' &&
                cookieHeader
              ) {
                return this.hashRateLimitKey(cookieHeader);
              }
              return ipKeyGenerator(req.ip || 'unknown');
            },
            handler: (req: Request, res: Response) => {
              const requestId = req['id'] || 'no-req-id';
              const service = getRequestTargetService(req);
              this.logger.warn(
                `[${requestId}] [${service}] rate limit exceeded for ${req.method} ${req.originalUrl}`,
              );
              const mess =
                'Too many requests from this IP, please try again later.';
              res.status(429).json(buildApiError(req, 429, mess));
            },
            message: {
              success: false,
              code: 429,
              mess: 'Too many requests from this IP, please try again later.',
              data: null,
              errors: [
                'Too many requests from this IP, please try again later.',
              ],
            },
          }),
        );
      }
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    const method = req.method.toUpperCase();

    for (const [key, limiter] of this.limiters.entries()) {
      const [ruleMethod, pattern] = key.split(
        RateLimitMiddleware.LIMITER_KEY_SEPARATOR,
      );
      if (
        (ruleMethod === 'ALL' || ruleMethod === method) &&
        new RegExp(pattern).test(req.path)
      ) {
        return limiter(req, res, next);
      }
    }

    next();
  }

  private hashRateLimitKey(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
