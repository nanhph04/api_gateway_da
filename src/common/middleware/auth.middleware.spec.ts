import { UnauthorizedException } from '@nestjs/common';
import { AuthMiddleware } from './auth.middleware';

describe('AuthMiddleware', () => {
  let middleware: AuthMiddleware;
  let next: jest.Mock;

  beforeEach(() => {
    middleware = new AuthMiddleware();
    next = jest.fn();
  });

  it('allows media categories to be fetched without authorization', () => {
    middleware.use(
      {
        method: 'GET',
        path: '/api/media/categories',
        headers: {},
      } as any,
      {} as any,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows auth session profile to be handled by the identity service session cookie flow', () => {
    middleware.use(
      {
        method: 'GET',
        path: '/api/auth/session/profile',
        headers: {},
      } as any,
      {} as any,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects protected API routes without authorization', () => {
    expect(() =>
      middleware.use(
        {
          method: 'GET',
          path: '/api/media/videos',
          headers: {},
        } as any,
        {} as any,
        next,
      ),
    ).toThrow(UnauthorizedException);

    expect(next).not.toHaveBeenCalled();
  });
});
