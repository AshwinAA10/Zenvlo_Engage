import { Injectable, ForbiddenException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Usage } from '../entities/usage.entity';
import { Subscription } from '../entities/subscription.entity';
import { Widget } from '../../Widget/entities/widget.entity';
import { Testimonial } from '../../Testimonial/entities/testimonial.entity';
import { PLAN_CONFIGS, PlanFeatures } from '../models/billing.dto';

@Injectable()
export class UsageService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(UsageService.name);
  }

  getCurrentPeriodMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  async GetOrCreateCurrentUsage(businessId: string): Promise<Usage> {
    const periodMonth = this.getCurrentPeriodMonth();
    let usage = await Usage.findOne({
      where: { business_id: businessId, period_month: periodMonth },
    });

    if (!usage) {
      // Find current subscription to set correct initial limit
      const sub = await Subscription.findOne({
        where: { business_id: businessId, subscription_status: 'ACTIVE' },
      });
      const plan = sub?.plan || 'FREE';
      const limit = PLAN_CONFIGS[plan]?.features?.whatsapp_requests_limit || 50;

      usage = new Usage();
      usage.business_id = businessId;
      usage.period_month = periodMonth;
      usage.whatsapp_requests_sent = 0;
      usage.whatsapp_requests_limit = limit;
      await usage.save();
    }

    return usage;
  }

  async CheckCanSendWhatsAppRequest(businessId: string): Promise<boolean> {
    const usage = await this.GetOrCreateCurrentUsage(businessId);
    if (usage.whatsapp_requests_sent >= usage.whatsapp_requests_limit) {
      this.logger.warn({
        msg: 'WhatsApp request limit reached for business',
        businessId,
        sent: usage.whatsapp_requests_sent,
        limit: usage.whatsapp_requests_limit,
      });
      throw new ForbiddenException(
        `Monthly WhatsApp request limit of ${usage.whatsapp_requests_limit} reached for your plan. Please upgrade to Growth for 500 requests/month.`,
      );
    }
    return true;
  }

  async IncrementWhatsAppUsage(
    businessId: string,
    count: number = 1,
  ): Promise<Usage> {
    const usage = await this.GetOrCreateCurrentUsage(businessId);
    usage.whatsapp_requests_sent += count;
    await usage.save();
    return usage;
  }

  async CheckCanCreateWidget(businessId: string): Promise<boolean> {
    const sub = await Subscription.findOne({
      where: { business_id: businessId, subscription_status: 'ACTIVE' },
    });
    const plan = sub?.plan || 'FREE';
    const widgetLimit = PLAN_CONFIGS[plan]?.features?.widgets_limit;

    if (widgetLimit !== null && widgetLimit !== undefined) {
      const currentCount = await Widget.count({
        where: { business_id: businessId },
      });
      if (currentCount >= widgetLimit) {
        throw new ForbiddenException(
          `You have reached the maximum allowed widgets (${widgetLimit}) for the ${plan} plan. Upgrade to Growth for unlimited widgets.`,
        );
      }
    }
    return true;
  }

  async CheckCanCreateTestimonial(businessId: string): Promise<boolean> {
    const sub = await Subscription.findOne({
      where: { business_id: businessId, subscription_status: 'ACTIVE' },
    });
    const plan = sub?.plan || 'FREE';
    const testimonialLimit = PLAN_CONFIGS[plan]?.features?.testimonials_limit;

    if (testimonialLimit !== null && testimonialLimit !== undefined) {
      const currentCount = await Testimonial.count({
        where: { business_id: businessId },
      });
      if (currentCount >= testimonialLimit) {
        this.logger.warn({
          msg: 'Testimonial limit reached for business',
          businessId,
          plan,
          currentCount,
          limit: testimonialLimit,
        });
        throw new ForbiddenException(
          `You have reached the maximum allowed testimonials (${testimonialLimit}) for the ${plan} plan. Upgrade to Growth for unlimited testimonials.`,
        );
      }
    }
    return true;
  }

  async SyncUsageLimitForPlan(businessId: string, plan: string): Promise<void> {
    const usage = await this.GetOrCreateCurrentUsage(businessId);
    const newLimit = PLAN_CONFIGS[plan as keyof typeof PLAN_CONFIGS]?.features?.whatsapp_requests_limit || 50;
    usage.whatsapp_requests_limit = newLimit;
    await usage.save();
  }

  async GetUsageStats(businessId: string): Promise<{
    period_month: string;
    whatsapp_requests_sent: number;
    whatsapp_requests_limit: number;
    whatsapp_requests_remaining: number;
    widgets_count: number;
    widgets_limit: number | null;
    testimonials_count: number;
    testimonials_limit: number | null;
  }> {
    const usage = await this.GetOrCreateCurrentUsage(businessId);
    const sub = await Subscription.findOne({
      where: { business_id: businessId, subscription_status: 'ACTIVE' },
    });
    const plan = sub?.plan || 'FREE';
    const features: PlanFeatures = PLAN_CONFIGS[plan]?.features || PLAN_CONFIGS.FREE.features;

    const [widgetsCount, testimonialsCount] = await Promise.all([
      Widget.count({ where: { business_id: businessId } }),
      Testimonial.count({ where: { business_id: businessId } }),
    ]);

    const remaining = Math.max(
      0,
      usage.whatsapp_requests_limit - usage.whatsapp_requests_sent,
    );

    return {
      period_month: usage.period_month,
      whatsapp_requests_sent: usage.whatsapp_requests_sent,
      whatsapp_requests_limit: usage.whatsapp_requests_limit,
      whatsapp_requests_remaining: remaining,
      widgets_count: widgetsCount,
      widgets_limit: features.widgets_limit,
      testimonials_count: testimonialsCount,
      testimonials_limit: features.testimonials_limit,
    };
  }
}
