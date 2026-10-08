import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BaseEntity,
} from 'typeorm';

export type PaymentWebhookStatus = 'PROCESSED' | 'FAILED' | 'DUPLICATE';

@Entity('payment_webhook_events')
@Index(['event_id'], { unique: true })
export class PaymentWebhookEvent extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  business_id: string | null;

  @Column({ type: 'varchar', length: 100 })
  event_id: string;

  @Column({ type: 'varchar', length: 100 })
  event_type: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  entity_id: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'varchar', length: 30, default: 'PROCESSED' })
  status: PaymentWebhookStatus;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  processed_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_on: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_on: Date;
}
