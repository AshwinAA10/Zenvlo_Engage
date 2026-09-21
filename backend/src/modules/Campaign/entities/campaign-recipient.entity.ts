import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

@Entity('campaign_recipients')
export class CampaignRecipient extends TenantBaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  campaign_id: string;

  @Index()
  @Column({ type: 'uuid' })
  contact_id: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  delivery_status: string;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;
}
