import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import { Inject } from '@nestjs/common';
import { QUEUE_GOOGLE_SYNC } from '../../../common/constants';
import { BaseTenantWorkerHost } from './base-tenant.processor';
import { GoogleSyncJobPayload } from '../interfaces/job.interface';
import {
  GOOGLE_PLACES_SERVICE,
  IGooglePlacesService,
} from '../../Integration/interfaces/google-places.interface';
import { ReviewSource } from '../../Review/entities/review-source.entity';
import { Review } from '../../Review/entities/review.entity';
import {
  classifyFailure,
  ErrorCategory,
  UnrecoverableQueueError,
} from '../errors/failure-classification';

/**
 * BullMQ Worker Processor for asynchronous Google synchronization.
 *
 * Invariants & Reliability Guarantees:
 * - Scoped to tenant boundary via ClsService and verified business_id.
 * - Enforces mutual exclusion to prevent concurrent sync executions on the same place.
 * - Idempotently upserts remote reviews to prevent duplicates upon repeated syncs or retries.
 * - Tracks checkpoints (latest review date, synced item count) committed only after safe database save.
 * - Classifies failures: marks source REVOKED on authentication/permission failure (terminal non-retryable),
 *   and applies bounded jittered backoff on rate limits (OVER_QUERY_LIMIT, 429) and transient network drops.
 * - Strictly isolates credentials and synced review entities per tenant.
 */
@Processor(QUEUE_GOOGLE_SYNC)
export class GoogleSyncProcessor extends BaseTenantWorkerHost<
  GoogleSyncJobPayload,
  any
> {
  protected readonly queueName = QUEUE_GOOGLE_SYNC;
  protected readonly requiresTenant = true;

  constructor(
    logger: PinoLogger,
    cls: ClsService,
    @Inject(GOOGLE_PLACES_SERVICE)
    private readonly googlePlacesService: IGooglePlacesService,
  ) {
    super(logger, cls);
    this.logger.setContext(GoogleSyncProcessor.name);
  }

  async handleJob(
    job: Job<GoogleSyncJobPayload, any, string>,
  ): Promise<any> {
    const { source_id, business_id, external_id, checkpoint } = job.data;
    const businessId = business_id;
    const maxAttempts = job.opts?.attempts || 3;
    const currentAttempt = job.attemptsMade + 1;

    // 1. Authoritative lookup & Strict Tenant Isolation
    const source = await ReviewSource.findOne({
      where: { id: source_id, business_id },
    });

    if (!source) {
      this.logger.warn(
        { sourceId: source_id, businessId: business_id },
        'Google sync job discarded: ReviewSource not found or tenant mismatch',
      );
      return { processed: false, reason: 'SOURCE_NOT_FOUND' };
    }

    // 2. Revoked or Inactive Guard
    if (!source.is_active || source.sync_status === 'REVOKED') {
      this.logger.warn(
        {
          sourceId: source.id,
          businessId,
          syncStatus: source.sync_status,
          isActive: source.is_active,
        },
        'Google sync job skipped: ReviewSource is inactive or credentials revoked',
      );
      return { processed: false, reason: 'SOURCE_REVOKED_OR_INACTIVE' };
    }

    // 3. Mark state as SYNCING and link job ID
    source.sync_status = 'SYNCING';
    source.sync_job_id = job.id ? String(job.id) : null;
    source.metadata = {
      ...(source.metadata || {}),
      sync_in_progress: true,
      last_sync_started_at: new Date().toISOString(),
    };
    await source.save();

    try {
      // 4. Fetch Details from Google Places Provider
      const placeId = source.external_id || external_id;
      const details = await this.googlePlacesService.GetPlaceDetails(placeId);

      if (!details) {
        throw new Error(`Google Places API returned empty details for Place ID: ${placeId}`);
      }

      // Update place profile info
      source.name = details.name || source.name;
      source.address = details.formattedAddress || source.address;
      source.rating = details.rating !== undefined ? details.rating : source.rating;
      source.review_count =
        details.userRatingsTotal !== undefined
          ? details.userRatingsTotal
          : source.review_count;

      // 5. Idempotent Upsert of reviews
      let newlyImported = 0;
      let updatedCount = 0;
      let latestReviewDate: Date | null = checkpoint?.last_synced_review_date
        ? new Date(checkpoint.last_synced_review_date)
        : null;

      const remoteReviews = details.reviews || [];

      for (const rev of remoteReviews) {
        const revDate = rev.reviewDate ? new Date(rev.reviewDate) : new Date();
        if (!latestReviewDate || revDate > latestReviewDate) {
          latestReviewDate = revDate;
        }

        const existing = await Review.findOne({
          where: { business_id, external_id: rev.externalId },
        });

        if (existing) {
          // Idempotent update: update contents and rating if modified
          existing.author_name = rev.authorName || existing.author_name;
          existing.author_photo_url =
            rev.authorPhotoUrl !== undefined ? rev.authorPhotoUrl : existing.author_photo_url;
          existing.rating = rev.rating !== undefined ? rev.rating : existing.rating;
          existing.content = rev.text !== undefined ? rev.text : existing.content;
          existing.review_date = revDate;
          existing.original_url =
            rev.profileUrl !== undefined ? rev.profileUrl : existing.original_url;
          await existing.save();
          updatedCount++;
        } else {
          // New review creation
          const newReview = new Review();
          newReview.business_id = businessId;
          newReview.source_id = source.id;
          newReview.external_id = rev.externalId;
          newReview.author_name = rev.authorName;
          newReview.author_photo_url = rev.authorPhotoUrl || null;
          newReview.rating = rev.rating;
          newReview.content = rev.text;
          newReview.review_date = revDate;
          newReview.original_url = rev.profileUrl || null;
          newReview.is_visible = true;
          await newReview.save();
          newlyImported++;
        }
      }

      // 6. Safe Checkpoint Persistence: persist only after database records are saved
      const safeCheckpoint = {
        last_synced_review_date: latestReviewDate ? latestReviewDate.toISOString() : null,
        synced_count: remoteReviews.length,
        last_completed_at: new Date().toISOString(),
      };

      source.last_synced_at = new Date();
      source.sync_status = 'SUCCESS';
      source.last_sync_error = null;
      source.metadata = {
        ...(source.metadata || {}),
        checkpoint: safeCheckpoint,
        sync_in_progress: false,
      };
      await source.save();

      this.logger.info(
        {
          sourceId: source.id,
          businessId,
          newlyImported,
          updatedCount,
          totalFetched: remoteReviews.length,
        },
        'Google Place sync job completed successfully',
      );

      return {
        processed: true,
        source_id: source.id,
        newly_imported: newlyImported,
        updated_count: updatedCount,
        checkpoint: safeCheckpoint,
      };
    } catch (error: any) {
      // 7. Error Handling & Failure Classification
      const classification = classifyFailure(error, {
        attemptsMade: job.attemptsMade,
        maxAttempts,
      });

      this.logger.error(
        {
          sourceId: source.id,
          businessId,
          category: classification.category,
          isRetryable: classification.isRetryable,
          error: error.message,
          attempt: currentAttempt,
          maxAttempts,
        },
        `Google sync job failed: ${classification.reason}`,
      );

      // Terminal credentials / revoked consent
      if (classification.category === ErrorCategory.INVALID_CREDENTIALS) {
        source.sync_status = 'REVOKED';
        source.is_active = false;
        source.last_sync_error = classification.reason;
        source.metadata = {
          ...(source.metadata || {}),
          sync_in_progress: false,
          revoked_at: new Date().toISOString(),
        };
        await source.save();

        throw new UnrecoverableQueueError(classification);
      }

      // Terminal permanent validation error
      if (classification.category === ErrorCategory.PERMANENT_VALIDATION) {
        source.sync_status = 'FAILED';
        source.last_sync_error = classification.reason;
        source.metadata = {
          ...(source.metadata || {}),
          sync_in_progress: false,
        };
        await source.save();

        throw new UnrecoverableQueueError(classification);
      }

      // Retryable errors (RATE_LIMIT, PROVIDER_OUTAGE, SERVER_ERROR, TRANSIENT_NETWORK)
      source.sync_status = 'FAILED';
      source.last_sync_error = `[Attempt ${currentAttempt}/${maxAttempts}] ${classification.reason}`;
      source.metadata = {
        ...(source.metadata || {}),
        sync_in_progress: false,
      };
      await source.save();

      throw error;
    }
  }
}
