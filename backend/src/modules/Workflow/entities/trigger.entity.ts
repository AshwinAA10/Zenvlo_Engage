import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

@Entity('workflow_triggers')
export class Trigger extends TenantBaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  workflow_id: string;

  @Column({ type: 'varchar', length: 100 })
  trigger_type: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  config: Record<string, any>;
}
