import { MockWhatsAppService } from './mock-whatsapp.service';
import { PinoLogger } from 'nestjs-pino';

describe('MockWhatsAppService (Security Isolation)', () => {
  let mockLogger: jest.Mocked<PinoLogger>;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    mockLogger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('prohibits instantiation when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new MockWhatsAppService(mockLogger)).toThrow(
      /Mock WhatsApp provider is strictly forbidden in production/,
    );
  });

  it('prohibits message sending if somehow invoked in production', async () => {
    process.env.NODE_ENV = 'development';
    const service = new MockWhatsAppService(mockLogger);

    process.env.NODE_ENV = 'production';
    await expect(
      service.SendTestimonialRequest({
        businessId: 'biz-1',
        businessName: 'Spa',
        customerName: 'Customer',
        customerPhone: '+919999999999',
        testimonialUrl: 'https://test.com',
      }),
    ).rejects.toThrow(/Mock WhatsApp provider cannot send messages in production/);
  });

  it('allows message simulation in development or test environment', async () => {
    process.env.NODE_ENV = 'development';
    const service = new MockWhatsAppService(mockLogger);

    const result = await service.SendTestimonialRequest({
      businessId: 'biz-1',
      businessName: 'Spa',
      customerName: 'Customer',
      customerPhone: '+919999999999',
      testimonialUrl: 'https://test.com',
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('mock');
    expect(result.messageId).toMatch(/^mock_/);
    expect(result.status).toBe('SENT');
  });
});
