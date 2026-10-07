import { Injectable, Optional } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  IWhatsAppIntegrationService,
  ISendTestimonialRequestInput,
  ISendTestimonialRequestResult,
} from '../interfaces/whatsapp-integration.interface';

/**
 * MockWhatsAppService
 *
 * DEVELOPMENT / TEST ONLY WhatsApp provider implementation.
 * Strictly forbidden from being instantiated or invoked in production.
 */
@Injectable()
export class MockWhatsAppService implements IWhatsAppIntegrationService {
  private readonly logger: PinoLogger;

  constructor(@Optional() logger?: PinoLogger) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[SECURITY FATAL] Mock WhatsApp provider is strictly forbidden in production. Production must use the real Zenvlo WhatsApp provider.',
      );
    }
    this.logger =
      logger ||
      ({
        setContext: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      } as any);
    this.logger.setContext(MockWhatsAppService.name);
  }

  async SendTestimonialRequest(
    input: ISendTestimonialRequestInput,
  ): Promise<ISendTestimonialRequestResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[SECURITY FATAL] Mock WhatsApp provider cannot send messages in production.',
      );
    }

    const maskedPhone = input.customerPhone
      ? input.customerPhone.slice(0, 3) + '****' + input.customerPhone.slice(-4)
      : 'unknown';

    this.logger.warn({
      msg: '[DEV ONLY] Mock WhatsApp testimonial request simulated.',
      recipient: maskedPhone,
      business: input.businessName,
    });

    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      status: 'SENT',
      provider: 'mock',
    };
  }
}
