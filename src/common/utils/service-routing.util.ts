import { Request } from 'express';

export interface ServiceRouteRule {
  serviceKey: string;
  serviceName: string;
  pattern: RegExp;
  targetPathPrefix?: string;
}

export const SERVICE_ROUTE_RULES: ServiceRouteRule[] = [
  {
    serviceKey: 'identityService',
    serviceName: 'identity',
    pattern: /^\/api\/auth/,
    targetPathPrefix: '/api/identity/auth',
  },
  {
    serviceKey: 'identityService',
    serviceName: 'identity',
    pattern: /^\/api\/user/,
    targetPathPrefix: '/api/identity/user',
  },
  {
    serviceKey: 'mediaService',
    serviceName: 'media',
    pattern: /^\/api\/media/,
  },
  {
    serviceKey: 'financeService',
    serviceName: 'finance',
    pattern: /^\/api\/finance/,
    targetPathPrefix: '/api',
  },
  {
    serviceKey: 'walletService',
    serviceName: 'wallet',
    pattern: /^\/api\/wallet/,
  },
  {
    serviceKey: 'paymentService',
    serviceName: 'payment',
    pattern: /^\/api\/payment/,
  },
  {
    serviceKey: 'processingService',
    serviceName: 'processing',
    pattern: /^\/api\/process/,
  },
];

type RequestWithContext = Request & {
  id?: string;
  targetService?: string;
};

export function resolveServiceRule(path: string): ServiceRouteRule | undefined {
  return SERVICE_ROUTE_RULES.find((rule) => rule.pattern.test(path));
}

export function resolveServiceName(path: string): string {
  return resolveServiceRule(path)?.serviceName || 'unknown';
}

export function resolveProxyPath(originalUrl: string): string {
  const rule = resolveServiceRule(originalUrl);
  if (!rule?.targetPathPrefix) {
    return originalUrl;
  }

  return originalUrl.replace(rule.pattern, rule.targetPathPrefix);
}

export function setRequestTargetService(request: RequestWithContext): string {
  const serviceName = resolveServiceName(request.originalUrl || request.url);
  request.targetService = serviceName;
  return serviceName;
}

export function getRequestTargetService(request: RequestWithContext): string {
  return request.targetService || setRequestTargetService(request);
}
