import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ReviewSource } from '../entities/review-source.entity';
import { Review } from '../entities/review.entity';
import {
  ReviewQueryDto,
  ReviewStatsDto,
} from '../models/review.dto';
import {
  GOOGLE_PLACES_SERVICE,
  IGooglePlacesService,
  IGooglePlaceSearchResult,
} from '../../Integration/interfaces/google-places.interface';
import { QueueService } from '../../Queue/services/queue.service';

@Injectable()
export class ReviewService {
  constructor(
    private readonly logger: PinoLogger,
    @Inject(GOOGLE_PLACES_SERVICE)
    private readonly googlePlacesService: IGooglePlacesService,
    @Optional()
    private readonly queueService?: QueueService,
  ) {
    this.logger.setContext(ReviewService.name);
  }

  async SearchPlaces(query: string): Promise<IGooglePlaceSearchResult[]> {
    return this.googlePlacesService.SearchPlaces(query);
  }

  async ConnectPlace(
    businessId: string,
    placeId: string,
  ): Promise<{ source: ReviewSource; reviewsImported: number }> {
    const details = await this.googlePlacesService.GetPlaceDetails(placeId);

    let source = await ReviewSource.findOne({
      where: { business_id: businessId, external_id: placeId },
    });

    if (!source) {
      source = new ReviewSource();
      source.business_id = businessId;
      source.platform = 'GOOGLE';
      source.external_id = details.placeId;
    }

    source.name = details.name;
    source.address = details.formattedAddress;
    source.rating = details.rating;
    source.review_count = details.userRatingsTotal;
    source.is_active = true;
    source.last_synced_at = new Date();
    source.metadata = {
      url: details.url,
      website: details.website,
      phoneNumber: details.phoneNumber,
    };

    await source.save();

    let importedCount = 0;
    for (const rev of details.reviews) {
      const existing = await Review.findOne({
        where: { business_id: businessId, external_id: rev.externalId },
      });

      if (!existing) {
        const review = new Review();
        review.business_id = businessId;
        review.source_id = source.id;
        review.external_id = rev.externalId;
        review.author_name = rev.authorName;
        review.author_photo_url = rev.authorPhotoUrl || null;
        review.rating = rev.rating;
        review.content = rev.text;
        review.review_date = rev.reviewDate;
        review.original_url = rev.profileUrl || null;
        review.is_visible = true;
        await review.save();
        importedCount++;
      }
    }

    this.logger.info({
      msg: 'Connected Google Place and imported reviews',
      businessId,
      placeId,
      importedCount,
    });

    return { source, reviewsImported: importedCount };
  }

  async EnqueueSync(
    businessId: string,
    sourceId: string,
  ): Promise<{ status: string; jobId?: string; message: string; source?: ReviewSource }> {
    const source = await ReviewSource.findOne({
      where: { id: sourceId, business_id: businessId },
    });

    if (!source) {
      throw new NotFoundException('Review source not found');
    }

    if (!source.is_active || source.sync_status === 'REVOKED') {
      throw new BadRequestException(
        'Review source is inactive or integration credentials have been revoked',
      );
    }

    if (source.sync_status === 'SYNCING') {
      throw new ConflictException(
        'A synchronization job is already running for this source',
      );
    }

    if (this.queueService) {
      const jobId = await this.queueService.EnqueueGoogleSync({
        workspace_id: businessId,
        business_id: businessId,
        source_id: source.id,
        external_id: source.external_id,
        checkpoint: source.metadata?.checkpoint,
      });

      source.sync_status = 'SYNCING';
      source.sync_job_id = jobId;
      await source.save();

      return {
        status: 'QUEUED',
        jobId,
        message: 'Google synchronization job enqueued successfully',
      };
    }

    // Synchronous execution fallback when queue is not configured
    const syncRes = await this.SyncReviews(businessId, sourceId);
    return {
      status: 'COMPLETED',
      message: 'Google reviews synchronized synchronously',
      source: syncRes.source,
    };
  }

  async GetSyncStatus(
    businessId: string,
    sourceId: string,
  ): Promise<{
    source_id: string;
    sync_status: string;
    last_synced_at: Date | null;
    last_sync_error: string | null;
    sync_job_id: string | null;
    checkpoint: any;
    is_active: boolean;
  }> {
    const source = await ReviewSource.findOne({
      where: { id: sourceId, business_id: businessId },
    });

    if (!source) {
      throw new NotFoundException('Review source not found');
    }

    return {
      source_id: source.id,
      sync_status: source.sync_status,
      last_synced_at: source.last_synced_at,
      last_sync_error: source.last_sync_error,
      sync_job_id: source.sync_job_id,
      checkpoint: source.metadata?.checkpoint || null,
      is_active: source.is_active,
    };
  }

  async SyncReviews(
    businessId: string,
    sourceId: string,
  ): Promise<{ source: ReviewSource; newlyImported: number }> {
    const source = await ReviewSource.findOne({
      where: { id: sourceId, business_id: businessId },
    });

    if (!source) {
      throw new NotFoundException('Review source not found');
    }

    if (!source.is_active || source.sync_status === 'REVOKED') {
      throw new BadRequestException(
        'Review source is inactive or integration credentials have been revoked',
      );
    }

    const details = await this.googlePlacesService.GetPlaceDetails(
      source.external_id,
    );

    source.name = details.name;
    source.address = details.formattedAddress;
    source.rating = details.rating;
    source.review_count = details.userRatingsTotal;

    let newlyImported = 0;
    let latestReviewDate: Date | null = null;
    for (const rev of details.reviews) {
      const revDate = rev.reviewDate ? new Date(rev.reviewDate) : new Date();
      if (!latestReviewDate || revDate > latestReviewDate) {
        latestReviewDate = revDate;
      }

      const existing = await Review.findOne({
        where: { business_id: businessId, external_id: rev.externalId },
      });

      if (!existing) {
        const review = new Review();
        review.business_id = businessId;
        review.source_id = source.id;
        review.external_id = rev.externalId;
        review.author_name = rev.authorName;
        review.author_photo_url = rev.authorPhotoUrl || null;
        review.rating = rev.rating;
        review.content = rev.text;
        review.review_date = revDate;
        review.original_url = rev.profileUrl || null;
        review.is_visible = true;
        await review.save();
        newlyImported++;
      } else {
        existing.author_name = rev.authorName || existing.author_name;
        existing.author_photo_url =
          rev.authorPhotoUrl !== undefined ? rev.authorPhotoUrl : existing.author_photo_url;
        existing.rating = rev.rating !== undefined ? rev.rating : existing.rating;
        existing.content = rev.text !== undefined ? rev.text : existing.content;
        existing.review_date = revDate;
        existing.original_url =
          rev.profileUrl !== undefined ? rev.profileUrl : existing.original_url;
        await existing.save();
      }
    }

    source.last_synced_at = new Date();
    source.sync_status = 'SUCCESS';
    source.last_sync_error = null;
    source.metadata = {
      ...(source.metadata || {}),
      checkpoint: {
        last_synced_review_date: latestReviewDate ? latestReviewDate.toISOString() : null,
        synced_count: details.reviews?.length || 0,
        last_completed_at: new Date().toISOString(),
      },
    };
    await source.save();

    this.logger.info({
      msg: 'Synced Google Place reviews',
      businessId,
      sourceId,
      newlyImported,
    });

    return { source, newlyImported };
  }

  async GetSources(businessId: string): Promise<ReviewSource[]> {
    return ReviewSource.find({
      where: { business_id: businessId },
      order: { created_on: 'DESC' },
    });
  }

  async GetReviews(
    businessId: string,
    query: ReviewQueryDto,
  ): Promise<{ data: Review[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const qb = Review.createQueryBuilder('review')
      .where('review.business_id = :businessId', { businessId })
      .orderBy('review.review_date', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.source_id) {
      qb.andWhere('review.source_id = :sourceId', {
        sourceId: query.source_id,
      });
    }

    if (query.rating) {
      qb.andWhere('review.rating = :rating', { rating: query.rating });
    }

    if (typeof query.is_visible === 'boolean') {
      qb.andWhere('review.is_visible = :isVisible', {
        isVisible: query.is_visible,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(review.author_name ILIKE :search OR review.content ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async ToggleVisibility(
    businessId: string,
    reviewId: string,
    isVisible: boolean,
  ): Promise<Review> {
    const review = await Review.findOne({
      where: { id: reviewId, business_id: businessId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    review.is_visible = isVisible;
    await review.save();
    return review;
  }

  async GetReviewStats(businessId: string): Promise<ReviewStatsDto> {
    const reviews = await Review.find({
      where: { business_id: businessId },
      select: ['id', 'rating', 'is_visible'],
    });

    const total_reviews = reviews.length;
    let visible_reviews = 0;
    let total_score = 0;
    const distribution: Record<string, number> = {
      '5': 0,
      '4': 0,
      '3': 0,
      '2': 0,
      '1': 0,
    };

    for (const r of reviews) {
      if (r.is_visible) visible_reviews++;
      total_score += r.rating;
      const key = String(r.rating);
      if (distribution[key] !== undefined) {
        distribution[key]++;
      }
    }

    const average_rating =
      total_reviews > 0 ? parseFloat((total_score / total_reviews).toFixed(1)) : 5.0;

    return {
      average_rating,
      total_reviews,
      visible_reviews,
      distribution,
    };
  }
}
