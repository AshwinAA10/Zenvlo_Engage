import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { ReviewService } from './review.service';
import { ReviewSource } from '../entities/review-source.entity';
import { Review } from '../entities/review.entity';
import {
  GOOGLE_PLACES_SERVICE,
  IGooglePlacesService,
} from '../../Integration/interfaces/google-places.interface';
import { NotFoundException } from '@nestjs/common';

describe('ReviewService', () => {
  let service: ReviewService;
  let googlePlacesService: IGooglePlacesService;

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockGooglePlacesService: IGooglePlacesService = {
    SearchPlaces: jest.fn().mockResolvedValue([
      {
        placeId: 'place_123',
        name: 'Apollo Dental Indiranagar',
        formattedAddress: 'Indiranagar, Bengaluru',
        rating: 4.9,
        userRatingsTotal: 88,
      },
    ]),
    GetPlaceDetails: jest.fn().mockResolvedValue({
      placeId: 'place_123',
      name: 'Apollo Dental Indiranagar',
      formattedAddress: 'Indiranagar, Bengaluru',
      rating: 4.9,
      userRatingsTotal: 88,
      url: 'https://maps.google.com',
      reviews: [
        {
          externalId: 'g_rev_1',
          authorName: 'Arjun Das',
          authorPhotoUrl: 'https://example.com/photo.jpg',
          rating: 5,
          text: 'Superb service and painless root canal.',
          reviewDate: new Date('2026-09-01'),
        },
      ],
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: PinoLogger, useValue: mockLogger },
        {
          provide: GOOGLE_PLACES_SERVICE,
          useValue: mockGooglePlacesService,
        },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
    googlePlacesService = module.get<IGooglePlacesService>(
      GOOGLE_PLACES_SERVICE,
    );
    jest.clearAllMocks();
  });

  it('should search Google Places using provider abstraction', async () => {
    const res = await service.SearchPlaces('Apollo Dental');
    expect(res.length).toBe(1);
    expect(res[0].placeId).toBe('place_123');
    expect(googlePlacesService.SearchPlaces).toHaveBeenCalledWith('Apollo Dental');
  });

  it('should connect place and import reviews into tenant boundary', async () => {
    jest.spyOn(ReviewSource, 'findOne').mockResolvedValue(null);
    const mockSourceSave = jest.fn().mockImplementation(function (this: any) {
      this.id = 'src-1';
      return Promise.resolve(this);
    });
    jest.spyOn(ReviewSource.prototype, 'save').mockImplementation(mockSourceSave);

    jest.spyOn(Review, 'findOne').mockResolvedValue(null);
    const mockReviewSave = jest.fn().mockImplementation(function (this: any) {
      this.id = 'rev-1';
      return Promise.resolve(this);
    });
    jest.spyOn(Review.prototype, 'save').mockImplementation(mockReviewSave);

    const result = await service.ConnectPlace('biz-1', 'place_123');

    expect(result.source.name).toBe('Apollo Dental Indiranagar');
    expect(result.source.business_id).toBe('biz-1');
    expect(result.reviewsImported).toBe(1);
    expect(googlePlacesService.GetPlaceDetails).toHaveBeenCalledWith('place_123');
  });

  it('should toggle review visibility for website widgets', async () => {
    const mockReview = {
      id: 'rev-1',
      business_id: 'biz-1',
      is_visible: true,
      save: jest.fn().mockResolvedValue(true),
    };
    jest.spyOn(Review, 'findOne').mockResolvedValue(mockReview as any);

    const updated = await service.ToggleVisibility('biz-1', 'rev-1', false);
    expect(updated.is_visible).toBe(false);
    expect(mockReview.save).toHaveBeenCalled();
  });

  it('should throw NotFoundException when toggling review belonging to another tenant', async () => {
    jest.spyOn(Review, 'findOne').mockResolvedValue(null);

    await expect(
      service.ToggleVisibility('biz-1', 'foreign-id', false),
    ).rejects.toThrow(NotFoundException);
  });

  it('should calculate review stats and rating distribution accurately', async () => {
    jest.spyOn(Review, 'find').mockResolvedValue([
      { id: '1', rating: 5, is_visible: true },
      { id: '2', rating: 5, is_visible: true },
      { id: '3', rating: 4, is_visible: true },
      { id: '4', rating: 4, is_visible: false },
      { id: '5', rating: 2, is_visible: false },
    ] as any);

    const stats = await service.GetReviewStats('biz-1');

    expect(stats.total_reviews).toBe(5);
    expect(stats.visible_reviews).toBe(3);
    expect(stats.distribution['5']).toBe(2);
    expect(stats.distribution['4']).toBe(2);
    expect(stats.distribution['2']).toBe(1);
    expect(stats.average_rating).toBe(4.0); // (5+5+4+4+2)/5 = 20/5 = 4.0
  });
});
