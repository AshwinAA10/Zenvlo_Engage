import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

@Entity('workspace_members')
export class WorkspaceMember extends TenantBaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 50, default: 'member' })
  role: string;
}
