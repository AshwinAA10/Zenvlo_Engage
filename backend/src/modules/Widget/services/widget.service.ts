import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import * as crypto from 'crypto';
import { MoreThanOrEqual } from 'typeorm';
import { Widget } from '../entities/widget.entity';
import { Business } from '../../Business/entities/business.entity';
import { Testimonial } from '../../Testimonial/entities/testimonial.entity';
import { Review } from '../../Review/entities/review.entity';
import {
  CreateWidgetDto,
  UpdateWidgetDto,
  PublicWidgetResponseDto,
  PublicSocialProofItem,
} from '../models/widget.dto';

@Injectable()
export class WidgetService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(WidgetService.name);
  }

  async CreateWidget(businessId: string, dto: CreateWidgetDto): Promise<Widget> {
    const business = await Business.findOne({ where: { id: businessId } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const embedToken = `zen_${crypto.randomBytes(16).toString('hex')}`;

    const widget = new Widget();
    widget.business_id = businessId;
    widget.name = dto.name.trim();
    widget.type = dto.type || 'WALL';
    widget.theme = dto.theme || 'DARK';
    widget.primary_color = dto.primary_color || '#10B981';
    widget.max_items = dto.max_items || 12;
    widget.min_rating = dto.min_rating !== undefined ? dto.min_rating : 4;
    widget.show_google_reviews =
      dto.show_google_reviews !== undefined ? dto.show_google_reviews : true;
    widget.show_photos =
      dto.show_photos !== undefined ? dto.show_photos : true;
    widget.show_date = dto.show_date !== undefined ? dto.show_date : true;
    widget.custom_css = dto.custom_css || null;
    widget.is_active = true;
    widget.embed_token = embedToken;
    widget.views_count = 0;

    await widget.save();

    this.logger.info({
      msg: 'Created new testimonial widget',
      businessId,
      widgetId: widget.id,
      embedToken,
    });

    return widget;
  }

  async UpdateWidget(
    businessId: string,
    id: string,
    dto: UpdateWidgetDto,
  ): Promise<Widget> {
    const widget = await Widget.findOne({
      where: { id, business_id: businessId },
    });

    if (!widget) {
      throw new NotFoundException('Widget not found or does not belong to your business');
    }

    if (dto.name !== undefined) widget.name = dto.name.trim();
    if (dto.type !== undefined) widget.type = dto.type;
    if (dto.theme !== undefined) widget.theme = dto.theme;
    if (dto.primary_color !== undefined) widget.primary_color = dto.primary_color;
    if (dto.max_items !== undefined) widget.max_items = dto.max_items;
    if (dto.min_rating !== undefined) widget.min_rating = dto.min_rating;
    if (dto.show_google_reviews !== undefined)
      widget.show_google_reviews = dto.show_google_reviews;
    if (dto.show_photos !== undefined) widget.show_photos = dto.show_photos;
    if (dto.show_date !== undefined) widget.show_date = dto.show_date;
    if (dto.custom_css !== undefined) widget.custom_css = dto.custom_css;
    if (dto.is_active !== undefined) widget.is_active = dto.is_active;

    await widget.save();
    return widget;
  }

  async DeleteWidget(
    businessId: string,
    id: string,
  ): Promise<{ success: boolean }> {
    const widget = await Widget.findOne({
      where: { id, business_id: businessId },
    });

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    await widget.remove();
    return { success: true };
  }

  async GetWidgets(businessId: string): Promise<Widget[]> {
    return Widget.find({
      where: { business_id: businessId },
      order: { created_on: 'DESC' },
    });
  }

  async GetWidgetById(businessId: string, id: string): Promise<Widget> {
    const widget = await Widget.findOne({
      where: { id, business_id: businessId },
    });

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    return widget;
  }

  async GetPublicWidgetData(
    widgetIdentifier: string,
  ): Promise<PublicWidgetResponseDto> {
    // Lookup by either UUID or embed_token
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        widgetIdentifier,
      );

    let widget: Widget | null = null;
    if (isUuid) {
      widget = await Widget.findOne({
        where: { id: widgetIdentifier, is_active: true },
      });
    }

    if (!widget) {
      widget = await Widget.findOne({
        where: { embed_token: widgetIdentifier, is_active: true },
      });
    }

    if (!widget) {
      throw new NotFoundException('Widget not found or inactive');
    }

    // Increment views count asynchronously
    try {
      await Widget.createQueryBuilder()
        .update(Widget)
        .set({ views_count: () => 'views_count + 1' })
        .where('id = :id', { id: widget.id })
        .execute();
    } catch {
      // Do not block widget rendering on view count increment
    }

    const business = await Business.findOne({
      where: { id: widget.business_id },
    });

    if (!business) {
      throw new NotFoundException('Business profile not found');
    }

    const items: PublicSocialProofItem[] = [];

    // 1. Fetch approved testimonials with customer consent
    // STRICT PRIVACY: customer_phone and customer_email are omitted!
    const testimonials = await Testimonial.find({
      where: {
        business_id: widget.business_id,
        approval_status: 'APPROVED',
        consent_given: true,
        rating: MoreThanOrEqual(widget.min_rating),
      },
      order: { created_on: 'DESC' },
      take: widget.max_items,
    });

    for (const t of testimonials) {
      items.push({
        id: t.id,
        source_type: 'TESTIMONIAL',
        author_name: t.customer_name,
        author_photo_url: null,
        rating: t.rating,
        content: t.content,
        date: t.created_on.toISOString(),
        photo_url: widget.show_photos ? t.photo_url : null,
        video_url: widget.show_photos ? t.video_url : null,
      });
    }

    // 2. Fetch verified Google reviews if enabled
    if (widget.show_google_reviews) {
      const googleReviews = await Review.find({
        where: {
          business_id: widget.business_id,
          is_visible: true,
          rating: MoreThanOrEqual(widget.min_rating),
        },
        order: { review_date: 'DESC' },
        take: widget.max_items,
      });

      for (const gr of googleReviews) {
        items.push({
          id: gr.id,
          source_type: 'GOOGLE',
          author_name: gr.author_name,
          author_photo_url: gr.author_photo_url,
          rating: gr.rating,
          content: gr.content,
          date: gr.review_date.toISOString(),
          photo_url: null,
          video_url: null,
        });
      }
    }

    // Sort combined feed by date descending and limit to max_items
    items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const finalItems = items.slice(0, widget.max_items);

    // Compute composite aggregate rating
    let totalScore = 0;
    for (const item of finalItems) {
      totalScore += item.rating;
    }
    const avgRating =
      finalItems.length > 0
        ? parseFloat((totalScore / finalItems.length).toFixed(1))
        : 5.0;

    return {
      widget: {
        id: widget.id,
        name: widget.name,
        type: widget.type,
        theme: widget.theme,
        primary_color: widget.primary_color,
        show_photos: widget.show_photos,
        show_date: widget.show_date,
        custom_css: widget.custom_css,
      },
      business: {
        name: business.name,
        slug: business.slug,
        logo_url: business.logo_url,
        category: business.category,
        rating: avgRating,
        review_count: finalItems.length,
      },
      items: finalItems,
    };
  }

  GenerateEmbedScript(): string {
    return `/**
 * Zenvlo Engage - Universal Testimonial & Review Widget Loader
 * https://zenvlo.com
 */
(function() {
  function initZenvloWidgets() {
    var containers = document.querySelectorAll('[data-zenvlo-widget], [data-widget-id], #zenvlo-engage-widget');
    if (!containers || containers.length === 0) return;

    var scriptTag = document.currentScript || document.querySelector('script[src*="widgets/embed.js"]');
    var baseUrl = 'http://localhost:3000';
    if (scriptTag && scriptTag.src) {
      var urlObj = new URL(scriptTag.src);
      baseUrl = urlObj.origin;
      // In local dev, backend is 4000 and frontend is 3000
      if (baseUrl.indexOf(':4000') !== -1) {
        baseUrl = baseUrl.replace(':4000', ':3000');
      }
    }

    containers.forEach(function(container) {
      var widgetId = container.getAttribute('data-widget-id') || container.getAttribute('data-zenvlo-widget');
      if (!widgetId) return;
      if (container.dataset.zenvloLoaded) return;
      container.dataset.zenvloLoaded = 'true';

      var iframe = document.createElement('iframe');
      iframe.src = baseUrl + '/embed/' + widgetId;
      iframe.style.width = '100%';
      iframe.style.border = 'none';
      iframe.style.overflow = 'hidden';
      iframe.style.display = 'block';
      iframe.style.minHeight = '320px';
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('loading', 'lazy');
      iframe.setAttribute('title', 'Zenvlo Engage Social Proof Widget');

      window.addEventListener('message', function(event) {
        if (event.data && event.data.zenvloWidgetId === widgetId && event.data.height) {
          iframe.style.height = event.data.height + 'px';
        }
      });

      container.innerHTML = '';
      container.appendChild(iframe);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initZenvloWidgets);
  } else {
    initZenvloWidgets();
  }
})();
`;
  }
}
