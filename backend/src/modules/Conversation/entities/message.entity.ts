import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

@Entity('messages')
export class Message extends TenantBaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  conversation_id: string;

  @Column({ type: 'varchar', length: 50 })
  sender_type: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 50, default: 'text' })
  message_type: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;
}
