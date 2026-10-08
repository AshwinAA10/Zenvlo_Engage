import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { RequestLog, RequestStatus } from '../entities/request-log.entity';
import { Customer } from '../../Customer/entities/customer.entity';
import { Business } from '../../Business/entities/business.entity';
import {
  SendRequestDto,
  BatchSendRequestDto,
  RequestQueryDto,
  WhatsAppWebhookDto,
  RequestStatsDto,
} from '../models/request.dto';
import {
  WHATSAPP_INTEGRATION_SERVICE,
  IWhatsAppIntegrationService,
} from '../../Integration/interfaces/whatsapp-integration.interface';
import { UsageService } from '../../Billing/services/usage.service';
import { WebhookSecurityService } from '../../Webhook/services/webhook-security.service';

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
      ? (integrationResult.status as RequestStatus)
      : 'FAILED';

    const log = new RequestLog();
    log.business_id = businessId;
    log.customer_id = customer ? customer.id : null;
    log.customer_name = customerName;
    log.customer_phone = customerPhone;
    log.channel = 'WHATSAPP';
    log.template_name = 'testimonial_request';
    log.testimonial_url = testimonialUrl;
    log.custom_message = dto.custom_message || null;
    log.delivery_status = deliveryStatus;
    log.message_id =
      isSuccess && integrationResult.messageId
        ? integrationResult.messageId
        : null;
    log.error_message = isSuccess
      ? null
      : integrationResult.errorMessage ||
        'Provider failed to send WhatsApp message';
    log.sent_at = new Date();

    if (
      isSuccess &&
      (integrationResult.status === 'DELIVERED' ||
        integrationResult.status === 'SENT')
    ) {
      log.delivered_at = new Date();
    }

    const savedLog = await log.save();

    if (customer && isSuccess) {
      customer.last_request_sent_at = new Date();
      customer.request_count = (customer.request_count || 0) + 1;
      await customer.save();
    }

    this.logger.info({
      msg: isSuccess
        ? 'WhatsApp testimonial request logged'
        : 'WhatsApp testimonial request failed',
      businessId,
      customerId: log.customer_id,
      deliveryStatus: log.delivery_status,
      messageId: log.message_id,
      errorMessage: log.error_message,
    });

    if (this.usageService && isSuccess) {
      await this.usageService.IncrementWhatsAppUsage(businessId);
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

  async HandleWebhook(
    dto: WhatsAppWebhookDto,
    securityContext?: {
      signature?: string;
      timestamp?: string | number;
      rawBody?: string;
    },
  ): Promise<{ updated: boolean; ignored?: boolean; duplicate?: boolean; reason?: string }> {
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

    // 5. Idempotent execution wrapper with in-flight lock to protect against concurrency
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
