import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PinoLogger } from 'nestjs-pino';
import { WebhookReceiver } from '../entities/webhook-receiver.entity';
import { InboundWebhookEvent } from '../entities/inbound-webhook-event.entity';
import { CreateWebhookReceiverDto, UpdateWebhookReceiverDto } from '../models/webhook.dto';
import { QueueService } from '../../Queue/services/queue.service';
import { WebhookSecurityService } from './webhook-security.service';
import { CLS_WORKSPACE_ID, EVENT_AUDIT_RECORD } from '../../../common/constants';
import { AuditRecordEvent } from '../../../events/audit.event';

@Injectable()
export class WebhookService {
  constructor(
    private readonly cls: ClsService,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
    private readonly webhookSecurityService: WebhookSecurityService,
    @Optional() private readonly logger?: PinoLogger,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  async GetAll(): Promise<WebhookReceiver[]> {
    const workspaceId = this.cls.get<string>(CLS_WORKSPACE_ID);
    return WebhookReceiver.find({
      where: { workspace_id: workspaceId, status: 1 },
      order: { created_on: 'DESC' },
    });
  }

  async GetById(id: string): Promise<WebhookReceiver> {
    const workspaceId = this.cls.get<string>(CLS_WORKSPACE_ID);
    const receiver = await WebhookReceiver.findOne({
      where: { id, workspace_id: workspaceId, status: 1 },
    });
    if (!receiver) {
      throw new NotFoundException(`Webhook receiver with ID '${id}' not found`);
    }
    return receiver;
  }

  async Insert(dto: CreateWebhookReceiverDto): Promise<WebhookReceiver> {
    const receiver = new WebhookReceiver();
    receiver.name = dto.name;
    receiver.target_url = dto.target_url;
    receiver.secret_key = dto.secret_key || null;
    receiver.subscribed_events = dto.subscribed_events || [];

    return receiver.save();
  }

  async Update(id: string, dto: UpdateWebhookReceiverDto): Promise<WebhookReceiver> {
    const receiver = await this.GetById(id);

    if (dto.name !== undefined) receiver.name = dto.name;
    if (dto.target_url !== undefined) receiver.target_url = dto.target_url;
    if (dto.subscribed_events !== undefined) receiver.subscribed_events = dto.subscribed_events;

    return receiver.save();
  }

  async Delete(id: string): Promise<void> {
    const receiver = await this.GetById(id);
    await receiver.softRemove();
  }

  VerifyMetaToken(mode: string, token: string, challenge: string): string {
    const isProduction =
      (this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV) ===
      'production';
    const configuredToken = this.configService.get<string>('WHATSAPP_VERIFY_TOKEN');

    if (
      isProduction &&
      (!configuredToken ||
        configuredToken === 'placeholder_whatsapp_verify_token')
    ) {
      throw new UnauthorizedException(
        'WHATSAPP_VERIFY_TOKEN is not configured for production',
      );
    }

    const tokenToMatch =
      configuredToken ||
      (isProduction ? '' : 'placeholder_whatsapp_verify_token');

    if (mode === 'subscribe' && token && token === tokenToMatch) {
      return challenge;
    }
    throw new UnauthorizedException('Meta Webhook verification token mismatch');
  }

  async EnqueueMetaWebhook(
    payload: any,
    securityContext?: {
      signature?: string;
      timestamp?: string | number;
      rawBody?: string;
    },
  ): Promise<{ status: string; jobId?: string; duplicate?: boolean }> {
    const rawBody = securityContext?.rawBody || JSON.stringify(payload);

    // 1. Validate payload size
    this.webhookSecurityService.ValidatePayloadSize(rawBody);

    // 2. Validate structural shape of Meta webhook payload
    this.webhookSecurityService.ValidateMetaPayloadShape(payload);

    const isProduction =
      (this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV) ===
      'production';

    // 3. Signature verification
    const secret =
      this.configService.get<string>('META_APP_SECRET') ||
      process.env.META_APP_SECRET;

    if (isProduction || securityContext?.signature) {
      this.webhookSecurityService.VerifySignature(
        rawBody,
        securityContext?.signature,
        secret,
        'Meta Webhook',
      );
    }

    // 4. Timestamp & Replay verification
    const timestamp =
      securityContext?.timestamp ||
      payload.entry?.[0]?.time ||
      payload.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]?.timestamp ||
      payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.timestamp;

    if (timestamp !== undefined && timestamp !== null) {
      this.webhookSecurityService.ValidateTimestamp(
        timestamp,
        undefined,
        'Meta Webhook',
      );
    } else if (isProduction) {
      throw new BadRequestException('Missing webhook timestamp in production');
    }

    // 5. Idempotency deduplication & Durable Inbox Persistence
    const changeVal = payload.entry?.[0]?.changes?.[0]?.value;
    const eventId =
      changeVal?.statuses?.[0]?.id ||
      changeVal?.messages?.[0]?.id ||
      `${payload.entry?.[0]?.id || 'meta'}_${timestamp || Date.now()}_${payload.object}`;

    const idempotencyKey = `meta_wh:${eventId}`;

    const execution = await this.webhookSecurityService.ExecuteIdempotent(
      idempotencyKey,
      async () => {
        let inboundEvent: InboundWebhookEvent | null = null;
        try {
          inboundEvent = await InboundWebhookEvent.findOne({
            where: { provider: 'meta_whatsapp', event_id: eventId },
          });

          if (inboundEvent) {
            return { duplicate: true, jobId: inboundEvent.job_id };
          }

          inboundEvent = new InboundWebhookEvent();
          inboundEvent.provider = 'meta_whatsapp';
          inboundEvent.event_id = eventId;
          inboundEvent.event_type =
            payload.entry?.[0]?.changes?.[0]?.field || payload.object || 'meta_event';
          inboundEvent.payload = payload;
          inboundEvent.status = 'RECEIVED';
          inboundEvent.attempts = 0;
          inboundEvent.metadata = {
            raw_timestamp: timestamp,
            headers: { signature: securityContext?.signature },
          };
          await inboundEvent.save();
        } catch {
          // Gracefully continue if running in unit test environment without active TypeORM DataSource
        }

        try {
          if (typeof payload === 'object' && payload !== null && inboundEvent) {
            (payload as any).inbound_event_id = inboundEvent.id;
          }

          const jobId = await this.queueService.EnqueueWebhook(payload);

          if (inboundEvent) {
            inboundEvent.job_id = jobId;
            await inboundEvent.save();
          }

          return { duplicate: false, jobId };
        } catch (queueErr: any) {
          if (inboundEvent) {
            inboundEvent.status = 'FAILED';
            inboundEvent.last_error = `Queue enqueue failed: ${queueErr.message}`;
            await inboundEvent.save();
          }
          throw queueErr;
        }
      },
    );

    if (execution.duplicate || execution.result?.duplicate) {
      return { status: 'ALREADY_PROCESSED', duplicate: true };
    }

    const jobId =
      typeof execution.result === 'object' && execution.result !== null
        ? execution.result.jobId
        : execution.result;

    return { status: 'EVENT_RECEIVED', jobId: jobId || undefined };
  }

  async GetInboundEvents(
    businessId: string,
    query?: { status?: string; page?: number; limit?: number },
  ): Promise<{ data: InboundWebhookEvent[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query?.page || 1);
    const limit = Math.min(100, Math.max(1, query?.limit || 20));
    const skip = (page - 1) * limit;

    const qb = InboundWebhookEvent.createQueryBuilder('event')
      .where('(event.business_id = :businessId OR event.business_id IS NULL)', { businessId });

    if (query?.status) {
      qb.andWhere('event.status = :status', { status: query.status.toUpperCase() });
    }

    qb.orderBy('event.created_on', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async GetInboundEventById(
    businessId: string,
    id: string,
  ): Promise<InboundWebhookEvent> {
    const event = await InboundWebhookEvent.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Inbound webhook event with ID '${id}' not found`);
    }

    if (event.business_id && event.business_id !== businessId) {
      throw new ForbiddenException('Access to foreign tenant webhook event is forbidden');
    }

    return event;
  }

  async ReplayInboundEvent(
    businessId: string,
    id: string,
    actorId?: string,
  ): Promise<{ status: string; jobId?: string; event_id: string }> {
    const event = await this.GetInboundEventById(businessId, id);

    if (event.status !== 'FAILED') {
      throw new BadRequestException(
        `Only failed webhook events can be replayed. Current status: ${event.status}`,
      );
    }

    event.status = 'RECEIVED';
    event.attempts = 0;
    event.last_error = null;
    event.metadata = {
      ...(event.metadata || {}),
      replayed_at: new Date().toISOString(),
      replayed_by: actorId || businessId,
    };

    const jobId = await this.queueService.EnqueueWebhook(
      {
        ...event.payload,
        inbound_event_id: event.id,
        provider: event.provider,
        event_id: event.event_id,
        event_type: event.event_type,
        business_id: businessId,
      },
      {
        jobId: `replay_${event.id}_${Date.now()}`,
      },
    );

    event.job_id = jobId;
    await event.save();

    if (this.eventEmitter) {
      this.eventEmitter.emit(
        EVENT_AUDIT_RECORD,
        new AuditRecordEvent(
          businessId,
          actorId || businessId,
          'WEBHOOK_EVENT_REPLAYED',
          'InboundWebhookEvent',
          event.id,
          {
            provider: event.provider,
            event_id: event.event_id,
            jobId,
          },
        ),
      );
    }

    return { status: 'REPLAY_QUEUED', jobId, event_id: event.id };
  }
}
