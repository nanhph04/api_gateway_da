import proxy from 'express-http-proxy';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ProxyMiddleware } from './proxy.middleware';

jest.mock('express-http-proxy', () => jest.fn(() => jest.fn()));
jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: jest.fn(() => jest.fn()),
}));

describe('ProxyMiddleware', () => {
  const serviceConfig = {
    identityServiceUrl: 'http://identity-service',
    mediaServiceUrl: 'http://media-service',
    financeServiceUrl: 'http://finance-service',
    internalGatewaySecret: 'gateway-secret',
    getServiceUrlByKey: jest.fn((serviceKey: string) => {
      const urls: Record<string, string> = {
        identityService: 'http://identity-service',
        mediaService: 'http://media-service',
        financeService: 'http://finance-service',
      };
      return urls[serviceKey];
    }),
    getInternalGatewaySecretByServiceKey: jest.fn((serviceKey: string) => {
      const secrets: Record<string, string> = {
        identityService: 'identity-secret',
        mediaService: 'media-secret',
        financeService: 'finance-secret',
      };
      return secrets[serviceKey];
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getProxyOptions = (target: string, callIndex = 0): any => {
    const calls = (proxy as jest.Mock).mock.calls.filter(
      ([callTarget]) => callTarget === target,
    );
    return calls[callIndex][1];
  };

  it('rewrites auth routes to the identity-service prefix', async () => {
    new ProxyMiddleware(serviceConfig as never);

    const authProxyOptions = getProxyOptions('http://identity-service');

    await expect(
      authProxyOptions.proxyReqPathResolver({
        method: 'POST',
        originalUrl: '/api/auth/login',
      }),
    ).resolves.toBe('/api/identity/auth/login');

    await expect(
      authProxyOptions.proxyReqPathResolver({
        method: 'POST',
        originalUrl: '/api/auth/refresh?source=web',
      }),
    ).resolves.toBe('/api/identity/auth/refresh?source=web');
  });

  it('preserves multiple auth set-cookie headers and rewrites internal identity cookie paths', () => {
    new ProxyMiddleware(serviceConfig as never);

    const authProxyOptions = getProxyOptions('http://identity-service');
    const headers = authProxyOptions.userResHeaderDecorator(
      {
        'set-cookie': [
          'refresh_token=token; Path=/api/identity/auth; HttpOnly; SameSite=Strict',
          'other=value; Path=/api/identity/auth; HttpOnly',
        ],
      },
      {
        method: 'POST',
        originalUrl: '/api/auth/login',
      },
    );

    expect(headers['set-cookie']).toEqual([
      'refresh_token=token; Path=/; HttpOnly; SameSite=Strict',
      'other=value; Path=/; HttpOnly',
    ]);
  });

  it('rewrites identity clear-cookie paths for logout responses', () => {
    new ProxyMiddleware(serviceConfig as never);

    const authProxyOptions = getProxyOptions('http://identity-service');
    const headers = authProxyOptions.userResHeaderDecorator(
      {
        'set-cookie':
          'refresh_token=; Path=/api/identity/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      },
      {
        method: 'POST',
        originalUrl: '/api/auth/logout',
      },
    );

    expect(headers['set-cookie']).toBe(
      'refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    );
  });

  it('leaves non-identity set-cookie paths unchanged', () => {
    new ProxyMiddleware(serviceConfig as never);

    const mediaProxyOptions = getProxyOptions('http://media-service');
    const headers = mediaProxyOptions.userResHeaderDecorator(
      {
        'set-cookie': [
          'refresh_token=token; Path=/api/identity/auth; HttpOnly; SameSite=Strict',
        ],
      },
      {
        method: 'GET',
        originalUrl: '/api/media/categories',
      },
    );

    expect(headers['set-cookie']).toEqual([
      'refresh_token=token; Path=/api/identity/auth; HttpOnly; SameSite=Strict',
    ]);
  });

  it('rewrites user routes to the identity-service prefix', async () => {
    new ProxyMiddleware(serviceConfig as never);

    const userProxyOptions = getProxyOptions('http://identity-service');

    await expect(
      userProxyOptions.proxyReqPathResolver({
        method: 'GET',
        originalUrl: '/api/user/users/profile',
      }),
    ).resolves.toBe('/api/identity/user/users/profile');
  });

  it('leaves media service paths unchanged', async () => {
    new ProxyMiddleware(serviceConfig as never);

    const mediaProxyOptions = getProxyOptions('http://media-service');

    await expect(
      mediaProxyOptions.proxyReqPathResolver({
        method: 'GET',
        originalUrl: '/api/media/videos/latest?limit=10',
      }),
    ).resolves.toBe('/api/media/videos/latest?limit=10');
  });

  it('raises the media proxy body limit for channel image uploads', () => {
    new ProxyMiddleware(serviceConfig as never);

    const mediaProxyOptions = getProxyOptions('http://media-service');

    expect(mediaProxyOptions.limit).toBe('12mb');
  });

  it('rewrites namespaced finance routes to the finance-service api prefix', async () => {
    new ProxyMiddleware(serviceConfig as never);

    const financeProxyOptions = getProxyOptions('http://finance-service');

    await expect(
      financeProxyOptions.proxyReqPathResolver({
        method: 'GET',
        originalUrl: '/api/finance/wallets/me',
      }),
    ).resolves.toBe('/api/wallets/me');

    await expect(
      financeProxyOptions.proxyReqPathResolver({
        method: 'GET',
        originalUrl: '/api/finance/deposits/admin/packages?all=true',
      }),
    ).resolves.toBe('/api/deposits/admin/packages?all=true');

    await expect(
      financeProxyOptions.proxyReqPathResolver({
        method: 'GET',
        originalUrl:
          '/api/finance/admin/dashboard/overview?startDate=2026-05-01',
      }),
    ).resolves.toBe('/api/admin/dashboard/overview?startDate=2026-05-01');

    await expect(
      financeProxyOptions.proxyReqPathResolver({
        method: 'GET',
        originalUrl: '/api/finance/health',
      }),
    ).resolves.toBe('/api/health');
  });

  it('forwards legacy finance resource routes without rewriting', async () => {
    new ProxyMiddleware(serviceConfig as never);

    const financeProxyOptions = getProxyOptions('http://finance-service');

    await expect(
      financeProxyOptions.proxyReqPathResolver({
        method: 'GET',
        originalUrl: '/api/deposits/packages',
      }),
    ).resolves.toBe('/api/deposits/packages');

    await expect(
      financeProxyOptions.proxyReqPathResolver({
        method: 'GET',
        originalUrl: '/api/wallets/me',
      }),
    ).resolves.toBe('/api/wallets/me');
  });

  it('strips spoofable headers case-insensitively and sets gateway headers', () => {
    new ProxyMiddleware(serviceConfig as never);

    const mediaProxyOptions = getProxyOptions('http://media-service');
    const result = mediaProxyOptions.proxyReqOptDecorator(
      {
        headers: {
          'X-User-Id': 'spoofed-user',
          'x-USER-email': 'spoofed-email',
          'X-User-Role': 'spoofed-role',
          'X-Internal-Secret': 'spoofed-secret',
          'X-Request-Id': 'spoofed-request',
        },
      },
      {
        method: 'GET',
        originalUrl: '/api/media/studio/videos',
        id: 'request-1',
        user: {
          sub: 'user-1',
          email: 'user@example.com',
          role: 'admin',
        },
      },
    );

    expect(result.headers).toEqual({
      'x-request-id': 'request-1',
      'x-internal-secret': 'media-secret',
      'x-user-id': 'user-1',
      'x-user-email': 'user@example.com',
      'x-user-role': 'admin',
    });
  });

  it('sets service-specific internal secret for public routes that require downstream guard', () => {
    new ProxyMiddleware(serviceConfig as never);

    const mediaProxyOptions = getProxyOptions('http://media-service');
    const result = mediaProxyOptions.proxyReqOptDecorator(
      { headers: {} },
      {
        method: 'GET',
        originalUrl: '/api/media/channels/channel-1/membership-tiers',
        id: 'request-1',
      },
    );

    expect(result.headers['x-internal-secret']).toBe('media-secret');
    expect(result.headers['x-user-id']).toBeUndefined();
  });

  it('preserves raw body for webhook routes', () => {
    new ProxyMiddleware(serviceConfig as never);

    const webhookProxyOptions = getProxyOptions('http://finance-service', 1);
    const rawBody = Buffer.from('{"signature":"abc","data":{"id":1}}');

    const result = webhookProxyOptions.proxyReqBodyDecorator(
      { parsed: true },
      {
        method: 'POST',
        originalUrl: '/api/finance/deposits/webhooks/payos',
        rawBody,
      },
    );

    expect(result).toBe(rawBody);
  });

  it('creates a dedicated SSE proxy for media progress streams', () => {
    new ProxyMiddleware(serviceConfig as never);

    expect(createProxyMiddleware).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'http://media-service',
        changeOrigin: true,
      }),
    );
  });
});
