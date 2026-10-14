import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BaseEntity,
} from 'typeorm';

export type InboundWebhookStatus =
  | 'RECEIVED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED'
  | 'IGNORED';

@Entity('inbound_webhook_events')
@Index(['provider', 'event_id'], { unique: true })
@Index(['business_id', 'status'])
@Index(['created_on'])
export class InboundWebhookEvent extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  business_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  provider: string; // 'zenvlo_engage' | 'meta_whatsapp' | 'razorpay'

  @Column({ type: 'varchar', length: 255 })
  event_id: string; // unique event ID from provider or deterministic signature hash

  @Column({ type: 'varchar', length: 100 })
  event_type: string; // 'message_status_update' | 'message_received' | ...

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'varchar', length: 30, default: 'RECEIVED' })
  status: InboundWebhookStatus;

  @Column({ type: 'smallint', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  last_error: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  job_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processed_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_on: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_on: Date;
}
