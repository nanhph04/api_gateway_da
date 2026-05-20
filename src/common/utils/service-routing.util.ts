import type { Request } from 'express';

export type ServiceKey = 'identityService' | 'mediaService' | 'financeService';

export type AuthPolicy =
  | 'public'
  | 'optional'
  | 'protected'
  | 'cookieAuth'
  | 'webhook';

export type StreamMode = 'sse';

export interface RouteManifestEntry {
  method: string;
  serviceKey: ServiceKey;
  serviceName: string;
  publicPathPattern: RegExp;
  publicPathPrefix?: string;
  targetPathPrefix?: string;
  authPolicy: AuthPolicy;
  requiresInternalSecret: boolean;
  rateLimitBucket: string;
  streamMode?: StreamMode;
  deprecated?: boolean;
}

type RequestWithContext = Request & {
  id?: string;
  targetService?: string;
  routeManifestEntry?: RouteManifestEntry;
};

const ALL_METHODS = 'ALL';

const identityRoute = (
  method: string,
  publicPathPattern: RegExp,
  authPolicy: AuthPolicy,
  options: Partial<Pick<RouteManifestEntry, 'streamMode'>> = {},
): RouteManifestEntry => ({
  method,
  serviceKey: 'identityService',
  serviceName: 'identity',
  publicPathPattern,
  publicPathPrefix: publicPathPattern.source.includes('\\/api\\/auth')
    ? '/api/auth'
    : '/api/user',
  targetPathPrefix: publicPathPattern.source.includes('\\/api\\/auth')
    ? '/api/identity/auth'
    : '/api/identity/user',
  authPolicy,
  requiresInternalSecret: false,
  rateLimitBucket: 'identityService',
  streamMode: options.streamMode,
});

const mediaRoute = (
  method: string,
  publicPathPattern: RegExp,
  authPolicy: AuthPolicy,
  options: Partial<
    Pick<RouteManifestEntry, 'requiresInternalSecret' | 'streamMode'>
  > = {},
): RouteManifestEntry => ({
  method,
  serviceKey: 'mediaService',
  serviceName: 'media',
  publicPathPattern,
  authPolicy,
  requiresInternalSecret: options.requiresInternalSecret ?? true,
  rateLimitBucket: 'mediaService',
  streamMode: options.streamMode,
});

const financeRoute = (
  method: string,
  publicPathPattern: RegExp,
  authPolicy: AuthPolicy,
  options: Partial<Pick<RouteManifestEntry, 'deprecated'>> = {},
): RouteManifestEntry => ({
  method,
  serviceKey: 'financeService',
  serviceName: 'finance',
  publicPathPattern,
  publicPathPrefix: publicPathPattern.source.includes('\\/api\\/finance')
    ? '/api/finance'
    : undefined,
  targetPathPrefix: publicPathPattern.source.includes('\\/api\\/finance')
    ? '/api'
    : undefined,
  authPolicy,
  requiresInternalSecret: authPolicy !== 'webhook',
  rateLimitBucket: 'financeService',
  deprecated: options.deprecated,
});

export const ROUTE_MANIFEST: RouteManifestEntry[] = [
  identityRoute('POST', /^\/api\/auth\/register\/?$/, 'public'),
  identityRoute('POST', /^\/api\/auth\/login\/?$/, 'public'),
  identityRoute('POST', /^\/api\/auth\/verify-email\/?$/, 'public'),
  identityRoute('POST', /^\/api\/auth\/resend-otp\/?$/, 'public'),
  identityRoute('POST', /^\/api\/auth\/forgot-password\/?$/, 'public'),
  identityRoute('POST', /^\/api\/auth\/reset-password\/?$/, 'public'),
  identityRoute('POST', /^\/api\/auth\/refresh\/?$/, 'cookieAuth'),
  identityRoute('GET', /^\/api\/auth\/session\/profile\/?$/, 'cookieAuth'),
  identityRoute('GET', /^\/api\/auth\/session\/events\/?$/, 'protected', {
    streamMode: 'sse',
  }),
  identityRoute('POST', /^\/api\/auth\/change-password\/?$/, 'protected'),
  identityRoute('POST', /^\/api\/auth\/logout\/?$/, 'protected'),
  identityRoute('GET', /^\/api\/user\/users\/profile\/?$/, 'protected'),
  identityRoute(
    'POST',
    /^\/api\/user\/users\/profile\/avatar\/upload-url\/?$/,
    'protected',
  ),
  identityRoute(
    'POST',
    /^\/api\/user\/users\/profile\/avatar\/complete\/?$/,
    'protected',
  ),
  identityRoute('PATCH', /^\/api\/user\/users\/profile\/?$/, 'protected'),
  identityRoute(
    'GET',
    /^\/api\/identity\/user\/admin\/users\/summary\/?$/,
    'protected',
  ),
  identityRoute('GET', /^\/api\/user\/admin\/users\/summary\/?$/, 'protected'),
  identityRoute('GET', /^\/api\/user\/admin\/users\/?$/, 'protected'),
  identityRoute('GET', /^\/api\/user\/admin\/users\/[^/]+\/?$/, 'protected'),
  identityRoute(
    'PATCH',
    /^\/api\/user\/admin\/users\/[^/]+\/status\/?$/,
    'protected',
  ),

  mediaRoute('GET', /^\/api\/media\/?$/, 'public', {
    requiresInternalSecret: false,
  }),
  mediaRoute('GET', /^\/api\/media\/categories\/?$/, 'public', {
    requiresInternalSecret: false,
  }),
  mediaRoute('GET', /^\/api\/media\/categories\/[^/]+\/videos\/?$/, 'public', {
    requiresInternalSecret: false,
  }),
  mediaRoute('GET', /^\/api\/media\/tags\/?$/, 'public', {
    requiresInternalSecret: false,
  }),
  mediaRoute('GET', /^\/api\/media\/search\/?$/, 'public', {
    requiresInternalSecret: false,
  }),
  mediaRoute('GET', /^\/api\/media\/me\/channel\/?$/, 'protected'),
  mediaRoute('POST', /^\/api\/media\/me\/channel\/?$/, 'protected'),
  mediaRoute('PATCH', /^\/api\/media\/me\/channel\/?$/, 'protected'),
  mediaRoute('GET', /^\/api\/media\/channels\/[^/]+\/?$/, 'optional', {
    requiresInternalSecret: false,
  }),
  mediaRoute(
    'GET',
    /^\/api\/media\/channels\/[^/]+\/membership-status\/?$/,
    'protected',
  ),
  mediaRoute(
    'POST',
    /^\/api\/media\/channels\/[^/]+\/membership-review-requests\/?$/,
    'protected',
  ),
  mediaRoute(
    'PATCH',
    /^\/api\/media\/admin\/channels\/[^/]+\/membership\/?$/,
    'protected',
  ),
  mediaRoute('GET', /^\/api\/media\/memberships\/me\/?$/, 'protected'),
  mediaRoute(
    'PATCH',
    /^\/api\/media\/memberships\/[^/]+\/auto-renew\/?$/,
    'protected',
  ),
  mediaRoute(
    'GET',
    /^\/api\/media\/channels\/[^/]+\/membership-tiers\/?$/,
    'public',
  ),
  mediaRoute(
    'GET',
    /^\/api\/media\/channels\/[^/]+\/membership-tiers\/[^/]+\/?$/,
    'public',
  ),
  mediaRoute(
    'POST',
    /^\/api\/media\/channels\/[^/]+\/membership-tiers\/?$/,
    'protected',
  ),
  mediaRoute(
    'PATCH',
    /^\/api\/media\/channels\/[^/]+\/membership-tiers\/[^/]+\/?$/,
    'protected',
  ),
  mediaRoute(
    'DELETE',
    /^\/api\/media\/channels\/[^/]+\/membership-tiers\/[^/]+\/?$/,
    'protected',
  ),
  mediaRoute('GET', /^\/api\/media\/studio\/videos\/?$/, 'protected'),
  mediaRoute('GET', /^\/api\/media\/videos\/events\/stream\/?$/, 'protected', {
    streamMode: 'sse',
  }),
  mediaRoute(
    'GET',
    /^\/api\/media\/studio\/videos\/[^/]+\/?$/,
    'protected',
  ),
  mediaRoute(
    'GET',
    /^\/api\/media\/studio\/videos\/[^/]+\/thumbnail\/?$/,
    'protected',
  ),
  mediaRoute('GET', /^\/api\/media\/videos\/?$/, 'public', {
    requiresInternalSecret: false,
  }),
  mediaRoute('POST', /^\/api\/media\/studio\/videos\/uploads\/?$/, 'protected'),
  mediaRoute(
    'POST',
    /^\/api\/media\/studio\/videos\/[^/]+\/uploads\/[^/]+\/part-urls\/?$/,
    'protected',
  ),
  mediaRoute(
    'POST',
    /^\/api\/media\/studio\/videos\/[^/]+\/uploads\/[^/]+\/parts\/[^/]+\/completed\/?$/,
    'protected',
  ),
  mediaRoute(
    'GET',
    /^\/api\/media\/studio\/videos\/[^/]+\/uploads\/[^/]+\/status\/?$/,
    'protected',
  ),
  mediaRoute(
    'POST',
    /^\/api\/media\/studio\/videos\/[^/]+\/uploads\/[^/]+\/complete\/?$/,
    'protected',
  ),
  mediaRoute(
    'POST',
    /^\/api\/media\/studio\/videos\/[^/]+\/uploads\/[^/]+\/submit\/?$/,
    'protected',
  ),
  mediaRoute(
    'DELETE',
    /^\/api\/media\/studio\/videos\/[^/]+\/uploads\/[^/]+\/?$/,
    'protected',
  ),
  mediaRoute(
    'DELETE',
    /^\/api\/media\/studio\/videos\/[^/]+\/failed-upload\/?$/,
    'protected',
  ),
  mediaRoute('DELETE', /^\/api\/media\/studio\/videos\/[^/]+\/?$/, 'protected'),
  mediaRoute('GET', /^\/api\/media\/me\/videos\/[^/]+\/play\/?$/, 'protected'),
  mediaRoute(
    'POST',
    /^\/api\/media\/me\/videos\/[^/]+\/progress\/?$/,
    'protected',
  ),
  mediaRoute(
    'POST',
    /^\/api\/media\/me\/videos\/[^/]+\/playback-token\/refresh\/?$/,
    'protected',
  ),
  mediaRoute('GET', /^\/api\/media\/videos\/[^/]+\/metadata\/?$/, 'public', {
    requiresInternalSecret: false,
  }),
  mediaRoute('GET', /^\/api\/media\/videos\/[^/]+\/thumbnail\/?$/, 'public', {
    requiresInternalSecret: false,
  }),
  mediaRoute(
    'PATCH',
    /^\/api\/media\/studio\/videos\/[^/]+\/metadata\/?$/,
    'protected',
  ),
  mediaRoute('GET', /^\/api\/media\/videos\/latest\/?$/, 'public', {
    requiresInternalSecret: false,
  }),
  mediaRoute('GET', /^\/api\/media\/videos\/by-category\/?$/, 'public', {
    requiresInternalSecret: false,
  }),

  mediaRoute(
    'GET',
    /^\/api\/media\/me\/videos\/subscribed\/?$/,
    'protected',
  ),
  mediaRoute(
    'GET',
    /^\/api\/media\/me\/videos\/purchased\/?$/,
    'protected',
  ),
  mediaRoute(
    'GET',
    /^\/api\/media\/me\/videos\/continue-watching\/?$/,
    'protected',
  ),
  mediaRoute(
    'GET',
    /^\/api\/media\/stream\/[^/]+\/master\.m3u8\/?$/,
    'public',
    {
      requiresInternalSecret: false,
    },
  ),
  mediaRoute(
    'GET',
    /^\/api\/media\/stream\/[^/]+\/segments\/[^/]+\/?$/,
    'public',
    { requiresInternalSecret: false },
  ),
  mediaRoute('GET', /^\/api\/media\/admin\/categories\/?$/, 'protected'),
  mediaRoute('POST', /^\/api\/media\/admin\/categories\/?$/, 'protected'),
  mediaRoute(
    'PATCH',
    /^\/api\/media\/admin\/categories\/[^/]+\/?$/,
    'protected',
  ),
  mediaRoute(
    'DELETE',
    /^\/api\/media\/admin\/categories\/[^/]+\/?$/,
    'protected',
  ),
  mediaRoute('GET', /^\/api\/media\/admin\/tags\/?$/, 'protected'),
  mediaRoute('POST', /^\/api\/media\/admin\/tags\/?$/, 'protected'),
  mediaRoute('PATCH', /^\/api\/media\/admin\/tags\/[^/]+\/?$/, 'protected'),
  mediaRoute('DELETE', /^\/api\/media\/admin\/tags\/[^/]+\/?$/, 'protected'),
  mediaRoute('GET', /^\/api\/media\/admin\/channels\/summary\/?$/, 'protected'),
  mediaRoute('GET', /^\/api\/media\/admin\/channels\/?$/, 'protected'),
  mediaRoute(
    'GET',
    /^\/api\/media\/admin\/channels\/membership-reviews\/?$/,
    'protected',
  ),
  mediaRoute(
    'PATCH',
    /^\/api\/media\/admin\/channels\/[^/]+\/membership-review\/?$/,
    'protected',
  ),
  mediaRoute(
    'PATCH',
    /^\/api\/media\/admin\/channels\/[^/]+\/status\/?$/,
    'protected',
  ),
  mediaRoute('GET', /^\/api\/media\/admin\/videos\/?$/, 'protected'),
  mediaRoute('GET', /^\/api\/media\/admin\/videos\/[^/]+\/?$/, 'protected'),
  mediaRoute(
    'PATCH',
    /^\/api\/media\/admin\/videos\/[^/]+\/moderation\/?$/,
    'protected',
  ),
  mediaRoute('GET', /^\/api\/media\/admin\/reports\/summary\/?$/, 'protected'),
  mediaRoute('GET', /^\/api\/media\/admin\/reports\/?$/, 'protected'),

  financeRoute('GET', /^\/api\/finance\/deposits\/packages\/?$/, 'public'),
  financeRoute(
    'POST',
    /^\/api\/finance\/deposits\/webhooks\/payos\/?$/,
    'webhook',
  ),
  financeRoute(
    'POST',
    /^\/api\/finance\/deposits\/[^/]+\/webhook\/success\/?$/,
    'webhook',
  ),
  financeRoute('ALL', /^\/api\/finance(?:\/.*)?\/?$/, 'protected'),
  financeRoute('ALL', /^\/api\/studio(?:\/.*)?\/?$/, 'protected'),

  financeRoute('GET', /^\/api\/deposits\/packages\/?$/, 'public', {
    deprecated: true,
  }),
  financeRoute('POST', /^\/api\/deposits\/webhooks\/payos\/?$/, 'webhook', {
    deprecated: true,
  }),
  financeRoute(
    'POST',
    /^\/api\/deposits\/[^/]+\/webhook\/success\/?$/,
    'webhook',
    { deprecated: true },
  ),
  financeRoute('ALL', /^\/api\/deposits(?:\/.*)?\/?$/, 'protected', {
    deprecated: true,
  }),
  financeRoute('ALL', /^\/api\/wallets(?:\/.*)?\/?$/, 'protected', {
    deprecated: true,
  }),
  financeRoute('ALL', /^\/api\/payments(?:\/.*)?\/?$/, 'protected', {
    deprecated: true,
  }),
  financeRoute('ALL', /^\/api\/transactions(?:\/.*)?\/?$/, 'protected', {
    deprecated: true,
  }),
  financeRoute('ALL', /^\/api\/withdrawals(?:\/.*)?\/?$/, 'protected', {
    deprecated: true,
  }),
];

export function normalizePath(originalUrl: string): string {
  return originalUrl.split('?')[0] || '/';
}

export function resolveRouteManifestEntry(
  method: string,
  originalUrl: string,
): RouteManifestEntry | undefined {
  const path = normalizePath(originalUrl);
  const normalizedMethod = method.toUpperCase();

  return ROUTE_MANIFEST.find(
    (entry) =>
      (entry.method === ALL_METHODS || entry.method === normalizedMethod) &&
      entry.publicPathPattern.test(path),
  );
}

export function resolveServiceName(
  method: string,
  originalUrl: string,
): string {
  return (
    resolveRouteManifestEntry(method, originalUrl)?.serviceName || 'unknown'
  );
}

export function resolveProxyPath(method: string, originalUrl: string): string {
  const entry = resolveRouteManifestEntry(method, originalUrl);
  if (!entry?.targetPathPrefix || !entry.publicPathPrefix) {
    return originalUrl;
  }

  const queryIndex = originalUrl.indexOf('?');
  const path =
    queryIndex === -1 ? originalUrl : originalUrl.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : originalUrl.slice(queryIndex);

  if (!path.startsWith(entry.publicPathPrefix)) {
    return originalUrl;
  }

  return `${entry.targetPathPrefix}${path.slice(entry.publicPathPrefix.length)}${query}`;
}

export function setRequestRouteManifestEntry(
  request: RequestWithContext,
): RouteManifestEntry | undefined {
  const entry = resolveRouteManifestEntry(
    request.method,
    request.originalUrl || request.url,
  );
  request.routeManifestEntry = entry;
  request.targetService = entry?.serviceName || 'unknown';
  return entry;
}

export function getRequestRouteManifestEntry(
  request: RequestWithContext,
): RouteManifestEntry | undefined {
  return request.routeManifestEntry || setRequestRouteManifestEntry(request);
}

export function setRequestTargetService(request: RequestWithContext): string {
  const serviceName =
    setRequestRouteManifestEntry(request)?.serviceName || 'unknown';
  request.targetService = serviceName;
  return serviceName;
}

export function getRequestTargetService(request: RequestWithContext): string {
  return request.targetService || setRequestTargetService(request);
}
