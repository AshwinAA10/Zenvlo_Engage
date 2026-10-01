import {
  Injectable,
  Inject,
  NotFoundException,
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

@Injectable()
export class ReviewService {
  constructor(
    private readonly logger: PinoLogger,
    @Inject(GOOGLE_PLACES_SERVICE)
    private readonly googlePlacesService: IGooglePlacesService,
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

    const details = await this.googlePlacesService.GetPlaceDetails(
      source.external_id,
    );

    source.name = details.name;
    source.address = details.formattedAddress;
    source.rating = details.rating;
    source.review_count = details.userRatingsTotal;
    source.last_synced_at = new Date();
    await source.save();

    let newlyImported = 0;
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
        newlyImported++;
      }
    }

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
