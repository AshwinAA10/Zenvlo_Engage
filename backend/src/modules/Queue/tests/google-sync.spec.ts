import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Job } from 'bullmq';

import {
  QUEUE_GOOGLE_SYNC,
  JOB_GOOGLE_PLACE_SYNC,
} from '../../../common/constants';
import { ReviewSource } from '../../Review/entities/review-source.entity';
import { Review } from '../../Review/entities/review.entity';
import {
  GOOGLE_PLACES_SERVICE,
  IGooglePlacesService,
  IGooglePlaceDetails,
} from '../../Integration/interfaces/google-places.interface';
import { QueueService } from '../services/queue.service';
import { GoogleSyncProcessor } from '../processors/google-sync.processor';
import { GoogleSyncJobPayload } from '../interfaces/job.interface';
import { ReviewService } from '../../Review/services/review.service';
import {
  ErrorCategory,
  UnrecoverableQueueError,
} from '../errors/failure-classification';

describe('Phase 5: Google Sync Jobs & Asynchronous Architecture', () => {
  const businessId = '11111111-1111-1111-1111-111111111111';
  const foreignBusinessId = '22222222-2222-2222-2222-222222222222';
  const sourceId = 'src-google-101';
  const placeId = 'ChIJN1t_tDeuEmsRUsoyG83frY4';

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockCls = {
    run: jest.fn().mockImplementation((fn: () => any) => fn()),
    set: jest.fn(),
    get: jest.fn(),
  };

  let mockGooglePlacesService: jest.Mocked<IGooglePlacesService>;
  let mockQueueService: any;
  let processor: GoogleSyncProcessor;
  let reviewService: ReviewService;

  const samplePlaceDetails: IGooglePlaceDetails = {
    placeId,
    name: 'Apollo Dental Indiranagar',
    formattedAddress: 'Indiranagar 100ft Road, Bengaluru',
    rating: 4.8,
    userRatingsTotal: 120,
    url: 'https://maps.google.com/?cid=101',
    reviews: [
      {
        externalId: 'g_rev_001',
        authorName: 'Arjun Das',
        authorPhotoUrl: 'https://lh3.googleusercontent.com/photo1.jpg',
        rating: 5,
        text: 'Top notch consultation and gentle procedure!',
        reviewDate: new Date('2026-10-01T10:00:00Z'),
        profileUrl: 'https://maps.google.com/contrib/1',
      },
      {
        externalId: 'g_rev_002',
        authorName: 'Priya Sharma',
        authorPhotoUrl: 'https://lh3.googleusercontent.com/photo2.jpg',
        rating: 4,
        text: 'Clean clinic and very attentive doctors.',
        reviewDate: new Date('2026-10-05T14:30:00Z'),
        profileUrl: 'https://maps.google.com/contrib/2',
      },
    ],
  };

  const createMockJob = (
    data: Partial<GoogleSyncJobPayload> = {},
    attemptsMade = 0,
    maxAttempts = 3,
  ): Job<GoogleSyncJobPayload, any, string> => {
    return {
      id: 'job-sync-test-999',
      data: {
        workspace_id: businessId,
        business_id: businessId,
        source_id: sourceId,
        external_id: placeId,
        timestamp: Date.now(),
        ...data,
      },
      attemptsMade,
      opts: {
        attempts: maxAttempts,
      },
    } as unknown as Job<GoogleSyncJobPayload, any, string>;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockGooglePlacesService = {
      SearchPlaces: jest.fn(),
      GetPlaceDetails: jest.fn().mockResolvedValue(samplePlaceDetails),
    };

    mockQueueService = {
      EnqueueGoogleSync: jest.fn().mockResolvedValue('job-sync-test-999'),
    };

    processor = new GoogleSyncProcessor(
      mockLogger as any,
      mockCls as any,
      mockGooglePlacesService,
    );

    reviewService = new ReviewService(
      mockLogger as any,
      mockGooglePlacesService,
      mockQueueService,
    );
  });

  describe('1. Asynchronous Execution & Enqueueing', () => {
    it('should enqueue sync job asynchronously and transition status to SYNCING', async () => {
      const mockSource: any = {
        id: sourceId,
        business_id: businessId,
        external_id: placeId,
        is_active: true,
        sync_status: 'IDLE',
        sync_job_id: null,
        metadata: {},
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(mockSource as any);

      const result = await reviewService.EnqueueSync(businessId, sourceId);

      expect(result.status).toBe('QUEUED');
      expect(result.jobId).toBe('job-sync-test-999');
      expect(mockQueueService.EnqueueGoogleSync).toHaveBeenCalledWith({
        workspace_id: businessId,
        business_id: businessId,
        source_id: sourceId,
        external_id: placeId,
        checkpoint: undefined,
      });
      expect(mockSource.sync_status).toBe('SYNCING');
      expect(mockSource.sync_job_id).toBe('job-sync-test-999');
      expect(mockSource.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if source does not exist or tenant does not match', async () => {
      jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(null);

      await expect(
        reviewService.EnqueueSync(businessId, 'non-existent-source'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('2. Overlapping Job Prevention (Mutex & Concurrency Protection)', () => {
    it('should throw ConflictException (409) if a sync job is already in progress', async () => {
      const mockSource: any = {
        id: sourceId,
        business_id: businessId,
        external_id: placeId,
        is_active: true,
        sync_status: 'SYNCING',
        sync_job_id: 'job-existing-1',
        save: jest.fn(),
      };

      jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(mockSource as any);

      await expect(
        reviewService.EnqueueSync(businessId, sourceId),
      ).rejects.toThrow(ConflictException);

      expect(mockQueueService.EnqueueGoogleSync).not.toHaveBeenCalled();
    });

    it('should use deterministic BullMQ jobId to prevent duplicate queue items', async () => {
      const mockBullQueue = {
        add: jest.fn().mockResolvedValue({ id: `google_sync_${sourceId}` }),
      };

      const realQueueService = new QueueService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        undefined,
        undefined,
        mockBullQueue as any,
      );

      const enqueuedId = await realQueueService.EnqueueGoogleSync({
        workspace_id: businessId,
        business_id: businessId,
        source_id: sourceId,
        external_id: placeId,
      });

      expect(enqueuedId).toBe(`google_sync_${sourceId}`);
      expect(mockBullQueue.add).toHaveBeenCalledWith(
        JOB_GOOGLE_PLACE_SYNC,
        expect.objectContaining({ source_id: sourceId }),
        expect.objectContaining({
          jobId: `google_sync_${sourceId}`,
          attempts: 3,
        }),
      );
    });
  });

  describe('3. Idempotent Upsert & Deduplication', () => {
    it('should insert new reviews on first sync pass', async () => {
      const mockSource: any = {
        id: sourceId,
        business_id: businessId,
        external_id: placeId,
        is_active: true,
        sync_status: 'SYNCING',
        metadata: {},
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(mockSource as any);
      jest.spyOn(Review, 'findOne').mockResolvedValue(null); // No existing reviews

      const mockReviewSave = jest.fn().mockImplementation(function (this: any) {
        this.id = 'rev-db-id';
        return Promise.resolve(this);
      });
      jest.spyOn(Review.prototype, 'save').mockImplementation(mockReviewSave);

      const job = createMockJob();
      const res = await processor.handleJob(job);

      expect(res.processed).toBe(true);
      expect(res.newly_imported).toBe(2);
      expect(res.updated_count).toBe(0);
      expect(mockReviewSave).toHaveBeenCalledTimes(2);
      expect(mockSource.sync_status).toBe('SUCCESS');
      expect(mockSource.last_synced_at).toBeDefined();
    });

    it('should idempotently update existing reviews without duplicating records on repeated runs', async () => {
      const mockSource: any = {
        id: sourceId,
        business_id: businessId,
        external_id: placeId,
        is_active: true,
        sync_status: 'SYNCING',
        metadata: {},
        save: jest.fn().mockResolvedValue(true),
      };

      const existingReview1 = {
        id: 'rev-db-1',
        business_id: businessId,
        external_id: 'g_rev_001',
        author_name: 'Old Author Name',
        rating: 3,
        content: 'Old review content',
        review_date: new Date('2026-09-01'),
        save: jest.fn().mockResolvedValue(true),
      };

      const existingReview2 = {
        id: 'rev-db-2',
        business_id: businessId,
        external_id: 'g_rev_002',
        author_name: 'Priya Sharma',
        rating: 4,
        content: 'Clean clinic',
        review_date: new Date('2026-10-05'),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(mockSource as any);
      jest.spyOn(Review, 'findOne').mockImplementation((opts: any) => {
        if (opts.where.external_id === 'g_rev_001') {
          return Promise.resolve(existingReview1 as any);
        }
        if (opts.where.external_id === 'g_rev_002') {
          return Promise.resolve(existingReview2 as any);
        }
        return Promise.resolve(null);
      });

      const job = createMockJob();
      const res = await processor.handleJob(job);

      expect(res.processed).toBe(true);
      expect(res.newly_imported).toBe(0);
      expect(res.updated_count).toBe(2);
      expect(existingReview1.save).toHaveBeenCalled();
      expect(existingReview1.author_name).toBe('Arjun Das');
      expect(existingReview1.rating).toBe(5);
      expect(existingReview2.save).toHaveBeenCalled();
      expect(mockSource.sync_status).toBe('SUCCESS');
    });
  });

  describe('4. Incremental Sync & Safe Checkpoint Persistence', () => {
    it('should compute checkpoint from latest review date and persist only after successful commit', async () => {
      const mockSource: any = {
        id: sourceId,
        business_id: businessId,
        external_id: placeId,
        is_active: true,
        sync_status: 'SYNCING',
        metadata: {},
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(mockSource as any);
      jest.spyOn(Review, 'findOne').mockResolvedValue(null);
      jest.spyOn(Review.prototype, 'save').mockResolvedValue(true as any);

      const job = createMockJob();
      const res = await processor.handleJob(job);

      expect(res.checkpoint).toBeDefined();
      expect(res.checkpoint.last_synced_review_date).toBe(
        new Date('2026-10-05T14:30:00Z').toISOString(),
      );
      expect(res.checkpoint.synced_count).toBe(2);
      expect(mockSource.metadata.checkpoint).toEqual(res.checkpoint);
      expect(mockSource.metadata.sync_in_progress).toBe(false);
    });

    it('should not update checkpoint if database save fails', async () => {
      const mockSource: any = {
        id: sourceId,
        business_id: businessId,
        external_id: placeId,
        is_active: true,
        sync_status: 'SYNCING',
        metadata: { checkpoint: { last_synced_review_date: '2026-09-01T00:00:00Z' } },
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(mockSource as any);
      jest.spyOn(Review, 'findOne').mockResolvedValue(null);
      jest.spyOn(Review.prototype, 'save').mockRejectedValue(
        new Error('Database transaction deadlocked'),
      );

      const job = createMockJob();

      await expect(processor.handleJob(job)).rejects.toThrow(
        'Database transaction deadlocked',
      );

      // Checkpoint was not modified to the failed new date
      expect(mockSource.metadata.checkpoint.last_synced_review_date).toBe(
        '2026-09-01T00:00:00Z',
      );
      expect(mockSource.sync_status).toBe('FAILED');
    });
  });

  describe('5. Authentication Failure & Revoked Access Handling', () => {
    it('should mark source REVOKED, deactivate, and throw UnrecoverableQueueError on REQUEST_DENIED', async () => {
      const mockSource: any = {
        id: sourceId,
        business_id: businessId,
        external_id: placeId,
        is_active: true,
        sync_status: 'SYNCING',
        last_sync_error: null,
        metadata: {},
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(mockSource as any);
      mockGooglePlacesService.GetPlaceDetails.mockRejectedValue(
        new Error('Google Places API REQUEST_DENIED: The provided API key is invalid or revoked'),
      );

      const job = createMockJob();

      await expect(processor.handleJob(job)).rejects.toThrow(UnrecoverableQueueError);

      expect(mockSource.sync_status).toBe('REVOKED');
      expect(mockSource.is_active).toBe(false);
      expect(mockSource.last_sync_error).toContain('Provider authentication failed or API credentials revoked');
      expect(mockSource.save).toHaveBeenCalled();
    });

    it('should reject immediate sync attempt if source is already REVOKED', async () => {
      const mockSource: any = {
        id: sourceId,
        business_id: businessId,
        external_id: placeId,
        is_active: false,
        sync_status: 'REVOKED',
        save: jest.fn(),
      };

      jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(mockSource as any);

      await expect(
        reviewService.EnqueueSync(businessId, sourceId),
      ).rejects.toThrow(BadRequestException);

      const job = createMockJob();
      const res = await processor.handleJob(job);
      expect(res.processed).toBe(false);
      expect(res.reason).toBe('SOURCE_REVOKED_OR_INACTIVE');
    });
  });

  describe('6. Rate Limiting & Transient Error Recovery', () => {
    it('should classify OVER_QUERY_LIMIT as RATE_LIMIT and allow retry', async () => {
      const mockSource: any = {
        id: sourceId,
        business_id: businessId,
        external_id: placeId,
        is_active: true,
        sync_status: 'SYNCING',
        last_sync_error: null,
        metadata: {},
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(mockSource as any);
      mockGooglePlacesService.GetPlaceDetails.mockRejectedValue(
        new Error('Google Places API OVER_QUERY_LIMIT: Quota exceeded or rate limited'),
      );

      const job = createMockJob({}, 0, 3); // 1st attempt out of 3

      await expect(processor.handleJob(job)).rejects.toThrow('OVER_QUERY_LIMIT');

      expect(mockSource.sync_status).toBe('FAILED');
      expect(mockSource.last_sync_error).toContain('Provider rate limit exceeded');
      expect(mockSource.is_active).toBe(true); // Must NOT deactivate on rate limits
    });

    it('should handle transient network drops (ETIMEDOUT) and allow retry', async () => {
      const mockSource: any = {
        id: sourceId,
        business_id: businessId,
        external_id: placeId,
        is_active: true,
        sync_status: 'SYNCING',
        last_sync_error: null,
        metadata: {},
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(mockSource as any);
      mockGooglePlacesService.GetPlaceDetails.mockRejectedValue(
        new Error('connect ETIMEDOUT 142.250.190.42:443'),
      );

      const job = createMockJob({}, 0, 3);

      await expect(processor.handleJob(job)).rejects.toThrow('ETIMEDOUT');

      expect(mockSource.sync_status).toBe('FAILED');
      expect(mockSource.last_sync_error).toContain('Transient network failure');
      expect(mockSource.is_active).toBe(true);
    });
  });

  describe('7. Strict Tenant Boundary Isolation', () => {
    it('should discard job and prevent cross-tenant leakage if tenant ID does not match source', async () => {
      const mockSource: any = {
        id: sourceId,
        business_id: foreignBusinessId, // Belongs to different tenant!
        external_id: placeId,
        is_active: true,
      };

      // ReviewSource.findOne({ where: { id: source_id, business_id } }) returns null
      jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(null);

      const job = createMockJob({ business_id: businessId });
      const res = await processor.handleJob(job);

      expect(res.processed).toBe(false);
      expect(res.reason).toBe('SOURCE_NOT_FOUND');
      expect(mockGooglePlacesService.GetPlaceDetails).not.toHaveBeenCalled();
    });

    it('should reject EnqueueSync when requested by non-owner tenant', async () => {
      jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(null);

      await expect(
        reviewService.EnqueueSync(foreignBusinessId, sourceId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('8. Observable Sync Status Endpoint', () => {
    it('should return complete sync status, job ID, last error and checkpoint', async () => {
      const lastSyncDate = new Date('2026-10-14T10:00:00Z');
      const mockSource: any = {
        id: sourceId,
        business_id: businessId,
        is_active: true,
        sync_status: 'SUCCESS',
        last_synced_at: lastSyncDate,
        last_sync_error: null,
        sync_job_id: 'job-sync-test-999',
        metadata: {
          checkpoint: {
            last_synced_review_date: '2026-10-05T14:30:00Z',
            synced_count: 2,
            last_completed_at: lastSyncDate.toISOString(),
          },
        },
      };

      jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(mockSource as any);

      const status = await reviewService.GetSyncStatus(businessId, sourceId);

      expect(status.source_id).toBe(sourceId);
      expect(status.sync_status).toBe('SUCCESS');
      expect(status.last_synced_at).toEqual(lastSyncDate);
      expect(status.last_sync_error).toBeNull();
      expect(status.sync_job_id).toBe('job-sync-test-999');
      expect(status.checkpoint.synced_count).toBe(2);
      expect(status.is_active).toBe(true);
    });
  });

  describe('9. Backward Compatibility & Fallback Mode', () => {
    it('should execute synchronously when QueueService is not configured', async () => {
      const syncServiceWithoutQueue = new ReviewService(
        mockLogger as any,
        mockGooglePlacesService,
        undefined, // No queue service injected
      );

      const mockSource: any = {
        id: sourceId,
        business_id: businessId,
        external_id: placeId,
        is_active: true,
        sync_status: 'IDLE',
        name: 'Apollo Dental',
        address: 'Indiranagar',
        rating: 4.8,
        review_count: 100,
        last_synced_at: null,
        metadata: {},
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(mockSource as any);
      jest.spyOn(Review, 'findOne').mockResolvedValue(null);
      jest.spyOn(Review.prototype, 'save').mockResolvedValue(true as any);

      const result = await syncServiceWithoutQueue.EnqueueSync(businessId, sourceId);

      expect(result.status).toBe('COMPLETED');
      expect(mockGooglePlacesService.GetPlaceDetails).toHaveBeenCalledWith(placeId);
      expect(mockSource.sync_status).toBe('SUCCESS');
    });
  });
});
