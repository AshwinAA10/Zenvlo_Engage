import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { WebhookReceiver } from '../entities/webhook-receiver.entity';
import { CreateWebhookReceiverDto, UpdateWebhookReceiverDto } from '../models/webhook.dto';
import { QueueService } from '../../Queue/services/queue.service';
import { WebhookSecurityService } from './webhook-security.service';
import { CLS_WORKSPACE_ID } from '../../../common/constants';

@Injectable()
export class WebhookService {
  constructor(
    private readonly cls: ClsService,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
    private readonly webhookSecurityService: WebhookSecurityService,
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

    // 5. Idempotency deduplication
    const changeVal = payload.entry?.[0]?.changes?.[0]?.value;
    const eventId =
      changeVal?.statuses?.[0]?.id ||
      changeVal?.messages?.[0]?.id ||
      `${payload.entry?.[0]?.id || 'meta'}_${timestamp || Date.now()}_${payload.object}`;

    const idempotencyKey = `meta_wh:${eventId}`;

    const execution = await this.webhookSecurityService.ExecuteIdempotent(
      idempotencyKey,
      async () => {
        const jobId = await this.queueService.EnqueueWebhook(payload);
        return jobId;
      },
    );

    if (execution.duplicate) {
      return { status: 'ALREADY_PROCESSED', duplicate: true };
    }

    return { status: 'EVENT_RECEIVED', jobId: execution.result };
  }
}
