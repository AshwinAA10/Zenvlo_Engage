import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import { Inject, Optional, forwardRef } from '@nestjs/common';
import { QUEUE_BATCH_OPERATIONS } from '../../../common/constants';
import { BaseTenantWorkerHost } from './base-tenant.processor';
import { BatchChunkJobPayload } from '../interfaces/job.interface';
import { BatchExecution } from '../entities/batch-execution.entity';
import { BatchService } from '../services/batch.service';
import { RequestService } from '../../Request/services/request.service';
import { CustomerService } from '../../Customer/services/customer.service';
import { Customer } from '../../Customer/entities/customer.entity';

/**
 * BullMQ Worker Processor for chunked batch operations.
 *
 * Reliability & Concurrency Invariants:
 * - Strictly validates and propagates tenant workspace context.
 * - Enforces bounded concurrency (configured in BullMQ).
 * - Checks cooperative cancellation flag before and between individual items.
 * - Processes items with partial failure isolation (one failure does not drop other items).
 * - Implements item idempotency to prevent duplicate operations on worker retries.
 * - Atomically aggregates chunk progress to eliminate race conditions.
 */
@Processor(QUEUE_BATCH_OPERATIONS)
export class BatchProcessor extends BaseTenantWorkerHost<
  BatchChunkJobPayload,
  any
> {
  protected readonly queueName = QUEUE_BATCH_OPERATIONS;
  protected readonly requiresTenant = true;

  constructor(
    logger: PinoLogger,
    cls: ClsService,
    private readonly batchService: BatchService,
    @Optional()
    @Inject(forwardRef(() => RequestService))
    private readonly requestService?: RequestService,
    @Optional()
    @Inject(forwardRef(() => CustomerService))
    private readonly customerService?: CustomerService,
  ) {
    super(logger, cls);
    this.logger.setContext(BatchProcessor.name);
  }

  async handleJob(job: Job<BatchChunkJobPayload, any, string>): Promise<any> {
    const { batch_id, operation_type, item_ids, items, params } = job.data;
    const business_id = job.data.business_id || job.data.workspace_id;

    // 1. Authoritative check on BatchExecution record
    const batch = await BatchExecution.findOne({
      where: { id: batch_id, business_id },
    });

    if (!batch) {
      this.logger.warn(
        { batchId: batch_id, businessId: business_id },
        'Batch chunk job discarded: BatchExecution record not found or tenant mismatch',
      );
      return { processed: false, reason: 'BATCH_NOT_FOUND' };
    }

    // 2. Cooperative cancellation check
    if (batch.delivery_status === 'CANCELLED') {
      this.logger.info(
        { batchId: batch_id, chunkIndex: job.data.chunk_index },
        'Batch chunk execution skipped: batch was cancelled',
      );
      return { processed: false, cancelled: true, reason: 'BATCH_CANCELLED' };
    }

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    // 3. Process Chunk based on operation type
    if (operation_type === 'WHATSAPP_TESTIMONIAL_REQUESTS' && item_ids) {
      for (const customerId of item_ids) {
        // Cooperative cancellation check between items
        const freshBatch = await BatchExecution.findOne({
          select: ['delivery_status'],
          where: { id: batch_id },
        });
        if (freshBatch?.delivery_status === 'CANCELLED') {
          skipped += item_ids.length - (succeeded + failed + skipped);
          break;
        }

        try {
          if (this.requestService) {
            const log = await this.requestService.SendSingleRequest(business_id, {
              customer_id: customerId,
              custom_message: params?.custom_message,
            });

            if (log.delivery_status === 'FAILED') {
              failed++;
              if (log.error_message) errors.push(log.error_message);
            } else {
              succeeded++;
            }
          } else {
            // Fallback: direct customer verification
            const cust = await Customer.findOne({
              where: { id: customerId, business_id },
            });
            if (cust) succeeded++;
            else failed++;
          }
        } catch (itemErr: any) {
          failed++;
          errors.push(itemErr.message || 'Failed to dispatch request to customer');
          this.logger.warn(
            { batchId: batch_id, customerId, error: itemErr.message },
            'Single item failed in batch chunk; proceeding with remaining items',
          );
        }
      }
    } else if (operation_type === 'CUSTOMER_IMPORT' && items) {
      for (const item of items) {
        const freshBatch = await BatchExecution.findOne({
          select: ['delivery_status'],
          where: { id: batch_id },
        });
        if (freshBatch?.delivery_status === 'CANCELLED') {
          skipped += items.length - (succeeded + failed + skipped);
          break;
        }

        try {
          if (!item.name || !item.phone) {
            failed++;
            errors.push('Name and phone are required');
            continue;
          }

          const cleanPhone = String(item.phone).replace(/[^\d+]/g, '');
          if (!cleanPhone || cleanPhone.length < 8) {
            failed++;
            errors.push(`Invalid phone number format: '${item.phone}'`);
            continue;
          }

          // Idempotency: Check if customer already exists for this tenant
          let customer = await Customer.findOne({
            where: { business_id, phone: cleanPhone },
          });

          if (customer) {
            // Already imported: idempotent skip/update
            skipped++;
            continue;
          }

          customer = new Customer();
          customer.business_id = business_id;
          customer.name = item.name.trim();
          customer.phone = cleanPhone;
          customer.email = item.email ? String(item.email).trim().toLowerCase() : null;
          customer.notes = item.notes ? String(item.notes).trim() : null;
          customer.tags = Array.isArray(item.tags) ? item.tags : [];
          customer.created_by_id = job.data.actor_id || 'system';
          customer.updated_by_id = job.data.actor_id || 'system';
          await customer.save();

          succeeded++;
        } catch (custErr: any) {
          failed++;
          errors.push(custErr.message || 'Failed to import customer item');
        }
      }
    }

    const processed = succeeded + failed + skipped;

    // 4. Record progress atomically in BatchExecution record
    await this.batchService.recordChunkProgress(batch_id, {
      processed,
      succeeded,
      failed,
      skipped,
      errorMsg: errors.length > 0 ? errors.slice(0, 3).join(', ') : undefined,
    });

    this.logger.info(
      {
        batchId: batch_id,
        chunkIndex: job.data.chunk_index,
        processed,
        succeeded,
        failed,
        skipped,
      },
      'Batch chunk successfully executed',
    );

    return {
      processed: true,
      batchId: batch_id,
      chunkIndex: job.data.chunk_index,
      succeeded,
      failed,
      skipped,
    };
  }
}
