import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import serviceConfig, {
  ServiceConfigService,
  rateLimitConfig,
} from './config/service.config';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { AuthMiddleware } from './common/middleware/auth.middleware';
import { ProxyMiddleware } from './proxy/proxy.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [serviceConfig, rateLimitConfig],
    }),
  ],
  controllers: [AppController],
  providers: [ServiceConfigService, AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, LoggerMiddleware).forRoutes('*');

    consumer
      .apply(AuthMiddleware)
      .forRoutes({ path: '/api/*path', method: RequestMethod.ALL });

    consumer
      .apply(RateLimitMiddleware)
      .forRoutes({ path: '/api/*path', method: RequestMethod.ALL });

    consumer
      .apply(ProxyMiddleware)
      .forRoutes({ path: '/api/*path', method: RequestMethod.ALL });
  }
}
