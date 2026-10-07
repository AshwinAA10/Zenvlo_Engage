import { ZenvloWhatsAppService } from './zenvlo-whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { ISendTestimonialRequestInput } from '../interfaces/whatsapp-integration.interface';

describe('ZenvloWhatsAppService (Production Provider Security)', () => {
  let service: ZenvloWhatsAppService;
  let mockLogger: any;
  let mockConfigService: any;

  const defaultInput: ISendTestimonialRequestInput = {
    businessId: 'biz-123',
    businessName: 'Luxe Salon',
    customerName: 'Aarav Patel',
    customerPhone: '+919876543210',
    testimonialUrl: 'https://app.zenvlo.com/submit/luxe-salon',
    customMessage: 'Thank you for visiting us!',
  };

  beforeEach(() => {
    mockLogger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'ZENVLO_WHATSAPP_API_URL') return 'https://api.zenvlo.com/v1/messages';
        if (key === 'ZENVLO_WHATSAPP_API_KEY') return 'live_sec_valid_whatsapp_key_12345';
        if (key === 'WHATSAPP_TIMEOUT_MS') return '5000';
        return null;
      }),
    } as any;

    // Reset global fetch mock
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('1. Production Startup & Configuration Enforcement', () => {
    it('throws fatal error in production if ZENVLO_WHATSAPP_API_URL is missing', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'ZENVLO_WHATSAPP_API_URL') return '';
        if (key === 'ZENVLO_WHATSAPP_API_KEY') return 'valid_key';
        return null;
      });

      expect(() => new ZenvloWhatsAppService(mockLogger, mockConfigService)).toThrow(
        /ZENVLO_WHATSAPP_API_URL and ZENVLO_WHATSAPP_API_KEY/,
      );
    });

    it('throws fatal error in production if ZENVLO_WHATSAPP_API_KEY is missing', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'ZENVLO_WHATSAPP_API_URL') return 'https://api.zenvlo.com/v1/messages';
        if (key === 'ZENVLO_WHATSAPP_API_KEY') return '';
        return null;
      });

      expect(() => new ZenvloWhatsAppService(mockLogger, mockConfigService)).toThrow(
        /ZENVLO_WHATSAPP_API_URL and ZENVLO_WHATSAPP_API_KEY/,
      );
    });

    it('throws fatal error in production if placeholder API key is used', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'ZENVLO_WHATSAPP_API_URL') return 'https://api.zenvlo.com/v1/messages';
        if (key === 'ZENVLO_WHATSAPP_API_KEY') return 'placeholder_whatsapp_access_token';
        return null;
      });

      expect(() => new ZenvloWhatsAppService(mockLogger, mockConfigService)).toThrow(
        /cannot use placeholder credentials in production/,
      );
    });
  });

  describe('2. Real Provider Message Transmission & Response Handling', () => {
    beforeEach(() => {
      service = new ZenvloWhatsAppService(mockLogger, mockConfigService);
    });

    it('successfully sends message when real provider responds with valid message ID', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message_id: 'wamid_HBgMOTE5ODc2NTQzMjEwFQIAERgSRjQ2OTg0',
          status: 'SENT',
        }),
      });

      const result = await service.SendTestimonialRequest(defaultInput);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid_HBgMOTE5ODc2NTQzMjEwFQIAERgSRjQ2OTg0');
      expect(result.status).toBe('SENT');
      expect(result.provider).toBe('zenvlo');

      // Verify fetch was called with real endpoint and authorization header
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.zenvlo.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer live_sec_valid_whatsapp_key_12345',
          }),
        }),
      );
    });

    it('rejects provider 200 OK response if message ID is missing and NEVER generates a fake ID', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          // message_id is omitted!
        }),
      });

      const result = await service.SendTestimonialRequest(defaultInput);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.messageId).toBeUndefined();
      expect(result.errorMessage).toContain('missing valid message ID');
    });

    it('handles provider 401/403 authentication failure by failing closed', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      const result = await service.SendTestimonialRequest(defaultInput);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.statusCode).toBe(401);
      expect(result.errorMessage).toContain('authentication failed');
    });

    it('handles provider 429 rate limit by failing closed', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limit exceeded' }),
      });

      const result = await service.SendTestimonialRequest(defaultInput);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.statusCode).toBe(429);
      expect(result.errorMessage).toContain('rate limit exceeded');
    });

    it('handles provider 400/422 payload rejection by failing closed', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Invalid recipient phone format' }),
      });

      const result = await service.SendTestimonialRequest(defaultInput);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.statusCode).toBe(422);
      expect(result.errorMessage).toContain('Invalid recipient phone format');
    });

    it('handles provider 500/503 unavailable by failing closed', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const result = await service.SendTestimonialRequest(defaultInput);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.statusCode).toBe(503);
      expect(result.errorMessage).toContain('unavailable');
    });

    it('handles network/connection failure by failing closed', async () => {
      (global as any).fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.SendTestimonialRequest(defaultInput);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('ECONNREFUSED');
    });

    it('handles timeout (AbortError) by failing closed', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      (global as any).fetch = jest.fn().mockRejectedValue(abortError);

      const result = await service.SendTestimonialRequest(defaultInput);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('timed out');
    });
  });

  describe('3. Sensitive Data Sanitization & Logging', () => {
    beforeEach(() => {
      service = new ZenvloWhatsAppService(mockLogger, mockConfigService);
    });

    it('never logs raw API secrets or tokens', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      await service.SendTestimonialRequest(defaultInput);

      const errorCalls = mockLogger.error.mock.calls;
      for (const call of errorCalls) {
        const loggedObj = JSON.stringify(call);
        expect(loggedObj).not.toContain('live_sec_valid_whatsapp_key_12345');
      }
    });
  });
});
