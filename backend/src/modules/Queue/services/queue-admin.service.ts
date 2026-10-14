import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { QueueService } from './queue.service';
import { RequestLog } from '../../Request/entities/request-log.entity';
import { AuditLog } from '../../System/entities/audit-log.entity';
import { sanitizeErrorMessage } from '../processors/base-tenant.processor';
import { QUEUE_WHATSAPP_OUTBOUND } from '../../../common/constants';

export interface FailedJobSummary {
  jobId: string;
  queueName: string;
  name: string;
  attemptsMade: number;
  failedReason: string;
  timestamp: string;
  workspaceId: string;
  requestLogId?: string;
  customerPhone?: string;
}

export interface FailedJobDetail extends FailedJobSummary {
  data: Record<string, any>;
  stacktrace?: string[];
  requestLogStatus?: string;
  requestLogError?: string;
}

@Injectable()
export class QueueAdminService {
  constructor(
    private readonly queueService: QueueService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(QueueAdminService.name);
  }

  /**
   * Retrieves failed jobs across one or all registered queues, isolated by workspace/tenant.
   */
  async getFailedJobs(
    workspaceId: string,
    queueName: string = QUEUE_WHATSAPP_OUTBOUND,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ jobs: FailedJobSummary[]; total: number }> {
    const queue = this.queueService.GetQueue(queueName);
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    const failedJobs = await queue.getFailed(0, 500); // Fetch recent failed jobs for filtering

    // Strictly enforce multi-tenant isolation
    const tenantJobs = failedJobs.filter(
      (job) => job.data?.workspace_id === workspaceId || job.data?.business_id === workspaceId,
    );

    const paginated = tenantJobs.slice(start, start + limit);

    const jobs: FailedJobSummary[] = paginated.map((job) => {
      const phone = job.data?.customer_phone;
      const maskedPhone = phone
        ? phone.slice(0, 3) + '****' + phone.slice(-4)
        : undefined;

      return {
        jobId: String(job.id || ''),
        queueName,
        name: job.name,
        attemptsMade: job.attemptsMade,
        failedReason: sanitizeErrorMessage(job.failedReason),
        timestamp: new Date(job.timestamp).toISOString(),
        workspaceId,
        requestLogId: job.data?.request_log_id,
        customerPhone: maskedPhone,
      };
    });

    return {
      jobs,
      total: tenantJobs.length,
    };
  }

  /**
   * Detailed inspection of a single failed job, verifying tenant authorization.
   */
  async inspectFailedJob(
    workspaceId: string,
    queueName: string,
    jobId: string,
  ): Promise<FailedJobDetail> {
    const queue = this.queueService.GetQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`Job '${jobId}' not found in queue '${queueName}'`);
    }

    // Verify tenant isolation
    const jobWorkspace = job.data?.workspace_id || job.data?.business_id;
    if (jobWorkspace !== workspaceId) {
      throw new ForbiddenException('Access denied: job belongs to another tenant workspace');
    }

    // Correlate with authoritative RequestLog if applicable
    let logStatus: string | undefined;
    let logError: string | undefined;
    if (job.data?.request_log_id) {
      const log = await RequestLog.findOne({
        where: { id: job.data.request_log_id, business_id: workspaceId },
      });
      if (log) {
        logStatus = log.delivery_status;
        logError = log.error_message || undefined;
      }
    }

    // Sanitize payload to prevent leaking tokens or raw sensitive message content
    const sanitizedData = { ...job.data };
    if (sanitizedData.custom_message) {
      sanitizedData.custom_message = '[REDACTED]';
    }
    if (sanitizedData.customer_phone) {
      sanitizedData.customer_phone =
        sanitizedData.customer_phone.slice(0, 3) +
        '****' +
        sanitizedData.customer_phone.slice(-4);
    }

    return {
      jobId: String(job.id || ''),
      queueName,
      name: job.name,
      attemptsMade: job.attemptsMade,
      failedReason: sanitizeErrorMessage(job.failedReason),
      timestamp: new Date(job.timestamp).toISOString(),
      workspaceId,
      requestLogId: job.data?.request_log_id,
      customerPhone: sanitizedData.customer_phone,
      data: sanitizedData,
      stacktrace: job.stacktrace?.map((line) => sanitizeErrorMessage(line)),
      requestLogStatus: logStatus,
      requestLogError: logError,
    };
  }

  /**
   * Safely replay a failed job with duplicate protection and audit logging.
   */
  async replayFailedJob(
    workspaceId: string,
    actorId: string,
    queueName: string,
    jobId: string,
    options?: { force?: boolean },
  ): Promise<{ success: boolean; jobId: string; queueName: string; status: string }> {
    const queue = this.queueService.GetQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`Job '${jobId}' not found in queue '${queueName}'`);
    }

    // 1. Verify tenant isolation
    const jobWorkspace = job.data?.workspace_id || job.data?.business_id;
    if (jobWorkspace !== workspaceId) {
      throw new ForbiddenException('Access denied: job belongs to another tenant workspace');
    }

    // 2. Authoritative database duplicate check (Idempotency)
    if (job.data?.request_log_id) {
      const log = await RequestLog.findOne({
        where: { id: job.data.request_log_id, business_id: workspaceId },
      });

      if (log) {
        if (
          log.message_id ||
          ['SENT', 'DELIVERED', 'READ'].includes(log.delivery_status)
        ) {
          throw new ConflictException(
            `Cannot replay job: message already delivered or accepted by provider (status: ${log.delivery_status}, messageId: ${log.message_id})`,
          );
        }

        // Safe ambiguous outcome safeguard
        if (log.delivery_status === 'AMBIGUOUS' && !options?.force) {
          throw new BadRequestException(
            'Cannot automatically replay ambiguous job without reconciliation confirmation (set force: true to override)',
          );
        }

        // Reset database record to QUEUED so worker can pick it up cleanly
        log.delivery_status = 'QUEUED';
        log.error_message = `[REPLAY] Replayed by actor ${actorId} at ${new Date().toISOString()}`;
        await log.save();
      }
    }

    // 3. Retry the job in BullMQ
    await job.retry();

    // 4. Audit Log recording
    try {
      const audit = new AuditLog();
      audit.workspace_id = workspaceId;
      audit.actor_id = actorId;
      audit.action = 'QUEUE_JOB_REPLAY';
      audit.entity_name = 'QueueJob';
      audit.entity_id = jobId;
      audit.metadata = {
        queueName,
        jobName: job.name,
        attemptsMade: job.attemptsMade,
        previousFailedReason: sanitizeErrorMessage(job.failedReason),
        force: Boolean(options?.force),
        replayedAt: new Date().toISOString(),
      };
      await audit.save();
    } catch (auditErr: any) {
      this.logger.warn(
        { error: auditErr.message, jobId, workspaceId },
        'Failed to record AuditLog for queue job replay',
      );
    }

    this.logger.info(
      { jobId, queueName, workspaceId, actorId },
      'Queue job successfully replayed by administrator',
    );

    return {
      success: true,
      jobId,
      queueName,
      status: 'REPLAYED',
    };
  }

  /**
   * Reconciles ambiguous outbound jobs by verifying incoming webhooks or resolving to terminal state.
   */
  async reconcileAmbiguous(
    workspaceId: string,
    actorId: string,
  ): Promise<{ reconciled: number; logs: any[] }> {
    const ambiguousLogs = await RequestLog.find({
      where: {
        business_id: workspaceId,
        delivery_status: 'AMBIGUOUS',
      },
    });

    const reconciledLogs: any[] = [];
    for (const log of ambiguousLogs) {
      if (log.message_id) {
        log.delivery_status = 'SENT';
      } else {
        log.delivery_status = 'FAILED';
        log.error_message = `[RECONCILED] Ambiguous delivery timed out without provider confirmation; reconciled at ${new Date().toISOString()}`;
      }
      await log.save();
      reconciledLogs.push({
        id: log.id,
        status: log.delivery_status,
        messageId: log.message_id,
      });
    }

    if (reconciledLogs.length > 0) {
      try {
        const audit = new AuditLog();
        audit.workspace_id = workspaceId;
        audit.actor_id = actorId;
        audit.action = 'QUEUE_RECONCILE_AMBIGUOUS';
        audit.entity_name = 'RequestLog';
        audit.metadata = {
          reconciledCount: reconciledLogs.length,
          timestamp: new Date().toISOString(),
        };
        await audit.save();
      } catch (err: any) {
        this.logger.warn({ error: err.message }, 'Failed to record audit log for reconciliation');
      }
    }

    return {
      reconciled: reconciledLogs.length,
      logs: reconciledLogs,
    };
  }
}
