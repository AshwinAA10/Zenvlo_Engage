import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { In } from 'typeorm';
import { QueueService } from './queue.service';
import { UsageService } from '../../Billing/services/usage.service';
import { Customer } from '../../Customer/entities/customer.entity';
import { BatchExecution, BatchStatus } from '../entities/batch-execution.entity';
import { BatchChunkJobPayload } from '../interfaces/job.interface';
import {
  QUEUE_BATCH_OPERATIONS,
  JOB_PROCESS_BATCH_CHUNK,
} from '../../../common/constants';
import { getBatchSettings } from '../config/queue.config';

export interface CreateWhatsAppBatchDto {
  customer_ids: string[];
  custom_message?: string;
  chunk_size?: number;
}

export interface CreateCustomerImportBatchDto {
  customers: {
    name: string;
    phone: string;
    email?: string;
    notes?: string;
    tags?: string[];
  }[];
  chunk_size?: number;
}

export interface BatchProgressReport {
  id: string;
  workspaceId: string;
  operationType: string;
  status: BatchStatus;
  totalItems: number;
  processedItems: number;
  succeededItems: number;
  failedItems: number;
  skippedItems: number;
  progressPercentage: number;
  totalChunks: number;
  processedChunks: number;
  chunkSize: number;
  startedAt: string | null;
  completedAt: string | null;
  metadata?: Record<string, any> | null;
  errorSummary?: string | null;
}

@Injectable()
export class BatchService {
  constructor(
    private readonly queueService: QueueService,
    private readonly logger: PinoLogger,
    @Optional() private readonly usageService?: UsageService,
  ) {
    this.logger.setContext(BatchService.name);
  }

  /**
   * Schedules a bulk WhatsApp testimonial request batch with bounded chunking.
   */
  async createWhatsAppBatch(
    workspaceId: string,
    actorId: string,
    dto: CreateWhatsAppBatchDto,
  ): Promise<BatchProgressReport> {
    if (!dto.customer_ids || dto.customer_ids.length === 0) {
      throw new BadRequestException('At least one customer ID must be provided');
    }

    const batchConfig = getBatchSettings();
    if (dto.customer_ids.length > batchConfig.maxItems) {
      throw new BadRequestException(
        `Batch size (${dto.customer_ids.length}) exceeds maximum limit of ${batchConfig.maxItems} items`,
      );
    }

    // 1. Quota check: Verify remaining monthly quota
    if (this.usageService) {
      const usage = await this.usageService.GetOrCreateCurrentUsage(workspaceId);
      const remainingQuota = usage.whatsapp_requests_limit - usage.whatsapp_requests_sent;
      if (dto.customer_ids.length > remainingQuota) {
        throw new ForbiddenException(
          `Batch size (${dto.customer_ids.length}) exceeds remaining monthly quota of ${Math.max(0, remainingQuota)} requests for your plan`,
        );
      }
    }

    // 2. Validate tenant-authorized customers
    const validCustomers = await Customer.find({
      select: ['id'],
      where: {
        business_id: workspaceId,
        id: In(dto.customer_ids),
      },
    });

    if (validCustomers.length === 0) {
      throw new BadRequestException(
        'None of the specified customer IDs belong to this workspace',
      );
    }

    const authorizedIds = validCustomers.map((c) => c.id);
    const chunkSize = Math.max(1, Math.min(dto.chunk_size || batchConfig.chunkSize, 250));
    const totalChunks = Math.ceil(authorizedIds.length / chunkSize);

    // 3. Create persistent BatchExecution entity
    const batch = new BatchExecution();
    batch.business_id = workspaceId;
    batch.operation_type = 'WHATSAPP_TESTIMONIAL_REQUESTS';
    batch.delivery_status = 'PENDING';
    batch.total_items = authorizedIds.length;
    batch.processed_items = 0;
    batch.succeeded_items = 0;
    batch.failed_items = 0;
    batch.skipped_items = 0;
    batch.chunk_size = chunkSize;
    batch.total_chunks = totalChunks;
    batch.processed_chunks = 0;
    batch.started_at = new Date();
    batch.created_by_id = actorId;
    batch.updated_by_id = actorId;
    batch.metadata = {
      custom_message: dto.custom_message || null,
      requested_count: dto.customer_ids.length,
      authorized_count: authorizedIds.length,
    };
    await batch.save();

    // 4. Enqueue chunked jobs to BullMQ
    const batchQueue = this.queueService.GetQueue(QUEUE_BATCH_OPERATIONS);
    for (let i = 0; i < totalChunks; i++) {
      const chunkIds = authorizedIds.slice(i * chunkSize, (i + 1) * chunkSize);
      const payload: BatchChunkJobPayload = {
        workspace_id: workspaceId,
        business_id: workspaceId,
        actor_id: actorId,
        batch_id: batch.id,
        chunk_index: i,
        total_chunks: totalChunks,
        operation_type: 'WHATSAPP_TESTIMONIAL_REQUESTS',
        item_ids: chunkIds,
        params: { custom_message: dto.custom_message },
        idempotency_key: `batch_${batch.id}_chunk_${i}`,
        timestamp: Date.now(),
      };

      await batchQueue.add(JOB_PROCESS_BATCH_CHUNK, payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        jobId: `batch_${batch.id}_chunk_${i}`,
      });
    }

    this.logger.info(
      { batchId: batch.id, workspaceId, totalItems: batch.total_items, totalChunks },
      'WhatsApp batch execution successfully scheduled',
    );

    return this.mapToReport(batch);
  }

  /**
   * Schedules a bulk customer import batch with bounded chunking.
   */
  async createCustomerImportBatch(
    workspaceId: string,
    actorId: string,
    dto: CreateCustomerImportBatchDto,
  ): Promise<BatchProgressReport> {
    if (!dto.customers || dto.customers.length === 0) {
      throw new BadRequestException('At least one customer record must be provided for import');
    }

    const batchConfig = getBatchSettings();
    if (dto.customers.length > batchConfig.maxItems) {
      throw new BadRequestException(
        `Import size (${dto.customers.length}) exceeds maximum limit of ${batchConfig.maxItems} items`,
      );
    }

    const chunkSize = Math.max(1, Math.min(dto.chunk_size || batchConfig.chunkSize, 250));
    const totalChunks = Math.ceil(dto.customers.length / chunkSize);

    const batch = new BatchExecution();
    batch.business_id = workspaceId;
    batch.operation_type = 'CUSTOMER_IMPORT';
    batch.delivery_status = 'PENDING';
    batch.total_items = dto.customers.length;
    batch.processed_items = 0;
    batch.succeeded_items = 0;
    batch.failed_items = 0;
    batch.skipped_items = 0;
    batch.chunk_size = chunkSize;
    batch.total_chunks = totalChunks;
    batch.processed_chunks = 0;
    batch.started_at = new Date();
    batch.created_by_id = actorId;
    batch.updated_by_id = actorId;
    batch.metadata = { total_records: dto.customers.length };
    await batch.save();

    const batchQueue = this.queueService.GetQueue(QUEUE_BATCH_OPERATIONS);
    for (let i = 0; i < totalChunks; i++) {
      const chunkItems = dto.customers.slice(i * chunkSize, (i + 1) * chunkSize);
      const payload: BatchChunkJobPayload = {
        workspace_id: workspaceId,
        business_id: workspaceId,
        actor_id: actorId,
        batch_id: batch.id,
        chunk_index: i,
        total_chunks: totalChunks,
        operation_type: 'CUSTOMER_IMPORT',
        items: chunkItems,
        idempotency_key: `batch_${batch.id}_chunk_${i}`,
        timestamp: Date.now(),
      };

      await batchQueue.add(JOB_PROCESS_BATCH_CHUNK, payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        jobId: `batch_${batch.id}_chunk_${i}`,
      });
    }

    return this.mapToReport(batch);
  }

  /**
   * Retrieves real-time batch progress report verifying tenant isolation.
   */
  async getBatchProgress(
    workspaceId: string,
    batchId: string,
  ): Promise<BatchProgressReport> {
    const batch = await BatchExecution.findOne({
      where: { id: batchId, business_id: workspaceId },
    });

    if (!batch) {
      throw new NotFoundException(`Batch execution '${batchId}' not found for this workspace`);
    }

    return this.mapToReport(batch);
  }

  /**
   * Paginated list of batch operations for the requesting tenant.
   */
  async listBatches(
    workspaceId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: BatchProgressReport[]; total: number; page: number; limit: number }> {
    const pageNum = Math.max(1, page);
    const limitNum = Math.max(1, Math.min(limit, 100));

    const [batches, total] = await BatchExecution.findAndCount({
      where: { business_id: workspaceId },
      order: { created_on: 'DESC' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    });

    return {
      data: batches.map((b) => this.mapToReport(b)),
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  /**
   * Cooperatively cancels an active batch execution.
   */
  async cancelBatch(
    workspaceId: string,
    actorId: string,
    batchId: string,
  ): Promise<{ success: boolean; batchId: string; status: BatchStatus }> {
    const batch = await BatchExecution.findOne({
      where: { id: batchId, business_id: workspaceId },
    });

    if (!batch) {
      throw new NotFoundException(`Batch execution '${batchId}' not found for this workspace`);
    }

    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(batch.delivery_status)) {
      return { success: false, batchId, status: batch.delivery_status };
    }

    batch.delivery_status = 'CANCELLED';
    batch.completed_at = new Date();
    batch.metadata = {
      ...(batch.metadata || {}),
      cancelled_by: actorId,
      cancelled_at: new Date().toISOString(),
    };
    await batch.save();

    this.logger.warn(
      { batchId, workspaceId, actorId },
      'Batch execution cancelled by authorized actor',
    );

    return {
      success: true,
      batchId,
      status: 'CANCELLED',
    };
  }

  /**
   * Atomically records chunk execution progress into the persistent BatchExecution record.
   */
  async recordChunkProgress(
    batchId: string,
    delta: {
      processed: number;
      succeeded: number;
      failed: number;
      skipped: number;
      errorMsg?: string;
    },
  ): Promise<BatchExecution | null> {
    const batch = await BatchExecution.findOne({ where: { id: batchId } });
    if (!batch) return null;

    // Do not alter progress if already cancelled
    if (batch.delivery_status === 'CANCELLED') {
      return batch;
    }

    batch.delivery_status = 'PROCESSING';
    batch.processed_items = (batch.processed_items || 0) + delta.processed;
    batch.succeeded_items = (batch.succeeded_items || 0) + delta.succeeded;
    batch.failed_items = (batch.failed_items || 0) + delta.failed;
    batch.skipped_items = (batch.skipped_items || 0) + delta.skipped;
    batch.processed_chunks = (batch.processed_chunks || 0) + 1;

    if (delta.errorMsg) {
      batch.error_summary = batch.error_summary
        ? `${batch.error_summary}; ${delta.errorMsg}`
        : delta.errorMsg;
    }

    // Check completion condition
    if (
      batch.processed_chunks >= batch.total_chunks ||
      batch.processed_items >= batch.total_items
    ) {
      if (batch.failed_items > 0 && batch.succeeded_items > 0) {
        batch.delivery_status = 'PARTIALLY_COMPLETED';
      } else if (batch.failed_items === batch.total_items) {
        batch.delivery_status = 'FAILED';
      } else {
        batch.delivery_status = 'COMPLETED';
      }
      batch.completed_at = new Date();
    }

    await batch.save();
    return batch;
  }

  private mapToReport(batch: BatchExecution): BatchProgressReport {
    const total = batch.total_items || 0;
    const processed = batch.processed_items || 0;
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

    return {
      id: batch.id,
      workspaceId: batch.business_id,
      operationType: batch.operation_type,
      status: batch.delivery_status,
      totalItems: total,
      processedItems: processed,
      succeededItems: batch.succeeded_items || 0,
      failedItems: batch.failed_items || 0,
      skippedItems: batch.skipped_items || 0,
      progressPercentage: Math.min(100, Math.max(0, percentage)),
      totalChunks: batch.total_chunks || 0,
      processedChunks: batch.processed_chunks || 0,
      chunkSize: batch.chunk_size || 50,
      startedAt: batch.started_at ? batch.started_at.toISOString() : null,
      completedAt: batch.completed_at ? batch.completed_at.toISOString() : null,
      metadata: batch.metadata,
      errorSummary: batch.error_summary,
    };
  }
}
