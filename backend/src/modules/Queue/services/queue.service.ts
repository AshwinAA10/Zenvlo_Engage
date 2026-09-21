import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_WEBHOOKS, QUEUE_MESSAGES, QUEUE_CAMPAIGNS } from '../../../common/constants';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUE_WEBHOOKS) private readonly webhookQueue: Queue,
    @InjectQueue(QUEUE_MESSAGES) private readonly messageQueue: Queue,
    @InjectQueue(QUEUE_CAMPAIGNS) private readonly campaignQueue: Queue,
  ) {}

  async EnqueueWebhook(data: any): Promise<string> {
    const job = await this.webhookQueue.add('meta-webhook-event', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
    return job.id ? String(job.id) : '';
  }

  async EnqueueMessage(data: any): Promise<string> {
    const job = await this.messageQueue.add('send-message', data, {
      attempts: 3,
      removeOnComplete: true,
    });
    return job.id ? String(job.id) : '';
  }

  async EnqueueCampaign(data: any): Promise<string> {
    const job = await this.campaignQueue.add('process-campaign', data, {
      attempts: 5,
      removeOnComplete: false,
    });
    return job.id ? String(job.id) : '';
  }
}
