import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ServiceConfigService } from '../config/service.config';
import { Request, Response, NextFunction } from 'express';
import proxy from 'express-http-proxy';
import {
  getRequestTargetService,
  resolveProxyPath,
  SERVICE_ROUTE_RULES,
  setRequestTargetService,
} from '../common/utils/service-routing.util';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ProxyMiddleware.name);
  private proxyMap: Record<string, ReturnType<typeof proxy>> = {};

  constructor(private readonly serviceConfigService: ServiceConfigService) {
    for (const rule of SERVICE_ROUTE_RULES) {
      const target = this.resolveTargetUrl(rule.serviceKey);

      if (target) {
        this.proxyMap[rule.pattern.source] = proxy(target, {
          proxyReqPathResolver: (req) => {
            return Promise.resolve(resolveProxyPath(req.originalUrl));
          },
          proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            // Delete sensitive headers to prevent spoofing from external clients
            delete proxyReqOpts.headers['x-user-id'];
            delete proxyReqOpts.headers['x-user-email'];
            delete proxyReqOpts.headers['x-user-role'];
            delete proxyReqOpts.headers['x-internal-secret'];
            delete proxyReqOpts.headers['x-request-id'];

            if (srcReq['user']) {
              proxyReqOpts.headers['x-user-id'] = srcReq['user'].sub;
              proxyReqOpts.headers['x-user-email'] = srcReq['user'].email;
              proxyReqOpts.headers['x-internal-secret'] =
                this.serviceConfigService.internalGatewaySecret;
              if (srcReq['user'].role) {
                proxyReqOpts.headers['x-user-role'] = srcReq['user'].role;
              }
            }
            if (srcReq['id']) {
              proxyReqOpts.headers['x-request-id'] = srcReq['id'];
            }
            return proxyReqOpts;
          },
          onError: (err, req, res) => {
            const requestId = req['id'] || 'no-req-id';
            const service = getRequestTargetService(req as Request);
            this.logger.error(
              `[${requestId}] [${service}] proxy error for ${req.method} ${req.originalUrl}: ${err.message}`,
            );
            res.status(502).json({
              success: false,
              error: 'Bad Gateway',
            });
          },
        });
      }
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

    for (const [pattern, handler] of Object.entries(this.proxyMap)) {
      if (new RegExp(pattern).test(url)) {
        return handler(req, res, next);
      }
    }
    next();
  }
}
