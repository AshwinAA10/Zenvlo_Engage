import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { PlanType, BillingCycle } from '../entities/subscription.entity';

export class CreateCheckoutOrderDto {
  @IsEnum(['GROWTH', 'ENTERPRISE'] as const)
  @IsNotEmpty()
  plan: 'GROWTH' | 'ENTERPRISE';

  @IsEnum(['MONTHLY', 'YEARLY'] as const)
  @IsOptional()
  billing_cycle?: BillingCycle = 'MONTHLY';
}

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  razorpay_order_id: string;

  @IsString()
  @IsNotEmpty()
  razorpay_payment_id: string;

  @IsString()
  @IsNotEmpty()
  razorpay_signature: string;

  @IsEnum(['GROWTH', 'ENTERPRISE'] as const)
  @IsNotEmpty()
  plan: 'GROWTH' | 'ENTERPRISE';

  @IsEnum(['MONTHLY', 'YEARLY'] as const)
  @IsOptional()
  billing_cycle?: BillingCycle = 'MONTHLY';
}

export interface PlanFeatures {
  whatsapp_requests_limit: number;
  widgets_limit: number | null; // null = unlimited
  testimonials_limit: number | null; // null = unlimited
  watermark_removed: boolean;
  google_places_sync: boolean;
}

export const PLAN_CONFIGS: Record<PlanType, { monthlyPrice: number; yearlyPrice: number; features: PlanFeatures }> = {
  FREE: {
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: {
      whatsapp_requests_limit: 50,
      widgets_limit: 1,
      testimonials_limit: 20,
      watermark_removed: false,
      google_places_sync: true,
    },
  },
  GROWTH: {
    monthlyPrice: 1499, // ₹1,499/mo
    yearlyPrice: 14990, // ₹14,990/yr (~2 months free)
    features: {
      whatsapp_requests_limit: 500,
      widgets_limit: null, // unlimited
      testimonials_limit: null, // unlimited
      watermark_removed: true,
      google_places_sync: true,
    },
  },
  ENTERPRISE: {
    monthlyPrice: 4999,
    yearlyPrice: 49990,
    features: {
      whatsapp_requests_limit: 2500,
      widgets_limit: null,
      testimonials_limit: null,
      watermark_removed: true,
      google_places_sync: true,
    },
  },
};
