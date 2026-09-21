import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

@Entity('participants')
export class Participant extends TenantBaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  conversation_id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 50, default: 'assigned_agent' })
  role: string;
}
