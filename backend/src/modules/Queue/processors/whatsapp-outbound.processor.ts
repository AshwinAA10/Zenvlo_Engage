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
  ISendTestimonialRequestResult,
} from '../../Integration/interfaces/whatsapp-integration.interface';
import { RequestLog } from '../../Request/entities/request-log.entity';
import { Customer } from '../../Customer/entities/customer.entity';
import { Business } from '../../Business/entities/business.entity';
import { UsageService } from '../../Billing/services/usage.service';
import {
  classifyFailure,
  ErrorCategory,
} from '../errors/failure-classification';
import { calculateBackoffWithJitter } from '../config/queue.config';

/**
 * BullMQ Worker Processor for asynchronous outbound WhatsApp messages.
 *
 * Reliability & Failure Handling Invariants:
 * - Strictly validates and propagates tenant workspace context via ClsService.
 * - Authoritatively queries persisted RequestLog to prevent phantom sends.
 * - Idempotently checks if the message was already submitted, preventing duplicate WhatsApp messages on retry.
 * - Enforces recipient consent and opt-out rules prior to provider transmission.
 * - Enforces monthly subscription usage quotas.
 * - Differentiates provider acceptance (status: SENT) from device delivery (status: DELIVERED via webhook).
 * - Distinguishes retryable errors (429, 5xx, timeout) from permanent errors (400, 422).
 * - Implements failure classification with jittered exponential backoff and rate-limit respect.
 * - Safeguards ambiguous outcomes (timeouts after dispatch) by marking AMBIGUOUS and halting blind retries.
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
    const businessId = business_id;
    const maxAttempts = job.opts?.attempts || 3;
    const currentAttempt = job.attemptsMade + 1;

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

    // 2. Prevent duplicate processing and duplicate provider submissions (Idempotency)
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
        log.error_message =
          '[PERMANENT_VALIDATION] Associated customer record was not found or deleted';
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
        log.error_message =
          '[PERMANENT_VALIDATION] Customer has opted out of WhatsApp messages';
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
        log.error_message = `[PERMANENT_VALIDATION] ${
          quotaErr.message || 'Monthly WhatsApp request limit reached for plan'
        }`;
        await log.save();
        return { processed: false, status: 'FAILED', reason: 'LIMIT_EXHAUSTED' };
      }
    }

    // 6. Resolve Business information
    const business = await Business.findOne({ where: { id: business_id } });
    const businessName = business?.name || 'Your Business';

    // 7. Dispatch through Zenvlo Engage WhatsApp provider
    let integrationResult: ISendTestimonialRequestResult;
    try {
      integrationResult = await this.whatsappService.SendTestimonialRequest({
        businessId: business_id,
        businessName,
        customerName: log.customer_name,
        customerPhone: log.customer_phone,
        testimonialUrl: log.testimonial_url,
        customMessage: log.custom_message || undefined,
      });
    } catch (dispatchErr: any) {
      const isTimeout =
        dispatchErr?.name === 'AbortError' ||
        dispatchErr?.message?.includes('timed out');
      integrationResult = {
        success: false,
        status: 'FAILED',
        statusCode: isTimeout ? 504 : 0,
        isTimeout,
        errorMessage: dispatchErr?.message || 'Provider connection error',
      };
    }

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
      // Classify the failure
      const classification = classifyFailure(integrationResult.errorMessage, {
        statusCode: integrationResult.statusCode,
        retryAfterSeconds: integrationResult.retryAfterSeconds,
        isTimeout: integrationResult.isTimeout,
        hasSentPayload: true,
        attemptsMade: job.attemptsMade,
        maxAttempts,
      });

      // 9. Ambiguous outcome handling (safeguarded: do NOT blindly retry!)
      if (
        classification.category === ErrorCategory.AMBIGUOUS_OUTCOME ||
        integrationResult.isAmbiguous
      ) {
        log.delivery_status = 'AMBIGUOUS';
        log.error_message = `[AMBIGUOUS_OUTCOME] Attempt ${currentAttempt}/${maxAttempts} timed out after dispatch. Reconciliation required: ${classification.reason}`;
        await log.save();

        this.logger.warn(
          {
            requestLogId: log.id,
            businessId,
            currentAttempt,
            error: classification.reason,
          },
          'WhatsApp submission outcome ambiguous; halting blind retries to prevent duplicate delivery',
        );

        return {
          processed: false,
          status: 'AMBIGUOUS',
          reason: 'AMBIGUOUS_OUTCOME',
          error: log.error_message,
        };
      }

      // 10. Non-retryable Permanent Failures (Client validation errors 400/422, credentials 401/403)
      if (!classification.isRetryable) {
        log.delivery_status = 'FAILED';
        log.error_message = `[${classification.category}] ${classification.reason}`;
        await log.save();

        this.logger.error(
          {
            requestLogId: log.id,
            businessId,
            statusCode: classification.statusCode,
            category: classification.category,
            error: log.error_message,
          },
          'Outbound WhatsApp request permanently failed (terminal non-retryable)',
        );

        return {
          processed: false,
          status: 'FAILED',
          category: classification.category,
          error: log.error_message,
        };
      }

      // 11. Retryable Failures (429 Rate Limit, 5xx Server Error, Transient Network)
      if (job.attemptsMade < maxAttempts - 1) {
        log.delivery_status = 'PROCESSING';
        log.error_message = `Attempt ${currentAttempt} failed: [${classification.category}] ${classification.reason}`;
        await log.save();

        const jitteredDelayMs = classification.retryAfterSeconds
          ? classification.retryAfterSeconds * 1000
          : calculateBackoffWithJitter(job.attemptsMade, 2000, 60000, 0.2);

        this.logger.warn(
          {
            requestLogId: log.id,
            attemptsMade: job.attemptsMade,
            nextAttempt: currentAttempt + 1,
            category: classification.category,
            backoffMs: jitteredDelayMs,
            error: classification.reason,
          },
          'Provider encountered temporary error; scheduling retry with backoff',
        );

        // Throw error so BullMQ triggers configured exponential backoff retry
        throw new Error(
          `WhatsApp provider temporary error (${classification.statusCode || 'network'}): ${classification.reason}`,
        );
      }

      // 12. Exhausted all retries (Terminal state in DLQ)
      log.delivery_status = 'FAILED';
      log.error_message = `[${classification.category}] All ${maxAttempts} attempts exhausted at ${classification.timestamp}. Final error: ${classification.reason}`;
      await log.save();

      this.logger.error(
        {
          requestLogId: log.id,
          businessId,
          attemptsMade: currentAttempt,
          category: classification.category,
          error: log.error_message,
        },
        'Outbound WhatsApp request retries exhausted; marked as FAILED in terminal state',
      );

      // Throw error on final attempt so BullMQ moves the job to the failed set (DLQ)
      throw new Error(
        `WhatsApp provider retries exhausted (${maxAttempts}/${maxAttempts}): ${classification.reason}`,
      );
    }
  }
}
