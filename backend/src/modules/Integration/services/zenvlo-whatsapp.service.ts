import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import {
  IWhatsAppIntegrationService,
  ISendTestimonialRequestInput,
  ISendTestimonialRequestResult,
} from '../interfaces/whatsapp-integration.interface';

/**
 * ZenvloWhatsAppService
 *
 * Real production WhatsApp integration service communicating directly with
 * the Zenvlo Engage WhatsApp provider API.
 *
 * Security Invariants:
 * - Production strictly requires valid ZENVLO_WHATSAPP_API_URL and ZENVLO_WHATSAPP_API_KEY.
 * - Never falls back to mock, sandbox, or synthetic message ID generation.
 * - Validates provider response schema before reporting success.
 * - Sanitizes all diagnostic logs to prevent credential or PII leaks.
 */
@Injectable()
export class ZenvloWhatsAppService implements IWhatsAppIntegrationService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly isProduction: boolean;
  private readonly timeoutMs: number;

  private readonly logger: PinoLogger;

  constructor(
    @Optional() logger?: PinoLogger,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.logger =
      logger ||
      ({
        setContext: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      } as any);
    this.logger.setContext(ZenvloWhatsAppService.name);

    const nodeEnv =
      this.configService?.get<string>('NODE_ENV') ||
      process.env.NODE_ENV ||
      'development';
    this.isProduction = nodeEnv.toLowerCase() === 'production';

    this.apiUrl =
      this.configService?.get<string>('ZENVLO_WHATSAPP_API_URL') ||
      process.env.ZENVLO_WHATSAPP_API_URL ||
      '';

    this.apiKey =
      this.configService?.get<string>('ZENVLO_WHATSAPP_API_KEY') ||
      process.env.ZENVLO_WHATSAPP_API_KEY ||
      '';

    const configuredTimeout =
      this.configService?.get<string>('WHATSAPP_TIMEOUT_MS') ||
      process.env.WHATSAPP_TIMEOUT_MS;
    this.timeoutMs = configuredTimeout ? parseInt(configuredTimeout, 10) : 10000;

    if (this.isProduction) {
      if (!this.apiUrl || !this.apiKey) {
        throw new Error(
          '[SECURITY FATAL] Zenvlo WhatsApp provider cannot start in production without ZENVLO_WHATSAPP_API_URL and ZENVLO_WHATSAPP_API_KEY.',
        );
      }
      if (
        this.apiKey.startsWith('placeholder_') ||
        this.apiKey.includes('your_internal_zenvlo_engage_api_key')
      ) {
        throw new Error(
          '[SECURITY FATAL] Zenvlo WhatsApp provider cannot use placeholder credentials in production.',
        );
      }
    }
  }

  async SendTestimonialRequest(
    input: ISendTestimonialRequestInput,
  ): Promise<ISendTestimonialRequestResult> {
    const maskedPhone = input.customerPhone
      ? input.customerPhone.slice(0, 3) + '****' + input.customerPhone.slice(-4)
      : 'unknown';

    // Verify credentials presence
    if (!this.apiUrl || !this.apiKey) {
      this.logger.error({
        msg: 'WhatsApp provider credentials missing. Request failed closed.',
        businessId: input.businessId,
        isProduction: this.isProduction,
      });

      return {
        success: false,
        status: 'FAILED',
        errorMessage: 'WhatsApp provider credentials are not configured.',
        provider: 'zenvlo',
      };
    }

    const payload = {
      recipient: input.customerPhone,
      customer_name: input.customerName,
      business_name: input.businessName,
      business_id: input.businessId,
      testimonial_url: input.testimonialUrl,
      custom_message: input.customMessage || null,
      template: 'testimonial_request',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const startTime = Date.now();

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'X-Business-ID': input.businessId,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      // Handle specific HTTP status classes
      if (response.status === 401 || response.status === 403) {
        this.logger.error({
          msg: 'WhatsApp provider authentication failed (401/403).',
          statusCode: response.status,
          businessId: input.businessId,
          latencyMs,
        });

        return {
          success: false,
          status: 'FAILED',
          statusCode: response.status,
          errorMessage: 'WhatsApp provider authentication failed.',
          provider: 'zenvlo',
        };
      }

      if (response.status === 429) {
        this.logger.warn({
          msg: 'WhatsApp provider rate limit exceeded (429).',
          businessId: input.businessId,
          latencyMs,
        });

        return {
          success: false,
          status: 'FAILED',
          statusCode: 429,
          errorMessage: 'WhatsApp provider rate limit exceeded.',
          provider: 'zenvlo',
        };
      }

      if (response.status === 400 || response.status === 422) {
        let errDetail = 'Invalid recipient or payload';
        try {
          const errData: any = await response.json();
          errDetail = errData?.message || errData?.error || errDetail;
        } catch {
          // ignore json parse error on error response
        }

        this.logger.warn({
          msg: 'WhatsApp message rejected by provider (400/422).',
          statusCode: response.status,
          businessId: input.businessId,
          recipient: maskedPhone,
          latencyMs,
        });

        return {
          success: false,
          status: 'FAILED',
          statusCode: response.status,
          errorMessage: `WhatsApp message rejected: ${errDetail}`,
          provider: 'zenvlo',
        };
      }

      if (response.status >= 500) {
        this.logger.error({
          msg: `WhatsApp provider unavailable (${response.status}).`,
          statusCode: response.status,
          businessId: input.businessId,
          latencyMs,
        });

        return {
          success: false,
          status: 'FAILED',
          statusCode: response.status,
          errorMessage: `WhatsApp provider unavailable (${response.status}).`,
          provider: 'zenvlo',
        };
      }

      if (!response.ok) {
        this.logger.error({
          msg: `WhatsApp provider unexpected HTTP error (${response.status}).`,
          statusCode: response.status,
          businessId: input.businessId,
          latencyMs,
        });

        return {
          success: false,
          status: 'FAILED',
          statusCode: response.status,
          errorMessage: `WhatsApp provider returned HTTP ${response.status}.`,
          provider: 'zenvlo',
        };
      }

      // Successful HTTP response (200, 201, 202) -> Validate provider response schema
      let data: any;
      try {
        data = await response.json();
      } catch (jsonErr: any) {
        this.logger.error({
          msg: 'Malformed JSON in WhatsApp provider response.',
          statusCode: response.status,
          businessId: input.businessId,
          latencyMs,
        });

        return {
          success: false,
          status: 'FAILED',
          errorMessage: 'Malformed response received from WhatsApp provider.',
          provider: 'zenvlo',
        };
      }

      // STRICT VALIDATION: Ensure real provider returned an actual message ID
      const messageId = data?.message_id || data?.messageId || data?.id;
      if (!messageId || typeof messageId !== 'string' || messageId.trim().length === 0) {
        this.logger.error({
          msg: 'WhatsApp provider returned 2xx but omitted message ID. Rejected.',
          statusCode: response.status,
          businessId: input.businessId,
          latencyMs,
        });

        return {
          success: false,
          status: 'FAILED',
          errorMessage: 'WhatsApp provider response missing valid message ID.',
          provider: 'zenvlo',
        };
      }

      this.logger.info({
        msg: 'WhatsApp testimonial request successfully submitted to real provider.',
        messageId,
        businessId: input.businessId,
        recipient: maskedPhone,
        latencyMs,
      });

      return {
        success: true,
        messageId,
        status: data.status === 'DELIVERED' ? 'DELIVERED' : 'SENT',
        provider: 'zenvlo',
        statusCode: response.status,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        this.logger.error({
          msg: `WhatsApp provider request timed out after ${this.timeoutMs}ms.`,
          businessId: input.businessId,
          recipient: maskedPhone,
        });

        return {
          success: false,
          status: 'FAILED',
          errorMessage: 'WhatsApp provider request timed out.',
          provider: 'zenvlo',
        };
      }

      this.logger.error({
        msg: 'WhatsApp provider connection error.',
        error: err.message,
        businessId: input.businessId,
        recipient: maskedPhone,
      });

      return {
        success: false,
        status: 'FAILED',
        errorMessage: `WhatsApp provider connection error: ${err.message}`,
        provider: 'zenvlo',
      };
    }
  }
}
