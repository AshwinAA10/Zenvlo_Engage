import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

@Injectable()
export class RequestService {
  constructor(
    private readonly logger: PinoLogger,
    @Inject(WHATSAPP_INTEGRATION_SERVICE)
    private readonly whatsappService: IWhatsAppIntegrationService,
    @Optional()
    private readonly usageService?: UsageService,
  ) {
    this.logger.setContext(RequestService.name);
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

    const log = new RequestLog();
    log.business_id = businessId;
    log.customer_id = customer ? customer.id : null;
    log.customer_name = customerName;
    log.customer_phone = customerPhone;
    log.channel = 'WHATSAPP';
    log.template_name = 'testimonial_request';
    log.testimonial_url = testimonialUrl;
    log.custom_message = dto.custom_message || null;
    log.delivery_status = integrationResult.status as RequestStatus;
    log.message_id = integrationResult.messageId || null;
    log.error_message = integrationResult.errorMessage || null;
    log.sent_at = new Date();

    if (
      integrationResult.status === 'DELIVERED' ||
      integrationResult.status === 'SENT'
    ) {
      log.delivered_at = new Date();
    }

    const savedLog = await log.save();

    if (customer) {
      customer.last_request_sent_at = new Date();
      customer.request_count = (customer.request_count || 0) + 1;
      await customer.save();
    }

    this.logger.info({
      msg: 'WhatsApp testimonial request logged',
      businessId,
      customerId: log.customer_id,
      deliveryStatus: log.delivery_status,
      messageId: log.message_id,
    });

    if (this.usageService) {
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
        queued++;
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

    const delivery_rate =
      total_sent > 0
        ? Math.round(((delivered + pending_contract) / total_sent) * 100)
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

  async HandleWebhook(dto: WhatsAppWebhookDto): Promise<{ updated: boolean }> {
    const log = await RequestLog.findOne({
      where: { message_id: dto.message_id },
    });

    if (!log) {
      this.logger.warn({
        msg: 'Webhook received for unknown message_id',
        messageId: dto.message_id,
      });
      return { updated: false };
    }

    const uppercaseStatus = dto.status.toUpperCase();
    if (
      ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'].includes(
        uppercaseStatus,
      )
    ) {
      log.delivery_status = uppercaseStatus as RequestStatus;
      if (uppercaseStatus === 'DELIVERED' && !log.delivered_at) {
        log.delivered_at = new Date();
      }
      if (uppercaseStatus === 'READ' && !log.read_at) {
        log.read_at = new Date();
      }
    }

    if (dto.error_message) {
      log.error_message = dto.error_message;
    }

    await log.save();
    return { updated: true };
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
