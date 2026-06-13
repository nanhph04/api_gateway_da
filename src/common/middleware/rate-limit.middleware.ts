import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
  getRequestTargetService,
  ROUTE_MANIFEST,
} from '../utils/service-routing.util';
import { buildApiError, redactSensitiveUrl } from '../utils/api-error.util';

type PlaybackTokenPayload = {
  videoId?: unknown;
  userId?: unknown;
  scope?: unknown;
  exp?: unknown;
};

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
              if (this.isMediaStreamBucket(rule.rateLimitBucket)) {
                return this.getMediaStreamRateLimitKey(req);
              }

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
                `[${requestId}] [${service}] rate limit exceeded for ${req.method} ${redactSensitiveUrl(req.originalUrl)}`,
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

  private isMediaStreamBucket(bucket: string): boolean {
    return bucket === 'mediaStreamManifest' || bucket === 'mediaStreamSegment';
  }

  private getMediaStreamRateLimitKey(req: Request): string {
    const token = this.getPlaybackTokenFromRequest(req);
    const payload = token ? this.verifyPlaybackToken(token) : null;

    if (payload) {
      return `stream:${payload.userId}:${payload.videoId}`;
    }

    return `stream-invalid:${ipKeyGenerator(req.ip || 'unknown')}`;
  }

  private getPlaybackTokenFromRequest(req: Request): string | null {
    const token = req.query.token;

    if (typeof token === 'string' && token.trim()) {
      return token;
    }

    if (Array.isArray(token) && typeof token[0] === 'string' && token[0]) {
      return token[0];
    }

    return null;
  }

  private verifyPlaybackToken(token: string): {
    userId: string;
    videoId: string;
  } | null {
    const [encodedPayload, signature] = token.split('.');

    if (!encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = this.signPlaybackTokenPayload(encodedPayload);
    const signatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedSignatureBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
    ) {
      return null;
    }

    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as PlaybackTokenPayload;

      if (
        typeof payload.userId !== 'string' ||
        typeof payload.videoId !== 'string' ||
        payload.scope !== 'stream' ||
        typeof payload.exp !== 'number' ||
        payload.exp < Math.floor(Date.now() / 1000)
      ) {
        return null;
      }

      return {
        userId: payload.userId,
        videoId: payload.videoId,
      };
    } catch {
      return null;
    }
  }

  private signPlaybackTokenPayload(encodedPayload: string): string {
    return createHmac(
      'sha256',
      this.configService.get<string>(
        'PLAYBACK_TOKEN_SECRET',
        this.configService.get<string>(
          'ACCESS_TOKEN_SECRET',
          'change-me-in-production',
        ),
      ),
    )
      .update(encodedPayload)
      .digest('base64url');
  }

  private hashRateLimitKey(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
