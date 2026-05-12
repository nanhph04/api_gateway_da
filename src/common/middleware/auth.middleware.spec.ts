import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthMiddleware } from './auth.middleware';

describe('AuthMiddleware', () => {
  let middleware: AuthMiddleware;
  let next: jest.Mock;

  beforeEach(() => {
    process.env.ACCESS_TOKEN_SECRET = 'test-secret';
    middleware = new AuthMiddleware();
    next = jest.fn();
  });

  const buildRequest = (
    method: string,
    path: string,
    authorization?: string,
  ): any => ({
    method,
    path,
    originalUrl: path,
    headers: authorization ? { authorization } : {},
  });

  const signToken = (): string =>
    jwt.sign(
      {
        sub: 'user-1',
        email: 'user@example.com',
        role: 'user',
      },
      'test-secret',
    );

  it('allows public routes without authorization', () => {
    middleware.use(
      buildRequest('GET', '/api/media/categories'),
      {} as any,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows cookie auth routes without bearer verification', () => {
    middleware.use(
      buildRequest('GET', '/api/auth/session/profile'),
      {} as any,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows webhook routes without bearer verification', () => {
    middleware.use(
      buildRequest('POST', '/api/finance/deposits/webhooks/payos'),
      {} as any,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('supports optional auth without a token', () => {
    middleware.use(
      buildRequest('GET', '/api/media/channels/channel-1'),
      {} as any,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets user context for optional auth with a valid token', () => {
    const req = buildRequest(
      'GET',
      '/api/media/channels/channel-1',
      `Bearer ${signToken()}`,
    );

    middleware.use(req, {} as any, next);

    expect(req.user).toEqual(
      expect.objectContaining({
        sub: 'user-1',
        email: 'user@example.com',
        role: 'user',
      }),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects optional auth with an invalid token', () => {
    expect(() =>
      middleware.use(
        buildRequest(
          'GET',
          '/api/media/channels/channel-1',
          'Bearer invalid-token',
        ),
        {} as any,
        next,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects protected API routes without authorization', () => {
    expect(() =>
      middleware.use(
        buildRequest('GET', '/api/media/videos/me'),
        {} as any,
        next,
      ),
    ).toThrow(UnauthorizedException);

    expect(next).not.toHaveBeenCalled();
  });
});
