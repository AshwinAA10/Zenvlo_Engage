import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { RequestLog, RequestStatus } from '../entities/request-log.entity';
import { Customer } from '../../Customer/entities/customer.entity';
import { Business } from '../../Business/entities/business.entity';
import { InboundWebhookEvent } from '../../Webhook/entities/inbound-webhook-event.entity';
import {
  SendRequestDto,
  BatchSendRequestDto,
  RequestQueryDto,
  WhatsAppWebhookDto,
  RequestStatsDto,
  RequestAnalyticsQueryDto,
  RequestAnalyticsResponseDto,
  DeliveryBreakdownItemDto,
  RequestTrendPointDto,
} from '../models/request.dto';
import {
  WHATSAPP_INTEGRATION_SERVICE,
  IWhatsAppIntegrationService,
} from '../../Integration/interfaces/whatsapp-integration.interface';
import { UsageService } from '../../Billing/services/usage.service';
import { WebhookSecurityService } from '../../Webhook/services/webhook-security.service';
import { QueueService } from '../../Queue/services/queue.service';

const STATUS_RANK: Record<string, number> = {
  QUEUED: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
};

@Injectable()
export class RequestService {
  private readonly webhookSecurity: WebhookSecurityService;

  constructor(
    private readonly logger: PinoLogger,
    @Inject(WHATSAPP_INTEGRATION_SERVICE)
    private readonly whatsappService: IWhatsAppIntegrationService,
    @Optional()
    private readonly queueService?: QueueService,
    @Optional()
    private readonly usageService?: UsageService,
    @Optional()
    webhookSecurityService?: WebhookSecurityService,
    @Optional()
    private readonly configService?: ConfigService,
  ) {
    this.logger.setContext(RequestService.name);
    this.webhookSecurity =
      webhookSecurityService ||
      new WebhookSecurityService(this.logger, this.configService);
  }

  /**
   * Evaluates if a customer has opted out or revoked messaging consent.
   */
  private isCustomerOptedOut(customer: Customer): boolean {
    return (
      customer.tags?.includes('opted_out') ||
      customer.tags?.includes('unsubscribed') ||
      customer.metadata?.opted_out === true ||
      customer.metadata?.consent === false
    );
  }

  async SendSingleRequest(
    businessId: string,
    dto: SendRequestDto,
  ): Promise<RequestLog> {
    if (this.usageService) {
      await this.usageService.CheckCanSendWhatsAppRequest(businessId);
    }

    const business = await Business.findOne({ where: { id: businessId } });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    let customer: Customer | null = null;
    let customerName = dto.customer_name;
    let customerPhone = dto.customer_phone;

    if (dto.customer_id) {
      customer = await Customer.findOne({
        where: { id: dto.customer_id, business_id: businessId },
      });
      if (!customer) {
        throw new NotFoundException(
          'Customer not found or does not belong to your business',
        );
      }

      if (this.isCustomerOptedOut(customer)) {
        throw new BadRequestException(
          'Customer has opted out of WhatsApp messages',
        );
      }

      customerName = customer.name;
      customerPhone = customer.phone;
    }

    if (!customerName || !customerPhone) {
      throw new BadRequestException(
        'Customer name and WhatsApp phone number are required',
      );
    }

    const appBaseUrl =
      process.env.APP_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';
    const testimonialUrl = `${appBaseUrl}/submit/${business.slug}`;

    // 1. Persist message record initially in QUEUED status
    const log = new RequestLog();
    log.business_id = businessId;
    log.customer_id = customer ? customer.id : null;
    log.customer_name = customerName;
    log.customer_phone = customerPhone;
    log.channel = 'WHATSAPP';
    log.template_name = 'testimonial_request';
    log.testimonial_url = testimonialUrl;
    log.custom_message = dto.custom_message || null;
    log.delivery_status = 'QUEUED';
    log.sent_at = new Date();
    log.error_message = null;

    const savedLog = await log.save();

    // 2. Reliable Queue Enqueueing Strategy
    if (this.queueService) {
      try {
        await this.queueService.EnqueueWhatsAppOutbound({
          workspace_id: businessId,
          business_id: businessId,
          request_log_id: savedLog.id,
          customer_id: savedLog.customer_id,
          customer_name: savedLog.customer_name,
          customer_phone: savedLog.customer_phone,
          testimonial_url: savedLog.testimonial_url,
          custom_message: savedLog.custom_message,
          idempotency_key: `outbound_wa:${savedLog.id}`,
        });

        this.logger.info({
          msg: 'WhatsApp testimonial request successfully enqueued',
          requestLogId: savedLog.id,
          businessId,
          deliveryStatus: savedLog.delivery_status,
        });
      } catch (queueErr: any) {
        this.logger.error({
          msg: 'Queue enqueue failed after database persistence',
          requestLogId: savedLog.id,
          businessId,
          error: queueErr.message,
        });
        savedLog.delivery_status = 'FAILED';
        savedLog.error_message = `Queue enqueue failed: ${queueErr.message}`;
        await savedLog.save();

        throw new InternalServerErrorException(
          `Failed to enqueue WhatsApp message: ${queueErr.message}`,
        );
      }
    } else {
      // Synchronous fallback only if QueueService is absent (e.g. isolated test environments)
      const integrationResult = await this.whatsappService.SendTestimonialRequest({
        businessId,
        businessName: business.name,
        customerName,
        customerPhone,
        testimonialUrl,
        customMessage: dto.custom_message,
      });

      const isSuccess = integrationResult.success;
      const deliveryStatus = isSuccess
        ? ((integrationResult.status as RequestStatus) || 'SENT')
        : 'FAILED';

      savedLog.delivery_status = deliveryStatus;
      savedLog.message_id =
        isSuccess && integrationResult.messageId
          ? integrationResult.messageId
          : null;
      savedLog.error_message = isSuccess
        ? null
        : integrationResult.errorMessage ||
          'Provider failed to send WhatsApp message';
      savedLog.sent_at = new Date();

      if (
        isSuccess &&
        (integrationResult.status === 'DELIVERED' ||
          integrationResult.status === 'SENT')
      ) {
        savedLog.delivered_at = new Date();
      }
      await savedLog.save();

      if (customer && isSuccess) {
        customer.last_request_sent_at = new Date();
        customer.request_count = (customer.request_count || 0) + 1;
        await customer.save();
      }

      if (this.usageService && isSuccess) {
        await this.usageService.IncrementWhatsAppUsage(businessId);
      }
    }

    return savedLog;
  }

  async SendBatchRequests(
    businessId: string,
    dto: BatchSendRequestDto,
  ): Promise<{
    total: number;
    queued: number;
    failed: number;
    logs: RequestLog[];
  }> {
    if (!dto.customer_ids || dto.customer_ids.length === 0) {
      throw new BadRequestException('At least one customer ID must be provided');
    }

    const logs: RequestLog[] = [];
    let queued = 0;
    let failed = 0;

    for (const customerId of dto.customer_ids) {
      try {
        const log = await this.SendSingleRequest(businessId, {
          customer_id: customerId,
          custom_message: dto.custom_message,
        });
        logs.push(log);
        if (log.delivery_status === 'FAILED') {
          failed++;
        } else {
          queued++;
        }
      } catch (err: any) {
        this.logger.error({
          msg: 'Failed to send batch request to customer',
          customerId,
          error: err.message,
        });
        failed++;
      }
    }

    return {
      total: dto.customer_ids.length,
      queued,
      failed,
      logs,
    };
  }

  async GetRequestLogs(
    businessId: string,
    query: RequestQueryDto,
  ): Promise<{ data: RequestLog[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const qb = RequestLog.createQueryBuilder('log')
      .where('log.business_id = :businessId', { businessId })
      .orderBy('log.created_on', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.delivery_status) {
      qb.andWhere('log.delivery_status = :status', {
        status: query.delivery_status,
      });
    }

    if (query.customer_id) {
      qb.andWhere('log.customer_id = :customerId', {
        customerId: query.customer_id,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(log.customer_name ILIKE :search OR log.customer_phone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async GetRequestStats(businessId: string): Promise<RequestStatsDto> {
    const logs = await RequestLog.find({
      where: { business_id: businessId },
      select: ['id', 'delivery_status', 'testimonial_id'],
    });

    const total_sent = logs.length;
    let delivered = 0;
    let read = 0;
    let failed = 0;
    let pending_contract = 0;
    let feedback_received = 0;

    for (const log of logs) {
      if (log.delivery_status === 'DELIVERED') delivered++;
      else if (log.delivery_status === 'READ') {
        delivered++;
        read++;
      } else if (log.delivery_status === 'FAILED') failed++;
      else if (log.delivery_status === 'PENDING_CONTRACT') pending_contract++;

      if (log.testimonial_id) feedback_received++;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const delivery_rate =
      total_sent > 0
        ? Math.round(
            ((delivered + (isProduction ? 0 : pending_contract)) / total_sent) *
              100,
          )
        : 100;

    const feedback_conversion_rate =
      total_sent > 0 ? Math.round((feedback_received / total_sent) * 100) : 0;

    return {
      total_sent,
      delivered,
      read,
      failed,
      pending_contract,
      feedback_received,
      delivery_rate,
      feedback_conversion_rate,
    };
  }

  async GetRequestAnalytics(
    businessId: string,
    query: RequestAnalyticsQueryDto,
  ): Promise<RequestAnalyticsResponseDto> {
    const now = new Date();
    const endDate = query.endDate ? new Date(query.endDate) : now;
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid startDate or endDate format');
    }

    if (startDate > endDate) {
      throw new BadRequestException('startDate cannot be after endDate');
    }

    const durationMs = endDate.getTime() - startDate.getTime();
    const maxDurationMs = 366 * 24 * 60 * 60 * 1000;
    if (durationMs > maxDurationMs) {
      throw new BadRequestException('Date range cannot exceed 366 days');
    }

    const prevStartDate = new Date(startDate.getTime() - durationMs);
    const prevEndDate = new Date(startDate.getTime());
    const days = Math.max(1, Math.round(durationMs / (24 * 60 * 60 * 1000)));

    // 1. Fetch current cohort records (tenant-isolated and scoped to active records)
    const currentQb = RequestLog.createQueryBuilder('log')
      .where('log.business_id = :businessId', { businessId })
      .andWhere('log.status = :activeStatus', { activeStatus: 1 })
      .andWhere('log.created_on >= :startDate AND log.created_on <= :endDate', {
        startDate,
        endDate,
      });

    if (query.channel) {
      currentQb.andWhere('log.channel = :channel', { channel: query.channel });
    }

    const currentLogs = await currentQb
      .select([
        'log.id',
        'log.delivery_status',
        'log.testimonial_id',
        'log.created_on',
        'log.delivered_at',
        'log.read_at',
        'log.response_received_at',
      ])
      .orderBy('log.created_on', 'ASC')
      .getMany();

    // 2. Fetch comparative previous cohort records
    const prevQb = RequestLog.createQueryBuilder('log')
      .where('log.business_id = :businessId', { businessId })
      .andWhere('log.status = :activeStatus', { activeStatus: 1 })
      .andWhere('log.created_on >= :prevStartDate AND log.created_on < :prevEndDate', {
        prevStartDate,
        prevEndDate,
      });

    if (query.channel) {
      prevQb.andWhere('log.channel = :channel', { channel: query.channel });
    }

    const prevLogs = await prevQb
      .select(['log.id', 'log.delivery_status', 'log.testimonial_id'])
      .getMany();

    // 3. Current period aggregation & metrics calculation
    const total_requests = currentLogs.length;
    let confirmed_delivered = 0;
    let confirmed_read = 0;
    let confirmed_failed = 0;
    let pending_confirmation = 0;
    let feedback_responses = 0;

    const statusCounts: Record<string, number> = {};

    for (const log of currentLogs) {
      const status = log.delivery_status || 'UNKNOWN';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      if (status === 'DELIVERED') {
        confirmed_delivered++;
      } else if (status === 'READ') {
        confirmed_delivered++;
        confirmed_read++;
      } else if (status === 'FAILED') {
        confirmed_failed++;
      } else {
        // QUEUED, PROCESSING, SUBMITTED, SENT, PENDING_CONTRACT, AMBIGUOUS
        pending_confirmation++;
      }

      if (log.testimonial_id || log.response_received_at) {
        feedback_responses++;
      }
    }

    // Delivery success rate calculated strictly from known terminal outcomes
    const knownOutcomes = confirmed_delivered + confirmed_failed;
    const delivery_success_rate =
      knownOutcomes > 0
        ? Math.round((confirmed_delivered / knownOutcomes) * 1000) / 10
        : null;

    const overall_delivery_rate =
      total_requests > 0
        ? Math.round((confirmed_delivered / total_requests) * 1000) / 10
        : 0;

    const response_rate_delivered =
      confirmed_delivered > 0
        ? Math.round((feedback_responses / confirmed_delivered) * 1000) / 10
        : null;

    const response_rate_total =
      total_requests > 0
        ? Math.round((feedback_responses / total_requests) * 1000) / 10
        : 0;

    // 4. Comparative previous period metrics
    const prev_total_requests = prevLogs.length;
    let prev_confirmed_delivered = 0;
    let prev_feedback_responses = 0;

    for (const pLog of prevLogs) {
      if (pLog.delivery_status === 'DELIVERED' || pLog.delivery_status === 'READ') {
        prev_confirmed_delivered++;
      }
      if (pLog.testimonial_id) {
        prev_feedback_responses++;
      }
    }

    const calcDelta = (curr: number, prev: number): number | null => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 1000) / 10;
    };

    const total_requests_change_pct =
      prev_total_requests > 0 || total_requests > 0
        ? calcDelta(total_requests, prev_total_requests)
        : null;

    const delivered_change_pct =
      prev_confirmed_delivered > 0 || confirmed_delivered > 0
        ? calcDelta(confirmed_delivered, prev_confirmed_delivered)
        : null;

    const responses_change_pct =
      prev_feedback_responses > 0 || feedback_responses > 0
        ? calcDelta(feedback_responses, prev_feedback_responses)
        : null;

    // 5. Delivery status breakdown
    const terminalStatuses = new Set(['DELIVERED', 'READ', 'FAILED']);
    const delivery_breakdown: DeliveryBreakdownItemDto[] = Object.entries(statusCounts).map(
      ([st, cnt]) => ({
        status: st,
        count: cnt,
        percentage:
          total_requests > 0
            ? Math.round((cnt / total_requests) * 1000) / 10
            : 0,
        is_terminal: terminalStatuses.has(st),
      }),
    );

    // 6. Time series trend generation (continuous daily buckets)
    const trendMap = new Map<string, RequestTrendPointDto>();
    const curDate = new Date(startDate);
    curDate.setUTCHours(0, 0, 0, 0);
    const endMidnight = new Date(endDate);
    endMidnight.setUTCHours(23, 59, 59, 999);

    while (curDate <= endMidnight) {
      const dateStr = curDate.toISOString().slice(0, 10);
      trendMap.set(dateStr, {
        date: dateStr,
        created: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        pending: 0,
        responses: 0,
      });
      curDate.setUTCDate(curDate.getUTCDate() + 1);
    }

    for (const log of currentLogs) {
      const logDateStr = new Date(log.created_on).toISOString().slice(0, 10);
      let bucket = trendMap.get(logDateStr);
      if (!bucket) {
        bucket = {
          date: logDateStr,
          created: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          pending: 0,
          responses: 0,
        };
        trendMap.set(logDateStr, bucket);
      }
      bucket.created++;
      if (log.delivery_status === 'DELIVERED') {
        bucket.delivered++;
      } else if (log.delivery_status === 'READ') {
        bucket.delivered++;
        bucket.read++;
      } else if (log.delivery_status === 'FAILED') {
        bucket.failed++;
      } else {
        bucket.pending++;
      }

      if (log.testimonial_id || log.response_received_at) {
        bucket.responses++;
      }
    }

    const trend = Array.from(trendMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        prevStartDate: prevStartDate.toISOString(),
        prevEndDate: prevEndDate.toISOString(),
        days,
      },
      summary: {
        total_requests,
        confirmed_delivered,
        confirmed_read,
        confirmed_failed,
        pending_confirmation,
        feedback_responses,
        delivery_success_rate,
        overall_delivery_rate,
        response_rate_delivered,
        response_rate_total,
      },
      comparison: {
        prev_total_requests,
        prev_confirmed_delivered,
        prev_feedback_responses,
        total_requests_change_pct,
        delivered_change_pct,
        responses_change_pct,
      },
      delivery_breakdown,
      trend,
      meta: {
        channel: query.channel || 'WHATSAPP',
        unknown_outcomes_count: pending_confirmation,
        semantics: {
          delivery_success_rate:
            'Calculated strictly from verified terminal outcomes: (delivered + read) / (delivered + read + failed) * 100. Pending/in-flight dispatches are not treated as delivered or failed.',
          response_rate_delivered:
            'Ratio of customer testimonials submitted to confirmed delivered requests: feedback_responses / (delivered + read) * 100.',
          pending_confirmation:
            'Requests queued, sent to network, or in transit awaiting definitive webhook delivery receipts.',
        },
      },
    };
  }

  async HandleWebhook(
    dto: WhatsAppWebhookDto,
    securityContext?: {
      signature?: string;
      timestamp?: string | number;
      rawBody?: string;
    },
    options?: { async?: boolean },
  ): Promise<{
    updated: boolean;
    ignored?: boolean;
    duplicate?: boolean;
    reason?: string;
    status?: string;
    jobId?: string;
    eventId?: string;
  }> {
    const rawBody = securityContext?.rawBody || JSON.stringify(dto);

    // 1. Payload size check
    this.webhookSecurity.ValidatePayloadSize(rawBody);

    const isProduction =
      (this.configService?.get<string>('NODE_ENV') || process.env.NODE_ENV) ===
      'production';

    // 2. Secret resolution
    const secret =
      this.configService?.get<string>('ZENVLO_WHATSAPP_WEBHOOK_SECRET') ||
      process.env.ZENVLO_WHATSAPP_WEBHOOK_SECRET ||
      this.configService?.get<string>('ZENVLO_WHATSAPP_API_KEY') ||
      process.env.ZENVLO_WHATSAPP_API_KEY;

    // 3. Signature verification (mandatory in production or when signature provided)
    if (isProduction || securityContext?.signature) {
      this.webhookSecurity.VerifySignature(
        rawBody,
        securityContext?.signature,
        secret,
        'Zenvlo WhatsApp Webhook',
      );
    }

    // 4. Timestamp & Replay verification
    const eventTimestamp = securityContext?.timestamp || dto.timestamp;
    if (eventTimestamp !== undefined && eventTimestamp !== null) {
      this.webhookSecurity.ValidateTimestamp(
        eventTimestamp,
        undefined,
        'Zenvlo WhatsApp Webhook',
      );
    } else if (isProduction) {
      throw new BadRequestException('Missing webhook timestamp in production');
    }

    const uppercaseStatus = (dto.status || '').toUpperCase();
    if (!['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'].includes(uppercaseStatus)) {
      throw new BadRequestException(`Invalid delivery status: ${dto.status}`);
    }

    // 5. Durable Inbound Event Recording
    const eventId = `zenvlo_${dto.message_id}_${uppercaseStatus}`;
    let inboundEvent: InboundWebhookEvent | null = null;
    try {
      inboundEvent = await InboundWebhookEvent.findOne({
        where: { provider: 'zenvlo_engage', event_id: eventId },
      });

      if (!inboundEvent) {
        inboundEvent = new InboundWebhookEvent();
        inboundEvent.provider = 'zenvlo_engage';
        inboundEvent.event_id = eventId;
        inboundEvent.event_type = 'message_status_update';
        inboundEvent.payload = dto as any;
        inboundEvent.status = 'RECEIVED';
        inboundEvent.attempts = 0;
        inboundEvent.metadata = {
          raw_timestamp: eventTimestamp,
          signature: securityContext?.signature,
        };
        await inboundEvent.save();
      }
    } catch {
      // Continue gracefully if running in unit test without DB context
    }

    // 6. Asynchronous execution mode
    if (options?.async && this.queueService) {
      try {
        const jobId = await this.queueService.EnqueueWebhook(
          {
            inbound_event_id: inboundEvent?.id,
            provider: 'zenvlo_engage',
            event_id: eventId,
            event_type: 'message_status_update',
            payload: dto,
            raw_timestamp: eventTimestamp,
            ...dto,
          },
          {
            jobId: `wh_${eventId}`,
          },
        );

        if (inboundEvent) {
          inboundEvent.job_id = jobId;
          await inboundEvent.save();
        }

        return { updated: true, status: 'EVENT_RECEIVED', jobId, eventId };
      } catch (queueErr: any) {
        if (inboundEvent) {
          inboundEvent.status = 'FAILED';
          inboundEvent.last_error = `Queue enqueue failed: ${queueErr.message}`;
          await inboundEvent.save();
        }
        throw new InternalServerErrorException(
          `Failed to queue webhook event: ${queueErr.message}`,
        );
      }
    }

    // 7. Idempotent execution wrapper with in-flight lock to protect against concurrency
    const idempotencyKey = `req_wh:${dto.message_id}:${uppercaseStatus}`;

    const execution = await this.webhookSecurity.ExecuteIdempotent(idempotencyKey, async () => {
      const log = await RequestLog.findOne({
        where: { message_id: dto.message_id },
      });

      if (!log) {
        this.logger.warn({
          msg: 'Webhook received for unknown message_id',
          messageId: dto.message_id,
        });
        return { updated: false, reason: 'UNKNOWN_MESSAGE_ID' };
      }

      // 6. Tenant isolation validation: if external payload includes business_id, it must match
      if (dto.business_id && dto.business_id !== log.business_id) {
        this.logger.warn({
          msg: 'Tenant mismatch detected in webhook payload',
          payloadBusinessId: dto.business_id,
          logBusinessId: log.business_id,
        });
        throw new ForbiddenException('Tenant mismatch: Cross-tenant webhook tampering detected');
      }

      // 7. State machine integrity & regression check
      const currentRank = STATUS_RANK[log.delivery_status] || 0;
      const newRank = STATUS_RANK[uppercaseStatus] || 0;

      // Duplicate delivery check at database level
      if (log.delivery_status === uppercaseStatus) {
        this.logger.info({
          msg: 'Webhook delivery status already recorded',
          messageId: dto.message_id,
          status: uppercaseStatus,
        });
        return { updated: false, duplicate: true, reason: 'ALREADY_RECORDED' };
      }

      // State regression prevention
      if (newRank > 0 && currentRank > 0 && newRank < currentRank) {
        this.logger.warn({
          msg: 'Ignoring out-of-order webhook status regression',
          messageId: dto.message_id,
          currentStatus: log.delivery_status,
          incomingStatus: uppercaseStatus,
        });
        return { updated: false, ignored: true, reason: 'STATUS_REGRESSION_PREVENTED' };
      }

      // Failure state validation: cannot fail after already delivered/read
      if (
        uppercaseStatus === 'FAILED' &&
        (log.delivery_status === 'DELIVERED' || log.delivery_status === 'READ')
      ) {
        this.logger.warn({
          msg: 'Ignoring FAILED webhook status for already delivered/read message',
          messageId: dto.message_id,
          currentStatus: log.delivery_status,
        });
        return { updated: false, ignored: true, reason: 'ALREADY_DELIVERED' };
      }

      log.delivery_status = uppercaseStatus as RequestStatus;
      if (uppercaseStatus === 'DELIVERED' && !log.delivered_at) {
        log.delivered_at = new Date();
      }
      if (uppercaseStatus === 'READ') {
        if (!log.delivered_at) log.delivered_at = new Date();
        if (!log.read_at) log.read_at = new Date();
      }
      if (dto.error_message) {
        log.error_message = dto.error_message;
      }

      await log.save();
      return { updated: true };
    });

    if (execution.duplicate) {
      return { updated: false, duplicate: true, reason: 'CONCURRENT_OR_PROCESSED_DUPLICATE' };
    }
    return execution.result || { updated: false };
  }

  async LinkTestimonialFeedback(
    businessId: string,
    customerPhone: string,
    testimonialId: string,
  ): Promise<void> {
    const unlinkedLog = await RequestLog.createQueryBuilder('log')
      .where('log.business_id = :businessId', { businessId })
      .andWhere('log.customer_phone = :phone', { phone: customerPhone })
      .andWhere('log.testimonial_id IS NULL')
      .orderBy('log.created_on', 'DESC')
      .getOne();

    if (unlinkedLog) {
      unlinkedLog.testimonial_id = testimonialId;
      unlinkedLog.response_received_at = new Date();
      await unlinkedLog.save();
      this.logger.info({
        msg: 'Linked public testimonial feedback to WhatsApp request log',
        requestLogId: unlinkedLog.id,
        testimonialId,
      });
    }
  }
}
