import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import { CLS_WORKSPACE_ID, CLS_USER_ID } from '../../../common/constants';
import { BaseJobPayload } from '../interfaces/job.interface';

/**
 * Strips tokens, passwords, secrets and PII from error strings to prevent leaking in logs.
 */
export function sanitizeErrorMessage(error: any): string {
  if (!error) return 'Unknown error';
  let message = typeof error === 'string' ? error : error.message || String(error);

  // Redact bearer tokens, passwords, authorization headers, and redis passwords
  message = message.replace(/(bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED]');
  message = message.replace(/(password\s*[:=]\s*)[^\s,]+/gi, '$1[REDACTED]');
  message = message.replace(/(secret\s*[:=]\s*)[^\s,]+/gi, '$1[REDACTED]');
  message = message.replace(/(token\s*[:=]\s*)[^\s,]+/gi, '$1[REDACTED]');
  message = message.replace(/(redis:\/\/[^:]+:)[^@]+(@)/gi, '$1[REDACTED]$2');

  return message;
}

/**
 * Base Worker Host providing:
 * - Multi-tenant context extraction and propagation to ClsService
 * - Structured lifecycle logging (start, complete, failure with durations)
 * - Safe error sanitization without credentials/PII exposure
 * - Resilient exception handling preventing unhandled process crashes
 */
export abstract class BaseTenantWorkerHost<
  TData extends BaseJobPayload = BaseJobPayload,
  TResult = any
> extends WorkerHost {
  protected abstract readonly queueName: string;
  protected abstract readonly requiresTenant: boolean;

  constructor(
    protected readonly logger: PinoLogger,
    protected readonly cls: ClsService,
  ) {
    super();
  }

  /**
   * Domain-specific job processing logic implemented by concrete workers.
   */
  abstract handleJob(job: Job<TData, TResult, string>): Promise<TResult>;

  /**
   * BullMQ worker process entry point with lifecycle tracking.
   */
  async process(job: Job<TData, TResult, string>): Promise<TResult> {
    const startTime = Date.now();
    const jobId = String(job.id || '');
    const jobName = job.name;
    const queueName = this.queueName;
    const attemptsMade = job.attemptsMade;
    const workspaceId = job.data?.workspace_id;
    const actorId = job.data?.actor_id;

    if (this.requiresTenant && !workspaceId) {
      const err = new Error(
        `[SECURITY FATAL] Tenant-scoped job '${jobName}' (ID: ${jobId}) rejected: missing workspace_id`,
      );
      this.logger.error(
        { jobId, queueName, jobName, attemptsMade },
        'Tenant context validation failed for job',
      );
      throw err;
    }

    this.logger.info(
      {
        jobId,
        queueName,
        jobName,
        workspaceId: workspaceId || null,
        actorId: actorId || null,
        attemptsMade,
      },
      'BullMQ job execution started',
    );

    try {
      // Execute the job inside CLS context so Active Record TenantBaseEntity operates correctly
      const result = await this.cls.run(async () => {
        if (workspaceId) {
          this.cls.set(CLS_WORKSPACE_ID, workspaceId);
        }
        if (actorId) {
          this.cls.set(CLS_USER_ID, actorId);
        }
        return await this.handleJob(job);
      });

      const durationMs = Date.now() - startTime;
      this.logger.info(
        {
          jobId,
          queueName,
          jobName,
          workspaceId: workspaceId || null,
          durationMs,
        },
        'BullMQ job execution completed successfully',
      );

      return result;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const sanitizedError = sanitizeErrorMessage(error);

      this.logger.error(
        {
          jobId,
          queueName,
          jobName,
          workspaceId: workspaceId || null,
          durationMs,
          attemptsMade,
          errorMessage: sanitizedError,
        },
        'BullMQ job execution failed',
      );

      // Re-throw so BullMQ can trigger configured backoff/retry or move to failed state
      throw error;
    }
  }
}
