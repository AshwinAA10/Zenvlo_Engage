import { Job, Queue } from 'bullmq';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BatchService } from '../services/batch.service';
import { BatchProcessor } from '../processors/batch.processor';
import { BatchExecution } from '../entities/batch-execution.entity';
import { Customer } from '../../Customer/entities/customer.entity';
import { Usage } from '../../Billing/entities/usage.entity';
import {
  QUEUE_BATCH_OPERATIONS,
  JOB_PROCESS_BATCH_CHUNK,
} from '../../../common/constants';
import { BatchChunkJobPayload } from '../interfaces/job.interface';

describe('Phase 4: Batch Processing Architecture', () => {
  const businessId = '11111111-1111-1111-1111-111111111111';
  const foreignBusinessId = '22222222-2222-2222-2222-222222222222';
  const actorId = 'actor-admin-123';

  let batchService: BatchService;
  let mockQueueService: any;
  let mockBatchQueue: any;
  let mockLogger: any;
  let mockUsageService: any;

  beforeEach(() => {
    mockLogger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockBatchQueue = {
      add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    };

    mockQueueService = {
      GetQueue: jest.fn().mockReturnValue(mockBatchQueue),
    };

    mockUsageService = {
      GetOrCreateCurrentUsage: jest.fn().mockResolvedValue({
        business_id: businessId,
        whatsapp_requests_sent: 10,
        whatsapp_requests_limit: 500, // 490 remaining
      }),
    };

    batchService = new BatchService(
      mockQueueService as any,
      mockLogger as any,
      mockUsageService as any,
    );
  });

  // =========================================================================
  // 1. Input Validation, Tenant Authorization & Resource Limits
  // =========================================================================
  describe('1. Input Validation & Quota Constraints', () => {
    it('should reject empty customer batch with BadRequestException', async () => {
      await expect(
        batchService.createWhatsAppBatch(businessId, actorId, {
          customer_ids: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject batch exceeding maximum size limit', async () => {
      const hugeBatch = new Array(5001).fill('cust-id');
      await expect(
        batchService.createWhatsAppBatch(businessId, actorId, {
          customer_ids: hugeBatch,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject batch when requested count exceeds remaining plan quota', async () => {
      mockUsageService.GetOrCreateCurrentUsage.mockResolvedValueOnce({
        whatsapp_requests_sent: 495,
        whatsapp_requests_limit: 500, // Only 5 remaining
      });

      await expect(
        batchService.createWhatsAppBatch(businessId, actorId, {
          customer_ids: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject batch if customers belong to another tenant workspace', async () => {
      jest.spyOn(Customer, 'find').mockResolvedValue([]); // No matching customers for this tenant

      await expect(
        batchService.createWhatsAppBatch(businessId, actorId, {
          customer_ids: ['foreign-cust-1', 'foreign-cust-2'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // 2. Chunk Boundaries & Chunk Slicing
  // =========================================================================
  describe('2. Bounded Chunk Slicing & Execution Record Initialization', () => {
    it('should partition 125 items into exactly 3 chunks of (50, 50, 25)', async () => {
      const customerIds = Array.from({ length: 125 }, (_, i) => `cust-${i + 1}`);
      const mockCustomers = customerIds.map((id) => ({ id } as Customer));

      jest.spyOn(Customer, 'find').mockResolvedValue(mockCustomers);
      jest.spyOn(BatchExecution.prototype, 'save').mockImplementation(function (this: any) {
        this.id = 'batch-chunk-125';
        return Promise.resolve(this);
      });

      const report = await batchService.createWhatsAppBatch(businessId, actorId, {
        customer_ids: customerIds,
        chunk_size: 50,
        custom_message: 'VIP Invitation',
      });

      expect(report.totalItems).toBe(125);
      expect(report.totalChunks).toBe(3);
      expect(report.chunkSize).toBe(50);
      expect(report.status).toBe('PENDING');

      // Verifies exactly 3 jobs enqueued with correct boundaries
      expect(mockBatchQueue.add).toHaveBeenCalledTimes(3);

      const firstCall = mockBatchQueue.add.mock.calls[0];
      expect(firstCall[0]).toBe(JOB_PROCESS_BATCH_CHUNK);
      expect(firstCall[1].item_ids.length).toBe(50);
      expect(firstCall[1].chunk_index).toBe(0);

      const secondCall = mockBatchQueue.add.mock.calls[1];
      expect(secondCall[1].item_ids.length).toBe(50);
      expect(secondCall[1].chunk_index).toBe(1);

      const thirdCall = mockBatchQueue.add.mock.calls[2];
      expect(thirdCall[1].item_ids.length).toBe(25);
      expect(thirdCall[1].chunk_index).toBe(2);
    });
  });

  // =========================================================================
  // 3. Worker Execution: Partial Failure Resilience & Idempotency
  // =========================================================================
  describe('3. BatchProcessor Worker Execution', () => {
    let processor: BatchProcessor;
    let mockCls: any;
    let mockRequestService: any;
    let mockCustomerService: any;

    beforeEach(() => {
      mockCls = {
        run: jest.fn().mockImplementation((fn: () => any) => fn()),
        set: jest.fn(),
        get: jest.fn(),
      };

      mockRequestService = {
        SendSingleRequest: jest.fn(),
      };

      mockCustomerService = {};

      processor = new BatchProcessor(
        mockLogger as any,
        mockCls as any,
        batchService,
        mockRequestService as any,
        mockCustomerService as any,
      );
    });

    it('should isolate item failures without failing the entire chunk', async () => {
      const mockBatch = {
        id: 'batch-partial-test',
        business_id: businessId,
        delivery_status: 'PENDING',
        total_items: 3,
        processed_items: 0,
        succeeded_items: 0,
        failed_items: 0,
        skipped_items: 0,
        total_chunks: 1,
        processed_chunks: 0,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(BatchExecution, 'findOne').mockResolvedValue(mockBatch as any);

      // Customer 1 succeeds, Customer 2 fails (e.g. opted out), Customer 3 succeeds
      mockRequestService.SendSingleRequest
        .mockResolvedValueOnce({ delivery_status: 'SENT' })
        .mockResolvedValueOnce({ delivery_status: 'FAILED', error_message: 'Customer opted out' })
        .mockResolvedValueOnce({ delivery_status: 'SENT' });

      const mockJob = {
        id: 'chunk-job-1',
        data: {
          workspace_id: businessId,
          business_id: businessId,
          batch_id: 'batch-partial-test',
          chunk_index: 0,
          total_chunks: 1,
          operation_type: 'WHATSAPP_TESTIMONIAL_REQUESTS',
          item_ids: ['cust-1', 'cust-2', 'cust-3'],
        },
      } as unknown as Job<BatchChunkJobPayload>;

      const result = await processor.process(mockJob);

      expect(result.processed).toBe(true);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);

      // Verify batch record transitioned to PARTIALLY_COMPLETED
      expect(mockBatch.succeeded_items).toBe(2);
      expect(mockBatch.failed_items).toBe(1);
      expect(mockBatch.delivery_status).toBe('PARTIALLY_COMPLETED');
    });

    it('should idempotently skip existing customers during bulk customer import', async () => {
      const mockBatch = {
        id: 'batch-import-test',
        business_id: businessId,
        delivery_status: 'PENDING',
        total_items: 2,
        processed_items: 0,
        succeeded_items: 0,
        failed_items: 0,
        skipped_items: 0,
        total_chunks: 1,
        processed_chunks: 0,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(BatchExecution, 'findOne').mockResolvedValue(mockBatch as any);

      // Item 1 is an existing customer; Item 2 is new
      jest.spyOn(Customer, 'findOne')
        .mockResolvedValueOnce({ id: 'existing-cust', phone: '+919000000001' } as any)
        .mockResolvedValueOnce(null);

      jest.spyOn(Customer.prototype, 'save').mockResolvedValue({ id: 'new-cust' } as any);

      const mockJob = {
        id: 'chunk-import-1',
        data: {
          workspace_id: businessId,
          business_id: businessId,
          batch_id: 'batch-import-test',
          chunk_index: 0,
          total_chunks: 1,
          operation_type: 'CUSTOMER_IMPORT',
          items: [
            { name: 'Existing Customer', phone: '+919000000001' },
            { name: 'Brand New Customer', phone: '+919000000002' },
          ],
        },
      } as unknown as Job<BatchChunkJobPayload>;

      const result = await processor.process(mockJob);

      expect(result.succeeded).toBe(1);
      expect(result.skipped).toBe(1);
      expect(mockBatch.succeeded_items).toBe(1);
      expect(mockBatch.skipped_items).toBe(1);
      expect(mockBatch.delivery_status).toBe('COMPLETED');
    });
  });

  // =========================================================================
  // 4. Cooperative Cancellation & Progress Tracking
  // =========================================================================
  describe('4. Cooperative Cancellation & Real-Time Progress', () => {
    it('should halt batch processing immediately when cancellation is requested', async () => {
      const mockBatch = {
        id: 'batch-cancel-test',
        business_id: businessId,
        delivery_status: 'PROCESSING',
        metadata: {},
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(BatchExecution, 'findOne').mockResolvedValue(mockBatch as any);

      const cancelResult = await batchService.cancelBatch(businessId, actorId, 'batch-cancel-test');

      expect(cancelResult.success).toBe(true);
      expect(cancelResult.status).toBe('CANCELLED');
      expect(mockBatch.delivery_status).toBe('CANCELLED');
    });

    it('should accurately compute progress percentage and respect tenant isolation', async () => {
      const mockBatch = {
        id: 'batch-progress-test',
        business_id: businessId,
        operation_type: 'WHATSAPP_TESTIMONIAL_REQUESTS',
        delivery_status: 'PROCESSING',
        total_items: 200,
        processed_items: 150,
        succeeded_items: 145,
        failed_items: 5,
        skipped_items: 0,
        total_chunks: 4,
        processed_chunks: 3,
        chunk_size: 50,
        started_at: new Date(),
        completed_at: null,
      };
      jest.spyOn(BatchExecution, 'findOne').mockResolvedValue(mockBatch as any);

      const progress = await batchService.getBatchProgress(businessId, 'batch-progress-test');

      expect(progress.progressPercentage).toBe(75); // 150 / 200 = 75%
      expect(progress.status).toBe('PROCESSING');
      expect(progress.succeededItems).toBe(145);
      expect(progress.failedItems).toBe(5);

      // Verify foreign tenant access is rejected
      jest.spyOn(BatchExecution, 'findOne').mockResolvedValue(null);
      await expect(
        batchService.getBatchProgress(foreignBusinessId, 'batch-progress-test'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
