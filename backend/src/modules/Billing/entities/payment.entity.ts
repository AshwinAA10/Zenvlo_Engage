import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';
import { PlanType, BillingCycle } from './subscription.entity';

export type PaymentStatus =
  | 'CREATED'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'REFUNDED';

@Entity('payments')
@Index(['business_id'])
@Index(['razorpay_order_id'])
@Index(['razorpay_payment_id'], { unique: true })
export class Payment extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 100 })
  razorpay_order_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpay_payment_id: string | null;

  @Column({ type: 'integer' })
  amount: number; // in paise (e.g. 149900 = ₹1,499.00)

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @Column({ name: 'payment_status', type: 'varchar', length: 30, default: 'CREATED' })
  payment_status: PaymentStatus;

  @Column({ type: 'varchar', length: 30 })
  plan: PlanType;

  @Column({ type: 'varchar', length: 30, default: 'MONTHLY' })
  billing_cycle: BillingCycle;

  @Column({ type: 'varchar', length: 100, nullable: true })
  receipt: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  method: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  error_code: string | null;

  @Column({ type: 'text', nullable: true })
  error_description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  refund_id: string | null;

  @Column({ type: 'integer', nullable: true })
  refund_amount: number | null;
}
