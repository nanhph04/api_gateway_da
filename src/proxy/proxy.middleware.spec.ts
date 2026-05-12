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
    walletServiceUrl: '',
    paymentServiceUrl: '',
    processingServiceUrl: '',
    internalGatewaySecret: 'gateway-secret',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rewrites public auth routes to the identity-service prefix', async () => {
    new ProxyMiddleware(serviceConfig as never);

    const authProxyOptions = (proxy as jest.Mock).mock.calls[0][1];

    await expect(
      authProxyOptions.proxyReqPathResolver({ originalUrl: '/api/auth/login' }),
    ).resolves.toBe('/api/identity/auth/login');

    await expect(
      authProxyOptions.proxyReqPathResolver({
        originalUrl: '/api/auth/refresh',
      }),
    ).resolves.toBe('/api/identity/auth/refresh');
  });

  it('preserves auth set-cookie headers and rewrites internal identity cookie paths', () => {
    new ProxyMiddleware(serviceConfig as never);

    const authProxyOptions = (proxy as jest.Mock).mock.calls[0][1];
    const headers = authProxyOptions.userResHeaderDecorator(
      {
        'set-cookie': [
          'refresh_token=token; Path=/api/identity/auth; HttpOnly; SameSite=Strict',
        ],
      },
      { originalUrl: '/api/auth/login' },
    );

    expect(headers['set-cookie']).toEqual([
      'refresh_token=token; Path=/api/auth; HttpOnly; SameSite=Strict',
    ]);
  });

  it('leaves non-auth set-cookie paths unchanged', () => {
    new ProxyMiddleware(serviceConfig as never);

    const userProxyOptions = (proxy as jest.Mock).mock.calls[1][1];
    const headers = userProxyOptions.userResHeaderDecorator(
      {
        'set-cookie': [
          'refresh_token=token; Path=/api/identity/auth; HttpOnly; SameSite=Strict',
        ],
      },
      { originalUrl: '/api/user/users/profile' },
    );

    expect(headers['set-cookie']).toEqual([
      'refresh_token=token; Path=/api/identity/auth; HttpOnly; SameSite=Strict',
    ]);
  });

  it('rewrites user routes to the identity-service prefix', async () => {
    new ProxyMiddleware(serviceConfig as never);

    const userProxyOptions = (proxy as jest.Mock).mock.calls[1][1];

    await expect(
      userProxyOptions.proxyReqPathResolver({
        originalUrl: '/api/user/users/profile',
      }),
    ).resolves.toBe('/api/identity/user/users/profile');
  });

  it('leaves non-identity service paths unchanged', async () => {
    new ProxyMiddleware(serviceConfig as never);

    const mediaProxyOptions = (proxy as jest.Mock).mock.calls[2][1];

    await expect(
      mediaProxyOptions.proxyReqPathResolver({
        originalUrl: '/api/media/videos/discovery/latest',
      }),
    ).resolves.toBe('/api/media/videos/discovery/latest');
  });

  it('rewrites finance routes to the finance-service api prefix', async () => {
    new ProxyMiddleware(serviceConfig as never);

    const financeProxyOptions = (proxy as jest.Mock).mock.calls[3][1];

    await expect(
      financeProxyOptions.proxyReqPathResolver({
        originalUrl: '/api/finance/wallets/me',
      }),
    ).resolves.toBe('/api/wallets/me');

    await expect(
      financeProxyOptions.proxyReqPathResolver({
        originalUrl: '/api/finance/payments',
      }),
    ).resolves.toBe('/api/payments');
  });

  it('forwards direct finance resource routes to finance-service without rewriting', async () => {
    new ProxyMiddleware(serviceConfig as never);

    const depositsProxyOptions = (proxy as jest.Mock).mock.calls[4][1];
    const walletsProxyOptions = (proxy as jest.Mock).mock.calls[5][1];

    await expect(
      depositsProxyOptions.proxyReqPathResolver({
        originalUrl: '/api/deposits/packages',
      }),
    ).resolves.toBe('/api/deposits/packages');

    await expect(
      walletsProxyOptions.proxyReqPathResolver({
        originalUrl: '/api/wallets/me',
      }),
    ).resolves.toBe('/api/wallets/me');
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
