import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import { Inject, Optional } from '@nestjs/common';
import { QUEUE_WHATSAPP_OUTBOUND } from '../../../common/constants';
import { BaseTenantWorkerHost } from './base-tenant.processor';
import { OutboundWhatsAppJobPayload } from '../interfaces/job.interface';
import {
  WHATSAPP_INTEGRATION_SERVICE,
  IWhatsAppIntegrationService,
} from '../../Integration/interfaces/whatsapp-integration.interface';
import { RequestLog } from '../../Request/entities/request-log.entity';
import { Customer } from '../../Customer/entities/customer.entity';
import { Business } from '../../Business/entities/business.entity';
import { UsageService } from '../../Billing/services/usage.service';

/**
 * BullMQ Worker Processor for asynchronous outbound WhatsApp messages.
 *
 * Security & Reliability Invariants:
 * - Strictly validates and propagates tenant workspace context via ClsService.
 * - Authoritatively queries persisted RequestLog to prevent phantom or uncoordinated sends.
 * - Idempotently checks if the message was already submitted, preventing duplicate WhatsApp messages on retry.
 * - Enforces recipient consent and opt-out rules prior to provider transmission.
 * - Enforces monthly subscription usage quotas.
 * - Differentiates provider acceptance (status: SENT) from device delivery (status: DELIVERED via webhook).
 * - Distinguishes retryable errors (429, 5xx, timeout) from permanent errors (400, 422).
 */
@Processor(QUEUE_WHATSAPP_OUTBOUND)
export class WhatsAppOutboundProcessor extends BaseTenantWorkerHost<
  OutboundWhatsAppJobPayload,
  any
> {
  protected readonly queueName = QUEUE_WHATSAPP_OUTBOUND;
  protected readonly requiresTenant = true;

  constructor(
    logger: PinoLogger,
    cls: ClsService,
    @Inject(WHATSAPP_INTEGRATION_SERVICE)
    private readonly whatsappService: IWhatsAppIntegrationService,
    @Optional()
    private readonly usageService?: UsageService,
  ) {
    super(logger, cls);
    this.logger.setContext(WhatsAppOutboundProcessor.name);
  }

  async handleJob(
    job: Job<OutboundWhatsAppJobPayload, any, string>,
  ): Promise<any> {
    const { request_log_id, business_id } = job.data;

    // 1. Retrieve authoritative record from database
    const log = await RequestLog.findOne({
      where: { id: request_log_id, business_id },
    });

    if (!log) {
      this.logger.warn(
        {
          requestLogId: request_log_id,
          businessId: business_id,
        },
        'Outbound WhatsApp job discarded: RequestLog record not found or tenant mismatch',
      );
      return { processed: false, reason: 'RECORD_NOT_FOUND' };
    }

    // 2. Prevent duplicate processing and duplicate provider submissions
    if (
      log.message_id ||
      ['SENT', 'DELIVERED', 'READ'].includes(log.delivery_status)
    ) {
      this.logger.info(
        {
          requestLogId: log.id,
          messageId: log.message_id,
          deliveryStatus: log.delivery_status,
        },
        'Outbound WhatsApp job skipped: message already submitted or delivered',
      );
      return {
        processed: true,
        duplicate: true,
        messageId: log.message_id,
        status: log.delivery_status,
      };
    }

    // 3. Transition status to PROCESSING
    log.delivery_status = 'PROCESSING';
    await log.save();

    // 4. Verify recipient consent and opt-out rules
    let customer: Customer | null = null;
    if (log.customer_id) {
      customer = await Customer.findOne({
        where: { id: log.customer_id, business_id },
      });

      if (!customer) {
        log.delivery_status = 'FAILED';
        log.error_message = 'Associated customer record was not found or deleted';
        await log.save();
        return { processed: false, status: 'FAILED', reason: 'CUSTOMER_NOT_FOUND' };
      }

      const isOptedOut =
        customer.tags?.includes('opted_out') ||
        customer.tags?.includes('unsubscribed') ||
        customer.metadata?.opted_out === true ||
        customer.metadata?.consent === false;

      if (isOptedOut) {
        this.logger.warn(
          {
            businessId: business_id,
            customerId: customer.id,
          },
          'Outbound WhatsApp job aborted: recipient customer has opted out of messages',
        );
        log.delivery_status = 'FAILED';
        log.error_message = 'Customer has opted out of WhatsApp messages';
        await log.save();
        return { processed: false, status: 'FAILED', reason: 'OPTED_OUT' };
      }
    }

    // 5. Verify plan limits / subscription quota
    if (this.usageService) {
      try {
        await this.usageService.CheckCanSendWhatsAppRequest(business_id);
      } catch (quotaErr: any) {
        this.logger.warn(
          {
            businessId: business_id,
            error: quotaErr.message,
          },
          'Outbound WhatsApp job aborted: subscription request limit exhausted',
        );
        log.delivery_status = 'FAILED';
        log.error_message =
          quotaErr.message || 'Monthly WhatsApp request limit reached for plan';
        await log.save();
        return { processed: false, status: 'FAILED', reason: 'LIMIT_EXHAUSTED' };
      }
    }

    // 6. Resolve Business information
    const business = await Business.findOne({ where: { id: business_id } });
    const businessName = business?.name || 'Your Business';

    // 7. Dispatch through Zenvlo Engage WhatsApp provider
    const integrationResult = await this.whatsappService.SendTestimonialRequest({
      businessId: business_id,
      businessName,
      customerName: log.customer_name,
      customerPhone: log.customer_phone,
      testimonialUrl: log.testimonial_url,
      customMessage: log.custom_message || undefined,
    });

    // 8. Handle provider response & state tracking
    if (integrationResult.success && integrationResult.messageId) {
      // Provider accepted message: track as SENT (do NOT equate provider acceptance with device delivery)
      log.message_id = integrationResult.messageId;
      log.delivery_status = 'SENT';
      log.sent_at = new Date();
      log.error_message = null;
      await log.save();

      // Update customer stats
      if (customer) {
        customer.last_request_sent_at = new Date();
        customer.request_count = (customer.request_count || 0) + 1;
        await customer.save();
      }

      // Record billing usage
      if (this.usageService) {
        await this.usageService.IncrementWhatsAppUsage(business_id);
      }

      this.logger.info(
        {
          requestLogId: log.id,
          messageId: log.message_id,
          businessId: business_id,
        },
        'Outbound WhatsApp request successfully submitted to provider',
      );

      return {
        processed: true,
        status: 'SENT',
        messageId: log.message_id,
      };
    } else {
      // Provider failed or rejected
      const statusCode = integrationResult.statusCode;
      const isRetryable =
        statusCode === 429 ||
        (statusCode !== undefined && statusCode >= 500) ||
        integrationResult.errorMessage?.includes('timed out') ||
        integrationResult.errorMessage?.includes('connection error');

      const maxAttempts = job.opts?.attempts || 3;
      if (isRetryable && job.attemptsMade < maxAttempts - 1) {
        log.error_message = `Attempt ${job.attemptsMade + 1} failed: ${integrationResult.errorMessage}`;
        await log.save();

        this.logger.warn(
          {
            requestLogId: log.id,
            attemptsMade: job.attemptsMade,
            statusCode,
            error: integrationResult.errorMessage,
          },
          'Provider encountered temporary error; scheduling retry',
        );

        throw new Error(
          `WhatsApp provider temporary error (${statusCode || 'network'}): ${integrationResult.errorMessage}`,
        );
      }

      // Terminal failure (permanent client error 400/422 or exhausted retries)
      log.delivery_status = 'FAILED';
      log.error_message =
        integrationResult.errorMessage ||
        'WhatsApp provider rejected or failed to process message';
      await log.save();

      this.logger.error(
        {
          requestLogId: log.id,
          businessId: business_id,
          statusCode,
          error: log.error_message,
        },
        'Outbound WhatsApp request permanently failed',
      );

      return {
        processed: false,
        status: 'FAILED',
        error: log.error_message,
      };
    }
  }
}
