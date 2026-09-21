import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

@Entity('webhook_events')
export class WebhookEvent extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 100 })
  event_type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  delivery_status: string;

  @Column({ type: 'smallint', default: 0 })
  delivery_attempts: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  response_summary: string | null;
}
