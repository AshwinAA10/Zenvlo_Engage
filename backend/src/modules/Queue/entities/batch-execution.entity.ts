import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

export type BatchStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type BatchOperationType =
  | 'WHATSAPP_TESTIMONIAL_REQUESTS'
  | 'CUSTOMER_IMPORT'
  | 'CAMPAIGN_DISPATCH'
  | string;

@Entity('batch_executions')
@Index(['business_id', 'status'])
@Index(['business_id', 'created_on'])
export class BatchExecution extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 80 })
  operation_type: BatchOperationType;

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  delivery_status: BatchStatus; // Aliased to status in business logic

  get batch_status(): BatchStatus {
    return this.delivery_status;
  }
  set batch_status(val: BatchStatus) {
    this.delivery_status = val;
  }

  @Column({ type: 'int', default: 0 })
  total_items: number;

  @Column({ type: 'int', default: 0 })
  processed_items: number;

  @Column({ type: 'int', default: 0 })
  succeeded_items: number;

  @Column({ type: 'int', default: 0 })
  failed_items: number;

  @Column({ type: 'int', default: 0 })
  skipped_items: number;

  @Column({ type: 'int', default: 50 })
  chunk_size: number;

  @Column({ type: 'int', default: 0 })
  total_chunks: number;

  @Column({ type: 'int', default: 0 })
  processed_chunks: number;

  @Column({ type: 'timestamptz', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  error_summary: string | null;
}
