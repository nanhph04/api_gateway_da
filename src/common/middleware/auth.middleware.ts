import {
  Injectable,
  Logger,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import {
  getRequestRouteManifestEntry,
  getRequestTargetService,
} from '../utils/service-routing.util';

interface AuthenticatedRequest extends Request {
  id?: string;
  user?: jwt.JwtPayload;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  use(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
    const entry = getRequestRouteManifestEntry(req);
    const path = req.path;
    const requestId = req.id || 'n/a';
    const service = getRequestTargetService(req);
    const authPolicy = entry?.authPolicy ?? 'protected';

    if (
      authPolicy === 'public' ||
      authPolicy === 'cookieAuth' ||
      authPolicy === 'webhook'
    ) {
      next();
      return;
    }

    const token = this.getBearerToken(req, authPolicy);
    if (!token) {
      if (authPolicy === 'optional') {
        next();
        return;
      }

      this.logRejectedRequest(
        requestId,
        service,
        req.method,
        path,
        'missing Authorization header',
      );
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    try {
      req.user = this.verifyAccessToken(token);
      next();
    } catch (error) {
      this.logger.warn(
        `[${requestId}] [${service}] ${req.method} ${path} JWT verification failed: ${this.getJwtErrorSummary(error)}, ${this.getTokenSummary(token)}`,
      );
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private getBearerToken(
    req: AuthenticatedRequest,
    authPolicy: string,
  ): string | undefined {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      if (!authHeader.startsWith('Bearer ')) {
        return undefined;
      }

      const token = authHeader.split(' ')[1];
      return token || undefined;
    }

    if (!this.canUseQueryAccessToken(req, authPolicy)) {
      return undefined;
    }

    const accessToken = req.query?.access_token;
    return typeof accessToken === 'string' && accessToken
      ? accessToken
      : undefined;
  }

  private canUseQueryAccessToken(
    req: AuthenticatedRequest,
    authPolicy: string,
  ): boolean {
    if (authPolicy !== 'protected' || req.method.toUpperCase() !== 'GET') {
      return false;
    }

    const entry = getRequestRouteManifestEntry(req);
    return entry?.streamMode === 'sse';
  }

  private verifyAccessToken(token: string): jwt.JwtPayload {
    const secret =
      process.env.ACCESS_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      'dev-access-secret';

    const decoded = jwt.verify(token, secret);
    if (!decoded || typeof decoded === 'string') {
      throw new jwt.JsonWebTokenError('JWT payload must be an object');
    }

    return decoded;
  }

  private logRejectedRequest(
    requestId: string,
    service: string,
    method: string,
    path: string,
    reason: string,
  ): void {
    this.logger.warn(
      `[${requestId}] [${service}] ${method} ${path} rejected: ${reason}`,
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
