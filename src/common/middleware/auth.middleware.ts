import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

interface PublicRouteRule {
  method: string;
  pattern: RegExp;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
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

  use(req: Request, res: Response, next: NextFunction) {
    const path = req.path;

    if (this.publicRoutes.has(path) || this.isPublicMediaRoute(req.method, path)) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.split(' ')[1];
    try {
      const secret =
        process.env.ACCESS_TOKEN_SECRET ||
        process.env.JWT_SECRET ||
        'dev-access-secret';
      const decoded = jwt.verify(token, secret);

      req['user'] = decoded;
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private isPublicMediaRoute(method: string, path: string): boolean {
    return this.publicMediaRoutes.some(
      (route) => route.method === method && route.pattern.test(path),
    );
  }
}
