import {
  Injectable,
  Logger,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { getRequestTargetService } from '../utils/service-routing.util';

interface PublicRouteRule {
  method: string;
  pattern: RegExp;
}

interface AuthenticatedRequest extends Request {
  id?: string;
  user?: string | jwt.JwtPayload;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  private readonly publicRoutes = new Set<string>([
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/verify-email',
    '/api/auth/resend-otp',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/refresh',
  ]);

  private readonly publicMediaRoutes: PublicRouteRule[] = [
    {
      method: 'GET',
      pattern: /^\/api\/media\/channels\/[^/]+$/,
    },
    {
      method: 'GET',
      pattern: /^\/api\/media\/videos\/discovery\/latest$/,
    },
    {
      method: 'GET',
      pattern: /^\/api\/media\/videos\/discovery\/by-category$/,
    },
    {
      method: 'GET',
      pattern: /^\/api\/media\/stream\/[^/]+\/master\.m3u8$/,
    },
    {
      method: 'GET',
      pattern: /^\/api\/media\/stream\/[^/]+\/segments\/[^/]+$/,
    },
  ];

  use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const path = req.path;
    const requestId = req.id || 'n/a';
    const service = getRequestTargetService(req);

    if (
      this.publicRoutes.has(path) ||
      this.isPublicMediaRoute(req.method, path)
    ) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn(
        `[${requestId}] [${service}] ${req.method} ${path} rejected: missing or invalid Authorization header`,
      );
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      this.logger.warn(
        `[${requestId}] [${service}] ${req.method} ${path} rejected: empty bearer token`,
      );
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    try {
      const secret =
        process.env.ACCESS_TOKEN_SECRET ||
        process.env.JWT_SECRET ||
        'dev-access-secret';

      const decoded = jwt.verify(token, secret);

      req.user = decoded;
      next();
    } catch (error) {
      this.logger.warn(
        `[${requestId}] [${service}] ${req.method} ${path} JWT verification failed: ${this.getJwtErrorSummary(error)}, ${this.getTokenSummary(token)}`,
      );
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private isPublicMediaRoute(method: string, path: string): boolean {
    return this.publicMediaRoutes.some(
      (route) => route.method === method && route.pattern.test(path),
    );
  }

  private getTokenSummary(token: string): string {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      return 'token=unreadable';
    }

    const payload =
      decoded.payload && typeof decoded.payload === 'object'
        ? decoded.payload
        : undefined;

    const exp = payload?.exp
      ? new Date(payload.exp * 1000).toISOString()
      : 'none';
    const iat = payload?.iat
      ? new Date(payload.iat * 1000).toISOString()
      : 'none';

    return [
      `alg=${decoded.header.alg || 'none'}`,
      `sub=${payload?.sub || 'none'}`,
      `email=${payload?.email || 'none'}`,
      `role=${payload?.role || 'none'}`,
      `iat=${iat}`,
      `exp=${exp}`,
    ].join(', ');
  }

  private getJwtErrorSummary(error: unknown): string {
    if (error instanceof jwt.TokenExpiredError) {
      return `TokenExpiredError expiredAt=${error.expiredAt.toISOString()}`;
    }

    if (error instanceof jwt.NotBeforeError) {
      return `NotBeforeError date=${error.date.toISOString()}`;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return `JsonWebTokenError message="${error.message}"`;
    }

    if (error instanceof Error) {
      return `${error.name} message="${error.message}"`;
    }

    return 'UnknownError';
  }
}
