import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { WidgetService } from './widget.service';
import { Widget } from '../entities/widget.entity';
import { Business } from '../../Business/entities/business.entity';
import { Testimonial } from '../../Testimonial/entities/testimonial.entity';
import { Review } from '../../Review/entities/review.entity';
import { NotFoundException } from '@nestjs/common';

describe('WidgetService', () => {
  let service: WidgetService;

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WidgetService,
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<WidgetService>(WidgetService);
    jest.clearAllMocks();
  });

  it('should create a widget with unique embed token', async () => {
    jest.spyOn(Business, 'findOne').mockResolvedValue({
      id: 'biz-1',
      name: 'Dr. Smile Clinic',
    } as any);

    const mockSave = jest.fn().mockImplementation(function (this: any) {
      this.id = 'w-1';
      return Promise.resolve(this);
    });
    jest.spyOn(Widget.prototype, 'save').mockImplementation(mockSave);

    const widget = await service.CreateWidget('biz-1', {
      name: 'Homepage Wall',
      type: 'WALL',
      theme: 'DARK',
      primary_color: '#10B981',
      min_rating: 4,
    });

    expect(widget.name).toBe('Homepage Wall');
    expect(widget.business_id).toBe('biz-1');
    expect(widget.embed_token).toMatch(/^zen_[0-9a-f]{32}$/);
    expect(widget.views_count).toBe(0);
  });

  it('should fetch public widget data without exposing private customer info', async () => {
    const mockWidget = {
      id: 'd3b07384-d113-494a-9c76-2e88a38b1d92',
      business_id: 'biz-1',
      name: 'Main Wall',
      type: 'WALL',
      theme: 'DARK',
      primary_color: '#10B981',
      min_rating: 4,
      max_items: 10,
      show_google_reviews: true,
      show_photos: true,
      show_date: true,
      custom_css: null,
      is_active: true,
    };
    jest.spyOn(Widget, 'findOne').mockResolvedValue(mockWidget as any);

    // Mock views count increment query builder
    const mockQb: any = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(true),
    };
    jest.spyOn(Widget, 'createQueryBuilder').mockReturnValue(mockQb);

    jest.spyOn(Business, 'findOne').mockResolvedValue({
      id: 'biz-1',
      name: 'Dr. Smile Clinic',
      slug: 'dr-smile',
      logo_url: 'https://example.com/logo.png',
      category: 'Clinic',
    } as any);

    jest.spyOn(Testimonial, 'find').mockResolvedValue([
      {
        id: 't-1',
        customer_name: 'Ananya Roy',
        customer_phone: '+919988776655', // PRIVATE
        customer_email: 'ananya@secret.com', // PRIVATE
        rating: 5,
        content: 'Loved the gentle dental treatment!',
        photo_url: 'https://example.com/photo.jpg',
        video_url: null,
        created_on: new Date('2026-09-15T10:00:00Z'),
      },
    ] as any);

    jest.spyOn(Review, 'find').mockResolvedValue([
      {
        id: 'r-1',
        author_name: 'Rahul Sharma',
        author_photo_url: 'https://example.com/rahul.jpg',
        rating: 5,
        content: 'Highly professional doctors and clean clinic.',
        review_date: new Date('2026-09-18T12:00:00Z'),
      },
    ] as any);

    const result = await service.GetPublicWidgetData('d3b07384-d113-494a-9c76-2e88a38b1d92');

    expect(result.widget.name).toBe('Main Wall');
    expect(result.business.name).toBe('Dr. Smile Clinic');
    expect(result.items.length).toBe(2);

    // Privacy Verification: phone numbers and emails must NEVER be in items
    for (const item of result.items) {
      expect((item as any).customer_phone).toBeUndefined();
      expect((item as any).customer_email).toBeUndefined();
      expect((item as any).phone).toBeUndefined();
      expect((item as any).email).toBeUndefined();
    }

    // Newest first
    expect(result.items[0].author_name).toBe('Rahul Sharma');
    expect(result.items[1].author_name).toBe('Ananya Roy');
  });

  it('should generate universal embed loader script', () => {
    const script = service.GenerateEmbedScript();
    expect(script).toContain('Zenvlo Engage - Universal Testimonial & Review Widget Loader');
    expect(script).toContain('data-widget-id');
    expect(script).toContain('/embed/');
  });
});
