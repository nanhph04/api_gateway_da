import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply Global Exception Filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Apply Global Response Interceptor
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Apply Helmet for Security Headers
  app.use(helmet());

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `API Gateway is running on: http://localhost:${port}`,
    'Bootstrap',
  );
}
bootstrap();
