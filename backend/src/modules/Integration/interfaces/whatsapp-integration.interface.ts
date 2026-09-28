export interface ISendTestimonialRequestInput {
  businessId: string;
  businessName: string;
  customerName: string;
  customerPhone: string;
  testimonialUrl: string;
  customMessage?: string;
}

export interface ISendTestimonialRequestResult {
  success: boolean;
  messageId?: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'PENDING_CONTRACT';
  errorMessage?: string;
}

export interface IWhatsAppIntegrationService {
  SendTestimonialRequest(
    input: ISendTestimonialRequestInput,
  ): Promise<ISendTestimonialRequestResult>;
}

export const WHATSAPP_INTEGRATION_SERVICE = 'WHATSAPP_INTEGRATION_SERVICE';
