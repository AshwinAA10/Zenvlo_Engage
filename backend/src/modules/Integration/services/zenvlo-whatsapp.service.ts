import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  IWhatsAppIntegrationService,
  ISendTestimonialRequestInput,
  ISendTestimonialRequestResult,
} from '../interfaces/whatsapp-integration.interface';

/**
 * ZenvloWhatsAppService
 *
 * Implements the integration boundary communicating with the existing Zenvlo Engage
 * WhatsApp capability. The actual internal API endpoint and authentication mechanism
 * are marked as PENDING_CONTRACT_CONFIRMATION until the internal contract is provided.
 */
@Injectable()
export class ZenvloWhatsAppService implements IWhatsAppIntegrationService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ZenvloWhatsAppService.name);
  }

  async SendTestimonialRequest(
    input: ISendTestimonialRequestInput,
  ): Promise<ISendTestimonialRequestResult> {
    this.logger.warn({
      msg: 'Internal WhatsApp API contract pending confirmation. Request simulated.',
      recipient: input.customerPhone,
      business: input.businessName,
    });

    return {
      success: true,
      messageId: `pending_contract_${Date.now()}`,
      status: 'PENDING_CONTRACT',
    };
  }
}
