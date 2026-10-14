import { Injectable, OnApplicationShutdown, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import {
  QUEUE_SYSTEM,
  QUEUE_WEBHOOKS,
  QUEUE_MESSAGES,
  QUEUE_CAMPAIGNS,
  QUEUE_WHATSAPP_OUTBOUND,
  JOB_SYSTEM_PING,
  JOB_SYSTEM_CLEANUP,
  JOB_META_WEBHOOK,
  JOB_SEND_MESSAGE,
  JOB_SEND_WHATSAPP_REQUEST,
  JOB_PROCESS_CAMPAIGN,
} from '../../../common/constants';
import {
  BaseJobPayload,
  SystemPingJobPayload,
  SystemCleanupJobPayload,
  WebhookJobPayload,
  MessageJobPayload,
  CampaignJobPayload,
  OutboundWhatsAppJobPayload,
} from '../interfaces/job.interface';
import { getDefaultJobOptions } from '../config/queue.config';

@Injectable()
export class QueueService implements OnApplicationShutdown {
  private readonly queueMap: Map<string, Queue>;

  constructor(
    @InjectQueue(QUEUE_SYSTEM) private readonly systemQueue: Queue,
    @InjectQueue(QUEUE_WEBHOOKS) private readonly webhookQueue: Queue,
    @InjectQueue(QUEUE_MESSAGES) private readonly messageQueue: Queue,
    @InjectQueue(QUEUE_CAMPAIGNS) private readonly campaignQueue: Queue,
    @Optional() @InjectQueue(QUEUE_WHATSAPP_OUTBOUND) private readonly whatsappOutboundQueue?: Queue,
  ) {
    this.queueMap = new Map<string, Queue>([
      [QUEUE_SYSTEM, this.systemQueue],
      [QUEUE_WEBHOOKS, this.webhookQueue],
      [QUEUE_MESSAGES, this.messageQueue],
      [QUEUE_CAMPAIGNS, this.campaignQueue],
    ]);
    if (this.whatsappOutboundQueue) {
      this.queueMap.set(QUEUE_WHATSAPP_OUTBOUND, this.whatsappOutboundQueue);
    }
  }

  /**
   * Enqueue a system ping job (used for liveness, test execution, and queue validation).
   */
  async EnqueueSystemPing(
    data: Omit<SystemPingJobPayload, 'timestamp'>,
    options?: JobsOptions,
  ): Promise<string> {
    const payload: SystemPingJobPayload = {
      ...data,
      requested_at: data.requested_at || Date.now(),
      timestamp: Date.now(),
    };
    const job = await this.systemQueue.add(JOB_SYSTEM_PING, payload, {
      ...getDefaultJobOptions(),
      attempts: 2,
      ...options,
    });
    return job.id ? String(job.id) : '';
  }

  /**
   * Enqueue a system cleanup job.
   */
  async EnqueueSystemCleanup(
    data: Omit<SystemCleanupJobPayload, 'timestamp'>,
    options?: JobsOptions,
  ): Promise<string> {
    const payload: SystemCleanupJobPayload = {
      ...data,
      timestamp: Date.now(),
    };
    const job = await this.systemQueue.add(JOB_SYSTEM_CLEANUP, payload, {
      ...getDefaultJobOptions(),
      ...options,
    });
    return job.id ? String(job.id) : '';
  }

  /**
   * Enqueue inbound Meta webhook payload.
   */
  async EnqueueWebhook(data: WebhookJobPayload | any, options?: JobsOptions): Promise<string> {
    const payload = {
      timestamp: Date.now(),
      ...data,
    };
    const job = await this.webhookQueue.add(JOB_META_WEBHOOK, payload, {
      ...getDefaultJobOptions(),
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      ...options,
    });
    return job.id ? String(job.id) : '';
  }

  /**
   * Enqueue message dispatch job.
   */
  async EnqueueMessage(data: MessageJobPayload | any, options?: JobsOptions): Promise<string> {
    const payload = {
      timestamp: Date.now(),
      ...data,
    };
    const job = await this.messageQueue.add(JOB_SEND_MESSAGE, payload, {
      ...getDefaultJobOptions(),
      attempts: 3,
      ...options,
    });
    return job.id ? String(job.id) : '';
  }

  /**
   * Enqueue campaign batch job.
   */
  async EnqueueCampaign(data: CampaignJobPayload | any, options?: JobsOptions): Promise<string> {
    const payload = {
      timestamp: Date.now(),
      ...data,
    };
    const job = await this.campaignQueue.add(JOB_PROCESS_CAMPAIGN, payload, {
      ...getDefaultJobOptions(),
      attempts: 5,
      ...options,
    });
    return job.id ? String(job.id) : '';
  }

  /**
   * Enqueue outbound WhatsApp testimonial request job.
   */
  async EnqueueWhatsAppOutbound(
    data: Omit<OutboundWhatsAppJobPayload, 'timestamp'>,
    options?: JobsOptions,
  ): Promise<string> {
    if (!this.whatsappOutboundQueue) {
      throw new Error(`Queue '${QUEUE_WHATSAPP_OUTBOUND}' is not registered in QueueService`);
    }
    const payload: OutboundWhatsAppJobPayload = {
      ...data,
      timestamp: Date.now(),
    };
    const job = await this.whatsappOutboundQueue.add(JOB_SEND_WHATSAPP_REQUEST, payload, {
      ...getDefaultJobOptions(),
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      ...options,
    });
    return job.id ? String(job.id) : '';
  }

  /**
   * Generic strongly-typed enqueue method for custom queues and jobs.
   */
  async EnqueueJob<T extends BaseJobPayload>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobsOptions,
  ): Promise<string> {
    const queue = this.GetQueue(queueName);
    const payload: T = {
      ...data,
      timestamp: data.timestamp ?? Date.now(),
    };
    const job = await queue.add(jobName, payload, {
      ...getDefaultJobOptions(),
      ...options,
    });
    return job.id ? String(job.id) : '';
  }

  /**
   * Retrieves a registered BullMQ queue instance by name.
   */
  GetQueue(queueName: string): Queue {
    const queue = this.queueMap.get(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' is not registered in QueueService`);
    }
    return queue;
  }

  /**
   * Returns a map of all registered BullMQ queues.
   */
  GetAllQueues(): Map<string, Queue> {
    return this.queueMap;
  }

  /**
   * Gracefully close all BullMQ queue connections on application shutdown.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.CloseAll();
  }

  /**
   * Close all queue connections safely.
   */
  async CloseAll(): Promise<void> {
    const closePromises = Array.from(this.queueMap.values()).map(async (queue) => {
      try {
        await queue.close();
      } catch {
        // Ignore errors during closing
      }
    });
    await Promise.all(closePromises);
  }
}
