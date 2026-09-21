import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

@Entity('conversations')
export class Conversation extends TenantBaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  channel_id: string;

  @Index()
  @Column({ type: 'uuid' })
  contact_id: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_message_at: Date | null;

  @Column({ type: 'int', default: 0 })
  unread_count: number;
}
