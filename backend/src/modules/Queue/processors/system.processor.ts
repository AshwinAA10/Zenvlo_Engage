import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import { QUEUE_SYSTEM, JOB_SYSTEM_PING, JOB_SYSTEM_CLEANUP } from '../../../common/constants';
import { BaseTenantWorkerHost } from './base-tenant.processor';
import { SystemJobPayload, SystemPingJobPayload } from '../interfaces/job.interface';

@Processor(QUEUE_SYSTEM)
export class SystemProcessor extends BaseTenantWorkerHost<SystemJobPayload, any> {
  protected readonly queueName = QUEUE_SYSTEM;
  protected readonly requiresTenant = false;

  constructor(logger: PinoLogger, cls: ClsService) {
    super(logger, cls);
    this.logger.setContext(SystemProcessor.name);
  }

  async handleJob(job: Job<SystemJobPayload, any, string>): Promise<any> {
    if (job.name === JOB_SYSTEM_PING) {
      const pingPayload = job.data as SystemPingJobPayload;
      const latencyMs = Date.now() - (pingPayload.requested_at || pingPayload.timestamp || Date.now());
      return {
        pong: true,
        ping_id: pingPayload.ping_id,
        latency_ms: latencyMs,
        processed_at: Date.now(),
      };
    }

    if (job.name === JOB_SYSTEM_CLEANUP) {
      return {
        cleaned: true,
        target: (job.data as any).target || 'default',
        timestamp: Date.now(),
      };
    }

    return { processed: true, name: job.name, timestamp: Date.now() };
  }
}
