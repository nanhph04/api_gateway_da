import proxy from 'express-http-proxy';
import { ProxyMiddleware } from './proxy.middleware';

jest.mock('express-http-proxy', () => jest.fn(() => jest.fn()));

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
});
