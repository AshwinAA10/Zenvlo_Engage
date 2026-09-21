import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

@Entity('webhook_receivers')
export class WebhookReceiver extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 1000 })
  target_url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  secret_key: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  subscribed_events: string[];
}
