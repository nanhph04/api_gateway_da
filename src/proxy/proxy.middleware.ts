import { Injectable, NestMiddleware } from '@nestjs/common';
import { ServiceConfigService } from '../config/service.config';
import { Request, Response, NextFunction } from 'express';
import proxy from 'express-http-proxy';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private proxyMap: Record<string, ReturnType<typeof proxy>> = {};

  constructor(private readonly serviceConfigService: ServiceConfigService) {
    const routeRules = {
      '^/api/auth': this.serviceConfigService.authServiceUrl,
      '^/api/users': this.serviceConfigService.userServiceUrl,
      '^/api/media': this.serviceConfigService.mediaServiceUrl,
      '^/api/wallet': this.serviceConfigService.walletServiceUrl,
      '^/api/payment': this.serviceConfigService.paymentServiceUrl,
      '^/api/process': this.serviceConfigService.processingServiceUrl,
    };

    for (const [pattern, target] of Object.entries(routeRules)) {
      if (target) {
        this.proxyMap[pattern] = proxy(target, {
          proxyReqPathResolver: (req) => {
            return Promise.resolve(req.originalUrl);
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
              proxyReqOpts.headers['x-internal-secret'] = this.serviceConfigService.internalGatewaySecret;
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
            console.error(`[Proxy] Error: ${err.message}`);
            res.status(502).json({
              success: false,
              error: 'Bad Gateway',
            });
          },
        });
      }
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    const url = req.originalUrl;
    for (const [pattern, handler] of Object.entries(this.proxyMap)) {
      if (new RegExp(pattern).test(url)) {
        return handler(req, res, next);
      }
    }
    next();
  }
}
