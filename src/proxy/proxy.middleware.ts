import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ServiceConfigService } from '../config/service.config';
import { Request, Response, NextFunction } from 'express';
import proxy from 'express-http-proxy';
import {
  createProxyMiddleware,
  type RequestHandler,
} from 'http-proxy-middleware';
import {
  getRequestTargetService,
  resolveProxyPath,
  SERVICE_ROUTE_RULES,
  setRequestTargetService,
} from '../common/utils/service-routing.util';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private static readonly MEDIA_PROGRESS_STREAM_PATTERN =
    /^\/api\/media\/videos\/[^/]+\/progress\/stream$/;

  private readonly logger = new Logger(ProxyMiddleware.name);
  private proxyMap: Record<string, ReturnType<typeof proxy>> = {};
  private readonly mediaSseProxy?: RequestHandler;

  constructor(private readonly serviceConfigService: ServiceConfigService) {
    for (const rule of SERVICE_ROUTE_RULES) {
      const target = this.resolveTargetUrl(rule.serviceKey);

      if (target) {
        this.proxyMap[rule.pattern.source] = proxy(target, {
          proxyReqPathResolver: (req) => {
            return Promise.resolve(resolveProxyPath(req.originalUrl));
          },
          proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            return this.decorateProxyRequestOptions(proxyReqOpts, srcReq);
          },
          userResHeaderDecorator: (headers, userReq) =>
            this.decorateProxyResponseHeaders(headers, userReq as Request),
          onError: (err, req, res) => {
            this.handleProxyError(err, req as Request, res);
          },
        });
      }
    }

    if (this.serviceConfigService.mediaServiceUrl) {
      this.mediaSseProxy = createProxyMiddleware({
        target: this.serviceConfigService.mediaServiceUrl,
        changeOrigin: true,
        proxyTimeout: 0,
        timeout: 0,
        selfHandleResponse: false,
        on: {
          proxyReq: (proxyReq, req) => {
            this.setForwardHeaders(proxyReq, req as Request);
          },
          error: (err, req, res) => {
            this.handleProxyError(err, req as Request, res as Response);
          },
        },
      });
    }
  }

  private resolveTargetUrl(serviceKey: string): string | undefined {
    if (typeof this.serviceConfigService.getServiceUrlByKey === 'function') {
      return this.serviceConfigService.getServiceUrlByKey(serviceKey);
    }

    const serviceUrlMap: Record<string, string | undefined> = {
      identityService: this.serviceConfigService.identityServiceUrl,
      mediaService: this.serviceConfigService.mediaServiceUrl,
      financeService: this.serviceConfigService.financeServiceUrl,
      walletService: this.serviceConfigService.walletServiceUrl,
      paymentService: this.serviceConfigService.paymentServiceUrl,
      processingService: this.serviceConfigService.processingServiceUrl,
    };

    return serviceUrlMap[serviceKey];
  }

  use(req: Request, res: Response, next: NextFunction) {
    const url = req.originalUrl;
    setRequestTargetService(req);

    if (
      req.method === 'GET' &&
      ProxyMiddleware.MEDIA_PROGRESS_STREAM_PATTERN.test(url) &&
      this.mediaSseProxy
    ) {
      return this.mediaSseProxy(req, res, next);
    }

    for (const [pattern, handler] of Object.entries(this.proxyMap)) {
      if (new RegExp(pattern).test(url)) {
        return handler(req, res, next);
      }
    }
    next();
  }

  private decorateProxyRequestOptions(
    proxyReqOpts: {
      headers: Record<string, string>;
    },
    srcReq: Request,
  ): { headers: Record<string, string> } {
    delete proxyReqOpts.headers['x-user-id'];
    delete proxyReqOpts.headers['x-user-email'];
    delete proxyReqOpts.headers['x-user-role'];
    delete proxyReqOpts.headers['x-internal-secret'];
    delete proxyReqOpts.headers['x-request-id'];

    const user = srcReq['user'] as
      | { sub: string; email: string; role?: string }
      | undefined;
    if (user) {
      proxyReqOpts.headers['x-user-id'] = user.sub;
      proxyReqOpts.headers['x-user-email'] = user.email;
      proxyReqOpts.headers['x-internal-secret'] =
        this.serviceConfigService.internalGatewaySecret;
      if (user.role) {
        proxyReqOpts.headers['x-user-role'] = user.role;
      }
    }
    if (srcReq['id']) {
      proxyReqOpts.headers['x-request-id'] = String(srcReq['id']);
    }

    return proxyReqOpts;
  }

  private decorateProxyResponseHeaders(
    headers: Record<string, string | string[] | undefined>,
    userReq: Request,
  ): Record<string, string | string[] | undefined> {
    const setCookieHeader = headers['set-cookie'];
    if (!setCookieHeader || !/^\/api\/auth/.test(userReq.originalUrl)) {
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
    srcReq: Request,
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

    const user = srcReq['user'] as
      | { sub: string; email: string; role?: string }
      | undefined;
    if (user) {
      proxyReq.setHeader('x-user-id', user.sub);
      proxyReq.setHeader('x-user-email', user.email);
      proxyReq.setHeader(
        'x-internal-secret',
        this.serviceConfigService.internalGatewaySecret,
      );
      if (user.role) {
        proxyReq.setHeader('x-user-role', user.role);
      }
    }
    if (srcReq['id']) {
      proxyReq.setHeader('x-request-id', String(srcReq['id']));
    }
  }

  private handleProxyError(err: Error, req: Request, res: Response): void {
    const requestId = req['id'] || 'no-req-id';
    const service = getRequestTargetService(req as Request);
    this.logger.error(
      `[${requestId}] [${service}] proxy error for ${req.method} ${req.originalUrl}: ${err.message}`,
    );
    res.status(502).json({
      success: false,
      error: 'Bad Gateway',
    });
  }
}
