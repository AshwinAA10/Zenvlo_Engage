import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { WebhookReceiver } from '../entities/webhook-receiver.entity';
import { CreateWebhookReceiverDto, UpdateWebhookReceiverDto } from '../models/webhook.dto';
import { QueueService } from '../../Queue/services/queue.service';
import { CLS_WORKSPACE_ID } from '../../../common/constants';

@Injectable()
export class WebhookService {
  constructor(
    private readonly cls: ClsService,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
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

  async EnqueueMetaWebhook(payload: any): Promise<{ status: string; jobId: string }> {
    const jobId = await this.queueService.EnqueueWebhook(payload);
    return { status: 'enqueued', jobId };
  }
}
