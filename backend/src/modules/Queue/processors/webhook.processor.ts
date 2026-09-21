import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { QUEUE_WEBHOOKS } from '../../../common/constants';

@Processor(QUEUE_WEBHOOKS)
export class WebhookProcessor extends WorkerHost {
  constructor(private readonly logger: PinoLogger) {
    super();
    this.logger.setContext(WebhookProcessor.name);
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.info(
      { jobId: job.id, jobName: job.name },
      'Processing asynchronous webhook event in BullMQ worker',
    );

    const { object, entry } = job.data;
    if (object === 'whatsapp_business_account' || object === 'instagram') {
      this.logger.info({ object, entriesCount: entry?.length }, 'Meta webhook payload verified');
    }

    return { processed: true, timestamp: Date.now() };
  }
}
