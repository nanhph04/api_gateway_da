import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import type { ServiceKey } from '../common/utils/service-routing.util';
import { resolveRouteManifestEntry } from '../common/utils/service-routing.util';

const getNumberConfig = (
  configService: NestConfigService,
  key: string,
  defaultValue: number,
): number => {
  const value = configService.get<string | number>(key);

  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : defaultValue;
};

export const serviceConfig = registerAs('services', () => {
  const configService = new NestConfigService();

  return {
    identityServiceUrl:
      configService.get<string>('IDENTITY_SERVICE_URL') ||
      configService.get<string>('AUTH_SERVICE_URL') ||
      'http://localhost:4000',

    mediaServiceUrl: configService.get<string>(
      'MEDIA_SERVICE_URL',
      'http://localhost:4002',
    ),

    financeServiceUrl: configService.get<string>(
      'FINANCE_SERVICE_URL',
      'http://localhost:4004',
    ),

    walletServiceUrl: configService.get<string>(
      'WALLET_SERVICE_URL',
      'http://localhost:3003',
    ),

    paymentServiceUrl: configService.get<string>(
      'PAYMENT_SERVICE_URL',
      'http://localhost:3004',
    ),

    processingServiceUrl: configService.get<string>(
      'PROCESSING_SERVICE_URL',
      'http://localhost:3005',
    ),

    internalGatewaySecret: configService.get<string>(
      'INTERNAL_GATEWAY_SECRET',
      'gateway-secret',
    ),

    identityInternalGatewaySecret:
      configService.get<string>('IDENTITY_INTERNAL_GATEWAY_SECRET') ||
      configService.get<string>('INTERNAL_GATEWAY_SECRET') ||
      'gateway-secret',

    mediaInternalGatewaySecret:
      configService.get<string>('MEDIA_INTERNAL_GATEWAY_SECRET') ||
      configService.get<string>('INTERNAL_GATEWAY_SECRET') ||
      'gateway-secret',

    financeInternalGatewaySecret:
      configService.get<string>('FINANCE_INTERNAL_GATEWAY_SECRET') ||
      configService.get<string>('INTERNAL_GATEWAY_SECRET') ||
      'gateway-secret',
  };
});

export const rateLimitConfig = registerAs('rateLimit', () => {
  const configService = new NestConfigService();

  return {
    userService: {
      windowMs: getNumberConfig(
        configService,
        'USER_RATE_LIMIT_WINDOW_MS',
        15 * 60 * 1000,
      ),
      max: getNumberConfig(configService, 'USER_RATE_LIMIT_MAX', 100),
    },

    identitySessionProfile: {
      windowMs: getNumberConfig(
        configService,
        'IDENTITY_SESSION_PROFILE_RATE_LIMIT_WINDOW_MS',
        60 * 1000,
      ),
      max: getNumberConfig(
        configService,
        'IDENTITY_SESSION_PROFILE_RATE_LIMIT_MAX',
        120,
      ),
    },

    mediaService: {
      windowMs: getNumberConfig(
        configService,
        'MEDIA_RATE_LIMIT_WINDOW_MS',
        15 * 60 * 1000,
      ),
      max: getNumberConfig(configService, 'MEDIA_RATE_LIMIT_MAX', 100),
    },

    financeService: {
      windowMs: getNumberConfig(
        configService,
        'FINANCE_RATE_LIMIT_WINDOW_MS',
        15 * 60 * 1000,
      ),
      max: getNumberConfig(configService, 'FINANCE_RATE_LIMIT_MAX', 100),
    },

    walletService: {
      windowMs: getNumberConfig(
        configService,
        'WALLET_RATE_LIMIT_WINDOW_MS',
        15 * 60 * 1000,
      ),
      max: getNumberConfig(configService, 'WALLET_RATE_LIMIT_MAX', 50),
    },

    paymentService: {
      windowMs: getNumberConfig(
        configService,
        'PAYMENT_RATE_LIMIT_WINDOW_MS',
        15 * 60 * 1000,
      ),
      max: getNumberConfig(configService, 'PAYMENT_RATE_LIMIT_MAX', 30),
    },

    processingService: {
      windowMs: getNumberConfig(
        configService,
        'PROCESSING_RATE_LIMIT_WINDOW_MS',
        15 * 60 * 1000,
      ),
      max: getNumberConfig(configService, 'PROCESSING_RATE_LIMIT_MAX', 20),
    },
  };
});

export default serviceConfig;

@Injectable()
export class ServiceConfigService {
  constructor(private readonly configService: NestConfigService) {}

  getServiceUrlByKey(serviceKey: string): string | undefined {
    switch (serviceKey) {
      case 'identityService':
        return this.identityServiceUrl;
      case 'mediaService':
        return this.mediaServiceUrl;
      case 'financeService':
        return this.financeServiceUrl;
      case 'walletService':
        return this.walletServiceUrl;
      case 'paymentService':
        return this.paymentServiceUrl;
      case 'processingService':
        return this.processingServiceUrl;
      default:
        return undefined;
    }
  }

  get identityServiceUrl(): string {
    return this.configService.get<string>(
      'services.identityServiceUrl',
      'http://localhost:4000',
    );
  }

  get mediaServiceUrl(): string {
    return this.configService.get<string>(
      'services.mediaServiceUrl',
      'http://localhost:4002',
    );
  }

  get financeServiceUrl(): string {
    return this.configService.get<string>(
      'services.financeServiceUrl',
      'http://localhost:4004',
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

  get internalGatewaySecret(): string {
    return this.configService.get<string>(
      'services.internalGatewaySecret',
      'gateway-secret',
    );
  }

  get identityInternalGatewaySecret(): string {
    return this.configService.get<string>(
      'services.identityInternalGatewaySecret',
      this.internalGatewaySecret,
    );
  }

  get mediaInternalGatewaySecret(): string {
    return this.configService.get<string>(
      'services.mediaInternalGatewaySecret',
      this.internalGatewaySecret,
    );
  }

  get financeInternalGatewaySecret(): string {
    return this.configService.get<string>(
      'services.financeInternalGatewaySecret',
      this.internalGatewaySecret,
    );
  }

  getInternalGatewaySecretByServiceKey(serviceKey: ServiceKey): string {
    switch (serviceKey) {
      case 'identityService':
        return this.identityInternalGatewaySecret;
      case 'mediaService':
        return this.mediaInternalGatewaySecret;
      case 'financeService':
        return this.financeInternalGatewaySecret;
      default:
        return this.internalGatewaySecret;
    }
  }

  getServiceUrl(path: string, method = 'GET'): string | undefined {
    const serviceKey = resolveRouteManifestEntry(method, path)?.serviceKey;
    return serviceKey ? this.getServiceUrlByKey(serviceKey) : undefined;
  }
}
