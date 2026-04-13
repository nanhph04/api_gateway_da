import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { registerAs } from '@nestjs/config';

export const serviceConfig = registerAs('services', () => ({
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:4000',
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  mediaServiceUrl: process.env.MEDIA_SERVICE_URL || 'http://localhost:3002',
  walletServiceUrl: process.env.WALLET_SERVICE_URL || 'http://localhost:3003',
  paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004',
  processingServiceUrl:
    process.env.PROCESSING_SERVICE_URL || 'http://localhost:3005',
}));

export const rateLimitConfig = registerAs('rateLimit', () => ({
  userService: {
    windowMs:
      parseInt(process.env.USER_RATE_LIMIT_WINDOW_MS || '', 10) ||
      15 * 60 * 1000,
    max: parseInt(process.env.USER_RATE_LIMIT_MAX || '', 10) || 100,
  },
  mediaService: {
    windowMs:
      parseInt(process.env.MEDIA_RATE_LIMIT_WINDOW_MS || '', 10) ||
      15 * 60 * 1000,
    max: parseInt(process.env.MEDIA_RATE_LIMIT_MAX || '', 10) || 100,
  },
  walletService: {
    windowMs:
      parseInt(process.env.WALLET_RATE_LIMIT_WINDOW_MS || '', 10) ||
      15 * 60 * 1000,
    max: parseInt(process.env.WALLET_RATE_LIMIT_MAX || '', 10) || 50,
  },
  paymentService: {
    windowMs:
      parseInt(process.env.PAYMENT_RATE_LIMIT_WINDOW_MS || '', 10) ||
      15 * 60 * 1000,
    max: parseInt(process.env.PAYMENT_RATE_LIMIT_MAX || '', 10) || 30,
  },
  processingService: {
    windowMs:
      parseInt(process.env.PROCESSING_RATE_LIMIT_WINDOW_MS || '', 10) ||
      15 * 60 * 1000,
    max: parseInt(process.env.PROCESSING_RATE_LIMIT_MAX || '', 10) || 20,
  },
}));

export default serviceConfig;

@Injectable()
export class ServiceConfigService {
  constructor(private readonly configService: NestConfigService) { }

  get authServiceUrl(): string {
    return this.configService.get<string>(
      'services.authServiceUrl',
      'http://localhost:4000',
    );
  }

  get userServiceUrl(): string {
    return this.configService.get<string>(
      'services.userServiceUrl',
      'http://localhost:3001',
    );
  }

  get mediaServiceUrl(): string {
    return this.configService.get<string>(
      'services.mediaServiceUrl',
      'http://localhost:3002',
    );
  }

  get walletServiceUrl(): string {
    return this.configService.get<string>(
      'services.walletServiceUrl',
      'http://localhost:3003',
    );
  }

  get paymentServiceUrl(): string {
    return this.configService.get<string>(
      'services.paymentServiceUrl',
      'http://localhost:3004',
    );
  }

  get processingServiceUrl(): string {
    return this.configService.get<string>(
      'services.processingServiceUrl',
      'http://localhost:3005',
    );
  }

  getServiceUrl(path: string): string | undefined {
    if (path.startsWith('/api/auth')) {
      return this.authServiceUrl;
    }
    if (path.startsWith('/api/users')) {
      return this.userServiceUrl;
    }
    if (path.startsWith('/api/media')) {
      return this.mediaServiceUrl;
    }
    if (path.startsWith('/api/wallet')) {
      return this.walletServiceUrl;
    }
    if (path.startsWith('/api/payment')) {
      return this.paymentServiceUrl;
    }
    if (path.startsWith('/api/process')) {
      return this.processingServiceUrl;
    }
    return undefined;
  }
}
