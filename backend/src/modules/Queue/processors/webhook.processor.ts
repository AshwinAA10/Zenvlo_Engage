import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import { QUEUE_WEBHOOKS } from '../../../common/constants';
import { BaseTenantWorkerHost } from './base-tenant.processor';
import { WebhookJobPayload } from '../interfaces/job.interface';

@Processor(QUEUE_WEBHOOKS)
export class WebhookProcessor extends BaseTenantWorkerHost<WebhookJobPayload, any> {
  protected readonly queueName = QUEUE_WEBHOOKS;
  protected readonly requiresTenant = false;

  constructor(logger: PinoLogger, cls: ClsService) {
    super(logger, cls);
    this.logger.setContext(WebhookProcessor.name);
  }

  async handleJob(job: Job<WebhookJobPayload, any, string>): Promise<any> {
    const { object, entry } = job.data;
    if (object === 'whatsapp_business_account' || object === 'instagram') {
      this.logger.info(
        { object, entriesCount: entry?.length },
        'Meta webhook payload verified in worker',
      );
    }

    return { processed: true, timestamp: Date.now() };
  }
}
