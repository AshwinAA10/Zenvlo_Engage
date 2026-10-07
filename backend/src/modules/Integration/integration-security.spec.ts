import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { IntegrationModule } from './Integration.module';
import { WHATSAPP_INTEGRATION_SERVICE } from './interfaces/whatsapp-integration.interface';
import { ZenvloWhatsAppService } from './services/zenvlo-whatsapp.service';
import { MockWhatsAppService } from './services/mock-whatsapp.service';
import { validateEnvironment } from '../../config/env.validation';

describe('Security Regression Audit — WhatsApp Production Enforcement (Phase 9A)', () => {
  const originalEnv = { ...process.env };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetAllMocks();
  });

  describe('1. Production Provider Selection Enforcement', () => {
    it('selects ZenvloWhatsAppService when in production with valid credentials', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [IntegrationModule],
        providers: [{ provide: PinoLogger, useValue: mockLogger }],
      })
        .overrideProvider(ConfigService)
        .useValue({
          get: (key: string) => {
            if (key === 'NODE_ENV') return 'production';
            if (key === 'WHATSAPP_PROVIDER') return 'zenvlo';
            if (key === 'ZENVLO_WHATSAPP_API_URL') return 'https://api.zenvlo.com/v1/messages';
            if (key === 'ZENVLO_WHATSAPP_API_KEY') return 'prod_secret_key_12345';
            return null;
          },
        })
        .compile();

      const provider = module.get(WHATSAPP_INTEGRATION_SERVICE);
      expect(provider).toBeInstanceOf(ZenvloWhatsAppService);
      expect(provider).not.toBeInstanceOf(MockWhatsAppService);
    });

    it('PROHIBITS mock provider in production: throws fatal security error if WHATSAPP_PROVIDER=mock', async () => {
      const createModule = () =>
        Test.createTestingModule({
          imports: [IntegrationModule],
          providers: [{ provide: PinoLogger, useValue: mockLogger }],
        })
          .overrideProvider(ConfigService)
          .useValue({
            get: (key: string) => {
              if (key === 'NODE_ENV') return 'production';
              if (key === 'WHATSAPP_PROVIDER') return 'mock';
              return null;
            },
          })
          .compile();

      await expect(createModule()).rejects.toThrow(
        /Insecure WhatsApp provider 'mock' is strictly forbidden in production/,
      );
    });

    it('PROHIBITS sandbox provider in production: throws fatal security error if WHATSAPP_PROVIDER=sandbox', async () => {
      const createModule = () =>
        Test.createTestingModule({
          imports: [IntegrationModule],
          providers: [{ provide: PinoLogger, useValue: mockLogger }],
        })
          .overrideProvider(ConfigService)
          .useValue({
            get: (key: string) => {
              if (key === 'NODE_ENV') return 'production';
              if (key === 'WHATSAPP_PROVIDER') return 'sandbox';
              return null;
            },
          })
          .compile();

      await expect(createModule()).rejects.toThrow(
        /Insecure WhatsApp provider 'sandbox' is strictly forbidden in production/,
      );
    });

    it('FAILS CLOSED: throws error in production when WhatsApp credentials are missing', async () => {
      const createModule = () =>
        Test.createTestingModule({
          imports: [IntegrationModule],
          providers: [{ provide: PinoLogger, useValue: mockLogger }],
        })
          .overrideProvider(ConfigService)
          .useValue({
            get: (key: string) => {
              if (key === 'NODE_ENV') return 'production';
              if (key === 'WHATSAPP_PROVIDER') return 'zenvlo';
              // Missing API URL and key
              return null;
            },
          })
          .compile();

      await expect(createModule()).rejects.toThrow(
        /Zenvlo WhatsApp provider cannot start in production without ZENVLO_WHATSAPP_API_URL and ZENVLO_WHATSAPP_API_KEY/,
      );
    });
  });

  describe('2. Environment Validation Schema Security Regression', () => {
    const validProdConfig = {
      NODE_ENV: 'production',
      WHATSAPP_PROVIDER: 'zenvlo',
      ZENVLO_WHATSAPP_API_URL: 'https://api.zenvlo.com/v1/messages',
      ZENVLO_WHATSAPP_API_KEY: 'prod_zenvlo_real_api_key_valid_9988',
      JWT_SECRET: 'super_secret_jwt_key_at_least_64_characters_long_for_security_production',
      JWT_REFRESH_SECRET: 'super_secret_jwt_refresh_key_at_least_64_characters_long_production',
      POSTGRES_PASSWORD: 'secure_production_postgres_password',
    };

    it('passes validation when production configuration is fully secure', () => {
      expect(() => validateEnvironment(validProdConfig)).not.toThrow();
    });

    it('rejects production configuration if WHATSAPP_PROVIDER is mock', () => {
      expect(() =>
        validateEnvironment({
          ...validProdConfig,
          WHATSAPP_PROVIDER: 'mock',
        }),
      ).toThrow(/Insecure WhatsApp provider 'mock' is strictly forbidden in production/);
    });

    it('rejects production configuration if WHATSAPP_PROVIDER is sandbox', () => {
      expect(() =>
        validateEnvironment({
          ...validProdConfig,
          WHATSAPP_PROVIDER: 'sandbox',
        }),
      ).toThrow(/Insecure WhatsApp provider 'sandbox' is strictly forbidden in production/);
    });

    it('rejects production configuration if ZENVLO_WHATSAPP_API_URL is missing', () => {
      const config = { ...validProdConfig };
      delete (config as any).ZENVLO_WHATSAPP_API_URL;
      expect(() => validateEnvironment(config)).toThrow(
        /ZENVLO_WHATSAPP_API_URL is required in production/,
      );
    });

    it('rejects production configuration if ZENVLO_WHATSAPP_API_KEY is missing or placeholder', () => {
      expect(() =>
        validateEnvironment({
          ...validProdConfig,
          ZENVLO_WHATSAPP_API_KEY: 'placeholder_whatsapp_access_token',
        }),
      ).toThrow(/cannot use placeholder credentials in production/);
    });

    it('rejects production configuration if JWT_SECRET uses development placeholder', () => {
      expect(() =>
        validateEnvironment({
          ...validProdConfig,
          JWT_SECRET: 'super_secret_jwt_key_zenvlo_engage_production_change_me',
        }),
      ).toThrow(/JWT_SECRET must be securely set in production/);
    });
  });

  describe('3. Non-Production Behavior', () => {
    it('allows mock provider in development environment', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [IntegrationModule],
        providers: [{ provide: PinoLogger, useValue: mockLogger }],
      })
        .overrideProvider(ConfigService)
        .useValue({
          get: (key: string) => {
            if (key === 'NODE_ENV') return 'development';
            if (key === 'WHATSAPP_PROVIDER') return 'mock';
            return null;
          },
        })
        .compile();

      const provider = module.get(WHATSAPP_INTEGRATION_SERVICE);
      expect(provider).toBeInstanceOf(MockWhatsAppService);
    });
  });
});
