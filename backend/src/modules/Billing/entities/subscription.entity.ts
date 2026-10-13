import {
  BaseEntity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Entity,
} from 'typeorm';

export type PlanType = 'FREE' | 'GROWTH' | 'ENTERPRISE';
export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus =
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'HALTED';

@Entity('subscriptions')
@Index(['business_id'])
export class Subscription extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'varchar', length: 30, default: 'FREE' })
  plan: PlanType;

  @Column({ type: 'varchar', length: 30, default: 'MONTHLY' })
  billing_cycle: BillingCycle;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'ACTIVE' })
  subscription_status: SubscriptionStatus;

  get status_text(): SubscriptionStatus {
    return this.subscription_status;
  }

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpay_customer_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpay_subscription_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpay_order_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpay_payment_id: string | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  current_period_start: Date;

  @Column({ type: 'timestamptz' })
  current_period_end: Date;

  @Column({ type: 'boolean', default: false })
  cancel_at_period_end: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  canceled_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_on: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_on: Date;
}

