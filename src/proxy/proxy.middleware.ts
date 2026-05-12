import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import proxy from 'express-http-proxy';
import {
  createProxyMiddleware,
  type RequestHandler,
} from 'http-proxy-middleware';
import { ServiceConfigService } from '../config/service.config';
import { buildApiError } from '../common/utils/api-error.util';
import {
  getRequestRouteManifestEntry,
  getRequestTargetService,
  resolveProxyPath,
  ROUTE_MANIFEST,
  setRequestRouteManifestEntry,
  type RouteManifestEntry,
  type ServiceKey,
} from '../common/utils/service-routing.util';

interface RequestWithGatewayContext extends Request {
  id?: string;
  rawBody?: Buffer;
  user?: {
    sub?: string;
    email?: string;
    role?: string;
  };
}

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ProxyMiddleware.name);
  private readonly proxyMap: Map<string, ReturnType<typeof proxy>> = new Map();
  private readonly mediaSseProxy?: RequestHandler;

  constructor(private readonly serviceConfigService: ServiceConfigService) {
    const proxiedServiceKeys = new Set<ServiceKey>();

    for (const entry of ROUTE_MANIFEST) {
      const target = this.resolveTargetUrl(entry.serviceKey);

      if (target && !entry.streamMode) {
        const proxyKey = this.getProxyKey(entry);
        if (!this.proxyMap.has(proxyKey)) {
          this.proxyMap.set(proxyKey, this.createHttpProxy(target));
        }
      }

      proxiedServiceKeys.add(entry.serviceKey);
    }

    if (
      proxiedServiceKeys.has('mediaService') &&
      this.serviceConfigService.mediaServiceUrl
    ) {
      this.mediaSseProxy = createProxyMiddleware({
        target: this.serviceConfigService.mediaServiceUrl,
        changeOrigin: true,
        proxyTimeout: 0,
        timeout: 0,
        selfHandleResponse: false,
        on: {
          proxyReq: (proxyReq, req) => {
            this.setForwardHeaders(proxyReq, req as RequestWithGatewayContext);
          },
          error: (err, req, res) => {
            this.handleProxyError(err, req as Request, res as Response);
          },
        },
      });
    }
  }

  use(req: RequestWithGatewayContext, res: Response, next: NextFunction): void {
    const entry = setRequestRouteManifestEntry(req);
    if (!entry) {
      next();
      return;
    }

    if (entry.streamMode === 'sse' && this.mediaSseProxy) {
      this.mediaSseProxy(req, res, next);
      return;
    }

    const handler = this.proxyMap.get(this.getProxyKey(entry));
    if (!handler) {
      next();
      return;
    }

    handler(req, res, next);
  }

  private createHttpProxy(target: string): ReturnType<typeof proxy> {
    return proxy(target, {
      proxyReqPathResolver: (req) => {
        return Promise.resolve(resolveProxyPath(req.method, req.originalUrl));
      },
      proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        return this.decorateProxyRequestOptions(
          proxyReqOpts,
          srcReq as RequestWithGatewayContext,
        );
      },
      proxyReqBodyDecorator: (bodyContent, srcReq) => {
        return this.decorateProxyRequestBody(
          bodyContent,
          srcReq as RequestWithGatewayContext,
        );
      },
      userResHeaderDecorator: (headers, userReq) =>
        this.decorateProxyResponseHeaders(
          headers,
          userReq as RequestWithGatewayContext,
        ),
      onError: (err, req, res) => {
        this.handleProxyError(err, req as Request, res);
      },
    });
  }

  private resolveTargetUrl(serviceKey: ServiceKey): string | undefined {
    return this.serviceConfigService.getServiceUrlByKey(serviceKey);
  }

  private getProxyKey(entry: RouteManifestEntry): string {
    return `${entry.serviceKey}:${entry.authPolicy === 'webhook' ? 'webhook' : 'http'}`;
  }

  private decorateProxyRequestOptions(
    proxyReqOpts: {
      headers?: Record<string, string | string[] | undefined>;
    },
    srcReq: RequestWithGatewayContext,
  ): { headers: Record<string, string | string[] | undefined> } {
    const headers = proxyReqOpts.headers || {};
    this.removeSpoofableHeaders(headers);

    this.setForwardedGatewayHeaders(headers, srcReq);
    proxyReqOpts.headers = headers;

    return proxyReqOpts as {
      headers: Record<string, string | string[] | undefined>;
    };
  }

  private decorateProxyRequestBody(
    bodyContent: unknown,
    srcReq: RequestWithGatewayContext,
  ): unknown {
    const entry = getRequestRouteManifestEntry(srcReq);
    if (entry?.authPolicy === 'webhook' && srcReq.rawBody) {
      return srcReq.rawBody;
    }

    return bodyContent;
  }

  private removeSpoofableHeaders(
    headers: Record<string, string | string[] | undefined>,
  ): void {
    const spoofableHeaders = new Set([
      'x-user-id',
      'x-user-email',
      'x-user-role',
      'x-internal-secret',
      'x-request-id',
    ]);

    for (const headerName of Object.keys(headers)) {
      if (spoofableHeaders.has(headerName.toLowerCase())) {
        delete headers[headerName];
      }
    }
  }

  private setForwardedGatewayHeaders(
    headers: Record<string, string | string[] | undefined>,
    srcReq: RequestWithGatewayContext,
  ): void {
    const entry = getRequestRouteManifestEntry(srcReq);
    if (srcReq.id) {
      headers['x-request-id'] = String(srcReq.id);
    }

    if (entry?.requiresInternalSecret) {
      headers['x-internal-secret'] =
        this.serviceConfigService.getInternalGatewaySecretByServiceKey(
          entry.serviceKey,
        );
    }

    const user = srcReq.user;
    if (!user) {
      return;
    }

    if (user.sub) {
      headers['x-user-id'] = user.sub;
    }
    if (user.email) {
      headers['x-user-email'] = user.email;
    }
    if (user.role) {
      headers['x-user-role'] = user.role;
    }
  }

  private decorateProxyResponseHeaders(
    headers: Record<string, string | string[] | undefined>,
    userReq: RequestWithGatewayContext,
  ): Record<string, string | string[] | undefined> {
    const setCookieHeader = headers['set-cookie'];
    const entry = getRequestRouteManifestEntry(userReq);
    if (!setCookieHeader || entry?.serviceKey !== 'identityService') {
      return headers;
    }

    return {
      ...headers,
      'set-cookie': this.rewriteIdentityAuthCookiePath(setCookieHeader),
    };
  }

  private rewriteIdentityAuthCookiePath(
    setCookieHeader: string | string[],
  ): string | string[] {
    if (Array.isArray(setCookieHeader)) {
      return setCookieHeader.map((cookie) =>
        this.rewriteIdentityAuthCookiePathValue(cookie),
      );
    }

    return this.rewriteIdentityAuthCookiePathValue(setCookieHeader);
  }

  private rewriteIdentityAuthCookiePathValue(cookie: string): string {
    return cookie.replace(
      /Path=\/api\/identity\/auth(?=;|$)/i,
      'Path=/api/auth',
    );
  }

  private setForwardHeaders(
    proxyReq: {
      removeHeader(name: string): void;
      setHeader(name: string, value: string): void;
    },
    srcReq: RequestWithGatewayContext,
  ): void {
    for (const header of [
      'x-user-id',
      'x-user-email',
      'x-user-role',
      'x-internal-secret',
      'x-request-id',
    ]) {
      proxyReq.removeHeader(header);
    }

    const headers: Record<string, string | undefined> = {};
    this.setForwardedGatewayHeaders(headers, srcReq);
    for (const [headerName, headerValue] of Object.entries(headers)) {
      if (headerValue) {
        proxyReq.setHeader(headerName, headerValue);
      }
    }
  }

  private handleProxyError(err: Error, req: Request, res: Response): void {
    const requestId = req['id'] || 'no-req-id';
    const service = getRequestTargetService(req);
    this.logger.error(
      `[${requestId}] [${service}] proxy error for ${req.method} ${req.originalUrl}: ${err.message}`,
    );

    if (!res.headersSent) {
      res.status(502).json(buildApiError(req, 502, 'Bad Gateway'));
    }
  }
}
