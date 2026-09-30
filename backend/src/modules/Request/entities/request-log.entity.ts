import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

export type RequestStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'PENDING_CONTRACT';

export type RequestChannel = 'WHATSAPP';

@Entity('request_logs')
@Index(['business_id', 'delivery_status'])
@Index(['business_id', 'created_on'])
@Index(['business_id', 'customer_id'])
@Index(['message_id'])
export class RequestLog extends TenantBaseEntity {
  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @Column({ type: 'varchar', length: 255 })
  customer_name: string;

  @Column({ type: 'varchar', length: 50 })
  customer_phone: string;

  @Column({ type: 'varchar', length: 30, default: 'WHATSAPP' })
  channel: RequestChannel;

  @Column({ type: 'varchar', length: 100, default: 'testimonial_request' })
  template_name: string;

  @Column({ type: 'varchar', length: 500 })
  testimonial_url: string;

  @Column({ type: 'text', nullable: true })
  custom_message: string | null;

  @Column({ type: 'varchar', length: 30, default: 'PENDING_CONTRACT' })
  delivery_status: RequestStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  message_id: string | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  delivered_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  read_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  testimonial_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  response_received_at: Date | null;
}
